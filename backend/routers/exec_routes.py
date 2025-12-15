from datetime import datetime, timezone
from typing import List
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user
from ..utils import ensure_project_access, ensure_version_in_project
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError


router = APIRouter(prefix="/exec", tags=["execution"])


def _ensure_exec_set_access(
    db: Session, user: models.User, exec_set_id: int
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
    return exec_set


@router.post("/sets", response_model=schemas.ExecSetOut, status_code=status.HTTP_201_CREATED)
def create_exec_set(
    payload: schemas.ExecSetCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = ensure_project_access(db, user, payload.project_id)
    ensure_version_in_project(db, project.id, payload.version_id)
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
    data = payload.model_dump(exclude_unset=True)
    changed = False
    turned_on_reuse = False
    for field in ["status", "requirement", "reuse_enabled", "reuse_presets"]:
        if field not in data:
            continue
        value = data[field]
        if field == "reuse_enabled":
            value = bool(value)
            if (not exec_set.reuse_enabled) and value:
                turned_on_reuse = True
        if value != getattr(exec_set, field):
            setattr(exec_set, field, value)
            changed = True
    if changed:
        exec_set.updated_at = datetime.now(timezone.utc)
        db.add(exec_set)
        # 执行页将用例切换为“复用类型”时：同步到用例库（case_files.reuse_enabled = true）。
        if turned_on_reuse and exec_set.case_file_id:
            db.query(models.CaseFile).filter(models.CaseFile.id == exec_set.case_file_id).update(
                {models.CaseFile.reuse_enabled: True}, synchronize_session=False
            )
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

    mode = (payload.mode or "replace").strip().lower()
    if mode not in ("replace", "append"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mode 仅支持 replace/append")
    prefer_source = (payload.prefer_result_source or "db").strip().lower()
    if prefer_source not in ("db", "import"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="prefer_result_source 仅支持 db/import")
    preserve_results = True if payload.preserve_results is None else bool(payload.preserve_results)

    # 按用户隔离：同一份 case_file，每个用户各自维护一份 exec_set/exec_cases。
    exec_set = (
        db.query(models.ExecSet)
        .filter(
            models.ExecSet.case_file_id == case_file.id,
            models.ExecSet.created_by == user.id,
        )
        .order_by(models.ExecSet.id.desc())
        .first()
    )
    now = datetime.now(timezone.utc)
    created = False
    if not exec_set:
        exec_set = models.ExecSet(
            project_id=case_file.project_id,
            version_id=case_file.version_id,
            case_file_id=case_file.id,
            name=case_file.file_name_clean,
            status="active",
            created_by=user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(exec_set)
        db.flush()
        created = True
    else:
        exec_set.status = "active"
        exec_set.updated_at = now

    if payload.requirement is not None:
        exec_set.requirement = payload.requirement
    if payload.reuse_enabled is not None:
        exec_set.reuse_enabled = bool(payload.reuse_enabled)
    elif bool(getattr(case_file, "reuse_enabled", False)):
        # 用例库标记为复用类型时：执行集自动启用复用（避免被创建为非复用）。
        exec_set.reuse_enabled = True
    if payload.reuse_presets is not None:
        exec_set.reuse_presets = payload.reuse_presets

    # 复用类型同步到用例库：只要执行集启用复用，就将用例库对应 case_file 标记为复用类型（只升不降）。
    if exec_set.reuse_enabled and not bool(getattr(case_file, "reuse_enabled", False)):
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
    for item in existing_cases:
        if item.case_item_id:
            existing_by_item_id[item.case_item_id] = item

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
            existing.module = item.module
            existing.title = item.title
            existing.expected = item.expected
            existing.priority = item.priority
            existing.precondition = item.precondition
            existing.steps = item.steps
            existing.remark = item.remark
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
            db.add(existing)
            updated_any = True
            continue

        # create new
        order_no = (idx + 1) if mode == "replace" else (base_order + len(new_cases))
        exec_case = models.ExecCase(
            exec_set_id=exec_set.id,
            case_item_id=item.id,
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
            if old.case_item_id and old.case_item_id not in keep_item_ids:
                db.delete(old)
                updated_any = True

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


@router.get("/sets/{exec_set_id}/cases", response_model=List[schemas.ExecCaseOut])
def list_exec_cases(
    exec_set_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_exec_set_access(db, user, exec_set_id)
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
    existing_keys = set((c.module, c.title, c.expected) for c in existing)
    new_cases = []
    order_base = len(existing) + 1
    for idx, item in enumerate(items):
        key = (item.module, item.title, item.expected)
        if key in existing_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="执行集已存在相同模块+用例名+预期结果的用例",
            )
        exec_case = models.ExecCase(
            exec_set_id=exec_set.id,
            case_item_id=item.id,
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
        # 防止同一批次请求中出现重复模块+标题，导致执行集写入重复用例。
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
                updated_case = False
                for key in case_fields:
                    if key in payload_data and payload_data[key] != getattr(case_item, key):
                        setattr(case_item, key, payload_data[key])
                        updated_case = True
                if updated_case:
                    now = exec_case.updated_at
                    case_item.updated_by = user.id
                    case_item.updated_at = now
                    db.query(models.CaseFile).filter(models.CaseFile.id == case_item.case_file_id).update(
                        {models.CaseFile.updated_at: now}, synchronize_session=False
                    )
                    db.add(case_item)
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
                        precondition=exec_case.precondition,
                        steps=exec_case.steps,
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
                detail="更新失败：用例字段重复（模块/标题/预期结果）",
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
    query = (
        db.query(
            models.ExecSet.project_id.label("project_id"),
            models.ExecSet.version_id.label("version_id"),
            func.coalesce(models.ExecCase.executor_id, models.ExecCase.updated_by, models.ExecCase.created_by).label(
                "user_id"
            ),
            func.count(models.ExecCase.id).label("total"),
            func.sum(
                case(
                    (
                        (models.ExecCase.status == "pending")
                        | (models.ExecCase.status == "未执行"),
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
        .filter(models.ExecSet.project_id == project_id)
    )
    if version_id is not None:
        query = query.filter(models.ExecSet.version_id == version_id)
    query = query.group_by("project_id", "version_id", "user_id")
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
    query = (
        db.query(models.ExecCase, models.ExecSet)
        .join(models.ExecSet, models.ExecSet.id == models.ExecCase.exec_set_id)
        .filter(models.ExecSet.project_id == project_id)
    )
    if version_id is not None:
        query = query.filter(models.ExecSet.version_id == version_id)
    if user_id is not None:
        query = query.filter(assigned_user == user_id)
    rows = (
        query.order_by(models.ExecCase.updated_at.desc(), models.ExecCase.id.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
    result: List[schemas.ExecOverviewCaseOut] = []
    for exec_case, exec_set in rows:
        result.append(
            schemas.ExecOverviewCaseOut(
                exec_case_id=exec_case.id,
                exec_set_id=exec_set.id,
                exec_set_name=exec_set.name,
                version_id=exec_set.version_id,
                module=exec_case.module,
                title=exec_case.title,
                status=exec_case.status,
                updated_at=exec_case.updated_at,
            )
        )
    return result
