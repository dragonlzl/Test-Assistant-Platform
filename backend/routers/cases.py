from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user
from ..utils import clean_case_file_name, ensure_project_access, ensure_version_in_project


router = APIRouter(prefix="/case-files", tags=["case-library"])


def _ensure_case_access(
    db: Session, user: models.User, case_file_id: int
) -> models.CaseFile:
    case_file = db.query(models.CaseFile).filter(models.CaseFile.id == case_file_id).first()
    if not case_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例文件不存在")
    ensure_project_access(db, user, case_file.project_id)
    return case_file


@router.post("/import", response_model=schemas.CaseFileOut, status_code=status.HTTP_201_CREATED)
def import_case_file(
    payload: schemas.CaseFileImportRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = ensure_project_access(db, user, payload.project_id)
    ensure_version_in_project(db, project.id, payload.version_id)
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")
    clean_name = clean_case_file_name(payload.file_name)
    exists = (
        db.query(models.CaseFile)
        .filter(
            models.CaseFile.project_id == project.id,
            models.CaseFile.version_id == payload.version_id,
            models.CaseFile.file_name_clean == clean_name,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="同名用例已存在")
    case_file = models.CaseFile(
        project_id=project.id,
        version_id=payload.version_id,
        file_name_clean=clean_name,
        importer_id=user.id,
        imported_at=datetime.now(timezone.utc),
        source=payload.source,
    )
    db.add(case_file)
    db.flush()
    for item in payload.items:
        db.add(
            models.CaseItem(
                case_file_id=case_file.id,
                module=item.module,
                title=item.title,
                priority=item.priority,
                precondition=item.precondition,
                steps=item.steps,
                expected=item.expected,
                remark=item.remark,
                created_by=user.id,
                updated_by=user.id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )
    log_operation(
        db=db,
        user_id=user.id,
        action="import_case_file",
        target_type="case_file",
        target_id=case_file.id,
        detail={"project_id": project.id, "file_name": clean_name},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例导入失败：存在重复条目")
    db.refresh(case_file)
    return case_file


@router.get("", response_model=List[schemas.CaseFileOut])
def list_case_files(
    project_id: int = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_query = db.query(models.CaseFile)
    if project_id:
        ensure_project_access(db, user, project_id)
        base_query = base_query.filter(models.CaseFile.project_id == project_id)
    elif user.role != "admin":
        base_query = base_query.join(
            models.UserProject, models.UserProject.project_id == models.CaseFile.project_id
        ).filter(models.UserProject.user_id == user.id)

    importer = aliased(models.User)
    updater = aliased(models.User)
    last_item_sq = (
        db.query(
            models.CaseItem.case_file_id.label("case_file_id"),
            models.CaseItem.updated_by.label("last_updated_by"),
            models.CaseItem.updated_at.label("last_item_updated_at"),
            func.row_number()
            .over(
                partition_by=models.CaseItem.case_file_id,
                order_by=models.CaseItem.updated_at.desc(),
            )
            .label("rn"),
        )
        .subquery()
    )

    rows = (
        base_query.with_entities(
            models.CaseFile,
            importer.username.label("importer_name"),
            last_item_sq.c.last_updated_by.label("last_updated_by"),
            updater.username.label("last_updated_by_name"),
        )
        .outerjoin(importer, importer.id == models.CaseFile.importer_id)
        .outerjoin(
            last_item_sq,
            (last_item_sq.c.case_file_id == models.CaseFile.id) & (last_item_sq.c.rn == 1),
        )
        .outerjoin(updater, updater.id == last_item_sq.c.last_updated_by)
        .order_by(models.CaseFile.id.desc())
        .all()
    )

    result = []
    for row in rows:
        case_file, importer_name, last_updated_by, last_updated_by_name = row
        result.append(
            {
                "id": case_file.id,
                "project_id": case_file.project_id,
                "version_id": case_file.version_id,
                "file_name_clean": case_file.file_name_clean,
                "importer_id": case_file.importer_id,
                "importer_name": importer_name,
                "imported_at": case_file.imported_at,
                "updated_at": case_file.updated_at,
                "last_updated_by": last_updated_by,
                "last_updated_by_name": last_updated_by_name,
            }
        )
    return result


@router.get("/{case_file_id}/items", response_model=List[schemas.CaseItemOut])
def list_case_items(
    case_file_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_case_access(db, user, case_file_id)
    items = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == case_file_id)
        .order_by(models.CaseItem.id.asc())
        .all()
    )
    return items


@router.patch("/items/{case_item_id}", response_model=schemas.CaseItemOut)
def update_case_item(
    case_item_id: int,
    payload: schemas.CaseItemPayload,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case_item = db.query(models.CaseItem).filter(models.CaseItem.id == case_item_id).first()
    if not case_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例不存在")
    _ensure_case_access(db, user, case_item.case_file_id)
    payload_data = payload.model_dump(exclude_unset=True)
    changed = False
    for field in ["module", "title", "priority", "precondition", "steps", "expected", "remark"]:
        if field not in payload_data:
            continue
        value = payload_data[field]
        if value != getattr(case_item, field):
            setattr(case_item, field, value)
            changed = True
    if changed:
        now = datetime.now(timezone.utc)
        case_item.updated_by = user.id
        case_item.updated_at = now
        db.query(models.CaseFile).filter(models.CaseFile.id == case_item.case_file_id).update(
            {models.CaseFile.updated_at: now}, synchronize_session=False
        )
        db.add(case_item)
        log_operation(
            db=db,
            user_id=user.id,
            action="update_case_item",
            target_type="case_item",
            target_id=case_item.id,
            detail={"case_file_id": case_item.case_file_id},
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="用例字段重复（模块/标题/预期结果）"
            )
        db.refresh(case_item)
    return case_item


@router.post(
    "/{case_file_id}/items",
    response_model=schemas.CaseItemOut,
    status_code=status.HTTP_201_CREATED,
)
def create_case_item(
    case_file_id: int,
    payload: schemas.CaseItemPayload,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_case_access(db, user, case_file_id)
    now = datetime.now(timezone.utc)
    case_item = models.CaseItem(
        case_file_id=case_file_id,
        module=payload.module,
        title=payload.title,
        priority=payload.priority,
        precondition=payload.precondition,
        steps=payload.steps,
        expected=payload.expected,
        remark=payload.remark,
        created_by=user.id,
        updated_by=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(case_item)
    db.query(models.CaseFile).filter(models.CaseFile.id == case_file_id).update(
        {models.CaseFile.updated_at: now}, synchronize_session=False
    )
    log_operation(
        db=db,
        user_id=user.id,
        action="create_case_item",
        target_type="case_file",
        target_id=case_file_id,
        detail={"case_file_id": case_file_id},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="用例字段重复（模块/标题/预期结果）"
        )
    db.refresh(case_item)
    return case_item


@router.delete("/items/{case_item_id}")
def delete_case_item(
    case_item_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case_item = db.query(models.CaseItem).filter(models.CaseItem.id == case_item_id).first()
    if not case_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例不存在")
    _ensure_case_access(db, user, case_item.case_file_id)
    now = datetime.now(timezone.utc)
    db.delete(case_item)
    db.query(models.CaseFile).filter(models.CaseFile.id == case_item.case_file_id).update(
        {models.CaseFile.updated_at: now}, synchronize_session=False
    )
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_case_item",
        target_type="case_item",
        target_id=case_item_id,
        detail={"case_file_id": case_item.case_file_id},
    )
    db.commit()
    return {"detail": "用例已删除"}
