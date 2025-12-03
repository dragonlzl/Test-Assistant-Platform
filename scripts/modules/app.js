    // 模型管理表单
    const modelDisplayNameEl = document.getElementById('modelDisplayName');
    const modelProviderEl = document.getElementById('modelProvider');
    const modelBaseUrlEl = document.getElementById('modelBaseUrl');
    const modelApiKeyEl = document.getElementById('modelApiKey');
    const modelIdentifierEl = document.getElementById('modelIdentifier');
    const modelMaxTokensEl = document.getElementById('modelMaxTokens');
    const modelFormStatus = document.getElementById('modelFormStatus');
    const modelListEl = document.getElementById('modelList');
    const createModelBtn = document.getElementById('createModelBtn');
    const modelFormWrapper = document.getElementById('modelFormWrapper');
    const modelFormTitle = document.getElementById('modelFormTitle');
    const saveModelBtn = document.getElementById('saveModelBtn');
    const resetModelFormBtn = document.getElementById('resetModelForm');
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
    const assignPromptDom = {};
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
        dom: assignPromptDom,
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
    const reqCore = requirementCoreModule || {};

    const normalizeRequirementName = reqCore.normalizeRequirementName || function normalizeRequirementNameFallback(name) {
      if (!name) return '';
      return String(name).trim();
    };

    const stripRequirementHeader = reqCore.stripRequirementHeader || function stripRequirementHeaderFallback(text) {
      if (!text) return '';
      const lines = text.split(/\r?\n/);
      if (lines.length && /^#需求标识：/.test(lines[0].trim())) return lines.slice(1).join('\n');
      return text;
    };

    const getRequirementLabel = reqCore.getRequirementLabel || function getRequirementLabelFallback(allowFallback) {
      const label = state.requirementLabel || normalizeRequirementName(state.lastRawImportName);
      if (label) return label;
      if (allowFallback === false) return '';
      return '当前需求';
    };

    const setRequirementLabel = reqCore.setRequirementLabel || function setRequirementLabelFallback(label, source) {
      const normalized = normalizeRequirementName(label);
      if (!normalized) return '';
      state.requirementLabel = normalized;
      if (source) state.requirementLabelSource = source;
      renderAutoRawInfo();
      return normalized;
    };

    const buildRequirementPrompt = reqCore.buildRequirementPrompt || function buildRequirementPromptFallback(text) {
      const suffix = '请填写本次需求名称，作为需求标识（不可为空）';
      return text ? `${text}\n${suffix}` : suffix;
    };

    const ensureRequirementLabel = reqCore.ensureRequirementLabel || function ensureRequirementLabelFallback(promptText) {
      const existing = getRequirementLabel(false);
      if (existing) return existing;
      const text = window.prompt(buildRequirementPrompt(promptText));
      if (!text) return '';
      return setRequirementLabel(text, 'manual');
    };

    const promptRequirementLabel = reqCore.promptRequirementLabel || function promptRequirementLabelFallback(promptText) {
      const current = getRequirementLabel(false);
      const text = window.prompt(buildRequirementPrompt(promptText), current || '');
      if (!text) return '';
      return setRequirementLabel(text, 'manual');
    };

    const promptTempExecRequirement = reqCore.promptTempExecRequirement || function promptTempExecRequirementFallback(fileName, fallbackLabel) {
      const base = normalizeRequirementName(fallbackLabel || '')
        || normalizeRequirementName(getRequirementLabel(false))
        || normalizeRequirementName((fileName || '').replace(/\.[^.]+$/, ''))
        || '';
      const input = window.prompt(`请输入需求标识（用于区分执行用例），文件：${fileName || ''}`, base);
      if (!input) return '';
      return setRequirementLabel(normalizeRequirementName(input), 'import');
    };

    const formatCompactTimestamp = reqCore.formatCompactTimestamp || function formatCompactTimestampFallback() {
      const d = new Date();
      const pad = function(n) { return n.toString().padStart(2, '0'); };
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    };

    const wrapDataWithRequirement = reqCore.wrapDataWithRequirement || function wrapDataWithRequirementFallback(data, type) {
      const wrapped = { requirement: getRequirementLabel(true), data };
      if (data && typeof data === 'object' && !Array.isArray(data) && Object.prototype.hasOwnProperty.call(data, 'data')) {
        wrapped.data = data.data;
      }
      if (type) wrapped.type = type;
      return wrapped;
    };

    const unwrapRequirementPayload = reqCore.unwrapRequirementPayload || function unwrapRequirementPayloadFallback(rawText) {
      const stripped = stripCodeFence(rawText || '').trim();
      return { payload: stripped, requirement: '', type: '' };
    };

    const extractRequirementLabelFromText = reqCore.extractRequirementLabelFromText || function extractRequirementLabelFromTextFallback() { return ''; };

    const wrapTextWithRequirement = reqCore.wrapTextWithRequirement || function wrapTextWithRequirementFallback(text, type) {
      const stripped = stripCodeFence(stripRequirementHeader(text || ''));
      if (!stripped) return '';
      try {
        const parsed = JSON.parse(stripped);
        return JSON.stringify(wrapDataWithRequirement(parsed, type), null, 2);
      } catch (err) {
        const header = [`#需求标识：${getRequirementLabel(true)}`];
        if (type) header.push(`#类型：${type}`);
        return `${header.join('\n')}\n${stripped}`;
      }
    };

    const getRequirementDisplayName = requirementCoreModule && requirementCoreModule.getRequirementDisplayName
      ? requirementCoreModule.getRequirementDisplayName
      : function getRequirementDisplayNameFallback() { return getRequirementLabel(true); };

    const getSafeRequirementSlug = requirementCoreModule && requirementCoreModule.getSafeRequirementSlug
      ? requirementCoreModule.getSafeRequirementSlug
      : function getSafeRequirementSlugFallback() {
        return (getRequirementLabel(true) || 'requirement').replace(/[\\/:*?"<>|]/g, '_');
      };

    async function notifyFeishuCoverageFailure() {
      if (!state.autoRunning || !getFeishuWebhookUrl()) return;
      await postFeishuMessage(`需求：${getRequirementDisplayName()}，清洗覆盖率不足100%，需手动重新清洗。`);
    }

    async function notifyFeishuWorkflowSuccess() {
      if (!getFeishuWebhookUrl()) return;
      await postFeishuMessage('全流程执行成功，请前往工具查看结果！！！');
    }

    async function notifyFeishuClarificationNeeded() {
      if (!state.autoRunning || !state.autoRequireClarifications) return;
      if (!getFeishuWebhookUrl()) return;
      await postFeishuMessage('请前往工具，进行需求澄清，确认澄清结果后可继续执行。');
    }

    const splitCore = window.app && window.app.splitCore && typeof window.app.splitCore.init === 'function'
      ? window.app.splitCore.init({ moduleFieldAliases, normalizeRequirementName, unwrapRequirementPayload })
      : null;
    const pickFirstString = splitCore && splitCore.pickFirstString ? splitCore.pickFirstString : function pickFirstStringFallback(source, aliases) {
      if (!source) return '';
      if (Array.isArray(source)) {
        for (let i = 0; i < source.length; i += 1) {
          const val = pickFirstStringFallback(source[i], aliases);
          if (val) return val;
        }
        return '';
      }
      if (typeof source === 'object') {
        for (let i = 0; i < aliases.length; i += 1) {
          const alias = aliases[i];
          const value = source[alias];
          if (typeof value === 'string' && value.trim()) return value.trim();
        }
      }
      return '';
    };
    const pickFirstValue = splitCore && splitCore.pickFirstValue ? splitCore.pickFirstValue : function pickFirstValueFallback(source, aliases) {
      if (!source) return undefined;
      if (Array.isArray(source)) {
        for (let i = 0; i < source.length; i += 1) {
          const val = pickFirstValueFallback(source[i], aliases);
          if (val !== undefined) return val;
        }
        return undefined;
      }
      if (typeof source === 'object') {
        for (let i = 0; i < aliases.length; i += 1) {
          const alias = aliases[i];
          if (Object.prototype.hasOwnProperty.call(source, alias)) {
            const value = source[alias];
            if (value !== undefined) return value;
          }
        }
      }
      return undefined;
    };
    const pickFirstArray = splitCore && splitCore.pickFirstArray ? splitCore.pickFirstArray : function pickFirstArrayFallback(source, aliases) {
      if (!source) return [];
      if (Array.isArray(source)) {
        for (let i = 0; i < source.length; i += 1) {
          const item = source[i];
          if (Array.isArray(item)) {
            if (item.length && typeof item[0] === 'string') return item;
          }
          if (item && typeof item === 'object') {
            const nested = pickFirstArrayFallback(item, aliases);
            if (nested && nested.length) return nested;
          }
        }
        return [];
      }
      if (typeof source === 'object') {
        for (let i = 0; i < aliases.length; i += 1) {
          const alias = aliases[i];
          const val = source[alias];
          if (Array.isArray(val)) return val;
        }
      }
      return [];
    };

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

    function clearRawInput() {
      rawText.value = '';
      fileName.textContent = '未选择文件';
      state.lastRawImportName = '';
      state.requirementLabel = '';
      state.requirementLabelSource = '';
      setStatus(parseStatus, '', '');
      renderAutoRawInfo();
      renderCleanRawView(state.cleanViewSelection);
      updateFlowStatus();
    }

    function getNestedValue(source, path) {
      if (!path || !path.length) return source;
      let current = source;
      for (let i = 0; i < path.length; i += 1) {
        if (current === undefined || current === null) {
          return undefined;
        }
        current = current[path[i]];
      }
      return current;
    }
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

    // 清洗与对比
    // 基础元素
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const fileName = document.getElementById('fileName');
    const rawText = document.getElementById('rawText');
    const parseStatus = document.getElementById('parseStatus');
    const runReviewBtn = document.getElementById('runReview');
    const reviewStatus = document.getElementById('reviewStatus');
    const reviewResultEl = document.getElementById('reviewResult');
    const copyReviewResultBtn = document.getElementById('copyReviewResult');
    const exportReviewResultBtn = document.getElementById('exportReviewResult');
    const importReviewResultBtn = document.getElementById('importReviewResult');
    const reviewImportFileInput = document.getElementById('reviewImportFile');
    const toggleReviewViewBtn = document.getElementById('toggleReviewView');
    const confirmClarificationsBtn = document.getElementById('confirmClarifications');
    const reviewViewContainer = document.getElementById('reviewViewContainer');
    const toggleSplitViewBtn = document.getElementById('toggleSplitView');
    const splitViewContainer = document.getElementById('splitViewContainer');
    const cleanViewContainer = document.getElementById('cleanViewContainer');
    const cleanHighlightAllBtn = document.getElementById('cleanHighlightAllBtn');
    const toggleCleanViewBtn = document.getElementById('toggleCleanViewBtn');
    const cleanRawView = document.getElementById('cleanRawView');
    const toggleCleanRawViewBtn = document.getElementById('toggleCleanRawViewBtn');
    const cleanRawLocateBtn = document.getElementById('cleanRawLocateBtn');

    const runCleanBtn = document.getElementById('runClean');
    const compareBtnEl = document.getElementById('compareBtn');
    const splitBtnEl = document.getElementById('splitBtn');
    const casesCompareBtnEl = document.getElementById('casesCompareBtn');
    const copyBtn = document.getElementById('copyCleaned');
    const cleanedTextEl = document.getElementById('cleanedText');
    const compareResultEl = document.getElementById('compareResult');
    const exportCompareResultBtn = document.getElementById('exportCompareResult');
    const importCompareResultBtn = document.getElementById('importCompareResult');
    const compareImportFileInput = document.getElementById('compareImportFile');
    const splitResultEl = document.getElementById('splitResult');
    const caseFileInput = document.getElementById('caseFileInput');
    const caseDropZone = document.getElementById('caseDropZone');
    const caseFileListEl = document.getElementById('caseFileList');
    const caseTextEl = document.getElementById('caseText');
    const caseStatus = document.getElementById('caseStatus');
    const caseViewBtn = document.getElementById('caseViewBtn');
    const caseViewContainer = document.getElementById('caseViewContainer');
    const caseViewHint = document.getElementById('caseViewHint');
    const autoRawInput = document.getElementById('autoRawFile');
    const autoRawDropZone = document.getElementById('autoRawDropZone');
    const autoRawListEl = document.getElementById('autoRawFileList');
    const autoRawClearBtn = document.getElementById('autoRawClear');
    const autoCaseInput = document.getElementById('autoCaseFile');
    const autoCaseDropZone = document.getElementById('autoCaseDropZone');
    const tempExecDropZone = document.getElementById('tempExecDropZone');
    const tempExecInput = document.getElementById('tempExecInput');
    const tempExecStatus = document.getElementById('tempExecStatus');
    const tempExecNav = document.getElementById('tempExecNav');
    const tempFocusBlock = document.getElementById('tempFocusBlock');
    const tempFocusZone = tempFocusBlock ? tempFocusBlock.querySelector('[data-temp-focus-zone]') : null;
    const tempVersionGrid = document.getElementById('tempVersionGrid');
    const createTempVersionBtn = document.getElementById('createTempVersionBtn');
    const tempExecView = document.getElementById('tempExecView');
    const tempExecMindContainer = document.getElementById('tempExecMindContainer');
    const exportTempExecBtn = document.getElementById('exportTempExecBtn');
    const exportTempExecConfigBtn = document.getElementById('exportTempExecConfigBtn');
    const importTempExecBtn = document.getElementById('importTempExecBtn');
    const exportTempExecXmindBtn = document.getElementById('exportTempExecXmindBtn');
    const importTempExecConfigBtn = document.getElementById('importTempExecConfigBtn');
    const tempExecMindBtn = document.getElementById('tempExecMindBtn');
    const tempExecOverviewBtn = document.getElementById('tempExecOverviewBtn');
    const tempExecOverview = document.getElementById('tempExecOverview');
    const tempExecOverviewSection = document.querySelector('[data-section-id="tempexec-overview"]');
    const tempExecViewSection = document.querySelector('[data-section-id="tempexec-view"]');
    const tempExecBackBtn = document.getElementById('tempExecBackBtn');
    const importTempExecFile = document.getElementById('importTempExecFile');
    const importTempExecConfigFile = document.getElementById('importTempExecConfigFile');
    const autoCaseFileListEl = document.getElementById('autoCaseFileList');
    const autoWorkflowBtn = document.getElementById('runAutoWorkflow');
    const autoClarifyToggle = document.getElementById('autoNeedClarify');
    const autoClarifySection = document.querySelector('[data-section-id="auto-clarify"]');
    const autoClarifyContainer = document.getElementById('autoClarifyContainer');
    const autoClarifyConfirmBtn = document.getElementById('autoClarifyConfirm');
    const autoClarifyStatus = document.getElementById('autoClarifyStatus');
    const autoClarifyToggleBtn = document.getElementById('autoClarifyToggleBtn');
    const autoJumpCleanViewBtn = document.getElementById('autoJumpCleanView');
    const autoFillCleanBtn = document.getElementById('autoFillCleanBtn');
    const autoCompareSuggestionInput = document.getElementById('autoCompareSuggestion');
    const autoCompareMissing = document.getElementById('autoCompareMissing');
    const autoCompareStatus = document.getElementById('autoCompareStatus');
    const autoRecleanBtn = document.getElementById('autoRecleanBtn');
    const autoRecleanStatus = document.getElementById('autoRecleanStatus');
    const autoIgnoreCoverageBtn = document.getElementById('autoIgnoreCoverageBtn');
    const autoMissingToggle = document.getElementById('autoMissingToggle');
    const autoMissingCopy = document.getElementById('autoMissingCopy');
    const autoMissingView = document.getElementById('autoMissingView');
    const autoMissingStatus = document.getElementById('autoMissingStatus');
    const autoMissingSmartFillBtn = document.getElementById('autoMissingSmartFill');
    const autoMissingGoUsecaseBtn = document.getElementById('autoMissingGoUsecase');
    const missingViewStatus = document.getElementById('missingViewStatus');
    const missingViewBtnEl = document.getElementById('missingViewBtn');
    const copyMissingBtnEl = document.getElementById('copyMissingBtn');
    const casesCompareResultEl = document.getElementById('casesCompareResult');
    const missingViewContainerEl = document.getElementById('missingViewContainer');
    const exportCasesCoverageBtn = document.getElementById('exportCasesCoverage');
    const importCasesCoverageBtn = document.getElementById('importCasesCoverage');
    const importCasesCoverageFile = document.getElementById('importCasesCoverageFile');
    const missingSmartFillBtn = document.getElementById('missingSmartFillBtn');
    const goUsecaseGenBtn = document.getElementById('goUsecaseGen');
    const casesGoUsecaseGenBtn = document.getElementById('casesGoUsecaseGen');
    const casesGenerationContainer = document.getElementById('casesGenerationContainer');
    const caseGenProgressPanel = document.getElementById('caseGenProgressPanel');
    const caseGenProgressList = document.getElementById('caseGenProgressList');
    const cleanStatus = document.getElementById('cleanStatus');
    const compareStatus = document.getElementById('compareStatus');
    const splitStatus = document.getElementById('splitStatus');
    const casesCoverageStatus = document.getElementById('casesCoverageStatus');
    const caseGenStatus = document.getElementById('caseGenStatus');
    const autoWorkflowStatus = document.getElementById('autoWorkflowStatus');
    const casesModuleProgress = document.getElementById('casesModuleProgress');
    const exportCaseGenBtn = document.getElementById('exportCaseGen');
    const toSplitFromCaseGenBtn = document.getElementById('toSplitFromCaseGen');
    const saveRawDebugBtn = document.getElementById('saveRawDebug');
    const importRawDebugBtn = document.getElementById('importRawDebug');
    const rawDebugFileInput = document.getElementById('rawDebugFile');
    const saveCleanDebugBtn = document.getElementById('saveCleanDebug');
    const importCleanDebugBtn = document.getElementById('importCleanDebug');
    const cleanDebugFileInput = document.getElementById('cleanDebugFile');
    const saveSplitDebugBtn = document.getElementById('saveSplitDebug');
    const importSplitDebugBtn = document.getElementById('importSplitDebug');
    const splitDebugFileInput = document.getElementById('splitDebugFile');
    const saveCaseDebugBtn = document.getElementById('saveCaseDebug');
    const importCaseDebugBtn = document.getElementById('importCaseDebug');
    const caseDebugFileInput = document.getElementById('caseDebugFile');
    debugNodes = {
      raw: { textarea: rawText, status: parseStatus, label: '原始需求', tag: 'RAW' },
      cleaned: { textarea: cleanedTextEl, status: cleanStatus, label: '清洗结果', tag: 'CLEANED' },
      split: { textarea: splitResultEl, status: splitStatus, label: '拆分结果', tag: 'SPLIT' },
      cases: { textarea: caseTextEl, status: caseStatus, label: '测试用例', tag: 'CASES' },
    };
    const flowNavSteps = document.querySelectorAll('#flowNav .step');
    const saveDefaultPromptsBtn = document.getElementById('saveDefaultPrompts');
    const exportDefaultPromptsBtn = document.getElementById('exportDefaultPrompts');
    const importDefaultPromptsBtn = document.getElementById('importDefaultPrompts');
    const importDefaultPromptsFile = document.getElementById('importDefaultPromptsFile');
    const defaultPromptStatus = document.getElementById('defaultPromptStatus');
    const modelTimeoutInput = document.getElementById('modelTimeoutInput');
    const saveModelTimeoutBtn = document.getElementById('saveModelTimeout');
    const modelTimeoutStatus = document.getElementById('modelTimeoutStatus');
    const feishuWebhookInput = document.getElementById('feishuWebhook');
    const feishuMentionInput = document.getElementById('feishuNotifyUser');
    const saveFeishuWebhookBtn = document.getElementById('saveFeishuWebhook');
    const testFeishuWebhookBtn = document.getElementById('testFeishuWebhook');
    const feishuWebhookStatus = document.getElementById('feishuWebhookStatus');
    const tempExecPageSizeInput = document.getElementById('tempExecPageSizeInput');
    const saveTempExecPageSizeBtn = document.getElementById('saveTempExecPageSize');
    const tempExecPageSizeStatus = document.getElementById('tempExecPageSizeStatus');
    const tempExecColumnForm = document.getElementById('tempExecColumnForm');
    const saveTempExecColumnsBtn = document.getElementById('saveTempExecColumns');
    const tempExecColumnStatus = document.getElementById('tempExecColumnStatus');
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    const scrollBottomBtn = document.getElementById('scrollBottomBtn');

    const tabButtons = document.querySelectorAll('[data-tab-btn]');
    const tabSections = document.querySelectorAll('[data-tab-section]');
    const xmindStructureToggle = document.getElementById('xmindStructureToggle');
    const xmindStructureCard = document.getElementById('xmindStructureCard');

    // 功能指派
    const cleanModelSelect = document.getElementById('cleanModelSelect');
    const compareModelSelect = document.getElementById('compareModelSelect');
    const splitModelSelect = document.getElementById('splitModelSelect');
    const casesModelSelect = document.getElementById('casesModelSelect');
    const caseGenModelSelect = document.getElementById('caseGenModelSelect');
    const caseFilterModelSelect = document.getElementById('caseFilterModelSelect');
    const cleanAssignStatus = document.getElementById('cleanAssignStatus');
    const reviewModelSelect = document.getElementById('reviewModelSelect');
    const reviewAssignStatus = document.getElementById('reviewAssignStatus');
    const compareAssignStatus = document.getElementById('compareAssignStatus');
    const splitAssignStatus = document.getElementById('splitAssignStatus');
    const casesAssignStatus = document.getElementById('casesAssignStatus');
    const caseGenAssignStatus = document.getElementById('caseGenAssignStatus');
    const caseFilterAssignStatus = document.getElementById('caseFilterAssignStatus');
    const cleanTimingEl = document.getElementById('cleanTiming');
    const reviewTimingEl = document.getElementById('reviewTiming');
    const compareTimingEl = document.getElementById('compareTiming');
    const splitTimingEl = document.getElementById('splitTiming');
    const casesTimingEl = document.getElementById('casesTiming');
    const caseGenTimingEl = document.getElementById('caseGenTiming');
    const saveAssignmentsBtn = document.getElementById('saveAssignments');
    const testCleanModelBtn = document.getElementById('testCleanModel');
    const testReviewModelBtn = document.getElementById('testReviewModel');
    const testCompareModelBtn = document.getElementById('testCompareModel');
    const testSplitModelBtn = document.getElementById('testSplitModel');
    const testCasesModelBtn = document.getElementById('testCasesModel');
    const testCaseGenModelBtn = document.getElementById('testCaseGenModel');
    const testCaseFilterModelBtn = document.getElementById('testCaseFilterModel');
    const cleanPromptEl = document.getElementById('cleanPrompt');
    const reviewPromptEl = document.getElementById('reviewPrompt');
    const comparePromptEl = document.getElementById('comparePrompt');
    const splitPromptEl = document.getElementById('splitPrompt');
    const casesPromptEl = document.getElementById('casesPrompt');
    const caseGenPromptEl = document.getElementById('caseGenPrompt');
    const caseFilterPromptEl = document.getElementById('caseFilterPrompt');
    const cleanReasoningSelect = document.getElementById('cleanReasoning');
    const reviewReasoningSelect = document.getElementById('reviewReasoning');
    const compareReasoningSelect = document.getElementById('compareReasoning');
    const splitReasoningSelect = document.getElementById('splitReasoning');
    const casesReasoningSelect = document.getElementById('casesReasoning');
    const caseGenReasoningSelect = document.getElementById('caseGenReasoning');
    const caseFilterReasoningSelect = document.getElementById('caseFilterReasoning');
    assignPromptDom.cleanPromptEl = cleanPromptEl;
    assignPromptDom.reviewPromptEl = reviewPromptEl;
    assignPromptDom.comparePromptEl = comparePromptEl;
    assignPromptDom.splitPromptEl = splitPromptEl;
    assignPromptDom.casesPromptEl = casesPromptEl;
    assignPromptDom.caseGenPromptEl = caseGenPromptEl;
    assignPromptDom.caseFilterPromptEl = caseFilterPromptEl;
    assignPromptDom.defaultPromptStatus = defaultPromptStatus;

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
        renderTempExecView,
        dom: {
          modelTimeoutInput,
          modelTimeoutStatus,
          feishuWebhookInput,
          feishuMentionInput,
          feishuWebhookStatus,
          tempExecColumnForm,
          tempExecColumnStatus,
          saveModelTimeoutBtn,
          saveFeishuWebhookBtn,
          testFeishuWebhookBtn,
          saveTempExecColumnsBtn,
          tempExecPageSizeInput,
          saveTempExecPageSizeBtn,
          tempExecPageSizeStatus,
        },
        applyTempExecPageSize,
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
      saveTempExecPageSize,
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
      saveTempExecPageSize: function noopSavePage() {},
      getFeishuWebhookUrl: function noopGetWebhook() { return ''; },
      getFeishuMentionId: function noopGetMention() { return ''; },
      postFeishuMessage: async function noopPost() { return { ok: false, reason: 'settings module missing' }; },
      ensureTempExecColumns: function fallbackEnsure() { return { ...defaultTempExecColumns }; },
    };
    loadSettings();

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
        dom: {
          modelDisplayNameEl,
          modelProviderEl,
          modelBaseUrlEl,
          modelApiKeyEl,
          modelIdentifierEl,
          modelMaxTokensEl,
          modelFormStatus,
          modelListEl,
          createModelBtn,
          modelFormWrapper,
          modelFormTitle,
          saveModelBtn,
          resetModelFormBtn,
          cleanModelSelect,
          reviewModelSelect,
          compareModelSelect,
          splitModelSelect,
          casesModelSelect,
          caseGenModelSelect,
          caseFilterModelSelect,
          cleanAssignStatus,
          reviewAssignStatus,
          compareAssignStatus,
          splitAssignStatus,
          casesAssignStatus,
          caseGenAssignStatus,
          caseFilterAssignStatus,
          cleanPromptEl,
          reviewPromptEl,
          comparePromptEl,
          splitPromptEl,
          casesPromptEl,
          caseGenPromptEl,
          caseFilterPromptEl,
          cleanReasoningSelect,
          reviewReasoningSelect,
          compareReasoningSelect,
          splitReasoningSelect,
          casesReasoningSelect,
          caseGenReasoningSelect,
          caseFilterReasoningSelect,
        },
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
        dom: {
          cleanModelSelect,
          reviewModelSelect,
          compareModelSelect,
          splitModelSelect,
          casesModelSelect,
          caseGenModelSelect,
          caseFilterModelSelect,
          cleanAssignStatus,
          reviewAssignStatus,
          compareAssignStatus,
          splitAssignStatus,
          casesAssignStatus,
          caseGenAssignStatus,
          caseFilterAssignStatus,
          cleanPromptEl,
          reviewPromptEl,
          comparePromptEl,
          splitPromptEl,
          casesPromptEl,
          caseGenPromptEl,
          caseFilterPromptEl,
          cleanReasoningSelect,
          reviewReasoningSelect,
          compareReasoningSelect,
          splitReasoningSelect,
          casesReasoningSelect,
          caseGenReasoningSelect,
          caseFilterReasoningSelect,
          saveAssignmentsBtn,
          testCleanModelBtn,
          testReviewModelBtn,
          testCompareModelBtn,
          testSplitModelBtn,
          testCasesModelBtn,
          testCaseGenModelBtn,
          testCaseFilterModelBtn,
        },
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
        dom: {
          rawText,
          missingViewBtn: missingViewBtnEl,
          copyMissingBtn: copyMissingBtnEl,
          missingViewContainer: missingViewContainerEl,
          missingSmartFillBtn,
          casesCompareResultEl,
          casesCoverageStatus,
          casesTimingEl,
          casesCompareBtnEl,
          casesModuleProgress,
          compareResultEl,
          compareStatus,
          compareTimingEl,
          compareBtnEl,
          splitResultEl,
        },
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
    const clampCoveragePercent = compareCore && compareCore.clampCoveragePercent
      ? compareCore.clampCoveragePercent
      : function(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return Math.max(0, Math.min(100, Math.round(num)));
      };
    const buildSingleModulePayload = compareCore && compareCore.buildSingleModulePayload
      ? compareCore.buildSingleModulePayload
      : function(module, idx) {
        const title = module && module.title ? module.title : `模块${idx + 1}`;
        const scenarios = module && Array.isArray(module.scenarios) ? module.scenarios : [];
        const points = module && Array.isArray(module.points) ? module.points : [];
        const coupled = module && Array.isArray(module.coupled) ? module.coupled : [];
        return {
          json: JSON.stringify([{
            module: title,
            key_scenarios: scenarios,
            test_points: points,
            coupled_modules: coupled,
          }], null, 2),
          title,
        };
      };
    const aggregateModuleCompareResults = compareCore && compareCore.aggregateModuleCompareResults
      ? compareCore.aggregateModuleCompareResults
      : function() { return { coverage: null, missing: [], extra: [] }; };
    const parseModuleCompareResponse = compareCore && compareCore.parseModuleCompareResponse
      ? compareCore.parseModuleCompareResponse
      : function(content, moduleTitle) {
        const rawContent = stripCodeFence(content);
        const jsonOnly = extractJsonPayload(rawContent);
        const payload = jsonOnly || rawContent;
        const data = JSON.parse(payload);
        return { module: moduleTitle, coverage: clampCoveragePercent(data.coverage), missing: data.missing || [], extra: data.extra || [] };
      };
    const formatMissingRequirement = compareCore && compareCore.formatMissingRequirement
      ? compareCore.formatMissingRequirement
      : function(item) {
        if (item === undefined || item === null) return '-';
        if (typeof item === 'string') return item.trim() || '-';
        if (typeof item === 'object') {
          try {
            if (item.module || item.title) {
              const parts = [];
              if (item.module || item.title) parts.push(`模块：${item.module || item.title}`);
              if (Array.isArray(item.key_scenarios) && item.key_scenarios.length) parts.push(`场景：${item.key_scenarios.join('，')}`);
              if (Array.isArray(item.test_points) && item.test_points.length) parts.push(`要点：${item.test_points.join('，')}`);
              if (Array.isArray(item.coupled_modules) && item.coupled_modules.length) parts.push(`耦合：${item.coupled_modules.join('，')}`);
              return parts.join('；') || JSON.stringify(item);
            }
            return JSON.stringify(item);
          } catch (err) {
            return String(item);
          }
        }
        return String(item);
      };
    const isCoveragePayload = compareCore && compareCore.isCoveragePayload
      ? compareCore.isCoveragePayload
      : function(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
        const hasCoverage = Object.prototype.hasOwnProperty.call(data, 'coverage');
        const hasMissing = Object.prototype.hasOwnProperty.call(data, 'missing');
        const hasExtra = Object.prototype.hasOwnProperty.call(data, 'extra');
        return hasCoverage && (hasMissing || hasExtra);
      };
    const parseMissingModules = compareCore && compareCore.parseMissingModules
      ? compareCore.parseMissingModules
      : function() { return []; };
    const buildMissingRows = compareCore && compareCore.buildMissingRows
      ? compareCore.buildMissingRows
      : function() { return []; };
    const pickMissingSelections = compareCore && compareCore.pickMissingSelections
      ? compareCore.pickMissingSelections
      : function() { return []; };
    if (compareCore) {
      if (compareCore.refreshMissingSmartFillButton) refreshMissingSmartFillButton = compareCore.refreshMissingSmartFillButton;
      if (compareCore.updateMissingView) updateMissingView = compareCore.updateMissingView;
      if (compareCore.toggleMissingView) toggleMissingView = compareCore.toggleMissingView;
      if (compareCore.refreshMissingSelectionUI) refreshMissingSelectionUI = compareCore.refreshMissingSelectionUI;
      if (compareCore.copyMissingJson) copyMissingJson = compareCore.copyMissingJson;
      if (compareCore.exportCasesCoverage) exportCasesCoverage = compareCore.exportCasesCoverage;
      if (compareCore.importCasesCoverage) importCasesCoverage = compareCore.importCasesCoverage;
      if (compareCore.exportCompareResult) exportCompareResult = compareCore.exportCompareResult;
      if (compareCore.importCompareResult) importCompareResult = compareCore.importCompareResult;
      if (compareCore.compareCoverage) compareCoverage = compareCore.compareCoverage;
      if (compareCore.compareCasesCoverage) compareCasesCoverage = compareCore.compareCasesCoverage;
      if (compareCore.extractCompareResultData) extractCompareResultData = compareCore.extractCompareResultData;
      if (compareCore.extractCoverageFromCompareResult) extractCoverageFromCompareResult = compareCore.extractCoverageFromCompareResult;
    }

    const debugCore = window.app && window.app.debugCore && typeof window.app.debugCore.init === 'function'
      ? window.app.debugCore.init({
        state,
        debugNodes,
        dom: {
          casesCoverageStatus,
          caseGenStatus,
          splitResultEl,
        },
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
    }
    const reviewCoreModule = window.app.reviewCore && typeof window.app.reviewCore.init === 'function'
      ? window.app.reviewCore.init({
        state,
        defaultPrompts,
        setStatus,
        escapeHtml,
        escapeHtmlPreserve,
        dom: {
          rawText,
          reviewStatus,
          reviewResultEl,
          reviewViewContainer,
          toggleReviewViewBtn,
          confirmClarificationsBtn,
          runReviewBtn,
          reviewTimingEl,
          autoClarifyContainer,
          autoClarifyToggle,
          autoClarifyToggleBtn,
          autoClarifyConfirmBtn,
          autoClarifySection,
          autoClarifyStatus,
        },
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
        dom: {
          runReviewBtn,
          copyReviewResultBtn,
          exportReviewResultBtn,
          importReviewResultBtn,
          reviewImportFileInput,
          toggleReviewViewBtn,
          confirmClarificationsBtn,
          reviewViewContainer,
          autoClarifyContainer,
          autoClarifyToggleBtn,
          autoClarifyToggle,
          autoClarifyConfirmBtn,
        },
      })
      : null;
    [reviewTimingEl, cleanTimingEl, compareTimingEl, splitTimingEl, casesTimingEl, caseGenTimingEl].forEach(el => updateModelTiming(el));

    // 清洗与对比
    function parseSplitModules() {
      if (!splitResultEl || !splitResultEl.value.trim()) return [];
      if (splitCore && splitCore.parseSplitModules) {
        return splitCore.parseSplitModules(splitResultEl.value, setRequirementLabel);
      }
      return [];
    }

    function ensureCaseGenModulesFromSplit() {
      if (state.caseGenModules.length) return false;
      if (!splitResultEl.value.trim()) return false;
      const modules = parseSplitModules();
      if (!modules.length) return false;
      state.caseGenModules = modules;
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenSource = splitResultEl.value.trim();
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenRunning = new Set();
      refreshMissingSmartFillButton();
      renderCaseGenProgressBoard();
      return true;
    }

    async function splitModules() {
      const cleaned = getCleanedTextForModel();
      if (!cleaned) {
        setStatus(splitStatus, '请先完成清洗，获取基础内容', 'warn');
        return;
      }
      const requirementLabel = ensureRequirementLabel('请输入本次需求标识后再进行测试模块拆分');
      if (!requirementLabel) {
        setStatus(splitStatus, '已取消测试模块拆分（需求标识为空）', 'warn');
        return;
      }
      if (splitBtnEl) splitBtnEl.setAttribute('disabled', 'disabled');
      let model;
      try {
        model = getAssignedModel('split');
      } catch (err) {
        setStatus(splitStatus, err.message, 'warn');
        updateModelTiming(splitTimingEl);
        if (splitBtnEl) splitBtnEl.removeAttribute('disabled');
        return;
      }
      splitResultEl.value = '';
      setStepInProgress('split');
      setStatus(splitStatus, '正在拆分测试模块...', '');
      try {
        const splitPrompt = state.assignments.splitPrompt ? state.assignments.splitPrompt.trim() : '';
        const prompt = splitPrompt || defaultPrompts.split;
        const reasoning = getReasoningForType('split');
        const startTime = Date.now();
          const content = await callModelWithConfig(model, cleaned, prompt, reasoning);
          updateModelTiming(splitTimingEl, Date.now() - startTime);
          splitResultEl.value = content;
          setStatus(splitStatus, '拆分完成', 'ok');
          setStatus(casesCoverageStatus, '', '');
        } catch (err) {
        console.error(err);
        updateModelTiming(splitTimingEl);
        setStatus(splitStatus, `拆分失败：${err.message}`, 'err');
      } finally {
        clearStepInProgress('split');
        updateFlowStatus();
        if (splitBtnEl) splitBtnEl.removeAttribute('disabled');
      }
    }

    const defaultScrollOffset = 200;
    const scrollElementIntoView = function(el, behavior, offset) {
      if (!el) return;
      appUtils.scrollElementIntoView(el, behavior || 'smooth', offset === undefined ? defaultScrollOffset : offset);
    };

    function scrollToSection(target, options = {}) {
      const behavior = options.behavior || 'smooth';
      if (target === 'cases') {
        ['cases-upload', 'cases'].forEach(id => {
          const sectionEl = document.querySelector(`[data-section-id="${id}"]`);
          if (sectionEl) sectionEl.classList.remove('collapsed');
        });
        switchTab('clean');
        const sectionCoverage = document.querySelector('[data-section-id="cases"]');
        if (sectionCoverage) {
          scrollElementIntoView(sectionCoverage, behavior);
          return;
        }
      }
      if (target === 'cases-upload') {
        switchTab('clean');
        const sectionUpload = document.querySelector('[data-section-id="cases-upload"]');
        if (sectionUpload) {
          sectionUpload.classList.remove('collapsed');
          sectionUpload.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      if (target === 'casesgen') {
        switchTab('casesgen');
        const caseGenSection = document.querySelector('[data-section-id="casesgen"]');
        if (caseGenSection) {
          caseGenSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      if (target === 'auto-import') {
        switchTab('auto');
        const autoSection = document.querySelector('[data-section-id="auto-import"]');
        if (autoSection) {
          autoSection.classList.remove('collapsed');
          scrollElementIntoView(autoSection, behavior, 240);
        }
        return;
      }
      const section = document.querySelector(`[data-section-id="${target}"]`);
      if (section) {
        switchTab('clean');
        section.classList.remove('collapsed');
        scrollElementIntoView(section, behavior);
      }
    }

    function refreshExportCaseGenButton() {
      if (!exportCaseGenBtn) return;
      const hasResult = Array.isArray(state.caseGenModules) && state.caseGenModules.some((mod) => {
        const content = (state.caseGenResults[mod.id] || '').trim();
        return Boolean(content && !/^\[\s*\]$/.test(content));
      });
      exportCaseGenBtn.disabled = !hasResult;
    }

    if (exportCaseGenBtn) exportCaseGenBtn.disabled = true;

    const casesCore = window.app && window.app.casesCore && typeof window.app.casesCore.init === 'function'
      ? window.app.casesCore.init({
        deps: { extractJsonObjects },
        state,
        dom: {
          caseFileListEl,
          autoCaseFileListEl,
          caseTextEl,
          caseViewContainer,
          caseViewBtn,
          caseViewHint,
          caseStatus,
          casesCoverageStatus,
        },
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
        dom: {
          autoMissingToggle,
          autoMissingCopy,
          autoMissingSmartFillBtn,
          autoMissingView,
          autoMissingStatus,
          autoMissingGoUsecaseBtn,
          autoWorkflowBtn,
          autoRecleanBtn,
          autoIgnoreCoverageBtn,
          autoCompareMissing,
          autoCompareSuggestionInput,
          autoFillCleanBtn,
          autoJumpCleanViewBtn,
          autoRecleanStatus,
          autoCompareStatus,
          autoWorkflowStatus,
          cleanedTextEl,
          rawText,
          reviewResultEl,
          compareResultEl,
          splitResultEl,
          casesCompareResultEl,
          casesGenerationContainer,
          caseGenStatus,
          missingViewStatus,
          autoClarifyToggle,
          autoClarifySection,
          autoMissingSectionSelector: '[data-section-id=\"auto-cases-missing\"]',
        },
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
        dom: {
          casesGenerationContainer,
          caseGenStatus,
          caseGenTimingEl,
          tempExecStatus,
        },
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
        dom: {
          tempExecStatus,
          tempVersionGrid,
          tempExecNav,
          tempFocusZone,
          tempExecOverview,
          tempExecView,
          tempExecViewSection,
          tempExecMindContainer,
          tempExecMindBtn,
          exportTempExecBtn,
          exportTempExecConfigBtn,
          exportTempExecXmindBtn,
        },
      })
      : null;
    const tempExecApi = tempexecCore ? { ...tempexecCore } : {};
    const tempExecDefaults = {
      normalizeReusePresets: function(list) { return Array.isArray(list) ? list : []; },
      ensureTempExecSelection: function(fileId) {
        if (!state.tempExecSelections || typeof state.tempExecSelections !== 'object') state.tempExecSelections = {};
        if (!fileId) return new Set();
        if (!state.tempExecSelections[fileId]) state.tempExecSelections[fileId] = new Set();
        return state.tempExecSelections[fileId];
      },
      ensureTempExecRemarkOpen: function(fileId) {
        if (!state.tempExecRemarkOpen || typeof state.tempExecRemarkOpen !== 'object') state.tempExecRemarkOpen = {};
        if (!fileId) return new Set();
        if (!state.tempExecRemarkOpen[fileId]) state.tempExecRemarkOpen[fileId] = new Set();
        return state.tempExecRemarkOpen[fileId];
      },
      ensureTempExecReuseOpen: function(fileId) {
        if (!state.tempExecReuseOpen || typeof state.tempExecReuseOpen !== 'object') state.tempExecReuseOpen = {};
        if (!fileId) return new Set();
        if (!state.tempExecReuseOpen[fileId]) state.tempExecReuseOpen[fileId] = new Set();
        return state.tempExecReuseOpen[fileId];
      },
      ensureTempExecDefectOpen: function(fileId) {
        if (!state.tempExecDefectOpen || typeof state.tempExecDefectOpen !== 'object') state.tempExecDefectOpen = {};
        if (!fileId) return new Set();
        if (!state.tempExecDefectOpen[fileId]) state.tempExecDefectOpen[fileId] = new Set();
        return state.tempExecDefectOpen[fileId];
      },
      ensureTempExecReplacement: ensureTempExecReplacement,
      generateTempExecId: generateTempExecId,
      renderTempExecView: function() {},
      renderTempVersionGrid: function() {},
      renderTempExecNav: function() {},
      getTempExecFile: function() { return null; },
      serializeSingleTempExecFile: function(file) { return file || null; },
      getTempExecPageSize: function() { return defaultTempExecPageSize; },
      applyTempExecSearch: function(fileId, term, raw) {
        state.tempExecSearch = { fileId: fileId || '', term: (term || '').trim().toLowerCase(), raw: raw || '' };
        if (typeof tempExecApi.renderTempExecView === 'function') tempExecApi.renderTempExecView();
      },
      applyTempExecPageSize: function(value) { return { size: value, changed: false }; },
      exportTempExecSnapshot: function() {
        if (tempExecStatus) setStatus(tempExecStatus, '当前环境暂不支持导出执行页面配置', 'warn');
      },
      importTempExecSnapshot: async function() {
        if (tempExecStatus) setStatus(tempExecStatus, '当前环境暂不支持导入执行页面配置', 'warn');
      },
      setTempExecActive: function() {},
      createTempExecFile: function() { return null; },
      syncTempExecFocus: function() {},
      persistTempExecState: function() {},
      removeTempExecFile: function() {},
      getCaseExecutionDisplay: function() { return ''; },
    };
    Object.keys(tempExecDefaults).forEach(function(key) {
      if (!tempExecApi[key]) tempExecApi[key] = tempExecDefaults[key];
    });
    state.tempExecPageSize = tempExecApi.getTempExecPageSize();
    createTempExecFile = tempExecApi.createTempExecFile;
    syncTempExecFocus = tempExecApi.syncTempExecFocus;
    persistTempExecState = tempExecApi.persistTempExecState;
    setTempExecActive = tempExecApi.setTempExecActive;
    removeTempExecFile = tempExecApi.removeTempExecFile;
    getCaseExecutionDisplay = tempExecApi.getCaseExecutionDisplay;
    renderTempExecView = tempExecApi.renderTempExecView;
    applyTempExecPageSize = tempExecApi.applyTempExecPageSize;

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

    function updateFlowStatus() {
      const stateMap = {
        import: rawText.value.trim().length > 0,
        review: reviewResultEl ? reviewResultEl.value.trim().length > 0 : false,
        clean: cleanedTextEl.value.trim().length > 0,
        split: splitResultEl.value.trim().length > 0,
        'cases-upload': hasCaseSource(),
        cases: casesCompareResultEl.value.trim().length > 0,
      };
      if (state.inProgressStep) stateMap[state.inProgressStep] = false;
      const order = ['import', 'review', 'clean', 'split', 'cases-upload', 'cases'];
      const next = state.inProgressStep || order.find(key => !stateMap[key]) || 'cases';
      if (runReviewBtn) {
        const rawReady = stateMap.import;
        runReviewBtn.disabled = !rawReady || state.inProgressStep === 'review';
      }
      flowNavSteps.forEach(step => {
        const target = step.dataset.target;
        step.classList.remove('done', 'active');
        if (target === state.inProgressStep) {
          step.classList.add('active');
          return;
        }
        if (stateMap[target]) step.classList.add('done');
        if (target === next) step.classList.add('active');
      });
    }

    const uploadModule = window.app.upload && typeof window.app.upload.init === 'function'
      ? window.app.upload.init({
        state,
        handlers: {
          handleCaseFiles,
          clearRawInput,
          removeImportedCase,
          setStepInProgress,
          clearStepInProgress,
          setRequirementLabel,
          renderAutoRawInfo,
          updateAutoCompareActions,
          updateAutoMissingCard,
          updateFlowStatus,
          setStatus,
          parseDocx: xmindCore && xmindCore.parseDocx ? function(file) { return xmindCore.parseDocx(file); } : null,
        },
        dom: {
          fileInput,
          dropZone,
          autoRawInput,
          autoRawDropZone,
          autoRawListEl,
          autoRawClearBtn,
          caseFileInput,
          caseDropZone,
          caseFileListEl,
          autoCaseInput,
          autoCaseDropZone,
          autoCaseFileListEl,
          rawText,
          fileName,
          parseStatus,
        },
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
        dom: {
          splitResultEl,
          splitViewContainer,
          toggleSplitViewBtn,
          splitStatus,
          caseGenStatus,
        },
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
        dom: {
          cleanStatus,
          cleanViewContainer,
          cleanRawView,
          cleanRawLocateBtn,
          cleanHighlightAllBtn,
          runCleanBtn,
          cleanTimingEl,
          rawText,
          cleanedTextEl,
          splitResultEl,
          casesCoverageStatus,
          caseGenStatus,
          autoRawListEl,
          autoRawClearBtn,
          caseTextEl,
        },
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

    if (toggleSplitViewBtn) toggleSplitViewBtn.addEventListener('click', toggleSplitView);
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
        dom: {
          runCleanBtn,
          copyBtn,
          toggleCleanViewBtn,
          cleanViewContainer,
          cleanRawView,
          toggleCleanRawViewBtn,
          cleanRawLocateBtn,
          cleanHighlightAllBtn,
        },
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
        dom: {
          compareBtnEl: document.getElementById('compareBtn'),
          casesCompareBtnEl: document.getElementById('casesCompareBtn'),
          exportCompareResultBtn: exportCompareResultBtn,
          importCompareResultBtn: importCompareResultBtn,
          compareImportFileInput: compareImportFileInput,
          casesCompareResultEl: casesCompareResultEl,
          missingViewBtn: missingViewBtnEl,
          copyMissingBtn: copyMissingBtnEl,
          missingViewContainer: missingViewContainerEl,
          missingSmartFillBtn: missingSmartFillBtn,
          exportCasesCoverageBtn: exportCasesCoverageBtn,
          importCasesCoverageBtn: importCasesCoverageBtn,
          importCasesCoverageFile: importCasesCoverageFile,
        },
      })
      : null;
    const splitModule = window.app.split && typeof window.app.split.init === 'function'
      ? window.app.split.init({
        handlers: {
          splitModules,
          toggleSplitView,
        },
        dom: {
          splitBtnEl: document.getElementById('splitBtn'),
          toggleSplitViewBtn,
        },
      })
      : null;

    tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tabBtn)));

    modelProviderEl.addEventListener('change', () => applyProviderPreset(modelProviderEl, modelBaseUrlEl, modelIdentifierEl));
    createModelBtn.addEventListener('click', () => {
      modelFormTitle.textContent = '新增模型';
      modelFormWrapper.classList.remove('hidden');
      resetModelForm();
    });
    saveModelBtn.addEventListener('click', saveModel);
    resetModelFormBtn.addEventListener('click', () => resetModelForm(true));
    if (caseViewBtn) caseViewBtn.addEventListener('click', toggleImportedCaseView);
    document.querySelectorAll('[data-jump]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.dataset.jump;
        if (!target) return;
        switchTab(target);
        const section = document.querySelector(`[data-tab-section=\"${target}\"]`);
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    if (saveDefaultPromptsBtn && saveDefaultPrompts) {
      saveDefaultPromptsBtn.addEventListener('click', () => saveDefaultPrompts());
    }
    if (exportDefaultPromptsBtn && exportDefaultPrompts) {
      exportDefaultPromptsBtn.addEventListener('click', () => exportDefaultPrompts());
    }
    if (importDefaultPromptsBtn && importDefaultPromptsFile && importDefaultPrompts) {
      importDefaultPromptsBtn.addEventListener('click', () => importDefaultPromptsFile.click());
      importDefaultPromptsFile.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (file) await importDefaultPrompts(file);
      });
    }
    bindDebugControls('raw', saveRawDebugBtn, importRawDebugBtn, rawDebugFileInput);
    bindDebugControls('cleaned', saveCleanDebugBtn, importCleanDebugBtn, cleanDebugFileInput);
    bindDebugControls('split', saveSplitDebugBtn, importSplitDebugBtn, splitDebugFileInput);
    bindDebugControls('cases', saveCaseDebugBtn, importCaseDebugBtn, caseDebugFileInput);

    if (exportCompareResultBtn && exportCompareResult) {
      exportCompareResultBtn.addEventListener('click', () => exportCompareResult());
    }
    if (importCompareResultBtn && compareImportFileInput && importCompareResult) {
      importCompareResultBtn.addEventListener('click', () => compareImportFileInput.click());
      compareImportFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (file) await importCompareResult(file);
      });
    }

    function switchTab(name) {
      state.activeTab = name;
      tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tabBtn === name));
      tabSections.forEach(sec => {
        const match = sec.dataset.tabSection === name;
        sec.classList.toggle('hidden', !match);
      });
      if (autoClarifySection) {
        const shouldShow = state.autoRequireClarifications && name === 'auto';
        autoClarifySection.classList.toggle('hidden', !shouldShow);
      }
      if (name === 'models') setStatus(modelFormStatus, '', '');
      if (name === 'assign') {
        renderAssignmentsSelect();
        setStatus(cleanAssignStatus, '', '');
        setStatus(compareAssignStatus, '', '');
        setStatus(splitAssignStatus, '', '');
        setStatus(casesAssignStatus, '', '');
      }
      if (name === 'casesgen') {
        const autoFilled = ensureCaseGenModulesFromSplit();
        if (autoFilled) {
          setStatus(caseGenStatus, '', '');
          renderCaseGeneration();
        } else if (state.caseGenModules.length) {
          renderCaseGeneration();
        }
        if (toSplitFromCaseGenBtn) {
          toSplitFromCaseGenBtn.classList.toggle('hidden', Boolean(splitResultEl.value.trim()));
        }
      }
      if (name === 'auto') {
        updateAutoClarifyVisibility();
        syncAutoCompareStatus();
        updateAutoMissingCard();
      }
    if (name === 'settings') {
      renderSettingsUI();
      if (feishuWebhookStatus) setStatus(feishuWebhookStatus, '', '');
    }
  }

    if (xmindStructureToggle && xmindStructureCard) {
      const labelEl = xmindStructureToggle.querySelector('span:last-child');
      const collapseCard = () => {
        xmindStructureCard.classList.add('collapsed-card');
        xmindStructureToggle.classList.remove('active');
        if (labelEl) labelEl.textContent = 'XMind 用例结构';
      };
      const expandCard = () => {
        xmindStructureCard.classList.remove('collapsed-card');
        xmindStructureToggle.classList.add('active');
        if (labelEl) labelEl.textContent = '收起 XMind 用例结构';
        requestAnimationFrame(() => {
          const target = xmindStructureCard;
          const rect = target.getBoundingClientRect();
          const offset = Math.max(120, (window.innerHeight / 2) - (rect.height / 2));
          scrollElementIntoView(target, 'smooth', offset);
        });
      };
      collapseCard();
      xmindStructureToggle.addEventListener('click', () => {
        const collapsed = xmindStructureCard.classList.contains('collapsed-card');
        if (collapsed) {
          expandCard();
        } else {
          collapseCard();
        }
      });
    }
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
          dom: {
            goUsecaseGenBtn,
            casesGoUsecaseGenBtn,
            toSplitFromCaseGenBtn,
            exportCaseGenBtn,
            caseGenStatus,
            casesGenerationContainer,
            splitResultEl,
            casesCoverageStatus,
            splitStatus,
          },
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
          dom: {
            caseGenProgressList,
            caseGenProgressPanel,
            toSplitFromCaseGenBtn,
            autoMissingGoUsecaseBtn,
          },
        })
        : null;
      const layoutHandlersModule = window.app.layoutHandlers && typeof window.app.layoutHandlers.init === 'function'
        ? window.app.layoutHandlers.init({
          updateFlowStatus,
          scrollToSection,
          dom: { flowNavSteps, scrollTopBtn, scrollBottomBtn },
      })
      : null;
    const casegenProgressModule = window.app.casegenProgress && typeof window.app.casegenProgress.init === 'function'
      ? window.app.casegenProgress.init({
        state,
        dom: {
          caseGenProgressPanel,
          caseGenProgressList,
        },
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
        casegenProgressModule.updateCaseProgressView(moduleId, casesGenerationContainer);
      };
      if (casegenProgressModule.clearCaseProgress) clearCaseProgress = function(moduleId) {
        casegenProgressModule.clearCaseProgress(moduleId, casesGenerationContainer);
      };
      if (casegenProgressModule.initCaseProgress) initCaseProgress = function(moduleId, groups) {
        casegenProgressModule.initCaseProgress(moduleId, groups, casesGenerationContainer);
      };
      if (casegenProgressModule.setCaseProgressGroupState) setCaseProgressGroupState = function(moduleId, idx, stateVal) {
        casegenProgressModule.setCaseProgressGroupState(moduleId, idx, stateVal, casesGenerationContainer);
      };
      if (casegenProgressModule.setCaseProgressStep) setCaseProgressStep = function(moduleId, step, stateVal) {
        casegenProgressModule.setCaseProgressStep(moduleId, step, stateVal, casesGenerationContainer);
      };
      if (casegenProgressModule.markAllCaseProgressGroups) markAllCaseProgressGroups = function(moduleId, stateVal) {
        casegenProgressModule.markAllCaseProgressGroups(moduleId, stateVal, casesGenerationContainer);
      };
    }
      setCaseViewHint('请先上传或输入 XMind 测试用例');
      updateFlowStatus();
      return { casegenHandlersModule, casegenCoreModule, layoutHandlersModule };
    }
    window.app = window.app || {};
    window.app.init = initApp;

    function setCaseViewHint(text) {
      if (caseViewHint) {
        caseViewHint.textContent = text;
        caseViewHint.classList.toggle('hidden', !text);
      }
    }

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
      dom: {
        autoWorkflowBtn,
        autoRecleanBtn,
        autoIgnoreCoverageBtn,
        autoMissingToggle,
        autoMissingCopy,
        autoMissingSmartFillBtn,
        autoMissingView,
        autoCompareMissing,
        autoCompareSuggestionInput,
        autoFillCleanBtn,
        autoJumpCleanViewBtn,
        autoRecleanStatus,
        autoCompareStatus,
        autoWorkflowStatus,
        cleanedTextEl,
        rawText,
        reviewResultEl,
        compareResultEl,
        splitResultEl,
        casesCompareResultEl,
        autoMissingStatus,
        autoClarifyToggle,
        autoClarifySection,
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
