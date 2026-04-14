import hashlib
import json
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request


_CACHE_TTL_SECONDS = 180
_FETCH_TIMEOUT_SECONDS = 8
_MAX_HITS = 120
_MAX_CONTEXT_CHARS = 12000
_MAX_SUMMARY_CHARS = 160
_MAX_CHUNK_CHARS = 1400
_DEFAULT_GENERIC_TERMS = {
    "需求",
    "功能",
    "模块",
    "场景",
    "测试",
    "用例",
    "页面",
    "系统",
    "流程",
    "支持",
    "相关",
    "逻辑",
    "配置",
    "规则",
    "界面",
}

_CACHE_LOCK = threading.Lock()
_INDEX_CACHE: Dict[str, Dict[str, Any]] = {}

_IMAGE_RE = re.compile(r"\[图片:\s*([^\]]+?)\]")
_TRAILING_PNG_RE = re.compile(r"\.(png|jpg|jpeg|gif|webp|svg)$", re.IGNORECASE)
_MULTI_SPACE_RE = re.compile(r"\s+")
_CLEAN_TOKEN_RE = re.compile(r"[\s\W_]+", re.UNICODE)
_TERM_RE = re.compile(r"[\u4e00-\u9fffA-Za-z0-9·_-]{2,24}")
_GENERIC_SPLIT_RE = re.compile(r"[，。；：、\s/\\|()\[\]{}<>“”\"'`]+")


class _NoRedirectHandler(urllib_request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class KnowledgeBaseError(Exception):
    def __init__(self, status_code: str, reason: str):
        super().__init__(reason)
        self.status_code = status_code
        self.reason = reason


def normalize_knowledge_base_url(raw_url: Optional[str]) -> str:
    url = str(raw_url or "").strip()
    if not url:
        return ""
    while len(url) > 1 and url.endswith("/"):
        url = url[:-1]
    parsed = urllib_parse.urlparse(url)
    scheme = str(parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise KnowledgeBaseError("invalid_url", "知识库地址仅支持 http/https")
    if not parsed.netloc:
        raise KnowledgeBaseError("invalid_url", "知识库地址格式不正确")
    return url


def query_knowledge_base(payload: Dict[str, Any]) -> Dict[str, Any]:
    base_url = ""
    try:
        base_url = normalize_knowledge_base_url(payload.get("base_url"))
    except KnowledgeBaseError as exc:
        return build_empty_query_result(exc.status_code, exc.reason)

    if not base_url:
        return build_empty_query_result("disabled", "未配置知识库地址")

    try:
        contract = _load_contract(base_url)
        query = _build_query(payload, base_url)
        hits = _score_entries(contract["entries"], query)
        if not hits:
            return build_empty_query_result(
                "no_match",
                "未找到与当前需求相关的知识库内容",
                manifest_meta=contract["manifest_meta"],
            )
        compressed = _compress_hits(hits)
        return {
            "used": compressed["used"] is True,
            "status": "ok",
            "reason": "知识库检索命中",
            "match_count": len(hits),
            "used_chunk_count": compressed["used_chunk_count"],
            "used_doc_count": compressed["used_doc_count"],
            "context_text": compressed["context_text"],
            "hits": compressed["hits"],
            "manifest_meta": contract["manifest_meta"],
        }
    except KnowledgeBaseError as exc:
        return build_empty_query_result(exc.status_code, exc.reason)


def build_empty_query_result(
    status_code: str,
    reason: str,
    manifest_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "used": False,
        "status": status_code,
        "reason": str(reason or ""),
        "match_count": 0,
        "used_chunk_count": 0,
        "used_doc_count": 0,
        "context_text": "",
        "hits": [],
        "manifest_meta": manifest_meta or {},
    }


def _build_query(payload: Dict[str, Any], base_url: str) -> Dict[str, Any]:
    requirement_label = str(payload.get("requirement_label") or "").strip()
    requirement_text = str(payload.get("requirement_text") or "").strip()
    module_title = str(payload.get("module_title") or "").strip()
    action_scope = str(payload.get("action_scope") or "").strip()
    action_mode = str(payload.get("action_mode") or "").strip()

    label_norm = _normalize_match_text(requirement_label)
    module_norm = _normalize_match_text(module_title)
    requirement_norm = _normalize_match_text(requirement_text)
    term_list = _extract_query_terms(
        [requirement_label, module_title, requirement_text],
        exclude_terms=[label_norm, module_norm],
    )

    return {
        "base_url": base_url,
        "requirement_label": requirement_label,
        "requirement_text": requirement_text,
        "module_title": module_title,
        "action_scope": action_scope,
        "action_mode": action_mode,
        "label_norm": label_norm,
        "module_norm": module_norm,
        "requirement_norm": requirement_norm,
        "terms": term_list,
    }


def _load_contract(base_url: str) -> Dict[str, Any]:
    cache_key = str(base_url or "")
    now = time.time()
    with _CACHE_LOCK:
        cached = _INDEX_CACHE.get(cache_key)
        if cached and float(cached.get("expires_at") or 0) > now:
            return cached["value"]

    manifest_url = base_url + "/kb-manifest.json"
    manifest = _fetch_json(manifest_url, not_found_status="manifest_missing")
    manifest_meta = _normalize_manifest_meta(manifest, base_url)
    index_url = _resolve_manifest_index_url(manifest, base_url)
    index_payload = _fetch_json(index_url, not_found_status="index_invalid")
    entries = _normalize_search_entries(index_payload)
    if not entries:
        raise KnowledgeBaseError("index_invalid", "知识库索引为空或格式不正确")
    value = {
        "manifest_meta": manifest_meta,
        "entries": entries,
    }
    with _CACHE_LOCK:
        _INDEX_CACHE[cache_key] = {
            "expires_at": now + _CACHE_TTL_SECONDS,
            "value": value,
        }
    return value


def _fetch_json(url: str, not_found_status: str) -> Any:
    request_obj = urllib_request.Request(
        url=url,
        headers={
            "Accept": "application/json,text/plain,*/*",
            "User-Agent": "tap-knowledge-base/1.0",
        },
        method="GET",
    )
    opener = urllib_request.build_opener(_NoRedirectHandler())
    try:
        with opener.open(request_obj, timeout=_FETCH_TIMEOUT_SECONDS) as response:
            raw = response.read()
    except urllib_error.HTTPError as exc:
        if int(exc.code or 0) == 404:
            if not_found_status == "manifest_missing":
                raise KnowledgeBaseError("manifest_missing", "未找到 kb-manifest.json") from exc
            raise KnowledgeBaseError("index_invalid", "知识库索引文件不存在") from exc
        if 300 <= int(exc.code or 0) < 400:
            raise KnowledgeBaseError("unreachable", "知识库地址发生重定向，无法稳定读取") from exc
        raise KnowledgeBaseError("unreachable", "知识库服务访问失败") from exc
    except urllib_error.URLError as exc:
        raise KnowledgeBaseError("unreachable", "知识库服务不可达") from exc
    except TimeoutError as exc:
        raise KnowledgeBaseError("unreachable", "知识库服务连接超时") from exc
    except Exception as exc:
        raise KnowledgeBaseError("unreachable", "知识库请求失败") from exc

    try:
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        if not_found_status == "manifest_missing":
            raise KnowledgeBaseError("manifest_missing", "kb-manifest.json 不是合法 JSON") from exc
        raise KnowledgeBaseError("index_invalid", "知识库索引不是合法 JSON") from exc


def _normalize_manifest_meta(manifest: Any, base_url: str) -> Dict[str, Any]:
    source = manifest if isinstance(manifest, dict) else {}
    return {
        "base_url": base_url,
        "version": source.get("version") if isinstance(source, dict) else None,
        "generated_at": str(source.get("generated_at") or source.get("generatedAt") or ""),
        "index_path": str(source.get("index_path") or source.get("search_index_path") or ""),
        "docs_dir": str(source.get("docs_dir") or source.get("clean_docs_dir") or ""),
        "doc_count": int(source.get("doc_count") or source.get("document_count") or 0),
        "entry_count": int(source.get("entry_count") or source.get("chunk_count") or 0),
    }


def _resolve_manifest_index_url(manifest: Any, base_url: str) -> str:
    source = manifest if isinstance(manifest, dict) else {}
    index_path = (
        source.get("index_path")
        or source.get("search_index_path")
        or source.get("search_index")
        or ""
    )
    if not index_path and isinstance(source.get("index"), dict):
        index_path = source.get("index", {}).get("path") or ""
    path_text = str(index_path or "").strip()
    if not path_text:
        raise KnowledgeBaseError("index_invalid", "kb-manifest.json 缺少索引路径")
    parsed = urllib_parse.urlparse(path_text)
    if str(parsed.scheme or "").lower() in ("http", "https"):
        return path_text
    return urllib_parse.urljoin(base_url + "/", path_text.lstrip("/"))


def _normalize_search_entries(index_payload: Any) -> List[Dict[str, Any]]:
    raw_entries = []
    if isinstance(index_payload, list):
        raw_entries = index_payload
    elif isinstance(index_payload, dict):
        if isinstance(index_payload.get("entries"), list):
            raw_entries = index_payload.get("entries") or []
        elif isinstance(index_payload.get("items"), list):
            raw_entries = index_payload.get("items") or []
    if not isinstance(raw_entries, list):
        raise KnowledgeBaseError("index_invalid", "知识库索引 entries 格式不正确")

    normalized = []
    for order, item in enumerate(raw_entries):
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        text = str(item.get("text") or item.get("content") or "").strip()
        clean_path = str(item.get("clean_path") or item.get("path") or "").strip()
        doc_id = str(item.get("doc_id") or "").strip()
        if not doc_id:
            doc_id = clean_path or title or ("doc-" + str(order + 1))
        if not title:
            title = doc_id.split("/")[-1] if doc_id else ("文档" + str(order + 1))
        if not text:
            continue
        aliases = _normalize_string_list(item.get("aliases"))
        keywords = _normalize_string_list(item.get("keywords"))
        summary = str(item.get("summary") or "").strip()
        heading = str(item.get("heading") or title or "").strip()
        module = str(item.get("module") or "").strip()
        chunk_index = _safe_int(item.get("chunk_index"), order)
        normalized.append(
            {
                "doc_id": doc_id,
                "module": module,
                "title": title,
                "aliases": aliases,
                "keywords": keywords,
                "summary": summary,
                "heading": heading,
                "text": text,
                "clean_path": clean_path,
                "chunk_index": chunk_index,
                "source_order": order,
                "title_norm": _normalize_match_text(title),
                "module_norm": _normalize_match_text(module),
                "heading_norm": _normalize_match_text(heading),
                "summary_norm": _normalize_match_text(summary),
                "text_norm": _normalize_match_text(text),
                "aliases_norm": [_normalize_match_text(value) for value in aliases],
                "keywords_norm": [_normalize_match_text(value) for value in keywords],
            }
        )
    return normalized


def _normalize_string_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        text = str(item or "").strip()
        if text:
            result.append(text)
    return result


def _safe_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
        return parsed
    except Exception:
        return int(fallback or 0)


def _extract_query_terms(texts: List[str], exclude_terms: Optional[List[str]] = None) -> List[str]:
    excluded = set()
    for item in exclude_terms or []:
        normalized = _normalize_match_text(item)
        if normalized:
            excluded.add(normalized)
    seen = set()
    result = []
    for raw_text in texts:
        text = str(raw_text or "").strip()
        if not text:
            continue
        for piece in _GENERIC_SPLIT_RE.split(text):
            token = str(piece or "").strip()
            if not token:
                continue
            normalized = _normalize_match_text(token)
            if not normalized or normalized in seen or normalized in excluded:
                continue
            if normalized in _DEFAULT_GENERIC_TERMS:
                continue
            seen.add(normalized)
            result.append(normalized)
    result.sort(key=len, reverse=True)
    return result[:48]


def _normalize_match_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    text = _IMAGE_RE.sub(lambda match: _strip_image_suffix(match.group(1)), text)
    text = _CLEAN_TOKEN_RE.sub("", text)
    return text


def _strip_image_suffix(text: str) -> str:
    value = str(text or "").strip()
    value = _TRAILING_PNG_RE.sub("", value)
    return value


def _score_entries(entries: List[Dict[str, Any]], query: Dict[str, Any]) -> List[Dict[str, Any]]:
    hits = []
    for entry in entries:
        hit = _score_single_entry(entry, query)
        if hit:
            hits.append(hit)
    hits.sort(
        key=lambda item: (
            -float(item.get("score") or 0),
            str(item["entry"].get("doc_id") or ""),
            int(item["entry"].get("chunk_index") or 0),
            int(item["entry"].get("source_order") or 0),
        )
    )
    return hits[:_MAX_HITS]


def _score_single_entry(entry: Dict[str, Any], query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    score = 0.0
    reasons = []
    title_norm = entry.get("title_norm") or ""
    aliases_norm = entry.get("aliases_norm") or []
    keywords_norm = entry.get("keywords_norm") or []
    module_norm = entry.get("module_norm") or ""
    heading_norm = entry.get("heading_norm") or ""
    summary_norm = entry.get("summary_norm") or ""
    text_norm = entry.get("text_norm") or ""
    label_norm = query.get("label_norm") or ""
    module_query_norm = query.get("module_norm") or ""

    if label_norm:
        title_score = _calculate_field_score(label_norm, title_norm, 620, 520, 420)
        if title_score > 0:
            score += title_score
            reasons.append("title")

        alias_score = _calculate_list_score(label_norm, aliases_norm, 420, 320, 260)
        if alias_score > 0:
            score += alias_score
            reasons.append("alias")

        keyword_score = _calculate_list_score(label_norm, keywords_norm, 300, 220, 180)
        if keyword_score > 0:
            score += keyword_score
            reasons.append("keyword")

        if label_norm and (
            label_norm in heading_norm
            or label_norm in summary_norm
            or label_norm in text_norm
        ):
            score += 120
            reasons.append("body")

    if module_query_norm:
        module_score = _calculate_field_score(module_query_norm, module_norm, 520, 420, 320)
        if module_score > 0:
            score += module_score
            reasons.append("module")

        module_title_score = _calculate_field_score(module_query_norm, title_norm, 380, 280, 220)
        if module_title_score > 0:
            score += module_title_score
            reasons.append("module-title")

        module_alias_score = _calculate_list_score(module_query_norm, aliases_norm, 300, 220, 160)
        if module_alias_score > 0:
            score += module_alias_score
            reasons.append("module-alias")

    for term in query.get("terms") or []:
        if not term:
            continue
        if title_norm and term == title_norm:
            score += 120
            reasons.append("term-title")
            continue
        if title_norm and term in title_norm:
            score += 48
            reasons.append("term-title")
            continue
        if _contains_in_list(term, aliases_norm):
            score += 40
            reasons.append("term-alias")
            continue
        if _contains_in_list(term, keywords_norm):
            score += 28
            reasons.append("term-keyword")
            continue
        if term in heading_norm:
            score += 18
            reasons.append("term-heading")
            continue
        if term in summary_norm:
            score += 14
            reasons.append("term-summary")
            continue
        if term in text_norm:
            score += 8
            reasons.append("term-body")

    if score <= 0:
        return None
    unique_reasons = []
    seen = set()
    for item in reasons:
        if item in seen:
            continue
        seen.add(item)
        unique_reasons.append(item)
    return {
        "entry": entry,
        "score": round(score, 2),
        "reasons": unique_reasons,
    }


def _calculate_field_score(query_norm: str, field_norm: str, exact: int, contain: int, overlap: int) -> float:
    if not query_norm or not field_norm:
        return 0.0
    if query_norm == field_norm:
        return float(exact)
    if query_norm in field_norm or field_norm in query_norm:
        return float(contain)
    if _has_overlap(query_norm, field_norm):
        return float(overlap)
    return 0.0


def _calculate_list_score(query_norm: str, values: List[str], exact: int, contain: int, overlap: int) -> float:
    best = 0.0
    for item in values or []:
        current = _calculate_field_score(query_norm, item, exact, contain, overlap)
        if current > best:
            best = current
    return best


def _contains_in_list(term: str, values: List[str]) -> bool:
    for item in values or []:
        if term == item or term in item or item in term:
            return True
    return False


def _has_overlap(left: str, right: str) -> bool:
    if not left or not right:
        return False
    common = 0
    for token in _TERM_RE.findall(left):
        if token and token in right:
            common += 1
            if common >= 1:
                return True
    return False


def _compress_hits(hits: List[Dict[str, Any]]) -> Dict[str, Any]:
    doc_groups = _group_hits_by_doc(hits)
    used_doc_ids = set()
    used_chunk_keys = set()
    seen_lines = set()
    context_blocks = []
    current_size = 0

    for group in doc_groups:
        doc_block, used_chunk_count = _build_doc_context_block(group, seen_lines)
        if not doc_block:
            continue
        block_len = len(doc_block)
        if current_size and (current_size + 2 + block_len) > _MAX_CONTEXT_CHARS:
            continue
        if not current_size and block_len > _MAX_CONTEXT_CHARS:
            doc_block = doc_block[:_MAX_CONTEXT_CHARS].rstrip()
            block_len = len(doc_block)
        if not doc_block:
            continue
        context_blocks.append(doc_block)
        current_size += block_len + (2 if current_size else 0)
        used_doc_ids.add(group["doc_id"])
        for hit in group["hits"]:
            used_chunk_keys.add(
                str(hit["entry"].get("doc_id") or "") + "#" + str(hit["entry"].get("chunk_index") or 0)
            )
        if current_size >= _MAX_CONTEXT_CHARS:
            break

    context_text = "\n\n".join(context_blocks).strip()
    serialized_hits = []
    for hit in hits:
        entry = hit["entry"]
        chunk_key = str(entry.get("doc_id") or "") + "#" + str(entry.get("chunk_index") or 0)
        serialized_hits.append(
            {
                "doc_id": entry.get("doc_id"),
                "module": entry.get("module"),
                "title": entry.get("title"),
                "heading": entry.get("heading"),
                "clean_path": entry.get("clean_path"),
                "score": hit.get("score"),
                "reasons": hit.get("reasons") or [],
                "used": chunk_key in used_chunk_keys,
            }
        )

    return {
        "used": bool(context_text),
        "context_text": context_text,
        "used_doc_count": len(used_doc_ids),
        "used_chunk_count": len(
            [item for item in serialized_hits if item.get("used") is True]
        ),
        "hits": serialized_hits,
    }


def _group_hits_by_doc(hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    mapping: Dict[str, Dict[str, Any]] = {}
    for hit in hits:
        entry = hit["entry"]
        doc_id = str(entry.get("doc_id") or "")
        bucket = mapping.get(doc_id)
        if not bucket:
            bucket = {
                "doc_id": doc_id,
                "module": entry.get("module"),
                "title": entry.get("title"),
                "summary": entry.get("summary"),
                "clean_path": entry.get("clean_path"),
                "best_score": float(hit.get("score") or 0),
                "hits": [],
            }
            mapping[doc_id] = bucket
        bucket["best_score"] = max(bucket["best_score"], float(hit.get("score") or 0))
        bucket["hits"].append(hit)

    groups = list(mapping.values())
    for group in groups:
        group["hits"].sort(
            key=lambda item: (
                int(item["entry"].get("chunk_index") or 0),
                -float(item.get("score") or 0),
            )
        )
    groups.sort(
        key=lambda item: (
            -float(item.get("best_score") or 0),
            str(item.get("title") or ""),
            str(item.get("doc_id") or ""),
        )
    )
    return groups


def _build_doc_context_block(group: Dict[str, Any], seen_lines: set) -> Tuple[str, int]:
    lines = []
    title = str(group.get("title") or "")
    module = str(group.get("module") or "")
    summary = _truncate_text(str(group.get("summary") or ""), _MAX_SUMMARY_CHARS)
    clean_path = str(group.get("clean_path") or "")

    header = title
    if module:
        header = module + " / " + header if header else module
    if header:
        lines.append("文档：" + header)
    if clean_path:
        lines.append("路径：" + clean_path)
    if summary:
        lines.append("摘要：" + summary)

    chunk_blocks = []
    used_chunk_count = 0
    for hit in group.get("hits") or []:
        entry = hit["entry"]
        heading = str(entry.get("heading") or entry.get("title") or "").strip()
        text = _prepare_chunk_text(str(entry.get("text") or ""), seen_lines)
        if not text:
            continue
        used_chunk_count += 1
        chunk_blocks.append("[" + heading + "]\n" + text)

    if not chunk_blocks:
        return "", 0

    lines.append("相关内容：")
    lines.extend(chunk_blocks)
    return "\n".join(lines).strip(), used_chunk_count


def _prepare_chunk_text(text: str, seen_lines: set) -> str:
    source = str(text or "").strip()
    if not source:
        return ""
    lines = []
    for raw_line in source.splitlines():
        line = _MULTI_SPACE_RE.sub(" ", str(raw_line or "").strip())
        if not line:
            continue
        if line in seen_lines:
            continue
        seen_lines.add(line)
        lines.append(line)
    joined = "\n".join(lines).strip()
    return _truncate_text(joined, _MAX_CHUNK_CHARS)


def _truncate_text(text: str, limit: int) -> str:
    value = str(text or "").strip()
    if not value or limit <= 0:
        return ""
    if len(value) <= limit:
        return value
    return value[: max(0, limit - 1)].rstrip() + "…"


def build_query_signature(payload: Dict[str, Any]) -> str:
    body = {
        "base_url": str(payload.get("base_url") or "").strip(),
        "requirement_label": str(payload.get("requirement_label") or "").strip(),
        "requirement_text": str(payload.get("requirement_text") or "").strip(),
        "module_title": str(payload.get("module_title") or "").strip(),
        "action_scope": str(payload.get("action_scope") or "").strip(),
        "action_mode": str(payload.get("action_mode") or "").strip(),
    }
    serialized = json.dumps(body, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(serialized.encode("utf-8")).hexdigest()
