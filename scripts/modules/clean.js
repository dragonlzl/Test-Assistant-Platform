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
    var state = ctx.state || {};

    var runCleaning = handlers.runCleaning;
    var copyCleaned = handlers.copyCleaned;
    var renderCleanView = handlers.renderCleanView;
    var renderCleanRawView = handlers.renderCleanRawView;

    if (runCleanBtn && typeof runCleaning === 'function') {
      runCleanBtn.addEventListener('click', runCleaning);
    }
    if (copyBtn && typeof copyCleaned === 'function') {
      copyBtn.addEventListener('click', copyCleaned);
    }
    if (toggleCleanViewBtn && cleanViewContainer && typeof renderCleanView === 'function') {
      toggleCleanViewBtn.addEventListener('click', function() {
        var isHidden = cleanViewContainer.classList.contains('hidden');
        if (isHidden) {
          cleanViewContainer.classList.remove('hidden');
          cleanViewContainer.classList.add('visible');
          toggleCleanViewBtn.textContent = '收起视图';
        } else {
          cleanViewContainer.classList.add('hidden');
          cleanViewContainer.classList.remove('visible');
          toggleCleanViewBtn.textContent = '展开视图';
        }
        renderCleanView(false);
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
