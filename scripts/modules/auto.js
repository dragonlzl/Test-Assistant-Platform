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
    var toggleAutoCompareView = handlers.toggleAutoCompareView || function() {};
    var buildFilteredComparePayload = handlers.buildFilteredComparePayload || function() { return null; };
    var updateAutoCompareActions = handlers.updateAutoCompareActions || function() {};
    var syncAutoCompareStatus = handlers.syncAutoCompareStatus || function() { return null; };
    var persistWorkflowState = handlers.persistWorkflowState || function() {};
    var resetAutoCompareMissingView = handlers.resetAutoCompareMissingView || function() {};
    var resetAutoCompareUserInputs = handlers.resetAutoCompareUserInputs || function() {};
    var jumpToCleanHighlightView = handlers.jumpToCleanHighlightView || function() {};
    var enforceAutoCoverageRequirement = handlers.enforceAutoCoverageRequirement || function() { return Promise.resolve(); };
    var executeAutoWorkflowSteps = handlers.executeAutoWorkflowSteps || function() { return Promise.resolve(); };
    var stopAgentWorkflow = handlers.stopAgentWorkflow || function() {};

    var dom = ctx.dom || {};
    var pickEl = function(el, id, selector) {
      if (el) return el;
      if (selector && typeof document !== 'undefined') return document.querySelector(selector);
      if (id && typeof document !== 'undefined') return document.getElementById(id);
      return null;
    };
    var autoWorkflowBtn = pickEl(dom.autoWorkflowBtn, 'runAutoWorkflow');
    var autoAgentStopBtn = pickEl(dom.autoAgentStopBtn, 'autoAgentStopBtn');
    var autoRecleanBtn = pickEl(dom.autoRecleanBtn, 'autoRecleanBtn');
    var autoIgnoreCoverageBtn = pickEl(dom.autoIgnoreCoverageBtn, 'autoIgnoreCoverageBtn');
    var autoMissingToggle = pickEl(dom.autoMissingToggle, 'autoMissingToggle');
    var autoMissingCopy = pickEl(dom.autoMissingCopy, 'autoMissingCopy');
    var autoMissingSmartFillBtn = pickEl(dom.autoMissingSmartFillBtn, 'autoMissingSmartFill');
    var autoMissingView = pickEl(dom.autoMissingView, 'autoMissingView');
    var autoCompareToggleBtn = pickEl(dom.autoCompareToggleBtn, 'autoCompareToggleBtn');
    var autoCompareMissing = pickEl(dom.autoCompareMissing, 'autoCompareMissing');
    var autoCompareSuggestionInput = pickEl(dom.autoCompareSuggestionInput, 'autoCompareSuggestion');
    var autoAgentPromptHintInput = pickEl(dom.autoAgentPromptHintInput, 'autoAgentPromptHint');
    var autoFillCleanBtn = pickEl(dom.autoFillCleanBtn, 'autoFillCleanBtn');
    var autoJumpCleanViewBtn = pickEl(dom.autoJumpCleanViewBtn, 'autoJumpCleanView');
    var autoRecleanStatus = pickEl(dom.autoRecleanStatus, 'autoRecleanStatus');
    var autoCompareStatus = pickEl(dom.autoCompareStatus, 'autoCompareStatus');
    var autoWorkflowStatus = pickEl(dom.autoWorkflowStatus, 'autoWorkflowStatus');
    var autoClarifyToggle = pickEl(dom.autoClarifyToggle, 'autoNeedClarify');
    var autoClarifySection = pickEl(dom.autoClarifySection, null, '[data-section-id=\"auto-clarify\"]');

    if (!state.autoCompareSelections) state.autoCompareSelections = new Set();
    if (!state.autoCompareMissingList) state.autoCompareMissingList = [];

    function isCaseGenAgentEnabled() {
      var settings = state.settings || {};
      var raw = settings.caseGenAgentEnabled;
      if (raw === true) return true;
      return String(raw || '').toLowerCase() === 'on';
    }

    function isAgentCoverageWaiting() {
      return Boolean(isCaseGenAgentEnabled() && state.waitingSteps && state.waitingSteps.compare);
    }

    function hasAutoCompareSelection() {
      var list = state.autoCompareMissingList || [];
      if (!list.length) return false;
      if (!state.autoCompareSelectionTouched) return true;
      return Boolean(state.autoCompareSelections && state.autoCompareSelections.size);
    }

    function isMeaningfulAgentInput(text) {
      var trimmed = String(text || '').replace(/\s+/g, '');
      if (!trimmed) return false;
      var meaningful = trimmed.match(/[\u4e00-\u9fffA-Za-z0-9]/g) || [];
      if (meaningful.length < 4) return false;
      if (!/[\u4e00-\u9fffA-Za-z]/.test(trimmed)) return false;
      if (meaningful.length >= 6) {
        var uniq = {};
        for (var i = 0; i < meaningful.length; i += 1) {
          uniq[meaningful[i]] = true;
        }
        if (Object.keys(uniq).length <= 2) return false;
      }
      var symbolCount = trimmed.length - meaningful.length;
      if (trimmed.length >= 8 && symbolCount / trimmed.length > 0.6) return false;
      return true;
    }

    function validateAgentSupplementInput(selectionAvailable, suggestionText) {
      var suggestion = String(suggestionText || '').trim();
      if (!selectionAvailable && !suggestion) {
        return { ok: false, reason: '补全清洗前请先勾选缺失项或输入补充说明' };
      }
      if (suggestion && !isMeaningfulAgentInput(suggestion)) {
        return { ok: false, reason: '补充说明过于零散，请确认输入内容合法且不为空' };
      }
      return { ok: true, reason: '' };
    }

    if (autoWorkflowBtn) {
      autoWorkflowBtn.addEventListener('click', function() {
        runAutoWorkflow();
      });
    }
    if (autoAgentStopBtn) {
      autoAgentStopBtn.addEventListener('click', function() {
        stopAgentWorkflow();
      });
    }
    if (autoRecleanBtn) {
      autoRecleanBtn.addEventListener('click', function() {
        runAutoWorkflowFromClean({
          mode: 'reclean',
          coverageAction: isAgentCoverageWaiting() ? 'reclean' : ''
        });
      });
    }
    if (autoIgnoreCoverageBtn) {
      autoIgnoreCoverageBtn.addEventListener('click', function() {
        continueAutoWorkflowAfterCoverage({
          coverageAction: isAgentCoverageWaiting() ? 'ignore' : ''
        });
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
    if (autoCompareToggleBtn) {
      autoCompareToggleBtn.addEventListener('click', function() {
        toggleAutoCompareView();
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
          renderAutoCompareMissingView(state.autoCompareMissingList, undefined, true, false);
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
          renderAutoCompareMissingView(state.autoCompareMissingList, undefined, true, false);
        }
      });
    }
    if (autoCompareSuggestionInput) {
      autoCompareSuggestionInput.value = state.autoCompareSuggestion || '';
      autoCompareSuggestionInput.addEventListener('input', function() {
        state.autoCompareSuggestion = autoCompareSuggestionInput.value;
        updateAutoCompareActions();
        persistWorkflowState();
      });
    }
    if (autoAgentPromptHintInput) {
      autoAgentPromptHintInput.value = typeof state.autoAgentPromptHint === 'string' ? state.autoAgentPromptHint : '';
      autoAgentPromptHintInput.addEventListener('input', function() {
        state.autoAgentPromptHint = autoAgentPromptHintInput.value;
        state.caseGenAgentPromptRouting = null;
        state.caseGenAgentFlowStopNote = '';
        persistWorkflowState();
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
        if (isAgentCoverageWaiting()) {
          var validation = validateAgentSupplementInput(hasAutoCompareSelection(), suggestionText);
          if (!validation.ok) {
            setStatus(autoRecleanStatus, validation.reason, 'warn');
            return;
          }
        }
        if (!comparePayload && !suggestionText) {
          setStatus(autoRecleanStatus, '请先勾选缺失项或输入补充说明', 'warn');
          return;
        }
        await runAutoWorkflowFromClean({
          compareOverride: comparePayload,
          suggestion: suggestionText,
          mode: 'supplement',
          coverageAction: isAgentCoverageWaiting() ? 'supplement' : '',
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

    syncAutoCompareStatus(false);

    return {
      resetAutoCompareMissingView: resetAutoCompareMissingView,
      resetAutoCompareUserInputs: resetAutoCompareUserInputs,
      renderAutoCompareMissingView: renderAutoCompareMissingView,
      toggleAutoCompareView: toggleAutoCompareView,
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
