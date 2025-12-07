(function() {
  function init(ctx) {
    if (!ctx) return;
    var state = ctx.state || {};
    var core = ctx.core || {};
    var utils = ctx.utils || {};
    var api = ctx.casesGenApi || {};
    var setStatus = core.setStatus || utils.setStatus || function() {};
    var debounce = utils.debounce || function(fn) { return fn; };
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
    var exportCaseGenBtn = document.getElementById('exportCaseGen');
    var testCaseGenModelBtn = document.getElementById('testCaseGenModel');
    var appendToExistingCasesBtn = document.getElementById('appendToExistingCases');
    var appendTargetSelect = document.getElementById('appendTargetSelect');
    var transferSelectedToExecBtn = document.getElementById('transferSelectedToExec');

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
        if (targetGenerate && api.generateCasesForModule) {
          api.generateCasesForModule(targetGenerate.dataset.generate);
          return;
        }
        var targetView = e.target.closest('[data-view]');
        if (targetView && api.toggleCaseView) {
          api.toggleCaseView(targetView.dataset.view);
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
        var targetTopup = e.target.closest('[data-topup]');
        if (targetTopup && api.topUpCasesForModule) {
          api.topUpCasesForModule(targetTopup.dataset.topup);
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
          state.caseGenSuggestions[area.dataset.suggestion] = area.value;
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
    }

  function bindAppendButton() {
    if (appendToExistingCasesBtn && api.appendSelectedCasesToImported) {
      appendToExistingCasesBtn.addEventListener('click', api.appendSelectedCasesToImported);
    }
    if (appendTargetSelect) {
      appendTargetSelect.addEventListener('change', function() {
        if (api && typeof api.state === 'object') {
          api.state.caseGenAppendTarget = appendTargetSelect.value || '';
        }
        if (api && typeof api.refreshAppendExistingButton === 'function') {
          api.refreshAppendExistingButton();
        }
      });
    }
    if (transferSelectedToExecBtn && api.transferSelectedCasesToExec) {
      transferSelectedToExecBtn.addEventListener('click', api.transferSelectedCasesToExec);
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
    bindAppendButton();
  }

  window.app = window.app || {};
  window.app.casesgen = { init: init };
})();
