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
    start_ms: Optional[int] = None,
    end_ms: Optional[int] = None,
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

    start_dt = None
    end_dt = None
    if start_ms is not None:
        try:
            start_num = int(start_ms)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_ms 非法")
        if start_num < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_ms 非法")
        start_dt = datetime.fromtimestamp(start_num / 1000.0, tz=timezone.utc)
    if end_ms is not None:
        try:
            end_num = int(end_ms)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_ms 非法")
        if end_num < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_ms 非法")
        end_dt = datetime.fromtimestamp(end_num / 1000.0, tz=timezone.utc)
    if start_dt and end_dt and end_dt < start_dt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_ms 不能小于 start_ms")
    if start_dt is not None:
        query = query.filter(models.OperationLog.created_at >= start_dt)
    if end_dt is not None:
        query = query.filter(models.OperationLog.created_at <= end_dt)

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
    user_target_ids = set()
    project_ids = set()
    version_ids = set()
    for log in logs:
        if not log:
            continue
        if getattr(log, "target_type", None) == "case_file" and getattr(log, "target_id", None):
            case_file_ids.add(int(log.target_id))
        if getattr(log, "target_type", None) == "exec_set" and getattr(log, "target_id", None):
            exec_set_ids.add(int(log.target_id))
        if getattr(log, "target_type", None) == "user" and getattr(log, "target_id", None):
            user_target_ids.add(int(log.target_id))
        if getattr(log, "target_type", None) == "project" and getattr(log, "target_id", None):
            project_ids.add(int(log.target_id))
        if getattr(log, "target_type", None) == "project_version" and getattr(log, "target_id", None):
            version_ids.add(int(log.target_id))
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
    user_name_by_id: Dict[int, str] = {}
    project_name_by_id: Dict[int, str] = {}
    version_name_by_id: Dict[int, str] = {}
    version_project_name_by_id: Dict[int, str] = {}
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
    if user_target_ids:
        rows = (
            db.query(models.User.id, models.User.username)
            .filter(models.User.id.in_(list(user_target_ids)))
            .all()
        )
        user_name_by_id = {int(r[0]): str(r[1] or "") for r in rows}
    if project_ids:
        rows = (
            db.query(models.Project.id, models.Project.name)
            .filter(models.Project.id.in_(list(project_ids)))
            .all()
        )
        project_name_by_id = {int(r[0]): str(r[1] or "") for r in rows}
    if version_ids:
        rows = (
            db.query(models.ProjectVersion.id, models.ProjectVersion.name, models.Project.name)
            .join(models.Project, models.Project.id == models.ProjectVersion.project_id)
            .filter(models.ProjectVersion.id.in_(list(version_ids)))
            .all()
        )
        version_name_by_id = {int(r[0]): str(r[1] or "") for r in rows}
        version_project_name_by_id = {int(r[0]): str(r[2] or "") for r in rows}
    result: List[schemas.OperationLogOut] = []
    for log in logs:
        detail_raw = log.detail
        # 避免在只读查询里修改 ORM JSON 引用导致 session 标记为 dirty
        detail = dict(detail_raw) if isinstance(detail_raw, dict) else None

        def ensure_detail():
            nonlocal detail
            if detail is None:
                if detail_raw is not None and not isinstance(detail_raw, dict):
                    detail = {"raw_detail": detail_raw}
                else:
                    detail = {}
            return detail

        def set_detail_if_missing(key: str, value: Optional[str]):
            if not value:
                return
            payload = ensure_detail()
            if not payload.get(key):
                payload[key] = value

        def set_detail_id_if_missing(key: str, value):
            if value is None:
                return
            payload = ensure_detail()
            if key not in payload:
                payload[key] = value

        # case_file name补齐（既支持 detail.case_file_id，也支持 target_id）
        cfid = None
        if detail:
            cfid = detail.get("case_file_id")
        if cfid is None and log.target_type == "case_file" and log.target_id is not None:
            cfid = log.target_id
            try:
                set_detail_id_if_missing("case_file_id", int(log.target_id))
            except Exception:
                pass
        if cfid is not None:
            try:
                cfid_int = int(cfid)
                name = case_file_name_by_id.get(cfid_int)
                if name:
                    set_detail_if_missing("file_name", name)
                    set_detail_if_missing("case_file_name", name)
                    set_detail_if_missing("file_name_clean", name)
            except Exception:
                pass

        # exec_set name补齐
        exec_set_id = None
        if detail:
            exec_set_id = detail.get("exec_set_id")
        if exec_set_id is None and log.target_type == "exec_set" and log.target_id is not None:
            exec_set_id = log.target_id
        if exec_set_id is not None:
            try:
                esid_int = int(exec_set_id)
                name3 = exec_set_name_by_id.get(esid_int)
                if name3:
                    set_detail_if_missing("exec_set_name", name3)
            except Exception:
                pass

        # user/project/version name补齐
        if log.target_type == "user" and log.target_id is not None:
            try:
                uid = int(log.target_id)
                uname = user_name_by_id.get(uid)
                if uname:
                    set_detail_if_missing("username", uname)
            except Exception:
                pass
        if log.target_type == "project" and log.target_id is not None:
            try:
                pid = int(log.target_id)
                pname = project_name_by_id.get(pid)
                if pname:
                    set_detail_if_missing("name", pname)
                    set_detail_if_missing("project_name", pname)
            except Exception:
                pass
        if log.target_type == "project_version" and log.target_id is not None:
            try:
                vid = int(log.target_id)
                vname = version_name_by_id.get(vid)
                if vname:
                    set_detail_if_missing("name", vname)
                    set_detail_if_missing("version_name", vname)
                p2 = version_project_name_by_id.get(vid)
                if p2:
                    set_detail_if_missing("project_name", p2)
            except Exception:
                pass
        if detail is None:
            detail = detail_raw
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
