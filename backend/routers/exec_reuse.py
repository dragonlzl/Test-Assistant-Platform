"""Web API adapter; MCP calls the same service within its own receipt transaction."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from .. import models
from ..db import engine, get_db
from ..dependencies import get_current_user
from ..execution_reuse_service import AddPresets, UpdatePresets, QuickExecute, get_reuse_context, mutate_reuse

router = APIRouter(prefix="/exec/sets/{exec_set_id}/reuse", tags=["execution"])


@router.get("")
def read_reuse(exec_set_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return get_reuse_context(db, user, exec_set_id)


def write_reuse(exec_set_id, payload, user, operation):
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
            with Session(bind=connection, join_transaction_mode="rollback_only", expire_on_commit=False) as db:
                current_user = db.get(models.User, user.id)
                if current_user is None or not current_user.is_active:
                    raise HTTPException(403, "账号不可用")
                result = mutate_reuse(db, current_user, exec_set_id, payload, operation)
                db.flush()
                connection.commit()
                return result
    except IntegrityError:
        raise HTTPException(409, "数据冲突，操作未提交，请重新读取")
    except OperationalError:
        raise HTTPException(503, "数据库暂忙，操作未提交，请稍后重试")


@router.post("/presets")
def add_presets(exec_set_id: int, payload: AddPresets, user=Depends(get_current_user)):
    return write_reuse(exec_set_id, payload, user, "add")


@router.patch("/presets")
def update_presets(exec_set_id: int, payload: UpdatePresets, user=Depends(get_current_user)):
    return write_reuse(exec_set_id, payload, user, "update")


@router.post("/quick-execute")
def quick_execute(exec_set_id: int, payload: QuickExecute, user=Depends(get_current_user)):
    return write_reuse(exec_set_id, payload, user, "quick")
