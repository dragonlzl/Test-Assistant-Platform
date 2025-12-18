from datetime import datetime, timezone
from typing import List
import json
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, aliased

from .. import models, schemas
from ..audit import log_case_library_change, log_operation
from ..db import get_db
from ..dependencies import get_current_user
from ..utils import ensure_project_access, ensure_version_in_project
from sqlalchemy import func, case, and_, cast, Integer
from sqlalchemy.exc import IntegrityError


router = APIRouter(prefix="/exec", tags=["execution"])


def _snapshot_case_item_for_history(case_item: models.CaseItem):
    if not case_item:
        return None
    return {
        "module": case_item.module,
        "title": case_item.title,
        "priority": case_item.priority,
        "precondition": case_item.precondition or "",
        "steps": case_item.steps or "",
        "expected": case_item.expected,
        "remark": case_item.remark,
    }


def _compute_case_item_changed_fields(old_snap: dict, new_snap: dict):
    keys = ["module", "title", "precondition", "steps", "expected"]
    changed = []
    for k in keys:
        old_val = "" if old_snap is None else str(old_snap.get(k) or "")
        new_val = "" if new_snap is None else str(new_snap.get(k) or "")
        if old_val != new_val:
            changed.append(k)
    return changed

_case_file_source_pattern = re.compile(r"^case_file:(\d+)$")


def _ensure_exec_set_access(
    db: Session, user: models.User, exec_set_id: int, allow_archived: bool = False
) -> models.ExecSet:
    exec_set = db.query(models.ExecSet).filter(models.ExecSet.id == exec_set_id).first()
    if not exec_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="执行集不存在")
    ensure_project_access(db, user, exec_set.project_id)
    # 执行结果按“个人”隔离：非管理员只能访问自己创建的执行集，避免多人执行结果互相覆盖。
    if user.role != "admin":
        owner_id = exec_set.created_by
        if not owner_id or int(owner_id) != int(user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问该执行集")
    if not allow_archived:
        current_status = str(exec_set.status or "").strip().lower()
        if current_status == "archived":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="执行集已归档，无法修改")
    return exec_set


def _ensure_exec_set_read_access(
    db: Session, user: models.User, exec_set_id: int
) -> models.ExecSet:
    exec_set = db.query(models.ExecSet).filter(models.ExecSet.id == exec_set_id).first()
    if not exec_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="执行集不存在")
    ensure_project_access(db, user, exec_set.project_id)
    return exec_set


def _parse_case_file_id(case_file_id, source):
    if case_file_id is not None:
        try:
            cid = int(case_file_id)
            return cid if cid > 0 else None
        except Exception:
            return None
    if not source:
        return None
    raw = str(source).strip()
    if not raw:
        return None
    if raw.isdigit():
        try:
            cid = int(raw)
            return cid if cid > 0 else None
        except Exception:
            return None
    m = _case_file_source_pattern.match(raw)
    if m and m.group(1):
        try:
            cid = int(m.group(1))
            return cid if cid > 0 else None
        except Exception:
            return None
    return None


@router.post("/sets", response_model=schemas.ExecSetOut, status_code=status.HTTP_201_CREATED)
def create_exec_set(
    payload: schemas.ExecSetCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = ensure_project_access(db, user, payload.project_id)
    ensure_version_in_project(db, project.id, payload.version_id)
    base_updated_at = None
    if payload.case_file_id:
        case_file = (
            db.query(models.CaseFile)
            .filter(models.CaseFile.id == payload.case_file_id)
            .first()
        )
        if case_file and int(case_file.project_id) == int(project.id):
            base_updated_at = case_file.updated_at
    exec_set = models.ExecSet(
        project_id=project.id,
        version_id=payload.version_id,
        name=payload.name,
        source=payload.source,
        case_file_id=payload.case_file_id,
        requirement=payload.requirement,
        reuse_enabled=bool(payload.reuse_enabled),
        reuse_presets=payload.reuse_presets,
        status="active",
        case_file_base_updated_at=base_updated_at,
        case_file_last_synced_at=base_updated_at,
        created_by=user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(exec_set)
    # 先 flush，确保 log 里能拿到 exec_set.id
    db.flush()
    log_operation(
        db=db,
        user_id=user.id,
        action="create_exec_set",
        target_type="exec_set",
        target_id=exec_set.id,
        detail={"project_id": project.id, "name": payload.name},
    )
    db.commit()
    db.refresh(exec_set)
    setattr(exec_set, "case_count", 0)
    return exec_set


@router.patch("/sets/{exec_set_id}", response_model=schemas.ExecSetOut)
def update_exec_set(
    exec_set_id: int,
    payload: schemas.ExecSetUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_set = _ensure_exec_set_access(db, user, exec_set_id)
    prev_status = str(exec_set.status or "").strip().lower()
    data = payload.model_dump(exclude_unset=True)
    if "status" in data:
        desired = str(data.get("status") or "").strip().lower()
        if desired == "archived":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请使用归档按钮进行归档")
    changed = False
    turned_on_reuse = False
    turned_off_reuse = False
    prev_reuse_enabled = bool(getattr(exec_set, "reuse_enabled", False))
    for field in ["status", "requirement", "reuse_enabled", "reuse_presets"]:
        if field not in data:
            continue
        value = data[field]
        if field == "reuse_enabled":
            value = bool(value)
            if (not prev_reuse_enabled) and value:
                turned_on_reuse = True
            if prev_reuse_enabled and (not value):
                turned_off_reuse = True
        if value != getattr(exec_set, field):
            setattr(exec_set, field, value)
            changed = True
    if changed:
        # 归档后重新激活：视为“重新开始”，清空用例库变更历史（不影响执行用例本身的保留/清理规则）。
        next_status = str(exec_set.status or "").strip().lower()
        if prev_status and prev_status != "active" and next_status == "active":
            if exec_set.case_file_id:
                case_file = (
                    db.query(models.CaseFile)
                    .filter(models.CaseFile.id == int(exec_set.case_file_id))
                    .first()
                )
                if case_file and case_file.updated_at:
                    exec_set.case_file_base_updated_at = case_file.updated_at
                    exec_set.case_file_last_synced_at = case_file.updated_at
            exec_set.case_file_last_diff_at = None
            exec_set.case_file_last_diff_json = None
            exec_set.case_file_last_diff_shown_at = None
            exec_set.case_file_diff_history_json = None
        exec_set.updated_at = datetime.now(timezone.utc)
        db.add(exec_set)
        # 执行页复用开关需同步到用例库（case_files.reuse_enabled），避免执行页取消勾选后被用例库状态“反向开启”。
        # 兼容旧数据：部分 exec_sets.case_file_id 为空，但 source 内含 case_file_id（case_file:123）。
        resolved_case_file_id = _parse_case_file_id(exec_set.case_file_id, exec_set.source)
        if resolved_case_file_id and exec_set.case_file_id is None:
            exec_set.case_file_id = resolved_case_file_id
            db.add(exec_set)
        if resolved_case_file_id and (turned_on_reuse or turned_off_reuse):
            case_file = (
                db.query(models.CaseFile)
                .filter(models.CaseFile.id == int(resolved_case_file_id))
                .first()
            )
            if case_file and int(case_file.project_id) == int(exec_set.project_id):
                desired = True if turned_on_reuse else False
                if bool(getattr(case_file, "reuse_enabled", False)) != desired:
                    case_file.reuse_enabled = desired
                    case_file.updated_by = user.id
                    case_file.updated_at = exec_set.updated_at
                    db.add(case_file)
        log_operation(
            db=db,
            user_id=user.id,
            action="update_exec_set",
            target_type="exec_set",
            target_id=exec_set.id,
        )
        db.commit()
        db.refresh(exec_set)
    setattr(exec_set, "case_count", None)
    return exec_set


@router.delete("/sets/{exec_set_id}")
def delete_exec_set(
    exec_set_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_set = _ensure_exec_set_access(db, user, exec_set_id)
    target_id = exec_set.id
    project_id = exec_set.project_id
    name = exec_set.name
    db.delete(exec_set)
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_exec_set",
        target_type="exec_set",
        target_id=target_id,
        detail={"project_id": project_id, "name": name},
    )
    db.commit()
    return {"status": "ok"}


def _get_exec_set_case_status_counts(db: Session, exec_set_id: int):
    pending_statuses = ["pending", "未执行", "变更重跑", "有改动", ""]
    failed_statuses = ["failed", "失败"]
    blocked_statuses = ["blocked", "阻塞"]
    row = (
        db.query(
            func.count(models.ExecCase.id).label("total"),
            func.sum(
                case(
                    (
                        (models.ExecCase.status.is_(None))
                        | (models.ExecCase.status.in_(pending_statuses)),
                        1,
                    ),
                    else_=0,
                )
            ).label("pending"),
            func.sum(case((models.ExecCase.status.in_(failed_statuses), 1), else_=0)).label(
                "failed"
            ),
            func.sum(
                case((models.ExecCase.status.in_(blocked_statuses), 1), else_=0)
            ).label("blocked"),
        )
        .filter(models.ExecCase.exec_set_id == exec_set_id)
        .first()
    )
    if not row:
        return {"total": 0, "pending": 0, "failed": 0, "blocked": 0}
    return {
        "total": int(row.total or 0),
        "pending": int(row.pending or 0),
        "failed": int(row.failed or 0),
        "blocked": int(row.blocked or 0),
    }


def _build_archive_list_item(
    exec_set: models.ExecSet,
    project_name: str,
    version_name: str,
    importer_name: str,
    archiver_name: str,
    case_count: int,
):
    return schemas.ExecArchiveListItemOut(
        exec_set_id=int(exec_set.id),
        project_id=int(exec_set.project_id),
        project_name=project_name or "",
        version_id=(int(exec_set.version_id) if exec_set.version_id is not None else None),
        version_name=(version_name if version_name else None),
        name=str(exec_set.name or ""),
        case_count=int(case_count or 0),
        reuse_enabled=bool(getattr(exec_set, "reuse_enabled", False)),
        imported_by=(int(exec_set.created_by) if exec_set.created_by is not None else None),
        imported_by_name=(importer_name if importer_name else None),
        imported_at=exec_set.created_at,
        archived_by=(int(exec_set.archived_by) if exec_set.archived_by is not None else None),
        archived_by_name=(archiver_name if archiver_name else None),
        archived_at=(exec_set.archived_at if exec_set.archived_at is not None else None),
        archived_reason=(str(exec_set.archived_reason) if exec_set.archived_reason is not None else None),
    )


@router.post("/sets/{exec_set_id}/archive", response_model=schemas.ExecArchiveListItemOut)
def archive_exec_set(
    exec_set_id: int,
    payload: schemas.ExecSetArchiveRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_set = _ensure_exec_set_access(db, user, exec_set_id, allow_archived=True)
    current_status = str(exec_set.status or "").strip().lower()
    if current_status == "archived":
        # 幂等：重复点击归档直接返回当前归档记录。
        pass
    else:
        counts = _get_exec_set_case_status_counts(db, exec_set.id)
        need_reason = bool(counts.get("pending") or counts.get("failed") or counts.get("blocked"))
        reason = str(payload.reason or "").strip()
        if need_reason and not reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "detail": "仍存在未通过用例，归档需填写原因",
                    "counts": counts,
                },
            )
        now = datetime.now(timezone.utc)
        exec_set.status = "archived"
        exec_set.archived_by = user.id
        exec_set.archived_at = now
        exec_set.archived_reason = reason if reason else None
        exec_set.updated_at = now
        db.add(exec_set)
        log_operation(
            db=db,
            user_id=user.id,
            action="archive_exec_set",
            target_type="exec_set",
            target_id=exec_set.id,
            detail={
                "project_id": exec_set.project_id,
                "name": exec_set.name,
                "counts": counts,
                "reason": (reason if reason else None),
            },
        )
        db.commit()
        db.refresh(exec_set)

    importer = aliased(models.User)
    archiver = aliased(models.User)
    case_count_sq = (
        db.query(
            models.ExecCase.exec_set_id.label("exec_set_id"),
            func.count(models.ExecCase.id).label("case_count"),
        )
        .group_by(models.ExecCase.exec_set_id)
        .subquery()
    )
    row = (
        db.query(
            models.ExecSet,
            models.Project.name.label("project_name"),
            models.ProjectVersion.name.label("version_name"),
            importer.username.label("importer_name"),
            archiver.username.label("archiver_name"),
            case_count_sq.c.case_count.label("case_count"),
        )
        .join(models.Project, models.Project.id == models.ExecSet.project_id)
        .outerjoin(models.ProjectVersion, models.ProjectVersion.id == models.ExecSet.version_id)
        .outerjoin(importer, importer.id == models.ExecSet.created_by)
        .outerjoin(archiver, archiver.id == models.ExecSet.archived_by)
        .outerjoin(case_count_sq, case_count_sq.c.exec_set_id == models.ExecSet.id)
        .filter(models.ExecSet.id == exec_set.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="归档记录不存在")
    es, project_name, version_name, importer_name, archiver_name, case_count = row
    return _build_archive_list_item(
        es,
        project_name,
        version_name,
        importer_name,
        archiver_name,
        int(case_count or 0),
    )


def _normalize_match_key(
    module: str, title: str, precondition: str, steps: str, expected: str
) -> str:
    def _norm(value: str) -> str:
        return (value or "").strip().lower()

    return (
        _norm(module)
        + "::"
        + _norm(title)
        + "::"
        + _norm(precondition)
        + "::"
        + _norm(steps)
        + "::"
        + _norm(expected)
    )


def _has_reuse_execution(reuse_details_value) -> bool:
    """
    判断“复用子项”是否存在有效执行结果。
    - status 为 通过/失败/阻塞/不适用 视为已执行
    - note 非空也视为有执行痕迹（避免仅靠 status 丢失）
    """
    if reuse_details_value is None:
        return False
    data = reuse_details_value
    if isinstance(reuse_details_value, str):
        raw = reuse_details_value.strip()
        if not raw:
            return False
        try:
            data = json.loads(raw)
        except Exception:
            data = None
    if not isinstance(data, list):
        return False
    for item in data:
        if not isinstance(item, dict):
            continue
        st = str(item.get("status") or "").strip()
        if st and st not in ("未执行", "pending"):
            return True
        note = str(item.get("note") or "").strip()
        if note:
            return True
    return False


@router.post("/sets/from-case-file", response_model=schemas.ExecSetOut)
def upsert_exec_set_from_case_file(
    payload: schemas.ExecSetFromCaseFileRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case_file = (
        db.query(models.CaseFile).filter(models.CaseFile.id == payload.case_file_id).first()
    )
    if not case_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例文件不存在")
    ensure_project_access(db, user, case_file.project_id)
    ensure_version_in_project(db, case_file.project_id, case_file.version_id)
    exec_version_field_set = (
        hasattr(payload, "__fields_set__") and "exec_version_id" in payload.__fields_set__
    )
    if exec_version_field_set and payload.exec_version_id is not None:
        ensure_version_in_project(db, case_file.project_id, payload.exec_version_id)

    mode = (payload.mode or "replace").strip().lower()
    if mode not in ("replace", "append"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mode 仅支持 replace/append")
    prefer_source = (payload.prefer_result_source or "db").strip().lower()
    if prefer_source not in ("db", "import"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="prefer_result_source 仅支持 db/import")
    preserve_results = True if payload.preserve_results is None else bool(payload.preserve_results)

    target_version_id = payload.exec_version_id if exec_version_field_set else case_file.version_id

    # 按用户隔离：同一份 case_file，每个用户各自维护一份 exec_set/exec_cases。
    # 同一用户、同一 case_file：允许按“执行版本（exec_sets.version_id）”分叉多份执行集，执行结果相互独立。
    exec_set_q = (
        db.query(models.ExecSet)
        .filter(
            models.ExecSet.case_file_id == case_file.id,
            models.ExecSet.created_by == user.id,
            models.ExecSet.status == "active",
        )
    )
    if target_version_id is None:
        exec_set_q = exec_set_q.filter(models.ExecSet.version_id.is_(None))
    else:
        exec_set_q = exec_set_q.filter(models.ExecSet.version_id == int(target_version_id))
    exec_set = exec_set_q.order_by(models.ExecSet.id.desc()).first()
    now = datetime.now(timezone.utc)
    created = False
    if not exec_set:
        initial_version_id = target_version_id
        exec_set = models.ExecSet(
            project_id=case_file.project_id,
            version_id=initial_version_id,
            case_file_id=case_file.id,
            name=case_file.file_name_clean,
            status="active",
            case_file_base_updated_at=case_file.updated_at,
            case_file_last_synced_at=case_file.updated_at,
            created_by=user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(exec_set)
        db.flush()
        created = True
    else:
        exec_set.updated_at = now
        if exec_version_field_set:
            exec_set.version_id = payload.exec_version_id
        if exec_set.case_file_base_updated_at is None:
            exec_set.case_file_base_updated_at = case_file.updated_at
        if exec_set.case_file_last_synced_at is None:
            exec_set.case_file_last_synced_at = case_file.updated_at

    if payload.requirement is not None:
        exec_set.requirement = payload.requirement
    explicit_reuse_enabled = None
    if payload.reuse_enabled is not None:
        explicit_reuse_enabled = bool(payload.reuse_enabled)
        exec_set.reuse_enabled = explicit_reuse_enabled
    elif created and bool(getattr(case_file, "reuse_enabled", False)):
        # 用例库标记为复用类型时：新建执行集默认启用复用（避免被创建为非复用）。
        exec_set.reuse_enabled = True
    if payload.reuse_presets is not None:
        exec_set.reuse_presets = payload.reuse_presets

    # 复用类型同步到用例库（case_files.reuse_enabled），保证执行页与用例库一致，避免“取消勾选后又被反向开启”。
    if explicit_reuse_enabled is not None:
        if bool(getattr(case_file, "reuse_enabled", False)) != explicit_reuse_enabled:
            case_file.reuse_enabled = explicit_reuse_enabled
            db.add(case_file)
    elif exec_set.reuse_enabled and not bool(getattr(case_file, "reuse_enabled", False)):
        case_file.reuse_enabled = True
        db.add(case_file)

    import_map = {}
    if payload.import_cases:
        for item in payload.import_cases:
            key = _normalize_match_key(
                item.module, item.title, item.precondition, item.steps, item.expected
            )
            import_map[key] = item

    case_items = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == case_file.id)
        .order_by(models.CaseItem.id.asc())
        .all()
    )
    existing_cases = (
        db.query(models.ExecCase)
        .filter(models.ExecCase.exec_set_id == exec_set.id)
        .order_by(models.ExecCase.order_no.asc(), models.ExecCase.id.asc())
        .all()
    )
    if mode == "replace" and not preserve_results and existing_cases:
        # 覆盖导入等场景：强制“完全替换”，避免旧条目残留导致前端展示为追加/合并。
        # 注意：这会删除执行集中所有旧用例（包含未绑定 case_item 的临时用例）。
        db.query(models.ExecCase).filter(models.ExecCase.exec_set_id == exec_set.id).delete(
            synchronize_session=False
        )
        existing_cases = []
    existing_by_item_id = {}
    for row in existing_cases:
        if not row:
            continue
        source_id = getattr(row, "case_item_source_id", None)
        if source_id is None and row.case_item_id:
            source_id = int(row.case_item_id)
        if source_id is None:
            continue
        existing_by_item_id[int(source_id)] = row

    keep_item_ids = set([it.id for it in case_items])

    new_cases: List[models.ExecCase] = []
    updated_any = False
    base_order = 1
    if mode == "append":
        # append mode: 在现有顺序末尾新增库里还未存在的用例
        base_order = (
            max([c.order_no for c in existing_cases if c.order_no is not None] or [0]) + 1
        )

    for idx, item in enumerate(case_items):
        existing = existing_by_item_id.get(item.id)
        if existing and mode == "append":
            continue
        key = _normalize_match_key(item.module, item.title, item.precondition, item.steps, item.expected)
        import_case = import_map.get(key)

        if existing:
            before_module = existing.module
            before_title = existing.title
            before_expected = existing.expected
            before_priority = existing.priority
            before_precondition = existing.precondition
            before_steps = existing.steps
            before_remark = existing.remark

            existing.module = item.module
            existing.title = item.title
            existing.expected = item.expected
            existing.priority = item.priority
            existing.precondition = item.precondition
            existing.steps = item.steps
            existing.remark = item.remark
            existing.case_item_id = item.id
            existing.case_item_source_id = int(item.id)
            existing.updated_by = user.id
            existing.updated_at = now
            if mode == "replace":
                existing.order_no = idx + 1
            if import_case and prefer_source == "import":
                if import_case.status is not None:
                    existing.status = import_case.status
                if import_case.remark is not None:
                    existing.remark = import_case.remark
                if import_case.reuse_details is not None:
                    existing.reuse_details = import_case.reuse_details
                if import_case.defect_links is not None:
                    existing.defect_links = import_case.defect_links
            else:
                changed = (
                    before_module != existing.module
                    or before_title != existing.title
                    or before_expected != existing.expected
                    or before_priority != existing.priority
                    or before_precondition != existing.precondition
                    or before_steps != existing.steps
                    or before_remark != existing.remark
                )
                # 用例库发生改动时：若该用例已有执行结果，则标记为“变更重跑”（系统态），提醒重新确认并按未执行处理。
                if changed:
                    before_status = str(existing.status or "").strip()
                    defect_links_value = existing.defect_links
                    reuse_details_value = existing.reuse_details
                    has_defect_links = False
                    if defect_links_value is not None:
                        if isinstance(defect_links_value, list):
                            has_defect_links = bool(defect_links_value)
                        else:
                            has_defect_links = bool(str(defect_links_value).strip())
                    has_reuse_execution = _has_reuse_execution(reuse_details_value)
                    has_result = bool(before_status and before_status != "未执行") or bool(
                        (existing.actual_result or "").strip()
                        or (existing.remark or "").strip()
                        or (existing.defect_link or "").strip()
                        or has_defect_links
                        or has_reuse_execution
                    )
                    if has_result and before_status not in ("变更重跑", "有改动"):
                        existing.status = "变更重跑"
                        # 复用类型：子项状态也同步为“变更重跑”，避免子项仍显示旧结果。
                        if isinstance(existing.reuse_details, list) and existing.reuse_details:
                            next_details = []
                            for d in existing.reuse_details:
                                if isinstance(d, dict):
                                    d2 = dict(d)
                                    d2["status"] = "变更重跑"
                                    next_details.append(d2)
                                else:
                                    next_details.append(d)
                            existing.reuse_details = next_details
            db.add(existing)
            updated_any = True
            continue

        # create new
        order_no = (idx + 1) if mode == "replace" else (base_order + len(new_cases))
        exec_case = models.ExecCase(
            exec_set_id=exec_set.id,
            case_item_id=item.id,
            case_item_source_id=int(item.id),
            module=item.module,
            title=item.title,
            expected=item.expected,
            priority=item.priority,
            precondition=item.precondition,
            steps=item.steps,
            actual_result=None,
            defect_link=None,
            reuse_details=import_case.reuse_details if import_case else None,
            defect_links=import_case.defect_links if import_case else None,
            remark=(import_case.remark if (import_case and import_case.remark is not None) else item.remark),
            status=(import_case.status if (import_case and import_case.status is not None) else "未执行"),
            order_no=order_no,
            executor_id=user.id,
            created_by=user.id,
            updated_by=user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(exec_case)
        new_cases.append(exec_case)
        updated_any = True

    if mode == "replace":
        # 删除已不存在的旧用例（例如用例库被删除或替换）
        for old in existing_cases:
            source_id = getattr(old, "case_item_source_id", None)
            if source_id is None and old.case_item_id:
                source_id = int(old.case_item_id)
            # source_id 为空的用例视为“手工新增执行用例”，不参与用例库同步删除。
            if source_id is None:
                continue
            if int(source_id) not in keep_item_ids:
                db.delete(old)
                updated_any = True

    # 标记“已同步到用例库版本”，用于后续执行页刷新判断是否存在用例库新变更。
    exec_set.case_file_last_synced_at = case_file.updated_at

    action = "upsert_exec_set_from_case_file"
    log_operation(
        db=db,
        user_id=user.id,
        action=action,
        target_type="exec_set",
        target_id=exec_set.id,
        detail={
            "case_file_id": case_file.id,
            "mode": mode,
            "created": created,
            "new_cases": len(new_cases),
        },
    )
    db.commit()
    db.refresh(exec_set)
    try:
        count = (
            db.query(func.count(models.ExecCase.id))
            .filter(models.ExecCase.exec_set_id == exec_set.id)
            .scalar()
        )
        setattr(exec_set, "case_count", int(count or 0))
    except Exception:
        setattr(exec_set, "case_count", None)
    return exec_set


@router.get("/sets", response_model=List[schemas.ExecSetOut])
def list_exec_sets(
    project_id: int = None,
    all_users: bool = False,
    status_filter: str = "active",
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.ExecSet)
    if project_id:
        ensure_project_access(db, user, project_id)
        query = query.filter(models.ExecSet.project_id == project_id)
    elif user.role != "admin":
        # 非管理员：仍需限制为“当前可访问的项目范围”，避免用户被移出项目后仍能看到历史执行集。
        query = query.join(models.Project).join(models.UserProject).filter(
            models.UserProject.user_id == user.id
        )

    # 默认仅返回“当前用户”的执行集，保证执行结果不串；管理员可用 all_users=true 拉全量（用于排查/管理）。
    if user.role != "admin":
        query = query.filter(models.ExecSet.created_by == user.id)
    elif not all_users:
        query = query.filter(models.ExecSet.created_by == user.id)
    desired = str(status_filter or "active").strip().lower()
    if desired not in ("active", "archived", "all"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status_filter 仅支持 active/archived/all")
    if desired != "all":
        query = query.filter(models.ExecSet.status == desired)
    case_count_sq = (
        db.query(
            models.ExecCase.exec_set_id.label("exec_set_id"),
            func.count(models.ExecCase.id).label("case_count"),
        )
        .group_by(models.ExecCase.exec_set_id)
        .subquery()
    )
    rows = (
        query.with_entities(models.ExecSet, case_count_sq.c.case_count.label("case_count"))
        .outerjoin(case_count_sq, case_count_sq.c.exec_set_id == models.ExecSet.id)
        .order_by(models.ExecSet.id.desc())
        .all()
    )
    result = []
    for row in rows:
        exec_set, case_count = row
        result.append(
            {
                "id": exec_set.id,
                "project_id": exec_set.project_id,
                "version_id": exec_set.version_id,
                "source": exec_set.source,
                "case_file_id": exec_set.case_file_id,
                "name": exec_set.name,
                "requirement": exec_set.requirement,
                "reuse_enabled": bool(exec_set.reuse_enabled),
                "reuse_presets": exec_set.reuse_presets,
                "case_count": int(case_count or 0),
                "status": exec_set.status,
                "created_at": exec_set.created_at,
                "updated_at": exec_set.updated_at,
            }
        )
    return result


@router.get("/sets/by-case-file", response_model=List[schemas.ExecSetByCaseFileOut])
def list_exec_sets_by_case_file(
    project_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_project_access(db, user, project_id)
    rows = (
        db.query(
            models.ExecSet.case_file_id,
            models.ExecSet.source,
            models.ExecSet.status,
            models.User.username,
        )
        .outerjoin(models.User, models.User.id == models.ExecSet.created_by)
        .filter(models.ExecSet.project_id == project_id)
        .all()
    )
    by_file = {}
    for case_file_id, source, status_text, username in rows:
        fid = _parse_case_file_id(case_file_id, source)
        if not fid:
            continue
        entry = by_file.get(fid)
        if not entry:
            entry = {"active": set()}
            by_file[fid] = entry
        name = (username or "").strip() or None
        if not name:
            name = "未知人员"
        if str(status_text or "") == "active":
            entry["active"].add(name)
    result: List[schemas.ExecSetByCaseFileOut] = []
    for fid in sorted(by_file.keys()):
        entry = by_file.get(fid) or {}
        active_set = entry.get("active") or set()
        active_users = sorted(list(active_set))
        result.append(
            schemas.ExecSetByCaseFileOut(
                case_file_id=int(fid),
                active_users=active_users,
            )
        )
    return result


def _case_snapshot(module, title, expected, priority=None, precondition="", steps="", remark=None):
    return schemas.CaseLibraryCaseSnapshot(
        module=str(module or ""),
        title=str(title or ""),
        priority=(str(priority) if priority is not None else None),
        precondition=str(precondition or ""),
        steps=str(steps or ""),
        expected=str(expected or ""),
        remark=(str(remark) if remark is not None else None),
    )


def _diff_exec_set_against_case_file(
    db: Session, exec_set: models.ExecSet, case_file: models.CaseFile, added_kind: str = "added"
):
    case_items = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == case_file.id)
        .order_by(models.CaseItem.id.asc())
        .all()
    )
    exec_cases = (
        db.query(models.ExecCase)
        .filter(models.ExecCase.exec_set_id == exec_set.id)
        .order_by(models.ExecCase.order_no.asc(), models.ExecCase.id.asc())
        .all()
    )
    item_by_id = {int(it.id): it for it in case_items if it and it.id}
    exec_by_item_id = {}
    for c in exec_cases:
        if not c:
            continue
        source_id = getattr(c, "case_item_source_id", None)
        if source_id is None and c.case_item_id:
            source_id = int(c.case_item_id)
        if source_id is None:
            continue
        exec_by_item_id[int(source_id)] = c

    entries: List[schemas.ExecCaseLibraryDiffEntry] = []
    appended = 0
    added = 0
    updated = 0
    deleted = 0

    def _collect_changed_fields(old_snap: schemas.CaseLibraryCaseSnapshot, new_snap: schemas.CaseLibraryCaseSnapshot):
        changed_fields = []
        if old_snap.module != new_snap.module:
            changed_fields.append("module")
        if old_snap.title != new_snap.title:
            changed_fields.append("title")
        if (old_snap.priority or "") != (new_snap.priority or ""):
            changed_fields.append("priority")
        if old_snap.precondition != new_snap.precondition:
            changed_fields.append("precondition")
        if old_snap.steps != new_snap.steps:
            changed_fields.append("steps")
        if old_snap.expected != new_snap.expected:
            changed_fields.append("expected")
        # remark 属于“执行备注”字段，可能包含执行过程记录，不应参与用例库变更导致的“变更重跑”判定。
        return changed_fields

    for item_id, item in item_by_id.items():
        if item_id not in exec_by_item_id:
            kind = str(added_kind or "added").strip().lower()
            if kind == "appended":
                appended += 1
            else:
                kind = "added"
                added += 1
            entries.append(
                schemas.ExecCaseLibraryDiffEntry(
                    kind=kind,
                    case_item_id=item_id,
                    changed_fields=[],
                    old=None,
                    new=_case_snapshot(
                        item.module,
                        item.title,
                        item.expected,
                        item.priority,
                        item.precondition,
                        item.steps,
                        item.remark,
                    ),
                )
            )

    for item_id, exec_case in exec_by_item_id.items():
        if item_id not in item_by_id:
            deleted += 1
            entries.append(
                schemas.ExecCaseLibraryDiffEntry(
                    kind="deleted",
                    case_item_id=item_id,
                    changed_fields=[],
                    old=_case_snapshot(
                        exec_case.module,
                        exec_case.title,
                        exec_case.expected,
                        exec_case.priority,
                        exec_case.precondition,
                        exec_case.steps,
                        exec_case.remark,
                    ),
                    new=None,
                )
            )

    for item_id, item in item_by_id.items():
        exec_case = exec_by_item_id.get(item_id)
        if not exec_case:
            continue
        old_snap = _case_snapshot(
            exec_case.module,
            exec_case.title,
            exec_case.expected,
            exec_case.priority,
            exec_case.precondition,
            exec_case.steps,
            exec_case.remark,
        )
        new_snap = _case_snapshot(
            item.module,
            item.title,
            item.expected,
            item.priority,
            item.precondition,
            item.steps,
            item.remark,
        )
        changed_fields = _collect_changed_fields(old_snap, new_snap)
        if changed_fields:
            updated += 1
            entries.append(
                schemas.ExecCaseLibraryDiffEntry(
                    kind="updated",
                    case_item_id=item_id,
                    changed_fields=changed_fields,
                    old=old_snap,
                    new=new_snap,
                )
            )

    summary = schemas.ExecCaseLibraryDiffSummary(
        appended=appended, added=added, updated=updated, deleted=deleted
    )
    return {"entries": entries, "summary": summary}


def _sync_exec_set_from_case_file(
    db: Session, user: models.User, exec_set: models.ExecSet, case_file: models.CaseFile
):
    now = datetime.now(timezone.utc)
    case_items = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == case_file.id)
        .order_by(models.CaseItem.id.asc())
        .all()
    )
    existing_cases = (
        db.query(models.ExecCase)
        .filter(models.ExecCase.exec_set_id == exec_set.id)
        .order_by(models.ExecCase.order_no.asc(), models.ExecCase.id.asc())
        .all()
    )
    existing_by_item_id = {}
    for item in existing_cases:
        if not item:
            continue
        source_id = getattr(item, "case_item_source_id", None)
        if source_id is None and item.case_item_id:
            source_id = int(item.case_item_id)
        if source_id is None:
            continue
        existing_by_item_id[int(source_id)] = item

    keep_item_ids = set([int(it.id) for it in case_items if it and it.id])
    updated_any = False
    new_cases = 0

    for idx, item in enumerate(case_items):
        if not item or not item.id:
            continue
        existing = existing_by_item_id.get(int(item.id))
        if existing:
            before_module = existing.module
            before_title = existing.title
            before_expected = existing.expected
            before_priority = existing.priority
            before_precondition = existing.precondition
            before_steps = existing.steps
            before_status = str(existing.status or "").strip()

            defect_links_value = existing.defect_links
            reuse_details_value = existing.reuse_details
            has_defect_links = False
            if defect_links_value is not None:
                if isinstance(defect_links_value, list):
                    has_defect_links = bool(defect_links_value)
                else:
                    has_defect_links = bool(str(defect_links_value).strip())
            has_reuse_execution = _has_reuse_execution(reuse_details_value)
            # 注意：exec_case.remark 属于执行备注（非用例库字段），不应导致“误判已执行”或触发重跑。
            has_result = bool(before_status and before_status != "未执行") or bool(
                (existing.actual_result or "").strip()
                or (existing.defect_link or "").strip()
                or has_defect_links
                or has_reuse_execution
            )

            existing.module = item.module
            existing.title = item.title
            existing.expected = item.expected
            existing.priority = item.priority
            existing.precondition = item.precondition
            existing.steps = item.steps
            existing.order_no = idx + 1
            existing.case_item_id = item.id
            existing.case_item_source_id = int(item.id)
            existing.updated_by = user.id
            existing.updated_at = now

            changed = (
                before_module != existing.module
                or before_title != existing.title
                or before_expected != existing.expected
                or before_priority != existing.priority
                or before_precondition != existing.precondition
                or before_steps != existing.steps
            )
            if changed:
                if has_result and before_status not in ("变更重跑", "有改动"):
                    existing.status = "变更重跑"
                    if isinstance(existing.reuse_details, list) and existing.reuse_details:
                        next_details = []
                        for d in existing.reuse_details:
                            if isinstance(d, dict):
                                d2 = dict(d)
                                d2["status"] = "变更重跑"
                                next_details.append(d2)
                            else:
                                next_details.append(d)
                        existing.reuse_details = next_details

            db.add(existing)
            updated_any = True
            continue

        exec_case = models.ExecCase(
            exec_set_id=exec_set.id,
            case_item_id=item.id,
            case_item_source_id=int(item.id),
            module=item.module,
            title=item.title,
            expected=item.expected,
            priority=item.priority,
            precondition=item.precondition,
            steps=item.steps,
            actual_result=None,
            defect_link=None,
            reuse_details=None,
            defect_links=None,
            remark=item.remark,
            status="未执行",
            order_no=idx + 1,
            executor_id=user.id,
            created_by=user.id,
            updated_by=user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(exec_case)
        new_cases += 1
        updated_any = True

    # 删除已不存在的旧用例（例如用例库被删除或替换）
    for old in existing_cases:
        if not old:
            continue
        source_id = getattr(old, "case_item_source_id", None)
        if source_id is None and old.case_item_id:
            source_id = int(old.case_item_id)
        # source_id 为空的用例视为“手工新增执行用例”，不参与用例库同步删除。
        if source_id is None:
            continue
        if int(source_id) not in keep_item_ids:
            db.delete(old)
            updated_any = True

    if updated_any:
        exec_set.updated_at = now
        if exec_set.case_file_base_updated_at is None:
            exec_set.case_file_base_updated_at = exec_set.created_at or case_file.updated_at
        exec_set.case_file_last_synced_at = case_file.updated_at
        db.add(exec_set)
        log_operation(
            db=db,
            user_id=user.id,
            action="sync_exec_set_from_case_file",
            target_type="exec_set",
            target_id=exec_set.id,
            detail={"case_file_id": case_file.id, "new_cases": int(new_cases)},
        )
        db.commit()
        db.refresh(exec_set)
    return exec_set


def _normalize_exec_set_case_library_history(raw) -> List[schemas.ExecCaseLibraryDiffHistoryBatch]:
    if not raw:
        return []
    data = raw
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except Exception:
            data = None
    if not isinstance(data, list):
        return []
    batches: List[schemas.ExecCaseLibraryDiffHistoryBatch] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        diff_at = item.get("diff_at") or item.get("diffAt") or item.get("last_diff_at") or item.get("lastDiffAt")
        operator = item.get("operator") or item.get("operator_name") or item.get("operatorName") or None
        summary_raw = item.get("summary") or {}
        diff_raw = item.get("diff") or []
        if not diff_at:
            continue
        try:
            summary = schemas.ExecCaseLibraryDiffSummary(**(summary_raw if isinstance(summary_raw, dict) else {}))
        except Exception:
            summary = schemas.ExecCaseLibraryDiffSummary()
        try:
            diff_entries = [
                schemas.ExecCaseLibraryDiffEntry(**d)
                for d in (diff_raw if isinstance(diff_raw, list) else [])
                if isinstance(d, dict)
            ]
        except Exception:
            diff_entries = []
        try:
            batch = schemas.ExecCaseLibraryDiffHistoryBatch(
                diff_at=diff_at,
                operator=str(operator) if operator else None,
                summary=summary,
                diff=diff_entries,
            )
            batches.append(batch)
        except Exception:
            continue
    batches.sort(key=lambda b: b.diff_at, reverse=True)
    return batches


def _dump_exec_set_case_library_history(
    batches: List[schemas.ExecCaseLibraryDiffHistoryBatch], max_batches: int = 200
):
    if not batches:
        return None
    trimmed = batches[: max(1, int(max_batches or 200))]
    return [
        {
            "diff_at": b.diff_at.isoformat() if getattr(b, "diff_at", None) else None,
            "operator": (str(b.operator) if getattr(b, "operator", None) else None),
            "summary": (b.summary.model_dump() if getattr(b, "summary", None) else schemas.ExecCaseLibraryDiffSummary().model_dump()),
            "diff": [e.model_dump() for e in (b.diff or [])],
        }
        for b in trimmed
    ]


@router.post("/sets/{exec_set_id}/case-library-sync", response_model=schemas.ExecCaseLibrarySyncOut)
def sync_exec_set_case_library(
    exec_set_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_set = _ensure_exec_set_access(db, user, exec_set_id)
    case_file_id = _parse_case_file_id(exec_set.case_file_id, exec_set.source)
    if not case_file_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="执行集未关联用例文件")
    case_file = db.query(models.CaseFile).filter(models.CaseFile.id == int(case_file_id)).first()
    if not case_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例文件不存在")
    ensure_project_access(db, user, case_file.project_id)

    if exec_set.case_file_base_updated_at is None:
        exec_set.case_file_base_updated_at = exec_set.created_at or case_file.updated_at
        db.add(exec_set)
        db.commit()
        db.refresh(exec_set)

    stored = exec_set.case_file_last_diff_json if exec_set.case_file_last_diff_json else None
    stored_diff_entries: List[schemas.ExecCaseLibraryDiffEntry] = []
    stored_summary = schemas.ExecCaseLibraryDiffSummary()
    if stored and isinstance(stored, dict):
        stored_diff = stored.get("diff") or []
        stored_summary_raw = stored.get("summary") or {}
        try:
            stored_diff_entries = [
                schemas.ExecCaseLibraryDiffEntry(**item)
                for item in (stored_diff if isinstance(stored_diff, list) else [])
            ]
        except Exception:
            stored_diff_entries = []
        try:
            stored_summary = schemas.ExecCaseLibraryDiffSummary(
                **(stored_summary_raw if isinstance(stored_summary_raw, dict) else {})
            )
        except Exception:
            stored_summary = schemas.ExecCaseLibraryDiffSummary()

    history_batches = _normalize_exec_set_case_library_history(getattr(exec_set, "case_file_diff_history_json", None))

    last_synced_at = exec_set.case_file_last_synced_at
    file_updated_at = case_file.updated_at
    base_updated_at = exec_set.case_file_base_updated_at
    library_changed = False
    if last_synced_at and file_updated_at and file_updated_at > last_synced_at:
        library_changed = True
    elif not last_synced_at:
        if base_updated_at and file_updated_at and file_updated_at > base_updated_at:
            library_changed = True
        else:
            exec_set.case_file_last_synced_at = file_updated_at
            db.add(exec_set)
            db.commit()
            db.refresh(exec_set)

    if not library_changed:
        return schemas.ExecCaseLibrarySyncOut(
            exec_set_id=int(exec_set.id),
            case_file_id=int(case_file.id),
            case_file_updated_at=case_file.updated_at,
            base_updated_at=base_updated_at,
            last_diff_at=exec_set.case_file_last_diff_at,
            last_shown_at=exec_set.case_file_last_diff_shown_at,
            ever_changed=bool(base_updated_at and file_updated_at and file_updated_at > base_updated_at),
            has_new_diff=False,
            should_auto_popup=False,
            summary=stored_summary,
            diff=stored_diff_entries,
            history=history_batches,
        )

    added_kind = "added"
    try:
        last_ev = (
            db.query(models.CaseLibraryChangeEvent)
            .filter(models.CaseLibraryChangeEvent.project_id == case_file.project_id)
            .filter(models.CaseLibraryChangeEvent.file_name_clean == case_file.file_name_clean)
            .order_by(models.CaseLibraryChangeEvent.created_at.desc())
            .first()
        )
        if (
            last_ev
            and str(getattr(last_ev, "kind", "") or "") == "append"
            and last_ev.created_at
            and case_file.updated_at
        ):
            # 追加入库：用最近一次事件与 case_file.updated_at 做时间邻近判断，避免误标记为“追加”。
            delta = abs((last_ev.created_at - case_file.updated_at).total_seconds())
            if delta <= 5:
                added_kind = "appended"
    except Exception:
        added_kind = "added"

    diff_result = _diff_exec_set_against_case_file(db, exec_set, case_file, added_kind=added_kind)
    new_entries = diff_result.get("entries") or []
    summary = diff_result.get("summary") or schemas.ExecCaseLibraryDiffSummary()
    has_new_diff = bool(summary.appended or summary.added or summary.updated or summary.deleted)
    if has_new_diff:
        exec_set.case_file_last_diff_at = case_file.updated_at
        operator_name = None
        try:
            if getattr(case_file, "updated_by", None):
                op_user = (
                    db.query(models.User)
                    .filter(models.User.id == int(case_file.updated_by))
                    .first()
                )
                operator_name = op_user.username if op_user and op_user.username else None
            if not operator_name and getattr(case_file, "importer_id", None):
                op_user2 = (
                    db.query(models.User)
                    .filter(models.User.id == int(case_file.importer_id))
                    .first()
                )
                operator_name = op_user2.username if op_user2 and op_user2.username else None
        except Exception:
            operator_name = None
        latest_payload = {
            "case_file_id": int(case_file.id),
            "case_file_updated_at": case_file.updated_at.isoformat() if case_file.updated_at else None,
            "summary": summary.model_dump(),
            "diff": [e.model_dump() for e in new_entries],
        }
        exec_set.case_file_last_diff_json = latest_payload
        # 追加到 diff 历史（最新在前）。并发重复写入时，用 diff_at 去重。
        try:
            batch = schemas.ExecCaseLibraryDiffHistoryBatch(
                diff_at=case_file.updated_at,
                operator=operator_name,
                summary=summary,
                diff=new_entries,
            )
            if not history_batches or history_batches[0].diff_at != batch.diff_at:
                history_batches.insert(0, batch)
        except Exception:
            # ignore
            pass
        exec_set.case_file_diff_history_json = _dump_exec_set_case_library_history(history_batches)
        db.add(exec_set)
        db.commit()
        db.refresh(exec_set)

    _sync_exec_set_from_case_file(db, user, exec_set, case_file)
    exec_set.case_file_last_synced_at = file_updated_at
    db.add(exec_set)
    db.commit()
    db.refresh(exec_set)

    last_diff_at = exec_set.case_file_last_diff_at
    last_shown_at = exec_set.case_file_last_diff_shown_at
    ever_changed = bool(base_updated_at and case_file.updated_at and case_file.updated_at > base_updated_at)
    should_auto_popup = bool(has_new_diff and last_diff_at and (not last_shown_at or last_diff_at > last_shown_at))

    stored = exec_set.case_file_last_diff_json if exec_set.case_file_last_diff_json else None
    diff_entries = []
    stored_summary = summary
    if stored and isinstance(stored, dict):
        stored_diff = stored.get("diff") or []
        stored_summary_raw = stored.get("summary") or {}
        try:
            diff_entries = [
                schemas.ExecCaseLibraryDiffEntry(**item) for item in (stored_diff if isinstance(stored_diff, list) else [])
            ]
        except Exception:
            diff_entries = []
        try:
            stored_summary = schemas.ExecCaseLibraryDiffSummary(**(stored_summary_raw if isinstance(stored_summary_raw, dict) else {}))
        except Exception:
            stored_summary = summary
    elif has_new_diff:
        diff_entries = new_entries

    return schemas.ExecCaseLibrarySyncOut(
        exec_set_id=int(exec_set.id),
        case_file_id=int(case_file.id),
        case_file_updated_at=case_file.updated_at,
        base_updated_at=base_updated_at,
        last_diff_at=last_diff_at,
        last_shown_at=last_shown_at,
        ever_changed=ever_changed,
        has_new_diff=has_new_diff,
        should_auto_popup=should_auto_popup,
        summary=stored_summary,
        diff=diff_entries,
        history=history_batches,
    )


@router.post("/sets/{exec_set_id}/case-library-diff/ack")
def ack_exec_set_case_library_diff(
    exec_set_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_set = _ensure_exec_set_access(db, user, exec_set_id)
    if not exec_set.case_file_last_diff_at:
        return {"detail": "no diff", "exec_set_id": int(exec_set.id)}
    exec_set.case_file_last_diff_shown_at = exec_set.case_file_last_diff_at
    exec_set.updated_at = datetime.now(timezone.utc)
    db.add(exec_set)
    db.commit()
    return {"detail": "ok", "exec_set_id": int(exec_set.id)}


@router.get("/sets/{exec_set_id}/cases", response_model=List[schemas.ExecCaseOut])
def list_exec_cases(
    exec_set_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_exec_set_read_access(db, user, exec_set_id)
    cases = (
        db.query(models.ExecCase)
        .filter(models.ExecCase.exec_set_id == exec_set_id)
        .order_by(models.ExecCase.order_no.asc(), models.ExecCase.id.asc())
        .all()
    )
    return cases


@router.post(
    "/sets/{exec_set_id}/cases",
    response_model=schemas.ExecCaseOut,
    status_code=status.HTTP_201_CREATED,
)
def create_exec_case(
    exec_set_id: int,
    payload: schemas.ExecCaseCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_set = _ensure_exec_set_access(db, user, exec_set_id)
    now = datetime.now(timezone.utc)

    order_no = 1
    if payload.after_case_id:
        after_case = (
            db.query(models.ExecCase)
            .filter(
                models.ExecCase.id == payload.after_case_id,
                models.ExecCase.exec_set_id == exec_set.id,
            )
            .first()
        )
        if not after_case:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="插入位置用例不存在")
        order_no = int(after_case.order_no or 0) + 1

    db.query(models.ExecCase).filter(
        models.ExecCase.exec_set_id == exec_set.id,
        models.ExecCase.order_no >= order_no,
    ).update(
        {models.ExecCase.order_no: models.ExecCase.order_no + 1},
        synchronize_session=False,
    )

    case_item_id = None
    module = (payload.module or "")
    title = (payload.title or "")
    expected = (payload.expected or "")
    priority = payload.priority
    precondition = payload.precondition
    steps = payload.steps
    remark = payload.remark
    if payload.case_item_id:
        if not exec_set.case_file_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="执行集未绑定用例文件，无法从用例库创建",
            )
        case_item = (
            db.query(models.CaseItem)
            .filter(models.CaseItem.id == payload.case_item_id)
            .first()
        )
        if not case_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例不存在")
        if case_item.case_file_id != exec_set.case_file_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用例不属于当前执行集对应的用例文件",
            )
        case_item_id = case_item.id
        module = case_item.module
        title = case_item.title
        expected = case_item.expected
        priority = case_item.priority
        precondition = case_item.precondition
        steps = case_item.steps
        if payload.remark is None:
            remark = case_item.remark

    exec_case = models.ExecCase(
        exec_set_id=exec_set.id,
        case_item_id=case_item_id,
        case_item_source_id=int(case_item_id) if case_item_id is not None else None,
        module=module,
        title=title,
        expected=expected,
        priority=priority,
        precondition=precondition,
        steps=steps,
        actual_result=None,
        defect_link=None,
        reuse_details=payload.reuse_details,
        defect_links=payload.defect_links,
        remark=remark,
        status=payload.status or "未执行",
        order_no=order_no,
        executor_id=user.id,
        created_by=user.id,
        updated_by=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(exec_case)
    log_operation(
        db=db,
        user_id=user.id,
        action="create_exec_case",
        target_type="exec_set",
        target_id=exec_set.id,
        detail={"order_no": order_no},
    )
    db.commit()
    db.refresh(exec_case)
    return exec_case


@router.delete("/cases/{case_id}")
def delete_exec_case(
    case_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_case = db.query(models.ExecCase).filter(models.ExecCase.id == case_id).first()
    if not exec_case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="执行用例不存在")
    exec_set = _ensure_exec_set_access(db, user, exec_case.exec_set_id)
    removed_order = int(exec_case.order_no or 0)
    db.delete(exec_case)
    if removed_order:
        db.query(models.ExecCase).filter(
            models.ExecCase.exec_set_id == exec_set.id,
            models.ExecCase.order_no > removed_order,
        ).update(
            {models.ExecCase.order_no: models.ExecCase.order_no - 1},
            synchronize_session=False,
        )
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_exec_case",
        target_type="exec_case",
        target_id=case_id,
    )
    db.commit()
    return {"status": "ok"}


@router.post(
    "/sets/{exec_set_id}/cases/from-library",
    response_model=List[schemas.ExecCaseOut],
    status_code=status.HTTP_201_CREATED,
)
def add_cases_from_library(
    exec_set_id: int,
    payload: schemas.ExecCaseCreateFromLibrary,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_set = _ensure_exec_set_access(db, user, exec_set_id)
    if not payload.case_item_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")
    items = (
        db.query(models.CaseItem)
        .join(models.CaseFile)
        .filter(models.CaseItem.id.in_(payload.case_item_ids))
        .all()
    )
    if len(items) != len(payload.case_item_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="部分用例不存在")
    for item in items:
        if item.case_file.project_id != exec_set.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="用例项目与执行集不一致"
            )
    existing = db.query(models.ExecCase).filter(models.ExecCase.exec_set_id == exec_set.id).all()
    existing_keys = set(
        (
            (c.module or "").strip().lower(),
            (c.title or "").strip().lower(),
            (c.precondition or "").strip().lower(),
            (c.steps or "").strip().lower(),
            (c.expected or "").strip().lower(),
        )
        for c in existing
    )
    new_cases = []
    order_base = len(existing) + 1
    for idx, item in enumerate(items):
        key = (
            (item.module or "").strip().lower(),
            (item.title or "").strip().lower(),
            (item.precondition or "").strip().lower(),
            (item.steps or "").strip().lower(),
            (item.expected or "").strip().lower(),
        )
        if key in existing_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="执行集已存在相同模块+用例描述+前提条件+操作步骤+预期结果的用例",
            )
        exec_case = models.ExecCase(
            exec_set_id=exec_set.id,
            case_item_id=item.id,
            case_item_source_id=int(item.id),
            module=item.module,
            title=item.title,
            expected=item.expected,
            priority=item.priority,
            precondition=item.precondition,
            steps=item.steps,
            actual_result=None,
            defect_link=None,
            reuse_details=None,
            defect_links=None,
            remark=item.remark,
            status="未执行",
            order_no=order_base + idx,
            executor_id=user.id,
            created_by=user.id,
            updated_by=user.id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(exec_case)
        new_cases.append(exec_case)
        # 防止同一批次请求中出现重复条目（模块/标题/前提条件/操作步骤/预期结果均相同），导致执行集写入重复用例。
        existing_keys.add(key)
    log_operation(
        db=db,
        user_id=user.id,
        action="add_exec_cases",
        target_type="exec_set",
        target_id=exec_set.id,
        detail={"count": len(new_cases)},
    )
    db.commit()
    for case in new_cases:
        db.refresh(case)
    return new_cases


@router.patch("/cases/{case_id}", response_model=schemas.ExecCaseOut)
def update_exec_case(
    case_id: int,
    payload: schemas.ExecCaseUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exec_case = db.query(models.ExecCase).filter(models.ExecCase.id == case_id).first()
    if not exec_case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="执行用例不存在")
    _ensure_exec_set_access(db, user, exec_case.exec_set_id)
    fields = [
        "module",
        "title",
        "expected",
        "priority",
        "precondition",
        "steps",
        "actual_result",
        "defect_link",
        "reuse_details",
        "defect_links",
        "remark",
        "status",
        "executor_id",
    ]
    changed = False
    payload_data = payload.model_dump(exclude_unset=True)
    for field in fields:
        if field not in payload_data:
            continue
        value = payload_data[field]
        if value != getattr(exec_case, field):
            old_val = getattr(exec_case, field)
            old_text = old_val
            new_text = value
            if old_val is not None and not isinstance(old_val, str):
                try:
                    old_text = json.dumps(old_val, ensure_ascii=False)
                except TypeError:
                    old_text = str(old_val)
            if value is not None and not isinstance(value, str):
                try:
                    new_text = json.dumps(value, ensure_ascii=False)
                except TypeError:
                    new_text = str(value)
            db.add(
                models.ExecCaseHistory(
                    exec_case_id=exec_case.id,
                    field_changed=field,
                    old_value=old_text,
                    new_value=new_text,
                    changed_by=user.id,
                    changed_at=datetime.now(timezone.utc),
                )
            )
            setattr(exec_case, field, value)
            changed = True
    if changed:
        exec_case.updated_by = user.id
        exec_case.updated_at = datetime.now(timezone.utc)
        db.add(exec_case)

        # 非“实际结果/缺陷链接”字段变更需要同步到用例库（case_items）
        case_fields = ["module", "title", "expected", "priority", "precondition", "steps", "remark"]
        if exec_case.case_item_id:
            case_item = (
                db.query(models.CaseItem)
                .filter(models.CaseItem.id == exec_case.case_item_id)
                .first()
            )
            if case_item:
                old_snap = _snapshot_case_item_for_history(case_item)
                updated_case = False
                for key in case_fields:
                    if key not in payload_data:
                        continue
                    value = payload_data[key]
                    if key in ("precondition", "steps") and value is None:
                        value = ""
                    if value != getattr(case_item, key):
                        setattr(case_item, key, value)
                        updated_case = True
                if updated_case:
                    now = exec_case.updated_at
                    case_item.updated_by = user.id
                    case_item.updated_at = now
                    db.query(models.CaseFile).filter(models.CaseFile.id == case_item.case_file_id).update(
                        {models.CaseFile.updated_at: now}, synchronize_session=False
                    )
                    db.add(case_item)
                    try:
                        case_file = (
                            db.query(models.CaseFile)
                            .filter(models.CaseFile.id == case_item.case_file_id)
                            .first()
                        )
                        if case_file:
                            new_snap = _snapshot_case_item_for_history(case_item)
                            log_case_library_change(
                                db=db,
                                user=user,
                                project_id=case_file.project_id,
                                version_id=case_file.version_id,
                                file_name_clean=case_file.file_name_clean,
                                case_file_id=case_file.id,
                                case_item_id=case_item.id,
                                kind="updated",
                                old=old_snap,
                                new=new_snap,
                                meta={"changed_fields": _compute_case_item_changed_fields(old_snap or {}, new_snap or {})},
                                at=now,
                            )
                    except Exception:
                        # 历史记录不应影响执行用例更新主流程
                        pass
        else:
            # 新增的执行用例可能尚未绑定 case_item：当必填字段齐全时自动落库到用例库并绑定。
            required_ready = (
                (exec_case.module or "").strip()
                and (exec_case.title or "").strip()
                and (exec_case.expected or "").strip()
            )
            if required_ready:
                exec_set = db.query(models.ExecSet).filter(models.ExecSet.id == exec_case.exec_set_id).first()
                if exec_set and exec_set.case_file_id:
                    now = exec_case.updated_at
                    case_item = models.CaseItem(
                        case_file_id=exec_set.case_file_id,
                        module=exec_case.module,
                        title=exec_case.title,
                        expected=exec_case.expected,
                        priority=exec_case.priority,
                        precondition=exec_case.precondition or "",
                        steps=exec_case.steps or "",
                        remark=exec_case.remark,
                        created_by=user.id,
                        updated_by=user.id,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(case_item)
                    db.flush()
                    exec_case.case_item_id = case_item.id
                    db.query(models.CaseFile).filter(models.CaseFile.id == exec_set.case_file_id).update(
                        {models.CaseFile.updated_at: now}, synchronize_session=False
                    )
                    db.add(exec_case)
                    try:
                        case_file = (
                            db.query(models.CaseFile)
                            .filter(models.CaseFile.id == exec_set.case_file_id)
                            .first()
                        )
                        if case_file:
                            log_case_library_change(
                                db=db,
                                user=user,
                                project_id=case_file.project_id,
                                version_id=case_file.version_id,
                                file_name_clean=case_file.file_name_clean,
                                case_file_id=case_file.id,
                                case_item_id=case_item.id,
                                kind="added",
                                old=None,
                                new=_snapshot_case_item_for_history(case_item),
                                meta={"source": "exec_case_auto_bind"},
                                at=now,
                            )
                    except Exception:
                        pass
        log_operation(
            db=db,
            user_id=user.id,
            action="update_exec_case",
            target_type="exec_case",
            target_id=exec_case.id,
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="更新失败：用例字段重复（模块/标题/前提条件/操作步骤/预期结果）",
            )
        db.refresh(exec_case)
    return exec_case


@router.get("/overview", response_model=List[schemas.ExecOverviewOut])
def get_execution_overview(
    project_id: int,
    version_id: int = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_project_access(db, user, project_id)

    source_is_int = and_(
        models.ExecSet.source.isnot(None),
        models.ExecSet.source != "",
        models.ExecSet.source.op("GLOB")("[0-9]*"),
    )
    source_case_file_id = case(
        (source_is_int, cast(models.ExecSet.source, Integer)),
        else_=None,
    )
    effective_case_file_id = func.coalesce(models.ExecSet.case_file_id, source_case_file_id)
    query_case_file_join = and_(
        models.CaseFile.id == effective_case_file_id,
        models.CaseFile.project_id == models.ExecSet.project_id,
    )
    effective_version_id = func.coalesce(models.ExecSet.version_id, models.CaseFile.version_id)

    assigned_user = func.coalesce(
        models.ExecCase.executor_id, models.ExecCase.updated_by, models.ExecCase.created_by
    )
    query = (
        db.query(
            models.ExecSet.project_id.label("project_id"),
            effective_version_id.label("version_id"),
            assigned_user.label("user_id"),
            func.count(models.ExecCase.id).label("total"),
            func.sum(
                case(
                    (
                        (models.ExecCase.status == "pending")
                        | (models.ExecCase.status == "未执行")
                        | (models.ExecCase.status == "变更重跑")
                        | (models.ExecCase.status == "有改动"),
                        1,
                    ),
                    else_=0,
                )
            ).label("pending"),
            func.sum(case((models.ExecCase.status == "通过", 1), else_=0)).label("passed_cn"),
            func.sum(case((models.ExecCase.status == "passed", 1), else_=0)).label("passed_en"),
            func.sum(case((models.ExecCase.status == "failed", 1), else_=0)).label("failed_en"),
            func.sum(case((models.ExecCase.status == "失败", 1), else_=0)).label("failed_cn"),
            func.sum(case((models.ExecCase.status == "blocked", 1), else_=0)).label("blocked_en"),
            func.sum(case((models.ExecCase.status == "阻塞", 1), else_=0)).label("blocked_cn"),
            func.sum(case((models.ExecCase.status == "不适用", 1), else_=0)).label("na_cn"),
            func.sum(case((models.ExecCase.status == "not_applicable", 1), else_=0)).label("na_en"),
        )
        .join(models.ExecCase, models.ExecCase.exec_set_id == models.ExecSet.id)
        .outerjoin(models.CaseFile, query_case_file_join)
        .filter(models.ExecSet.project_id == project_id)
    )
    if version_id is not None:
        query = query.filter(effective_version_id == version_id)
    query = query.group_by(models.ExecSet.project_id, effective_version_id, assigned_user)
    rows = query.all()
    user_ids = [row.user_id for row in rows if row.user_id is not None]
    usernames = {}
    if user_ids:
        # 执行总览需要展示“人员”，这里一次性批量取 username，避免 N+1。
        for uid, uname in db.query(models.User.id, models.User.username).filter(
            models.User.id.in_(list(set(user_ids)))
        ):
            usernames[uid] = uname
    result = []
    for row in rows:
        total_failed = (row.failed_en or 0) + (row.failed_cn or 0)
        total_blocked = (row.blocked_en or 0) + (row.blocked_cn or 0)
        total_na = (row.na_en or 0) + (row.na_cn or 0)
        passed = (row.passed_cn or 0) + (row.passed_en or 0)
        result.append(
            schemas.ExecOverviewOut(
                project_id=row.project_id,
                version_id=row.version_id,
                user_id=row.user_id,
                username=usernames.get(row.user_id) if row.user_id is not None else None,
                total=row.total or 0,
                pending=row.pending or 0,
                passed=passed,
                failed=total_failed,
                blocked=total_blocked,
                not_applicable=total_na,
            )
        )
    return result


@router.get("/overview/cases", response_model=List[schemas.ExecOverviewCaseOut])
def list_execution_overview_cases(
    project_id: int,
    version_id: int = None,
    user_id: int = None,
    limit: int = 200,
    offset: int = 0,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_project_access(db, user, project_id)
    safe_limit = max(1, min(int(limit or 200), 1000))
    safe_offset = max(0, int(offset or 0))

    assigned_user = func.coalesce(
        models.ExecCase.executor_id, models.ExecCase.updated_by, models.ExecCase.created_by
    )

    source_is_int = and_(
        models.ExecSet.source.isnot(None),
        models.ExecSet.source != "",
        models.ExecSet.source.op("GLOB")("[0-9]*"),
    )
    source_case_file_id = case(
        (source_is_int, cast(models.ExecSet.source, Integer)),
        else_=None,
    )
    effective_case_file_id = func.coalesce(models.ExecSet.case_file_id, source_case_file_id)
    query_case_file_join = and_(
        models.CaseFile.id == effective_case_file_id,
        models.CaseFile.project_id == models.ExecSet.project_id,
    )
    effective_version_id = func.coalesce(models.ExecSet.version_id, models.CaseFile.version_id)

    query = (
        db.query(models.ExecCase, models.ExecSet, effective_version_id.label("effective_version_id"))
        .join(models.ExecSet, models.ExecSet.id == models.ExecCase.exec_set_id)
        .outerjoin(models.CaseFile, query_case_file_join)
        .filter(models.ExecSet.project_id == project_id)
    )
    if version_id is not None:
        query = query.filter(effective_version_id == version_id)
    if user_id is not None:
        query = query.filter(assigned_user == user_id)
    rows = (
        query.order_by(models.ExecCase.updated_at.desc(), models.ExecCase.id.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
    result: List[schemas.ExecOverviewCaseOut] = []
    for exec_case, exec_set, effective_vid in rows:
        result.append(
            schemas.ExecOverviewCaseOut(
                exec_case_id=exec_case.id,
                exec_set_id=exec_set.id,
                exec_set_name=exec_set.name,
                version_id=effective_vid,
                module=exec_case.module,
                title=exec_case.title,
                status=exec_case.status,
                updated_at=exec_case.updated_at,
            )
        )
    return result


@router.get("/overview/layout", response_model=List[schemas.ExecOverviewUserLayoutOut])
def get_execution_overview_layout(
    project_id: int,
    version_id: int = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_project_access(db, user, project_id)

    membership_ids = [
        int(uid)
        for uid, in db.query(models.UserProject.user_id)
        .filter(models.UserProject.project_id == project_id)
        .all()
        if uid is not None
    ]
    # 兼容：admin 可能未加入 user_projects，但仍可能在该项目下创建执行集（例如排查/协助执行）。
    admin_ids_query = (
        db.query(models.ExecSet.created_by)
        .join(models.User, models.User.id == models.ExecSet.created_by)
        .filter(
            models.ExecSet.project_id == project_id,
            models.ExecSet.created_by.isnot(None),
            models.User.role == "admin",
        )
        .distinct()
    )
    if version_id is not None:
        source_is_int = and_(
            models.ExecSet.source.isnot(None),
            models.ExecSet.source != "",
            models.ExecSet.source.op("GLOB")("[0-9]*"),
        )
        source_case_file_id = case(
            (source_is_int, cast(models.ExecSet.source, Integer)),
            else_=None,
        )
        effective_case_file_id = func.coalesce(models.ExecSet.case_file_id, source_case_file_id)
        query_case_file_join = and_(
            models.CaseFile.id == effective_case_file_id,
            models.CaseFile.project_id == models.ExecSet.project_id,
        )
        effective_version_id = func.coalesce(models.ExecSet.version_id, models.CaseFile.version_id)
        admin_ids_query = admin_ids_query.outerjoin(models.CaseFile, query_case_file_join).filter(
            effective_version_id == version_id
        )
    admin_ids = [int(uid) for uid, in admin_ids_query.all() if uid is not None]

    member_ids = list(set(membership_ids + admin_ids))
    if not member_ids:
        return []

    member_rows = (
        db.query(models.User.id, models.User.username, models.User.level, models.User.created_at)
        .filter(models.User.id.in_(member_ids), models.User.is_active == True)  # noqa: E712
        .all()
    )
    member_meta = {}
    for row in member_rows:
        if not row or row.id is None:
            continue
        member_meta[int(row.id)] = {
            "username": row.username,
            "level": row.level,
            "created_at": row.created_at,
        }

    query = (
        db.query(
            models.ExecSet.id.label("exec_set_id"),
            models.ExecSet.name.label("exec_set_name"),
            models.ExecSet.status.label("status"),
            models.ExecSet.requirement.label("requirement"),
            models.ExecSet.created_by.label("user_id"),
            models.ExecSet.created_at.label("created_at"),
            models.ExecSet.updated_at.label("updated_at"),
            func.count(models.ExecCase.id).label("total"),
            func.sum(
                case(
                    (
                        (models.ExecCase.status == "pending")
                        | (models.ExecCase.status == "未执行")
                        | (models.ExecCase.status == "变更重跑")
                        | (models.ExecCase.status == "有改动"),
                        1,
                    ),
                    else_=0,
                )
            ).label("pending"),
            func.sum(case((models.ExecCase.status == "通过", 1), else_=0)).label("passed_cn"),
            func.sum(case((models.ExecCase.status == "passed", 1), else_=0)).label("passed_en"),
            func.sum(case((models.ExecCase.status == "failed", 1), else_=0)).label("failed_en"),
            func.sum(case((models.ExecCase.status == "失败", 1), else_=0)).label("failed_cn"),
            func.sum(case((models.ExecCase.status == "blocked", 1), else_=0)).label("blocked_en"),
            func.sum(case((models.ExecCase.status == "阻塞", 1), else_=0)).label("blocked_cn"),
            func.sum(case((models.ExecCase.status == "不适用", 1), else_=0)).label("na_cn"),
            func.sum(case((models.ExecCase.status == "not_applicable", 1), else_=0)).label("na_en"),
        )
        .join(models.ExecCase, models.ExecCase.exec_set_id == models.ExecSet.id)
        .filter(models.ExecSet.project_id == project_id, models.ExecSet.created_by.in_(member_ids))
    )

    source_is_int = and_(
        models.ExecSet.source.isnot(None),
        models.ExecSet.source != "",
        models.ExecSet.source.op("GLOB")("[0-9]*"),
    )
    source_case_file_id = case(
        (source_is_int, cast(models.ExecSet.source, Integer)),
        else_=None,
    )
    effective_case_file_id = func.coalesce(models.ExecSet.case_file_id, source_case_file_id)
    query_case_file_join = and_(
        models.CaseFile.id == effective_case_file_id,
        models.CaseFile.project_id == models.ExecSet.project_id,
    )
    effective_version_id = func.coalesce(models.ExecSet.version_id, models.CaseFile.version_id).label("version_id")
    query = query.outerjoin(models.CaseFile, query_case_file_join).add_columns(effective_version_id)

    if version_id is not None:
        query = query.filter(effective_version_id == version_id)
    query = query.group_by(
        models.ExecSet.id,
        models.ExecSet.name,
        models.ExecSet.status,
        models.ExecSet.requirement,
        models.ExecSet.created_by,
        models.ExecSet.created_at,
        models.ExecSet.updated_at,
        effective_version_id,
    )
    rows = query.all()

    placement_rows = (
        db.query(models.Setting.owner_id, models.Setting.value_json)
        .filter(
            models.Setting.scope == "user",
            models.Setting.key == "tempexec_ui_v1",
            models.Setting.owner_id.in_(member_ids),
        )
        .all()
    )
    placement_by_user = {}
    for owner_id, value_json in placement_rows:
        if owner_id is None:
            continue
        placement = None
        if isinstance(value_json, dict) and isinstance(value_json.get("placement"), dict):
            placement = value_json.get("placement")
        placement_by_user[int(owner_id)] = placement

    grouped = {}
    for row in rows:
        if row.user_id is None:
            continue
        uid = int(row.user_id)
        total_failed = (row.failed_en or 0) + (row.failed_cn or 0)
        total_blocked = (row.blocked_en or 0) + (row.blocked_cn or 0)
        total_na = (row.na_en or 0) + (row.na_cn or 0)
        passed = (row.passed_cn or 0) + (row.passed_en or 0)
        pending = row.pending or 0
        total = row.total or 0
        grouped.setdefault(uid, []).append(
            schemas.ExecOverviewExecSetOut(
                exec_set_id=row.exec_set_id,
                exec_set_name=row.exec_set_name,
                version_id=row.version_id,
                status=row.status,
                requirement=row.requirement,
                total=total,
                pending=pending,
                passed=passed,
                failed=total_failed,
                blocked=total_blocked,
                not_applicable=total_na,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )

    result: List[schemas.ExecOverviewUserLayoutOut] = []
    for uid, sets in grouped.items():
        meta = member_meta.get(uid) or {}
        username = meta.get("username") or ("用户#" + str(uid))
        level = meta.get("level")
        created_at = meta.get("created_at")
        total = sum([s.total for s in sets])
        pending = sum([s.pending for s in sets])
        passed = sum([s.passed for s in sets])
        failed = sum([s.failed for s in sets])
        blocked = sum([s.blocked for s in sets])
        na = sum([s.not_applicable for s in sets])
        if created_at is None:
            created_at = datetime.now(timezone.utc)
        result.append(
            schemas.ExecOverviewUserLayoutOut(
                project_id=project_id,
                version_id=version_id,
                user_id=uid,
                username=username,
                level=level,
                user_created_at=created_at,
                total=total,
                pending=pending,
                passed=passed,
                failed=failed,
                blocked=blocked,
                not_applicable=na,
                ui_placement=placement_by_user.get(uid),
                exec_sets=sets,
            )
        )

    return result


@router.get("/archives", response_model=List[schemas.ExecArchiveListItemOut])
def list_exec_archives(
    project_id: int = None,
    version_id: int = None,
    q: str = None,
    limit: int = 200,
    offset: int = 0,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(int(limit or 200), 500))
    safe_offset = max(0, int(offset or 0))

    importer = aliased(models.User)
    archiver = aliased(models.User)
    case_count_sq = (
        db.query(
            models.ExecCase.exec_set_id.label("exec_set_id"),
            func.count(models.ExecCase.id).label("case_count"),
        )
        .group_by(models.ExecCase.exec_set_id)
        .subquery()
    )
    query = (
        db.query(
            models.ExecSet,
            models.Project.name.label("project_name"),
            models.ProjectVersion.name.label("version_name"),
            importer.username.label("importer_name"),
            archiver.username.label("archiver_name"),
            case_count_sq.c.case_count.label("case_count"),
        )
        .join(models.Project, models.Project.id == models.ExecSet.project_id)
        .outerjoin(models.ProjectVersion, models.ProjectVersion.id == models.ExecSet.version_id)
        .outerjoin(importer, importer.id == models.ExecSet.created_by)
        .outerjoin(archiver, archiver.id == models.ExecSet.archived_by)
        .outerjoin(case_count_sq, case_count_sq.c.exec_set_id == models.ExecSet.id)
        .filter(models.ExecSet.status == "archived")
    )

    if project_id is not None:
        ensure_project_access(db, user, project_id)
        query = query.filter(models.ExecSet.project_id == project_id)
    elif user.role != "admin":
        query = query.join(models.UserProject, models.UserProject.project_id == models.ExecSet.project_id).filter(
            models.UserProject.user_id == user.id
        )

    if version_id is not None:
        query = query.filter(models.ExecSet.version_id == version_id)

    term = str(q or "").strip()
    if term:
        query = query.filter(models.ExecSet.name.contains(term))

    rows = (
        query.order_by(
            func.coalesce(models.ExecSet.archived_at, models.ExecSet.updated_at).desc(),
            models.ExecSet.id.desc(),
        )
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
    result: List[schemas.ExecArchiveListItemOut] = []
    for es, project_name, version_name, importer_name, archiver_name, case_count in rows:
        result.append(
            _build_archive_list_item(
                es,
                project_name,
                version_name,
                importer_name,
                archiver_name,
                int(case_count or 0),
            )
        )
    return result


@router.get("/archives/{exec_set_id}", response_model=schemas.ExecArchiveDetailOut)
def get_exec_archive_detail(
    exec_set_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    importer = aliased(models.User)
    archiver = aliased(models.User)
    case_count_sq = (
        db.query(
            models.ExecCase.exec_set_id.label("exec_set_id"),
            func.count(models.ExecCase.id).label("case_count"),
        )
        .group_by(models.ExecCase.exec_set_id)
        .subquery()
    )
    row = (
        db.query(
            models.ExecSet,
            models.Project.name.label("project_name"),
            models.ProjectVersion.name.label("version_name"),
            importer.username.label("importer_name"),
            archiver.username.label("archiver_name"),
            case_count_sq.c.case_count.label("case_count"),
        )
        .join(models.Project, models.Project.id == models.ExecSet.project_id)
        .outerjoin(models.ProjectVersion, models.ProjectVersion.id == models.ExecSet.version_id)
        .outerjoin(importer, importer.id == models.ExecSet.created_by)
        .outerjoin(archiver, archiver.id == models.ExecSet.archived_by)
        .outerjoin(case_count_sq, case_count_sq.c.exec_set_id == models.ExecSet.id)
        .filter(models.ExecSet.id == exec_set_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="归档记录不存在")
    exec_set, project_name, version_name, importer_name, archiver_name, case_count = row
    if str(exec_set.status or "").strip().lower() != "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该记录未归档")
    ensure_project_access(db, user, exec_set.project_id)
    cases = (
        db.query(models.ExecCase)
        .filter(models.ExecCase.exec_set_id == exec_set.id)
        .order_by(models.ExecCase.order_no.asc(), models.ExecCase.id.asc())
        .all()
    )
    base = _build_archive_list_item(
        exec_set,
        project_name,
        version_name,
        importer_name,
        archiver_name,
        int(case_count or 0),
    )
    return schemas.ExecArchiveDetailOut(**base.model_dump(), cases=cases)


@router.delete("/archives/{exec_set_id}")
def delete_exec_archive(
    exec_set_id: int,
    admin: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if admin.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可操作")
    exec_set = db.query(models.ExecSet).filter(models.ExecSet.id == exec_set_id).first()
    if not exec_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="归档记录不存在")
    if str(exec_set.status or "").strip().lower() != "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该记录未归档")
    ensure_project_access(db, admin, exec_set.project_id)
    target_id = exec_set.id
    project_id = exec_set.project_id
    name = exec_set.name
    db.delete(exec_set)
    log_operation(
        db=db,
        user_id=admin.id,
        action="delete_exec_archive",
        target_type="exec_set",
        target_id=target_id,
        detail={"project_id": project_id, "name": name},
    )
    db.commit()
    return {"status": "ok"}
