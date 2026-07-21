(function() {
  var started = false;
  function start() {
    if (started) return;
    if (window.app && typeof window.app.init === 'function') {
      window.app.init();
      started = true;
      window.app.ui = window.app.ui || {};
      if (window.app.ui.NavigationShell && typeof window.app.ui.NavigationShell.init === 'function') {
        window.app.ui.navigation = window.app.ui.NavigationShell.init();
      }
      if (window.app.ui.DrawerShell && typeof window.app.ui.DrawerShell.init === 'function') {
        window.app.ui.drawers = window.app.ui.DrawerShell.init();
      }
      window.app.__tapSharedUiStartCount = Number(window.app.__tapSharedUiStartCount || 0) + 1;
      window.app.uiReady = true;
      if (typeof CustomEvent === 'function') {
        document.dispatchEvent(new CustomEvent('tap:ui-ready', {
          detail: { startCount: window.app.__tapSharedUiStartCount },
        }));
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
