(function() {
  function init(ctx) {
    if (!ctx) return {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};
    var pickEl = function(el, id) {
      if (el) return el;
      if (typeof document !== 'undefined') return document.getElementById(id);
      return null;
    };

    var splitBtnEl = pickEl(dom.splitBtnEl, 'splitBtn');
    var toggleSplitViewBtn = pickEl(dom.toggleSplitViewBtn, 'toggleSplitView');

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
