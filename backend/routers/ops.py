from datetime import datetime, timezone
from typing import List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user, require_admin


router = APIRouter(prefix="/ops", tags=["operation-logs"])


@router.get("", response_model=List[schemas.OperationLogOut])
def list_operation_logs(
    limit: int = 200,
    offset: int = 0,
    user_id: Optional[int] = None,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if limit <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="limit 必须为正数")
    if limit > 500:
        limit = 500
    query = db.query(models.OperationLog)
    if user_id is not None:
        query = query.filter(models.OperationLog.user_id == user_id)
    logs = (
        query.order_by(models.OperationLog.created_at.desc())
        .offset(offset if offset and offset > 0 else 0)
        .limit(limit)
        .all()
    )
    id_map: Dict[int, str] = {}
    ids = [log.user_id for log in logs if log.user_id]
    if ids:
        rows = db.query(models.User.id, models.User.username).filter(models.User.id.in_(ids)).all()
        id_map = {row[0]: row[1] for row in rows}

    # Best-effort enrichment: fill missing file/exec_set names for old logs so UI can show clearer targets.
    case_file_ids = set()
    exec_set_ids = set()
    for log in logs:
        if not log:
            continue
        if getattr(log, "target_type", None) == "case_file" and getattr(log, "target_id", None):
            case_file_ids.add(int(log.target_id))
        if getattr(log, "target_type", None) == "exec_set" and getattr(log, "target_id", None):
            exec_set_ids.add(int(log.target_id))
        detail = getattr(log, "detail", None)
        if isinstance(detail, dict):
            cfid = detail.get("case_file_id")
            if cfid is not None:
                try:
                    case_file_ids.add(int(cfid))
                except Exception:
                    pass
            esid = detail.get("exec_set_id")
            if esid is not None:
                try:
                    exec_set_ids.add(int(esid))
                except Exception:
                    pass

    case_file_name_by_id: Dict[int, str] = {}
    exec_set_name_by_id: Dict[int, str] = {}
    if case_file_ids:
        rows = (
            db.query(models.CaseFile.id, models.CaseFile.file_name_clean)
            .filter(models.CaseFile.id.in_(list(case_file_ids)))
            .all()
        )
        case_file_name_by_id = {int(r[0]): str(r[1] or "") for r in rows}
    if exec_set_ids:
        rows = (
            db.query(models.ExecSet.id, models.ExecSet.name)
            .filter(models.ExecSet.id.in_(list(exec_set_ids)))
            .all()
        )
        exec_set_name_by_id = {int(r[0]): str(r[1] or "") for r in rows}
    result: List[schemas.OperationLogOut] = []
    for log in logs:
        detail = log.detail
        if isinstance(detail, dict):
            # 避免在只读查询里修改 ORM JSON 引用导致 session 标记为 dirty
            detail = dict(detail)
            # case_file name补齐
            cfid = detail.get("case_file_id")
            if cfid is not None:
                try:
                    cfid_int = int(cfid)
                    if not detail.get("file_name"):
                        name = case_file_name_by_id.get(cfid_int)
                        if name:
                            detail["file_name"] = name
                    if not detail.get("case_file_name"):
                        name2 = case_file_name_by_id.get(cfid_int)
                        if name2:
                            detail["case_file_name"] = name2
                except Exception:
                    pass
            # exec_set name补齐
            if not detail.get("exec_set_name") and log.target_type == "exec_set" and log.target_id is not None:
                try:
                    esid_int = int(log.target_id)
                    name3 = exec_set_name_by_id.get(esid_int)
                    if name3:
                        detail["exec_set_name"] = name3
                except Exception:
                    pass
        result.append(
            schemas.OperationLogOut(
                id=log.id,
                user_id=log.user_id,
                username=id_map.get(log.user_id),
                action=log.action,
                target_type=log.target_type,
                target_id=log.target_id,
                result=log.result,
                detail=detail,
                created_at=log.created_at,
            )
        )
    return result


@router.post("/event", response_model=schemas.OperationLogOut, status_code=status.HTTP_201_CREATED)
def create_operation_log_event(
    payload: schemas.OperationLogEventIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    action = str(payload.action or "").strip()
    if not action:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="action 不能为空")
    entry = log_operation(
        db=db,
        user_id=user.id,
        action=action,
        target_type=(str(payload.target_type).strip() if payload.target_type is not None else None),
        target_id=payload.target_id,
        result=str(payload.result or "success").strip() or "success",
        detail=payload.detail,
    )
    db.commit()
    db.refresh(entry)
    return schemas.OperationLogOut(
        id=entry.id,
        user_id=entry.user_id,
        username=user.username,
        action=entry.action,
        target_type=entry.target_type,
        target_id=entry.target_id,
        result=entry.result,
        detail=entry.detail,
        created_at=entry.created_at if entry.created_at else datetime.now(timezone.utc),
    )
