from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from . import models


def log_operation(
    db: Session,
    user_id: Optional[int],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    result: str = "success",
    detail: Optional[Any] = None,
) -> None:
    entry = models.OperationLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        detail=detail,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
