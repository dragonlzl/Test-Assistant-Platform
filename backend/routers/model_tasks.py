from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..dependencies import get_current_user
from ..model_task_service import (
    ACTIVE_MODEL_TASK_STATUSES,
    build_model_task_id,
    can_access_model_config,
    model_task_executor,
    request_task_cancel,
)
from ..model_gateway import request_model_name


router = APIRouter(prefix="/model-tasks", tags=["model-tasks"])


def _get_owned_task(db: Session, task_id: str, user: models.User) -> models.ModelTask:
    task = db.query(models.ModelTask).filter(models.ModelTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模型任务不存在")
    if task.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问该模型任务")
    return task


@router.post("", response_model=schemas.ModelTaskOut, status_code=status.HTTP_202_ACCEPTED)
def create_model_task(
    payload: schemas.ModelTaskCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    idempotency_key = str(payload.idempotency_key or "").strip()
    if not idempotency_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="幂等键不能为空")
    existing = (
        db.query(models.ModelTask)
        .filter(
            models.ModelTask.user_id == user.id,
            models.ModelTask.idempotency_key == idempotency_key,
        )
        .first()
    )
    if existing:
        if existing.model_config_id != payload.model_config_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="幂等键已绑定其他模型配置，请重新发起生成",
            )
        return existing
    if payload.resume_only:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="待恢复的后端任务不存在")
    if not request_model_name(payload.payload):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="模型任务必须指定具体模型，不能使用站点默认模型",
        )

    model_config = (
        db.query(models.ModelConfig)
        .filter(models.ModelConfig.id == payload.model_config_id)
        .first()
    )
    if not model_config or not model_config.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型配置不存在或已停用")
    if not can_access_model_config(model_config, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限使用该模型配置")

    task = models.ModelTask(
        id=build_model_task_id(),
        user_id=user.id,
        model_config_id=model_config.id,
        scene=str(payload.scene or "generation")[:64],
        owner_key=str(payload.owner_key or idempotency_key)[:255],
        idempotency_key=idempotency_key[:255],
        status="queued",
        request_json=payload.payload if payload.payload is not None else {},
        timeout_sec=max(5, min(1800, int(payload.timeout_sec or 60))),
    )
    db.add(task)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(models.ModelTask)
            .filter(
                models.ModelTask.user_id == user.id,
                models.ModelTask.idempotency_key == idempotency_key,
            )
            .first()
        )
        if existing:
            return existing
        raise
    db.refresh(task)
    model_task_executor.submit(task.id)
    return task


@router.get("", response_model=List[schemas.ModelTaskOut])
def list_model_tasks(
    scene: Optional[str] = None,
    active_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.ModelTask).filter(models.ModelTask.user_id == user.id)
    if scene:
        query = query.filter(models.ModelTask.scene == scene)
    if active_only:
        query = query.filter(models.ModelTask.status.in_(ACTIVE_MODEL_TASK_STATUSES))
    return query.order_by(models.ModelTask.created_at.desc()).limit(limit).all()


@router.get("/{task_id}", response_model=schemas.ModelTaskOut)
def get_model_task(
    task_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_owned_task(db, task_id, user)


@router.post("/{task_id}/cancel", response_model=schemas.ModelTaskOut)
def cancel_model_task(
    task_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_owned_task(db, task_id, user)
    task = request_task_cancel(db, task)
    model_task_executor.cancel(task.id)
    return task


@router.post("/cancel-by-owner", response_model=schemas.ModelTaskCancelOut)
def cancel_model_tasks_by_owner(
    payload: schemas.ModelTaskCancelByOwner,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owner_key = str(payload.owner_key or "").strip()
    if not owner_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="任务所有者标识不能为空")
    tasks = (
        db.query(models.ModelTask)
        .filter(
            models.ModelTask.user_id == user.id,
            models.ModelTask.owner_key == owner_key,
            models.ModelTask.status.in_(ACTIVE_MODEL_TASK_STATUSES),
        )
        .all()
    )
    ids = []
    for task in tasks:
        request_task_cancel(db, task)
        model_task_executor.cancel(task.id)
        ids.append(task.id)
    return schemas.ModelTaskCancelOut(cancelled_count=len(ids), task_ids=ids)
