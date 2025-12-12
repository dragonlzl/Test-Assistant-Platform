from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user


router = APIRouter(tags=["settings"])


def _normalize_scope(scope: Optional[str], allow_all: bool = False) -> str:
    value = (scope or "user").lower()
    if allow_all and value == "all":
        return "all"
    if value in ("user", "global"):
        return value
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="scope 无效")


def _resolve_owner_id(scope: str, user: models.User) -> Optional[int]:
    if scope == "global":
        return None
    return user.id


@router.get("/settings", response_model=List[schemas.SettingOut])
def list_settings(
    scope: str = "all",
    owner_id: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(scope, allow_all=True)
    effective_owner = owner_id if owner_id is not None else user.id
    if owner_id is not None and user.role != "admin" and owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限查看该用户设置")
    query = db.query(models.Setting)
    if scope_norm == "user":
        query = query.filter(
            models.Setting.scope == "user",
            models.Setting.owner_id == effective_owner,
        )
    elif scope_norm == "global":
        query = query.filter(models.Setting.scope == "global")
    else:
        query = query.filter(
            or_(
                models.Setting.scope == "global",
                and_(
                    models.Setting.scope == "user",
                    models.Setting.owner_id == effective_owner,
                ),
            )
        )
    return query.order_by(models.Setting.updated_at.desc()).all()


@router.put("/settings", response_model=List[schemas.SettingOut])
def save_settings(
    payload: schemas.SettingsUpdateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(payload.scope or "user")
    if scope_norm == "global" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可保存全局设置")
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设置项不能为空")
    owner_id = _resolve_owner_id(scope_norm, user)
    saved = []
    now = datetime.now(timezone.utc)
    for item in payload.items:
        key = item.key.strip() if item and item.key else ""
        if not key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设置 key 不能为空")
        setting = (
            db.query(models.Setting)
            .filter(
                models.Setting.scope == scope_norm,
                models.Setting.owner_id == owner_id,
                models.Setting.key == key,
            )
            .first()
        )
        if setting:
            setting.value_json = item.value_json
            setting.updated_at = now
        else:
            setting = models.Setting(
                scope=scope_norm,
                owner_id=owner_id,
                key=key,
                value_json=item.value_json,
                updated_at=now,
            )
            db.add(setting)
        saved.append(setting)
    db.flush()
    log_operation(
        db=db,
        user_id=user.id,
        action="update_settings",
        target_type="settings",
        target_id=owner_id,
        detail={"scope": scope_norm, "keys": [item.key for item in payload.items]},
    )
    db.commit()
    for setting in saved:
        db.refresh(setting)
    return saved


@router.get("/models", response_model=List[schemas.ModelConfigOut])
def list_model_configs(
    scope: str = "all",
    owner_id: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(scope, allow_all=True)
    query = db.query(models.ModelConfig)
    if owner_id is not None:
        if user.role != "admin" and owner_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权限查看该用户模型配置"
            )
        query = query.filter(models.ModelConfig.owner_id == owner_id)
    elif scope_norm == "user":
        query = query.filter(models.ModelConfig.owner_id == user.id)
    elif scope_norm == "global":
        query = query.filter(models.ModelConfig.owner_id.is_(None))
    else:
        query = query.filter(
            or_(models.ModelConfig.owner_id.is_(None), models.ModelConfig.owner_id == user.id)
        )
    return query.order_by(models.ModelConfig.id.desc()).all()


@router.post("/models", response_model=schemas.ModelConfigOut, status_code=status.HTTP_201_CREATED)
def create_model_config(
    payload: schemas.ModelConfigCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(payload.scope or "user")
    if scope_norm == "global" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可创建全局模型配置")
    owner_id = _resolve_owner_id(scope_norm, user)
    existing = (
        db.query(models.ModelConfig)
        .filter(models.ModelConfig.owner_id == owner_id, models.ModelConfig.name == payload.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型名称已存在")
    config = models.ModelConfig(
        owner_id=owner_id,
        name=payload.name,
        config_json=payload.config_json,
        is_active=True if payload.is_active is None else payload.is_active,
    )
    db.add(config)
    db.flush()
    log_operation(
        db=db,
        user_id=user.id,
        action="create_model_config",
        target_type="model_config",
        target_id=config.id,
        detail={"scope": scope_norm, "name": payload.name},
    )
    db.commit()
    db.refresh(config)
    return config


@router.patch("/models/{config_id}", response_model=schemas.ModelConfigOut)
def update_model_config(
    config_id: int,
    payload: schemas.ModelConfigUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.query(models.ModelConfig).filter(models.ModelConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模型配置不存在")
    if config.owner_id is None and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可修改全局配置")
    if config.owner_id is not None and config.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限修改该配置")
    if payload.name and payload.name != config.name:
        exists = (
            db.query(models.ModelConfig)
            .filter(
                models.ModelConfig.owner_id == config.owner_id,
                models.ModelConfig.name == payload.name,
                models.ModelConfig.id != config.id,
            )
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型名称已存在")
        config.name = payload.name
    if payload.config_json is not None:
        config.config_json = payload.config_json
    if payload.is_active is not None:
        config.is_active = payload.is_active
    config.updated_at = datetime.now(timezone.utc)
    db.add(config)
    log_operation(
        db=db,
        user_id=user.id,
        action="update_model_config",
        target_type="model_config",
        target_id=config.id,
    )
    db.commit()
    db.refresh(config)
    return config


@router.get("/features", response_model=List[schemas.FeatureAssignmentOut])
def list_feature_assignments(
    scope: str = "all",
    owner_id: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(scope, allow_all=True)
    query = db.query(models.FeatureAssignment)
    if owner_id is not None:
        if user.role != "admin" and owner_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权限查看该用户功能指派"
            )
        query = query.filter(models.FeatureAssignment.owner_id == owner_id)
    elif scope_norm == "user":
        query = query.filter(models.FeatureAssignment.owner_id == user.id)
    elif scope_norm == "global":
        query = query.filter(models.FeatureAssignment.owner_id.is_(None))
    else:
        query = query.filter(
            or_(
                models.FeatureAssignment.owner_id.is_(None),
                models.FeatureAssignment.owner_id == user.id,
            )
        )
    return query.order_by(models.FeatureAssignment.id.desc()).all()


@router.post(
    "/features",
    response_model=schemas.FeatureAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_feature_assignment(
    payload: schemas.FeatureAssignmentCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(payload.scope or "user")
    if scope_norm == "global" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可创建全局指派")
    owner_id = _resolve_owner_id(scope_norm, user)
    exists = (
        db.query(models.FeatureAssignment)
        .filter(
            models.FeatureAssignment.owner_id == owner_id,
            models.FeatureAssignment.name == payload.name,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="功能指派名称已存在")
    assignment = models.FeatureAssignment(
        owner_id=owner_id,
        name=payload.name,
        config_json=payload.config_json,
    )
    db.add(assignment)
    db.flush()
    log_operation(
        db=db,
        user_id=user.id,
        action="create_feature_assignment",
        target_type="feature_assignment",
        target_id=assignment.id,
        detail={"scope": scope_norm, "name": payload.name},
    )
    db.commit()
    db.refresh(assignment)
    return assignment


@router.patch("/features/{assignment_id}", response_model=schemas.FeatureAssignmentOut)
def update_feature_assignment(
    assignment_id: int,
    payload: schemas.FeatureAssignmentUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(models.FeatureAssignment)
        .filter(models.FeatureAssignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="功能指派不存在")
    if assignment.owner_id is None and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可修改全局指派")
    if assignment.owner_id is not None and assignment.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限修改该指派")
    if payload.name and payload.name != assignment.name:
        exists = (
            db.query(models.FeatureAssignment)
            .filter(
                models.FeatureAssignment.owner_id == assignment.owner_id,
                models.FeatureAssignment.name == payload.name,
                models.FeatureAssignment.id != assignment.id,
            )
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="功能指派名称已存在")
        assignment.name = payload.name
    if payload.config_json is not None:
        assignment.config_json = payload.config_json
    assignment.updated_at = datetime.now(timezone.utc)
    db.add(assignment)
    log_operation(
        db=db,
        user_id=user.id,
        action="update_feature_assignment",
        target_type="feature_assignment",
        target_id=assignment.id,
    )
    db.commit()
    db.refresh(assignment)
    return assignment
