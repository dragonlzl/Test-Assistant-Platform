(function() {
  function init(ctx) {
    if (!ctx) return {};
    var handlers = ctx.handlers || {};
    var dom = ctx.dom || {};

    var compareBtnEl = dom.compareBtnEl;
    var casesCompareBtnEl = dom.casesCompareBtnEl;
    var exportCompareResultBtn = dom.exportCompareResultBtn;
    var importCompareResultBtn = dom.importCompareResultBtn;
    var compareImportFileInput = dom.compareImportFileInput;
    var casesCompareResultEl = dom.casesCompareResultEl;
    var missingViewBtn = dom.missingViewBtn;
    var copyMissingBtn = dom.copyMissingBtn;
    var missingViewContainer = dom.missingViewContainer;
    var missingSmartFillBtn = dom.missingSmartFillBtn;
    var exportCasesCoverageBtn = dom.exportCasesCoverageBtn;
    var importCasesCoverageBtn = dom.importCasesCoverageBtn;
    var importCasesCoverageFile = dom.importCasesCoverageFile;

    if (compareBtnEl && typeof handlers.compareCoverage === 'function') {
      compareBtnEl.addEventListener('click', handlers.compareCoverage);
    }
    if (casesCompareBtnEl && typeof handlers.compareCasesCoverage === 'function') {
      casesCompareBtnEl.addEventListener('click', handlers.compareCasesCoverage);
    }
    if (exportCompareResultBtn && typeof handlers.exportCompareResult === 'function') {
      exportCompareResultBtn.addEventListener('click', handlers.exportCompareResult);
    }
    if (importCompareResultBtn && compareImportFileInput && typeof handlers.importCompareResult === 'function') {
      importCompareResultBtn.addEventListener('click', function() {
        compareImportFileInput.click();
      });
      compareImportFileInput.addEventListener('change', function(e) {
        var files = e.target && e.target.files;
        var file = files && files[0];
        if (file) handlers.importCompareResult(file);
        compareImportFileInput.value = '';
      });
    }
    if (casesCompareResultEl && typeof handlers.handleCasesCompareInput === 'function') {
      casesCompareResultEl.addEventListener('input', handlers.handleCasesCompareInput);
    }
    if (missingViewBtn && typeof handlers.toggleMissingView === 'function') {
      missingViewBtn.addEventListener('click', handlers.toggleMissingView);
    }
    if (copyMissingBtn && typeof handlers.copyMissingJson === 'function') {
      copyMissingBtn.addEventListener('click', handlers.copyMissingJson);
    }
    if (missingViewContainer && typeof handlers.handleMissingSelectionChange === 'function' && typeof handlers.handleMissingSelectAll === 'function') {
      missingViewContainer.addEventListener('change', function(e) {
        var target = e.target;
        if (!target) return;
        if (target.dataset.missingIndex !== undefined) {
          handlers.handleMissingSelectionChange(Number(target.dataset.missingIndex), target.checked);
        } else if (target.dataset.missingSelectAll !== undefined) {
          handlers.handleMissingSelectAll(target.checked);
        }
      });
    }
    if (missingSmartFillBtn && typeof handlers.smartFillMissingSuggestions === 'function') {
      missingSmartFillBtn.addEventListener('click', handlers.smartFillMissingSuggestions);
    }
    if (exportCasesCoverageBtn && typeof handlers.exportCasesCoverage === 'function') {
      exportCasesCoverageBtn.addEventListener('click', handlers.exportCasesCoverage);
    }
    if (importCasesCoverageBtn && importCasesCoverageFile && typeof handlers.importCasesCoverage === 'function') {
      importCasesCoverageBtn.addEventListener('click', function() {
        importCasesCoverageFile.click();
      });
      importCasesCoverageFile.addEventListener('change', function(e) {
        var file = e.target && e.target.files && e.target.files[0];
        if (file) handlers.importCasesCoverage(file);
        importCasesCoverageFile.value = '';
      });
    }

    return {};
  }

  window.app = window.app || {};
  window.app.compare = { init: init };
})();
