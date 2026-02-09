from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple
import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session, aliased

from .. import models, schemas
from ..audit import log_case_library_change, log_operation
from ..db import get_db
from ..dependencies import get_current_user, require_admin
from ..utils import clean_case_file_name, ensure_project_access, ensure_version_in_project, ensure_case_item_order


router = APIRouter(prefix="/case-files", tags=["case-library"])


def _normalize_text(value: str) -> str:
    if value is None:
        return ""
    return str(value).strip()


_INVISIBLE_MARKER_RE = re.compile(r"[\u200b\u200c\u200d\u2060\ufeff]")


def _normalize_case_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    try:
        return _INVISIBLE_MARKER_RE.sub("", str(value)).strip()
    except Exception:
        return ""


def _is_case_item_complete(
    module: Optional[str],
    title: Optional[str],
    precondition: Optional[str],
    steps: Optional[str],
    expected: Optional[str],
) -> bool:
    if not _normalize_case_text(module):
        return False
    if not _normalize_case_text(title):
        return False
    if not _normalize_case_text(precondition):
        return False
    if not _normalize_case_text(steps):
        return False
    if not _normalize_case_text(expected):
        return False
    return True


def _is_case_item_delete_complete(
    title: Optional[str],
    precondition: Optional[str],
    steps: Optional[str],
    expected: Optional[str],
) -> bool:
    if not _normalize_case_text(title):
        return False
    if not _normalize_case_text(precondition):
        return False
    if not _normalize_case_text(steps):
        return False
    if not _normalize_case_text(expected):
        return False
    return True


def _collect_import_modules(items: List[schemas.CaseItemPayload]) -> Set[str]:
    modules: Set[str] = set()
    for it in items or []:
        mod = _normalize_text(getattr(it, "module", "") or "")
        if mod:
            modules.add(mod)
    return modules


def _collect_import_titles(items: List[schemas.CaseItemPayload]) -> Set[str]:
    titles: Set[str] = set()
    for it in items or []:
        title = _normalize_text(getattr(it, "title", "") or "")
        if title:
            titles.add(title)
    return titles


def _find_duplicate_case_file(
    db: Session,
    project_id: int,
    import_clean_name: str,
    import_items: List[schemas.CaseItemPayload],
) -> Tuple[Optional[models.CaseFile], Dict]:
    """
    同名判定（更准确）：
    1) 名字去掉首尾空格后完全相同：同名。
    2) 导入名字包含库中名字（如 “用例1（1）” / “xx用例1yy”）：
       - 若模块交集 >= 2：同名。
       - 若双方都只有 1 个模块且模块相同，则继续判断标题交集 >= 2：同名。
    返回 (matched_case_file, meta)
    """
    import_name = _normalize_text(import_clean_name)
    if not import_name:
        return None, {}

    files = (
        db.query(models.CaseFile)
        .filter(models.CaseFile.project_id == project_id)
        .order_by(models.CaseFile.id.asc())
        .all()
    )
    if not files:
        return None, {}

    for cf in files:
        if _normalize_text(cf.file_name_clean) == import_name:
            return cf, {"match_rule": "name_exact"}

    candidates: List[models.CaseFile] = []
    for cf in files:
        base = _normalize_text(cf.file_name_clean)
        if not base:
            continue
        if base == import_name:
            continue
        if base in import_name:
            candidates.append(cf)

    if not candidates:
        return None, {}

    import_modules = _collect_import_modules(import_items)
    import_titles = _collect_import_titles(import_items)
    import_module_count = len(import_modules)

    best: Optional[models.CaseFile] = None
    best_meta: Dict = {}
    best_score = -1

    for cf in candidates:
        db_modules = {
            _normalize_text(row[0])
            for row in (
                db.query(models.CaseItem.module)
                .filter(models.CaseItem.case_file_id == cf.id)
                .distinct()
                .all()
            )
            if row and _normalize_text(row[0])
        }
        overlap_modules = len(import_modules.intersection(db_modules))
        if overlap_modules >= 2:
            score = overlap_modules * 10
            if score > best_score:
                best = cf
                best_score = score
                best_meta = {
                    "match_rule": "name_contains+module_overlap>=2",
                    "overlap_modules": overlap_modules,
                }
            continue

        # 第二逻辑第二情况：双方都只有 1 个模块且模块相同，再看标题是否至少 2 条重合
        if import_module_count == 1 and len(db_modules) == 1 and overlap_modules == 1:
            module_name = next(iter(import_modules))
            db_titles = {
                _normalize_text(row[0])
                for row in (
                    db.query(models.CaseItem.title)
                    .filter(
                        models.CaseItem.case_file_id == cf.id,
                        models.CaseItem.module == module_name,
                    )
                    .distinct()
                    .all()
                )
                if row and _normalize_text(row[0])
            }
            overlap_titles = len(import_titles.intersection(db_titles))
            if overlap_titles >= 2:
                score = overlap_titles * 10 + 1
                if score > best_score:
                    best = cf
                    best_score = score
                    best_meta = {
                        "match_rule": "name_contains+single_module+title_overlap>=2",
                        "overlap_modules": overlap_modules,
                        "overlap_titles": overlap_titles,
                        "module": module_name,
                    }

    return best, best_meta


def _ensure_case_access(
    db: Session, user: models.User, case_file_id: int
) -> models.CaseFile:
    case_file = db.query(models.CaseFile).filter(models.CaseFile.id == case_file_id).first()
    if not case_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例文件不存在")
    ensure_project_access(db, user, case_file.project_id)
    return case_file


def _parse_assoc_item_ids(raw) -> List[int]:
    if raw is None:
        return []
    data = raw
    if isinstance(raw, str):
        txt = str(raw).strip()
        if not txt:
            return []
        try:
            import json

            data = json.loads(txt)
        except Exception:
            return []
    if not isinstance(data, list):
        return []
    seen = set()
    ids: List[int] = []
    for item in data:
        try:
            cid = int(item)
        except Exception:
            continue
        if cid <= 0:
            continue
        if cid in seen:
            continue
        seen.add(cid)
        ids.append(cid)
    return ids


def _normalize_assoc_selected_ids(
    db: Session,
    sub_case_file_id: int,
    selected_case_item_ids: List[int],
) -> List[int]:
    ids = []
    seen = set()
    for raw in selected_case_item_ids or []:
        try:
            cid = int(raw)
        except Exception:
            continue
        if cid <= 0:
            continue
        if cid in seen:
            continue
        seen.add(cid)
        ids.append(cid)
    if not ids:
        return []
    rows = (
        db.query(models.CaseItem.id)
        .filter(models.CaseItem.case_file_id == int(sub_case_file_id))
        .filter(models.CaseItem.id.in_(ids))
        .order_by(models.CaseItem.order_no.asc(), models.CaseItem.id.asc())
        .all()
    )
    valid = [int(r[0]) for r in (rows or []) if r and r[0]]
    return valid


def _build_case_file_association_out(
    assoc: models.CaseFileAssociation,
    sub_case_name: str,
) -> schemas.CaseFileAssociationOut:
    selected_ids = _parse_assoc_item_ids(getattr(assoc, "selected_case_item_ids", None))
    return schemas.CaseFileAssociationOut(
        id=int(assoc.id),
        main_case_file_id=int(assoc.main_case_file_id),
        sub_case_file_id=int(assoc.sub_case_file_id),
        sub_case_file_name=str(sub_case_name or ("用例#" + str(assoc.sub_case_file_id))),
        selected_case_item_ids=selected_ids,
        selected_count=len(selected_ids),
        created_at=assoc.created_at,
        updated_at=assoc.updated_at,
    )


def _is_case_file_association_forbidden(
    db: Session,
    main_case_file_id: int,
    sub_case_file_id: int,
) -> bool:
    if int(main_case_file_id) == int(sub_case_file_id):
        return True
    # 若已存在反向关联（sub -> main），则禁止 main -> sub，防止形成互为主副。
    reverse = (
        db.query(models.CaseFileAssociation.id)
        .filter(models.CaseFileAssociation.main_case_file_id == int(sub_case_file_id))
        .filter(models.CaseFileAssociation.sub_case_file_id == int(main_case_file_id))
        .first()
    )
    return reverse is not None


def _resolve_case_file_association_forbidden_reason(
    db: Session,
    main_case_file_id: int,
    sub_case_file_id: int,
) -> Optional[str]:
    if int(main_case_file_id) == int(sub_case_file_id):
        return "不能选择当前主用例"
    reverse = (
        db.query(models.CaseFileAssociation.id)
        .filter(models.CaseFileAssociation.main_case_file_id == int(sub_case_file_id))
        .filter(models.CaseFileAssociation.sub_case_file_id == int(main_case_file_id))
        .first()
    )
    if reverse:
        return "已存在反向关联"
    return None


@router.post("/import", response_model=schemas.CaseFileOut, status_code=status.HTTP_201_CREATED)
def import_case_file(
    payload: schemas.CaseFileImportRequest,
    response: Response,
    overwrite: bool = False,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = ensure_project_access(db, user, payload.project_id)
    ensure_version_in_project(db, project.id, payload.version_id)
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")
    # 导入文件内可能存在重复条目（按 模块+标题+前提条件+操作步骤+预期结果 判断），直接写库会触发唯一约束导致整份导入失败；
    # 这里做一次去重以提升容错（执行页导入侧也依赖该接口）。
    def _norm_key(value: str) -> str:
        if value is None:
            return ""
        try:
            return str(value).replace("\r\n", "\n").strip().lower()
        except Exception:
            return ""

    unique_items = []
    seen_keys = set()
    duplicate_count = 0
    for item in payload.items:
        key = (
            _norm_key(item.module),
            _norm_key(item.title),
            _norm_key(getattr(item, "precondition", None)),
            _norm_key(getattr(item, "steps", None)),
            _norm_key(item.expected),
        )
        if key in seen_keys:
            duplicate_count += 1
            continue
        seen_keys.add(key)
        unique_items.append(item)
    if not unique_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")
    clean_name = clean_case_file_name(payload.file_name)
    exists = (
        db.query(models.CaseFile)
        .filter(
            models.CaseFile.project_id == project.id,
            models.CaseFile.file_name_clean == clean_name,
        )
        .first()
    )
    # 更准确的同名判定：先按清洗名精准匹配，再按“包含 + 模块/标题重合”判断。
    if not exists:
        matched, meta = _find_duplicate_case_file(
            db, project.id, clean_name, unique_items
        )
        if matched:
            exists = matched
            # 覆盖导入时可接受模糊匹配，否则拒绝并返回匹配信息供前端打开 diff。
            if not overwrite:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "detail": "同名用例已存在",
                        "existing_case_file_id": matched.id,
                        "existing_file_name_clean": matched.file_name_clean,
                        "existing_version_id": matched.version_id,
                        "match": meta,
                    },
                )
    if exists and not overwrite:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "detail": "同名用例已存在",
                "existing_case_file_id": exists.id,
                "existing_file_name_clean": exists.file_name_clean,
                "existing_version_id": exists.version_id,
                "match": {"match_rule": "name_exact"},
            },
        )
    now = datetime.now(timezone.utc)
    linked_exec_sets = 0
    prev_version_id = None
    before_count = 0
    if exists and overwrite:
        response.status_code = status.HTTP_200_OK
        case_file = exists
        prev_version_id = case_file.version_id
        linked_exec_sets = (
            db.query(func.count(models.ExecSet.id))
            .filter(models.ExecSet.case_file_id == case_file.id)
            .scalar()
            or 0
        )
        before_count = (
            db.query(func.count(models.CaseItem.id))
            .filter(models.CaseItem.case_file_id == case_file.id)
            .scalar()
            or 0
        )
        case_file.version_id = payload.version_id
        case_file.importer_id = user.id
        case_file.imported_at = now
        case_file.source = payload.source
        case_file.updated_at = now
        case_file.updated_by = user.id
        if getattr(payload, "reuse_enabled", None) is True:
            case_file.reuse_enabled = True
        db.query(models.CaseItem).filter(models.CaseItem.case_file_id == case_file.id).delete(
            synchronize_session=False
        )
        db.add(case_file)
        db.flush()
    else:
        case_file = models.CaseFile(
            project_id=project.id,
            version_id=payload.version_id,
            file_name_clean=clean_name,
            reuse_enabled=True if (getattr(payload, "reuse_enabled", None) is True) else False,
            importer_id=user.id,
            updated_by=user.id,
            imported_at=now,
            source=payload.source,
        )
        db.add(case_file)
        db.flush()
    values = []
    for idx, item in enumerate(unique_items):
        values.append(
            {
                "case_file_id": case_file.id,
                "module": item.module,
                "title": item.title,
                "priority": item.priority,
                "precondition": item.precondition if item.precondition is not None else "",
                "steps": item.steps if item.steps is not None else "",
                "expected": item.expected,
                "remark": item.remark,
                "order_no": idx + 1,
                "created_by": user.id,
                "updated_by": user.id,
                "created_at": now,
                "updated_at": now,
            }
        )
    # 使用 SQLite OR IGNORE：确保“存在重复条目”等唯一约束冲突不会导致整份导入失败；
    # 同时保留项目级同名用例文件拒绝逻辑（在上方已提前拦截）。
    if values:
        db.execute(sqlite_insert(models.CaseItem).values(values).prefix_with("OR IGNORE"))
    item_count = (
        db.query(func.count(models.CaseItem.id))
        .filter(models.CaseItem.case_file_id == case_file.id)
        .scalar()
        or 0
    )
    if item_count <= 0:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")
    skipped_db_conflicts = max(0, int(len(unique_items)) - int(item_count))
    log_case_library_change(
        db=db,
        user=user,
        project_id=project.id,
        version_id=payload.version_id,
        file_name_clean=case_file.file_name_clean,
        case_file_id=case_file.id,
        kind="reimport" if (exists and overwrite) else "import",
        meta={
            "overwrite": bool(exists and overwrite),
            "prev_version_id": prev_version_id,
            "linked_exec_sets": int(linked_exec_sets or 0),
            "item_total": len(payload.items),
            "item_unique": len(unique_items),
            "item_imported": int(item_count),
            "item_skipped_payload_duplicates": duplicate_count,
            "item_skipped_db_conflicts": skipped_db_conflicts,
        },
        at=now,
    )
    log_operation(
        db=db,
        user_id=user.id,
        action="overwrite_case_file" if (exists and overwrite) else "import_case_file",
        target_type="case_file",
        target_id=case_file.id,
        detail={
            "project_id": project.id,
            "file_name": case_file.file_name_clean,
            "source": payload.source,
            "overwrite": bool(exists and overwrite),
            "prev_version_id": prev_version_id,
            "linked_exec_sets": int(linked_exec_sets or 0),
            "item_total": len(payload.items),
            "item_unique": len(unique_items),
            "item_imported": int(item_count),
            "item_skipped_payload_duplicates": duplicate_count,
            "item_skipped_db_conflicts": skipped_db_conflicts,
            "before_count": int(before_count),
            "after_count": int(item_count),
        },
    )
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(getattr(e, "orig", "") or str(e) or "").strip()
        if msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用例导入失败：" + msg,
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例导入失败：数据库约束冲突")
    db.refresh(case_file)
    # 给前端即时展示用例条目数（不新增 DB 字段）。
    try:
        setattr(case_file, "item_count", int(item_count))
    except Exception:
        pass
    return case_file


@router.post("/share", response_model=schemas.CaseFileOut, status_code=status.HTTP_201_CREATED)
def share_case_file(
    payload: schemas.CaseFileShareRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source_case_file = (
        db.query(models.CaseFile)
        .filter(models.CaseFile.id == payload.case_file_id)
        .first()
    )
    if not source_case_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例不存在")
    ensure_project_access(db, user, source_case_file.project_id)

    target_project = (
        db.query(models.Project)
        .filter(models.Project.id == payload.target_project_id)
        .first()
    )
    if not target_project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="目标项目不存在")
    ensure_version_in_project(db, target_project.id, payload.target_version_id)

    clean_name = clean_case_file_name(source_case_file.file_name_clean)
    exists = (
        db.query(models.CaseFile)
        .filter(
            models.CaseFile.project_id == target_project.id,
            models.CaseFile.file_name_clean == clean_name,
        )
        .first()
    )
    if exists:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": "case_file_duplicate",
                "existing_case_file_id": exists.id,
                "existing_file_name_clean": exists.file_name_clean,
            },
        )

    items = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == source_case_file.id)
        .order_by(models.CaseItem.order_no.asc(), models.CaseItem.id.asc())
        .all()
    )
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")

    now = datetime.now(timezone.utc)
    case_file = models.CaseFile(
        project_id=target_project.id,
        version_id=payload.target_version_id,
        file_name_clean=clean_name,
        reuse_enabled=bool(getattr(source_case_file, "reuse_enabled", False)),
        importer_id=user.id,
        updated_by=user.id,
        imported_at=now,
        updated_at=now,
        source="share:" + str(source_case_file.id),
    )
    db.add(case_file)
    db.flush()

    values = []
    for idx, item in enumerate(items):
        values.append(
            {
                "case_file_id": case_file.id,
                "module": item.module,
                "title": item.title,
                "priority": item.priority,
                "precondition": item.precondition if item.precondition is not None else "",
                "steps": item.steps if item.steps is not None else "",
                "expected": item.expected,
                "remark": item.remark,
                "order_no": idx + 1,
                "created_by": user.id,
                "updated_by": user.id,
                "created_at": now,
                "updated_at": now,
            }
        )
    if values:
        db.execute(sqlite_insert(models.CaseItem).values(values).prefix_with("OR IGNORE"))
    item_count = (
        db.query(func.count(models.CaseItem.id))
        .filter(models.CaseItem.case_file_id == case_file.id)
        .scalar()
        or 0
    )
    if item_count <= 0:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")

    log_case_library_change(
        db=db,
        user=user,
        project_id=target_project.id,
        version_id=payload.target_version_id,
        file_name_clean=case_file.file_name_clean,
        case_file_id=case_file.id,
        kind="import",
        meta={
            "source": "share",
            "source_case_file_id": source_case_file.id,
            "source_project_id": source_case_file.project_id,
            "source_version_id": source_case_file.version_id,
        },
    )
    log_operation(
        db=db,
        user_id=user.id,
        action="share_case_file",
        target_type="case_file",
        target_id=case_file.id,
        detail={
            "case_file_id": case_file.id,
            "file_name": case_file.file_name_clean,
            "source_case_file_id": source_case_file.id,
            "source_project_id": source_case_file.project_id,
            "source_version_id": source_case_file.version_id,
            "target_project_id": target_project.id,
            "target_version_id": payload.target_version_id,
        },
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "case_file_duplicate"},
        )
    db.refresh(case_file)
    setattr(case_file, "item_count", int(item_count))
    return case_file


@router.post("/change-version")
def change_case_file_version(
    payload: schemas.CaseFileChangeVersionRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.case_file_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择用例文件")
    ensure_project_access(db, user, payload.project_id)
    ensure_version_in_project(db, payload.project_id, payload.target_version_id)

    raw_ids = payload.case_file_ids or []
    ids = []
    seen = set()
    for item in raw_ids:
        try:
            value = int(item)
        except Exception:
            continue
        if value in seen:
            continue
        seen.add(value)
        ids.append(value)
    if not ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择用例文件")

    case_files = (
        db.query(models.CaseFile)
        .filter(
            models.CaseFile.project_id == payload.project_id,
            models.CaseFile.id.in_(ids),
        )
        .all()
    )
    if not case_files:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例不存在")

    now = datetime.now(timezone.utc)
    updated_ids = []
    skipped_ids = []
    existing_ids = set()

    for case_file in case_files:
        if not case_file:
            continue
        existing_ids.add(case_file.id)
        prev_version_id = case_file.version_id
        if prev_version_id == payload.target_version_id:
            skipped_ids.append(int(case_file.id))
            continue
        case_file.version_id = payload.target_version_id
        case_file.updated_at = now
        case_file.updated_by = user.id
        db.add(case_file)
        updated_ids.append(int(case_file.id))
        log_case_library_change(
            db=db,
            user=user,
            project_id=case_file.project_id,
            version_id=payload.target_version_id,
            file_name_clean=case_file.file_name_clean,
            case_file_id=case_file.id,
            kind="version_changed",
            meta={
                "prev_version_id": prev_version_id,
                "next_version_id": payload.target_version_id,
            },
            at=now,
        )

    missing_ids = [int(item) for item in ids if item not in existing_ids]
    log_operation(
        db=db,
        user_id=user.id,
        action="change_case_file_version",
        target_type="case_file",
        target_id=updated_ids[0] if len(updated_ids) == 1 else None,
        detail={
            "project_id": payload.project_id,
            "target_version_id": payload.target_version_id,
            "case_file_ids": ids,
            "updated_ids": updated_ids,
            "skipped_ids": skipped_ids,
            "missing_ids": missing_ids,
        },
    )
    db.commit()
    return {
        "detail": "版本已更新",
        "updated_ids": updated_ids,
        "skipped_ids": skipped_ids,
        "missing_ids": missing_ids,
    }


@router.get("", response_model=List[schemas.CaseFileOut])
def list_case_files(
    project_id: int = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_query = db.query(models.CaseFile)
    if project_id:
        ensure_project_access(db, user, project_id)
        base_query = base_query.filter(models.CaseFile.project_id == project_id)
    elif user.role != "admin":
        base_query = base_query.join(
            models.UserProject, models.UserProject.project_id == models.CaseFile.project_id
        ).filter(models.UserProject.user_id == user.id)

    importer = aliased(models.User)
    updater = aliased(models.User)
    last_item_sq = (
        db.query(
            models.CaseItem.case_file_id.label("case_file_id"),
            models.CaseItem.updated_by.label("last_updated_by"),
            models.CaseItem.updated_at.label("last_item_updated_at"),
            func.row_number()
            .over(
                partition_by=models.CaseItem.case_file_id,
                order_by=models.CaseItem.updated_at.desc(),
            )
            .label("rn"),
        )
        .subquery()
    )
    item_count_sq = (
        db.query(
            models.CaseItem.case_file_id.label("case_file_id"),
            func.count(models.CaseItem.id).label("item_count"),
        )
        .group_by(models.CaseItem.case_file_id)
        .subquery()
    )
    assoc_count_sq = (
        db.query(
            models.CaseFileAssociation.main_case_file_id.label("main_case_file_id"),
            func.count(models.CaseFileAssociation.id).label("association_count"),
        )
        .group_by(models.CaseFileAssociation.main_case_file_id)
        .subquery()
    )

    rows = (
        base_query.with_entities(
            models.CaseFile,
            importer.username.label("importer_name"),
            last_item_sq.c.last_updated_by.label("last_updated_by"),
            updater.username.label("last_updated_by_name"),
            item_count_sq.c.item_count.label("item_count"),
            assoc_count_sq.c.association_count.label("association_count"),
        )
        .outerjoin(importer, importer.id == models.CaseFile.importer_id)
        .outerjoin(
            last_item_sq,
            (last_item_sq.c.case_file_id == models.CaseFile.id) & (last_item_sq.c.rn == 1),
        )
        .outerjoin(updater, updater.id == last_item_sq.c.last_updated_by)
        .outerjoin(item_count_sq, item_count_sq.c.case_file_id == models.CaseFile.id)
        .outerjoin(
            assoc_count_sq,
            assoc_count_sq.c.main_case_file_id == models.CaseFile.id,
        )
        .order_by(models.CaseFile.id.desc())
        .all()
    )

    result = []
    for row in rows:
        (
            case_file,
            importer_name,
            last_updated_by,
            last_updated_by_name,
            item_count,
            association_count,
        ) = row
        result.append(
            {
                "id": case_file.id,
                "project_id": case_file.project_id,
                "version_id": case_file.version_id,
                "file_name_clean": case_file.file_name_clean,
                "source": case_file.source,
                "reuse_enabled": bool(getattr(case_file, "reuse_enabled", False)),
                "association_count": int(association_count or 0),
                "item_count": int(item_count or 0),
                "importer_id": case_file.importer_id,
                "importer_name": importer_name,
                "imported_at": case_file.imported_at,
                "updated_at": case_file.updated_at,
                "last_updated_by": last_updated_by,
                "last_updated_by_name": last_updated_by_name,
            }
        )
    return result


@router.get("/{case_file_id}/items", response_model=List[schemas.CaseItemOut])
def list_case_items(
    case_file_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_case_access(db, user, case_file_id)
    items = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == case_file_id)
        .order_by(models.CaseItem.order_no.asc(), models.CaseItem.id.asc())
        .all()
    )
    return items


@router.get("/{case_file_id}/associations", response_model=List[schemas.CaseFileAssociationOut])
def list_case_file_associations(
    case_file_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_case_access(db, user, case_file_id)
    sub_case = aliased(models.CaseFile)
    rows = (
        db.query(models.CaseFileAssociation, sub_case.file_name_clean)
        .join(sub_case, sub_case.id == models.CaseFileAssociation.sub_case_file_id)
        .filter(models.CaseFileAssociation.main_case_file_id == int(case_file_id))
        .order_by(
            models.CaseFileAssociation.order_no.asc(),
            models.CaseFileAssociation.id.asc(),
        )
        .all()
    )
    result: List[schemas.CaseFileAssociationOut] = []
    for row in rows:
        assoc, sub_name = row
        result.append(_build_case_file_association_out(assoc, sub_name or ""))
    return result


@router.get(
    "/{case_file_id}/association-candidates",
    response_model=List[schemas.CaseFileAssociationCandidateOut],
)
def list_case_file_association_candidates(
    case_file_id: int,
    include_forbidden: bool = True,
    version_id: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    main_case = _ensure_case_access(db, user, case_file_id)
    item_count_sq = (
        db.query(
            models.CaseItem.case_file_id.label("case_file_id"),
            func.count(models.CaseItem.id).label("item_count"),
        )
        .group_by(models.CaseItem.case_file_id)
        .subquery()
    )
    assoc_count_sq = (
        db.query(
            models.CaseFileAssociation.main_case_file_id.label("main_case_file_id"),
            func.count(models.CaseFileAssociation.id).label("association_count"),
        )
        .group_by(models.CaseFileAssociation.main_case_file_id)
        .subquery()
    )
    query = (
        db.query(
            models.CaseFile,
            item_count_sq.c.item_count,
            assoc_count_sq.c.association_count,
        )
        .outerjoin(item_count_sq, item_count_sq.c.case_file_id == models.CaseFile.id)
        .outerjoin(
            assoc_count_sq,
            assoc_count_sq.c.main_case_file_id == models.CaseFile.id,
        )
        .filter(models.CaseFile.project_id == int(main_case.project_id))
    )
    if version_id is not None:
        query = query.filter(models.CaseFile.version_id == int(version_id))
    rows = query.order_by(models.CaseFile.id.desc()).all()
    existing_sub_rows = (
        db.query(models.CaseFileAssociation.sub_case_file_id)
        .filter(models.CaseFileAssociation.main_case_file_id == int(main_case.id))
        .all()
    )
    existing_sub_ids = {int(r[0]) for r in (existing_sub_rows or []) if r and r[0] is not None}

    result: List[schemas.CaseFileAssociationCandidateOut] = []
    for row in rows:
        case_file, item_count, association_count = row
        case_id = int(case_file.id)
        reason = None
        if case_id in existing_sub_ids:
            reason = "已关联到当前主用例"
        else:
            reason = _resolve_case_file_association_forbidden_reason(
                db, int(main_case.id), case_id
            )
        forbidden = reason is not None
        if forbidden and not include_forbidden:
            continue
        result.append(
            schemas.CaseFileAssociationCandidateOut(
                id=case_id,
                project_id=int(case_file.project_id),
                version_id=case_file.version_id,
                file_name_clean=str(case_file.file_name_clean or ("用例#" + str(case_file.id))),
                item_count=int(item_count or 0),
                association_count=int(association_count or 0),
                association_forbidden=forbidden,
                forbidden_reason=reason,
            )
        )
    return result


@router.post(
    "/{case_file_id}/associations",
    response_model=schemas.CaseFileAssociationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_case_file_association(
    case_file_id: int,
    payload: schemas.CaseFileAssociationCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    main_case = _ensure_case_access(db, user, case_file_id)
    sub_case = _ensure_case_access(db, user, payload.sub_case_file_id)
    if int(main_case.project_id) != int(sub_case.project_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联用例需属于同一项目")
    if _is_case_file_association_forbidden(db, main_case.id, sub_case.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用例关系不允许建立关联（可能已存在反向关联或选择了主用例自身）",
        )
    existed = (
        db.query(models.CaseFileAssociation)
        .filter(models.CaseFileAssociation.main_case_file_id == int(main_case.id))
        .filter(models.CaseFileAssociation.sub_case_file_id == int(sub_case.id))
        .first()
    )
    if existed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="关联已存在")

    selected_ids = _normalize_assoc_selected_ids(
        db,
        sub_case_file_id=sub_case.id,
        selected_case_item_ids=payload.selected_case_item_ids,
    )
    if not selected_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先勾选至少一条副用例")

    max_order = (
        db.query(func.max(models.CaseFileAssociation.order_no))
        .filter(models.CaseFileAssociation.main_case_file_id == int(main_case.id))
        .scalar()
    )
    next_order = int(max_order or 0) + 1
    now = datetime.now(timezone.utc)
    assoc = models.CaseFileAssociation(
        main_case_file_id=int(main_case.id),
        sub_case_file_id=int(sub_case.id),
        selected_case_item_ids=selected_ids,
        order_no=next_order,
        created_by=user.id,
        updated_by=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(assoc)
    log_operation(
        db=db,
        user_id=user.id,
        action="create_case_file_association",
        target_type="case_file",
        target_id=int(main_case.id),
        detail={
            "main_case_file_id": int(main_case.id),
            "sub_case_file_id": int(sub_case.id),
            "selected_count": len(selected_ids),
        },
    )
    db.commit()
    db.refresh(assoc)
    return _build_case_file_association_out(assoc, sub_case.file_name_clean or "")


@router.patch(
    "/{case_file_id}/associations/{association_id}",
    response_model=schemas.CaseFileAssociationOut,
)
def update_case_file_association(
    case_file_id: int,
    association_id: int,
    payload: schemas.CaseFileAssociationPatch,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_case_access(db, user, case_file_id)
    assoc = (
        db.query(models.CaseFileAssociation)
        .filter(models.CaseFileAssociation.id == int(association_id))
        .filter(models.CaseFileAssociation.main_case_file_id == int(case_file_id))
        .first()
    )
    if not assoc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="关联不存在")
    sub_case = _ensure_case_access(db, user, int(assoc.sub_case_file_id))
    selected_ids = _normalize_assoc_selected_ids(
        db,
        sub_case_file_id=sub_case.id,
        selected_case_item_ids=payload.selected_case_item_ids,
    )
    if not selected_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先勾选至少一条副用例")
    assoc.selected_case_item_ids = selected_ids
    assoc.updated_by = user.id
    assoc.updated_at = datetime.now(timezone.utc)
    db.add(assoc)
    log_operation(
        db=db,
        user_id=user.id,
        action="update_case_file_association",
        target_type="case_file",
        target_id=int(case_file_id),
        detail={
            "association_id": int(assoc.id),
            "main_case_file_id": int(case_file_id),
            "sub_case_file_id": int(assoc.sub_case_file_id),
            "selected_count": len(selected_ids),
        },
    )
    db.commit()
    db.refresh(assoc)
    return _build_case_file_association_out(assoc, sub_case.file_name_clean or "")


@router.delete("/{case_file_id}/associations/{association_id}")
def delete_case_file_association(
    case_file_id: int,
    association_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_case_access(db, user, case_file_id)
    assoc = (
        db.query(models.CaseFileAssociation)
        .filter(models.CaseFileAssociation.id == int(association_id))
        .filter(models.CaseFileAssociation.main_case_file_id == int(case_file_id))
        .first()
    )
    if not assoc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="关联不存在")
    sub_case_file_id = int(assoc.sub_case_file_id)
    db.delete(assoc)
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_case_file_association",
        target_type="case_file",
        target_id=int(case_file_id),
        detail={
            "association_id": int(association_id),
            "main_case_file_id": int(case_file_id),
            "sub_case_file_id": int(sub_case_file_id),
        },
    )
    db.commit()
    return {
        "detail": "ok",
        "association_id": int(association_id),
        "main_case_file_id": int(case_file_id),
        "sub_case_file_id": int(sub_case_file_id),
    }


def _snapshot_case_item(item: models.CaseItem):
    if not item:
        return None
    return {
        "module": item.module,
        "title": item.title,
        "priority": item.priority,
        "precondition": item.precondition or "",
        "steps": item.steps or "",
        "expected": item.expected,
        "remark": item.remark,
    }


def _compute_changed_fields(old_snap: dict, new_snap: dict):
    keys = ["module", "title", "precondition", "steps", "expected"]
    changed = []
    for k in keys:
        old_val = "" if old_snap is None else str(old_snap.get(k) or "")
        new_val = "" if new_snap is None else str(new_snap.get(k) or "")
        if old_val != new_val:
            changed.append(k)
    return changed


@router.delete("/{case_file_id}")
def delete_case_file(
    case_file_id: int,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    case_file = _ensure_case_access(db, admin, case_file_id)
    case_file_key = str(case_file.id)
    source_key = "case_file:" + case_file_key
    active_exec_rows = (
        db.query(models.ExecSet.id, models.User.username)
        .outerjoin(models.User, models.User.id == models.ExecSet.created_by)
        .filter(models.ExecSet.project_id == case_file.project_id)
        .filter(models.ExecSet.status == "active")
        .filter(
            or_(
                models.ExecSet.case_file_id == case_file.id,
                models.ExecSet.source == case_file_key,
                models.ExecSet.source == source_key,
            )
        )
        .all()
    )
    if active_exec_rows:
        users = set()
        unknown = False
        for _, username in active_exec_rows:
            if username and str(username).strip():
                users.add(str(username).strip())
            else:
                unknown = True
        active_users = sorted(list(users))
        if unknown:
            active_users.append("未知人员")
        users_text = "、".join(active_users) if active_users else "未知人员"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": "该用例文件正在执行页中（执行人员：" + users_text + "），请先在执行页面解散该份用例后再删除。",
                "active_users": active_users,
            },
        )
    linked_exec_sets = (
        db.query(func.count(models.ExecSet.id))
        .filter(models.ExecSet.case_file_id == case_file.id)
        .scalar()
        or 0
    )
    items = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == case_file.id)
        .all()
    )
    deleted_total = len(items)
    deleted_complete = 0
    for item in items or []:
        if not item:
            continue
        if _is_case_item_delete_complete(
            item.title,
            item.precondition,
            item.steps,
            item.expected,
        ):
            deleted_complete += 1
    log_case_library_change(
        db=db,
        user=admin,
        project_id=case_file.project_id,
        version_id=case_file.version_id,
        file_name_clean=case_file.file_name_clean,
        case_file_id=case_file.id,
        kind="file_deleted",
        meta={"linked_exec_sets": int(linked_exec_sets)},
        at=datetime.now(timezone.utc),
    )
    db.delete(case_file)
    log_operation(
        db=db,
        user_id=admin.id,
        action="delete_case_file",
        target_type="case_file",
        target_id=case_file_id,
        detail={
            "project_id": case_file.project_id,
            "version_id": case_file.version_id,
            "file_name": case_file.file_name_clean,
            "linked_exec_sets": int(linked_exec_sets),
            "item_deleted_total": int(deleted_total),
            "item_deleted_complete": int(deleted_complete),
            "before_count": int(deleted_total),
            "after_count": 0,
        },
    )
    db.commit()
    return {
        "detail": "用例文件已删除",
        "case_file_id": case_file_id,
        "linked_exec_sets": int(linked_exec_sets),
    }


@router.patch("/items/{case_item_id}", response_model=schemas.CaseItemOut)
def update_case_item(
    case_item_id: int,
    payload: schemas.CaseItemPatch,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case_item = db.query(models.CaseItem).filter(models.CaseItem.id == case_item_id).first()
    if not case_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例不存在")
    case_file = _ensure_case_access(db, user, case_item.case_file_id)
    prev_complete = _is_case_item_complete(
        case_item.module,
        case_item.title,
        case_item.precondition,
        case_item.steps,
        case_item.expected,
    )
    prev_delete_complete = _is_case_item_delete_complete(
        case_item.title,
        case_item.precondition,
        case_item.steps,
        case_item.expected,
    )
    old_snap = _snapshot_case_item(case_item)
    prev_complete = _is_case_item_complete(
        case_item.module,
        case_item.title,
        case_item.precondition,
        case_item.steps,
        case_item.expected,
    )
    prev_delete_complete = _is_case_item_delete_complete(
        case_item.title,
        case_item.precondition,
        case_item.steps,
        case_item.expected,
    )
    prev_complete = _is_case_item_complete(
        case_item.module,
        case_item.title,
        case_item.precondition,
        case_item.steps,
        case_item.expected,
    )
    payload_data = payload.model_dump(exclude_unset=True)
    changed = False
    for field in ["module", "title", "priority", "precondition", "steps", "expected", "remark"]:
        if field not in payload_data:
            continue
        value = payload_data[field]
        if value is None and field in ("module", "title", "expected"):
            # 必填字段不允许被 PATCH 为 null；不传字段即可保持原值。
            continue
        if field in ("precondition", "steps") and value is None:
            value = ""
        if value != getattr(case_item, field):
            setattr(case_item, field, value)
            changed = True
    if changed:
        now = datetime.now(timezone.utc)
        case_item.updated_by = user.id
        case_item.updated_at = now
        db.query(models.CaseFile).filter(models.CaseFile.id == case_item.case_file_id).update(
            {models.CaseFile.updated_at: now, models.CaseFile.updated_by: user.id}, synchronize_session=False
        )
        db.add(case_item)
        new_snap = _snapshot_case_item(case_item)
        next_complete = _is_case_item_complete(
            case_item.module,
            case_item.title,
            case_item.precondition,
            case_item.steps,
            case_item.expected,
        )
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
            meta={"changed_fields": _compute_changed_fields(old_snap or {}, new_snap or {})},
            at=now,
        )
        case_count = (
            db.query(func.count(models.CaseItem.id))
            .filter(models.CaseItem.case_file_id == case_item.case_file_id)
            .scalar()
            or 0
        )
        log_operation(
            db=db,
            user_id=user.id,
            action="update_case_item",
            target_type="case_item",
            target_id=case_item.id,
            detail={
                "case_file_id": case_item.case_file_id,
                "file_name": case_file.file_name_clean,
                "case_item_id": case_item.id,
                "module": case_item.module,
                "title": case_item.title,
                "precondition": case_item.precondition,
                "steps": case_item.steps,
                "expected": case_item.expected,
                "prev_complete": bool(prev_complete),
                "next_complete": bool(next_complete),
                "before_count": int(case_count),
                "after_count": int(case_count),
            },
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用例字段重复（模块/标题/前提条件/操作步骤/预期结果）",
            )
        db.refresh(case_item)
    return case_item


@router.post(
    "/{case_file_id}/items",
    response_model=schemas.CaseItemOut,
    status_code=status.HTTP_201_CREATED,
)
def create_case_item(
    case_file_id: int,
    payload: schemas.CaseItemPayload,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case_file = _ensure_case_access(db, user, case_file_id)
    before_count = (
        db.query(func.count(models.CaseItem.id))
        .filter(models.CaseItem.case_file_id == case_file_id)
        .scalar()
        or 0
    )
    order_map = ensure_case_item_order(db, case_file_id)
    order_no = max(order_map.values() or [0]) + 1
    now = datetime.now(timezone.utc)
    case_item = models.CaseItem(
        case_file_id=case_file_id,
        module=payload.module,
        title=payload.title,
        priority=payload.priority,
        precondition=payload.precondition if payload.precondition is not None else "",
        steps=payload.steps if payload.steps is not None else "",
        expected=payload.expected,
        remark=payload.remark,
        order_no=order_no,
        created_by=user.id,
        updated_by=user.id,
        created_at=now,
        updated_at=now,
    )
    next_complete = _is_case_item_complete(
        case_item.module,
        case_item.title,
        case_item.precondition,
        case_item.steps,
        case_item.expected,
    )
    db.add(case_item)
    db.flush()
    db.query(models.CaseFile).filter(models.CaseFile.id == case_file_id).update(
        {models.CaseFile.updated_at: now, models.CaseFile.updated_by: user.id}, synchronize_session=False
    )
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
        new=_snapshot_case_item(case_item),
        meta=None,
        at=now,
    )
    log_operation(
        db=db,
        user_id=user.id,
        action="create_case_item",
        target_type="case_file",
        target_id=case_file_id,
        detail={
            "case_file_id": case_file_id,
            "file_name": case_file.file_name_clean,
            "case_item_id": case_item.id,
            "module": case_item.module,
            "title": case_item.title,
            "precondition": case_item.precondition,
            "steps": case_item.steps,
            "expected": case_item.expected,
            "next_complete": bool(next_complete),
            "before_count": int(before_count),
            "after_count": int(before_count + 1),
        },
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用例字段重复（模块/标题/前提条件/操作步骤/预期结果）",
        )
    db.refresh(case_item)
    return case_item


@router.post(
    "/{case_file_id}/items/append",
    response_model=schemas.CaseFileAppendOut,
    status_code=status.HTTP_200_OK,
)
def append_case_items(
    case_file_id: int,
    payload: schemas.CaseFileAppendRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case_file = _ensure_case_access(db, user, case_file_id)
    items = payload.items or []
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")
    overwrite_existing = bool(getattr(payload, "overwrite_existing", False))

    # 追加也要对 payload 做一次去重，避免触发唯一约束导致整批失败（与导入接口一致）。
    def _norm_key(value: str) -> str:
        if value is None:
            return ""
        try:
            return str(value).replace("\r\n", "\n").strip().lower()
        except Exception:
            return ""

    unique_items: List[schemas.CaseItemPayload] = []
    seen_keys = set()
    duplicate_count = 0
    for item in items:
        key = (
            _norm_key(item.module),
            _norm_key(item.title),
            _norm_key(getattr(item, "precondition", None)),
            _norm_key(getattr(item, "steps", None)),
            _norm_key(item.expected),
        )
        if key in seen_keys:
            duplicate_count += 1
            continue
        seen_keys.add(key)
        unique_items.append(item)
    if not unique_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用例为空")

    before_count = (
        db.query(func.count(models.CaseItem.id))
        .filter(models.CaseItem.case_file_id == case_file.id)
        .scalar()
        or 0
    )
    now = datetime.now(timezone.utc)
    # “重复”判定：模块 + 标题 + 前提条件 + 操作步骤 + 预期结果 都一致。
    def _content_key(item_payload: schemas.CaseItemPayload):
        return (
            _norm_key(item_payload.module),
            _norm_key(item_payload.title),
            _norm_key(getattr(item_payload, "precondition", None)),
            _norm_key(getattr(item_payload, "steps", None)),
            _norm_key(item_payload.expected),
        )

    existing_rows = (
        db.query(models.CaseItem)
        .filter(models.CaseItem.case_file_id == case_file.id)
        .order_by(models.CaseItem.order_no.asc(), models.CaseItem.id.asc())
        .all()
    )
    order_map = ensure_case_item_order(db, case_file.id)
    next_order = max(order_map.values() or [0]) + 1
    existing_by_content = {}
    for row in existing_rows:
        if not row:
            continue
        key = (
            _norm_key(row.module),
            _norm_key(row.title),
            _norm_key(getattr(row, "precondition", None)),
            _norm_key(getattr(row, "steps", None)),
            _norm_key(getattr(row, "expected", None)),
        )
        if not key[0] or not key[1] or not key[4]:
            continue
        bucket = existing_by_content.get(key)
        if bucket is None:
            bucket = []
            existing_by_content[key] = bucket
        bucket.append(row)

    values = []
    overwritten = 0
    overwritten_changed = 0
    skipped_existing_conflicts = 0

    for item in unique_items:
        content_key = _content_key(item)
        if not content_key[0] or not content_key[1] or not content_key[4]:
            continue
        matched = existing_by_content.get(content_key) or []
        if matched:
            if overwrite_existing:
                for row in matched:
                    if not row:
                        continue
                    changed = False
                    next_priority = item.priority
                    next_remark = item.remark
                    if row.priority != next_priority:
                        row.priority = next_priority
                        changed = True
                    if (row.remark or "") != (next_remark or ""):
                        row.remark = next_remark
                        changed = True
                    row.updated_by = user.id
                    row.updated_at = now
                    db.add(row)
                    overwritten += 1
                    if changed:
                        overwritten_changed += 1
            else:
                skipped_existing_conflicts += 1
            continue

        values.append(
            {
                "case_file_id": case_file.id,
                "module": item.module,
                "title": item.title,
                "priority": item.priority,
                "precondition": item.precondition if item.precondition is not None else "",
                "steps": item.steps if item.steps is not None else "",
                "expected": item.expected,
                "remark": item.remark,
                "order_no": next_order,
                "created_by": user.id,
                "updated_by": user.id,
                "created_at": now,
                "updated_at": now,
            }
        )
        next_order += 1

    if values:
        db.execute(sqlite_insert(models.CaseItem).values(values).prefix_with("OR IGNORE"))

    after_count = (
        db.query(func.count(models.CaseItem.id))
        .filter(models.CaseItem.case_file_id == case_file.id)
        .scalar()
        or 0
    )
    appended = max(0, int(after_count) - int(before_count))
    appended_complete = 0
    if appended > 0:
        inserted_rows = (
            db.query(models.CaseItem)
            .filter(
                models.CaseItem.case_file_id == case_file.id,
                models.CaseItem.created_by == user.id,
                models.CaseItem.created_at == now,
            )
            .all()
        )
        for row in inserted_rows or []:
            if not row:
                continue
            if _is_case_item_complete(
                row.module,
                row.title,
                row.precondition,
                row.steps,
                row.expected,
            ):
                appended_complete += 1
    skipped_db_conflicts = max(0, int(len(values)) - int(appended))

    case_file.updated_at = now
    case_file.updated_by = user.id
    db.add(case_file)

    log_case_library_change(
        db=db,
        user=user,
        project_id=case_file.project_id,
        version_id=case_file.version_id,
        file_name_clean=case_file.file_name_clean,
        case_file_id=case_file.id,
        kind="append",
        meta={
            "overwrite_existing": bool(overwrite_existing),
            "item_total": int(len(items)),
            "item_unique": int(len(unique_items)),
            "item_appended": int(appended),
            "item_appended_complete": int(appended_complete),
            "item_overwritten": int(overwritten),
            "item_overwritten_changed": int(overwritten_changed),
            "item_skipped_payload_duplicates": int(duplicate_count),
            "item_skipped_db_conflicts": int(skipped_db_conflicts),
            "item_skipped_existing_conflicts": int(skipped_existing_conflicts),
        },
        at=now,
    )
    log_operation(
        db=db,
        user_id=user.id,
        action="append_case_items",
        target_type="case_file",
        target_id=case_file.id,
        detail={
            "project_id": case_file.project_id,
            "version_id": case_file.version_id,
            "file_name": case_file.file_name_clean,
            "overwrite_existing": bool(overwrite_existing),
            "item_total": int(len(items)),
            "item_unique": int(len(unique_items)),
            "item_appended": int(appended),
            "item_appended_complete": int(appended_complete),
            "item_overwritten": int(overwritten),
            "item_overwritten_changed": int(overwritten_changed),
            "item_skipped_payload_duplicates": int(duplicate_count),
            "item_skipped_db_conflicts": int(skipped_db_conflicts),
            "item_skipped_existing_conflicts": int(skipped_existing_conflicts),
            "before_count": int(before_count),
            "after_count": int(after_count),
        },
    )
    db.commit()
    return schemas.CaseFileAppendOut(
        case_file_id=int(case_file.id),
        project_id=int(case_file.project_id),
        version_id=int(case_file.version_id) if case_file.version_id is not None else None,
        file_name_clean=str(case_file.file_name_clean or ""),
        appended=int(appended),
        overwritten=int(overwritten),
        overwritten_changed=int(overwritten_changed),
        skipped_payload_duplicates=int(duplicate_count),
        skipped_db_conflicts=int(skipped_db_conflicts),
        skipped_existing_conflicts=int(skipped_existing_conflicts),
        total_payload=int(len(items)),
        total_unique=int(len(unique_items)),
        updated_at=case_file.updated_at or now,
    )


@router.delete("/items/{case_item_id}")
def delete_case_item(
    case_item_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case_item = db.query(models.CaseItem).filter(models.CaseItem.id == case_item_id).first()
    if not case_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用例不存在")
    case_file = _ensure_case_access(db, user, case_item.case_file_id)
    before_count = (
        db.query(func.count(models.CaseItem.id))
        .filter(models.CaseItem.case_file_id == case_item.case_file_id)
        .scalar()
        or 0
    )
    prev_complete = _is_case_item_complete(
        case_item.module,
        case_item.title,
        case_item.precondition,
        case_item.steps,
        case_item.expected,
    )
    prev_delete_complete = _is_case_item_delete_complete(
        case_item.title,
        case_item.precondition,
        case_item.steps,
        case_item.expected,
    )
    old_snap = _snapshot_case_item(case_item)
    now = datetime.now(timezone.utc)
    log_case_library_change(
        db=db,
        user=user,
        project_id=case_file.project_id,
        version_id=case_file.version_id,
        file_name_clean=case_file.file_name_clean,
        case_file_id=case_file.id,
        case_item_id=case_item.id,
        kind="deleted",
        old=old_snap,
        new=None,
        meta=None,
        at=now,
    )
    db.delete(case_item)
    db.query(models.CaseFile).filter(models.CaseFile.id == case_item.case_file_id).update(
        {models.CaseFile.updated_at: now, models.CaseFile.updated_by: user.id}, synchronize_session=False
    )
    log_operation(
        db=db,
        user_id=user.id,
        action="delete_case_item",
        target_type="case_item",
        target_id=case_item_id,
        detail={
            "case_file_id": case_item.case_file_id,
            "file_name": case_file.file_name_clean,
            "case_item_id": case_item.id,
            "module": case_item.module,
            "title": case_item.title,
            "precondition": case_item.precondition,
            "steps": case_item.steps,
            "expected": case_item.expected,
            "prev_complete": bool(prev_complete),
            "prev_delete_complete": bool(prev_delete_complete),
            "before_count": int(before_count),
            "after_count": int(max(before_count - 1, 0)),
        },
    )
    db.commit()
    return {"detail": "用例已删除"}


@router.get("/change-history/files", response_model=List[schemas.CaseLibraryChangeFileOut])
def list_case_library_change_files(
    project_id: int,
    version_id: Optional[int] = None,
    q: Optional[str] = None,
    limit: int = 200,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_project_access(db, user, project_id)
    if version_id is not None and int(version_id) != 0:
        ensure_version_in_project(db, project_id, int(version_id))
    max_limit = 500
    resolved_limit = int(limit or 0)
    if resolved_limit <= 0:
        resolved_limit = 200
    if resolved_limit > max_limit:
        resolved_limit = max_limit

    # 仅展示“发生改动”的用例：过滤 view 类事件，避免刷屏。
    events = (
        db.query(models.CaseLibraryChangeEvent)
        .filter(models.CaseLibraryChangeEvent.project_id == project_id)
        .filter(models.CaseLibraryChangeEvent.kind != "view")
        .order_by(models.CaseLibraryChangeEvent.created_at.desc())
        .limit(8000)
        .all()
    )
    latest_by_key = {}
    total_by_key = {}
    latest_import_by_key = {}
    for ev in events:
        file_name_clean = str(ev.file_name_clean or "")
        if not file_name_clean:
            continue
        key = (
            int(ev.case_file_id)
            if ev.case_file_id is not None
            else ("n", file_name_clean, int(ev.version_id) if ev.version_id is not None else None)
        )
        if key not in latest_by_key:
            latest_by_key[key] = ev
        total_by_key[key] = int(total_by_key.get(key, 0) or 0) + 1
        if ev.kind in ("import", "reimport") and key not in latest_import_by_key:
            latest_import_by_key[key] = ev

    if not latest_by_key:
        return []

    current_files = (
        db.query(models.CaseFile)
        .filter(models.CaseFile.project_id == project_id)
        .all()
    )
    current_map = {}
    user_ids = set()
    for cf in current_files:
        if not cf:
            continue
        file_key = str(cf.file_name_clean or "")
        if not file_key:
            continue
        current_map[int(cf.id)] = cf
        # 兼容：极少数历史变更事件缺少 case_file_id 时，按 (name,version) 回落匹配。
        current_map[("n", file_key, int(cf.version_id) if cf.version_id is not None else None)] = cf
        if cf.importer_id is not None:
            user_ids.add(int(cf.importer_id))
        if cf.updated_by is not None:
            user_ids.add(int(cf.updated_by))

    user_name_by_id = {}
    if user_ids:
        for u in db.query(models.User).filter(models.User.id.in_(list(user_ids))).all():
            if not u:
                continue
            user_name_by_id[int(u.id)] = str(u.username)

    rows = []
    q_text = str(q or "").strip().lower()
    resolved_version_id = None
    if version_id is not None and int(version_id) != 0:
        resolved_version_id = int(version_id)
    for k, ev in latest_by_key.items():
        file_name_clean = str(ev.file_name_clean or "")
        cf = current_map.get(k)
        is_deleted = cf is None
        derived_version_id = (
            int(cf.version_id) if (cf and cf.version_id is not None) else (int(ev.version_id) if ev.version_id is not None else None)
        )
        if resolved_version_id is not None:
            if derived_version_id is None or int(derived_version_id) != resolved_version_id:
                continue
        if q_text and q_text not in str(file_name_clean).lower():
            continue
        importer_name = None
        imported_at = None
        last_updated_by_name = None
        updated_at = None
        if cf:
            if cf.importer_id is not None:
                importer_name = user_name_by_id.get(int(cf.importer_id))
            imported_at = cf.imported_at
            if cf.updated_by is not None:
                last_updated_by_name = user_name_by_id.get(int(cf.updated_by))
            updated_at = cf.updated_at
        else:
            import_ev = latest_import_by_key.get(file_name_clean)
            if import_ev:
                importer_name = str(import_ev.operator_name) if import_ev.operator_name else None
                imported_at = import_ev.created_at
            last_updated_by_name = str(ev.operator_name) if ev.operator_name else None
            updated_at = ev.created_at
        rows.append(
            schemas.CaseLibraryChangeFileOut(
                project_id=int(project_id),
                file_name_clean=file_name_clean,
                case_file_id=(int(cf.id) if cf else (int(ev.case_file_id) if ev.case_file_id is not None else None)),
                version_id=derived_version_id,
                is_deleted=bool(is_deleted),
                last_changed_at=ev.created_at,
                last_operator=(str(ev.operator_name) if ev.operator_name else None),
                importer_name=importer_name,
                imported_at=imported_at,
                last_updated_by_name=last_updated_by_name,
                updated_at=updated_at,
                total_events=int(total_by_key.get(k, 0) or 0),
            )
        )

    rows.sort(key=lambda r: r.last_changed_at, reverse=True)
    return rows[:resolved_limit]


@router.get("/change-history", response_model=schemas.CaseLibraryChangeHistoryOut)
def get_case_library_change_history(
    project_id: int,
    file_name_clean: str,
    version_id: Optional[int] = None,
    limit: int = 500,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_project_access(db, user, project_id)
    resolved_version_id = None
    if version_id is not None and int(version_id) != 0:
        resolved_version_id = int(version_id)
        ensure_version_in_project(db, project_id, resolved_version_id)
    name = str(file_name_clean or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file_name_clean 不能为空")
    max_limit = 2000
    resolved_limit = int(limit or 0)
    if resolved_limit <= 0:
        resolved_limit = 500
    if resolved_limit > max_limit:
        resolved_limit = max_limit

    case_file_q = db.query(models.CaseFile).filter(
        models.CaseFile.project_id == project_id, models.CaseFile.file_name_clean == name
    )
    if resolved_version_id is not None:
        case_file_q = case_file_q.filter(models.CaseFile.version_id == resolved_version_id)
    case_file = case_file_q.first()
    is_deleted = case_file is None

    events_q = (
        db.query(models.CaseLibraryChangeEvent)
        .filter(models.CaseLibraryChangeEvent.project_id == project_id)
        .filter(models.CaseLibraryChangeEvent.file_name_clean == name)
    )
    if resolved_version_id is not None:
        events_q = events_q.filter(models.CaseLibraryChangeEvent.version_id == resolved_version_id)
    events = (
        events_q.filter(models.CaseLibraryChangeEvent.kind != "view")
        .order_by(models.CaseLibraryChangeEvent.created_at.desc())
        .limit(resolved_limit)
        .all()
    )
    history = []
    for ev in events:
        old_snap = ev.old_json if isinstance(ev.old_json, dict) else None
        new_snap = ev.new_json if isinstance(ev.new_json, dict) else None
        meta = ev.meta_json if isinstance(ev.meta_json, dict) else None
        changed_fields = []
        if meta and isinstance(meta.get("changed_fields"), list):
            changed_fields = [str(x) for x in meta.get("changed_fields") if x is not None]
        elif old_snap is not None and new_snap is not None:
            changed_fields = _compute_changed_fields(old_snap or {}, new_snap or {})
        history.append(
            schemas.CaseLibraryChangeEntryOut(
                id=int(ev.id),
                kind=str(ev.kind or ""),
                changed_at=ev.created_at,
                operator=(str(ev.operator_name) if ev.operator_name else None),
                changed_fields=changed_fields,
                old=old_snap,
                new=new_snap,
                meta=meta,
            )
        )

    version_id = None
    case_file_id = None
    if case_file:
        case_file_id = int(case_file.id)
        version_id = int(case_file.version_id) if case_file.version_id is not None else None
    else:
        if events:
            version_id = int(events[0].version_id) if events[0].version_id is not None else None
            case_file_id = int(events[0].case_file_id) if events[0].case_file_id is not None else None
    return schemas.CaseLibraryChangeHistoryOut(
        project_id=int(project_id),
        file_name_clean=name,
        case_file_id=case_file_id,
        version_id=version_id,
        is_deleted=bool(is_deleted),
        history=history,
    )
