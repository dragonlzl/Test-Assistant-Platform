(function() {
  window.app = window.app || {};

  var activeTool = '';
  var activeToolTrigger = null;
  var userCloseTimer = 0;
  var toolLabels = {
    memo: '个人备忘'
  };
  var toolNavLabels = {
    memo: '个人备忘'
  };
  var navIcons = {
    casesgen: 'casesgen',
    assign: 'assign',
    models: 'models',
    tempexec: 'tempexec',
    'case-library': 'case-library',
    'case-archive': 'case-archive',
    'exec-overview': 'exec-overview',
    'project-admin': 'project-admin',
    'user-admin': 'user-admin',
    'ops-log': 'ops-log',
    settings: 'settings'
  };
  var navLabels = {
    casesgen: '用例生成',
    assign: '功能指派',
    models: '模型管理',
    tempexec: '用例执行',
    'case-library': '用例库',
    'case-archive': '用例归档',
    'exec-overview': '执行总览',
    'project-admin': '项目管理',
    'user-admin': '人员管理',
    'ops-log': '操作记录',
    settings: '通用设置'
  };

  function getIcons() {
    return window.app && window.app.workspaceIcons ? window.app.workspaceIcons : null;
  }

  function renderIcon(name, className) {
    var icons = getIcons();
    if (!icons || typeof icons.render !== 'function') return '';
    return icons.render(name, className || '');
  }

  function createElement(tagName, className, html) {
    var el = document.createElement(tagName);
    if (className) el.className = className;
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  function blockCategoryActivation(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function clearCategoryInteractionState(button) {
    if (!button || !button.classList) return;
    if (button.classList.contains('active')) button.classList.remove('active');
    if (button.classList.contains('hovering')) button.classList.remove('hovering');
  }

  function keepCategoriesPassive(nav) {
    var buttons = nav.querySelectorAll('.tab-group-btn');
    Array.prototype.forEach.call(buttons, clearCategoryInteractionState);
    if (typeof MutationObserver !== 'function') return;

    var observer = new MutationObserver(function(records) {
      Array.prototype.forEach.call(records, function(record) {
        var button = record.target;
        if (!button || !button.dataset || button.dataset.workspaceCategory !== '1') return;
        clearCategoryInteractionState(button);
      });
    });
    observer.observe(nav, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });
  }

  function decorateBrand(sidebar) {
    var header = sidebar.querySelector('.sidebar-header');
    var title = header ? header.querySelector('h1') : null;
    if (!header || !title || title.dataset.workspaceReady === '1') return;
    title.dataset.workspaceReady = '1';
    title.setAttribute('aria-label', '用例助手');
    title.innerHTML =
      '<span class="workspace-brand-mark" aria-hidden="true"><span class="workspace-brand-letter">T</span></span>' +
      '<span class="workspace-brand-copy"><span class="workspace-brand-title">用例助手</span><span class="workspace-brand-subtitle">TEST ASSISTANT</span></span>';
  }

  function syncNavigationNotice(button) {
    if (!button || !button.dataset) return;
    var tabName = button.dataset.tabBtn || '';
    var labelElement = button.querySelector('.workspace-nav-label');
    var label = navLabels[tabName] || (labelElement ? String(labelElement.textContent || '').trim() : '');
    var notice = button.querySelector('.tab-notice');
    var noticeText = notice ? String(notice.textContent || '').trim() : '';
    var accessibleLabel = noticeText ? label + '，' + noticeText : label;
    if (notice) {
      notice.setAttribute('aria-hidden', 'true');
      notice.setAttribute('title', noticeText);
    }
    if (accessibleLabel) {
      button.setAttribute('aria-label', accessibleLabel);
      button.setAttribute('title', accessibleLabel);
    }
  }

  function watchNavigationNotices(nav) {
    if (!nav || nav.dataset.workspaceNoticeObserver === '1') return;
    nav.dataset.workspaceNoticeObserver = '1';
    Array.prototype.forEach.call(nav.querySelectorAll('[data-tab-btn]'), syncNavigationNotice);
    if (typeof MutationObserver !== 'function') return;

    var observer = new MutationObserver(function() {
      Array.prototype.forEach.call(nav.querySelectorAll('[data-tab-btn]'), syncNavigationNotice);
    });
    observer.observe(nav, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function decorateNavigation(sidebar) {
    var nav = sidebar.querySelector('nav.tabs.vertical');
    if (!nav) return;
    nav.classList.add('workspace-nav');

    Array.prototype.forEach.call(nav.querySelectorAll('.tab-group'), function(group) {
      group.classList.add('workspace-nav-group');
      var groupButton = group.querySelector('.tab-group-btn');
      if (groupButton) {
        groupButton.setAttribute('tabindex', '-1');
        groupButton.setAttribute('role', 'heading');
        groupButton.setAttribute('aria-level', '2');
        groupButton.dataset.workspaceCategory = '1';
        groupButton.addEventListener('click', blockCategoryActivation, true);
      }
      var submenu = group.querySelector('.tab-submenu');
      if (submenu) submenu.classList.add('workspace-nav-list');
    });

    Array.prototype.forEach.call(nav.querySelectorAll('[data-tab-btn]'), function(button) {
      if (button.dataset && button.dataset.workspaceNavReady === '1') return;
      var tabName = button.dataset ? button.dataset.tabBtn : '';
      var iconName = navIcons[tabName] || 'brand';
      var label = navLabels[tabName] || String(button.textContent || '').trim();
      var icon = createElement('span', 'workspace-nav-icon', renderIcon(iconName));
      var labelElement = createElement('span', 'workspace-nav-label');
      labelElement.textContent = label;
      button.textContent = '';
      button.appendChild(icon);
      button.appendChild(labelElement);
      if (button.dataset) button.dataset.workspaceNavReady = '1';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });

    keepCategoriesPassive(nav);
    watchNavigationNotices(nav);
  }

  function selectToolPanel(toolId) {
    var tabBar = document.getElementById('sidebarTabBar');
    var panels = document.getElementById('sidebarTabPanels');
    if (tabBar) {
      Array.prototype.forEach.call(tabBar.querySelectorAll('[data-sidebar-tab]'), function(button) {
        var selected = button.dataset && button.dataset.sidebarTab === toolId;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
    }
    if (panels) {
      Array.prototype.forEach.call(panels.querySelectorAll('[data-sidebar-panel]'), function(panel) {
        var selected = panel.dataset && panel.dataset.sidebarPanel === toolId;
        panel.classList.toggle('is-active', selected);
      });
    }
  }

  function syncToolTriggerState(open) {
    var tabBar = document.getElementById('sidebarTabBar');
    if (!tabBar) return;
    Array.prototype.forEach.call(tabBar.querySelectorAll('[data-sidebar-tab]'), function(button) {
      var expanded = open && button.dataset && button.dataset.sidebarTab === activeTool;
      button.classList.toggle('is-drawer-open', Boolean(expanded));
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function closeUserCard() {
    var menu = document.getElementById('userMenu');
    var toggle = document.getElementById('userMenuToggle');
    if (userCloseTimer) {
      window.clearTimeout(userCloseTimer);
      userCloseTimer = 0;
    }
    if (menu) menu.classList.remove('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function closeToolDrawer(options) {
    var overlay = document.getElementById('workspaceToolOverlay');
    if (!overlay || !overlay.classList.contains('is-open')) return false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('workspace-tool-open');
    syncToolTriggerState(false);
    var restoreFocus = !options || options.restoreFocus !== false;
    var trigger = activeToolTrigger;
    activeTool = '';
    activeToolTrigger = null;
    if (restoreFocus && trigger && typeof trigger.focus === 'function') {
      try { trigger.focus(); } catch (err) { /* ignore */ }
    }
    return true;
  }

  function openToolDrawer(toolId, trigger) {
    var normalized = toolId ? String(toolId) : '';
    var overlay = document.getElementById('workspaceToolOverlay');
    if (!overlay || !toolLabels[normalized]) return false;
    activeTool = normalized;
    activeToolTrigger = trigger || document.querySelector('[data-sidebar-tab="' + normalized + '"]');
    selectToolPanel(normalized);
    var title = document.getElementById('workspaceToolDrawerTitle');
    if (title) title.textContent = toolLabels[normalized];
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('workspace-tool-open');
    syncToolTriggerState(true);
    closeUserCard();
    return true;
  }

  function setupToolDrawer(sidebar) {
    var tabs = document.getElementById('sidebarTabs');
    var tabBar = document.getElementById('sidebarTabBar');
    var panels = document.getElementById('sidebarTabPanels');
    if (!tabs || !tabBar || !panels || document.getElementById('workspaceToolOverlay')) return;

    tabs.classList.add('workspace-tools');
    tabBar.setAttribute('aria-label', '个人工具');
    Array.prototype.forEach.call(tabBar.querySelectorAll('[data-sidebar-tab]'), function(button) {
      var toolId = button.dataset ? button.dataset.sidebarTab : '';
      var dot = button.querySelector('.sidebar-tab-dot');
      var iconName = toolId === 'memo' ? 'memo' : 'progress';
      button.textContent = '';
      button.insertAdjacentHTML('beforeend', renderIcon(iconName, 'workspace-tool-icon'));
      var label = createElement('span', 'workspace-tool-label');
      label.textContent = toolNavLabels[toolId] || toolLabels[toolId] || toolId;
      button.appendChild(label);
      if (dot) button.appendChild(dot);
      button.setAttribute('title', toolLabels[toolId] || toolId);
      button.setAttribute('aria-controls', 'workspaceToolDrawer');
      button.setAttribute('aria-expanded', 'false');
    });

    var overlay = createElement('div', 'workspace-tool-overlay');
    overlay.id = 'workspaceToolOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<button class="workspace-tool-mask" type="button" aria-label="关闭工具面板"></button>' +
      '<aside class="workspace-tool-drawer" id="workspaceToolDrawer" role="dialog" aria-modal="true" aria-labelledby="workspaceToolDrawerTitle">' +
        '<div class="workspace-tool-drawer-header">' +
          '<div><span class="workspace-tool-eyebrow">个人工具</span><h2 id="workspaceToolDrawerTitle">个人备忘</h2></div>' +
          '<button class="workspace-icon-button" id="workspaceToolDrawerClose" type="button" aria-label="关闭工具面板" title="关闭">' + renderIcon('close') + '</button>' +
        '</div>' +
        '<div class="workspace-tool-drawer-body"></div>' +
      '</aside>';
    document.body.appendChild(overlay);
    var body = overlay.querySelector('.workspace-tool-drawer-body');
    if (body) body.appendChild(panels);

    tabBar.addEventListener('click', function(event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-sidebar-tab]') : null;
      if (!button || !button.dataset) return;
      var toolId = button.dataset.sidebarTab || '';
      if (overlay.classList.contains('is-open') && activeTool === toolId) {
        closeToolDrawer();
        return;
      }
      openToolDrawer(toolId, button);
    });

    var mask = overlay.querySelector('.workspace-tool-mask');
    var closeButton = document.getElementById('workspaceToolDrawerClose');
    if (mask) mask.addEventListener('click', function() { closeToolDrawer(); });
    if (closeButton) closeButton.addEventListener('click', function() { closeToolDrawer(); });

    overlay.addEventListener('click', function(event) {
      var progressItem = event.target && event.target.closest ? event.target.closest('[data-casegen-workspace]') : null;
      if (progressItem) {
        window.setTimeout(function() { closeToolDrawer({ restoreFocus: false }); }, 0);
      }
    });
  }

  function updateUserCard() {
    var username = document.getElementById('currentUsername');
    var name = username ? String(username.textContent || '').trim() : '';
    var initial = name && name !== '未登录' ? name.slice(0, 1) : '访';
    var avatar = document.querySelector('#userMenuToggle .workspace-user-avatar');
    var cardAvatar = document.querySelector('#userMenu .workspace-user-card-avatar');
    var cardName = document.querySelector('#userMenu .workspace-user-card-name');
    if (avatar) avatar.textContent = initial;
    if (cardAvatar) cardAvatar.textContent = initial;
    if (cardName) cardName.textContent = name || '未登录';
  }

  function openUserCard() {
    var menu = document.getElementById('userMenu');
    var toggle = document.getElementById('userMenuToggle');
    if (userCloseTimer) {
      window.clearTimeout(userCloseTimer);
      userCloseTimer = 0;
    }
    if (menu) menu.classList.add('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function queueUserCardClose() {
    if (userCloseTimer) window.clearTimeout(userCloseTimer);
    userCloseTimer = window.setTimeout(function() {
      closeUserCard();
    }, 220);
  }

  function navigateToSettings() {
    closeUserCard();
    if (window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab('settings');
      return;
    }
    window.location.href = './settings.html?tab=settings';
  }

  function setupUserArea(sidebar) {
    var banner = document.getElementById('userBanner');
    var toggle = document.getElementById('userMenuToggle');
    var menu = document.getElementById('userMenu');
    var username = document.getElementById('currentUsername');
    var role = document.getElementById('currentUserRole');
    var logout = document.getElementById('logoutBtn');
    if (!banner || !toggle || !menu || !username || !logout) return;

    banner.classList.add('workspace-user-area');
    var prefix = banner.querySelector('.user-prefix');
    if (prefix) prefix.classList.add('workspace-visually-hidden');

    toggle.classList.add('workspace-user-trigger');
    toggle.innerHTML = '<span class="workspace-user-avatar">访</span>';
    toggle.setAttribute('title', '用户菜单');
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');

    var summary = createElement('span', 'workspace-user-summary');
    summary.appendChild(username);
    banner.insertBefore(summary, menu);
    banner.insertBefore(toggle, summary);

    menu.classList.add('workspace-user-card');
    menu.setAttribute('role', 'menu');
    var profile = createElement('div', 'workspace-user-card-profile');
    profile.innerHTML =
      '<span class="workspace-user-card-avatar">访</span>' +
      '<span class="workspace-user-card-copy"><strong class="workspace-user-card-name">未登录</strong><span class="workspace-user-card-role-label">角色</span></span>';
    if (role) {
      role.classList.add('workspace-user-card-role');
      var copy = profile.querySelector('.workspace-user-card-copy');
      if (copy) copy.appendChild(role);
    }
    menu.insertBefore(profile, menu.firstChild);

    var settingsButton = createElement('button', 'workspace-user-action');
    settingsButton.id = 'workspaceUserSettingsBtn';
    settingsButton.type = 'button';
    settingsButton.setAttribute('role', 'menuitem');
    settingsButton.innerHTML = renderIcon('settings') + '<span>通用设置</span>';
    menu.insertBefore(settingsButton, logout);
    settingsButton.addEventListener('click', navigateToSettings);

    logout.classList.add('workspace-user-action', 'workspace-user-logout');
    logout.setAttribute('role', 'menuitem');
    logout.innerHTML = renderIcon('logout') + '<span>退出登录</span>';

    sidebar.appendChild(banner);

    toggle.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (document.body && document.body.classList.contains('drawer-open')) {
        closeUserCard();
        return;
      }
      openUserCard();
    });
    banner.addEventListener('mouseenter', openUserCard);
    banner.addEventListener('mouseleave', queueUserCardClose);
    banner.addEventListener('focusin', openUserCard);
    banner.addEventListener('focusout', function(event) {
      var next = event.relatedTarget;
      if (next && banner.contains(next)) return;
      queueUserCardClose();
    });
    banner.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape') return;
      closeUserCard();
      try { toggle.focus(); } catch (err) { /* ignore */ }
    });

    var observer = new MutationObserver(updateUserCard);
    observer.observe(username, { childList: true, characterData: true, subtree: true });
    if (role) observer.observe(role, { childList: true, characterData: true, subtree: true });
    var menuObserver = new MutationObserver(function() {
      toggle.setAttribute('aria-expanded', menu.classList.contains('menu-open') ? 'true' : 'false');
    });
    menuObserver.observe(menu, { attributes: true, attributeFilter: ['class'] });
    updateUserCard();
  }

  function setWorkspaceSectionNavCollapsed(sectionNav, toggle, collapsed) {
    var isCollapsed = Boolean(collapsed);
    var label = isCollapsed ? '展开快捷导航' : '收起快捷导航';
    var expandedHost = sectionNav.querySelector('.workspace-section-nav-header');
    var collapsedHostId = toggle.getAttribute('data-collapsed-host') || '';
    var collapsedHost = collapsedHostId ? document.getElementById(collapsedHostId) : null;
    var targetHost = isCollapsed ? collapsedHost : expandedHost;
    var restoreFocus = document.activeElement === toggle;
    if (targetHost && toggle.parentNode !== targetHost) targetHost.appendChild(toggle);
    sectionNav.classList.toggle('is-collapsed', isCollapsed);
    toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    toggle.innerHTML = renderIcon(isCollapsed ? 'panel-left-open' : 'panel-left-close');
    if (restoreFocus && typeof toggle.focus === 'function') {
      try { toggle.focus({ preventScroll: true }); } catch (err) { toggle.focus(); }
    }
  }

  function setupWorkspaceSectionNav() {
    var sectionNavs = document.querySelectorAll('.workspace-section-nav');
    Array.prototype.forEach.call(sectionNavs, function(sectionNav) {
      var toggle = sectionNav.querySelector('.workspace-section-nav-toggle');
      if (!toggle || toggle.dataset.workspaceReady === '1') return;
      toggle.dataset.workspaceReady = '1';
      setWorkspaceSectionNavCollapsed(sectionNav, toggle, false);
      toggle.addEventListener('click', function() {
        setWorkspaceSectionNavCollapsed(sectionNav, toggle, !sectionNav.classList.contains('is-collapsed'));
      });
    });
  }

  function bindGlobalEvents() {
    document.addEventListener('click', function(event) {
      var banner = document.getElementById('userBanner');
      if (banner && event.target && banner.contains(event.target)) return;
      closeUserCard();
    });
    document.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape') return;
      if (closeToolDrawer()) {
        event.preventDefault();
        return;
      }
      closeUserCard();
    });
  }

  function init() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.dataset.workspaceReady === '1') return false;
    sidebar.dataset.workspaceReady = '1';
    document.documentElement.classList.add('workspace-shell-enabled');
    document.body.classList.add('workspace-shell-body');
    decorateBrand(sidebar);
    decorateNavigation(sidebar);
    setupToolDrawer(sidebar);
    setupUserArea(sidebar);
    setupWorkspaceSectionNav();
    bindGlobalEvents();
    return true;
  }

  window.app.workspaceShell = {
    init: init,
    openToolDrawer: openToolDrawer,
    closeToolDrawer: closeToolDrawer,
    openUserCard: openUserCard,
    closeUserCard: closeUserCard,
    isToolDrawerOpen: function() {
      var overlay = document.getElementById('workspaceToolOverlay');
      return Boolean(overlay && overlay.classList.contains('is-open'));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
