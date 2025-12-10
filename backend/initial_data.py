from datetime import datetime, timezone

from sqlalchemy.orm import Session

from . import models
from .config import settings
from .security import hash_password


def ensure_admin(db: Session) -> None:
    admin = (
        db.query(models.User)
        .filter(models.User.username == settings.default_admin_username)
        .first()
    )
    if admin:
        return
    admin_user = models.User(
        username=settings.default_admin_username,
        password_hash=hash_password(settings.default_admin_password),
        role="admin",
        level="leader",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(admin_user)
    db.commit()


def init_db(db: Session) -> None:
    ensure_admin(db)
