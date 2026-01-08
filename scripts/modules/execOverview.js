(function() {
  var api = window.app && window.app.apiClient;
  if (!api) return;

    var execOverviewProjectStorageKey = 'exec_overview_last_project_id_v1';
    var execOverviewVersionStorageKey = 'exec_overview_last_version_id_v1';

		  var dom = {
		    root: document.getElementById('execOverview'),
		    status: document.getElementById('execOverviewStatus'),
		    refreshBtn: document.getElementById('execOverviewRefreshBtn'),
		    navProjects: document.getElementById('execOverviewNavProjects'),
	    projectList: document.getElementById('execOverviewProjects'),
	    detail: document.getElementById('execOverviewDetail'),
	    projectTitle: document.getElementById('execOverviewProjectTitle'),
	    versionSelect: document.getElementById('execOverviewVersionSelect'),
      versionSummary: document.getElementById('execOverviewVersionSummary'),
      versionSummaryBody: document.getElementById('execOverviewVersionSummaryBody'),
      versionSummaryEmpty: document.getElementById('execOverviewVersionSummaryEmpty'),
	    userCards: document.getElementById('execOverviewUserCards'),
	    emptyProjects: document.getElementById('execOverviewEmptyProjects'),
	    emptyUsers: document.getElementById('execOverviewEmptyUsers'),
      execSetDrawer: document.getElementById('execOverviewExecSetDrawer'),
      execSetTitle: document.getElementById('execOverviewExecSetTitle'),
      execSetStatus: document.getElementById('execOverviewExecSetStatus'),
      execSetClose: document.getElementById('execOverviewExecSetClose'),
      execSetSearchInput: document.getElementById('execOverviewExecSetSearchInput'),
      execSetSearchClearBtn: document.getElementById('execOverviewExecSetSearchClearBtn'),
      execSetPaginationTop: document.getElementById('execOverviewExecSetPaginationTop'),
      execSetPaginationBottom: document.getElementById('execOverviewExecSetPaginationBottom'),
      execSetTableBody: document.getElementById('execOverviewExecSetTableBody'),
      execSetEmpty: document.getElementById('execOverviewExecSetEmpty'),
	  };

  var state = {
    projects: [],
    versions: [],
    currentProject: null,
    currentVersionId: null,
    overviewRows: [],
    overviewLayoutUsers: [],
    versionSummaryRows: [],
    execSetDrawer: {
      execSetId: null,
      execSetName: '',
      rows: [],
      searchText: '',
      pageIndex: 0,
    },
  };

  function setStatus(text, type) {
    if (!dom.status) return;
    dom.status.textContent = text || '';
    dom.status.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function setDrawerStatus(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = ['status', type || ''].filter(Boolean).join(' ');
  }

  function isAuthReady() {
    if (window.app && window.app.authReady === true) return true;
    var globalState = window.app && window.app.state ? window.app.state : null;
    return Boolean(globalState && globalState.currentUser);
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeTimeInput(input) {
    if (!input) return '';
    if (typeof input === 'number') return input;
    var raw = String(input || '').trim();
    if (!raw) return '';
    // 兼容 SQLite/Pydantic 输出：若时间不含时区信息，默认按 UTC 解释（避免展示少 8 小时）。
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

  function parseTimeToDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    var normalized = normalizeTimeInput(value);
    try {
      var d = typeof normalized === 'number' ? new Date(normalized) : new Date(normalized || value);
      if (!d || isNaN(d.getTime())) return null;
      return d;
    } catch (e) {
      return null;
    }
  }

  function parseTimeMs(value) {
    var d = parseTimeToDate(value);
    return d ? d.getTime() : 0;
  }

  function formatTime(value) {
    if (!value) return '--';
    var d = parseTimeToDate(value);
    if (!d) return String(value || '--');
    try {
      return d.toLocaleString();
    } catch (e) {
      return String(value || '--');
    }
  }

  function formatName(row) {
    if (!row) return '未知人员';
    if (row.username) return row.username;
    if (row.user_id || row.user_id === 0) return '用户#' + row.user_id;
    return '未分配';
  }

  function normalizeVersionId(value) {
    if (value === null || value === undefined) return null;
    if (value === '') return null;
    var n = Number(value);
    return isNaN(n) ? null : n;
  }

  function normalizeVersionKey(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value);
  }

  function resolveVersionNameById(versionId) {
    if (versionId === null || versionId === undefined || versionId === '') return '未分配版本';
    var versions = Array.isArray(state.versions) ? state.versions : [];
    var found = null;
    versions.some(function(v) {
      if (!v) return false;
      if (String(v.id) === String(versionId)) {
        found = v;
        return true;
      }
      return false;
    });
    if (found && found.name) return found.name;
    return '版本#' + String(versionId);
  }

  function buildVersionOrderList() {
    var versions = Array.isArray(state.versions) ? state.versions : [];
    return versions
      .filter(function(v) { return v && (v.id || v.id === 0); })
      .map(function(v) { return String(v.id); });
  }

  function sortVersionSummaryRows(rows) {
    var order = buildVersionOrderList();
    return rows.slice().sort(function(a, b) {
      var ak = normalizeVersionKey(a && a.version_id);
      var bk = normalizeVersionKey(b && b.version_id);
      if (ak === '' && bk !== '') return 1;
      if (bk === '' && ak !== '') return -1;
      var ia = order.indexOf(String(ak));
      var ib = order.indexOf(String(bk));
      if (ia === -1 && ib === -1) {
        return resolveVersionNameById(ak).localeCompare(resolveVersionNameById(bk), 'zh-Hans-CN');
      }
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function buildFileProgressBar(total, pending, passed, failed, blocked, na) {
    var t = Number(total) || 0;
    if (t <= 0) {
      return (
        '<div class="exec-overview-file-progress" title="执行进度 0%（0/0）">' +
          '<div class="temp-overview-bar">' +
            '<div class="temp-overview-segment status-pending" style="flex:1;"><span>0</span></div>' +
          '</div>' +
          '<div class="label">0%</div>' +
        '</div>'
      );
    }
    var safe = function(n) { return Math.max(0, Number(n) || 0); };
    var pPending = safe(pending);
    var pPassed = safe(passed);
    var pFailed = safe(failed);
    var pBlocked = safe(blocked);
    var pNa = safe(na);
    var done = pPassed + pNa;
    var pct = Math.round((done / t) * 100);

    var segs = [
      { className: 'status-passed', count: pPassed },
      { className: 'status-failed', count: pFailed },
      { className: 'status-blocked', count: pBlocked },
      { className: 'status-unspecified', count: pNa },
      { className: 'status-pending', count: pPending },
    ].filter(function(seg) { return seg && seg.count > 0; });
    var segmentHtml = segs.length
      ? segs
        .map(function(seg) {
          return (
            '<div class="temp-overview-segment ' + seg.className + '" style="flex:' + seg.count + ';">' +
              '<span>' + String(seg.count) + '</span>' +
            '</div>'
          );
        })
        .join('')
      : '<div class="temp-overview-segment status-pending" style="flex:1;"><span>0</span></div>';
    return (
      '<div class="exec-overview-file-progress" title="执行进度 ' + pct + '%（' + done + '/' + t + '）">' +
        '<div class="temp-overview-bar">' + segmentHtml + '</div>' +
        '<div class="label">' + pct + '%</div>' +
      '</div>'
    );
  }

  function buildExecSetMeta(item) {
    var safe = function(n) { return Math.max(0, Number(n) || 0); };
    var total = safe(item && item.total);
    var pending = safe(item && item.pending);
    var passed = safe(item && item.passed);
    var failed = safe(item && item.failed);
    var blocked = safe(item && item.blocked);
    var na = safe(item && item.not_applicable);
    var executed = Math.max(0, total - pending);

    var statusText = '未执行';
    var statusCls = 'pending';
    if (total > 0 && (failed > 0 || blocked > 0)) {
      if (failed > 0 && blocked > 0) statusText = '失败/阻塞';
      else if (failed > 0) statusText = '失败';
      else statusText = '阻塞';
      statusCls = 'err';
    } else if (total > 0 && pending === 0) {
      statusText = '已完成';
      statusCls = 'ok';
    } else if (executed > 0) {
      statusText = '执行中';
      statusCls = 'running';
    }

    var parts = [];
    parts.push('已' + executed + '/' + total);
    parts.push('待' + pending);
    parts.push('过' + passed);
    parts.push('失' + failed);
    parts.push('阻' + blocked);
    if (na > 0) parts.push('不适用' + na);
    var counts = [
      '<span class="exec-overview-kv kv-done">已' + executed + '/' + total + '</span>',
      '<span class="exec-overview-kv kv-pending">待' + pending + '</span>',
      '<span class="exec-overview-kv kv-passed">过' + passed + '</span>',
      '<span class="exec-overview-kv kv-failed">失' + failed + '</span>',
      '<span class="exec-overview-kv kv-blocked">阻' + blocked + '</span>',
      (na > 0 ? '<span class="exec-overview-kv kv-na">不适用' + na + '</span>' : ''),
    ].filter(Boolean).join('');

    return (
      '<div class="exec-overview-file-meta">' +
        '<span class="exec-overview-file-status status-' + statusCls + '">' + escapeHtml(statusText) + '</span>' +
        '<span class="exec-overview-file-counts" title="' + escapeHtml(parts.join(' ')) + '">' + counts + '</span>' +
      '</div>'
    );
  }

  function loadLastProjectId() {
    if (typeof localStorage === 'undefined') return '';
    try {
      var raw = localStorage.getItem(execOverviewProjectStorageKey) || '';
      raw = String(raw || '').trim();
      return raw;
    } catch (e) {
      return '';
    }
  }

  function saveLastProjectId(projectId) {
    if (typeof localStorage === 'undefined') return;
    var pid = projectId === null || projectId === undefined ? '' : String(projectId);
    if (!pid) return;
    try {
      localStorage.setItem(execOverviewProjectStorageKey, pid);
    } catch (e) {}
  }

  function loadLastVersionSelection(projectId) {
    if (typeof localStorage === 'undefined') return { exists: false, value: '' };
    if (projectId === null || projectId === undefined || projectId === '') return { exists: false, value: '' };
    try {
      var raw = localStorage.getItem(execOverviewVersionStorageKey) || '';
      var saved = raw ? (JSON.parse(raw || '{}') || {}) : {};
      if (!saved || typeof saved !== 'object') return { exists: false, value: '' };
      var key = String(projectId);
      if (!Object.prototype.hasOwnProperty.call(saved, key)) return { exists: false, value: '' };
      return { exists: true, value: saved[key] };
    } catch (e) {
      return { exists: false, value: '' };
    }
  }

  function saveLastVersionSelection(projectId, versionId) {
    if (typeof localStorage === 'undefined') return;
    if (projectId === null || projectId === undefined || projectId === '') return;
    try {
      var raw = localStorage.getItem(execOverviewVersionStorageKey) || '';
      var saved = raw ? (JSON.parse(raw || '{}') || {}) : {};
      if (!saved || typeof saved !== 'object') saved = {};
      var key = String(projectId);
      saved[key] = versionId === null || versionId === undefined ? '' : String(versionId);
      localStorage.setItem(execOverviewVersionStorageKey, JSON.stringify(saved));
    } catch (e) {}
  }

  function applyPersistedVersion(projectId) {
    var persisted = loadLastVersionSelection(projectId);
    if (!persisted.exists) return;
    var normalized = normalizeVersionId(persisted.value);
    if (normalized !== null) {
      var ok = (Array.isArray(state.versions) ? state.versions : []).some(function(v) {
        return v && String(v.id) === String(normalized);
      });
      if (!ok) normalized = null;
    }
    state.currentVersionId = normalized;
    renderVersionSelect();
    saveLastVersionSelection(projectId, normalized);
  }

  function showProjectList() {
    state.currentProject = null;
    state.currentVersionId = null;
    state.versions = [];
    state.overviewRows = [];
    state.overviewLayoutUsers = [];
    state.versionSummaryRows = [];
    renderVersionSummary();
    if (dom.detail) dom.detail.classList.add('hidden');
    if (dom.projectList) dom.projectList.classList.add('hidden');
    if (dom.projectTitle) dom.projectTitle.textContent = '';
    hideExecSetDrawer();
  }

  function showProjectDetail(project) {
    state.currentProject = project || null;
    if (dom.projectList) dom.projectList.classList.add('hidden');
    if (dom.detail) dom.detail.classList.remove('hidden');
    if (dom.projectTitle) dom.projectTitle.textContent = project && project.name ? project.name : '项目';
    hideExecSetDrawer();
  }

  var execSetDrawerInstance = null;

  function clampPageSize(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 20;
    if (n < 5) return 5;
    if (n > 200) return 200;
    return Math.floor(n);
  }

  function getPageSize() {
    var globalState = window.app && window.app.state ? window.app.state : {};
    var fromSettings = globalState && globalState.settings ? globalState.settings.tempExecPageSize : null;
    if (fromSettings !== null && fromSettings !== undefined) return clampPageSize(fromSettings);
    return clampPageSize(globalState && globalState.tempExecPageSize ? globalState.tempExecPageSize : 20);
  }

  function setExecSetPagination(html) {
    if (dom.execSetPaginationTop) dom.execSetPaginationTop.innerHTML = html || '';
    if (dom.execSetPaginationBottom) dom.execSetPaginationBottom.innerHTML = html || '';
  }

  function buildExecSetPagination(total, pageIndex, totalPages, start, end, rawTotal) {
    total = Number(total) || 0;
    rawTotal = Number(rawTotal) || 0;
    pageIndex = Number(pageIndex) || 0;
    totalPages = Number(totalPages) || 1;
    start = Number(start) || 0;
    end = Number(end) || 0;
    var currentPage = totalPages ? pageIndex + 1 : 1;
    var maxPage = totalPages || 1;
    var rangeInfo = total ? ('显示 ' + (start + 1) + '-' + end + ' / 共 ' + total + ' 条') : '暂无记录';
    if (rawTotal && total && total !== rawTotal) {
      rangeInfo += '（筛选后）';
    } else if (rawTotal && !total && rawTotal) {
      rangeInfo += '（筛选后）';
    }
    return (
      '<div class=\"temp-pagination\" data-exec-overview-pagination>' +
        '<div class=\"temp-pagination-info\">' + escapeHtml(rangeInfo) + '，每页 ' + getPageSize() + ' 条</div>' +
        '<div class=\"temp-pagination-controls\">' +
          '<button type=\"button\" class=\"secondary\" data-exec-overview-page=\"first\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>首页</button>' +
          '<button type=\"button\" class=\"secondary\" data-exec-overview-page=\"prev\" ' + (pageIndex <= 0 ? 'disabled' : '') + '>上一页</button>' +
          '<button type=\"button\" class=\"secondary\" data-exec-overview-page=\"next\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>下一页</button>' +
          '<button type=\"button\" class=\"secondary\" data-exec-overview-page=\"last\" ' + (pageIndex >= totalPages - 1 ? 'disabled' : '') + '>末页</button>' +
          '<label>跳转</label>' +
          '<input type=\"number\" min=\"1\" max=\"' + maxPage + '\" value=\"' + Math.min(currentPage, maxPage) + '\" data-exec-overview-page-input>' +
        '</div>' +
      '</div>'
    );
  }

  function normalizeExecSetSearchText(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return text.trim().toLowerCase();
  }

  function matchesExecSetCase(item, term) {
    if (!term) return true;
    if (!item) return false;
    function has(field) {
      var raw = item[field];
      if (raw === null || raw === undefined) return false;
      return String(raw).toLowerCase().indexOf(term) !== -1;
    }
    return Boolean(
      has('module') ||
      has('title') ||
      has('actual_result') ||
      has('expected') ||
      has('remark')
    );
  }

  function hideExecSetDrawer() {
    if (execSetDrawerInstance && typeof execSetDrawerInstance.close === 'function') {
      execSetDrawerInstance.close();
    }
    if (dom.execSetTableBody) dom.execSetTableBody.innerHTML = '';
    if (dom.execSetEmpty) dom.execSetEmpty.classList.add('hidden');
    if (dom.execSetTitle) dom.execSetTitle.textContent = '执行列表';
    setDrawerStatus(dom.execSetStatus, '', '');
    setExecSetPagination('');
    state.execSetDrawer.execSetId = null;
    state.execSetDrawer.execSetName = '';
    state.execSetDrawer.rows = [];
    state.execSetDrawer.searchText = '';
    state.execSetDrawer.pageIndex = 0;
    if (dom.execSetSearchInput) dom.execSetSearchInput.value = '';
    if (dom.execSetSearchClearBtn) dom.execSetSearchClearBtn.disabled = true;
  }

  function syncExecSetSearchControls() {
    if (!dom.execSetSearchClearBtn) return;
    var term = state.execSetDrawer && state.execSetDrawer.searchText ? String(state.execSetDrawer.searchText) : '';
    dom.execSetSearchClearBtn.disabled = !term.trim();
  }

  function renderExecSetDrawer() {
    var rawList = Array.isArray(state.execSetDrawer.rows) ? state.execSetDrawer.rows : [];
    var term = normalizeExecSetSearchText(state.execSetDrawer.searchText);
    var filtered = term
      ? rawList.filter(function(item) { return matchesExecSetCase(item, term); })
      : rawList;
    var pageSize = getPageSize();
    var total = filtered.length;
    var totalPages = total ? Math.ceil(total / pageSize) : 1;
    if (state.execSetDrawer.pageIndex >= totalPages) state.execSetDrawer.pageIndex = Math.max(totalPages - 1, 0);
    if (state.execSetDrawer.pageIndex < 0) state.execSetDrawer.pageIndex = 0;
    var start = state.execSetDrawer.pageIndex * pageSize;
    var end = Math.min(total, start + pageSize);
    var pageRows = total ? filtered.slice(start, end) : [];

    renderExecSetCases(pageRows);

    if (dom.execSetEmpty) {
      if (term && !total && rawList.length) {
        dom.execSetEmpty.textContent = '未找到匹配用例';
      } else {
        dom.execSetEmpty.textContent = '暂无用例';
      }
    }

    if (!rawList.length && !term) {
      setExecSetPagination('');
      return;
    }
    setExecSetPagination(buildExecSetPagination(total, state.execSetDrawer.pageIndex, totalPages, start, end, rawList.length));
  }

	  function renderProjects() {
	    var list = Array.isArray(state.projects) ? state.projects : [];
	    if (!list.length) {
	      if (dom.projectList) dom.projectList.innerHTML = '';
	      if (dom.navProjects) dom.navProjects.innerHTML = '';
	      if (dom.emptyProjects) dom.emptyProjects.classList.remove('hidden');
	      return;
	    }
	    if (dom.emptyProjects) dom.emptyProjects.classList.add('hidden');
	    if (dom.navProjects) {
        var currentId = state.currentProject && state.currentProject.id ? String(state.currentProject.id) : '';
	      dom.navProjects.innerHTML = list
	        .map(function(p) {
	          var name = p && p.name ? p.name : '未命名项目';
	          var desc = p && p.description ? p.description : '';
            var isActive = currentId && String(p && p.id) === currentId;
            var cls = 'nav-entry-card nav-entry-overview' + (isActive ? ' active' : '');
	          return (
	            '<button type="button" class="' + cls + '" data-project-id="' +
	            escapeHtml(p.id) +
	            '">' +
	            '<span class="nav-entry-icon" aria-hidden="true">' +
	            '<svg viewBox="0 0 24 24" role="presentation" focusable="false">' +
	            '<path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path>' +
	            '</svg>' +
	            '</span>' +
	            '<span class="nav-entry-text">' +
	            '<span class="nav-entry-title">' +
	            escapeHtml(name) +
	            '</span>' +
	            '<span class="nav-entry-desc">' +
	            escapeHtml(desc || '进入项目执行总览') +
	            '</span>' +
	            '</span>' +
	            '</button>'
	          );
	        })
	        .join('');
	    }
	    if (dom.projectList) dom.projectList.innerHTML = '';
	  }

  function renderVersionSelect() {
    if (!dom.versionSelect) return;
    var versions = Array.isArray(state.versions) ? state.versions : [];
    var options = ['<option value=\"\">全部版本</option>'];
    versions.forEach(function(v) {
      if (!v) return;
      options.push(
        '<option value=\"' + escapeHtml(v.id) + '\">' + escapeHtml(v.name || ('版本#' + v.id)) + '</option>'
      );
    });
    dom.versionSelect.innerHTML = options.join('');
    dom.versionSelect.value = state.currentVersionId === null ? '' : String(state.currentVersionId);
  }

  function renderOverviewRows() {
    if (!dom.userCards) return;
    var layoutUsers = Array.isArray(state.overviewLayoutUsers) ? state.overviewLayoutUsers : [];
    var rows = Array.isArray(state.overviewRows) ? state.overviewRows : [];
    var hasLayout = layoutUsers.length > 0;
    var list = hasLayout ? layoutUsers : rows;
    if (!list.length) {
      var emptyText = dom.emptyUsers && dom.emptyUsers.textContent ? dom.emptyUsers.textContent : '暂无执行数据';
      dom.userCards.classList.remove('layout-mode');
      dom.userCards.innerHTML = '<div class="exec-overview-empty-state">' + escapeHtml(emptyText) + '</div>';
      if (dom.emptyUsers) dom.emptyUsers.classList.add('hidden');
      return;
    }
    if (dom.emptyUsers) dom.emptyUsers.classList.add('hidden');
    dom.userCards.classList.toggle('layout-mode', hasLayout);

    function computeExecSetState(item) {
      var total = Number(item && item.total) || 0;
      var pending = Number(item && item.pending) || 0;
      var failed = Number(item && item.failed) || 0;
      var blocked = Number(item && item.blocked) || 0;
      var executed = Math.max(0, total - pending);
      if (total > 0 && (failed > 0 || blocked > 0)) return 'err';
      if (total > 0 && pending === 0) return 'ok';
      if (executed > 0) return 'running';
      return 'pending';
    }


    function renderUserLayoutCard(userRow) {
      var total = userRow.total || 0;
      var pending = userRow.pending || 0;
      var passed = userRow.passed || 0;
      var failed = userRow.failed || 0;
      var blocked = userRow.blocked || 0;
      var na = userRow.not_applicable || 0;
      var name = userRow.username ? userRow.username : formatName(userRow);
      var userId = userRow.user_id === null || userRow.user_id === undefined ? '' : String(userRow.user_id);
      var execSets = Array.isArray(userRow.exec_sets) ? userRow.exec_sets.slice() : [];

      var pid = state.currentProject && state.currentProject.id ? String(state.currentProject.id) : '';
      var placement = userRow.ui_placement && typeof userRow.ui_placement === 'object' ? userRow.ui_placement : null;
      var verOrder = placement && placement.versionOrderByProject && pid && Array.isArray(placement.versionOrderByProject[pid])
        ? placement.versionOrderByProject[pid].map(function(v) { return v === null || v === undefined ? '' : String(v); })
        : [];
      var fileOrderByVer = placement && placement.fileOrderByProjectVersion && pid && placement.fileOrderByProjectVersion[pid]
        ? placement.fileOrderByProjectVersion[pid]
        : {};

      var byVer = {};
      execSets.forEach(function(es) {
        if (!es) return;
        var vid = es.version_id === null || es.version_id === undefined ? '' : String(es.version_id);
        if (!byVer[vid]) byVer[vid] = [];
        byVer[vid].push(es);
      });

      var verIds = Object.keys(byVer);
      verIds.sort(function(a, b) {
        if (String(a) === '' && String(b) !== '') return 1;
        if (String(b) === '' && String(a) !== '') return -1;
        var ia = verOrder.indexOf(String(a));
        var ib = verOrder.indexOf(String(b));
        if (ia === -1 && ib === -1) {
          return resolveVersionNameById(a).localeCompare(resolveVersionNameById(b), 'zh-Hans-CN');
        }
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      var versionsHtml = verIds
        .map(function(vid) {
          var list = byVer[vid] || [];
          var order = fileOrderByVer && fileOrderByVer[vid] && Array.isArray(fileOrderByVer[vid])
            ? fileOrderByVer[vid].map(function(x) { return x === null || x === undefined ? '' : String(x); })
            : [];
	          list.sort(function(a, b) {
	            var ia = order.indexOf(String(a.exec_set_id));
	            var ib = order.indexOf(String(b.exec_set_id));
	            if (ia !== -1 || ib !== -1) {
	              if (ia === -1) return 1;
	              if (ib === -1) return -1;
	              if (ia !== ib) return ia - ib;
	            }
	            var ta = a && a.updated_at ? parseTimeMs(a.updated_at) : 0;
	            var tb = b && b.updated_at ? parseTimeMs(b.updated_at) : 0;
	            return tb - ta;
	          });

          var chips = list
            .map(function(es) {
              var stateCls = computeExecSetState(es);
              var isArchived = es && String(es.status || '') === 'archived';
              var archiveTag = isArchived ? '<span class="tag tag-archived">归</span>' : '';
              var label = es && es.exec_set_name ? String(es.exec_set_name) : ('执行集#' + String(es.exec_set_id));
              var execSetId = es && (es.exec_set_id || es.exec_set_id === 0) ? String(es.exec_set_id) : '';
              return (
                '<button type="button" class="exec-overview-file-chip state-' + stateCls + '" data-exec-set-id="' + escapeHtml(execSetId) + '" data-exec-set-name="' + escapeHtml(label) + '">' +
                  '<div class="row">' +
                    archiveTag +
                    '<span class="text" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>' +
                    '<span class="badge">' + (es.total || 0) + '</span>' +
                  '</div>' +
                  buildFileProgressBar(es.total || 0, es.pending || 0, es.passed || 0, es.failed || 0, es.blocked || 0, es.not_applicable || 0) +
                  buildExecSetMeta(es) +
                '</button>'
              );
            })
            .join('');

          return (
            '<div class="exec-overview-version-box">' +
              '<div class="head">' +
                '<span class="title" title="' + escapeHtml(resolveVersionNameById(vid)) + '">' + escapeHtml(resolveVersionNameById(vid)) + '</span>' +
              '</div>' +
              '<div class="body">' + (chips || '<span class="hint">暂无用例</span>') + '</div>' +
            '</div>'
          );
        })
        .join('');

      return (
        '<div class="exec-overview-user-card">' +
          '<div class="head">' +
            '<div class="name">' + escapeHtml(name) + '</div>' +
          '</div>' +
          '<div class="meta">' +
            '<span>总数 ' + total + '</span>' +
            '<span>待执行 ' + pending + '</span>' +
            '<span>通过 ' + passed + '</span>' +
            '<span>失败 ' + failed + '</span>' +
            '<span>阻塞 ' + blocked + '</span>' +
            '<span>不适用 ' + na + '</span>' +
          '</div>' +
          '<div class="exec-overview-layout">' + versionsHtml + '</div>' +
        '</div>'
      );
    }

	    if (hasLayout) {
	      list = list.slice().sort(function(a, b) {
	        var ta = a && a.user_created_at ? parseTimeMs(a.user_created_at) : 0;
	        var tb = b && b.user_created_at ? parseTimeMs(b.user_created_at) : 0;
	        if (ta !== tb) return ta - tb;
	        return String(a && a.username ? a.username : '').localeCompare(String(b && b.username ? b.username : ''), 'zh-Hans-CN');
	      });
	      dom.userCards.innerHTML = list.map(renderUserLayoutCard).join('');
	      return;
    }

    // 兼容旧接口：按总量降序，便于快速找到工作量最大的人员。
    rows = rows.slice().sort(function(a, b) {
      var ta = a && a.total ? a.total : 0;
      var tb = b && b.total ? b.total : 0;
      return tb - ta;
    });
    dom.userCards.innerHTML = rows.map(function(r) {
      var total = r.total || 0;
      var pending = r.pending || 0;
      var passed = r.passed || 0;
      var failed = r.failed || 0;
      var blocked = r.blocked || 0;
      var na = r.not_applicable || 0;
      var name = formatName(r);
      var userId = r.user_id === null || r.user_id === undefined ? '' : String(r.user_id);
      return (
        '<div class="exec-overview-user-card">' +
          '<div class="head">' +
            '<div class="name">' + escapeHtml(name) + '</div>' +
          '</div>' +
          '<div class="meta">' +
            '<span>总数 ' + total + '</span>' +
            '<span>待执行 ' + pending + '</span>' +
            '<span>通过 ' + passed + '</span>' +
            '<span>失败 ' + failed + '</span>' +
            '<span>阻塞 ' + blocked + '</span>' +
            '<span>不适用 ' + na + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function aggregateSummaryFromLayout(layoutUsers) {
    var map = {};
    var list = Array.isArray(layoutUsers) ? layoutUsers : [];
    list.forEach(function(userRow) {
      var sets = Array.isArray(userRow && userRow.exec_sets) ? userRow.exec_sets : [];
      sets.forEach(function(es) {
        if (!es) return;
        var key = normalizeVersionKey(es.version_id);
        if (!map[key]) {
          map[key] = {
            version_id: key,
            total: 0,
            pending: 0,
            passed: 0,
            failed: 0,
            blocked: 0,
            not_applicable: 0,
          };
        }
        map[key].total += Number(es.total) || 0;
        map[key].pending += Number(es.pending) || 0;
        map[key].passed += Number(es.passed) || 0;
        map[key].failed += Number(es.failed) || 0;
        map[key].blocked += Number(es.blocked) || 0;
        map[key].not_applicable += Number(es.not_applicable) || 0;
      });
    });
    return Object.keys(map).map(function(key) { return map[key]; });
  }

  function aggregateSummaryFromRows(rows) {
    var map = {};
    var list = Array.isArray(rows) ? rows : [];
    list.forEach(function(row) {
      if (!row) return;
      var key = normalizeVersionKey(row.version_id);
      if (!map[key]) {
        map[key] = {
          version_id: key,
          total: 0,
          pending: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          not_applicable: 0,
        };
      }
      map[key].total += Number(row.total) || 0;
      map[key].pending += Number(row.pending) || 0;
      map[key].passed += Number(row.passed) || 0;
      map[key].failed += Number(row.failed) || 0;
      map[key].blocked += Number(row.blocked) || 0;
      map[key].not_applicable += Number(row.not_applicable) || 0;
    });
    return Object.keys(map).map(function(key) { return map[key]; });
  }

  function renderVersionSummary() {
    if (!dom.versionSummaryBody) return;
    var list = Array.isArray(state.versionSummaryRows) ? state.versionSummaryRows : [];
    list = filterVersionSummaryRows(list);
    if (!list.length) {
      dom.versionSummaryBody.innerHTML = '';
      if (dom.versionSummaryEmpty) dom.versionSummaryEmpty.classList.remove('hidden');
      return;
    }
    if (dom.versionSummaryEmpty) dom.versionSummaryEmpty.classList.add('hidden');
    list = sortVersionSummaryRows(list);
    dom.versionSummaryBody.innerHTML = list.map(function(row) {
      var total = Number(row.total) || 0;
      var pending = Number(row.pending) || 0;
      var passed = Number(row.passed) || 0;
      var failed = Number(row.failed) || 0;
      var blocked = Number(row.blocked) || 0;
      var na = Number(row.not_applicable) || 0;
      var title = resolveVersionNameById(row.version_id);
      return (
        '<div class="exec-overview-version-summary-row">' +
          '<div class="exec-overview-version-summary-title" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</div>' +
          '<div class="exec-overview-version-summary-main">' +
            buildFileProgressBar(total, pending, passed, failed, blocked, na) +
            buildExecSetMeta({
              total: total,
              pending: pending,
              passed: passed,
              failed: failed,
              blocked: blocked,
              not_applicable: na,
            }) +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function filterVersionSummaryRows(rows) {
    var list = Array.isArray(rows) ? rows : [];
    var current = state.currentVersionId;
    if (current === null || current === undefined || current === '') return list;
    var key = normalizeVersionKey(current);
    return list.filter(function(row) {
      return normalizeVersionKey(row && row.version_id) === key;
    });
  }

  function loadVersionSummary(projectId) {
    if (!projectId) {
      state.versionSummaryRows = [];
      renderVersionSummary();
      return Promise.resolve([]);
    }
    if (!api.getExecutionOverview && !api.getExecutionOverviewLayout) return Promise.resolve([]);
    var hasLayout = typeof api.getExecutionOverviewLayout === 'function';
    var fetcher = hasLayout ? api.getExecutionOverviewLayout : api.getExecutionOverview;
    return fetcher
      .call(api, projectId, null)
      .then(function(rows) {
        state.versionSummaryRows = hasLayout ? aggregateSummaryFromLayout(rows) : aggregateSummaryFromRows(rows);
        renderVersionSummary();
        return rows;
      })
      .catch(function() {
        state.versionSummaryRows = [];
        renderVersionSummary();
        return [];
      });
  }

  function renderExecSetCases(rows) {
    if (!dom.execSetTableBody) return;
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      dom.execSetTableBody.innerHTML = '';
      if (dom.execSetEmpty) dom.execSetEmpty.classList.remove('hidden');
      return;
    }
    if (dom.execSetEmpty) dom.execSetEmpty.classList.add('hidden');
    dom.execSetTableBody.innerHTML = list.map(function(item) {
      var updatedText = formatTime(item && item.updated_at ? item.updated_at : '');
      var statusText = item && item.status !== null && item.status !== undefined ? String(item.status) : '';
      var actualText = item && item.actual_result !== null && item.actual_result !== undefined ? String(item.actual_result) : '';
      if (!actualText && statusText) actualText = statusText;
      return (
        '<tr>' +
          '<td>' + escapeHtml(item.module || '') + '</td>' +
          '<td>' + escapeHtml(item.title || '') + '</td>' +
          '<td>' + escapeHtml(actualText) + '</td>' +
          '<td>' + escapeHtml(updatedText) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function loadProjects() {
    setStatus('加载项目中...', '');
    return api
      .listProjects()
      .then(function(list) {
        var projects = Array.isArray(list) ? list : [];
        var utils = window.app && window.app.utils ? window.app.utils : {};
        var globalState = window.app && window.app.state ? window.app.state : {};
        if (utils && typeof utils.sortProjectsByUserSettings === 'function') {
          projects = utils.sortProjectsByUserSettings(projects, globalState);
        }
        state.projects = projects;
        renderProjects();
        setStatus('', '');
        return list;
      })
      .catch(function(err) {
        state.projects = [];
        renderProjects();
        setStatus(err && err.message ? err.message : '项目加载失败', 'err');
        return [];
      });
  }

  function loadVersions(projectId) {
    if (!api.listProjectVersions) return Promise.resolve([]);
    return api
      .listProjectVersions(projectId)
      .then(function(list) {
        state.versions = Array.isArray(list) ? list : [];
        renderVersionSelect();
        return list;
      })
      .catch(function() {
        state.versions = [];
        renderVersionSelect();
        return [];
      });
  }

  function loadOverview() {
    var project = state.currentProject;
    if (!project || !project.id) return Promise.resolve([]);
    if (!api.getExecutionOverview && !api.getExecutionOverviewLayout) return Promise.resolve([]);
    setStatus('加载执行总览中...', '');
    state.overviewRows = [];
    state.overviewLayoutUsers = [];
    var hasLayout = typeof api.getExecutionOverviewLayout === 'function';
    var fetcher = hasLayout ? api.getExecutionOverviewLayout : api.getExecutionOverview;
    return fetcher
      .call(api, project.id, state.currentVersionId)
      .then(function(rows) {
        if (hasLayout) {
          state.overviewLayoutUsers = Array.isArray(rows) ? rows : [];
          state.overviewRows = [];
        } else {
          state.overviewRows = Array.isArray(rows) ? rows : [];
          state.overviewLayoutUsers = [];
        }
        renderOverviewRows();
        setStatus('', '');
        return rows;
      })
      .catch(function(err) {
        state.overviewRows = [];
        state.overviewLayoutUsers = [];
        renderOverviewRows();
        setStatus(err && err.message ? err.message : '执行总览加载失败', 'err');
        return [];
      });
  }

  function loadExecSetCases(execSetId, execSetName) {
    if (!api.listExecCases) return;
    var sid = Number(execSetId);
    if (!Number.isFinite(sid) || sid <= 0) return;
    var name = execSetName ? String(execSetName) : '';
    if (dom.execSetTitle) dom.execSetTitle.textContent = name ? ('执行列表：' + name) : ('执行列表（执行集#' + sid + '）');
    setDrawerStatus(dom.execSetStatus, '加载中...', '');
    if (execSetDrawerInstance && typeof execSetDrawerInstance.open === 'function') execSetDrawerInstance.open();
    if (dom.execSetEmpty) dom.execSetEmpty.classList.add('hidden');
    state.execSetDrawer.execSetId = sid;
    state.execSetDrawer.execSetName = name;
    state.execSetDrawer.rows = [];
    state.execSetDrawer.searchText = '';
    state.execSetDrawer.pageIndex = 0;
    if (dom.execSetSearchInput) dom.execSetSearchInput.value = '';
    syncExecSetSearchControls();
    setExecSetPagination('');
    if (dom.execSetTableBody) {
      dom.execSetTableBody.innerHTML = '<tr><td colspan="5"><p class="hint">加载中...</p></td></tr>';
    }
    api
      .listExecCases(sid)
      .then(function(rows) {
        state.execSetDrawer.rows = Array.isArray(rows) ? rows : [];
        renderExecSetDrawer();
        setDrawerStatus(dom.execSetStatus, '', '');
      })
      .catch(function(err) {
        state.execSetDrawer.rows = [];
        renderExecSetDrawer();
        setDrawerStatus(dom.execSetStatus, err && err.message ? err.message : '执行列表加载失败', 'err');
      });
  }

  function openProjectById(projectId) {
    var list = Array.isArray(state.projects) ? state.projects : [];
    var project = null;
    list.some(function(p) {
      if (!p) return false;
      if (String(p.id) === String(projectId)) {
        project = p;
        return true;
      }
      return false;
    });
    if (!project) return;
    saveLastProjectId(project.id);
    showProjectDetail(project);
    renderProjects();
    state.currentVersionId = null;
    renderVersionSelect();
    loadVersions(project.id).then(function() {
      applyPersistedVersion(project.id);
      return Promise.all([loadOverview(), loadVersionSummary(project.id)]);
    });
  }

	  function bindEvents() {
      if (window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function') {
        if (dom.execSetDrawer) {
          execSetDrawerInstance = window.app.drawer.createDrawer({ drawerId: 'execOverviewExecSetDrawer', openButtons: [], closeButtons: ['execOverviewExecSetClose'] });
        }
      }

      if (dom.execSetSearchInput) {
        dom.execSetSearchInput.addEventListener('input', function() {
          state.execSetDrawer.searchText = String(dom.execSetSearchInput.value || '');
          state.execSetDrawer.pageIndex = 0;
          syncExecSetSearchControls();
          renderExecSetDrawer();
        });
      }
      if (dom.execSetSearchClearBtn) {
        dom.execSetSearchClearBtn.addEventListener('click', function() {
          state.execSetDrawer.searchText = '';
          state.execSetDrawer.pageIndex = 0;
          if (dom.execSetSearchInput) dom.execSetSearchInput.value = '';
          syncExecSetSearchControls();
          renderExecSetDrawer();
        });
      }
      if (dom.execSetDrawer) {
        dom.execSetDrawer.addEventListener('click', function(e) {
          var btn = e && e.target && e.target.closest ? e.target.closest('[data-exec-overview-page]') : null;
          if (!btn) return;
          var action = btn.getAttribute('data-exec-overview-page') || '';
          if (!action) return;
          var pageSize = getPageSize();
          var term = normalizeExecSetSearchText(state.execSetDrawer.searchText);
          var rawList = Array.isArray(state.execSetDrawer.rows) ? state.execSetDrawer.rows : [];
          var filtered = term ? rawList.filter(function(item) { return matchesExecSetCase(item, term); }) : rawList;
          var total = filtered.length;
          var totalPages = total ? Math.ceil(total / pageSize) : 1;
          if (action === 'prev') state.execSetDrawer.pageIndex -= 1;
          else if (action === 'next') state.execSetDrawer.pageIndex += 1;
          else if (action === 'first') state.execSetDrawer.pageIndex = 0;
          else if (action === 'last') state.execSetDrawer.pageIndex = totalPages - 1;
          if (state.execSetDrawer.pageIndex < 0) state.execSetDrawer.pageIndex = 0;
          if (state.execSetDrawer.pageIndex >= totalPages) state.execSetDrawer.pageIndex = Math.max(totalPages - 1, 0);
          renderExecSetDrawer();
        });
        dom.execSetDrawer.addEventListener('change', function(e) {
          var t = e && e.target ? e.target : null;
          if (!t || !t.hasAttribute) return;
          if (!t.hasAttribute('data-exec-overview-page-input')) return;
          var raw = t.value;
          var idx = Math.floor(Number(raw)) - 1;
          if (!isFinite(idx) || idx < 0) idx = 0;
          state.execSetDrawer.pageIndex = idx;
          renderExecSetDrawer();
        });
      }

	    if (dom.refreshBtn) {
	      dom.refreshBtn.addEventListener('click', function() {
	        var currentId = state.currentProject && state.currentProject.id ? state.currentProject.id : null;
	        setStatus('刷新中...', '');
	        loadProjects().then(function() {
	          if (!currentId && currentId !== 0) {
	            showProjectList();
	            setStatus('', '');
	            return;
	          }
	          var found = null;
	          var list = Array.isArray(state.projects) ? state.projects : [];
	          list.some(function(p) {
	            if (!p) return false;
	            if (String(p.id) === String(currentId)) {
	              found = p;
	              return true;
	            }
	            return false;
	          });
	          if (!found) {
	            showProjectList();
	            setStatus('', '');
	            return;
	          }
          showProjectDetail(found);
          state.currentVersionId = null;
          renderVersionSelect();
          loadVersions(found.id).then(function() {
            applyPersistedVersion(found.id);
            return Promise.all([loadOverview(), loadVersionSummary(found.id)]);
          }).finally(function() {
            setStatus('', '');
          });
        });
      });
    }
	    if (dom.navProjects) {
	      dom.navProjects.addEventListener('click', function(e) {
	        var btn = e && e.target && e.target.closest ? e.target.closest('[data-project-id]') : null;
	        if (!btn) return;
	        var pid = btn.getAttribute('data-project-id');
	        openProjectById(pid);
	      });
	    }
    if (dom.versionSelect) {
      dom.versionSelect.addEventListener('change', function() {
        state.currentVersionId = normalizeVersionId(dom.versionSelect.value);
        renderVersionSummary();
        loadOverview();
        var pid = state.currentProject && state.currentProject.id ? state.currentProject.id : null;
        if (pid || pid === 0) saveLastVersionSelection(pid, state.currentVersionId);
        if (pid || pid === 0) loadVersionSummary(pid);
      });
    }
    if (dom.userCards) {
      dom.userCards.addEventListener('click', function(e) {
        var chip = e && e.target && e.target.closest ? e.target.closest('.exec-overview-file-chip') : null;
        if (chip) {
          var sid = chip.getAttribute('data-exec-set-id');
          if (!sid) return;
          var sname = chip.getAttribute('data-exec-set-name') || '';
          loadExecSetCases(sid, sname);
        }
      });
    }
  }

  var pendingTab = '';
  var lastTabActivatedAt = 0;
  var lastTabActivatedName = '';

  function handleTabActivated(tabName) {
    if (tabName !== 'exec-overview') return;
    if (!isAuthReady()) {
      pendingTab = tabName || '';
      setStatus('登录信息加载中...', '');
      return;
    }
    var now = Date.now();
    if (tabName === lastTabActivatedName && (now - lastTabActivatedAt) < 300) return;
    lastTabActivatedName = tabName || '';
    lastTabActivatedAt = now;
    // 默认先展示项目卡片列表。
    showProjectList();
    loadProjects().then(function() {
      var savedProjectId = loadLastProjectId();
      if (!savedProjectId) return;
      openProjectById(savedProjectId);
    });
  }

  function handlePageSizeChanged() {
    if (dom.execSetDrawer && dom.execSetDrawer.classList && dom.execSetDrawer.classList.contains('open')) {
      renderExecSetDrawer();
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
    var tabBtn = document.querySelector('[data-tab-btn="exec-overview"]');
    if (!tabBtn) return;
    tabBtn.addEventListener('click', function() {
      setTimeout(function() {
        handleTabActivated('exec-overview');
      }, 0);
    });
  }

  function bindAuthReady() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-auth-ready', function() {
      var globalState = window.app && window.app.state ? window.app.state : {};
      var tabName = pendingTab || (globalState && globalState.activeTab ? globalState.activeTab : '');
      pendingTab = '';
      if (tabName) handleTabActivated(tabName);
    });
  }

  function init() {
    if (!dom.root) return;
    bindTabActivation();
    bindTabButtonFallbacks();
    bindAuthReady();
    bindEvents();
    // 若刷新后已停留在执行总览页，补一次加载。
    var visible = document.querySelector('section[data-tab-section="exec-overview"]:not(.hidden)');
    if (visible) handleTabActivated('exec-overview');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
