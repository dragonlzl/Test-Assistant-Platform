(function() {
  function init(ctx) {
    if (!ctx) return;
    var state = ctx.state || {};
    var core = ctx.core || {};
    var utils = ctx.utils || {};
    var api = ctx.casesGenApi || {};
    var setStatus = core.setStatus || utils.setStatus || function() {};
    var debounce = utils.debounce || function(fn) { return fn; };
    var persistWorkflowState = core.persistWorkflowState || function() {};
    var switchTab = core.switchTab || function() {};
    var updateAssignmentStatuses = core.updateAssignmentStatuses || function() {};
    var updateReasoningVisibility = core.updateReasoningVisibility || function() {};
    var testModel = core.testModel || function() {};

    var goUsecaseGenBtn = document.getElementById('goUsecaseGen');
    var casesGoUsecaseGenBtn = document.getElementById('casesGoUsecaseGen');
    var casesGenerationContainer = document.getElementById('casesGenerationContainer');
    var caseGenStatus = document.getElementById('caseGenStatus');
    var caseGenViewDrawerBody = document.getElementById('caseGenViewDrawerBody');
    var caseGenModelSelect = document.getElementById('caseGenModelSelect');
  var caseGenAssignStatus = document.getElementById('caseGenAssignStatus');
  var caseGenPromptEl = document.getElementById('caseGenPrompt');
    var caseGenReasoningSelect = document.getElementById('caseGenReasoning');
    var caseGenAllGenerateBtn = document.getElementById('caseGenAllGenerateBtn');
    var caseGenAllTopupBtn = document.getElementById('caseGenAllTopupBtn');
    var caseGenSuggestionGenerateBtn = document.getElementById('caseGenSuggestionGenerateBtn');
    var caseGenSettingsTabBtn = document.getElementById('caseGenSettingsTabBtn');
    var caseGenModulesTabBtn = document.getElementById('caseGenModulesTabBtn');
    var caseGenCustomRequirementEl = document.getElementById('caseGenCustomRequirement');
    var caseGenNeedBoundaryEl = document.getElementById('caseGenNeedBoundary');
    var caseGenNeedMobileEl = document.getElementById('caseGenNeedMobile');
    var caseGenNeedSpecialEl = document.getElementById('caseGenNeedSpecial');
    var caseGenSpecialRepeatOperationEl = document.getElementById('caseGenSpecialRepeatOperation');
    var caseGenSpecialMultiTouchEl = document.getElementById('caseGenSpecialMultiTouch');
    var caseGenSpecialRepeatExecutionEl = document.getElementById('caseGenSpecialRepeatExecution');
    var caseGenSpecialWeakNetworkEl = document.getElementById('caseGenSpecialWeakNetwork');
    var caseGenSpecialInterruptResumeEl = document.getElementById('caseGenSpecialInterruptResume');
    var exportCaseGenBtn = document.getElementById('exportCaseGen');
    var exportCaseGenXmindBtn = document.getElementById('exportCaseGenXmind');
    var testCaseGenModelBtn = document.getElementById('testCaseGenModel');
    var caseGenStoreActionSelect = document.getElementById('caseGenStoreActionSelect');
    var caseGenStoreNewBtn = document.getElementById('caseGenStoreNewBtn');
    var caseGenStoreAppendBtn = document.getElementById('caseGenStoreAppendBtn');
    var caseGenStoreModeNewBtn = document.getElementById('caseGenStoreModeNewBtn');
    var caseGenStoreModeAppendBtn = document.getElementById('caseGenStoreModeAppendBtn');
    var caseGenAllViewBtn = document.getElementById('caseGenAllViewBtn');
    var caseGenAllSelectBtn = document.getElementById('caseGenAllSelectBtn');

    function bindGoButtons() {
      if (goUsecaseGenBtn && api.goToCaseGeneration) {
        goUsecaseGenBtn.addEventListener('click', function() { api.goToCaseGeneration('split'); });
      }
      if (casesGoUsecaseGenBtn && api.goToCaseGeneration) {
        casesGoUsecaseGenBtn.addEventListener('click', function() { api.goToCaseGeneration('cases'); });
      }
    }

    function bindContainerEvents() {
      if (!casesGenerationContainer) return;
      function handleCaseGenClick(e) {
        var targetGenerate = e.target.closest('[data-generate]');
        if (targetGenerate) {
          if (api.openCaseGenModuleGenerateDrawer) {
            api.openCaseGenModuleGenerateDrawer(targetGenerate.dataset.generate);
            return;
          }
          if (api.generateCasesForModule) {
            api.generateCasesForModule(targetGenerate.dataset.generate);
            return;
          }
        }
        if (targetGenerate) {
          return;
        }
        var targetView = e.target.closest('[data-view]');
        if (targetView && api.toggleCaseView) {
          api.toggleCaseView(targetView.dataset.view);
          return;
        }
        var targetSelectAllModules = e.target.closest('[data-case-select-all-modules]');
        if (targetSelectAllModules && api.handleCaseSelectAllModules) {
          api.handleCaseSelectAllModules();
          return;
        }
        var targetExport = e.target.closest('[data-export]');
        if (targetExport && api.exportModuleCases) {
          api.exportModuleCases(targetExport.dataset.export);
          return;
        }
        var targetExportSelected = e.target.closest('[data-export-selected]');
        if (targetExportSelected && api.exportSelectedCases) {
          api.exportSelectedCases(targetExportSelected.dataset.exportSelected);
          return;
        }
        var targetXmind = e.target.closest('[data-xmind-selected]');
        if (targetXmind && api.exportSelectedCasesToXmind) {
          api.exportSelectedCasesToXmind(targetXmind.dataset.xmindSelected);
          return;
        }
        var targetTempExec = e.target.closest('[data-tempexec]');
        if (targetTempExec && api.transferModuleToTempExec) {
          api.transferModuleToTempExec(targetTempExec.dataset.tempexec);
          return;
        }
        var targetImport = e.target.closest('[data-import]');
        if (targetImport && api.importModuleCases) {
          var input = casesGenerationContainer.querySelector('input[data-import-input="' + targetImport.dataset.import + '"]');
          if (input) input.click();
          return;
        }
        var targetClear = e.target.closest('[data-clear]');
        if (targetClear && api.clearModuleCases) {
          api.clearModuleCases(targetClear.dataset.clear);
          return;
        }
      }
      function handleCaseGenChange(e) {
        var input = e.target;
        if (!input) return;
        if (input.dataset.caseSelect && api.handleCaseSelectionChange) {
          api.handleCaseSelectionChange(input.dataset.caseSelect, Number(input.dataset.index), input.checked);
          return;
        }
        if (input.dataset.caseSelectAll && api.handleCaseSelectAll) {
          api.handleCaseSelectAll(input.dataset.caseSelectAll, input.checked);
          return;
        }
        if (input.dataset.importInput && api.importModuleCases) {
          var files = input.files;
          var file = files && files[0];
          if (file) api.importModuleCases(input.dataset.importInput, file);
          input.value = '';
        }
      }
      function handleCaseGenInput(e) {
        var area = e.target.closest('textarea[data-suggestion]');
        if (area) {
          if (!state.caseGenSuggestions || typeof state.caseGenSuggestions !== 'object') {
            state.caseGenSuggestions = {};
          }
          state.caseGenSuggestions[area.dataset.suggestion] = area.value;
          persistWorkflowState();
          if (api && typeof api.renderCaseGenProgressBoard === 'function') {
            api.renderCaseGenProgressBoard();
          }
          if (api && typeof api.refreshCaseGenBatchButtons === 'function') {
            api.refreshCaseGenBatchButtons();
          }
        }
      }
      casesGenerationContainer.addEventListener('click', handleCaseGenClick);
      casesGenerationContainer.addEventListener('change', handleCaseGenChange);
      casesGenerationContainer.addEventListener('input', handleCaseGenInput);
      if (caseGenViewDrawerBody) {
        caseGenViewDrawerBody.addEventListener('click', handleCaseGenClick);
        caseGenViewDrawerBody.addEventListener('change', handleCaseGenChange);
      }
    }

    function bindModelSelectors() {
      if (caseGenModelSelect) {
        caseGenModelSelect.addEventListener('change', function() {
          state.assignments.caseGenId = caseGenModelSelect.value || '';
          updateAssignmentStatuses();
          updateReasoningVisibility('casegen');
        });
      }
      if (caseGenPromptEl) {
        caseGenPromptEl.addEventListener('input', debounce(function() {
          state.assignments.caseGenPrompt = caseGenPromptEl.value;
        }, 300));
      }
      if (caseGenReasoningSelect) {
        caseGenReasoningSelect.addEventListener('change', function() {
          state.assignments.caseGenReasoning = caseGenReasoningSelect.value || '';
        });
      }
      if (testCaseGenModelBtn && testModel) {
        testCaseGenModelBtn.addEventListener('click', function() {
          testModel(caseGenModelSelect.value, caseGenAssignStatus);
        });
      }
    }

  function bindExportButtons() {
    if (exportCaseGenBtn && api.exportCaseGenerationResults) {
      exportCaseGenBtn.addEventListener('click', api.exportCaseGenerationResults);
    }
    if (exportCaseGenXmindBtn && api.exportSelectedModulesToXmind) {
      exportCaseGenXmindBtn.addEventListener('click', api.exportSelectedModulesToXmind);
    }
  }

    function bindBatchButtons() {
      if (caseGenAllGenerateBtn) {
        caseGenAllGenerateBtn.addEventListener('click', function() {
          if (api && typeof api.openCaseGenBatchActionDrawer === 'function') {
            api.openCaseGenBatchActionDrawer('generate');
            return;
          }
          if (api && typeof api.generateAllCaseGenModules === 'function') {
            api.generateAllCaseGenModules();
          }
        });
      }
      if (caseGenAllTopupBtn) {
        caseGenAllTopupBtn.addEventListener('click', function() {
          if (api && typeof api.openCaseGenBatchActionDrawer === 'function') {
            api.openCaseGenBatchActionDrawer('topup');
            return;
          }
          if (api && typeof api.topUpAllCaseGenModules === 'function') {
            api.topUpAllCaseGenModules();
          }
        });
      }
      if (caseGenSuggestionGenerateBtn) {
        caseGenSuggestionGenerateBtn.addEventListener('click', function() {
          if (api && typeof api.openCaseGenBatchActionDrawer === 'function') {
            api.openCaseGenBatchActionDrawer('suggested');
            return;
          }
          if (api && typeof api.generateSuggestedCaseGenModules === 'function') {
            api.generateSuggestedCaseGenModules();
          }
        });
      }
    }

    function ensureCaseGenSettings() {
      if (api && typeof api.ensureCaseGenSettings === 'function') {
        return api.ensureCaseGenSettings();
      }
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = {
          activeTab: 'settings',
          storeMode: 'new',
          customRequirement: '',
          needBoundary: false,
          needMobile: false,
          needSpecial: false,
          specialRepeatOperation: false,
          specialMultiTouch: false,
          specialRepeatExecution: false,
          specialWeakNetwork: false,
          specialInterruptResume: false,
        };
      }
      return state.caseGenSettings;
    }

    function updateCaseGenSetting(key, value) {
      if (api && typeof api.setCaseGenSettingValue === 'function') {
        api.setCaseGenSettingValue(key, value);
        return;
      }
      var settings = ensureCaseGenSettings();
      settings[key] = value;
      persistWorkflowState();
    }

    function syncCaseGenSettingsUI() {
      var settings = ensureCaseGenSettings();
      if (caseGenCustomRequirementEl) caseGenCustomRequirementEl.value = settings.customRequirement || '';
      if (caseGenNeedBoundaryEl) caseGenNeedBoundaryEl.checked = settings.needBoundary === true;
      if (caseGenNeedMobileEl) caseGenNeedMobileEl.checked = settings.needMobile === true;
      if (caseGenNeedSpecialEl) caseGenNeedSpecialEl.checked = settings.needSpecial === true;
      if (caseGenSpecialRepeatOperationEl) caseGenSpecialRepeatOperationEl.checked = settings.specialRepeatOperation === true;
      if (caseGenSpecialMultiTouchEl) caseGenSpecialMultiTouchEl.checked = settings.specialMultiTouch === true;
      if (caseGenSpecialRepeatExecutionEl) caseGenSpecialRepeatExecutionEl.checked = settings.specialRepeatExecution === true;
      if (caseGenSpecialWeakNetworkEl) caseGenSpecialWeakNetworkEl.checked = settings.specialWeakNetwork === true;
      if (caseGenSpecialInterruptResumeEl) caseGenSpecialInterruptResumeEl.checked = settings.specialInterruptResume === true;
      if (api && typeof api.syncCaseGenSpecialOptionsState === 'function') {
        api.syncCaseGenSpecialOptionsState();
      }
      if (api && typeof api.setCaseGenViewTab === 'function') {
        api.setCaseGenViewTab(settings.activeTab || 'settings', { persist: false });
      }
      if (api && typeof api.setCaseGenStoreMode === 'function') {
        api.setCaseGenStoreMode(settings.storeMode || 'new', { persist: false });
      }
    }

    function bindCaseGenSettings() {
      if (caseGenSettingsTabBtn && api && typeof api.setCaseGenViewTab === 'function') {
        caseGenSettingsTabBtn.addEventListener('click', function() {
          api.setCaseGenViewTab('settings');
        });
      }
      if (caseGenModulesTabBtn && api && typeof api.setCaseGenViewTab === 'function') {
        caseGenModulesTabBtn.addEventListener('click', function() {
          api.setCaseGenViewTab('modules');
        });
      }
      if (caseGenCustomRequirementEl) {
        caseGenCustomRequirementEl.addEventListener('input', debounce(function() {
          updateCaseGenSetting('customRequirement', caseGenCustomRequirementEl.value || '');
        }, 200));
      }
      if (caseGenNeedBoundaryEl) {
        caseGenNeedBoundaryEl.addEventListener('change', function() {
          updateCaseGenSetting('needBoundary', caseGenNeedBoundaryEl.checked === true);
        });
      }
      if (caseGenNeedMobileEl) {
        caseGenNeedMobileEl.addEventListener('change', function() {
          updateCaseGenSetting('needMobile', caseGenNeedMobileEl.checked === true);
        });
      }
      if (caseGenNeedSpecialEl) {
        caseGenNeedSpecialEl.addEventListener('change', function() {
          updateCaseGenSetting('needSpecial', caseGenNeedSpecialEl.checked === true);
          if (api && typeof api.syncCaseGenSpecialOptionsState === 'function') {
            api.syncCaseGenSpecialOptionsState();
          }
        });
      }
      if (caseGenSpecialRepeatOperationEl) {
        caseGenSpecialRepeatOperationEl.addEventListener('change', function() {
          updateCaseGenSetting('specialRepeatOperation', caseGenSpecialRepeatOperationEl.checked === true);
        });
      }
      if (caseGenSpecialMultiTouchEl) {
        caseGenSpecialMultiTouchEl.addEventListener('change', function() {
          updateCaseGenSetting('specialMultiTouch', caseGenSpecialMultiTouchEl.checked === true);
        });
      }
      if (caseGenSpecialRepeatExecutionEl) {
        caseGenSpecialRepeatExecutionEl.addEventListener('change', function() {
          updateCaseGenSetting('specialRepeatExecution', caseGenSpecialRepeatExecutionEl.checked === true);
        });
      }
      if (caseGenSpecialWeakNetworkEl) {
        caseGenSpecialWeakNetworkEl.addEventListener('change', function() {
          updateCaseGenSetting('specialWeakNetwork', caseGenSpecialWeakNetworkEl.checked === true);
        });
      }
      if (caseGenSpecialInterruptResumeEl) {
        caseGenSpecialInterruptResumeEl.addEventListener('change', function() {
          updateCaseGenSetting('specialInterruptResume', caseGenSpecialInterruptResumeEl.checked === true);
        });
      }
    }

    function bindStoreButtons() {
      if (caseGenStoreModeNewBtn && api && typeof api.setCaseGenStoreMode === 'function') {
        caseGenStoreModeNewBtn.addEventListener('click', function() {
          api.setCaseGenStoreMode('new');
        });
      }
      if (caseGenStoreModeAppendBtn && api && typeof api.setCaseGenStoreMode === 'function') {
        caseGenStoreModeAppendBtn.addEventListener('click', function() {
          api.setCaseGenStoreMode('append');
        });
      }
      if (caseGenStoreActionSelect) {
        caseGenStoreActionSelect.addEventListener('change', function() {
          if (api && typeof api.setCaseGenDbStoreNewAction === 'function') {
            api.setCaseGenDbStoreNewAction(caseGenStoreActionSelect.value || '');
          }
          if (api && typeof api.clearCaseGenDbStoreNewActionError === 'function') {
            api.clearCaseGenDbStoreNewActionError();
          }
        });
      }
      if (caseGenAllViewBtn && api.openCaseGenAllView) {
        caseGenAllViewBtn.addEventListener('click', api.openCaseGenAllView);
      }
      if (caseGenAllSelectBtn && api.handleCaseSelectAllModules) {
        caseGenAllSelectBtn.addEventListener('click', api.handleCaseSelectAllModules);
      }
      if (caseGenStoreNewBtn && api.openCaseGenDbStoreNewDrawer) {
        caseGenStoreNewBtn.addEventListener('click', api.openCaseGenDbStoreNewDrawer);
      }
      if (caseGenStoreAppendBtn && api.openCaseGenDbStoreAppendDrawer) {
        caseGenStoreAppendBtn.addEventListener('click', api.openCaseGenDbStoreAppendDrawer);
      }
    }

    // 初始渲染：进入用例生成时自动补模块
    if (typeof api.ensureCaseGenModulesFromSplit === 'function') {
      api.ensureCaseGenModulesFromSplit();
    }

    bindGoButtons();
    bindContainerEvents();
    bindModelSelectors();
    bindExportButtons();
    bindBatchButtons();
    bindCaseGenSettings();
    bindStoreButtons();
    syncCaseGenSettingsUI();
  }

  window.app = window.app || {};
  window.app.casesgen = { init: init };
})();
