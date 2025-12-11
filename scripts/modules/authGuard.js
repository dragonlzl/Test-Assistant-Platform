(function() {
  var TOKEN_KEY = 'tap-auth-token';
  var state = window.app && window.app.state ? window.app.state : {};
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
  var logoutBtn = null;
  var userDisplay = null;
  var userRoleEl = null;
  var userMenu = null;
  var userMenuToggle = null;

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
    var currentTab = state.activeTab || 'auto';
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
    var user = state.currentUser;
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
    state.activeTab = name;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TOKEN_KEY + '-active-tab', name);
      }
    } catch (err) {
      // ignore
    }
  }

  function ensureSession() {
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
    state.authToken = stored;
    apiClient.getCurrentUser().then(function(user) {
      if (user) {
        user.level = normalizeLevel(user.level);
      }
      state.currentUser = user;
      updateUserDisplay();
      applyRoleVisibility(user);
      // 刷新后重新应用当前页签以恢复可见状态
      var tab = state.activeTab || 'auto';
      state.activeTab = tab;
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
