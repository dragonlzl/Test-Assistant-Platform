(function() {
  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};

    var runReviewBtn = dom.runReviewBtn;
    var copyReviewResultBtn = dom.copyReviewResultBtn;
    var exportReviewResultBtn = dom.exportReviewResultBtn;
    var importReviewResultBtn = dom.importReviewResultBtn;
    var reviewImportFileInput = dom.reviewImportFileInput;
    var toggleReviewViewBtn = dom.toggleReviewViewBtn;
    var confirmClarificationsBtn = dom.confirmClarificationsBtn;
    var reviewViewContainer = dom.reviewViewContainer;

    var autoClarifyContainer = dom.autoClarifyContainer;
    var autoClarifyToggleBtn = dom.autoClarifyToggleBtn;
    var autoClarifyToggle = dom.autoClarifyToggle;
    var autoClarifyConfirmBtn = dom.autoClarifyConfirmBtn;

    var reviewRequirements = handlers.reviewRequirements;
    var copyReviewResult = handlers.copyReviewResult;
    var exportReviewResult = handlers.exportReviewResult;
    var importReviewResult = handlers.importReviewResult;
    var toggleReviewView = handlers.toggleReviewView;
    var confirmClarifications = handlers.confirmClarifications;
    var handleClarifyClickEvent = handlers.handleClarifyClickEvent;
    var handleClarifyChangeEvent = handlers.handleClarifyChangeEvent;
    var handleClarifyInputEvent = handlers.handleClarifyInputEvent;
    var updateAutoClarifyVisibility = handlers.updateAutoClarifyVisibility;
    var toggleAutoClarifyPanel = handlers.toggleAutoClarifyPanel;
    var handleAutoClarifyConfirm = handlers.handleAutoClarifyConfirm;
    var flushClarifyPendingRender = handlers.flushClarifyPendingRender;

    if (runReviewBtn && typeof reviewRequirements === 'function') {
      runReviewBtn.addEventListener('click', reviewRequirements);
    }
    if (copyReviewResultBtn && typeof copyReviewResult === 'function') {
      copyReviewResultBtn.addEventListener('click', copyReviewResult);
    }
    if (exportReviewResultBtn && typeof exportReviewResult === 'function') {
      exportReviewResultBtn.addEventListener('click', exportReviewResult);
    }
    if (importReviewResultBtn && reviewImportFileInput && typeof importReviewResult === 'function') {
      importReviewResultBtn.addEventListener('click', function() { reviewImportFileInput.click(); });
      reviewImportFileInput.addEventListener('change', function(e) {
        var files = e.target && e.target.files;
        var file = files && files[0];
        if (file) importReviewResult(file);
        reviewImportFileInput.value = '';
      });
    }
    if (toggleReviewViewBtn && typeof toggleReviewView === 'function') {
      toggleReviewViewBtn.addEventListener('click', toggleReviewView);
    }
    if (confirmClarificationsBtn && typeof confirmClarifications === 'function') {
      confirmClarificationsBtn.addEventListener('click', confirmClarifications);
    }

    if (reviewViewContainer) {
      if (typeof handleClarifyClickEvent === 'function') {
        reviewViewContainer.addEventListener('click', handleClarifyClickEvent);
      }
      if (typeof handleClarifyChangeEvent === 'function') {
        reviewViewContainer.addEventListener('change', handleClarifyChangeEvent);
      }
      if (typeof handleClarifyInputEvent === 'function') {
        reviewViewContainer.addEventListener('input', handleClarifyInputEvent);
      }
      reviewViewContainer.addEventListener('compositionstart', function(e) {
        var target = e && e.target && e.target.closest
          ? e.target.closest('textarea[data-clarify-index]')
          : null;
        if (!target || !target.dataset) return;
        state.clarifyComposing = true;
        target.dataset.clarifyComposing = '1';
      });
      reviewViewContainer.addEventListener('compositionend', function(e) {
        var target = e && e.target && e.target.closest
          ? e.target.closest('textarea[data-clarify-index]')
          : null;
        if (!target || !target.dataset) return;
        delete target.dataset.clarifyComposing;
        state.clarifyComposing = false;
        if (typeof handleClarifyInputEvent === 'function') {
          handleClarifyInputEvent({ target: target });
        }
        if (typeof flushClarifyPendingRender === 'function') flushClarifyPendingRender();
      });
    }

    if (autoClarifyContainer) {
      if (typeof handleClarifyClickEvent === 'function') {
        autoClarifyContainer.addEventListener('click', handleClarifyClickEvent);
      }
      if (typeof handleClarifyChangeEvent === 'function') {
        autoClarifyContainer.addEventListener('change', handleClarifyChangeEvent);
      }
      if (typeof handleClarifyInputEvent === 'function') {
        autoClarifyContainer.addEventListener('input', handleClarifyInputEvent);
      }
      autoClarifyContainer.addEventListener('compositionstart', function(e) {
        var target = e && e.target && e.target.closest
          ? e.target.closest('textarea[data-clarify-index]')
          : null;
        if (!target || !target.dataset) return;
        state.clarifyComposing = true;
        target.dataset.clarifyComposing = '1';
      });
      autoClarifyContainer.addEventListener('compositionend', function(e) {
        var target = e && e.target && e.target.closest
          ? e.target.closest('textarea[data-clarify-index]')
          : null;
        if (!target || !target.dataset) return;
        delete target.dataset.clarifyComposing;
        state.clarifyComposing = false;
        if (typeof handleClarifyInputEvent === 'function') {
          handleClarifyInputEvent({ target: target });
        }
        if (typeof flushClarifyPendingRender === 'function') flushClarifyPendingRender();
      });
    }

    if (autoClarifyToggleBtn && typeof toggleAutoClarifyPanel === 'function') {
      autoClarifyToggleBtn.addEventListener('click', function() {
        if (!state.autoRequireClarifications) return;
        toggleAutoClarifyPanel();
      });
    }

    if (autoClarifyToggle && typeof updateAutoClarifyVisibility === 'function') {
      autoClarifyToggle.addEventListener('change', function(e) {
        var checked = Boolean(e && e.target && e.target.checked);
        updateAutoClarifyVisibility(checked, { resetDismissed: false, source: 'toggle' });
      });
    }

    if (autoClarifyConfirmBtn && typeof handleAutoClarifyConfirm === 'function') {
      autoClarifyConfirmBtn.addEventListener('click', handleAutoClarifyConfirm);
    }

    return {};
  }

  window.app = window.app || {};
  window.app.review = { init: init };
})();
