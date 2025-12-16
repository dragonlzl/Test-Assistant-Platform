(function() {
  var api = window.app && window.app.apiClient;
  if (!api) return;

    var execOverviewProjectStorageKey = 'exec_overview_last_project_id_v1';

		  var dom = {
		    root: document.getElementById('execOverview'),
		    status: document.getElementById('execOverviewStatus'),
		    refreshBtn: document.getElementById('execOverviewRefreshBtn'),
		    navProjects: document.getElementById('execOverviewNavProjects'),
	    projectList: document.getElementById('execOverviewProjects'),
	    detail: document.getElementById('execOverviewDetail'),
	    projectTitle: document.getElementById('execOverviewProjectTitle'),
	    versionSelect: document.getElementById('execOverviewVersionSelect'),
	    userCards: document.getElementById('execOverviewUserCards'),
	    emptyProjects: document.getElementById('execOverviewEmptyProjects'),
	    emptyUsers: document.getElementById('execOverviewEmptyUsers'),
      execSetDrawer: document.getElementById('execOverviewExecSetDrawer'),
      execSetTitle: document.getElementById('execOverviewExecSetTitle'),
      execSetStatus: document.getElementById('execOverviewExecSetStatus'),
      execSetClose: document.getElementById('execOverviewExecSetClose'),
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

  function showProjectList() {
    state.currentProject = null;
    state.currentVersionId = null;
    state.versions = [];
    state.overviewRows = [];
    state.overviewLayoutUsers = [];
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

  function hideExecSetDrawer() {
    if (execSetDrawerInstance && typeof execSetDrawerInstance.close === 'function') {
      execSetDrawerInstance.close();
    }
    if (dom.execSetTableBody) dom.execSetTableBody.innerHTML = '';
    if (dom.execSetEmpty) dom.execSetEmpty.classList.add('hidden');
    if (dom.execSetTitle) dom.execSetTitle.textContent = '执行列表';
    setDrawerStatus(dom.execSetStatus, '', '');
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
      dom.userCards.innerHTML = '';
      if (dom.emptyUsers) dom.emptyUsers.classList.remove('hidden');
      return;
    }
    if (dom.emptyUsers) dom.emptyUsers.classList.add('hidden');
    dom.userCards.classList.toggle('layout-mode', hasLayout);

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
      return (
        '<tr>' +
          '<td>' + escapeHtml(item.module || '') + '</td>' +
          '<td>' + escapeHtml(item.title || '') + '</td>' +
          '<td>' + escapeHtml(item.status || '') + '</td>' +
          '<td>' + escapeHtml(item.actual_result || '') + '</td>' +
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
        state.projects = Array.isArray(list) ? list : [];
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
    if (dom.execSetTableBody) {
      dom.execSetTableBody.innerHTML = '<tr><td colspan="5"><p class="hint">加载中...</p></td></tr>';
    }
    api
      .listExecCases(sid)
      .then(function(rows) {
        renderExecSetCases(rows);
        setDrawerStatus(dom.execSetStatus, '', '');
      })
      .catch(function(err) {
        renderExecSetCases([]);
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
    loadVersions(project.id).then(loadOverview);
  }

	  function bindEvents() {
      if (window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function') {
        if (dom.execSetDrawer) {
          execSetDrawerInstance = window.app.drawer.createDrawer({ drawerId: 'execOverviewExecSetDrawer', openButtons: [], closeButtons: ['execOverviewExecSetClose'] });
        }
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
	          loadVersions(found.id).then(loadOverview).finally(function() {
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
        loadOverview();
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

  function handleTabActivated(tabName) {
    if (tabName !== 'exec-overview') return;
    if (!isAuthReady()) {
      pendingTab = tabName || '';
      setStatus('登录信息加载中...', '');
      return;
    }
    // 默认先展示项目卡片列表。
    showProjectList();
    loadProjects().then(function() {
      var savedProjectId = loadLastProjectId();
      if (!savedProjectId) return;
      openProjectById(savedProjectId);
    });
  }

  function bindTabActivation() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('app-tab-activated', function(e) {
      var tabName = e && e.detail ? e.detail.tab : '';
      handleTabActivated(tabName);
    });
  }

  function bindTabButtonFallbacks() {
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
