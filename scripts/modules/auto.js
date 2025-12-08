(function() {
  function init(ctx) {
    if (!ctx) return;
    var state = ctx.state || {};
    var core = ctx.core || {};
    var setStatus = ctx.setStatus || core.setStatus || function() {};
    var handlers = ctx.handlers || {};
    var runAutoWorkflow = handlers.runAutoWorkflow || function() {};
    var runAutoWorkflowFromClean = handlers.runAutoWorkflowFromClean || function() {};
    var continueAutoWorkflowAfterCoverage = handlers.continueAutoWorkflowAfterCoverage || function() {};
    var toggleAutoMissingView = handlers.toggleAutoMissingView || function() {};
    var copyAutoMissingJson = handlers.copyAutoMissingJson || function() {};
    var smartFillMissingSuggestions = handlers.smartFillMissingSuggestions || function() {};
    var handleMissingSelectionChange = handlers.handleMissingSelectionChange || function() {};
    var handleMissingSelectAll = handlers.handleMissingSelectAll || function() {};
    var renderAutoCompareMissingView = handlers.renderAutoCompareMissingView || function() {};
    var toggleAutoCompareMissingView = handlers.toggleAutoCompareMissingView || function() {};
    var buildFilteredComparePayload = handlers.buildFilteredComparePayload || function() { return null; };
    var updateAutoCompareActions = handlers.updateAutoCompareActions || function() {};
    var syncAutoCompareStatus = handlers.syncAutoCompareStatus || function() { return null; };
    var resetAutoCompareMissingView = handlers.resetAutoCompareMissingView || function() {};
    var resetAutoCompareUserInputs = handlers.resetAutoCompareUserInputs || function() {};
    var jumpToCleanHighlightView = handlers.jumpToCleanHighlightView || function() {};
    var enforceAutoCoverageRequirement = handlers.enforceAutoCoverageRequirement || function() { return Promise.resolve(); };
    var executeAutoWorkflowSteps = handlers.executeAutoWorkflowSteps || function() { return Promise.resolve(); };

    var dom = ctx.dom || {};
    var pickEl = function(el, id, selector) {
      if (el) return el;
      if (selector && typeof document !== 'undefined') return document.querySelector(selector);
      if (id && typeof document !== 'undefined') return document.getElementById(id);
      return null;
    };
    var autoWorkflowBtn = pickEl(dom.autoWorkflowBtn, 'runAutoWorkflow');
    var autoRecleanBtn = pickEl(dom.autoRecleanBtn, 'autoRecleanBtn');
    var autoIgnoreCoverageBtn = pickEl(dom.autoIgnoreCoverageBtn, 'autoIgnoreCoverageBtn');
    var autoMissingToggle = pickEl(dom.autoMissingToggle, 'autoMissingToggle');
    var autoMissingCopy = pickEl(dom.autoMissingCopy, 'autoMissingCopy');
    var autoMissingSmartFillBtn = pickEl(dom.autoMissingSmartFillBtn, 'autoMissingSmartFill');
    var autoMissingView = pickEl(dom.autoMissingView, 'autoMissingView');
    var autoCompareMissing = pickEl(dom.autoCompareMissing, 'autoCompareMissing');
    var autoCompareMissingToggle = pickEl(dom.autoCompareMissingToggle, 'autoCompareMissingToggle');
    var autoCompareSuggestionInput = pickEl(dom.autoCompareSuggestionInput, 'autoCompareSuggestion');
    var autoFillCleanBtn = pickEl(dom.autoFillCleanBtn, 'autoFillCleanBtn');
    var autoJumpCleanViewBtn = pickEl(dom.autoJumpCleanViewBtn, 'autoJumpCleanView');
    var autoRecleanStatus = pickEl(dom.autoRecleanStatus, 'autoRecleanStatus');
    var autoCompareStatus = pickEl(dom.autoCompareStatus, 'autoCompareStatus');
    var autoWorkflowStatus = pickEl(dom.autoWorkflowStatus, 'autoWorkflowStatus');
    var autoClarifyToggle = pickEl(dom.autoClarifyToggle, 'autoNeedClarify');
    var autoClarifySection = pickEl(dom.autoClarifySection, null, '[data-section-id=\"auto-clarify\"]');

    if (!state.autoCompareSelections) state.autoCompareSelections = new Set();
    if (!state.autoCompareMissingList) state.autoCompareMissingList = [];

    if (autoWorkflowBtn) {
      autoWorkflowBtn.addEventListener('click', function() {
        runAutoWorkflow();
      });
    }
    if (autoRecleanBtn) {
      autoRecleanBtn.addEventListener('click', function() {
        runAutoWorkflowFromClean({ mode: 'reclean' });
      });
    }
    if (autoIgnoreCoverageBtn) {
      autoIgnoreCoverageBtn.addEventListener('click', function() {
        continueAutoWorkflowAfterCoverage();
      });
    }
    if (autoMissingToggle) {
      autoMissingToggle.addEventListener('click', function() {
        toggleAutoMissingView();
      });
    }
    if (autoMissingCopy) {
      autoMissingCopy.addEventListener('click', function() {
        copyAutoMissingJson();
      });
    }
    if (autoMissingSmartFillBtn) {
      autoMissingSmartFillBtn.addEventListener('click', function() {
        smartFillMissingSuggestions();
      });
    }
    if (autoMissingView) {
      autoMissingView.addEventListener('change', function(e) {
        var target = e.target;
        if (!target) return;
        if (target.dataset.autoMissingIndex !== undefined) {
          handleMissingSelectionChange(Number(target.dataset.autoMissingIndex), target.checked);
        } else if (target.dataset.autoMissingSelectAll !== undefined) {
          handleMissingSelectAll(target.checked);
          autoMissingView.querySelectorAll('input[data-auto-missing-index]').forEach(function(cb) {
            cb.checked = target.checked;
          });
        }
      });
    }
    if (autoCompareMissingToggle) {
      autoCompareMissingToggle.addEventListener('click', function() {
        toggleAutoCompareMissingView();
      });
    }
    if (autoCompareMissing) {
      autoCompareMissing.addEventListener('change', function(e) {
        var target = e.target;
        if (!target) return;
        if (target.dataset.autoCompareSelectAll !== undefined) {
          var checked = target.checked;
          state.autoCompareSelectionTouched = true;
          state.autoCompareSelections = checked
            ? new Set((state.autoCompareMissingList || []).map(function(_, idx) { return idx; }))
            : new Set();
          renderAutoCompareMissingView(state.autoCompareMissingList, undefined, true);
          return;
        }
        if (target.dataset.autoCompareIndex !== undefined) {
          var idx = Number(target.dataset.autoCompareIndex);
          if (!Number.isFinite(idx)) return;
          state.autoCompareSelectionTouched = true;
          if (target.checked) {
            state.autoCompareSelections.add(idx);
          } else {
            state.autoCompareSelections.delete(idx);
          }
          renderAutoCompareMissingView(state.autoCompareMissingList, undefined, true);
        }
      });
    }
    if (autoCompareSuggestionInput) {
      autoCompareSuggestionInput.value = state.autoCompareSuggestion || '';
      autoCompareSuggestionInput.addEventListener('input', function() {
        state.autoCompareSuggestion = autoCompareSuggestionInput.value;
        updateAutoCompareActions();
      });
    }
    if (autoFillCleanBtn) {
      autoFillCleanBtn.addEventListener('click', async function() {
        if (autoFillCleanBtn.disabled) return;
        if (state.autoRunning) {
          setStatus(autoRecleanStatus, '当前已有执行任务，请稍候', 'warn');
          return;
        }
        var comparePayload = buildFilteredComparePayload();
        var suggestionText = state.autoCompareSuggestion ? state.autoCompareSuggestion.trim() : '';
        if (!comparePayload && !suggestionText) {
          setStatus(autoRecleanStatus, '请先勾选缺失项或输入补充说明', 'warn');
          return;
        }
        await runAutoWorkflowFromClean({
          compareOverride: comparePayload,
          suggestion: suggestionText,
          mode: 'supplement',
          startMessage: '正在根据缺失项补全清洗并继续…',
          workflowStartMessage: '正在补全过程并重新执行剩余步骤，请勿关闭页面',
          successMessage: '补全清洗并继续完成',
          workflowSuccessMessage: '补全过程完成，已重新执行剩余步骤',
          failureMessage: '补全清洗并继续中断',
          workflowFailureMessage: '补全清洗并继续中断',
        });
      });
    }
    if (autoJumpCleanViewBtn && jumpToCleanHighlightView) {
      autoJumpCleanViewBtn.addEventListener('click', function() {
        if (autoJumpCleanViewBtn.disabled) return;
        jumpToCleanHighlightView();
      });
    }

    syncAutoCompareStatus();

    return {
      resetAutoCompareMissingView: resetAutoCompareMissingView,
      resetAutoCompareUserInputs: resetAutoCompareUserInputs,
      renderAutoCompareMissingView: renderAutoCompareMissingView,
      buildFilteredComparePayload: buildFilteredComparePayload,
      updateAutoCompareActions: updateAutoCompareActions,
      syncAutoCompareStatus: syncAutoCompareStatus,
      runAutoWorkflow: runAutoWorkflow,
      runAutoWorkflowFromClean: runAutoWorkflowFromClean,
      continueAutoWorkflowAfterCoverage: continueAutoWorkflowAfterCoverage,
      executeAutoWorkflowSteps: executeAutoWorkflowSteps,
      enforceAutoCoverageRequirement: enforceAutoCoverageRequirement,
    };
  }

  window.app = window.app || {};
  window.app.auto = { init: init };
})();
