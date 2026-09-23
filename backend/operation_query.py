"""Bounded audit queries shared by the web UI and MCP. No full JSON in list queries."""
import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Float, String, and_, case, cast, func, literal, or_

from . import models

Log = models.OperationLog
ACTION_LABELS = {
    'login': '登录', 'logout': '登出', 'change_password': '修改密码',
    'import_case_file': '用例库页面入库', 'overwrite_case_file': '覆盖入库',
    'delete_case_file': '删除', 'change_case_file_version': '更换版本', 'append_case_items': '追加',
    'create_exec_set': '执行页面入库', 'upsert_exec_set_from_case_file': '转执行',
    'archive_exec_set': '归档', 'delete_exec_set': '直接解散', 'delete_exec_archive': '删除归档',
    'dissolve_exec_archived_placeholders': '解散归档', 'change_case_reuse_type': '用例类型变更',
    'export_case_files_xmind': '导出xmind', 'export_case_files_excel': '导出excel',
    'export_exec_xmind': '导出xmind（含结果）', 'export_exec_snapshot': '导出excel（含结果）',
    'export_cases_xmind': '导出xmind', 'update_exec_case': '执行记录变更', 'exec_case_run': '执行用例',
    'create_case_file_association': '关联用例', 'update_case_file_association': '编辑关联',
    'delete_case_file_association': '取消关联', 'create_case_item': '新增', 'update_case_item': '修改',
    'delete_case_item': '删除', 'batch_create_case_items': '批量新增', 'batch_delete_case_items': '批量删除',
    'create_missing_case_item': '新增', 'update_missing_case_item': '修改', 'delete_missing_case_item': '删除',
    'create_missing_module': '新增漏测模块', 'update_missing_module': '修改漏测模块', 'delete_missing_module': '删除漏测模块',
    'export_case_template_xmind': '导出xmind', 'export_case_template_excel': '导出excel',
    'create_project': '新增', 'update_project': '编辑项目', 'delete_project': '删除',
    'create_version': '新增版本', 'delete_version': '删除', 'create_user': '新增',
    'delete_user': '删除', 'update_user': '编辑', 'assign_projects': '分配权限', 'reset_password': '重置密码',
    'mcp_tool_call': 'MCP 调用', 'create_mcp_token': '创建 MCP 凭据', 'revoke_mcp_token': '撤销 MCP 凭据',
    'register_knowledge_source': '登记知识库', 'disable_knowledge_source': '停用知识库',
    'update_settings': '修改设置', 'add_exec_cases': '追加执行用例',
    'add_exec_reuse_presets': '新增复用子项', 'update_exec_reuse_presets': '配置复用解锁方式',
    'quick_execute_reuse': '复用快速执行', 'apply_reuse_applicability': '应用复用适用性',
}
# 筛选项脱离具体记录展示时，补齐对象名称，避免多个“删除/新增”无法区分。
FILTER_LABELS = {
    'create_case_item': '新增用例', 'update_case_item': '修改用例', 'delete_case_item': '删除用例',
    'create_missing_case_item': '新增易漏用例', 'update_missing_case_item': '修改易漏用例', 'delete_missing_case_item': '删除易漏用例',
    'delete_case_file': '删除用例文件', 'create_project': '新增项目', 'delete_project': '删除项目',
    'delete_version': '删除版本', 'create_user': '新增人员', 'update_user': '编辑人员', 'delete_user': '删除人员',
    'export_case_files_xmind': '用例库导出xmind', 'export_case_files_excel': '用例库导出excel',
    'export_cases_xmind': '生成用例导出xmind', 'export_case_template_xmind': '模板导出xmind', 'export_case_template_excel': '模板导出excel',
}
TARGET_GROUPS = {
    'platform': ['login', 'logout', 'change_password', 'update_settings', 'mcp_tool_call', 'create_mcp_token', 'revoke_mcp_token'],
    'case': ['import_case_file', 'overwrite_case_file', 'delete_case_file', 'change_case_file_version', 'append_case_items',
             'create_exec_set', 'upsert_exec_set_from_case_file', 'archive_exec_set', 'delete_exec_set', 'delete_exec_archive',
             'dissolve_exec_archived_placeholders', 'change_case_reuse_type', 'export_case_files_xmind', 'export_case_files_excel',
             'export_exec_xmind', 'export_exec_snapshot', 'export_cases_xmind', 'exec_case_run', 'update_exec_case',
             'create_case_file_association', 'update_case_file_association', 'delete_case_file_association',
             'create_missing_module', 'update_missing_module', 'delete_missing_module', 'add_exec_cases',
             'add_exec_reuse_presets', 'update_exec_reuse_presets', 'quick_execute_reuse', 'apply_reuse_applicability'],
    'case_item': ['create_case_item', 'update_case_item', 'delete_case_item', 'create_missing_case_item',
                  'update_missing_case_item', 'delete_missing_case_item', 'batch_create_case_items', 'batch_delete_case_items'],
    'case_template': ['export_case_template_xmind', 'export_case_template_excel'],
    'project': ['create_project', 'update_project', 'delete_project', 'create_version', 'register_knowledge_source', 'disable_knowledge_source'],
    'version': ['create_version', 'delete_version'],
    'user': ['create_user', 'delete_user', 'update_user', 'assign_projects', 'reset_password'],
}


class LogFilter(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    start_ms: Optional[int] = Field(default=None, ge=0)
    end_ms: Optional[int] = Field(default=None, ge=0)
    user_id: Optional[int] = Field(default=None, gt=0)
    actions: List[str] = Field(default_factory=list, max_length=100)
    target_groups: List[Literal['platform', 'case', 'case_item', 'case_template', 'project', 'version', 'user']] = Field(default_factory=list, max_length=8)
    target_type: Optional[str] = Field(default=None, max_length=64)
    target_id: Optional[int] = Field(default=None, gt=0)
    result: Optional[Literal['success', 'failed']] = None
    exclude_auto: bool = True


class LogPage(LogFilter):
    limit: int = Field(default=20, ge=1, le=100)
    cursor: Optional[str] = Field(default=None, max_length=1024)


class LogSummary(LogFilter):
    view: Literal['activity', 'contribution', 'execContribution'] = 'activity'
    user_ids: List[int] = Field(min_length=1, max_length=100)


class LogDetail(BaseModel):
    model_config = ConfigDict(extra='forbid')
    log_id: int = Field(gt=0, le=9223372036854775807)
    offset: int = Field(default=0, ge=0, le=2147483647)
    limit: int = Field(default=6000, ge=1, le=12000)


def require_log_admin(user):
    if user.role != 'admin':
        raise HTTPException(403, '仅管理员可查看操作记录')


def json_field(key):
    return func.json_extract(Log.detail, '$.' + key)


def time_bounds(filters, frozen=None):
    try:
        end = datetime.fromtimestamp(filters.end_ms / 1000, timezone.utc) if filters.end_ms is not None else (frozen or datetime.now(timezone.utc))
        start = datetime.fromtimestamp(filters.start_ms / 1000, timezone.utc) if filters.start_ms is not None else end - timedelta(days=7)
    except (ValueError, OverflowError, OSError):
        raise HTTPException(400, '日期超出有效范围')
    if start > end:
        raise HTTPException(400, '结束日期不能早于开始日期')
    if end - start > timedelta(days=366):
        raise HTTPException(400, '单次查询最多 366 天，请缩小日期范围')
    return start, end


def filter_query(db, filters, bounds):
    q = db.query(Log).filter(Log.created_at >= bounds[0], Log.created_at <= bounds[1])
    if filters.user_id is not None:
        q = q.filter(Log.user_id == filters.user_id)
    if filters.actions:
        if any(not v or len(v) > 64 for v in filters.actions):
            raise HTTPException(400, '操作类型无效')
        q = q.filter(Log.action.in_(filters.actions))
    if filters.target_groups:
        actions = {a for group in filters.target_groups for a in TARGET_GROUPS[group]}
        q = q.filter(Log.action.in_(actions))
    if filters.target_type:
        q = q.filter(Log.target_type == filters.target_type)
    if filters.target_id is not None:
        q = q.filter(Log.target_id == filters.target_id)
    if filters.result:
        q = q.filter(Log.result == filters.result)
    if filters.exclude_auto:
        q = q.filter(~Log.action.startswith('sync_', autoescape=True), ~Log.action.startswith('auto_', autoescape=True),
                     func.coalesce(json_field('auto'), 0) != 1)
    return q


# Scalars only. No payloads, old/new snapshots, full steps or model/settings secrets.
TEXT_KEYS = ['page', 'name', 'file_name', 'case_file_name', 'file_name_clean', 'exec_set_name', 'project_name', 'version_name',
             'username', 'module_name', 'title', 'source', 'tool', 'status', 'association_target_label']
NUMBER_KEYS = ['case_file_id', 'exec_set_id', 'project_id', 'before_count', 'after_count', 'count', 'transfer_count',
               'new_cases', 'item_imported', 'item_deleted_total', 'modified_count', 'reuse_enabled', 'after_reuse_enabled', 'association_enabled', 'overwrite']


def summary_columns():
    return [Log.id, Log.user_id, Log.action, Log.target_type, Log.target_id, Log.result, Log.created_at,
            *[func.substr(cast(json_field(k), String), 1, 160).label(k) for k in TEXT_KEYS],
            *[case((func.json_type(Log.detail, '$.' + k).in_(['integer', 'real', 'true', 'false']), json_field(k)), else_=None).label(k) for k in NUMBER_KEYS]]


def summarize_rows(db, rows):
    ids = {r.user_id for r in rows if r.user_id}
    names = dict(db.query(models.User.id, models.User.username).filter(models.User.id.in_(ids)).all()) if ids else {}
    results = []
    for row in rows:
        mapping = row._mapping
        detail = {k: mapping[k] for k in TEXT_KEYS + NUMBER_KEYS if mapping[k] is not None}
        for k in ('reuse_enabled', 'after_reuse_enabled', 'association_enabled', 'overwrite'):
            if k in detail:
                detail[k] = detail[k] in (1, True, 'true')
        label = ACTION_LABELS.get(row.action, row.action)
        if row.action in ('batch_create_case_items', 'batch_delete_case_items') and detail.get('count', 0) > 0:
            label += str(int(detail['count'])) + '条'
        if row.action == 'import_case_file':
            label = '覆盖入库' if detail.get('overwrite') else '执行页面入库' if detail.get('source') == 'tempexec' else label
        results.append({'id': row.id, 'user_id': row.user_id, 'username': names.get(row.user_id), 'action': row.action,
                        'action_label': label, 'target_type': row.target_type, 'target_id': row.target_id,
                        'result': row.result, 'created_at': row.created_at, 'detail': detail, 'detail_available': True})
    return results


def list_logs(db, user, filters: LogPage):
    require_log_admin(user)
    signature = hashlib.sha256(json.dumps(filters.model_dump(exclude={'cursor', 'limit'}), sort_keys=True).encode()).hexdigest()[:24]
    cursor = None
    if filters.cursor:
        try:
            cursor = json.loads(base64.urlsafe_b64decode(filters.cursor.encode()))
            if cursor['query'] != signature:
                raise ValueError()
            bounds = tuple(datetime.fromisoformat(cursor[k]) for k in ('start', 'end'))
            previous = datetime.fromisoformat(cursor['time'])
            previous_id = int(cursor['id'])
            snapshot_id = int(cursor['snapshot'])
            if bounds[0] > bounds[1] or bounds[1] - bounds[0] > timedelta(days=366):
                raise ValueError()
            if not (0 < previous_id <= snapshot_id <= 9223372036854775807):
                raise ValueError()
        except (ValueError, KeyError, TypeError, UnicodeDecodeError):
            raise HTTPException(400, '分页游标无效或筛选条件已变更，请重新查询')
    else:
        bounds = time_bounds(filters)
        snapshot_id = db.query(func.max(Log.id)).scalar() or 0
    q = filter_query(db, filters, bounds).filter(Log.id <= snapshot_id)
    if cursor:
        q = q.filter(or_(Log.created_at < previous, and_(Log.created_at == previous, Log.id < previous_id)))
    rows = q.with_entities(*summary_columns()).order_by(Log.created_at.desc(), Log.id.desc()).limit(filters.limit + 1).all()
    has_more = len(rows) > filters.limit
    rows = rows[:filters.limit]
    next_cursor = None
    if has_more:
        payload = {'query': signature, 'start': bounds[0].isoformat(), 'end': bounds[1].isoformat(),
                   'time': rows[-1].created_at.isoformat(), 'id': rows[-1].id, 'snapshot': snapshot_id}
        next_cursor = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return {'items': summarize_rows(db, rows), 'next_cursor': next_cursor, 'has_more': has_more,
            'range': {'start_ms': int(bounds[0].timestamp() * 1000), 'end_ms': int(bounds[1].timestamp() * 1000)},
            'action_options': [{'key': k, 'label': FILTER_LABELS.get(k, v)} for k, v in ACTION_LABELS.items()]}


def get_log_detail(db, user, request: LogDetail):
    require_log_admin(user)
    raw = cast(Log.detail, String)
    row = db.query(Log.id, Log.action, Log.created_at, func.substr(raw, request.offset + 1, request.limit).label('chunk'),
                   func.length(raw).label('total')).filter(Log.id == request.log_id).first()
    if row is None:
        raise HTTPException(404, '操作记录不存在')
    total = row.total or 0
    end = min(total, request.offset + request.limit)
    return {'id': row.id, 'action': row.action, 'created_at': row.created_at, 'detail_text': row.chunk or '',
            'offset': request.offset, 'total_chars': total, 'next_offset': end if end < total else None}


def _positive(key):
    value = cast(json_field(key), String)
    number = cast(value, Float)
    return case((number > 0, number), else_=0)


def _boolean(key):
    value = json_field(key)
    return case((value.in_([1, 'true', 'True']), True), (value.in_([0, 'false', 'False']), False), else_=None)


def _clean(key):
    value = func.coalesce(cast(json_field(key), String), '')
    for char in ('\u200b', '\u200c', '\u200d', '\u2060', '\ufeff'):
        value = func.replace(value, char, '')
    return func.trim(value, ' \t\n\r')


def summarize_logs(db, user, filters: LogSummary):
    """Aggregate in SQLite; preserve the existing contribution completeness/dedup rules."""
    require_log_admin(user)
    bounds = time_bounds(filters)
    if any(i <= 0 for i in filters.user_ids):
        raise HTTPException(400, '人员 ID 无效')
    q = filter_query(db, filters, bounds).filter(Log.user_id.in_(filters.user_ids))
    rows = []
    action = Log.action
    if filters.view == 'activity':
        label = case((and_(action == 'import_case_file', json_field('overwrite') == 1), '覆盖入库'),
                     (and_(action == 'import_case_file', json_field('source') == 'tempexec'), '执行页面入库'),
                     *[(action == key, value) for key, value in ACTION_LABELS.items() if key != 'update_exec_case'], else_=None)
        # Original activity excludes the synthetic execution list entries and per-item batch duplicates.
        q = q.filter(~and_(action.in_(['create_case_item', 'delete_case_item']), func.coalesce(json_field('batch'), 0) == 1))
        rows = q.with_entities(Log.user_id, label.label('key'), func.count().label('count')).filter(label.isnot(None)).group_by(Log.user_id, label).all()
    elif filters.view == 'contribution':
        complete = and_(*[_clean(k) != '' for k in ('module', 'title', 'precondition', 'steps', 'expected')])
        delete_complete = and_(*[_clean(k) != '' for k in ('title', 'precondition', 'steps', 'expected')])
        created = func.coalesce(_boolean('next_complete'), _boolean('complete'), complete)
        deleted = func.coalesce(_boolean('prev_delete_complete'), _boolean('prev_complete'), _boolean('complete'), delete_complete)
        newly_complete = and_(_boolean('prev_complete') == 0, func.coalesce(_boolean('next_complete'), complete) == 1)
        key = case((action.in_(['import_case_file', 'overwrite_case_file']), 'import'),
                   (action == 'append_case_items', 'add'), (and_(action == 'create_case_item', created == 1), 'add'),
                   (and_(action == 'update_case_item', newly_complete), 'add'),
                   (and_(action == 'delete_case_item', deleted == 1), 'delete'), (action == 'delete_case_file', 'delete'),
                   (action == 'create_missing_case_item', 'add'), (action == 'update_missing_case_item', 'edit'),
                   (action == 'delete_missing_case_item', 'delete'), else_=None)
        value = case((action.in_(['import_case_file', 'overwrite_case_file']), func.coalesce(func.nullif(_positive('item_imported'), 0), _positive('item_unique'))),
                     (action == 'append_case_items', func.coalesce(func.nullif(_positive('item_appended_complete'), 0), _positive('item_appended'))),
                     (action == 'delete_case_file', _positive('item_deleted_complete')), else_=1)
        rows = q.with_entities(Log.user_id, key.label('key'), func.sum(value).label('count')).filter(key.isnot(None)).group_by(Log.user_id, key).all()
    else:
        changed = func.coalesce(cast(json_field('changed_fields'), String), '')
        executed = or_(changed.contains('status'), changed.contains('actual_result'),
                       ~func.lower(_clean('status')).in_(['', 'pending', '未执行', '变更重跑', '有改动']), _clean('actual_result') != '')
        # MCP result-only events have stable case IDs; older UI events use their existing structural signature.
        identity = _clean('exec_set_id') + literal('::') + _clean('module') + literal('::') + _clean('title') + literal('::') + _clean('precondition') + literal('::') + _clean('steps') + literal('::') + _clean('expected')
        identity = case((json_field('result_only') == 1, literal('id:') + cast(Log.target_id, String)), else_=identity)
        exec_rows = q.filter(action == 'update_exec_case', executed).with_entities(Log.user_id, func.count(func.distinct(identity))).group_by(Log.user_id).all()
        archive_rows = q.filter(action == 'archive_exec_set').with_entities(Log.user_id, func.sum(_positive('actual_result_count'))).group_by(Log.user_id).all()
        rows = [(uid, 'exec', count) for uid, count in exec_rows] + [(uid, 'archive', count) for uid, count in archive_rows]
    names = dict(db.query(models.User.id, models.User.username).filter(models.User.id.in_(filters.user_ids)).all())
    return {'items': [{'user_id': uid, 'username': names.get(uid, '用户#' + str(uid)), 'key': key, 'count': count}
                      for uid, key, count in rows if count], 'range': {'start_ms': int(bounds[0].timestamp()*1000), 'end_ms': int(bounds[1].timestamp()*1000)}}
