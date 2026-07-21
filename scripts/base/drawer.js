(function() {
  function getScrollLockPort() {
    var shell = window.app && window.app.ui ? window.app.ui.DrawerShell : null;
    return shell && shell.scrollLock ? shell.scrollLock : null;
  }

  function closeAllDrawers() {
    if (typeof document === 'undefined') return;
    var skipId = '';
    var skipDrawer = null;
    try {
      if (window.app && typeof window.app.__drawerSkipCloseId === 'string') {
        skipId = String(window.app.__drawerSkipCloseId || '');
        window.app.__drawerSkipCloseId = '';
      }
    } catch (err) {
      // ignore
    }
    if (skipId) {
      skipDrawer = document.getElementById(skipId);
    }
    var openDrawers = document.querySelectorAll ? document.querySelectorAll('.drawer.open, .drawer.closing') : [];
    if (openDrawers && typeof openDrawers.forEach === 'function') {
      openDrawers.forEach(function(drawer) {
        if (skipDrawer && drawer === skipDrawer) return;
        if (shouldSkipClose(drawer)) return;
        var closer = drawer.querySelector('[data-drawer-close]') || drawer.querySelector('.drawer-mask');
        if (closer && typeof closer.click === 'function') {
          closer.click();
        } else {
          drawer.classList.remove('open');
        }
      });
    }
  }

  function shouldSkipClose(drawer) {
    if (!drawer || !drawer.id) return false;
    var id = String(drawer.id || '');
    if (!id) return false;
    try {
      if (window.app && window.app.__drawerSkipCloseId && String(window.app.__drawerSkipCloseId) === id) {
        return true;
      }
      var guard = window.app && window.app.__drawerCloseGuard ? window.app.__drawerCloseGuard : null;
      if (!guard || guard.id === undefined || guard.id === null) return false;
      if (String(guard.id) !== id) return false;
      var until = Number(guard.until || 0);
      if (!isFinite(until) || until <= 0) return false;
      if (Date.now() < until) return true;
      if (window.app && window.app.__drawerCloseGuard && String(window.app.__drawerCloseGuard.id) === id) {
        window.app.__drawerCloseGuard = null;
      }
    } catch (err) {
      // ignore
    }
    return false;
  }

  function createDrawer(options) {
    options = options || {};
    var drawerId = options.drawerId || '';
    var drawer = drawerId ? document.getElementById(drawerId) : null;
    if (!drawer) return null;
    if (drawer.classList && drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
    var panel = drawer.querySelector('.drawer-panel');
    var mask = drawer.querySelector('.drawer-mask');
    var openButtons = Array.isArray(options.openButtons) ? options.openButtons : [];
    var closeButtons = Array.isArray(options.closeButtons) ? options.closeButtons : [];
    var closeToken = 0;
    var closeFinalizeTimer = 0;

    function applyBodyLock() {
      var port = getScrollLockPort();
      if (port && typeof port.acquire === 'function') port.acquire(drawerId);
    }
    function releaseBodyLock() {
      var port = getScrollLockPort();
      if (port && typeof port.release === 'function') port.release(drawerId);
    }
    function clearInstantOpen() {
      if (drawer.classList.contains('drawer-instant-open')) {
        drawer.classList.remove('drawer-instant-open');
      }
    }
    function open(openOptions) {
      var opts = openOptions || {};
      closeToken += 1;
      if (closeFinalizeTimer) {
        clearTimeout(closeFinalizeTimer);
        closeFinalizeTimer = 0;
      }
      if (opts.instant === true) {
        drawer.classList.add('drawer-instant-open');
      } else {
        clearInstantOpen();
      }
      if (drawer.classList.contains('closing')) drawer.classList.remove('closing');
      drawer.classList.add('open');
      if (drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
      if (opts.instant === true) {
        if (panel && typeof panel.offsetWidth === 'number') panel.offsetWidth;
        if (mask && typeof mask.offsetWidth === 'number') mask.offsetWidth;
        setTimeout(function() {
          clearInstantOpen();
        }, 0);
      }
      applyBodyLock();
      if (typeof options.onOpen === 'function') options.onOpen();
    }
    function finalizeClose(token, force) {
      if (force !== true && token !== closeToken) return;
      if (closeFinalizeTimer) {
        clearTimeout(closeFinalizeTimer);
        closeFinalizeTimer = 0;
      }
      drawer.classList.remove('closing');
      releaseBodyLock();
      if (typeof options.onClose === 'function') options.onClose();
    }
    function close() {
      if (drawer.classList.contains('closing')) return;
      if (!drawer.classList.contains('open')) return;
      if (shouldSkipClose(drawer)) return;
      clearInstantOpen();
      closeToken += 1;
      var token = closeToken;
      if (closeFinalizeTimer) clearTimeout(closeFinalizeTimer);
      drawer.classList.add('closing');
      drawer.classList.remove('open');

      var pending = 0;
      var resolved = false;
      function tryFinalize() {
        if (resolved) return;
        if (pending > 0) return;
        resolved = true;
        finalizeClose(token);
      }
      function track(el, prop) {
        if (!el || typeof el.addEventListener !== 'function') return;
        pending += 1;
        var handler = function(e) {
          if (!e || e.propertyName !== prop) return;
          el.removeEventListener('transitionend', handler);
          pending -= 1;
          tryFinalize();
        };
        el.addEventListener('transitionend', handler);
      }
      track(mask, 'opacity');
      track(panel, 'transform');
      closeFinalizeTimer = setTimeout(function() {
        pending = 0;
        if (drawer.classList.contains('closing') && !drawer.classList.contains('open')) {
          resolved = true;
          finalizeClose(token, true);
          return;
        }
        tryFinalize();
      }, 450);
      setTimeout(tryFinalize, 0);
    }
    function toggle() {
      if (drawer.classList.contains('open')) {
        close();
      } else {
        open();
      }
    }
    function bindClick(el, handler) {
      if (!el || typeof handler !== 'function') return;
      el.addEventListener('click', handler);
    }
    openButtons.forEach(function(id) {
      var btn = document.getElementById(id);
      bindClick(btn, open);
    });
    closeButtons.forEach(function(id) {
      var btn = document.getElementById(id);
      bindClick(btn, close);
    });
    if (mask) bindClick(mask, close);
    if (panel) {
      panel.querySelectorAll('[data-drawer-close]').forEach(function(node) {
        bindClick(node, close);
      });
    }

    return {
      open: open,
      close: close,
      toggle: toggle,
      element: drawer,
    };
  }

  window.app = window.app || {};
  window.app.drawer = {
    createDrawer: createDrawer,
    closeAllDrawers: closeAllDrawers,
  };
})();
