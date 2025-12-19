(function() {
  var apiClient = null;
  var globalState = null;
  var utils = null;
  var storage = null;
  var appConfig = window.app && window.app.config ? window.app.config : {};

  var STORAGE_KEY = appConfig.opsLogViewStorageKey || 'tap-ops-log-view-v1';

  var TARGETS = [
    { key: 'all', label: '全部' },
    { key: 'platform', label: '系统平台' },
    { key: 'case', label: '用例' },
    { key: 'case_item', label: '用例（子项）' },
    { key: 'case_template', label: '用例模版' },
    { key: 'project', label: '项目' },
    { key: 'version', label: '版本' },
    { key: 'user', label: '人员' },
  ];

  var state = {
    drawer: null,
    users: [],
    logs: [],
    pageIndex: 0,
    selectedUserId: '',
    selectedTargets: { all: true },
    hasViewed: false,
    pendingAuth: false,
    loading: false,
  };

  var dom = {
    statusEl: document.getElementById('opsLogStatus'),
    tabBtn: document.querySelector('[data-tab-btn="ops-log"]'),
    tabSection: document.querySelector('[data-tab-section="ops-log"]'),
    drawerEl: document.getElementById('opsLogDrawer'),
    drawerRefreshBtn: document.getElementById('opsLogDrawerRefreshBtn'),
    drawerStatusEl: document.getElementById('opsLogDrawerStatus'),
    userSelect: document.getElementById('opsLogUserSelect'),
    targetGrid: document.getElementById('opsLogTargetFilterGrid'),
    paginationTop: document.getElementById('opsLogPaginationTop'),
    paginationBottom: document.getElementById('opsLogPaginationBottom'),
    tableBody: document.getElementById('opsLogDrawerTableBody'),
    emptyHint: document.getElementById('opsLogDrawerEmpty'),
  };

  function setStatus(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function clampPageSize(n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n) || n <= 0) return 20;
    if (n < 5) return 5;
    if (n > 200) return 200;
    return n;
  }

  function getPageSize() {
    var fromSettings = globalState && globalState.settings ? globalState.settings.tempExecPageSize : null;
    if (fromSettings !== null && fromSettings !== undefined) return clampPageSize(fromSettings);
    return clampPageSize(globalState && globalState.tempExecPageSize ? globalState.tempExecPageSize : 20);
  }

  function escapeHtml(text) {
    if (utils && typeof utils.escapeHtml === 'function') return utils.escapeHtml(text);
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(value) {
    if (!value) return '--';
    function normalizeTimeInput(input) {
      if (!input) return '';
      if (typeof input === 'number') return input;
      var raw = String(input || '').trim();
      if (!raw) return '';
      if (raw.indexOf('T') === -1 && raw.indexOf(' ') !== -1) {
        raw = raw.replace(' ', 'T');
      }
      raw = raw.replace(/(\.\d{3})\d+/, '$1');
      raw = raw.replace(/([+-]\d{2}):(\d{2})$/, '$1$2');
      var hasTz = /Z$/i.test(raw) || /[+-]\d{2}\d{2}$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw);
      var isIsoWithTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw);
      if (isIsoWithTime && !hasTz) raw += 'Z';
      return raw;
    }
    try {
      var normalized = normalizeTimeInput(value);
      var d = typeof normalized === 'number' ? new Date(normalized) : new Date(normalized || value);
      if (!d || isNaN(d.getTime())) return String(value || '--');
      return d.toLocaleString();
    } catch (e) {
      return String(value || '--');
    }
  }

  function normalizeAction(value) {
    return String(value || '').trim().toLowerCase();
  }

  function canView() {
    return globalState && globalState.currentUser && String(globalState.currentUser.role || '') === 'admin';
  }

  function readPersisted() {
    if (!storage || typeof storage.getJson !== 'function') return null;
    return storage.getJson(STORAGE_KEY, null);
  }

  function persistViewState() {
    if (!storage || typeof storage.setJson !== 'function') return;
    var selected = getSelectedTargetKeys();
    var payload = {
      userId: state.selectedUserId || '',
      targets: selected,
      pageIndex: Number(state.pageIndex) || 0,
      hasViewed: Boolean(state.hasViewed),
      savedAt: Date.now(),
    };
    storage.setJson(STORAGE_KEY, payload);
  }

  function restoreViewState() {
    var saved = readPersisted();
    if (!saved || typeof saved !== 'object') return;
    state.selectedUserId = saved.userId ? String(saved.userId || '') : '';
    state.pageIndex = Number(saved.pageIndex) || 0;
    state.hasViewed = Boolean(saved.hasViewed);
    state.selectedTargets = { all: true };
    // 兼容：旧版字段为 behaviors（操作行为筛选），新版为 targets（操作对象筛选）。
    var list = Array.isArray(saved.targets) ? saved.targets : [];
    if (list.length) {
      state.selectedTargets = { all: false };
      list.forEach(function(key) {
        if (!key) return;
        state.selectedTargets[String(key)] = true;
      });
      syncAllTargetSelection();
    }
  }

  function isAutoOperation(log) {
    var l = log && typeof log === 'object' ? log : null;
    if (!l) return false;
    var action = String(l.action || '').trim().toLowerCase();
    if (action.indexOf('sync_') === 0) return true;
    if (action.indexOf('auto_') === 0) return true;
    var detail = l.detail && typeof l.detail === 'object' ? l.detail : null;
    if (detail && detail.auto === true) return true;
    return false;
  }

  function getSettingsKeyLabel(key) {
    var k = String(key || '').trim();
    if (!k) return '';
    if (k === 'tempExecPageSize') return '全局分页设置';
    if (k === 'feishuWebhook') return '飞书 Webhook';
    if (k === 'feishuMention') return '@角色ID';
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

    // 系统平台
    if (action === 'login' || action === 'logout' || action === 'change_password') return '系统平台';

    // 解散归档占位（执行页版本盒子）
    if (action === 'dissolve_exec_archived_placeholders') {
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
      if (fileName3) return '用例：' + fileName3;
      return id ? ('用例#' + id) : '用例';
    }

    if (type) return id ? (type + '#' + id) : type;
    return id ? ('#' + id) : '--';
  }

  function getSelectedTargetKeys() {
    var keys = [];
    var selected = state.selectedTargets || {};
    if (selected.all) return [];
    TARGETS.forEach(function(b) {
      if (!b || b.key === 'all') return;
      if (selected[b.key]) keys.push(b.key);
    });
    // 若无勾选，视为“全部”。
    if (!keys.length) return [];
    return keys;
  }

  function syncAllTargetSelection() {
    var selected = state.selectedTargets || {};
    var any = false;
    for (var i = 0; i < TARGETS.length; i += 1) {
      var key = TARGETS[i].key;
      if (key === 'all') continue;
      if (selected[key]) {
        any = true;
        break;
      }
    }
    // 未选任何具体对象：回到“全部”。
    if (!any) {
      state.selectedTargets = { all: true };
      return;
    }
    // 选中了全部具体对象：也视为“全部”。
    var allSelected = true;
    for (var j = 0; j < TARGETS.length; j += 1) {
      var key2 = TARGETS[j].key;
      if (key2 === 'all') continue;
      if (!selected[key2]) {
        allSelected = false;
        break;
      }
    }
    if (allSelected) {
      state.selectedTargets = { all: true };
    } else {
      state.selectedTargets.all = false;
    }
  }

  function syncUserSelect() {
    if (!dom.userSelect) return;
    var list = Array.isArray(state.users) ? state.users : [];
    var active = state.selectedUserId ? String(state.selectedUserId || '') : '';
    var options = ['<option value=""' + (active ? '' : ' selected') + '>全部人员</option>'];
    list.forEach(function(u) {
      if (!u || u.id === null || u.id === undefined) return;
      var id = String(u.id);
      var selected = active && id === active ? ' selected' : '';
      options.push('<option value="' + escapeHtml(id) + '"' + selected + '>' + escapeHtml(u.username || ('用户#' + id)) + '</option>');
    });
    dom.userSelect.innerHTML = options.join('');
    if (dom.userSelect.value !== active) dom.userSelect.value = active;
  }

  function syncTargetGrid() {
    if (!dom.targetGrid) return;
    var selected = state.selectedTargets || { all: true };
    dom.targetGrid.innerHTML = TARGETS.map(function(b) {
      var key = b.key;
      var checked = '';
      if (selected.all) checked = key === 'all' ? ' checked' : '';
      else checked = selected[key] ? ' checked' : '';
      return (
        '<label class="ops-log-filter-chip">' +
          '<input type="checkbox" data-ops-log-target="' + escapeHtml(key) + '"' + checked + ' />' +
          '<span>' + escapeHtml(b.label) + '</span>' +
        '</label>'
      );
    }).join('');
  }

  function setPagination(html) {
    if (dom.paginationTop) dom.paginationTop.innerHTML = html || '';
    if (dom.paginationBottom) dom.paginationBottom.innerHTML = html || '';
  }

  function buildPagination(total, pageIndex, totalPages, start, end) {
    total = Number(total) || 0;
    pageIndex = Number(pageIndex) || 0;
    totalPages = Number(totalPages) || 1;
    start = Number(start) || 0;
    end = Number(end) || 0;
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var maxPage = totalPages || 1;
    var rangeInfo = total ? ('显示 ' + (start + 1) + '-' + end + ' / 共 ' + total + ' 条') : '暂无记录';
    return (
      '<div class="temp-pagination" data-ops-log-pagination>' +
        '<div class="temp-pagination-info">' + escapeHtml(rangeInfo) + '，每页 ' + getPageSize() + ' 条</div>' +
        '<div class="temp-pagination-controls">' +
          '<button type="button" class="secondary" data-ops-log-page="first" ' + (pageIndex <= 0 ? 'disabled' : '') + '>首页</button>' +
          '<button type="button" class="secondary" data-ops-log-page="prev" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<button type="button" class="secondary" data-ops-log-page="next" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<button type="button" class="secondary" data-ops-log-page="last" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>末页</button>' +
          '<label>跳转</label>' +
          '<input type="number" min="1" max="' + maxPage + '" value="' + Math.min(currentPage, maxPage) + '" data-ops-log-page-input>' +
        '</div>' +
      '</div>'
    );
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
      action === 'append_case_items' ||
      action === 'create_exec_set' ||
      action === 'upsert_exec_set_from_case_file' ||
      action === 'archive_exec_set' ||
      action === 'delete_exec_set' ||
      action === 'delete_exec_archive' ||
      action === 'dissolve_exec_archived_placeholders' ||
      action === 'export_case_files_xmind' ||
      action === 'export_case_files_excel' ||
      action === 'export_exec_xmind' ||
      action === 'export_exec_snapshot' ||
      action === 'export_cases_xmind'
    ) {
      return ['case'];
    }

    // 用例（子项）
    if (
      action === 'update_case_item' ||
      action === 'create_case_item' ||
      action === 'delete_case_item' ||
      action === 'batch_create_case_items' ||
      action === 'batch_delete_case_items'
    ) {
      return ['case_item'];
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

  function resolveActionLabel(log) {
    var l = log && typeof log === 'object' ? log : null;
    if (!l) return '';
    var action = normalizeAction(l.action);
    var detail = l.detail && typeof l.detail === 'object' ? l.detail : {};

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
    if (action === 'append_case_items') return '追加';
    if (action === 'create_exec_set') return '执行页面入库';
    if (action === 'upsert_exec_set_from_case_file') return '转执行';
    if (action === 'archive_exec_set') return '归档';
    if (action === 'delete_exec_set') return '直接解散';
    if (action === 'delete_exec_archive') return '删除归档';
    if (action === 'dissolve_exec_archived_placeholders') return '解散归档';
    if (action === 'export_case_files_xmind') return '导出xmind';
    if (action === 'export_case_files_excel') return '导出excel';
    if (action === 'export_cases_xmind') return '导出xmind';
    if (action === 'export_exec_xmind') return '导出xmind（含结果）';
    if (action === 'export_exec_snapshot') return '导出excel（含结果）';

    // 用例（子项）
    if (action === 'batch_create_case_items') return '批量新增';
    if (action === 'batch_delete_case_items') return '批量删除';
    if (action === 'create_case_item') return detail && detail.batch === true ? '' : '新增';
    if (action === 'update_case_item') return '修改';
    if (action === 'delete_case_item') return detail && detail.batch === true ? '' : '删除';

    // 用例模版
    if (action === 'export_case_template_xmind') return '导出xmind';
    if (action === 'export_case_template_excel') return '导出excel';

    // 项目
    if (action === 'create_project') return '新增';
    if (action === 'delete_project') return '删除';

    // 版本
    if (action === 'create_version') {
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

  function isAllowedLog(log) {
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
      if (k === 'auto') return 'AI一键需求&用例评审';
      if (k === 'clean') return '功能工作流';
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
    if (action.indexOf('export_case_template_') === 0) return '用例库';
    if (action === 'export_case_files_xmind' || action === 'export_case_files_excel') return '用例库';
    if (action.indexOf('batch_') === 0) return '用例库';
    if (action.indexOf('_case_item') !== -1) return '用例库';

    return '--';
  }

  function getFilteredLogs() {
    var list = Array.isArray(state.logs) ? state.logs : [];
    list = list.filter(isAllowedLog);
    var selected = state.selectedTargets || { all: true };
    if (selected.all) return list;
    var allow = {};
    TARGETS.forEach(function(b) {
      if (!b || b.key === 'all') return;
      if (selected[b.key]) allow[b.key] = true;
    });
    return list.filter(function(log) {
      var keys = resolveLogTargetKeys(log);
      for (var i = 0; i < keys.length; i += 1) {
        if (allow[keys[i]]) return true;
      }
      return false;
    });
  }

  function renderList() {
    if (!dom.tableBody) return;
    var rows = getFilteredLogs();
    if (!rows.length) {
      dom.tableBody.innerHTML = '';
      if (dom.emptyHint) dom.emptyHint.classList.remove('hidden');
      setPagination(buildPagination(0, 0, 1, 0, 0));
      return;
    }
    if (dom.emptyHint) dom.emptyHint.classList.add('hidden');

    var pageSize = getPageSize();
    var total = rows.length;
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!Number.isFinite(state.pageIndex) || state.pageIndex < 0) state.pageIndex = 0;
    if (state.pageIndex >= totalPages) state.pageIndex = Math.max(totalPages - 1, 0);
    var start = state.pageIndex * pageSize;
    var end = Math.min(total, start + pageSize);
    var view = rows.slice(start, end);

    setPagination(buildPagination(total, state.pageIndex, totalPages, start, end));
    dom.tableBody.innerHTML = view.map(function(log) {
      var operator = log && (log.username || log.user_id) ? String(log.username || log.user_id) : '--';
      return (
        '<tr>' +
          '<td>' + escapeHtml(formatTime(log.created_at)) + '</td>' +
          '<td>' + escapeHtml(operator) + '</td>' +
          '<td>' + escapeHtml(resolvePageLabel(log)) + '</td>' +
          '<td>' + escapeHtml(buildTargetLabel(log)) + '</td>' +
          '<td>' + escapeHtml(resolveActionLabel(log) || '--') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadUsers() {
    if (!apiClient.listUsers) return Promise.resolve([]);
    return apiClient
      .listUsers()
      .then(function(list) {
        state.users = Array.isArray(list) ? list : [];
        syncUserSelect();
        return state.users;
      })
      .catch(function() {
        state.users = [];
        syncUserSelect();
        return [];
      });
  }

  function loadLogs() {
    if (!apiClient.listOperationLogs) return Promise.resolve([]);
    if (!canView()) {
      state.logs = [];
      state.pageIndex = 0;
      renderList();
      setStatus(dom.drawerStatusEl, '仅管理员可查看操作记录', 'warn');
      return Promise.resolve([]);
    }
    if (state.loading) return Promise.resolve(state.logs);
    state.loading = true;
    if (dom.drawerRefreshBtn) dom.drawerRefreshBtn.disabled = true;
    setStatus(dom.drawerStatusEl, '加载中...', '');
    var userId = state.selectedUserId ? Number(state.selectedUserId) : null;
    return apiClient
      .listOperationLogs({
        limit: 500,
        offset: 0,
        user_id: userId !== null && Number.isFinite(userId) ? userId : undefined,
      })
      .then(function(list) {
        state.logs = (Array.isArray(list) ? list : []).filter(function(row) { return !isAutoOperation(row); });
        state.pageIndex = 0;
        renderList();
        var allowedCount = state.logs.filter(isAllowedLog).length;
        setStatus(dom.drawerStatusEl, '已加载 ' + allowedCount + ' 条记录（最多 500 条）', 'ok');
        return state.logs;
      })
      .catch(function(err) {
        state.logs = [];
        state.pageIndex = 0;
        renderList();
        setStatus(dom.drawerStatusEl, err && err.message ? err.message : '加载失败', 'err');
        return [];
      })
      .finally(function() {
        state.loading = false;
        if (dom.drawerRefreshBtn) dom.drawerRefreshBtn.disabled = false;
      });
  }

  function ensureDrawer() {
    if (state.drawer) return state.drawer;
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    state.drawer = window.app.drawer.createDrawer({
      drawerId: 'opsLogDrawer',
      openButtons: ['openOpsLogDrawerBtn'],
      onOpen: function() {
        state.hasViewed = true;
        persistViewState();
        setStatus(dom.drawerStatusEl, '加载中...', '');
        syncTargetGrid();
        loadUsers().then(function() {
          syncUserSelect();
          return loadLogs();
        });
      },
    });
    return state.drawer;
  }

  function openDrawerIfNeeded() {
    if (!state.hasViewed) return;
    var drawer = ensureDrawer();
    if (!drawer || typeof drawer.open !== 'function') return;
    drawer.open();
  }

  function bindEvents() {
    if (dom.drawerRefreshBtn) {
      dom.drawerRefreshBtn.addEventListener('click', function() {
        state.pageIndex = 0;
        persistViewState();
        loadLogs();
      });
    }
    if (dom.userSelect) {
      dom.userSelect.addEventListener('change', function() {
        state.selectedUserId = dom.userSelect.value ? String(dom.userSelect.value || '') : '';
        state.pageIndex = 0;
        persistViewState();
        loadLogs();
      });
    }
    if (dom.targetGrid) {
      dom.targetGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsLogTarget || '') : '';
        if (!key) return;
        if (key === 'all') {
          state.selectedTargets = { all: Boolean(t.checked) };
          if (!t.checked) state.selectedTargets = { all: true };
          syncTargetGrid();
          state.pageIndex = 0;
          persistViewState();
          renderList();
          return;
        }
        if (!state.selectedTargets || typeof state.selectedTargets !== 'object') state.selectedTargets = { all: true };
        if (state.selectedTargets.all) {
          var next = { all: false };
          next[key] = Boolean(t.checked);
          state.selectedTargets = next;
        } else {
          state.selectedTargets[key] = Boolean(t.checked);
        }
        syncAllTargetSelection();
        syncTargetGrid();
        state.pageIndex = 0;
        persistViewState();
        renderList();
      });
    }
    function bindPaginationContainer(container) {
      if (!container || !container.addEventListener) return;
      container.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-ops-log-page]') : null;
        if (!btn || !btn.dataset) return;
        var action = btn.dataset.opsLogPage || '';
        var rows = getFilteredLogs();
        var pageSize = getPageSize();
        var total = rows.length;
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        if (action === 'prev') state.pageIndex -= 1;
        else if (action === 'next') state.pageIndex += 1;
        else if (action === 'first') state.pageIndex = 0;
        else if (action === 'last') state.pageIndex = totalPages - 1;
        if (state.pageIndex < 0) state.pageIndex = 0;
        if (state.pageIndex >= totalPages) state.pageIndex = Math.max(totalPages - 1, 0);
        persistViewState();
        renderList();
      });
      container.addEventListener('change', function(e) {
        var input = e && e.target && e.target.closest ? e.target.closest('[data-ops-log-page-input]') : null;
        if (!input) return;
        var rows = getFilteredLogs();
        var pageSize = getPageSize();
        var total = rows.length;
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        var n = Number(input.value);
        if (!isFinite(n)) return;
        var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
        state.pageIndex = idx;
        persistViewState();
        renderList();
      });
    }
    bindPaginationContainer(dom.paginationTop);
    bindPaginationContainer(dom.paginationBottom);

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('app-tab-activated', function(e) {
        var tabName = e && e.detail ? e.detail.tab : '';
        if (tabName !== 'ops-log') return;
        if (window.app && window.app.authReady !== true) {
          state.pendingAuth = true;
          setStatus(dom.statusEl, '登录信息加载中...', '');
          return;
        }
        setStatus(dom.statusEl, '', '');
        openDrawerIfNeeded();
      });
      window.addEventListener('app-auth-ready', function() {
        if (!state.pendingAuth) return;
        state.pendingAuth = false;
        var visible = dom.tabSection && !dom.tabSection.classList.contains('hidden');
        if (!visible) return;
        setStatus(dom.statusEl, '', '');
        openDrawerIfNeeded();
      });
    }
  }

  function init() {
    apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
    globalState = window.app && window.app.state ? window.app.state : null;
    utils = window.app && window.app.utils ? window.app.utils : null;
    storage = window.app && window.app.services && window.app.services.storage ? window.app.services.storage : null;

    if (!apiClient || !globalState) return;

    restoreViewState();
    ensureDrawer();
    syncTargetGrid();
    bindEvents();

    if (!canView()) {
      setStatus(dom.statusEl, '仅管理员可查看操作记录', 'warn');
      return;
    }
    setStatus(dom.statusEl, '已启用操作记录（仅管理员）', 'ok');
  }

  var started = false;
  function attemptInit() {
    if (started) return;
    // app.init() 由 bootstrap 在 DOMContentLoaded 后触发；这里等 app 把 state / authReady 准备好。
    if (!window.app || window.app._inited !== true) return;
    if (window.app.authReady !== true) return;
    started = true;
    init();
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('app-auth-ready', attemptInit);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(attemptInit, 0);
      setTimeout(attemptInit, 200);
      setTimeout(attemptInit, 800);
    });
  } else {
    setTimeout(attemptInit, 0);
  }
})();
