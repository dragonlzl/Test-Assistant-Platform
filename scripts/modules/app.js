    window.app = window.app || {};
    function markInitStage(stage) {
      var stableStage = stage ? String(stage || '') : '';
      window.app.__tapInitStage = stableStage;
      var nextHistory = Array.isArray(window.app.__tapInitStageHistory)
        ? window.app.__tapInitStageHistory.slice()
        : [];
      nextHistory.push(stableStage);
      if (nextHistory.length > 24) nextHistory = nextHistory.slice(nextHistory.length - 24);
      window.app.__tapInitStageHistory = nextHistory;
      try {
        var root = document && document.documentElement ? document.documentElement : null;
        if (!root) return;
        var historyText = nextHistory.join('>');
        if (root.dataset) {
          root.dataset.tapInitStage = stableStage;
          root.dataset.tapInitStageHistory = historyText;
        } else {
          root.setAttribute('data-tap-init-stage', stableStage);
          root.setAttribute('data-tap-init-stage-history', historyText);
        }
      } catch (err) {
        // ignore
      }
    }
    markInitStage('app-script-start');
    const appUtils = window.app.utils || {};
    const appConfig = window.app.config || {};
    window.app.config = appConfig;

    const configContext = window.app.appConfigContext.create(appConfig);
    const {
      providerDefaults,
      defaultPrompts,
      defaultPromptsKey,
      defaultMaxTokens,
      legacyCleanKey,
      legacyCompareKey,
      modelsKey,
      assignmentKey,
      activeTabKey,
      workflowStorageKey,
      tempExecStorageKey,
      tempExecFocusStorageKey,
      tempExecPageSizeStorageKey,
      defaultTempExecPageSize,
      tempExecResultOptions,
      defaultPlacement,
      defaultTempExecColumns,
      defaultSettings,
      settingsKey,
      minModelTimeoutSec,
      maxModelTimeoutSec,
      defaultCaseViewFontSize,
      minCaseViewFontSize,
      maxCaseViewFontSize,
      legacyCasesPrompt,
      legacyCleanPrompt,
      legacyCaseGenPrompt,
      cleanHighlightColors,
      moduleFieldAliases,
      cleanedEntryFieldAliases,
      cleanedDescriptionFieldAliases,
    } = configContext;

    const stateManager = window.app.stateManager || {};
    const state = typeof stateManager.initState === 'function'
      ? stateManager.initState({
          defaultSettings,
          defaultPlacement,
          defaultTempExecPageSize,
        })
      : (window.app.state || {});
    window.app.state = state;
    if (!state.requirementLabel) {
      state.requirementLabel = '当前需求';
      state.requirementLabelSource = state.requirementLabelSource || 'default';
    }
    const appInitHelpers = window.app.appInitHelpers || {};
    if (!appInitHelpers.createFallbacks) {
      throw new Error('appInitHelpers 未加载');
    }
    const appApi = appInitHelpers.createFallbacks({ defaultTempExecPageSize });
    const api = appApi;
    const proxyApi = function(name) {
      const wrapper = function() {
        if (api && typeof api[name] === 'function') {
          return api[name].apply(null, arguments);
        }
        return api ? api[name] : undefined;
      };
      wrapper.__appProxy = name;
      return wrapper;
    };
    const apiProxy = new Proxy({}, {
      get: function(_, prop) {
        return proxyApi(prop);
      },
    });
    const {
      refreshMissingSmartFillButton,
      updateMissingView,
      toggleMissingView,
      copyMissingJson,
      syncReviewViewFromResult,
      renderCaseGeneration,
      renderCaseTable,
      renderAutoRawInfo,
      renderCleanRawView,
      renderImportedCaseList,
      removeImportedCase,
      hasImportedCases,
      hasCaseSource,
      getImportedCaseObjects,
      syncCaseTextWithImports,
      toggleImportedCaseView,
      buildCasesComparePayload,
      buildReviewClarificationContext,
      resetImportedCaseView,
      refreshImportedCaseView,
      handleCaseFiles,
      updateAutoCompareActions,
      updateAutoMissingCard,
      syncAutoCompareStatus,
      exportCompareResult,
      importCompareResult,
      handleMissingSelectionChange,
      handleMissingSelectAll,
      smartFillMissingSuggestions,
      updateAutoClarifyVisibility,
      ensureCaseGenModulesFromSplit,
      exportCasesCoverage,
      importCasesCoverage,
      compareCoverage,
      compareCasesCoverage,
      extractCompareResultData,
      extractCoverageFromCompareResult,
      goCasesGenAndScroll,
      runCleaning,
      copyCleaned,
      syncSplitView,
      toggleSplitView,
      shouldExpectCleanJson,
      getCleanedTextForModel,
      renderCleanView,
      locateCleanRawSelection,
      jumpToCleanHighlightView,
      renderTempExecView,
      applyTempExecPageSize,
      clampTempExecPageSize,
      createTempExecFile,
      syncTempExecFocus,
      persistTempExecState,
      setTempExecActive,
      removeTempExecFile,
      getCaseExecutionDisplay,
      renderCaseGenProgressBoard,
      setCaseModuleRunning,
      isCaseModuleRunning,
      renderCaseModuleProgress,
      updateCaseProgressView,
      clearCaseProgress,
      initCaseProgress,
      setCaseProgressGroupState,
      setCaseProgressStep,
      markAllCaseProgressGroups,
      updateFlowStatus,
      scrollToSection,
      refreshExportCaseGenButton,
      setCaseViewHint,
    } = apiProxy;
    const buildDom = appInitHelpers.buildDom || function(ids, alias) {
      const result = {};
      (ids || []).forEach(function(id) { result[id] = document.getElementById(id); });
      (alias || []).forEach(function(item) {
        if (item && item.name) result[item.name] = document.getElementById(item.id || item.name);
      });
      return result;
    };
    const assignIfPresent = appInitHelpers.assignIfPresent || function(target, source, keys) {
      if (!target || !source) return target;
      (keys || []).forEach(function(key) {
        const val = source && source[key];
        if (!val || (val && val.__appProxy && val.__appProxy === key)) return;
        target[key] = val;
      });
      return target;
    };
    const baseInitModule = appInitHelpers.initModule || function(name, args) {
      const mod = window.app && window.app[name];
      return mod && typeof mod.init === 'function' ? mod.init(args || {}) : null;
    };
    const initModule = function(name, args) {
      try {
        return baseInitModule(name, args);
      } catch (err) {
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
          console.warn('模块初始化失败: ' + name, err);
        }
        return null;
      }
    };
    let switchTab = function(name) {
      if (api && typeof api.switchTab === 'function') return api.switchTab(name);
      return null;
    };
    var persistWorkflowState = function() {};
    var persistWorkflowStateNow = function() {};
    function requestPersistWorkflowState() {
      return persistWorkflowState();
    }
    function requestPersistWorkflowStateNow() {
      return persistWorkflowStateNow();
    }

    function clampTimeoutSeconds(value) {
      const num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultSettings.timeoutSec;
      return Math.min(maxModelTimeoutSec, Math.max(minModelTimeoutSec, num));
    }

    const setStatus = appUtils.setStatus;

    function updateModelTiming(el, durationMs) {
      if (!el) return;
      if (!Number.isFinite(durationMs)) {
        el.textContent = '--';
      } else {
        el.textContent = (durationMs / 1000).toFixed(2);
      }
    }

    const debounce = appUtils.debounce;

    const downloadBlob = appUtils.downloadBlob;
    const downloadText = appUtils.downloadText;
    const stripCodeFence = appUtils.stripCodeFence;
    const extractJsonPayload = appUtils.extractJsonPayload;
    const formatJsonOrText = appUtils.formatJsonOrText;
    const extractJsonObjects = appUtils.extractJsonObjects;
    const sanitizeCasesForExport = appUtils.sanitizeCasesForExport;
    const escapeHtml = appUtils.escapeHtml;
    const escapeHtmlPreserve = appUtils.escapeHtmlPreserve;
    const runConcurrent = appUtils.runConcurrent;

    const assignHandlersModule = initModule('assignHandlers', {
      state,
      defaultPrompts,
      storageKey: defaultPromptsKey,
      setStatus,
      downloadText,
    });
    const assignHandlersFallback = {
      loadCustomDefaultPrompts: function noopLoadPrompts() {},
      saveDefaultPrompts: function noopSavePrompts() {},
      exportDefaultPrompts: function noopExportPrompts() {},
      importDefaultPrompts: async function noopImportPrompts() {},
    };
    const {
      loadCustomDefaultPrompts,
      saveDefaultPrompts,
      exportDefaultPrompts,
      importDefaultPrompts,
    } = assignHandlersModule || assignHandlersFallback;
    loadCustomDefaultPrompts();

    const requirementCoreModule = initModule('requirementCore', {
      state,
      utils: { stripCodeFence },
      handlers: { renderAutoRawInfo: function renderAutoRawInfoProxy() { renderAutoRawInfo(); } },
    });
    if (!requirementCoreModule) {
      throw new Error('requirementCore 未加载');
    }
    const requirementApi = requirementCoreModule;
    const {
      normalizeRequirementName,
      stripRequirementHeader,
      setRequirementLabel,
      getRequirementLabel,
      buildRequirementPrompt,
      ensureRequirementLabel,
      promptRequirementLabel,
      promptTempExecRequirement,
      formatCompactTimestamp,
      wrapDataWithRequirement,
      unwrapRequirementPayload,
      extractRequirementLabelFromText,
      wrapTextWithRequirement,
      getRequirementDisplayName,
      getSafeRequirementSlug,
    } = requirementApi;
    window.app.setRequirementLabel = setRequirementLabel;
    window.app.getRequirementLabel = getRequirementLabel;
    window.app.ensureRequirementLabel = ensureRequirementLabel;

    const splitCore = window.app && window.app.splitCore && typeof window.app.splitCore.init === 'function'
      ? window.app.splitCore.init({ moduleFieldAliases, normalizeRequirementName, unwrapRequirementPayload, stripCodeFence })
      : null;
    const pickFirstString = splitCore && splitCore.pickFirstString ? splitCore.pickFirstString : function pickFirstStringFallback() { return ''; };
    const pickFirstValue = splitCore && splitCore.pickFirstValue ? splitCore.pickFirstValue : function pickFirstValueFallback() { return undefined; };
    const pickFirstArray = splitCore && splitCore.pickFirstArray ? splitCore.pickFirstArray : function pickFirstArrayFallback() { return []; };

    const cleanCore = window.app && window.app.cleanCore && typeof window.app.cleanCore.init === 'function'
      ? window.app.cleanCore.init({
        unwrapRequirementPayload,
        extractJsonObjects,
        cleanedEntryFieldAliases,
        cleanedDescriptionFieldAliases,
        pickFirstValue,
        pickFirstString,
      })
        : null;


    const modelRuntime = window.app.modelRuntime.create({
      state: state,
      defaultSettings: defaultSettings,
      defaultPrompts: defaultPrompts,
      defaultMaxTokens: defaultMaxTokens,
      clampTimeoutSeconds: clampTimeoutSeconds,
      stripCodeFence: stripCodeFence,
      modelClientService: window.app && window.app.services && window.app.services.modelClient,
    });
    const {
      callModelWithConfig,
      callModelWithContent,
      abortAllModelRequests,
      abortModelRequestsByOwner,
      getLastModelError,
      clearLastModelError,
      getConfiguredTimeoutSec,
    } = modelRuntime;

    const missingReminderAiManager = window.app.missingReminderAiManager.init({
      utils: appUtils,
      callModelWithConfig: callModelWithConfig,
    });
    window.app.missingReminderAi = missingReminderAiManager;

    const caseLibraryAiGenManager = window.app.caseLibraryAiGenManager.init({
      utils: appUtils,
      callModelWithConfig: callModelWithConfig,
    });
    window.app.caseLibraryAiGen = caseLibraryAiGenManager;
    if (caseLibraryAiGenManager && typeof caseLibraryAiGenManager.resumeTasks === 'function') {
      caseLibraryAiGenManager.resumeTasks({ force: true });
    }

    const xmindCaseGenTaskManager = window.app.xmindCaseGenTaskManagerModule.init({
      callModelWithConfig: callModelWithConfig,
      callModelWithContent: callModelWithContent,
      abortRequestsByOwner: abortModelRequestsByOwner,
      getTimeoutSec: getConfiguredTimeoutSec,
      requestSchedulerCore: window.app && window.app.xmindRequestSchedulerCore
        ? window.app.xmindRequestSchedulerCore
        : null,
    });
    window.app.xmindCaseGenTaskManager = xmindCaseGenTaskManager;

    const domContext = window.app.appDomContext.create({
      root: window,
      domConfig: window.app.domConfig || {},
      buildDom: buildDom,
    });
    const { dom, debugNodes } = domContext;
    var reviewResultEl = dom.reviewResultEl;
    var cleanedTextEl = dom.cleanedTextEl;
    var compareResultEl = dom.compareResultEl;
    var splitResultEl = dom.splitResultEl;
    var casesCompareResultEl = dom.casesCompareResultEl;

    const settingsModule = initModule('settings', {
      state,
      config: {
        defaultSettings,
        defaultTempExecColumns,
        defaultTempExecPageSize,
        defaultCaseViewFontSize,
        minCaseViewFontSize,
        maxCaseViewFontSize,
        settingsKey,
        minModelTimeoutSec,
        maxModelTimeoutSec,
      },
      utils: appUtils,
      setStatus,
      clampTimeoutSeconds,
      clampTempExecPageSize: function(value) { return api.clampTempExecPageSize(value); },
      renderTempExecView: proxyApi('renderTempExecView'),
      applyTempExecPageSize: function(value) { return api.applyTempExecPageSize(value); },
    });
    const {
      loadSettings,
      persistSettings,
      renderSettingsUI,
      renderTempExecColumnSettings,
      saveTimeoutSetting,
      saveFeishuWebhookConfig,
      testFeishuWebhookConfig,
      saveTempExecColumnsSetting,
      getFeishuWebhookUrl,
      getFeishuMentionId,
      postFeishuMessage,
      ensureTempExecColumns,
    } = settingsModule || {
      loadSettings: function noopLoad() {},
      persistSettings: function noopPersist() {},
      renderSettingsUI: function noopRender() {},
      renderTempExecColumnSettings: function noopRenderCols() {},
      saveTimeoutSetting: function noopSaveTimeout() {},
      saveFeishuWebhookConfig: function noopSaveFeishu() {},
      testFeishuWebhookConfig: function noopTestFeishu() {},
      saveTempExecColumnsSetting: function noopSaveCols() {},
      getFeishuWebhookUrl: function noopGetWebhook() { return ''; },
      getFeishuMentionId: function noopGetMention() { return ''; },
      postFeishuMessage: async function noopPost() { return { ok: false, reason: 'settings module missing' }; },
      ensureTempExecColumns: function fallbackEnsure() { return { ...defaultTempExecColumns }; },
    };
    loadSettings();
    markInitStage('settings-loaded');
    initModule('memoPad', {
      state: state,
      dom: dom,
      utils: appUtils,
      confirmDrawer: window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null,
      persistSettings: persistSettings,
    });

    const defaultScrollOffset = 200;
    const scrollElementIntoView = function(el, behavior, offset) {
      if (!el) return;
      appUtils.scrollElementIntoView(el, behavior || 'smooth', offset === undefined ? defaultScrollOffset : offset);
    };

    const modelsModule = window.app.models && typeof window.app.models.init === 'function'
      ? window.app.models.init({
        state,
        config: {
          defaultPrompts,
          defaultMaxTokens,
          legacyCleanPrompt,
          legacyCaseGenPrompt,
          legacyCasesPrompt,
          providerDefaults,
          modelsKey,
          assignmentKey,
          legacyCleanKey,
          legacyCompareKey,
        },
        setStatus,
      })
      : null;

    const {
      loadModels,
      saveModels,
      renderModels,
      resetModelForm,
      fillModelForm,
      deleteModel,
      renderAssignmentsSelect,
      updateAssignmentStatuses,
      loadAssignments,
      saveAssignments,
      updateReasoningVisibility,
      getReasoningForType,
      getTemperatureForType,
      getAssignedModel,
      testModel,
      saveModel,
    } = modelsModule || {};
    markInitStage('models-module-ready');

    const requirementMediaContextController = window.app.requirementMediaContextController.create({
      state: state,
      dom: dom,
      getAssignedModel: getAssignedModel,
    });
    const updateRequirementMediaContextHints = requirementMediaContextController.update;

    const workflowStepStateController = window.app.workflowStepStateController.create({
      state: state,
      api: api,
      updateFlowStatusWithValidation: function() { return updateFlowStatusWithValidation(); },
    });
    const {
      ensureInProgressMap,
      ensureWaitingMap,
      ensureWaitingReasonMap,
      ensureFailedMap,
      ensureFailedReasonMap,
      ensureValidationFailedMap,
      ensureValidationFailedReasonMap,
      triggerUpdateFlowStatus,
      setStepWaiting,
      clearStepWaiting,
      clearAllWaitingSteps,
      setStepFailed,
      clearStepFailed,
      clearAllFailedSteps,
      setStepInProgress,
      clearStepInProgress,
      isStepLocked,
    } = workflowStepStateController;

    const parseSplitModules = function() {
      if (splitCore && splitCore.parseSplitModules && dom.splitResultEl) {
        return splitCore.parseSplitModules(dom.splitResultEl.value, setRequirementLabel);
      }
      return [];
    };

    const splitRuntime = splitCore && splitCore.createSplitRuntime
      ? splitCore.createSplitRuntime({
        state,
        config: { defaultPrompts },
        dom: dom,
        handlers: {
          setStatus,
          setStepInProgress,
          clearStepInProgress,
          updateFlowStatus: proxyApi('updateFlowStatus'),
          hasImportedCases: proxyApi('hasImportedCases'),
          getImportedCaseObjects: proxyApi('getImportedCaseObjects'),
          openConfirmDrawer: appUtils.openConfirmDrawer,
          scrollToSection: proxyApi('scrollToSection'),
          switchTab: function(name) { return switchTab(name); },
          ensureRequirementLabel,
          getCleanedTextForModel: proxyApi('getCleanedTextForModel'),
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          updateModelTiming,
          parseSplitModules: function() { return parseSplitModules(); },
          refreshMissingSmartFillButton: proxyApi('refreshMissingSmartFillButton'),
          renderCaseGenProgressBoard: proxyApi('renderCaseGenProgressBoard'),
          syncSplitView: proxyApi('syncSplitView'),
        },
      })
      : null;
    if (splitRuntime && splitRuntime.splitModules) api.splitModules = splitRuntime.splitModules;
    if (splitRuntime && splitRuntime.ensureCaseGenModulesFromSplit) api.ensureCaseGenModulesFromSplit = splitRuntime.ensureCaseGenModulesFromSplit;
    if (splitRuntime && splitRuntime.applySplitResultText) {
      api.applySplitResultText = splitRuntime.applySplitResultText;
      window.app.applySplitResultText = splitRuntime.applySplitResultText;
    }
    window.app.splitModules = api.splitModules;
    window.app.ensureCaseGenModulesFromSplit = api.ensureCaseGenModulesFromSplit;
    window.app.parseSplitModules = parseSplitModules;

    const flowCore = window.app.flowCore && typeof window.app.flowCore.init === 'function'
      ? window.app.flowCore.init({
        state,
        handlers: {
          switchTab: function(name) { return switchTab(name); },
          scrollElementIntoView,
          hasCaseSource: function() { return api.hasCaseSource(); },
        },
      })
      : null;
    const renderFlowStatus = flowCore && flowCore.updateFlowStatus ? flowCore.updateFlowStatus : function noopFlowStatus() {};
    function updateFlowStatusWithValidation() {
      validateFlowData();
      renderFlowStatus();
      updateRequirementMediaContextHints();
      requestPersistWorkflowState();
    }
    if (flowCore && flowCore.updateFlowStatus) api.updateFlowStatus = updateFlowStatusWithValidation;
    if (flowCore && flowCore.scrollToSection) api.scrollToSection = flowCore.scrollToSection;
    if (flowCore && flowCore.refreshExportCaseGenButton) api.refreshExportCaseGenButton = flowCore.refreshExportCaseGenButton;
    if (flowCore && flowCore.setCaseViewHint) api.setCaseViewHint = flowCore.setCaseViewHint;

    const assignModule = window.app.assign && typeof window.app.assign.init === 'function'
      ? window.app.assign.init({
        state,
        utils: appUtils,
        debounce: appUtils.debounce,
        setStatus,
        updateAssignmentStatuses,
        updateReasoningVisibility,
        renderAssignmentsSelect,
        saveAssignments,
        testModel,
        updateFlowStatus: proxyApi('updateFlowStatus'),
      })
      : null;
    const compareCore = window.app && window.app.compareCore && typeof window.app.compareCore.init === 'function'
      ? window.app.compareCore.init({
        stripCodeFence,
        extractJsonPayload,
        unwrapRequirementPayload,
        state,
        setStatus,
        config: { defaultPrompts },
        utils: { escapeHtml },
        handlers: {
          updateAutoMissingCard: proxyApi('updateAutoMissingCard'),
          ensureRequirementLabel,
          getSafeRequirementSlug,
          downloadText,
          wrapTextWithRequirement,
          promptRequirementLabel,
          setRequirementLabel,
          updateFlowStatus: proxyApi('updateFlowStatus'),
          wrapDataWithRequirement,
          extractRequirementLabelFromText,
          resetAutoCompareUserInputs: proxyApi('resetAutoCompareUserInputs'),
          syncAutoCompareStatus: proxyApi('syncAutoCompareStatus'),
          getCleanedTextForModel: proxyApi('getCleanedTextForModel'),
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          updateModelTiming,
          formatJsonOrText,
          buildCasesComparePayload: proxyApi('buildCasesComparePayload'),
          parseSplitModules,
          setStepInProgress,
          clearStepInProgress,
          runConcurrent,
          ensureCaseGenModulesFromSplit: api.ensureCaseGenModulesFromSplit,
          persistWorkflowState: requestPersistWorkflowState,
          persistWorkflowStateNow: requestPersistWorkflowStateNow,
        },
      })
      : null;
    const compareApi = compareCore || {};
    const clampCoveragePercent = compareApi.clampCoveragePercent || function(value) {
      const num = Number(value);
      if (!Number.isFinite(num)) return null;
      return Math.max(0, Math.min(100, Math.round(num)));
    };
    const buildSingleModulePayload = compareApi.buildSingleModulePayload || function(module, idx) {
      return {
        json: '',
        title: module && module.title ? module.title : `模块${idx + 1}`,
      };
    };
    const aggregateModuleCompareResults = compareApi.aggregateModuleCompareResults || function() { return { coverage: null, missing: [], extra: [] }; };
    const parseModuleCompareResponse = compareApi.parseModuleCompareResponse || function(content, moduleTitle) {
      const payload = extractJsonPayload(stripCodeFence(content));
      const data = payload ? JSON.parse(payload) : {};
      return { module: moduleTitle, coverage: clampCoveragePercent(data.coverage), missing: data.missing || [], extra: data.extra || [] };
    };
    const formatMissingRequirement = compareApi.formatMissingRequirement || function(item) {
      if (item === undefined || item === null) return '-';
      if (typeof item === 'string') return item.trim() || '-';
      return String(item);
    };
    const isCoveragePayload = compareApi.isCoveragePayload || function(data) {
      return !!(data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'coverage'));
    };
    const parseMissingModules = compareApi.parseMissingModules || api.emptyArr;
    const buildMissingRows = compareApi.buildMissingRows || api.emptyArr;
    const pickMissingSelections = compareApi.pickMissingSelections || api.emptyArr;
    const workflowValidationController = window.app.workflowValidationController.create({
      dom: dom,
      api: api,
      ensureValidationFailedMap: ensureValidationFailedMap,
      ensureValidationFailedReasonMap: ensureValidationFailedReasonMap,
      isStepLocked: isStepLocked,
      unwrapRequirementPayload: unwrapRequirementPayload,
      stripRequirementHeader: stripRequirementHeader,
      shouldExpectCleanJson: shouldExpectCleanJson,
      isCoveragePayload: isCoveragePayload,
      clampCoveragePercent: clampCoveragePercent,
      parseSplitModules: parseSplitModules,
      hasCaseSource: hasCaseSource,
    });
    const validateFlowData = workflowValidationController.validateFlowData;
    assignIfPresent(api, compareApi, [
      'refreshMissingSmartFillButton',
      'updateMissingView',
      'toggleMissingView',
      'refreshMissingSelectionUI',
      'handleMissingSelectionChange',
      'handleMissingSelectAll',
      'copyMissingJson',
      'exportCasesCoverage',
      'importCasesCoverage',
      'exportCompareResult',
      'importCompareResult',
      'compareCoverage',
      'compareCasesCoverage',
      'extractCompareResultData',
      'extractCoverageFromCompareResult',
    ]);

    const debugCore = window.app && window.app.debugCore && typeof window.app.debugCore.init === 'function'
      ? window.app.debugCore.init({
        state,
        debugNodes,
        dom,
        skipAutoBind: true,
        handlers: {
          setStatus,
          extractRequirementLabelFromText,
          promptRequirementLabel,
          getRequirementLabel,
          setRequirementLabel,
          stripRequirementHeader,
          wrapTextWithRequirement,
          renderAutoRawInfo: proxyApi('renderAutoRawInfo'),
          renderCleanView: proxyApi('renderCleanView'),
          renderCleanRawView: proxyApi('renderCleanRawView'),
          renderCaseGeneration: proxyApi('renderCaseGeneration'),
          renderCaseGenProgressBoard: proxyApi('renderCaseGenProgressBoard'),
          refreshMissingSmartFillButton: proxyApi('refreshMissingSmartFillButton'),
          syncCaseTextWithImports: proxyApi('syncCaseTextWithImports'),
          renderImportedCaseList: proxyApi('renderImportedCaseList'),
          resetImportedCaseView: proxyApi('resetImportedCaseView'),
          setCaseViewHint: proxyApi('setCaseViewHint'),
          updateFlowStatus: proxyApi('updateFlowStatus'),
        },
        utils: { downloadText, stripCodeFence },
      })
      : null;
    if (debugCore) {
      assignIfPresent(api, debugCore, ['saveDebugText', 'importDebugText', 'bindDebugControls']);
      api.bindDebugControls('raw', dom.saveRawDebugBtn, dom.importRawDebugBtn, dom.rawDebugFileInput);
      api.bindDebugControls('cleaned', dom.saveCleanDebugBtn, dom.importCleanDebugBtn, dom.cleanDebugFileInput);
      api.bindDebugControls('split', dom.saveSplitDebugBtn, dom.importSplitDebugBtn, dom.splitDebugFileInput);
      api.bindDebugControls('cases', dom.saveCaseDebugBtn, dom.importCaseDebugBtn, dom.caseDebugFileInput);
    }
    const reviewCoreModule = window.app.reviewCore && typeof window.app.reviewCore.init === 'function'
      ? window.app.reviewCore.init({
        state,
        defaultPrompts,
        setStatus,
        escapeHtml,
        escapeHtmlPreserve,
        dom,
        handlers: {
          ensureRequirementLabel,
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          callModelWithContent,
          updateModelTiming,
          wrapTextWithRequirement,
          formatJsonOrText,
          stripCodeFence,
          unwrapRequirementPayload,
          extractRequirementLabelFromText,
          setRequirementLabel,
          promptRequirementLabel,
          stripRequirementHeader,
          isCoveragePayload,
          downloadText,
          getSafeRequirementSlug,
          updateFlowStatus,
          setStepInProgress,
          clearStepInProgress,
          persistWorkflowState: requestPersistWorkflowState,
        },
      })
      : null;
    assignIfPresent(api, reviewCoreModule, [
      'reviewRequirements',
      'copyReviewResult',
      'exportReviewResult',
      'importReviewResult',
      'toggleReviewView',
      'confirmClarifications',
      'handleClarifyClickEvent',
      'handleClarifyChangeEvent',
      'handleClarifyInputEvent',
      'updateAutoClarifyVisibility',
      'renderAutoClarifyView',
      'openAutoClarifyPanel',
      'closeAutoClarifyPanel',
      'toggleAutoClarifyPanel',
      'handleAutoClarifyConfirm',
      'waitForAutoClarification',
      'syncReviewViewFromResult',
      'buildReviewClarificationContext',
    ]);
    const reviewModule = window.app.review && typeof window.app.review.init === 'function'
      ? window.app.review.init({
        state,
        handlers: {
          reviewRequirements: proxyApi('reviewRequirements'),
          copyReviewResult: proxyApi('copyReviewResult'),
          exportReviewResult: proxyApi('exportReviewResult'),
          importReviewResult: proxyApi('importReviewResult'),
          toggleReviewView: proxyApi('toggleReviewView'),
          confirmClarifications: proxyApi('confirmClarifications'),
          handleClarifyClickEvent: proxyApi('handleClarifyClickEvent'),
          handleClarifyChangeEvent: proxyApi('handleClarifyChangeEvent'),
          handleClarifyInputEvent: proxyApi('handleClarifyInputEvent'),
          updateAutoClarifyVisibility: proxyApi('updateAutoClarifyVisibility'),
          toggleAutoClarifyPanel: proxyApi('toggleAutoClarifyPanel'),
          handleAutoClarifyConfirm: proxyApi('handleAutoClarifyConfirm'),
        },
        dom,
      })
      : null;
    [dom.reviewTimingEl, dom.cleanTimingEl, dom.compareTimingEl, dom.splitTimingEl, dom.casesTimingEl, dom.caseGenTimingEl].forEach(el => updateModelTiming(el));

    if (dom.exportCaseGenBtn) dom.exportCaseGenBtn.disabled = true;

    const casesCore = window.app && window.app.casesCore && typeof window.app.casesCore.init === 'function'
      ? window.app.casesCore.init({
        deps: { extractJsonObjects },
        state,
        dom,
        handlers: {
          setStatus,
          setCaseViewHint: proxyApi('setCaseViewHint'),
          updateFlowStatus: proxyApi('updateFlowStatus'),
          refreshImportedCaseView: proxyApi('refreshImportedCaseView'),
          renderCaseTable: proxyApi('renderCaseTable'),
          setStepInProgress,
          clearStepInProgress,
          ensureRequirementLabel,
          parseXmindFile: function(file) {
            const parser = typeof parseXmindFile === 'function'
              ? parseXmindFile
              : (window.app && window.app.xmindCore && typeof window.app.xmindCore.parseXmindFile === 'function'
                ? window.app.xmindCore.parseXmindFile
                : null);
            return parser ? parser(file) : Promise.resolve({ text: '', list: [] });
          },
          extractRequirementLabelFromText,
          setRequirementLabel,
        },
        utils: { escapeHtml },
      })
      : null;
    if (casesCore) {
      window.app.casesCoreApi = casesCore;
    }
    const parseCaseList = casesCore && casesCore.parseCaseList
      ? casesCore.parseCaseList
      : function missingParseCaseList() { throw new Error('casesCore.parseCaseList 不可用'); };
    const deriveCaseListFromText = casesCore && casesCore.deriveCaseListFromText
      ? casesCore.deriveCaseListFromText
      : function missingDeriveCaseList() { throw new Error('casesCore.deriveCaseListFromText 不可用'); };
    assignIfPresent(api, casesCore, [
      'renderImportedCaseList',
      'addImportedCase',
      'removeImportedCase',
      'hasImportedCases',
      'hasCaseSource',
      'getCombinedCaseList',
      'getCombinedCaseText',
      'getImportedCaseObjects',
      'syncCaseTextWithImports',
      'syncImportedCaseStatus',
      'resetImportedCaseView',
      'refreshImportedCaseView',
      'toggleImportedCaseView',
      'buildCasesComparePayload',
      'importCaseFiles',
    ]);
    if (api.importCaseFiles) {
      api.handleCaseFiles = function handleCaseFilesProxy() {
        return api.importCaseFiles.apply(null, arguments);
      };
    }

    const generateTempExecId = appUtils.generateTempExecId;
    const generateTempVersionId = appUtils.generateTempVersionId;
    const normalizeTempExecName = appUtils.normalizeTempExecName;
    const stringifyCaseField = appUtils.stringifyCaseField;
    const buildMissingReminderKeywords = appUtils.buildMissingReminderKeywords;
    const normalizeMissingReminderMatchConfig = appUtils.normalizeMissingReminderMatchConfig;
    const removePendingTempExecByName = appUtils.removePendingTempExecByName;

    const ensureTempExecReplacement = function ensureTempExecReplacementProxy(entry, pendingList) {
      if (appUtils.ensureTempExecReplacement) {
        return appUtils.ensureTempExecReplacement(entry, {
          existingList: state.tempExecFiles,
          pendingList: pendingList || [],
          normalizeName: normalizeTempExecName,
          removeExisting: proxyApi('removeTempExecFile'),
          removePending: removePendingTempExecByName,
          confirmFn: window.confirm,
        });
      }
      const normalized = normalizeTempExecName(entry && entry.name);
      const pending = pendingList || [];
      const duplicates = state.tempExecFiles.filter(file => normalizeTempExecName(file && file.name) === normalized);
      const pendingDuplicates = pending.filter(item => normalizeTempExecName(item && item.name) === normalized);
      if (duplicates.length || pendingDuplicates.length) {
        const confirmMsg = `检测到名称为【${entry ? entry.name : ''}】的用例已存在，替换将清除原有执行结果，是否继续？`;
        if (!window.confirm(confirmMsg)) return false;
        duplicates.forEach(file => api.removeTempExecFile(file && file.id));
        removePendingTempExecByName(pending, entry && entry.name);
      }
      return true;
    };

    const autoCoreModule = window.app && window.app.autoCore && typeof window.app.autoCore.init === 'function'
      ? window.app.autoCore.init({
        state,
        dom,
        handlers: {
          setStatus,
          setStepWaiting,
          clearStepWaiting,
          clearAllWaitingSteps,
          setStepFailed,
          clearStepFailed,
          clearAllFailedSteps,
          updateFlowStatus,
          parseMissingModules,
          buildMissingRows,
          pickMissingSelections,
          scrollElementIntoView,
          switchTab,
          goToCaseGeneration: proxyApi('goToCaseGeneration'),
          ensureCaseGenModulesFromSplit,
          renderCaseGeneration: proxyApi('renderCaseGeneration'),
          setCaseGenViewTab: proxyApi('setCaseGenViewTab'),
          syncLegacyCaseGenState: proxyApi('syncLegacyCaseGenState'),
          getRequirementLabel,
          getFeishuWebhookUrl,
          postFeishuMessage,
          reviewRequirements: proxyApi('reviewRequirements'),
          runCleaning: proxyApi('runCleaning'),
          compareCoverage: proxyApi('compareCoverage'),
          splitModules: proxyApi('splitModules'),
          compareCasesCoverage: proxyApi('compareCasesCoverage'),
          extractCoverageFromCompareResult: proxyApi('extractCoverageFromCompareResult'),
          extractCompareResultData: proxyApi('extractCompareResultData'),
          formatMissingRequirement,
          shouldExpectCleanJson: proxyApi('shouldExpectCleanJson'),
          hasCaseSource: proxyApi('hasCaseSource'),
          scrollToSection: proxyApi('scrollToSection'),
          renderAutoClarifyView: proxyApi('renderAutoClarifyView'),
          openAutoClarifyPanel: proxyApi('openAutoClarifyPanel'),
          waitForAutoClarification: proxyApi('waitForAutoClarification'),
          updateAutoClarifyVisibility: proxyApi('updateAutoClarifyVisibility'),
          jumpToCleanHighlightView: proxyApi('jumpToCleanHighlightView'),
          persistWorkflowState: requestPersistWorkflowState,
        },
        utils: { escapeHtml },
      })
      : null;
    assignIfPresent(api, autoCoreModule, [
      'notifyFeishuWorkflowSuccess',
      'notifyFeishuCoverageFailure',
      'notifyFeishuClarificationNeeded',
      'resetAutoMissingView',
      'refreshAutoMissingSelectionUI',
      'updateAutoMissingCard',
      'toggleAutoMissingView',
      'ensureAutoMissingViewVisible',
      'copyAutoMissingJson',
      'handleMissingSelectionChange',
      'handleMissingSelectAll',
      'smartFillMissingSuggestions',
      'resetAutoCompareMissingView',
      'resetAutoCompareUserInputs',
      'renderAutoCompareMissingView',
      'toggleAutoCompareView',
      'buildFilteredComparePayload',
      'updateAutoCompareActions',
      'syncAutoCompareStatus',
      'buildAutoWorkflowSteps',
      'executeAutoWorkflowSteps',
      'enforceAutoCoverageRequirement',
      'runAutoWorkflow',
      'runAutoWorkflowFromClean',
      'continueAutoWorkflowAfterCoverage',
      'cancelAutoWorkflow',
      'applyAutoWorkflowTaskState',
    ]);

    const autoWorkflowManager = window.app.autoWorkflowManagerModule.init({
      getSteps: function() {
        return autoCoreModule && typeof autoCoreModule.buildAutoWorkflowSteps === 'function'
          ? autoCoreModule.buildAutoWorkflowSteps()
          : [];
      },
      canRun: function() {
        return autoCoreModule && typeof autoCoreModule.isAutoWorkflowReady === 'function'
          ? autoCoreModule.isAutoWorkflowReady()
          : true;
      },
      persistWorkflowStateNow: requestPersistWorkflowStateNow,
      getLastModelError: getLastModelError,
      clearLastModelError: clearLastModelError,
      abortModelRequests: abortAllModelRequests,
    });
    window.app.autoWorkflowManager = autoWorkflowManager;

    const taskLifecycleController = window.app.appTaskLifecycleController.create({
      root: window,
      state: state,
      missingReminderAiManager: missingReminderAiManager,
      autoWorkflowManager: autoWorkflowManager,
      applyAutoWorkflowTaskState: autoCoreModule && autoCoreModule.applyAutoWorkflowTaskState,
      loadModels: loadModels,
      loadAssignments: loadAssignments,
    });
    const syncAutoWorkflowTaskState = taskLifecycleController.syncAutoWorkflowTaskState;
    const casesGenCoreModule = window.app && window.app.casesGenCore && typeof window.app.casesGenCore.init === 'function'
      ? window.app.casesGenCore.init({
        state,
        dom,
        setStatus,
        utils: {
          escapeHtml,
          escapeHtmlPreserve,
          stringifyCaseField,
        },
        handlers: {
          downloadText,
          downloadBlob,
          stripCodeFence,
          unwrapRequirementPayload,
          extractRequirementLabelFromText,
          promptRequirementLabel,
          setRequirementLabel,
          ensureRequirementLabel,
          getRequirementLabel,
          getCleanedTextForModel: proxyApi('getCleanedTextForModel'),
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          updateModelTiming,
          runConcurrent,
          hasImportedCases: proxyApi('hasImportedCases'),
          getImportedCaseObjects: proxyApi('getImportedCaseObjects'),
          addImportedCase: proxyApi('addImportedCase'),
          renderImportedCaseList: proxyApi('renderImportedCaseList'),
          refreshImportedCaseView: proxyApi('refreshImportedCaseView'),
          syncCaseTextWithImports: proxyApi('syncCaseTextWithImports'),
          getTempExecFiles: function() { return state.tempExecFiles || []; },
          normalizeTempExecCases: function(list, fileId) {
            if (tempExecApi && typeof tempExecApi.normalizeTempExecCases === 'function') {
              return tempExecApi.normalizeTempExecCases(list, fileId);
            }
            return list;
          },
          deriveCaseListFromText,
          buildXmindPackageFromCases: function() {
            const impl = window.app && window.app.xmindCore && window.app.xmindCore.buildXmindPackageFromCases
              ? window.app.xmindCore.buildXmindPackageFromCases
              : (typeof buildXmindPackageFromCases === 'function' ? buildXmindPackageFromCases : null);
            if (!impl) return null;
            return impl.apply(null, arguments);
          },
          createTempExecFile: proxyApi('createTempExecFile'),
          ensureTempExecReplacement,
          syncTempExecFocus: proxyApi('syncTempExecFocus'),
          persistTempExecState: proxyApi('persistTempExecState'),
          setTempExecActive: proxyApi('setTempExecActive'),
          renderTempExecView: proxyApi('renderTempExecView'),
          switchTab,
          scrollElementIntoView,
          renderCaseGenProgressBoard: proxyApi('renderCaseGenProgressBoard'),
          renderCaseModuleProgress: proxyApi('renderCaseModuleProgress'),
          updateCaseProgressView: function(moduleId) { return api.updateCaseProgressView(moduleId); },
          clearCaseProgress: function(moduleId) { return api.clearCaseProgress(moduleId); },
          initCaseProgress: function(moduleId, groups) { return api.initCaseProgress(moduleId, groups); },
          setCaseProgressGroupState: function(moduleId, idx, stateVal) { return api.setCaseProgressGroupState(moduleId, idx, stateVal); },
          setCaseProgressStep: function(moduleId, step, stateVal) { return api.setCaseProgressStep(moduleId, step, stateVal); },
          markAllCaseProgressGroups: function(moduleId, stateVal) { return api.markAllCaseProgressGroups(moduleId, stateVal); },
          setCaseModuleRunning: function(moduleId, running) { return api.setCaseModuleRunning(moduleId, running); },
          isCaseModuleRunning: function(moduleId) { return api.isCaseModuleRunning(moduleId); },
          refreshExportCaseGenButton: proxyApi('refreshExportCaseGenButton'),
          setCaseViewHint: proxyApi('setCaseViewHint'),
          parseCaseList,
          extractJsonObjects,
          persistWorkflowState: requestPersistWorkflowState,
        },
        config: { defaultPrompts },
        sanitizeCasesForExport,
        wrapDataWithRequirement,
        getSafeRequirementSlug,
        normalizeRequirementName,
        formatCompactTimestamp,
      })
      : null;
    assignIfPresent(api, casesGenCoreModule, [
      'renderCaseGeneration',
      'renderCaseTable',
      'parseGeneratedCases',
      'generateCasesForModule',
      'generateAllCaseGenModules',
      'generateSuggestedCaseGenModules',
      'topUpCasesForModule',
      'topUpAllCaseGenModules',
      'exportCaseGenerationResults',
      'exportSelectedModulesToXmind',
      'exportModuleCases',
      'importModuleCases',
      'transferModuleToTempExec',
      'clearModuleCases',
      'toggleCaseView',
      'openXmindMirrorCaseView',
      'handleCaseSelectionChange',
      'handleCaseSelectAll',
      'handleCaseSelectAllModules',
      'exportSelectedCases',
      'exportSelectedCasesToXmind',
      'refreshCaseSelectionUI',
      'updateSupplementButtons',
      'refreshAppendExistingButton',
      'refreshCaseGenBatchButtons',
      'ensureCaseGenSettings',
      'setCaseGenSettingValue',
      'syncCaseGenSpecialOptionsState',
      'setCaseGenViewTab',
      'setCaseGenStoreMode',
      'openCaseGenBatchActionDrawer',
      'openCaseGenModuleGenerateDrawer',
      'openCaseGenSettingsDrawer',
      'getCaseGenPromptComponents',
      'buildCaseGenPrompt',
      'buildModuleCases',
      'buildModuleTopup',
      'commitModuleCases',
      'snapshotModuleCases',
      'rollbackModuleCases',
      'snapshotAllCaseGenState',
      'rollbackAllCaseGenState',
      'getLatestCaseGenOperationSnapshot',
      'discardCaseGenOperationSnapshot',
      'rollbackCaseGenOperationSnapshot',
      'syncLegacyCaseGenState',
      'restoreLegacyCaseGenState',
      'getCaseListForModule',
      'setCaseGenDbStoreNewAction',
      'clearCaseGenDbStoreNewActionError',
      'openCaseGenDbStoreNewDrawer',
      'openCaseGenDbStoreAppendDrawer',
      'openCaseGenDbStoreNewDrawerWithItems',
      'openCaseGenDbStoreAppendDrawerWithItems',
      'openCaseGenAllView',
      'refreshExportCaseGenXmindButton',
      'renderAppendTargetOptions',
    ]);

    let tempExecApi = {};
    const getCaseExecutionDisplayProxy = function(file, item) {
      if (tempExecApi && typeof tempExecApi.getCaseExecutionDisplay === 'function') {
        return tempExecApi.getCaseExecutionDisplay(file, item);
      }
      return { label: '' };
    };

    const xmindCore = window.app && window.app.xmindCore && typeof window.app.xmindCore.init === 'function'
      ? window.app.xmindCore.init({
        formatCompactTimestamp,
        normalizeRequirementName,
        getRequirementLabel,
        getCaseExecutionDisplay: getCaseExecutionDisplayProxy,
        deriveCaseListFromText,
        JSZip: window.JSZip,
      })
      : null;
    const xmindMarkdownExportCore = window.app && window.app.xmindMarkdownExportCore && typeof window.app.xmindMarkdownExportCore.init === 'function'
      ? window.app.xmindMarkdownExportCore.init({
        formatCompactTimestamp,
        normalizeRequirementName,
        getSafeFileBaseName: xmindCore && xmindCore.getSafeFileBaseName
          ? xmindCore.getSafeFileBaseName
          : null,
      })
      : null;
    const xmindCaseDedupeCore = window.app && window.app.xmindCaseDedupeCore && typeof window.app.xmindCaseDedupeCore.init === 'function'
      ? window.app.xmindCaseDedupeCore.init({})
      : null;
    const xmindRequirementCoverageCore = window.app && window.app.xmindRequirementCoverageCore && typeof window.app.xmindRequirementCoverageCore.init === 'function'
      ? window.app.xmindRequirementCoverageCore.init({})
      : null;
    const mindElixirCore = window.app && window.app.mindElixirCore && typeof window.app.mindElixirCore.init === 'function'
      ? window.app.mindElixirCore.init({
        xmindApi: xmindCore,
        renderPolicyCore: window.app.xmindRenderPolicyCore || null,
      })
      : null;
    const formatXmindNodeValue = xmindCore && xmindCore.formatXmindNodeValue
      ? xmindCore.formatXmindNodeValue
      : function formatXmindNodeValueFallback(val) { return (val || '').toString(); };
    const buildCaseFieldsForXmind = xmindCore && xmindCore.buildCaseFieldsForXmind
      ? xmindCore.buildCaseFieldsForXmind
      : function buildCaseFieldsForXmindFallback(item, fallbackModule) {
        return [(item && item.module) || fallbackModule || '模块'];
      };
    const buildXmindPackageFromCases = xmindCore && xmindCore.buildXmindPackageFromCases
      ? xmindCore.buildXmindPackageFromCases
      : null;
    if (xmindCore) {
      window.app.xmindCoreApi = xmindCore;
    }
    if (xmindMarkdownExportCore) {
      window.app.xmindMarkdownExportCoreApi = xmindMarkdownExportCore;
    }
    if (xmindCaseDedupeCore) {
      window.app.xmindCaseDedupeCoreApi = xmindCaseDedupeCore;
    }
    if (xmindRequirementCoverageCore) {
      window.app.xmindRequirementCoverageCoreApi = xmindRequirementCoverageCore;
    }
    if (mindElixirCore) {
      window.app.mindElixirCoreApi = mindElixirCore;
    }

    const xmindAssetLoader = window.app.xmindAssetLoader.create({
      xmindCore: xmindCore,
      extractRequirementLabelFromText: extractRequirementLabelFromText,
    });
    const {
      ensureMindElixirCoreApi,
      parseXmindFile,
      lazyParseXmindFile,
      lazyExtractRequirementLabel,
      lazyBuildTempExecXmindPackage,
      lazyBuildCasesXmindPackage,
    } = xmindAssetLoader;

    const tempexecCore = window.app && window.app.tempexecCore && typeof window.app.tempexecCore.init === 'function'
      ? window.app.tempexecCore.init({
        setStatus,
        normalizeRequirementName,
        getRequirementLabel,
        ensureRequirementLabel,
        stripTimestampSuffix: xmindCore && xmindCore.stripTimestampSuffix,
        getSafeFileBaseName: xmindCore && xmindCore.getSafeFileBaseName,
        defaultTempExecColumns,
        defaultPlacement,
        state,
        tempExecStorageKey,
        tempExecFocusStorageKey,
        tempExecPageSizeStorageKey,
        modelsKey,
        assignmentKey,
        defaultTempExecPageSize,
        caseViewBaseFontSize: defaultCaseViewFontSize,
        escapeHtml,
        escapeHtmlPreserve,
        normalizeTempExecName,
        stringifyCaseField,
        buildMissingReminderKeywords,
        normalizeMissingReminderMatchConfig,
        callModelWithConfig,
        getAssignedModel,
        deriveCaseListFromText,
        parseXmindFile: lazyParseXmindFile,
        parseXlsxFileToRows: (window.app && window.app.xlsxCoreApi && typeof window.app.xlsxCoreApi.parseXlsxFileToRows === 'function')
          ? window.app.xlsxCoreApi.parseXlsxFileToRows
          : null,
        buildTempExecXmindPackage: lazyBuildTempExecXmindPackage,
        extractRequirementLabelFromText: lazyExtractRequirementLabel,
        promptTempExecRequirement,
        ensureTempExecReplacement,
        generateTempExecId,
        generateTempVersionId,
        setRequirementLabel,
        ensureTempExecColumns,
        persistSettings,
        formatCompactTimestamp,
        downloadText,
        downloadBlob,
        scrollElementIntoView,
        tempExecResultOptions,
        reuseApplicabilityCore: window.app && window.app.reuseApplicabilityCore,
        tempExecImportDuplicateControllerFactory: window.app && window.app.tempExecImportDuplicate
          ? window.app.tempExecImportDuplicate.controller
          : null,
        tempExecCaseLibraryDiffControllerFactory: window.app && window.app.tempExecCaseLibraryDiff
          ? window.app.tempExecCaseLibraryDiff.controller
          : null,
        buildXmindPackageFromCases: lazyBuildCasesXmindPackage,
        openConfirmDrawer: appUtils.openConfirmDrawer,
        buildMindDataFromCases: mindElixirCore && mindElixirCore.buildMindDataFromCases,
        dom,
      })
      : null;
    tempExecApi = tempexecCore ? { ...tempexecCore } : {};
    const tempExecStatus = dom.tempExecStatus || null;
    const tempExecDefaults = window.app.tempexecDefaults && typeof window.app.tempexecDefaults.create === 'function'
      ? window.app.tempexecDefaults.create({
        state,
        defaultTempExecPageSize,
        tempExecStatus,
        setStatus,
        normalizeTempExecName,
        removePendingTempExecByName,
        removeTempExecFile: function(id) {
          if (tempExecApi.removeTempExecFile) return tempExecApi.removeTempExecFile(id);
          return undefined;
        },
        renderTempExecView: function() {
          if (typeof tempExecApi.renderTempExecView === 'function') tempExecApi.renderTempExecView();
        },
        generateTempExecId,
        generateTempVersionId,
        stringifyCaseField,
      })
      : {};
    Object.keys(tempExecDefaults).forEach(function(key) {
      if (!tempExecApi[key]) tempExecApi[key] = tempExecDefaults[key];
    });
    // 供用例库等独立模块复用执行页能力（转到执行/保留结果等）
    window.app.tempExecApi = tempExecApi;
    const getTempExecPageSizeFn = tempExecApi.getTempExecPageSize || function() { return defaultTempExecPageSize; };
    state.tempExecPageSize = getTempExecPageSizeFn();
    api.createTempExecFile = tempExecApi.createTempExecFile || api.createTempExecFile;
    api.syncTempExecFocus = tempExecApi.syncTempExecFocus || api.syncTempExecFocus;
    api.persistTempExecState = tempExecApi.persistTempExecState || api.persistTempExecState;
    api.setTempExecActive = tempExecApi.setTempExecActive || api.setTempExecActive;
    api.setTempExecStatusFilter = tempExecApi.setTempExecStatusFilter || api.setTempExecStatusFilter;
    api.removeTempExecFile = tempExecApi.removeTempExecFile || api.removeTempExecFile;
    api.getCaseExecutionDisplay = tempExecApi.getCaseExecutionDisplay || api.getCaseExecutionDisplay;
    api.renderTempExecView = tempExecApi.renderTempExecView || api.renderTempExecView;
    api.clampTempExecPageSize = tempExecApi.clampTempExecPageSize || api.clampTempExecPageSize;
    api.applyTempExecPageSize = tempExecApi.applyTempExecPageSize || function(value) { return { size: value, changed: false }; };

    api.setStepWaiting = setStepWaiting;
    api.clearStepWaiting = clearStepWaiting;
    api.clearAllWaitingSteps = clearAllWaitingSteps;
    api.setStepFailed = setStepFailed;
    api.clearStepFailed = clearStepFailed;
    api.clearAllFailedSteps = clearAllFailedSteps;


    const workflowResetController = window.app.workflowResetController.create({
      state: state,
      dom: dom,
      setStatus: setStatus,
      autoWorkflowManager: autoWorkflowManager,
      syncAutoWorkflowTaskState: syncAutoWorkflowTaskState,
      abortAllModelRequests: abortAllModelRequests,
      renderImportedCaseList: renderImportedCaseList,
      resetImportedCaseView: resetImportedCaseView,
      syncCaseTextWithImports: syncCaseTextWithImports,
      renderCaseGeneration: renderCaseGeneration,
      renderCaseGenProgressBoard: renderCaseGenProgressBoard,
      renderCleanView: renderCleanView,
      renderCleanRawView: renderCleanRawView,
      syncReviewViewFromResult: syncReviewViewFromResult,
      syncSplitView: syncSplitView,
      updateMissingView: updateMissingView,
      syncAutoCompareStatus: syncAutoCompareStatus,
      updateAutoClarifyVisibility: updateAutoClarifyVisibility,
      updateAutoMissingCard: updateAutoMissingCard,
      renderAutoRawInfo: renderAutoRawInfo,
      setCaseViewHint: setCaseViewHint,
      triggerUpdateFlowStatus: triggerUpdateFlowStatus,
      requestPersistWorkflowStateNow: requestPersistWorkflowStateNow,
    });
    const {
      resetWorkflowData,
      interruptActiveExecutions,
      guardRequirementImport,
    } = workflowResetController;
    api.resetWorkflowData = resetWorkflowData;
    api.interruptActiveExecutions = interruptActiveExecutions;

    const uploadModule = window.app.upload && typeof window.app.upload.init === 'function'
      ? window.app.upload.init({
        state,
        handlers: {
          guardRequirementImport: guardRequirementImport,
          handleCaseFiles,
          removeImportedCase,
          setStepInProgress,
          clearStepInProgress,
          setRequirementLabel,
          renderAutoRawInfo,
          updateAutoCompareActions,
          updateAutoMissingCard,
          updateFlowStatus,
          setStatus,
          renderCleanRawView,
          persistWorkflowState: requestPersistWorkflowState,
          parseDocx: xmindCore && xmindCore.parseDocx ? function(file) { return xmindCore.parseDocx(file); } : null,
        },
        dom,
      })
      : null;

    const splitHandlersModule = window.app.splitHandlers && typeof window.app.splitHandlers.init === 'function'
      ? window.app.splitHandlers.init({
        state,
        setStatus,
        utils: { escapeHtml },
        handlers: {
          refreshMissingSmartFillButton,
          updateFlowStatus,
          ensureCaseGenModulesFromSplit,
          renderCaseGeneration,
          parseSplitModules,
        },
        dom,
      })
      : null;
    assignIfPresent(api, splitHandlersModule, ['syncSplitView', 'toggleSplitView']);

    const cleanHandlersModule = window.app.cleanHandlers && typeof window.app.cleanHandlers.init === 'function'
      ? window.app.cleanHandlers.init({
        state,
        cleanCore,
        defaultPrompts,
        handlers: {
          setStatus,
          updateFlowStatus,
          renderCaseGeneration,
          renderCaseGenProgressBoard,
          refreshMissingSmartFillButton,
          setCaseViewHint,
          syncCaseTextWithImports,
          renderImportedCaseList,
          resetImportedCaseView,
          wrapTextWithRequirement,
          getRequirementLabel,
          hasImportedCases,
          stripRequirementHeader,
          stripCodeFence,
          unwrapRequirementPayload,
          stringifyDescription: cleanCore && cleanCore.stringifyDescription ? cleanCore.stringifyDescription : undefined,
          switchTab,
          escapeHtml,
          escapeHtmlPreserve,
          cleanHighlightColors,
          ensureRequirementLabel,
          buildReviewClarificationContext,
          getAssignedModel,
          getReasoningForType,
          getTemperatureForType,
          callModelWithConfig,
          callModelWithContent,
          updateModelTiming,
          extractJsonPayload,
          getLastModelError,
          setStepInProgress,
          clearStepInProgress,
          persistWorkflowState: requestPersistWorkflowState,
        },
        dom,
      })
      : null;
    assignIfPresent(api, cleanHandlersModule, [
      'renderAutoRawInfo',
      'handleRawInput',
      'handleCleanInput',
      'handleSplitInput',
      'handleCaseTextInput',
      'wrapCleanedText',
      'renderCleanRawView',
      'collectEntryRanges',
      'shouldExpectCleanJson',
      'getCleanedEntries',
      'getCleanedRequirementText',
      'getCleanedTextForModel',
      'renderCleanView',
      'locateCleanRawSelection',
      'jumpToCleanHighlightView',
      'runCleaning',
      'copyCleaned',
    ]);

    markInitStage('before-app-runtime-init');
    const runtime = window.app.appRuntime && typeof window.app.appRuntime.init === 'function'
      ? window.app.appRuntime.init({
        state,
        dom,
        api,
        appUtils,
        activeTabKey,
        assignIfPresent,
        tempExecApi,
        setStatus,
        renderAssignmentsSelect,
        saveAssignments,
        ensureCaseGenModulesFromSplit,
        renderCaseGeneration,
        updateAutoClarifyVisibility,
        syncAutoCompareStatus,
        updateAutoMissingCard,
        renderSettingsUI,
        updateMissingView,
        toggleSplitView,
        shouldExpectCleanJson,
        runCleaning,
        copyCleaned,
        renderCleanView,
        renderCleanRawView,
        locateCleanRawSelection,
        toggleMissingView,
        compareCoverage,
        compareCasesCoverage,
        exportCompareResult,
        importCompareResult,
        copyMissingJson,
        handleMissingSelectionChange,
        handleMissingSelectAll,
        smartFillMissingSuggestions,
        exportCasesCoverage,
        importCasesCoverage,
        getSafeRequirementSlug,
        parseSplitModules,
        scrollToSection,
        scrollElementIntoView,
        goCasesGenAndScroll,
        refreshMissingSmartFillButton,
        updateFlowStatus: triggerUpdateFlowStatus,
        setCaseViewHint,
        renderCaseGenProgressBoard,
        workflowStorageKey,
        persistSettings,
        loadModels,
        loadAssignments,
        renderModels,
        renderImportedCaseList,
        renderAutoRawInfo,
        syncReviewViewFromResult,
        syncSplitView,
        resetModelForm,
        toggleImportedCaseView,
        escapeHtml,
        escapeHtmlPreserve,
        formatCompactTimestamp,
        callModelWithConfig,
        callModelWithContent,
        xmindCaseDedupeCore,
        getAssignedModel,
        getReasoningForType,
        getTemperatureForType,
        xmindCaseGenTaskManager,
        updateModelTiming,
        downloadBlob,
        parseXmindFile,
        updateAssignmentStatuses,
        updateReasoningVisibility,
        testModel,
      })
      : null;
    markInitStage('after-app-runtime-init');
    if (window.app && typeof window.app.persistWorkflowState === 'function') {
      persistWorkflowState = window.app.persistWorkflowState;
    } else if (api && typeof api.persistWorkflowState === 'function') {
      persistWorkflowState = api.persistWorkflowState;
    }
    if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
      persistWorkflowStateNow = window.app.persistWorkflowStateNow;
    } else if (api && typeof api.persistWorkflowStateNow === 'function') {
      persistWorkflowStateNow = api.persistWorkflowStateNow;
    }
    if (runtime && runtime.switchTab) switchTab = runtime.switchTab;
    window.app.switchTab = switchTab;
    initModule('flowGuide', {
      utils: appUtils,
      switchTab: switchTab,
      setStatus: setStatus,
    });
    initModule('pageGuide', {
      state: state,
      config: {
        defaultPageGuideSwitches: appConfig.defaultPageGuideSwitches || {},
        defaultSettings: defaultSettings,
      },
      utils: appUtils,
      setStatus: setStatus,
    });
