from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..config import settings
from ..db import get_db
from ..dependencies import get_current_user, require_admin
from ..security import hash_password


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("", response_model=List[schemas.UserOut])
def list_users(_: models.User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.id.asc()).all()


@router.post("", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: schemas.UserCreate,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(models.User).filter(models.User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="账号已存在")
    password = payload.password or settings.default_user_password
    user = models.User(
        username=payload.username,
        password_hash=hash_password(password),
        role=payload.role or "user",
        level=payload.level or "member",
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_operation(
        db=db,
        user_id=admin.id,
        action="create_user",
        target_type="user",
        target_id=user.id,
        detail={"username": user.username},
    )
    db.commit()
    return user


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if payload.role:
        user.role = payload.role
    if payload.level:
        user.level = payload.level
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    log_operation(
        db=db,
        user_id=admin.id,
        action="update_user",
        target_type="user",
        target_id=user.id,
        detail=payload.dict(exclude_none=True),
    )
    db.commit()
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    db.delete(user)
    log_operation(
        db=db,
        user_id=admin.id,
        action="delete_user",
        target_type="user",
        target_id=user_id,
    )
    db.commit()
    return {"detail": "用户已删除"}


@router.post("/{user_id}/reset_password")
def reset_password(
    user_id: int,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    user.password_hash = hash_password(settings.default_user_password)
    db.add(user)
    log_operation(
        db=db,
        user_id=admin.id,
        action="reset_password",
        target_type="user",
        target_id=user.id,
    )
    db.commit()
    return {"detail": "密码已重置"}


@router.post("/assign-projects")
def assign_projects(
    payload: schemas.UserProjectAssignment,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if payload.project_ids:
        projects = (
            db.query(models.Project)
            .filter(models.Project.id.in_(payload.project_ids))
            .all()
        )
        found_ids = {p.id for p in projects}
        missing = [pid for pid in payload.project_ids if pid not in found_ids]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"项目不存在：{missing}"
            )
    db.query(models.UserProject).filter(models.UserProject.user_id == user.id).delete(
        synchronize_session=False
    )
    for pid in payload.project_ids:
        db.add(models.UserProject(user_id=user.id, project_id=pid))
    log_operation(
        db=db,
        user_id=admin.id,
        action="assign_projects",
        target_type="user",
        target_id=user.id,
        detail={"project_ids": payload.project_ids},
    )
    db.commit()
    return {"detail": "项目分配已更新"}
