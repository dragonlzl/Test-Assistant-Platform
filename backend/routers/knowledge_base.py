from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from .. import models, schemas
from ..dependencies import get_current_user, require_admin
from ..db import get_db
from ..audit import log_operation
from ..knowledge_access import accessible_sources, authorized_payload, resolve_source
from ..utils import ensure_project_access
from ..knowledge_base_service import (
    catalog_knowledge_base,
    get_knowledge_base_documents,
    KnowledgeBaseServiceError,
    search_knowledge_base,
    validate_knowledge_base,
    normalize_base_url,
)


router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


class SourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    project_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=120)
    base_url: str = Field(min_length=1, max_length=2048)


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    name: str
    base_url: str
    is_active: bool


@router.get("/sources", response_model=List[SourceOut])
def list_sources(project_id: Optional[int] = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    query = accessible_sources(db, user)
    if project_id is not None:
        ensure_project_access(db, user, project_id)
        query = query.filter(models.KnowledgeSource.project_id == project_id)
    return query.order_by(models.KnowledgeSource.id).all()


@router.post("/access")
def check_access(payload: schemas.KnowledgeBaseTarget, user=Depends(get_current_user), db: Session = Depends(get_db)):
    source = resolve_source(db, user, payload.model_dump())
    return {"id": source.id, "project_id": source.project_id, "allowed": True}


@router.post("/sources", response_model=SourceOut, status_code=201)
def register_source(payload: SourceCreate, user=Depends(require_admin), db: Session = Depends(get_db)):
    ensure_project_access(db, user, payload.project_id)
    try:
        url = normalize_base_url(payload.base_url)
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    source = db.query(models.KnowledgeSource).filter_by(project_id=payload.project_id, base_url=url).first()
    if source:
        source.is_active = True
        source.name = payload.name
    else:
        source = models.KnowledgeSource(project_id=payload.project_id, name=payload.name, base_url=url)
        db.add(source)
    try:
        db.flush()
        log_operation(db, user.id, "register_knowledge_source", "knowledge_source", source.id,
                      detail={"project_id": payload.project_id, "name": payload.name})
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "知识库已登记，请刷新列表") from exc
    db.refresh(source)
    return source


@router.delete("/sources/{source_id}")
def disable_source(source_id: int, user=Depends(require_admin), db: Session = Depends(get_db)):
    source = db.query(models.KnowledgeSource).filter_by(id=source_id).first()
    if source is None:
        raise HTTPException(404, "知识库不存在")
    source.is_active = False
    log_operation(db, user.id, "disable_knowledge_source", "knowledge_source", source.id,
                  detail={"project_id": source.project_id, "name": source.name})
    db.commit()
    return {"detail": "知识库已停用"}


@router.post("/validate", response_model=schemas.KnowledgeBaseValidateResponse)
def validate_shared_knowledge_base(
    payload: schemas.KnowledgeBaseValidateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        target = authorized_payload(db, user, payload.model_dump())
        return validate_knowledge_base(
            target["base_url"],
            timeout_sec=payload.timeout_sec,
            force_refresh=payload.force_refresh,
            deep_check=payload.deep_check,
        )
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/catalog", response_model=schemas.KnowledgeBaseCatalogResponse)
def catalog_shared_knowledge_base(
    payload: schemas.KnowledgeBaseCatalogRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return catalog_knowledge_base(authorized_payload(db, user, payload.model_dump()))
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/documents", response_model=schemas.KnowledgeBaseDocumentsResponse)
def list_shared_knowledge_base_documents(
    payload: schemas.KnowledgeBaseDocumentsRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return get_knowledge_base_documents(authorized_payload(db, user, payload.model_dump()))
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/search", response_model=schemas.KnowledgeBaseSearchResponse)
def search_shared_knowledge_base(
    payload: schemas.KnowledgeBaseSearchRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return search_knowledge_base(authorized_payload(db, user, payload.model_dump()))
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
