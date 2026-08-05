(function() {
  var apiClient = null;
  var globalState = null;
  var utils = null;
  var storage = null;
  var auditModel = null;
  var overviewModel = null;
  var overviewController = null;
  var dataSource = null;
  var appConfig = window.app && window.app.config ? window.app.config : {};

  var STORAGE_KEY = appConfig.opsLogViewStorageKey || 'tap-ops-log-view-v1';
  var ACTIVITY_STORAGE_KEY = appConfig.opsActivityViewStorageKey || 'tap-ops-activity-view-v1';
  var CONTRIBUTION_STORAGE_KEY = appConfig.opsContributionViewStorageKey || 'tap-ops-contribution-view-v1';
  var EXEC_CONTRIBUTION_STORAGE_KEY = appConfig.opsExecContributionViewStorageKey || 'tap-ops-exec-contribution-view-v1';
  var DEFAULT_ACTIVITY_RANGE = 'week';
  var ACTIVITY_BAR_MAX_RATIO = 82;
  var DRAWER_MAX_ALLOWED_LOGS = Number(appConfig.opsLogDrawerMaxAllowed || 500);
  if (!Number.isFinite(DRAWER_MAX_ALLOWED_LOGS) || DRAWER_MAX_ALLOWED_LOGS <= 0) DRAWER_MAX_ALLOWED_LOGS = 500;
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

  var state = {
    drawer: null,
    users: [],
    logs: [],
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
    state.pageIndex = Number(saved.pageIndex) || 0;
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
    var list = Array.isArray(state.logs) ? state.logs : [];
    var execLogs = overviewModel ? overviewModel.buildExecCaseRunLogs(list) : [];
    var options = auditModel.buildActionFilterOptions(list.concat(execLogs));
    var optionKeys = options.map(function(item) { return item.key; });
    state.actionOptionKeys = optionKeys;
    trimActionSelection(optionKeys);
    syncAllActionSelection(optionKeys);
    var selected = state.selectedActions || { all: true };
    var html = ['<label class="ops-log-filter-chip">' +
      '<input type="checkbox" data-ops-log-action="all"' + (selected.all ? ' checked' : '') + ' />' +
      '<span>全部</span>' +
    '</label>'];
    options.forEach(function(item) {
      var key = item.key;
      var checked = '';
      if (!selected.all && selected[key]) checked = ' checked';
      html.push(
        '<label class="ops-log-filter-chip">' +
          '<input type="checkbox" data-ops-log-action="' + escapeHtml(key) + '"' + checked + ' />' +
          '<span>' + escapeHtml(item.label) + '</span>' +
        '</label>'
      );
    });
    dom.actionGrid.innerHTML = html.join('');
  }

  function syncOpsLogDateRange() {
    if (dom.dateStart) dom.dateStart.value = state.dateStart || '';
    if (dom.dateEnd) dom.dateEnd.value = state.dateEnd || '';
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

  function getFilteredLogs() {
    var list = Array.isArray(state.logs) ? state.logs : [];
    var execLogs = overviewModel ? overviewModel.buildExecCaseRunLogs(list) : [];
    if (execLogs.length) list = list.concat(execLogs);
    list = list.filter(auditModel.isAllowedLog);
    var range = getDateRangeMs(state.dateStart, state.dateEnd);
    var selected = state.selectedTargets || { all: true };
    if (selected.all) {
      return list.filter(function(log) {
        return isTimeInRange(log && log.created_at, range);
      }).filter(function(log) {
        var selectedActions = state.selectedActions || { all: true };
        if (selectedActions.all) return true;
        var label = auditModel.resolveActionFilterLabel(log);
        if (!label) return false;
        return Boolean(selectedActions[label]);
      }).sort(function(a, b) {
        return (parseTimeMs(b && b.created_at) || 0) - (parseTimeMs(a && a.created_at) || 0);
      });
    }
    var allow = {};
    TARGETS.forEach(function(b) {
      if (!b || b.key === 'all') return;
      if (selected[b.key]) allow[b.key] = true;
    });
    return list.filter(function(log) {
      if (!isTimeInRange(log && log.created_at, range)) return false;
      var keys = auditModel.resolveLogTargetKeys(log);
      for (var i = 0; i < keys.length; i += 1) {
        if (allow[keys[i]]) return true;
      }
      return false;
    }).filter(function(log) {
      var selected = state.selectedActions || { all: true };
      if (selected.all) return true;
      var label = auditModel.resolveActionFilterLabel(log);
      if (!label) return false;
      return Boolean(selected[label]);
    }).sort(function(a, b) {
      return (parseTimeMs(b && b.created_at) || 0) - (parseTimeMs(a && a.created_at) || 0);
    });
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
        { name: '操作记录', rows: auditModel.buildOpsLogExportRows(rows) },
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
          '<td>' + escapeHtml(auditModel.resolvePageLabel(log)) + '</td>' +
          '<td>' + escapeHtml(auditModel.buildTargetLabel(log)) + '</td>' +
          '<td>' + escapeHtml(auditModel.resolveActionLabel(log) || '--') + '</td>' +
          '<td>' + escapeHtml(auditModel.resolveCountChangeLabel(log)) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function handlePageSizeChanged() {
    if (overviewController) overviewController.handlePageSizeChanged();
  }

  function loadUsers() {
    if (!apiClient.listUsers) return Promise.resolve([]);
    return apiClient
      .listUsers()
      .then(function(list) {
        state.users = Array.isArray(list) ? list : [];
        syncUserSelect();
        if (overviewController) overviewController.notifyUsersChanged();
        return state.users;
      })
      .catch(function() {
        state.users = [];
        syncUserSelect();
        if (overviewController) overviewController.notifyUsersChanged();
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
    if (state.loading) {
      state.pendingReload = true;
      return Promise.resolve(state.logs);
    }
    state.loading = true;
    if (dom.drawerRefreshBtn) dom.drawerRefreshBtn.disabled = true;
    setStatus(dom.drawerStatusEl, '加载中...', '');
    var userId = state.selectedUserId ? Number(state.selectedUserId) : null;
    var range = getDateRangeMs(state.dateStart, state.dateEnd);
    return dataSource.fetchDrawer(range, {
      userId: userId !== null && Number.isFinite(userId) ? userId : null,
      maxAllowed: DRAWER_MAX_ALLOWED_LOGS,
    })
      .then(function(payload) {
        state.logs = payload && payload.logs ? payload.logs : [];
        state.pageIndex = 0;
        syncActionGrid();
        renderList();
        var allowedCount = payload && Number.isFinite(payload.allowedCount) ? payload.allowedCount : state.logs.filter(auditModel.isAllowedLog).length;
        var hasRange = range && (range.startMs !== null || range.endMs !== null);
        var msg = '已加载 ' + allowedCount + ' 条记录';
        if (!hasRange) msg += '（最多 ' + DRAWER_MAX_ALLOWED_LOGS + ' 条）';
        if (payload && payload.reachedCap && !hasRange) msg += '，可通过日期筛选查看更多';
        setStatus(dom.drawerStatusEl, msg, 'ok');
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
        if (state.pendingReload) {
          state.pendingReload = false;
          loadLogs();
        }
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

  function openDrawerIfNeeded() {
    if (!state.drawerOpen) return;
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
          renderList();
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
      if (overviewController) overviewController.refreshCurrentByPolicy();
    });
    window.addEventListener('app-auth-ready', function() {
      if (!state.pendingAuth) return;
      state.pendingAuth = false;
      var visible = dom.tabSection && !dom.tabSection.classList.contains('hidden');
      if (!visible) return;
      setStatus(dom.statusEl, '', '');
      openDrawerIfNeeded();
      if (overviewController) overviewController.refreshCurrentByPolicy();
    });
  }

  function init() {
    apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
    globalState = window.app && window.app.state ? window.app.state : null;
    utils = window.app && window.app.utils ? window.app.utils : null;
    storage = window.app && window.app.services && window.app.services.storage ? window.app.services.storage : null;
    auditModel = window.app && window.app.opsLogAuditModel ? window.app.opsLogAuditModel : null;
    overviewModel = window.app && window.app.opsLogOverviewModel ? window.app.opsLogOverviewModel : null;

    if (!apiClient || !globalState || !auditModel || !overviewModel) return;
    auditModel.configure({ overviewModel: overviewModel, formatTime: formatTime });
    var dataSourceFactory = window.app && window.app.opsLogDataSource;
    if (!dataSourceFactory || typeof dataSourceFactory.create !== 'function') return;
    dataSource = dataSourceFactory.create({
      apiClient: apiClient,
      isAutoOperation: isAutoOperation,
      isAllowedLog: auditModel.isAllowedLog,
      isTimeInRange: isTimeInRange,
    });

    var overviewFactory = window.app && window.app.opsLogOverviewController;
    if (!overviewFactory || typeof overviewFactory.create !== 'function') return;
    overviewController = overviewFactory.create({
      state: state,
      dom: dom,
      model: overviewModel,
      storage: storage,
      storageKeys: {
        activity: ACTIVITY_STORAGE_KEY,
        contribution: CONTRIBUTION_STORAGE_KEY,
        execContribution: EXEC_CONTRIBUTION_STORAGE_KEY,
      },
      defaultRange: DEFAULT_ACTIVITY_RANGE,
      barMaxRatio: ACTIVITY_BAR_MAX_RATIO,
      autoRefreshIntervalMs: OVERVIEW_AUTO_REFRESH_INTERVAL_MS,
      setStatus: setStatus,
      escapeHtml: escapeHtml,
      canView: canView,
      normalizeView: normalizeOpsOverviewView,
      persistRootViewState: persistViewState,
      fetchLogs: dataSource.fetchByRange,
      getDateRangeMs: getDateRangeMs,
      isTimeInRange: isTimeInRange,
      isAllowedLog: auditModel.isAllowedLog,
      resolveActivityActionLabel: auditModel.resolveActivityActionLabel,
      loadUsers: loadUsers,
      createDrawer: function(drawerOptions) {
        if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
        return window.app.drawer.createDrawer(drawerOptions);
      },
    });

    restoreViewState();
    ensureDrawer();
    syncTargetGrid();
    syncOpsLogDateRange();
    overviewController.initialize();
    bindEvents();

    if (!canView()) {
      setStatus(dom.statusEl, '仅管理员可查看操作记录', 'warn');
      overviewController.renderAll();
      return;
    }
    setStatus(dom.statusEl, '已启用操作记录（仅管理员）', 'ok');
    overviewController.refreshCurrentByPolicy();
    window.app = window.app || {};
    window.app.opsLogBound = true;
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
