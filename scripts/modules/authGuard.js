(function() {
  var TOKEN_KEY = 'tap-auth-token';
  var LAST_USER_KEY = 'tap-last-user-id';
  var state = window.app && window.app.state ? window.app.state : {};
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
  var logoutBtn = null;
  var userDisplay = null;
  var userRoleEl = null;
  var userMenu = null;
  var userMenuToggle = null;

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
      var legacyCleanKey = getConfigValue('legacyCleanKey', 'cleaner-config-v1');
      var legacyCompareKey = getConfigValue('legacyCompareKey', 'cleaner-compare-config-v1');
      var keysToClear = [modelsKey, assignmentKey, settingsKey, tempExecPageSizeKey, legacyCleanKey, legacyCompareKey];
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

  function redirectToLogin() {
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
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TOKEN_KEY + '-active-tab', name);
      }
    } catch (err) {
      // ignore
    }
  }

  function ensureSession() {
    var liveState = ensureStateInstance();
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
      try {
        window.dispatchEvent(new CustomEvent('app-auth-ready', { detail: { user: liveState.currentUser } }));
      } catch (err) {
        // ignore
      }
      updateUserDisplay();
      applyRoleVisibility(liveState.currentUser);
      var tab = liveState.activeTab || 'auto';
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
    liveState.authToken = stored;
    apiClient.getCurrentUser().then(function(user) {
      if (user) {
        user.level = normalizeLevel(user.level);
      }
      liveState.currentUser = user;
      liveState.authReady = true;
      window.app = window.app || {};
      window.app.authReady = true;
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
    }).catch(function() {
      apiClient.clearToken();
      redirectToLogin();
    });
  }

  function bindEvents() {
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        if (apiClient && typeof apiClient.logout === 'function') {
          apiClient.logout().finally(function() {
            apiClient.clearToken();
            redirectToLogin();
          });
        } else {
          redirectToLogin();
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
