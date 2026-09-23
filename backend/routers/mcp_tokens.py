import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .. import models
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user
from ..mcp_auth import token_digest

router = APIRouter(prefix="/mcp-tokens", tags=["mcp"])


class TokenCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=80)
    expires_in_days: int = Field(default=90, ge=1, le=365)
    read_only: bool = False


class TokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    token_prefix: str
    read_only: bool
    revoked: bool
    expires_at: datetime
    created_at: datetime


class TokenCreated(TokenOut):
    token: str


@router.get("", response_model=List[TokenOut])
def list_tokens(response: Response, user=Depends(get_current_user), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return db.query(models.McpToken).filter_by(user_id=user.id).order_by(models.McpToken.id.desc()).all()


@router.post("", response_model=TokenCreated, status_code=201)
def create_token(payload: TokenCreate, response: Response, user=Depends(get_current_user), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    if db.query(models.McpToken).filter_by(user_id=user.id, revoked=False).filter(
        models.McpToken.expires_at > datetime.now(timezone.utc)
    ).count() >= 20:
        raise HTTPException(400, "最多保留 20 个有效 MCP 凭据，请先撤销不使用的凭据")
    secret = "tap_mcp_" + secrets.token_urlsafe(32)
    row = models.McpToken(user_id=user.id, name=payload.name, token_hash=token_digest(secret),
                          token_prefix=secret[:16], read_only=payload.read_only,
                          expires_at=datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days))
    db.add(row)
    db.flush()
    log_operation(db, user.id, "create_mcp_token", "mcp_token", row.id,
                  detail={"name": row.name, "read_only": row.read_only})
    db.commit()
    db.refresh(row)
    return {**TokenOut.model_validate(row).model_dump(), "token": secret}


@router.delete("/{token_id}")
def revoke_token(token_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.McpToken).filter_by(id=token_id, user_id=user.id).first()
    if row is None:
        raise HTTPException(404, "凭据不存在")
    row.revoked = True
    log_operation(db, user.id, "revoke_mcp_token", "mcp_token", row.id, detail={"name": row.name})
    db.commit()
    return {"detail": "MCP 凭据已撤销"}
