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

    var compareBtnEl = pickEl(dom.compareBtnEl, 'compareBtn');
    var casesCompareBtnEl = pickEl(dom.casesCompareBtnEl, 'casesCompareBtn');
    var exportCompareResultBtn = pickEl(dom.exportCompareResultBtn, 'exportCompareResult');
    var importCompareResultBtn = pickEl(dom.importCompareResultBtn, 'importCompareResult');
    var compareImportFileInput = pickEl(dom.compareImportFileInput, 'compareImportFile');
    var casesCompareResultEl = pickEl(dom.casesCompareResultEl, 'casesCompareResult');
    var missingViewBtn = pickEl(dom.missingViewBtn, 'missingViewBtn');
    var copyMissingBtn = pickEl(dom.copyMissingBtn, 'copyMissingBtn');
    var missingViewContainer = pickEl(dom.missingViewContainer, 'missingViewContainer');
    var missingSmartFillBtn = pickEl(dom.missingSmartFillBtn, 'missingSmartFillBtn');
    var exportCasesCoverageBtn = pickEl(dom.exportCasesCoverageBtn, 'exportCasesCoverage');
    var importCasesCoverageBtn = pickEl(dom.importCasesCoverageBtn, 'importCasesCoverage');
    var importCasesCoverageFile = pickEl(dom.importCasesCoverageFile, 'importCasesCoverageFile');

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
    function bindMissingViewChange(e) {
      var target = e && e.target;
      if (!target) return;
      if (target.dataset.missingIndex !== undefined) {
        handlers.handleMissingSelectionChange(Number(target.dataset.missingIndex), target.checked);
      } else if (target.dataset.missingSelectAll !== undefined) {
        handlers.handleMissingSelectAll(target.checked);
      }
    }
    if (missingViewContainer && typeof handlers.handleMissingSelectionChange === 'function' && typeof handlers.handleMissingSelectAll === 'function') {
      missingViewContainer.addEventListener('change', bindMissingViewChange);
      missingViewContainer.addEventListener('click', bindMissingViewChange);
    }
    if (missingSmartFillBtn && typeof handlers.smartFillMissingSuggestions === 'function') {
      missingSmartFillBtn.addEventListener('click', handlers.smartFillMissingSuggestions);
    }
    if (exportCasesCoverageBtn && (handlers.exportCasesCoverage || handlers.triggerCoverageSampleDownload)) {
      exportCasesCoverageBtn.addEventListener('click', function() {
        var hasPayload = casesCompareResultEl && casesCompareResultEl.value && casesCompareResultEl.value.trim();
        exportCasesCoverageBtn.dataset.clicked = '1';
        if (typeof handlers.exportCasesCoverage === 'function') {
          handlers.exportCasesCoverage();
        }
        if (!hasPayload && typeof handlers.triggerCoverageSampleDownload === 'function') {
          handlers.triggerCoverageSampleDownload(exportCasesCoverageBtn);
        }
      });
    }
    if (importCasesCoverageBtn && importCasesCoverageFile) {
      importCasesCoverageBtn.addEventListener('click', function() {
        importCasesCoverageFile.click();
      });
    }
    if (importCasesCoverageFile && typeof handlers.importCasesCoverage === 'function' && !importCasesCoverageFile.dataset.boundImport) {
      importCasesCoverageFile.dataset.boundImport = '1';
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
