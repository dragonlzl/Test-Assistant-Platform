(function() {
  function init(ctx) {
    if (!ctx) return {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};

    var splitBtnEl = dom.splitBtnEl;
    var toggleSplitViewBtn = dom.toggleSplitViewBtn;

    if (splitBtnEl && typeof handlers.splitModules === 'function') {
      splitBtnEl.addEventListener('click', handlers.splitModules);
    }
    if (toggleSplitViewBtn && typeof handlers.toggleSplitView === 'function') {
      toggleSplitViewBtn.addEventListener('click', handlers.toggleSplitView);
    }

    return {};
  }

  window.app = window.app || {};
  window.app.split = { init: init };
})();
