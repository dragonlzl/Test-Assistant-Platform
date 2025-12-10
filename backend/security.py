import secrets
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext


# 使用 pbkdf2_sha256 避免 bcrypt 依赖及 72 字节限制
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def generate_token(ttl_minutes: int = 60):
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    token = secrets.token_hex(32)
    return token, expires_at
