(function() {
  var started = false;
  function start() {
    if (started) return;
    started = true;
    if (window.app && typeof window.app.init === 'function') {
      window.app.init();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
