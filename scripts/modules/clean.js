(function() {
  function init(ctx) {
    if (!ctx) return {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};

    var runCleanBtn = dom.runCleanBtn;
    var copyBtn = dom.copyBtn;
    var toggleCleanViewBtn = dom.toggleCleanViewBtn;
    var cleanViewContainer = dom.cleanViewContainer;
    var cleanRawView = dom.cleanRawView;
    var toggleCleanRawViewBtn = dom.toggleCleanRawViewBtn;
    var cleanRawLocateBtn = dom.cleanRawLocateBtn;
    var cleanHighlightAllBtn = dom.cleanHighlightAllBtn;
    var cleanViewDrawerBody = dom.cleanViewDrawerBody;
    var cleanViewDrawerTitle = dom.cleanViewDrawerTitle;
    var cleanViewDrawer = null;
    var state = ctx.state || {};

    var runCleaning = handlers.runCleaning;
    var copyCleaned = handlers.copyCleaned;
    var renderCleanView = handlers.renderCleanView;
    var renderCleanRawView = handlers.renderCleanRawView;

    function ensureCleanDrawer() {
      if (cleanViewDrawer) return cleanViewDrawer;
      if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
      cleanViewDrawer = window.app.drawer.createDrawer({
        drawerId: 'cleanViewDrawer',
        closeButtons: ['closeCleanViewDrawerBtn'],
        onClose: function() {
          if (cleanViewContainer) {
            cleanViewContainer.classList.add('hidden');
            cleanViewContainer.classList.remove('visible');
          }
          if (cleanRawView) {
            cleanRawView.classList.add('hidden');
            cleanRawView.classList.remove('visible');
          }
          if (toggleCleanViewBtn) toggleCleanViewBtn.textContent = '展开视图';
        },
      });
      return cleanViewDrawer;
    }

    if (runCleanBtn && typeof runCleaning === 'function') {
      runCleanBtn.addEventListener('click', runCleaning);
    }
    if (copyBtn && typeof copyCleaned === 'function') {
      copyBtn.addEventListener('click', copyCleaned);
    }
    if (toggleCleanViewBtn && typeof renderCleanView === 'function') {
      toggleCleanViewBtn.addEventListener('click', function() {
        var drawer = ensureCleanDrawer();
        if (!drawer) return;
        var isOpen = drawer.element && drawer.element.classList.contains('open');
        if (isOpen) {
          drawer.close();
          return;
        }
        if (cleanViewContainer) {
          cleanViewContainer.classList.remove('hidden');
          cleanViewContainer.classList.add('visible');
        }
        if (cleanRawView) {
          cleanRawView.classList.remove('hidden');
          cleanRawView.classList.add('visible');
        }
        if (cleanViewDrawerTitle) cleanViewDrawerTitle.textContent = '清洗结果视图';
        toggleCleanViewBtn.textContent = '收起视图';
        renderCleanView(false);
        drawer.open();
      });
    }
    if (toggleCleanRawViewBtn && cleanRawView && typeof renderCleanRawView === 'function') {
      toggleCleanRawViewBtn.addEventListener('click', function() {
        var isHidden = cleanRawView.classList.contains('hidden');
        if (isHidden) {
          cleanRawView.classList.remove('hidden');
          cleanRawView.classList.add('visible');
          toggleCleanRawViewBtn.textContent = '收起原文';
        } else {
          cleanRawView.classList.add('hidden');
          cleanRawView.classList.remove('visible');
          toggleCleanRawViewBtn.textContent = '展开原文';
        }
      });
    }
    if (cleanHighlightAllBtn && typeof renderCleanView === 'function') {
      cleanHighlightAllBtn.addEventListener('click', function() {
        if (!ctx.shouldExpectCleanJson || !ctx.shouldExpectCleanJson()) return;
        if (!ctx.state || !ctx.state.cleanEntries || !ctx.state.cleanEntries.length) return;
        var enable = !ctx.state.cleanHighlightAll;
        ctx.state.cleanHighlightAll = enable;
        ctx.state.cleanActiveHighlights = {};
        if (enable) {
          ctx.state.cleanEntries.forEach(function(_, idx) {
            ctx.state.cleanActiveHighlights[idx] = true;
          });
        }
        renderCleanView(false);
      });
    }
    if (cleanRawLocateBtn && typeof handlers.locateCleanRawSelection === 'function') {
      cleanRawLocateBtn.addEventListener('click', handlers.locateCleanRawSelection);
    }
    if (cleanViewContainer && typeof renderCleanView === 'function') {
      cleanViewContainer.addEventListener('click', function(e) {
        var toggleBtn = e.target && e.target.closest ? e.target.closest('[data-clean-toggle]') : null;
        if (toggleBtn) {
          var idx = Number(toggleBtn.dataset.cleanToggle);
          if (!Number.isFinite(idx)) return;
          if (state.cleanActiveHighlights && state.cleanActiveHighlights[idx]) {
            delete state.cleanActiveHighlights[idx];
          } else {
            state.cleanActiveHighlights[idx] = true;
          }
          renderCleanView(false);
          return;
        }
        var row = e.target && e.target.closest ? e.target.closest('tr[data-clean-index]') : null;
        if (!row) return;
        var index = Number(row.dataset.cleanIndex);
        if (!Number.isFinite(index)) return;
        state.cleanViewSelection = index;
        renderCleanView(false);
      });
    }

    return {};
  }

  window.app = window.app || {};
  window.app.clean = { init: init };
})();
