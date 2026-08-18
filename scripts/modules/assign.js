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
    var showCenterToast = ctx.showCenterToast || utils.showCenterToast || function() {};

    var dom = ctx.dom || {};
    var pick = function(node, id) { return node || document.getElementById(id); };
    var xmindCaseGenModelSelect = pick(dom.xmindCaseGenModelSelect, 'xmindCaseGenModelSelect');
    var caseFilterModelSelect = pick(dom.caseFilterModelSelect, 'caseFilterModelSelect');
    var missingReminderModelSelect = pick(dom.missingReminderModelSelect, 'missingReminderModelSelect');
    var caseLibraryGenModelSelect = pick(dom.caseLibraryGenModelSelect, 'caseLibraryGenModelSelect');
    var xmindCaseGenAssignStatus = pick(dom.xmindCaseGenAssignStatus, 'xmindCaseGenAssignStatus');
    var caseFilterAssignStatus = pick(dom.caseFilterAssignStatus, 'caseFilterAssignStatus');
    var missingReminderAssignStatus = pick(dom.missingReminderAssignStatus, 'missingReminderAssignStatus');
    var caseLibraryGenAssignStatus = pick(dom.caseLibraryGenAssignStatus, 'caseLibraryGenAssignStatus');
    var xmindCaseGenPromptEl = pick(dom.xmindCaseGenPromptEl, 'xmindCaseGenPrompt');
    var caseFilterPromptEl = pick(dom.caseFilterPromptEl, 'caseFilterPrompt');
    var missingReminderPromptEl = pick(dom.missingReminderPromptEl, 'missingReminderPrompt');
    var caseLibraryGenPromptEl = pick(dom.caseLibraryGenPromptEl, 'caseLibraryGenPrompt');
    var xmindCaseGenReasoningSelect = pick(dom.xmindCaseGenReasoningSelect, 'xmindCaseGenReasoning');
    var caseFilterReasoningSelect = pick(dom.caseFilterReasoningSelect, 'caseFilterReasoning');
    var missingReminderReasoningSelect = pick(dom.missingReminderReasoningSelect, 'missingReminderReasoning');
    var caseLibraryGenReasoningSelect = pick(dom.caseLibraryGenReasoningSelect, 'caseLibraryGenReasoning');
    var xmindCaseGenTemperatureEl = pick(dom.xmindCaseGenTemperatureEl, 'xmindCaseGenTemperature');
    var caseFilterTemperatureEl = pick(dom.caseFilterTemperatureEl, 'caseFilterTemperature');
    var missingReminderTemperatureEl = pick(dom.missingReminderTemperatureEl, 'missingReminderTemperature');
    var caseLibraryGenTemperatureEl = pick(dom.caseLibraryGenTemperatureEl, 'caseLibraryGenTemperature');
    var globalAssignModelSelect = pick(dom.globalAssignModelSelect, 'globalAssignModelSelect');
    var applyGlobalAssignBtn = pick(dom.applyGlobalAssignBtn, 'applyGlobalAssignBtn');
    var globalAssignStatus = pick(dom.globalAssignStatus, 'globalAssignStatus');
    var assignSaveBar = pick(dom.assignSaveBar, 'assignSaveBar');
    var saveAssignmentsBtn = pick(dom.saveAssignmentsBtn, 'saveAssignments');
    var testXmindCaseGenModelBtn = pick(dom.testXmindCaseGenModelBtn, 'testXmindCaseGenModel');
    var testCaseFilterModelBtn = pick(dom.testCaseFilterModelBtn, 'testCaseFilterModel');
    var testMissingReminderModelBtn = pick(dom.testMissingReminderModelBtn, 'testMissingReminderModel');
    var testCaseLibraryGenModelBtn = pick(dom.testCaseLibraryGenModelBtn, 'testCaseLibraryGenModel');
    var assignmentIdKeys = ['xmindCaseGenId', 'caseFilterId', 'missingReminderId', 'caseLibraryGenId'];
    var reasoningTypes = ['xmindcasegen', 'casefilter', 'missingreminder', 'caselibrarygen'];

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

    function showAssignmentSavedToast() {
      showCenterToast('指派已保存', 'ok', 3000);
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
      if (xmindCaseGenModelSelect) xmindCaseGenModelSelect.value = targetId;
      if (caseFilterModelSelect) caseFilterModelSelect.value = targetId;
      if (missingReminderModelSelect) missingReminderModelSelect.value = targetId;
      if (caseLibraryGenModelSelect) caseLibraryGenModelSelect.value = targetId;
      reasoningTypes.forEach(function(type) {
        updateReasoningVisibility(type);
      });
      saveAssignments();
      renderAssignmentsSelect();
      syncGlobalAssignSelection();
      if (assignSaveBar) assignSaveBar.classList.add('hidden');
      updateAssignmentStatuses();
      setStatus(globalAssignStatus, '已统一指派并保存，刷新页面后仍会保持该配置', 'ok');
    }

    bindModelSelect(caseFilterModelSelect, 'caseFilterId', 'casefilter', caseFilterAssignStatus);
    bindModelSelect(xmindCaseGenModelSelect, 'xmindCaseGenId', 'xmindcasegen', xmindCaseGenAssignStatus);
    bindModelSelect(missingReminderModelSelect, 'missingReminderId', 'missingreminder', missingReminderAssignStatus);
    bindModelSelect(caseLibraryGenModelSelect, 'caseLibraryGenId', 'caselibrarygen', caseLibraryGenAssignStatus);

    bindPromptInput(xmindCaseGenPromptEl, 'xmindCaseGenPrompt');
    bindPromptInput(caseFilterPromptEl, 'caseFilterPrompt');
    bindPromptInput(missingReminderPromptEl, 'missingReminderPrompt');
    bindPromptInput(caseLibraryGenPromptEl, 'caseLibraryGenPrompt');

    bindReasoningSelect(xmindCaseGenReasoningSelect, 'xmindCaseGenReasoning');
    bindReasoningSelect(caseFilterReasoningSelect, 'caseFilterReasoning');
    bindReasoningSelect(missingReminderReasoningSelect, 'missingReminderReasoning');
    bindReasoningSelect(caseLibraryGenReasoningSelect, 'caseLibraryGenReasoning');
    bindTemperatureInput(xmindCaseGenTemperatureEl, 'xmindCaseGenTemperature');
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
        showAssignmentSavedToast();
      });
    }

    if (testXmindCaseGenModelBtn && testModel) testXmindCaseGenModelBtn.addEventListener('click', function() {
      testModel(xmindCaseGenModelSelect ? xmindCaseGenModelSelect.value : '', xmindCaseGenAssignStatus);
    });
    if (testCaseFilterModelBtn && testModel) testCaseFilterModelBtn.addEventListener('click', function() {
      testModel(caseFilterModelSelect ? caseFilterModelSelect.value : '', caseFilterAssignStatus);
    });
    if (testMissingReminderModelBtn && testModel) testMissingReminderModelBtn.addEventListener('click', function() {
      testModel(missingReminderModelSelect ? missingReminderModelSelect.value : '', missingReminderAssignStatus);
    });
    if (testCaseLibraryGenModelBtn && testModel) testCaseLibraryGenModelBtn.addEventListener('click', function() {
      testModel(caseLibraryGenModelSelect ? caseLibraryGenModelSelect.value : '', caseLibraryGenAssignStatus);
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
