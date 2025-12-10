(function() {
  var TOKEN_KEY = 'tap-auth-token';
  var state = window.app && window.app.state ? window.app.state : {};
  var apiClient = window.app && window.app.apiClient ? window.app.apiClient : null;
  var logoutBtn = null;
  var userDisplay = null;
  var userRoleEl = null;
  var userMenu = null;
  var userMenuToggle = null;

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function redirectToLogin() {
    var redirect = window.location.pathname + window.location.search + window.location.hash;
    var target = 'login.html?redirect=' + encodeURIComponent(redirect);
    window.location.replace(target);
  }

  function applyRoleVisibility(role) {
    var adminOnly = document.querySelectorAll('[data-role="admin-only"]');
    adminOnly.forEach(function(node) {
      node.classList.toggle('hidden', role !== 'admin');
    });
    var currentTab = state.activeTab || 'auto';
    var adminTabs = ['project-admin', 'user-admin', 'ops-log'];
    if (role !== 'admin' && adminTabs.indexOf(currentTab) !== -1) {
      switchToTab('auto');
    }
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
      state.currentUser = user;
      updateUserDisplay();
      applyRoleVisibility(user && user.role ? user.role : 'user');
    }).catch(function() {
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
    var banner = document.getElementById('userBanner');
    // 悬停显示菜单
    if (banner) {
      banner.addEventListener('mouseenter', function() {
        if (state && state.currentUser) {
          userMenu.classList.add('menu-open');
        }
      });
    }
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
