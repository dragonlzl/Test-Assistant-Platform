"""MCP-only addition review. No writes or external model calls during comparison."""
import hashlib
import hmac
import json
import re
import unicodedata
from collections import defaultdict
from typing import List, Literal, Optional

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from . import models

FIELDS = ("module", "title", "priority", "precondition", "steps", "expected", "remark")
CONTENT_FIELDS = ("module", "title", "precondition", "steps", "expected")
MAX_ROWS = 10000
MAX_TEXT = 4000000
MAX_COMPARISONS = 100000
MAX_REVIEW_ITEMS = 30
MAX_MATCHES = 3
REVIEW_INSTRUCTIONS = (
    "新增前服务端检查相似用例。返回 CASE_REVIEW_REQUIRED 时整批尚未写入，必须向用户展示相似用例、"
    "匹配原因及 differences，逐条询问 update（修改已有）、add（继续新增）、skip（跳过）。"
    "不得自行推断用户已确认或为绕过查重改写候选。用户明确选择后，在原调用中补充 similarity_review，"
    "原 items、目标和 idempotency_key 保持不变；每个待确认 item_index 都须提供 decision。"
    "update 仅修改 differences 中的显式传入字段，未传字段保留；需提供选定的 case_item_id。"
    "同文件完全重复项即使选择 add 仍会跳过。若只读摘要不足，先 get_case_items 读取全文再询问。"
    "确认过期后须展示最新对比重新询问。文本规则不保证检出所有语义重复，AI 在准备候选时发现语义相似，"
    "也须先展示差异并询问用户，不能自行决定覆盖或继续新增。"
)


class ReviewDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item_index: int = Field(ge=0, le=199, description="待新增 items 中的零起始下标。")
    action: Literal["add", "update", "skip"]
    case_item_id: Optional[int] = Field(default=None, gt=0, description="仅 update 必填，须为该条对比中返回的已有用例 ID。")


class SimilarityReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    review_token: str = Field(pattern=r"^[a-f0-9]{64}$", description="本次对比返回的令牌；用户明确选择后原样回传。")
    decisions: List[ReviewDecision] = Field(min_length=1, max_length=200)


class CaseReviewRequired(Exception):
    def __init__(self, report):
        self.report = report


def normalize(value):
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return re.sub(r"[\W_\s\u200b-\u200d\u2060\ufeff]+", "", text)


def grams(text):
    return {text[i:i + 2] for i in range(max(1, len(text) - 1))} if text else set()


def features(item):
    result = {key: normalize(item.get(key)) for key in CONTENT_FIELDS}
    result["grams"] = {key: grams(result[key]) for key in CONTENT_FIELDS}
    return result


def similarity(left, right):
    if all(left[key] == right[key] for key in CONTENT_FIELDS):
        return 1.0, "五个内容字段一致（忽略大小写、空白和标点）"
    scores = {}
    for key in CONTENT_FIELDS:
        a, b = left["grams"][key], right["grams"][key]
        scores[key] = 2 * len(a & b) / (len(a) + len(b)) if a and b else 0
    title, steps, expected = scores["title"], scores["steps"], scores["expected"]
    # A shared short title/module alone is not sufficient; business actions/results matter.
    if title >= .72 and (steps >= .55 or expected >= .65):
        return .45 * title + .30 * steps + .25 * expected, "标题与操作步骤或预期结果相近"
    if steps >= .82 and expected >= .82 and len(left["steps"]) >= 6 and len(left["expected"]) >= 4:
        return .15 * title + .45 * steps + .40 * expected, "操作步骤与预期结果高度相近"
    return None


def snapshot(row):
    return {key: getattr(row, key) for key in FIELDS}


def excerpt(value):
    text = str(value or "")
    return {"text": text[:240], "truncated": len(text) > 240}


def check_additions(db, user, token, name, args):
    """Return confirmed decisions, or raise a review response before any business writes.

    The caller holds BEGIN IMMEDIATE through checking, changes and the write receipt.
    The signed digest binds the caller, original request, explicit update fields and DB
    snapshot. It proves a comparison took place, not that a human clicked a UI button.
    """
    query = db.query(models.CaseItem, models.CaseFile).join(models.CaseFile).filter(models.CaseFile.project_id == args.project_id)
    target_file = getattr(args, "case_file_id", None)
    if target_file:
        query = query.filter(models.CaseItem.case_file_id == target_file)
    rows = query.order_by(models.CaseItem.id).limit(MAX_ROWS + 1).all()
    if len(rows) > MAX_ROWS:
        raise HTTPException(400, "相似检查范围超过 10000 条，请按目标用例文件分别追加或先整理文件规模；本次未写入")
    documents = [snapshot(row) for row, _ in rows]
    candidates = [item.model_dump() for item in args.items]
    if sum(len(str(value or "")) for item in documents + candidates for value in item.values()) > MAX_TEXT:
        raise HTTPException(400, "相似检查文本过大，请缩小批次或目标用例文件；本次未写入")
    existing_features = [features(item) for item in documents]
    inverted = defaultdict(set)
    for index, data in enumerate(existing_features):
        for key in ("title", "steps", "expected"):
            for term in data["grams"][key]:
                inverted[(key, term)].add(index)
    matches = {}
    comparisons = 0
    for index, item in enumerate(candidates):
        data = features(item)
        possible = set()
        for key in ("title", "steps", "expected"):
            for term in data["grams"][key]:
                possible.update(inverted.get((key, term), ()))
        comparisons += len(possible)
        if comparisons > MAX_COMPARISONS:
            raise HTTPException(400, "相似检查候选过多，请减小新增批次；本次未写入")
        found = []
        for other in possible:
            score = similarity(data, existing_features[other])
            if score is not None:
                found.append((other, *score))
        if found:
            matches[index] = sorted(found, key=lambda match: (-match[1], rows[match[0]][0].id))
    review = args.similarity_review
    if not matches and review is None:
        return {}
    request = args.model_dump(mode="json", exclude={"similarity_review"})
    # Explicit fields matter for update: omitted values must never erase existing data.
    request["explicit_fields"] = [sorted(item.model_fields_set) for item in args.items]
    state = [(row.id, row.case_file_id, str(row.created_at), str(row.updated_at), file.file_name_clean,
              file.version_id, documents[i]) for i, (row, file) in enumerate(rows)]
    encoded = json.dumps(["case-review-v1", user.id, name, request, state], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hmac.new(token.token_hash.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    if len(matches) > MAX_REVIEW_ITEMS:
        raise HTTPException(400, "本批超过 30 条用例需要相似确认，请拆成不超过 30 条的批次；本次未写入")
    if review is not None and not hmac.compare_digest(review.review_token, digest):
        stale = True
    else:
        stale = False
    if review is None or stale:
        entries = []
        for index, found in matches.items():
            proposed = args.items[index].model_dump(exclude_unset=True)
            summaries = []
            for other, score, reason in found[:MAX_MATCHES]:
                row, file = rows[other]
                current = documents[other]
                summaries.append({
                    "case_item_id": row.id, "case_file_id": row.case_file_id,
                    "file_name": file.file_name_clean, "version_id": file.version_id,
                    "updated_at": str(row.updated_at), "score": round(score, 3), "reason": reason,
                    "existing": {key: excerpt(current[key]) for key in CONTENT_FIELDS},
                    "differences": {key: {"before": excerpt(current[key]), "after": excerpt(value)}
                                    for key, value in proposed.items() if value != current[key]},
                })
            entries.append({"item_index": index, "candidate": {key: excerpt(item) for key, item in candidates[index].items()},
                            "match_count": len(found), "matches": summaries,
                            "matches_truncated": len(found) > MAX_MATCHES, "choices": ["update", "add", "skip"]})
        if not matches:
            raise HTTPException(409, "确认已过期且当前没有相似项，请重新读取目标版本并移除 similarity_review 后重试")
        report = {"error": {"code": "CASE_REVIEW_REQUIRED", "message": "相似用例需要用户选择，整批尚未写入"},
                  "review_token": digest, "stale_review": stale,
                  "scope": "case_file" if target_file else "project", "scope_id": target_file or args.project_id,
                  "items": entries, "instructions": REVIEW_INSTRUCTIONS}
        if len(json.dumps(report, ensure_ascii=False)) > 200000:
            raise HTTPException(400, "相似对比结果过大，请减小新增批次；本次未写入")
        raise CaseReviewRequired(report)
    decisions = {}
    update_ids = set()
    for decision in review.decisions:
        index = decision.item_index
        if index not in matches or index in decisions:
            raise HTTPException(400, "确认下标必须唯一且属于本次待确认条目")
        if decision.action == "update":
            allowed = {rows[other][0].id for other, _, _ in matches[index][:MAX_MATCHES]}
            if decision.case_item_id not in allowed or decision.case_item_id in update_ids:
                raise HTTPException(400, "修改目标须来自该条返回的相似用例，且同批不能重复修改同一目标")
            update_ids.add(decision.case_item_id)
        elif decision.case_item_id is not None:
            raise HTTPException(400, "只有 update 决策可以携带 case_item_id")
        decisions[index] = decision
    if set(decisions) != set(matches):
        raise HTTPException(400, "须提供每个待确认条目的用户选择，本次未写入")
    return decisions
