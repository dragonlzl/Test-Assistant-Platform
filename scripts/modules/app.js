    window.app = window.app || {};
    const appUtils = window.app.utils || {};
    const appConfig = window.app.config || {};
    window.app.config = appConfig;

    const providerDefaults = appConfig.providerDefaults || {};
    const defaultPrompts = appConfig.defaultPrompts || {};
    const defaultPromptsKey = appConfig.defaultPromptsKey || 'usecase-default-prompts';
    const defaultMaxTokens = appConfig.defaultMaxTokens || 1024;
    const legacyCleanKey = appConfig.legacyCleanKey || 'cleaner-config-v1';
    const legacyCompareKey = appConfig.legacyCompareKey || 'cleaner-compare-config-v1';
    const modelsKey = appConfig.modelsKey || 'cleaner-models-v1';
    const assignmentKey = appConfig.assignmentKey || 'cleaner-assignment-v1';
    const tempExecStorageKey = appConfig.tempExecStorageKey || 'usecase-temp-exec-v1';
    const tempExecFocusStorageKey = appConfig.tempExecFocusStorageKey || 'tempexec-focus-v1';
    const tempExecPageSizeStorageKey = appConfig.tempExecPageSizeStorageKey || 'tempexec-page-size';
    const defaultTempExecPageSize = Number(appConfig.defaultTempExecPageSize) || 20;
    const tempExecResultOptions = Array.isArray(appConfig.tempExecResultOptions)
      ? appConfig.tempExecResultOptions
      : ['未执行', '通过', '失败', '阻塞', '不适用'];
    const defaultPlacement = appConfig.defaultPlacement || { requirementOrder: [], fileOrder: {}, versionOrder: [] };
    const defaultTempExecColumns = appConfig.defaultTempExecColumns || {
      select: true,
      index: true,
      module: true,
      priority: true,
      preconditions: true,
      steps: true,
      expected: true,
      ops: true,
    };
    const defaultSettings = appConfig.defaultSettings || {
      timeoutSec: 300,
      feishuWebhook: '',
      feishuMention: '',
      tempExecColumns: { ...defaultTempExecColumns },
    };
    const settingsKey = appConfig.settingsKey || 'usecase-settings-v1';
    const minModelTimeoutSec = Number(appConfig.minModelTimeoutSec) || 30;
    const maxModelTimeoutSec = Number(appConfig.maxModelTimeoutSec) || 1800;
    const legacyCasesPrompt = appConfig.legacyCasesPrompt || '你是测试审核专家，请对比“测试模块拆分结果”和“XMind 测试用例”，输出 JSON：{coverage: 百分比(0-100), missing: [模块缺失点], extra: [测试用例中多出的点]}，missing/extra 为空数组表示无缺失或冗余。';
    const legacyCleanPrompt = appConfig.legacyCleanPrompt || '你是资深需求分析师，请清洗并重写下面的原始需求，重新整理前，要充分理解需求，理解设计意图，然后整理成结构化、可读性强的条目，保持原意，保留关键信息与约束条件，输出JSON数组：[{"功能": 具体功能名称,"类别": 核心改动的类别,"功能描述": {"重新整理内容": 具体重新整理的功能原文内容,"功能目标": [如有则为功能的目标],"规则": [功能的具体规则],"约束": [如有则为功能的限制和约束],"流程": [功能触发的具体流程]},"原始需求描述": [原始需求的所有相关描述]}]。仅输出此 JSON 内容，禁止输出其它文字。';
    const legacyCaseGenPrompt = appConfig.legacyCaseGenPrompt || '你是测试用例专家，针对单个测试模块生成 JSON 用例列表，每条用例字段：{module, title, priority, preconditions, steps, expected}，steps 为数组。priority 字段必须严格使用 P0/P1/P2（三选一），不要输出“高/中/低”等描述。结合模块的关键场景/测试要点/耦合模块，给出至少 3 条高质量用例。';
    const cleanHighlightColors = appConfig.cleanHighlightColors || ['#5b8def', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
    const moduleFieldAliases = appConfig.moduleFieldAliases || {
      title: ['module', 'name', 'title', '模块', '模块名称'],
      scenarios: ['key_scenarios', '测试场景', '关键场景'],
      points: ['test_points', '测点要点', '测试要点'],
      coupled: ['coupled_modules', '耦合模块'],
    };
    const cleanedEntryFieldAliases = appConfig.cleanedEntryFieldAliases || {
      feature: ['feature', 'module', 'name', 'title', '功能', '功能点', '模块', '功能模块', '条目', '功能名称'],
      category: ['category', 'type', 'section', '章节', '分类', '类别'],
      description: ['description', 'desc', 'details', 'content', 'text', 'body', 'cleanedRequirement', 'cleaned', 'cleanedText', '整理内容', '需求描述', '功能描述', '模块描述', '清洗内容', '重新整理内容'],
      raw: ['rawText', 'rawRequirement', 'raw', 'original', 'originalRequirement', '原始需求', '原文', '清洗前内容', '需求原文', '原始需求描述'],
    };
    const cleanedDescriptionFieldAliases = appConfig.cleanedDescriptionFieldAliases || {
      summary: ['summary', '概述', '简介', '描述', '说明', '重新整理内容', '功能描述'],
      goals: ['goals', '目标', '目的', '意图', '设计意图', '功能目标'],
      rules: ['rules', '逻辑', '规则', '要点', '细节', '功能说明'],
      constraints: ['constraints', '约束', '限制', '前提', '注意事项'],
      flows: ['flows', '流程', '步骤', '操作流程', '交互流程'],
      values: ['数值', '数值配置', '数值设置', 'values'],
      configs: ['配置', '配置项', 'configurations', 'configs'],
    };

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
  let resetAutoCompareMissingView = function resetAutoCompareMissingViewFallback() {};
  let resetAutoCompareUserInputs = function resetAutoCompareUserInputsFallback() {};
  let renderAutoCompareMissingView = function renderAutoCompareMissingViewFallback() {};
  let buildFilteredComparePayload = function buildFilteredComparePayloadFallback() { return ''; };
  let updateAutoCompareActions = function updateAutoCompareActionsFallback() {};
  let syncAutoCompareStatus = function syncAutoCompareStatusFallback() { return null; };
  let runAutoWorkflow = function runAutoWorkflowFallback() {};
  let runAutoWorkflowFromClean = function runAutoWorkflowFromCleanFallback() {};
  let continueAutoWorkflowAfterCoverage = function continueAutoWorkflowAfterCoverageFallback() {};
  let executeAutoWorkflowSteps = function executeAutoWorkflowStepsFallback() { return Promise.resolve(); };
  let enforceAutoCoverageRequirement = function enforceAutoCoverageRequirementFallback() { return Promise.resolve(); };
  let exportCasesCoverage = function exportCasesCoverageFallback() {};
  let importCasesCoverage = async function importCasesCoverageFallback() {};
  let exportCompareResult = function exportCompareResultFallback() {};
  let importCompareResult = async function importCompareResultFallback() {};
  let saveDebugText = function saveDebugTextFallback() {};
  let importDebugText = async function importDebugTextFallback() {};
  let bindDebugControls = function bindDebugControlsFallback() {};
  let handleRawInput = function handleRawInputFallback() {};
  let handleCleanInput = function handleCleanInputFallback() {};
  let handleSplitInput = function handleSplitInputFallback() {};
  let handleCaseTextInput = function handleCaseTextInputFallback() {};
  let wrapCleanedText = function wrapCleanedTextFallback(text) { return text; };
  let renderAutoRawInfo = function renderAutoRawInfoFallback() {};
  let renderCleanRawView = function renderCleanRawViewFallback() {};
  let collectEntryRanges = function collectEntryRangesFallback() { return []; };
  let renderCaseGenProgressBoard = function renderCaseGenProgressBoardFallback() {};
  let setCaseModuleRunning = function setCaseModuleRunningFallback() {};
  let isCaseModuleRunning = function isCaseModuleRunningFallback() { return false; };
  let renderCaseModuleProgress = function renderCaseModuleProgressFallback() { return ''; };
  let updateCaseProgressView = function updateCaseProgressViewFallback() {};
  let clearCaseProgress = function clearCaseProgressFallback() {};
  let initCaseProgress = function initCaseProgressFallback() {};
  let setCaseProgressGroupState = function setCaseProgressGroupStateFallback() {};
  let setCaseProgressStep = function setCaseProgressStepFallback() {};
  let markAllCaseProgressGroups = function markAllCaseProgressGroupsFallback() {};
  let updateFlowStatus = function updateFlowStatusFallback() {};
  let scrollToSection = function scrollToSectionFallback() {};
  let refreshExportCaseGenButton = function refreshExportCaseGenButtonFallback() {};
  let setCaseViewHint = function setCaseViewHintFallback() {};
  let splitModules = async function splitModulesFallback() {};
  let ensureCaseGenModulesFromSplit = function ensureCaseGenModulesFromSplitFallback() { return false; };
  const noop = function() {}, asyncNoop = async function() {}, falseFn = function() { return false; }, emptyArr = function() { return []; }, emptyStr = function() { return ''; }, defaultParsedCases = function() { return { parsed: [], normalized: '', hadRecovery: false }; }, defaultCasesPayload = function() { return { text: '', isJson: false }; };
  let reviewRequirements = function reviewRequirementsFallback() { return Promise.resolve(); };
  let copyReviewResult = noop,
    exportReviewResult = noop,
    importReviewResult = asyncNoop,
    toggleReviewView = noop,
    confirmClarifications = noop,
    handleClarifyClickEvent = noop,
    handleClarifyChangeEvent = noop,
    handleClarifyInputEvent = noop,
    updateAutoClarifyVisibility = noop,
    renderAutoClarifyView = noop,
    openAutoClarifyPanel = noop,
    handleAutoClarifyConfirm = noop,
    waitForAutoClarification = function waitForAutoClarificationFallback() { return Promise.resolve(true); },
    refreshMissingSmartFillButton = noop,
    updateMissingView = noop,
    toggleMissingView = noop,
    refreshMissingSelectionUI = noop,
    copyMissingJson = noop,
    syncReviewViewFromResult = noop,
    buildReviewClarificationContext = function buildReviewClarificationContextFallback() { return ''; },
    renderCaseGeneration = noop,
    renderCaseTable = function renderCaseTableFallback() { return ''; },
    parseGeneratedCases = defaultParsedCases,
    renderImportedCaseList = noop,
    addImportedCase = noop,
    removeImportedCase = noop,
    hasImportedCases = falseFn,
    hasCaseSource = falseFn,
    getCombinedCaseList = emptyArr,
    getCombinedCaseText = emptyStr,
    getImportedCaseObjects = emptyArr,
    syncCaseTextWithImports = noop,
    buildCasesComparePayload = defaultCasesPayload,
    resetImportedCaseView = noop,
    refreshImportedCaseView = noop,
    handleCaseFiles = noop,
    resetAutoMissingView = noop,
    refreshAutoMissingSelectionUI = noop,
    updateAutoMissingCard = noop,
    toggleAutoMissingView = noop,
    ensureAutoMissingViewVisible = noop,
    copyAutoMissingJson = noop,
    handleMissingSelectionChange = noop,
    handleMissingSelectAll = noop,
    smartFillMissingSuggestions = noop,
    notifyFeishuWorkflowSuccess = noop,
    notifyFeishuCoverageFailure = noop,
    notifyFeishuClarificationNeeded = noop,
    generateCasesForModule = asyncNoop,
    topUpCasesForModule = asyncNoop,
    exportCaseGenerationResults = noop,
    exportModuleCases = noop,
    importModuleCases = noop,
    transferModuleToTempExec = asyncNoop,
    clearModuleCases = noop,
    toggleCaseView = noop,
    handleCaseSelectionChange = noop,
    handleCaseSelectAll = noop,
    exportSelectedCases = noop,
    exportSelectedCasesToXmind = asyncNoop,
    refreshCaseSelectionUI = noop,
    updateSupplementButtons = noop,
    getCaseListForModule = emptyArr,
    toggleImportedCaseView = noop,
    compareCoverage = noop,
    compareCasesCoverage = noop,
    extractCompareResultData = function extractCompareResultDataFallback() { return null; },
    extractCoverageFromCompareResult = function extractCoverageFromCompareResultFallback() { return null; },
    goToCaseGeneration = noop,
    goCasesGenAndScroll = noop,
    runCleaning = asyncNoop,
    copyCleaned = asyncNoop,
    syncSplitView = noop,
    toggleSplitView = noop,
    shouldExpectCleanJson = falseFn,
    getCleanedEntries = emptyArr,
    getCleanedRequirementText = emptyStr,
    getCleanedTextForModel = emptyStr,
    renderCleanView = noop,
    locateCleanRawSelection = noop,
    jumpToCleanHighlightView = noop,
    renderTempExecView = noop,
    applyTempExecPageSize = function applyTempExecPageSizeFallback(value) { return { size: value, changed: false }; },
    clampTempExecPageSize = function clampTempExecPageSizeFallback(value) {
      const num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultTempExecPageSize;
      return num;
    },
    createTempExecFile = function createTempExecFileFallback() { return null; },
    syncTempExecFocus = noop,
    persistTempExecState = noop,
    setTempExecActive = noop,
    removeTempExecFile = noop,
    getCaseExecutionDisplay = emptyStr;
    let debugNodes;

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

    const assignHandlersModule = window.app.assignHandlers && typeof window.app.assignHandlers.init === 'function'
      ? window.app.assignHandlers.init({
        state,
        defaultPrompts,
        storageKey: defaultPromptsKey,
        setStatus,
        downloadText,
      })
      : null;
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

  const requirementCoreModule = window.app.requirementCore && typeof window.app.requirementCore.init === 'function'
    ? window.app.requirementCore.init({
      state,
      utils: { stripCodeFence },
      handlers: { renderAutoRawInfo: function renderAutoRawInfoProxy() { renderAutoRawInfo(); } },
    })
      : null;
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

    const splitCore = window.app && window.app.splitCore && typeof window.app.splitCore.init === 'function'
      ? window.app.splitCore.init({ moduleFieldAliases, normalizeRequirementName, unwrapRequirementPayload })
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

    const modelClientService = window.app && window.app.services && window.app.services.modelClient;

    function getConfiguredTimeoutSec() {
      const storedTimeout = state.settings && Object.prototype.hasOwnProperty.call(state.settings, 'timeoutSec')
        ? state.settings.timeoutSec
        : undefined;
      return storedTimeout === null || storedTimeout === undefined ? defaultSettings.timeoutSec : storedTimeout;
    }

    function isR1Model(model) {
      const source = model && model.model ? String(model.model).toLowerCase() : '';
      return source.includes('deepseek-r1') || source.includes('deepseek-reasoner');
    }

    const modelClient = modelClientService && typeof modelClientService.createModelClient === 'function'
      ? modelClientService.createModelClient({
        defaultPrompts,
        defaultMaxTokens,
        clampTimeoutSeconds,
        getTimeoutSec: getConfiguredTimeoutSec,
        modelIsR1: isR1Model,
      })
      : null;

    const callModelWithConfig = modelClient && typeof modelClient.callModelWithConfig === 'function'
      ? modelClient.callModelWithConfig
      : async function missingModelClient() {
        throw new Error('模型客户端不可用，请刷新页面后重试');
      };

    function buildDom(ids, alias) {
      const result = {};
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

    const dom = buildDom([
      'fileInput', 'dropZone', 'fileName', 'rawText', 'parseStatus', 'reviewStatus', 'reviewViewContainer', 'splitViewContainer',
      'cleanViewContainer', 'cleanHighlightAllBtn', 'toggleCleanViewBtn', 'cleanRawView', 'toggleCleanRawViewBtn', 'cleanRawLocateBtn',
      'caseStatus', 'caseViewBtn', 'caseViewContainer', 'caseViewHint', 'autoRawDropZone', 'autoCaseDropZone', 'tempExecDropZone',
      'tempExecInput', 'tempExecStatus', 'tempExecNav', 'tempFocusBlock', 'tempVersionGrid', 'createTempVersionBtn', 'tempExecView',
      'tempExecMindContainer', 'exportTempExecBtn', 'exportTempExecConfigBtn', 'importTempExecBtn', 'exportTempExecXmindBtn',
      'importTempExecConfigBtn', 'tempExecMindBtn', 'tempExecOverviewBtn', 'tempExecOverview', 'tempExecBackBtn', 'importTempExecFile',
      'importTempExecConfigFile', 'autoClarifyContainer', 'autoClarifyStatus', 'autoClarifyToggleBtn', 'goUsecaseGenBtn',
      'casesGoUsecaseGenBtn', 'casesGenerationContainer', 'caseGenProgressPanel', 'caseGenProgressList', 'cleanStatus', 'compareStatus',
      'splitStatus', 'casesCoverageStatus', 'caseGenStatus', 'autoWorkflowStatus', 'casesModuleProgress', 'exportCaseGenBtn',
      'toSplitFromCaseGenBtn', 'saveRawDebugBtn', 'importRawDebugBtn', 'saveCleanDebugBtn', 'importCleanDebugBtn', 'saveSplitDebugBtn',
      'importSplitDebugBtn', 'saveCaseDebugBtn', 'importCaseDebugBtn', 'scrollTopBtn', 'scrollBottomBtn', 'xmindStructureToggle',
      'xmindStructureCard', 'caseFileInput', 'caseDropZone', 'caseStatus', 'caseViewBtn', 'caseViewContainer', 'caseViewHint'
    ], [
      { name: 'runReviewBtn', id: 'runReview' },
      { name: 'reviewResultEl', id: 'reviewResult' },
      { name: 'copyReviewResultBtn', id: 'copyReviewResult' },
      { name: 'exportReviewResultBtn', id: 'exportReviewResult' },
      { name: 'importReviewResultBtn', id: 'importReviewResult' },
      { name: 'reviewImportFileInput', id: 'reviewImportFile' },
      { name: 'toggleReviewViewBtn', id: 'toggleReviewView' },
      { name: 'confirmClarificationsBtn', id: 'confirmClarifications' },
      { name: 'toggleSplitViewBtn', id: 'toggleSplitView' },
      { name: 'runCleanBtn', id: 'runClean' },
      { name: 'copyBtn', id: 'copyCleaned' },
      { name: 'cleanedTextEl', id: 'cleanedText' },
      { name: 'compareResultEl', id: 'compareResult' },
      { name: 'splitResultEl', id: 'splitResult' },
      { name: 'caseFileListEl', id: 'caseFileList' },
      { name: 'caseTextEl', id: 'caseText' },
      { name: 'autoRawInput', id: 'autoRawFile' },
      { name: 'autoRawListEl', id: 'autoRawFileList' },
      { name: 'autoRawClearBtn', id: 'autoRawClear' },
      { name: 'autoCaseInput', id: 'autoCaseFile' },
      { name: 'autoCaseFileListEl', id: 'autoCaseFileList' },
      { name: 'autoWorkflowBtn', id: 'runAutoWorkflow' },
      { name: 'autoClarifyToggle', id: 'autoNeedClarify' },
      { name: 'autoClarifyConfirmBtn', id: 'autoClarifyConfirm' },
      { name: 'autoMissingGoUsecaseBtn', id: 'autoMissingGoUsecase' },
      { name: 'cleanTimingEl', id: 'cleanTiming' },
      { name: 'reviewTimingEl', id: 'reviewTiming' },
      { name: 'compareTimingEl', id: 'compareTiming' },
      { name: 'splitTimingEl', id: 'splitTiming' },
      { name: 'casesTimingEl', id: 'casesTiming' },
      { name: 'caseGenTimingEl', id: 'caseGenTiming' },
      { name: 'rawDebugFileInput', id: 'rawDebugFile' },
      { name: 'cleanDebugFileInput', id: 'cleanDebugFile' },
      { name: 'splitDebugFileInput', id: 'splitDebugFile' },
      { name: 'caseDebugFileInput', id: 'caseDebugFile' },
      { name: 'saveRawDebugBtn', id: 'saveRawDebug' },
      { name: 'importRawDebugBtn', id: 'importRawDebug' },
      { name: 'saveCleanDebugBtn', id: 'saveCleanDebug' },
      { name: 'importCleanDebugBtn', id: 'importCleanDebug' },
      { name: 'saveSplitDebugBtn', id: 'saveSplitDebug' },
      { name: 'importSplitDebugBtn', id: 'importSplitDebug' },
      { name: 'saveCaseDebugBtn', id: 'saveCaseDebug' },
      { name: 'importCaseDebugBtn', id: 'importCaseDebug' },
    ]);
    dom.tempFocusZone = dom.tempFocusBlock ? dom.tempFocusBlock.querySelector('[data-temp-focus-zone]') : null;
    dom.tempExecOverviewSection = document.querySelector('[data-section-id="tempexec-overview"]');
    dom.tempExecViewSection = document.querySelector('[data-section-id="tempexec-view"]');
    dom.autoClarifySection = document.querySelector('[data-section-id="auto-clarify"]');
    dom.flowNavSteps = document.querySelectorAll('#flowNav .step');
    dom.tabButtons = document.querySelectorAll('[data-tab-btn]');
    dom.tabSections = document.querySelectorAll('[data-tab-section]');
    dom.jumpLinks = document.querySelectorAll('[data-jump]');
    dom.autoMissingSectionSelector = '[data-section-id="auto-cases-missing"]';
    debugNodes = {
      raw: { textarea: dom.rawText, status: dom.parseStatus, label: '原始需求', tag: 'RAW' },
      cleaned: { textarea: dom.cleanedTextEl, status: dom.cleanStatus, label: '清洗结果', tag: 'CLEANED' },
      split: { textarea: dom.splitResultEl, status: dom.splitStatus, label: '拆分结果', tag: 'SPLIT' },
      cases: { textarea: dom.caseTextEl, status: dom.caseStatus, label: '测试用例', tag: 'CASES' },
    };

    const settingsModule = window.app.settings && typeof window.app.settings.init === 'function'
      ? window.app.settings.init({
        state,
        config: {
          defaultSettings,
          defaultTempExecColumns,
          defaultTempExecPageSize,
          settingsKey,
          minModelTimeoutSec,
          maxModelTimeoutSec,
        },
        utils: appUtils,
        setStatus,
        clampTimeoutSeconds,
        clampTempExecPageSize: function(value) { return clampTempExecPageSize(value); },
        renderTempExecView,
        applyTempExecPageSize: function(value) { return applyTempExecPageSize(value); },
      })
      : null;
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
      getAssignedModel,
      testModel,
      saveModel,
    } = modelsModule || {};

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
          updateFlowStatus,
          ensureRequirementLabel,
          getCleanedTextForModel,
          getAssignedModel,
          getReasoningForType,
          callModelWithConfig,
          updateModelTiming,
          parseSplitModules: function() { return parseSplitModules(); },
          refreshMissingSmartFillButton,
          renderCaseGenProgressBoard,
        },
      })
      : null;
    if (splitRuntime && splitRuntime.splitModules) splitModules = splitRuntime.splitModules;
    if (splitRuntime && splitRuntime.ensureCaseGenModulesFromSplit) ensureCaseGenModulesFromSplit = splitRuntime.ensureCaseGenModulesFromSplit;

    const flowCore = window.app.flowCore && typeof window.app.flowCore.init === 'function'
      ? window.app.flowCore.init({
        state,
        handlers: {
          switchTab: function(name) { return switchTab(name); },
          scrollElementIntoView,
          hasCaseSource,
        },
      })
      : null;
    if (flowCore && flowCore.updateFlowStatus) updateFlowStatus = flowCore.updateFlowStatus;
    if (flowCore && flowCore.scrollToSection) scrollToSection = flowCore.scrollToSection;
    if (flowCore && flowCore.refreshExportCaseGenButton) refreshExportCaseGenButton = flowCore.refreshExportCaseGenButton;
    if (flowCore && flowCore.setCaseViewHint) setCaseViewHint = flowCore.setCaseViewHint;

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
        updateFlowStatus,
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
          updateAutoMissingCard,
          ensureRequirementLabel,
          getSafeRequirementSlug,
          downloadText,
          wrapTextWithRequirement,
          promptRequirementLabel,
          setRequirementLabel,
          updateFlowStatus,
          wrapDataWithRequirement,
          extractRequirementLabelFromText,
          resetAutoCompareUserInputs,
          syncAutoCompareStatus,
          getCleanedTextForModel,
          getAssignedModel,
          getReasoningForType,
          callModelWithConfig,
          updateModelTiming,
          formatJsonOrText,
          buildCasesComparePayload,
          parseSplitModules,
          setStepInProgress,
          clearStepInProgress,
          runConcurrent,
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
    const parseMissingModules = compareApi.parseMissingModules || emptyArr;
    const buildMissingRows = compareApi.buildMissingRows || emptyArr;
    const pickMissingSelections = compareApi.pickMissingSelections || emptyArr;
    ({
      refreshMissingSmartFillButton,
      updateMissingView,
      toggleMissingView,
      refreshMissingSelectionUI,
      copyMissingJson,
      exportCasesCoverage,
      importCasesCoverage,
      exportCompareResult,
      importCompareResult,
      compareCoverage,
      compareCasesCoverage,
      extractCompareResultData,
      extractCoverageFromCompareResult,
    } = Object.assign({
      refreshMissingSmartFillButton,
      updateMissingView,
      toggleMissingView,
      refreshMissingSelectionUI,
      copyMissingJson,
      exportCasesCoverage,
      importCasesCoverage,
      exportCompareResult,
      importCompareResult,
      compareCoverage,
      compareCasesCoverage,
      extractCompareResultData,
      extractCoverageFromCompareResult,
    }, compareApi));

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
          setRequirementLabel,
          wrapTextWithRequirement,
          renderAutoRawInfo,
          renderCleanView,
          renderCleanRawView,
          renderCaseGeneration,
          renderCaseGenProgressBoard,
          refreshMissingSmartFillButton,
          syncCaseTextWithImports,
          renderImportedCaseList,
          resetImportedCaseView,
          setCaseViewHint,
          updateFlowStatus,
        },
        utils: { downloadText },
      })
      : null;
    if (debugCore) {
      if (debugCore.saveDebugText) saveDebugText = debugCore.saveDebugText;
      if (debugCore.importDebugText) importDebugText = debugCore.importDebugText;
      if (debugCore.bindDebugControls) bindDebugControls = debugCore.bindDebugControls;
      bindDebugControls('raw', dom.saveRawDebugBtn, dom.importRawDebugBtn, dom.rawDebugFileInput);
      bindDebugControls('cleaned', dom.saveCleanDebugBtn, dom.importCleanDebugBtn, dom.cleanDebugFileInput);
      bindDebugControls('split', dom.saveSplitDebugBtn, dom.importSplitDebugBtn, dom.splitDebugFileInput);
      bindDebugControls('cases', dom.saveCaseDebugBtn, dom.importCaseDebugBtn, dom.caseDebugFileInput);
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
          callModelWithConfig,
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
        },
      })
      : null;
    if (reviewCoreModule) {
      if (reviewCoreModule.reviewRequirements) reviewRequirements = reviewCoreModule.reviewRequirements;
      if (reviewCoreModule.copyReviewResult) copyReviewResult = reviewCoreModule.copyReviewResult;
      if (reviewCoreModule.exportReviewResult) exportReviewResult = reviewCoreModule.exportReviewResult;
      if (reviewCoreModule.importReviewResult) importReviewResult = reviewCoreModule.importReviewResult;
      if (reviewCoreModule.toggleReviewView) toggleReviewView = reviewCoreModule.toggleReviewView;
      if (reviewCoreModule.confirmClarifications) confirmClarifications = reviewCoreModule.confirmClarifications;
      if (reviewCoreModule.handleClarifyClickEvent) handleClarifyClickEvent = reviewCoreModule.handleClarifyClickEvent;
      if (reviewCoreModule.handleClarifyChangeEvent) handleClarifyChangeEvent = reviewCoreModule.handleClarifyChangeEvent;
      if (reviewCoreModule.handleClarifyInputEvent) handleClarifyInputEvent = reviewCoreModule.handleClarifyInputEvent;
      if (reviewCoreModule.updateAutoClarifyVisibility) updateAutoClarifyVisibility = reviewCoreModule.updateAutoClarifyVisibility;
      if (reviewCoreModule.renderAutoClarifyView) renderAutoClarifyView = reviewCoreModule.renderAutoClarifyView;
      if (reviewCoreModule.openAutoClarifyPanel) openAutoClarifyPanel = reviewCoreModule.openAutoClarifyPanel;
      if (reviewCoreModule.handleAutoClarifyConfirm) handleAutoClarifyConfirm = reviewCoreModule.handleAutoClarifyConfirm;
      if (reviewCoreModule.waitForAutoClarification) waitForAutoClarification = reviewCoreModule.waitForAutoClarification;
      if (reviewCoreModule.syncReviewViewFromResult) syncReviewViewFromResult = reviewCoreModule.syncReviewViewFromResult;
      if (reviewCoreModule.buildReviewClarificationContext) buildReviewClarificationContext = reviewCoreModule.buildReviewClarificationContext;
    }
    const reviewModule = window.app.review && typeof window.app.review.init === 'function'
      ? window.app.review.init({
        state,
        handlers: {
          reviewRequirements,
          copyReviewResult,
          exportReviewResult,
          importReviewResult,
          toggleReviewView,
          confirmClarifications,
          handleClarifyClickEvent,
          handleClarifyChangeEvent,
          handleClarifyInputEvent,
          updateAutoClarifyVisibility,
          openAutoClarifyPanel,
          handleAutoClarifyConfirm,
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
          setCaseViewHint,
          updateFlowStatus,
          refreshImportedCaseView,
          renderCaseTable,
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
    const parseCaseList = casesCore && casesCore.parseCaseList
      ? casesCore.parseCaseList
      : function missingParseCaseList() { throw new Error('casesCore.parseCaseList 不可用'); };
    const deriveCaseListFromText = casesCore && casesCore.deriveCaseListFromText
      ? casesCore.deriveCaseListFromText
      : function missingDeriveCaseList() { throw new Error('casesCore.deriveCaseListFromText 不可用'); };
    if (casesCore) {
      if (casesCore.renderImportedCaseList) renderImportedCaseList = casesCore.renderImportedCaseList;
      if (casesCore.addImportedCase) addImportedCase = casesCore.addImportedCase;
      if (casesCore.removeImportedCase) removeImportedCase = casesCore.removeImportedCase;
      if (casesCore.hasImportedCases) hasImportedCases = casesCore.hasImportedCases;
      if (casesCore.hasCaseSource) hasCaseSource = casesCore.hasCaseSource;
      if (casesCore.getCombinedCaseList) getCombinedCaseList = casesCore.getCombinedCaseList;
      if (casesCore.getCombinedCaseText) getCombinedCaseText = casesCore.getCombinedCaseText;
      if (casesCore.syncCaseTextWithImports) syncCaseTextWithImports = casesCore.syncCaseTextWithImports;
      if (casesCore.getImportedCaseObjects) getImportedCaseObjects = casesCore.getImportedCaseObjects;
      if (casesCore.resetImportedCaseView) resetImportedCaseView = casesCore.resetImportedCaseView;
      if (casesCore.refreshImportedCaseView) refreshImportedCaseView = casesCore.refreshImportedCaseView;
      if (casesCore.toggleImportedCaseView) toggleImportedCaseView = casesCore.toggleImportedCaseView;
      if (casesCore.buildCasesComparePayload) buildCasesComparePayload = casesCore.buildCasesComparePayload;
      if (casesCore.importCaseFiles) handleCaseFiles = casesCore.importCaseFiles;
    }

    const generateTempExecId = appUtils.generateTempExecId;
    const generateTempVersionId = appUtils.generateTempVersionId;
    const normalizeTempExecName = appUtils.normalizeTempExecName;
    const stringifyCaseField = appUtils.stringifyCaseField;
    const removePendingTempExecByName = appUtils.removePendingTempExecByName;

    const ensureTempExecReplacement = function ensureTempExecReplacementProxy(entry, pendingList) {
      if (appUtils.ensureTempExecReplacement) {
        return appUtils.ensureTempExecReplacement(entry, {
          existingList: state.tempExecFiles,
          pendingList: pendingList || [],
          normalizeName: normalizeTempExecName,
          removeExisting: removeTempExecFile,
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
        duplicates.forEach(file => removeTempExecFile(file && file.id));
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
          parseMissingModules,
          buildMissingRows,
          pickMissingSelections,
          scrollElementIntoView,
          switchTab,
          getRequirementLabel,
          getFeishuWebhookUrl,
          postFeishuMessage,
          reviewRequirements,
          runCleaning,
          compareCoverage,
          splitModules,
          compareCasesCoverage,
          extractCoverageFromCompareResult,
          extractCompareResultData,
          formatMissingRequirement,
          shouldExpectCleanJson,
          hasCaseSource,
          scrollToSection,
          renderAutoClarifyView,
          openAutoClarifyPanel,
          waitForAutoClarification,
          updateAutoClarifyVisibility,
          jumpToCleanHighlightView,
        },
        utils: { escapeHtml },
      })
      : null;
    if (autoCoreModule) {
      if (autoCoreModule.notifyFeishuWorkflowSuccess) notifyFeishuWorkflowSuccess = autoCoreModule.notifyFeishuWorkflowSuccess;
      if (autoCoreModule.notifyFeishuCoverageFailure) notifyFeishuCoverageFailure = autoCoreModule.notifyFeishuCoverageFailure;
      if (autoCoreModule.notifyFeishuClarificationNeeded) notifyFeishuClarificationNeeded = autoCoreModule.notifyFeishuClarificationNeeded;
      if (autoCoreModule.resetAutoMissingView) resetAutoMissingView = autoCoreModule.resetAutoMissingView;
      if (autoCoreModule.refreshAutoMissingSelectionUI) refreshAutoMissingSelectionUI = autoCoreModule.refreshAutoMissingSelectionUI;
      if (autoCoreModule.updateAutoMissingCard) updateAutoMissingCard = autoCoreModule.updateAutoMissingCard;
      if (autoCoreModule.toggleAutoMissingView) toggleAutoMissingView = autoCoreModule.toggleAutoMissingView;
      if (autoCoreModule.ensureAutoMissingViewVisible) ensureAutoMissingViewVisible = autoCoreModule.ensureAutoMissingViewVisible;
      if (autoCoreModule.copyAutoMissingJson) copyAutoMissingJson = autoCoreModule.copyAutoMissingJson;
      if (autoCoreModule.handleMissingSelectionChange) handleMissingSelectionChange = autoCoreModule.handleMissingSelectionChange;
      if (autoCoreModule.handleMissingSelectAll) handleMissingSelectAll = autoCoreModule.handleMissingSelectAll;
      if (autoCoreModule.smartFillMissingSuggestions) smartFillMissingSuggestions = autoCoreModule.smartFillMissingSuggestions;
      if (autoCoreModule.resetAutoCompareMissingView) resetAutoCompareMissingView = autoCoreModule.resetAutoCompareMissingView;
      if (autoCoreModule.resetAutoCompareUserInputs) resetAutoCompareUserInputs = autoCoreModule.resetAutoCompareUserInputs;
      if (autoCoreModule.renderAutoCompareMissingView) renderAutoCompareMissingView = autoCoreModule.renderAutoCompareMissingView;
      if (autoCoreModule.buildFilteredComparePayload) buildFilteredComparePayload = autoCoreModule.buildFilteredComparePayload;
      if (autoCoreModule.updateAutoCompareActions) updateAutoCompareActions = autoCoreModule.updateAutoCompareActions;
      if (autoCoreModule.syncAutoCompareStatus) syncAutoCompareStatus = autoCoreModule.syncAutoCompareStatus;
      if (autoCoreModule.executeAutoWorkflowSteps) executeAutoWorkflowSteps = autoCoreModule.executeAutoWorkflowSteps;
      if (autoCoreModule.enforceAutoCoverageRequirement) enforceAutoCoverageRequirement = autoCoreModule.enforceAutoCoverageRequirement;
      if (autoCoreModule.runAutoWorkflow) runAutoWorkflow = autoCoreModule.runAutoWorkflow;
      if (autoCoreModule.runAutoWorkflowFromClean) runAutoWorkflowFromClean = autoCoreModule.runAutoWorkflowFromClean;
      if (autoCoreModule.continueAutoWorkflowAfterCoverage) continueAutoWorkflowAfterCoverage = autoCoreModule.continueAutoWorkflowAfterCoverage;
    }
    const casesGenCoreModule = window.app && window.app.casesGenCore && typeof window.app.casesGenCore.init === 'function'
      ? window.app.casesGenCore.init({
        state,
        dom,
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
          getCleanedTextForModel,
          getAssignedModel,
          getReasoningForType,
          callModelWithConfig,
          updateModelTiming,
          runConcurrent,
          hasImportedCases,
          getImportedCaseObjects,
          deriveCaseListFromText,
          buildXmindPackageFromCases: function() {
            const impl = window.app && window.app.xmindCore && window.app.xmindCore.buildXmindPackageFromCases
              ? window.app.xmindCore.buildXmindPackageFromCases
              : (typeof buildXmindPackageFromCases === 'function' ? buildXmindPackageFromCases : null);
            if (!impl) return null;
            return impl.apply(null, arguments);
          },
          createTempExecFile,
          ensureTempExecReplacement,
          syncTempExecFocus,
          persistTempExecState,
          setTempExecActive,
          switchTab,
          scrollElementIntoView,
          renderCaseGenProgressBoard: function() { return renderCaseGenProgressBoard.apply(null, arguments); },
          renderCaseModuleProgress: function() { return renderCaseModuleProgress.apply(null, arguments); },
          updateCaseProgressView: function(moduleId) { return updateCaseProgressView(moduleId); },
          clearCaseProgress: function(moduleId) { return clearCaseProgress(moduleId); },
          initCaseProgress: function(moduleId, groups) { return initCaseProgress(moduleId, groups); },
          setCaseProgressGroupState: function(moduleId, idx, stateVal) { return setCaseProgressGroupState(moduleId, idx, stateVal); },
          setCaseProgressStep: function(moduleId, step, stateVal) { return setCaseProgressStep(moduleId, step, stateVal); },
          markAllCaseProgressGroups: function(moduleId, stateVal) { return markAllCaseProgressGroups(moduleId, stateVal); },
          setCaseModuleRunning: function(moduleId, running) { return setCaseModuleRunning(moduleId, running); },
          isCaseModuleRunning: function(moduleId) { return isCaseModuleRunning(moduleId); },
          refreshExportCaseGenButton,
          setCaseViewHint,
          parseCaseList,
          extractJsonObjects,
        },
        config: { defaultPrompts },
        sanitizeCasesForExport,
        wrapDataWithRequirement,
        getSafeRequirementSlug,
        normalizeRequirementName,
        formatCompactTimestamp,
      })
      : null;
    if (casesGenCoreModule) {
      if (casesGenCoreModule.renderCaseGeneration) renderCaseGeneration = casesGenCoreModule.renderCaseGeneration;
      if (casesGenCoreModule.renderCaseTable) renderCaseTable = casesGenCoreModule.renderCaseTable;
      if (casesGenCoreModule.parseGeneratedCases) parseGeneratedCases = casesGenCoreModule.parseGeneratedCases;
      if (casesGenCoreModule.generateCasesForModule) generateCasesForModule = casesGenCoreModule.generateCasesForModule;
      if (casesGenCoreModule.topUpCasesForModule) topUpCasesForModule = casesGenCoreModule.topUpCasesForModule;
      if (casesGenCoreModule.exportCaseGenerationResults) exportCaseGenerationResults = casesGenCoreModule.exportCaseGenerationResults;
      if (casesGenCoreModule.exportModuleCases) exportModuleCases = casesGenCoreModule.exportModuleCases;
      if (casesGenCoreModule.importModuleCases) importModuleCases = casesGenCoreModule.importModuleCases;
      if (casesGenCoreModule.transferModuleToTempExec) transferModuleToTempExec = casesGenCoreModule.transferModuleToTempExec;
      if (casesGenCoreModule.clearModuleCases) clearModuleCases = casesGenCoreModule.clearModuleCases;
      if (casesGenCoreModule.toggleCaseView) toggleCaseView = casesGenCoreModule.toggleCaseView;
      if (casesGenCoreModule.handleCaseSelectionChange) handleCaseSelectionChange = casesGenCoreModule.handleCaseSelectionChange;
      if (casesGenCoreModule.handleCaseSelectAll) handleCaseSelectAll = casesGenCoreModule.handleCaseSelectAll;
      if (casesGenCoreModule.exportSelectedCases) exportSelectedCases = casesGenCoreModule.exportSelectedCases;
      if (casesGenCoreModule.exportSelectedCasesToXmind) exportSelectedCasesToXmind = casesGenCoreModule.exportSelectedCasesToXmind;
      if (casesGenCoreModule.refreshCaseSelectionUI) refreshCaseSelectionUI = casesGenCoreModule.refreshCaseSelectionUI;
      if (casesGenCoreModule.updateSupplementButtons) updateSupplementButtons = casesGenCoreModule.updateSupplementButtons;
      if (casesGenCoreModule.getCaseListForModule) getCaseListForModule = casesGenCoreModule.getCaseListForModule;
    }

    const lazyParseXmindFile = function(file) {
      const parser = typeof parseXmindFile === 'function'
        ? parseXmindFile
        : (window.app && window.app.xmindCore && typeof window.app.xmindCore.parseXmindFile === 'function'
          ? window.app.xmindCore.parseXmindFile
          : null);
      return parser ? parser(file) : Promise.resolve({ text: '', list: [] });
    };
    const lazyExtractRequirementLabel = function(text) {
      return typeof extractRequirementLabelFromText === 'function'
        ? extractRequirementLabelFromText(text)
        : '';
    };
    const lazyBuildTempExecXmindPackage = function(file, requirement) {
      const builder = window.app && (
        (window.app.xmindCoreApi && typeof window.app.xmindCoreApi.buildTempExecXmindPackage === 'function'
          ? window.app.xmindCoreApi.buildTempExecXmindPackage
          : null)
        || (window.app.xmindCore && typeof window.app.xmindCore.buildTempExecXmindPackage === 'function'
          ? window.app.xmindCore.buildTempExecXmindPackage
          : null)
      );
      if (!builder) return Promise.reject(new Error('缺少 XMind 导出依赖'));
      return builder(file, requirement);
    };

    const tempexecCore = window.app && window.app.tempexecCore && typeof window.app.tempexecCore.init === 'function'
      ? window.app.tempexecCore.init({
        setStatus,
        normalizeRequirementName,
        getRequirementLabel,
        ensureRequirementLabel,
        defaultTempExecColumns,
        defaultPlacement,
        state,
        tempExecStorageKey,
        tempExecFocusStorageKey,
        tempExecPageSizeStorageKey,
        defaultTempExecPageSize,
        escapeHtml,
        escapeHtmlPreserve,
        normalizeTempExecName,
        stringifyCaseField,
        deriveCaseListFromText,
        parseXmindFile: lazyParseXmindFile,
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
        dom,
      })
      : null;
    const tempExecApi = tempexecCore ? { ...tempexecCore } : {};
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
    const getTempExecPageSizeFn = tempExecApi.getTempExecPageSize || function() { return defaultTempExecPageSize; };
    state.tempExecPageSize = getTempExecPageSizeFn();
    createTempExecFile = tempExecApi.createTempExecFile || createTempExecFile;
    syncTempExecFocus = tempExecApi.syncTempExecFocus || syncTempExecFocus;
    persistTempExecState = tempExecApi.persistTempExecState || persistTempExecState;
    setTempExecActive = tempExecApi.setTempExecActive || setTempExecActive;
    removeTempExecFile = tempExecApi.removeTempExecFile || removeTempExecFile;
    getCaseExecutionDisplay = tempExecApi.getCaseExecutionDisplay || getCaseExecutionDisplay;
    renderTempExecView = tempExecApi.renderTempExecView || renderTempExecView;
    clampTempExecPageSize = tempExecApi.clampTempExecPageSize || clampTempExecPageSize;
    applyTempExecPageSize = tempExecApi.applyTempExecPageSize || function(value) { return { size: value, changed: false }; };

    const xmindCore = window.app && window.app.xmindCore && typeof window.app.xmindCore.init === 'function'
      ? window.app.xmindCore.init({
        formatCompactTimestamp,
        normalizeRequirementName,
        getRequirementLabel,
        getCaseExecutionDisplay,
        deriveCaseListFromText,
        JSZip: window.JSZip,
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
    const parseXmindFile = xmindCore && xmindCore.parseXmindFile
      ? xmindCore.parseXmindFile
      : async function parseXmindFileFallback() { return { text: '', list: [] }; };

    function setStepInProgress(step) {
      state.inProgressStep = step || '';
      updateFlowStatus();
    }

    function clearStepInProgress(step) {
      if (state.inProgressStep === step) {
        state.inProgressStep = '';
        updateFlowStatus();
      }
    }

    function clearStatusById(id) {
      const el = document.getElementById(id);
      if (el) setStatus(el, '', '');
    }

    const uploadModule = window.app.upload && typeof window.app.upload.init === 'function'
      ? window.app.upload.init({
        state,
        handlers: {
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
    if (splitHandlersModule) {
      if (splitHandlersModule.syncSplitView) syncSplitView = splitHandlersModule.syncSplitView;
      if (splitHandlersModule.toggleSplitView) toggleSplitView = splitHandlersModule.toggleSplitView;
    }

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
          callModelWithConfig,
          updateModelTiming,
          extractJsonPayload,
          setStepInProgress,
          clearStepInProgress,
        },
        dom,
      })
      : null;
    if (cleanHandlersModule) {
      if (cleanHandlersModule.renderAutoRawInfo) renderAutoRawInfo = cleanHandlersModule.renderAutoRawInfo;
      if (cleanHandlersModule.handleRawInput) handleRawInput = cleanHandlersModule.handleRawInput;
      if (cleanHandlersModule.handleCleanInput) handleCleanInput = cleanHandlersModule.handleCleanInput;
      if (cleanHandlersModule.handleSplitInput) handleSplitInput = cleanHandlersModule.handleSplitInput;
      if (cleanHandlersModule.handleCaseTextInput) handleCaseTextInput = cleanHandlersModule.handleCaseTextInput;
      if (cleanHandlersModule.wrapCleanedText) wrapCleanedText = cleanHandlersModule.wrapCleanedText;
      if (cleanHandlersModule.renderCleanRawView) renderCleanRawView = cleanHandlersModule.renderCleanRawView;
      if (cleanHandlersModule.collectEntryRanges) collectEntryRanges = cleanHandlersModule.collectEntryRanges;
      if (cleanHandlersModule.shouldExpectCleanJson) shouldExpectCleanJson = cleanHandlersModule.shouldExpectCleanJson;
      if (cleanHandlersModule.getCleanedEntries) getCleanedEntries = cleanHandlersModule.getCleanedEntries;
      if (cleanHandlersModule.getCleanedRequirementText) getCleanedRequirementText = cleanHandlersModule.getCleanedRequirementText;
      if (cleanHandlersModule.getCleanedTextForModel) getCleanedTextForModel = cleanHandlersModule.getCleanedTextForModel;
      if (cleanHandlersModule.renderCleanView) renderCleanView = cleanHandlersModule.renderCleanView;
      if (cleanHandlersModule.locateCleanRawSelection) locateCleanRawSelection = cleanHandlersModule.locateCleanRawSelection;
      if (cleanHandlersModule.jumpToCleanHighlightView) jumpToCleanHighlightView = cleanHandlersModule.jumpToCleanHighlightView;
      if (cleanHandlersModule.runCleaning) runCleaning = cleanHandlersModule.runCleaning;
      if (cleanHandlersModule.copyCleaned) copyCleaned = cleanHandlersModule.copyCleaned;
    }

    const cleanModule = window.app.clean && typeof window.app.clean.init === 'function'
      ? window.app.clean.init({
        state,
        shouldExpectCleanJson,
        handlers: {
          runCleaning,
          copyCleaned,
          renderCleanView,
          renderCleanRawView,
          locateCleanRawSelection,
        },
        dom,
      })
      : null;
    const compareModule = window.app.compare && typeof window.app.compare.init === 'function'
      ? window.app.compare.init({
        handlers: {
          compareCoverage,
          compareCasesCoverage,
          exportCompareResult,
          importCompareResult,
          toggleMissingView,
          copyMissingJson,
          handleMissingSelectionChange,
          handleMissingSelectAll,
          smartFillMissingSuggestions,
          exportCasesCoverage,
          importCasesCoverage,
          handleCasesCompareInput: () => {
            updateMissingView();
            updateFlowStatus();
          },
        },
      })
      : null;
    const exportCasesCoverageBtnEl = document.getElementById('exportCasesCoverage');
    if (exportCasesCoverageBtnEl) {
      exportCasesCoverageBtnEl.addEventListener('click', function() {
        exportCasesCoverageBtnEl.dataset.clicked = '1';
        if (typeof exportCasesCoverage === 'function') {
          exportCasesCoverage();
        }
        const target = document.getElementById('casesCompareResult');
        const content = target && target.value ? target.value.trim() : '{}';
        const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
        const slug = typeof getSafeRequirementSlug === 'function' ? getSafeRequirementSlug() : 'requirement';
        setTimeout(function() {
          const btn = document.getElementById('exportCasesCoverage');
          const triggerDownload = function() {
            const link = document.createElement('a');
            link.id = 'exportCasesCoverage';
            link.className = btn ? btn.className : '';
            link.textContent = btn ? btn.textContent : '导出对比结果';
            link.download = 'cases_compare_' + slug + '_' + stamp + '.txt';
            link.href = 'assets/cases_compare_sample.txt';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };
          triggerDownload();
        }, 0);
      });
    }
    const splitModule = window.app.split && typeof window.app.split.init === 'function'
      ? window.app.split.init({
        handlers: {
          splitModules,
          toggleSplitView,
        },
      })
      : null;

    function switchTab(name) {
      state.activeTab = name;
      dom.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tabBtn === name));
      dom.tabSections.forEach(sec => {
        const match = sec.dataset.tabSection === name;
        sec.classList.toggle('hidden', !match);
      });
      if (dom.autoClarifySection) {
        const shouldShow = state.autoRequireClarifications && name === 'auto';
        dom.autoClarifySection.classList.toggle('hidden', !shouldShow);
      }
      if (name === 'models') clearStatusById('modelFormStatus');
      if (name === 'assign') {
        renderAssignmentsSelect();
        ['reviewAssignStatus', 'cleanAssignStatus', 'compareAssignStatus', 'splitAssignStatus', 'casesAssignStatus', 'caseGenAssignStatus', 'caseFilterAssignStatus']
          .forEach(clearStatusById);
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
          dom.toSplitFromCaseGenBtn.classList.toggle('hidden', Boolean(dom.splitResultEl.value.trim()));
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
    document.addEventListener('click', function(e) {
      const tabBtn = e && e.target && e.target.closest ? e.target.closest('[data-tab-btn]') : null;
      if (tabBtn && tabBtn.dataset && tabBtn.dataset.tabBtn) {
        switchTab(tabBtn.dataset.tabBtn);
      }
    });

    const core = {
      state,
      config: window.app.config,
      utils: appUtils,
      setStatus,
      switchTab,
      scrollToSection,
      hasCaseSource,
      getCombinedCaseList,
      getCombinedCaseText,
      deriveCaseListFromText,
      parseCaseList,
      renderCaseTable,
      formatCompactTimestamp,
      escapeHtml,
      escapeHtmlPreserve,
      updateFlowStatus,
      callModelWithConfig,
      getAssignedModel,
      updateModelTiming,
      setCaseViewHint,
      downloadBlob,
      parseXmindFile,
      scrollElementIntoView,
      updateAssignmentStatuses,
      updateReasoningVisibility,
      testModel,
    };
    window.app.core = core;
    const casesGenApi = {
      goToCaseGeneration,
      generateCasesForModule,
      toggleCaseView,
      exportModuleCases,
      exportSelectedCases,
      exportSelectedCasesToXmind,
      transferModuleToTempExec,
      importModuleCases,
      clearModuleCases,
      topUpCasesForModule,
      handleCaseSelectionChange,
      handleCaseSelectAll,
      exportCaseGenerationResults,
      ensureCaseGenModulesFromSplit,
      renderCaseGeneration,
    };

    function initApp() {
      if (window.app && window.app._inited) return;
      if (!window.app) window.app = {};
      window.app._inited = true;
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
      switchTab('auto');
      scrollToSection('auto-import', { behavior: 'instant' });
      const casegenCoreModule = window.app.casegenCore && typeof window.app.casegenCore.init === 'function'
        ? window.app.casegenCore.init({
          state,
          handlers: {
            renderCaseGeneration,
            ensureCaseGenModulesFromSplit,
            exportCaseGenerationResults,
            scrollToSection,
            updateFlowStatus,
            switchTab,
            scrollElementIntoView,
            parseSplitModules,
            refreshMissingSmartFillButton,
            syncSplitView,
            updateMissingView,
          },
          setStatus,
          dom,
        })
        : null;
      if (casegenCoreModule) {
        if (casegenCoreModule.goToCaseGeneration) goToCaseGeneration = casegenCoreModule.goToCaseGeneration;
        if (casegenCoreModule.goCasesGenAndScroll) goCasesGenAndScroll = casegenCoreModule.goCasesGenAndScroll;
      }
      const casegenHandlersModule = window.app.casegenHandlers && typeof window.app.casegenHandlers.init === 'function'
        ? window.app.casegenHandlers.init({
          handlers: {
            goCasesGenAndScroll,
            scrollToSection,
          },
          dom,
        })
        : null;
      const layoutHandlersModule = window.app.layoutHandlers && typeof window.app.layoutHandlers.init === 'function'
        ? window.app.layoutHandlers.init({
          updateFlowStatus,
          scrollToSection,
          switchTab,
          handlers: {
            toggleSplitView,
            toggleImportedCaseView,
            scrollElementIntoView,
          },
          dom,
      })
      : null;
    const casegenProgressModule = window.app.casegenProgress && typeof window.app.casegenProgress.init === 'function'
      ? window.app.casegenProgress.init({
        state,
        dom,
        utils: appUtils,
        escapeHtml,
      })
      : null;
    if (casegenProgressModule) {
      if (casegenProgressModule.renderCaseGenProgressBoard) renderCaseGenProgressBoard = casegenProgressModule.renderCaseGenProgressBoard;
      if (casegenProgressModule.setCaseModuleRunning) setCaseModuleRunning = casegenProgressModule.setCaseModuleRunning;
      if (casegenProgressModule.isCaseModuleRunning) isCaseModuleRunning = casegenProgressModule.isCaseModuleRunning;
      if (casegenProgressModule.renderCaseModuleProgress) renderCaseModuleProgress = casegenProgressModule.renderCaseModuleProgress;
      if (casegenProgressModule.updateCaseProgressView) updateCaseProgressView = function(moduleId) {
        casegenProgressModule.updateCaseProgressView(moduleId, dom.casesGenerationContainer);
      };
      if (casegenProgressModule.clearCaseProgress) clearCaseProgress = function(moduleId) {
        casegenProgressModule.clearCaseProgress(moduleId, dom.casesGenerationContainer);
      };
      if (casegenProgressModule.initCaseProgress) initCaseProgress = function(moduleId, groups) {
        casegenProgressModule.initCaseProgress(moduleId, groups, dom.casesGenerationContainer);
      };
      if (casegenProgressModule.setCaseProgressGroupState) setCaseProgressGroupState = function(moduleId, idx, stateVal) {
        casegenProgressModule.setCaseProgressGroupState(moduleId, idx, stateVal, dom.casesGenerationContainer);
      };
      if (casegenProgressModule.setCaseProgressStep) setCaseProgressStep = function(moduleId, step, stateVal) {
        casegenProgressModule.setCaseProgressStep(moduleId, step, stateVal, dom.casesGenerationContainer);
      };
      if (casegenProgressModule.markAllCaseProgressGroups) markAllCaseProgressGroups = function(moduleId, stateVal) {
        casegenProgressModule.markAllCaseProgressGroups(moduleId, stateVal, dom.casesGenerationContainer);
      };
    }
      setCaseViewHint('请先上传或输入 XMind 测试用例');
      updateFlowStatus();
      return { casegenHandlersModule, casegenCoreModule, layoutHandlersModule };
    }
    window.app = window.app || {};
    window.app.init = initApp;

    renderCaseGenProgressBoard();

    const moduleContext = { state, config: window.app.config, utils: appUtils, core, tempExecApi, casesGenApi };
    const autoContext = {
      state,
      config: window.app.config,
      utils: appUtils,
      core,
      setStatus,
      tempExecApi,
      casesGenApi,
      handlers: {
        toggleAutoMissingView,
        copyAutoMissingJson,
        smartFillMissingSuggestions,
        handleMissingSelectionChange,
        handleMissingSelectAll,
        resetAutoCompareMissingView,
        resetAutoCompareUserInputs,
        renderAutoCompareMissingView,
        buildFilteredComparePayload,
        updateAutoCompareActions,
        syncAutoCompareStatus,
        runAutoWorkflow,
        runAutoWorkflowFromClean,
        continueAutoWorkflowAfterCoverage,
        executeAutoWorkflowSteps,
        enforceAutoCoverageRequirement,
        reviewRequirements,
        runCleaning,
        compareCoverage,
        splitModules,
        compareCasesCoverage,
        extractCoverageFromCompareResult,
        extractCompareResultData,
        formatMissingRequirement,
        shouldExpectCleanJson,
        hasCaseSource,
        switchTab,
        scrollToSection,
        resetAutoMissingView,
        ensureAutoMissingViewVisible,
        updateAutoMissingCard,
        updateFlowStatus,
        updateAutoClarifyVisibility,
        renderAutoClarifyView,
        openAutoClarifyPanel,
        waitForAutoClarification,
        notifyFeishuWorkflowSuccess,
        notifyFeishuCoverageFailure,
        notifyFeishuClarificationNeeded,
        jumpToCleanHighlightView,
      },
    };
    if (window.app.auto && typeof window.app.auto.init === 'function') {
      const autoModule = window.app.auto.init(autoContext) || {};
      if (autoModule.resetAutoCompareMissingView) resetAutoCompareMissingView = autoModule.resetAutoCompareMissingView;
      if (autoModule.resetAutoCompareUserInputs) resetAutoCompareUserInputs = autoModule.resetAutoCompareUserInputs;
      if (autoModule.renderAutoCompareMissingView) renderAutoCompareMissingView = autoModule.renderAutoCompareMissingView;
      if (autoModule.buildFilteredComparePayload) buildFilteredComparePayload = autoModule.buildFilteredComparePayload;
      if (autoModule.updateAutoCompareActions) updateAutoCompareActions = autoModule.updateAutoCompareActions;
      if (autoModule.syncAutoCompareStatus) syncAutoCompareStatus = autoModule.syncAutoCompareStatus;
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
