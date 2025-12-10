import os
import re
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from . import models


def clean_case_file_name(name: str) -> str:
    """Strip导出标识/后缀，返回干净的用例文件名基线。"""
    base = os.path.basename(name or "")
    base = re.sub(r"\.(xmind|json|txt|csv)$", "", base, flags=re.IGNORECASE)
    base = re.sub(r"(?:_result)?_\d{14}$", "", base)
    base = re.sub(r"^勾选用例[-_]*", "", base)
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
