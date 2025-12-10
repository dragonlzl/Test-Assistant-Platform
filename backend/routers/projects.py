from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
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
    user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    query = db.query(models.Project)
    if user.role != "admin":
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


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: int,
    payload: schemas.ProjectUpdate,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    if payload.description is not None:
        project.description = payload.description
    db.add(project)
    db.commit()
    db.refresh(project)
    log_operation(
        db=db,
        user_id=admin.id,
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
    )
    db.commit()
    return {"detail": "项目已删除"}


@router.get("/{project_id}/versions", response_model=List[schemas.ProjectVersionOut])
def list_versions(
    project_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
        detail={"project_id": project.id, "name": version.name},
    )
    db.commit()
    return version


@router.delete("/{project_id}/versions/{version_id}")
def delete_version(
    project_id: int,
    version_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_accessible_project(project_id, user, db)
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
    db.delete(version)
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_version",
        target_type="project_version",
        target_id=version_id,
        detail={"project_id": project_id},
    )
    db.commit()
    return {"detail": "版本已删除"}
