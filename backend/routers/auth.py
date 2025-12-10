from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..config import settings
from ..db import get_db
from ..dependencies import get_current_session, get_current_user
from ..security import generate_token, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")
    token, expires_at = generate_token(ttl_minutes=8 * 60)
    session = models.UserSession(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        revoked=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(session)
    log_operation(
        db=db,
        user_id=user.id,
        action="login",
        target_type="auth",
        target_id=user.id,
        detail={"expires_at": expires_at.isoformat()},
    )
    db.commit()
    return schemas.TokenResponse(
        access_token=token,
        expires_at=expires_at,
        user=user,
    )


@router.post("/logout")
def logout(
    session: models.UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
):
    session.revoked = True
    db.add(session)
    log_operation(
        db=db,
        user_id=session.user_id,
        action="logout",
        target_type="auth",
        target_id=session.user_id,
    )
    db.commit()
    return {"detail": "logged out"}


@router.post("/password")
def change_password(
    payload: schemas.PasswordChangeRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="旧密码错误")
    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.query(models.UserSession).filter(models.UserSession.user_id == user.id).update(
        {"revoked": True}
    )
    log_operation(
        db=db,
        user_id=user.id,
        action="change_password",
        target_type="user",
        target_id=user.id,
    )
    db.commit()
    return {"detail": "密码已更新，请重新登录"}
