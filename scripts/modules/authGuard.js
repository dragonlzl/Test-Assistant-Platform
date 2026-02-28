(function() {
  var TOKEN_KEY = 'tap-auth-token';
  var LAST_USER_KEY = 'tap-last-user-id';
  var LOGIN_SEQ_KEY = 'tap-login-seq';
  var TAB_SEQ_KEY = 'tap-active-tab-login-seq';
  var state = window.app && window.app.state ? window.app.state : {};
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
  var logoutBtn = null;
  var userDisplay = null;
  var userRoleEl = null;
  var userMenu = null;
  var userMenuToggle = null;
  var sessionRetryTimer = 0;
  var sessionRetryCount = 0;
  var MAX_SESSION_RETRY = 2;

  function ensureStateInstance() {
    if (window.app && window.app.state) return window.app.state;
    var mgr = window.app && window.app.stateManager ? window.app.stateManager : null;
    if (mgr && typeof mgr.initState === 'function') {
      var cfg = window.app && window.app.config ? window.app.config : {};
      try {
        return mgr.initState({
          defaultSettings: cfg.defaultSettings,
          defaultPlacement: cfg.defaultPlacement,
          defaultTempExecPageSize: cfg.defaultTempExecPageSize,
        });
      } catch (err) {
        // ignore init failures
      }
    }
    return state;
  }

  function isE2ESkipAuth() {
    try {
      if (typeof window !== 'undefined' && window.__APP_ALLOW_ANON) return true;
      if (typeof localStorage !== 'undefined') {
        var flag = localStorage.getItem('tap-e2e-skip-auth');
        if (flag === '1' || flag === 'true') return true;
      }
    } catch (err) {
      // ignore
    }
    return false;
  }

  function normalizeLevel(level) {
    if (!level && level !== 0) return '';
    var lower = String(level).toLowerCase();
    if (lower === '组长') return 'leader';
    if (lower === '组员') return 'member';
    return lower;
  }

  function drawerIsOpen() {
    return window.app && typeof window.app.isDrawerOpen === 'function' && window.app.isDrawerOpen();
  }

  function getConfigValue(key, fallback) {
    try {
      var cfg = window.app && window.app.config ? window.app.config : {};
      if (cfg && Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] !== undefined) {
        return cfg[key];
      }
    } catch (err) {
      // ignore
    }
    return fallback;
  }

  function parseQuery(search) {
    var result = {};
    if (!search) return result;
    var raw = String(search || '').replace(/^\?/, '');
    if (!raw) return result;
    raw.split('&').forEach(function(pair) {
      if (!pair) return;
      var parts = pair.split('=');
      var key = decodeURIComponent(parts.shift() || '');
      if (!key) return;
      var value = parts.length ? decodeURIComponent(parts.join('=')) : '';
      result[key] = value;
    });
    return result;
  }

  function getTabFromUrl() {
    if (typeof window === 'undefined' || !window.location) return '';
    var params = parseQuery(window.location.search || '');
    return params && params.tab ? String(params.tab || '') : '';
  }

  function getLoginSeq() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(LOGIN_SEQ_KEY) || '';
      }
    } catch (err) {
      // ignore
    }
    return '';
  }

  // Clear user-scoped local caches when switching accounts to avoid leakage across users.
  function handleUserSwitch(user) {
    var currentId = (user && (user.id || user.id === 0)) ? String(user.id) : '';
    var storedId = '';
    try {
      storedId = typeof localStorage !== 'undefined' ? (localStorage.getItem(LAST_USER_KEY) || '') : '';
    } catch (err) {
      storedId = '';
    }
    if (storedId && currentId && storedId !== currentId) {
      var modelsKey = getConfigValue('modelsKey', 'cleaner-models-v1');
      var assignmentKey = getConfigValue('assignmentKey', 'cleaner-assignment-v1');
      var settingsKey = getConfigValue('settingsKey', 'usecase-settings-v1');
      var tempExecPageSizeKey = getConfigValue('tempExecPageSizeStorageKey', 'tempexec-page-size');
      var themeHintKey = 'tap-theme-hint';
      var opsLogViewKey = getConfigValue('opsLogViewStorageKey', 'tap-ops-log-view-v1');
      var opsActivityViewKey = getConfigValue('opsActivityViewStorageKey', 'tap-ops-activity-view-v1');
      var legacyCleanKey = getConfigValue('legacyCleanKey', 'cleaner-config-v1');
      var legacyCompareKey = getConfigValue('legacyCompareKey', 'cleaner-compare-config-v1');
      var workflowKey = getConfigValue('workflowStorageKey', 'usecase-workflow-state-v1');
      var keysToClear = [modelsKey, assignmentKey, settingsKey, tempExecPageSizeKey, themeHintKey, opsLogViewKey, opsActivityViewKey, legacyCleanKey, legacyCompareKey, workflowKey];
      try {
        if (typeof localStorage !== 'undefined') {
          keysToClear.forEach(function(key) {
            if (!key) return;
            localStorage.removeItem(key);
          });
        }
      } catch (err) {
        // ignore
      }

      // Reset in-memory state so empty remote data won't retain previous user's values.
      var liveState = (window.app && window.app.state) ? window.app.state : state;
      var stateManager = window.app && window.app.stateManager ? window.app.stateManager : null;
      var defaultSettings = getConfigValue('defaultSettings', null);
      var defaultPlacement = getConfigValue('defaultPlacement', null);
      var defaultTempExecPageSize = getConfigValue('defaultTempExecPageSize', null);
      var defaults = null;
      if (stateManager && typeof stateManager.createInitialState === 'function') {
        try {
          defaults = stateManager.createInitialState({
            defaultSettings: defaultSettings,
            defaultPlacement: defaultPlacement,
            defaultTempExecPageSize: defaultTempExecPageSize,
          });
        } catch (err) {
          defaults = null;
        }
      }
      if (defaults) {
        liveState.models = Array.isArray(defaults.models) ? defaults.models.slice() : [];
        liveState.assignments = defaults.assignments && typeof defaults.assignments === 'object'
          ? Object.assign({}, defaults.assignments)
          : (liveState.assignments || {});
        liveState.settings = defaults.settings && typeof defaults.settings === 'object'
          ? Object.assign({}, defaults.settings)
          : (liveState.settings || {});
        if (defaults.tempExecPageSize !== undefined) {
          liveState.tempExecPageSize = defaults.tempExecPageSize;
        }
      } else {
        liveState.models = [];
        liveState.assignments = {};
        liveState.settings = {};
        if (defaultTempExecPageSize) liveState.tempExecPageSize = Number(defaultTempExecPageSize) || 20;
      }
      liveState.userJustSwitched = true;
      liveState.userModelsReset = false;
      liveState.assignmentRemoteId = null;
      liveState.hasSavedAssignments = false;
      liveState.editingId = null;
    }

    try {
      if (typeof localStorage !== 'undefined' && currentId) {
        localStorage.setItem(LAST_USER_KEY, currentId);
      }
    } catch (err) {
      // ignore
    }
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function getSavedActiveTab() {
    var saved = '';
    try {
      var activeTabKey = getConfigValue('activeTabKey', 'usecase-active-tab');
      if (activeTabKey && typeof sessionStorage !== 'undefined') {
        saved = sessionStorage.getItem(activeTabKey) || '';
      }
    } catch (err) {
      saved = '';
    }
    if (!saved) return '';
    // 只在同一次登录会话内恢复页签：避免“登出/重新登录”仍回到旧页签。
    try {
      if (typeof sessionStorage !== 'undefined') {
        var tabSeq = sessionStorage.getItem(TAB_SEQ_KEY) || '';
        var loginSeq = getLoginSeq();
        // 若已有 loginSeq 但页签未标记 seq，补写一次，避免“第一次切页后刷新不生效需要第二次”的体验问题。
        if (loginSeq && !tabSeq) {
          sessionStorage.setItem(TAB_SEQ_KEY, loginSeq);
          tabSeq = loginSeq;
        }
        if (loginSeq && tabSeq && tabSeq !== loginSeq) {
          var activeTabKey2 = getConfigValue('activeTabKey', 'usecase-active-tab');
          if (activeTabKey2) sessionStorage.removeItem(activeTabKey2);
          sessionStorage.removeItem(TAB_SEQ_KEY);
          return '';
        }
      }
    } catch (err) {
      // ignore
    }
    // Only accept tabs that exist in the current DOM; role/visibility will be handled later.
    var btn = document.querySelector('[data-tab-btn="' + saved + '"]');
    if (!btn) return '';
    return saved;
  }

  function getPageDefaultTab() {
    var fallback = 'auto';
    try {
      var cfg = window.app && window.app.config ? window.app.config : {};
      var pageDefaults = cfg && cfg.pageDefaultTabMap ? cfg.pageDefaultTabMap : {};
      var pageKey = '';
      if (document && document.body && document.body.dataset && document.body.dataset.page) {
        pageKey = String(document.body.dataset.page || '');
      }
      if (!pageKey) pageKey = 'index';
      if (pageDefaults && pageDefaults[pageKey]) {
        fallback = String(pageDefaults[pageKey] || fallback);
      }
    } catch (err) {
      // ignore
    }
    return fallback;
  }

  function resolveValidTab(name) {
    if (typeof document === 'undefined') return name || 'auto';
    var target = name || '';
    if (target) {
      var exists = document.querySelector('[data-tab-section=\"' + target + '\"]');
      if (exists) return target;
    }
    var defaultTab = getPageDefaultTab();
    if (defaultTab) {
      var defaultExists = document.querySelector('[data-tab-section=\"' + defaultTab + '\"]');
      if (defaultExists) return defaultTab;
    }
    var first = document.querySelector('[data-tab-section]');
    if (first && first.dataset && first.dataset.tabSection) return first.dataset.tabSection;
    return target || defaultTab || 'auto';
  }

  function redirectToLogin(options) {
    // Re-login should start from default tab (session-level persistence only).
    try {
      var activeTabKey = getConfigValue('activeTabKey', 'usecase-active-tab');
      if (activeTabKey && typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(activeTabKey);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(TAB_SEQ_KEY);
      }
    } catch (err) {
      // ignore
    }
    var keepRedirect = !(options && options.keepRedirect === false);
    if (!keepRedirect) {
      window.location.replace('login.html');
      return;
    }
    var redirect = window.location.pathname + window.location.search + window.location.hash;
    var target = 'login.html?redirect=' + encodeURIComponent(redirect);
    window.location.replace(target);
  }

  function applyRoleVisibility(user) {
    var role = user && user.role ? user.role : 'user';
    var level = user && user.level ? user.level : '';
    var levelNorm = normalizeLevel(level);
    var allowProjectTab = role === 'admin' || levelNorm === 'leader' || levelNorm === 'member';
    var adminOnly = document.querySelectorAll('[data-role="admin-only"]');
    adminOnly.forEach(function(node) {
      var tabName = '';
      if (node.dataset) {
        tabName = node.dataset.tabBtn || node.dataset.tabSection || '';
      }
      var isProjectTab = tabName === 'project-admin';
      var shouldShowProject = isProjectTab && allowProjectTab;
      if (role !== 'admin' && !shouldShowProject) {
        node.classList.add('role-hidden');
        node.classList.add('hidden');
      } else {
        node.classList.remove('role-hidden');
        if (node.dataset && (node.dataset.tabBtn || node.dataset.tabSection)) {
          node.classList.remove('hidden');
        }
      }
    });
    if (allowProjectTab) {
      var projectTabBtn = document.querySelector('[data-tab-btn="project-admin"]');
      if (projectTabBtn && projectTabBtn.classList) {
        projectTabBtn.classList.remove('hidden');
        projectTabBtn.classList.remove('role-hidden');
      }
      var projectTabSection = document.querySelector('[data-tab-section="project-admin"]');
      if (projectTabSection && projectTabSection.classList) {
        projectTabSection.classList.remove('role-hidden');
      }
    }
    var currentTab = ensureStateInstance().activeTab || 'auto';
    var restrictedTabs = ['user-admin', 'ops-log'];
    if (!allowProjectTab) restrictedTabs.push('project-admin');
    if (role !== 'admin' && restrictedTabs.indexOf(currentTab) !== -1) {
      currentTab = 'auto';
    }
    var firstVisible = updateGroupVisibility();
    var currentBtn = document.querySelector('[data-tab-btn="' + currentTab + '"]');
    var currentVisible = currentBtn && !currentBtn.classList.contains('hidden') && !currentBtn.classList.contains('role-hidden');
    var currentGroup = currentBtn ? currentBtn.closest('.tab-group') : null;
    if (currentGroup && currentGroup.classList.contains('hidden')) {
      currentVisible = false;
    }
    if (!currentVisible) {
      var fallback = firstVisible || 'auto';
      switchToTab(fallback);
      return;
    }
    switchToTab(currentTab);
  }

  function updateGroupVisibility() {
    var groups = document.querySelectorAll('.tab-group');
    var firstVisibleTab = null;
    groups.forEach(function(group) {
      var submenu = group.querySelector('.tab-submenu');
      var btns = submenu ? submenu.querySelectorAll('[data-tab-btn]') : [];
      var hasVisible = false;
      Array.prototype.forEach.call(btns, function(btn) {
        var hidden = btn.classList.contains('hidden') || btn.classList.contains('role-hidden');
        if (!hidden) {
          hasVisible = true;
          if (!firstVisibleTab && btn.dataset && btn.dataset.tabBtn) {
            firstVisibleTab = btn.dataset.tabBtn;
          }
        }
      });
      var groupBtn = group.querySelector('.tab-group-btn');
      if (hasVisible) {
        group.classList.remove('hidden');
        if (groupBtn) groupBtn.classList.remove('hidden');
        if (submenu) submenu.classList.add('hidden');
      } else {
        group.classList.add('hidden');
        if (groupBtn) groupBtn.classList.add('hidden');
        if (submenu) submenu.classList.add('hidden');
      }
    });
    return firstVisibleTab;
  }

  function updateUserDisplay() {
    var user = ensureStateInstance().currentUser;
    var nameText = user && user.username ? user.username : '未登录';
    var roleRaw = user && user.role ? user.role : '';
    var roleText = roleRaw === 'admin' ? '管理员' : (roleRaw ? '用户' : '');
    var roleDisplay = roleText ? roleText : '';
    setText(userDisplay, nameText);
    if (userRoleEl) {
      setText(userRoleEl, roleDisplay);
    }
    if (logoutBtn) {
      logoutBtn.classList.toggle('hidden', !user);
    }
  }

  function closeMenu() {
    if (userMenu) userMenu.classList.remove('menu-open');
  }

  function toggleMenu() {
    if (!userMenu) return;
    if (drawerIsOpen()) {
      closeMenu();
      return;
    }
    userMenu.classList.toggle('menu-open');
  }

  function switchToTab(name) {
    name = resolveValidTab(name);
    if (window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab(name);
      return;
    }
    var tabButtons = document.querySelectorAll('[data-tab-btn]');
    var tabSections = document.querySelectorAll('[data-tab-section]');
    tabButtons.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset && btn.dataset.tabBtn === name);
    });
    tabSections.forEach(function(sec) {
      var match = sec.dataset && sec.dataset.tabSection === name;
      sec.classList.toggle('hidden', !match);
    });
    var liveState = ensureStateInstance();
    liveState.activeTab = name;
    try {
      // Match appRuntime behavior: session-level persistence only.
      var activeTabKey = getConfigValue('activeTabKey', 'usecase-active-tab');
      if (activeTabKey && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(activeTabKey, name);
        var loginSeq = getLoginSeq();
        if (loginSeq) sessionStorage.setItem(TAB_SEQ_KEY, loginSeq);
      }
    } catch (err) {
      // ignore
    }
    // 兼容 appRuntime 未就绪时的页签恢复：派发统一事件，供模块在激活时加载数据。
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('app-tab-activated', { detail: { tab: name } }));
      }
    } catch (err) {
      // ignore
    }
  }

  function clearSessionRetryTimer() {
    if (!sessionRetryTimer) return;
    clearTimeout(sessionRetryTimer);
    sessionRetryTimer = 0;
  }

  function resetSessionRetryState() {
    clearSessionRetryTimer();
    sessionRetryCount = 0;
  }

  function scheduleEnsureSessionRetry(reason) {
    if (sessionRetryTimer) return;
    if (sessionRetryCount >= MAX_SESSION_RETRY) return;
    sessionRetryCount += 1;
    var delayMs = 900 + (sessionRetryCount - 1) * 1200;
    sessionRetryTimer = setTimeout(function() {
      sessionRetryTimer = 0;
      if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
        console.warn('[authGuard] retry ensureSession', {
          retry: sessionRetryCount,
          reason: reason || '',
        });
      }
      ensureSession();
    }, delayMs);
  }

  function renderFallbackTabAfterAuthFailure(liveState, reason) {
    var safeState = liveState || ensureStateInstance();
    var fallbackTab = resolveValidTab((safeState && safeState.activeTab) || getPageDefaultTab() || 'auto');
    if (safeState) safeState.activeTab = fallbackTab;
    updateUserDisplay();
    applyRoleVisibility(safeState && safeState.currentUser ? safeState.currentUser : null);
    if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
      console.warn('[authGuard] auth check failed, fallback tab rendered', {
        tab: fallbackTab,
        reason: reason || '',
      });
    }
  }

  function ensureSession() {
    var liveState = ensureStateInstance();
    // Refresh should restore current tab within the same browser session.
    // Login / logout flows clear this key so re-login starts from default.
    var forceDefaultTab = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        forceDefaultTab = sessionStorage.getItem('tap-force-default-tab') === '1';
        if (forceDefaultTab) sessionStorage.removeItem('tap-force-default-tab');
      }
    } catch (err) {
      forceDefaultTab = false;
    }
    // 兼容某些浏览器/跳转链路 sessionStorage 不稳定：同时支持 localStorage 标记。
    // 注意：即便 sessionStorage 已读到 force 标记，也要清掉 localStorage，避免“首次刷新仍被强制回主页，需要第二次才正常”的问题。
    try {
      if (typeof localStorage !== 'undefined') {
        var localForce = localStorage.getItem('tap-force-default-tab') === '1';
        if (localForce) localStorage.removeItem('tap-force-default-tab');
        if (localForce) forceDefaultTab = true;
      }
    } catch (err) {
      // ignore
    }
    var urlTab = getTabFromUrl();
    if (forceDefaultTab && !urlTab) {
      // 显式登出后的下一次登录：无条件回到主页(auto)，避免任何残留页签影响。
      try {
        var activeTabKey = getConfigValue('activeTabKey', 'usecase-active-tab');
        if (activeTabKey && typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(activeTabKey);
        }
      } catch (err) {
        // ignore
      }
      liveState.activeTab = 'auto';
    } else {
      var savedTab = urlTab || getSavedActiveTab();
      // 无保存页签时统一回到主页(auto)，避免重登落到旧默认(clean)。
      liveState.activeTab = savedTab || 'auto';
    }
    if (isE2ESkipAuth()) {
      liveState.currentUser = liveState.currentUser || {
        id: 0,
        username: 'e2e',
        role: 'admin',
        level: 'leader',
      };
      handleUserSwitch(liveState.currentUser);
      liveState.authToken = liveState.authToken || 'e2e-token';
      liveState.authReady = true;
      window.app = window.app || {};
      window.app.authReady = true;
      resetSessionRetryState();
      try {
        window.dispatchEvent(new CustomEvent('app-auth-ready', { detail: { user: liveState.currentUser } }));
      } catch (err) {
        // ignore
      }
      updateUserDisplay();
      applyRoleVisibility(liveState.currentUser);
      var tab = resolveValidTab(liveState.activeTab || 'auto');
      liveState.activeTab = tab;
      switchToTab(tab);
      return;
    }
    if (!apiClient || typeof apiClient.getStoredToken !== 'function') {
      redirectToLogin();
      return;
    }
    var stored = apiClient.getStoredToken();
    if (!stored) {
      redirectToLogin();
      return;
    }
    apiClient.setToken(stored);
    // 兼容旧数据：如果已有 token 但还没有 loginSeq，补一个基准值用于“同会话刷新恢复页签”。
    try {
      if (typeof localStorage !== 'undefined') {
        var seq = localStorage.getItem(LOGIN_SEQ_KEY) || '';
        if (!seq) {
          var rand = Math.random().toString(16).slice(2);
          localStorage.setItem(LOGIN_SEQ_KEY, String(Date.now()) + '-' + rand);
        }
      }
    } catch (err) {
      // ignore
    }
    liveState.authToken = stored;
    apiClient.getCurrentUser().then(function(user) {
      if (user) {
        user.level = normalizeLevel(user.level);
      }
      liveState.currentUser = user;
      liveState.authReady = true;
      window.app = window.app || {};
      window.app.authReady = true;
      resetSessionRetryState();
      handleUserSwitch(user);
      try {
        window.dispatchEvent(new CustomEvent('app-auth-ready', { detail: { user: user } }));
      } catch (err) {
        // ignore
      }
      updateUserDisplay();
      applyRoleVisibility(user);
      // 刷新后重新应用当前页签以恢复可见状态
      var tab = liveState.activeTab || 'auto';
      liveState.activeTab = tab;
      switchToTab(tab);
    }).catch(function(err) {
      var status = err && err.status ? Number(err.status) : 0;
      if (status === 401 || status === 403) {
        resetSessionRetryState();
        apiClient.clearToken();
        redirectToLogin();
        return;
      }
      liveState.authReady = false;
      window.app = window.app || {};
      window.app.authReady = false;
      var msg = err && err.message ? err.message : '服务不可用';
      renderFallbackTabAfterAuthFailure(liveState, msg);
      scheduleEnsureSessionRetry(msg);
      try {
        var toast = window.app && window.app.utils ? window.app.utils : null;
        if (toast && typeof toast.showCenterToast === 'function') {
          toast.showCenterToast('登录校验失败：' + msg + '，请稍后刷新重试', 'warn', 3000);
        }
      } catch (e) {
        // ignore
      }
    });
  }

  function bindEvents() {
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        if (apiClient && typeof apiClient.logout === 'function') {
          apiClient.logout().finally(function() {
            apiClient.clearToken();
            // 显式登出：重登应回到主页，不再保留退出时的页面 URL。
            try {
              if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('tap-force-default-tab', '1');
            } catch (err) {
              // ignore
            }
            try {
              if (typeof localStorage !== 'undefined') localStorage.setItem('tap-force-default-tab', '1');
            } catch (err) {
              // ignore
            }
            redirectToLogin({ keepRedirect: false });
          });
        } else {
          try {
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('tap-force-default-tab', '1');
          } catch (err) {
            // ignore
          }
          try {
            if (typeof localStorage !== 'undefined') localStorage.setItem('tap-force-default-tab', '1');
          } catch (err) {
            // ignore
          }
          redirectToLogin({ keepRedirect: false });
        }
      });
    }
    if (userMenuToggle) {
      userMenuToggle.addEventListener('click', function(event) {
        if (drawerIsOpen()) {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
          return;
        }
        event.stopPropagation();
        toggleMenu();
      });
    }
    document.addEventListener('click', function(event) {
      var target = event && event.target;
      if (!userMenu || !userMenuToggle) return;
      var withinMenu = userMenu.contains(target);
      var withinToggle = userMenuToggle.contains(target);
      if (!withinMenu && !withinToggle) closeMenu();
    });
    // 仅点击设置按钮才展开，移除悬停触发
    if (userMenu) {
      userMenu.addEventListener('mouseleave', function() {
        closeMenu();
      });
    }
  }

  function init() {
    logoutBtn = document.getElementById('logoutBtn');
    userDisplay = document.getElementById('currentUsername');
    userRoleEl = document.getElementById('currentUserRole');
    userMenu = document.getElementById('userMenu');
    userMenuToggle = document.getElementById('userMenuToggle');
    bindEvents();
    ensureSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
