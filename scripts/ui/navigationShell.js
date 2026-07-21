(function() {
  var storageKey = 'tap-navigation-context-collapsed-v1';
  var narrowMediaQuery = '(max-width: 899px)';
  var activeController = null;
  var groupMeta = {
    ai: { symbol: 'AI', label: 'AI 功能' },
    cases: { symbol: 'TC', label: '用例相关' },
    manage: { symbol: 'AD', label: '管理' },
    settings: { symbol: 'ST', label: '设置' },
  };

  function readCollapsed() {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function writeCollapsed(collapsed) {
    try {
      localStorage.setItem(storageKey, collapsed ? '1' : '0');
    } catch (error) {
      // Ignore unavailable storage.
    }
  }

  function resolveMeta(button) {
    var group = button && button.dataset ? button.dataset.group : '';
    var known = groupMeta[group] || {};
    var labelNode = button && button.querySelector ? button.querySelector('.tab-group-label') : null;
    var label = known.label || (labelNode ? labelNode.textContent : button.textContent) || group;
    return {
      group: group,
      symbol: known.symbol || String(label).slice(0, 2).toUpperCase(),
      label: String(label).trim(),
    };
  }

  function emitLayoutResize(detail) {
    if (typeof CustomEvent !== 'function') return;
    document.dispatchEvent(new CustomEvent('tap:layout-resize', {
      detail: detail || {},
    }));
  }

  function init() {
    if (activeController) return activeController;
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return null;

    var originalChildren = Array.prototype.slice.call(sidebar.childNodes);
    var rail = document.createElement('div');
    var context = document.createElement('div');
    var railBrand = document.createElement('div');
    var railNav = document.createElement('nav');
    var collapseButton = document.createElement('button');
    var contextHeader = document.createElement('div');
    var contextTitle = document.createElement('strong');
    var backdrop = document.createElement('button');
    var originalButtons = Array.prototype.slice.call(sidebar.querySelectorAll('.tab-group-btn'));
    var proxyEntries = [];
    var cleanupListeners = [];
    var selectedGroup = '';
    var desktopCollapsed = readCollapsed();
    var mobileOpen = false;
    var destroyed = false;
    var mutationObserver = null;
    var resizeTimer = 0;

    function isNarrow() {
      return Boolean(window.matchMedia && window.matchMedia(narrowMediaQuery).matches);
    }

    function listen(target, type, handler, options) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(type, handler, options);
      cleanupListeners.push(function() {
        target.removeEventListener(type, handler, options);
      });
    }

    function scheduleLayoutResize(reason) {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function() {
        resizeTimer = 0;
        emitLayoutResize({ source: 'navigation', reason: reason || 'state-change' });
      }, 220);
    }

    rail.className = 'tap-nav-rail';
    context.className = 'tap-nav-context';
    railBrand.className = 'tap-nav-brand';
    railBrand.textContent = 'TA';
    railBrand.title = '用例助手';
    railNav.className = 'tap-nav-rail-list';
    railNav.setAttribute('aria-label', '主功能导航');
    collapseButton.type = 'button';
    collapseButton.className = 'tap-nav-collapse';
    contextHeader.className = 'tap-nav-context-header';
    contextTitle.textContent = '功能导航';
    contextHeader.appendChild(contextTitle);
    backdrop.type = 'button';
    backdrop.className = 'tap-nav-backdrop';
    backdrop.hidden = true;
    backdrop.tabIndex = -1;
    backdrop.setAttribute('aria-label', '关闭二级导航');

    originalChildren.forEach(function(child) {
      context.appendChild(child);
    });
    context.insertBefore(contextHeader, context.firstChild);
    rail.appendChild(railBrand);
    rail.appendChild(railNav);
    rail.appendChild(collapseButton);
    sidebar.appendChild(rail);
    sidebar.appendChild(context);
    document.body.appendChild(backdrop);
    sidebar.setAttribute('data-navigation-shell', '1');

    function applyState() {
      sidebar.classList.toggle('is-context-collapsed', desktopCollapsed);
      sidebar.classList.toggle('is-mobile-context-open', mobileOpen);
      document.documentElement.classList.toggle('tap-nav-context-collapsed', desktopCollapsed);
      backdrop.hidden = !mobileOpen;
      backdrop.setAttribute('aria-hidden', mobileOpen ? 'false' : 'true');

      var contextVisible = isNarrow() ? mobileOpen : !desktopCollapsed;
      collapseButton.textContent = contextVisible ? '<' : '>';
      collapseButton.title = contextVisible ? '收起二级导航' : '展开二级导航';
      collapseButton.setAttribute('aria-label', collapseButton.title);
      collapseButton.setAttribute('aria-expanded', contextVisible ? 'true' : 'false');
      context.setAttribute('aria-hidden', contextVisible ? 'false' : 'true');
    }

    function setDesktopCollapsed(next, persist) {
      desktopCollapsed = next === true;
      if (persist !== false) writeCollapsed(desktopCollapsed);
      applyState();
      scheduleLayoutResize('desktop-collapse');
    }

    function setMobileOpen(next) {
      var normalized = next === true && isNarrow();
      if (mobileOpen === normalized) return;
      mobileOpen = normalized;
      applyState();
      scheduleLayoutResize('mobile-overlay');
    }

    function setSelectedGroup(group, title) {
      if (!group) return;
      selectedGroup = group;
      contextTitle.textContent = title || (groupMeta[group] && groupMeta[group].label) || '功能导航';
      proxyEntries.forEach(function(entry) {
        var active = entry.meta.group === group;
        entry.proxy.classList.toggle('active', active);
        entry.proxy.setAttribute('aria-current', active ? 'page' : 'false');
      });
    }

    originalButtons.forEach(function(button) {
      var meta = resolveMeta(button);
      if (!meta.group) return;
      var proxy = document.createElement('button');
      var icon = document.createElement('span');
      var label = document.createElement('span');
      proxy.type = 'button';
      proxy.className = 'tap-nav-rail-item';
      proxy.setAttribute('data-nav-group', meta.group);
      proxy.title = meta.label;
      proxy.setAttribute('aria-label', meta.label);
      icon.className = 'tap-nav-rail-symbol';
      icon.textContent = meta.symbol;
      label.className = 'tap-nav-rail-label';
      label.textContent = meta.label;
      proxy.appendChild(icon);
      proxy.appendChild(label);
      railNav.appendChild(proxy);

      var handleProxyClick = function(event) {
        event.preventDefault();
        event.stopPropagation();
        if (isNarrow()) setMobileOpen(true);
        else if (desktopCollapsed) setDesktopCollapsed(false);
        setSelectedGroup(meta.group, meta.label);
        button.click();
      };
      var handleOriginalClick = function() {
        if (isNarrow()) setMobileOpen(true);
        else if (desktopCollapsed) setDesktopCollapsed(false);
        setSelectedGroup(meta.group, meta.label);
      };
      listen(proxy, 'click', handleProxyClick);
      listen(button, 'click', handleOriginalClick);
      proxyEntries.push({ button: button, proxy: proxy, meta: meta });
    });

    function syncFromOriginal() {
      var activeEntry = null;
      proxyEntries.forEach(function(entry) {
        var groupEl = entry.button.closest ? entry.button.closest('.tab-group') : null;
        var hidden = entry.button.classList.contains('hidden') || Boolean(groupEl && groupEl.classList.contains('hidden'));
        entry.proxy.classList.toggle('hidden', hidden);
        if (entry.button.classList.contains('active')) activeEntry = entry;
      });
      if (activeEntry) setSelectedGroup(activeEntry.meta.group, activeEntry.meta.label);
      else if (selectedGroup) setSelectedGroup(selectedGroup);
    }

    function handleCollapseClick() {
      if (isNarrow()) setMobileOpen(!mobileOpen);
      else setDesktopCollapsed(!desktopCollapsed);
    }

    function handleContextClick(event) {
      var tabButton = event.target && event.target.closest ? event.target.closest('[data-tab-btn]') : null;
      if (!tabButton) return;
      var menu = tabButton.closest('[data-group-menu]');
      if (menu && menu.dataset) {
        var group = menu.dataset.groupMenu;
        var original = sidebar.querySelector('.tab-group-btn[data-group="' + group + '"]');
        var meta = resolveMeta(original);
        setSelectedGroup(group, meta.label);
      }
      if (isNarrow()) setMobileOpen(false);
    }

    function handleDocumentPointer(event) {
      if (!mobileOpen || !isNarrow()) return;
      if (sidebar.contains(event.target)) return;
      setMobileOpen(false);
    }

    function handleDocumentKeydown(event) {
      if (event.key !== 'Escape' || !mobileOpen || !isNarrow()) return;
      if (document.querySelector('.drawer.open')) return;
      setMobileOpen(false);
      event.preventDefault();
    }

    function handleViewportResize() {
      if (!isNarrow() && mobileOpen) setMobileOpen(false);
      else applyState();
    }

    listen(collapseButton, 'click', handleCollapseClick);
    listen(context, 'click', handleContextClick);
    listen(backdrop, 'click', function() { setMobileOpen(false); });
    listen(document, 'pointerdown', handleDocumentPointer, true);
    listen(document, 'keydown', handleDocumentKeydown);
    listen(window, 'resize', handleViewportResize);

    if (typeof MutationObserver === 'function') {
      mutationObserver = new MutationObserver(syncFromOriginal);
      proxyEntries.forEach(function(entry) {
        mutationObserver.observe(entry.button, { attributes: true, attributeFilter: ['class'] });
        var group = entry.button.closest ? entry.button.closest('.tab-group') : null;
        if (group) mutationObserver.observe(group, { attributes: true, attributeFilter: ['class'] });
      });
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (resizeTimer) window.clearTimeout(resizeTimer);
      if (mutationObserver) mutationObserver.disconnect();
      cleanupListeners.forEach(function(cleanup) { cleanup(); });
      cleanupListeners = [];
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      sidebar.replaceChildren();
      originalChildren.forEach(function(child) { sidebar.appendChild(child); });
      sidebar.removeAttribute('data-navigation-shell');
      sidebar.classList.remove('is-context-collapsed', 'is-mobile-context-open');
      document.documentElement.classList.remove('tap-navigation-ready', 'tap-nav-context-collapsed');
      if (window.app && window.app.ui && window.app.ui.navigation === activeController) {
        window.app.ui.navigation = null;
      }
      activeController = null;
      emitLayoutResize({ source: 'navigation', reason: 'destroy' });
    }

    applyState();
    syncFromOriginal();
    document.documentElement.classList.add('tap-navigation-ready');
    activeController = {
      element: sidebar,
      setCollapsed: setDesktopCollapsed,
      isCollapsed: function() { return desktopCollapsed; },
      setMobileOpen: setMobileOpen,
      isMobileOpen: function() { return mobileOpen; },
      selectGroup: setSelectedGroup,
      destroy: destroy,
    };
    return activeController;
  }

  function destroy() {
    if (activeController) activeController.destroy();
  }

  window.app = window.app || {};
  window.app.ui = window.app.ui || {};
  window.app.ui.NavigationShell = {
    init: init,
    destroy: destroy,
    get: function() { return activeController; },
  };
})();
