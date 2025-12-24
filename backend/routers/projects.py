from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user, require_admin


router = APIRouter(prefix="/projects", tags=["projects"])


def _get_accessible_project(
    project_id: int, user: models.User, db: Session
) -> models.Project:
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


@router.get("", response_model=List[schemas.ProjectOut])
def list_projects(
    scope: Optional[str] = Query(None),
    include_all: bool = Query(False),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Project)
    scope_text = str(scope or "").strip().lower()
    allow_all = bool(include_all) or scope_text in ("share", "all")
    if user.role != "admin" and not allow_all:
        query = query.join(models.UserProject).filter(models.UserProject.user_id == user.id)
    projects = query.order_by(models.Project.id.desc()).all()
    return projects


@router.post("", response_model=schemas.ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: schemas.ProjectCreate,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(models.Project).filter(models.Project.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="项目名已存在")
    project = models.Project(
        name=payload.name,
        description=payload.description,
        created_by=admin.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    log_operation(
        db=db,
        user_id=admin.id,
        action="create_project",
        target_type="project",
        target_id=project.id,
        detail={"name": project.name},
    )
    db.commit()
    return project


def _is_leader(user: models.User) -> bool:
    if not user or not user.level:
        return False
    return str(user.level).lower() == "leader"


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: int,
    payload: schemas.ProjectUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    is_admin = user.role == "admin"
    if not is_admin:
        membership = (
            db.query(models.UserProject)
            .filter(
                models.UserProject.project_id == project_id,
                models.UserProject.user_id == user.id,
            )
            .first()
        )
        if not membership or not _is_leader(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权限修改该项目"
            )
    if payload.description is not None:
        project.description = payload.description
    db.add(project)
    db.commit()
    db.refresh(project)
    log_operation(
        db=db,
        user_id=user.id,
        action="update_project",
        target_type="project",
        target_id=project.id,
        detail=payload.dict(exclude_none=True),
    )
    db.commit()
    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    db.delete(project)
    log_operation(
        db=db,
        user_id=admin.id,
        action="delete_project",
        target_type="project",
        target_id=project_id,
        detail={"name": project.name, "project_name": project.name},
    )
    db.commit()
    return {"detail": "项目已删除"}


@router.get("/{project_id}/versions", response_model=List[schemas.ProjectVersionOut])
def list_versions(
    project_id: int,
    scope: Optional[str] = Query(None),
    include_all: bool = Query(False),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    scope_text = str(scope or "").strip().lower()
    allow_all = bool(include_all) or scope_text in ("share", "all")
    if user.role != "admin" and not allow_all:
        _get_accessible_project(project_id, user, db)
    return (
        db.query(models.ProjectVersion)
        .filter(models.ProjectVersion.project_id == project_id)
        .order_by(models.ProjectVersion.id.desc())
        .all()
    )


@router.post(
    "/{project_id}/versions",
    response_model=schemas.ProjectVersionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_version(
    project_id: int,
    payload: schemas.ProjectVersionCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_accessible_project(project_id, user, db)
    if user.role != "admin":
        membership = (
            db.query(models.UserProject)
            .filter(
                models.UserProject.project_id == project_id,
                models.UserProject.user_id == user.id,
            )
            .first()
        )
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权限新增该项目版本"
            )
    exists = (
        db.query(models.ProjectVersion)
        .filter(
            models.ProjectVersion.project_id == project_id,
            models.ProjectVersion.name == payload.name,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="版本名已存在")
    version = models.ProjectVersion(
        project_id=project.id,
        name=payload.name,
        created_by=user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    log_operation(
        db=db,
        user_id=user.id,
        action="create_version",
        target_type="project_version",
        target_id=version.id,
        detail={"project_id": project.id, "project_name": project.name, "name": version.name},
    )
    db.commit()
    return version


@router.delete("/{project_id}/versions/{version_id}")
def delete_version(
    project_id: int,
    version_id: int,
    transfer_to: Optional[str] = Query(
        None, description="删除前将用例库中该版本用例转移到指定版本名（同项目内）"
    ),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_accessible_project(project_id, user, db)
    version = (
        db.query(models.ProjectVersion)
        .filter(
            models.ProjectVersion.id == version_id,
            models.ProjectVersion.project_id == project_id,
        )
        .first()
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")
    if user.role != "admin":
        membership = (
            db.query(models.UserProject)
            .filter(
                models.UserProject.project_id == project_id,
                models.UserProject.user_id == user.id,
            )
            .first()
        )
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权限删除该项目版本"
            )

    case_file_count = (
        db.query(func.count(models.CaseFile.id))
        .filter(
            models.CaseFile.project_id == project_id,
            models.CaseFile.version_id == version_id,
        )
        .scalar()
        or 0
    )
    transfer_name = (transfer_to or "").strip()
    moved_count = 0
    moved_exec_sets = 0
    transfer_version_id = None
    if case_file_count > 0:
        if not transfer_name:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "detail": "版本下已存在用例，请先指定转移版本",
                    "code": "VERSION_IN_USE",
                    "case_file_count": int(case_file_count),
                },
            )
        target = (
            db.query(models.ProjectVersion)
            .filter(
                models.ProjectVersion.project_id == project_id,
                models.ProjectVersion.name == transfer_name,
            )
            .first()
        )
        if not target:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="版本不存在，请先创建版本后再操作")
        if target.id == version_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="转移版本不能与当前版本相同")
        moved_count = (
            db.query(models.CaseFile)
            .filter(
                models.CaseFile.project_id == project_id,
                models.CaseFile.version_id == version_id,
            )
            .update({models.CaseFile.version_id: target.id}, synchronize_session=False)
            or 0
        )
        # 同步转移执行集，避免执行页面仍显示“已删除版本”或落入“全部版本”分组
        moved_exec_sets = (
            db.query(models.ExecSet)
            .filter(
                models.ExecSet.project_id == project_id,
                models.ExecSet.version_id == version_id,
            )
            .update({models.ExecSet.version_id: target.id}, synchronize_session=False)
            or 0
        )
        transfer_version_id = target.id

    db.delete(version)
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_version",
        target_type="project_version",
        target_id=version_id,
        detail={
            "project_id": project_id,
            "project_name": project.name,
            "name": version.name,
            "version_name": version.name,
            "case_file_count": int(case_file_count),
            "moved_case_files": int(moved_count),
            "moved_exec_sets": int(moved_exec_sets),
            "transfer_to_version_name": transfer_name or None,
            "transfer_to_version_id": transfer_version_id,
        },
    )
    db.commit()
    return {"detail": "版本已删除"}
