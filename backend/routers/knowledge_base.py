from fastapi import APIRouter, Depends, HTTPException

from .. import models, schemas
from ..dependencies import get_current_user
from ..knowledge_base_service import (
    catalog_knowledge_base,
    get_knowledge_base_documents,
    KnowledgeBaseServiceError,
    search_knowledge_base,
    validate_knowledge_base,
)


router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


@router.post("/validate", response_model=schemas.KnowledgeBaseValidateResponse)
def validate_shared_knowledge_base(
    payload: schemas.KnowledgeBaseValidateRequest,
    _: models.User = Depends(get_current_user),
):
    try:
        return validate_knowledge_base(
            payload.base_url,
            timeout_sec=payload.timeout_sec,
            force_refresh=payload.force_refresh,
            deep_check=payload.deep_check,
        )
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/catalog", response_model=schemas.KnowledgeBaseCatalogResponse)
def catalog_shared_knowledge_base(
    payload: schemas.KnowledgeBaseCatalogRequest,
    _: models.User = Depends(get_current_user),
):
    try:
        return catalog_knowledge_base(payload.model_dump())
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/documents", response_model=schemas.KnowledgeBaseDocumentsResponse)
def list_shared_knowledge_base_documents(
    payload: schemas.KnowledgeBaseDocumentsRequest,
    _: models.User = Depends(get_current_user),
):
    try:
        return get_knowledge_base_documents(payload.model_dump())
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/search", response_model=schemas.KnowledgeBaseSearchResponse)
def search_shared_knowledge_base(
    payload: schemas.KnowledgeBaseSearchRequest,
    _: models.User = Depends(get_current_user),
):
    try:
        return search_knowledge_base(payload.model_dump())
    except KnowledgeBaseServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
