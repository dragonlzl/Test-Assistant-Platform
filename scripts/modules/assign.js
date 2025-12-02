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
    var cleanModelSelect = dom.cleanModelSelect;
    var reviewModelSelect = dom.reviewModelSelect;
    var compareModelSelect = dom.compareModelSelect;
    var splitModelSelect = dom.splitModelSelect;
    var casesModelSelect = dom.casesModelSelect;
    var caseGenModelSelect = dom.caseGenModelSelect;
    var caseFilterModelSelect = dom.caseFilterModelSelect;
    var cleanAssignStatus = dom.cleanAssignStatus;
    var reviewAssignStatus = dom.reviewAssignStatus;
    var compareAssignStatus = dom.compareAssignStatus;
    var splitAssignStatus = dom.splitAssignStatus;
    var casesAssignStatus = dom.casesAssignStatus;
    var caseGenAssignStatus = dom.caseGenAssignStatus;
    var caseFilterAssignStatus = dom.caseFilterAssignStatus;
    var cleanPromptEl = dom.cleanPromptEl;
    var reviewPromptEl = dom.reviewPromptEl;
    var comparePromptEl = dom.comparePromptEl;
    var splitPromptEl = dom.splitPromptEl;
    var casesPromptEl = dom.casesPromptEl;
    var caseGenPromptEl = dom.caseGenPromptEl;
    var caseFilterPromptEl = dom.caseFilterPromptEl;
    var cleanReasoningSelect = dom.cleanReasoningSelect;
    var reviewReasoningSelect = dom.reviewReasoningSelect;
    var compareReasoningSelect = dom.compareReasoningSelect;
    var splitReasoningSelect = dom.splitReasoningSelect;
    var casesReasoningSelect = dom.casesReasoningSelect;
    var caseGenReasoningSelect = dom.caseGenReasoningSelect;
    var caseFilterReasoningSelect = dom.caseFilterReasoningSelect;
    var saveAssignmentsBtn = dom.saveAssignmentsBtn;
    var testCleanModelBtn = dom.testCleanModelBtn;
    var testReviewModelBtn = dom.testReviewModelBtn;
    var testCompareModelBtn = dom.testCompareModelBtn;
    var testSplitModelBtn = dom.testSplitModelBtn;
    var testCasesModelBtn = dom.testCasesModelBtn;
    var testCaseGenModelBtn = dom.testCaseGenModelBtn;
    var testCaseFilterModelBtn = dom.testCaseFilterModelBtn;

    function setAssignmentId(key, value) {
      if (!state.assignments) state.assignments = {};
      state.assignments[key] = value;
    }

    function bindModelSelect(el, key, reasoningType, statusEl) {
      if (!el) return;
      el.addEventListener('change', function() {
        setAssignmentId(key, el.value || '');
        updateAssignmentStatuses();
        if (reasoningType) updateReasoningVisibility(reasoningType);
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

    bindModelSelect(cleanModelSelect, 'cleanId', 'clean', cleanAssignStatus);
    bindModelSelect(reviewModelSelect, 'reviewId', 'review', reviewAssignStatus);
    bindModelSelect(compareModelSelect, 'compareId', 'compare', compareAssignStatus);
    bindModelSelect(splitModelSelect, 'splitId', 'split', splitAssignStatus);
    bindModelSelect(casesModelSelect, 'casesId', 'cases', casesAssignStatus);
    bindModelSelect(caseFilterModelSelect, 'caseFilterId', 'casefilter', caseFilterAssignStatus);
    bindModelSelect(caseGenModelSelect, 'caseGenId', 'casegen', caseGenAssignStatus);

    bindPromptInput(cleanPromptEl, 'cleanPrompt');
    bindPromptInput(reviewPromptEl, 'reviewPrompt');
    bindPromptInput(comparePromptEl, 'comparePrompt');
    bindPromptInput(splitPromptEl, 'splitPrompt');
    bindPromptInput(casesPromptEl, 'casesPrompt');
    bindPromptInput(caseGenPromptEl, 'caseGenPrompt');
    bindPromptInput(caseFilterPromptEl, 'caseFilterPrompt');

    bindReasoningSelect(cleanReasoningSelect, 'cleanReasoning');
    bindReasoningSelect(reviewReasoningSelect, 'reviewReasoning');
    bindReasoningSelect(compareReasoningSelect, 'compareReasoning');
    bindReasoningSelect(splitReasoningSelect, 'splitReasoning');
    bindReasoningSelect(casesReasoningSelect, 'casesReasoning');
    bindReasoningSelect(caseGenReasoningSelect, 'caseGenReasoning');
    bindReasoningSelect(caseFilterReasoningSelect, 'caseFilterReasoning');

    if (saveAssignmentsBtn) {
      saveAssignmentsBtn.addEventListener('click', function() {
        saveAssignments();
        renderAssignmentsSelect();
        updateAssignmentStatuses();
      });
    }

    if (testCleanModelBtn && testModel) testCleanModelBtn.addEventListener('click', function() {
      testModel(cleanModelSelect ? cleanModelSelect.value : '', cleanAssignStatus);
    });
    if (testReviewModelBtn && testModel) testReviewModelBtn.addEventListener('click', function() {
      testModel(reviewModelSelect ? reviewModelSelect.value : '', reviewAssignStatus);
    });
    if (testCompareModelBtn && testModel) testCompareModelBtn.addEventListener('click', function() {
      testModel(compareModelSelect ? compareModelSelect.value : '', compareAssignStatus);
    });
    if (testSplitModelBtn && testModel) testSplitModelBtn.addEventListener('click', function() {
      testModel(splitModelSelect ? splitModelSelect.value : '', splitAssignStatus);
    });
    if (testCasesModelBtn && testModel) testCasesModelBtn.addEventListener('click', function() {
      testModel(casesModelSelect ? casesModelSelect.value : '', casesAssignStatus);
    });
    if (testCaseGenModelBtn && testModel) testCaseGenModelBtn.addEventListener('click', function() {
      testModel(caseGenModelSelect ? caseGenModelSelect.value : '', caseGenAssignStatus);
    });
    if (testCaseFilterModelBtn && testModel) testCaseFilterModelBtn.addEventListener('click', function() {
      testModel(caseFilterModelSelect ? caseFilterModelSelect.value : '', caseFilterAssignStatus);
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
