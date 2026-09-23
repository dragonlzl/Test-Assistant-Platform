"""Atomic preset creation/configuration and applicability execution for HTTP and MCP."""
import copy
import hashlib
import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from . import models
from .ai_operations import mark_ai_operation
from .audit import log_operation
from .reuse_applicability import detect_profile, normalize_applicability, apply_rules
from .routers.exec_routes import _ensure_exec_set_access, _ensure_exec_set_read_access, _load_json_list, _resolve_reuse_archive_status

MAX_CASES = 2000
MAX_PRESETS = 100
MAX_NEW_DETAILS = 20000


class ReuseInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Applicability(ReuseInput):
    profile: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=80)


class NewPreset(ReuseInput):
    text: str = Field(min_length=1, max_length=1000)
    applicability: Optional[Applicability] = None


class PresetChange(ReuseInput):
    preset_id: str = Field(min_length=1, max_length=255)
    applicability: Optional[Applicability] = Field(description="获取/解锁方式；null 清除配置。取值须来自读取接口返回的 profile.options。")


class ReuseWrite(ReuseInput):
    expected_revision: str = Field(pattern=r"^[a-f0-9]{64}$", description="get_execution_reuse_context 返回的 revision，包含执行集和所有执行用例的版本。")


class AddPresets(ReuseWrite):
    items: List[NewPreset] = Field(min_length=1, max_length=50)
    quick_execute: bool = Field(default=False, description="同时对本次新增子项应用不适用规则；匹配项保持未执行，不标记通过。")


class UpdatePresets(ReuseWrite):
    items: List[PresetChange] = Field(min_length=1, max_length=50)
    quick_execute: bool = Field(default=False, description="同时对本次修改子项应用规则；清除方式时恢复该子项由规则产生的不适用，保留人工结果。")


class QuickExecute(ReuseWrite):
    preset_ids: List[str] = Field(default_factory=list, max_length=100, description="只应用指定预设；省略或空数组应用全部预设。")


def _state(db, parent):
    def timestamp(value):
        # SQLite reloads UTC datetimes without tzinfo; hashes must survive flush/reload.
        utc = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
        return utc.isoformat(timespec="microseconds")

    presets = _load_json_list(parent.reuse_presets)
    project = db.get(models.Project, parent.project_id)
    versions = db.query(models.ExecCase.id, models.ExecCase.updated_at).filter_by(exec_set_id=parent.id).order_by(models.ExecCase.id).all()
    payload = [parent.id, parent.project_id, project.name, timestamp(parent.updated_at), parent.status,
               parent.reuse_enabled, presets, [[cid, timestamp(updated)] for cid, updated in versions]]
    revision = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    modules = [r[0] for r in db.query(models.ExecCase.module).filter_by(exec_set_id=parent.id).distinct()]
    return presets, detect_profile(project.name, modules, presets), len(versions), revision


def get_reuse_context(db, user, exec_set_id):
    parent = _ensure_exec_set_read_access(db, user, exec_set_id)
    presets, profile, count, revision = _state(db, parent)
    # Existing oversized data can still be inspected, without returning an unbounded payload.
    visible = []
    for preset in presets[:MAX_PRESETS]:
        if isinstance(preset, dict):
            visible.append({"id": str(preset.get("id", ""))[:255], "text": str(preset.get("text", ""))[:1000],
                            "applicability": normalize_applicability(preset.get("applicability"))})
    return {"exec_set_id": parent.id, "project_id": parent.project_id, "status": parent.status,
            "reuse_enabled": bool(parent.reuse_enabled), "can_write": bool(parent.reuse_enabled and parent.status == "active"
                and (user.role == "admin" or parent.created_by == user.id)),
            "revision": revision, "case_count": count, "presets": visible, "preset_count": len(presets),
            "presets_truncated": len(presets) > MAX_PRESETS, "profile": profile,
            "limits": {"max_cases": MAX_CASES, "max_presets": MAX_PRESETS, "max_batch": 50, "max_new_details": MAX_NEW_DETAILS}}


def _validate_applicability(value, profile):
    if value is None:
        return None
    raw = value.model_dump()
    normalized = normalize_applicability(raw)
    if not normalized or not profile or normalized["profile"] != profile["key"]:
        raise HTTPException(400, "当前执行集不支持该获取/解锁方式，请读取复用配置中的 profile 和 options")
    return normalized


def mutate_reuse(db, user, exec_set_id, request, operation, from_mcp=False):
    """Caller owns a write lock and transaction, including MCP's idempotency receipt."""
    parent = _ensure_exec_set_access(db, user, exec_set_id)
    if parent.status != "active" or not parent.reuse_enabled:
        raise HTTPException(400, "仅支持执行中的复用类型用例，请先在网页开启复用")
    presets, profile, case_count, revision = _state(db, parent)
    if revision != request.expected_revision:
        raise HTTPException(409, "执行集或用例已变更，请重新读取复用配置后再操作")
    if case_count > MAX_CASES or len(presets) > MAX_PRESETS:
        raise HTTPException(400, "执行集超出复用批量操作上限：最多 2000 条用例、100 个预设")
    ids = [str(p.get("id", "")) for p in presets if isinstance(p, dict)]
    if len(ids) != len(presets) or not all(ids) or len(set(ids)) != len(ids):
        raise HTTPException(400, "现有预设 ID 无效或重复，请先在网页整理复用配置")
    next_presets = copy.deepcopy(presets)
    by_id = {str(p["id"]): p for p in next_presets}
    selected, added = [], []
    quick = operation == "quick" or request.quick_execute
    if operation == "add":
        if len(presets) + len(request.items) > MAX_PRESETS or case_count * len(request.items) > MAX_NEW_DETAILS:
            raise HTTPException(400, "新增子项超出上限：总预设最多 100 个，单次最多新增 20000 个用例子项")
        names = {str(p.get("text", "")).strip() for p in presets}
        for item in request.items:
            if item.text in names:
                raise HTTPException(409, "已存在同名预设子项或本批次名称重复：" + item.text)
            names.add(item.text)
            preset = {"id": "reuse-preset-" + uuid4().hex, "text": item.text}
            applicability = _validate_applicability(item.applicability, profile)
            if applicability:
                preset["applicability"] = applicability
            added.append(preset)
            selected.append(preset["id"])
            by_id[preset["id"]] = preset
            next_presets.append(preset)
    elif operation == "update":
        for item in request.items:
            if item.preset_id in selected:
                raise HTTPException(400, "本批次包含重复预设 ID")
            if item.preset_id not in by_id:
                raise HTTPException(404, "预设子项不存在")
            selected.append(item.preset_id)
            applicability = _validate_applicability(item.applicability, profile)
            if applicability:
                by_id[item.preset_id]["applicability"] = applicability
            else:
                by_id[item.preset_id].pop("applicability", None)
    elif operation == "quick":
        selected = request.preset_ids or ids
        if len(selected) != len(set(selected)) or any(pid not in by_id for pid in selected):
            raise HTTPException(400, "预设 ID 重复或不属于当前执行集")
    else:
        raise ValueError("Unknown reuse operation")
    if quick and not profile:
        raise HTTPException(400, "当前执行集不支持获取/解锁方式快速执行")
    if quick and operation != "update" and not any(normalize_applicability(by_id[pid].get("applicability")) for pid in selected):
        raise HTTPException(400, "请至少为一个选中预设子项设置获取/解锁方式")

    rows = db.query(models.ExecCase).filter_by(exec_set_id=parent.id).order_by(models.ExecCase.id).all() if added or quick else []
    counts = {"added_presets": len(added), "added_details": 0, "updated_cases": 0, "auto_set": 0, "auto_cleared": 0, "conflicts": 0}
    now = datetime.now(timezone.utc)
    for row in rows:
        old_details = _load_json_list(row.reuse_details)
        details = copy.deepcopy(old_details)
        for preset in added:
            details.append({"id": "reuse-detail-" + uuid4().hex, "presetId": preset["id"], "text": preset["text"],
                            "note": "", "status": "未执行", "removed": False})
            counts["added_details"] += 1
        execution_changed = False
        if quick:
            details, stats = apply_rules(details, {pid: by_id[pid] for pid in selected}, profile["key"], row)
            for key, value in stats.items():
                counts[key] += value
            execution_changed = bool(stats["auto_set"] or stats["auto_cleared"])
        if details == old_details:
            continue
        status = _resolve_reuse_archive_status(details)
        for field, value in (("reuse_details", details), ("status", status)):
            old = getattr(row, field)
            if old == value:
                continue
            db.add(models.ExecCaseHistory(exec_case_id=row.id, field_changed=field,
                old_value=json.dumps(old, ensure_ascii=False) if field == "reuse_details" else old,
                new_value=json.dumps(value, ensure_ascii=False) if field == "reuse_details" else value,
                changed_by=user.id, changed_at=now))
            setattr(row, field, value)
        row.updated_at, row.updated_by = now, user.id
        if from_mcp:
            if added:
                mark_ai_operation(db, row, "child_added")
            if execution_changed:
                mark_ai_operation(db, row, "executed")
        counts["updated_cases"] += 1
    if next_presets != presets or counts["updated_cases"]:
        parent.reuse_presets = next_presets
        parent.updated_at = now
        log_operation(db, user.id, {"add": "add_exec_reuse_presets", "update": "update_exec_reuse_presets", "quick": "quick_execute_reuse"}[operation],
                      "exec_set", parent.id, detail={"exec_set_id": parent.id, "exec_set_name": parent.name,
                          "preset_ids": selected, "quick_execute": quick, **counts})
    db.flush()
    return {**get_reuse_context(db, user, parent.id), "affected_preset_ids": selected, "summary": counts}
