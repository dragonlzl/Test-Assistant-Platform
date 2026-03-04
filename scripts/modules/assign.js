(function() {
  function init(ctx) {
    if (!ctx) return {};
    var state = ctx.state || {};
    var utils = ctx.utils || {};
    var debounce = ctx.debounce || utils.debounce || function(fn) { return fn; };
    var setStatus = ctx.setStatus || utils.setStatus || function() {};
    var updateAssignmentStatuses = ctx.updateAssignmentStatuses || function() {};
    var updateReasoningVisibility = ctx.updateReasoningVisibility || function() {};
    var renderAssignmentsSelect = ctx.renderAssignmentsSelect || function() {};
    var saveAssignments = ctx.saveAssignments || function() {};
    var testModel = ctx.testModel || function() {};
    var updateFlowStatus = ctx.updateFlowStatus || function() {};

    var dom = ctx.dom || {};
    var pick = function(node, id) { return node || document.getElementById(id); };
    var cleanModelSelect = pick(dom.cleanModelSelect, 'cleanModelSelect');
    var reviewModelSelect = pick(dom.reviewModelSelect, 'reviewModelSelect');
    var compareModelSelect = pick(dom.compareModelSelect, 'compareModelSelect');
    var splitModelSelect = pick(dom.splitModelSelect, 'splitModelSelect');
    var casesModelSelect = pick(dom.casesModelSelect, 'casesModelSelect');
    var caseGenModelSelect = pick(dom.caseGenModelSelect, 'caseGenModelSelect');
    var caseFilterModelSelect = pick(dom.caseFilterModelSelect, 'caseFilterModelSelect');
    var missingReminderModelSelect = pick(dom.missingReminderModelSelect, 'missingReminderModelSelect');
    var caseLibraryGenModelSelect = pick(dom.caseLibraryGenModelSelect, 'caseLibraryGenModelSelect');
    var cleanAssignStatus = pick(dom.cleanAssignStatus, 'cleanAssignStatus');
    var reviewAssignStatus = pick(dom.reviewAssignStatus, 'reviewAssignStatus');
    var compareAssignStatus = pick(dom.compareAssignStatus, 'compareAssignStatus');
    var splitAssignStatus = pick(dom.splitAssignStatus, 'splitAssignStatus');
    var casesAssignStatus = pick(dom.casesAssignStatus, 'casesAssignStatus');
    var caseGenAssignStatus = pick(dom.caseGenAssignStatus, 'caseGenAssignStatus');
    var caseFilterAssignStatus = pick(dom.caseFilterAssignStatus, 'caseFilterAssignStatus');
    var missingReminderAssignStatus = pick(dom.missingReminderAssignStatus, 'missingReminderAssignStatus');
    var caseLibraryGenAssignStatus = pick(dom.caseLibraryGenAssignStatus, 'caseLibraryGenAssignStatus');
    var cleanPromptEl = pick(dom.cleanPromptEl, 'cleanPrompt');
    var reviewPromptEl = pick(dom.reviewPromptEl, 'reviewPrompt');
    var comparePromptEl = pick(dom.comparePromptEl, 'comparePrompt');
    var splitPromptEl = pick(dom.splitPromptEl, 'splitPrompt');
    var casesPromptEl = pick(dom.casesPromptEl, 'casesPrompt');
    var caseGenPromptEl = pick(dom.caseGenPromptEl, 'caseGenPrompt');
    var caseFilterPromptEl = pick(dom.caseFilterPromptEl, 'caseFilterPrompt');
    var missingReminderPromptEl = pick(dom.missingReminderPromptEl, 'missingReminderPrompt');
    var caseLibraryGenPromptEl = pick(dom.caseLibraryGenPromptEl, 'caseLibraryGenPrompt');
    var cleanReasoningSelect = pick(dom.cleanReasoningSelect, 'cleanReasoning');
    var reviewReasoningSelect = pick(dom.reviewReasoningSelect, 'reviewReasoning');
    var compareReasoningSelect = pick(dom.compareReasoningSelect, 'compareReasoning');
    var splitReasoningSelect = pick(dom.splitReasoningSelect, 'splitReasoning');
    var casesReasoningSelect = pick(dom.casesReasoningSelect, 'casesReasoning');
    var caseGenReasoningSelect = pick(dom.caseGenReasoningSelect, 'caseGenReasoning');
    var caseFilterReasoningSelect = pick(dom.caseFilterReasoningSelect, 'caseFilterReasoning');
    var missingReminderReasoningSelect = pick(dom.missingReminderReasoningSelect, 'missingReminderReasoning');
    var caseLibraryGenReasoningSelect = pick(dom.caseLibraryGenReasoningSelect, 'caseLibraryGenReasoning');
    var cleanTemperatureEl = pick(dom.cleanTemperatureEl, 'cleanTemperature');
    var reviewTemperatureEl = pick(dom.reviewTemperatureEl, 'reviewTemperature');
    var compareTemperatureEl = pick(dom.compareTemperatureEl, 'compareTemperature');
    var splitTemperatureEl = pick(dom.splitTemperatureEl, 'splitTemperature');
    var casesTemperatureEl = pick(dom.casesTemperatureEl, 'casesTemperature');
    var caseGenTemperatureEl = pick(dom.caseGenTemperatureEl, 'caseGenTemperature');
    var caseFilterTemperatureEl = pick(dom.caseFilterTemperatureEl, 'caseFilterTemperature');
    var missingReminderTemperatureEl = pick(dom.missingReminderTemperatureEl, 'missingReminderTemperature');
    var caseLibraryGenTemperatureEl = pick(dom.caseLibraryGenTemperatureEl, 'caseLibraryGenTemperature');
    var globalAssignModelSelect = pick(dom.globalAssignModelSelect, 'globalAssignModelSelect');
    var applyGlobalAssignBtn = pick(dom.applyGlobalAssignBtn, 'applyGlobalAssignBtn');
    var globalAssignStatus = pick(dom.globalAssignStatus, 'globalAssignStatus');
    var assignSaveBar = pick(dom.assignSaveBar, 'assignSaveBar');
    var saveAssignmentsBtn = pick(dom.saveAssignmentsBtn, 'saveAssignments');
    var testCleanModelBtn = pick(dom.testCleanModelBtn, 'testCleanModel');
    var testReviewModelBtn = pick(dom.testReviewModelBtn, 'testReviewModel');
    var testCompareModelBtn = pick(dom.testCompareModelBtn, 'testCompareModel');
    var testSplitModelBtn = pick(dom.testSplitModelBtn, 'testSplitModel');
    var testCasesModelBtn = pick(dom.testCasesModelBtn, 'testCasesModel');
    var testCaseGenModelBtn = pick(dom.testCaseGenModelBtn, 'testCaseGenModel');
    var testCaseFilterModelBtn = pick(dom.testCaseFilterModelBtn, 'testCaseFilterModel');
    var testMissingReminderModelBtn = pick(dom.testMissingReminderModelBtn, 'testMissingReminderModel');
    var testCaseLibraryGenModelBtn = pick(dom.testCaseLibraryGenModelBtn, 'testCaseLibraryGenModel');
    var assignmentIdKeys = ['cleanId', 'reviewId', 'compareId', 'splitId', 'casesId', 'caseGenId', 'caseFilterId', 'missingReminderId', 'caseLibraryGenId'];
    var reasoningTypes = ['clean', 'review', 'compare', 'split', 'cases', 'casegen', 'casefilter', 'missingreminder', 'caselibrarygen'];

    function setAssignmentId(key, value) {
      if (!state.assignments) state.assignments = {};
      state.assignments[key] = value;
    }

    function bindModelSelect(el, key, reasoningType, statusEl) {
      if (!el) return;
      el.addEventListener('change', function() {
        setAssignmentId(key, el.value || '');
        syncGlobalAssignSelection();
        if (reasoningType) updateReasoningVisibility(reasoningType);
        // 模型下拉变更后立即保存，避免还需要手动点击“保存指派”。
        saveAssignments();
        renderAssignmentsSelect();
        updateAssignmentStatuses();
        updateFlowStatus();
      });
      if (statusEl) setStatus(statusEl, '', '');
    }

    function bindPromptInput(el, key) {
      if (!el) return;
      el.addEventListener('input', debounce(function() {
        state.assignments[key] = el.value;
      }, 300));
    }

    function bindReasoningSelect(el, key) {
      if (!el) return;
      el.addEventListener('change', function() {
        state.assignments[key] = el.value || '';
      });
    }

    function normalizeTemperature(value) {
      if (value === undefined || value === null || value === '') return 0.2;
      var num = Number(value);
      if (!Number.isFinite(num)) return 0.2;
      if (num < 0) return 0;
      if (num > 1) return 1;
      return Number(num.toFixed(2));
    }

    function bindTemperatureInput(el, key) {
      if (!el) return;
      el.addEventListener('input', function() {
        state.assignments[key] = normalizeTemperature(el.value);
      });
    }

    function syncGlobalAssignSelection() {
      if (!globalAssignModelSelect) return;
      var candidate = '';
      var mismatch = false;
      assignmentIdKeys.forEach(function(key) {
        var currentId = state.assignments && state.assignments[key] ? String(state.assignments[key]) : '';
        if (!currentId) {
          mismatch = true;
          return;
        }
        if (!candidate) {
          candidate = currentId;
        } else if (candidate !== currentId) {
          mismatch = true;
        }
      });
      globalAssignModelSelect.value = mismatch ? '' : candidate;
    }

    function applyGlobalAssignment() {
      var targetId = globalAssignModelSelect && globalAssignModelSelect.value ? String(globalAssignModelSelect.value) : '';
      if (!targetId) {
        setStatus(globalAssignStatus, '请先选择一个模型后再确认', 'warn');
        return;
      }
      assignmentIdKeys.forEach(function(key) {
        setAssignmentId(key, targetId);
      });
      if (cleanModelSelect) cleanModelSelect.value = targetId;
      if (reviewModelSelect) reviewModelSelect.value = targetId;
      if (compareModelSelect) compareModelSelect.value = targetId;
      if (splitModelSelect) splitModelSelect.value = targetId;
      if (casesModelSelect) casesModelSelect.value = targetId;
      if (caseGenModelSelect) caseGenModelSelect.value = targetId;
      if (caseFilterModelSelect) caseFilterModelSelect.value = targetId;
      if (missingReminderModelSelect) missingReminderModelSelect.value = targetId;
      if (caseLibraryGenModelSelect) caseLibraryGenModelSelect.value = targetId;
      reasoningTypes.forEach(function(type) {
        updateReasoningVisibility(type);
      });
      saveAssignments();
      renderAssignmentsSelect();
      updateFlowStatus();
      syncGlobalAssignSelection();
      if (assignSaveBar) assignSaveBar.classList.add('hidden');
      updateAssignmentStatuses();
      setStatus(globalAssignStatus, '已统一指派并保存，刷新页面后仍会保持该配置', 'ok');
    }

    bindModelSelect(cleanModelSelect, 'cleanId', 'clean', cleanAssignStatus);
    bindModelSelect(reviewModelSelect, 'reviewId', 'review', reviewAssignStatus);
    bindModelSelect(compareModelSelect, 'compareId', 'compare', compareAssignStatus);
    bindModelSelect(splitModelSelect, 'splitId', 'split', splitAssignStatus);
    bindModelSelect(casesModelSelect, 'casesId', 'cases', casesAssignStatus);
    bindModelSelect(caseFilterModelSelect, 'caseFilterId', 'casefilter', caseFilterAssignStatus);
    bindModelSelect(caseGenModelSelect, 'caseGenId', 'casegen', caseGenAssignStatus);
    bindModelSelect(missingReminderModelSelect, 'missingReminderId', 'missingreminder', missingReminderAssignStatus);
    bindModelSelect(caseLibraryGenModelSelect, 'caseLibraryGenId', 'caselibrarygen', caseLibraryGenAssignStatus);

    bindPromptInput(cleanPromptEl, 'cleanPrompt');
    bindPromptInput(reviewPromptEl, 'reviewPrompt');
    bindPromptInput(comparePromptEl, 'comparePrompt');
    bindPromptInput(splitPromptEl, 'splitPrompt');
    bindPromptInput(casesPromptEl, 'casesPrompt');
    bindPromptInput(caseGenPromptEl, 'caseGenPrompt');
    bindPromptInput(caseFilterPromptEl, 'caseFilterPrompt');
    bindPromptInput(missingReminderPromptEl, 'missingReminderPrompt');
    bindPromptInput(caseLibraryGenPromptEl, 'caseLibraryGenPrompt');

    bindReasoningSelect(cleanReasoningSelect, 'cleanReasoning');
    bindReasoningSelect(reviewReasoningSelect, 'reviewReasoning');
    bindReasoningSelect(compareReasoningSelect, 'compareReasoning');
    bindReasoningSelect(splitReasoningSelect, 'splitReasoning');
    bindReasoningSelect(casesReasoningSelect, 'casesReasoning');
    bindReasoningSelect(caseGenReasoningSelect, 'caseGenReasoning');
    bindReasoningSelect(caseFilterReasoningSelect, 'caseFilterReasoning');
    bindReasoningSelect(missingReminderReasoningSelect, 'missingReminderReasoning');
    bindReasoningSelect(caseLibraryGenReasoningSelect, 'caseLibraryGenReasoning');
    bindTemperatureInput(cleanTemperatureEl, 'cleanTemperature');
    bindTemperatureInput(reviewTemperatureEl, 'reviewTemperature');
    bindTemperatureInput(compareTemperatureEl, 'compareTemperature');
    bindTemperatureInput(splitTemperatureEl, 'splitTemperature');
    bindTemperatureInput(casesTemperatureEl, 'casesTemperature');
    bindTemperatureInput(caseGenTemperatureEl, 'caseGenTemperature');
    bindTemperatureInput(caseFilterTemperatureEl, 'caseFilterTemperature');
    bindTemperatureInput(missingReminderTemperatureEl, 'missingReminderTemperature');
    bindTemperatureInput(caseLibraryGenTemperatureEl, 'caseLibraryGenTemperature');
    if (globalAssignModelSelect) {
      globalAssignModelSelect.addEventListener('change', function() {
        setStatus(globalAssignStatus, '', '');
      });
    }
    if (applyGlobalAssignBtn) {
      applyGlobalAssignBtn.addEventListener('click', function() {
        applyGlobalAssignment();
      });
    }
    syncGlobalAssignSelection();

    if (saveAssignmentsBtn) {
      saveAssignmentsBtn.addEventListener('click', function() {
        saveAssignments();
        renderAssignmentsSelect();
        updateAssignmentStatuses();
      });
    }

    if (testCleanModelBtn && testModel) testCleanModelBtn.addEventListener('click', function() {
      testModel(cleanModelSelect ? cleanModelSelect.value : '', cleanAssignStatus, 'assign-clean');
    });
    if (testReviewModelBtn && testModel) testReviewModelBtn.addEventListener('click', function() {
      testModel(reviewModelSelect ? reviewModelSelect.value : '', reviewAssignStatus, 'assign-review');
    });
    if (testCompareModelBtn && testModel) testCompareModelBtn.addEventListener('click', function() {
      testModel(compareModelSelect ? compareModelSelect.value : '', compareAssignStatus, 'assign-compare');
    });
    if (testSplitModelBtn && testModel) testSplitModelBtn.addEventListener('click', function() {
      testModel(splitModelSelect ? splitModelSelect.value : '', splitAssignStatus, 'assign-split');
    });
    if (testCasesModelBtn && testModel) testCasesModelBtn.addEventListener('click', function() {
      testModel(casesModelSelect ? casesModelSelect.value : '', casesAssignStatus, 'assign-cases');
    });
    if (testCaseGenModelBtn && testModel) testCaseGenModelBtn.addEventListener('click', function() {
      testModel(caseGenModelSelect ? caseGenModelSelect.value : '', caseGenAssignStatus, 'assign-casegen');
    });
    if (testCaseFilterModelBtn && testModel) testCaseFilterModelBtn.addEventListener('click', function() {
      testModel(caseFilterModelSelect ? caseFilterModelSelect.value : '', caseFilterAssignStatus, 'assign-casefilter');
    });
    if (testMissingReminderModelBtn && testModel) testMissingReminderModelBtn.addEventListener('click', function() {
      testModel(missingReminderModelSelect ? missingReminderModelSelect.value : '', missingReminderAssignStatus, 'assign-missingreminder');
    });
    if (testCaseLibraryGenModelBtn && testModel) testCaseLibraryGenModelBtn.addEventListener('click', function() {
      testModel(caseLibraryGenModelSelect ? caseLibraryGenModelSelect.value : '', caseLibraryGenAssignStatus, 'assign-caselibrarygen');
    });

    return {
      bindModelSelect: bindModelSelect,
      bindPromptInput: bindPromptInput,
      bindReasoningSelect: bindReasoningSelect,
    };
  }

  window.app = window.app || {};
  window.app.assign = { init: init };
})();
