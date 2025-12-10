from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user
from ..utils import ensure_project_access, ensure_version_in_project


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
    existing = (
        db.query(models.ExecCase)
        .filter(models.ExecCase.exec_set_id == exec_set.id)
        .all()
    )
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
            created_by=user.id,
            updated_by=user.id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(exec_case)
        new_cases.append(exec_case)
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
    fields = ["module", "title", "expected", "actual_result", "defect_link", "remark", "status"]
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
