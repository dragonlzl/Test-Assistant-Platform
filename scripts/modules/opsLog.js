(function() {
  var apiClient = null;
  var globalState = null;
  var utils = null;
  var storage = null;
  var appConfig = window.app && window.app.config ? window.app.config : {};

  var STORAGE_KEY = appConfig.opsLogViewStorageKey || 'tap-ops-log-view-v1';

  var BEHAVIORS = [
    { key: 'all', label: '全部' },
    { key: 'login', label: '登录' },
    { key: 'logout', label: '退出登录' },
    { key: 'view', label: '查看' },
    { key: 'create', label: '新增' },
    { key: 'delete', label: '删除' },
    { key: 'update', label: '修改' },
    { key: 'archive', label: '归档' },
    { key: 'import', label: '导入' },
    { key: 'export', label: '导出' },
    { key: 'export_template', label: '导出模板' },
    { key: 'to_exec', label: '转执行' },
    { key: 'other', label: '其他' },
  ];

  var state = {
    drawer: null,
    users: [],
    logs: [],
    pageIndex: 0,
    selectedUserId: '',
    selectedBehaviors: { all: true },
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
    behaviorGrid: document.getElementById('opsLogActionFilterGrid'),
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

  function canView() {
    return globalState && globalState.currentUser && String(globalState.currentUser.role || '') === 'admin';
  }

  function readPersisted() {
    if (!storage || typeof storage.getJson !== 'function') return null;
    return storage.getJson(STORAGE_KEY, null);
  }

  function persistViewState() {
    if (!storage || typeof storage.setJson !== 'function') return;
    var selected = getSelectedBehaviorKeys();
    var payload = {
      userId: state.selectedUserId || '',
      behaviors: selected,
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
    state.selectedBehaviors = { all: true };
    var list = Array.isArray(saved.behaviors) ? saved.behaviors : [];
    if (list.length) {
      state.selectedBehaviors = { all: false };
      list.forEach(function(key) {
        if (!key) return;
        state.selectedBehaviors[String(key)] = true;
      });
      syncAllBehaviorSelection();
    }
  }

  function resolveBehaviorKey(action) {
    var a = String(action || '').trim().toLowerCase();
    if (!a) return 'other';
    if (a === 'login') return 'login';
    if (a === 'logout') return 'logout';
    if (a.indexOf('view_') === 0) return 'view';
    if (a.indexOf('export_case_template') === 0) return 'export_template';
    if (a.indexOf('export_template') === 0) return 'export_template';
    if (a === 'upsert_exec_set_from_case_file') return 'to_exec';
    if (a.indexOf('archive') !== -1) return 'archive';
    if (a.indexOf('export') === 0) return 'export';
    if (a.indexOf('import') === 0) return 'import';
    if (a.indexOf('overwrite') === 0) return 'import';
    if (a.indexOf('append') === 0) return 'import';
    if (a === 'add_exec_cases') return 'import';
    if (a.indexOf('delete') === 0) return 'delete';
    if (a.indexOf('create') === 0) return 'create';
    if (a.indexOf('update') === 0) return 'update';
    if (a.indexOf('change') === 0) return 'update';
    if (a.indexOf('reset') === 0) return 'update';
    if (a.indexOf('assign') === 0) return 'update';
    return 'other';
  }

  function getBehaviorLabel(key) {
    var k = String(key || '');
    for (var i = 0; i < BEHAVIORS.length; i += 1) {
      if (BEHAVIORS[i].key === k) return BEHAVIORS[i].label;
    }
    return k || '--';
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
    var type = String(l.target_type || '').trim();
    var id = (l.target_id || l.target_id === 0) ? String(l.target_id) : '';
    var detail = l.detail && typeof l.detail === 'object' ? l.detail : {};
    var action = String(l.action || '').trim().toLowerCase();

    if (type === 'auth') return '平台系统';
    if (type === 'settings') {
      var items = detail && Array.isArray(detail.items) ? detail.items : [];
      var labels = items.map(function(it) { return formatSettingsItemLabel(it); }).filter(Boolean);
      if (!labels.length) {
        var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
        labels = keys.map(function(k) { return getSettingsKeyLabel(k); }).filter(Boolean);
      }
      if (labels.length) return '其他设置：' + labels.join('、');
      return '其他设置';
    }
    if (type === 'model_config' || type === 'models') return '模型管理';
    if (type === 'feature_assignment' || type === 'features') return '功能指派';
    if (type === 'case_template') return '用例模板';

    if (type === 'case_file') {
      var fileName = String(detail.file_name || detail.file_name_clean || '').trim();
      if (fileName) return '用例文件：' + fileName;
      return id ? ('用例文件#' + id) : '用例文件';
    }
    if (type === 'case_item') {
      var fileName2 = String(detail.file_name || detail.file_name_clean || '').trim();
      if (fileName2) return '用例文件：' + fileName2;
      var caseFileId = (detail.case_file_id || detail.case_file_id === 0) ? String(detail.case_file_id) : '';
      if (caseFileId) return '用例文件#' + caseFileId;
      return '用例文件';
    }
    if (type === 'exec_set') {
      if (action === 'upsert_exec_set_from_case_file' || action === 'sync_exec_set_from_case_file') {
        var fileName3 = String(detail.case_file_name || detail.file_name || detail.file_name_clean || '').trim();
        if (fileName3) return '用例文件：' + fileName3;
      }
      var execName = String(detail.name || '').trim();
      if (!execName) execName = String(detail.exec_set_name || '').trim();
      if (execName) return '执行用例：' + execName;
      return id ? ('执行用例#' + id) : '执行用例';
    }
    if (type === 'user') {
      var userName = String(detail.username || '').trim();
      if (userName) return '人员：' + userName;
      return id ? ('用户#' + id) : '人员';
    }
    if (type === 'project') {
      var projectName = String(detail.name || '').trim();
      if (projectName) return '项目：' + projectName;
      return id ? ('项目#' + id) : '项目';
    }
    if (type === 'project_version') {
      var versionName = String(detail.name || '').trim();
      if (versionName) return '版本：' + versionName;
      return id ? ('版本#' + id) : '版本';
    }

    if (type) return id ? (type + '#' + id) : type;
    return id ? ('#' + id) : '--';
  }

  function getSelectedBehaviorKeys() {
    var keys = [];
    var selected = state.selectedBehaviors || {};
    if (selected.all) return [];
    BEHAVIORS.forEach(function(b) {
      if (!b || b.key === 'all') return;
      if (selected[b.key]) keys.push(b.key);
    });
    // 若无勾选，视为“全部”。
    if (!keys.length) return [];
    return keys;
  }

  function syncAllBehaviorSelection() {
    var selected = state.selectedBehaviors || {};
    var any = false;
    for (var i = 0; i < BEHAVIORS.length; i += 1) {
      var key = BEHAVIORS[i].key;
      if (key === 'all') continue;
      if (selected[key]) {
        any = true;
        break;
      }
    }
    // 未选任何具体行为：回到“全部”。
    if (!any) {
      state.selectedBehaviors = { all: true };
      return;
    }
    // 选中了全部具体行为：也视为“全部”。
    var allSelected = true;
    for (var j = 0; j < BEHAVIORS.length; j += 1) {
      var key2 = BEHAVIORS[j].key;
      if (key2 === 'all') continue;
      if (!selected[key2]) {
        allSelected = false;
        break;
      }
    }
    if (allSelected) {
      state.selectedBehaviors = { all: true };
    } else {
      state.selectedBehaviors.all = false;
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

  function syncBehaviorGrid() {
    if (!dom.behaviorGrid) return;
    var selected = state.selectedBehaviors || { all: true };
    dom.behaviorGrid.innerHTML = BEHAVIORS.map(function(b) {
      var key = b.key;
      var checked = selected.all ? ' checked' : (selected[key] ? ' checked' : '');
      return (
        '<label class="ops-log-filter-chip">' +
          '<input type="checkbox" data-ops-log-behavior="' + escapeHtml(key) + '"' + checked + ' />' +
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

  function getFilteredLogs() {
    var list = Array.isArray(state.logs) ? state.logs : [];
    var selected = state.selectedBehaviors || { all: true };
    if (selected.all) return list;
    var allow = {};
    BEHAVIORS.forEach(function(b) {
      if (!b || b.key === 'all') return;
      if (selected[b.key]) allow[b.key] = true;
    });
    return list.filter(function(log) {
      var key = resolveBehaviorKey(log && log.action ? log.action : '');
      return Boolean(allow[key] || allow.other && key === 'other');
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
      var behaviorKey = resolveBehaviorKey(log && log.action ? log.action : '');
      return (
        '<tr>' +
          '<td>' + escapeHtml(formatTime(log.created_at)) + '</td>' +
          '<td>' + escapeHtml(operator) + '</td>' +
          '<td>' + escapeHtml(buildTargetLabel(log)) + '</td>' +
          '<td>' + escapeHtml(getBehaviorLabel(behaviorKey)) + '</td>' +
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
        setStatus(dom.drawerStatusEl, '已加载 ' + state.logs.length + ' 条记录（最多 500 条）', 'ok');
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
        syncBehaviorGrid();
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
    if (dom.behaviorGrid) {
      dom.behaviorGrid.addEventListener('change', function(e) {
        var t = e && e.target ? e.target : null;
        var key = t && t.dataset ? String(t.dataset.opsLogBehavior || '') : '';
        if (!key) return;
        if (key === 'all') {
          state.selectedBehaviors = { all: Boolean(t.checked) };
          if (!t.checked) state.selectedBehaviors = { all: true };
          syncBehaviorGrid();
          state.pageIndex = 0;
          persistViewState();
          renderList();
          return;
        }
        if (!state.selectedBehaviors || typeof state.selectedBehaviors !== 'object') state.selectedBehaviors = { all: true };
        if (state.selectedBehaviors.all) {
          var next = { all: false };
          BEHAVIORS.forEach(function(b) {
            if (!b || b.key === 'all') return;
            next[b.key] = true;
          });
          next[key] = Boolean(t.checked);
          state.selectedBehaviors = next;
        } else {
          state.selectedBehaviors[key] = Boolean(t.checked);
        }
        syncAllBehaviorSelection();
        syncBehaviorGrid();
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
    syncBehaviorGrid();
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
