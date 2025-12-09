(function() {
  var scrollLocked = false;
  var lockedScrollTop = 0;
  var lockListenersAttached = false;

  function isInOpenDrawer(target) {
    var node = target;
    while (node) {
      if (node.classList && node.classList.contains('drawer')) {
        return node.classList.contains('open');
      }
      node = node.parentNode;
    }
    return false;
  }

  function preventScrollIfOutsideDrawer(e) {
    if (!e || isInOpenDrawer(e.target)) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }

  function preventKeyScroll(e) {
    if (!e || isInOpenDrawer(e.target)) return;
    var keys = [' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'];
    if (keys.indexOf(e.key) === -1) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }

  function lockBodyScroll(body, root) {
    if (body && body.classList && !body.classList.contains('drawer-open')) {
      body.classList.add('drawer-open');
    }
    if (root && root.classList && !root.classList.contains('drawer-open')) {
      root.classList.add('drawer-open');
    }
    if (scrollLocked) return;
    var scrollTop = 0;
    if (typeof window !== 'undefined' && typeof window.scrollY === 'number') {
      scrollTop = window.scrollY;
    } else if (document && document.documentElement) {
      scrollTop = document.documentElement.scrollTop || document.body.scrollTop || 0;
    }
    lockedScrollTop = scrollTop;
    if (!lockListenersAttached && typeof window !== 'undefined') {
      window.addEventListener('wheel', preventScrollIfOutsideDrawer, { passive: false });
      window.addEventListener('touchmove', preventScrollIfOutsideDrawer, { passive: false });
      window.addEventListener('keydown', preventKeyScroll, true);
      lockListenersAttached = true;
    }
    scrollLocked = true;
  }

  function unlockBodyScroll(body, root) {
    var otherOpen = document.querySelector && document.querySelector('.drawer.open');
    if (otherOpen) return;
    if (root && root.classList) root.classList.remove('drawer-open');
    if (body && body.classList) body.classList.remove('drawer-open');
    if (lockListenersAttached && typeof window !== 'undefined') {
      window.removeEventListener('wheel', preventScrollIfOutsideDrawer, { passive: false });
      window.removeEventListener('touchmove', preventScrollIfOutsideDrawer, { passive: false });
      window.removeEventListener('keydown', preventKeyScroll, true);
      lockListenersAttached = false;
    }
    if (scrollLocked) {
      var targetTop = lockedScrollTop || 0;
      scrollLocked = false;
      lockedScrollTop = 0;
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo(0, targetTop);
      }
    }
  }

  function closeAllDrawers() {
    if (typeof document === 'undefined') return;
    var body = document.body;
    var root = document.documentElement;
    var openDrawers = document.querySelectorAll ? document.querySelectorAll('.drawer.open') : [];
    if (openDrawers && typeof openDrawers.forEach === 'function') {
      openDrawers.forEach(function(drawer) {
        var closer = drawer.querySelector('[data-drawer-close]') || drawer.querySelector('.drawer-mask');
        if (closer && typeof closer.click === 'function') {
          closer.click();
        } else {
          drawer.classList.remove('open');
        }
      });
    }
    unlockBodyScroll(body, root);
  }

  function createDrawer(options) {
    options = options || {};
    var drawerId = options.drawerId || '';
    var drawer = drawerId ? document.getElementById(drawerId) : null;
    if (!drawer) return null;
    if (drawer.classList && drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
    var panel = drawer.querySelector('.drawer-panel');
    var mask = drawer.querySelector('.drawer-mask');
    var body = document.body;
    var root = document.documentElement;
    var openButtons = Array.isArray(options.openButtons) ? options.openButtons : [];
    var closeButtons = Array.isArray(options.closeButtons) ? options.closeButtons : [];

    function applyBodyLock() {
      lockBodyScroll(body, root);
    }
    function releaseBodyLock() {
      unlockBodyScroll(body, root);
    }
    function open() {
      drawer.classList.add('open');
      if (drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
      applyBodyLock();
      if (typeof options.onOpen === 'function') options.onOpen();
    }
    function close() {
      drawer.classList.remove('open');
      releaseBodyLock();
      if (typeof options.onClose === 'function') options.onClose();
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
