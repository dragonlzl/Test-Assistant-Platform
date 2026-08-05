(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.opsLogAuditModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  var overviewModel = null;
  var formatTime = function(value) { return value ? String(value) : '--'; };

  function configure(options) {
    var opts = options && typeof options === 'object' ? options : {};
    overviewModel = opts.overviewModel || null;
    if (typeof opts.formatTime === 'function') formatTime = opts.formatTime;
  }

  function normalizeAction(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getSettingsKeyLabel(key) {
    var k = String(key || '').trim();
    if (!k) return '';
    if (k === 'tempExecPageSize') return '全局分页设置';
    if (k === 'feishuWebhook') return '飞书 Webhook';
    if (k === 'feishuMention') return '@角色ID';
    if (k === 'missingCaseReminderPlacement') return '易漏用例提醒区域';
    if (k === 'missingCaseReminderMatchConfig') return '易漏用例命中设定';
    if (k === 'missingCaseReminderAiEnabled') return '易漏用例推荐（大模型）';
    if (k === 'projectOrder') return '项目排序';
    if (k === 'defaultProjectId') return '默认项目';
    return k;
  }

  function formatSettingsItemLabel(item) {
    if (!item || typeof item !== 'object') return '';
    var key = String(item.key || '').trim();
    if (!key) return '';
    var label = getSettingsKeyLabel(key);
    // 仅对少量“无敏感信息且对排查有价值”的设置展示值。
    if (key === 'tempExecPageSize') {
      var n = Number(item.value_json);
      if (Number.isFinite(n) && n > 0) return label + '=' + n;
      return label;
    }
    return label;
  }

  function buildTargetLabel(log) {
    var l = log && typeof log === 'object' ? log : null;
    if (!l) return '--';
    var type = normalizeAction(l.target_type);
    var id = (l.target_id || l.target_id === 0) ? String(l.target_id) : '';
    var detail = l.detail && typeof l.detail === 'object' ? l.detail : {};
    var action = normalizeAction(l.action);

    if (action === 'create_case_file_association' || action === 'update_case_file_association' || action === 'delete_case_file_association') {
      var associationTargetLabel = String(detail.association_target_label || '').trim();
      if (associationTargetLabel) return associationTargetLabel;

      var mainCaseNameAssoc = String(
        detail.main_case_file_name || detail.file_name || detail.case_file_name || ''
      ).trim();
      if (!mainCaseNameAssoc) {
        var mainCaseIdAssoc =
          detail.main_case_file_id || detail.main_case_file_id === 0
            ? String(detail.main_case_file_id)
            : '';
        if (mainCaseIdAssoc) mainCaseNameAssoc = '主用例#' + mainCaseIdAssoc;
      }

      var associationSnapshotAfter = String(detail.association_snapshot_after || '').trim();
      if (!associationSnapshotAfter && mainCaseNameAssoc) {
        associationSnapshotAfter = mainCaseNameAssoc;
      }

      if (action === 'create_case_file_association') {
        if (associationSnapshotAfter) return '关联用例：' + associationSnapshotAfter;
        return '关联用例';
      }

      if (action === 'update_case_file_association') {
        if (associationSnapshotAfter) return '编辑关联：' + associationSnapshotAfter;
        return '编辑关联';
      }

      var removedSubCaseName = String(
        detail.association_removed_sub_case_name || detail.sub_case_file_name || ''
      ).trim();
      if (!removedSubCaseName) {
        var removedSubCaseId =
          detail.sub_case_file_id || detail.sub_case_file_id === 0
            ? String(detail.sub_case_file_id)
            : '';
        if (removedSubCaseId) removedSubCaseName = '副用例#' + removedSubCaseId;
      }

      var removedCount = Number(detail.association_removed_selected_count);
      if (!Number.isFinite(removedCount) || removedCount < 0) {
        removedCount = Number(detail.selected_count);
      }
      if (!Number.isFinite(removedCount) || removedCount < 0) {
        removedCount = 0;
      }
      removedCount = Math.floor(removedCount);

      var removedLabel = removedSubCaseName ? removedSubCaseName + String(removedCount) + '条' : '';
      if (associationSnapshotAfter && removedLabel) {
        return '取消关联：' + associationSnapshotAfter + '-' + removedLabel;
      }
      if (associationSnapshotAfter) return '取消关联：' + associationSnapshotAfter;
      return '取消关联';
    }

    // 系统平台
    if (action === 'login' || action === 'logout' || action === 'change_password') return '系统平台';
    if (action === 'exec_case_run') {
      var execFileName = String(detail.case_file_name || detail.file_name || detail.exec_set_name || '').trim();
      var execTitle = String(detail.case_title || detail.case_name || detail.title || '').trim();
      var reuseFlag = String(detail.case_type || detail.reuse_type || '').trim().toLowerCase() === 'reuse';
      if (!reuseFlag) {
        var reuseTotal = Number(detail.reuse_total_count);
        if (Number.isFinite(reuseTotal) && reuseTotal > 0) reuseFlag = true;
      }
      var suffix = reuseFlag ? '（复）' : '';
      if (execFileName) return '用例：' + execFileName + suffix;
      if (execTitle) return '用例：' + execTitle + suffix;
      return '用例' + suffix;
    }

    // 解散归档占位（执行页版本盒子）
    if (action === 'dissolve_exec_archived_placeholders') {
      var nameList = [];
      if (Array.isArray(detail.file_names)) nameList = detail.file_names;
      else if (Array.isArray(detail.case_names)) nameList = detail.case_names;
      nameList = nameList.map(function(v) { return String(v || '').trim(); }).filter(Boolean);
      if (nameList.length) {
        var shown0 = nameList.slice(0, 3);
        var suffix0 = nameList.length > shown0.length ? (' 等（' + nameList.length + ' 份）') : '';
        return '用例：' + shown0.join('、') + suffix0;
      }
      var singleName0 = String(detail.file_name || detail.case_file_name || '').trim();
      if (singleName0) return '用例：' + singleName0;
      var projName0 = String(detail.project_name || '').trim();
      var verName0 = String(detail.version_name || detail.name || '').trim();
      var label0 = (projName0 || verName0) ? (projName0 + verName0) : '';
      var cnt0 = Number(detail.count);
      if (!Number.isFinite(cnt0) || cnt0 <= 0) cnt0 = 0;
      if (label0) return '用例：归档占位（' + label0 + '）';
      if (cnt0) return '用例：归档占位（' + cnt0 + ' 份）';
      return '用例：归档占位';
    }

    // 用例模版
    if (type === 'case_template' || action.indexOf('export_case_template_') === 0) return '用例模版';

    // 人员
    if (type === 'user') {
      var userName = String(detail.username || '').trim();
      if (userName) return '人员：' + userName;
      return id ? ('人员#' + id) : '人员';
    }

    // 项目
    if (type === 'project') {
      var projectName = String(detail.name || detail.project_name || '').trim();
      if (projectName) return '项目：' + projectName;
      return id ? ('项目#' + id) : '项目';
    }

    // 新增版本：倾向展示为“项目”，便于在项目维度回溯。
    if (action === 'create_version') {
      var projectId = (detail.project_id || detail.project_id === 0) ? String(detail.project_id) : '';
      var projName = String(detail.project_name || '').trim();
      var verName = String(detail.name || '').trim();
      var base = projName ? ('项目：' + projName) : (projectId ? ('项目#' + projectId) : '项目');
      if (verName) return base + '（版本：' + verName + '）';
      return base;
    }

    // 版本
    if (type === 'project_version' || action === 'delete_version') {
      var projectName2 = String(detail.project_name || '').trim();
      var versionName = String(detail.version_name || detail.name || '').trim();
      if (action === 'delete_version' && (projectName2 || versionName)) {
        return '版本 ' + (projectName2 + versionName);
      }
      if (versionName) return '版本：' + versionName;
      return id ? ('版本#' + id) : '版本';
    }

    // 用例（子项）：优先用 action 判断，避免 create_case_item 的 target_type=case_file 导致误判。
    if (
      action === 'create_missing_case_item' ||
      action === 'update_missing_case_item' ||
      action === 'delete_missing_case_item' ||
      action === 'create_missing_module' ||
      action === 'update_missing_module' ||
      action === 'delete_missing_module'
    ) {
      var missingModuleName = String(detail.module_name || '').trim();
      if (missingModuleName) return '用例：' + missingModuleName + '（模块）';
      var missingModuleId = (detail.module_id || detail.module_id === 0) ? String(detail.module_id) : id;
      if (missingModuleId) return '用例#' + missingModuleId + '（模块）';
      return '用例（模块）';
    }
    if (
      action === 'update_case_item' ||
      action === 'create_case_item' ||
      action === 'delete_case_item' ||
      action === 'batch_create_case_items' ||
      action === 'batch_delete_case_items'
    ) {
      var fileNameChild = String(detail.file_name || detail.case_file_name || detail.file_name_clean || '').trim();
      if (fileNameChild) return '用例：' + fileNameChild + '（子项）';
      var cfid = (detail.case_file_id || detail.case_file_id === 0) ? String(detail.case_file_id) : '';
      if (cfid) return '用例#' + cfid + '（子项）';
      return id ? ('用例#' + id + '（子项）') : '用例（子项）';
    }

    // 用例（文件）
    if (type === 'case_file') {
      var fileName = String(detail.file_name || detail.file_name_clean || '').trim();
      if (fileName) return '用例：' + fileName;
      var fileNames = Array.isArray(detail.file_names) ? detail.file_names : [];
      fileNames = fileNames.map(function(v) { return String(v || '').trim(); }).filter(Boolean);
      if (fileNames.length) {
        var shown = fileNames.slice(0, 3);
        var suffix = fileNames.length > shown.length ? (' 等（' + fileNames.length + ' 份）') : '';
        return '用例：' + shown.join('、') + suffix;
      }
      return id ? ('用例#' + id) : '用例';
    }
    if (type === 'case_item') {
      var fileName2 = String(detail.file_name || detail.file_name_clean || '').trim();
      if (fileName2) return '用例：' + fileName2;
      var caseFileId = (detail.case_file_id || detail.case_file_id === 0) ? String(detail.case_file_id) : '';
      if (caseFileId) return '用例#' + caseFileId;
      return '用例';
    }
    if (type === 'exec_set') {
      var fileName3 = String(detail.case_file_name || detail.file_name || detail.file_name_clean || '').trim();
      if (!fileName3) fileName3 = String(detail.exec_set_name || detail.name || '').trim();
      var associationSuffix = '';
      if (action === 'upsert_exec_set_from_case_file') {
        var associationEnabled = detail && detail.association_enabled === true;
        if (!associationEnabled && detail && detail.association_enabled !== false) {
          var sourceCaseFileIds = Array.isArray(detail.source_case_file_ids) ? detail.source_case_file_ids : [];
          if (sourceCaseFileIds.length > 1) associationEnabled = true;
        }
        if (associationEnabled) associationSuffix = '（关联）';
      }
      if (fileName3) return '用例：' + fileName3 + associationSuffix;
      return id ? ('用例#' + id + associationSuffix) : ('用例' + associationSuffix);
    }

    if (type) return id ? (type + '#' + id) : type;
    return id ? ('#' + id) : '--';
  }

  function resolveActionFilterLabel(log) {
    if (!log || typeof log !== 'object') return '';
    var action = normalizeAction(log.action);
    if (!action) return '';
    if (action === 'batch_create_case_items') return '批量新增';
    if (action === 'batch_delete_case_items') return '批量删除';
    if (action === 'create_version') return '新增版本';
    return resolveActionLabel(log) || '';
  }

  function buildActionFilterOptions(list) {
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(log) {
      var label = resolveActionFilterLabel(log);
      if (!label) return;
      if (!map[label]) map[label] = { key: label, label: label, count: 0 };
      map[label].count += 1;
    });
    var options = Object.keys(map).map(function(key) { return map[key]; });
    options.sort(function(a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label || '').localeCompare(String(b.label || ''));
    });
    return options;
  }

  function resolveLogTargetKeys(log) {
    var l = log && typeof log === 'object' ? log : null;
    if (!l) return [];
    var action = normalizeAction(l.action);
    if (!action) return [];

    // 系统平台
    if (action === 'login' || action === 'logout' || action === 'change_password') return ['platform'];

    // 用例模版
    if (action.indexOf('export_case_template_') === 0) return ['case_template'];

    // 用例（文件）
    if (
      action === 'import_case_file' ||
      action === 'overwrite_case_file' ||
      action === 'delete_case_file' ||
      action === 'change_case_file_version' ||
      action === 'append_case_items' ||
      action === 'create_exec_set' ||
      action === 'upsert_exec_set_from_case_file' ||
      action === 'archive_exec_set' ||
      action === 'delete_exec_set' ||
      action === 'delete_exec_archive' ||
      action === 'dissolve_exec_archived_placeholders' ||
      action === 'change_case_reuse_type' ||
      action === 'export_case_files_xmind' ||
      action === 'export_case_files_excel' ||
      action === 'export_exec_xmind' ||
      action === 'export_exec_snapshot' ||
      action === 'export_cases_xmind' ||
      action === 'exec_case_run' ||
      action === 'create_case_file_association' ||
      action === 'update_case_file_association' ||
      action === 'delete_case_file_association'
    ) {
      return ['case'];
    }

    // 用例（子项）
    if (
      action === 'update_case_item' ||
      action === 'create_case_item' ||
      action === 'delete_case_item' ||
      action === 'create_missing_case_item' ||
      action === 'update_missing_case_item' ||
      action === 'delete_missing_case_item' ||
      action === 'batch_create_case_items' ||
      action === 'batch_delete_case_items'
    ) {
      return ['case_item'];
    }

    if (
      action === 'create_missing_module' ||
      action === 'update_missing_module' ||
      action === 'delete_missing_module'
    ) {
      return ['case'];
    }

    // 项目/版本
    if (action === 'create_project' || action === 'delete_project') return ['project'];
    if (action === 'create_version') return ['project', 'version'];
    if (action === 'delete_version') return ['version'];

    // 人员
    if (
      action === 'create_user' ||
      action === 'delete_user' ||
      action === 'update_user' ||
      action === 'assign_projects' ||
      action === 'reset_password'
    ) {
      return ['user'];
    }

    return [];
  }

  function resolveActionLabel(log, options) {
    var l = log && typeof log === 'object' ? log : null;
    if (!l) return '';
    var action = normalizeAction(l.action);
    var detail = l.detail && typeof l.detail === 'object' ? l.detail : {};
    var preferVersionLabel = options && options.preferVersionLabel === true;

    // 系统平台
    if (action === 'login') return '登录';
    if (action === 'logout') return '登出';
    if (action === 'change_password') return '修改密码';

    // 用例（文件）
    if (action === 'import_case_file') {
      var source = String(detail.source || '').trim();
      if (detail && detail.overwrite === true) return '覆盖入库';
      if (source === 'tempexec') return '执行页面入库';
      return '用例库页面入库';
    }
    if (action === 'overwrite_case_file') return '覆盖入库';
    if (action === 'delete_case_file') return '删除';
    if (action === 'change_case_file_version') return '更换版本';
    if (action === 'append_case_items') return '追加';
    if (action === 'create_exec_set') return '执行页面入库';
    if (action === 'upsert_exec_set_from_case_file') return '转执行';
    if (action === 'create_case_file_association') return '关联用例';
    if (action === 'update_case_file_association') return '编辑关联';
    if (action === 'delete_case_file_association') return '取消关联';
    if (action === 'change_case_reuse_type') return '用例类型变更';
    if (action === 'archive_exec_set') return '归档';
    if (action === 'delete_exec_set') return '直接解散';
    if (action === 'delete_exec_archive') return '删除归档';
    if (action === 'dissolve_exec_archived_placeholders') return '解散归档';
    if (action === 'export_case_files_xmind') return '导出xmind';
    if (action === 'export_case_files_excel') return '导出excel';
    if (action === 'export_cases_xmind') return '导出xmind';
    if (action === 'export_exec_xmind') return '导出xmind（含结果）';
    if (action === 'export_exec_snapshot') return '导出excel（含结果）';
    if (action === 'exec_case_run') return '执行用例';

    // 用例（子项）
    if (action === 'batch_create_case_items') {
      var count1 = Number(detail.count);
      if (Number.isFinite(count1) && count1 > 0) return '批量新增' + count1 + '条';
      return '批量新增';
    }
    if (action === 'batch_delete_case_items') {
      var count2 = Number(detail.count);
      if (Number.isFinite(count2) && count2 > 0) return '批量删除' + count2 + '条';
      return '批量删除';
    }
    if (action === 'create_case_item') return detail && detail.batch === true ? '' : '新增';
    if (action === 'update_case_item') return '修改';
    if (action === 'delete_case_item') return detail && detail.batch === true ? '' : '删除';
    if (action === 'create_missing_case_item') return '新增';
    if (action === 'update_missing_case_item') return '修改';
    if (action === 'delete_missing_case_item') return '删除';

    if (action === 'create_missing_module') return '新增漏测模块';
    if (action === 'update_missing_module') return '修改漏测模块';
    if (action === 'delete_missing_module') return '删除漏测模块';

    // 用例模版
    if (action === 'export_case_template_xmind') return '导出xmind';
    if (action === 'export_case_template_excel') return '导出excel';

    // 项目
    if (action === 'create_project') return '新增';
    if (action === 'delete_project') return '删除';

    // 版本
    if (action === 'create_version') {
      if (preferVersionLabel) return '新增版本';
      var selected = state.selectedTargets || { all: true };
      // 默认更贴近“项目维度”的描述：新增版本；当明确只看“版本”时，使用“新增”。
      if (!selected.all && selected.version && !selected.project) return '新增';
      return '新增版本';
    }
    if (action === 'delete_version') return '删除';

    // 人员
    if (action === 'create_user') return '新增';
    if (action === 'delete_user') return '删除';
    if (action === 'update_user') return '编辑';
    if (action === 'assign_projects') return '分配权限';
    if (action === 'reset_password') return '重置密码';

    return '';
  }

  function resolveActivityActionLabel(log) {
    return resolveActionLabel(log, { preferVersionLabel: true });
  }

  function normalizeCountValue(value) {
    var num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.floor(num);
  }

  function resolveCountChangeLabel(log) {
    var l = log && typeof log === 'object' ? log : null;
    if (!l) return '-';
    var action = normalizeAction(l.action);
    if (!action) return '-';
    var detail = l.detail && typeof l.detail === 'object' ? l.detail : {};
    if (action === 'exec_case_run') {
      var beforeExec = normalizeCountValue(detail.before_count);
      var afterExec = normalizeCountValue(detail.after_count);
      if (beforeExec !== null && afterExec !== null) return String(beforeExec) + ' -> ' + String(afterExec);
      var execCount = normalizeCountValue(detail.exec_count);
      if (execCount === null) execCount = normalizeCountValue(detail.count);
      if (execCount !== null) return String(execCount);
      return '-';
    }
    if (action === 'change_case_reuse_type') {
      var nextReuse = null;
      if (detail.reuse_enabled !== undefined && detail.reuse_enabled !== null) {
        nextReuse = detail.reuse_enabled === true;
      } else if (detail.after_reuse_enabled !== undefined && detail.after_reuse_enabled !== null) {
        nextReuse = detail.after_reuse_enabled === true;
      }
      if (nextReuse === true) return '转为复用';
      if (nextReuse === false) return '转为非复用';
      return '-';
    }
    var before = normalizeCountValue(detail.before_count);
    var after = normalizeCountValue(detail.after_count);
    if (action === 'update_case_item') {
      var modifiedCount = normalizeCountValue(detail.modified_count);
      if (modifiedCount === null) modifiedCount = 1;
      return String(modifiedCount);
    }
    if (action === 'update_missing_case_item' || action === 'update_missing_module') {
      var modifiedCount2 = normalizeCountValue(detail.modified_count);
      if (modifiedCount2 === null) modifiedCount2 = 1;
      return String(modifiedCount2);
    }
    if (action === 'upsert_exec_set_from_case_file') {
      var transferCount = normalizeCountValue(detail.transfer_count);
      if (transferCount === null) transferCount = normalizeCountValue(detail.after_count);
      if (transferCount === null) transferCount = normalizeCountValue(detail.new_cases);
      if (transferCount === null) return '-';
      return String(transferCount);
    }

    if (before === null || after === null) {
      if (action === 'delete_case_file') {
        var deleted = normalizeCountValue(detail.item_deleted_total);
        if (deleted !== null) {
          before = deleted;
          after = 0;
        }
      } else if (action === 'import_case_file') {
        var imported = normalizeCountValue(detail.item_imported);
        var isOverwrite = detail.overwrite === true;
        if (!isOverwrite && detail.overwrite !== undefined && detail.overwrite !== null) {
          isOverwrite = String(detail.overwrite).toLowerCase() === 'true';
        }
        if (imported !== null && !isOverwrite) {
          before = 0;
          after = imported;
        }
      } else if (action === 'dissolve_exec_archived_placeholders') {
        var dissolved = normalizeCountValue(detail.count);
        if (dissolved !== null) {
          before = dissolved;
          after = 0;
        }
      }
    }

    if (before === null || after === null) return '-';
    return String(before) + ' -> ' + String(after);
  }

  function isAllowedLog(log) {
    var l = log && typeof log === 'object' ? log : null;
    if (!l) return false;
    return Boolean(resolveActionLabel(log));
  }

  function resolvePageLabel(log) {
    var l = log && typeof log === 'object' ? log : null;
    if (!l) return '--';
    var detail = l.detail && typeof l.detail === 'object' ? l.detail : {};
    var raw = String(detail.page || '').trim();
    var action = normalizeAction(l.action);

    function fromTabKey(key) {
      var k = String(key || '').trim();
      if (!k) return '';
      if (k === 'tempexec') return '用例执行';
      if (k === 'case-library') return '用例库';
      if (k === 'case-archive') return '用例归档';
      if (k === 'exec-overview') return '执行总览';
      if (k === 'project-admin') return '项目管理';
      if (k === 'user-admin') return '人员管理';
      if (k === 'ops-log') return '操作记录';
      if (k === 'settings') return '其他配置';
      if (k === 'models') return '模型管理';
      if (k === 'assign') return '功能指派';
      if (k === 'casesgen') return '用例生成';
      if (k === 'auto') return '一键执行';
      if (k === 'clean') return '功能流程';
      if (k === 'login') return '系统平台';
      return k;
    }

    var fromDetail = fromTabKey(raw);
    if (fromDetail) return fromDetail;

    // 兜底：老日志缺少 page 时按 action 推断
    if (action === 'login' || action === 'logout' || action === 'change_password') return '系统平台';
    if (
      action === 'create_user' ||
      action === 'delete_user' ||
      action === 'update_user' ||
      action === 'assign_projects' ||
      action === 'reset_password'
    ) {
      return '人员管理';
    }
    if (
      action === 'create_project' ||
      action === 'delete_project' ||
      action === 'create_version' ||
      action === 'delete_version'
    ) {
      return '项目管理';
    }
    if (action === 'delete_exec_archive') return '用例归档';
    if (
      action === 'archive_exec_set' ||
      action === 'delete_exec_set' ||
      action === 'export_exec_xmind' ||
      action === 'export_exec_snapshot' ||
      action === 'export_cases_xmind' ||
      action === 'dissolve_exec_archived_placeholders'
    ) {
      return '用例执行';
    }
    if (action === 'import_case_file' || action === 'overwrite_case_file') {
      var source = String(detail.source || '').trim();
      if (source === 'tempexec') return '用例执行';
      return '用例库';
    }
    if (action === 'change_case_file_version') return '用例库';
    if (action.indexOf('export_case_template_') === 0) return '用例库';
    if (action === 'export_case_files_xmind' || action === 'export_case_files_excel') return '用例库';
    if (action.indexOf('batch_') === 0) return '用例库';
    if (action.indexOf('_case_item') !== -1) return '用例库';
    if (action.indexOf('missing_case_item') !== -1 || action.indexOf('missing_module') !== -1) return '用例库';

    return '--';
  }

  function buildOpsLogExportRows(rows) {
    var header = ['操作时间', '操作人员', '操作页面', '操作项', '操作行为', '变化'];
    var list = Array.isArray(rows) ? rows : [];
    var body = list.map(function(log) {
      var operator = log && (log.username || log.user_id) ? String(log.username || log.user_id) : '--';
      return [
        formatTime(log && log.created_at),
        operator,
        resolvePageLabel(log),
        buildTargetLabel(log),
        resolveActionLabel(log) || '--',
        resolveCountChangeLabel(log),
      ];
    });
    return [header].concat(body);
  }

  return {
    configure: configure,
    normalizeAction: normalizeAction,
    getSettingsKeyLabel: getSettingsKeyLabel,
    formatSettingsItemLabel: formatSettingsItemLabel,
    buildTargetLabel: buildTargetLabel,
    resolveActionFilterLabel: resolveActionFilterLabel,
    buildActionFilterOptions: buildActionFilterOptions,
    resolveLogTargetKeys: resolveLogTargetKeys,
    resolveActionLabel: resolveActionLabel,
    resolveActivityActionLabel: resolveActivityActionLabel,
    normalizeCountValue: normalizeCountValue,
    resolveCountChangeLabel: resolveCountChangeLabel,
    isAllowedLog: isAllowedLog,
    resolvePageLabel: resolvePageLabel,
    buildOpsLogExportRows: buildOpsLogExportRows,
  };
});
