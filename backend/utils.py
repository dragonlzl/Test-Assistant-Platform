import os
import re
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from . import models
from datetime import datetime, timezone


def clean_case_file_name(name: str) -> str:
    """Strip导出标识/后缀，返回干净的用例文件名基线。"""
    base = os.path.basename(name or "").strip()
    # 去除后缀（不限扩展名，避免导出/二次命名带来的非预期扩展名残留）
    base = re.sub(r"\.[^.]+$", "", base)
    # 去除导出/导出 XMind 的时间戳标识（支持多次导出导致的重复后缀）
    # 兼容两种格式：
    # - _YYYYMMDDHHMMSS（14 位）
    # - _YYYYMMDD_HHMMSS（8+6，中间可有下划线）
    ts_pattern = re.compile(r"(_result)?_\d{8}(?:_?\d{6})?$", flags=re.IGNORECASE)
    while ts_pattern.search(base):
        base = ts_pattern.sub("", base)
    # 去除“勾选用例”前缀（用例生成/导出默认命名，兼容 “勾选用例 登录” 这类带空格分隔的手工命名）
    # 注意：历史文件名可能包含全角空格/各种短横线（例如 “勾选用例　登录”、“勾选用例—登录”），需与前端清洗规则保持一致，
    # 否则会出现“前端匹配不到已存在用例 → 重新调用导入 → 后端判重拒绝”的 0 成功/1 失败现象。
    base = re.sub(
        "^勾选用例[\\s_\\-\\u2010-\\u2015\\u2212\\uFE63\\uFF0D]*",
        "",
        base,
        flags=re.IGNORECASE,
    )
    base = base.strip().strip("_- ")
    return base or "case"


def ensure_project_access(db: Session, user: models.User, project_id: int) -> models.Project:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if user.role == "admin":
        return project
    membership = (
        db.query(models.UserProject)
        .filter(
            models.UserProject.project_id == project_id,
            models.UserProject.user_id == user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问该项目")
    return project


def ensure_version_in_project(
    db: Session, project_id: int, version_id: Optional[int]
) -> Optional[models.ProjectVersion]:
    if version_id is None:
        return None
    version = (
        db.query(models.ProjectVersion)
        .filter(
            models.ProjectVersion.id == version_id,
            models.ProjectVersion.project_id == project_id,
        )
        .first()
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="项目版本不存在")
    return version


def ensure_case_item_order(db: Session, case_file_id: int):
    rows = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == int(case_file_id))
        .order_by(models.CaseItem.order_no.asc(), models.CaseItem.id.asc())
        .all()
    )
    if not rows:
        return {}
    expected = 1
    needs_fix = False
    for row in rows:
        order_no = int(row.order_no or 0)
        if order_no != expected:
            needs_fix = True
            break
        expected += 1
    if needs_fix:
        for idx, row in enumerate(rows):
            row.order_no = idx + 1
            db.add(row)
        db.flush()
    return {row.id: row.order_no for row in rows}


def get_executor_for_case(user: models.User, case: models.ExecCase) -> int:
    if case.executor_id:
        return case.executor_id
    if case.updated_by:
        return case.updated_by
    if case.created_by:
        return case.created_by
    return user.id
