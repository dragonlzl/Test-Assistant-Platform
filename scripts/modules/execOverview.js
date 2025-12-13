(function() {
  var api = window.app && window.app.apiClient;
  if (!api) return;

	  var dom = {
	    root: document.getElementById('execOverview'),
	    status: document.getElementById('execOverviewStatus'),
	    refreshBtn: document.getElementById('execOverviewRefreshBtn'),
	    navProjects: document.getElementById('execOverviewNavProjects'),
	    projectList: document.getElementById('execOverviewProjects'),
	    detail: document.getElementById('execOverviewDetail'),
	    backBtn: document.getElementById('execOverviewBackBtn'),
	    projectTitle: document.getElementById('execOverviewProjectTitle'),
	    versionSelect: document.getElementById('execOverviewVersionSelect'),
	    userCards: document.getElementById('execOverviewUserCards'),
	    casesPanel: document.getElementById('execOverviewCasesPanel'),
	    casesTitle: document.getElementById('execOverviewCasesTitle'),
	    casesClose: document.getElementById('execOverviewCasesClose'),
	    casesTableBody: document.getElementById('execOverviewCasesTableBody'),
	    emptyProjects: document.getElementById('execOverviewEmptyProjects'),
	    emptyUsers: document.getElementById('execOverviewEmptyUsers'),
	    emptyCases: document.getElementById('execOverviewEmptyCases'),
	  };

  var state = {
    projects: [],
    versions: [],
    currentProject: null,
    currentVersionId: null,
    overviewRows: [],
  };

  function setStatus(text, type) {
    if (!dom.status) return;
    dom.status.textContent = text || '';
    dom.status.className = ['status', type || ''].filter(Boolean).join(' ');
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

	  function showProjectList() {
	    state.currentProject = null;
	    state.currentVersionId = null;
	    state.versions = [];
	    state.overviewRows = [];
	    if (dom.detail) dom.detail.classList.add('hidden');
	    if (dom.projectList) dom.projectList.classList.add('hidden');
	    if (dom.projectTitle) dom.projectTitle.textContent = '';
	    hideCasesPanel();
	  }

  function showProjectDetail(project) {
    state.currentProject = project || null;
    if (dom.projectList) dom.projectList.classList.add('hidden');
    if (dom.detail) dom.detail.classList.remove('hidden');
    if (dom.projectTitle) dom.projectTitle.textContent = project && project.name ? project.name : '项目';
    hideCasesPanel();
  }

  function hideCasesPanel() {
    if (dom.casesPanel) dom.casesPanel.classList.add('hidden');
    if (dom.casesTableBody) dom.casesTableBody.innerHTML = '';
    if (dom.emptyCases) dom.emptyCases.classList.add('hidden');
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
	      dom.navProjects.innerHTML = list
	        .map(function(p) {
	          var name = p && p.name ? p.name : '未命名项目';
	          var desc = p && p.description ? p.description : '';
	          return (
	            '<button type="button" class="nav-entry-card nav-entry-overview" data-project-id="' +
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
    var rows = Array.isArray(state.overviewRows) ? state.overviewRows : [];
    if (!rows.length) {
      dom.userCards.innerHTML = '';
      if (dom.emptyUsers) dom.emptyUsers.classList.remove('hidden');
      return;
    }
    if (dom.emptyUsers) dom.emptyUsers.classList.add('hidden');
    // 按总量降序，便于快速找到工作量最大的人员。
    rows = rows.slice().sort(function(a, b) {
      var ta = a && a.total ? a.total : 0;
      var tb = b && b.total ? b.total : 0;
      return tb - ta;
    });
    dom.userCards.innerHTML = rows
      .map(function(r) {
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
          '<div class="name">' +
          escapeHtml(name) +
          '</div>' +
          '<button type="button" class="secondary exec-overview-view-cases" data-user-id="' +
          escapeHtml(userId) +
          '">查看用例</button>' +
          '</div>' +
          '<div class="meta">' +
          '<span>总数 ' +
          total +
          '</span>' +
          '<span>待执行 ' +
          pending +
          '</span>' +
          '<span>通过 ' +
          passed +
          '</span>' +
          '<span>失败 ' +
          failed +
          '</span>' +
          '<span>阻塞 ' +
          blocked +
          '</span>' +
          '<span>不适用 ' +
          na +
          '</span>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderCases(rows) {
    if (!dom.casesTableBody) return;
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      dom.casesTableBody.innerHTML = '';
      if (dom.emptyCases) dom.emptyCases.classList.remove('hidden');
      return;
    }
    if (dom.emptyCases) dom.emptyCases.classList.add('hidden');
    dom.casesTableBody.innerHTML = list
      .map(function(item) {
        var updatedAt = item && item.updated_at ? item.updated_at : '';
        var updatedText = '';
        try {
          updatedText = updatedAt ? new Date(updatedAt).toLocaleString() : '--';
        } catch (e) {
          updatedText = updatedAt || '--';
        }
        return (
          '<tr>' +
          '<td>' +
          escapeHtml(item.exec_set_name || ('执行集#' + item.exec_set_id)) +
          '</td>' +
          '<td>' +
          escapeHtml(item.module || '') +
          '</td>' +
          '<td>' +
          escapeHtml(item.title || '') +
          '</td>' +
          '<td>' +
          escapeHtml(item.status || '') +
          '</td>' +
          '<td>' +
          escapeHtml(updatedText) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
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
    if (!api.getExecutionOverview) return Promise.resolve([]);
    setStatus('加载执行总览中...', '');
    return api
      .getExecutionOverview(project.id, state.currentVersionId)
      .then(function(rows) {
        state.overviewRows = Array.isArray(rows) ? rows : [];
        renderOverviewRows();
        setStatus('', '');
        return rows;
      })
      .catch(function(err) {
        state.overviewRows = [];
        renderOverviewRows();
        setStatus(err && err.message ? err.message : '执行总览加载失败', 'err');
        return [];
      });
  }

  function loadCasesForUser(userId) {
    var project = state.currentProject;
    if (!project || !project.id) return;
    if (!api.listExecutionOverviewCases) return;
    setStatus('加载用例明细中...', '');
    api
      .listExecutionOverviewCases({
        project_id: project.id,
        version_id: state.currentVersionId,
        user_id: userId,
        limit: 200,
        offset: 0,
      })
      .then(function(rows) {
        if (dom.casesTitle) {
          dom.casesTitle.textContent = '用例明细（最多 200 条）';
        }
        if (dom.casesPanel) dom.casesPanel.classList.remove('hidden');
        renderCases(rows);
        setStatus('', '');
      })
      .catch(function(err) {
        if (dom.casesPanel) dom.casesPanel.classList.remove('hidden');
        renderCases([]);
        setStatus(err && err.message ? err.message : '用例明细加载失败', 'err');
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
    showProjectDetail(project);
    state.currentVersionId = null;
    renderVersionSelect();
    loadVersions(project.id).then(loadOverview);
  }

	  function bindEvents() {
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
	    if (dom.backBtn) {
	      dom.backBtn.addEventListener('click', function() {
	        showProjectList();
	        if (dom.navProjects && typeof dom.navProjects.scrollIntoView === 'function') {
	          dom.navProjects.scrollIntoView({ behavior: 'auto', block: 'start' });
	        }
	      });
	    }
	    if (dom.versionSelect) {
	      dom.versionSelect.addEventListener('change', function() {
	        state.currentVersionId = normalizeVersionId(dom.versionSelect.value);
        hideCasesPanel();
        loadOverview();
      });
    }
    if (dom.userCards) {
      dom.userCards.addEventListener('click', function(e) {
        var btn = e && e.target && e.target.closest ? e.target.closest('.exec-overview-view-cases') : null;
        if (!btn) return;
        var uid = btn.getAttribute('data-user-id');
        var n = normalizeVersionId(uid);
        if (n === null) return;
        loadCasesForUser(n);
      });
    }
    if (dom.casesClose) {
      dom.casesClose.addEventListener('click', function() {
        hideCasesPanel();
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
    loadProjects();
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
