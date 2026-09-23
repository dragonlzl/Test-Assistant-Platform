"""All web and MCP knowledge reads pass through the same live project authorization."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models
from .knowledge_base_service import KnowledgeBaseServiceError, normalize_base_url
from .utils import ensure_project_access


def accessible_sources(db: Session, user):
    query = db.query(models.KnowledgeSource).filter(models.KnowledgeSource.is_active.is_(True))
    if user.role != "admin":
        query = query.join(models.UserProject, models.UserProject.project_id == models.KnowledgeSource.project_id).filter(
            models.UserProject.user_id == user.id
        )
    return query


def resolve_source(db: Session, user, payload):
    project_id = payload.get("project_id")
    source_id = payload.get("knowledge_base_id")
    base_url = payload.get("base_url")
    if project_id is not None:
        ensure_project_access(db, user, project_id)
    query = accessible_sources(db, user)
    if project_id is not None:
        query = query.filter(models.KnowledgeSource.project_id == project_id)
    if source_id is not None:
        query = query.filter(models.KnowledgeSource.id == source_id)
    if base_url:
        try:
            normalized = normalize_base_url(base_url)
        except KnowledgeBaseServiceError as exc:
            raise HTTPException(exc.status_code, exc.message) from exc
        query = query.filter(models.KnowledgeSource.base_url == normalized)
    if source_id is None and not base_url:
        raise HTTPException(400, "请选择已授权的项目知识库")
    source = query.order_by(models.KnowledgeSource.id).first()
    if source is None:
        raise HTTPException(403, "没有权限访问该知识库，或知识库尚未绑定到你的项目")
    return source


def authorized_payload(db: Session, user, payload):
    source = resolve_source(db, user, payload)
    return {**payload, "base_url": source.base_url}
