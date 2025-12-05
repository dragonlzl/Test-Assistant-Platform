(function() {
  function init(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var dom = ctx.dom || {};
    var api = ctx.api || {};
    var activeTabKey = ctx.activeTabKey || 'usecase-active-tab';
    var appUtils = ctx.appUtils || {};
    var assignIfPresent = ctx.assignIfPresent || function(target) { return target; };
    var tempExecApi = ctx.tempExecApi || {};
    var setStatus = ctx.setStatus || function() {};
    var renderAssignmentsSelect = ctx.renderAssignmentsSelect || function() {};
    var ensureCaseGenModulesFromSplit = ctx.ensureCaseGenModulesFromSplit || function() { return false; };
    var renderCaseGeneration = ctx.renderCaseGeneration || function() {};
    var updateAutoClarifyVisibility = ctx.updateAutoClarifyVisibility || function() {};
    var syncAutoCompareStatus = ctx.syncAutoCompareStatus || function() {};
    var updateAutoMissingCard = ctx.updateAutoMissingCard || function() {};
    var renderSettingsUI = ctx.renderSettingsUI || function() {};
    var updateMissingView = ctx.updateMissingView || function() {};
    var toggleSplitView = ctx.toggleSplitView || function() {};
    var shouldExpectCleanJson = ctx.shouldExpectCleanJson || function() { return false; };
    var runCleaning = ctx.runCleaning || function() {};
    var copyCleaned = ctx.copyCleaned || function() {};
    var renderCleanView = ctx.renderCleanView || function() {};
    var renderCleanRawView = ctx.renderCleanRawView || function() {};
    var locateCleanRawSelection = ctx.locateCleanRawSelection || function() {};
    var compareCoverage = ctx.compareCoverage || function() {};
    var compareCasesCoverage = ctx.compareCasesCoverage || function() {};
    var exportCompareResult = ctx.exportCompareResult || function() {};
    var importCompareResult = ctx.importCompareResult || function() {};
    var toggleMissingView = ctx.toggleMissingView || function() {};
    var copyMissingJson = ctx.copyMissingJson || function() {};
    var handleMissingSelectionChange = ctx.handleMissingSelectionChange || function() {};
    var handleMissingSelectAll = ctx.handleMissingSelectAll || function() {};
    var smartFillMissingSuggestions = ctx.smartFillMissingSuggestions || function() {};
    var exportCasesCoverage = ctx.exportCasesCoverage || function() {};
    var importCasesCoverage = ctx.importCasesCoverage || function() {};
    var getSafeRequirementSlug = ctx.getSafeRequirementSlug || function() { return 'requirement'; };
    var parseSplitModules = ctx.parseSplitModules || function() { return []; };
    var scrollToSection = ctx.scrollToSection || function() {};
    var scrollElementIntoView = ctx.scrollElementIntoView || function() {};
    var goCasesGenAndScroll = ctx.goCasesGenAndScroll || function() {};
    var refreshMissingSmartFillButton = ctx.refreshMissingSmartFillButton || function() {};
    var updateFlowStatus = ctx.updateFlowStatus || function() {};
    var setCaseViewHint = ctx.setCaseViewHint || function() {};
    var renderCaseGenProgressBoard = api.renderCaseGenProgressBoard || ctx.renderCaseGenProgressBoard || function() {};
    var loadModels = ctx.loadModels || function() {};
    var loadAssignments = ctx.loadAssignments || function() {};
    var renderModels = ctx.renderModels || function() {};
    var renderImportedCaseList = ctx.renderImportedCaseList || function() {};
    var renderAutoRawInfo = ctx.renderAutoRawInfo || function() {};
    var syncReviewViewFromResult = ctx.syncReviewViewFromResult || function() {};
    var syncSplitView = ctx.syncSplitView || function() {};
    var resetModelForm = ctx.resetModelForm || function() {};
    var toggleImportedCaseView = ctx.toggleImportedCaseView || function() {};
    var escapeHtml = ctx.escapeHtml;
    var escapeHtmlPreserve = ctx.escapeHtmlPreserve;
    var formatCompactTimestamp = ctx.formatCompactTimestamp || function() { return ''; };
    var callModelWithConfig = ctx.callModelWithConfig || function() { return Promise.reject(); };
    var getAssignedModel = ctx.getAssignedModel || function() {};
    var updateModelTiming = ctx.updateModelTiming || function() {};
    var downloadBlob = ctx.downloadBlob || function() {};
    var parseXmindFile = ctx.parseXmindFile || function() { return Promise.resolve({ text: '', list: [] }); };
    var updateAssignmentStatuses = ctx.updateAssignmentStatuses || function() {};
    var updateReasoningVisibility = ctx.updateReasoningVisibility || function() {};
    var testModel = ctx.testModel || function() {};
    var hasCaseSource = api.hasCaseSource || function() { return false; };
    var getCombinedCaseList = api.getCombinedCaseList || function() { return []; };
    var getCombinedCaseText = api.getCombinedCaseText || function() { return ''; };
    var deriveCaseListFromText = api.deriveCaseListFromText || function() { return []; };
    var parseCaseList = api.parseCaseList || function() { return []; };
    var renderCaseTable = api.renderCaseTable || function() {};
    var goToCaseGeneration = api.goToCaseGeneration || function() {};
    var generateCasesForModule = api.generateCasesForModule || function() {};
    var toggleCaseView = api.toggleCaseView || function() {};
    var exportModuleCases = api.exportModuleCases || function() {};
    var exportSelectedCases = api.exportSelectedCases || function() {};
    var exportSelectedCasesToXmind = api.exportSelectedCasesToXmind || function() {};
    var transferModuleToTempExec = api.transferModuleToTempExec || function() {};
    var importModuleCases = api.importModuleCases || function() {};
    var clearModuleCases = api.clearModuleCases || function() {};
    var topUpCasesForModule = api.topUpCasesForModule || function() {};
    var handleCaseSelectionChange = api.handleCaseSelectionChange || function() {};
    var handleCaseSelectAll = api.handleCaseSelectAll || function() {};
    var exportCaseGenerationResults = api.exportCaseGenerationResults || function() {};

    const cleanModule = window.app.clean && typeof window.app.clean.init === 'function'
      ? window.app.clean.init({
        state: state,
        shouldExpectCleanJson: shouldExpectCleanJson,
        handlers: {
          runCleaning: runCleaning,
          copyCleaned: copyCleaned,
          renderCleanView: renderCleanView,
          renderCleanRawView: renderCleanRawView,
          locateCleanRawSelection: locateCleanRawSelection,
        },
        dom: dom,
      })
      : null;
    const compareModule = window.app.compare && typeof window.app.compare.init === 'function'
      ? window.app.compare.init({
        handlers: {
          compareCoverage: compareCoverage,
          compareCasesCoverage: compareCasesCoverage,
          exportCompareResult: exportCompareResult,
          importCompareResult: importCompareResult,
          toggleMissingView: toggleMissingView,
          copyMissingJson: copyMissingJson,
          handleMissingSelectionChange: handleMissingSelectionChange,
          handleMissingSelectAll: handleMissingSelectAll,
          smartFillMissingSuggestions: smartFillMissingSuggestions,
          exportCasesCoverage: exportCasesCoverage,
          importCasesCoverage: importCasesCoverage,
          triggerCoverageSampleDownload: function(btn) {
            const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
            const slug = typeof getSafeRequirementSlug === 'function' ? getSafeRequirementSlug() : 'requirement';
            setTimeout(function() {
              const trigger = btn || document.getElementById('exportCasesCoverage');
              const link = document.createElement('a');
              link.id = 'exportCasesCoverage';
              link.className = trigger ? trigger.className : '';
              link.textContent = trigger ? trigger.textContent : '导出对比结果';
              link.download = 'cases_compare_' + slug + '_' + stamp + '.txt';
              link.href = 'assets/cases_compare_sample.txt';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }, 0);
          },
          handleCasesCompareInput: function() {
            updateMissingView();
            updateFlowStatus();
          },
        },
      })
      : null;
    const splitModule = window.app.split && typeof window.app.split.init === 'function'
      ? window.app.split.init({
        handlers: {
          splitModules: api.splitModules,
          toggleSplitView: toggleSplitView,
        },
      })
      : null;

    function focusAssignSaveIfNeeded() {
      var assignBtn = document.querySelector('[data-tab-btn="assign"]');
      var badge = assignBtn && assignBtn.querySelector('.tab-notice');
      var needScroll = Boolean(state && state.assignmentsMissing);
      if (!needScroll) {
        needScroll = badge && typeof badge.textContent === 'string' && badge.textContent.indexOf('未保存指派模型') !== -1;
      }
      if (!needScroll) return;
      var saveBar = document.getElementById('assignSaveBar');
      var saveBtn = document.getElementById('saveAssignments');
      if (saveBar) saveBar.classList.remove('hidden');
      var target = saveBar || saveBtn;
      if (!target) return;
      function scrollToSave() {
        if (target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else if (typeof scrollElementIntoView === 'function') {
          scrollElementIntoView(target, 'auto', 140);
        }
      }
      setTimeout(scrollToSave, 0);
      setTimeout(scrollToSave, 200);
      setTimeout(scrollToSave, 400);
    }

    (function bindAssignTabClick() {
      var assignBtn = document.querySelector('[data-tab-btn="assign"]');
      if (!assignBtn) return;
      assignBtn.addEventListener('click', focusAssignSaveIfNeeded);
    })();

    function switchTab(name) {
      state.activeTab = name;
      if (activeTabKey && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(activeTabKey, name);
        } catch (err) {
          // ignore
        }
      }
      dom.tabButtons.forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset && btn.dataset.tabBtn === name);
      });
      dom.tabSections.forEach(function(sec) {
        const match = sec.dataset && sec.dataset.tabSection === name;
        sec.classList.toggle('hidden', !match);
      });
      if (dom.autoClarifySection) {
        const shouldShow = state.autoRequireClarifications && name === 'auto';
        dom.autoClarifySection.classList.toggle('hidden', !shouldShow);
      }
      if (dom.flowNav) {
        dom.flowNav.classList.toggle('hidden', name === 'tempexec');
      }
      if (dom.tempexecFlowNav) {
        dom.tempexecFlowNav.classList.toggle('hidden', name !== 'tempexec');
      }
      if (name === 'models') clearStatusById('modelFormStatus');
      if (name === 'assign') {
        renderAssignmentsSelect();
        ['reviewAssignStatus', 'cleanAssignStatus', 'compareAssignStatus', 'splitAssignStatus', 'casesAssignStatus', 'caseGenAssignStatus', 'caseFilterAssignStatus']
          .forEach(clearStatusById);
        focusAssignSaveIfNeeded();
      }
      if (name === 'casesgen') {
        const autoFilled = ensureCaseGenModulesFromSplit();
        if (autoFilled) {
          setStatus(dom.caseGenStatus, '', '');
          renderCaseGeneration();
        } else if (state.caseGenModules.length) {
          renderCaseGeneration();
        }
        if (dom.toSplitFromCaseGenBtn && dom.splitResultEl) {
          dom.toSplitFromCaseGenBtn.classList.toggle('hidden', Boolean(dom.splitResultEl.value && dom.splitResultEl.value.trim()));
        }
      }
      if (name === 'auto') {
        updateAutoClarifyVisibility();
        syncAutoCompareStatus();
        updateAutoMissingCard();
      }
      if (name === 'settings') {
        renderSettingsUI();
        clearStatusById('feishuWebhookStatus');
      }
    }
    api.switchTab = switchTab;
    document.addEventListener('click', function(e) {
      const tabBtn = e && e.target && e.target.closest ? e.target.closest('[data-tab-btn]') : null;
      if (tabBtn && tabBtn.dataset && tabBtn.dataset.tabBtn) {
        switchTab(tabBtn.dataset.tabBtn);
      }
    });

    function clearStatusById(id) {
      const el = document.getElementById(id);
      if (el) setStatus(el, '', '');
    }

    const core = {};
    assignIfPresent(core, {
      state: state,
      config: window.app.config,
      utils: appUtils,
      setStatus: setStatus,
      switchTab: switchTab,
      scrollToSection: scrollToSection,
      hasCaseSource: hasCaseSource,
      getCombinedCaseList: getCombinedCaseList,
      getCombinedCaseText: getCombinedCaseText,
      deriveCaseListFromText: deriveCaseListFromText,
      parseCaseList: parseCaseList,
      renderCaseTable: renderCaseTable,
      formatCompactTimestamp: formatCompactTimestamp,
      escapeHtml: escapeHtml,
      escapeHtmlPreserve: escapeHtmlPreserve,
      updateFlowStatus: updateFlowStatus,
      callModelWithConfig: callModelWithConfig,
      getAssignedModel: getAssignedModel,
      updateModelTiming: updateModelTiming,
      setCaseViewHint: setCaseViewHint,
      downloadBlob: downloadBlob,
      parseXmindFile: parseXmindFile,
      scrollElementIntoView: scrollElementIntoView,
      updateAssignmentStatuses: updateAssignmentStatuses,
      updateReasoningVisibility: updateReasoningVisibility,
      testModel: testModel,
    }, Object.keys({
      state: 1, config: 1, utils: 1, setStatus: 1, switchTab: 1, scrollToSection: 1, hasCaseSource: 1, getCombinedCaseList: 1,
      getCombinedCaseText: 1, deriveCaseListFromText: 1, parseCaseList: 1, renderCaseTable: 1, formatCompactTimestamp: 1, escapeHtml: 1,
      escapeHtmlPreserve: 1, updateFlowStatus: 1, callModelWithConfig: 1, getAssignedModel: 1, updateModelTiming: 1, setCaseViewHint: 1,
      downloadBlob: 1, parseXmindFile: 1, scrollElementIntoView: 1, updateAssignmentStatuses: 1, updateReasoningVisibility: 1, testModel: 1,
    }));
    window.app.core = core;

    const casesGenApi = {};
    assignIfPresent(casesGenApi, {
      goToCaseGeneration: goToCaseGeneration,
      generateCasesForModule: generateCasesForModule,
      toggleCaseView: toggleCaseView,
      exportModuleCases: exportModuleCases,
      exportSelectedCases: exportSelectedCases,
      exportSelectedCasesToXmind: exportSelectedCasesToXmind,
      transferModuleToTempExec: transferModuleToTempExec,
      importModuleCases: importModuleCases,
      clearModuleCases: clearModuleCases,
      topUpCasesForModule: topUpCasesForModule,
      handleCaseSelectionChange: handleCaseSelectionChange,
      handleCaseSelectAll: handleCaseSelectAll,
      exportCaseGenerationResults: exportCaseGenerationResults,
      ensureCaseGenModulesFromSplit: ensureCaseGenModulesFromSplit,
      renderCaseGeneration: renderCaseGeneration,
    }, Object.keys({
      goToCaseGeneration: 1, generateCasesForModule: 1, toggleCaseView: 1, exportModuleCases: 1, exportSelectedCases: 1,
      exportSelectedCasesToXmind: 1, transferModuleToTempExec: 1, importModuleCases: 1, clearModuleCases: 1, topUpCasesForModule: 1,
      handleCaseSelectionChange: 1, handleCaseSelectAll: 1, exportCaseGenerationResults: 1, ensureCaseGenModulesFromSplit: 1, renderCaseGeneration: 1,
    }));

    function initApp() {
      if (window.app && window.app._inited) return;
      if (!window.app) window.app = {};
      window.app._inited = true;
      function resolveInitialTab() {
        var defaultTab = 'auto';
        var saved = '';
        if (activeTabKey && typeof localStorage !== 'undefined') {
          try {
            saved = localStorage.getItem(activeTabKey) || '';
          } catch (err) {
            saved = '';
          }
        }
        var tabs = [];
        if (dom.tabButtons && dom.tabButtons.length) {
          dom.tabButtons.forEach(function(btn) {
            if (btn && btn.dataset && btn.dataset.tabBtn) {
              tabs.push(btn.dataset.tabBtn);
            }
          });
        }
        var isValidSaved = saved && tabs.indexOf(saved) !== -1;
        if (isValidSaved) return saved;
        var hasDefault = tabs.indexOf(defaultTab) !== -1;
        if (hasDefault) return defaultTab;
        return tabs.length ? tabs[0] : defaultTab;
      }
      loadModels();
      loadAssignments();
      renderModels();
      renderAssignmentsSelect();
      renderSettingsUI();
      renderCaseGeneration();
      renderImportedCaseList();
      renderAutoRawInfo();
      renderCleanView();
      renderCleanRawView(null);
      updateAutoClarifyVisibility();
      updateAutoMissingCard();
      syncReviewViewFromResult();
      syncSplitView();
      resetModelForm();
      var initialTab = resolveInitialTab();
      switchTab(initialTab);
      if (initialTab === 'auto') {
        scrollToSection('auto-import', { behavior: 'instant' });
      }
      const casegenCoreModule = window.app.casegenCore && typeof window.app.casegenCore.init === 'function'
        ? window.app.casegenCore.init({
          state: state,
          handlers: {
            renderCaseGeneration: renderCaseGeneration,
            ensureCaseGenModulesFromSplit: ensureCaseGenModulesFromSplit,
            exportCaseGenerationResults: exportCaseGenerationResults,
            scrollToSection: scrollToSection,
            updateFlowStatus: updateFlowStatus,
            switchTab: switchTab,
            scrollElementIntoView: scrollElementIntoView,
            parseSplitModules: parseSplitModules,
            refreshMissingSmartFillButton: refreshMissingSmartFillButton,
            syncSplitView: syncSplitView,
            updateMissingView: updateMissingView,
          },
          setStatus: setStatus,
          dom: dom,
        })
        : null;
      assignIfPresent(api, casegenCoreModule, ['goToCaseGeneration', 'goCasesGenAndScroll']);

      const casegenHandlersModule = window.app.casegenHandlers && typeof window.app.casegenHandlers.init === 'function'
        ? window.app.casegenHandlers.init({
          handlers: {
            goCasesGenAndScroll: api.goCasesGenAndScroll || goCasesGenAndScroll,
            scrollToSection: scrollToSection,
          },
          dom: dom,
        })
        : null;
      const layoutHandlersModule = window.app.layoutHandlers && typeof window.app.layoutHandlers.init === 'function'
        ? window.app.layoutHandlers.init({
          updateFlowStatus: updateFlowStatus,
          scrollToSection: scrollToSection,
          switchTab: switchTab,
          handlers: {
            toggleSplitView: toggleSplitView,
            toggleImportedCaseView: toggleImportedCaseView,
            scrollElementIntoView: scrollElementIntoView,
          },
          dom: dom,
      })
      : null;
    const casegenProgressModule = window.app.casegenProgress && typeof window.app.casegenProgress.init === 'function'
      ? window.app.casegenProgress.init({
        state: state,
        dom: dom,
        utils: appUtils,
        escapeHtml: escapeHtml,
      })
      : null;
    assignIfPresent(api, casegenProgressModule, [
      'renderCaseGenProgressBoard',
      'setCaseModuleRunning',
      'isCaseModuleRunning',
      'renderCaseModuleProgress',
      'updateCaseProgressView',
      'clearCaseProgress',
      'initCaseProgress',
      'setCaseProgressGroupState',
      'setCaseProgressStep',
      'markAllCaseProgressGroups',
    ]);
      setCaseViewHint('请先上传或输入 XMind 测试用例');
      updateFlowStatus();
      return { casegenHandlersModule: casegenHandlersModule, casegenCoreModule: casegenCoreModule, layoutHandlersModule: layoutHandlersModule };
    }
    window.app = window.app || {};
    window.app.init = initApp;

    renderCaseGenProgressBoard();

    const moduleContext = { state: state, config: window.app.config, utils: appUtils, core: core, tempExecApi: tempExecApi, casesGenApi: casesGenApi };
    const autoContext = {
      state: state,
      config: window.app.config,
      utils: appUtils,
      core: core,
      setStatus: setStatus,
      tempExecApi: tempExecApi,
      casesGenApi: casesGenApi,
      handlers: {
        toggleAutoMissingView: api.toggleAutoMissingView,
        copyAutoMissingJson: api.copyAutoMissingJson,
        smartFillMissingSuggestions: api.smartFillMissingSuggestions,
        handleMissingSelectionChange: api.handleMissingSelectionChange,
        handleMissingSelectAll: api.handleMissingSelectAll,
        resetAutoCompareMissingView: api.resetAutoCompareMissingView,
        resetAutoCompareUserInputs: api.resetAutoCompareUserInputs,
        renderAutoCompareMissingView: api.renderAutoCompareMissingView,
        buildFilteredComparePayload: api.buildFilteredComparePayload,
        updateAutoCompareActions: api.updateAutoCompareActions,
        syncAutoCompareStatus: api.syncAutoCompareStatus,
        runAutoWorkflow: api.runAutoWorkflow,
        runAutoWorkflowFromClean: api.runAutoWorkflowFromClean,
        continueAutoWorkflowAfterCoverage: api.continueAutoWorkflowAfterCoverage,
        executeAutoWorkflowSteps: api.executeAutoWorkflowSteps,
        enforceAutoCoverageRequirement: api.enforceAutoCoverageRequirement,
        reviewRequirements: api.reviewRequirements,
        runCleaning: api.runCleaning,
        compareCoverage: compareCoverage,
        splitModules: api.splitModules,
        compareCasesCoverage: api.compareCasesCoverage,
        extractCoverageFromCompareResult: api.extractCoverageFromCompareResult,
        extractCompareResultData: api.extractCompareResultData,
        formatMissingRequirement: api.formatMissingRequirement,
        shouldExpectCleanJson: shouldExpectCleanJson,
        hasCaseSource: hasCaseSource,
        switchTab: switchTab,
        scrollToSection: scrollToSection,
        resetAutoMissingView: api.resetAutoMissingView,
        ensureAutoMissingViewVisible: api.ensureAutoMissingViewVisible,
        updateAutoMissingCard: api.updateAutoMissingCard,
        updateFlowStatus: updateFlowStatus,
        updateAutoClarifyVisibility: updateAutoClarifyVisibility,
        renderAutoClarifyView: api.renderAutoClarifyView,
        openAutoClarifyPanel: api.openAutoClarifyPanel,
        waitForAutoClarification: api.waitForAutoClarification,
        notifyFeishuWorkflowSuccess: api.notifyFeishuWorkflowSuccess,
        notifyFeishuCoverageFailure: api.notifyFeishuCoverageFailure,
        notifyFeishuClarificationNeeded: api.notifyFeishuClarificationNeeded,
        jumpToCleanHighlightView: api.jumpToCleanHighlightView,
      },
    };
    if (window.app.auto && typeof window.app.auto.init === 'function') {
      const autoModule = window.app.auto.init(autoContext) || {};
      assignIfPresent(api, autoModule, [
        'resetAutoCompareMissingView',
        'resetAutoCompareUserInputs',
        'renderAutoCompareMissingView',
        'buildFilteredComparePayload',
        'updateAutoCompareActions',
        'syncAutoCompareStatus',
      ]);
    }
    syncAutoCompareStatus();
    if (window.app.casesgen && typeof window.app.casesgen.init === 'function') {
      window.app.casesgen.init(moduleContext);
    }
    if (window.app.tempexec && typeof window.app.tempexec.init === 'function') {
      window.app.tempexec.init(moduleContext);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }

    return {
      switchTab: switchTab,
      core: core,
      casesGenApi: casesGenApi,
      initApp: initApp,
    };
  }

  window.app = window.app || {};
  window.app.appRuntime = { init: init };
})();
