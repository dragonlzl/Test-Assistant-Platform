from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, distinct
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


def _normalize_type_ids(values: Optional[List[int]]) -> List[int]:
    if not values:
        return []
    result = []
    seen = set()
    for raw in values:
        val = _normalize_type_id(raw)
        if val is None or val in seen:
            continue
        seen.add(val)
        result.append(val)
    return result


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


def _resolve_missing_item_type_ids(
    db: Session,
    module: models.MissingModule,
    payload: Optional[object],
) -> Optional[tuple]:
    if payload is None:
        return None
    if payload.type_ids is not None:
        type_ids = _normalize_type_ids(payload.type_ids)
    elif payload.type_id is not None:
        single = _normalize_type_id(payload.type_id)
        type_ids = [single] if single is not None else []
    else:
        return None
    if len(type_ids) > 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="类型最多选择3个")
    if not type_ids:
        return [], {}
    types = (
        db.query(models.MissingCaseType)
        .filter(models.MissingCaseType.id.in_(type_ids))
        .all()
    )
    if len(types) != len(type_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="类型不存在")
    for missing_type in types:
        if missing_type.project_id != module.project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="类型不属于当前项目")
    name_map = {t.id: t.name for t in types}
    return type_ids, name_map


def _load_missing_item_type_map(
    db: Session, item_ids: List[int]
) -> dict:
    if not item_ids:
        return {}
    rows = (
        db.query(
            models.MissingCaseItemType.item_id,
            models.MissingCaseType.id,
            models.MissingCaseType.name,
        )
        .join(
            models.MissingCaseType,
            models.MissingCaseType.id == models.MissingCaseItemType.type_id,
        )
        .filter(models.MissingCaseItemType.item_id.in_(item_ids))
        .order_by(models.MissingCaseItemType.item_id.asc(), models.MissingCaseType.id.asc())
        .all()
    )
    result = {}
    for row in rows:
        item_id, type_id, type_name = row
        data = result.setdefault(item_id, {"type_ids": [], "type_names": []})
        data["type_ids"].append(type_id)
        data["type_names"].append(type_name)
    return result


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
        base_query = (
            base_query.join(
                models.MissingCaseItem,
                models.MissingCaseItem.module_id == models.MissingModule.id,
            )
            .outerjoin(
                models.MissingCaseItemType,
                models.MissingCaseItemType.item_id == models.MissingCaseItem.id,
            )
            .filter(
                or_(
                    models.MissingCaseItemType.type_id.in_(selected_type_ids),
                    models.MissingCaseItem.type_id.in_(selected_type_ids),
                )
            )
        )

    item_count_query = db.query(
        models.MissingCaseItem.module_id.label("module_id"),
        func.count(distinct(models.MissingCaseItem.id)).label("item_count"),
    )
    if selected_type_ids:
        item_count_query = (
            item_count_query.outerjoin(
                models.MissingCaseItemType,
                models.MissingCaseItemType.item_id == models.MissingCaseItem.id,
            )
            .filter(
                or_(
                    models.MissingCaseItemType.type_id.in_(selected_type_ids),
                    models.MissingCaseItem.type_id.in_(selected_type_ids),
                )
            )
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
    before_count = (
        db.query(func.count(models.MissingModule.id))
        .filter(models.MissingModule.project_id == project.id)
        .scalar()
        or 0
    )
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
        detail={
            "project_id": project.id,
            "module_name": module.name,
            "before_count": int(before_count),
            "after_count": int(before_count) + 1,
        },
    )
    db.commit()
    return module


@router.get("/{module_id}/items", response_model=List[schemas.MissingCaseItemOut])
def list_missing_items(
    module_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = _ensure_missing_module_access(db, user, module_id)
    items = (
        db.query(models.MissingCaseItem)
        .filter(models.MissingCaseItem.module_id == module.id)
        .order_by(models.MissingCaseItem.order_no.asc(), models.MissingCaseItem.id.asc())
        .all()
    )
    item_ids = [item.id for item in items]
    type_map = _load_missing_item_type_map(db, item_ids)
    legacy_type_ids = [
        item.type_id
        for item in items
        if item.type_id and item.id not in type_map
    ]
    legacy_name_map = {}
    if legacy_type_ids:
        legacy_rows = (
            db.query(models.MissingCaseType.id, models.MissingCaseType.name)
            .filter(models.MissingCaseType.id.in_(legacy_type_ids))
            .all()
        )
        legacy_name_map = {row[0]: row[1] for row in legacy_rows}

    result = []
    for item in items:
        type_info = type_map.get(item.id, {})
        type_ids = type_info.get("type_ids", [])
        type_names = type_info.get("type_names", [])
        if not type_ids and item.type_id:
            type_ids = [item.type_id]
            type_names = [legacy_name_map.get(item.type_id)]
        primary_id = type_ids[0] if type_ids else None
        primary_name = type_names[0] if type_names else None
        result.append(
            {
                "id": item.id,
                "module_id": item.module_id,
                "module_name": module.name,
                "type_id": primary_id,
                "type_name": primary_name,
                "type_ids": type_ids,
                "type_names": type_names,
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
    before_count = (
        db.query(func.count(models.MissingCaseItem.id))
        .filter(models.MissingCaseItem.module_id == module.id)
        .scalar()
        or 0
    )
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
    type_ids = []
    type_name_map = {}
    type_info = _resolve_missing_item_type_ids(db, module, payload)
    if type_info is not None:
        type_ids, type_name_map = type_info
    primary_type_id = type_ids[0] if type_ids else None
    primary_type_name = type_name_map.get(primary_type_id) if primary_type_id else None
    now = datetime.now(timezone.utc)
    item = models.MissingCaseItem(
        module_id=module.id,
        type_id=primary_type_id,
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
    db.flush()
    if type_ids:
        for type_id in type_ids:
            db.add(models.MissingCaseItemType(item_id=item.id, type_id=type_id))
    db.commit()
    db.refresh(item)
    log_operation(
        db=db,
        user_id=user.id,
        action="create_missing_case_item",
        target_type="missing_module",
        target_id=module.id,
        detail={
            "module_id": module.id,
            "module_name": module.name,
            "item_id": item.id,
            "before_count": int(before_count),
            "after_count": int(before_count) + 1,
        },
    )
    db.commit()
    return {
        "id": item.id,
        "module_id": item.module_id,
        "module_name": module.name,
        "type_id": primary_type_id,
        "type_name": primary_type_name,
        "type_ids": type_ids,
        "type_names": [type_name_map.get(type_id) for type_id in type_ids],
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
    current_count = (
        db.query(func.count(models.MissingCaseItem.id))
        .filter(models.MissingCaseItem.module_id == module.id)
        .scalar()
        or 0
    )

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
    type_info = _resolve_missing_item_type_ids(db, module, payload)
    next_type_ids = None
    if type_info is not None:
        next_type_ids, _ = type_info
        item.type_id = next_type_ids[0] if next_type_ids else None

    item.updated_by = user.id
    item.updated_at = datetime.now(timezone.utc)
    db.add(item)
    db.commit()
    db.refresh(item)
    if next_type_ids is not None:
        db.query(models.MissingCaseItemType).filter(
            models.MissingCaseItemType.item_id == item.id
        ).delete(synchronize_session=False)
        if next_type_ids:
            for type_id in next_type_ids:
                db.add(models.MissingCaseItemType(item_id=item.id, type_id=type_id))
        db.commit()
    log_operation(
        db=db,
        user_id=user.id,
        action="update_missing_case_item",
        target_type="missing_module",
        target_id=module.id,
        detail={
            "module_id": module.id,
            "module_name": module.name,
            "item_id": item.id,
            "before_count": int(current_count),
            "after_count": int(current_count),
            "modified_count": 1,
        },
    )
    db.commit()
    type_ids = []
    type_names = []
    type_map = _load_missing_item_type_map(db, [item.id])
    type_info = type_map.get(item.id, {})
    type_ids = type_info.get("type_ids", [])
    type_names = type_info.get("type_names", [])
    if not type_ids and item.type_id:
        type_row = (
            db.query(models.MissingCaseType.name)
            .filter(models.MissingCaseType.id == int(item.type_id))
            .first()
        )
        if type_row:
            type_ids = [item.type_id]
            type_names = [type_row[0]]
    primary_type_id = type_ids[0] if type_ids else None
    primary_type_name = type_names[0] if type_names else None
    return {
        "id": item.id,
        "module_id": item.module_id,
        "module_name": module.name,
        "type_id": primary_type_id,
        "type_name": primary_type_name,
        "type_ids": type_ids,
        "type_names": type_names,
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
    before_count = (
        db.query(func.count(models.MissingCaseItem.id))
        .filter(models.MissingCaseItem.module_id == module.id)
        .scalar()
        or 0
    )
    db.delete(item)
    db.commit()
    after_count = int(before_count) - 1
    if after_count < 0:
        after_count = 0
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_missing_case_item",
        target_type="missing_module",
        target_id=module.id,
        detail={
            "module_id": module.id,
            "module_name": module.name,
            "item_id": item_id,
            "before_count": int(before_count),
            "after_count": int(after_count),
        },
    )
    db.commit()
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
        detail={
            "project_id": module.project_id,
            "module_name": module.name,
            "modified_count": 1,
        },
    )
    db.commit()
    return module


@router.delete("/{module_id}")
def delete_missing_module(
    module_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    module = _ensure_missing_module_access(db, user, module_id)
    before_count = (
        db.query(func.count(models.MissingModule.id))
        .filter(models.MissingModule.project_id == module.project_id)
        .scalar()
        or 0
    )
    db.delete(module)
    db.commit()
    after_count = int(before_count) - 1
    if after_count < 0:
        after_count = 0
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_missing_module",
        target_type="missing_module",
        target_id=module.id,
        detail={
            "project_id": module.project_id,
            "module_name": module.name,
            "before_count": int(before_count),
            "after_count": int(after_count),
        },
    )
    db.commit()
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
            models.MissingCaseItemType.type_id.label("type_id"),
            func.count(distinct(models.MissingCaseItemType.item_id)).label("item_count"),
        )
        .group_by(models.MissingCaseItemType.type_id)
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
    db.commit()
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

    item_ids = [
        row[0]
        for row in db.query(models.MissingCaseItemType.item_id)
        .filter(models.MissingCaseItemType.type_id == missing_type.id)
        .distinct()
        .all()
    ]
    item_count = len(item_ids)
    if not item_count:
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
        legacy_ids = [
            row[0]
            for row in db.query(models.MissingCaseItem.id)
            .filter(models.MissingCaseItem.type_id == missing_type.id)
            .all()
        ]
        moved_ids = set(item_ids).union(set(legacy_ids))
        if moved_ids:
            existing_target = {
                row[0]
                for row in db.query(models.MissingCaseItemType.item_id)
                .filter(
                    models.MissingCaseItemType.item_id.in_(list(moved_ids)),
                    models.MissingCaseItemType.type_id == target.id,
                )
                .all()
            }
            for item_id in moved_ids:
                if item_id in existing_target:
                    continue
                db.add(models.MissingCaseItemType(item_id=item_id, type_id=target.id))
            db.query(models.MissingCaseItemType).filter(
                models.MissingCaseItemType.type_id == missing_type.id
            ).delete(synchronize_session=False)
        moved = len(moved_ids)
        (
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
    db.commit()
    return {"detail": "deleted", "moved_count": int(moved)}
