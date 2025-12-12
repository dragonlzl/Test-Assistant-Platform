from typing import List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..dependencies import require_admin


router = APIRouter(prefix="/ops", tags=["operation-logs"])


@router.get("", response_model=List[schemas.OperationLogOut])
def list_operation_logs(
    limit: int = 200,
    offset: int = 0,
    user_id: Optional[int] = None,
    _: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if limit <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="limit 必须为正数")
    if limit > 500:
        limit = 500
    query = db.query(models.OperationLog)
    if user_id is not None:
        query = query.filter(models.OperationLog.user_id == user_id)
    logs = (
        query.order_by(models.OperationLog.created_at.desc())
        .offset(offset if offset and offset > 0 else 0)
        .limit(limit)
        .all()
    )
    id_map: Dict[int, str] = {}
    ids = [log.user_id for log in logs if log.user_id]
    if ids:
        rows = db.query(models.User.id, models.User.username).filter(models.User.id.in_(ids)).all()
        id_map = {row[0]: row[1] for row in rows}
    result: List[schemas.OperationLogOut] = []
    for log in logs:
        result.append(
            schemas.OperationLogOut(
                id=log.id,
                user_id=log.user_id,
                username=id_map.get(log.user_id),
                action=log.action,
                target_type=log.target_type,
                target_id=log.target_id,
                result=log.result,
                detail=log.detail,
                created_at=log.created_at,
            )
        )
    return result
