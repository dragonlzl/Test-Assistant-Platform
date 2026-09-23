"""Result-only updates must never trigger execution-page library auto-binding."""
import copy
import json
from datetime import datetime, timezone

from fastapi import HTTPException

from . import models
from .audit import log_operation
from .routers.exec_routes import _ensure_exec_set_access, _load_json_list, _resolve_reuse_archive_status


def record_result(db, user, row, fields, reuse_detail_id=None, reuse_note=None):
    parent = _ensure_exec_set_access(db, user, row.exec_set_id)
    fields = dict(fields)
    if parent.reuse_enabled:
        details = copy.deepcopy(_load_json_list(row.reuse_details))
        detail = next((item for item in details if isinstance(item, dict) and not item.get("removed")
                       and str(item.get("id")) == reuse_detail_id), None)
        if detail is None:
            raise HTTPException(400, "复用用例须指定有效的 reuse_detail_id；请先读取执行明细，未配置时可用 add_execution_reuse_presets 新增预设子项")
        detail["status"] = fields["status"]
        detail.pop("statusOrigin", None)
        detail.pop("statusOriginProfile", None)
        if reuse_note is not None:
            detail["note"] = reuse_note
        fields["reuse_details"] = details
        fields["status"] = _resolve_reuse_archive_status(details)
    elif reuse_detail_id is not None or reuse_note is not None:
        raise HTTPException(400, "当前执行集未开启复用")
    changed = []
    now = datetime.now(timezone.utc)
    for key in ("status", "actual_result", "remark", "defect_link", "reuse_details"):
        if key not in fields or fields[key] == getattr(row, key):
            continue
        old_value, new_value = getattr(row, key), fields[key]
        if key == "reuse_details":
            old_value, new_value = json.dumps(old_value, ensure_ascii=False), json.dumps(new_value, ensure_ascii=False)
        db.add(models.ExecCaseHistory(exec_case_id=row.id, field_changed=key, old_value=old_value,
                                      new_value=new_value, changed_by=user.id, changed_at=now))
        setattr(row, key, fields[key])
        changed.append(key)
    if changed:
        row.updated_at = now
        row.updated_by = user.id
        row.executor_id = user.id
        log_operation(db, user.id, "update_exec_case", "exec_case", row.id,
                      detail={"exec_set_id": parent.id, "exec_set_name": parent.name,
                              "changed_fields": changed, "status": row.status, "result_only": True})
        db.flush()
    return row
