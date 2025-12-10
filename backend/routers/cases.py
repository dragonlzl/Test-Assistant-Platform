from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
    db.commit()
    db.refresh(case_file)
    return case_file


@router.get("", response_model=List[schemas.CaseFileOut])
def list_case_files(
    project_id: int = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.CaseFile)
    if project_id:
        ensure_project_access(db, user, project_id)
        query = query.filter(models.CaseFile.project_id == project_id)
    elif user.role != "admin":
        query = query.join(models.Project).join(models.UserProject).filter(
            models.UserProject.user_id == user.id
        )
    case_files = query.order_by(models.CaseFile.id.desc()).all()
    return case_files


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
    changed = False
    for field in ["module", "title", "priority", "precondition", "steps", "expected", "remark"]:
        value = getattr(payload, field, None)
        if value is not None and value != getattr(case_item, field):
            setattr(case_item, field, value)
            changed = True
    if changed:
        case_item.updated_by = user.id
        case_item.updated_at = datetime.now(timezone.utc)
        db.add(case_item)
        log_operation(
            db=db,
            user_id=user.id,
            action="update_case_item",
            target_type="case_item",
            target_id=case_item.id,
            detail={"case_file_id": case_item.case_file_id},
        )
        db.commit()
        db.refresh(case_item)
    return case_item
