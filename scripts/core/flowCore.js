(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var pickEl = function(el, id, selector) {
      if (el) return el;
      if (selector && typeof document !== 'undefined') return document.querySelector(selector);
      if (typeof document !== 'undefined' && id) return document.getElementById(id);
      return null;
    };
    var handlers = ctx.handlers || {};

    var rawText = pickEl(dom.rawText, 'rawText');
    var reviewResultEl = pickEl(dom.reviewResultEl, 'reviewResult');
    var cleanedTextEl = pickEl(dom.cleanedTextEl, 'cleanedText');
    var splitResultEl = pickEl(dom.splitResultEl, 'splitResult');
    var casesCompareResultEl = pickEl(dom.casesCompareResultEl, 'casesCompareResult');
    var flowNavSteps = dom.flowNavSteps || (typeof document !== 'undefined' ? document.querySelectorAll('#flowNav .step') : []);
    var runReviewBtn = pickEl(dom.runReviewBtn, 'runReview');
    var caseViewHint = pickEl(dom.caseViewHint, 'caseViewHint');
    var exportCaseGenBtn = pickEl(dom.exportCaseGenBtn, 'exportCaseGen');
    var stepStatusText = {
      pending: '未开始',
      running: '执行中',
      done: '执行完成',
    };
    var stepStatusIcon = {
      pending: '•',
      running: '↻',
      done: '✓',
    };

    var switchTab = handlers.switchTab || function() {};
    var scrollElementIntoView = handlers.scrollElementIntoView || function() {};
    var hasCaseSource = handlers.hasCaseSource || function() { return false; };

    function setCaseViewHint(text) {
      if (!caseViewHint) return;
      caseViewHint.textContent = text || '';
      caseViewHint.classList.toggle('hidden', !text);
    }

    function persistCardExpanded(section) {
      if (!section) return;
      section.classList.remove('collapsed');
      var store = window.app && window.app.cardCollapseStore;
      if (store && typeof store.setBySectionId === 'function') {
        var key = section.dataset && section.dataset.sectionId ? section.dataset.sectionId : '';
        if (key) store.setBySectionId(key, false);
      }
    }

    function refreshExportCaseGenButton() {
      if (!exportCaseGenBtn) return;
      var hasResult = Array.isArray(state.caseGenModules) && state.caseGenModules.some(function(mod) {
        var content = (state.caseGenResults[mod.id] || '').trim();
        return Boolean(content && !/^\[\s*\]$/.test(content));
      });
      exportCaseGenBtn.disabled = !hasResult;
    }

    function syncStepStatus(stepEl, status) {
      if (!stepEl) return;
      var statusEl = stepEl.querySelector ? stepEl.querySelector('.step-status') : null;
      if (!statusEl) return;
      statusEl.setAttribute('data-status', status);
      statusEl.textContent = stepStatusIcon[status] || '';
      var label = stepStatusText[status] || '';
      if (label) {
        statusEl.setAttribute('title', label);
        statusEl.setAttribute('aria-label', label);
      } else {
        statusEl.removeAttribute('title');
        statusEl.removeAttribute('aria-label');
      }
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
          var status = 'pending';
          if (target === state.inProgressStep) {
            step.classList.add('active');
            status = 'running';
            syncStepStatus(step, status);
            return;
          }
          if (stateMap[target]) step.classList.add('done');
          if (target === next) step.classList.add('active');
          if (stateMap[target]) status = 'done';
          syncStepStatus(step, status);
        });
      }
    }

    function scrollToSection(target, options) {
      var behavior = options && options.behavior ? options.behavior : 'smooth';
      if (target === 'cases') {
        ['cases-upload', 'cases'].forEach(function(id) {
          var sectionEl = document.querySelector('[data-section-id="' + id + '"]');
          persistCardExpanded(sectionEl);
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
          persistCardExpanded(sectionUpload);
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
          persistCardExpanded(autoSection);
          scrollElementIntoView(autoSection, behavior, 240);
        }
        return;
      }
      var section = document.querySelector('[data-section-id="' + target + '"]');
      if (section) {
        switchTab('clean');
        persistCardExpanded(section);
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
