"""Personal MCP credentials are separate from browser sessions; plaintext is never stored."""
import hashlib
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def authenticate_mcp(db: Session, authorization: str):
    scheme, _, secret = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secret.startswith("tap_mcp_"):
        raise HTTPException(401, "需要个人 MCP 凭据", headers={"WWW-Authenticate": "Bearer"})
    token = db.query(models.McpToken).filter_by(token_hash=token_digest(secret), revoked=False).first()
    if token is None:
        raise HTTPException(401, "MCP 凭据无效或已撤销", headers={"WWW-Authenticate": "Bearer"})
    expires = token.expires_at.replace(tzinfo=timezone.utc) if token.expires_at.tzinfo is None else token.expires_at
    if expires <= datetime.now(timezone.utc) or not token.user or not token.user.is_active:
        raise HTTPException(401, "MCP 凭据已过期或账号不可用", headers={"WWW-Authenticate": "Bearer"})
    return token


def revoke_user_mcp_tokens(db: Session, user_id: int):
    db.query(models.McpToken).filter_by(user_id=user_id).update({"revoked": True})
