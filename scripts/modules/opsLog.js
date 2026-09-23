(function() {
  var apiClient = null;
  var globalState = null;
  var utils = null;
  var storage = null;
  var appConfig = window.app && window.app.config ? window.app.config : {};

  var STORAGE_KEY = appConfig.opsLogViewStorageKey || 'tap-ops-log-view-v1';
  var ACTIVITY_STORAGE_KEY = appConfig.opsActivityViewStorageKey || 'tap-ops-activity-view-v1';
  var CONTRIBUTION_STORAGE_KEY = appConfig.opsContributionViewStorageKey || 'tap-ops-contribution-view-v1';
  var EXEC_CONTRIBUTION_STORAGE_KEY = appConfig.opsExecContributionViewStorageKey || 'tap-ops-exec-contribution-view-v1';
  var DEFAULT_ACTIVITY_RANGE = 'week';
  var ACTIVITY_BAR_MAX_RATIO = 82;
  var OVERVIEW_AUTO_REFRESH_INTERVAL_MS = Number(appConfig.opsOverviewAutoRefreshIntervalMs || 60000);
  if (!Number.isFinite(OVERVIEW_AUTO_REFRESH_INTERVAL_MS) || OVERVIEW_AUTO_REFRESH_INTERVAL_MS < 0) {
    OVERVIEW_AUTO_REFRESH_INTERVAL_MS = 60000;
  }

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

  // 在展示时翻译工具名，已有操作记录和 Excel 导出共用，不改写原始审计详情。
  var MCP_TOOL_LABELS = {
    get_current_user: '查看当前用户与凭据权限',
    list_projects: '查询项目列表',
    list_versions: '查询项目版本',
    create_version: '创建项目版本',
    list_case_files: '查询用例文件',
    get_case_items: '查看用例内容',
    search_cases: '搜索用例',
    create_case_file: '新建用例文件并入库',
    append_case_items: '追加用例',
    update_case_item: '修改用例内容',
    create_execution_set: '将用例转入执行',
    list_execution_sets: '查询执行集',
    get_execution_cases: '查看执行用例',
    get_execution_reuse_context: '查看复用子项与解锁配置',
    add_execution_reuse_presets: '新增复用子项',
    update_execution_reuse_presets: '配置复用解锁方式',
    quick_execute_reuse: '复用用例快速执行',
    record_execution_result: '记录用例执行结果',
    get_execution_overview: '查看执行统计',
    list_archives: '查询用例归档',
    get_archive: '查看归档详情',
    get_case_history: '查看用例变更历史',
    list_missing_cases: '查询易漏用例',
    list_knowledge_bases: '查询项目知识库',
    search_knowledge: '检索知识库内容',
    get_knowledge_document: '读取知识库文档',
    list_knowledge_documents: '查询知识库文档目录',
    list_operation_logs: '查询操作记录',
    get_operation_log_detail: '查看操作记录详情',
    get_operation_log_summary: '汇总操作记录',
  };

  var CONTRIBUTION_BEHAVIORS = [
    { key: 'import', label: '用例导入' },
    { key: 'add', label: '新增用例' },
    { key: 'edit', label: '修改用例' },
    { key: 'delete', label: '删除用例' },
  ];

  var EXEC_CONTRIBUTION_BEHAVIORS = [
    { key: 'exec', label: '用例执行' },
    { key: 'archive', label: '归档用例' },
  ];

  var state = {
    drawer: null,
    users: [],
    logs: [],
    cursors: [null],
    nextCursor: null,
    logRequestId: 0,
    logController: null,
    queryPageSize: null,
    actionOptions: [],
    detailRequestId: 0,
    pageIndex: 0,
    selectedUserId: '',
    selectedTargets: { all: true },
    selectedActions: { all: true },
    actionOptionKeys: [],
    overviewView: 'activity',
    hasViewed: false,
    drawerOpen: false,
    dateStart: '',
    dateEnd: '',
    pendingAuth: false,
    pendingReload: false,
    loading: false,
    activity: {
      drawer: null,
      usersLoaded: false,
      logsLoaded: false,
      loading: false,
      selectedUserIds: [],
      draftUserIds: [],
      selectedBehaviors: { all: true },
      timeRange: DEFAULT_ACTIVITY_RANGE,
      dateStart: '',
      dateEnd: '',
      hasSelection: false,
      logs: [],
      behaviors: [],
      colorMap: {},
      lastFetchedAt: 0,
    },
    contribution: {
      drawer: null,
      usersLoaded: false,
      logsLoaded: false,
      loading: false,
      selectedUserIds: [],
      draftUserIds: [],
      selectedBehaviors: { all: true },
      timeRange: DEFAULT_ACTIVITY_RANGE,
      dateStart: '',
      dateEnd: '',
      hasSelection: false,
      logs: [],
      behaviors: [],
      colorMap: {},
      lastFetchedAt: 0,
    },
    execContribution: {
      drawer: null,
      usersLoaded: false,
      logsLoaded: false,
      loading: false,
      selectedUserIds: [],
      draftUserIds: [],
      selectedBehaviors: { all: true },
      timeRange: DEFAULT_ACTIVITY_RANGE,
      dateStart: '',
      dateEnd: '',
      hasSelection: false,
      logs: [],
      behaviors: [],
      colorMap: {},
      lastFetchedAt: 0,
    },
  };

  var dom = {
    statusEl: document.getElementById('opsLogStatus'),
    tabBtn: document.querySelector('[data-tab-btn="ops-log"]'),
    tabSection: document.querySelector('[data-tab-section="ops-log"]'),
    drawerEl: document.getElementById('opsLogDrawer'),
    drawerRefreshBtn: document.getElementById('opsLogDrawerRefreshBtn'),
    drawerExportBtn: document.getElementById('opsLogDrawerExportBtn'),
    drawerStatusEl: document.getElementById('opsLogDrawerStatus'),
    userSelect: document.getElementById('opsLogUserSelect'),
    dateStart: document.getElementById('opsLogDateStart'),
    dateEnd: document.getElementById('opsLogDateEnd'),
    targetGrid: document.getElementById('opsLogTargetFilterGrid'),
    actionGrid: document.getElementById('opsLogActionFilterGrid'),
    paginationTop: document.getElementById('opsLogPaginationTop'),
    paginationBottom: document.getElementById('opsLogPaginationBottom'),
    tableBody: document.getElementById('opsLogDrawerTableBody'),
    emptyHint: document.getElementById('opsLogDrawerEmpty'),
    activityDrawerStatus: document.getElementById('opsActivityDrawerStatus'),
    activityUserGrid: document.getElementById('opsActivityUserGrid'),
    activitySelectAll: document.getElementById('opsActivitySelectAll'),
    activityApplyBtn: document.getElementById('opsActivityApplyBtn'),
    activityUserEmpty: document.getElementById('opsActivityUserEmpty'),
    activityTimeRange: document.getElementById('opsActivityTimeRangeSelect'),
    activityDateStart: document.getElementById('opsActivityDateStart'),
    activityDateEnd: document.getElementById('opsActivityDateEnd'),
    activityBehaviorGrid: document.getElementById('opsActivityBehaviorFilterGrid'),
    activityStatus: document.getElementById('opsActivityStatus'),
    activitySelectionText: document.getElementById('opsActivitySelectionText'),
    activityRefreshBtn: document.getElementById('opsActivityRefreshBtn'),
    activityList: document.getElementById('opsActivityList'),
    activityEmpty: document.getElementById('opsActivityEmpty'),
    activityCard: document.getElementById('opsActivityCard'),
    contributionDrawerStatus: document.getElementById('opsContributionDrawerStatus'),
    contributionUserGrid: document.getElementById('opsContributionUserGrid'),
    contributionSelectAll: document.getElementById('opsContributionSelectAll'),
    contributionApplyBtn: document.getElementById('opsContributionApplyBtn'),
    contributionUserEmpty: document.getElementById('opsContributionUserEmpty'),
    contributionTimeRange: document.getElementById('opsContributionTimeRangeSelect'),
    contributionDateStart: document.getElementById('opsContributionDateStart'),
    contributionDateEnd: document.getElementById('opsContributionDateEnd'),
    contributionBehaviorGrid: document.getElementById('opsContributionBehaviorFilterGrid'),
    contributionStatus: document.getElementById('opsContributionStatus'),
    contributionSelectionText: document.getElementById('opsContributionSelectionText'),
    contributionRefreshBtn: document.getElementById('opsContributionRefreshBtn'),
    contributionList: document.getElementById('opsContributionList'),
    contributionEmpty: document.getElementById('opsContributionEmpty'),
    contributionCard: document.getElementById('opsContributionCard'),
    execContributionDrawerStatus: document.getElementById('opsExecContributionDrawerStatus'),
    execContributionUserGrid: document.getElementById('opsExecContributionUserGrid'),
    execContributionSelectAll: document.getElementById('opsExecContributionSelectAll'),
    execContributionApplyBtn: document.getElementById('opsExecContributionApplyBtn'),
    execContributionUserEmpty: document.getElementById('opsExecContributionUserEmpty'),
    execContributionTimeRange: document.getElementById('opsExecContributionTimeRangeSelect'),
    execContributionDateStart: document.getElementById('opsExecContributionDateStart'),
    execContributionDateEnd: document.getElementById('opsExecContributionDateEnd'),
    execContributionBehaviorGrid: document.getElementById('opsExecContributionBehaviorFilterGrid'),
    execContributionStatus: document.getElementById('opsExecContributionStatus'),
    execContributionSelectionText: document.getElementById('opsExecContributionSelectionText'),
    execContributionRefreshBtn: document.getElementById('opsExecContributionRefreshBtn'),
    execContributionList: document.getElementById('opsExecContributionList'),
    execContributionEmpty: document.getElementById('opsExecContributionEmpty'),
    execContributionCard: document.getElementById('opsExecContributionCard'),
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
    if (n > 100) return 100;
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

  function parseTimeMs(value) {
    if (!value && value !== 0) return null;
    try {
      var normalized = normalizeTimeInput(value);
      var d = typeof normalized === 'number' ? new Date(normalized) : new Date(normalized || value);
      if (!d || isNaN(d.getTime())) return null;
      return d.getTime();
    } catch (err) {
      return null;
    }
  }

  function padDayPart(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function getDayKeyFromMs(value) {
    if (!Number.isFinite(value)) return '';
    var d = new Date(value);
    if (!d || isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + padDayPart(d.getMonth() + 1) + '-' + padDayPart(d.getDate());
  }

  function resolveSingleUserId(list) {
    if (!Array.isArray(list) || list.length !== 1) return null;
    var raw = Number(list[0]);
    if (!Number.isFinite(raw)) return null;
    return raw;
  }

  function getOldestLogTime(list) {
    if (!Array.isArray(list) || !list.length) return null;
    for (var i = list.length - 1; i >= 0; i -= 1) {
      var log = list[i];
      var t = log ? parseTimeMs(log.created_at) : null;
      if (t !== null) return t;
    }
    return null;
  }

  function parseDateInputValue(value, isEnd) {
    if (!value) return null;
    var raw = String(value || '').trim();
    if (!raw) return null;
    var parts = raw.split('-');
    if (parts.length !== 3) return null;
    var year = Number(parts[0]);
    var month = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (isEnd) return new Date(year, month, day, 23, 59, 59, 999).getTime();
    return new Date(year, month, day).getTime();
  }

  function getDateRangeMs(startValue, endValue) {
    var startMs = parseDateInputValue(startValue, false);
    var endMs = parseDateInputValue(endValue, true);
    if (startMs !== null && endMs !== null && endMs < startMs) {
      var tmp = startMs;
      startMs = endMs;
      endMs = tmp;
    }
    return { startMs: startMs, endMs: endMs };
  }

  function isTimeInRange(value, range) {
    if (!range || (range.startMs === null && range.endMs === null)) return true;
    var t = parseTimeMs(value);
    if (!t) return false;
    if (range.startMs !== null && t < range.startMs) return false;
    if (range.endMs !== null && t > range.endMs) return false;
    return true;
  }

  function formatTime(value) {
    if (!value) return '--';
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

  function normalizeOpsOverviewView(value) {
    var raw = String(value || '').trim().toLowerCase();
    if (raw === 'contribution') return 'contribution';
    if (raw === 'exec' || raw === 'exec-contribution' || raw === 'execution') return 'exec-contribution';
    return 'activity';
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
    var selectedActions = getSelectedActionKeys();
    var payload = {
      userId: state.selectedUserId || '',
      targets: selected,
      actions: selectedActions,
      pageIndex: Number(state.pageIndex) || 0,
      hasViewed: Boolean(state.hasViewed),
      drawerOpen: Boolean(state.drawerOpen),
      overviewView: state.overviewView || 'activity',
      dateStart: state.dateStart || '',
      dateEnd: state.dateEnd || '',
      savedAt: Date.now(),
    };
    storage.setJson(STORAGE_KEY, payload);
  }

  function restoreViewState() {
    var saved = readPersisted();
    if (!saved || typeof saved !== 'object') return;
    state.selectedUserId = saved.userId ? String(saved.userId || '') : '';
    state.pageIndex = 0;
    state.hasViewed = Boolean(saved.hasViewed);
    state.drawerOpen = Boolean(saved.drawerOpen);
    state.overviewView = normalizeOpsOverviewView(saved.overviewView);
    state.dateStart = saved.dateStart ? String(saved.dateStart || '') : '';
    state.dateEnd = saved.dateEnd ? String(saved.dateEnd || '') : '';
    state.selectedTargets = { all: true };
    state.selectedActions = { all: true };
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
    var actions = Array.isArray(saved.actions) ? saved.actions : [];
    if (actions.length) {
      state.selectedActions = { all: false };
      actions.forEach(function(key) {
        if (!key) return;
        state.selectedActions[String(key)] = true;
      });
      syncAllActionSelection();
    }
  }

  function readActivityPersisted() {
    if (!storage || typeof storage.getJson !== 'function') return null;
    return storage.getJson(ACTIVITY_STORAGE_KEY, null);
  }

  function persistActivityState() {
    if (!storage || typeof storage.setJson !== 'function') return;
    var selected = getSelectedActivityBehaviorKeys();
    var payload = {
      userIds: Array.isArray(state.activity.selectedUserIds) ? state.activity.selectedUserIds.slice() : [],
      timeRange: state.activity.timeRange || DEFAULT_ACTIVITY_RANGE,
      dateStart: state.activity.dateStart || '',
      dateEnd: state.activity.dateEnd || '',
      behaviors: selected,
      behaviorAll: Boolean(state.activity.selectedBehaviors && state.activity.selectedBehaviors.all),
      hasSelection: Boolean(state.activity.hasSelection),
      savedAt: Date.now(),
    };
    storage.setJson(ACTIVITY_STORAGE_KEY, payload);
  }

  function restoreActivityState() {
    var saved = readActivityPersisted();
    if (!saved || typeof saved !== 'object') return;
    var ids = Array.isArray(saved.userIds) ? saved.userIds : [];
    state.activity.selectedUserIds = ids.map(function(id) { return String(id); }).filter(Boolean);
    state.activity.draftUserIds = state.activity.selectedUserIds.slice();
    state.activity.timeRange = saved.timeRange ? String(saved.timeRange) : DEFAULT_ACTIVITY_RANGE;
    state.activity.dateStart = saved.dateStart ? String(saved.dateStart || '') : '';
    state.activity.dateEnd = saved.dateEnd ? String(saved.dateEnd || '') : '';
    state.activity.hasSelection = Boolean(saved.hasSelection || state.activity.selectedUserIds.length);
    state.activity.selectedBehaviors = { all: true };
    if (saved.behaviorAll === true) return;
    var behaviors = Array.isArray(saved.behaviors) ? saved.behaviors : [];
    if (behaviors.length) {
      state.activity.selectedBehaviors = { all: false };
      behaviors.forEach(function(key) {
        if (!key) return;
        state.activity.selectedBehaviors[String(key)] = true;
      });
    }
  }

  function readContributionPersisted() {
    if (!storage || typeof storage.getJson !== 'function') return null;
    return storage.getJson(CONTRIBUTION_STORAGE_KEY, null);
  }

  function persistContributionState() {
    if (!storage || typeof storage.setJson !== 'function') return;
    var selected = getSelectedContributionBehaviorKeys();
    var payload = {
      userIds: Array.isArray(state.contribution.selectedUserIds) ? state.contribution.selectedUserIds.slice() : [],
      timeRange: state.contribution.timeRange || DEFAULT_ACTIVITY_RANGE,
      dateStart: state.contribution.dateStart || '',
      dateEnd: state.contribution.dateEnd || '',
      behaviors: selected,
      behaviorAll: Boolean(state.contribution.selectedBehaviors && state.contribution.selectedBehaviors.all),
      hasSelection: Boolean(state.contribution.hasSelection),
      savedAt: Date.now(),
    };
    storage.setJson(CONTRIBUTION_STORAGE_KEY, payload);
  }

  function restoreContributionState() {
    var saved = readContributionPersisted();
    if (!saved || typeof saved !== 'object') return;
    var ids = Array.isArray(saved.userIds) ? saved.userIds : [];
    state.contribution.selectedUserIds = ids.map(function(id) { return String(id); }).filter(Boolean);
    state.contribution.draftUserIds = state.contribution.selectedUserIds.slice();
    state.contribution.timeRange = saved.timeRange ? String(saved.timeRange) : DEFAULT_ACTIVITY_RANGE;
    state.contribution.dateStart = saved.dateStart ? String(saved.dateStart || '') : '';
    state.contribution.dateEnd = saved.dateEnd ? String(saved.dateEnd || '') : '';
    state.contribution.hasSelection = Boolean(saved.hasSelection || state.contribution.selectedUserIds.length);
    state.contribution.selectedBehaviors = { all: true };
    if (saved.behaviorAll === true) return;
    var behaviors = Array.isArray(saved.behaviors) ? saved.behaviors : [];
    if (behaviors.length) {
      state.contribution.selectedBehaviors = { all: false };
      behaviors.forEach(function(key) {
        if (!key) return;
        state.contribution.selectedBehaviors[String(key)] = true;
      });
    }
  }

  function readExecContributionPersisted() {
    if (!storage || typeof storage.getJson !== 'function') return null;
    return storage.getJson(EXEC_CONTRIBUTION_STORAGE_KEY, null);
  }

  function persistExecContributionState() {
    if (!storage || typeof storage.setJson !== 'function') return;
    var selected = getSelectedExecContributionBehaviorKeys();
    var payload = {
      userIds: Array.isArray(state.execContribution.selectedUserIds) ? state.execContribution.selectedUserIds.slice() : [],
      timeRange: state.execContribution.timeRange || DEFAULT_ACTIVITY_RANGE,
      dateStart: state.execContribution.dateStart || '',
      dateEnd: state.execContribution.dateEnd || '',
      behaviors: selected,
      behaviorAll: Boolean(state.execContribution.selectedBehaviors && state.execContribution.selectedBehaviors.all),
      hasSelection: Boolean(state.execContribution.hasSelection),
      savedAt: Date.now(),
    };
    storage.setJson(EXEC_CONTRIBUTION_STORAGE_KEY, payload);
  }

  function restoreExecContributionState() {
    var saved = readExecContributionPersisted();
    if (!saved || typeof saved !== 'object') return;
    var ids = Array.isArray(saved.userIds) ? saved.userIds : [];
    state.execContribution.selectedUserIds = ids.map(function(id) { return String(id); }).filter(Boolean);
    state.execContribution.draftUserIds = state.execContribution.selectedUserIds.slice();
    state.execContribution.timeRange = saved.timeRange ? String(saved.timeRange) : DEFAULT_ACTIVITY_RANGE;
    state.execContribution.dateStart = saved.dateStart ? String(saved.dateStart || '') : '';
    state.execContribution.dateEnd = saved.dateEnd ? String(saved.dateEnd || '') : '';
    state.execContribution.hasSelection = Boolean(saved.hasSelection || state.execContribution.selectedUserIds.length);
    state.execContribution.selectedBehaviors = { all: true };
    if (saved.behaviorAll === true) return;
    var behaviors = Array.isArray(saved.behaviors) ? saved.behaviors : [];
    if (behaviors.length) {
      state.execContribution.selectedBehaviors = { all: false };
      behaviors.forEach(function(key) {
        if (!key) return;
        state.execContribution.selectedBehaviors[String(key)] = true;
      });
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
    if (action === 'update_settings') return '平台设置';
    if (action === 'mcp_tool_call') {
      var tool = String(detail.tool || '').trim();
      var toolLabel = Object.prototype.hasOwnProperty.call(MCP_TOOL_LABELS, tool)
        ? MCP_TOOL_LABELS[tool] : '其他工具调用';
      return 'MCP：' + toolLabel;
    }
    if (type === 'knowledge_source') return '知识库：' + String(detail.name || id);
    if (type === 'mcp_token') return 'MCP 凭据：' + String(detail.name || id);

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

  function getSelectedActionKeys() {
    var selected = state.selectedActions || {};
    if (selected.all) return [];
    var keys = [];
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (selected[key]) keys.push(key);
    });
    if (!keys.length) return [];
    return keys;
  }

  function trimActionSelection(optionKeys) {
    var selected = state.selectedActions || {};
    if (selected.all) return;
    var keys = Array.isArray(optionKeys) ? optionKeys : [];
    if (!keys.length) return;
    var allow = {};
    keys.forEach(function(key) {
      if (!key) return;
      allow[key] = true;
    });
    var changed = false;
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (!allow[key]) {
        delete selected[key];
        changed = true;
      }
    });
    if (changed) {
      var any = false;
      Object.keys(selected).forEach(function(key) {
        if (key === 'all') return;
        if (selected[key]) any = true;
      });
      if (!any) state.selectedActions = { all: true };
    }
  }

  function syncAllActionSelection(optionKeys) {
    var selected = state.selectedActions || {};
    var keys = Array.isArray(optionKeys) ? optionKeys : (Array.isArray(state.actionOptionKeys) ? state.actionOptionKeys : []);
    if (keys.length) {
      var any = false;
      keys.forEach(function(key) {
        if (selected[key]) any = true;
      });
      if (!any) {
        state.selectedActions = { all: true };
        return;
      }
      var allSelected = true;
      keys.forEach(function(key) {
        if (!selected[key]) allSelected = false;
      });
      if (allSelected) {
        state.selectedActions = { all: true };
      } else {
        state.selectedActions.all = false;
      }
      return;
    }
    var hasSelection = false;
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (selected[key]) hasSelection = true;
    });
    if (!hasSelection) state.selectedActions = { all: true };
  }

  function syncActionGrid() {
    if (!dom.actionGrid) return;
    var options = state.actionOptions || [];
    state.actionOptionKeys = options.map(function(item) { return item.key; });
    var selected = state.selectedActions || { all: true };
    var html = ['<label class="ops-log-filter-chip"><input type="checkbox" data-ops-log-action="all"'
      + (selected.all ? ' checked' : '') + ' /><span>全部</span></label>'];
    options.forEach(function(item) {
      html.push('<label class="ops-log-filter-chip"><input type="checkbox" data-ops-log-action="'
        + escapeHtml(item.key) + '"' + (!selected.all && selected[item.key] ? ' checked' : '')
        + ' /><span>' + escapeHtml(item.label) + '</span></label>');
    });
    dom.actionGrid.innerHTML = html.join('');
  }


  function syncOpsLogDateRange() {
    if (dom.dateStart) dom.dateStart.value = state.dateStart || '';
    if (dom.dateEnd) dom.dateEnd.value = state.dateEnd || '';
  }

  function getActivityPalette() {
    var palette = appConfig && Array.isArray(appConfig.cleanHighlightColors) ? appConfig.cleanHighlightColors : null;
    if (palette && palette.length) return palette;
    return ['#5b8def', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#ec4899', '#84cc16'];
  }

  function getActivityColor(label) {
    var key = String(label || '').trim().toLowerCase();
    if (!key) return '#9ca3af';
    if (state.activity.colorMap[key]) return state.activity.colorMap[key];
    var hash = 0;
    for (var i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    var palette = getActivityPalette();
    var idx = Math.abs(hash) % palette.length;
    var color = palette[idx];
    state.activity.colorMap[key] = color;
    return color;
  }

  function getContributionColor(label) {
    var key = String(label || '').trim().toLowerCase();
    if (!key) return '#9ca3af';
    if (state.contribution.colorMap[key]) return state.contribution.colorMap[key];
    var hash = 0;
    for (var i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    var palette = getActivityPalette();
    var idx = Math.abs(hash) % palette.length;
    var color = palette[idx];
    state.contribution.colorMap[key] = color;
    return color;
  }

  function getExecContributionColor(label) {
    var key = String(label || '').trim().toLowerCase();
    if (!key) return '#9ca3af';
    if (state.execContribution.colorMap[key]) return state.execContribution.colorMap[key];
    var hash = 0;
    for (var i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    var palette = getActivityPalette();
    var idx = Math.abs(hash) % palette.length;
    var color = palette[idx];
    state.execContribution.colorMap[key] = color;
    return color;
  }

  function getActivityUserNameMap() {
    var map = {};
    var list = Array.isArray(state.users) ? state.users : [];
    list.forEach(function(u) {
      if (!u || u.id === null || u.id === undefined) return;
      var id = String(u.id);
      map[id] = String(u.username || ('用户#' + id));
    });
    return map;
  }

  function appendMissingUsers(users, selectedIds, builder) {
    var list = Array.isArray(users) ? users.slice() : [];
    var ids = Array.isArray(selectedIds) ? selectedIds : [];
    if (!ids.length || typeof builder !== 'function') return list;
    var existing = {};
    list.forEach(function(user) {
      if (!user || user.id === null || user.id === undefined) return;
      existing[String(user.id)] = true;
    });
    ids.forEach(function(id) {
      var key = String(id || '').trim();
      if (!key || existing[key]) return;
      var item = builder(key);
      if (!item) return;
      existing[key] = true;
      list.push(item);
    });
    return list;
  }

  function getActivityUserIds() {
    var list = Array.isArray(state.users) ? state.users : [];
    var ids = [];
    list.forEach(function(u) {
      if (!u || u.id === null || u.id === undefined) return;
      ids.push(String(u.id));
    });
    return ids;
  }

  function setActivityDraftUserIds(ids) {
    var map = {};
    var list = [];
    (Array.isArray(ids) ? ids : []).forEach(function(id) {
      var key = String(id || '').trim();
      if (!key || map[key]) return;
      map[key] = true;
      list.push(key);
    });
    state.activity.draftUserIds = list;
  }

  function syncActivitySelectionText() {
    if (!dom.activitySelectionText) return;
    var selected = Array.isArray(state.activity.selectedUserIds) ? state.activity.selectedUserIds : [];
    if (!selected.length) {
      dom.activitySelectionText.textContent = '未选择';
      return;
    }
    var nameMap = getActivityUserNameMap();
    var names = selected.map(function(id) { return nameMap[id] || ('用户#' + id); });
    var shown = names.slice(0, 3);
    var suffix = names.length > shown.length ? (' 等' + names.length + ' 人') : '';
    dom.activitySelectionText.textContent = shown.join('、') + suffix;
  }

  function syncActivityUserGrid() {
    if (!dom.activityUserGrid) return;
    var list = Array.isArray(state.users) ? state.users : [];
    var draft = Array.isArray(state.activity.draftUserIds) ? state.activity.draftUserIds : [];
    var selectedMap = {};
    draft.forEach(function(id) { selectedMap[String(id)] = true; });
    if (!list.length) {
      dom.activityUserGrid.innerHTML = '';
      if (dom.activityUserEmpty) dom.activityUserEmpty.classList.remove('hidden');
      if (dom.activitySelectAll) dom.activitySelectAll.checked = false;
      return;
    }
    if (dom.activityUserEmpty) dom.activityUserEmpty.classList.add('hidden');
    dom.activityUserGrid.innerHTML = list.map(function(u) {
      if (!u || u.id === null || u.id === undefined) return '';
      var id = String(u.id);
      var checked = selectedMap[id] ? ' checked' : '';
      return (
        '<label class="ops-activity-user-chip">' +
          '<input type="checkbox" data-ops-activity-user="' + escapeHtml(id) + '"' + checked + ' />' +
          '<span>' + escapeHtml(u.username || ('用户#' + id)) + '</span>' +
        '</label>'
      );
    }).join('');
    if (dom.activitySelectAll) {
      dom.activitySelectAll.checked = draft.length && draft.length === list.length;
    }
  }

  function setContributionDraftUserIds(ids) {
    var map = {};
    var list = [];
    (Array.isArray(ids) ? ids : []).forEach(function(id) {
      var key = String(id || '').trim();
      if (!key || map[key]) return;
      map[key] = true;
      list.push(key);
    });
    state.contribution.draftUserIds = list;
  }

  function syncContributionSelectionText() {
    if (!dom.contributionSelectionText) return;
    var selected = Array.isArray(state.contribution.selectedUserIds) ? state.contribution.selectedUserIds : [];
    if (!selected.length) {
      dom.contributionSelectionText.textContent = '未选择';
      return;
    }
    var nameMap = getActivityUserNameMap();
    var names = selected.map(function(id) { return nameMap[id] || ('用户#' + id); });
    var shown = names.slice(0, 3);
    var suffix = names.length > shown.length ? (' 等' + names.length + ' 人') : '';
    dom.contributionSelectionText.textContent = shown.join('、') + suffix;
  }

  function syncContributionUserGrid() {
    if (!dom.contributionUserGrid) return;
    var list = Array.isArray(state.users) ? state.users : [];
    var draft = Array.isArray(state.contribution.draftUserIds) ? state.contribution.draftUserIds : [];
    var selectedMap = {};
    draft.forEach(function(id) { selectedMap[String(id)] = true; });
    if (!list.length) {
      dom.contributionUserGrid.innerHTML = '';
      if (dom.contributionUserEmpty) dom.contributionUserEmpty.classList.remove('hidden');
      if (dom.contributionSelectAll) dom.contributionSelectAll.checked = false;
      return;
    }
    if (dom.contributionUserEmpty) dom.contributionUserEmpty.classList.add('hidden');
    dom.contributionUserGrid.innerHTML = list.map(function(u) {
      if (!u || u.id === null || u.id === undefined) return '';
      var id = String(u.id);
      var checked = selectedMap[id] ? ' checked' : '';
      return (
        '<label class="ops-activity-user-chip">' +
          '<input type="checkbox" data-ops-contribution-user="' + escapeHtml(id) + '"' + checked + ' />' +
          '<span>' + escapeHtml(u.username || ('用户#' + id)) + '</span>' +
        '</label>'
      );
    }).join('');
    if (dom.contributionSelectAll) {
      dom.contributionSelectAll.checked = draft.length && draft.length === list.length;
    }
  }

  function setExecContributionDraftUserIds(ids) {
    var map = {};
    var list = [];
    (Array.isArray(ids) ? ids : []).forEach(function(id) {
      var key = String(id || '').trim();
      if (!key || map[key]) return;
      map[key] = true;
      list.push(key);
    });
    state.execContribution.draftUserIds = list;
  }

  function syncExecContributionSelectionText() {
    if (!dom.execContributionSelectionText) return;
    var selected = Array.isArray(state.execContribution.selectedUserIds) ? state.execContribution.selectedUserIds : [];
    if (!selected.length) {
      dom.execContributionSelectionText.textContent = '未选择';
      return;
    }
    var nameMap = getActivityUserNameMap();
    var names = selected.map(function(id) { return nameMap[id] || ('用户#' + id); });
    var shown = names.slice(0, 3);
    var suffix = names.length > shown.length ? (' 等' + names.length + ' 人') : '';
    dom.execContributionSelectionText.textContent = shown.join('、') + suffix;
  }

  function syncExecContributionUserGrid() {
    if (!dom.execContributionUserGrid) return;
    var list = Array.isArray(state.users) ? state.users : [];
    var draft = Array.isArray(state.execContribution.draftUserIds) ? state.execContribution.draftUserIds : [];
    var selectedMap = {};
    draft.forEach(function(id) { selectedMap[String(id)] = true; });
    if (!list.length) {
      dom.execContributionUserGrid.innerHTML = '';
      if (dom.execContributionUserEmpty) dom.execContributionUserEmpty.classList.remove('hidden');
      if (dom.execContributionSelectAll) dom.execContributionSelectAll.checked = false;
      return;
    }
    if (dom.execContributionUserEmpty) dom.execContributionUserEmpty.classList.add('hidden');
    dom.execContributionUserGrid.innerHTML = list.map(function(u) {
      if (!u || u.id === null || u.id === undefined) return '';
      var id = String(u.id);
      var checked = selectedMap[id] ? ' checked' : '';
      return (
        '<label class="ops-activity-user-chip">' +
          '<input type="checkbox" data-ops-exec-contribution-user="' + escapeHtml(id) + '"' + checked + ' />' +
          '<span>' + escapeHtml(u.username || ('用户#' + id)) + '</span>' +
        '</label>'
      );
    }).join('');
    if (dom.execContributionSelectAll) {
      dom.execContributionSelectAll.checked = draft.length && draft.length === list.length;
    }
  }

  function applyOpsOverviewView(view, options) {
    var next = normalizeOpsOverviewView(view);
    state.overviewView = next;
    if (dom.activityCard && dom.activityCard.classList) {
      dom.activityCard.classList.toggle('hidden', next !== 'activity');
    }
    if (dom.contributionCard && dom.contributionCard.classList) {
      dom.contributionCard.classList.toggle('hidden', next !== 'contribution');
    }
    if (dom.execContributionCard && dom.execContributionCard.classList) {
      dom.execContributionCard.classList.toggle('hidden', next !== 'exec-contribution');
    }
    if (!options || options.refresh !== false) {
      if (next === 'contribution') refreshContributionView(true);
      else if (next === 'exec-contribution') refreshExecContributionView(true);
      else refreshActivityView(true);
    }
    if (!options || options.persist !== false) {
      persistViewState();
    }
  }

  function getSelectedActivityBehaviorKeys() {
    var selected = state.activity.selectedBehaviors || {};
    if (selected.all) return [];
    var keys = [];
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (selected[key]) keys.push(key);
    });
    if (!keys.length) return [];
    return keys;
  }

  function syncActivityBehaviorSelection() {
    var behaviors = Array.isArray(state.activity.behaviors) ? state.activity.behaviors : [];
    var selected = state.activity.selectedBehaviors || { all: true };
    if (selected.all) return;
    var available = {};
    behaviors.forEach(function(item) {
      if (!item || !item.key) return;
      available[item.key] = true;
    });
    var keys = [];
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (selected[key] && available[key]) keys.push(key);
    });
    if (!keys.length) {
      state.activity.selectedBehaviors = { all: true };
      return;
    }
    var next = { all: false };
    keys.forEach(function(key) { next[key] = true; });
    state.activity.selectedBehaviors = next;
  }

  function syncActivityBehaviorFilters() {
    if (!dom.activityBehaviorGrid) return;
    var selected = state.activity.selectedBehaviors || { all: true };
    var list = Array.isArray(state.activity.behaviors) ? state.activity.behaviors : [];
    if (!list.length) {
      dom.activityBehaviorGrid.innerHTML = '<span class="hint">暂无可用行为</span>';
      return;
    }
    var html = [];
    var allChecked = selected.all ? ' checked' : '';
    html.push(
      '<label class="ops-activity-filter-chip">' +
        '<input type="checkbox" data-ops-activity-behavior="all"' + allChecked + ' />' +
        '<span>全部</span>' +
      '</label>'
    );
    list.forEach(function(item) {
      if (!item || !item.key) return;
      var checked = '';
      if (selected.all) checked = '';
      else if (selected[item.key]) checked = ' checked';
      html.push(
        '<label class="ops-activity-filter-chip">' +
          '<input type="checkbox" data-ops-activity-behavior="' + escapeHtml(item.key) + '"' + checked + ' />' +
          '<span>' + escapeHtml(item.label || item.key) + ' ' + item.count + '</span>' +
        '</label>'
      );
    });
    dom.activityBehaviorGrid.innerHTML = html.join('');
  }

  function syncActivityTimeRange() {
    if (!dom.activityTimeRange) return;
    var value = state.activity.timeRange || DEFAULT_ACTIVITY_RANGE;
    dom.activityTimeRange.value = value;
  }

  function syncActivityDateRange() {
    if (dom.activityDateStart) dom.activityDateStart.value = state.activity.dateStart || '';
    if (dom.activityDateEnd) dom.activityDateEnd.value = state.activity.dateEnd || '';
  }

  function getSelectedContributionBehaviorKeys() {
    var selected = state.contribution.selectedBehaviors || {};
    if (selected.all) return [];
    var keys = [];
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (selected[key]) keys.push(key);
    });
    if (!keys.length) return [];
    return keys;
  }

  function syncContributionBehaviorSelection() {
    var behaviors = Array.isArray(state.contribution.behaviors) ? state.contribution.behaviors : [];
    var selected = state.contribution.selectedBehaviors || { all: true };
    if (selected.all) return;
    var available = {};
    behaviors.forEach(function(item) {
      if (!item || !item.key) return;
      available[item.key] = true;
    });
    var keys = [];
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (selected[key] && available[key]) keys.push(key);
    });
    if (!keys.length) {
      state.contribution.selectedBehaviors = { all: true };
      return;
    }
    var next = { all: false };
    keys.forEach(function(key) { next[key] = true; });
    state.contribution.selectedBehaviors = next;
  }

  function syncContributionBehaviorFilters() {
    if (!dom.contributionBehaviorGrid) return;
    var selected = state.contribution.selectedBehaviors || { all: true };
    var list = Array.isArray(state.contribution.behaviors) ? state.contribution.behaviors : [];
    var html = [];
    var allChecked = selected.all ? ' checked' : '';
    html.push(
      '<label class="ops-activity-filter-chip">' +
        '<input type="checkbox" data-ops-contribution-behavior="all"' + allChecked + ' />' +
        '<span>全部</span>' +
      '</label>'
    );
    var source = list.length ? list : CONTRIBUTION_BEHAVIORS.map(function(item) {
      return { key: item.key, label: item.label, count: 0 };
    });
    source.forEach(function(item) {
      if (!item || !item.key) return;
      var checked = '';
      if (selected.all) checked = '';
      else if (selected[item.key]) checked = ' checked';
      html.push(
        '<label class="ops-activity-filter-chip">' +
          '<input type="checkbox" data-ops-contribution-behavior="' + escapeHtml(item.key) + '"' + checked + ' />' +
          '<span>' + escapeHtml(item.label || item.key) + ' ' + item.count + '</span>' +
        '</label>'
      );
    });
    dom.contributionBehaviorGrid.innerHTML = html.join('');
  }

  function syncContributionTimeRange() {
    if (!dom.contributionTimeRange) return;
    var value = state.contribution.timeRange || DEFAULT_ACTIVITY_RANGE;
    dom.contributionTimeRange.value = value;
  }

  function syncContributionDateRange() {
    if (dom.contributionDateStart) dom.contributionDateStart.value = state.contribution.dateStart || '';
    if (dom.contributionDateEnd) dom.contributionDateEnd.value = state.contribution.dateEnd || '';
  }

  function getSelectedExecContributionBehaviorKeys() {
    var selected = state.execContribution.selectedBehaviors || {};
    if (selected.all) return [];
    var keys = [];
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (selected[key]) keys.push(key);
    });
    if (!keys.length) return [];
    return keys;
  }

  function syncExecContributionBehaviorSelection() {
    var behaviors = Array.isArray(state.execContribution.behaviors) ? state.execContribution.behaviors : [];
    var selected = state.execContribution.selectedBehaviors || { all: true };
    if (selected.all) return;
    var available = {};
    behaviors.forEach(function(item) {
      if (!item || !item.key) return;
      available[item.key] = true;
    });
    var keys = [];
    Object.keys(selected).forEach(function(key) {
      if (key === 'all') return;
      if (selected[key] && available[key]) keys.push(key);
    });
    if (!keys.length) {
      state.execContribution.selectedBehaviors = { all: true };
      return;
    }
    var next = { all: false };
    keys.forEach(function(key) { next[key] = true; });
    state.execContribution.selectedBehaviors = next;
  }

  function syncExecContributionBehaviorFilters() {
    if (!dom.execContributionBehaviorGrid) return;
    var selected = state.execContribution.selectedBehaviors || { all: true };
    var list = Array.isArray(state.execContribution.behaviors) ? state.execContribution.behaviors : [];
    var html = [];
    var allChecked = selected.all ? ' checked' : '';
    html.push(
      '<label class="ops-activity-filter-chip">' +
        '<input type="checkbox" data-ops-exec-contribution-behavior="all"' + allChecked + ' />' +
        '<span>全部</span>' +
      '</label>'
    );
    var source = list.length ? list : EXEC_CONTRIBUTION_BEHAVIORS.map(function(item) {
      return { key: item.key, label: item.label, count: 0 };
    });
    source.forEach(function(item) {
      if (!item || !item.key) return;
      var checked = '';
      if (selected.all) checked = '';
      else if (selected[item.key]) checked = ' checked';
      html.push(
        '<label class="ops-activity-filter-chip">' +
          '<input type="checkbox" data-ops-exec-contribution-behavior="' + escapeHtml(item.key) + '"' + checked + ' />' +
          '<span>' + escapeHtml(item.label || item.key) + ' ' + item.count + '</span>' +
        '</label>'
      );
    });
    dom.execContributionBehaviorGrid.innerHTML = html.join('');
  }

  function syncExecContributionTimeRange() {
    if (!dom.execContributionTimeRange) return;
    var value = state.execContribution.timeRange || DEFAULT_ACTIVITY_RANGE;
    dom.execContributionTimeRange.value = value;
  }

  function syncExecContributionDateRange() {
    if (dom.execContributionDateStart) dom.execContributionDateStart.value = state.execContribution.dateStart || '';
    if (dom.execContributionDateEnd) dom.execContributionDateEnd.value = state.execContribution.dateEnd || '';
  }

  function getActivityRangeStartMs() {
    var range = state.activity.timeRange || DEFAULT_ACTIVITY_RANGE;
    if (range === 'all') return Date.now() - 365 * 24 * 60 * 60 * 1000;
    var now = new Date();
    if (range === 'year') return new Date(now.getFullYear(), 0, 1).getTime();
    if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (range === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (range === 'week') {
      var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var day = base.getDay();
      var diff = day === 0 ? 6 : day - 1;
      base.setDate(base.getDate() - diff);
      return base.getTime();
    }
    return null;
  }

  function getActivityDateRangeMs() {
    var range = getDateRangeMs(state.activity.dateStart, state.activity.dateEnd);
    if (range.startMs !== null || range.endMs !== null) return range;
    return { startMs: getActivityRangeStartMs(), endMs: null };
  }

  function getContributionRangeStartMs() {
    var range = state.contribution.timeRange || DEFAULT_ACTIVITY_RANGE;
    if (range === 'all') return Date.now() - 365 * 24 * 60 * 60 * 1000;
    var now = new Date();
    if (range === 'year') return new Date(now.getFullYear(), 0, 1).getTime();
    if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (range === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (range === 'week') {
      var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var day = base.getDay();
      var diff = day === 0 ? 6 : day - 1;
      base.setDate(base.getDate() - diff);
      return base.getTime();
    }
    return null;
  }

  function getContributionDateRangeMs() {
    var range = getDateRangeMs(state.contribution.dateStart, state.contribution.dateEnd);
    if (range.startMs !== null || range.endMs !== null) return range;
    return { startMs: getContributionRangeStartMs(), endMs: null };
  }

  function getExecContributionRangeStartMs() {
    var range = state.execContribution.timeRange || DEFAULT_ACTIVITY_RANGE;
    if (range === 'all') return Date.now() - 365 * 24 * 60 * 60 * 1000;
    var now = new Date();
    if (range === 'year') return new Date(now.getFullYear(), 0, 1).getTime();
    if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (range === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (range === 'week') {
      var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var day = base.getDay();
      var diff = day === 0 ? 6 : day - 1;
      base.setDate(base.getDate() - diff);
      return base.getTime();
    }
    return null;
  }

  function getExecContributionDateRangeMs() {
    var range = getDateRangeMs(state.execContribution.dateStart, state.execContribution.dateEnd);
    if (range.startMs !== null || range.endMs !== null) return range;
    return { startMs: getExecContributionRangeStartMs(), endMs: null };
  }

  var INVISIBLE_MARKER_RE = /[\u200b\u200c\u200d\u2060\ufeff]/g;

  function normalizeCaseText(value) {
    if (value === null || value === undefined) return '';
    try {
      return String(value).replace(INVISIBLE_MARKER_RE, '').trim();
    } catch (err) {
      return '';
    }
  }

  function readDetailBool(detail, key) {
    if (!detail || typeof detail !== 'object') return null;
    if (!(key in detail)) return null;
    var raw = detail[key];
    if (raw === true || raw === false) return raw;
    if (typeof raw === 'string') {
      var v = raw.trim().toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
    }
    return null;
  }

  function getPositiveNumber(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 0;
    return n;
  }

  function isCaseItemCompleteFromDetail(detail) {
    if (!detail || typeof detail !== 'object') return null;
    var moduleText = normalizeCaseText(detail.module);
    var titleText = normalizeCaseText(detail.title);
    var preText = normalizeCaseText(detail.precondition);
    var stepsText = normalizeCaseText(detail.steps);
    var expectedText = normalizeCaseText(detail.expected);
    if (!moduleText || !titleText || !preText || !stepsText || !expectedText) return false;
    return true;
  }

  function isCaseItemDeleteCompleteFromDetail(detail) {
    if (!detail || typeof detail !== 'object') return null;
    var titleText = normalizeCaseText(detail.title);
    var preText = normalizeCaseText(detail.precondition);
    var stepsText = normalizeCaseText(detail.steps);
    var expectedText = normalizeCaseText(detail.expected);
    if (!titleText || !preText || !stepsText || !expectedText) return false;
    return true;
  }

  function getContributionBehaviorLabel(key) {
    var k = String(key || '').trim();
    var match = CONTRIBUTION_BEHAVIORS.filter(function(item) { return item.key === k; })[0];
    return match && match.label ? match.label : k;
  }

  function getExecContributionBehaviorLabel(key) {
    var k = String(key || '').trim();
    var match = EXEC_CONTRIBUTION_BEHAVIORS.filter(function(item) { return item.key === k; })[0];
    return match && match.label ? match.label : k;
  }

  function getFilteredActivityLogs() {
    var list = Array.isArray(state.activity.logs) ? state.activity.logs : [];
    var selectedIds = Array.isArray(state.activity.selectedUserIds) ? state.activity.selectedUserIds : [];
    if (!selectedIds.length) return [];
    var allowed = {};
    selectedIds.forEach(function(id) { allowed[String(id)] = true; });
    var range = getActivityDateRangeMs();
    return list.filter(function(log) {
      if (!log || (!log._aggregate && !isAllowedLog(log))) return false;
      var userId = (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
      if (!userId || !allowed[userId]) return false;
      if (!log._aggregate && !isTimeInRange(log.created_at, range)) return false;
      return true;
    });
  }

  function getFilteredContributionLogs() {
    var list = Array.isArray(state.contribution.logs) ? state.contribution.logs : [];
    var selectedIds = Array.isArray(state.contribution.selectedUserIds) ? state.contribution.selectedUserIds : [];
    if (!selectedIds.length) return [];
    var allowed = {};
    selectedIds.forEach(function(id) { allowed[String(id)] = true; });
    var range = getContributionDateRangeMs();
    return list.filter(function(log) {
      if (!log) return false;
      var userId = (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
      if (!userId || !allowed[userId]) return false;
      if (!log._aggregate && !isTimeInRange(log.created_at, range)) return false;
      return true;
    });
  }

  function getFilteredExecContributionLogs() {
    var list = Array.isArray(state.execContribution.logs) ? state.execContribution.logs : [];
    var selectedIds = Array.isArray(state.execContribution.selectedUserIds) ? state.execContribution.selectedUserIds : [];
    if (!selectedIds.length) return [];
    var allowed = {};
    selectedIds.forEach(function(id) { allowed[String(id)] = true; });
    var range = getExecContributionDateRangeMs();
    return list.filter(function(log) {
      if (!log) return false;
      var userId = (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
      if (!userId || !allowed[userId]) return false;
      if (!log._aggregate && !isTimeInRange(log.created_at, range)) return false;
      return true;
    });
  }

  function resolveContributionEntry(log) {
    if (log && log._aggregate) return { key: log.key, count: log.count };
    if (!log || typeof log !== 'object') return null;
    var action = normalizeAction(log.action);
    var detail = log.detail && typeof log.detail === 'object' ? log.detail : {};
    if (action === 'import_case_file' || action === 'overwrite_case_file') {
      var imported = getPositiveNumber(detail.item_imported);
      if (!imported) imported = getPositiveNumber(detail.item_unique);
      if (!imported) return null;
      return { key: 'import', label: getContributionBehaviorLabel('import'), count: imported };
    }
    if (action === 'append_case_items') {
      var appendedComplete = getPositiveNumber(detail.item_appended_complete);
      var appended = appendedComplete || getPositiveNumber(detail.item_appended);
      if (!appended) return null;
      return { key: 'add', label: getContributionBehaviorLabel('add'), count: appended };
    }
    if (action === 'create_case_item') {
      var createdComplete = readDetailBool(detail, 'next_complete');
      if (createdComplete === null) createdComplete = readDetailBool(detail, 'complete');
      if (createdComplete === null) {
        var resolvedCreate = isCaseItemCompleteFromDetail(detail);
        if (resolvedCreate !== null) createdComplete = resolvedCreate;
      }
      if (!createdComplete) return null;
      return { key: 'add', label: getContributionBehaviorLabel('add'), count: 1 };
    }
    if (action === 'update_case_item') {
      var prevComplete = readDetailBool(detail, 'prev_complete');
      var nextComplete = readDetailBool(detail, 'next_complete');
      if (prevComplete === null || nextComplete === null) {
        var resolvedUpdate = isCaseItemCompleteFromDetail(detail);
        if (nextComplete === null && resolvedUpdate !== null) nextComplete = resolvedUpdate;
      }
      if (prevComplete === false && nextComplete === true) {
        return { key: 'add', label: getContributionBehaviorLabel('add'), count: 1 };
      }
      return null;
    }
    if (action === 'delete_case_item') {
      var deleteComplete = readDetailBool(detail, 'prev_delete_complete');
      if (deleteComplete === null) deleteComplete = readDetailBool(detail, 'prev_complete');
      if (deleteComplete === null) deleteComplete = readDetailBool(detail, 'complete');
      if (deleteComplete === null) {
        var resolvedDelete = isCaseItemDeleteCompleteFromDetail(detail);
        if (resolvedDelete !== null) deleteComplete = resolvedDelete;
      }
      if (!deleteComplete) return null;
      return { key: 'delete', label: getContributionBehaviorLabel('delete'), count: 1 };
    }
    if (action === 'delete_case_file') {
      var deletedComplete = getPositiveNumber(detail.item_deleted_complete);
      if (!deletedComplete) return null;
      return { key: 'delete', label: getContributionBehaviorLabel('delete'), count: deletedComplete };
    }
    if (action === 'create_missing_case_item') {
      return { key: 'add', label: getContributionBehaviorLabel('add'), count: 1 };
    }
    if (action === 'update_missing_case_item') {
      return { key: 'edit', label: getContributionBehaviorLabel('edit'), count: 1 };
    }
    if (action === 'delete_missing_case_item') {
      return { key: 'delete', label: getContributionBehaviorLabel('delete'), count: 1 };
    }
    return null;
  }

  function normalizeExecCaseKey(detail) {
    if (!detail || typeof detail !== 'object') return '';
    var execSetId = (detail.exec_set_id || detail.exec_set_id === 0) ? String(detail.exec_set_id) : '';
    var moduleText = normalizeCaseText(detail.module);
    var titleText = normalizeCaseText(detail.title);
    var preText = normalizeCaseText(detail.precondition);
    var stepsText = normalizeCaseText(detail.steps);
    var expectedText = normalizeCaseText(detail.expected);
    var caseKey = [moduleText, titleText, preText, stepsText, expectedText].join('::');
    if (execSetId) return execSetId + '::' + caseKey;
    return caseKey;
  }

  function resolveExecCaseFileName(detail) {
    if (!detail || typeof detail !== 'object') return '';
    var fileName = normalizeCaseText(detail.case_file_name);
    if (!fileName) fileName = normalizeCaseText(detail.file_name);
    if (!fileName) fileName = normalizeCaseText(detail.exec_set_name);
    return fileName;
  }

  function readChangedFields(detail) {
    if (!detail || typeof detail !== 'object') return [];
    var raw = detail.changed_fields;
    if (Array.isArray(raw)) return raw.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
    if (typeof raw === 'string') {
      var parts = raw.split(',').map(function(item) { return String(item || '').trim(); }).filter(Boolean);
      if (parts.length) return parts;
    }
    return [];
  }

  function isExecCaseRunEvent(detail) {
    if (!detail || typeof detail !== 'object') return false;
    var changed = readChangedFields(detail);
    var hasSignal = changed.indexOf('status') !== -1 || changed.indexOf('actual_result') !== -1 || changed.indexOf('reuse_details') !== -1;
    if (!hasSignal) return false;
    return resolveExecCaseExecutedState(detail) === true;
  }

  function isExecCaseExecuted(detail) {
    if (!detail || typeof detail !== 'object') return false;
    var changed = readChangedFields(detail);
    var hasChanged = changed.indexOf('status') !== -1 || changed.indexOf('actual_result') !== -1;
    var statusRaw = String(detail.status || '').trim();
    var statusLower = statusRaw.toLowerCase();
    var pendingMap = {
      '': true,
      'pending': true,
      '未执行': true,
      '变更重跑': true,
      '有改动': true,
    };
    var hasStatus = Boolean(statusRaw) && !pendingMap[statusRaw] && !pendingMap[statusLower];
    var actualText = normalizeCaseText(detail.actual_result);
    if (hasChanged || hasStatus || actualText) return true;
    return false;
  }

  function resolveReuseMeta(detail) {
    if (!detail || typeof detail !== 'object') return { isReuse: false, executedCount: null, totalCount: null };
    var total = Number(detail.reuse_total_count);
    var executed = Number(detail.reuse_executed_count);
    var totalOk = Number.isFinite(total) && total > 0;
    var executedOk = Number.isFinite(executed) && executed >= 0;
    var changed = readChangedFields(detail);
    var hasReuseFlag = totalOk || changed.indexOf('reuse_details') !== -1;
    return {
      isReuse: hasReuseFlag,
      executedCount: totalOk && executedOk ? executed : null,
      totalCount: totalOk ? total : null,
    };
  }

  function resolveExecCaseExecutedState(detail) {
    var reuseMeta = resolveReuseMeta(detail);
    if (reuseMeta.totalCount !== null && reuseMeta.executedCount !== null) {
      return reuseMeta.executedCount > 0;
    }
    return isExecCaseExecuted(detail);
  }

  function resolveExecContributionEntry(log) {
    if (log && log._aggregate) return { key: log.key, count: log.count };
    if (!log || typeof log !== 'object') return null;
    var action = normalizeAction(log.action);
    var detail = log.detail && typeof log.detail === 'object' ? log.detail : {};
    if (action === 'update_exec_case') {
      if (!isExecCaseExecuted(detail)) return null;
      var caseKey = normalizeExecCaseKey(detail);
      if (!caseKey) return null;
      return { key: 'exec', label: getExecContributionBehaviorLabel('exec'), count: 1, caseKey: caseKey };
    }
    if (action === 'archive_exec_set') {
      var archived = getPositiveNumber(detail.actual_result_count);
      if (!archived) return null;
      return { key: 'archive', label: getExecContributionBehaviorLabel('archive'), count: archived };
    }
    return null;
  }

  function buildActivityViewData(logs) {
    var nameMap = getActivityUserNameMap();
    var userMap = {};
    var behaviorTotals = {};
    logs.forEach(function(log) {
      var label = log._aggregate ? log.key : resolveActivityActionLabel(log);
      if (!label) return;
      var userId = (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
      if (!userId) return;
      var entry = userMap[userId];
      if (!entry) {
        var fallbackName = nameMap[userId] || ('用户#' + userId);
        entry = { id: userId, name: String(log.username || fallbackName), total: 0, behaviors: {} };
        userMap[userId] = entry;
      }
      var count = log._aggregate ? log.count : 1;
      entry.total += count;
      entry.behaviors[label] = (entry.behaviors[label] || 0) + count;
      behaviorTotals[label] = (behaviorTotals[label] || 0) + count;
    });

    var behaviorList = Object.keys(behaviorTotals).map(function(key) {
      return { key: key, label: key, count: behaviorTotals[key] };
    }).sort(function(a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label || '').localeCompare(String(b.label || ''));
    });
    state.activity.behaviors = behaviorList;
    syncActivityBehaviorSelection();

    var selected = state.activity.selectedBehaviors || { all: true };
    var allowAll = selected.all;
    var allowMap = {};
    if (!allowAll) {
      Object.keys(selected).forEach(function(key) {
        if (key === 'all') return;
        if (selected[key]) allowMap[key] = true;
      });
    }

    var users = [];
    Object.keys(userMap).forEach(function(id) {
      var entry = userMap[id];
      var actions = [];
      var total = 0;
      Object.keys(entry.behaviors).forEach(function(label) {
        if (!allowAll && !allowMap[label]) return;
        var count = entry.behaviors[label];
        if (!count) return;
        total += count;
        actions.push({ label: label, count: count });
      });
      if (!total) return;
      actions.sort(function(a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.label || '').localeCompare(String(b.label || ''));
      });
      users.push({ id: entry.id, name: entry.name, total: total, actions: actions });
    });
    if (users.length > 1) {
      users.sort(function(a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }
    return users;
  }

  function buildContributionViewData(logs) {
    var nameMap = getActivityUserNameMap();
    var userMap = {};
    var behaviorTotals = {};
    CONTRIBUTION_BEHAVIORS.forEach(function(item) {
      if (!item || !item.key) return;
      behaviorTotals[item.key] = 0;
    });

    logs.forEach(function(log) {
      var entry = resolveContributionEntry(log);
      if (!entry || !entry.key) return;
      var userId = (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
      if (!userId) return;
      var entryCount = getPositiveNumber(entry.count);
      if (!entryCount) return;
      var record = userMap[userId];
      if (!record) {
        var fallbackName = nameMap[userId] || ('用户#' + userId);
        record = { id: userId, name: String(log.username || fallbackName), total: 0, behaviors: {} };
        userMap[userId] = record;
      }
      record.total += entryCount;
      record.behaviors[entry.key] = (record.behaviors[entry.key] || 0) + entryCount;
      behaviorTotals[entry.key] = (behaviorTotals[entry.key] || 0) + entryCount;
    });

    state.contribution.behaviors = CONTRIBUTION_BEHAVIORS.map(function(item) {
      return {
        key: item.key,
        label: item.label,
        count: behaviorTotals[item.key] || 0,
      };
    });
    syncContributionBehaviorSelection();

    var selected = state.contribution.selectedBehaviors || { all: true };
    var allowAll = selected.all;
    var allowMap = {};
    if (!allowAll) {
      Object.keys(selected).forEach(function(key) {
        if (key === 'all') return;
        if (selected[key]) allowMap[key] = true;
      });
    }

    var users = [];
    Object.keys(userMap).forEach(function(id) {
      var entry = userMap[id];
      var actions = [];
      var total = 0;
      Object.keys(entry.behaviors).forEach(function(key) {
        if (!allowAll && !allowMap[key]) return;
        var count = entry.behaviors[key];
        if (!count) return;
        total += count;
        actions.push({ key: key, label: getContributionBehaviorLabel(key), count: count });
      });
      if (!total) return;
      actions.sort(function(a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.label || '').localeCompare(String(b.label || ''));
      });
      users.push({ id: entry.id, name: entry.name, total: total, actions: actions });
    });
    if (users.length > 1) {
      users.sort(function(a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }
    return users;
  }

  function buildExecContributionViewData(logs) {
    var nameMap = getActivityUserNameMap();
    var userMap = {};
    var behaviorTotals = {};
    var execCaseDedup = {};
    EXEC_CONTRIBUTION_BEHAVIORS.forEach(function(item) {
      if (!item || !item.key) return;
      behaviorTotals[item.key] = 0;
    });

    logs.forEach(function(log) {
      var entry = resolveExecContributionEntry(log);
      if (!entry || !entry.key) return;
      var userId = (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
      if (!userId) return;
      var entryCount = getPositiveNumber(entry.count);
      if (entry.key === 'exec' && !log._aggregate) {
        var caseKey = String(entry.caseKey || '').trim();
        if (!caseKey) return;
        if (!execCaseDedup[userId]) execCaseDedup[userId] = {};
        if (execCaseDedup[userId][caseKey]) return;
        execCaseDedup[userId][caseKey] = true;
        entryCount = 1;
      }
      if (!entryCount) return;
      var record = userMap[userId];
      if (!record) {
        var fallbackName = nameMap[userId] || ('用户#' + userId);
        record = { id: userId, name: String(log.username || fallbackName), total: 0, behaviors: {} };
        userMap[userId] = record;
      }
      record.total += entryCount;
      record.behaviors[entry.key] = (record.behaviors[entry.key] || 0) + entryCount;
      behaviorTotals[entry.key] = (behaviorTotals[entry.key] || 0) + entryCount;
    });

    state.execContribution.behaviors = EXEC_CONTRIBUTION_BEHAVIORS.map(function(item) {
      return {
        key: item.key,
        label: item.label,
        count: behaviorTotals[item.key] || 0,
      };
    });
    syncExecContributionBehaviorSelection();

    var selected = state.execContribution.selectedBehaviors || { all: true };
    var allowAll = selected.all;
    var allowMap = {};
    if (!allowAll) {
      Object.keys(selected).forEach(function(key) {
        if (key === 'all') return;
        if (selected[key]) allowMap[key] = true;
      });
    }

    var users = [];
    Object.keys(userMap).forEach(function(id) {
      var entry = userMap[id];
      var execCount = entry.behaviors.exec || 0;
      var archiveCount = entry.behaviors.archive || 0;
      if (!allowAll && !allowMap.exec) execCount = 0;
      if (!allowAll && !allowMap.archive) archiveCount = 0;
      var total = execCount + archiveCount;
      if (!total) return;
      users.push({
        id: entry.id,
        name: entry.name,
        execCount: execCount,
        archiveCount: archiveCount,
        total: total,
      });
    });
    if (users.length > 1) {
      users.sort(function(a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }
    return users;
  }

  function renderActivityView() {
    if (!dom.activityList || !dom.activityEmpty) return;
    syncActivitySelectionText();
    if (!canView()) {
      dom.activityList.innerHTML = '';
      dom.activityEmpty.textContent = '仅管理员可查看活跃度';
      dom.activityEmpty.classList.remove('hidden');
      setStatus(dom.activityStatus, '仅管理员可查看活跃度', 'warn');
      state.activity.behaviors = [];
      syncActivityBehaviorFilters();
      return;
    }
    if (!state.activity.hasSelection || !state.activity.selectedUserIds.length) {
      dom.activityList.innerHTML = '';
      dom.activityEmpty.textContent = '请先选择人员查看活跃度';
      dom.activityEmpty.classList.remove('hidden');
      setStatus(dom.activityStatus, '', '');
      state.activity.behaviors = [];
      syncActivityBehaviorFilters();
      return;
    }
    var filteredLogs = getFilteredActivityLogs();
    var users = buildActivityViewData(filteredLogs);
    syncActivityBehaviorFilters();
    var nameMap = getActivityUserNameMap();
    users = appendMissingUsers(users, state.activity.selectedUserIds, function(id) {
      return {
        id: id,
        name: nameMap[id] || ('用户#' + id),
        total: 0,
        actions: [],
      };
    });
    if (!users.length) {
      dom.activityList.innerHTML = '';
      dom.activityEmpty.textContent = filteredLogs.length ? '筛选后暂无活跃度数据' : '暂无活跃度数据';
      dom.activityEmpty.classList.remove('hidden');
      return;
    }
    var maxTotal = 0;
    users.forEach(function(user) {
      if (user.total > maxTotal) maxTotal = user.total;
    });
    dom.activityEmpty.classList.add('hidden');
    dom.activityList.innerHTML = users.map(function(user) {
      var total = user.total || 0;
      var trackWidth = maxTotal ? (total / maxTotal) * ACTIVITY_BAR_MAX_RATIO : 0;
      var segments = user.actions.map(function(item) {
        var width = total ? (item.count / total) * 100 : 0;
        var label = item.label || '';
        var title = label + ' ' + item.count;
        return (
          '<span class="ops-activity-bar-seg" title="' + escapeHtml(title) + '" style="width:' + width.toFixed(2) + '%;background:' + getActivityColor(label) + ';"></span>'
        );
      }).join('');
      return (
        '<div class="ops-activity-row">' +
          '<div class="ops-activity-user">' + escapeHtml(user.name) + '</div>' +
          '<div class="ops-activity-bar">' +
            '<div class="ops-activity-bar-track" style="width:' + trackWidth.toFixed(2) + '%;">' + segments + '</div>' +
            '<div class="ops-activity-count">' + total + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderContributionView() {
    if (!dom.contributionList || !dom.contributionEmpty) return;
    syncContributionSelectionText();
    if (!canView()) {
      dom.contributionList.innerHTML = '';
      dom.contributionEmpty.textContent = '仅管理员可查看用例贡献';
      dom.contributionEmpty.classList.remove('hidden');
      setStatus(dom.contributionStatus, '仅管理员可查看用例贡献', 'warn');
      state.contribution.behaviors = [];
      syncContributionBehaviorFilters();
      return;
    }
    if (!state.contribution.hasSelection || !state.contribution.selectedUserIds.length) {
      dom.contributionList.innerHTML = '';
      dom.contributionEmpty.textContent = '请先选择人员查看用例贡献';
      dom.contributionEmpty.classList.remove('hidden');
      setStatus(dom.contributionStatus, '', '');
      state.contribution.behaviors = [];
      syncContributionBehaviorFilters();
      return;
    }
    var filteredLogs = getFilteredContributionLogs();
    var users = buildContributionViewData(filteredLogs);
    syncContributionBehaviorFilters();
    var nameMap = getActivityUserNameMap();
    users = appendMissingUsers(users, state.contribution.selectedUserIds, function(id) {
      return {
        id: id,
        name: nameMap[id] || ('用户#' + id),
        total: 0,
        actions: [],
      };
    });
    if (!users.length) {
      dom.contributionList.innerHTML = '';
      dom.contributionEmpty.textContent = filteredLogs.length ? '筛选后暂无贡献数据' : '暂无贡献数据';
      dom.contributionEmpty.classList.remove('hidden');
      return;
    }
    var maxTotal = 0;
    users.forEach(function(user) {
      if (user.total > maxTotal) maxTotal = user.total;
    });
    dom.contributionEmpty.classList.add('hidden');
    dom.contributionList.innerHTML = users.map(function(user) {
      var total = user.total || 0;
      var trackWidth = maxTotal ? (total / maxTotal) * ACTIVITY_BAR_MAX_RATIO : 0;
      var segments = user.actions.map(function(item) {
        var width = total ? (item.count / total) * 100 : 0;
        var label = item.label || '';
        var title = label + ' ' + item.count;
        return (
          '<span class="ops-activity-bar-seg" title="' + escapeHtml(title) + '" style="width:' + width.toFixed(2) + '%;background:' + getContributionColor(label) + ';"></span>'
        );
      }).join('');
      return (
        '<div class="ops-activity-row">' +
          '<div class="ops-activity-user">' + escapeHtml(user.name) + '</div>' +
          '<div class="ops-activity-bar">' +
            '<div class="ops-activity-bar-track" style="width:' + trackWidth.toFixed(2) + '%;">' + segments + '</div>' +
            '<div class="ops-activity-count">' + total + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderExecContributionView() {
    if (!dom.execContributionList || !dom.execContributionEmpty) return;
    syncExecContributionSelectionText();
    if (!canView()) {
      dom.execContributionList.innerHTML = '';
      dom.execContributionEmpty.textContent = '仅管理员可查看用例执行贡献';
      dom.execContributionEmpty.classList.remove('hidden');
      setStatus(dom.execContributionStatus, '仅管理员可查看用例执行贡献', 'warn');
      state.execContribution.behaviors = [];
      syncExecContributionBehaviorFilters();
      return;
    }
    if (!state.execContribution.hasSelection || !state.execContribution.selectedUserIds.length) {
      dom.execContributionList.innerHTML = '';
      dom.execContributionEmpty.textContent = '请先选择人员查看用例执行贡献';
      dom.execContributionEmpty.classList.remove('hidden');
      setStatus(dom.execContributionStatus, '', '');
      state.execContribution.behaviors = [];
      syncExecContributionBehaviorFilters();
      return;
    }
    var selected = state.execContribution.selectedBehaviors || { all: true };
    var allowExec = selected.all || Boolean(selected.exec);
    var allowArchive = selected.all || Boolean(selected.archive);
    if (!allowExec && !allowArchive) {
      allowExec = true;
      allowArchive = true;
    }
    var filteredLogs = getFilteredExecContributionLogs();
    var users = buildExecContributionViewData(filteredLogs);
    syncExecContributionBehaviorFilters();
    var nameMap = getActivityUserNameMap();
    users = appendMissingUsers(users, state.execContribution.selectedUserIds, function(id) {
      return {
        id: id,
        name: nameMap[id] || ('用户#' + id),
        execCount: 0,
        archiveCount: 0,
        total: 0,
      };
    });
    if (!users.length) {
      dom.execContributionList.innerHTML = '';
      dom.execContributionEmpty.textContent = filteredLogs.length ? '筛选后暂无贡献数据' : '暂无贡献数据';
      dom.execContributionEmpty.classList.remove('hidden');
      return;
    }
    var maxTotal = 0;
    users.forEach(function(user) {
      var maxItem = 0;
      if (allowExec) maxItem = Math.max(maxItem, user.execCount || 0);
      if (allowArchive) maxItem = Math.max(maxItem, user.archiveCount || 0);
      if (maxItem > maxTotal) maxTotal = maxItem;
    });
    dom.execContributionEmpty.classList.add('hidden');
    dom.execContributionList.innerHTML = users.map(function(user) {
      var execCount = user.execCount || 0;
      var archiveCount = user.archiveCount || 0;
      var execTrackWidth = maxTotal ? (execCount / maxTotal) * ACTIVITY_BAR_MAX_RATIO : 0;
      var archiveTrackWidth = maxTotal ? (archiveCount / maxTotal) * ACTIVITY_BAR_MAX_RATIO : 0;
      var bars = [];
      if (allowExec) {
        bars.push(
          '<div class="ops-activity-bar-item">' +
            '<div class="ops-activity-bar-label">执行</div>' +
            '<div class="ops-activity-bar-track exec-contribution" style="width:' + execTrackWidth.toFixed(2) + '%;">' +
              (execCount ? '<span class="ops-activity-bar-seg" title="执行 ' + execCount + '" style="width:100%;background:#3b82f6;"></span>' : '') +
            '</div>' +
            '<div class="ops-activity-count compact">' + execCount + '</div>' +
          '</div>'
        );
      }
      if (allowArchive) {
        bars.push(
          '<div class="ops-activity-bar-item">' +
            '<div class="ops-activity-bar-label">归档</div>' +
            '<div class="ops-activity-bar-track exec-contribution" style="width:' + archiveTrackWidth.toFixed(2) + '%;">' +
              (archiveCount ? '<span class="ops-activity-bar-seg" title="归档 ' + archiveCount + '" style="width:100%;background:#10b981;"></span>' : '') +
            '</div>' +
            '<div class="ops-activity-count compact">' + archiveCount + '</div>' +
          '</div>'
        );
      }
      return (
        '<div class="ops-activity-row ops-activity-row-stacked">' +
          '<div class="ops-activity-user">' + escapeHtml(user.name) + '</div>' +
          '<div class="ops-activity-bar ops-activity-bar-stack">' +
            bars.join('') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function setPagination(html) {
    if (dom.paginationTop) dom.paginationTop.innerHTML = html || '';
    if (dom.paginationBottom) dom.paginationBottom.innerHTML = html || '';
  }

  function buildPagination() {
    var disabled = state.loading ? 'disabled' : '';
    return '<div class="temp-pagination"><div class="temp-pagination-info">第 ' + (state.pageIndex + 1)
      + ' 页，本页 ' + state.logs.length + ' 条，每页最多 ' + getPageSize() + ' 条</div>'
      + '<div class="temp-pagination-controls">'
      + '<button type="button" class="secondary" data-ops-log-page="first" ' + (state.pageIndex <= 0 ? 'disabled' : disabled) + '>首页</button>'
      + '<button type="button" class="secondary" data-ops-log-page="prev" ' + (state.pageIndex <= 0 ? 'disabled' : disabled) + '>上一页</button>'
      + '<button type="button" class="secondary" data-ops-log-page="next" ' + (!state.nextCursor ? 'disabled' : disabled) + '>下一页</button>'
      + '</div></div>';
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
      if (k === 'mcp') return 'MCP 接入';
      if (k === 'settings') return '其他配置';
      if (k === 'models') return '模型管理';
      if (k === 'assign') return '功能指派';
      if (k === 'casesgen' || k === 'auto' || k === 'clean') return 'XMind 用例生成';
      if (k === 'login') return '系统平台';
      return k;
    }

    var fromDetail = fromTabKey(raw);
    if (fromDetail) return fromDetail;

    // 兜底：老日志缺少 page 时按 action 推断
    if (action === 'mcp_tool_call') return 'MCP 接入';
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

  function getFilteredLogs() {
    // 日期、人员、对象和行为均已在数据库中筛选，这里只持有当前页。
    return Array.isArray(state.logs) ? state.logs : [];
  }


  function getDownloadBlob() {
    if (utils && typeof utils.downloadBlob === 'function') return utils.downloadBlob;
    return null;
  }

  function getSimpleXlsxBuilder() {
    var api = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
    if (api && typeof api.buildSimpleXlsxBlob === 'function') return api.buildSimpleXlsxBlob;
    var coreApi = window.app && window.app.xlsxCoreApi ? window.app.xlsxCoreApi : null;
    if (coreApi && typeof coreApi.buildSimpleXlsxBlob === 'function') return coreApi.buildSimpleXlsxBlob;
    return null;
  }

  function formatExportTimestamp() {
    if (utils && typeof utils.formatCompactTimestamp === 'function') return utils.formatCompactTimestamp(new Date());
    var d = new Date();
    function pad(num) { return num < 10 ? '0' + num : String(num); }
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      '_' +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }

  function sanitizeDownloadName(base) {
    var name = String(base || '').trim() || '操作记录';
    name = name.replace(/\.[^.]+$/, '');
    name = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!name) name = '操作记录';
    return name;
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
        log.action_label || resolveActionLabel(log) || '--',
        resolveCountChangeLabel(log),
      ];
    });
    return [header].concat(body);
  }

  function exportDrawerLogs() {
    if (!canView()) {
      setStatus(dom.drawerStatusEl, '仅管理员可导出操作记录', 'warn');
      return;
    }
    var builder = getSimpleXlsxBuilder();
    if (!builder) {
      setStatus(dom.drawerStatusEl, 'Excel 导出能力未就绪', 'err');
      return;
    }
    var downloadBlob = getDownloadBlob();
    if (!downloadBlob) {
      setStatus(dom.drawerStatusEl, '导出失败：缺少下载能力', 'err');
      return;
    }
    var rows = getFilteredLogs();
    if (!rows.length) {
      setStatus(dom.drawerStatusEl, '暂无记录可导出', 'warn');
      return;
    }
    var fileName = sanitizeDownloadName('操作记录_' + formatExportTimestamp()) + '.xlsx';
    if (dom.drawerExportBtn) dom.drawerExportBtn.disabled = true;
    setStatus(dom.drawerStatusEl, '导出中：' + rows.length + ' 条记录', '');
    builder({
      sheets: [
        { name: '操作记录', rows: buildOpsLogExportRows(rows) },
      ],
    })
      .then(function(blob) {
        downloadBlob(fileName, blob);
        setStatus(dom.drawerStatusEl, '导出完成：' + rows.length + ' 条记录', 'ok');
      })
      .catch(function(err) {
        setStatus(dom.drawerStatusEl, '导出失败：' + (err && err.message ? err.message : '未知错误'), 'err');
      })
      .finally(function() {
        if (dom.drawerExportBtn) dom.drawerExportBtn.disabled = false;
      });
  }

  function renderList() {
    if (!dom.tableBody) return;
    var rows = getFilteredLogs();
    if (dom.emptyHint) dom.emptyHint.classList.toggle('hidden', rows.length > 0);
    setPagination(buildPagination());
    dom.tableBody.innerHTML = rows.map(function(log) {
      var operator = log && (log.username || log.user_id) ? String(log.username || log.user_id) : '--';
      return '<tr>'
        + '<td>' + escapeHtml(formatTime(log.created_at)) + '</td>'
        + '<td>' + escapeHtml(operator) + '</td>'
        + '<td>' + escapeHtml(resolvePageLabel(log)) + '</td>'
        + '<td>' + escapeHtml(buildTargetLabel(log)) + '</td>'
        + '<td>' + escapeHtml(log.action_label || resolveActionLabel(log) || log.action) + '</td>'
        + '<td>' + escapeHtml(resolveCountChangeLabel(log)) + '</td>'
        + '<td>' + escapeHtml(log.result === 'success' ? '成功' : log.result === 'failed' ? '失败' : log.result) + '</td>'
        + '<td><button class="secondary" type="button" data-ops-log-detail="' + log.id + '">详情</button></td></tr>';
    }).join('');
  }


  function handlePageSizeChanged() {
    if (state.drawerOpen && state.queryPageSize !== null && state.queryPageSize !== getPageSize()) loadLogs();
    if (state.overviewView === 'contribution') {
      renderContributionView();
      return;
    }
    if (state.overviewView === 'exec-contribution') {
      renderExecContributionView();
      return;
    }
    renderActivityView();
  }

  function loadUsers() {
    if (!apiClient.listUsers) return Promise.resolve([]);
    return apiClient
      .listUsers()
      .then(function(list) {
        state.users = Array.isArray(list) ? list : [];
        state.activity.usersLoaded = true;
        state.contribution.usersLoaded = true;
        state.execContribution.usersLoaded = true;
        syncUserSelect();
        syncActivityUserGrid();
        syncContributionUserGrid();
        syncActivitySelectionText();
        syncContributionSelectionText();
        syncExecContributionUserGrid();
        syncExecContributionSelectionText();
        return state.users;
      })
      .catch(function() {
        state.users = [];
        state.activity.usersLoaded = true;
        state.contribution.usersLoaded = true;
        state.execContribution.usersLoaded = true;
        syncUserSelect();
        syncActivityUserGrid();
        syncContributionUserGrid();
        syncActivitySelectionText();
        syncContributionSelectionText();
        syncExecContributionUserGrid();
        syncExecContributionSelectionText();
        return [];
      });
  }

  function loadLogs(options) {
    if (!apiClient.queryOperationLogs || !canView()) return Promise.resolve([]);
    var continuing = options && options.page === true;
    if (!continuing) {
      state.pageIndex = 0;
      state.cursors = [null];
    }
    var requestId = ++state.logRequestId;
    if (state.logController) state.logController.abort();
    state.logController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    state.loading = true;
    state.logs = [];
    state.nextCursor = null;
    state.detailRequestId += 1;
    var detailPanel = document.getElementById('opsLogDetailPanel');
    if (detailPanel) detailPanel.classList.add('hidden');
    renderList();
    if (dom.drawerRefreshBtn) dom.drawerRefreshBtn.disabled = true;
    if (dom.drawerExportBtn) dom.drawerExportBtn.disabled = true;
    setStatus(dom.drawerStatusEl, '正在查询当前页...', '');
    var range = getDateRangeMs(state.dateStart, state.dateEnd);
    state.queryPageSize = getPageSize();
    var payload = {
      limit: state.queryPageSize, cursor: state.cursors[state.pageIndex] || null,
      start_ms: range.startMs, end_ms: range.endMs,
      user_id: state.selectedUserId ? Number(state.selectedUserId) : null,
      target_groups: getSelectedTargetKeys(), actions: getSelectedActionKeys(),
      result: document.getElementById('opsLogResultFilter').value || null,
    };
    return apiClient.queryOperationLogs(payload, state.logController ? state.logController.signal : undefined)
      .then(function(result) {
        if (requestId !== state.logRequestId) return [];
        state.logs = Array.isArray(result.items) ? result.items : [];
        state.nextCursor = result.next_cursor || null;
        state.actionOptions = Array.isArray(result.action_options) ? result.action_options : [];
        syncActionGrid();
        setStatus(dom.drawerStatusEl, '本页 ' + state.logs.length + ' 条摘要' + (state.nextCursor ? '，可翻页查看更多' : '，已到末页'), 'ok');
        return state.logs;
      })
      .catch(function(err) {
        if (requestId !== state.logRequestId) return [];
        setStatus(dom.drawerStatusEl, err && err.message ? err.message : '查询失败', 'err');
        return [];
      })
      .finally(function() {
        if (requestId !== state.logRequestId) return;
        state.loading = false;
        if (dom.drawerRefreshBtn) dom.drawerRefreshBtn.disabled = false;
        if (dom.drawerExportBtn) dom.drawerExportBtn.disabled = !state.logs.length;
        renderList();
      });
  }

  function loadLogDetail(id, offset) {
    var panel = document.getElementById('opsLogDetailPanel');
    var text = document.getElementById('opsLogDetailText');
    var buttons = document.getElementById('opsLogDetailPages');
    var serial = ++state.detailRequestId;
    panel.classList.remove('hidden');
    text.textContent = '正在读取详情...';
    buttons.textContent = '';
    panel.scrollIntoView({ block: 'nearest' });
    return apiClient.getOperationLogDetail({ log_id: id, offset: offset || 0, limit: 6000 }).then(function(result) {
      if (serial !== state.detailRequestId) return;
      text.textContent = result.detail_text || '无详情';
      buttons.innerHTML = '<span>记录 #' + id + '，字符 ' + (result.offset + 1) + '–'
        + Math.min(result.offset + 6000, result.total_chars) + ' / ' + result.total_chars + '</span>'
        + '<button class="secondary" data-ops-detail-id="' + id + '" data-ops-detail-offset="' + Math.max(0, result.offset - 6000) + '" '
        + (result.offset ? '' : 'disabled') + '>上一段</button>'
        + '<button class="secondary" data-ops-detail-id="' + id + '" data-ops-detail-offset="' + (result.next_offset || 0) + '" '
        + (result.next_offset !== null ? '' : 'disabled') + '>下一段</button>';
      panel.scrollIntoView({ block: 'nearest' });
    }).catch(function(err) {
      if (serial === state.detailRequestId) text.textContent = err.message || '读取失败';
    });
  }

  function loadOverview(view, force, range, statusEl, refreshBtn) {
    var target = state[view];
    if (!canView() || !target.selectedUserIds.length) return Promise.resolve([]);
    if (target.logsLoaded && !force) return Promise.resolve(target.logs);
    if (target.controller) target.controller.abort();
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    target.controller = controller;
    var serial = (target.requestId || 0) + 1;
    target.requestId = serial;
    target.loading = true;
    target.logs = [];
    if (refreshBtn) refreshBtn.disabled = true;
    setStatus(statusEl, '正在汇总所选人员...', '');
    return apiClient.summarizeOperationLogs({ view: view, user_ids: target.selectedUserIds.map(Number),
      start_ms: range.startMs, end_ms: range.endMs }, controller ? controller.signal : undefined)
      .then(function(result) {
        if (serial !== target.requestId) return [];
        target.logs = (Array.isArray(result.items) ? result.items : []).map(function(item) {
          return { _aggregate: true, user_id: item.user_id, username: item.username, key: item.key, count: item.count };
        });
        target.logsLoaded = true;
        target.lastFetchedAt = Date.now();
        setStatus(statusEl, '已按所选人员和日期汇总', 'ok');
        return target.logs;
      }).catch(function(err) {
        if (serial !== target.requestId) return [];
        target.logsLoaded = false;
        setStatus(statusEl, err.message || '汇总失败', 'err');
        return [];
      }).finally(function() {
        if (serial !== target.requestId) return;
        target.loading = false;
        if (refreshBtn) refreshBtn.disabled = false;
      });
  }


  function loadActivityLogs(force) {
    return loadOverview("activity", force, getActivityDateRangeMs(), dom.activityStatus, dom.activityRefreshBtn);
  }


  function loadContributionLogs(force) {
    return loadOverview("contribution", force, getContributionDateRangeMs(), dom.contributionStatus, dom.contributionRefreshBtn);
  }


  function loadExecContributionLogs(force) {
    return loadOverview("execContribution", force, getExecContributionDateRangeMs(), dom.execContributionStatus, dom.execContributionRefreshBtn);
  }


  function refreshActivityView(force) {
    if (!state.activity.hasSelection || !state.activity.selectedUserIds.length) {
      renderActivityView();
      return Promise.resolve([]);
    }
    var ensureUsers = state.activity.usersLoaded ? Promise.resolve([]) : loadUsers();
    if (!state.activity.logsLoaded || force) {
      return ensureUsers.then(function() {
        return loadActivityLogs(true).then(function() {
          renderActivityView();
          return state.activity.logs;
        });
      });
    }
    return ensureUsers.then(function() {
      renderActivityView();
      return state.activity.logs;
    });
  }

  function refreshContributionView(force) {
    if (!state.contribution.hasSelection || !state.contribution.selectedUserIds.length) {
      renderContributionView();
      return Promise.resolve([]);
    }
    var ensureUsers = state.contribution.usersLoaded ? Promise.resolve([]) : loadUsers();
    if (!state.contribution.logsLoaded || force) {
      return ensureUsers.then(function() {
        return loadContributionLogs(true).then(function() {
          renderContributionView();
          return state.contribution.logs;
        });
      });
    }
    return ensureUsers.then(function() {
      renderContributionView();
      return state.contribution.logs;
    });
  }

  function refreshExecContributionView(force) {
    if (!state.execContribution.hasSelection || !state.execContribution.selectedUserIds.length) {
      renderExecContributionView();
      return Promise.resolve([]);
    }
    var ensureUsers = state.execContribution.usersLoaded ? Promise.resolve([]) : loadUsers();
    if (!state.execContribution.logsLoaded || force) {
      return ensureUsers.then(function() {
        return loadExecContributionLogs(true).then(function() {
          renderExecContributionView();
          return state.execContribution.logs;
        });
      });
    }
    return ensureUsers.then(function() {
      renderExecContributionView();
      return state.execContribution.logs;
    });
  }

  function shouldAutoRefreshOverviewView(viewKey) {
    if (!Number.isFinite(OVERVIEW_AUTO_REFRESH_INTERVAL_MS) || OVERVIEW_AUTO_REFRESH_INTERVAL_MS <= 0) {
      return true;
    }
    var target = state.activity;
    if (viewKey === 'contribution') target = state.contribution;
    else if (viewKey === 'exec-contribution') target = state.execContribution;
    if (!target || !target.logsLoaded) return true;
    var lastFetchedAt = Number(target.lastFetchedAt || 0);
    if (!isFinite(lastFetchedAt) || lastFetchedAt <= 0) return true;
    var delta = Date.now() - lastFetchedAt;
    return delta >= OVERVIEW_AUTO_REFRESH_INTERVAL_MS;
  }

  function refreshCurrentOverviewViewByPolicy() {
    var forceReload = shouldAutoRefreshOverviewView(state.overviewView);
    if (state.overviewView === 'contribution') return refreshContributionView(forceReload);
    if (state.overviewView === 'exec-contribution') return refreshExecContributionView(forceReload);
    return refreshActivityView(forceReload);
  }

  function ensureDrawer() {
    if (state.drawer) return state.drawer;
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    state.drawer = window.app.drawer.createDrawer({
      drawerId: 'opsLogDrawer',
      openButtons: ['openOpsLogDrawerBtn'],
      onOpen: function() {
        state.hasViewed = true;
        state.drawerOpen = true;
        persistViewState();
        setStatus(dom.drawerStatusEl, '加载中...', '');
        syncTargetGrid();
        syncActionGrid();
        loadUsers().then(function() {
          syncUserSelect();
          return loadLogs();
        });
      },
      onClose: function() {
        state.drawerOpen = false;
        persistViewState();
      },
    });
    return state.drawer;
  }

  function ensureActivityDrawer() {
    if (state.activity.drawer) return state.activity.drawer;
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    state.activity.drawer = window.app.drawer.createDrawer({
      drawerId: 'opsActivityDrawer',
      openButtons: ['openOpsActivityDrawerBtn', 'openOpsActivityDrawerBtnInline'],
      onOpen: function() {
        applyOpsOverviewView('activity');
        setStatus(dom.activityDrawerStatus, '', '');
        setActivityDraftUserIds(state.activity.selectedUserIds);
        syncActivityUserGrid();
        if (!state.activity.usersLoaded) {
          loadUsers().then(function() {
            syncActivityUserGrid();
          });
        }
      },
      onClose: function() {
        setActivityDraftUserIds(state.activity.selectedUserIds);
        syncActivityUserGrid();
      },
    });
    return state.activity.drawer;
  }

  function ensureContributionDrawer() {
    if (state.contribution.drawer) return state.contribution.drawer;
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    state.contribution.drawer = window.app.drawer.createDrawer({
      drawerId: 'opsContributionDrawer',
      openButtons: ['openOpsContributionDrawerBtn', 'openOpsContributionDrawerBtnInline'],
      onOpen: function() {
        applyOpsOverviewView('contribution');
        setStatus(dom.contributionDrawerStatus, '', '');
        setContributionDraftUserIds(state.contribution.selectedUserIds);
        syncContributionUserGrid();
        if (!state.contribution.usersLoaded) {
          loadUsers().then(function() {
            syncContributionUserGrid();
          });
        }
      },
      onClose: function() {
        setContributionDraftUserIds(state.contribution.selectedUserIds);
        syncContributionUserGrid();
      },
    });
    return state.contribution.drawer;
  }

  function ensureExecContributionDrawer() {
    if (state.execContribution.drawer) return state.execContribution.drawer;
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    state.execContribution.drawer = window.app.drawer.createDrawer({
      drawerId: 'opsExecContributionDrawer',
      openButtons: ['openOpsExecContributionDrawerBtn', 'openOpsExecContributionDrawerBtnInline'],
      onOpen: function() {
        applyOpsOverviewView('exec-contribution');
        setStatus(dom.execContributionDrawerStatus, '', '');
        setExecContributionDraftUserIds(state.execContribution.selectedUserIds);
        syncExecContributionUserGrid();
        if (!state.execContribution.usersLoaded) {
          loadUsers().then(function() {
            syncExecContributionUserGrid();
          });
        }
      },
      onClose: function() {
        setExecContributionDraftUserIds(state.execContribution.selectedUserIds);
        syncExecContributionUserGrid();
      },
    });
    return state.execContribution.drawer;
  }

  function openDrawerIfNeeded() {
    if (!state.drawerOpen) return;
    var element = document.getElementById('opsLogDrawer');
    if (element && element.classList.contains('open')) return;
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
    if (dom.drawerExportBtn) {
      dom.drawerExportBtn.addEventListener('click', function() {
        exportDrawerLogs();
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
    if (dom.dateStart) {
      dom.dateStart.addEventListener('change', function() {
        state.dateStart = dom.dateStart.value || '';
        state.pageIndex = 0;
        persistViewState();
        loadLogs();
      });
    }
    if (dom.dateEnd) {
      dom.dateEnd.addEventListener('change', function() {
        state.dateEnd = dom.dateEnd.value || '';
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
          loadLogs();
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
        loadLogs();
      });
    }
    if (dom.actionGrid) {
      dom.actionGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsLogAction || '') : '';
        if (!key) return;
        if (key === 'all') {
          state.selectedActions = { all: Boolean(t.checked) };
          if (!t.checked) state.selectedActions = { all: true };
          syncActionGrid();
          state.pageIndex = 0;
          persistViewState();
          loadLogs();
          return;
        }
        if (!state.selectedActions || typeof state.selectedActions !== 'object') state.selectedActions = { all: true };
        if (state.selectedActions.all) {
          var next = { all: false };
          next[key] = Boolean(t.checked);
          state.selectedActions = next;
        } else {
          state.selectedActions[key] = Boolean(t.checked);
        }
        syncAllActionSelection();
        syncActionGrid();
        state.pageIndex = 0;
        persistViewState();
        loadLogs();
      });
    }
    if (dom.activitySelectAll) {
      dom.activitySelectAll.addEventListener('change', function() {
        if (dom.activitySelectAll.checked) {
          setActivityDraftUserIds(getActivityUserIds());
        } else {
          setActivityDraftUserIds([]);
        }
        syncActivityUserGrid();
      });
    }
    if (dom.activityUserGrid) {
      dom.activityUserGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsActivityUser || '') : '';
        if (!key) return;
        var draft = Array.isArray(state.activity.draftUserIds) ? state.activity.draftUserIds.slice() : [];
        var idx = draft.indexOf(key);
        if (t.checked) {
          if (idx === -1) draft.push(key);
        } else if (idx !== -1) {
          draft.splice(idx, 1);
        }
        state.activity.draftUserIds = draft;
        syncActivityUserGrid();
      });
    }
    if (dom.activityApplyBtn) {
      dom.activityApplyBtn.addEventListener('click', function() {
        var draft = Array.isArray(state.activity.draftUserIds) ? state.activity.draftUserIds : [];
        if (!draft.length) {
          setStatus(dom.activityDrawerStatus, '请至少选择一位人员', 'warn');
          return;
        }
        state.activity.selectedUserIds = draft.slice();
        state.activity.hasSelection = true;
        persistActivityState();
        syncActivitySelectionText();
        if (state.activity.drawer && typeof state.activity.drawer.close === 'function') {
          state.activity.drawer.close();
        }
        refreshActivityView(true);
      });
    }
    if (dom.activityTimeRange) {
      dom.activityTimeRange.addEventListener('change', function() {
        state.activity.timeRange = dom.activityTimeRange.value || DEFAULT_ACTIVITY_RANGE;
        persistActivityState();
        refreshActivityView(true);
      });
    }
    if (dom.activityDateStart) {
      dom.activityDateStart.addEventListener('change', function() {
        state.activity.dateStart = dom.activityDateStart.value || '';
        persistActivityState();
        refreshActivityView(true);
      });
    }
    if (dom.activityDateEnd) {
      dom.activityDateEnd.addEventListener('change', function() {
        state.activity.dateEnd = dom.activityDateEnd.value || '';
        persistActivityState();
        refreshActivityView(true);
      });
    }
    if (dom.activityBehaviorGrid) {
      dom.activityBehaviorGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsActivityBehavior || '') : '';
        if (!key) return;
        if (key === 'all') {
          state.activity.selectedBehaviors = { all: Boolean(t.checked) };
          if (!t.checked) state.activity.selectedBehaviors = { all: true };
          syncActivityBehaviorFilters();
          persistActivityState();
          renderActivityView();
          return;
        }
        if (!state.activity.selectedBehaviors || typeof state.activity.selectedBehaviors !== 'object') {
          state.activity.selectedBehaviors = { all: true };
        }
        if (state.activity.selectedBehaviors.all) {
          var next = { all: false };
          next[key] = Boolean(t.checked);
          state.activity.selectedBehaviors = next;
        } else {
          state.activity.selectedBehaviors[key] = Boolean(t.checked);
        }
        syncActivityBehaviorSelection();
        syncActivityBehaviorFilters();
        persistActivityState();
        renderActivityView();
      });
    }
    if (dom.activityRefreshBtn) {
      dom.activityRefreshBtn.addEventListener('click', function() {
        refreshActivityView(true);
      });
    }
    if (dom.contributionSelectAll) {
      dom.contributionSelectAll.addEventListener('change', function() {
        if (dom.contributionSelectAll.checked) {
          setContributionDraftUserIds(getActivityUserIds());
        } else {
          setContributionDraftUserIds([]);
        }
        syncContributionUserGrid();
      });
    }
    if (dom.contributionUserGrid) {
      dom.contributionUserGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsContributionUser || '') : '';
        if (!key) return;
        var draft = Array.isArray(state.contribution.draftUserIds) ? state.contribution.draftUserIds.slice() : [];
        var idx = draft.indexOf(key);
        if (t.checked) {
          if (idx === -1) draft.push(key);
        } else if (idx !== -1) {
          draft.splice(idx, 1);
        }
        state.contribution.draftUserIds = draft;
        syncContributionUserGrid();
      });
    }
    if (dom.contributionApplyBtn) {
      dom.contributionApplyBtn.addEventListener('click', function() {
        var draft = Array.isArray(state.contribution.draftUserIds) ? state.contribution.draftUserIds : [];
        if (!draft.length) {
          setStatus(dom.contributionDrawerStatus, '请至少选择一位人员', 'warn');
          return;
        }
        state.contribution.selectedUserIds = draft.slice();
        state.contribution.hasSelection = true;
        persistContributionState();
        syncContributionSelectionText();
        if (state.contribution.drawer && typeof state.contribution.drawer.close === 'function') {
          state.contribution.drawer.close();
        }
        refreshContributionView(true);
      });
    }
    if (dom.contributionTimeRange) {
      dom.contributionTimeRange.addEventListener('change', function() {
        state.contribution.timeRange = dom.contributionTimeRange.value || DEFAULT_ACTIVITY_RANGE;
        persistContributionState();
        refreshContributionView(true);
      });
    }
    if (dom.contributionDateStart) {
      dom.contributionDateStart.addEventListener('change', function() {
        state.contribution.dateStart = dom.contributionDateStart.value || '';
        persistContributionState();
        refreshContributionView(true);
      });
    }
    if (dom.contributionDateEnd) {
      dom.contributionDateEnd.addEventListener('change', function() {
        state.contribution.dateEnd = dom.contributionDateEnd.value || '';
        persistContributionState();
        refreshContributionView(true);
      });
    }
    if (dom.contributionBehaviorGrid) {
      dom.contributionBehaviorGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsContributionBehavior || '') : '';
        if (!key) return;
        if (key === 'all') {
          state.contribution.selectedBehaviors = { all: Boolean(t.checked) };
          if (!t.checked) state.contribution.selectedBehaviors = { all: true };
          syncContributionBehaviorFilters();
          persistContributionState();
          renderContributionView();
          return;
        }
        if (!state.contribution.selectedBehaviors || typeof state.contribution.selectedBehaviors !== 'object') {
          state.contribution.selectedBehaviors = { all: true };
        }
        if (state.contribution.selectedBehaviors.all) {
          var next = { all: false };
          next[key] = Boolean(t.checked);
          state.contribution.selectedBehaviors = next;
        } else {
          state.contribution.selectedBehaviors[key] = Boolean(t.checked);
        }
        syncContributionBehaviorSelection();
        syncContributionBehaviorFilters();
        persistContributionState();
        renderContributionView();
      });
    }
    if (dom.contributionRefreshBtn) {
      dom.contributionRefreshBtn.addEventListener('click', function() {
        refreshContributionView(true);
      });
    }
    if (dom.execContributionSelectAll) {
      dom.execContributionSelectAll.addEventListener('change', function() {
        if (dom.execContributionSelectAll.checked) {
          setExecContributionDraftUserIds(getActivityUserIds());
        } else {
          setExecContributionDraftUserIds([]);
        }
        syncExecContributionUserGrid();
      });
    }
    if (dom.execContributionUserGrid) {
      dom.execContributionUserGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsExecContributionUser || '') : '';
        if (!key) return;
        var draft = Array.isArray(state.execContribution.draftUserIds) ? state.execContribution.draftUserIds.slice() : [];
        var idx = draft.indexOf(key);
        if (t.checked) {
          if (idx === -1) draft.push(key);
        } else if (idx !== -1) {
          draft.splice(idx, 1);
        }
        state.execContribution.draftUserIds = draft;
        syncExecContributionUserGrid();
      });
    }
    if (dom.execContributionApplyBtn) {
      dom.execContributionApplyBtn.addEventListener('click', function() {
        var draft = Array.isArray(state.execContribution.draftUserIds) ? state.execContribution.draftUserIds : [];
        if (!draft.length) {
          setStatus(dom.execContributionDrawerStatus, '请至少选择一位人员', 'warn');
          return;
        }
        state.execContribution.selectedUserIds = draft.slice();
        state.execContribution.hasSelection = true;
        persistExecContributionState();
        syncExecContributionSelectionText();
        if (state.execContribution.drawer && typeof state.execContribution.drawer.close === 'function') {
          state.execContribution.drawer.close();
        }
        refreshExecContributionView(true);
      });
    }
    if (dom.execContributionTimeRange) {
      dom.execContributionTimeRange.addEventListener('change', function() {
        state.execContribution.timeRange = dom.execContributionTimeRange.value || DEFAULT_ACTIVITY_RANGE;
        persistExecContributionState();
        refreshExecContributionView(true);
      });
    }
    if (dom.execContributionDateStart) {
      dom.execContributionDateStart.addEventListener('change', function() {
        state.execContribution.dateStart = dom.execContributionDateStart.value || '';
        persistExecContributionState();
        refreshExecContributionView(true);
      });
    }
    if (dom.execContributionDateEnd) {
      dom.execContributionDateEnd.addEventListener('change', function() {
        state.execContribution.dateEnd = dom.execContributionDateEnd.value || '';
        persistExecContributionState();
        refreshExecContributionView(true);
      });
    }
    if (dom.execContributionBehaviorGrid) {
      dom.execContributionBehaviorGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsExecContributionBehavior || '') : '';
        if (!key) return;
        if (key === 'all') {
          state.execContribution.selectedBehaviors = { all: Boolean(t.checked) };
          if (!t.checked) state.execContribution.selectedBehaviors = { all: true };
          syncExecContributionBehaviorFilters();
          persistExecContributionState();
          renderExecContributionView();
          return;
        }
        if (!state.execContribution.selectedBehaviors || typeof state.execContribution.selectedBehaviors !== 'object') {
          state.execContribution.selectedBehaviors = { all: true };
        }
        if (state.execContribution.selectedBehaviors.all) {
          var next = { all: false };
          next[key] = Boolean(t.checked);
          state.execContribution.selectedBehaviors = next;
        } else {
          state.execContribution.selectedBehaviors[key] = Boolean(t.checked);
        }
        syncExecContributionBehaviorSelection();
        syncExecContributionBehaviorFilters();
        persistExecContributionState();
        renderExecContributionView();
      });
    }
    if (dom.execContributionRefreshBtn) {
      dom.execContributionRefreshBtn.addEventListener('click', function() {
        refreshExecContributionView(true);
      });
    }
    function bindPaginationContainer(container) {
      if (!container) return;
      container.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-ops-log-page]') : null;
        if (!btn || btn.disabled || state.loading) return;
        var action = btn.dataset.opsLogPage;
        if (action === 'next' && state.nextCursor) {
          state.cursors[state.pageIndex + 1] = state.nextCursor;
          state.pageIndex += 1;
        } else if (action === 'prev' && state.pageIndex > 0) state.pageIndex -= 1;
        else if (action === 'first') state.pageIndex = 0;
        else return;
        loadLogs({ page: true });
      });
    }
    var resultFilter = document.getElementById('opsLogResultFilter');
    if (resultFilter) resultFilter.addEventListener('change', function() { loadLogs(); });
    if (dom.tableBody) dom.tableBody.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-ops-log-detail]');
      if (btn) loadLogDetail(Number(btn.dataset.opsLogDetail), 0);
    });
    var detailPages = document.getElementById('opsLogDetailPages');
    if (detailPages) detailPages.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-ops-detail-id]');
      if (btn && !btn.disabled) loadLogDetail(Number(btn.dataset.opsDetailId), Number(btn.dataset.opsDetailOffset));
    });
    var closeDetail = document.getElementById('opsLogDetailClose');
    if (closeDetail) closeDetail.addEventListener('click', function() {
      state.detailRequestId += 1;
      document.getElementById('opsLogDetailPanel').classList.add('hidden');
    });
    bindPaginationContainer(dom.paginationTop);
    bindPaginationContainer(dom.paginationBottom);
  }

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
      refreshCurrentOverviewViewByPolicy();
    });
    window.addEventListener('app-auth-ready', function() {
      if (!state.pendingAuth) return;
      state.pendingAuth = false;
      var visible = dom.tabSection && !dom.tabSection.classList.contains('hidden');
      if (!visible) return;
      setStatus(dom.statusEl, '', '');
      openDrawerIfNeeded();
      refreshCurrentOverviewViewByPolicy();
    });
  }

  function init() {
    apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
    globalState = window.app && window.app.state ? window.app.state : null;
    utils = window.app && window.app.utils ? window.app.utils : null;
    storage = window.app && window.app.services && window.app.services.storage ? window.app.services.storage : null;

    if (!apiClient || !globalState) return;

    restoreViewState();
    if (!state.dateStart && !state.dateEnd) {
      state.dateStart = getDayKeyFromMs(Date.now() - 6 * 24 * 60 * 60 * 1000);
      state.dateEnd = getDayKeyFromMs(Date.now());
    }
    // 旧行为筛选保存的是中文标签；新查询使用稳定的 action key。
    if (getSelectedActionKeys().some(function(key) { return /[^a-z_]/.test(key); })) state.selectedActions = { all: true };
    restoreActivityState();
    restoreContributionState();
    restoreExecContributionState();
    ensureDrawer();
    ensureActivityDrawer();
    ensureContributionDrawer();
    ensureExecContributionDrawer();
    applyOpsOverviewView(state.overviewView, { persist: false, refresh: false });
    syncTargetGrid();
    syncOpsLogDateRange();
    syncActivityTimeRange();
    syncActivityDateRange();
    syncContributionTimeRange();
    syncContributionDateRange();
    syncExecContributionTimeRange();
    syncExecContributionDateRange();
    setActivityDraftUserIds(state.activity.selectedUserIds);
    syncActivityUserGrid();
    syncActivityBehaviorFilters();
    syncActivitySelectionText();
    setContributionDraftUserIds(state.contribution.selectedUserIds);
    syncContributionUserGrid();
    syncContributionBehaviorFilters();
    syncContributionSelectionText();
    setExecContributionDraftUserIds(state.execContribution.selectedUserIds);
    syncExecContributionUserGrid();
    syncExecContributionBehaviorFilters();
    syncExecContributionSelectionText();
    bindEvents();

    if (!canView()) {
      setStatus(dom.statusEl, '仅管理员可查看操作记录', 'warn');
      renderActivityView();
      renderContributionView();
      renderExecContributionView();
      return;
    }
    setStatus(dom.statusEl, '已启用操作记录（仅管理员）', 'ok');
    if (globalState.activeTab === 'ops-log') refreshCurrentOverviewViewByPolicy();
    window.app = window.app || {};
    window.app.opsLogBound = true;
    if (globalState.activeTab === 'ops-log') openDrawerIfNeeded();
  }

  var started = false;
  var initAttempts = 0;
  var MAX_INIT_ATTEMPTS = 50;
  function attemptInit() {
    if (started) return;
    // app.init() 由 bootstrap 在 DOMContentLoaded 后触发；这里等 app 把 state / authReady 准备好。
    if (!window.app || window.app.authReady !== true) {
      if (initAttempts < MAX_INIT_ATTEMPTS) {
        initAttempts += 1;
        setTimeout(attemptInit, 200);
      }
      return;
    }
    if (!window.app.apiClient || !window.app.state) {
      if (initAttempts < MAX_INIT_ATTEMPTS) {
        initAttempts += 1;
        setTimeout(attemptInit, 200);
      }
      return;
    }
    if (!window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') {
      if (initAttempts < MAX_INIT_ATTEMPTS) {
        initAttempts += 1;
        setTimeout(attemptInit, 200);
      }
      return;
    }
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
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('app-page-size-changed', function() {
      handlePageSizeChanged();
    });
  }
})();
