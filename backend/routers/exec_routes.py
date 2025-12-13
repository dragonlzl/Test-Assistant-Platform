from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user
from ..utils import ensure_project_access, ensure_version_in_project
from sqlalchemy import func, case


router = APIRouter(prefix="/exec", tags=["execution"])


def _ensure_exec_set_access(
    db: Session, user: models.User, exec_set_id: int
) -> models.ExecSet:
    exec_set = db.query(models.ExecSet).filter(models.ExecSet.id == exec_set_id).first()
    if not exec_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="执行集不存在")
    ensure_project_access(db, user, exec_set.project_id)
    return exec_set


@router.post("/sets", response_model=schemas.ExecSetOut, status_code=status.HTTP_201_CREATED)
def create_exec_set(
    payload: schemas.ExecSetCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = ensure_project_access(db, user, payload.project_id)
    ensure_version_in_project(db, project.id, payload.version_id)
    exec_set = models.ExecSet(
        project_id=project.id,
        version_id=payload.version_id,
        name=payload.name,
        source=payload.source,
        status="active",
        created_by=user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(exec_set)
    # 先 flush，确保 log 里能拿到 exec_set.id
    db.flush()
    log_operation(
        db=db,
        user_id=user.id,
        action="create_exec_set",
        target_type="exec_set",
        target_id=exec_set.id,
        detail={"project_id": project.id, "name": payload.name},
    )
    db.commit()
    db.refresh(exec_set)
    return exec_set


@router.get("/sets", response_model=List[schemas.ExecSetOut])
def list_exec_sets(
    project_id: int = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.ExecSet)
    if project_id:
        ensure_project_access(db, user, project_id)
        query = query.filter(models.ExecSet.project_id == project_id)
    elif user.role != "admin":
        query = query.join(models.Project).join(models.UserProject).filter(
            models.UserProject.user_id == user.id
        )
    return query.order_by(models.ExecSet.id.desc()).all()


@router.get("/sets/{exec_set_id}/cases", response_model=List[schemas.ExecCaseOut])
def list_exec_cases(
    exec_set_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_exec_set_access(db, user, exec_set_id)
    cases = (
        db.query(models.ExecCase)
        .filter(models.ExecCase.exec_set_id == exec_set_id)
        .order_by(models.ExecCase.order_no.asc(), models.ExecCase.id.asc())
        .all()
    )
    return cases


@router.post(
    "/sets/{exec_set_id}/cases/from-library",
    response_model=List[schemas.ExecCaseOut],
    status_code=status.HTTP_201_CREATED,
)
def add_cases_from_library(
    exec_set_id: int,
    payload: schemas.ExecCaseCreateFromLibrary,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_set = _ensure_exec_set_access(db, user, exec_set_id)
    if not payload.case_item_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")
    items = (
        db.query(models.CaseItem)
        .join(models.CaseFile)
        .filter(models.CaseItem.id.in_(payload.case_item_ids))
        .all()
    )
    if len(items) != len(payload.case_item_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="部分用例不存在")
    for item in items:
        if item.case_file.project_id != exec_set.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="用例项目与执行集不一致"
            )
    existing = db.query(models.ExecCase).filter(models.ExecCase.exec_set_id == exec_set.id).all()
    existing_keys = set((c.module, c.title) for c in existing)
    new_cases = []
    order_base = len(existing) + 1
    for idx, item in enumerate(items):
        key = (item.module, item.title)
        if key in existing_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="执行集已存在相同模块+用例名的用例",
            )
        exec_case = models.ExecCase(
            exec_set_id=exec_set.id,
            case_item_id=item.id,
            module=item.module,
            title=item.title,
            expected=item.expected,
            actual_result=None,
            defect_link=None,
            remark=item.remark,
            status="pending",
            order_no=order_base + idx,
            executor_id=user.id,
            created_by=user.id,
            updated_by=user.id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(exec_case)
        new_cases.append(exec_case)
        # 防止同一批次请求中出现重复模块+标题，导致执行集写入重复用例。
        existing_keys.add(key)
    log_operation(
        db=db,
        user_id=user.id,
        action="add_exec_cases",
        target_type="exec_set",
        target_id=exec_set.id,
        detail={"count": len(new_cases)},
    )
    db.commit()
    for case in new_cases:
        db.refresh(case)
    return new_cases


@router.patch("/cases/{case_id}", response_model=schemas.ExecCaseOut)
def update_exec_case(
    case_id: int,
    payload: schemas.ExecCaseUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_case = db.query(models.ExecCase).filter(models.ExecCase.id == case_id).first()
    if not exec_case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="执行用例不存在")
    _ensure_exec_set_access(db, user, exec_case.exec_set_id)
    fields = [
        "module",
        "title",
        "expected",
        "actual_result",
        "defect_link",
        "remark",
        "status",
        "executor_id",
    ]
    changed = False
    for field in fields:
        value = getattr(payload, field, None)
        if value is not None and value != getattr(exec_case, field):
            db.add(
                models.ExecCaseHistory(
                    exec_case_id=exec_case.id,
                    field_changed=field,
                    old_value=getattr(exec_case, field),
                    new_value=value,
                    changed_by=user.id,
                    changed_at=datetime.now(timezone.utc),
                )
            )
            setattr(exec_case, field, value)
            changed = True
    if changed:
        exec_case.updated_by = user.id
        exec_case.updated_at = datetime.now(timezone.utc)
        db.add(exec_case)
        log_operation(
            db=db,
            user_id=user.id,
            action="update_exec_case",
            target_type="exec_case",
            target_id=exec_case.id,
        )
        db.commit()
        db.refresh(exec_case)
    return exec_case


@router.get("/overview", response_model=List[schemas.ExecOverviewOut])
def get_execution_overview(
    project_id: int,
    version_id: int = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_project_access(db, user, project_id)
    query = (
        db.query(
            models.ExecSet.project_id.label("project_id"),
            models.ExecSet.version_id.label("version_id"),
            func.coalesce(models.ExecCase.executor_id, models.ExecCase.updated_by, models.ExecCase.created_by).label(
                "user_id"
            ),
            func.count(models.ExecCase.id).label("total"),
            func.sum(case((models.ExecCase.status == "pending", 1), else_=0)).label("pending"),
            func.sum(case((models.ExecCase.status == "通过", 1), else_=0)).label("passed_cn"),
            func.sum(case((models.ExecCase.status == "failed", 1), else_=0)).label("failed_en"),
            func.sum(case((models.ExecCase.status == "失败", 1), else_=0)).label("failed_cn"),
            func.sum(case((models.ExecCase.status == "blocked", 1), else_=0)).label("blocked_en"),
            func.sum(case((models.ExecCase.status == "阻塞", 1), else_=0)).label("blocked_cn"),
            func.sum(case((models.ExecCase.status == "不适用", 1), else_=0)).label("na_cn"),
            func.sum(case((models.ExecCase.status == "not_applicable", 1), else_=0)).label("na_en"),
        )
        .join(models.ExecCase, models.ExecCase.exec_set_id == models.ExecSet.id)
        .filter(models.ExecSet.project_id == project_id)
    )
    if version_id is not None:
        query = query.filter(models.ExecSet.version_id == version_id)
    query = query.group_by("project_id", "version_id", "user_id")
    rows = query.all()
    user_ids = [row.user_id for row in rows if row.user_id is not None]
    usernames = {}
    if user_ids:
        # 执行总览需要展示“人员”，这里一次性批量取 username，避免 N+1。
        for uid, uname in db.query(models.User.id, models.User.username).filter(
            models.User.id.in_(list(set(user_ids)))
        ):
            usernames[uid] = uname
    result = []
    for row in rows:
        total_failed = (row.failed_en or 0) + (row.failed_cn or 0)
        total_blocked = (row.blocked_en or 0) + (row.blocked_cn or 0)
        total_na = (row.na_en or 0) + (row.na_cn or 0)
        passed = (row.passed_cn or 0)
        result.append(
            schemas.ExecOverviewOut(
                project_id=row.project_id,
                version_id=row.version_id,
                user_id=row.user_id,
                username=usernames.get(row.user_id) if row.user_id is not None else None,
                total=row.total or 0,
                pending=row.pending or 0,
                passed=passed,
                failed=total_failed,
                blocked=total_blocked,
                not_applicable=total_na,
            )
        )
    return result


@router.get("/overview/cases", response_model=List[schemas.ExecOverviewCaseOut])
def list_execution_overview_cases(
    project_id: int,
    version_id: int = None,
    user_id: int = None,
    limit: int = 200,
    offset: int = 0,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_project_access(db, user, project_id)
    safe_limit = max(1, min(int(limit or 200), 1000))
    safe_offset = max(0, int(offset or 0))

    assigned_user = func.coalesce(
        models.ExecCase.executor_id, models.ExecCase.updated_by, models.ExecCase.created_by
    )
    query = (
        db.query(models.ExecCase, models.ExecSet)
        .join(models.ExecSet, models.ExecSet.id == models.ExecCase.exec_set_id)
        .filter(models.ExecSet.project_id == project_id)
    )
    if version_id is not None:
        query = query.filter(models.ExecSet.version_id == version_id)
    if user_id is not None:
        query = query.filter(assigned_user == user_id)
    rows = (
        query.order_by(models.ExecCase.updated_at.desc(), models.ExecCase.id.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
    result: List[schemas.ExecOverviewCaseOut] = []
    for exec_case, exec_set in rows:
        result.append(
            schemas.ExecOverviewCaseOut(
                exec_case_id=exec_case.id,
                exec_set_id=exec_set.id,
                exec_set_name=exec_set.name,
                version_id=exec_set.version_id,
                module=exec_case.module,
                title=exec_case.title,
                status=exec_case.status,
                updated_at=exec_case.updated_at,
            )
        )
    return result
