(function() {
  var api = window.app && window.app.apiClient;
  if (!api) return;

  var utils = window.app && window.app.utils ? window.app.utils : {};
  var escapeHtml = typeof utils.escapeHtml === 'function' ? utils.escapeHtml : function(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  var escapeHtmlPreserve = typeof utils.escapeHtmlPreserve === 'function'
    ? utils.escapeHtmlPreserve
    : function(text) { return escapeHtml(text).replace(/\n/g, '<br>'); };

  function openConfirmDrawer(options) {
    if (utils && typeof utils.openConfirmDrawer === 'function') {
      return utils.openConfirmDrawer(options || {});
    }
    var msg = options && options.message ? String(options.message) : '';
    var ok = true;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      ok = window.confirm(msg);
    }
    return Promise.resolve({ ok: ok });
  }

  var dom = {
    root: document.getElementById('caseArchive'),
    status: document.getElementById('caseArchiveStatus'),
    openDrawerBtn: document.getElementById('openCaseArchiveDrawerBtn'),
    drawer: document.getElementById('caseArchiveDrawer'),
    drawerStatus: document.getElementById('caseArchiveDrawerStatus'),
    listPaginationTop: document.getElementById('caseArchiveListPaginationTop'),
    listPaginationBottom: document.getElementById('caseArchiveListPaginationBottom'),
    projectSelect: document.getElementById('caseArchiveProjectSelect'),
    versionSelect: document.getElementById('caseArchiveVersionSelect'),
    searchInput: document.getElementById('caseArchiveSearchInput'),
    searchBtn: document.getElementById('caseArchiveSearchBtn'),
    clearBtn: document.getElementById('caseArchiveSearchClearBtn'),
    listBody: document.getElementById('caseArchiveListBody'),
    listEmpty: document.getElementById('caseArchiveListEmpty'),
    detailCard: document.getElementById('caseArchiveDetailCard'),
    detailTitle: document.getElementById('caseArchiveDetailTitle'),
    detailProject: document.getElementById('caseArchiveDetailProject'),
    detailVersion: document.getElementById('caseArchiveDetailVersion'),
    detailName: document.getElementById('caseArchiveDetailName'),
    detailReuse: document.getElementById('caseArchiveDetailReuse'),
    detailCount: document.getElementById('caseArchiveDetailCount'),
    detailImporter: document.getElementById('caseArchiveDetailImporter'),
    detailImportedAt: document.getElementById('caseArchiveDetailImportedAt'),
    detailArchiver: document.getElementById('caseArchiveDetailArchiver'),
    detailArchivedAt: document.getElementById('caseArchiveDetailArchivedAt'),
    detailReason: document.getElementById('caseArchiveDetailReason'),
    openDrawerFromDetailBtn: document.getElementById('caseArchiveOpenDrawerFromDetailBtn'),
    detailSearchInput: document.getElementById('caseArchiveDetailSearchInput'),
    detailSearchClearBtn: document.getElementById('caseArchiveDetailSearchClearBtn'),
    casesPaginationTop: document.getElementById('caseArchiveCasesPaginationTop'),
    casesPaginationBottom: document.getElementById('caseArchiveCasesPaginationBottom'),
    casesBody: document.getElementById('caseArchiveCasesBody'),
    casesEmpty: document.getElementById('caseArchiveCasesEmpty'),
  };

  var state = {
    drawer: null,
    projects: [],
    versions: [],
    currentProjectId: '',
    currentVersionId: '',
    q: '',
    rows: [],
    currentUser: null,
    selected: null,
    listPageIndex: 0,
    casesPageIndex: 0,
    restoringDetail: null,
    casesSearchText: '',
    // 归档详情：只读展开状态（按 exec_set 维度隔离，避免切换详情互相影响）
    casePanelOpenByExecSet: {},
  };

  var detailPersistKey = 'tap-case-archive-detail';

  function getCurrentUserId() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    var user = globalState && globalState.currentUser ? globalState.currentUser : null;
    var userId = user && user.id !== undefined && user.id !== null ? user.id : null;
    if (!userId || String(userId) === '0') return null;
    return userId;
  }

  function getCurrentLoginSeq() {
    if (typeof localStorage === 'undefined') return '';
    try {
      return String(localStorage.getItem('tap-login-seq') || '');
    } catch (err) {
      return '';
    }
  }

  function readDetailPersistedState() {
    if (typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(detailPersistKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeDetailPersistedState(payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (!payload) {
        localStorage.removeItem(detailPersistKey);
        return;
      }
      localStorage.setItem(detailPersistKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }

  function clearDetailPersistedState() {
    writeDetailPersistedState(null);
  }

  function persistDetailSelection(opts) {
    opts = opts || {};
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    if (!userId && !loginSeq) return;
    var sid = opts.execSetId || (state.selected && state.selected.exec_set_id) || null;
    sid = Number(sid);
    if (!Number.isFinite(sid) || sid <= 0) return;
    var casesPageIndex = opts.casesPageIndex;
    if (casesPageIndex === null || casesPageIndex === undefined) casesPageIndex = state.casesPageIndex;
    casesPageIndex = Number(casesPageIndex);
    if (!Number.isFinite(casesPageIndex) || casesPageIndex < 0) casesPageIndex = 0;
    writeDetailPersistedState({
      user_id: userId || '',
      login_seq: loginSeq || '',
      exec_set_id: sid,
      cases_page_index: casesPageIndex,
      saved_at: Date.now(),
    });
  }

  function clampPageSize(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 20;
    if (n < 5) return 5;
    if (n > 200) return 200;
    return Math.floor(n);
  }

  function normalizeSearchText(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return text.trim().toLowerCase();
  }

  function getPageSize() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    var fromSettings = globalState && globalState.settings ? globalState.settings.tempExecPageSize : null;
    if (fromSettings !== null && fromSettings !== undefined) return clampPageSize(fromSettings);
    return clampPageSize(globalState && globalState.tempExecPageSize ? globalState.tempExecPageSize : 20);
  }

  function stringifyMaybeJson(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch (err) {
      try { return String(value); } catch (err2) { return ''; }
    }
  }

  function buildCaseSearchHay(item) {
    if (!item || typeof item !== 'object') return '';
    var parts = [];
    parts.push(item.module || '');
    parts.push(item.title || '');
    parts.push(item.priority || '');
    parts.push(item.precondition || '');
    parts.push(item.steps || '');
    parts.push(item.expected || '');
    parts.push(item.status || '');
    parts.push(item.actual_result || '');
    parts.push(item.remark || '');
    parts.push(item.defect_link || '');
    if (item.defect_links) {
      if (Array.isArray(item.defect_links)) parts.push(item.defect_links.join(' '));
      else parts.push(stringifyMaybeJson(item.defect_links));
    }
    if (item.reuse_details) parts.push(stringifyMaybeJson(item.reuse_details));
    return normalizeSearchText(parts.join(' '));
  }

  function getFilteredCases(detail) {
    var list = detail && Array.isArray(detail.cases) ? detail.cases : [];
    var term = normalizeSearchText(state.casesSearchText || '');
    if (!term) return list;
    return list.filter(function(item) {
      var hay = buildCaseSearchHay(item);
      return hay.indexOf(term) !== -1;
    });
  }

  function setStatus(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function isAuthReady() {
    if (window.app && window.app.authReady === true) return true;
    var globalState = window.app && window.app.state ? window.app.state : null;
    return Boolean(globalState && globalState.currentUser);
  }

  function getCurrentUser() {
    var globalState = window.app && window.app.state ? window.app.state : null;
    return globalState && globalState.currentUser ? globalState.currentUser : null;
  }

  function normalizeLevel(level) {
    if (!level && level !== 0) return '';
    var lower = String(level).toLowerCase();
    if (lower === '组长') return 'leader';
    if (lower === '组员') return 'member';
    return lower;
  }

  function isAdminUser(user) {
    return Boolean(user && String(user.role || '') === 'admin');
  }

  function isLeaderUser(user) {
    var level = user && user.level ? user.level : '';
    return normalizeLevel(level) === 'leader';
  }

  function showCenterToast(message, type, duration) {
    if (utils && typeof utils.showCenterToast === 'function') {
      utils.showCenterToast(message, type, duration);
      return;
    }
    setStatus(dom.drawerStatus, message, type || '');
  }

  function normalizeArchiveState(value) {
    var raw = value === null || value === undefined ? '' : String(value || '').trim().toLowerCase();
    if (!raw) return 'archived';
    if (raw === 'rerun' || raw === 'reexec' || raw === 're-run' || raw === '重执') return 'rerun';
    if (raw === 'archived' || raw === '已归') return 'archived';
    return raw;
  }

  function getArchiveRowState(row) {
    if (!row || typeof row !== 'object') return 'archived';
    return normalizeArchiveState(row.archive_state || row.archiveState || row.archive_status || row.archiveStatus);
  }

  function findArchiveRow(execSetId) {
    var rows = Array.isArray(state.rows) ? state.rows : [];
    var id = String(execSetId || '');
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (!row) continue;
      if (String(row.exec_set_id || row.execSetId || '') === id) return row;
    }
    return null;
  }

  function normalizeTimeInput(input) {
    if (!input) return '';
    if (typeof input === 'number') return input;
    var raw = String(input || '').trim();
    if (!raw) return '';
    if (/Z$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw + 'Z';
    if (/^\d{4}-\d{2}-\d{2} /.test(raw)) return raw.replace(' ', 'T') + 'Z';
    return raw;
  }

  function formatTime(input) {
    var normalized = normalizeTimeInput(input);
    if (!normalized) return '';
    var date = normalized instanceof Date ? normalized : new Date(normalized);
    if (!date || Number.isNaN(date.getTime())) return String(input || '');
    var pad = function(num) { return num < 10 ? '0' + num : String(num); };
    return (
      date.getFullYear() +
      '-' +
      pad(date.getMonth() + 1) +
      '-' +
      pad(date.getDate()) +
      ' ' +
      pad(date.getHours()) +
      ':' +
      pad(date.getMinutes()) +
      ':' +
      pad(date.getSeconds())
    );
  }

  function normalizeExecStatus(value) {
    var text = value === null || value === undefined ? '' : String(value);
    text = text.trim();
    if (!text) return '未执行';
    if (text === 'pending') return '未执行';
    return text;
  }

  function mapStatusToClass(status) {
    var text = normalizeExecStatus(status);
    if (text === '通过') return 'passed';
    if (text === '失败') return 'failed';
    if (text === '阻塞') return 'blocked';
    if (text === '不适用') return 'unspecified';
    if (text === '变更重跑' || text === '有改动') return 'changed';
    return 'pending';
  }

  function getTempExecResultOptions() {
    var config = window.app && window.app.config ? window.app.config : {};
    var list = config && Array.isArray(config.tempExecResultOptions) ? config.tempExecResultOptions : null;
    if (list && list.length) return list.slice();
    return ['未执行', '通过', '失败', '阻塞', '不适用'];
  }

  function parseReuseDetails(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }
    return [];
  }

  function parseDefectUrls(item) {
    var merged = [];
    if (!item || typeof item !== 'object') return merged;
    var defectSingle = item.defect_link ? String(item.defect_link) : '';
    if (defectSingle && defectSingle.trim()) merged.push(defectSingle.trim());
    var defectLinks = item.defect_links;
    if (defectLinks) {
      if (Array.isArray(defectLinks)) {
        defectLinks.forEach(function(d) {
          if (d === null || d === undefined) return;
          if (typeof d === 'string') {
            if (d.trim()) merged.push(d.trim());
            return;
          }
          if (d && typeof d === 'object' && d.url) {
            var url = String(d.url);
            if (url.trim()) merged.push(url.trim());
          }
        });
      } else if (typeof defectLinks === 'string') {
        if (defectLinks.trim()) merged.push(defectLinks.trim());
      }
    }
    // 简单去重（保持顺序）
    var seen = {};
    return merged.filter(function(u) {
      var k = String(u || '').trim();
      if (!k) return false;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function normalizeDefectOpenUrl(url) {
    var text = (url || '').trim();
    if (!text) return '';
    var lower = text.toLowerCase();
    if (lower.indexOf('http://') === 0 || lower.indexOf('https://') === 0) return text;
    if (/^[a-z][a-z0-9+.-]*:/.test(text)) return text;
    return 'https://' + text;
  }

  function ensureCasePanelState(execSetId) {
    var sid = execSetId === null || execSetId === undefined ? '' : String(execSetId);
    if (!sid) sid = 'unknown';
    if (!state.casePanelOpenByExecSet[sid] || typeof state.casePanelOpenByExecSet[sid] !== 'object') {
      state.casePanelOpenByExecSet[sid] = { remark: new Set(), defect: new Set(), reuse: new Set() };
    }
    return state.casePanelOpenByExecSet[sid];
  }

  function resetCasePanelState(execSetId) {
    var sid = execSetId === null || execSetId === undefined ? '' : String(execSetId);
    if (!sid) sid = 'unknown';
    state.casePanelOpenByExecSet[sid] = { remark: new Set(), defect: new Set(), reuse: new Set() };
    return state.casePanelOpenByExecSet[sid];
  }

  function buildReadonlyStatusSelect(currentStatus) {
    var status = normalizeExecStatus(currentStatus);
    var options = getTempExecResultOptions();
    var html = '';
    if (status === '变更重跑' || status === '有改动') {
      html += '<option value="' + escapeHtml(status) + '" selected disabled>' + escapeHtml(status) + '</option>';
    }
    html += options.map(function(opt) {
      return '<option value="' + escapeHtml(opt) + '" ' + (status === opt ? 'selected' : '') + '>' + escapeHtml(opt) + '</option>';
    }).join('');
    return (
      '<select class="status-select" disabled data-status="' + escapeHtml(status) + '">' +
        html +
      '</select>'
    );
  }

  function renderReadonlyReusePanel(item) {
    var details = parseReuseDetails(item && item.reuse_details !== undefined ? item.reuse_details : null);
    if (!details.length) return '<p class="reuse-empty">暂无复用子项。</p>';
    return (
      '<div class="reuse-list">' +
        details.map(function(d, i) {
          if (!d || typeof d !== 'object') return '';
          var text = d.text ? String(d.text) : ('子项' + (i + 1));
          var note = d.note ? String(d.note) : '';
          var st = normalizeExecStatus(d.status);
          var cls = mapStatusToClass(st);
          return (
            '<div class="reuse-entry readonly">' +
              '<div class="reuse-input readonly">' + escapeHtml(text) + '</div>' +
              '<div class="reuse-note readonly">' + escapeHtml(note) + '</div>' +
              '<span class="status-select ' + escapeHtml(cls) + '">' + escapeHtml(st) + '</span>' +
            '</div>'
          );
        }).filter(Boolean).join('') +
      '</div>'
    );
  }

  function renderReadonlyDefectPanel(item) {
    var urls = parseDefectUrls(item);
    if (!urls.length) return '<p class="reuse-empty">暂无缺陷链接。</p>';
    return (
      '<div class="defect-list">' +
        urls.map(function(url) {
          return (
            '<div class="defect-entry readonly">' +
              '<div class="defect-url" title="' + escapeHtml(url) + '">' + escapeHtml(url) + '</div>' +
              '<button type="button" class="defect-open" data-case-archive-defect-open="' + escapeHtml(url) + '">打开</button>' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  function ensureDrawer() {
    if (state.drawer) return state.drawer;
    if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
    state.drawer = window.app.drawer.createDrawer({
      drawerId: 'caseArchiveDrawer',
      openButtons: ['openCaseArchiveDrawerBtn'],
      onOpen: function() {
        state.listPageIndex = 0;
        setStatus(dom.drawerStatus, '加载归档列表中...', '');
        loadProjects().then(function() {
          syncProjectSelect();
          return loadVersions(state.currentProjectId);
        }).then(function() {
          return loadArchives();
        });
      },
    });
    return state.drawer;
  }

  function syncProjectSelect() {
    if (!dom.projectSelect) return;
    var list = Array.isArray(state.projects) ? state.projects : [];
    var active = state.currentProjectId ? String(state.currentProjectId || '') : '';
    var globalState = window.app && window.app.state ? window.app.state : {};
    var defaultPid = '';
    if (utils && typeof utils.resolveDefaultProjectIdByUserSettings === 'function') {
      defaultPid = utils.resolveDefaultProjectIdByUserSettings(list, globalState);
    }
    if (!active || !list.some(function(p) { return p && String(p.id) === active; })) {
      active = defaultPid || (list.length ? String(list[0].id) : '');
      state.currentProjectId = active;
    }
    var options = ['<option value=""' + (active ? '' : ' selected') + '>请选择项目</option>'];
    list.forEach(function(p) {
      if (!p || p.id === null || p.id === undefined) return;
      var pid = String(p.id);
      var selected = active && pid === active ? ' selected' : '';
      options.push('<option value="' + escapeHtml(pid) + '"' + selected + '>' + escapeHtml(p.name || ('项目#' + pid)) + '</option>');
    });
    dom.projectSelect.innerHTML = options.join('');
    if (dom.projectSelect.value !== active) dom.projectSelect.value = active;
    syncVersionSelect();
  }

  function syncVersionSelect() {
    if (!dom.versionSelect) return;
    var list = Array.isArray(state.versions) ? state.versions : [];
    var pid = state.currentProjectId ? String(state.currentProjectId || '') : '';
    dom.versionSelect.disabled = !pid;
    if (!pid) {
      dom.versionSelect.innerHTML = '<option value="" selected>请先选择项目</option>';
      return;
    }
    var active = state.currentVersionId ? String(state.currentVersionId || '') : '';
    if (active && !list.some(function(v) { return v && String(v.id) === active; })) {
      active = '';
      state.currentVersionId = '';
    }
    var options = ['<option value=""' + (active ? '' : ' selected') + '>全部版本</option>'];
    list.forEach(function(v) {
      if (!v || v.id === null || v.id === undefined) return;
      var vid = String(v.id);
      var selected = active && vid === active ? ' selected' : '';
      options.push('<option value="' + escapeHtml(vid) + '"' + selected + '>' + escapeHtml(v.name || ('版本#' + vid)) + '</option>');
    });
    dom.versionSelect.innerHTML = options.join('');
    if (dom.versionSelect.value !== active) dom.versionSelect.value = active;
  }

  function loadProjects() {
    if (!api.listProjects) return Promise.resolve([]);
    return api
      .listProjects()
      .then(function(list) {
        var projects = Array.isArray(list) ? list : [];
        var globalState = window.app && window.app.state ? window.app.state : {};
        if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
          projects = utils.sortProjectsByUserSettings(projects, globalState);
        }
        state.projects = projects;
        return state.projects;
      })
      .catch(function(err) {
        state.projects = [];
        setStatus(dom.drawerStatus, err && err.message ? err.message : '项目加载失败', 'err');
        return [];
      });
  }

  function loadVersions(projectId) {
    if (!api.listProjectVersions) return Promise.resolve([]);
    var pid = projectId ? String(projectId || '') : '';
    if (!pid) {
      state.versions = [];
      syncVersionSelect();
      return Promise.resolve([]);
    }
    return api
      .listProjectVersions(pid)
      .then(function(list) {
        state.versions = Array.isArray(list) ? list : [];
        syncVersionSelect();
        return state.versions;
      })
      .catch(function() {
        state.versions = [];
        syncVersionSelect();
        return [];
      });
  }

  function loadArchives() {
    if (!api.listExecArchives) return Promise.resolve([]);
    var pid = state.currentProjectId ? String(state.currentProjectId || '') : '';
    if (!pid) {
      state.rows = [];
      state.listPageIndex = 0;
      renderList();
      setStatus(dom.drawerStatus, '请先选择项目', 'warn');
      return Promise.resolve([]);
    }
    var vid = state.currentVersionId ? String(state.currentVersionId || '') : '';
    var term = state.q ? String(state.q || '').trim() : '';
    setStatus(dom.drawerStatus, '加载中...', '');
    return api
      .listExecArchives({
        project_id: Number(pid),
        version_id: vid ? Number(vid) : undefined,
        q: term,
        limit: 200,
        offset: 0,
      })
      .then(function(rows) {
        state.rows = Array.isArray(rows) ? rows : [];
        state.listPageIndex = 0;
        renderList();
        setStatus(dom.drawerStatus, '', '');
        return state.rows;
      })
      .catch(function(err) {
        state.rows = [];
        state.listPageIndex = 0;
        renderList();
        setStatus(dom.drawerStatus, err && err.message ? err.message : '归档列表加载失败', 'err');
        return [];
      });
  }

  function setListPagination(html) {
    if (dom.listPaginationTop) dom.listPaginationTop.innerHTML = html || '';
    if (dom.listPaginationBottom) dom.listPaginationBottom.innerHTML = html || '';
  }

  function buildListPagination(total, pageIndex, totalPages, start, end) {
    total = Number(total) || 0;
    pageIndex = Number(pageIndex) || 0;
    totalPages = Number(totalPages) || 1;
    start = Number(start) || 0;
    end = Number(end) || 0;
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var maxPage = totalPages || 1;
    var rangeInfo = total ? ('显示 ' + (start + 1) + '-' + end + ' / 共 ' + total + ' 条') : '暂无记录';
    return (
      '<div class="temp-pagination" data-case-archive-list-pagination>' +
        '<div class="temp-pagination-info">' + escapeHtml(rangeInfo) + '，每页 ' + getPageSize() + ' 条</div>' +
        '<div class="temp-pagination-controls">' +
          '<button type="button" class="secondary" data-case-archive-list-page="first" ' + (pageIndex <= 0 ? 'disabled' : '') + '>首页</button>' +
          '<button type="button" class="secondary" data-case-archive-list-page="prev" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<button type="button" class="secondary" data-case-archive-list-page="next" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<button type="button" class="secondary" data-case-archive-list-page="last" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>末页</button>' +
          '<label>跳转</label>' +
          '<input type="number" min="1" max="' + maxPage + '" value="' + Math.min(currentPage, maxPage) + '" data-case-archive-list-page-input>' +
        '</div>' +
      '</div>'
    );
  }

  function renderList() {
    if (!dom.listBody) return;
    var rows = Array.isArray(state.rows) ? state.rows : [];
    if (!rows.length) {
      dom.listBody.innerHTML = '';
      if (dom.listEmpty) dom.listEmpty.classList.remove('hidden');
      setListPagination(buildListPagination(0, 0, 1, 0, 0));
      return;
    }
    if (dom.listEmpty) dom.listEmpty.classList.add('hidden');
    var user = state.currentUser || getCurrentUser();
    var isAdmin = isAdminUser(user);
    var pageSize = getPageSize();
    var total = rows.length;
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!Number.isFinite(state.listPageIndex) || state.listPageIndex < 0) state.listPageIndex = 0;
    if (state.listPageIndex >= totalPages) state.listPageIndex = Math.max(totalPages - 1, 0);
    var start = state.listPageIndex * pageSize;
    var end = Math.min(total, start + pageSize);
    var view = rows.slice(start, end);
    setListPagination(buildListPagination(total, state.listPageIndex, totalPages, start, end));
    dom.listBody.innerHTML = view.map(function(row, idx) {
      var reuseText = row && row.reuse_enabled ? '复用' : '非复用';
      var archiveState = getArchiveRowState(row);
      var stateLabel = archiveState === 'rerun' ? '重执' : '已归';
      var stateClass = archiveState === 'rerun' ? 'tag case-archive-rerun' : 'tag tag-archived';
      var rearchiveCount = row && (row.rearchive_count || row.rearchiveCount);
      if (rearchiveCount === undefined || rearchiveCount === null || rearchiveCount === '') rearchiveCount = 0;
      var ops = [
        '<button type="button" class="pill secondary tiny" data-case-archive-action="view" data-case-archive-id="' + escapeHtml(String(row.exec_set_id)) + '">查看</button>',
        '<button type="button" class="pill secondary tiny" data-case-archive-action="restore" data-case-archive-id="' + escapeHtml(String(row.exec_set_id)) + '">恢复</button>',
      ];
      if (isAdmin) {
        ops.push('<button type="button" class="pill secondary tiny danger" data-case-archive-action="delete" data-case-archive-id="' + escapeHtml(String(row.exec_set_id)) + '">删除</button>');
      }
      return (
        '<tr>' +
          '<td>' + (start + idx + 1) + '</td>' +
          '<td>' + escapeHtml(row.project_name || '') + '</td>' +
          '<td>' + escapeHtml(row.version_name || '--') + '</td>' +
          '<td title="' + escapeHtml(row.name || '') + '">' + escapeHtml(row.name || '') + '</td>' +
          '<td>' + escapeHtml(String(row.case_count || 0)) + '</td>' +
          '<td>' + escapeHtml(String(rearchiveCount || 0)) + '</td>' +
          '<td><span class="' + escapeHtml(stateClass) + '">' + escapeHtml(stateLabel) + '</span></td>' +
          '<td>' + escapeHtml(reuseText) + '</td>' +
          '<td>' + escapeHtml(row.imported_by_name || '--') + '</td>' +
          '<td>' + escapeHtml(formatTime(row.imported_at || '')) + '</td>' +
          '<td>' + escapeHtml(row.archived_by_name || '--') + '</td>' +
          '<td>' + escapeHtml(formatTime(row.archived_at || '')) + '</td>' +
          '<td class="ops">' + ops.join(' ') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function showDetail(detail) {
    if (!dom.detailCard) return;
    var d = detail && typeof detail === 'object' ? detail : null;
    state.selected = d;
    if (!d) {
      dom.detailCard.classList.add('hidden');
      state.selected = null;
      state.casesPageIndex = 0;
      state.restoringDetail = null;
      clearDetailPersistedState();
      return;
    }
    // 切换详情时清空只读展开状态，避免复用之前的展开状态造成误解。
    resetCasePanelState(d.exec_set_id);
    dom.detailCard.classList.remove('hidden');
    var shouldRestore = false;
    var restoring = state.restoringDetail && typeof state.restoringDetail === 'object' ? state.restoringDetail : null;
    if (restoring && restoring.execSetId && String(restoring.execSetId) === String(d.exec_set_id)) {
      shouldRestore = true;
    }
    if (shouldRestore) {
      state.casesPageIndex = Number(restoring.casesPageIndex) || 0;
    } else {
      state.casesPageIndex = 0;
    }
    state.restoringDetail = null;
    state.casesSearchText = '';
    if (dom.detailSearchInput) dom.detailSearchInput.value = '';
    if (dom.detailTitle) dom.detailTitle.textContent = '归档用例视图：' + (d.name || '');
    if (dom.detailProject) dom.detailProject.textContent = d.project_name || '--';
    if (dom.detailVersion) dom.detailVersion.textContent = d.version_name || '--';
    if (dom.detailName) dom.detailName.textContent = d.name || '--';
    if (dom.detailReuse) dom.detailReuse.textContent = d.reuse_enabled ? '复用' : '非复用';
    if (dom.detailCount) dom.detailCount.textContent = String(d.case_count || 0);
    if (dom.detailImporter) dom.detailImporter.textContent = d.imported_by_name || '--';
    if (dom.detailImportedAt) dom.detailImportedAt.textContent = formatTime(d.imported_at || '') || '--';
    if (dom.detailArchiver) dom.detailArchiver.textContent = d.archived_by_name || '--';
    if (dom.detailArchivedAt) dom.detailArchivedAt.textContent = formatTime(d.archived_at || '') || '--';
    if (dom.detailReason) dom.detailReason.textContent = d.archived_reason ? String(d.archived_reason) : '--';
    renderCases(d);
    persistDetailSelection({ execSetId: d.exec_set_id, casesPageIndex: state.casesPageIndex });
  }

  function setCasesPagination(html) {
    if (dom.casesPaginationTop) dom.casesPaginationTop.innerHTML = html || '';
    if (dom.casesPaginationBottom) dom.casesPaginationBottom.innerHTML = html || '';
  }

  function buildCasesPagination(total, pageIndex, totalPages, start, end) {
    total = Number(total) || 0;
    pageIndex = Number(pageIndex) || 0;
    totalPages = Number(totalPages) || 1;
    start = Number(start) || 0;
    end = Number(end) || 0;
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var maxPage = totalPages || 1;
    var rangeInfo = total ? ('显示 ' + (start + 1) + '-' + end + ' / 共 ' + total + ' 条') : '暂无记录';
    return (
      '<div class="temp-pagination" data-case-archive-cases-pagination>' +
        '<div class="temp-pagination-info">' + escapeHtml(rangeInfo) + '，每页 ' + getPageSize() + ' 条</div>' +
        '<div class="temp-pagination-controls">' +
          '<button type="button" class="secondary" data-case-archive-cases-page="first" ' + (pageIndex <= 0 ? 'disabled' : '') + '>首页</button>' +
          '<button type="button" class="secondary" data-case-archive-cases-page="prev" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<button type="button" class="secondary" data-case-archive-cases-page="next" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<button type="button" class="secondary" data-case-archive-cases-page="last" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>末页</button>' +
          '<label>跳转</label>' +
          '<input type="number" min="1" max="' + maxPage + '" value="' + Math.min(currentPage, maxPage) + '" data-case-archive-cases-page-input>' +
        '</div>' +
      '</div>'
    );
  }

  function renderCases(detail) {
    if (!dom.casesBody) return;
    var list = getFilteredCases(detail);
    if (!list.length) {
      dom.casesBody.innerHTML = '';
      if (dom.casesEmpty) dom.casesEmpty.classList.remove('hidden');
      setCasesPagination(buildCasesPagination(0, 0, 1, 0, 0));
      return;
    }
    if (dom.casesEmpty) dom.casesEmpty.classList.add('hidden');
    var reuseEnabled = Boolean(detail && detail.reuse_enabled);
    var panelState = ensureCasePanelState(detail && detail.exec_set_id ? detail.exec_set_id : '');
    var pageSize = getPageSize();
    var total = list.length;
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (!Number.isFinite(state.casesPageIndex) || state.casesPageIndex < 0) state.casesPageIndex = 0;
    if (state.casesPageIndex >= totalPages) state.casesPageIndex = Math.max(totalPages - 1, 0);
    var start = state.casesPageIndex * pageSize;
    var end = Math.min(total, start + pageSize);
    var view = list.slice(start, end);
    setCasesPagination(buildCasesPagination(total, state.casesPageIndex, totalPages, start, end));
    var colCount = 10;
    dom.casesBody.innerHTML = view.map(function(item, idx) {
      var caseId = item && item.id !== null && item.id !== undefined ? String(item.id) : String(start + idx + 1);
      var statusText = normalizeExecStatus(item && item.status ? item.status : '');
      var statusClass = mapStatusToClass(statusText);

      var remark = item && item.remark ? String(item.remark) : '';
      var hasRemark = Boolean(remark && remark.trim());
      var remarkOpen = panelState.remark && panelState.remark.has(caseId);
      var remarkBtnClass = ['remark-toggle'];
      if (remarkOpen) remarkBtnClass.push('active');
      if (hasRemark) remarkBtnClass.push('filled');

      var defectUrls = parseDefectUrls(item);
      var hasDefects = defectUrls.length > 0;
      var defectOpen = panelState.defect && panelState.defect.has(caseId);
      var defectBtnClass = ['defect-toggle'];
      if (defectOpen) defectBtnClass.push('active');
      if (hasDefects) defectBtnClass.push('filled');

      var reuseOpen = panelState.reuse && panelState.reuse.has(caseId);
      var actualCell = reuseEnabled
        ? (
          '<td class="reuse-cell actual">' +
            '<button type="button" class="reuse-status ' + escapeHtml(statusClass) + '" data-case-archive-reuse-toggle="' + escapeHtml(caseId) + '">' +
              escapeHtml(statusText) +
            '</button>' +
          '</td>'
        )
        : (
          '<td class="actual">' +
            buildReadonlyStatusSelect(statusText) +
          '</td>'
        );

      var mainRow = (
        '<tr data-case-archive-case-row="main" data-case-archive-case-id="' + escapeHtml(caseId) + '">' +
          '<td class="index">' + (start + idx + 1) + '</td>' +
          '<td class="module">' + escapeHtml(item && item.module ? item.module : '') + '</td>' +
          '<td class="title">' + escapeHtml(item && item.title ? item.title : '') + '</td>' +
          '<td>' + escapeHtml(item && item.priority ? item.priority : '') + '</td>' +
          '<td>' + escapeHtmlPreserve(item && item.precondition ? item.precondition : '') + '</td>' +
          '<td>' + escapeHtmlPreserve(item && item.steps ? item.steps : '') + '</td>' +
          '<td>' + escapeHtmlPreserve(item && item.expected ? item.expected : '') + '</td>' +
          actualCell +
          '<td>' +
            '<button type="button" class="' + remarkBtnClass.join(' ') + '" data-case-archive-remark-toggle="' + escapeHtml(caseId) + '">' +
              (hasRemark ? '备注已填' : '备注') +
            '</button>' +
          '</td>' +
          '<td>' +
            '<button type="button" class="' + defectBtnClass.join(' ') + '" data-case-archive-defect-toggle="' + escapeHtml(caseId) + '">' +
              (hasDefects ? '链接已填' : '缺陷链接') +
            '</button>' +
          '</td>' +
        '</tr>'
      );

      var reuseRow = reuseEnabled
        ? (
          '<tr class="reuse-row ' + (reuseOpen ? 'visible' : '') + '" data-case-archive-reuse-row="' + escapeHtml(caseId) + '">' +
            '<td colspan="' + colCount + '">' +
              '<div class="reuse-panel readonly">' +
                renderReadonlyReusePanel(item) +
              '</div>' +
            '</td>' +
          '</tr>'
        )
        : '';

      var remarkRow = (
        '<tr class="remark-row ' + (remarkOpen ? 'visible' : '') + '" data-case-archive-remark-row="' + escapeHtml(caseId) + '">' +
          '<td colspan="' + colCount + '">' +
            '<div class="remark-panel readonly">' + escapeHtmlPreserve(remark || '') + '</div>' +
          '</td>' +
        '</tr>'
      );

      var defectRow = (
        '<tr class="defect-row ' + (defectOpen ? 'visible' : '') + '" data-case-archive-defect-row="' + escapeHtml(caseId) + '">' +
          '<td colspan="' + colCount + '">' +
            '<div class="defect-panel readonly">' +
              renderReadonlyDefectPanel(item) +
            '</div>' +
          '</td>' +
        '</tr>'
      );

      return mainRow + reuseRow + remarkRow + defectRow;
    }).join('');
  }

  function openDetail(execSetId) {
    if (!api.getExecArchive) return;
    var sid = Number(execSetId);
    if (!Number.isFinite(sid) || sid <= 0) return;
    state.restoringDetail = null;
    setStatus(dom.status, '加载归档用例中...', '');
    api
      .getExecArchive(sid)
      .then(function(detail) {
        showDetail(detail);
        setStatus(dom.status, '', '');
        // 关闭抽屉后展示详情
        try {
          var drawer = ensureDrawer();
          if (drawer && typeof drawer.close === 'function') drawer.close();
        } catch (e) {
          // ignore
        }
      })
      .catch(function(err) {
        showDetail(null);
        setStatus(dom.status, err && err.message ? err.message : '归档用例加载失败', 'err');
      });
  }

  function deleteArchive(execSetId) {
    if (!api.deleteExecArchive) return;
    var sid = Number(execSetId);
    if (!Number.isFinite(sid) || sid <= 0) return;
    var row = findArchiveRow(sid);
    if (getArchiveRowState(row) === 'rerun') {
      showCenterToast('重执状态下无法删除归档记录', 'warn', 3000);
      return;
    }
    var drawerRef = ensureDrawer();
    openConfirmDrawer({
      title: '确认删除归档',
      message: '确定删除该归档记录吗？此操作不可撤销。',
      confirmText: '确认删除',
      cancelText: '取消',
      previousDrawer: drawerRef,
    }).then(function(res) {
      if (!res || res.ok !== true) return;
      setStatus(dom.drawerStatus, '删除中...', '');
      api
        .deleteExecArchive(sid)
        .then(function() {
          setStatus(dom.drawerStatus, '已删除', 'ok');
          return loadArchives();
        })
        .catch(function(err) {
          setStatus(dom.drawerStatus, err && err.message ? err.message : '删除失败', 'err');
        });
    });
  }

  function formatArchiveVersionLabel(row, resp) {
    var versionName = (resp && resp.version_name) || (row && row.version_name) || '';
    var projectName = (row && row.project_name) ? String(row.project_name) : '';
    var versionLabel = versionName ? ('版本' + versionName) : '';
    if (!versionLabel && (row && row.version_id)) {
      versionLabel = '版本#' + String(row.version_id);
    }
    if (!versionLabel) versionLabel = '未指定版本';
    if (projectName) {
      return projectName + ' / ' + versionLabel;
    }
    return versionLabel;
  }

  function normalizeArchiveIdValue(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value);
  }

  function isSameArchiveExecSet(set, row) {
    if (!set || !row) return false;
    if (normalizeArchiveIdValue(set.project_id) !== normalizeArchiveIdValue(row.project_id)) return false;
    if (normalizeArchiveIdValue(set.version_id) !== normalizeArchiveIdValue(row.version_id)) return false;
    var setName = String(set.name || '').trim();
    var rowName = String(row.name || '').trim();
    if (!setName || !rowName) return false;
    return setName === rowName;
  }

  function checkDuplicateActiveExecSet(row, options) {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client || typeof client.listExecSets !== 'function') {
      return Promise.resolve(false);
    }
    if (!row) return Promise.resolve(false);
    var projectId = row && row.project_id !== null && row.project_id !== undefined ? row.project_id : null;
    var opts = { status_filter: 'active' };
    if (options && options.allUsers) opts.all_users = true;
    return client
      .listExecSets(projectId, opts)
      .then(function(sets) {
        var list = Array.isArray(sets) ? sets : [];
        return list.some(function(set) { return isSameArchiveExecSet(set, row); });
      })
      .catch(function() { return false; });
  }

  function checkCaseFileDeleted(row) {
    var client = window.app && window.app.apiClient ? window.app.apiClient : null;
    if (!client || typeof client.listCaseFiles !== 'function') {
      return Promise.resolve(false);
    }
    if (!row) return Promise.resolve(false);
    var projectId = row && row.project_id !== null && row.project_id !== undefined ? row.project_id : null;
    if (projectId === null || projectId === undefined || projectId === '') return Promise.resolve(false);
    var targetName = String(row.name || '').trim();
    if (!targetName) return Promise.resolve(false);
    return client
      .listCaseFiles(projectId)
      .then(function(files) {
        var list = Array.isArray(files) ? files : [];
        var exists = list.some(function(file) {
          var name = file && file.file_name_clean ? String(file.file_name_clean || '').trim() : '';
          return name && name === targetName;
        });
        return !exists;
      })
      .catch(function() {
        return false;
      });
  }

  function refreshTempExecAfterRestore() {
    var tempApi = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
    if (tempApi && typeof tempApi.loadTempExecState === 'function') {
      tempApi.loadTempExecState();
    }
  }

  function restoreArchive(execSetId) {
    if (!api.restoreExecArchive) return;
    var sid = Number(execSetId);
    if (!Number.isFinite(sid) || sid <= 0) return;
    var row = findArchiveRow(sid);
    var archiveState = getArchiveRowState(row);
    if (archiveState === 'rerun') {
      showCenterToast('该归档用例处于重执状态，需重新归档后再恢复', 'warn', 3000);
      return;
    }
    var user = state.currentUser || getCurrentUser();
    checkCaseFileDeleted(row).then(function(deleted) {
      if (deleted) {
        showCenterToast('该用例已从用例库中删除，无法进行恢复！！！', 'warn', 5000);
        return;
      }
      if (!isAdminUser(user) && !isLeaderUser(user)) {
        checkDuplicateActiveExecSet(row).then(function(hasDuplicate) {
          if (hasDuplicate) {
            showCenterToast('执行页面已有相同执行用例，无法恢复。如需恢复，请先解散或者归档当前执行的同名用例', 'warn', 5000);
          } else {
            showCenterToast('恢复请联系 组长 或 管理员！！', 'warn', 5000);
          }
        });
        return;
      }
      var drawerRef = ensureDrawer();
      openConfirmDrawer({
        title: '确认恢复归档',
        message: '确认恢复该归档用例到执行页吗？恢复后将保留归档前执行结果，并同步用例库变更。',
        confirmText: '确认恢复',
        cancelText: '取消',
        previousDrawer: drawerRef,
      }).then(function(res) {
        if (!res || res.ok !== true) return;
        setStatus(dom.drawerStatus, '恢复中...', '');
        api
          .restoreExecArchive(sid)
          .then(function(resp) {
            setStatus(dom.drawerStatus, '已恢复', 'ok');
            var label = formatArchiveVersionLabel(row, resp);
            if (resp && resp.version_box_existed) {
              showCenterToast('已恢复到版本盒子：' + label, 'ok', 3000);
            } else {
              showCenterToast('已恢复并新建版本盒子：' + label, 'ok', 3000);
            }
            try {
              var restoredId = resp && (resp.restored_exec_set_id || resp.restoredExecSetId);
              if (restoredId !== null && restoredId !== undefined) {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem('tap-tempexec-pending-restore-diff', String(restoredId));
                }
              }
            } catch (err) {
              // ignore
            }
            return loadArchives().then(function() {
              refreshTempExecAfterRestore();
            });
          })
          .catch(function(err) {
            var payload = err && err.payload && err.payload.detail ? err.payload.detail : null;
            if (payload && payload.code === 'exec_set_duplicate') {
              showCenterToast(
                '该人员在执行页面已有相同执行用例。如需恢复，请先解散或者归档当前执行的同名用例。',
                'warn',
                5000
              );
            } else if (payload && payload.code === 'case_deleted') {
              showCenterToast('该用例已从用例库中删除，无法进行恢复！！！', 'warn', 5000);
            }
            var msg = err && err.message ? err.message : '恢复失败';
            setStatus(dom.drawerStatus, msg, 'err');
          });
      });
    });
  }

  function bindEvents() {
    if (dom.projectSelect) {
      dom.projectSelect.addEventListener('change', function() {
        state.currentProjectId = dom.projectSelect.value || '';
        state.currentVersionId = '';
        state.listPageIndex = 0;
        setStatus(dom.drawerStatus, '加载版本中...', '');
        loadVersions(state.currentProjectId).then(function() {
          return loadArchives();
        });
      });
    }
    if (dom.versionSelect) {
      dom.versionSelect.addEventListener('change', function() {
        state.currentVersionId = dom.versionSelect.value || '';
        state.listPageIndex = 0;
        loadArchives();
      });
    }
    if (dom.searchBtn) {
      dom.searchBtn.addEventListener('click', function() {
        state.q = dom.searchInput ? String(dom.searchInput.value || '').trim() : '';
        state.listPageIndex = 0;
        loadArchives();
      });
    }
    if (dom.clearBtn) {
      dom.clearBtn.addEventListener('click', function() {
        if (dom.searchInput) dom.searchInput.value = '';
        state.q = '';
        state.listPageIndex = 0;
        loadArchives();
      });
    }
    if (dom.searchInput) {
      dom.searchInput.addEventListener('keydown', function(e) {
        if (!e || e.key !== 'Enter') return;
        state.q = String(dom.searchInput.value || '').trim();
        state.listPageIndex = 0;
        loadArchives();
      });
    }
    if (dom.listBody) {
      dom.listBody.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-action]') : null;
        if (!btn || !btn.dataset) return;
        var action = btn.dataset.caseArchiveAction || '';
        var id = btn.dataset.caseArchiveId || '';
        if (!id) return;
        if (action === 'view') {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          openDetail(id);
        } else if (action === 'restore') {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          restoreArchive(id);
        } else if (action === 'delete') {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          deleteArchive(id);
        }
      });
    }
    if (dom.casesBody) {
      dom.casesBody.addEventListener('click', function(e) {
        if (!state.selected || !state.selected.exec_set_id) return;
        var openBtn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-defect-open]') : null;
        if (openBtn) {
          var rawUrl = openBtn.getAttribute('data-case-archive-defect-open') || '';
          var targetUrl = normalizeDefectOpenUrl(rawUrl);
          if (targetUrl) window.open(targetUrl, '_blank');
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          return;
        }
        var remarkBtn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-remark-toggle]') : null;
        if (remarkBtn) {
          var rid = remarkBtn.getAttribute('data-case-archive-remark-toggle') || '';
          if (rid) {
            var panels = ensureCasePanelState(state.selected.exec_set_id);
            if (panels.remark.has(rid)) panels.remark.delete(rid);
            else panels.remark.add(rid);
            renderCases(state.selected);
            persistDetailSelection();
          }
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          return;
        }
        var defectBtn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-defect-toggle]') : null;
        if (defectBtn) {
          var did = defectBtn.getAttribute('data-case-archive-defect-toggle') || '';
          if (did) {
            var panels2 = ensureCasePanelState(state.selected.exec_set_id);
            if (panels2.defect.has(did)) panels2.defect.delete(did);
            else panels2.defect.add(did);
            renderCases(state.selected);
            persistDetailSelection();
          }
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          return;
        }
        var reuseBtn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-reuse-toggle]') : null;
        if (reuseBtn) {
          var uid = reuseBtn.getAttribute('data-case-archive-reuse-toggle') || '';
          if (uid) {
            var panels3 = ensureCasePanelState(state.selected.exec_set_id);
            if (panels3.reuse.has(uid)) panels3.reuse.delete(uid);
            else panels3.reuse.add(uid);
            renderCases(state.selected);
            persistDetailSelection();
          }
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          return;
        }
      });
    }
    if (dom.listPaginationTop) {
      dom.listPaginationTop.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-list-page]') : null;
        if (!btn || !btn.dataset) return;
        var action = btn.dataset.caseArchiveListPage || '';
        var total = Array.isArray(state.rows) ? state.rows.length : 0;
        var pageSize = getPageSize();
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        if (action === 'prev') state.listPageIndex -= 1;
        else if (action === 'next') state.listPageIndex += 1;
        else if (action === 'first') state.listPageIndex = 0;
        else if (action === 'last') state.listPageIndex = totalPages - 1;
        if (state.listPageIndex < 0) state.listPageIndex = 0;
        if (state.listPageIndex >= totalPages) state.listPageIndex = Math.max(totalPages - 1, 0);
        renderList();
      });
      dom.listPaginationTop.addEventListener('change', function(e) {
        var input = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-list-page-input]') : null;
        if (!input) return;
        var total = Array.isArray(state.rows) ? state.rows.length : 0;
        var pageSize = getPageSize();
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        var n = Number(input.value);
        if (!isFinite(n)) return;
        var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
        state.listPageIndex = idx;
        renderList();
      });
    }
    if (dom.listPaginationBottom) {
      dom.listPaginationBottom.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-list-page]') : null;
        if (!btn || !btn.dataset) return;
        var action = btn.dataset.caseArchiveListPage || '';
        var total = Array.isArray(state.rows) ? state.rows.length : 0;
        var pageSize = getPageSize();
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        if (action === 'prev') state.listPageIndex -= 1;
        else if (action === 'next') state.listPageIndex += 1;
        else if (action === 'first') state.listPageIndex = 0;
        else if (action === 'last') state.listPageIndex = totalPages - 1;
        if (state.listPageIndex < 0) state.listPageIndex = 0;
        if (state.listPageIndex >= totalPages) state.listPageIndex = Math.max(totalPages - 1, 0);
        renderList();
      });
      dom.listPaginationBottom.addEventListener('change', function(e) {
        var input = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-list-page-input]') : null;
        if (!input) return;
        var total = Array.isArray(state.rows) ? state.rows.length : 0;
        var pageSize = getPageSize();
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        var n = Number(input.value);
        if (!isFinite(n)) return;
        var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
        state.listPageIndex = idx;
        renderList();
      });
    }
    if (dom.casesPaginationTop) {
      dom.casesPaginationTop.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-cases-page]') : null;
        if (!btn || !btn.dataset) return;
        var action = btn.dataset.caseArchiveCasesPage || '';
        var total = state.selected && Array.isArray(state.selected.cases) ? state.selected.cases.length : 0;
        var pageSize = getPageSize();
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        if (action === 'prev') state.casesPageIndex -= 1;
        else if (action === 'next') state.casesPageIndex += 1;
        else if (action === 'first') state.casesPageIndex = 0;
        else if (action === 'last') state.casesPageIndex = totalPages - 1;
        if (state.casesPageIndex < 0) state.casesPageIndex = 0;
        if (state.casesPageIndex >= totalPages) state.casesPageIndex = Math.max(totalPages - 1, 0);
        renderCases(state.selected);
        persistDetailSelection();
      });
      dom.casesPaginationTop.addEventListener('change', function(e) {
        var input = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-cases-page-input]') : null;
        if (!input) return;
        var total = state.selected && Array.isArray(state.selected.cases) ? state.selected.cases.length : 0;
        var pageSize = getPageSize();
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        var n = Number(input.value);
        if (!isFinite(n)) return;
        var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
        state.casesPageIndex = idx;
        renderCases(state.selected);
        persistDetailSelection();
      });
    }
    if (dom.casesPaginationBottom) {
      dom.casesPaginationBottom.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-cases-page]') : null;
        if (!btn || !btn.dataset) return;
        var action = btn.dataset.caseArchiveCasesPage || '';
        var total = state.selected && Array.isArray(state.selected.cases) ? state.selected.cases.length : 0;
        var pageSize = getPageSize();
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        if (action === 'prev') state.casesPageIndex -= 1;
        else if (action === 'next') state.casesPageIndex += 1;
        else if (action === 'first') state.casesPageIndex = 0;
        else if (action === 'last') state.casesPageIndex = totalPages - 1;
        if (state.casesPageIndex < 0) state.casesPageIndex = 0;
        if (state.casesPageIndex >= totalPages) state.casesPageIndex = Math.max(totalPages - 1, 0);
        renderCases(state.selected);
        persistDetailSelection();
      });
      dom.casesPaginationBottom.addEventListener('change', function(e) {
        var input = e && e.target && e.target.closest ? e.target.closest('[data-case-archive-cases-page-input]') : null;
        if (!input) return;
        var total = state.selected && Array.isArray(state.selected.cases) ? state.selected.cases.length : 0;
        var pageSize = getPageSize();
        var totalPages = total ? Math.ceil(total / pageSize) : 1;
        var n = Number(input.value);
        if (!isFinite(n)) return;
        var idx = Math.max(0, Math.min(totalPages - 1, Math.floor(n - 1)));
        state.casesPageIndex = idx;
        renderCases(state.selected);
        persistDetailSelection();
      });
    }
    if (dom.openDrawerFromDetailBtn) {
      dom.openDrawerFromDetailBtn.addEventListener('click', function() {
        // 用户显式返回列表：不再恢复详情。
        showDetail(null);
        var drawer = ensureDrawer();
        if (drawer && typeof drawer.open === 'function') drawer.open();
      });
    }
    var debounce = utils && typeof utils.debounce === 'function' ? utils.debounce : null;
    var applyDetailSearch = function(next) {
      state.casesSearchText = next || '';
      state.casesPageIndex = 0;
      renderCases(state.selected);
      persistDetailSelection();
    };
    if (dom.detailSearchInput) {
      var onDetailSearchInput = function() {
        applyDetailSearch(String(dom.detailSearchInput.value || ''));
      };
      var handler = debounce ? debounce(onDetailSearchInput, 180) : onDetailSearchInput;
      dom.detailSearchInput.addEventListener('input', handler);
      dom.detailSearchInput.addEventListener('keydown', function(e) {
        if (!e || e.key !== 'Enter') return;
        applyDetailSearch(String(dom.detailSearchInput.value || ''));
      });
    }
    if (dom.detailSearchClearBtn) {
      dom.detailSearchClearBtn.addEventListener('click', function() {
        if (dom.detailSearchInput) dom.detailSearchInput.value = '';
        applyDetailSearch('');
      });
    }
  }

  function restoreDetailFromPersistedState() {
    if (!isAuthReady()) return false;
    if (!api.getExecArchive) return false;
    if (state.selected && state.selected.exec_set_id) return false;
    var persisted = readDetailPersistedState();
    if (!persisted || typeof persisted !== 'object') return false;
    var userId = getCurrentUserId();
    var loginSeq = getCurrentLoginSeq();
    var okByUser = userId && String(persisted.user_id || '') === String(userId);
    var okByLogin = loginSeq && String(persisted.login_seq || '') === String(loginSeq);
    if (!okByUser && !okByLogin) return false;
    var sid = Number(persisted.exec_set_id);
    if (!Number.isFinite(sid) || sid <= 0) return false;
    var pageIndex = Number(persisted.cases_page_index);
    if (!Number.isFinite(pageIndex) || pageIndex < 0) pageIndex = 0;
    state.restoringDetail = { execSetId: sid, casesPageIndex: pageIndex };
    setStatus(dom.status, '恢复上次查看的归档详情...', '');
    api
      .getExecArchive(sid)
      .then(function(detail) {
        showDetail(detail);
        setStatus(dom.status, '', '');
      })
      .catch(function(err) {
        state.restoringDetail = null;
        clearDetailPersistedState();
        setStatus(dom.status, err && err.message ? err.message : '恢复归档详情失败', 'err');
      });
    return true;
  }

  function handleTabActivated(tabName) {
    if (tabName !== 'case-archive') return;
    if (!isAuthReady()) {
      setStatus(dom.status, '登录信息加载中...', '');
      return;
    }
    state.currentUser = getCurrentUser();
    setStatus(dom.status, '', '');
    restoreDetailFromPersistedState();
  }

  function handlePageSizeChanged() {
    if (Array.isArray(state.rows) && state.rows.length) {
      renderList();
    }
    if (state.selected) {
      renderCases(state.selected);
    }
  }

  function bindTabActivation() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-tab-activated', function(e) {
      var tabName = e && e.detail ? e.detail.tab : '';
      handleTabActivated(tabName);
    });
    window.addEventListener('app-page-size-changed', function() {
      handlePageSizeChanged();
    });
  }

  function bindTabButtonFallbacks() {
    // CustomEvent 可用时依赖 app-tab-activated，避免重复触发。
    if (typeof CustomEvent === 'function') return;
    var tabBtn = document.querySelector('[data-tab-btn="case-archive"]');
    if (!tabBtn) return;
    tabBtn.addEventListener('click', function() {
      setTimeout(function() {
        handleTabActivated('case-archive');
      }, 0);
    });
  }

  function bindAuthReady() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-auth-ready', function() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = globalState && globalState.activeTab ? globalState.activeTab : '';
      if (tabName) handleTabActivated(tabName);
    });
  }

  function init() {
    if (!dom.root) return;
    ensureDrawer();
    bindEvents();
    bindTabActivation();
    bindTabButtonFallbacks();
    bindAuthReady();
    var visible = document.querySelector('section[data-tab-section="case-archive"]:not(.hidden)');
    if (visible) handleTabActivated('case-archive');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
