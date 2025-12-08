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
    var openAutoClarifyPanel = handlers.openAutoClarifyPanel;
    var closeAutoClarifyPanel = handlers.closeAutoClarifyPanel;
    var handleAutoClarifyConfirm = handlers.handleAutoClarifyConfirm;

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
    }

    if (autoClarifyToggleBtn && typeof updateAutoClarifyVisibility === 'function') {
      autoClarifyToggleBtn.addEventListener('click', function() {
        if (!state.autoRequireClarifications) return;
        if (!autoClarifyContainer) return;
        var hidden = autoClarifyContainer.classList.contains('hidden');
        if (hidden) {
          if (typeof openAutoClarifyPanel === 'function') openAutoClarifyPanel();
        } else {
          if (typeof closeAutoClarifyPanel === 'function') {
            closeAutoClarifyPanel();
          } else {
            autoClarifyContainer.classList.add('hidden');
            autoClarifyContainer.classList.remove('visible');
            autoClarifyToggleBtn.textContent = '展开澄清视图';
          }
        }
      });
    }

    if (autoClarifyToggle && typeof updateAutoClarifyVisibility === 'function') {
      autoClarifyToggle.addEventListener('change', function(e) {
        var checked = Boolean(e && e.target && e.target.checked);
        updateAutoClarifyVisibility(checked);
        if (checked && state.reviewRows && state.reviewRows.length && typeof openAutoClarifyPanel === 'function') {
          openAutoClarifyPanel();
        }
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
