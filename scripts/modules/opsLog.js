(function() {
  var apiClient = null;
  var globalState = null;
  var utils = null;
  var storage = null;
  var appConfig = window.app && window.app.config ? window.app.config : {};

  var STORAGE_KEY = appConfig.opsLogViewStorageKey || 'tap-ops-log-view-v1';
  var ACTIVITY_STORAGE_KEY = appConfig.opsActivityViewStorageKey || 'tap-ops-activity-view-v1';
  var DEFAULT_ACTIVITY_RANGE = 'week';
  var ACTIVITY_BAR_MAX_RATIO = 82;

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
    activity: {
      drawer: null,
      usersLoaded: false,
      logsLoaded: false,
      loading: false,
      selectedUserIds: [],
      draftUserIds: [],
      selectedBehaviors: { all: true },
      timeRange: DEFAULT_ACTIVITY_RANGE,
      hasSelection: false,
      logs: [],
      behaviors: [],
      colorMap: {},
    },
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
    activityDrawerStatus: document.getElementById('opsActivityDrawerStatus'),
    activityUserGrid: document.getElementById('opsActivityUserGrid'),
    activitySelectAll: document.getElementById('opsActivitySelectAll'),
    activityApplyBtn: document.getElementById('opsActivityApplyBtn'),
    activityUserEmpty: document.getElementById('opsActivityUserEmpty'),
    activityTimeRange: document.getElementById('opsActivityTimeRangeSelect'),
    activityBehaviorGrid: document.getElementById('opsActivityBehaviorFilterGrid'),
    activityStatus: document.getElementById('opsActivityStatus'),
    activitySelectionText: document.getElementById('opsActivitySelectionText'),
    activityRefreshBtn: document.getElementById('opsActivityRefreshBtn'),
    activityList: document.getElementById('opsActivityList'),
    activityEmpty: document.getElementById('opsActivityEmpty'),
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

  function getActivityRangeStartMs() {
    var range = state.activity.timeRange || DEFAULT_ACTIVITY_RANGE;
    if (range === 'all') return null;
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

  function getFilteredActivityLogs() {
    var list = Array.isArray(state.activity.logs) ? state.activity.logs : [];
    var selectedIds = Array.isArray(state.activity.selectedUserIds) ? state.activity.selectedUserIds : [];
    if (!selectedIds.length) return [];
    var allowed = {};
    selectedIds.forEach(function(id) { allowed[String(id)] = true; });
    var startMs = getActivityRangeStartMs();
    return list.filter(function(log) {
      if (!log || !isAllowedLog(log)) return false;
      var userId = (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
      if (!userId || !allowed[userId]) return false;
      if (startMs) {
        var t = parseTimeMs(log.created_at);
        if (!t || t < startMs) return false;
      }
      return true;
    });
  }

  function buildActivityViewData(logs) {
    var nameMap = getActivityUserNameMap();
    var userMap = {};
    var behaviorTotals = {};
    logs.forEach(function(log) {
      var label = resolveActivityActionLabel(log);
      if (!label) return;
      var userId = (log.user_id || log.user_id === 0) ? String(log.user_id) : '';
      if (!userId) return;
      var entry = userMap[userId];
      if (!entry) {
        var fallbackName = nameMap[userId] || ('用户#' + userId);
        entry = { id: userId, name: String(log.username || fallbackName), total: 0, behaviors: {} };
        userMap[userId] = entry;
      }
      entry.total += 1;
      entry.behaviors[label] = (entry.behaviors[label] || 0) + 1;
      behaviorTotals[label] = (behaviorTotals[label] || 0) + 1;
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
      action === 'change_case_file_version' ||
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
    if (action === 'change_case_file_version') return '用例库';
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
        state.activity.usersLoaded = true;
        syncUserSelect();
        syncActivityUserGrid();
        syncActivitySelectionText();
        return state.users;
      })
      .catch(function() {
        state.users = [];
        state.activity.usersLoaded = true;
        syncUserSelect();
        syncActivityUserGrid();
        syncActivitySelectionText();
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

  function loadActivityLogs(force) {
    if (!apiClient.listOperationLogs) return Promise.resolve([]);
    if (!canView()) {
      state.activity.logs = [];
      state.activity.logsLoaded = true;
      renderActivityView();
      setStatus(dom.activityStatus, '仅管理员可查看活跃度', 'warn');
      return Promise.resolve([]);
    }
    if (state.activity.loading) return Promise.resolve(state.activity.logs);
    if (state.activity.logsLoaded && !force) return Promise.resolve(state.activity.logs);
    state.activity.loading = true;
    if (dom.activityRefreshBtn) dom.activityRefreshBtn.disabled = true;
    setStatus(dom.activityStatus, '加载中...', '');
    return apiClient
      .listOperationLogs({ limit: 500, offset: 0 })
      .then(function(list) {
        state.activity.logs = (Array.isArray(list) ? list : []).filter(function(row) { return !isAutoOperation(row); });
        state.activity.logsLoaded = true;
        setStatus(dom.activityStatus, '已加载 ' + state.activity.logs.length + ' 条记录（最多 500 条）', 'ok');
        return state.activity.logs;
      })
      .catch(function(err) {
        state.activity.logs = [];
        state.activity.logsLoaded = true;
        setStatus(dom.activityStatus, err && err.message ? err.message : '加载失败', 'err');
        return [];
      })
      .finally(function() {
        state.activity.loading = false;
        if (dom.activityRefreshBtn) dom.activityRefreshBtn.disabled = false;
      });
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

  function ensureActivityDrawer() {
    if (state.activity.drawer) return state.activity.drawer;
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    state.activity.drawer = window.app.drawer.createDrawer({
      drawerId: 'opsActivityDrawer',
      openButtons: ['openOpsActivityDrawerBtn', 'openOpsActivityDrawerBtnInline'],
      onOpen: function() {
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
        renderActivityView();
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
        refreshActivityView(false);
      });
      window.addEventListener('app-auth-ready', function() {
        if (!state.pendingAuth) return;
        state.pendingAuth = false;
        var visible = dom.tabSection && !dom.tabSection.classList.contains('hidden');
        if (!visible) return;
        setStatus(dom.statusEl, '', '');
        openDrawerIfNeeded();
        refreshActivityView(false);
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
    restoreActivityState();
    ensureDrawer();
    ensureActivityDrawer();
    syncTargetGrid();
    syncActivityTimeRange();
    setActivityDraftUserIds(state.activity.selectedUserIds);
    syncActivityUserGrid();
    syncActivityBehaviorFilters();
    syncActivitySelectionText();
    bindEvents();

    if (!canView()) {
      setStatus(dom.statusEl, '仅管理员可查看操作记录', 'warn');
      renderActivityView();
      return;
    }
    setStatus(dom.statusEl, '已启用操作记录（仅管理员）', 'ok');
    refreshActivityView(false);
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
