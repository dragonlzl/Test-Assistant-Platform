(function() {
  function createDrawer(options) {
    options = options || {};
    var drawerId = options.drawerId || '';
    var drawer = drawerId ? document.getElementById(drawerId) : null;
    if (!drawer) return null;
    if (drawer.classList && drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
    var panel = drawer.querySelector('.drawer-panel');
    var mask = drawer.querySelector('.drawer-mask');
    var body = document.body;
    var openButtons = Array.isArray(options.openButtons) ? options.openButtons : [];
    var closeButtons = Array.isArray(options.closeButtons) ? options.closeButtons : [];

    function open() {
      drawer.classList.add('open');
      if (drawer.classList.contains('hidden')) drawer.classList.remove('hidden');
      if (body) body.classList.add('drawer-open');
      if (typeof options.onOpen === 'function') options.onOpen();
    }
    function close() {
      drawer.classList.remove('open');
      if (body) body.classList.remove('drawer-open');
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
  };
})();
