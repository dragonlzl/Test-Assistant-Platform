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
) -> models.OperationLog:
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
    return entry


def log_case_library_change(
    db: Session,
    user: Optional[models.User],
    project_id: int,
    file_name_clean: str,
    kind: str,
    version_id: Optional[int] = None,
    case_file_id: Optional[int] = None,
    case_item_id: Optional[int] = None,
    old: Optional[Any] = None,
    new: Optional[Any] = None,
    meta: Optional[Any] = None,
    at: Optional[datetime] = None,
) -> None:
    """
    用例库改动历史：永久保留，允许关联对象被删除（case_files/case_items）。

    kind 约定：
    - import / reimport / file_deleted
    - added / updated / deleted（对应 case_item 变更）
    """
    when = at or datetime.now(timezone.utc)
    operator_id = None
    operator_name = None
    if user:
        operator_id = user.id
        operator_name = user.username
    entry = models.CaseLibraryChangeEvent(
        project_id=int(project_id),
        version_id=int(version_id) if (version_id is not None) else None,
        file_name_clean=str(file_name_clean or "").strip(),
        case_file_id=int(case_file_id) if (case_file_id is not None) else None,
        case_item_id=int(case_item_id) if (case_item_id is not None) else None,
        kind=str(kind or "").strip(),
        operator_id=operator_id,
        operator_name=operator_name,
        old_json=old,
        new_json=new,
        meta_json=meta,
        created_at=when,
    )
    db.add(entry)
