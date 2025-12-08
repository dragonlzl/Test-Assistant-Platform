(function() {
  window.app = window.app || {};

  function createFallbacks(options) {
    var defaultTempExecPageSize = Number(options && options.defaultTempExecPageSize) || 20;
    var noop = function() {};
    var asyncNoop = async function() {};
    var falseFn = function() { return false; };
    var emptyArr = function() { return []; };
    var emptyStr = function() { return ''; };
    var defaultParsedCases = function() { return { parsed: [], normalized: '', hadRecovery: false }; };
    var defaultCasesPayload = function() { return { text: '', isJson: false }; };
    var clampTempExecPageSize = function(value) {
      var num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultTempExecPageSize;
      return num;
    };
    return {
      noop: noop,
      asyncNoop: asyncNoop,
      falseFn: falseFn,
      emptyArr: emptyArr,
      emptyStr: emptyStr,
      defaultParsedCases: defaultParsedCases,
      defaultCasesPayload: defaultCasesPayload,
      resetAutoCompareMissingView: noop,
      resetAutoCompareUserInputs: noop,
      renderAutoCompareMissingView: noop,
      buildFilteredComparePayload: function() { return ''; },
      updateAutoCompareActions: noop,
      syncAutoCompareStatus: noop,
      runAutoWorkflow: noop,
      runAutoWorkflowFromClean: noop,
      continueAutoWorkflowAfterCoverage: noop,
      executeAutoWorkflowSteps: function() { return Promise.resolve(); },
      enforceAutoCoverageRequirement: function() { return Promise.resolve(); },
      exportCasesCoverage: noop,
      importCasesCoverage: asyncNoop,
      exportCompareResult: noop,
      importCompareResult: asyncNoop,
      saveDebugText: noop,
      importDebugText: asyncNoop,
      bindDebugControls: noop,
      handleRawInput: noop,
      handleCleanInput: noop,
      handleSplitInput: noop,
      handleCaseTextInput: noop,
      wrapCleanedText: function(text) { return text; },
      renderAutoRawInfo: noop,
      renderCleanRawView: noop,
      collectEntryRanges: emptyArr,
      renderCaseGenProgressBoard: noop,
      setCaseModuleRunning: noop,
      isCaseModuleRunning: falseFn,
      renderCaseModuleProgress: function() { return ''; },
      updateCaseProgressView: noop,
      clearCaseProgress: noop,
      initCaseProgress: noop,
      setCaseProgressGroupState: noop,
      setCaseProgressStep: noop,
      markAllCaseProgressGroups: noop,
      updateFlowStatus: noop,
      scrollToSection: noop,
      refreshExportCaseGenButton: noop,
      setCaseViewHint: noop,
      splitModules: asyncNoop,
      ensureCaseGenModulesFromSplit: falseFn,
      reviewRequirements: function() { return Promise.resolve(); },
      copyReviewResult: noop,
      exportReviewResult: noop,
      importReviewResult: asyncNoop,
      toggleReviewView: noop,
      confirmClarifications: noop,
      handleClarifyClickEvent: noop,
      handleClarifyChangeEvent: noop,
      handleClarifyInputEvent: noop,
      updateAutoClarifyVisibility: noop,
      renderAutoClarifyView: noop,
      openAutoClarifyPanel: noop,
      handleAutoClarifyConfirm: noop,
      waitForAutoClarification: function() { return Promise.resolve(true); },
      refreshMissingSmartFillButton: noop,
      updateMissingView: noop,
      toggleMissingView: noop,
      refreshMissingSelectionUI: noop,
      copyMissingJson: noop,
      syncReviewViewFromResult: noop,
      buildReviewClarificationContext: function() { return ''; },
      renderCaseGeneration: noop,
      renderCaseTable: function() { return ''; },
      parseGeneratedCases: defaultParsedCases,
      renderImportedCaseList: noop,
      addImportedCase: noop,
      removeImportedCase: noop,
      hasImportedCases: falseFn,
      hasCaseSource: falseFn,
      getCombinedCaseList: emptyArr,
      getCombinedCaseText: emptyStr,
      getImportedCaseObjects: emptyArr,
      syncCaseTextWithImports: noop,
      buildCasesComparePayload: defaultCasesPayload,
      resetImportedCaseView: noop,
      refreshImportedCaseView: noop,
      handleCaseFiles: noop,
      resetAutoMissingView: noop,
      refreshAutoMissingSelectionUI: noop,
      updateAutoMissingCard: noop,
      toggleAutoMissingView: noop,
      ensureAutoMissingViewVisible: noop,
      copyAutoMissingJson: noop,
      handleMissingSelectionChange: noop,
      handleMissingSelectAll: noop,
      smartFillMissingSuggestions: noop,
      notifyFeishuWorkflowSuccess: noop,
      notifyFeishuCoverageFailure: noop,
      notifyFeishuClarificationNeeded: noop,
      generateCasesForModule: asyncNoop,
      topUpCasesForModule: asyncNoop,
      exportCaseGenerationResults: noop,
      exportModuleCases: noop,
      importModuleCases: noop,
      transferModuleToTempExec: asyncNoop,
      clearModuleCases: noop,
      toggleCaseView: noop,
      handleCaseSelectionChange: noop,
      handleCaseSelectAll: noop,
      exportSelectedCases: noop,
      exportSelectedCasesToXmind: asyncNoop,
      refreshCaseSelectionUI: noop,
      updateSupplementButtons: noop,
      getCaseListForModule: emptyArr,
      toggleImportedCaseView: noop,
      compareCoverage: noop,
      compareCasesCoverage: noop,
      extractCompareResultData: function() { return null; },
      extractCoverageFromCompareResult: function() { return null; },
      goToCaseGeneration: noop,
      goCasesGenAndScroll: noop,
      runCleaning: asyncNoop,
      copyCleaned: asyncNoop,
      syncSplitView: noop,
      toggleSplitView: noop,
      shouldExpectCleanJson: falseFn,
      getCleanedEntries: emptyArr,
      getCleanedRequirementText: emptyStr,
      getCleanedTextForModel: emptyStr,
      renderCleanView: noop,
      locateCleanRawSelection: noop,
      jumpToCleanHighlightView: noop,
      renderTempExecView: noop,
      applyTempExecPageSize: function(value) { return { size: value, changed: false }; },
      clampTempExecPageSize: clampTempExecPageSize,
      createTempExecFile: function() { return null; },
      syncTempExecFocus: noop,
      persistTempExecState: noop,
      setTempExecActive: noop,
      removeTempExecFile: noop,
      getCaseExecutionDisplay: emptyStr,
    };
  }

  function buildDom(ids, alias) {
    var result = {};
    (ids || []).forEach(function(id) {
      result[id] = document.getElementById(id);
    });
    (alias || []).forEach(function(item) {
      if (item && item.name) {
        result[item.name] = document.getElementById(item.id || item.name);
      }
    });
    return result;
  }

  function initModule(name, args) {
    var mod = window.app && window.app[name];
    return mod && typeof mod.init === 'function' ? mod.init(args || {}) : null;
  }

  function assignIfPresent(target, source, keys) {
    if (!target || !source) return target;
    (keys || []).forEach(function(key) {
      var val = source && source[key];
      if (!val || (val && val.__appProxy && val.__appProxy === key)) return;
      target[key] = val;
    });
    return target;
  }

  window.app.appInitHelpers = {
    createFallbacks: createFallbacks,
    buildDom: buildDom,
    initModule: initModule,
    assignIfPresent: assignIfPresent,
  };
})();
