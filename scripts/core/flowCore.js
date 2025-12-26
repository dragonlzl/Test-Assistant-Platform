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
    var compareResultEl = pickEl(dom.compareResultEl, 'compareResult');
    var splitResultEl = pickEl(dom.splitResultEl, 'splitResult');
    var casesCompareResultEl = pickEl(dom.casesCompareResultEl, 'casesCompareResult');
    var flowNavSteps = dom.flowNavSteps || (typeof document !== 'undefined' ? document.querySelectorAll('#flowNav .step') : []);
    var flowNavStepsCompact = dom.flowNavStepsCompact
      || (typeof document !== 'undefined' ? document.querySelectorAll('#autoFlowCompact .step') : []);
    var flowNavSubsteps = dom.flowNavSubsteps
      || (typeof document !== 'undefined' ? document.querySelectorAll('.ai-flow-substep') : []);
    var runReviewBtn = pickEl(dom.runReviewBtn, 'runReview');
    var caseViewHint = pickEl(dom.caseViewHint, 'caseViewHint');
    var exportCaseGenBtn = pickEl(dom.exportCaseGenBtn, 'exportCaseGen');
    var stepStatusText = {
      pending: '未开始',
      running: '执行中',
      done: '执行完成',
      waiting: '等待确认',
      failed: '数据异常',
    };
    var stepStatusIcon = {
      pending: '▶',
      running: '↻',
      done: '✓',
      waiting: '!',
      failed: 'X',
    };
    var stepMeta = {
      import: { badge: '1', label: '导入' },
      review: { badge: '2', label: '评审' },
      clean: { badge: '3', label: '清洗' },
      compare: { badge: '4', label: '对比完整性' },
      split: { badge: '5', label: '拆分' },
      'cases-upload': { badge: '6', label: '用例导入' },
      cases: { badge: '7', label: '覆盖对比' },
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
      statusEl.style.background = '';
      statusEl.style.backgroundImage = '';
      statusEl.style.borderColor = '';
      statusEl.style.borderTopColor = '';
      statusEl.style.borderWidth = '';
      statusEl.style.boxShadow = '';
      statusEl.style.color = '';
      if (status === 'running') {
        statusEl.style.background = '#fff';
        statusEl.style.borderWidth = '2px';
        statusEl.style.borderColor = '#bfdbfe';
        statusEl.style.borderTopColor = '#2563eb';
        statusEl.style.boxShadow = '0 6px 14px rgba(37,99,235,0.25), 0 0 0 1px rgba(37,99,235,0.14)';
        statusEl.style.color = '#1d4ed8';
      } else if (status === 'waiting') {
        statusEl.style.background = 'linear-gradient(135deg, #ffedd5, #fed7aa)';
        statusEl.style.borderColor = '#fb923c';
        statusEl.style.color = '#c2410c';
        statusEl.style.boxShadow = '0 6px 14px rgba(251,146,60,0.25)';
      } else if (status === 'failed') {
        statusEl.style.background = 'linear-gradient(135deg, #fee2e2, #fecdd3)';
        statusEl.style.borderColor = '#ef4444';
        statusEl.style.color = '#991b1b';
        statusEl.style.boxShadow = '0 6px 14px rgba(248,113,113,0.28)';
      } else if (status === 'pending') {
        statusEl.style.background = 'linear-gradient(135deg, #f8fafc, #e2e8f0)';
        statusEl.style.borderColor = '#cbd5e1';
        statusEl.style.color = '#94a3b8';
      } else if (status === 'done') {
        statusEl.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        statusEl.style.borderColor = 'transparent';
        statusEl.style.boxShadow = '0 6px 14px rgba(34,197,94,0.3)';
        statusEl.style.color = '#fff';
      }
    }

    function ensureStepReason(stepEl) {
      if (!stepEl || typeof document === 'undefined') return null;
      var reasonEl = stepEl.querySelector ? stepEl.querySelector('.step-reason') : null;
      if (!reasonEl) {
        reasonEl = document.createElement('div');
        reasonEl.className = 'step-reason hidden';
        stepEl.appendChild(reasonEl);
      }
      return reasonEl;
    }

    function syncStepReason(stepEl, reason, status) {
      if (!stepEl) return;
      if (stepEl.classList && stepEl.classList.contains('no-reason')) {
        var existing = stepEl.querySelector ? stepEl.querySelector('.step-reason') : null;
        if (existing) {
          existing.textContent = '';
          existing.classList.add('hidden');
        }
        if (stepEl.classList) stepEl.classList.remove('has-reason');
        return;
      }
      var reasonEl = ensureStepReason(stepEl);
      if (!reasonEl) return;
      var shouldShow = Boolean(reason) && (status === 'waiting' || status === 'failed');
      var reasonText = shouldShow ? String(reason) : '';
      reasonEl.textContent = reasonText;
      var isShort = shouldShow && reasonText.length <= 10;
      if (reasonEl.classList) {
        reasonEl.classList.toggle('reason-short', isShort);
        reasonEl.classList.toggle('hidden', !shouldShow);
      }
      if (stepEl.classList) stepEl.classList.toggle('has-reason', shouldShow);
    }

    function updateFlowStatus() {
      var stateMap = {
        import: rawText && rawText.value.trim().length > 0,
        review: reviewResultEl ? reviewResultEl.value.trim().length > 0 : false,
        clean: cleanedTextEl && cleanedTextEl.value.trim().length > 0,
        compare: compareResultEl && compareResultEl.value.trim().length > 0,
        split: splitResultEl && splitResultEl.value.trim().length > 0,
        'cases-upload': hasCaseSource(),
        cases: casesCompareResultEl && casesCompareResultEl.value.trim().length > 0,
      };
      var runningMap = (state && state.inProgressSteps && typeof state.inProgressSteps === 'object') ? state.inProgressSteps : {};
      var waitingMap = (state && state.waitingSteps && typeof state.waitingSteps === 'object') ? state.waitingSteps : {};
      var failedMap = (state && state.failedSteps && typeof state.failedSteps === 'object') ? state.failedSteps : {};
      var validationFailedMap = (state && state.validationFailedSteps && typeof state.validationFailedSteps === 'object')
        ? state.validationFailedSteps
        : {};
      var waitingReasonMap = (state && state.waitingReasons && typeof state.waitingReasons === 'object') ? state.waitingReasons : {};
      var failedReasonMap = (state && state.failedReasons && typeof state.failedReasons === 'object') ? state.failedReasons : {};
      var validationReasonMap = (state && state.validationFailedReasons && typeof state.validationFailedReasons === 'object')
        ? state.validationFailedReasons
        : {};
      if (state.inProgressStep) runningMap[state.inProgressStep] = true;
      if (state) state.inProgressSteps = runningMap;
      if (state && (!state.waitingSteps || typeof state.waitingSteps !== 'object')) state.waitingSteps = waitingMap;
      if (state && (!state.failedSteps || typeof state.failedSteps !== 'object')) state.failedSteps = failedMap;
      if (state && (!state.validationFailedSteps || typeof state.validationFailedSteps !== 'object')) state.validationFailedSteps = validationFailedMap;
      Object.keys(waitingMap).forEach(function(key) {
        stateMap[key] = false;
      });
      Object.keys(failedMap).forEach(function(key) {
        stateMap[key] = false;
      });
      Object.keys(validationFailedMap).forEach(function(key) {
        stateMap[key] = false;
      });
      var mergedFailedMap = {};
      [failedMap, validationFailedMap].forEach(function(map) {
        Object.keys(map).forEach(function(key) {
          mergedFailedMap[key] = true;
        });
      });
      var order = ['import', 'review', 'clean', 'compare', 'split', 'cases-upload', 'cases'];
      var failedStep = order.find(function(key) { return mergedFailedMap[key]; }) || '';
      var waitingStep = order.find(function(key) { return waitingMap[key]; }) || '';
      var runningStep = order.find(function(key) { return runningMap[key]; }) || '';
      var nextPending = failedStep || waitingStep || order.find(function(key) { return !stateMap[key] && !runningMap[key]; }) || 'cases';
      var compactTarget = runningStep || failedStep || waitingStep || nextPending;
      if (runReviewBtn) {
        var rawReady = stateMap.import;
        runReviewBtn.disabled = !rawReady || runningMap.review;
      }
      function syncSteps(stepList) {
        if (!stepList || typeof stepList.forEach !== 'function') return;
        stepList.forEach(function(step) {
          var target = step.dataset ? step.dataset.target : '';
          var status = 'pending';
          var isRunning = Boolean(runningMap[target]);
          var isWaiting = Boolean(waitingMap[target]);
          var isFailed = Boolean(mergedFailedMap[target]);
          var reason = '';
          step.classList.remove('done', 'active', 'waiting', 'failed');
          if (isRunning) {
            step.classList.add('active');
            status = 'running';
            syncStepStatus(step, status);
            syncStepReason(step, '', status);
            return;
          }
          if (isWaiting) {
            step.classList.add('active');
            step.classList.add('waiting');
            status = 'waiting';
            reason = waitingReasonMap[target] || '等待处理';
            syncStepStatus(step, status);
            syncStepReason(step, reason, status);
            return;
          }
          if (isFailed) {
            step.classList.add('active');
            step.classList.add('failed');
            status = 'failed';
            reason = failedReasonMap[target] || validationReasonMap[target] || '执行失败';
            syncStepStatus(step, status);
            syncStepReason(step, reason, status);
            return;
          }
          if (stateMap[target]) step.classList.add('done');
          if (!stateMap[target] && target === nextPending) step.classList.add('active');
          if (stateMap[target]) status = 'done';
          syncStepStatus(step, status);
          syncStepReason(step, '', status);
        });
      }
      syncSteps(flowNavSteps);
      syncSteps(flowNavStepsCompact);
      if (flowNavSubsteps && typeof flowNavSubsteps.forEach === 'function') {
        var subMeta = stepMeta[compactTarget] || {};
        flowNavSubsteps.forEach(function(step) {
          if (!step) return;
          if (step.dataset) step.dataset.target = compactTarget;
          var badgeEl = step.querySelector ? step.querySelector('.badge') : null;
          if (badgeEl && subMeta.badge) badgeEl.textContent = subMeta.badge;
          var labelEl = step.querySelector ? step.querySelector('.step-label') : null;
          if (labelEl && subMeta.label) labelEl.textContent = subMeta.label;
        });
        syncSteps(flowNavSubsteps);
      }
      if (flowNavStepsCompact && typeof flowNavStepsCompact.forEach === 'function') {
        flowNavStepsCompact.forEach(function(step) {
          var target = step.dataset ? step.dataset.target : '';
          step.classList.toggle('hidden', compactTarget && target !== compactTarget);
        });
      }
    }

    function scrollToSection(target, options) {
      var behavior = options && options.behavior ? options.behavior : 'smooth';
      var waitingMap = (state && state.waitingSteps && typeof state.waitingSteps === 'object') ? state.waitingSteps : {};
      if (target === 'review' && waitingMap.review) {
        switchTab('auto');
        var clarifySection = document.querySelector('[data-section-id="auto-clarify"]');
        if (clarifySection) {
          clarifySection.classList.remove('hidden');
          persistCardExpanded(clarifySection);
          scrollElementIntoView(clarifySection, behavior, 240);
        }
        return;
      }
      if (target === 'compare' && waitingMap.compare) {
        switchTab('auto');
        var autoCompareSection = document.querySelector('[data-section-id="auto-compare"]');
        if (autoCompareSection) {
          autoCompareSection.classList.remove('hidden');
          persistCardExpanded(autoCompareSection);
          scrollElementIntoView(autoCompareSection, behavior, 240);
        }
        return;
      }
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
