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
  let tempDragContext = null;
  window.app.tempDragContext = tempDragContext;
  let tempExecUndoTimer = null;
  let tempExecUndoInterval = null;
  let tempExecUndoEl = null;
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
  let reviewRequirements = function reviewRequirementsFallback() { return Promise.resolve(); };
  let copyReviewResult = function copyReviewResultFallback() {};
  let exportReviewResult = function exportReviewResultFallback() {};
  let importReviewResult = function importReviewResultFallback() {};
  let toggleReviewView = function toggleReviewViewFallback() {};
  let confirmClarifications = function confirmClarificationsFallback() {};
  let handleClarifyClickEvent = function handleClarifyClickEventFallback() {};
  let handleClarifyChangeEvent = function handleClarifyChangeEventFallback() {};
  let handleClarifyInputEvent = function handleClarifyInputEventFallback() {};
  let updateAutoClarifyVisibility = function updateAutoClarifyVisibilityFallback() {};
  let renderAutoClarifyView = function renderAutoClarifyViewFallback() {};
  let openAutoClarifyPanel = function openAutoClarifyPanelFallback() {};
  let handleAutoClarifyConfirm = function handleAutoClarifyConfirmFallback() {};
  let waitForAutoClarification = function waitForAutoClarificationFallback() { return Promise.resolve(true); };
  let refreshMissingSmartFillButton = function refreshMissingSmartFillButtonFallback() {};
  let updateMissingView = function updateMissingViewFallback() {};
  let toggleMissingView = function toggleMissingViewFallback() {};
  let refreshMissingSelectionUI = function refreshMissingSelectionUIFallback() {};
  let copyMissingJson = function copyMissingJsonFallback() {};
  let syncReviewViewFromResult = function syncReviewViewFromResultFallback() {};
  let buildReviewClarificationContext = function buildReviewClarificationContextFallback() { return ''; };
  let renderCaseGeneration = function renderCaseGenerationFallback() {};
  let renderCaseTable = function renderCaseTableFallback() { return ''; };
  let parseGeneratedCases = function parseGeneratedCasesFallback() { return { parsed: [], normalized: '', hadRecovery: false }; };
  let renderImportedCaseList = function renderImportedCaseListFallback() {};
  let addImportedCase = function addImportedCaseFallback() {};
  let removeImportedCase = function removeImportedCaseFallback() {};
  let hasImportedCases = function hasImportedCasesFallback() { return false; };
  let hasCaseSource = function hasCaseSourceFallback() { return false; };
  let getCombinedCaseList = function getCombinedCaseListFallback() { return []; };
  let getCombinedCaseText = function getCombinedCaseTextFallback() { return ''; };
  let syncCaseTextWithImports = function syncCaseTextWithImportsFallback() {};
  let buildCasesComparePayload = function buildCasesComparePayloadFallback() { return { text: '', isJson: false }; };
  let resetImportedCaseView = function resetImportedCaseViewFallback() {};
  let handleCaseFiles = function handleCaseFilesFallback() {};
  let resetAutoMissingView = function resetAutoMissingViewFallback() {};
  let refreshAutoMissingSelectionUI = function refreshAutoMissingSelectionUIFallback() {};
  let updateAutoMissingCard = function updateAutoMissingCardFallback() {};
  let toggleAutoMissingView = function toggleAutoMissingViewFallback() {};
  let ensureAutoMissingViewVisible = function ensureAutoMissingViewVisibleFallback() {};
  let copyAutoMissingJson = function copyAutoMissingJsonFallback() {};
  let handleMissingSelectionChange = function handleMissingSelectionChangeFallback() {};
  let handleMissingSelectAll = function handleMissingSelectAllFallback() {};
  let smartFillMissingSuggestions = function smartFillMissingSuggestionsFallback() {};
  let generateCasesForModule = async function generateCasesForModuleFallback() {};
  let topUpCasesForModule = async function topUpCasesForModuleFallback() {};
  let exportCaseGenerationResults = function exportCaseGenerationResultsFallback() {};
  let exportModuleCases = function exportModuleCasesFallback() {};
  let importModuleCases = function importModuleCasesFallback() {};
  let transferModuleToTempExec = async function transferModuleToTempExecFallback() {};
  let clearModuleCases = function clearModuleCasesFallback() {};
  let toggleCaseView = function toggleCaseViewFallback() {};
  let handleCaseSelectionChange = function handleCaseSelectionChangeFallback() {};
  let handleCaseSelectAll = function handleCaseSelectAllFallback() {};
  let exportSelectedCases = function exportSelectedCasesFallback() {};
  let exportSelectedCasesToXmind = async function exportSelectedCasesToXmindFallback() {};
  let refreshCaseSelectionUI = function refreshCaseSelectionUIFallback() {};
  let updateSupplementButtons = function updateSupplementButtonsFallback() {};
  let getCaseListForModule = function getCaseListForModuleFallback() { return []; };
  let compareCoverage = function compareCoverageFallback() {};
  let compareCasesCoverage = function compareCasesCoverageFallback() {};
  let goToCaseGeneration = function goToCaseGenerationFallback() {};
  let goCasesGenAndScroll = function goCasesGenAndScrollFallback() {};
  let runCleaning = async function runCleaningFallback() {};
  let copyCleaned = async function copyCleanedFallback() {};
  let syncSplitView = function syncSplitViewFallback() {};
  let toggleSplitView = function toggleSplitViewFallback() {};
  let shouldExpectCleanJson = function shouldExpectCleanJsonFallback() { return false; };
  let getCleanedEntries = function getCleanedEntriesFallback() { return []; };
  let getCleanedRequirementText = function getCleanedRequirementTextFallback() { return ''; };
  let getCleanedTextForModel = function getCleanedTextForModelFallback() { return ''; };
  let renderCleanView = function renderCleanViewFallback() {};
  let locateCleanRawSelection = function locateCleanRawSelectionFallback() {};
  let jumpToCleanHighlightView = function jumpToCleanHighlightViewFallback() {};
  let ensureTempExecPlacement = function ensureTempExecPlacementFallback() { return {}; };
  let ensureRequirementOrder = function ensureRequirementOrderFallback() { return []; };
  let ensureFileOrder = function ensureFileOrderFallback() { return []; };
  let ensureVersionOrder = function ensureVersionOrderFallback() { return []; };
  let reorderRequirementOrder = function reorderRequirementOrderFallback() {};
  let updateVersionOrder = function updateVersionOrderFallback() {};
  let removeFileFromOrder = function removeFileFromOrderFallback() {};
  let insertFileIntoOrder = function insertFileIntoOrderFallback() {};
  let syncTempExecPlacement = function syncTempExecPlacementFallback() {};
  let moveTempExecFileToRequirement = function moveTempExecFileToRequirementFallback() {};
  let clampTempExecPageSize = function clampTempExecPageSizeFallback(value) { return value; };
  let loadTempExecPageSizeSetting = function loadTempExecPageSizeSettingFallback() { return defaultTempExecPageSize; };
  let saveTempExecPageSizeSetting = function saveTempExecPageSizeSettingFallback() {};
  let ensureTempExecPageIndex = function ensureTempExecPageIndexFallback() { return 0; };
  let resetTempExecPages = function resetTempExecPagesFallback() {};
  let setTempExecPage = function setTempExecPageFallback() {};
  let changeTempExecPage = function changeTempExecPageFallback() {};
  let applyTempExecPageSize = function applyTempExecPageSizeFallback(value) { return { size: value, changed: false }; };
  let getTempExecPageSize = function getTempExecPageSizeFallback() { return defaultTempExecPageSize; };
  let getTempExecFile = function getTempExecFileFallback() { return null; };
  let getTempExecFilesByRequirement = function getTempExecFilesByRequirementFallback() { return []; };
  let persistTempExecState = function persistTempExecStateFallback() {};
  let renderTempExecNav = function renderTempExecNavFallback() {};
  let renderTempExecView = function renderTempExecViewFallback() {};
  let renderTempVersionGrid = function renderTempVersionGridFallback() {};
  let renderTempExecTable = function renderTempExecTableFallback() { return ''; };
  let renderTempExecOverview = function renderTempExecOverviewFallback() {};
  let renderTempFocusZone = function renderTempFocusZoneFallback() {};
  let scrollTempExecViewTop = function scrollTempExecViewTopFallback() {};
  let ensureReusePresets = function ensureReusePresetsFallback(file) {
    if (!file) return [];
    if (!Array.isArray(file.reusePresets)) file.reusePresets = [];
    return file.reusePresets;
  };
  let startTempExecPresetDraft = function startTempExecPresetDraftFallback() {};
  let cancelTempExecPresetDraft = function cancelTempExecPresetDraftFallback() {};
  let updateTempExecPresetDraft = function updateTempExecPresetDraftFallback() {};
  let confirmTempExecPresetDraft = function confirmTempExecPresetDraftFallback() {};
  let removeTempExecPreset = function removeTempExecPresetFallback() {};
  let toggleTempExecReusePanel = function toggleTempExecReusePanelFallback() {};
  let addTempExecReuseEntry = function addTempExecReuseEntryFallback() {};
  let removeTempExecReuseEntry = function removeTempExecReuseEntryFallback() {};
  let updateTempExecReuseStatus = function updateTempExecReuseStatusFallback() {};
  let updateTempExecReuseText = function updateTempExecReuseTextFallback() {};
  let updateTempExecReuseNote = function updateTempExecReuseNoteFallback() {};
  let handleTempExecReuseToggle = function handleTempExecReuseToggleFallback() {};
  let getCaseExecutionDisplay = function getCaseExecutionDisplayFallback() { return ''; };
  let applyTempExecSearch = function applyTempExecSearchFallback(fileId, term, raw) {
    state.tempExecSearch = { fileId: fileId || '', term: (term || '').trim().toLowerCase(), raw: raw || '' };
    if (typeof renderTempExecView === 'function') renderTempExecView();
  };
  let loadTempExecFocus = function loadTempExecFocusFallback() {};
  let saveTempExecFocus = function saveTempExecFocusFallback() {};
  let syncTempExecFocus = function syncTempExecFocusFallback() {};
  let addTempExecFocus = function addTempExecFocusFallback() {};
  let removeTempExecFocus = function removeTempExecFocusFallback() {};
  let prioritizeTempExecUnassignedRequirements = function prioritizeTempExecUnassignedRequirementsFallback() {};
  let addTempExecDefectLink = function addTempExecDefectLinkFallback() {};
  let removeTempExecDefectLink = function removeTempExecDefectLinkFallback() {};
  let updateTempExecDefectLink = function updateTempExecDefectLinkFallback() {};
  let openTempExecDefectLink = function openTempExecDefectLinkFallback() {};
  let toggleTempExecDefectPanel = function toggleTempExecDefectPanelFallback() {};

    function setTempDragContext(ctx) {
      tempDragContext = ctx;
      window.app.tempDragContext = ctx;
    }

    function isDraggingRequirement() {
      return tempDragContext && tempDragContext.type === 'req';
    }
    let debugNodes;
    state.tempExecPageSize = loadTempExecPageSizeSetting();

    function clampTimeoutSeconds(value) {
      const num = Math.round(Number(value));
      if (!Number.isFinite(num) || num <= 0) return defaultSettings.timeoutSec;
      return Math.min(maxModelTimeoutSec, Math.max(minModelTimeoutSec, num));
    }

    const setStatus = appUtils.setStatus || function setStatus(el, text, type = '') {
      if (!el) return;
      el.textContent = text || '';
      el.className = ['status', type].filter(Boolean).join(' ');
    };

    function updateModelTiming(el, durationMs) {
      if (!el) return;
      if (!Number.isFinite(durationMs)) {
        el.textContent = '--';
      } else {
        el.textContent = (durationMs / 1000).toFixed(2);
      }
    }

    const debounce = appUtils.debounce || function debounce(fn, wait = 200) {
      let t;
      return function debounced() {
        if (t) clearTimeout(t);
        const args = arguments;
        const ctx = this;
        t = setTimeout(() => fn.apply(ctx, args), wait);
      };
    };

    function downloadBlob(filename, blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    const downloadText = appUtils.downloadText || function downloadTextFallback(filename, text) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      downloadBlob(filename, blob);
    };

    const stripCodeFence = appUtils.stripCodeFence || function stripCodeFence(text) {
      if (!text) return '';
      const trimmed = text.trim();
      const fenceRegex = /^(```|'''|"""|‵‵‵)([\w-]*)?\n?([\s\S]*?)\1$/i;
      const directMatch = trimmed.match(fenceRegex);
      if (directMatch) {
        return (directMatch[3] || '').trim();
      }
      const normalized = trimmed
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2032\u2035]/g, '`');
      if (normalized !== trimmed) {
        const normalizedMatch = normalized.match(fenceRegex);
        if (normalizedMatch) {
          return (normalizedMatch[3] || '').trim();
        }
      }
      return trimmed;
    };
    const extractJsonPayload = appUtils.extractJsonPayload || function extractJsonPayloadFallback(rawText) {
      return appUtils.extractJsonPayload ? appUtils.extractJsonPayload(rawText) : '';
    };
    const formatJsonOrText = appUtils.formatJsonOrText || function formatJsonOrTextFallback(text) {
      return text ? text.trim() : '';
    };

    if (!appUtils.setStatus) {
      window.app = window.app || {};
      window.app.utils = appUtils;
      appUtils.setStatus = setStatus;
    }
    if (!appUtils.debounce) appUtils.debounce = debounce;
    if (!appUtils.downloadText) appUtils.downloadText = downloadText;
    if (!appUtils.stripCodeFence) appUtils.stripCodeFence = stripCodeFence;
    if (!appUtils.extractJsonPayload) appUtils.extractJsonPayload = extractJsonPayload;
    if (!appUtils.formatJsonOrText) appUtils.formatJsonOrText = formatJsonOrText;
    const extractJsonObjects = appUtils.extractJsonObjects || function extractJsonObjectsFallback(text) {
      return appUtils.extractJsonObjects ? appUtils.extractJsonObjects(text) : [];
    };
    if (!appUtils.extractJsonObjects) appUtils.extractJsonObjects = extractJsonObjects;
    const sanitizeCasesForExport = appUtils.sanitizeCasesForExport || function sanitizeCasesForExportFallback(list) {
      const arr = Array.isArray(list) ? list : [];
      return arr.map(function(item) {
        if (!item || typeof item !== 'object') return item;
        const clone = {};
        Object.keys(item).forEach(function(key) {
          if (key === 'remark') return;
          clone[key] = item[key];
        });
        return clone;
      });
    };
    if (!appUtils.sanitizeCasesForExport) appUtils.sanitizeCasesForExport = sanitizeCasesForExport;
    const escapeHtml = appUtils.escapeHtml || function escapeHtmlFallback(text) {
      return appUtils.escapeHtml ? appUtils.escapeHtml(text) : '';
    };
    const escapeHtmlPreserve = appUtils.escapeHtmlPreserve || function escapeHtmlPreserveFallback(text) {
      return appUtils.escapeHtmlPreserve ? appUtils.escapeHtmlPreserve(text) : '';
    };
    const runConcurrent = appUtils.runConcurrent || async function runConcurrentFallback(items, concurrency, handler) {
      if (!Array.isArray(items) || !items.length) return [];
      const limit = Math.max(1, Number(concurrency) || 1);
      const results = new Array(items.length);
      let index = 0;
      async function worker() {
        while (index < items.length) {
          const currentIndex = index;
          index += 1;
          results[currentIndex] = await handler(items[currentIndex], currentIndex);
        }
      }
      const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
      await Promise.all(workers);
      return results;
    };

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

    function looksLikeCoverageSummary(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      const hasCoverage = Object.prototype.hasOwnProperty.call(data, 'coverage');
      const hasMissing = Object.prototype.hasOwnProperty.call(data, 'missing');
      const hasExtra = Object.prototype.hasOwnProperty.call(data, 'extra');
      if (hasCoverage && (hasMissing || hasExtra)) return true;
      const nestedKeys = ['result', 'summary', 'data', 'payload'];
      for (let i = 0; i < nestedKeys.length; i += 1) {
        const nested = data[nestedKeys[i]];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          if (looksLikeCoverageSummary(nested)) return true;
        }
      }
      return false;
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

    function extractCompareResultData() {
      const raw = compareResultEl.value.trim();
      if (!raw) return null;
      const result = unwrapRequirementPayload(raw);
      if (result.type && result.type !== 'compare') {
        setStatus(compareStatus, '导入内容类型不匹配（非对比完整性结果）', 'warn');
        return null;
      }
      const payload = typeof result.payload === 'string' ? result.payload : result.payload;
      try {
        return typeof payload === 'string' ? JSON.parse(payload) : payload;
      } catch (err) {
        console.warn('对比结果解析失败', err);
        return null;
      }
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
          looksLikeCoverageSummary,
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
    function extractXmindTopicsFromXml(xmlText) {
      try {
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        const titles = Array.from(doc.getElementsByTagName('title'));
        return titles.map(t => `- ${t.textContent.trim()}`).join('\n');
      } catch (err) {
        console.warn('XMind XML 解析失败', err);
        return xmlText;
      }
    }
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

    function extractCoverageFromCompareResult() {
      const data = extractCompareResultData();
      if (!data) return null;
      const value = data.coverage;
      return clampCoveragePercent(value);
    }

    const defaultScrollOffset = 200;
    function scrollElementIntoView(el, behavior = 'smooth', offset = defaultScrollOffset) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollTop = rect.top + window.scrollY - offset;
      window.scrollTo({
        top: Math.max(scrollTop, 0),
        behavior,
      });
    }

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
      if (casesCore.buildCasesComparePayload) buildCasesComparePayload = casesCore.buildCasesComparePayload;
      if (casesCore.importCaseFiles) handleCaseFiles = casesCore.importCaseFiles;
    }

    const generateTempExecId = appUtils.generateTempExecId || function generateTempExecIdFallback() {
      return `tempexec-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`;
    };

    const generateTempVersionId = appUtils.generateTempVersionId || function generateTempVersionIdFallback() {
      return `tempver-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`;
    };

    const normalizeTempExecName = appUtils.normalizeTempExecName || function normalizeTempExecNameFallback(name) {
      return (name || '').trim().toLowerCase();
    };

    const stringifyCaseField = appUtils.stringifyCaseField || function stringifyCaseFieldFallback(value) {
      if (Array.isArray(value)) {
        return value
          .map(v => {
            const base = v === undefined || v === null ? '' : v;
            return base.toString().trim();
          })
          .filter(Boolean)
          .join(' / ');
      }
      if (value && typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (err) {
          return '';
        }
      }
      if (value === undefined || value === null) return '';
      return value.toString().trim();
    };

    const removePendingTempExecByName = appUtils.removePendingTempExecByName || function removePendingTempExecByNameFallback(pendingList, name) {
      const normalized = normalizeTempExecName(name);
      for (let i = pendingList.length - 1; i >= 0; i -= 1) {
        const item = pendingList[i];
        if (normalizeTempExecName(item && item.name) === normalized) {
          pendingList.splice(i, 1);
        }
      }
    };

    const ensureTempExecReplacement = appUtils.ensureTempExecReplacement
      ? function ensureTempExecReplacementProxy(entry, pendingList) {
        return appUtils.ensureTempExecReplacement(entry, {
          existingList: state.tempExecFiles,
          pendingList: pendingList || [],
          normalizeName: normalizeTempExecName,
          removeExisting: removeTempExecFile,
          removePending: removePendingTempExecByName,
          confirmFn: window.confirm,
        });
      }
      : function ensureTempExecReplacementFallback(entry, pendingList = []) {
        const normalized = normalizeTempExecName(entry && entry.name);
        const duplicates = state.tempExecFiles.filter(file => normalizeTempExecName(file && file.name) === normalized);
        const pendingDuplicates = pendingList.filter(item => normalizeTempExecName(item && item.name) === normalized);
        if (duplicates.length || pendingDuplicates.length) {
          const confirmMsg = `检测到名称为【${entry ? entry.name : ''}】的用例已存在，替换将清除原有执行结果，是否继续？`;
          if (!window.confirm(confirmMsg)) return false;
          duplicates.forEach(file => removeTempExecFile(file && file.id));
          removePendingTempExecByName(pendingList, entry && entry.name);
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
          getModuleSuggestion,
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
          setCaseModuleStatus: function(moduleId, text, type) { return setCaseModuleStatus(moduleId, text, type); },
          clearCaseModuleStatus: function(moduleId) { return clearCaseModuleStatus(moduleId); },
          syncCaseModuleStatus: function(moduleId) { return syncCaseModuleStatus(moduleId); },
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

    function createTempExecFile(name, list = [], scope = 'current', explicitId, createdAt, requirementLabel) {
      const id = explicitId || generateTempExecId();
      const cases = normalizeTempExecCases(list, id);
      if (!cases.length) return null;
      const stamp = Number(createdAt);
      const requirement = normalizeRequirementName(requirementLabel) || getRequirementLabel(true);
      const entry = {
        id,
        name: name || `用例${state.tempExecFiles.length + 1}`,
        cases,
        scope,
        reuseEnabled: false,
        createdAt: Number.isFinite(stamp) && stamp > 0 ? stamp : Date.now(),
        reusePresets: [],
        requirement,
        versionId: '',
      };
      insertFileIntoOrder(requirement, id);
      ensureRequirementOrder(state.tempExecFiles.concat(entry).map(f => normalizeRequirementName(f && f.requirement) || '未标识需求'));
      return entry;
    }

    const tempexecCore = window.app && window.app.tempexecCore && typeof window.app.tempexecCore.init === 'function'
      ? window.app.tempexecCore.init({
        setStatus,
        normalizeRequirementName,
        getRequirementLabel,
        defaultTempExecColumns,
        defaultPlacement,
        state,
        tempExecStorageKey,
        tempExecFocusStorageKey,
        tempExecPageSizeStorageKey,
        defaultTempExecPageSize,
        escapeHtml,
        escapeHtmlPreserve,
        stringifyCaseField,
        setRequirementLabel,
        ensureTempExecColumns,
        persistSettings,
        formatCompactTimestamp,
        downloadText,
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
    const normalizeReusePresets = tempexecCore && tempexecCore.normalizeReusePresets ? tempexecCore.normalizeReusePresets : function(list) { return Array.isArray(list) ? list : []; };
    const normalizeTempExecCases = tempexecCore && tempexecCore.normalizeTempExecCases
      ? tempexecCore.normalizeTempExecCases
      : function(list, fileId) { return []; };
    const normalizeTempExecPlacement = tempexecCore && tempexecCore.normalizeTempExecPlacement
      ? tempexecCore.normalizeTempExecPlacement
      : function() { return defaultPlacement; };
    const serializeTempExecFiles = tempexecCore && tempexecCore.serializeTempExecFiles
      ? function() { return tempexecCore.serializeTempExecFiles(state); }
      : function() { return []; };
    const serializeTempExecVersionsFn = tempexecCore && tempexecCore.serializeTempExecVersions
      ? function() { return tempexecCore.serializeTempExecVersions(state); }
      : function() { return []; };
    const serializeTempExecSnapshot = tempexecCore && tempexecCore.serializeTempExecSnapshot
      ? function() { return tempexecCore.serializeTempExecSnapshot(state, getTempExecPageSize, state.settings.tempExecColumns || { ...defaultTempExecColumns }); }
      : function() { return {}; };
    const exportTempExecSnapshot = tempexecCore && tempexecCore.exportTempExecSnapshot
      ? tempexecCore.exportTempExecSnapshot
      : function() {
        if (tempExecStatus) setStatus(tempExecStatus, '当前环境暂不支持导出执行页面配置', 'warn');
      };
    const importTempExecSnapshot = tempexecCore && tempexecCore.importTempExecSnapshot
      ? tempexecCore.importTempExecSnapshot
      : async function() {
        if (tempExecStatus) setStatus(tempExecStatus, '当前环境暂不支持导入执行页面配置', 'warn');
      };
    const applyTempExecSnapshot = tempexecCore && tempexecCore.applyTempExecSnapshot
      ? tempexecCore.applyTempExecSnapshot
      : function() {};
    const serializeSingleTempExecFile = tempexecCore && tempexecCore.serializeSingleTempExecFile
      ? tempexecCore.serializeSingleTempExecFile
      : function(file) { return file || null; };
    const ensureTempExecSelection = tempexecCore && tempexecCore.ensureTempExecSelection
      ? tempexecCore.ensureTempExecSelection
      : function(fileId) {
        if (!state.tempExecSelections || typeof state.tempExecSelections !== 'object') state.tempExecSelections = {};
        if (!fileId) return new Set();
        if (!state.tempExecSelections[fileId]) state.tempExecSelections[fileId] = new Set();
        return state.tempExecSelections[fileId];
      };
    const resetTempExecSelections = tempexecCore && tempexecCore.resetTempExecSelections
      ? tempexecCore.resetTempExecSelections
      : function(fileId) {
        if (!state.tempExecSelections || typeof state.tempExecSelections !== 'object') state.tempExecSelections = {};
        if (!fileId) {
          state.tempExecSelections = {};
          return;
        }
        state.tempExecSelections[fileId] = new Set();
      };
    const ensureTempExecRemarkOpen = tempexecCore && tempexecCore.ensureTempExecRemarkOpen
      ? tempexecCore.ensureTempExecRemarkOpen
      : function(fileId) {
        if (!state.tempExecRemarkOpen || typeof state.tempExecRemarkOpen !== 'object') state.tempExecRemarkOpen = {};
        if (!fileId) return new Set();
        if (!state.tempExecRemarkOpen[fileId]) state.tempExecRemarkOpen[fileId] = new Set();
        return state.tempExecRemarkOpen[fileId];
      };
    const resetTempExecRemarkOpen = tempexecCore && tempexecCore.resetTempExecRemarkOpen
      ? tempexecCore.resetTempExecRemarkOpen
      : function(fileId) {
        if (!state.tempExecRemarkOpen || typeof state.tempExecRemarkOpen !== 'object') state.tempExecRemarkOpen = {};
        if (!fileId) {
          state.tempExecRemarkOpen = {};
          return;
        }
        state.tempExecRemarkOpen[fileId] = new Set();
      };
    const ensureTempExecReuseOpen = tempexecCore && tempexecCore.ensureTempExecReuseOpen
      ? tempexecCore.ensureTempExecReuseOpen
      : function(fileId) {
        if (!state.tempExecReuseOpen || typeof state.tempExecReuseOpen !== 'object') state.tempExecReuseOpen = {};
        if (!fileId) return new Set();
        if (!state.tempExecReuseOpen[fileId]) state.tempExecReuseOpen[fileId] = new Set();
        return state.tempExecReuseOpen[fileId];
      };
    const resetTempExecReuseOpen = tempexecCore && tempexecCore.resetTempExecReuseOpen
      ? tempexecCore.resetTempExecReuseOpen
      : function(fileId) {
        if (!state.tempExecReuseOpen || typeof state.tempExecReuseOpen !== 'object') state.tempExecReuseOpen = {};
        if (!fileId) {
          state.tempExecReuseOpen = {};
          return;
        }
        state.tempExecReuseOpen[fileId] = new Set();
      };
    const ensureTempExecDefectOpen = tempexecCore && tempexecCore.ensureTempExecDefectOpen
      ? tempexecCore.ensureTempExecDefectOpen
      : function(fileId) {
        if (!state.tempExecDefectOpen || typeof state.tempExecDefectOpen !== 'object') state.tempExecDefectOpen = {};
        if (!fileId) return new Set();
        if (!state.tempExecDefectOpen[fileId]) state.tempExecDefectOpen[fileId] = new Set();
        return state.tempExecDefectOpen[fileId];
      };
    const resetTempExecDefectOpen = tempexecCore && tempexecCore.resetTempExecDefectOpen
      ? tempexecCore.resetTempExecDefectOpen
      : function(fileId) {
        if (!state.tempExecDefectOpen || typeof state.tempExecDefectOpen !== 'object') state.tempExecDefectOpen = {};
        if (!fileId) {
          state.tempExecDefectOpen = {};
          return;
        }
        state.tempExecDefectOpen[fileId] = new Set();
      };
    const clearTempExecCaseStates = tempexecCore && tempexecCore.clearTempExecCaseStates
      ? tempexecCore.clearTempExecCaseStates
      : function(fileId) {
        if (!fileId) return;
        ensureTempExecSelection(fileId).clear();
        ensureTempExecRemarkOpen(fileId).clear();
        ensureTempExecReuseOpen(fileId).clear();
        ensureTempExecDefectOpen(fileId).clear();
      };
    const ensureDefectLinks = tempexecCore && tempexecCore.ensureDefectLinks
      ? tempexecCore.ensureDefectLinks
      : function(caseItem) {
        if (!caseItem) return [];
        if (!Array.isArray(caseItem.defectLinks)) caseItem.defectLinks = [];
        return caseItem.defectLinks;
      };
    addTempExecDefectLink = tempexecCore && tempexecCore.addTempExecDefectLink
      ? tempexecCore.addTempExecDefectLink
      : addTempExecDefectLink;
    removeTempExecDefectLink = tempexecCore && tempexecCore.removeTempExecDefectLink
      ? tempexecCore.removeTempExecDefectLink
      : removeTempExecDefectLink;
    updateTempExecDefectLink = tempexecCore && tempexecCore.updateTempExecDefectLink
      ? tempexecCore.updateTempExecDefectLink
      : updateTempExecDefectLink;
    openTempExecDefectLink = tempexecCore && tempexecCore.openTempExecDefectLink
      ? tempexecCore.openTempExecDefectLink
      : openTempExecDefectLink;
    toggleTempExecDefectPanel = tempexecCore && tempexecCore.toggleTempExecDefectPanel
      ? tempexecCore.toggleTempExecDefectPanel
      : toggleTempExecDefectPanel;
    const ensureTempVersionList = tempexecCore && tempexecCore.ensureTempVersionList
      ? tempexecCore.ensureTempVersionList
      : function() {};
    const getTempVersion = tempexecCore && tempexecCore.getTempVersion
      ? tempexecCore.getTempVersion
      : function() { return null; };
    const applyVersionAssignments = tempexecCore && tempexecCore.applyVersionAssignments
      ? tempexecCore.applyVersionAssignments
      : function() {};
    const isVersionNameDuplicate = tempexecCore && tempexecCore.isVersionNameDuplicate
      ? tempexecCore.isVersionNameDuplicate
      : function() { return false; };
    const createTempVersion = tempexecCore && tempexecCore.createTempVersion
      ? tempexecCore.createTempVersion
      : function() { return null; };
    const removeTempExecFromVersion = tempexecCore && tempexecCore.removeTempExecFromVersion
      ? tempexecCore.removeTempExecFromVersion
      : function() {};
    const removeTempGroupFromVersion = tempexecCore && tempexecCore.removeTempGroupFromVersion
      ? tempexecCore.removeTempGroupFromVersion
      : function() {};
    const moveTempExecToVersion = tempexecCore && tempexecCore.moveTempExecToVersion
      ? tempexecCore.moveTempExecToVersion
      : function() {};
    const moveTempExecFileWithinVersion = tempexecCore && tempexecCore.moveTempExecFileWithinVersion
      ? tempexecCore.moveTempExecFileWithinVersion
      : function() {};
    const getVersionRequirementBlocks = tempexecCore && tempexecCore.getVersionRequirementBlocks
      ? tempexecCore.getVersionRequirementBlocks
      : function() { return []; };
    const parseReqPayload = tempexecCore && tempexecCore.parseReqPayload
      ? tempexecCore.parseReqPayload
      : function() { return { req: '', key: '', fromVersion: '' }; };
    const reorderVersionRequirement = tempexecCore && tempexecCore.reorderVersionRequirement
      ? tempexecCore.reorderVersionRequirement
      : function() {};
    const moveRequirementToVersion = tempexecCore && tempexecCore.moveRequirementToVersion
      ? tempexecCore.moveRequirementToVersion
      : function() {};
    const moveRequirementOutOfVersion = tempexecCore && tempexecCore.moveRequirementOutOfVersion
      ? tempexecCore.moveRequirementOutOfVersion
      : function() {};
    const removeTempVersion = tempexecCore && tempexecCore.removeTempVersion
      ? tempexecCore.removeTempVersion
      : function() {};
    const reorderTempVersion = tempexecCore && tempexecCore.reorderTempVersion
      ? tempexecCore.reorderTempVersion
      : function() {};
    const renameTempVersion = tempexecCore && tempexecCore.renameTempVersion
      ? tempexecCore.renameTempVersion
      : function() {};
    const getTempVersionName = tempexecCore && tempexecCore.getTempVersionName
      ? tempexecCore.getTempVersionName
      : function() { return ''; };
    if (tempexecCore) {
      ensureTempExecPlacement = tempexecCore.ensureTempExecPlacement || ensureTempExecPlacement;
      ensureRequirementOrder = tempexecCore.ensureRequirementOrder || ensureRequirementOrder;
      ensureFileOrder = tempexecCore.ensureFileOrder || ensureFileOrder;
      ensureVersionOrder = tempexecCore.ensureVersionOrder || ensureVersionOrder;
      reorderRequirementOrder = tempexecCore.reorderRequirementOrder || reorderRequirementOrder;
      updateVersionOrder = tempexecCore.updateVersionOrder || updateVersionOrder;
      removeFileFromOrder = tempexecCore.removeFileFromOrder || removeFileFromOrder;
      insertFileIntoOrder = tempexecCore.insertFileIntoOrder || insertFileIntoOrder;
      syncTempExecPlacement = tempexecCore.syncTempExecPlacement || syncTempExecPlacement;
      moveTempExecFileToRequirement = tempexecCore.moveTempExecFileToRequirement || moveTempExecFileToRequirement;
      clampTempExecPageSize = tempexecCore.clampTempExecPageSize || clampTempExecPageSize;
      loadTempExecPageSizeSetting = tempexecCore.loadTempExecPageSizeSetting || loadTempExecPageSizeSetting;
      saveTempExecPageSizeSetting = tempexecCore.saveTempExecPageSizeSetting || saveTempExecPageSizeSetting;
      ensureTempExecPageIndex = tempexecCore.ensureTempExecPageIndex || ensureTempExecPageIndex;
      getTempExecPageSize = tempexecCore.getTempExecPageSize || getTempExecPageSize;
      resetTempExecPages = tempexecCore.resetTempExecPages || resetTempExecPages;
      setTempExecPage = tempexecCore.setTempExecPage || setTempExecPage;
      changeTempExecPage = tempexecCore.changeTempExecPage || changeTempExecPage;
      applyTempExecPageSize = tempexecCore.applyTempExecPageSize || applyTempExecPageSize;
      getTempExecFile = tempexecCore.getTempExecFile || getTempExecFile;
      getTempExecFilesByRequirement = tempexecCore.getTempExecFilesByRequirement || getTempExecFilesByRequirement;
      persistTempExecState = tempexecCore.persistTempExecState || persistTempExecState;
      renderTempExecNav = tempexecCore.renderTempExecNav || renderTempExecNav;
      renderTempExecView = tempexecCore.renderTempExecView || renderTempExecView;
      renderTempVersionGrid = tempexecCore.renderTempVersionGrid || renderTempVersionGrid;
      renderTempExecTable = tempexecCore.renderTempExecTable || renderTempExecTable;
      renderTempExecOverview = tempexecCore.renderTempExecOverview || renderTempExecOverview;
      renderTempFocusZone = tempexecCore.renderTempFocusZone || renderTempFocusZone;
      scrollTempExecViewTop = tempexecCore.scrollTempExecViewTop || scrollTempExecViewTop;
      ensureReusePresets = tempexecCore.ensureReusePresets || ensureReusePresets;
      startTempExecPresetDraft = tempexecCore.startTempExecPresetDraft || startTempExecPresetDraft;
      cancelTempExecPresetDraft = tempexecCore.cancelTempExecPresetDraft || cancelTempExecPresetDraft;
      updateTempExecPresetDraft = tempexecCore.updateTempExecPresetDraft || updateTempExecPresetDraft;
      confirmTempExecPresetDraft = tempexecCore.confirmTempExecPresetDraft || confirmTempExecPresetDraft;
      removeTempExecPreset = tempexecCore.removeTempExecPreset || removeTempExecPreset;
      toggleTempExecReusePanel = tempexecCore.toggleTempExecReusePanel || toggleTempExecReusePanel;
      addTempExecReuseEntry = tempexecCore.addTempExecReuseEntry || addTempExecReuseEntry;
      removeTempExecReuseEntry = tempexecCore.removeTempExecReuseEntry || removeTempExecReuseEntry;
      updateTempExecReuseStatus = tempexecCore.updateTempExecReuseStatus || updateTempExecReuseStatus;
      updateTempExecReuseText = tempexecCore.updateTempExecReuseText || updateTempExecReuseText;
      updateTempExecReuseNote = tempexecCore.updateTempExecReuseNote || updateTempExecReuseNote;
      handleTempExecReuseToggle = tempexecCore.handleTempExecReuseToggle || handleTempExecReuseToggle;
      getCaseExecutionDisplay = tempexecCore.getCaseExecutionDisplay || getCaseExecutionDisplay;
      applyTempExecSearch = tempexecCore.applyTempExecSearch || applyTempExecSearch;
      loadTempExecFocus = tempexecCore.loadTempExecFocus || loadTempExecFocus;
      saveTempExecFocus = tempexecCore.saveTempExecFocus || saveTempExecFocus;
      syncTempExecFocus = tempexecCore.syncTempExecFocus || syncTempExecFocus;
      addTempExecFocus = tempexecCore.addTempExecFocus || addTempExecFocus;
      removeTempExecFocus = tempexecCore.removeTempExecFocus || removeTempExecFocus;
      prioritizeTempExecUnassignedRequirements = tempexecCore.prioritizeTempExecUnassignedRequirements || prioritizeTempExecUnassignedRequirements;
    }

    function loadTempExecState() {
      let savedRaw = null;
      try {
        savedRaw = JSON.parse(localStorage.getItem(tempExecStorageKey) || '[]');
      } catch (err) {
        console.warn('临时执行数据解析失败', err);
        savedRaw = [];
      }
      let savedFiles = [];
      let savedVersions = [];
      let savedPlacement = null;
      if (Array.isArray(savedRaw)) {
        savedFiles = savedRaw;
      } else if (savedRaw && typeof savedRaw === 'object') {
        savedFiles = Array.isArray(savedRaw.files) ? savedRaw.files : [];
        savedVersions = Array.isArray(savedRaw.versions) ? savedRaw.versions : [];
        savedPlacement = savedRaw.placement && typeof savedRaw.placement === 'object' ? savedRaw.placement : null;
      }
      const usedIds = new Set();
      state.tempExecFiles = savedFiles
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          let fileId = item.id || generateTempExecId();
          while (usedIds.has(fileId)) {
            fileId = generateTempExecId();
          }
          const list = normalizeTempExecCases(item.cases || [], fileId);
          if (!list.length) return null;
          usedIds.add(fileId);
          return {
            id: fileId,
            name: item.name || '测试用例',
            cases: list,
            scope: 'history',
            requirement: normalizeRequirementName(item.requirement) || '',
            reuseEnabled: Boolean(item.reuseEnabled),
            createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
      reusePresets: item && item.reusePresets ? normalizeReusePresets(item.reusePresets) : [],
            versionId: item.versionId || '',
          };
        })
        .filter(Boolean);
      applyVersionAssignments(savedVersions);
      state.tempExecPlacement = normalizeTempExecPlacement(savedPlacement);
      state.tempExecActiveId = '';
      state.tempExecSelections = {};
      state.tempExecRemarkOpen = {};
      state.tempExecReuseOpen = {};
      state.tempExecDefectOpen = {};
      state.tempExecPresetDraft = null;
      resetTempExecPages();
      loadTempExecFocus();
      syncTempExecPlacement();
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
      renderTempFocusZone();
    }

    if (tempVersionGrid) {
      tempVersionGrid.addEventListener('dragstart', function(e) {
        var targetFile = e.target.closest('[data-temp-file]');
        var targetReq = e.target.closest('[data-temp-req]');
        var targetVer = e.target.closest('[data-temp-version]');
        if (!targetFile && !targetReq && !targetVer) return;
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        if (targetFile) {
          e.dataTransfer.setData('text/plain', targetFile.dataset.tempFile || '');
        } else if (targetReq && targetReq.dataset.tempReq) {
          var payload = [
            targetReq.dataset.tempReq || '',
            targetReq.dataset.tempReqKey || '',
            targetReq.dataset.tempVersionGroup || '',
          ].join('||');
          e.dataTransfer.setData('text/temp-req-version', payload);
          e.dataTransfer.setData('text/temp-req', targetReq.dataset.tempReq);
          e.dataTransfer.setData('text/temp-req-key', targetReq.dataset.tempReqKey || '');
        } else if (targetVer && targetVer.dataset.tempVersion) {
          e.dataTransfer.setData('text/temp-version', targetVer.dataset.tempVersion);
        }
      });
      tempVersionGrid.addEventListener('dragover', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (card) {
          e.preventDefault();
          card.classList.add('dragover');
        }
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) {
          e.preventDefault();
          reqBox.classList.add('dragover');
        }
      });
      tempVersionGrid.addEventListener('dragleave', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (card) card.classList.remove('dragover');
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) reqBox.classList.remove('dragover');
      });
    function resolveVersionTargetReq(card, clientY) {
        if (!card) return { req: '', key: '' };
        const boxes = Array.from(card.querySelectorAll('[data-temp-req]'));
        let target = { req: '', key: '' };
        boxes.some((box) => {
          const rect = box.getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) {
            target = { req: box.dataset.tempReq || '', key: box.dataset.tempReqKey || '' };
            return true;
          }
          return false;
        });
        if (!target.req && boxes.length) {
          const last = boxes[boxes.length - 1];
          target = { req: last.dataset.tempReq || '', key: last.dataset.tempReqKey || '' };
        }
        return target;
      }
      function resolveVersionFileInsertTarget(reqBox, clientY) {
        if (!reqBox) return '';
        const rows = Array.from(reqBox.querySelectorAll('[data-temp-file]'));
        let targetId = '';
        rows.some((row) => {
          const rect = row.getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) {
            targetId = row.dataset.tempFile || '';
            return true;
          }
          return false;
        });
        return targetId;
      }
      tempVersionGrid.addEventListener('drop', function(e) {
        var card = e.target.closest('[data-temp-version]');
        if (!card) return;
        e.preventDefault();
        card.classList.remove('dragover');
        var reqBox = e.target.closest('[data-temp-req]');
        if (reqBox) reqBox.classList.remove('dragover');
        if (tempMouseDragFileId && tempMouseDragFromNav) {
          var dropReq = reqBox && reqBox.dataset ? reqBox.dataset.tempReq : '';
          var pendingFileId = tempMouseDragFileId;
          tempMouseDragFileId = '';
          tempMouseDragFromNav = false;
          if (getTempExecFile && getTempExecFile(pendingFileId)) {
            if (typeof moveTempExecFileWithinVersion === 'function') {
              moveTempExecFileWithinVersion(pendingFileId, card.dataset.tempVersion, dropReq || '', '');
            } else if (typeof moveTempExecToVersion === 'function') {
              moveTempExecToVersion(pendingFileId, card.dataset.tempVersion);
            }
            return;
          }
        }
        var dataTransfer = e.dataTransfer || null;
        var verId = dataTransfer ? dataTransfer.getData('text/temp-version') : '';
        if (verId) {
          reorderTempVersion(verId, card.dataset.tempVersion);
          return;
        }
        var reqMove = dataTransfer ? dataTransfer.getData('text/temp-req') : '';
        var reqKeyMove = dataTransfer ? dataTransfer.getData('text/temp-req-key') : '';
        var reqPayload = dataTransfer ? dataTransfer.getData('text/temp-req-version') : '';
        var payloadText = reqPayload || (reqMove ? [reqMove, reqKeyMove || '', card.dataset.tempVersion || ''].join('||') : '');
        if (payloadText) {
          var parts = payloadText.split('||');
          var srcReq = parts[0] || '';
          var srcKey = parts[1] || '';
          var srcVer = parts[2] || '';
          var targetResolved = resolveVersionTargetReq(card, e.clientY);
          var tgtKey = reqBox && reqBox.dataset.tempReqKey ? reqBox.dataset.tempReqKey : targetResolved.key;
          var tgtReq = reqBox && reqBox.dataset.tempReq ? reqBox.dataset.tempReq : targetResolved.req;
          const targetVersion = card.dataset.tempVersion;
          const targetObj = getTempVersion(targetVersion);
          const hasReqInVersion = getVersionRequirementBlocks(targetObj).some(block => {
            return (block.key && block.key === srcKey) || (normalizeRequirementName(block.req) === normalizeRequirementName(srcReq));
          });
          if (srcVer === card.dataset.tempVersion && (srcKey || srcReq)) {
            if (hasReqInVersion) {
              reorderVersionRequirement(card.dataset.tempVersion, srcKey || srcReq, tgtKey || tgtReq || '');
            } else if (srcReq) {
              moveRequirementToVersion(srcReq, card.dataset.tempVersion, tgtKey || tgtReq || '');
            }
            return;
          }
          if (srcReq && typeof moveRequirementToVersion === 'function') {
            moveRequirementToVersion(srcReq, card.dataset.tempVersion, tgtKey || tgtReq || '');
            return;
          }
        }
        var ids = dataTransfer ? dataTransfer.getData('text/plain') : '';
        if (!ids && window.app && window.app.tempDragContext && window.app.tempDragContext.type === 'file') {
          ids = window.app.tempDragContext.fileId || '';
        }
        if (ids) {
          var resolvedReq = reqBox && reqBox.dataset.tempReq ? reqBox.dataset.tempReq : resolveVersionTargetReq(card, e.clientY).req;
          var beforeId = resolveVersionFileInsertTarget(reqBox, e.clientY);
          if (!beforeId) {
            var fileRow = e.target.closest('[data-temp-file]');
            beforeId = fileRow && fileRow.dataset.tempFile ? fileRow.dataset.tempFile : '';
          }
          var idArr = ids.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
          var firstFile = idArr.length ? getTempExecFile(idArr[0]) : null;
          var srcReqName = normalizeRequirementName(firstFile && firstFile.requirement) || '';
          var tgtReqName = normalizeRequirementName(resolvedReq) || srcReqName;
          if (idArr.length && srcReqName && tgtReqName && srcReqName !== tgtReqName) {
            var confirmedMove = window.confirm('确定将用例从【' + srcReqName + '】移动到【' + tgtReqName + '】吗？');
            if (!confirmedMove) return;
          }
          if (typeof moveTempExecFileWithinVersion === 'function') {
            moveTempExecFileWithinVersion(ids, card.dataset.tempVersion, resolvedReq, beforeId || '');
          } else {
            moveTempExecToVersion(ids, card.dataset.tempVersion);
          }
        }
      });
      tempVersionGrid.addEventListener('click', function(e) {
        var removeBtn = e.target.closest('[data-temp-version-remove]');
        if (removeBtn) removeTempVersion(removeBtn.dataset.tempVersionRemove);
        var groupRemoveBtn = e.target.closest('[data-temp-group-remove]');
        if (groupRemoveBtn) {
          removeTempGroupFromVersion(groupRemoveBtn.dataset.tempGroupRemove, groupRemoveBtn.dataset.tempGroupIds || '');
          return;
        }
        var renameBtn = e.target.closest('[data-temp-version-rename]');
        if (renameBtn) {
          renameTempVersion(renameBtn.dataset.tempVersionRename);
          return;
        }
        var fileBtn = e.target.closest('[data-temp-file]');
        if (fileBtn && typeof setTempExecActive === 'function') {
          var fileId = fileBtn.dataset.tempFile;
          if (fileId && getTempExecFile(fileId)) {
            setTempExecActive(fileId);
            switchTab('tempexec');
            if (typeof scrollElementIntoView === 'function' && tempExecViewSection) {
              scrollElementIntoView(tempExecViewSection, 'smooth', 120);
            } else if (tempExecViewSection && tempExecViewSection.scrollIntoView) {
              tempExecViewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      });
    }

    function handleTempFileDragStart(e) {
      if (!e) return;
      setTempDragContext(null);
      var fileBtn = e.target.closest('[data-temp-file]');
      if (fileBtn) {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', fileBtn.dataset.tempFile || '');
        }
        const file = getTempExecFile(fileBtn.dataset.tempFile);
        const req = normalizeRequirementName(file && file.requirement) || fileBtn.dataset.tempReq || '';
        setTempDragContext({
          type: 'file',
          fileId: fileBtn.dataset.tempFile || '',
          requirement: req,
          versionId: file && file.versionId ? file.versionId : '',
        });
      return;
    }
    var reqBox = e.target.closest('[data-temp-req]');
    if (reqBox && reqBox.dataset.tempReq) {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/temp-req', reqBox.dataset.tempReq);
        var rect = reqBox.getBoundingClientRect();
        var ghost = reqBox.cloneNode(true);
        ghost.style.position = 'fixed';
        ghost.style.top = '-9999px';
        ghost.style.left = '-9999px';
        ghost.style.width = rect.width + 'px';
        ghost.style.maxWidth = rect.width + 'px';
        ghost.style.boxSizing = 'border-box';
        document.body.appendChild(ghost);
        var offsetX = Math.max(0, e.clientX - rect.left);
        var offsetY = Math.max(0, e.clientY - rect.top);
        e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
        setTimeout(function() {
          if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        }, 0);
      }
      setTempDragContext({ type: 'req', req: reqBox.dataset.tempReq, versionId: reqBox.dataset.tempVersionGroup || '' });
      return;
    }
      var versionCard = e.target.closest('[data-temp-version]');
      if (versionCard && versionCard.dataset.tempVersion) {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/temp-version', versionCard.dataset.tempVersion);
        }
        setTempDragContext({ type: 'version', versionId: versionCard.dataset.tempVersion });
      }
    }

    document.addEventListener('dragstart', handleTempFileDragStart);
    var tempMouseDragFileId = '';
    var tempMouseDragFromNav = false;
    document.addEventListener('mousedown', function(e) {
      var fileRow = e.target.closest('[data-temp-file]');
      if (fileRow && fileRow.dataset.tempFile) {
        tempMouseDragFileId = fileRow.dataset.tempFile;
        tempMouseDragFromNav = Boolean(tempExecNav && tempExecNav.contains(fileRow));
      } else {
        tempMouseDragFileId = '';
        tempMouseDragFromNav = false;
      }
    });
    document.addEventListener('mouseup', function(e) {
      if (!tempMouseDragFileId || !tempMouseDragFromNav) return;
      var versionBody = e.target.closest('[data-temp-version] .temp-version-body');
      var versionCard = e.target.closest('[data-temp-version]');
      if (versionCard && versionCard.dataset && versionCard.dataset.tempVersion && versionBody) {
        var fileId = tempMouseDragFileId;
        tempMouseDragFileId = '';
        tempMouseDragFromNav = false;
        if (getTempExecFile && !getTempExecFile(fileId)) return;
        var resolvedReq = versionBody.dataset && versionBody.dataset.tempReq ? versionBody.dataset.tempReq : '';
        if (typeof moveTempExecFileWithinVersion === 'function') {
          moveTempExecFileWithinVersion(fileId, versionCard.dataset.tempVersion, resolvedReq, '');
        } else if (typeof moveTempExecToVersion === 'function') {
          moveTempExecToVersion(fileId, versionCard.dataset.tempVersion);
        }
        return;
      }
      tempMouseDragFileId = '';
      tempMouseDragFromNav = false;
    });

    async function importTempExecFiles(fileList) {
      const files = Array.from(fileList || []).sort((a, b) => (a && a.name ? a.name : '').localeCompare((b && b.name) || '', 'zh-Hans-CN'));
      if (!files.length) return;
      var firstImport = !state.tempExecFiles || !state.tempExecFiles.length;
      if (firstImport) {
        state.tempExecPlacement = { requirementOrder: [], fileOrder: {}, versionOrder: [] };
        state.tempExecFocus = [];
        saveTempExecFocus();
      }
      if (tempExecStatus) setStatus(tempExecStatus, '正在解析测试用例...', '');
      const added = [];
      for (const file of files) {
        try {
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          let text = '';
          let list = [];
          let requirementFromContent = '';
          if (ext === 'xmind') {
            const parsed = await parseXmindFile(file);
            text = parsed.text || '';
            list = Array.isArray(parsed.list) ? parsed.list : [];
          } else if (ext === 'json') {
            text = (await file.text()).trim();
            const requirementRegex = /"requir[e]?ment"\s*:\s*"([^"]+)"/i;
            const reqMatch = text.match(requirementRegex);
            if (!requirementFromContent && reqMatch && reqMatch[1]) {
              requirementFromContent = normalizeRequirementName(reqMatch[1]);
            }
            let rawJson = text;
            try {
              let parsed = JSON.parse(rawJson);
              if (Array.isArray(parsed)) {
                list = parsed;
                if (!requirementFromContent && parsed.length && parsed[0]) {
                  const candidateReq = parsed[0].requirement || parsed[0].requirment;
                  if (typeof candidateReq === 'string') requirementFromContent = normalizeRequirementName(candidateReq);
                }
              } else if (parsed && Array.isArray(parsed.cases)) {
                list = parsed.cases;
                const candidateReq = parsed.requirement || parsed.requirment;
                if (!requirementFromContent && typeof candidateReq === 'string') {
                  requirementFromContent = normalizeRequirementName(candidateReq);
                }
              } else {
                list = deriveCaseListFromText(text);
              }
            } catch (err) {
              const start = rawJson.indexOf('{');
              const end = rawJson.lastIndexOf('}');
              let parsed = null;
              if (start !== -1 && end > start) {
                const sliced = rawJson.slice(start, end + 1);
                try {
                  parsed = JSON.parse(sliced);
                } catch (err2) {
                  console.warn('JSON 主体截取后仍无法解析', err2);
                }
              }
              if (parsed) {
                if (Array.isArray(parsed)) {
                  list = parsed;
                  if (!requirementFromContent && parsed.length && parsed[0]) {
                    const candidateReq = parsed[0].requirement || parsed[0].requirment;
                    if (typeof candidateReq === 'string') requirementFromContent = normalizeRequirementName(candidateReq);
                  }
                } else if (parsed && Array.isArray(parsed.cases)) {
                  list = parsed.cases;
                  const candidateReq = parsed.requirement || parsed.requirment;
                  if (!requirementFromContent && typeof candidateReq === 'string') {
                    requirementFromContent = normalizeRequirementName(candidateReq);
                  }
                }
              }
              if (!list.length) {
                console.warn('JSON 解析失败，尝试降级处理', err);
                list = deriveCaseListFromText(text);
              }
            }
          } else {
            text = await file.text();
            list = deriveCaseListFromText(text);
          }
          const extractedRequirement = requirementFromContent || extractRequirementLabelFromText(text) || '';
          let requirementLabel = extractedRequirement;
          if (!requirementLabel) {
            requirementLabel = promptTempExecRequirement(file.name, extractedRequirement || (file && file.name));
            if (!requirementLabel) {
              if (tempExecStatus) setStatus(tempExecStatus, '已取消导入（需求标识为空）', 'warn');
              break;
            }
          }
          if (requirementLabel && !state.requirementLabel) {
            setRequirementLabel(requirementLabel, 'import');
          }
          const entry = createTempExecFile(file.name, list, 'current', null, null, requirementLabel);
          if (entry && ensureTempExecReplacement(entry, added)) {
            added.push(entry);
          }
        } catch (err) {
          console.warn('导入临时执行用例失败', err);
          if (tempExecStatus) setStatus(tempExecStatus, `解析 ${file.name} 失败：${err.message}`, 'warn');
        }
      }
      if (!added.length) {
        if (tempExecStatus) setStatus(tempExecStatus, '未解析到有效用例，请检查文件结构', 'warn');
        return;
      }
      state.tempExecFiles = state.tempExecFiles.concat(added);
      syncTempExecFocus();
      added.forEach(entry => {
        state.tempExecPages[entry.id] = 0;
      });
      if (firstImport) {
        const placement = ensureTempExecPlacement();
        const keepVersions = Array.isArray(placement.versionOrder) ? placement.versionOrder.slice() : [];
        placement.requirementOrder = [];
        placement.fileOrder = {};
        placement.versionOrder = keepVersions;
        syncTempExecPlacement();
      }
      persistTempExecState();
      setTempExecActive(added[added.length - 1].id);
      if (tempExecStatus) setStatus(tempExecStatus, `已导入 ${added.length} 份测试用例`, 'ok');
    }

    function setTempExecActive(fileId) {
      if (fileId && getTempExecFile(fileId)) {
        state.tempExecActiveId = fileId;
        ensureTempExecPageIndex(fileId);
      } else if (!fileId) {
        state.tempExecActiveId = '';
      } else {
        state.tempExecActiveId = '';
      }
      state.tempExecMindMode = false;
      if (state.tempExecPresetDraft && state.tempExecPresetDraft.fileId !== state.tempExecActiveId) {
        state.tempExecPresetDraft = null;
      }
      renderTempExecNav();
      renderTempExecView();
      renderTempVersionGrid();
      renderTempFocusZone();
    }

    function updateTempExecResult(fileId, index, value) {
      const file = getTempExecFile(fileId);
      if (!file) return;
      const selection = ensureTempExecSelection(fileId);
      const targets = selection.size && selection.has(index) ? Array.from(selection) : [index];
      targets.forEach((idx) => {
        if (file.cases[idx]) file.cases[idx].actual = value;
      });
      persistTempExecState();
      renderTempExecView();
      renderTempExecNav();
      renderTempVersionGrid();
    }

    function updateTempExecRemark(fileId, index, value) {
      const file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      file.cases[index].remark = value;
      persistTempExecState();
    }
    function pushTempExecUndo(payload) {
      if (!Array.isArray(state.tempExecUndoStack)) state.tempExecUndoStack = [];
      state.tempExecUndoStack.push({
        ts: Date.now(),
        data: payload,
      });
      if (state.tempExecUndoStack.length > 20) state.tempExecUndoStack.shift();
      return state.tempExecUndoStack.length;
    }
    function clearTempExecUndo() {
      state.tempExecUndoStack = [];
    }
    function restoreTempExecUndo() {
      if (!Array.isArray(state.tempExecUndoStack) || !state.tempExecUndoStack.length) return false;
      const undo = state.tempExecUndoStack.pop();
      if (!undo || !undo.data) return false;
      const payload = undo.data;
      const file = getTempExecFile(payload.fileId);
      if (!file) return false;
      if (payload.type === 'remove' && Array.isArray(payload.cases) && typeof payload.index === 'number') {
        const insertAt = Math.min(Math.max(payload.index, 0), file.cases.length);
        payload.cases.forEach((c, idx) => {
          file.cases.splice(insertAt + idx, 0, c);
        });
        clearTempExecCaseStates(file.id);
        persistTempExecState();
        renderTempExecView();
        return true;
      }
      if (payload.type === 'insert' && typeof payload.index === 'number') {
        if (file.cases[payload.index]) {
          file.cases.splice(payload.index, 1);
          clearTempExecCaseStates(file.id);
          persistTempExecState();
          renderTempExecView();
          return true;
        }
      }
      return false;
    }
    function cleanupTempExecUndoUI() {
      if (tempExecUndoTimer) {
        clearTimeout(tempExecUndoTimer);
        tempExecUndoTimer = null;
      }
      if (tempExecUndoInterval) {
        clearInterval(tempExecUndoInterval);
        tempExecUndoInterval = null;
      }
      if (tempExecUndoEl && tempExecUndoEl.parentNode) {
        tempExecUndoEl.parentNode.removeChild(tempExecUndoEl);
      }
      tempExecUndoEl = null;
    }
    function startTempExecUndoTimer(message) {
      cleanupTempExecUndoUI();
      const baseMsg = message || '已应用变更';
      let remaining = 8;
      tempExecUndoEl = document.createElement('div');
      tempExecUndoEl.className = 'temp-undo-toast';
      const text = document.createElement('span');
      const btn = document.createElement('button');
      btn.className = 'pill secondary';
      btn.textContent = '撤销';
      const renderCountdown = () => {
        const count = Array.isArray(state.tempExecUndoStack) ? state.tempExecUndoStack.length : 0;
        const suffix = count > 1 ? `，可撤销 ${count} 条` : '';
        text.textContent = `${baseMsg}${suffix}（${remaining}s）`;
      };
      btn.addEventListener('click', () => {
        const success = restoreTempExecUndo();
        const hasMore = Array.isArray(state.tempExecUndoStack) && state.tempExecUndoStack.length > 0;
        if (success && hasMore) {
          remaining = 8;
          renderCountdown();
          return;
        }
        clearTempExecUndo();
        cleanupTempExecUndoUI();
        if (tempExecStatus) {
          setStatus(tempExecStatus, success ? '已撤销最近操作' : '无法撤销', success ? 'ok' : 'warn');
        }
      });
      tempExecUndoEl.appendChild(text);
      tempExecUndoEl.appendChild(btn);
      document.body.appendChild(tempExecUndoEl);
      renderCountdown();
      tempExecUndoInterval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearTempExecUndo();
          cleanupTempExecUndoUI();
          return;
        }
        renderCountdown();
      }, 1000);
      tempExecUndoTimer = setTimeout(() => {
        clearTempExecUndo();
        cleanupTempExecUndoUI();
      }, remaining * 1000);
      if (tempExecStatus) setStatus(tempExecStatus, baseMsg, 'ok');
    }
    function insertTempExecCase(fileId, index) {
      const file = getTempExecFile(fileId);
      if (!file || !Array.isArray(file.cases)) return;
      const base = file.cases[index] || {};
      const module = base.module || '';
      const fresh = {
        module,
        title: '',
        priority: '',
        preconditions: '',
        steps: '',
        expected: '',
        actual: '未执行',
        remark: '',
        reuseDetails: [],
        defectLinks: [],
      };
      const insertAt = Number.isInteger(index) && index >= -1 ? index + 1 : file.cases.length;
      file.cases.splice(insertAt, 0, fresh);
      pushTempExecUndo({ type: 'insert', fileId, index: insertAt });
      clearTempExecCaseStates(fileId);
      persistTempExecState();
      renderTempExecView();
      if (tempExecStatus) {
        setStatus(tempExecStatus, '已插入空用例', 'ok');
        startTempExecUndoTimer('已插入空用例');
      }
    }
    function removeTempExecCase(fileId, index) {
      const file = getTempExecFile(fileId);
      if (!file || !Array.isArray(file.cases) || !file.cases[index]) return;
      const confirmed = window.confirm('确定删除该条用例吗？此操作不可撤销。');
      if (!confirmed) return;
      const removed = file.cases.splice(index, 1);
      pushTempExecUndo({ type: 'remove', fileId, index, cases: removed });
      clearTempExecCaseStates(fileId);
      persistTempExecState();
      renderTempExecView();
      if (tempExecStatus) {
        setStatus(tempExecStatus, '用例已删除', 'ok');
        startTempExecUndoTimer('用例已删除');
      }
    }
    function updateTempExecCaseField(fileId, index, field, value) {
      const file = getTempExecFile(fileId);
      if (!file || !file.cases[index]) return;
      const allowed = ['title', 'priority', 'preconditions', 'steps', 'expected'];
      if (allowed.indexOf(field) === -1) return;
      const text = typeof value === 'string' ? value : '';
      if (field === 'priority') {
        const normalized = (text || '').trim().toUpperCase();
        file.cases[index][field] = normalized;
      } else {
        file.cases[index][field] = text;
      }
      persistTempExecState();
    }

    function toggleTempExecSelection(fileId, index, checked) {
      const file = getTempExecFile(fileId);
      if (!file) return;
      const selection = ensureTempExecSelection(fileId);
      if (checked) {
        selection.add(index);
      } else {
        selection.delete(index);
      }
      renderTempExecView();
    }

    function toggleTempExecSelectAll(fileId, checked, indexes) {
      const file = getTempExecFile(fileId);
      if (!file) return;
      const selection = ensureTempExecSelection(fileId);
      selection.clear();
      const targets = Array.isArray(indexes) && indexes.length
        ? indexes
        : file.cases.map((_, idx) => idx);
      if (checked) targets.forEach(idx => selection.add(idx));
      renderTempExecView();
    }

    function removeTempExecFile(fileId) {
      const idx = state.tempExecFiles.findIndex(item => item.id === fileId);
      if (idx === -1) return;
      removeTempExecFromVersion(fileId, { silent: true });
      state.tempExecFiles.splice(idx, 1);
      Object.keys(state.tempExecPlacement.fileOrder || {}).forEach(req => {
        removeFileFromOrder(req, fileId);
      });
      delete state.tempExecSelections[fileId];
      delete state.tempExecRemarkOpen[fileId];
      delete state.tempExecReuseOpen[fileId];
      delete state.tempExecPages[fileId];
      state.tempExecFocus = state.tempExecFocus.filter(id => id !== fileId);
      saveTempExecFocus();
      delete state.tempExecDefectOpen[fileId];
      if (state.tempExecPresetDraft && state.tempExecPresetDraft.fileId === fileId) {
        state.tempExecPresetDraft = null;
      }
      let nextId = state.tempExecActiveId;
      if (state.tempExecActiveId === fileId) {
        const currentList = state.tempExecFiles.filter(item => item.scope === 'current');
        nextId = currentList.length ? currentList[0].id : (state.tempExecFiles[0] ? state.tempExecFiles[0].id : '');
      }
      persistTempExecState();
      setTempExecActive(nextId);
      renderTempVersionGrid();
    }

    function reorderTempRequirement(sourceReq, targetReq) {
      const src = normalizeRequirementName(sourceReq);
      const tgt = normalizeRequirementName(targetReq);
      if (!src || !tgt || src === tgt) return;
      reorderRequirementOrder(src, tgt);
      renderTempExecNav();
      renderTempVersionGrid();
    }

    function refreshImportedCaseView() {
      if (!caseViewContainer || !caseViewContainer.classList.contains('visible')) return;
      const list = getCombinedCaseList();
      if (!list.length) {
        resetImportedCaseView();
        return;
      }
      caseViewContainer.innerHTML = renderCaseTable(null, list);
    }

    function getModuleSuggestion(moduleId) {
      return (state.caseGenSuggestions[moduleId] || '').trim();
    }

    function syncCaseModuleStatus(moduleId) {
      if (!casesGenerationContainer || !moduleId) return;
      const el = casesGenerationContainer.querySelector(`[data-case-status="${moduleId}"]`);
      const statusInfo = state.caseGenModuleStatus[moduleId];
      if (!el) return;
      const text = statusInfo ? statusInfo.text : '';
      const type = statusInfo ? statusInfo.type : '';
      setStatus(el, text, type);
    }

    function setCaseModuleStatus(moduleId, text, type = '') {
      if (!moduleId) return;
      state.caseGenModuleStatus[moduleId] = { text, type };
      syncCaseModuleStatus(moduleId);
      renderCaseGenProgressBoard();
    }

    function clearCaseModuleStatus(moduleId) {
      if (!moduleId) return;
      delete state.caseGenModuleStatus[moduleId];
      syncCaseModuleStatus(moduleId);
      renderCaseGenProgressBoard();
    }

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

    function toggleImportedCaseView() {
      if (!caseViewContainer || !caseViewBtn) return;
      if (caseViewContainer.classList.contains('visible')) {
        resetImportedCaseView();
        return;
      }
      if (!hasCaseSource()) {
        setStatus(caseStatus, '请先上传或输入 XMind 测试用例', 'warn');
        setCaseViewHint('请先上传或输入 XMind 测试用例');
        return;
      }
      const list = getCombinedCaseList();
      if (!list.length) {
        setStatus(caseStatus, '无法解析当前用例，请检查格式', 'warn');
        setCaseViewHint('请先上传或输入 XMind 测试用例');
        return;
      }
      caseViewContainer.innerHTML = renderCaseTable(null, list);
      caseViewContainer.classList.remove('hidden');
      caseViewContainer.classList.add('visible');
      caseViewBtn.textContent = '收起用例视图';
      setCaseViewHint('');
      setStatus(caseStatus, '', '');
    }

    function normalizeTempExecNodeText(text) {
      if (text === undefined || text === null) return '';
      const str = text.toString().trim();
      if (!str) return '';
      return str;
    }

    const buildXmindPackageFromCases = xmindCore && xmindCore.buildXmindPackageFromCases
      ? xmindCore.buildXmindPackageFromCases
      : null;
    const buildTempExecXmindPackage = xmindCore && xmindCore.buildTempExecXmindPackage
      ? xmindCore.buildTempExecXmindPackage
      : null;
    const parseXmindFile = xmindCore && xmindCore.parseXmindFile
      ? xmindCore.parseXmindFile
      : async function parseXmindFileFallback() { return { text: '', list: [] }; };

    async function exportTempExecToXmind() {
      const active = getTempExecFile(state.tempExecActiveId);
      if (!active) {
        if (tempExecStatus) setStatus(tempExecStatus, '请选择需要导出的执行用例', 'warn');
        return;
      }
      const requirement = normalizeRequirementName(active.requirement) || ensureRequirementLabel('请输入需求标识后再导出执行 XMind');
      if (!requirement) {
        if (tempExecStatus) setStatus(tempExecStatus, '已取消导出（需求标识为空）', 'warn');
        return;
      }
      active.requirement = active.requirement || requirement;
      if (!state.requirementLabel && requirement) {
        setRequirementLabel(requirement, 'tempexec-export');
      }
      try {
        if (!buildTempExecXmindPackage) throw new Error('缺少 XMind 导出依赖');
        const { blob, fileName, count } = await buildTempExecXmindPackage(active, requirement);
        downloadBlob(fileName, blob);
        if (tempExecStatus) setStatus(tempExecStatus, `已导出 ${count} 条执行用例为 XMind`, 'ok');
      } catch (err) {
        console.error(err);
        if (tempExecStatus) setStatus(tempExecStatus, `XMind 导出失败：${err.message}`, 'err');
      }
    }


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
    const tempExecApi = {
      loadTempExecState,
      importTempExecFiles,
      addTempExecFocus,
      removeTempExecFocus,
      removeTempExecFile,
      getTempExecFile,
      setTempExecActive,
      renderTempExecNav,
      renderTempExecView,
      serializeSingleTempExecFile,
      exportTempExecToXmind,
      exportTempExecSnapshot,
      importTempExecSnapshot,
      moveTempExecFileToRequirement,
      reorderTempRequirement,
      reorderTempVersion,
      moveRequirementToVersion,
      moveRequirementOutOfVersion,
      createTempExecFile,
      ensureTempExecReplacement,
      syncTempExecFocus,
      persistTempExecState,
      ensureTempExecSelection,
      ensureTempExecRemarkOpen,
      ensureTempExecReuseOpen,
      ensureTempExecDefectOpen,
      toggleTempExecDefectPanel,
      addTempExecDefectLink,
      openTempExecDefectLink,
      removeTempExecDefectLink,
      toggleTempExecReusePanel,
      addTempExecReuseEntry,
      removeTempExecReuseEntry,
      updateTempExecReuseStatus,
      updateTempExecReuseText,
      updateTempExecReuseNote,
      updateTempExecResult,
      updateTempExecRemark,
      insertTempExecCase,
      removeTempExecCase,
      updateTempExecDefectLink,
      updateTempExecCaseField,
      handleTempExecReuseToggle,
      changeTempExecPage,
      setTempExecPage,
      scrollTempExecViewTop,
      toggleTempExecSelection,
      toggleTempExecSelectAll,
      startTempExecPresetDraft,
      cancelTempExecPresetDraft,
      confirmTempExecPresetDraft,
      updateTempExecPresetDraft,
      removeTempExecPreset,
      applyTempExecPageSize,
      applyTempExecSearch,
      getTempExecPageSize,
      generateTempExecId,
      createTempVersion,
      removeTempVersion,
      renderTempVersionGrid,
      moveTempExecToVersion,
      removeTempExecFromVersion,
      moveRequirementToVersion,
      moveTempExecFileWithinVersion,
    };
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
