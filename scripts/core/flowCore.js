(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var handlers = ctx.handlers || {};

    var rawText = dom.rawText;
    var reviewResultEl = dom.reviewResultEl;
    var cleanedTextEl = dom.cleanedTextEl;
    var splitResultEl = dom.splitResultEl;
    var casesCompareResultEl = dom.casesCompareResultEl;
    var flowNavSteps = dom.flowNavSteps || [];
    var runReviewBtn = dom.runReviewBtn;
    var caseViewHint = dom.caseViewHint;
    var exportCaseGenBtn = dom.exportCaseGenBtn;

    var switchTab = handlers.switchTab || function() {};
    var scrollElementIntoView = handlers.scrollElementIntoView || function() {};
    var hasCaseSource = handlers.hasCaseSource || function() { return false; };

    function setCaseViewHint(text) {
      if (!caseViewHint) return;
      caseViewHint.textContent = text || '';
      caseViewHint.classList.toggle('hidden', !text);
    }

    function refreshExportCaseGenButton() {
      if (!exportCaseGenBtn) return;
      var hasResult = Array.isArray(state.caseGenModules) && state.caseGenModules.some(function(mod) {
        var content = (state.caseGenResults[mod.id] || '').trim();
        return Boolean(content && !/^\[\s*\]$/.test(content));
      });
      exportCaseGenBtn.disabled = !hasResult;
    }

    function updateFlowStatus() {
      var stateMap = {
        import: rawText && rawText.value.trim().length > 0,
        review: reviewResultEl ? reviewResultEl.value.trim().length > 0 : false,
        clean: cleanedTextEl && cleanedTextEl.value.trim().length > 0,
        split: splitResultEl && splitResultEl.value.trim().length > 0,
        'cases-upload': hasCaseSource(),
        cases: casesCompareResultEl && casesCompareResultEl.value.trim().length > 0,
      };
      if (state.inProgressStep) stateMap[state.inProgressStep] = false;
      var order = ['import', 'review', 'clean', 'split', 'cases-upload', 'cases'];
      var next = state.inProgressStep || order.find(function(key) { return !stateMap[key]; }) || 'cases';
      if (runReviewBtn) {
        var rawReady = stateMap.import;
        runReviewBtn.disabled = !rawReady || state.inProgressStep === 'review';
      }
      if (flowNavSteps && typeof flowNavSteps.forEach === 'function') {
        flowNavSteps.forEach(function(step) {
          var target = step.dataset ? step.dataset.target : '';
          step.classList.remove('done', 'active');
          if (target === state.inProgressStep) {
            step.classList.add('active');
            return;
          }
          if (stateMap[target]) step.classList.add('done');
          if (target === next) step.classList.add('active');
        });
      }
    }

    function scrollToSection(target, options) {
      var behavior = options && options.behavior ? options.behavior : 'smooth';
      if (target === 'cases') {
        ['cases-upload', 'cases'].forEach(function(id) {
          var sectionEl = document.querySelector('[data-section-id="' + id + '"]');
          if (sectionEl) sectionEl.classList.remove('collapsed');
        });
        switchTab('clean');
        var sectionCoverage = document.querySelector('[data-section-id="cases"]');
        if (sectionCoverage) {
          scrollElementIntoView(sectionCoverage, behavior);
          return;
        }
      }
      if (target === 'cases-upload') {
        switchTab('clean');
        var sectionUpload = document.querySelector('[data-section-id="cases-upload"]');
        if (sectionUpload) {
          sectionUpload.classList.remove('collapsed');
          sectionUpload.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      if (target === 'casesgen') {
        switchTab('casesgen');
        var caseGenSection = document.querySelector('[data-section-id="casesgen"]');
        if (caseGenSection) {
          caseGenSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      if (target === 'auto-import') {
        switchTab('auto');
        var autoSection = document.querySelector('[data-section-id="auto-import"]');
        if (autoSection) {
          autoSection.classList.remove('collapsed');
          scrollElementIntoView(autoSection, behavior, 240);
        }
        return;
      }
      var section = document.querySelector('[data-section-id="' + target + '"]');
      if (section) {
        switchTab('clean');
        section.classList.remove('collapsed');
        scrollElementIntoView(section, behavior);
      }
    }

    return {
      setCaseViewHint: setCaseViewHint,
      refreshExportCaseGenButton: refreshExportCaseGenButton,
      updateFlowStatus: updateFlowStatus,
      scrollToSection: scrollToSection,
    };
  }

  window.app = window.app || {};
  window.app.flowCore = { init: init };
})();
