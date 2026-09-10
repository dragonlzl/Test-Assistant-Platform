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
    var globalAssignModelSelect = pick(dom.globalAssignModelSelect, 'globalAssignModelSelect');
    var globalAssignReasoning = pick(dom.globalAssignReasoning, 'globalAssignReasoning');
    var applyGlobalAssignBtn = pick(dom.applyGlobalAssignBtn, 'applyGlobalAssignBtn');
    var globalAssignStatus = pick(dom.globalAssignStatus, 'globalAssignStatus');
    var assignSaveBar = pick(dom.assignSaveBar, 'assignSaveBar');
    var saveAssignmentsBtns = document.querySelectorAll('[data-save-assignments]');
    var testXmindCaseGenModelBtn = pick(dom.testXmindCaseGenModelBtn, 'testXmindCaseGenModel');
    var testCaseFilterModelBtn = pick(dom.testCaseFilterModelBtn, 'testCaseFilterModel');
    var testMissingReminderModelBtn = pick(dom.testMissingReminderModelBtn, 'testMissingReminderModel');
    var testCaseLibraryGenModelBtn = pick(dom.testCaseLibraryGenModelBtn, 'testCaseLibraryGenModel');
    var assignmentHead = pick(dom.assignmentHead, 'assignmentHead');
    var assignmentNavButtons = document.querySelectorAll('[data-assignment-target]');
    var assignmentIdKeys = ['xmindCaseGenId', 'caseFilterId', 'missingReminderId', 'caseLibraryGenId'];
    var reasoningTypes = ['xmindcasegen', 'casefilter', 'missingreminder', 'caselibrarygen'];

    function decorateAssignmentNavigation() {
      var icons = window.app && window.app.workspaceIcons ? window.app.workspaceIcons : null;
      if (!icons || typeof icons.render !== 'function' || !assignmentNavButtons) return;
      Array.prototype.forEach.call(assignmentNavButtons, function(button) {
        var iconHost = button.querySelector('.nav-entry-icon');
        var iconName = button.dataset ? button.dataset.assignmentIcon : '';
        if (!iconHost || !iconName || iconHost.firstChild) return;
        iconHost.innerHTML = icons.render(iconName, 'assignment-nav-icon');
      });
    }

    function setActiveAssignmentNav(target) {
      if (!assignmentNavButtons) return;
      Array.prototype.forEach.call(assignmentNavButtons, function(button) {
        var active = Boolean(button.dataset && button.dataset.assignmentTarget === target);
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
    }

    function scrollToAssignmentSection(target) {
      if (!target) return;
      var section = document.querySelector('[data-assignment-section="' + target + '"]');
      if (!section) return;
      setActiveAssignmentNav(target);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function syncAssignmentLayout(tabName) {
      if (!document.body || !document.body.classList) return;
      var active = String(tabName || '') === 'assign';
      if (!tabName && assignmentHead && assignmentHead.classList) {
        active = !assignmentHead.classList.contains('hidden');
      }
      document.body.classList.toggle('assignment-layout-active', active);
    }

    function bindAssignmentNavigation() {
      decorateAssignmentNavigation();
      setActiveAssignmentNav('global');
      if (assignmentNavButtons && typeof assignmentNavButtons.forEach === 'function') {
        assignmentNavButtons.forEach(function(button) {
          button.addEventListener('click', function() {
            var target = button.dataset ? button.dataset.assignmentTarget : '';
            scrollToAssignmentSection(target);
          });
        });
      }
      window.addEventListener('app-tab-activated', function(event) {
        var tabName = event && event.detail ? event.detail.tab : '';
        syncAssignmentLayout(tabName);
      });
      window.setTimeout(function() {
        syncAssignmentLayout(state.activeTab || '');
      }, 0);
    }

    function setAssignmentId(key, value) {
      if (!state.assignments) state.assignments = {};
      state.assignments[key] = value;
    }

    function readModelSelection(el) {
      if (!el) return { siteId: '', modelId: '' };
      var option = el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0] : null;
      return {
        modelId: el.value || '',
        siteId: option ? (option.getAttribute('data-site-id') || '') : '',
      };
    }

    function modelIdKeyFor(idKey) {
      return String(idKey || '').replace(/Id$/, 'ModelId');
    }

    function bindModelSelect(el, key, reasoningType, statusEl) {
      if (!el) return;
      el.addEventListener('change', function() {
        var pick = readModelSelection(el);
        setAssignmentId(key, pick.siteId);
        setAssignmentId(modelIdKeyFor(key), pick.modelId);
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

    function showAssignmentSavedToast() {
      showCenterToast('指派已保存', 'ok', 3000);
    }

    function selectOptionBySiteModel(selectEl, siteId, modelId) {
      if (!selectEl) return;
      if (!siteId || !modelId) {
        selectEl.value = '';
        return;
      }
      var options = selectEl.querySelectorAll ? selectEl.querySelectorAll('option') : [];
      for (var i = 0; i < options.length; i += 1) {
        if (options[i].getAttribute('data-site-id') === siteId && options[i].value === modelId) {
          selectEl.selectedIndex = i;
          return;
        }
      }
      selectEl.value = '';
    }

    function syncGlobalAssignSelection() {
      if (!globalAssignModelSelect) return;
      var unifiedSite = '';
      var unifiedModel = '';
      var mismatch = false;
      assignmentIdKeys.forEach(function(key) {
        var siteId = state.assignments && state.assignments[key] ? String(state.assignments[key]) : '';
        var modelId = state.assignments && state.assignments[modelIdKeyFor(key)] ? String(state.assignments[modelIdKeyFor(key)]) : '';
        if (!siteId || !modelId) {
          mismatch = true;
          return;
        }
        if (!unifiedSite) {
          unifiedSite = siteId;
          unifiedModel = modelId;
        } else if (unifiedSite !== siteId || unifiedModel !== modelId) {
          mismatch = true;
        }
      });
      if (mismatch) {
        globalAssignModelSelect.value = '';
        return;
      }
      selectOptionBySiteModel(globalAssignModelSelect, unifiedSite, unifiedModel);
    }

    function testSelectedModel(selectEl, statusEl) {
      var selection = readModelSelection(selectEl);
      testModel(selection.modelId, statusEl, selection.siteId);
    }

    function applyGlobalAssignment() {
      var pick = readModelSelection(globalAssignModelSelect);
      if (!pick.siteId || !pick.modelId) {
        setStatus(globalAssignStatus, '请先选择一个模型后再确认', 'warn');
        return;
      }
      var reasoning = globalAssignReasoning ? (globalAssignReasoning.value || '') : '';
      assignmentIdKeys.forEach(function(key) {
        setAssignmentId(key, pick.siteId);
        setAssignmentId(modelIdKeyFor(key), pick.modelId);
      });
      var reasoningKeyByType = {
        xmindcasegen: 'xmindCaseGenReasoning',
        casefilter: 'caseFilterReasoning',
        missingreminder: 'missingReminderReasoning',
        caselibrarygen: 'caseLibraryGenReasoning',
      };
      reasoningTypes.forEach(function(type) {
        state.assignments[reasoningKeyByType[type]] = reasoning;
      });
      // 重建下拉与推理等级，再统一保存。
      renderAssignmentsSelect();
      saveAssignments();
      syncGlobalAssignSelection();
      if (assignSaveBar) assignSaveBar.classList.add('hidden');
      updateAssignmentStatuses();
      setStatus(globalAssignStatus, '已统一指派并保存，刷新页面后仍会保持该配置', 'ok');
    }

    bindAssignmentNavigation();
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

    saveAssignmentsBtns.forEach(function(saveAssignmentsBtn) {
      saveAssignmentsBtn.addEventListener('click', function() {
        saveAssignments();
        renderAssignmentsSelect();
        updateAssignmentStatuses();
        showAssignmentSavedToast();
      });
    });

    if (testXmindCaseGenModelBtn && testModel) testXmindCaseGenModelBtn.addEventListener('click', function() {
      testSelectedModel(xmindCaseGenModelSelect, xmindCaseGenAssignStatus);
    });
    if (testCaseFilterModelBtn && testModel) testCaseFilterModelBtn.addEventListener('click', function() {
      testSelectedModel(caseFilterModelSelect, caseFilterAssignStatus);
    });
    if (testMissingReminderModelBtn && testModel) testMissingReminderModelBtn.addEventListener('click', function() {
      testSelectedModel(missingReminderModelSelect, missingReminderAssignStatus);
    });
    if (testCaseLibraryGenModelBtn && testModel) testCaseLibraryGenModelBtn.addEventListener('click', function() {
      testSelectedModel(caseLibraryGenModelSelect, caseLibraryGenAssignStatus);
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
