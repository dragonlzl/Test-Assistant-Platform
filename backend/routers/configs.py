import json
from datetime import datetime, timezone
from typing import List, Optional
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user


router = APIRouter(tags=["settings"])


class _NoRedirectHandler(urllib_request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


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


def _normalize_timeout_sec(value: Optional[int]) -> int:
    try:
        timeout = int(value or 60)
    except Exception:
        timeout = 60
    if timeout < 5:
        return 5
    if timeout > 1800:
        return 1800
    return timeout


def _validate_model_url(raw_url: Optional[str]) -> str:
    url = (raw_url or "").strip()
    if not url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型地址不能为空")
    parsed = urllib_parse.urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="模型地址仅支持 http/https"
        )
    if not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="模型地址格式不正确"
        )
    return url


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
        detail={
            "scope": scope_norm,
            "keys": [item.key for item in payload.items],
            "items": [{"key": item.key, "value_json": item.value_json} for item in payload.items],
        },
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
    query = db.query(models.ModelConfig).filter(models.ModelConfig.is_active.is_(True))
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


@router.post("/model-proxy")
def proxy_model_request(
    payload: schemas.ModelProxyRequest,
    _: models.User = Depends(get_current_user),
):
    target_url = _validate_model_url(payload.base_url)
    timeout_sec = _normalize_timeout_sec(payload.timeout_sec)
    request_payload = payload.payload if payload.payload is not None else {}
    try:
        body_bytes = json.dumps(request_payload, ensure_ascii=False).encode("utf-8")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"模型请求体不是合法 JSON：{exc}"
        ) from exc

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json,text/plain,*/*",
        "User-Agent": "tap-model-proxy/1.0",
    }
    api_key = (payload.api_key or "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    request_obj = urllib_request.Request(
        url=target_url,
        data=body_bytes,
        headers=headers,
        method="POST",
    )

    opener = urllib_request.build_opener(_NoRedirectHandler())

    try:
        with opener.open(request_obj, timeout=timeout_sec) as upstream_resp:
            raw = upstream_resp.read()
            content_type = upstream_resp.headers.get("Content-Type", "application/json")
            return Response(
                content=raw,
                status_code=int(upstream_resp.status),
                headers={"Content-Type": content_type},
            )
    except urllib_error.HTTPError as exc:
        status_code = int(exc.code or 502)
        if 300 <= status_code < 400:
            location = ""
            if exc.headers:
                location = str(exc.headers.get("Location", "") or "").strip()
            detail = "模型接口发生重定向"
            if location:
                detail += f"：{location}"
            detail += "，请检查接口地址或网关配置，当前返回的可能不是实际模型 API"
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=detail,
            ) from exc
        raw = b""
        try:
            raw = exc.read() or b""
        except Exception:
            raw = b""
        content_type = (
            exc.headers.get("Content-Type", "text/plain; charset=utf-8")
            if exc.headers
            else "text/plain; charset=utf-8"
        )
        if not raw:
            reason = str(exc.reason or "upstream error")
            raw = reason.encode("utf-8")
        return Response(
            content=raw,
            status_code=status_code,
            headers={"Content-Type": content_type},
        )
    except urllib_error.URLError as exc:
        reason = getattr(exc, "reason", None)
        msg = str(reason or exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"连接模型服务失败：{msg}"
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="模型服务连接超时"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"模型代理请求失败：{exc}"
        ) from exc


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
