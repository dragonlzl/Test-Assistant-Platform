from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user
from ..utils import ensure_project_access


router = APIRouter(prefix="/missing-modules", tags=["missing-cases"])
types_router = APIRouter(prefix="/missing-types", tags=["missing-cases"])


def _normalize_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_type_id(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    try:
        val = int(value)
    except (TypeError, ValueError):
        return None
    if val <= 0:
        return None
    return val


def _parse_type_ids(value: Optional[str]) -> List[int]:
    if not value:
        return []
    result = []
    seen = set()
    for part in str(value).split(","):
        part = str(part or "").strip()
        if not part:
            continue
        try:
            val = int(part)
        except (TypeError, ValueError):
            continue
        if val <= 0 or val in seen:
            continue
        seen.add(val)
        result.append(val)
    return result


def _ensure_missing_module_access(
    db: Session, user: models.User, module_id: int
) -> models.MissingModule:
    module = (
        db.query(models.MissingModule)
        .filter(models.MissingModule.id == int(module_id))
        .first()
    )
    if not module:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模块不存在")
    ensure_project_access(db, user, module.project_id)
    return module


@router.get("", response_model=List[schemas.MissingModuleOut])
def list_missing_modules(
    project_id: Optional[int] = None,
    type_ids: Optional[str] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_query = db.query(models.MissingModule)
    if project_id is not None:
        ensure_project_access(db, user, project_id)
        base_query = base_query.filter(models.MissingModule.project_id == project_id)
    elif user.role != "admin":
        base_query = base_query.join(
            models.UserProject, models.UserProject.project_id == models.MissingModule.project_id
        ).filter(models.UserProject.user_id == user.id)

    selected_type_ids = _parse_type_ids(type_ids)
    if selected_type_ids:
        base_query = base_query.join(
            models.MissingCaseItem, models.MissingCaseItem.module_id == models.MissingModule.id
        ).filter(models.MissingCaseItem.type_id.in_(selected_type_ids))

    item_count_query = db.query(
        models.MissingCaseItem.module_id.label("module_id"),
        func.count(models.MissingCaseItem.id).label("item_count"),
    )
    if selected_type_ids:
        item_count_query = item_count_query.filter(
            models.MissingCaseItem.type_id.in_(selected_type_ids)
        )
    item_count_sq = item_count_query.group_by(models.MissingCaseItem.module_id).subquery()

    rows = (
        base_query.with_entities(
            models.MissingModule,
            item_count_sq.c.item_count.label("item_count"),
        )
        .outerjoin(item_count_sq, item_count_sq.c.module_id == models.MissingModule.id)
        .distinct()
        .order_by(models.MissingModule.id.asc())
        .all()
    )
    result = []
    for row in rows:
        module, item_count = row
        result.append(
            {
                "id": module.id,
                "project_id": module.project_id,
                "name": module.name,
                "item_count": int(item_count or 0),
                "created_at": module.created_at,
                "updated_at": module.updated_at,
            }
        )
    return result


@router.post("", response_model=schemas.MissingModuleOut, status_code=status.HTTP_201_CREATED)
def create_missing_module(
    payload: schemas.MissingModuleCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = ensure_project_access(db, user, payload.project_id)
    name = _normalize_text(payload.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模块名不能为空")
    now = datetime.now(timezone.utc)
    module = models.MissingModule(
        project_id=project.id,
        name=name,
        created_by=user.id,
        updated_by=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(module)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="missing_module_duplicate"
        )
    db.refresh(module)
    log_operation(
        db=db,
        user_id=user.id,
        action="create_missing_module",
        target_type="missing_module",
        target_id=module.id,
        detail={"project_id": project.id, "module_name": module.name},
    )
    return module


@router.get("/{module_id}/items", response_model=List[schemas.MissingCaseItemOut])
def list_missing_items(
    module_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = _ensure_missing_module_access(db, user, module_id)
    items = (
        db.query(models.MissingCaseItem, models.MissingCaseType.name)
        .outerjoin(
            models.MissingCaseType, models.MissingCaseType.id == models.MissingCaseItem.type_id
        )
        .filter(models.MissingCaseItem.module_id == module.id)
        .order_by(models.MissingCaseItem.order_no.asc(), models.MissingCaseItem.id.asc())
        .all()
    )
    result = []
    for row in items:
        item, type_name = row
        result.append(
            {
                "id": item.id,
                "module_id": item.module_id,
                "module_name": module.name,
                "type_id": item.type_id,
                "type_name": type_name,
                "title": item.title or "",
                "priority": item.priority,
                "precondition": item.precondition or "",
                "steps": item.steps or "",
                "expected": item.expected or "",
                "remark": item.remark,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
            }
        )
    return result


@router.post(
    "/{module_id}/items",
    response_model=schemas.MissingCaseItemOut,
    status_code=status.HTTP_201_CREATED,
)
def create_missing_item(
    module_id: int,
    payload: schemas.MissingCaseItemPayload,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = _ensure_missing_module_access(db, user, module_id)
    title = _normalize_text(payload.title)
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例标题不能为空")
    expected = _normalize_text(payload.expected)
    if not expected:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="预期结果不能为空")
    order_no = (
        db.query(func.max(models.MissingCaseItem.order_no))
        .filter(models.MissingCaseItem.module_id == module.id)
        .scalar()
        or 0
    )
    type_id = _normalize_type_id(payload.type_id)
    type_name = None
    if type_id is not None:
        missing_type = (
            db.query(models.MissingCaseType)
            .filter(models.MissingCaseType.id == int(type_id))
            .first()
        )
        if not missing_type:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="类型不存在")
        if missing_type.project_id != module.project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="类型不属于当前项目")
        type_name = missing_type.name
    now = datetime.now(timezone.utc)
    item = models.MissingCaseItem(
        module_id=module.id,
        type_id=type_id,
        title=title,
        priority=_normalize_text(payload.priority) or None,
        precondition=_normalize_text(payload.precondition),
        steps=_normalize_text(payload.steps),
        expected=expected,
        remark=_normalize_text(payload.remark) or None,
        order_no=int(order_no) + 1,
        created_by=user.id,
        updated_by=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    log_operation(
        db=db,
        user_id=user.id,
        action="create_missing_case_item",
        target_type="missing_module",
        target_id=module.id,
        detail={"module_id": module.id, "module_name": module.name, "item_id": item.id},
    )
    return {
        "id": item.id,
        "module_id": item.module_id,
        "module_name": module.name,
        "type_id": item.type_id,
        "type_name": type_name,
        "title": item.title or "",
        "priority": item.priority,
        "precondition": item.precondition or "",
        "steps": item.steps or "",
        "expected": item.expected or "",
        "remark": item.remark,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.patch("/items/{item_id}", response_model=schemas.MissingCaseItemOut)
def update_missing_item(
    item_id: int,
    payload: schemas.MissingCaseItemPatch,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(models.MissingCaseItem)
        .filter(models.MissingCaseItem.id == int(item_id))
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="条目不存在")
    module = _ensure_missing_module_access(db, user, item.module_id)

    if payload.precondition is not None:
        item.precondition = _normalize_text(payload.precondition)
    if payload.steps is not None:
        item.steps = _normalize_text(payload.steps)
    if payload.title is not None:
        next_title = _normalize_text(payload.title)
        if not next_title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例标题不能为空")
        item.title = next_title
    if payload.priority is not None:
        item.priority = _normalize_text(payload.priority) or None
    if payload.expected is not None:
        next_expected = _normalize_text(payload.expected)
        if not next_expected:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="预期结果不能为空")
        item.expected = next_expected
    if payload.remark is not None:
        item.remark = _normalize_text(payload.remark) or None
    if payload.type_id is not None:
        next_type_id = _normalize_type_id(payload.type_id)
        next_type_name = None
        if next_type_id is not None:
            missing_type = (
                db.query(models.MissingCaseType)
                .filter(models.MissingCaseType.id == int(next_type_id))
                .first()
            )
            if not missing_type:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="类型不存在")
            if missing_type.project_id != module.project_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="类型不属于当前项目")
            next_type_name = missing_type.name
        item.type_id = next_type_id

    item.updated_by = user.id
    item.updated_at = datetime.now(timezone.utc)
    db.add(item)
    db.commit()
    db.refresh(item)
    log_operation(
        db=db,
        user_id=user.id,
        action="update_missing_case_item",
        target_type="missing_module",
        target_id=module.id,
        detail={"module_id": module.id, "module_name": module.name, "item_id": item.id},
    )
    type_name = next_type_name if payload.type_id is not None else None
    if payload.type_id is None and item.type_id:
        type_row = (
            db.query(models.MissingCaseType.name)
            .filter(models.MissingCaseType.id == int(item.type_id))
            .first()
        )
        if type_row:
            type_name = type_row[0]
    return {
        "id": item.id,
        "module_id": item.module_id,
        "module_name": module.name,
        "type_id": item.type_id,
        "type_name": type_name,
        "title": item.title or "",
        "priority": item.priority,
        "precondition": item.precondition or "",
        "steps": item.steps or "",
        "expected": item.expected or "",
        "remark": item.remark,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.delete("/items/{item_id}")
def delete_missing_item(
    item_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(models.MissingCaseItem)
        .filter(models.MissingCaseItem.id == int(item_id))
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="条目不存在")
    module = _ensure_missing_module_access(db, user, item.module_id)
    db.delete(item)
    db.commit()
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_missing_case_item",
        target_type="missing_module",
        target_id=module.id,
        detail={"module_id": module.id, "module_name": module.name, "item_id": item_id},
    )
    return {"detail": "deleted"}


@router.patch("/{module_id}", response_model=schemas.MissingModuleOut)
def update_missing_module(
    module_id: int,
    payload: schemas.MissingModulePatch,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = _ensure_missing_module_access(db, user, module_id)
    name = _normalize_text(payload.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模块名不能为空")
    module.name = name
    module.updated_by = user.id
    module.updated_at = datetime.now(timezone.utc)
    db.add(module)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="missing_module_duplicate"
        )
    db.refresh(module)
    log_operation(
        db=db,
        user_id=user.id,
        action="update_missing_module",
        target_type="missing_module",
        target_id=module.id,
        detail={"project_id": module.project_id, "module_name": module.name},
    )
    return module


@router.delete("/{module_id}")
def delete_missing_module(
    module_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = _ensure_missing_module_access(db, user, module_id)
    db.delete(module)
    db.commit()
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_missing_module",
        target_type="missing_module",
        target_id=module.id,
        detail={"project_id": module.project_id, "module_name": module.name},
    )
    return {"detail": "deleted"}


@types_router.get("", response_model=List[schemas.MissingCaseTypeOut])
def list_missing_types(
    project_id: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_query = db.query(models.MissingCaseType)
    if project_id is not None:
        ensure_project_access(db, user, project_id)
        base_query = base_query.filter(models.MissingCaseType.project_id == project_id)
    elif user.role != "admin":
        base_query = base_query.join(
            models.UserProject, models.UserProject.project_id == models.MissingCaseType.project_id
        ).filter(models.UserProject.user_id == user.id)

    item_count_sq = (
        db.query(
            models.MissingCaseItem.type_id.label("type_id"),
            func.count(models.MissingCaseItem.id).label("item_count"),
        )
        .group_by(models.MissingCaseItem.type_id)
        .subquery()
    )

    rows = (
        base_query.with_entities(
            models.MissingCaseType,
            item_count_sq.c.item_count.label("item_count"),
        )
        .outerjoin(item_count_sq, item_count_sq.c.type_id == models.MissingCaseType.id)
        .order_by(models.MissingCaseType.id.asc())
        .all()
    )
    result = []
    for row in rows:
        missing_type, item_count = row
        result.append(
            {
                "id": missing_type.id,
                "project_id": missing_type.project_id,
                "name": missing_type.name,
                "item_count": int(item_count or 0),
                "created_at": missing_type.created_at,
                "updated_at": missing_type.updated_at,
            }
        )
    return result


@types_router.post("", response_model=schemas.MissingCaseTypeOut, status_code=status.HTTP_201_CREATED)
def create_missing_type(
    payload: schemas.MissingCaseTypeCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = ensure_project_access(db, user, payload.project_id)
    name = _normalize_text(payload.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="类型名不能为空")
    now = datetime.now(timezone.utc)
    missing_type = models.MissingCaseType(
        project_id=project.id,
        name=name,
        created_by=user.id,
        updated_by=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(missing_type)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="missing_type_duplicate"
        )
    db.refresh(missing_type)
    log_operation(
        db=db,
        user_id=user.id,
        action="create_missing_type",
        target_type="missing_type",
        target_id=missing_type.id,
        detail={"project_id": project.id, "type_name": missing_type.name},
    )
    return missing_type


@types_router.delete("/{type_id}")
def delete_missing_type(
    type_id: int,
    transfer_to: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    missing_type = (
        db.query(models.MissingCaseType)
        .filter(models.MissingCaseType.id == int(type_id))
        .first()
    )
    if not missing_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="类型不存在")
    ensure_project_access(db, user, missing_type.project_id)
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限删除类型")

    item_count = (
        db.query(func.count(models.MissingCaseItem.id))
        .filter(models.MissingCaseItem.type_id == missing_type.id)
        .scalar()
        or 0
    )
    transfer_id = _normalize_type_id(transfer_to)
    moved = 0
    if item_count > 0:
        if transfer_id is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "detail": "类型下已有易漏用例，请先转移类型",
                    "code": "MISSING_TYPE_IN_USE",
                    "item_count": int(item_count),
                },
            )
        target = (
            db.query(models.MissingCaseType)
            .filter(models.MissingCaseType.id == int(transfer_id))
            .first()
        )
        if not target:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="转移类型不存在")
        if target.project_id != missing_type.project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="转移类型不属于当前项目")
        if target.id == missing_type.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="转移类型不能与当前类型相同")
        moved = (
            db.query(models.MissingCaseItem)
            .filter(models.MissingCaseItem.type_id == missing_type.id)
            .update({models.MissingCaseItem.type_id: target.id}, synchronize_session=False)
            or 0
        )

    db.delete(missing_type)
    db.commit()
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_missing_type",
        target_type="missing_type",
        target_id=missing_type.id,
        detail={
            "project_id": missing_type.project_id,
            "type_name": missing_type.name,
            "transfer_to": transfer_id,
            "moved_count": int(moved),
        },
    )
    return {"detail": "deleted", "moved_count": int(moved)}
