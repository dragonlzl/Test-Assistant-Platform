(function() {
  function init(ctx) {
    ctx = ctx || {};
    var cloneJson = window.app.jsonCloneCore.cloneJson;
    var state = ctx.state || {};
    var config = ctx.config || (window.app && window.app.config) || {};
    var utils = ctx.utils || {};
    var core = ctx.core || {};
    var casesGenApi = ctx.casesGenApi || {};
    var prepApi = ctx.prepApi || {};
    var xmindGenApi = ctx.xmindGenApi || {};
    var xmindKnowledgeBaseApi = ctx.xmindKnowledgeBaseApi || null;
    var requiredKnowledgeBaseMethods = [
      'createDefaultState',
      'normalizeState',
      'normalizeBaseUrl',
      'buildQueryKey',
      'runPipeline',
      'renderDialogHtml',
      'getStageLabel',
    ];
    if (!xmindKnowledgeBaseApi || requiredKnowledgeBaseMethods.some(function(name) {
      return typeof xmindKnowledgeBaseApi[name] !== 'function';
    })) {
      throw new Error('xmindKnowledgeBaseApi 未完整初始化');
    }
    var createDefaultKnowledgeBaseState = xmindKnowledgeBaseApi.createDefaultState;
    var normalizeKnowledgeBaseState = xmindKnowledgeBaseApi.normalizeState;
    var normalizeKnowledgeBaseBaseUrl = xmindKnowledgeBaseApi.normalizeBaseUrl;
    var buildKnowledgeBaseQueryKey = xmindKnowledgeBaseApi.buildQueryKey;
    var getKnowledgeBaseStageLabel = xmindKnowledgeBaseApi.getStageLabel;
    var renderPolicyCore = ctx.renderPolicyCore
      || (window.app && window.app.xmindRenderPolicyCore ? window.app.xmindRenderPolicyCore : null);
    var coverageCaseTooltipCore = ctx.coverageCaseTooltipCore
      || (window.app && window.app.xmindCoverageCaseTooltipCore ? window.app.xmindCoverageCaseTooltipCore : null);
    var workspaceRecoveryCore = ctx.workspaceRecoveryCore
      || (window.app && window.app.xmindWorkspaceRecoveryCore ? window.app.xmindWorkspaceRecoveryCore : null);
    var drawerShellPort = window.app && window.app.ui ? window.app.ui.DrawerShell : null;
    var drawerFullscreenPort = drawerShellPort ? drawerShellPort.fullscreen : null;
    var drawerScrollLockPort = drawerShellPort ? drawerShellPort.scrollLock : null;

    function getRenderPolicyCore() {
      if (renderPolicyCore) return renderPolicyCore;
      if (window.app && window.app.xmindRenderPolicyCore) {
        renderPolicyCore = window.app.xmindRenderPolicyCore;
      }
      return renderPolicyCore;
    }

    function getWorkspaceRecoveryCore() {
      if (workspaceRecoveryCore) return workspaceRecoveryCore;
      if (window.app && window.app.xmindWorkspaceRecoveryCore) {
        workspaceRecoveryCore = window.app.xmindWorkspaceRecoveryCore;
      }
      return workspaceRecoveryCore;
    }

    var debounce = utils.debounce || function(fn) { return fn; };
    var showCenterToast = typeof utils.showCenterToast === 'function'
      ? utils.showCenterToast
      : function() {};
    var escapeHtml = core.escapeHtml || function(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    var setStatus = core.setStatus || function() {};
    var persistWorkflowState = core.persistWorkflowState || function() {};
    var persistWorkflowStateNow = core.persistWorkflowStateNow || persistWorkflowState;
    var renderCaseGenProgressBoard = core.renderCaseGenProgressBoard || function() {};
    var switchTab = core.switchTab || function() {};
    var runConcurrentTasks = typeof utils.runConcurrent === 'function'
      ? utils.runConcurrent
      : function(items, concurrency, worker) {
        var list = Array.isArray(items) ? items.slice() : [];
        var limit = Math.max(1, Number(concurrency) || 1);
        var runner = typeof worker === 'function'
          ? worker
          : function(item) { return Promise.resolve(item); };
        var cursor = 0;
        var results = new Array(list.length);
        function consume() {
          if (cursor >= list.length) return Promise.resolve();
          var current = cursor;
          cursor += 1;
          return Promise.resolve(runner(list[current], current))
            .then(function(ret) {
              results[current] = ret;
            })
            .then(consume);
        }
        var workers = [];
        var count = Math.min(limit, list.length || 1);
        for (var i = 0; i < count; i += 1) {
          workers.push(consume());
        }
        return Promise.all(workers).then(function() { return results; });
      };
    var defaultPrompts = window.app && window.app.config && window.app.config.defaultPrompts
      ? window.app.config.defaultPrompts
      : {};

    var openBtn = document.getElementById('xmindCaseGenOpenBtn');
    var drawerEl = document.getElementById('xmindCaseGenDrawer');
    var drawerTitleEl = document.getElementById('xmindCaseGenDrawerTitle');
    var workspaceListEl = document.getElementById('xmindCaseGenWorkspaceList');
    var workspaceAddBtn = document.getElementById('xmindCaseGenWorkspaceAddBtn');
    var toolbarEl = document.getElementById('xmindCaseGenToolbar');
    var summaryBtn = document.getElementById('xmindCaseGenSummaryBtn');
    var historyBtn = document.getElementById('xmindCaseGenHistoryBtn');
    var knowledgeRuleBtn = document.getElementById('xmindCaseGenKnowledgeRuleBtn');
    var knowledgeAiBtn = document.getElementById('xmindCaseGenKnowledgeAiBtn');
    var dedupeBtn = document.getElementById('xmindCaseGenDedupeBtn');
    var coverageBtn = document.getElementById('xmindCaseGenCoverageBtn');
    var storeBtn = document.getElementById('xmindCaseGenStoreBtn');
    var interruptBtn = document.getElementById('xmindCaseGenInterruptBtn');
    var deleteUndoBtn = document.getElementById('xmindCaseGenDeleteUndoBtn');
    var deleteRedoBtn = document.getElementById('xmindCaseGenDeleteRedoBtn');
    var summaryOverlayEl = document.getElementById('xmindCaseGenSummaryOverlay');
    var summaryDialogEl = document.getElementById('xmindCaseGenSummaryDialog');
    var summaryDialogTitleEl = document.getElementById('xmindCaseGenSummaryDialogTitle');
    var summaryDialogDescEl = document.getElementById('xmindCaseGenSummaryDialogDesc');
    var summaryDialogBodyEl = document.getElementById('xmindCaseGenSummaryDialogBody');
    var summaryCloseBtn = document.getElementById('xmindCaseGenSummaryCloseBtn');
    var exportBtn = document.getElementById('xmindCaseGenExportBtn');
    var exportMarkdownBtn = document.getElementById('xmindCaseGenExportMarkdownBtn');
    var statusEl = document.getElementById('xmindCaseGenStatus');
    var mindContainer = document.getElementById('xmindCaseGenMindContainer');

    var drawerInstance = null;
    var currentMindData = null;
    var mindInstance = null;
    var pendingCasesGenPageRender = false;
    var drawerOpenRenderTimer = 0;
    var deferredDrawerCloseCleanupTimer = 0;
    var recoveredStatePersistTimer = 0;
    var pendingOpenCenterRoot = false;
    var pendingOpenResetCanvas = false;
    var pendingOpenInstant = false;
    var pendingOpenSkipRestorableViewState = false;
    var pendingOpenForceSnapshotHydrate = false;
    var pendingDrawerOpenWorkspaceId = '';
    var drawerOpenedViaDomRestore = false;
    var restoreDrawerOpenInFlight = false;
    var pendingManualDedupeConfirm = false;

    var STEP_REQUIREMENT = 1;
    var STEP_CASES = 2;
    var STEP_OPTIONS = 3;
    var HISTORY_LIMIT = 80;
    var WORKSPACE_MAX = 3;
    var SHARED_WORKSPACE_CASEGEN_SETTING_KEYS = [
      'activeTab',
      'customRequirement',
      'dedupeSimplify',
      'needFunctionCondition',
      'needNumericValidation',
      'needBoundary',
      'needMobile',
      'needSpecial',
      'specialRepeatOperation',
      'specialMultiTouch',
      'specialRepeatExecution',
      'specialWeakNetwork',
      'specialInterruptResume',
    ];

    function getWorkspaceLimitText() {
      return '最多仅支持 ' + String(WORKSPACE_MAX) + ' 个生成页签';
    }

    var ROOT_ACTIONS = {
      FULL_CASES: 'root-full-cases',
      FULL_MODULES: 'root-full-modules',
      REGENERATE_MODULES: 'root-regenerate-modules',
      EXISTING_CASES: 'root-existing-cases',
      TOPUP_MODULES: 'root-topup-modules',
      TOPUP_MODULES_CASES: 'root-topup-modules-cases',
      APPEND_ALL: 'root-append-all',
      ROLLBACK: 'root-rollback',
    };
    var MODULE_ACTIONS = {
      FULL_CASES: 'module-full-cases',
      APPEND: 'module-append',
      ROLLBACK: 'module-rollback',
    };
    var COMMON_ACTIONS = {
      DELETE: 'xmind-delete-selection',
    };
    var DEDUPE_ACTION_ID = 'xmind-ai-dedupe';
    var COVERAGE_ACTION_ID = 'xmind-requirement-coverage';
    var DEDUPE_STRENGTH = 'conservative';
    var DEDUPE_MODE_ONLY = 'dedupe_only';
    var DEDUPE_MODE_SIMPLIFY = 'dedupe_simplify';
    var DEDUPE_MIN_VISIBLE_MS = 260;
    var DEDUPE_TERMINAL_GRACE_MS = 1200;
    var DEDUPE_TERMINAL_VISUAL_MS = 3200;
    var caseModelFactory = ctx.caseModelFactory
      || (window.app && window.app.xmindCasegenCaseModel ? window.app.xmindCasegenCaseModel : null);
    if (!caseModelFactory || typeof caseModelFactory.create !== 'function') {
      throw new Error('xmindCasegenCaseModel 未加载');
    }
    var caseModel = caseModelFactory.create({
      normalizeText: normalizeText,
      stringifyField: stringifyField,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeCaseTitle: normalizeCaseTitle,
    });
    var normalizeCaseItem = caseModel.normalizeCaseItem;
    var normalizeFallbackCaseList = caseModel.normalizeFallbackCaseList;
    var buildCaseSignature = caseModel.buildCaseSignature;
    var imagePipelineFactory = ctx.imagePipelineFactory
      || (window.app && window.app.xmindCasegenImagePipeline
        ? window.app.xmindCasegenImagePipeline
        : null);
    if (!imagePipelineFactory || typeof imagePipelineFactory.create !== 'function') {
      throw new Error('xmindCasegenImagePipeline 未加载');
    }
    var imagePipeline = imagePipelineFactory.create();
    var readBlobAsDataUrl = imagePipeline.readBlobAsDataUrl;
    var buildImageContentBlocks = imagePipeline.buildImageContentBlocks;
    var runtimeStateModelFactory = ctx.runtimeStateModelFactory
      || (window.app && window.app.xmindCasegenRuntimeStateModel
        ? window.app.xmindCasegenRuntimeStateModel
        : null);
    if (!runtimeStateModelFactory || typeof runtimeStateModelFactory.create !== 'function') {
      throw new Error('xmindCasegenRuntimeStateModel 未加载');
    }
    var runtimeStateModel = runtimeStateModelFactory.create({
      getHostState: function() { return state; },
      stepRequirement: STEP_REQUIREMENT,
      stepOptions: STEP_OPTIONS,
      buildBaselineModuleDeleteKey: buildBaselineModuleDeleteKey,
      buildBaselineCaseDeleteKey: buildBaselineCaseDeleteKey,
      normalizeUniqueStringList: normalizeUniqueStringList,
      createDefaultKnowledgeBaseState: createDefaultKnowledgeBaseState,
      createDefaultDedupeState: function() { return createDefaultDedupeState(); },
      createDefaultCoverageState: function() { return createDefaultCoverageState(); },
      createDefaultViewState: function() { return createDefaultViewState(); },
      createDefaultRootState: function() { return createDefaultRootState(); },
      createDefaultPrepState: function() { return createDefaultPrepState(); },
      normalizeStoredViewState: function(value, options) {
        return normalizeStoredViewState(value, options);
      },
      normalizeCoverageState: function(value) { return normalizeCoverageState(value); },
      hasImportedBaselineCases: function() { return hasImportedBaselineCases(); },
      normalizeInlineStatusType: normalizeInlineStatusType,
      normalizeKnowledgeBaseState: normalizeKnowledgeBaseState,
      normalizeRootPipelineDedupeModules: function(list) {
        return normalizeRootPipelineDedupeModules(list);
      },
      normalizeFallbackCaseList: normalizeFallbackCaseList,
      normalizeModuleKey: normalizeModuleKey,
    });
    var ensureState = runtimeStateModel.ensureState;
    var ensureModuleUiState = runtimeStateModel.ensureModuleUiState;
    var buildDeletedBaselineModuleMapFromList = runtimeStateModel.buildDeletedBaselineModuleMapFromList;
    var buildDeletedBaselineCaseMapFromList = runtimeStateModel.buildDeletedBaselineCaseMapFromList;
    var getDeletedBaselineModuleMap = runtimeStateModel.getDeletedBaselineModuleMap;
    var getDeletedBaselineCaseMap = runtimeStateModel.getDeletedBaselineCaseMap;
    var rememberDeletedBaselineModule = runtimeStateModel.rememberDeletedBaselineModule;
    var rememberDeletedBaselineCase = runtimeStateModel.rememberDeletedBaselineCase;
    var workspaceContextBridgeFactory = ctx.workspaceContextBridgeFactory
      || (window.app && window.app.xmindCasegenWorkspaceContextBridge
        ? window.app.xmindCasegenWorkspaceContextBridge
        : null);
    if (!workspaceContextBridgeFactory || typeof workspaceContextBridgeFactory.create !== 'function') {
      throw new Error('xmindCasegenWorkspaceContextBridge 未加载');
    }
    var workspaceContextBridge = workspaceContextBridgeFactory.create({
      getHostState: function() { return state; },
      getCasesGenApi: function() { return casesGenApi; },
      getActiveWorkspaceId: function() {
        return typeof getActiveWorkspaceId === 'function' ? getActiveWorkspaceId() : '';
      },
      isDrawerOpen: function() { return isDrawerOpen(); },
    });
    var getWorkspaceShadowDepth = workspaceContextBridge.getWorkspaceShadowDepth;
    var setWorkspaceShadowDepth = workspaceContextBridge.setWorkspaceShadowDepth;
    var getWorkspaceUiMutedDepth = workspaceContextBridge.getWorkspaceUiMutedDepth;
    var setWorkspaceUiMutedDepth = workspaceContextBridge.setWorkspaceUiMutedDepth;
    var getShadowWorkspaceSharedState = workspaceContextBridge.getShadowWorkspaceSharedState;
    var setShadowWorkspaceSharedState = workspaceContextBridge.setShadowWorkspaceSharedState;
    var syncLegacyWorkflowContext = workspaceContextBridge.syncLegacyWorkflowContext;
    var restoreLegacyWorkflowContext = workspaceContextBridge.restoreLegacyWorkflowContext;
    var finalizeLegacyWorkflowRestore = workspaceContextBridge.finalizeLegacyWorkflowRestore;
    var shouldSyncLegacyBeforeOpen = workspaceContextBridge.shouldSyncLegacyBeforeOpen;
    var shouldXmindOwnLiveWorkspaceState = workspaceContextBridge.shouldXmindOwnLiveWorkspaceState;
    var requirementContentModelFactory = ctx.requirementContentModelFactory
      || (window.app && window.app.xmindCasegenRequirementContentModel
        ? window.app.xmindCasegenRequirementContentModel
        : null);
    if (!requirementContentModelFactory || typeof requirementContentModelFactory.create !== 'function') {
      throw new Error('xmindCasegenRequirementContentModel 未加载');
    }
    var requirementContentModel = requirementContentModelFactory.create({
      getState: function() { return state; },
      getPrepState: getPrepState,
      setPrepField: setPrepField,
      cloneJson: cloneJson,
      readBlobAsDataUrl: readBlobAsDataUrl,
      getDocumentRequirementLabelText: getDocumentRequirementLabelText,
      getManualRequirementLabelText: getManualRequirementLabelText,
      getRawTextElement: function() { return document.getElementById('rawText'); },
      getWorkspaceShadowDepth: getWorkspaceShadowDepth,
      getShadowWorkspaceSharedState: getShadowWorkspaceSharedState,
      normalizeWorkspaceSharedState: function(value) { return normalizeWorkspaceSharedState(value); },
      getCombinedCaseList: function() {
        return xmindGenApi && typeof xmindGenApi.getCombinedCaseList === 'function'
          ? (xmindGenApi.getCombinedCaseList() || [])
          : [];
      },
      getDeletedBaselineModuleMap: getDeletedBaselineModuleMap,
      getDeletedBaselineCaseMap: getDeletedBaselineCaseMap,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      buildCaseSignature: buildCaseSignature,
      buildBaselineCaseDeleteKey: buildBaselineCaseDeleteKey,
      now: function() { return Date.now(); },
    });
    var modelSupportsVision = requirementContentModel.modelSupportsVision;
    var getDocumentRequirementImageCount = requirementContentModel.getDocumentRequirementImageCount;
    var getManualRequirementText = requirementContentModel.getManualRequirementText;
    var getManualRequirementImages = requirementContentModel.getManualRequirementImages;
    var getDocumentRequirementText = requirementContentModel.getDocumentRequirementText;
    var getDocumentRequirementImportName = requirementContentModel.getDocumentRequirementImportName;
    var getSelectedRequirementSource = requirementContentModel.getSelectedRequirementSource;
    var setManualRequirementText = requirementContentModel.setManualRequirementText;
    var appendManualRequirementImages = requirementContentModel.appendManualRequirementImages;
    var removeManualRequirementImage = requirementContentModel.removeManualRequirementImage;
    var hasImportedBaselineCases = requirementContentModel.hasImportedBaselineCases;
    var getVisibleBaselineCaseList = requirementContentModel.getVisibleBaselineCaseList;
    var hasVisibleImportedBaselineCases = requirementContentModel.hasVisibleImportedBaselineCases;
    var hasRequirementReady = requirementContentModel.hasRequirementReady;
    var hasCaseStepReady = requirementContentModel.hasCaseStepReady;
    var isPrepCompleted = requirementContentModel.isPrepCompleted;
    var caseSourceModelFactory = ctx.caseSourceModelFactory
      || (window.app && window.app.xmindCasegenCaseSourceModel
        ? window.app.xmindCasegenCaseSourceModel
        : null);
    if (!caseSourceModelFactory || typeof caseSourceModelFactory.create !== 'function') {
      throw new Error('xmindCasegenCaseSourceModel 未加载');
    }
    var caseSourceModel = caseSourceModelFactory.create({
      getState: function() { return state; },
      stripCodeFence: stripCodeFence,
      parseCaseList: function(rawText) {
        return xmindGenApi && typeof xmindGenApi.parseCaseList === 'function'
          ? xmindGenApi.parseCaseList(rawText || '')
          : [];
      },
      deriveCaseListFromText: function(rawText) {
        return xmindGenApi && typeof xmindGenApi.deriveCaseListFromText === 'function'
          ? xmindGenApi.deriveCaseListFromText(rawText || '')
          : [];
      },
      buildDeletedBaselineModuleMapFromList: buildDeletedBaselineModuleMapFromList,
      buildDeletedBaselineCaseMapFromList: buildDeletedBaselineCaseMapFromList,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      buildBaselineCaseDeleteKey: buildBaselineCaseDeleteKey,
      buildCaseSignature: buildCaseSignature,
      getVisibleBaselineCaseList: getVisibleBaselineCaseList,
      getRootUiState: function() { return ensureRootUiState(); },
      getModuleUiState: function(moduleId) { return ensureModuleUiState(moduleId); },
      ensureXmindState: function() { return ensureState(); },
      normalizeCaseItem: normalizeCaseItem,
      generateLocalId: generateLocalId,
      normalizeArrayField: normalizeArrayField,
    });
    var buildWorkspaceVisibleModuleContextFromSnapshot = caseSourceModel.buildWorkspaceVisibleModuleContextFromSnapshot;
    var summarizeVisibleModuleContext = caseSourceModel.summarizeVisibleModuleContext;
    var getAiCasesForModule = caseSourceModel.getAiCasesForModule;
    var buildVisibleModuleContext = caseSourceModel.buildVisibleModuleContext;
    var ensureVisibleModuleContext = caseSourceModel.ensureVisibleModuleContext;
    var getVisibleCasesForModuleEntry = caseSourceModel.getVisibleCasesForModuleEntry;
    var hasAiCasesForModule = caseSourceModel.hasAiCasesForModule;
    var findAiModuleById = caseSourceModel.findAiModuleById;
    var ensureAiModuleRecord = caseSourceModel.ensureAiModuleRecord;
    var buildVisibleModuleSnapshot = caseSourceModel.buildVisibleModuleSnapshot;
    var buildAiLayerSnapshot = caseSourceModel.buildAiLayerSnapshot;
    var modelOutputParserFactory = ctx.modelOutputParserFactory
      || (window.app && window.app.xmindCasegenModelOutputParser ? window.app.xmindCasegenModelOutputParser : null);
    if (!modelOutputParserFactory || typeof modelOutputParserFactory.create !== 'function') {
      throw new Error('xmindCasegenModelOutputParser 未加载');
    }
    var modelOutputParser = modelOutputParserFactory.create({
      stripCodeFence: stripCodeFence,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeArrayField: normalizeArrayField,
      normalizeCaseItem: normalizeCaseItem,
    });
    var summarizeModelOutputText = modelOutputParser.summarizeModelOutputText;
    var normalizeHistoryLongText = modelOutputParser.normalizeHistoryLongText;
    var extractJsonPayloadDetailed = modelOutputParser.extractJsonPayloadDetailed;
    var normalizeModelModulesOutputDetailed = modelOutputParser.normalizeModelModulesOutputDetailed;
    var generationPolicyModelFactory = ctx.generationPolicyModelFactory
      || (window.app && window.app.xmindCasegenGenerationPolicyModel
        ? window.app.xmindCasegenGenerationPolicyModel
        : null);
    if (!generationPolicyModelFactory || typeof generationPolicyModelFactory.create !== 'function') {
      throw new Error('xmindCasegenGenerationPolicyModel 未加载');
    }
    var generationPolicyModel = generationPolicyModelFactory.create({
      rootActions: ROOT_ACTIONS,
      moduleActions: MODULE_ACTIONS,
      cloneJson: cloneJson,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      normalizeArrayField: normalizeArrayField,
      normalizeCaseTitle: normalizeCaseTitle,
      normalizeCaseItem: normalizeCaseItem,
      getVisibleCasesForModuleEntry: getVisibleCasesForModuleEntry,
      normalizeHistoryLongText: normalizeHistoryLongText,
      normalizeModelModulesOutputDetailed: normalizeModelModulesOutputDetailed,
    });
    var createOperationContract = generationPolicyModel.createOperationContract;
    var applyExistingCasesCompletionPolicy = generationPolicyModel.applyExistingCasesCompletionPolicy;
    var applyImportedBaselineCompletionPolicy = generationPolicyModel.applyImportedBaselineCompletionPolicy;
    var getExistingCasesCompletionPolicy = generationPolicyModel.getExistingCasesCompletionPolicy;
    var getImportedBaselineCompletionPolicy = generationPolicyModel.getImportedBaselineCompletionPolicy;
    var filterModulesByContract = generationPolicyModel.filterModulesByContract;
    var mergeCasesWithoutDuplicates = generationPolicyModel.mergeCasesWithoutDuplicates;
    var resolveModuleTaskResult = generationPolicyModel.resolveModuleTaskResult;
    var getDiagnosticsMetric = generationPolicyModel.getDiagnosticsMetric;
    var buildGenerationErrorInfo = generationPolicyModel.buildGenerationErrorInfo;
    var getFriendlyRootEmptyModulesText = generationPolicyModel.getFriendlyRootEmptyModulesText;
    var buildRootNoChangeInfo = generationPolicyModel.buildRootNoChangeInfo;
    var buildModuleNoChangeInfo = generationPolicyModel.buildModuleNoChangeInfo;
    var generationSettingsModelFactory = ctx.generationSettingsModelFactory
      || (window.app && window.app.xmindCasegenGenerationSettingsModel
        ? window.app.xmindCasegenGenerationSettingsModel
        : null);
    if (!generationSettingsModelFactory || typeof generationSettingsModelFactory.create !== 'function') {
      throw new Error('xmindCasegenGenerationSettingsModel 未加载');
    }
    var generationSettingsModel = generationSettingsModelFactory.create({
      getState: function() { return state; },
      ensureCaseGenSettings: function() {
        if (casesGenApi && typeof casesGenApi.ensureCaseGenSettings === 'function') {
          return casesGenApi.ensureCaseGenSettings();
        }
        return state.caseGenSettings || {};
      },
      createDefaultCaseGenSettings: function() { return createDefaultCaseGenSettings(); },
      defaultPrompts: defaultPrompts,
      dedupeModeOnly: DEDUPE_MODE_ONLY,
      dedupeModeSimplify: DEDUPE_MODE_SIMPLIFY,
      getExistingCasesCompletionPolicy: getExistingCasesCompletionPolicy,
      getImportedBaselineCompletionPolicy: getImportedBaselineCompletionPolicy,
      getCaseGenPromptComponents: function(settings) {
        return casesGenApi && typeof casesGenApi.getCaseGenPromptComponents === 'function'
          ? (casesGenApi.getCaseGenPromptComponents(settings) || [])
          : [];
      },
      setCaseGenSettingValue: function(key, value) {
        if (casesGenApi && typeof casesGenApi.setCaseGenSettingValue === 'function') {
          casesGenApi.setCaseGenSettingValue(key, value);
        }
      },
      markPrepNeedsReconfirm: function(immediate) { return markPrepNeedsReconfirm(immediate); },
      persistXmindState: function(immediate) { return persistXmindState(immediate); },
    });
    var getCaseGenSettingsSnapshot = generationSettingsModel.getCaseGenSettingsSnapshot;
    var buildXmindGenerationOptionsSnapshot = generationSettingsModel.buildXmindGenerationOptionsSnapshot;
    var normalizeDedupeMode = generationSettingsModel.normalizeDedupeMode;
    var isDedupeSimplifyMode = generationSettingsModel.isDedupeSimplifyMode;
    var getDedupeModeFromSettings = generationSettingsModel.getDedupeModeFromSettings;
    var getDedupeModeActionText = generationSettingsModel.getDedupeModeActionText;
    var getDedupeRunningLabel = generationSettingsModel.getDedupeRunningLabel;
    var getDedupeRunningHint = generationSettingsModel.getDedupeRunningHint;
    var getDedupeRemovedSummaryText = generationSettingsModel.getDedupeRemovedSummaryText;
    var getDedupeNoChangeSummaryText = generationSettingsModel.getDedupeNoChangeSummaryText;
    var getDedupeExecutionDiagnosticText = generationSettingsModel.getDedupeExecutionDiagnosticText;
    var buildXmindGenerationOptionsSummary = generationSettingsModel.buildXmindGenerationOptionsSummary;
    var isRootFullGenerationContract = generationSettingsModel.isRootFullGenerationContract;
    var buildXmindHardConstraintText = generationSettingsModel.buildXmindHardConstraintText;
    var applyCaseGenOptionToSharedSettings = generationSettingsModel.applyCaseGenOptionToSharedSettings;
    var setCaseGenOption = generationSettingsModel.setCaseGenOption;
    var buildXmindPrompt = generationSettingsModel.buildXmindPrompt;
    var snapshotControllerFactory = ctx.snapshotControllerFactory
      || (window.app && window.app.xmindCasegenSnapshotController
        ? window.app.xmindCasegenSnapshotController
        : null);
    if (!snapshotControllerFactory || typeof snapshotControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenSnapshotController 未加载');
    }
    var snapshotController = snapshotControllerFactory.create({
      state: state,
      rootActions: ROOT_ACTIONS,
      cloneJson: cloneJson,
      cloneSelectionMap: function(value) { return cloneSelectionMap(value); },
      restoreSelectionMap: restoreSelectionMap,
      ensureState: ensureState,
      ensureModuleUiState: ensureModuleUiState,
      clearAllTopupHighlights: function() { return clearAllTopupHighlights(); },
      clearModuleTopupHighlight: function(moduleState) { return clearModuleTopupHighlight(moduleState); },
      clearDeleteHistoryStacks: function() { return clearDeleteHistoryStacks(); },
      syncCasesGenPageRender: syncCasesGenPageRender,
      persistXmindState: function(immediate) { return persistXmindState(immediate); },
      now: function() { return Date.now(); },
    });
    var clearStaleModuleUiState = snapshotController.clearStaleModuleUiState;
    var createCaseGenOperationSnapshotLocal = snapshotController.createCaseGenOperationSnapshotLocal;
    var discardCaseGenOperationSnapshotLocal = snapshotController.discardCaseGenOperationSnapshotLocal;
    var getLatestCaseGenOperationSnapshotLocal = snapshotController.getLatestCaseGenOperationSnapshotLocal;
    var invalidateDeleteConflictingSnapshots = snapshotController.invalidateDeleteConflictingSnapshots;
    var rollbackAllCaseGenStateLocal = snapshotController.rollbackAllCaseGenStateLocal;
    var rollbackCaseGenOperationSnapshotLocal = snapshotController.rollbackCaseGenOperationSnapshotLocal;
    var snapshotAllCaseGenStateLocal = snapshotController.snapshotAllCaseGenStateLocal;
    var syncCaseGenOperationPointersLocal = snapshotController.syncCaseGenOperationPointersLocal;
    var operationControllerFactory = ctx.operationControllerFactory
      || (window.app && window.app.xmindCasegenOperationController
        ? window.app.xmindCasegenOperationController
        : null);
    if (!operationControllerFactory || typeof operationControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenOperationController 未加载');
    }
    var operationController = operationControllerFactory.create({
      state: state,
      casesGenApi: casesGenApi,
      rootActions: ROOT_ACTIONS,
      moduleActions: MODULE_ACTIONS,
      dedupeActionId: DEDUPE_ACTION_ID,
      coverageActionId: COVERAGE_ACTION_ID,
      getActiveWorkspaceId: function() { return getActiveWorkspaceId(); },
      getManagedXmindTaskListIfReady: function() { return getManagedXmindTaskListIfReady(); },
      filterTasksByWorkspace: function(list, workspaceId) { return filterTasksByWorkspace(list, workspaceId); },
      ensureRootUiState: function() { return ensureRootUiState(); },
      getRootPipelineState: function() { return getRootPipelineState(); },
      isRootGenerationVisuallyRunning: function(value) { return isRootGenerationVisuallyRunning(value); },
      ensureDedupeUiState: function() { return ensureDedupeUiState(); },
      normalizeDedupeMode: normalizeDedupeMode,
      ensureCoverageUiState: function() { return ensureCoverageUiState(); },
      ensureState: ensureState,
      findAiModuleById: findAiModuleById,
      normalizeModuleKey: normalizeModuleKey,
      getAiCasesForModule: getAiCasesForModule,
      ensureModuleUiState: ensureModuleUiState,
      getDedupeRunningLabel: getDedupeRunningLabel,
      getLatestCaseGenOperationSnapshotLocal: getLatestCaseGenOperationSnapshotLocal,
      rollbackCaseGenOperationSnapshotLocal: rollbackCaseGenOperationSnapshotLocal,
      discardCaseGenOperationSnapshotLocal: discardCaseGenOperationSnapshotLocal,
      hasVisibleImportedBaselineCases: hasVisibleImportedBaselineCases,
      getVisibleCasesForModuleEntry: getVisibleCasesForModuleEntry,
      now: function() { return Date.now(); },
    });
    var buildBlockedActionMessage = operationController.buildBlockedActionMessage;
    var collectRunningGenerationOperations = operationController.collectRunningGenerationOperations;
    var discardCaseGenOperationSnapshotEntry = operationController.discardCaseGenOperationSnapshotEntry;
    var doesModuleActionConflictWithModuleOperation = operationController.doesModuleActionConflictWithModuleOperation;
    var doesModuleActionConflictWithRootOperation = operationController.doesModuleActionConflictWithRootOperation;
    var doesRootActionConflictWithModuleOperation = operationController.doesRootActionConflictWithModuleOperation;
    var getLatestCaseGenOperationSnapshotEntry = operationController.getLatestCaseGenOperationSnapshotEntry;
    var getModuleActions = operationController.getModuleActions;
    var getModuleFullCasesLabel = operationController.getModuleFullCasesLabel;
    var getRootActions = operationController.getRootActions;
    var getRootFullCasesLabel = operationController.getRootFullCasesLabel;
    var hasAnyAiCases = operationController.hasAnyAiCases;
    var hasAnyAiModules = operationController.hasAnyAiModules;
    var hasAnyRunningGenerationOperation = operationController.hasAnyRunningGenerationOperation;
    var isActionBlocked = operationController.isActionBlocked;
    var isModuleActionId = operationController.isModuleActionId;
    var isRollbackActionId = operationController.isRollbackActionId;
    var isRootActionId = operationController.isRootActionId;
    var isRootModuleOnlyIncrementalAction = operationController.isRootModuleOnlyIncrementalAction;
    var resolveBlockingOperation = operationController.resolveBlockingOperation;
    var rollbackCaseGenOperationSnapshotEntry = operationController.rollbackCaseGenOperationSnapshotEntry;
    var setAllModuleResultsVisibility = operationController.setAllModuleResultsVisibility;
    var setModuleResultsVisibility = operationController.setModuleResultsVisibility;
    var historyModelFactory = ctx.historyModelFactory
      || (window.app && window.app.xmindCasegenHistoryModel ? window.app.xmindCasegenHistoryModel : null);
    if (!historyModelFactory || typeof historyModelFactory.create !== 'function') {
      throw new Error('xmindCasegenHistoryModel 未加载');
    }
    var historyModel = historyModelFactory.create({
      escapeHtml: escapeHtml,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      rootActions: ROOT_ACTIONS,
      moduleActions: MODULE_ACTIONS,
      getRootFullCasesLabel: getRootFullCasesLabel,
      getModuleFullCasesLabel: getModuleFullCasesLabel,
      getRequirementLabelText: getRequirementLabelText,
    });
    var getRootHistoryActionLabel = historyModel.getRootHistoryActionLabel;
    var getModuleHistoryActionLabel = historyModel.getModuleHistoryActionLabel;
    var getGenerationFailureLabel = historyModel.getGenerationFailureLabel;
    var buildHistoryLocationLabel = historyModel.buildHistoryLocationLabel;
    var normalizeHistoryDurationMs = historyModel.normalizeHistoryDurationMs;
    var getTaskModelRequestDurationMs = historyModel.getTaskModelRequestDurationMs;
    var formatHistoryDuration = historyModel.formatHistoryDuration;
    var normalizeHistoryDetails = historyModel.normalizeHistoryDetails;
    var normalizeHistoryDiagnostics = historyModel.normalizeHistoryDiagnostics;
    var normalizeHistoryDedupeRecords = historyModel.normalizeHistoryDedupeRecords;
    var normalizeHistoryPreviewText = historyModel.normalizeHistoryPreviewText;
    var buildHistoryListHtml = historyModel.buildHistoryListHtml;
    var stateModelFactory = ctx.stateModelFactory
      || (window.app && window.app.xmindCasegenStateModel ? window.app.xmindCasegenStateModel : null);
    if (!stateModelFactory || typeof stateModelFactory.create !== 'function') {
      throw new Error('xmindCasegenStateModel 未加载');
    }
    var stateModel = stateModelFactory.create({
      stepRequirement: STEP_REQUIREMENT,
      dedupeModeOnly: DEDUPE_MODE_ONLY,
      sharedCaseGenSettingKeys: SHARED_WORKSPACE_CASEGEN_SETTING_KEYS,
      cloneJson: cloneJson,
      normalizeUniqueStringList: normalizeUniqueStringList,
      normalizeDedupeMode: normalizeDedupeMode,
      normalizeHistoryDedupeRecords: normalizeHistoryDedupeRecords,
      normalizeRootPipelineDedupeModules: normalizeRootPipelineDedupeModules,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeHistoryDurationMs: normalizeHistoryDurationMs,
      normalizeHistoryDiagnostics: normalizeHistoryDiagnostics,
      normalizePersistedRequirementLabel: normalizePersistedRequirementLabel,
      createDefaultKnowledgeBaseState: createDefaultKnowledgeBaseState,
      normalizeKnowledgeBaseState: normalizeKnowledgeBaseState,
      areRestoreContextsCompatible: function(baseContext, incomingContext) {
        var recoveryCore = getWorkspaceRecoveryCore();
        if (!recoveryCore || typeof recoveryCore.areRestoreContextsCompatible !== 'function') return true;
        return recoveryCore.areRestoreContextsCompatible(baseContext, incomingContext) === true;
      },
      createRootPipelineId: function() { return generateLocalId('xmind-root-pipeline'); },
      now: function() { return Date.now(); },
    });
    var createDefaultPrepState = stateModel.createDefaultPrepState;
    var createDefaultRootState = stateModel.createDefaultRootState;
    var createDefaultDedupeState = stateModel.createDefaultDedupeState;
    var createDefaultCoverageState = stateModel.createDefaultCoverageState;
    var normalizeCoverageState = stateModel.normalizeCoverageState;
    var createDefaultViewState = stateModel.createDefaultViewState;
    var normalizeStoredViewState = stateModel.normalizeStoredViewState;
    var mergeStoredViewState = stateModel.mergeStoredViewState;
    var shouldRestoreViewportForViewState = stateModel.shouldRestoreViewportForViewState;
    var cloneSelectionMap = stateModel.cloneSelectionMap;
    var createEmptyRequirementMedia = stateModel.createEmptyRequirementMedia;
    var createDefaultCaseGenSettings = stateModel.createDefaultCaseGenSettings;
    var createEmptyWorkspaceSharedState = stateModel.createEmptyWorkspaceSharedState;
    var cloneCaseGenSettingsValue = stateModel.cloneCaseGenSettingsValue;
    var cloneRequirementMediaValue = stateModel.cloneRequirementMediaValue;
    var createRootPipelineState = stateModel.createRootPipelineState;
    var cloneRootPipelineSnapshot = stateModel.cloneRootPipelineSnapshot;
    var buildCompactRootPipelineRestoreSnapshot = stateModel.buildCompactRootPipelineRestoreSnapshot;
    var mergeRootPipelineSnapshot = stateModel.mergeRootPipelineSnapshot;
    var createInitialXmindState = stateModel.createInitialXmindState;
    var normalizeWorkspaceSharedState = stateModel.normalizeWorkspaceSharedState;
    var createWorkspaceSnapshot = stateModel.createWorkspaceSnapshot;
    var normalizeWorkspaceSnapshot = stateModel.normalizeWorkspaceSnapshot;
    var workspaceSnapshotHasContent = stateModel.workspaceSnapshotHasContent;
    var workspaceSnapshotHasGeneratedContent = stateModel.workspaceSnapshotHasGeneratedContent;
    var workspaceSnapshotHasPrepDraft = stateModel.workspaceSnapshotHasPrepDraft;
    var mergeRestoreResultMap = stateModel.mergeRestoreResultMap;
    var deriveNextOperationSnapshotId = stateModel.deriveNextOperationSnapshotId;
    var buildOperationSnapshotRestoreVersion = stateModel.buildOperationSnapshotRestoreVersion;
    var shouldPreferRestoreOperationSnapshots = stateModel.shouldPreferRestoreOperationSnapshots;
    var mergeTaskRestoreContext = stateModel.mergeTaskRestoreContext;
    var knowledgeBaseControllerFactory = ctx.knowledgeBaseControllerFactory
      || (window.app && window.app.xmindCasegenKnowledgeBaseController
        ? window.app.xmindCasegenKnowledgeBaseController
        : null);
    if (!knowledgeBaseControllerFactory || typeof knowledgeBaseControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenKnowledgeBaseController 未加载');
    }
    var knowledgeBaseController = knowledgeBaseControllerFactory.create({
      state: state,
      knowledgeBaseApi: xmindKnowledgeBaseApi,
      cloneJson: cloneJson,
      ensureXmindState: ensureState,
      getActiveWorkspaceId: function() { return getActiveWorkspaceId(); },
      getWorkspaceRecord: function(workspaceId) { return getWorkspaceRecord(workspaceId); },
      createWorkspaceSnapshot: createWorkspaceSnapshot,
      createInitialXmindState: createInitialXmindState,
      getSelectedRequirementSource: getSelectedRequirementSource,
      getRequirementLabelText: getRequirementLabelText,
      generateLocalId: generateLocalId,
      callModelWithConfig: function(model, userText, prompt, reasoning, temperature) {
        return xmindGenApi && typeof xmindGenApi.callModelWithConfig === 'function'
          ? xmindGenApi.callModelWithConfig(model, userText, prompt, reasoning, temperature)
          : Promise.reject(new Error('当前 XMind 生成模型不可用，无法执行知识库 AI 筛选'));
      },
      callModelWithGuard: callXmindModelWithGuard,
      persistWorkflowState: persistWorkflowState,
      onActiveStateChange: function() {
        syncKnowledgeBaseToolbarState();
        if (summaryDialogController && summaryDialogController.isOpen()) {
          summaryDialogController.renderOpen();
        }
      },
      getWorkspaceShadowDepth: getWorkspaceShadowDepth,
      now: function() { return Date.now(); },
    });
    var getActiveKnowledgeBaseState = knowledgeBaseController.getActiveState;
    var runKnowledgeBasePipelineForGeneration = knowledgeBaseController.runForGeneration;
    var prepWorkflowControllerFactory = ctx.prepWorkflowControllerFactory
      || (window.app && window.app.xmindCasegenPrepWorkflowController
        ? window.app.xmindCasegenPrepWorkflowController
        : null);
    if (!prepWorkflowControllerFactory || typeof prepWorkflowControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenPrepWorkflowController 未加载');
    }
    var prepWorkflowController = prepWorkflowControllerFactory.create({
      documentObj: document,
      windowObj: window,
      DataTransfer: typeof DataTransfer !== 'undefined' ? DataTransfer : null,
      Event: typeof Event !== 'undefined' ? Event : null,
      xmindGenApi: xmindGenApi,
      getPrepState: getPrepState,
      isPrepBaseLocked: isPrepBaseLocked,
      setPrepField: setPrepField,
      appendManualRequirementImages: appendManualRequirementImages,
      notifyStatus: notifyFloatingStatus,
      renderOpenedSummaryDialog: function() { return summaryDialogController.renderOpen(); },
      openStoreConfirmDialog: openStoreConfirmDialog,
      hasAnyRunningGenerationOperation: hasAnyRunningGenerationOperation,
      resetXmindCasegenState: function(options) { return resetXmindCasegenState(options); },
      getCaseLibraryApi: function() {
        return window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
      },
      now: function() { return Date.now(); },
    });
    var buildCasesSummaryInfo = prepWorkflowController.buildCasesSummaryInfo;
    var triggerRequirementImport = prepWorkflowController.triggerRequirementImport;
    var triggerCasesImport = prepWorkflowController.triggerCasesImport;
    var triggerCasesLibrarySelect = prepWorkflowController.triggerCasesLibrarySelect;
    var ensureManualImageInput = prepWorkflowController.ensureManualImageInput;
    var requestPrepReset = prepWorkflowController.requestPrepReset;
    var importRequirementFileFromDrop = prepWorkflowController.importRequirementFileFromDrop;
    var importCasesFilesFromDrop = prepWorkflowController.importCasesFilesFromDrop;
    var prepDialogControllerFactory = ctx.prepDialogControllerFactory
      || (window.app && window.app.xmindCasegenPrepDialogController
        ? window.app.xmindCasegenPrepDialogController
        : null);
    if (!prepDialogControllerFactory || typeof prepDialogControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenPrepDialogController 未加载');
    }
    var prepDialogController = prepDialogControllerFactory.create({
      summaryDialogBodyEl: summaryDialogBodyEl,
      stepRequirement: STEP_REQUIREMENT,
      stepCases: STEP_CASES,
      stepOptions: STEP_OPTIONS,
      escapeHtml: escapeHtml,
      cloneJson: cloneJson,
      isPrepDialogOpen: function() {
        return summaryDialogController.isModeOpen('prep');
      },
      getPrepState: getPrepState,
      clampPrepStep: clampPrepStep,
      hasRequirementReady: hasRequirementReady,
      hasCaseStepReady: hasCaseStepReady,
      isPrepBaseLocked: isPrepBaseLocked,
      getCaseGenSettingsSnapshot: getCaseGenSettingsSnapshot,
      applyCaseGenOptionDraft: function(key, value) {
        applyCaseGenOptionToSharedSettings(key, value);
        if (casesGenApi && typeof casesGenApi.setCaseGenSettingValue === 'function') {
          casesGenApi.setCaseGenSettingValue(key, value);
        }
      },
      setPrepField: setPrepField,
      setCaseGenOption: setCaseGenOption,
      persistXmindState: function(immediate) { return persistXmindState(immediate); },
      renderOpenedSummaryDialog: function() { return summaryDialogController.renderOpen(); },
      closeSummaryDialog: function(options) { return summaryDialogController.close(options); },
      renderMind: function(options) { return render(options); },
      centerRootNodeView: function(options) { return centerRootNodeView(options); },
      notifySuccessToast: notifySuccessToast,
      notifyStatus: notifyStatus,
      scheduleRender: scheduleRender,
      getActiveKnowledgeBaseState: getActiveKnowledgeBaseState,
      getDocumentRequirementText: getDocumentRequirementText,
      getDocumentRequirementImportName: getDocumentRequirementImportName,
      getDocumentRequirementImageCount: getDocumentRequirementImageCount,
      getManualRequirementLabelText: getManualRequirementLabelText,
      getManualRequirementText: getManualRequirementText,
      getManualRequirementImages: getManualRequirementImages,
      buildCasesSummaryInfo: buildCasesSummaryInfo,
      hasImportedBaselineCases: hasImportedBaselineCases,
      hasAnyRunningGenerationOperation: hasAnyRunningGenerationOperation,
      triggerRequirementImport: triggerRequirementImport,
      triggerCasesImport: triggerCasesImport,
      triggerCasesLibrarySelect: triggerCasesLibrarySelect,
      ensureManualImageInput: ensureManualImageInput,
      requestPrepReset: requestPrepReset,
      removeManualRequirementImage: removeManualRequirementImage,
      setManualRequirementText: setManualRequirementText,
      appendManualRequirementImages: appendManualRequirementImages,
      importRequirementFileFromDrop: importRequirementFileFromDrop,
      importCasesFilesFromDrop: importCasesFilesFromDrop,
    });
    var renderPrepDialog = prepDialogController.renderPrepDialog;
    var syncPrepDialogState = prepDialogController.syncPrepDialogState;
    var syncSummaryDraftIntoState = prepDialogController.syncSummaryDraftIntoState;
    var mindDataModelFactory = ctx.mindDataModelFactory
      || (window.app && window.app.xmindCasegenMindDataModel
        ? window.app.xmindCasegenMindDataModel
        : null);
    if (!mindDataModelFactory || typeof mindDataModelFactory.create !== 'function') {
      throw new Error('xmindCasegenMindDataModel 未加载');
    }
    var mindDataModel = mindDataModelFactory.create({
      rootActions: ROOT_ACTIONS,
      moduleActions: MODULE_ACTIONS,
      dedupeActionId: DEDUPE_ACTION_ID,
      ensureVisibleModuleContext: ensureVisibleModuleContext,
      buildVisibleModuleContext: buildVisibleModuleContext,
      getRequirementLabelText: getRequirementLabelText,
      getPrepState: getPrepState,
      hasImportedBaselineCases: hasImportedBaselineCases,
      getCombinedCaseText: function() {
        return xmindGenApi && typeof xmindGenApi.getCombinedCaseText === 'function'
          ? xmindGenApi.getCombinedCaseText()
          : '';
      },
      buildVisibleModuleSnapshot: buildVisibleModuleSnapshot,
      ensureState: ensureState,
      ensureRootUiState: ensureRootUiState,
      ensureModuleUiState: ensureModuleUiState,
      cloneTopupHighlight: function(value) { return cloneTopupHighlight(value); },
      cloneJson: cloneJson,
      isRootGenerationVisuallyRunning: function(value) { return isRootGenerationVisuallyRunning(value); },
      getStoreValidationSignature: function() { return getStoreValidationSignature(); },
      normalizeModuleKey: normalizeModuleKey,
      normalizeModuleTitle: normalizeModuleTitle,
      buildViewStateNodeKey: function(meta, topic, fallbackPath) {
        return buildViewStateNodeKey(meta, topic, fallbackPath);
      },
      getXmindCoreApi: getXmindCoreApi,
      buildCaseSignature: buildCaseSignature,
      clearStaleModuleUiState: clearStaleModuleUiState,
      getCollapsedNodeKeyMap: function() { return getCollapsedNodeKeyMap(); },
      getVisibleCasesForModuleEntry: getVisibleCasesForModuleEntry,
      getCaseTopupHighlight: function(moduleState, caseIndex) {
        return getCaseTopupHighlight(moduleState, caseIndex);
      },
      getModuleNodeTopupHighlight: function(moduleState) {
        return getModuleNodeTopupHighlight(moduleState);
      },
      now: function() { return Date.now(); },
    });
    var buildMindData = mindDataModel.buildMindData;
    var buildModuleNodeId = mindDataModel.buildModuleNodeId;
    var buildNodeId = mindDataModel.buildNodeId;
    var getModuleNodeId = mindDataModel.getModuleNodeId;
    var getRootNodeId = mindDataModel.getRootNodeId;
    var topupHighlightControllerFactory = ctx.topupHighlightControllerFactory
      || (window.app && window.app.xmindCasegenTopupHighlightController
        ? window.app.xmindCasegenTopupHighlightController
        : null);
    if (!topupHighlightControllerFactory || typeof topupHighlightControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenTopupHighlightController 未加载');
    }
    var topupHighlightController = topupHighlightControllerFactory.create({
      mindContainer: mindContainer,
      ensureState: ensureState,
      ensureModuleUiState: ensureModuleUiState,
      buildNodeId: buildNodeId,
      generateLocalId: generateLocalId,
      setDebugState: setDebugState,
      getRenderPolicyCore: getRenderPolicyCore,
      isNodeFlowLeft: function(nodeEl) { return isNodeFlowLeft(nodeEl); },
      getMindInstance: function() { return mindInstance; },
      setTimeout: function(handler, delay) { return setTimeout(handler, delay); },
      clearTimeout: function(timerId) { clearTimeout(timerId); },
      now: function() { return Date.now(); },
      windowObj: window,
      documentObj: document,
      MutationObserver: typeof MutationObserver !== 'undefined' ? MutationObserver : null,
      ResizeObserver: typeof ResizeObserver !== 'undefined' ? ResizeObserver : null,
    });
    var bindTopupHighlightPresentation = topupHighlightController.bindTopupHighlightPresentation;
    var buildTopupHighlightLabel = topupHighlightController.buildTopupHighlightLabel;
    var cleanupTopupHighlightPresentation = topupHighlightController.cleanupTopupHighlightPresentation;
    var clearAllTopupHighlights = topupHighlightController.clearAllTopupHighlights;
    var clearModuleTopupHighlight = topupHighlightController.clearModuleTopupHighlight;
    var cloneTopupHighlight = topupHighlightController.cloneTopupHighlight;
    var getCaseTopupHighlight = topupHighlightController.getCaseTopupHighlight;
    var getModuleNodeTopupHighlight = topupHighlightController.getModuleNodeTopupHighlight;
    var getTopupHighlightMapElement = topupHighlightController.getTopupHighlightMapElement;
    var getTopupHighlightViewerElement = topupHighlightController.getTopupHighlightViewerElement;
    var scheduleTopupHighlightSync = topupHighlightController.scheduleTopupHighlightSync;
    var setModuleTopupHighlight = topupHighlightController.setModuleTopupHighlight;
    var syncTopupHighlightPresentation = topupHighlightController.syncTopupHighlightPresentation;
    var workspaceSessionController = null;
    var viewLifecycleControllerFactory = ctx.viewLifecycleControllerFactory
      || (window.app && window.app.xmindCasegenViewLifecycleController
        ? window.app.xmindCasegenViewLifecycleController
        : null);
    if (!viewLifecycleControllerFactory || typeof viewLifecycleControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenViewLifecycleController 未加载');
    }
    var viewLifecycleController = viewLifecycleControllerFactory.create({
      mindContainer: mindContainer,
      drawerEl: drawerEl,
      cloneJson: cloneJson,
      normalizeUniqueStringList: normalizeUniqueStringList,
      normalizeModuleKey: normalizeModuleKey,
      normalizeCaseTitle: normalizeCaseTitle,
      normalizeStoredViewState: normalizeStoredViewState,
      createDefaultViewState: createDefaultViewState,
      createWorkspaceSnapshot: createWorkspaceSnapshot,
      createInitialXmindState: createInitialXmindState,
      ensureState: ensureState,
      getHostState: function() { return state; },
      getWorkspaceHostState: function() { return ensureWorkspaceHostState(); },
      getWorkspaceOrder: function() {
        return workspaceSessionController ? workspaceSessionController.getWorkspaceOrder() : [];
      },
      getWorkspaceRecord: function(workspaceId) { return getWorkspaceRecord(workspaceId); },
      getActiveWorkspaceId: function() { return getActiveWorkspaceId(); },
      getWorkspaceShadowDepth: getWorkspaceShadowDepth,
      getWorkspaceUiMutedDepth: getWorkspaceUiMutedDepth,
      getMindInstance: function() { return mindInstance; },
      getCurrentMindData: function() { return currentMindData; },
      isDrawerOpen: isDrawerOpen,
      getRequirementLabelText: getRequirementLabelText,
      shouldRestoreViewportForViewState: shouldRestoreViewportForViewState,
      persistXmindState: function(immediate) { return persistXmindState(immediate); },
      persistWorkflowState: persistWorkflowState,
      persistWorkflowStateNow: persistWorkflowStateNow,
      saveActiveWorkspaceSnapshot: function(options) { return saveActiveWorkspaceSnapshot(options); },
      syncRunningTaskRestoreContexts: function(workspaceId, options) {
        return syncRunningTaskRestoreContexts(workspaceId, options);
      },
      syncSummaryDraftIntoState: syncSummaryDraftIntoState,
      isSummaryDialogOpen: function() {
        return summaryDialogController && summaryDialogController.isOpen();
      },
      getXmindTaskManager: getXmindTaskManager,
      isDrawerOpenedViaDomRestore: function() { return drawerOpenedViaDomRestore === true; },
      closeDrawer: function() { return close(); },
      render: function(options) { return render(options); },
      flushLightweightMindStatus: function() { return flushLightweightMindStatus(); },
      scheduleTopupHighlightSync: scheduleTopupHighlightSync,
      findRenderedMindNodeByStableId: findRenderedMindNodeByStableId,
      getRootNodeId: getRootNodeId,
      getMindElixirCoreApi: getMindElixirCoreApi,
    });
    var getViewState = viewLifecycleController.getViewState;
    var buildViewStateNodeKey = viewLifecycleController.buildViewStateNodeKey;
    var prepareMindDestroy = viewLifecycleController.prepareMindDestroy;
    var clearPendingOpenRenderHold = viewLifecycleController.clearPendingOpenRenderHold;
    var beginPendingOpenRenderHold = viewLifecycleController.beginPendingOpenRenderHold;
    var releasePendingOpenRenderHold = viewLifecycleController.releasePendingOpenRenderHold;
    var isPendingOpenRenderHeld = viewLifecycleController.isPendingOpenRenderHeld;
    var isPageSuspending = viewLifecycleController.isPageSuspending;
    var captureCurrentViewState = viewLifecycleController.captureCurrentViewState;
    var captureVisibleMindViewStateFromDom = viewLifecycleController.captureVisibleMindViewStateFromDom;
    var persistDrawerClosedIntentState = viewLifecycleController.persistDrawerClosedIntentState;
    var applyPendingSuspendViewStateCache = viewLifecycleController.applyPendingSuspendViewStateCache;
    var bindDrawerCloseIntentPersistence = viewLifecycleController.bindDrawerCloseIntentPersistence;
    var scheduleCaptureCurrentViewState = viewLifecycleController.scheduleCaptureCurrentViewState;
    var scheduleLightweightViewportCapture = viewLifecycleController.scheduleLightweightViewportCapture;
    var scheduleWorkspaceViewRestore = viewLifecycleController.scheduleWorkspaceViewRestore;
    var normalizeWorkspaceRenderViewState = viewLifecycleController.normalizeWorkspaceRenderViewState;
    var getWorkspaceStoredViewState = viewLifecycleController.getWorkspaceStoredViewState;
    var clearWorkspaceFullscreenRestoreIntent = viewLifecycleController.clearWorkspaceFullscreenRestoreIntent;
    var shouldRestoreWorkspaceViewport = viewLifecycleController.shouldRestoreWorkspaceViewport;
    var invalidateWorkspaceViewRestore = viewLifecycleController.invalidateWorkspaceViewRestore;
    var cancelQueuedMindRender = viewLifecycleController.cancelQueuedMindRender;
    var flushQueuedMindRender = viewLifecycleController.flushQueuedMindRender;
    var queueTerminalMindRender = viewLifecycleController.queueTerminalMindRender;
    var queueStructureMindRender = viewLifecycleController.queueStructureMindRender;
    var queueStatusMindRender = viewLifecycleController.queueStatusMindRender;
    var getRestorableViewState = viewLifecycleController.getRestorableViewState;
    var getRestorableDrawerState = viewLifecycleController.getRestorableDrawerState;
    var getCollapsedNodeKeyMap = viewLifecycleController.getCollapsedNodeKeyMap;
    var bindLiveViewStateCapture = viewLifecycleController.bindLiveViewStateCapture;
    var markManualViewportInteraction = viewLifecycleController.markManualViewportInteraction;
    var persistViewportActionViewState = viewLifecycleController.persistViewportActionViewState;
    var centerRootNodeView = viewLifecycleController.centerRootNodeView;
    var bindViewStatePersistenceLifecycle = viewLifecycleController.bindViewStatePersistenceLifecycle;
    var captureMindSearchStateForRender = viewLifecycleController.captureMindSearchStateForRender;
    var restoreMindSearchStateAfterRender = viewLifecycleController.restoreMindSearchStateAfterRender;
    var statusProjectionControllerFactory = ctx.statusProjectionControllerFactory
      || (window.app && window.app.xmindCasegenStatusProjectionController
        ? window.app.xmindCasegenStatusProjectionController
        : null);
    if (!statusProjectionControllerFactory || typeof statusProjectionControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenStatusProjectionController 未加载');
    }
    var statusProjectionController = statusProjectionControllerFactory.create({
      openBtn: openBtn,
      historyBtn: historyBtn,
      mindContainer: mindContainer,
      document: document,
      dedupeActionId: DEDUPE_ACTION_ID,
      existingCasesActionId: ROOT_ACTIONS.EXISTING_CASES,
      ensureState: ensureState,
      persistXmindState: function(immediate) { return persistXmindState(immediate); },
      isDrawerOpen: isDrawerOpen,
      isHistoryDialogOpen: function() {
        return summaryDialogController && summaryDialogController.isModeOpen('history');
      },
      getCasesGenApi: function() {
        return window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      },
      renderCaseGenProgressBoard: renderCaseGenProgressBoard,
      getMindInstance: function() { return mindInstance; },
      getRootNodeId: getRootNodeId,
      getRequirementLabelText: getRequirementLabelText,
      ensureRootUiState: function() { return ensureRootUiState(); },
      isRootGenerationVisuallyRunning: function(rootState) {
        return isRootGenerationVisuallyRunning(rootState);
      },
      buildVisibleModuleContext: buildVisibleModuleContext,
      ensureVisibleModuleContext: ensureVisibleModuleContext,
      ensureModuleUiState: ensureModuleUiState,
      getModuleNodeId: getModuleNodeId,
      syncInterruptButton: function() { return syncInterruptButton(); },
      renderWorkspaceTabs: function() { return renderWorkspaceTabs(); },
      syncInlineToolbarOverview: function() { return syncInlineToolbarOverview(); },
      setTimeout: function(handler, delay) { return setTimeout(handler, delay); },
    });
    var hasOpenButtonCompletionNotice = statusProjectionController.hasOpenButtonCompletionNotice;
    var hasHistoryUnreadNotice = statusProjectionController.hasHistoryUnreadNotice;
    var syncCasegenProgressSidebar = statusProjectionController.syncCasegenProgressSidebar;
    var syncOpenButtonState = statusProjectionController.syncOpenButtonState;
    var syncHistoryButtonState = statusProjectionController.syncHistoryButtonState;
    var clearOpenButtonCompletionNotice = statusProjectionController.clearOpenButtonCompletionNotice;
    var markOpenButtonCompletionNotice = statusProjectionController.markOpenButtonCompletionNotice;
    var clearHistoryUnreadNotice = statusProjectionController.clearHistoryUnreadNotice;
    var markHistoryUnreadNotice = statusProjectionController.markHistoryUnreadNotice;
    var findRenderedMindNodeByStableId = statusProjectionController.findRenderedMindNodeByStableId;
    var scheduleRenderedRootMindStatusBadgeRefresh = statusProjectionController.scheduleRenderedRootMindStatusBadgeRefresh;
    var flushLightweightMindStatus = statusProjectionController.flushLightweightMindStatus;
    var workspaceStateControllerFactory = ctx.workspaceStateControllerFactory
      || (window.app && window.app.xmindCasegenWorkspaceStateController
        ? window.app.xmindCasegenWorkspaceStateController
        : null);
    if (!workspaceStateControllerFactory || typeof workspaceStateControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenWorkspaceStateController 未加载');
    }
    var workspaceStateController = workspaceStateControllerFactory.create({
      state: state,
      stateModel: stateModel,
      cloneJson: cloneJson,
      snapshotPort: {
        ensureActiveState: ensureState,
        captureCurrent: function(options) {
          return workspaceSessionController.createWorkspaceSnapshotFromCurrent(options);
        },
        applyShared: function(snapshot, options) {
          return workspaceSessionController.applySharedWorkspaceSnapshot(snapshot, options);
        },
        syncSummaryDraft: syncSummaryDraftIntoState,
        setDrawerState: function(drawerOpen, fullscreen) {
          getViewState().drawerOpen = drawerOpen === true;
          getViewState().fullscreen = fullscreen === true;
        },
        postHydrate: function() {
          syncInlineStatusFromState();
          syncKnowledgeBaseToolbarState();
        },
      },
      persistencePort: {
        persistDeferred: persistWorkflowState,
        persistImmediate: persistWorkflowStateNow,
        syncRestoreContexts: function(workspaceId, options) {
          return syncRunningTaskRestoreContexts(workspaceId, options);
        },
      },
      environmentPort: {
        hasImportedBaseline: hasImportedBaselineCases,
        isDrawerOpen: isDrawerOpen,
        isDrawerFullscreen: function() {
          return Boolean(drawerEl && drawerEl.classList
            && drawerEl.classList.contains('xmind-drawer-fullscreen'));
        },
        isPageSuspending: isPageSuspending,
        getShadowDepth: getWorkspaceShadowDepth,
      },
      getTaskManager: getXmindTaskManager,
      getRecoveryCore: getWorkspaceRecoveryCore,
      deriveLiveWorkspaceName: function(fallback) {
        return workspaceSessionController
          ? workspaceSessionController.deriveLiveWorkspaceRecordName(fallback)
          : fallback;
      },
      normalizeRequirementLabelFromFileName: normalizeRequirementLabelFromFileName,
    });
    var persistXmindState = workspaceStateController.persistXmindState;
    var persistManagedTaskWorkspaceState = workspaceStateController.persistManagedTaskWorkspaceState;
    var extractActiveXmindStateSnapshot = workspaceStateController.extractActiveXmindStateSnapshot;
    var applyActiveXmindStateSnapshot = workspaceStateController.applyActiveXmindStateSnapshot;
    var createWorkspaceRecord = workspaceStateController.createWorkspaceRecord;
    var getWorkspaceHostState = workspaceStateController.getWorkspaceHostState;
    var isDefaultWorkspaceRecordName = workspaceStateController.isDefaultWorkspaceRecordName;
    var buildDefaultWorkspaceRecordName = workspaceStateController.buildDefaultWorkspaceRecordName;
    var resetActiveWorkspaceRecordNameToDefault = workspaceStateController.resetActiveWorkspaceRecordNameToDefault;
    var resetActiveWorkspaceRecordSnapshotToInitial = workspaceStateController.resetActiveWorkspaceRecordSnapshotToInitial;
    var captureWorkspaceSnapshot = workspaceStateController.captureWorkspaceSnapshot;
    var ensureWorkspaceHostState = workspaceStateController.ensureWorkspaceHostState;
    var getActiveWorkspaceId = workspaceStateController.getActiveWorkspaceId;
    var getMirrorWorkspaceId = workspaceStateController.getMirrorWorkspaceId;
    var getWorkspaceUiSelectedId = workspaceStateController.getWorkspaceUiSelectedId;
    var setMirrorWorkspaceSelection = workspaceStateController.setMirrorWorkspaceSelection;
    var getWorkspaceRecord = workspaceStateController.getWorkspaceRecord;
    var clearManagedTasksForWorkspace = workspaceStateController.clearManagedTasksForWorkspace;
    var rotateWorkspaceGeneration = workspaceStateController.rotateWorkspaceGeneration;
    var ensureWorkspaceRecordFromCurrentContent = workspaceStateController.ensureWorkspaceRecordFromCurrentContent;
    var saveActiveWorkspaceSnapshot = workspaceStateController.saveActiveWorkspaceSnapshot;
    var hydrateWorkspaceSnapshot = workspaceStateController.hydrateWorkspaceSnapshot;
    var buildWorkspaceDisplayName = workspaceStateController.buildWorkspaceDisplayName;
    var buildWorkspaceId = workspaceStateController.buildWorkspaceId;
    var summaryDialogControllerFactory = ctx.summaryDialogControllerFactory
      || (window.app && window.app.xmindCasegenSummaryDialogController
        ? window.app.xmindCasegenSummaryDialogController
        : null);
    if (!summaryDialogControllerFactory || typeof summaryDialogControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenSummaryDialogController 未加载');
    }
    var summaryDialogController = summaryDialogControllerFactory.create({
      elements: {
        overlayEl: summaryOverlayEl,
        dialogEl: summaryDialogEl,
        titleEl: summaryDialogTitleEl,
        descEl: summaryDialogDescEl,
        bodyEl: summaryDialogBodyEl,
        prepBtn: summaryBtn,
        historyBtn: historyBtn,
        knowledgeRuleBtn: knowledgeRuleBtn,
        knowledgeAiBtn: knowledgeAiBtn,
        coverageBtn: coverageBtn,
      },
      stepRequirement: STEP_REQUIREMENT,
      stepOptions: STEP_OPTIONS,
      hasActiveWorkspace: function() { return hasActiveWorkspace(); },
      notifyNoWorkspace: function() {
        notifyFloatingStatus('请先新建生成页签', 'warn', 2500);
      },
      hideOpenMindContextMenu: hideOpenMindContextMenu,
      getPrepState: getPrepState,
      isPrepBaseLocked: isPrepBaseLocked,
      clampPrepStep: clampPrepStep,
      syncSummaryDraftIntoState: syncSummaryDraftIntoState,
      renderPrep: function() { return renderPrepDialog(); },
      renderHistory: function() { return renderHistoryDialog(); },
      renderKnowledgeBase: function() { return renderKnowledgeBaseDialog(); },
      renderCoverage: function() { return renderCoverageDialog(); },
      hideCoverageTooltip: function() { return hideCoverageCaseDetailTooltip(); },
      persistState: function(immediate) { return persistXmindState(immediate); },
      releaseCoverageResources: function() { return releaseCoverageRequirementImageObjectUrls(); },
      renderWorkspaceTabs: function() { return renderWorkspaceTabs(); },
      clearHistoryUnreadNotice: clearHistoryUnreadNotice,
      syncHistoryButtonState: syncHistoryButtonState,
    });
    var getSummaryDialogState = summaryDialogController.getState;
    var renderOpenedSummaryDialog = summaryDialogController.renderOpen;
    var openSummaryDialog = summaryDialogController.openPrep;
    var openHistoryDialog = summaryDialogController.openHistory;
    var openKnowledgeBaseDialog = summaryDialogController.openKnowledgeBase;
    var closeSummaryDialog = summaryDialogController.close;
    var refreshRecoveryControllerFactory = ctx.refreshRecoveryControllerFactory
      || (window.app && window.app.xmindCasegenRefreshRecoveryController
        ? window.app.xmindCasegenRefreshRecoveryController
        : null);
    if (!refreshRecoveryControllerFactory || typeof refreshRecoveryControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenRefreshRecoveryController 未加载');
    }
    var refreshRecoveryController = refreshRecoveryControllerFactory.create({
      state: state,
      retryLimit: 18,
      getViewState: getViewState,
      getActiveWorkspaceId: getActiveWorkspaceId,
      getWorkspaceRecord: getWorkspaceRecord,
      listManagedTasks: function() {
        return typeof listManagedXmindTasks === 'function' ? listManagedXmindTasks() : [];
      },
      isTaskTerminal: function(task) {
        return typeof isManagedTaskTerminal === 'function' ? isManagedTaskTerminal(task) : false;
      },
      filterTasksByWorkspace: function(tasks, workspaceId) {
        return typeof filterTasksByWorkspace === 'function'
          ? filterTasksByWorkspace(tasks, workspaceId)
          : [];
      },
      isDrawerOpen: isDrawerOpen,
      openDrawer: function(options) {
        return typeof open === 'function' ? open(options) : null;
      },
      applyPendingSuspendViewStateCache: applyPendingSuspendViewStateCache,
      reconcileManagedTasks: function(options) {
        return typeof reconcileManagedXmindTasks === 'function'
          ? reconcileManagedXmindTasks(options)
          : null;
      },
      ensureWorkspaceHostState: ensureWorkspaceHostState,
      ensureActiveWorkspaceHydrated: function() {
        return typeof ensureActiveWorkspaceHydrated === 'function'
          ? ensureActiveWorkspaceHydrated()
          : null;
      },
      setDebugState: setDebugState,
      setTimer: function(handler, delay) { return setTimeout(handler, delay); },
      clearTimer: function(timerId) { clearTimeout(timerId); },
      now: function() { return Date.now(); },
    });
    var clearDrawerRestoreRetry = refreshRecoveryController.clearRetry;
    var markDrawerManualCloseSuppressed = refreshRecoveryController.markManualCloseSuppressed;
    var isDrawerManualCloseSuppressed = refreshRecoveryController.isManualCloseSuppressed;
    var hasManagedTaskRestoreContextForWorkspace = refreshRecoveryController.hasManagedTaskRestoreContextForWorkspace;
    var shouldRestoreDrawerAfterRefresh = refreshRecoveryController.shouldRestoreAfterRefresh;
    var scheduleDrawerRestoreRetry = refreshRecoveryController.scheduleRetry;
    var restoreDrawerAfterRefreshIfNeeded = refreshRecoveryController.restoreAfterWorkflowReady;
    var workspaceSessionControllerFactory = ctx.workspaceSessionControllerFactory
      || (window.app && window.app.xmindCasegenWorkspaceSessionController
        ? window.app.xmindCasegenWorkspaceSessionController
        : null);
    if (!workspaceSessionControllerFactory || typeof workspaceSessionControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenWorkspaceSessionController 未加载');
    }
    workspaceSessionController = workspaceSessionControllerFactory.create({
      state: state,
      documentObj: document,
      drawerEl: drawerEl,
      workspaceListEl: workspaceListEl,
      workspaceAddBtn: workspaceAddBtn,
      prepApi: prepApi,
      workspaceLimit: WORKSPACE_MAX,
      stepRequirement: STEP_REQUIREMENT,
      model: {
        cloneJson: cloneJson,
        cloneSelectionMap: cloneSelectionMap,
        restoreSelectionMap: restoreSelectionMap,
        normalizeWorkspaceSharedState: normalizeWorkspaceSharedState,
        cloneCaseGenSettingsValue: cloneCaseGenSettingsValue,
        createDefaultCaseGenSettings: createDefaultCaseGenSettings,
        normalizePersistedRequirementLabel: normalizePersistedRequirementLabel,
        normalizeRequirementLabelFromFileName: normalizeRequirementLabelFromFileName,
        cloneRequirementMediaValue: cloneRequirementMediaValue,
        createInitialXmindState: createInitialXmindState,
        createWorkspaceSnapshot: createWorkspaceSnapshot,
        createDefaultViewState: createDefaultViewState,
        normalizeStoredViewState: normalizeStoredViewState,
        normalizeWorkspaceSnapshot: normalizeWorkspaceSnapshot,
        workspaceSnapshotHasContent: workspaceSnapshotHasContent,
        workspaceSnapshotHasPrepDraft: workspaceSnapshotHasPrepDraft,
        workspaceSnapshotHasGeneratedContent: workspaceSnapshotHasGeneratedContent,
        summarizeVisibleModuleContext: summarizeVisibleModuleContext,
        buildVisibleModuleContext: buildVisibleModuleContext,
        buildWorkspaceVisibleModuleContextFromSnapshot: buildWorkspaceVisibleModuleContextFromSnapshot,
        escapeHtml: escapeHtml,
      },
      ensureState: ensureState,
      workspace: workspaceStateController,
      view: viewLifecycleController,
      tasks: {
        listManagedXmindTasks: function() { return listManagedXmindTasks(); },
        getTaskWorkspaceId: function(task) { return getTaskWorkspaceId(task); },
        filterTasksByWorkspace: function(list, workspaceId) {
          return filterTasksByWorkspace(list, workspaceId);
        },
        isManagedTaskTerminal: function(task) { return isManagedTaskTerminal(task); },
        consumeManagedXmindTask: function(task) { return consumeManagedXmindTask(task); },
        syncManagedRunningUiState: function(options) { return syncManagedRunningUiState(options); },
      },
      ui: {
        syncCasesGenPageRender: syncCasesGenPageRender,
        syncCasegenProgressSidebar: syncCasegenProgressSidebar,
        syncOpenButtonState: syncOpenButtonState,
        syncKnowledgeBaseToolbarState: syncKnowledgeBaseToolbarState,
        renderOpenedSummaryDialog: function() { return renderOpenedSummaryDialog(); },
        renderCaseGenProgressBoard: renderCaseGenProgressBoard,
        openSummaryDialog: function(step) { return openSummaryDialog(step); },
        closeSummaryDialog: function(options) { return closeSummaryDialog(options); },
        notifyInlineStatus: notifyInlineStatus,
        notifyFloatingStatus: notifyFloatingStatus,
        notifySuccessToast: notifySuccessToast,
        setDebugState: setDebugState,
        render: function(options) { return render(options); },
        openDrawer: function(options) { return open(options); },
        openStoreConfirmDialog: openStoreConfirmDialog,
        clearOpenButtonCompletionNotice: clearOpenButtonCompletionNotice,
      },
      workflow: {
        getPrepState: getPrepState,
        createDefaultPrepState: createDefaultPrepState,
        getManualRequirementLabelText: getManualRequirementLabelText,
        getDocumentRequirementLabelText: getDocumentRequirementLabelText,
        getSelectedRequirementSource: getSelectedRequirementSource,
        getCasesCoreApi: getCasesCoreApi,
        hasImportedBaselineCases: hasImportedBaselineCases,
        hasAnyRunningGenerationOperation: hasAnyRunningGenerationOperation,
        clearStoreValidationState: clearStoreValidationState,
        cleanupTopupHighlightPresentation: cleanupTopupHighlightPresentation,
        clearDrawerRestoreRetry: clearDrawerRestoreRetry,
        clearDeleteHistoryStacks: clearDeleteHistoryStacks,
        destroyMind: destroyMind,
        shouldXmindOwnLiveWorkspaceState: shouldXmindOwnLiveWorkspaceState,
        shouldSyncLegacyBeforeOpen: shouldSyncLegacyBeforeOpen,
        syncLegacyWorkflowContext: syncLegacyWorkflowContext,
        persistWorkflowState: persistWorkflowState,
        persistWorkflowStateNow: persistWorkflowStateNow,
        syncSummaryDraftIntoState: syncSummaryDraftIntoState,
        cloneModulesWithoutCases: cloneModulesWithoutCases,
        buildCompactRootPipelineRestoreSnapshot: buildCompactRootPipelineRestoreSnapshot,
        cloneRootPipelineSnapshot: cloneRootPipelineSnapshot,
        getRootPipelineState: getRootPipelineState,
        setRootPipelineState: setRootPipelineState,
        mergeRestoreResultMap: mergeRestoreResultMap,
        buildOperationSnapshotRestoreVersion: buildOperationSnapshotRestoreVersion,
        shouldPreferRestoreOperationSnapshots: shouldPreferRestoreOperationSnapshots,
        syncCaseGenOperationPointersLocal: syncCaseGenOperationPointersLocal,
        deriveNextOperationSnapshotId: deriveNextOperationSnapshotId,
        mergeRootPipelineSnapshot: mergeRootPipelineSnapshot,
        mergeStoredViewState: mergeStoredViewState,
        scheduleRecoveredStatePersist: scheduleRecoveredStatePersist,
        flushDeferredCasesGenPageRender: flushDeferredCasesGenPageRender,
        scheduleManagedTaskReconcile: function(reason) { return scheduleManagedTaskReconcile(reason); },
      },
      environment: {
        getWorkspaceShadowDepth: getWorkspaceShadowDepth,
        setWorkspaceShadowDepth: setWorkspaceShadowDepth,
        getWorkspaceUiMutedDepth: getWorkspaceUiMutedDepth,
        setWorkspaceUiMutedDepth: setWorkspaceUiMutedDepth,
        getShadowWorkspaceSharedState: getShadowWorkspaceSharedState,
        setShadowWorkspaceSharedState: setShadowWorkspaceSharedState,
        isDrawerOpen: isDrawerOpen,
        isDrawerFullscreen: function() {
          return Boolean(drawerEl && drawerEl.classList
            && drawerEl.classList.contains('xmind-drawer-fullscreen'));
        },
        isDrawerRestoreInFlight: function() { return restoreDrawerOpenInFlight === true; },
        setPendingDrawerOpenWorkspaceId: function(value) {
          pendingDrawerOpenWorkspaceId = String(value || '');
        },
        getManualImageInputEl: prepWorkflowController.getManualImageInputEl,
      },
      now: function() { return Date.now(); },
    });
    var buildCurrentSharedWorkspaceSnapshot = workspaceSessionController.buildCurrentSharedWorkspaceSnapshot;
    var applySharedWorkspaceSnapshot = workspaceSessionController.applySharedWorkspaceSnapshot;
    var currentActiveWorkspaceHasContent = workspaceSessionController.currentActiveWorkspaceHasContent;
    var resetWorkflowStateForXmind = workspaceSessionController.resetWorkflowStateForXmind;
    var resetXmindCasegenState = workspaceSessionController.resetXmindCasegenState;
    var updateSummary = workspaceSessionController.updateSummary;
    var hasActiveWorkspace = workspaceSessionController.hasActiveWorkspace;
    var ensureActiveWorkspaceHydrated = workspaceSessionController.ensureActiveWorkspaceHydrated;
    var getWorkspaceOrder = workspaceSessionController.getWorkspaceOrder;
    var hasWorkspaceRunningTasks = workspaceSessionController.hasWorkspaceRunningTasks;
    var listWorkspaceProgressItems = workspaceSessionController.listWorkspaceProgressItems;
    var getWorkspaceModuleMirrorPayload = workspaceSessionController.getWorkspaceModuleMirrorPayload;
    var renderWorkspaceTabs = workspaceSessionController.renderWorkspaceTabs;
    var createWorkspaceSnapshotFromCurrent = workspaceSessionController.createWorkspaceSnapshotFromCurrent;
    var switchWorkspace = workspaceSessionController.switchWorkspace;
    var activateWorkspace = workspaceSessionController.activateWorkspace;
    var selectWorkspaceForMirror = workspaceSessionController.selectWorkspaceForMirror;
    var hydrateActiveWorkspaceSnapshot = workspaceSessionController.hydrateActiveWorkspaceSnapshot;
    var syncActiveWorkspaceSnapshot = workspaceSessionController.syncActiveWorkspaceSnapshot;
    var createWorkspaceAndOpenPrep = workspaceSessionController.createWorkspaceAndOpenPrep;
    var openWorkspaceFromProgressPanel = workspaceSessionController.openWorkspaceFromProgressPanel;
    var deleteWorkspace = workspaceSessionController.deleteWorkspace;
    var captureActiveManagedTaskRestoreContext = workspaceSessionController.captureActiveManagedTaskRestoreContext;
    var ensureWorkspaceRecordForManagedTask = workspaceSessionController.ensureWorkspaceRecordForManagedTask;
    var applyManagedTaskLiveRestoreContext = workspaceSessionController.applyManagedTaskLiveRestoreContext;
    var handleManagedTaskWorkspaceRecordsRestored = workspaceSessionController.handleManagedTaskWorkspaceRecordsRestored;
    var runInWorkspaceContextNow = workspaceSessionController.runInWorkspaceContextNow;
    var drawerSessionControllerFactory = ctx.drawerSessionControllerFactory
      || (window.app && window.app.xmindCasegenDrawerSessionController
        ? window.app.xmindCasegenDrawerSessionController
        : null);
    if (!drawerSessionControllerFactory || typeof drawerSessionControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenDrawerSessionController 未加载');
    }
    var drawerSessionController = drawerSessionControllerFactory.create({
      state: state,
      drawerEl: drawerEl,
      drawerTitleEl: drawerTitleEl,
      drawerFullscreenPort: drawerFullscreenPort,
      drawerScrollLockPort: drawerScrollLockPort,
      workspace: {
        getActiveWorkspaceId: getActiveWorkspaceId,
        getMirrorWorkspaceId: getMirrorWorkspaceId,
        setMirrorWorkspaceSelection: setMirrorWorkspaceSelection,
        hydrateWorkspaceSnapshot: hydrateWorkspaceSnapshot,
        hydrateActiveWorkspaceSnapshot: hydrateActiveWorkspaceSnapshot,
        switchWorkspace: switchWorkspace,
        persistXmindState: persistXmindState,
      },
      view: viewLifecycleController,
      ui: {
        syncOpenButtonState: syncOpenButtonState,
        setDebugState: setDebugState,
        closeSummaryDialog: function(options) { return closeSummaryDialog(options); },
        render: function(options) { return render(options); },
      },
      workflow: {
        createDefaultCaseGenSettings: createDefaultCaseGenSettings,
        setCasesGenModulesView: setCasesGenModulesView,
        hasManagedTaskRestoreContextForWorkspace: function(workspaceId) {
          return hasManagedTaskRestoreContextForWorkspace(workspaceId);
        },
        resetMindCanvasBeforeDrawerOpen: resetMindCanvasBeforeDrawerOpen,
        clearDrawerRestoreRetry: clearDrawerRestoreRetry,
        clearStoreValidationState: clearStoreValidationState,
        isPageSuspending: isPageSuspending,
        destroyMind: destroyMind,
        finalizeLegacyWorkflowRestore: finalizeLegacyWorkflowRestore,
        flushDeferredCasesGenPageRender: flushDeferredCasesGenPageRender,
        persistWorkflowStateNow: persistWorkflowStateNow,
        isDrawerManualCloseSuppressed: isDrawerManualCloseSuppressed,
        markDrawerManualCloseSuppressed: markDrawerManualCloseSuppressed,
        shouldSyncLegacyBeforeOpen: shouldSyncLegacyBeforeOpen,
        syncLegacyWorkflowContext: syncLegacyWorkflowContext,
        clearOpenButtonCompletionNotice: clearOpenButtonCompletionNotice,
        switchTab: switchTab,
      },
      environment: {
        getDrawerInstance: function() { return drawerInstance; },
        setDrawerInstance: function(value) { drawerInstance = value || null; },
        getDrawerOpenRenderTimer: function() { return drawerOpenRenderTimer; },
        setDrawerOpenRenderTimer: function(value) { drawerOpenRenderTimer = Number(value || 0); },
        getDeferredCloseTimer: function() { return deferredDrawerCloseCleanupTimer; },
        setDeferredCloseTimer: function(value) { deferredDrawerCloseCleanupTimer = Number(value || 0); },
        getPendingOpenCenterRoot: function() { return pendingOpenCenterRoot === true; },
        setPendingOpenCenterRoot: function(value) { pendingOpenCenterRoot = value === true; },
        getPendingOpenResetCanvas: function() { return pendingOpenResetCanvas === true; },
        setPendingOpenResetCanvas: function(value) { pendingOpenResetCanvas = value === true; },
        getPendingOpenInstant: function() { return pendingOpenInstant === true; },
        setPendingOpenInstant: function(value) { pendingOpenInstant = value === true; },
        getPendingOpenSkipRestorable: function() { return pendingOpenSkipRestorableViewState === true; },
        setPendingOpenSkipRestorable: function(value) { pendingOpenSkipRestorableViewState = value === true; },
        getPendingOpenForceHydrate: function() { return pendingOpenForceSnapshotHydrate === true; },
        setPendingOpenForceHydrate: function(value) { pendingOpenForceSnapshotHydrate = value === true; },
        getPendingDrawerWorkspaceId: function() { return pendingDrawerOpenWorkspaceId; },
        setPendingDrawerWorkspaceId: function(value) { pendingDrawerOpenWorkspaceId = String(value || ''); },
        isDrawerOpenedViaDomRestore: function() { return drawerOpenedViaDomRestore === true; },
        setDrawerOpenedViaDomRestore: function(value) { drawerOpenedViaDomRestore = value === true; },
        isRestoreDrawerOpenInFlight: function() { return restoreDrawerOpenInFlight === true; },
        setRestoreDrawerOpenInFlight: function(value) { restoreDrawerOpenInFlight = value === true; },
        isDrawerOpen: isDrawerOpen,
        createDrawer: function(options) {
          if (!window.app || !window.app.drawer || typeof window.app.drawer.createDrawer !== 'function') return null;
          return window.app.drawer.createDrawer(options);
        },
      },
      setTimeout: function(handler, delay) { return setTimeout(handler, delay); },
      clearTimeout: function(timerId) { clearTimeout(timerId); },
      now: function() { return Date.now(); },
    });
    var ensureDrawer = drawerSessionController.ensureDrawer;
    var openDrawerShell = drawerSessionController.openDrawerShell;
    var releaseDrawerOpenLayoutState = drawerSessionController.releaseDrawerOpenLayoutState;
    var finalizeDrawerClosedLifecycle = drawerSessionController.finalizeDrawerClosedLifecycle;
    var open = drawerSessionController.open;
    var close = drawerSessionController.close;
    var setDrawerFullscreenState = drawerSessionController.setDrawerFullscreenState;
    var deleteControllerFactory = ctx.deleteControllerFactory
      || (window.app && window.app.xmindCasegenDeleteController
        ? window.app.xmindCasegenDeleteController
        : null);
    if (!deleteControllerFactory || typeof deleteControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenDeleteController 未加载');
    }
    var deleteController = deleteControllerFactory.create({
      state: state,
      deleteUndoBtn: deleteUndoBtn,
      deleteRedoBtn: deleteRedoBtn,
      historyLimit: HISTORY_LIMIT,
      deleteActionId: COMMON_ACTIONS.DELETE,
      cloneJson: cloneJson,
      cloneSelectionMap: cloneSelectionMap,
      restoreSelectionMap: restoreSelectionMap,
      ensureState: ensureState,
      generateLocalId: generateLocalId,
      normalizeModuleKey: normalizeModuleKey,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeCaseTitle: normalizeCaseTitle,
      buildCaseSignature: buildCaseSignature,
      ensureVisibleModuleContext: ensureVisibleModuleContext,
      buildVisibleModuleContext: buildVisibleModuleContext,
      hideOpenMindContextMenu: hideOpenMindContextMenu,
      getConfirmDrawer: function() {
        return window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      },
      confirmFallback: function(message) {
        return typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(message)
          : true;
      },
      rememberDeletedBaselineModule: rememberDeletedBaselineModule,
      rememberDeletedBaselineCase: rememberDeletedBaselineCase,
      getAiCasesForModule: getAiCasesForModule,
      findAiModuleById: findAiModuleById,
      commitCaseList: commitCaseList,
      clearModuleTopupHighlight: clearModuleTopupHighlight,
      invalidateDeleteConflictingSnapshots: invalidateDeleteConflictingSnapshots,
      hasImportedBaselineCases: hasImportedBaselineCases,
      ensureRootUiState: ensureRootUiState,
      syncCasesGenPageRender: syncCasesGenPageRender,
      syncInterruptButton: function() {
        if (typeof syncInterruptButton === 'function') syncInterruptButton();
      },
      notifyStatus: notifyStatus,
      render: function(options) { return render(options); },
      persistXmindState: persistXmindState,
      hasAnyRunningGenerationOperation: hasAnyRunningGenerationOperation,
      now: function() { return Date.now(); },
    });
    var syncDeleteHistoryButtons = deleteController.syncDeleteHistoryButtons;
    var clearDeleteHistoryStacks = deleteController.clearDeleteHistoryStacks;
    var undoLatestDeleteSelection = deleteController.undoLatestDeleteSelection;
    var redoLatestDeleteSelection = deleteController.redoLatestDeleteSelection;
    var isDeleteActionId = deleteController.isDeleteActionId;
    var isDeleteNodeType = deleteController.isDeleteNodeType;
    var buildDeleteTargetKey = deleteController.buildDeleteTargetKey;
    var hasDeleteTargets = deleteController.hasDeleteTargets;
    var removeAiModuleRecord = deleteController.removeAiModuleRecord;
    var handleDeleteSelection = deleteController.handleDeleteSelection;
    var buildDeleteAction = deleteController.buildDeleteAction;
    var resultDeliveryControllerFactory = ctx.resultDeliveryControllerFactory
      || (window.app && window.app.xmindCasegenResultDeliveryController
        ? window.app.xmindCasegenResultDeliveryController
        : null);
    if (!resultDeliveryControllerFactory || typeof resultDeliveryControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenResultDeliveryController 未加载');
    }
    var resultDeliveryController = resultDeliveryControllerFactory.create({
      state: state,
      casesGenApi: casesGenApi,
      documentObj: document,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      normalizeCaseItem: normalizeCaseItem,
      buildCaseSignature: buildCaseSignature,
      buildDeleteTargetKey: buildDeleteTargetKey,
      hasImportedBaselineCases: hasImportedBaselineCases,
      buildVisibleModuleContext: buildVisibleModuleContext,
      getVisibleCasesForModuleEntry: getVisibleCasesForModuleEntry,
      getAiCasesForModule: getAiCasesForModule,
      hasAnyRunningGenerationOperation: hasAnyRunningGenerationOperation,
      notifyFloatingStatus: notifyFloatingStatus,
      notifyStatus: notifyStatus,
      notifySuccessToast: notifySuccessToast,
      render: function(options) { return render(options); },
      isDrawerOpen: isDrawerOpen,
      openStoreConfirmDialog: openStoreConfirmDialog,
      getActiveWorkspaceId: getActiveWorkspaceId,
      resetXmindCasegenState: resetXmindCasegenState,
      deleteWorkspace: deleteWorkspace,
      getXmindCoreApi: getXmindCoreApi,
      getXmindMarkdownExportCoreApi: getXmindMarkdownExportCoreApi,
      getCurrentMindData: function() { return currentMindData || buildMindData(); },
      getRequirementLabelText: getRequirementLabelText,
      buildVisibleModuleSnapshot: buildVisibleModuleSnapshot,
      downloadBlob: typeof core.downloadBlob === 'function'
        ? function(fileName, blob) { core.downloadBlob(fileName, blob); }
        : null,
      downloadText: typeof utils.downloadText === 'function'
        ? function(fileName, content) { utils.downloadText(fileName, content); }
        : null,
      createTextBlob: function(content) {
        return new Blob([content], { type: 'text/markdown;charset=utf-8' });
      },
      setTimeout: function(handler, delay) { return setTimeout(handler, delay); },
      clearTimeout: function(timerId) { clearTimeout(timerId); },
    });
    var clearStoreValidationState = resultDeliveryController.clearStoreValidationState;
    var isInvalidStoreModuleMeta = resultDeliveryController.isInvalidStoreModuleMeta;
    var isInvalidStoreCaseMeta = resultDeliveryController.isInvalidStoreCaseMeta;
    var getStoreValidationSignature = resultDeliveryController.getStoreValidationSignature;
    var handleStoreToLibrary = resultDeliveryController.handleStoreToLibrary;
    var exportCurrentXmind = resultDeliveryController.exportCurrentXmind;
    var exportCurrentMarkdown = resultDeliveryController.exportCurrentMarkdown;
    var resetAfterStoreSuccess = resultDeliveryController.resetAfterStoreSuccess;
    var rootPipelineControllerFactory = ctx.rootPipelineControllerFactory
      || (window.app && window.app.xmindCasegenRootPipelineController
        ? window.app.xmindCasegenRootPipelineController
        : null);
    if (!rootPipelineControllerFactory || typeof rootPipelineControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenRootPipelineController 未加载');
    }
    var rootPipelineController = rootPipelineControllerFactory.create({
      ensureState: ensureState,
      createRootPipelineState: createRootPipelineState,
      mergeRootPipelineSnapshot: mergeRootPipelineSnapshot,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      normalizeFallbackCaseList: normalizeFallbackCaseList,
      normalizeArrayField: normalizeArrayField,
      normalizeHistoryDurationMs: normalizeHistoryDurationMs,
      normalizeHistoryDiagnostics: normalizeHistoryDiagnostics,
      normalizeHistoryDetails: normalizeHistoryDetails,
      ensureVisibleModuleContext: ensureVisibleModuleContext,
      getVisibleCasesForModuleEntry: getVisibleCasesForModuleEntry,
      listManagedXmindTasks: function() {
        return typeof listManagedXmindTasks === 'function' ? listManagedXmindTasks() : [];
      },
      rootActions: ROOT_ACTIONS,
      moduleActions: MODULE_ACTIONS,
      getRootHistoryActionLabel: getRootHistoryActionLabel,
      normalizeDedupeMode: normalizeDedupeMode,
      getDedupeRemovedSummaryText: getDedupeRemovedSummaryText,
      getDedupeNoChangeSummaryText: getDedupeNoChangeSummaryText,
      buildTopupHighlightLabel: buildTopupHighlightLabel,
      buildVisibleModuleContext: buildVisibleModuleContext,
      buildRootPipelineDedupeReadiness: buildRootPipelineDedupeReadiness,
      getDedupeModeFromSettings: getDedupeModeFromSettings,
      startAiDedupeTask: function(options) { return startAiDedupeTask(options); },
      getActiveWorkspaceId: getActiveWorkspaceId,
      getDedupeModeActionText: getDedupeModeActionText,
      notifyStatus: notifyStatus,
      clearRootPendingModules: clearRootPendingModules,
      setAllModuleResultsVisibility: setAllModuleResultsVisibility,
      markOpenButtonCompletionNotice: markOpenButtonCompletionNotice,
      getGenerationFailureLabel: getGenerationFailureLabel,
      getFriendlyRootEmptyModulesText: getFriendlyRootEmptyModulesText,
      recordGenerationHistory: recordGenerationHistory,
      discardCaseGenOperationSnapshotEntry: discardCaseGenOperationSnapshotEntry,
      clearDeleteHistoryStacks: clearDeleteHistoryStacks,
      syncCasesGenPageRender: syncCasesGenPageRender,
      isDrawerOpen: isDrawerOpen,
      queueTerminalMindRender: queueTerminalMindRender,
      persistManagedTaskWorkspaceState: persistManagedTaskWorkspaceState,
    });
    var ensureRootUiState = rootPipelineController.ensureRootUiState;
    var getRootPipelineState = rootPipelineController.getRootPipelineState;
    var setRootPipelineState = rootPipelineController.setRootPipelineState;
    var clearRootPipelineState = rootPipelineController.clearRootPipelineState;
    var updateRootPipelineState = rootPipelineController.updateRootPipelineState;
    var ensureRootPipelineStateFromTask = rootPipelineController.ensureRootPipelineStateFromTask;
    var isTaskInRootPipeline = rootPipelineController.isTaskInRootPipeline;
    var normalizeRootPipelineTaskCount = rootPipelineController.normalizeRootPipelineTaskCount;
    var getRootPipelineModuleTaskCompletionKey = rootPipelineController.getRootPipelineModuleTaskCompletionKey;
    var markRootPipelineModuleTaskCompleted = rootPipelineController.markRootPipelineModuleTaskCompleted;
    var isRootPipelineModulePhaseComplete = rootPipelineController.isRootPipelineModulePhaseComplete;
    var collectRootPipelineRunningTasks = rootPipelineController.collectRootPipelineRunningTasks;
    var isRootPipelineUiActive = rootPipelineController.isRootPipelineUiActive;
    var isRootGenerationVisuallyRunning = rootPipelineController.isRootGenerationVisuallyRunning;
    var serializeRootPipelineDescriptor = rootPipelineController.serializeRootPipelineDescriptor;
    var resolveRootPipelineDescriptor = rootPipelineController.resolveRootPipelineDescriptor;
    var replaceRootPipelinePendingQueue = rootPipelineController.replaceRootPipelinePendingQueue;
    var shiftRootPipelinePendingDescriptor = rootPipelineController.shiftRootPipelinePendingDescriptor;
    var ensureRootPipelineDetailEntry = rootPipelineController.ensureRootPipelineDetailEntry;
    var appendRootPipelineModuleDetail = rootPipelineController.appendRootPipelineModuleDetail;
    var appendRootPipelineDiagnostics = rootPipelineController.appendRootPipelineDiagnostics;
    var normalizeRootPipelineDedupeModule = rootPipelineController.normalizeRootPipelineDedupeModule;
    var normalizeRootPipelineDedupeModules = rootPipelineController.normalizeRootPipelineDedupeModules;
    var hasRootPipelineDedupeCases = rootPipelineController.hasRootPipelineDedupeCases;
    var upsertRootPipelineDedupeModule = rootPipelineController.upsertRootPipelineDedupeModule;
    var mergeRootPipelineDetails = rootPipelineController.mergeRootPipelineDetails;
    var getRootPipelineDetailList = rootPipelineController.getRootPipelineDetailList;
    var countRootPipelineFallbackModules = rootPipelineController.countRootPipelineFallbackModules;
    var buildRootPipelineSuccessMessage = rootPipelineController.buildRootPipelineSuccessMessage;
    var buildRootPipelineModuleHighlightLabel = rootPipelineController.buildRootPipelineModuleHighlightLabel;
    var finalizeRootPipelineIfReady = rootPipelineController.finalizeRootPipelineIfReady;
    var shouldUseRootPipeline = rootPipelineController.shouldUseRootPipeline;
    var buildRootPipelineTaskDescriptors = rootPipelineController.buildRootPipelineTaskDescriptors;
    var taskInputControllerFactory = ctx.taskInputControllerFactory
      || (window.app && window.app.xmindCasegenTaskInputController
        ? window.app.xmindCasegenTaskInputController
        : null);
    if (!taskInputControllerFactory || typeof taskInputControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenTaskInputController 未加载');
    }
    var taskInputController = taskInputControllerFactory.create({
      state: state,
      config: config,
      xmindGenApi: xmindGenApi,
      dedupeStrength: DEDUPE_STRENGTH,
      cloneJson: cloneJson,
      normalizeArrayField: normalizeArrayField,
      normalizeHistoryDiagnostics: normalizeHistoryDiagnostics,
      extractJsonPayloadDetailed: extractJsonPayloadDetailed,
      buildXmindGenerationOptionsSnapshot: buildXmindGenerationOptionsSnapshot,
      isRootFullGenerationContract: isRootFullGenerationContract,
      buildXmindPrompt: buildXmindPrompt,
      buildRequirementPayload: buildRequirementPayload,
      modelSupportsVision: modelSupportsVision,
      getActiveWorkspaceId: getActiveWorkspaceId,
      buildImageContentBlocks: buildImageContentBlocks,
      runKnowledgeBasePipelineForGeneration: runKnowledgeBasePipelineForGeneration,
      getSelectedRequirementSource: getSelectedRequirementSource,
      getPrepState: getPrepState,
      getRequirementLabelText: getRequirementLabelText,
      getXmindCaseDedupeCoreApi: getXmindCaseDedupeCoreApi,
      getXmindDedupeBatchCoreApi: getXmindDedupeBatchCoreApi,
      normalizeDedupeMode: normalizeDedupeMode,
      getDedupeModeFromSettings: getDedupeModeFromSettings,
      getXmindRequirementCoverageCoreApi: getXmindRequirementCoverageCoreApi,
      buildVisibleModuleContext: buildVisibleModuleContext,
      buildVisibleModuleSnapshot: buildVisibleModuleSnapshot,
      getTaskWorkspaceId: function(task) { return getTaskWorkspaceId(task); },
    });
    var evaluateRootCoverageGaps = taskInputController.evaluateRootCoverageGaps;
    var buildRootCoverageRetryTaskPayload = taskInputController.buildRootCoverageRetryTaskPayload;
    var buildCoverageRetryHistoryDiagnostics = taskInputController.buildCoverageRetryHistoryDiagnostics;
    var estimateTaskContentBlocksSize = taskInputController.estimateTaskContentBlocksSize;
    var buildXmindGenerationTaskInput = taskInputController.buildXmindGenerationTaskInput;
    var buildXmindDedupeExecutionInput = taskInputController.buildXmindDedupeExecutionInput;
    var buildCoverageSourceRequest = taskInputController.buildCoverageSourceRequest;
    var buildXmindCoverageTaskInput = taskInputController.buildXmindCoverageTaskInput;
    var inlineToolbarControllerFactory = ctx.inlineToolbarControllerFactory
      || (window.app && window.app.xmindCasegenInlineToolbarController
        ? window.app.xmindCasegenInlineToolbarController
        : null);
    if (!inlineToolbarControllerFactory || typeof inlineToolbarControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenInlineToolbarController 未加载');
    }
    var inlineToolbarController = inlineToolbarControllerFactory.create({
      state: state,
      xmindGenApi: xmindGenApi,
      toolbarEl: toolbarEl,
      summaryBtn: summaryBtn,
      historyBtn: historyBtn,
      knowledgeRuleBtn: knowledgeRuleBtn,
      knowledgeAiBtn: knowledgeAiBtn,
      dedupeBtn: dedupeBtn,
      coverageBtn: coverageBtn,
      storeBtn: storeBtn,
      interruptBtn: interruptBtn,
      deleteUndoBtn: deleteUndoBtn,
      deleteRedoBtn: deleteRedoBtn,
      exportBtn: exportBtn,
      exportMarkdownBtn: exportMarkdownBtn,
      statusEl: statusEl,
      mindContainer: mindContainer,
      documentObj: document,
      dedupeActionId: DEDUPE_ACTION_ID,
      escapeHtml: escapeHtml,
      getViewState: getViewState,
      ensureDedupeUiState: ensureDedupeUiState,
      ensureCoverageUiState: ensureCoverageUiState,
      buildVisibleModuleContext: buildVisibleModuleContext,
      getVisibleCasesForModuleEntry: getVisibleCasesForModuleEntry,
      collectRunningGenerationOperations: collectRunningGenerationOperations,
      getRootPipelineState: getRootPipelineState,
      getDedupeModeFromSettings: getDedupeModeFromSettings,
      normalizeDedupeMode: normalizeDedupeMode,
      getDedupeModeActionText: getDedupeModeActionText,
      getDedupeRunningLabel: getDedupeRunningLabel,
      getDedupeRunningHint: getDedupeRunningHint,
      hasAnyRunningGenerationOperation: hasAnyRunningGenerationOperation,
      hasVisibleAiCasesForDedupe: hasVisibleAiCasesForDedupe,
      hasActiveWorkspace: hasActiveWorkspace,
      getSelectedRequirementSource: getSelectedRequirementSource,
      isCoverageDialogOpen: function() {
        return summaryDialogController.isModeOpen('coverage');
      },
      isManualDedupeConfirming: function() { return pendingManualDedupeConfirm === true; },
      syncDeleteHistoryButtons: syncDeleteHistoryButtons,
      syncKnowledgeBaseToolbarState: syncKnowledgeBaseToolbarState,
      syncHistoryButtonState: syncHistoryButtonState,
      persistXmindState: persistXmindState,
      persistWorkflowStateNow: persistWorkflowStateNow,
      notifySuccessToast: notifySuccessToast,
      now: function() { return Date.now(); },
    });
    var restoreInlineControlsToBank = inlineToolbarController.restoreInlineControlsToBank;
    var syncInlineToolbarOverview = inlineToolbarController.syncInlineToolbarOverview;
    var mountInlineControls = inlineToolbarController.mountInlineControls;
    var syncInterruptButton = inlineToolbarController.syncInterruptButton;
    var syncDedupeToolbarButton = inlineToolbarController.syncDedupeToolbarButton;
    var taskRequestControllerFactory = ctx.taskRequestControllerFactory
      || (window.app && window.app.xmindCasegenTaskRequestController
        ? window.app.xmindCasegenTaskRequestController
        : null);
    if (!taskRequestControllerFactory || typeof taskRequestControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenTaskRequestController 未加载');
    }
    var taskRequestController = taskRequestControllerFactory.create({
      dedupeActionId: DEDUPE_ACTION_ID,
      coverageActionId: COVERAGE_ACTION_ID,
      dedupeStrength: DEDUPE_STRENGTH,
      cloneJson: cloneJson,
      getActiveWorkspaceId: getActiveWorkspaceId,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeFallbackCaseList: normalizeFallbackCaseList,
      normalizeDedupeMode: normalizeDedupeMode,
      isDedupeSimplifyMode: isDedupeSimplifyMode,
      buildManagedTaskRestoreContext: function(options) {
        return buildManagedTaskRestoreContext(options);
      },
      getXmindTaskManager: getXmindTaskManager,
    });
    var buildManagedTaskRequestEnvelope = taskRequestController.buildManagedTaskRequestEnvelope;
    var buildRootTaskPayload = taskRequestController.buildRootTaskPayload;
    var buildModuleTaskPayload = taskRequestController.buildModuleTaskPayload;
    var buildDedupeTaskPayload = taskRequestController.buildDedupeTaskPayload;
    var buildCoverageTaskPayload = taskRequestController.buildCoverageTaskPayload;
    var startManagedXmindTask = taskRequestController.startManagedXmindTask;
    var taskRuntimeControllerFactory = ctx.taskRuntimeControllerFactory
      || (window.app && window.app.xmindCasegenTaskRuntimeController
        ? window.app.xmindCasegenTaskRuntimeController
        : null);
    if (!taskRuntimeControllerFactory || typeof taskRuntimeControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenTaskRuntimeController 未加载');
    }
    var taskRuntimeController = taskRuntimeControllerFactory.create({
      rootActions: ROOT_ACTIONS,
      moduleActions: MODULE_ACTIONS,
      dedupeActionId: DEDUPE_ACTION_ID,
      ensureRootUiState: ensureRootUiState,
      ensureDedupeUiState: ensureDedupeUiState,
      ensureCoverageUiState: ensureCoverageUiState,
      clearRootPendingModules: clearRootPendingModules,
      setAllModuleResultsVisibility: setAllModuleResultsVisibility,
      ensureState: ensureState,
      ensureModuleUiState: ensureModuleUiState,
      syncInterruptButton: syncInterruptButton,
      getRootPipelineState: getRootPipelineState,
      ensureRootPipelineStateFromTask: ensureRootPipelineStateFromTask,
      collectRootPipelineRunningTasks: collectRootPipelineRunningTasks,
      isRootPipelineUiActive: isRootPipelineUiActive,
      setModuleRootPendingAction: setModuleRootPendingAction,
      markRootPendingModules: markRootPendingModules,
      buildVisibleModuleContext: buildVisibleModuleContext,
      normalizeDedupeMode: normalizeDedupeMode,
      ensureVisibleModuleContext: ensureVisibleModuleContext,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      findAiModuleById: findAiModuleById,
      getAiCasesForModule: getAiCasesForModule,
      getRootNodeId: getRootNodeId,
      getModuleNodeId: getModuleNodeId,
      buildModuleNodeId: buildModuleNodeId,
      normalizeArrayField: normalizeArrayField,
      now: function() { return Date.now(); },
    });
    var clearManagedTaskRunningUiProjection = taskRuntimeController.clearManagedTaskRunningUiProjection;
    var applyRootPipelineRunningUiProjection = taskRuntimeController.applyRootPipelineRunningUiProjection;
    var isRunningTaskStructuralRenderRequired = taskRuntimeController.isRunningTaskStructuralRenderRequired;
    var shouldRenderRunningTasksStructurally = taskRuntimeController.shouldRenderRunningTasksStructurally;
    var applyManagedTaskRunningUiProjection = taskRuntimeController.applyManagedTaskRunningUiProjection;
    var getTaskErrorMessage = taskRuntimeController.getTaskErrorMessage;
    var buildGenerationCancelledInfo = taskRuntimeController.buildGenerationCancelledInfo;
    var shouldSuppressTaskCancelToast = taskRuntimeController.shouldSuppressTaskCancelToast;
    var resolveTaskModuleEntry = taskRuntimeController.resolveTaskModuleEntry;
    var getManagedTaskAnchorNodeId = taskRuntimeController.getManagedTaskAnchorNodeId;
    var cloneModulesWithoutCases = taskRuntimeController.cloneModulesWithoutCases;
    var analysisTaskControllerFactory = ctx.analysisTaskControllerFactory
      || (window.app && window.app.xmindCasegenAnalysisTaskController
        ? window.app.xmindCasegenAnalysisTaskController
        : null);
    if (!analysisTaskControllerFactory || typeof analysisTaskControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenAnalysisTaskController 未加载');
    }
    var analysisTaskController = analysisTaskControllerFactory.create({
      dedupeActionId: DEDUPE_ACTION_ID,
      dedupeModeOnly: DEDUPE_MODE_ONLY,
      dedupeMinVisibleMs: DEDUPE_MIN_VISIBLE_MS,
      dedupeTerminalGraceMs: DEDUPE_TERMINAL_GRACE_MS,
      dedupeTerminalVisualMs: DEDUPE_TERMINAL_VISUAL_MS,
      cloneJson: cloneJson,
      normalizeDedupeMode: normalizeDedupeMode,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      normalizeCaseItem: normalizeCaseItem,
      normalizeHistoryDiagnostics: normalizeHistoryDiagnostics,
      normalizeHistoryDedupeRecords: normalizeHistoryDedupeRecords,
      normalizeHistoryDurationMs: normalizeHistoryDurationMs,
      ensureDedupeUiState: ensureDedupeUiState,
      ensureCoverageUiState: ensureCoverageUiState,
      ensureRootUiState: ensureRootUiState,
      ensureModuleUiState: ensureModuleUiState,
      syncInterruptButton: syncInterruptButton,
      hasAnyRunningGenerationOperation: hasAnyRunningGenerationOperation,
      buildCoverageSourceRequest: buildCoverageSourceRequest,
      buildXmindCoverageTaskInput: buildXmindCoverageTaskInput,
      buildCoverageTaskPayload: buildCoverageTaskPayload,
      buildXmindDedupeExecutionInput: buildXmindDedupeExecutionInput,
      buildDedupeTaskPayload: buildDedupeTaskPayload,
      startManagedXmindTask: startManagedXmindTask,
      getActiveWorkspaceId: getActiveWorkspaceId,
      collectCurrentAiDedupeModules: collectCurrentAiDedupeModules,
      getDedupeModeFromSettings: getDedupeModeFromSettings,
      syncInlineToolbarOverview: syncInlineToolbarOverview,
      updateRootPipelineState: updateRootPipelineState,
      isDrawerOpen: isDrawerOpen,
      queueStatusMindRender: queueStatusMindRender,
      queueTerminalMindRender: queueTerminalMindRender,
      getRootNodeId: getRootNodeId,
      notifyStatus: notifyStatus,
      notifyFloatingStatus: notifyFloatingStatus,
      persistManagedTaskWorkspaceState: persistManagedTaskWorkspaceState,
      persistXmindState: persistXmindState,
      syncTerminalTaskRestoreContext: function(task) { return syncTerminalTaskRestoreContext(task); },
      getXmindCaseDedupeCoreApi: getXmindCaseDedupeCoreApi,
      getXmindDedupeBatchCoreApi: getXmindDedupeBatchCoreApi,
      getXmindRequirementCoverageCoreApi: getXmindRequirementCoverageCoreApi,
      getDedupeExecutionDiagnosticText: getDedupeExecutionDiagnosticText,
      getTaskErrorMessage: getTaskErrorMessage,
      buildGenerationCancelledInfo: buildGenerationCancelledInfo,
      buildGenerationErrorInfo: buildGenerationErrorInfo,
      shouldSuppressTaskCancelToast: shouldSuppressTaskCancelToast,
      commitCaseList: commitCaseList,
      clearModuleTopupHighlight: clearModuleTopupHighlight,
      clearDeleteHistoryStacks: clearDeleteHistoryStacks,
      saveActiveWorkspaceSnapshot: saveActiveWorkspaceSnapshot,
      renderWorkspaceTabs: renderWorkspaceTabs,
      syncCasesGenPageRender: syncCasesGenPageRender,
      appendRootPipelineDiagnostics: appendRootPipelineDiagnostics,
      recordGenerationHistory: recordGenerationHistory,
      clearCoverageHighlightedCase: function() { return clearCoverageHighlightedCase(); },
      isCoverageDialogOpen: function() {
        return summaryDialogController.isModeOpen('coverage');
      },
      renderCoverageDialog: function(options) { return renderCoverageDialog(options); },
    });
    var clearDedupeOverviewSummary = analysisTaskController.clearDedupeOverviewSummary;
    var setDedupeRunningState = analysisTaskController.setDedupeRunningState;
    var clearDedupeRunningState = analysisTaskController.clearDedupeRunningState;
    var scheduleDedupeTerminalVisualState = analysisTaskController.scheduleDedupeTerminalVisualState;
    var waitForDedupeMinVisibleDuration = analysisTaskController.waitForDedupeMinVisibleDuration;
    var showTerminalDedupeRunningState = analysisTaskController.showTerminalDedupeRunningState;
    var setCoverageRunningState = analysisTaskController.setCoverageRunningState;
    var clearCoverageRunningState = analysisTaskController.clearCoverageRunningState;
    var startRequirementCoverageTask = analysisTaskController.startRequirementCoverageTask;
    var startAiDedupeTask = analysisTaskController.startAiDedupeTask;
    var buildDedupeHistoryDetails = analysisTaskController.buildDedupeHistoryDetails;
    var buildDedupeDetailMap = analysisTaskController.buildDedupeDetailMap;
    var normalizeManagedDedupeTaskResult = analysisTaskController.normalizeManagedDedupeTaskResult;
    var completeDedupeTaskSuccess = analysisTaskController.completeDedupeTaskSuccess;
    var completeDedupeTaskError = analysisTaskController.completeDedupeTaskError;
    var completeCoverageTaskSuccess = analysisTaskController.completeCoverageTaskSuccess;
    var completeCoverageTaskError = analysisTaskController.completeCoverageTaskError;
    var coverageDialogControllerFactory = ctx.coverageDialogControllerFactory
      || (window.app && window.app.xmindCasegenCoverageDialogController
        ? window.app.xmindCasegenCoverageDialogController
        : null);
    if (!coverageDialogControllerFactory || typeof coverageDialogControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenCoverageDialogController 未加载');
    }
    var coverageDialogController = coverageDialogControllerFactory.create({
      summaryDialogBodyEl: summaryDialogBodyEl,
      coverageBtn: coverageBtn,
      escapeHtml: escapeHtml,
      ensureCoverageUiState: ensureCoverageUiState,
      buildCoverageSourceRequest: buildCoverageSourceRequest,
      getSelectedRequirementSource: getSelectedRequirementSource,
      getCoverageCaseTooltipCore: function() {
        if (coverageCaseTooltipCore) return coverageCaseTooltipCore;
        return window.app && window.app.xmindCoverageCaseTooltipCore
          ? window.app.xmindCoverageCaseTooltipCore
          : null;
      },
      persistXmindState: persistXmindState,
      hasActiveWorkspace: hasActiveWorkspace,
      notifyFloatingStatus: notifyFloatingStatus,
      collectRunningGenerationOperations: collectRunningGenerationOperations,
      notifyStatus: notifyStatus,
      hideOpenMindContextMenu: hideOpenMindContextMenu,
      openCoverageDialogShell: summaryDialogController.openCoverageShell,
      isCoverageDialogOpen: function() {
        return summaryDialogController.isModeOpen('coverage');
      },
      closeSummaryDialog: function(options) { return closeSummaryDialog(options); },
      startRequirementCoverageTask: function(options) {
        return startRequirementCoverageTask(options);
      },
    });
    var openCoverageDialog = coverageDialogController.openCoverageDialog;
    var renderCoverageDialog = coverageDialogController.renderCoverageDialog;
    var hideCoverageCaseDetailTooltip = coverageDialogController.hideCoverageCaseDetailTooltip;
    var releaseCoverageRequirementImageObjectUrls = coverageDialogController.releaseCoverageRequirementImageObjectUrls;
    var clearCoverageHighlightedCase = coverageDialogController.clearHighlightedCase;
    var generationCompletionControllerFactory = ctx.generationCompletionControllerFactory
      || (window.app && window.app.xmindCasegenGenerationCompletionController
        ? window.app.xmindCasegenGenerationCompletionController
        : null);
    if (!generationCompletionControllerFactory || typeof generationCompletionControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenGenerationCompletionController 未加载');
    }
    var generationCompletionController = generationCompletionControllerFactory.create({
      rootActions: ROOT_ACTIONS,
      moduleActions: MODULE_ACTIONS,
      cloneJson: cloneJson,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      normalizeFallbackCaseList: normalizeFallbackCaseList,
      normalizeUniqueStringList: normalizeUniqueStringList,
      normalizeHistoryDiagnostics: normalizeHistoryDiagnostics,
      summarizeModelOutputText: summarizeModelOutputText,
      createOperationContract: createOperationContract,
      normalizeModelModulesOutputDetailed: normalizeModelModulesOutputDetailed,
      filterModulesByContract: filterModulesByContract,
      buildVisibleModuleContext: buildVisibleModuleContext,
      ensureVisibleModuleContext: ensureVisibleModuleContext,
      evaluateRootCoverageGaps: evaluateRootCoverageGaps,
      tryStartRootCoverageRetry: tryStartRootCoverageRetry,
      applyRootOutput: applyRootOutput,
      buildCoverageRetryHistoryDiagnostics: buildCoverageRetryHistoryDiagnostics,
      buildRootNoChangeInfo: buildRootNoChangeInfo,
      buildModuleNoChangeInfo: buildModuleNoChangeInfo,
      resolveModuleTaskResult: resolveModuleTaskResult,
      ensureRootPipelineStateFromTask: ensureRootPipelineStateFromTask,
      ensureRootUiState: ensureRootUiState,
      ensureModuleUiState: ensureModuleUiState,
      getManagedTaskAnchorNodeId: getManagedTaskAnchorNodeId,
      updateRootPipelineState: updateRootPipelineState,
      buildRootPipelineTaskDescriptors: buildRootPipelineTaskDescriptors,
      cloneModulesWithoutCases: cloneModulesWithoutCases,
      getTaskModelRequestDurationMs: getTaskModelRequestDurationMs,
      normalizeRootPipelineDedupeModules: normalizeRootPipelineDedupeModules,
      appendRootPipelineDiagnostics: appendRootPipelineDiagnostics,
      mergeRootPipelineDetails: mergeRootPipelineDetails,
      normalizeRootPipelineTaskCount: normalizeRootPipelineTaskCount,
      getRootPipelineState: getRootPipelineState,
      startRootPipelineModuleTasks: function(pipeline, descriptors, options) {
        return startRootPipelineModuleTasks(pipeline, descriptors, options);
      },
      getTaskWorkspaceId: function(task) { return getTaskWorkspaceId(task); },
      finalizeRootPipelineIfReady: finalizeRootPipelineIfReady,
      resolveTaskModuleEntry: resolveTaskModuleEntry,
      getAiCasesForModule: getAiCasesForModule,
      commitCaseList: commitCaseList,
      setModuleTopupHighlight: setModuleTopupHighlight,
      buildRootPipelineModuleHighlightLabel: buildRootPipelineModuleHighlightLabel,
      removeAiModuleRecord: removeAiModuleRecord,
      clearModuleTopupHighlight: clearModuleTopupHighlight,
      clearModuleRootPendingAction: clearModuleRootPendingAction,
      upsertRootPipelineDedupeModule: upsertRootPipelineDedupeModule,
      appendRootPipelineModuleDetail: appendRootPipelineModuleDetail,
      markRootPipelineModuleTaskCompleted: markRootPipelineModuleTaskCompleted,
      getTaskErrorMessage: getTaskErrorMessage,
      buildGenerationCancelledInfo: buildGenerationCancelledInfo,
      buildGenerationErrorInfo: buildGenerationErrorInfo,
      formatHistoryDuration: formatHistoryDuration,
      clearDeleteHistoryStacks: clearDeleteHistoryStacks,
      syncCasesGenPageRender: syncCasesGenPageRender,
      isDrawerOpen: isDrawerOpen,
      queueTerminalMindRender: queueTerminalMindRender,
      flushQueuedMindRender: flushQueuedMindRender,
      syncTerminalTaskRestoreContext: function(task) { return syncTerminalTaskRestoreContext(task); },
      persistManagedTaskWorkspaceState: persistManagedTaskWorkspaceState,
      markOpenButtonCompletionNotice: markOpenButtonCompletionNotice,
      clearRootPendingModules: clearRootPendingModules,
      recordGenerationHistory: recordGenerationHistory,
      discardCaseGenOperationSnapshotEntry: discardCaseGenOperationSnapshotEntry,
      rollbackCaseGenOperationSnapshotEntry: rollbackCaseGenOperationSnapshotEntry,
      setAllModuleResultsVisibility: setAllModuleResultsVisibility,
      notifyStatus: notifyStatus,
      notifyFloatingStatus: notifyFloatingStatus,
      getRootHistoryActionLabel: getRootHistoryActionLabel,
      getModuleHistoryActionLabel: getModuleHistoryActionLabel,
      getGenerationFailureLabel: getGenerationFailureLabel,
      shouldSuppressTaskCancelToast: shouldSuppressTaskCancelToast,
      ensureState: ensureState,
    });
    var completeRootTaskSuccess = generationCompletionController.completeRootTaskSuccess;
    var completeRootTaskError = generationCompletionController.completeRootTaskError;
    var completeModuleTaskSuccess = generationCompletionController.completeModuleTaskSuccess;
    var completeModuleTaskError = generationCompletionController.completeModuleTaskError;
    var generationExecutionControllerFactory = ctx.generationExecutionControllerFactory
      || (window.app && window.app.xmindCasegenGenerationExecutionController
        ? window.app.xmindCasegenGenerationExecutionController
        : null);
    if (!generationExecutionControllerFactory || typeof generationExecutionControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenGenerationExecutionController 未加载');
    }
    var generationExecutionController = generationExecutionControllerFactory.create({
      rootActions: ROOT_ACTIONS,
      moduleActions: MODULE_ACTIONS,
      casesGenApi: casesGenApi,
      cloneJson: cloneJson,
      getActiveWorkspaceId: getActiveWorkspaceId,
      getRootNodeId: getRootNodeId,
      getModuleNodeId: getModuleNodeId,
      generateLocalId: generateLocalId,
      createCaseGenOperationSnapshotLocal: createCaseGenOperationSnapshotLocal,
      snapshotAllCaseGenStateLocal: snapshotAllCaseGenStateLocal,
      rollbackAllCaseGenStateLocal: rollbackAllCaseGenStateLocal,
      getLatestCaseGenOperationSnapshotLocal: getLatestCaseGenOperationSnapshotLocal,
      rollbackCaseGenOperationSnapshotLocal: rollbackCaseGenOperationSnapshotLocal,
      ensureAiModuleRecord: ensureAiModuleRecord,
      ensureRootUiState: ensureRootUiState,
      ensureModuleUiState: ensureModuleUiState,
      ensureState: ensureState,
      hasAiCasesForModule: hasAiCasesForModule,
      hasAnyAiModules: hasAnyAiModules,
      hasAnyAiCases: hasAnyAiCases,
      getModuleHistoryActionLabel: getModuleHistoryActionLabel,
      getRootHistoryActionLabel: getRootHistoryActionLabel,
      clearModuleTopupHighlight: clearModuleTopupHighlight,
      clearAllTopupHighlights: clearAllTopupHighlights,
      clearDedupeOverviewSummary: clearDedupeOverviewSummary,
      setModuleRootPendingAction: setModuleRootPendingAction,
      clearDeleteHistoryStacks: clearDeleteHistoryStacks,
      setAllModuleResultsVisibility: setAllModuleResultsVisibility,
      markRootPendingModules: markRootPendingModules,
      flushLightweightMindStatus: flushLightweightMindStatus,
      scheduleRenderedRootMindStatusBadgeRefresh: scheduleRenderedRootMindStatusBadgeRefresh,
      queueStructureMindRender: queueStructureMindRender,
      queueStatusMindRender: queueStatusMindRender,
      render: function(options) { return render(options); },
      notifyStatus: notifyStatus,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeFallbackCaseList: normalizeFallbackCaseList,
      normalizeUniqueStringList: normalizeUniqueStringList,
      buildVisibleModuleContext: buildVisibleModuleContext,
      ensureVisibleModuleContext: ensureVisibleModuleContext,
      buildVisibleModuleSnapshot: buildVisibleModuleSnapshot,
      getGenerationPayloadCore: function() {
        return window.app && window.app.xmindGenerationPayloadCore
          ? window.app.xmindGenerationPayloadCore
          : null;
      },
      createOperationContract: createOperationContract,
      applyImportedBaselineCompletionPolicy: applyImportedBaselineCompletionPolicy,
      applyExistingCasesCompletionPolicy: applyExistingCasesCompletionPolicy,
      buildXmindGenerationTaskInput: buildXmindGenerationTaskInput,
      buildModuleTaskPayload: buildModuleTaskPayload,
      buildRootTaskPayload: buildRootTaskPayload,
      startManagedXmindTask: startManagedXmindTask,
      persistXmindState: persistXmindState,
      completeModuleTaskError: completeModuleTaskError,
      completeRootTaskError: completeRootTaskError,
      createRootPipelineState: createRootPipelineState,
      getRootPipelineState: getRootPipelineState,
      setRootPipelineState: setRootPipelineState,
      clearRootPipelineState: clearRootPipelineState,
      updateRootPipelineState: updateRootPipelineState,
      replaceRootPipelinePendingQueue: replaceRootPipelinePendingQueue,
      shiftRootPipelinePendingDescriptor: shiftRootPipelinePendingDescriptor,
      resolveRootPipelineDescriptor: resolveRootPipelineDescriptor,
      collectRootPipelineRunningTasks: collectRootPipelineRunningTasks,
      appendRootPipelineDiagnostics: appendRootPipelineDiagnostics,
      normalizeRootPipelineTaskCount: normalizeRootPipelineTaskCount,
      runConcurrentTasks: runConcurrentTasks,
      shouldUseRootPipeline: shouldUseRootPipeline,
      ensureActionAllowed: ensureActionAllowed,
      ensurePrepReadyOrOpen: ensurePrepReadyOrOpen,
      hideOpenMindContextMenu: hideOpenMindContextMenu,
      isDeleteActionId: isDeleteActionId,
      handleDeleteSelection: handleDeleteSelection,
      resolveModuleEntryByMeta: resolveModuleEntryByMeta,
    });
    var startManagedModuleTask = generationExecutionController.startManagedModuleTask;
    var pumpRootPipelineModuleQueue = generationExecutionController.pumpRootPipelineModuleQueue;
    var startRootPipelineModuleTasks = generationExecutionController.startRootPipelineModuleTasks;
    var startRootPipeline = generationExecutionController.startRootPipeline;
    var runRootAction = generationExecutionController.runRootAction;
    var runModuleAction = generationExecutionController.runModuleAction;
    var handleNodeAction = generationExecutionController.handleNodeAction;
    var rootPipelineTailRescueControllerFactory = ctx.rootPipelineTailRescueControllerFactory
      || (window.app && window.app.xmindCasegenRootPipelineTailRescueController
        ? window.app.xmindCasegenRootPipelineTailRescueController
        : null);
    if (!rootPipelineTailRescueControllerFactory || typeof rootPipelineTailRescueControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenRootPipelineTailRescueController 未加载');
    }
    var rootPipelineTailRescueController = rootPipelineTailRescueControllerFactory.create({
      fullCasesActionId: ROOT_ACTIONS.FULL_CASES,
      getTaskManager: getXmindTaskManager,
      getTimingCore: getXmindGenerationTimingCoreApi,
      listManagedTasks: function() {
        return typeof listManagedXmindTasks === 'function' ? listManagedXmindTasks() : [];
      },
      getRootPipelineState: getRootPipelineState,
      normalizeModuleTitle: normalizeModuleTitle,
      normalizeModuleKey: normalizeModuleKey,
      normalizeHistoryDurationMs: normalizeHistoryDurationMs,
      normalizeRootPipelineTaskCount: normalizeRootPipelineTaskCount,
      normalizeFallbackCaseList: normalizeFallbackCaseList,
      estimateTaskContentBlocksSize: estimateTaskContentBlocksSize,
      getConfiguredTimeoutSec: getConfiguredXmindTimeoutSec,
      now: function() { return Date.now(); },
    });
    var maybeRescueRootPipelineTailRequest = rootPipelineTailRescueController.maybeRescue;
    var managedTaskControllerFactory = ctx.managedTaskControllerFactory
      || (window.app && window.app.xmindCasegenManagedTaskController
        ? window.app.xmindCasegenManagedTaskController
        : null);
    if (!managedTaskControllerFactory || typeof managedTaskControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenManagedTaskController 未加载');
    }
    var managedTaskController = managedTaskControllerFactory.create({
      cloneJson: cloneJson,
      mergeTaskRestoreContext: mergeTaskRestoreContext,
      mergeStoredViewState: mergeStoredViewState,
      createDefaultPrepState: createDefaultPrepState,
      createDefaultViewState: createDefaultViewState,
      createDefaultRootState: createDefaultRootState,
      createDefaultCaseGenSettings: createDefaultCaseGenSettings,
      createEmptyRequirementMedia: createEmptyRequirementMedia,
      normalizeStoredViewState: normalizeStoredViewState,
      normalizeWorkspaceSharedState: normalizeWorkspaceSharedState,
      normalizeWorkspaceSnapshot: normalizeWorkspaceSnapshot,
      createInitialXmindState: createInitialXmindState,
      createEmptyWorkspaceSharedState: createEmptyWorkspaceSharedState,
      cloneModulesWithoutCases: cloneModulesWithoutCases,
      buildCompactRootPipelineRestoreSnapshot: buildCompactRootPipelineRestoreSnapshot,
      cloneRootPipelineSnapshot: cloneRootPipelineSnapshot,
      getWorkflowReady: function() {
        return Boolean(window.app && window.app.__tapWorkflowReady === true);
      },
      getTaskManager: getXmindTaskManager,
      getRecoveryCore: getWorkspaceRecoveryCore,
      getActiveWorkspaceId: getActiveWorkspaceId,
      getWorkspaceRecord: getWorkspaceRecord,
      ensureWorkspaceRecordForTask: ensureWorkspaceRecordForManagedTask,
      captureActiveRestoreContext: captureActiveManagedTaskRestoreContext,
      shouldApplyLiveRestore: shouldXmindOwnLiveWorkspaceState,
      applyLiveRestoreContext: applyManagedTaskLiveRestoreContext,
      onWorkspaceRecordsRestored: handleManagedTaskWorkspaceRecordsRestored,
      getWorkspaceShadowDepth: getWorkspaceShadowDepth,
      clearRunningUiState: clearManagedTaskRunningUiProjection,
      applyRunningUiTask: applyManagedTaskRunningUiProjection,
      applyRootPipelineRunningUiState: applyRootPipelineRunningUiProjection,
      shouldRenderRunningTasksStructurally: shouldRenderRunningTasksStructurally,
      syncInterruptButton: syncInterruptButton,
      renderWorkspaceTabs: renderWorkspaceTabs,
      persistManagedTaskWorkspaceState: persistManagedTaskWorkspaceState,
      isDrawerOpen: isDrawerOpen,
      queueStructureRender: queueStructureMindRender,
      queueStatusRender: queueStatusMindRender,
      runInWorkspaceContextNow: runInWorkspaceContextNow,
      showTerminalDedupeRunningState: showTerminalDedupeRunningState,
      waitForDedupeMinVisibleDuration: waitForDedupeMinVisibleDuration,
      completeCoverageTaskSuccess: completeCoverageTaskSuccess,
      completeDedupeTaskSuccess: completeDedupeTaskSuccess,
      completeRootTaskSuccess: completeRootTaskSuccess,
      completeModuleTaskSuccess: completeModuleTaskSuccess,
      completeCoverageTaskError: completeCoverageTaskError,
      completeDedupeTaskError: completeDedupeTaskError,
      completeRootTaskError: completeRootTaskError,
      completeModuleTaskError: completeModuleTaskError,
      pumpRootPipelineModuleQueue: pumpRootPipelineModuleQueue,
      finalizeRootPipelineIfReady: finalizeRootPipelineIfReady,
      getManagedTaskAnchorNodeId: getManagedTaskAnchorNodeId,
      getRootPipelineState: getRootPipelineState,
      updateRootPipelineState: updateRootPipelineState,
      getRootNodeId: getRootNodeId,
      addTaskEventListener: function(handler) {
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('xmind-casegen-task', handler);
        }
      },
      maybeRescueRootPipelineTailRequest: maybeRescueRootPipelineTailRequest,
      notifyFloatingStatus: notifyFloatingStatus,
      logConsumeError: function(task, err) {
        if (typeof console === 'undefined' || !console || typeof console.error !== 'function') return;
        console.error('XMind managed task consume failed', {
          taskId: task && task.id ? String(task.id || '') : '',
          scope: task && task.scope ? String(task.scope || '') : '',
          actionId: task && task.actionId ? String(task.actionId || '') : '',
          workspaceId: getTaskWorkspaceId(task),
          error: err && err.stack ? String(err.stack || '') : String(err && err.message ? err.message : err || ''),
        });
      },
    });
    var isManagedTaskTerminal = managedTaskController.isManagedTaskTerminal;
    var getManagedXmindTaskListIfReady = managedTaskController.getManagedXmindTaskListIfReady;
    var listManagedXmindTasks = managedTaskController.listManagedXmindTasks;
    var getTaskWorkspaceId = managedTaskController.getTaskWorkspaceId;
    var filterTasksByWorkspace = managedTaskController.filterTasksByWorkspace;
    var getManagedTaskRestoreDecision = managedTaskController.getManagedTaskRestoreDecision;
    var filterRestorableManagedTasks = managedTaskController.filterRestorableManagedTasks;
    var syncManagedRunningUiState = managedTaskController.syncManagedRunningUiState;
    var enrichWorkspaceRestoreContext = managedTaskController.enrichWorkspaceRestoreContext;
    var buildManagedTaskRestoreContext = managedTaskController.buildManagedTaskRestoreContext;
    var syncRunningTaskRestoreContexts = managedTaskController.syncRunningTaskRestoreContexts;
    var syncManagedTaskRestoreContexts = managedTaskController.syncManagedTaskRestoreContexts;
    var syncTerminalTaskRestoreContext = managedTaskController.syncTerminalTaskRestoreContext;
    var buildMergedManagedTaskRestoreContext = managedTaskController.buildMergedManagedTaskRestoreContext;
    var markRestoreContextRootPipelineRestoredAfterRefresh = managedTaskController.markRestoreContextRootPipelineRestoredAfterRefresh;
    var markRunningTaskRestoreContextsRestoredAfterRefresh = managedTaskController.markRunningTaskRestoreContextsRestoredAfterRefresh;
    var buildRestoreContextFromWorkspaceSnapshot = managedTaskController.buildRestoreContextFromWorkspaceSnapshot;
    var applyRestoreContextToWorkspaceRecord = managedTaskController.applyRestoreContextToWorkspaceRecord;
    var restoreWorkflowContextFromManagedTasks = managedTaskController.restoreWorkflowContextFromManagedTasks;
    var runInWorkspaceContext = managedTaskController.runInWorkspaceContext;
    var consumeManagedXmindTask = managedTaskController.consumeManagedXmindTask;
    var consumeManagedTerminalTasks = managedTaskController.consumeManagedTerminalTasks;
    var reconcileManagedXmindTasks = managedTaskController.reconcileManagedXmindTasks;
    var scheduleManagedTaskReconcile = managedTaskController.scheduleManagedTaskReconcile;
    var bindManagedXmindTasks = managedTaskController.bindManagedXmindTasks;
    var interruptRunningXmindTasks = managedTaskController.interruptRunningXmindTasks;
    var mindRendererControllerFactory = ctx.mindRendererControllerFactory
      || (window.app && window.app.xmindCasegenMindRendererController
        ? window.app.xmindCasegenMindRendererController
        : null);
    if (!mindRendererControllerFactory || typeof mindRendererControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenMindRendererController 未加载');
    }
    var mindRendererController = mindRendererControllerFactory.create({
      mindContainer: mindContainer,
      toolbarEl: toolbarEl,
      document: document,
      escapeHtml: escapeHtml,
      normalizeModuleKey: normalizeModuleKey,
      isDeleteNodeType: isDeleteNodeType,
      buildDeleteTargetKey: buildDeleteTargetKey,
      isInvalidStoreModuleMeta: isInvalidStoreModuleMeta,
      isInvalidStoreCaseMeta: isInvalidStoreCaseMeta,
      getTopupHighlightMapElement: getTopupHighlightMapElement,
      getTopupHighlightViewerElement: getTopupHighlightViewerElement,
      setTimer: function(handler, delay) { return setTimeout(handler, delay); },
      cleanupTopupHighlightPresentation: cleanupTopupHighlightPresentation,
      restoreInlineControlsToBank: restoreInlineControlsToBank,
      getWorkspaceShadowDepth: getWorkspaceShadowDepth,
      persistXmindState: function(immediate) { return persistXmindState(immediate); },
      setDebugState: setDebugState,
      updateSummary: updateSummary,
      isDrawerOpen: isDrawerOpen,
      shouldRestoreDrawerAfterRefresh: shouldRestoreDrawerAfterRefresh,
      hasDrawerRestoreRetryTimer: refreshRecoveryController.hasRetryTimer,
      scheduleDrawerRestoreRetry: scheduleDrawerRestoreRetry,
      getViewState: getViewState,
      hasActiveWorkspace: hasActiveWorkspace,
      invalidateWorkspaceViewRestore: invalidateWorkspaceViewRestore,
      destroyMind: destroyMind,
      captureMindSearchStateForRender: captureMindSearchStateForRender,
      normalizeWorkspaceRenderViewState: normalizeWorkspaceRenderViewState,
      getRestorableViewState: getRestorableViewState,
      ensureState: ensureState,
      getRestorableDrawerState: getRestorableDrawerState,
      getRestoreDrawerOpenInFlight: function() { return restoreDrawerOpenInFlight === true; },
      setRestoreDrawerOpenInFlight: function(value) { restoreDrawerOpenInFlight = value === true; },
      getMindInstance: function() { return mindInstance; },
      setMindInstance: function(value) { mindInstance = value || null; },
      setCurrentMindData: function(value) { currentMindData = value || null; },
      buildMindData: buildMindData,
      getMindElixirCoreApi: getMindElixirCoreApi,
      isMindElixirReady: isMindElixirReady,
      ensureMindElixirCoreApiReady: ensureMindElixirCoreApiReady,
      getRootNodeId: getRootNodeId,
      exportCurrentXmind: exportCurrentXmind,
      getNodeActions: getNodeActions,
      handleNodeAction: handleNodeAction,
      handleDeleteSelection: handleDeleteSelection,
      scheduleTopupHighlightSync: scheduleTopupHighlightSync,
      markManualViewportInteraction: markManualViewportInteraction,
      persistViewportActionViewState: persistViewportActionViewState,
      scheduleLightweightViewportCapture: scheduleLightweightViewportCapture,
      scheduleCaptureCurrentViewState: scheduleCaptureCurrentViewState,
      mountInlineControls: mountInlineControls,
      syncDeleteHistoryButtons: syncDeleteHistoryButtons,
      bindTopupHighlightPresentation: bindTopupHighlightPresentation,
      bindLiveViewStateCapture: bindLiveViewStateCapture,
      syncTopupHighlightPresentation: syncTopupHighlightPresentation,
      centerRootNodeView: centerRootNodeView,
      scheduleWorkspaceViewRestore: scheduleWorkspaceViewRestore,
      getActiveWorkspaceId: getActiveWorkspaceId,
      restoreMindSearchStateAfterRender: restoreMindSearchStateAfterRender,
    });
    var isNodeFlowLeft = mindRendererController.isNodeFlowLeft;
    var render = mindRendererController.render;


    function restoreSelectionMap(snapshotMap) {
      var result = {};
      var map = snapshotMap && typeof snapshotMap === 'object' ? snapshotMap : {};
      Object.keys(map).forEach(function(key) {
        var set = new Set();
        (Array.isArray(map[key]) ? map[key] : []).forEach(function(value) {
          var num = Number(value);
          if (Number.isFinite(num)) set.add(num);
        });
        result[key] = set;
      });
      return result;
    }

    function normalizeInlineStatusType(type) {
      var text = type === null || type === undefined ? '' : String(type || '').trim();
      if (text === 'ok' || text === 'warn' || text === 'err') return text;
      return '';
    }

    function applyInlineStatus(text, type, options) {
      var opts = options || {};
      var xmindState = ensureState();
      var nextText = text === null || text === undefined ? '' : String(text || '');
      xmindState.inlineStatusText = nextText;
      xmindState.inlineStatusType = nextText ? normalizeInlineStatusType(type) : '';
      if (opts.skipDom === true) return;
      setStatus(statusEl, nextText, xmindState.inlineStatusType);
    }

    function syncInlineStatusFromState() {
      var xmindState = ensureState();
      applyInlineStatus(
        xmindState && xmindState.inlineStatusText ? String(xmindState.inlineStatusText || '') : '',
        normalizeInlineStatusType(xmindState && xmindState.inlineStatusType ? xmindState.inlineStatusType : '')
      );
    }

    function notifyInlineStatus(text, type, options) {
      applyInlineStatus(text, type, options);
    }

    function setDebugState(patch) {
      if (typeof window === 'undefined') return;
      window.app = window.app || {};
      var prev = window.app.__xmindCasegenDebug && typeof window.app.__xmindCasegenDebug === 'object'
        ? window.app.__xmindCasegenDebug
        : {};
      var next = {};
      Object.keys(prev).forEach(function(key) {
        next[key] = prev[key];
      });
      if (patch && typeof patch === 'object') {
        Object.keys(patch).forEach(function(key) {
          next[key] = patch[key];
        });
      }
      next.updatedAt = Date.now();
      window.app.__xmindCasegenDebug = next;
      try {
        var root = document && document.documentElement ? document.documentElement : null;
        if (root) {
          var phase = next.phase ? String(next.phase || '') : '';
          if (root.dataset) {
            root.dataset.tapXmindDebugPhase = phase;
          } else {
            root.setAttribute('data-tap-xmind-debug-phase', phase);
          }
        }
      } catch (err) {
        // ignore
      }
    }

    function notifySuccessToast(text, durationMs) {
      if (getWorkspaceUiMutedDepth() > 0) {
        notifyInlineStatus('', '', { skipDom: true });
        return;
      }
      if (!text) {
        notifyInlineStatus('', '');
        return;
      }
      notifyInlineStatus('', '');
      showCenterToast(String(text), 'ok', durationMs || 3000);
    }

    function notifyStatus(text, type, options) {
      var opts = options || {};
      if (getWorkspaceUiMutedDepth() > 0) {
        if ((type || '') === 'ok' && opts.forceInline !== true) {
          notifyInlineStatus('', '', { skipDom: true });
        } else {
          notifyInlineStatus(text, type || '', { skipDom: true });
        }
        return;
      }
      if ((type || '') === 'ok' && opts.forceInline !== true) {
        notifySuccessToast(text, opts.durationMs || 3000);
        return;
      }
      notifyInlineStatus(text, type || '');
    }

    function notifyFloatingStatus(text, type, durationMs) {
      if (getWorkspaceUiMutedDepth() > 0) {
        if (text) notifyInlineStatus(text, type || '', { skipDom: true });
        return;
      }
      if (!text) return;
      if (typeof showCenterToast === 'function') {
        showCenterToast(String(text), type || 'warn', durationMs || 5000);
        return;
      }
      notifyInlineStatus(text, type || '');
    }

    function syncKnowledgeBaseToolbarButton(button, title, stageStatus, reasonText) {
      if (!button) return;
      var stableStatus = stageStatus ? String(stageStatus || '') : 'disabled';
      var label = getKnowledgeBaseStageLabel(stableStatus);
      button.textContent = title + '：' + label;
      button.setAttribute('data-kb-stage-status', stableStatus);
      button.title = reasonText
        ? (title + '状态：' + label + '。' + reasonText)
        : (title + '状态：' + label);
    }

    function syncKnowledgeBaseToolbarState() {
      var kbState = getActiveKnowledgeBaseState();
      var ruleStage = kbState && kbState.ruleSearch && kbState.ruleSearch.status
        ? String(kbState.ruleSearch.status || '')
        : 'disabled';
      var aiStage = kbState && kbState.aiFilter && kbState.aiFilter.status
        ? String(kbState.aiFilter.status || '')
        : 'disabled';
      syncKnowledgeBaseToolbarButton(
        knowledgeRuleBtn,
        '知识检索',
        ruleStage,
        kbState && kbState.ruleSearch ? (kbState.ruleSearch.reason || kbState.ruleSearch.error || '') : ''
      );
      syncKnowledgeBaseToolbarButton(
        knowledgeAiBtn,
        'AI筛选',
        aiStage,
        kbState && kbState.aiFilter ? (kbState.aiFilter.reason || kbState.aiFilter.error || '') : ''
      );
    }

    function renderKnowledgeBaseDialog() {
      if (!summaryDialogBodyEl) return;
      summaryDialogBodyEl.innerHTML = xmindKnowledgeBaseApi.renderDialogHtml(getActiveKnowledgeBaseState());
    }

    function syncCasesGenPageRender(options) {
      var opts = options || {};
      if (!casesGenApi || typeof casesGenApi.renderCaseGeneration !== 'function') return false;
      if (getWorkspaceShadowDepth() > 0) {
        pendingCasesGenPageRender = true;
        return false;
      }
      if (opts.force !== true && isDrawerOpen()) {
        pendingCasesGenPageRender = true;
        return false;
      }
      pendingCasesGenPageRender = false;
      try {
        casesGenApi.renderCaseGeneration();
        return true;
      } catch (err) {
        pendingCasesGenPageRender = true;
        if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
          console.error('XMind casegen mirror render failed', err);
        }
        return false;
      }
    }

    function shouldDeferCasesGenPageRender() {
      return getWorkspaceShadowDepth() > 0;
    }

    function queueCasesGenPageRender() {
      pendingCasesGenPageRender = true;
      return true;
    }

    function flushDeferredCasesGenPageRender() {
      if (pendingCasesGenPageRender !== true) return false;
      return syncCasesGenPageRender({ force: true });
    }

    function getXmindCoreApi() {
      if (ctx.xmindCoreApi) return ctx.xmindCoreApi;
      return window.app && window.app.xmindCoreApi ? window.app.xmindCoreApi : null;
    }

    function getMindElixirCoreApi() {
      if (ctx.mindElixirCoreApi) return ctx.mindElixirCoreApi;
      return window.app && window.app.mindElixirCoreApi ? window.app.mindElixirCoreApi : null;
    }

    function getXmindMarkdownExportCoreApi() {
      if (ctx.xmindMarkdownExportCoreApi) return ctx.xmindMarkdownExportCoreApi;
      return window.app && window.app.xmindMarkdownExportCoreApi ? window.app.xmindMarkdownExportCoreApi : null;
    }

    function getXmindCaseDedupeCoreApi() {
      if (ctx.xmindCaseDedupeCore) return ctx.xmindCaseDedupeCore;
      if (ctx.xmindCaseDedupeCoreApi) return ctx.xmindCaseDedupeCoreApi;
      return window.app && window.app.xmindCaseDedupeCoreApi ? window.app.xmindCaseDedupeCoreApi : null;
    }

    function getXmindDedupeBatchCoreApi() {
      if (ctx.xmindDedupeBatchCore) return ctx.xmindDedupeBatchCore;
      if (ctx.xmindDedupeBatchCoreApi) return ctx.xmindDedupeBatchCoreApi;
      return window.app && window.app.xmindDedupeBatchCore ? window.app.xmindDedupeBatchCore : null;
    }

    function getXmindGenerationTimingCoreApi() {
      if (ctx.xmindGenerationTimingCore) return ctx.xmindGenerationTimingCore;
      if (ctx.xmindGenerationTimingCoreApi) return ctx.xmindGenerationTimingCoreApi;
      return window.app && window.app.xmindGenerationTimingCore ? window.app.xmindGenerationTimingCore : null;
    }

    function getXmindRequirementCoverageCoreApi() {
      if (ctx.xmindRequirementCoverageCore) return ctx.xmindRequirementCoverageCore;
      if (ctx.xmindRequirementCoverageCoreApi) return ctx.xmindRequirementCoverageCoreApi;
      if (window.app && window.app.xmindRequirementCoverageCoreApi) return window.app.xmindRequirementCoverageCoreApi;
      if (window.app && window.app.xmindRequirementCoverageCore && typeof window.app.xmindRequirementCoverageCore.init === 'function') {
        window.app.xmindRequirementCoverageCoreApi = window.app.xmindRequirementCoverageCore.init({});
        return window.app.xmindRequirementCoverageCoreApi;
      }
      return null;
    }

    function hasMindElixirCtorReady() {
      var globalObj = null;
      if (typeof MindElixir !== 'undefined') {
        globalObj = MindElixir;
      } else if (typeof window !== 'undefined' && window && window.MindElixir) {
        globalObj = window.MindElixir;
      }
      if (typeof globalObj === 'function') return true;
      return Boolean(globalObj && typeof globalObj.default === 'function');
    }

    function isMindElixirReady(api) {
      return Boolean(api && typeof api.renderMindMap === 'function' && hasMindElixirCtorReady());
    }

    function ensureMindElixirCoreApiReady() {
      var readyApi = getMindElixirCoreApi();
      if (isMindElixirReady(readyApi)) {
        return Promise.resolve(readyApi);
      }
      if (window.app && typeof window.app.ensureMindElixirCoreApi === 'function') {
        return window.app.ensureMindElixirCoreApi().then(function() {
          var nextApi = getMindElixirCoreApi();
          if (!isMindElixirReady(nextApi)) {
            throw new Error('MindElixir 依赖未就绪');
          }
          return nextApi;
        });
      }
      return Promise.resolve(readyApi);
    }

    function getCasesCoreApi() {
      if (ctx.casesCoreApi) return ctx.casesCoreApi;
      return window.app && window.app.casesCoreApi ? window.app.casesCoreApi : null;
    }

    function getXmindTaskManager() {
      if (xmindGenApi && xmindGenApi.taskManager) return xmindGenApi.taskManager;
      return window.app && window.app.xmindCaseGenTaskManager ? window.app.xmindCaseGenTaskManager : null;
    }

    function isDrawerOpen() {
      var el = drawerInstance && drawerInstance.element ? drawerInstance.element : drawerEl;
      return Boolean(el && el.classList && el.classList.contains('open'));
    }


    function scheduleRecoveredStatePersist() {
      if (recoveredStatePersistTimer) {
        clearTimeout(recoveredStatePersistTimer);
        recoveredStatePersistTimer = 0;
      }
      recoveredStatePersistTimer = setTimeout(function() {
        recoveredStatePersistTimer = 0;
        persistXmindState(true);
      }, 0);
    }

    function destroyMind() {
      prepareMindDestroy();
      cleanupTopupHighlightPresentation();
      restoreInlineControlsToBank();
      if (mindInstance && typeof mindInstance.destroy === 'function') {
        try {
          mindInstance.destroy();
        } catch (err) {}
      }
      mindInstance = null;
      currentMindData = null;
      if (mindContainer) mindContainer.innerHTML = '';
    }


    function showMindReloadingHint() {
      if (!mindContainer || typeof mindContainer.innerHTML !== 'string') return;
      mindContainer.innerHTML = '<p class="hint" style="padding:16px;">正在重新载入 XMind 视图...</p>';
    }

    function resetMindCanvasBeforeDrawerOpen() {
      destroyMind();
      showMindReloadingHint();
    }

    function setCasesGenModulesView() {
      if (casesGenApi && typeof casesGenApi.setCaseGenViewTab === 'function') {
        casesGenApi.setCaseGenViewTab('xmind-modules', { persist: false });
      } else {
        var modulesTabBtn = document.getElementById('caseGenModulesTabBtn');
        if (modulesTabBtn && typeof modulesTabBtn.click === 'function') modulesTabBtn.click();
      }
    }


    function getPrepState() {
      return ensureState().prep;
    }

    function setPrepField(key, value, immediate) {
      var prep = getPrepState();
      if (prep.baseLocked === true && isPrepBaseField(key)) return false;
      prep[key] = value;
      if (key !== 'completed' && key !== 'step' && key !== 'baseLocked') prep.completed = false;
      persistXmindState(immediate === true);
      syncPrepDialogState();
      if (isPrepBaseField(key) || key === 'completed' || key === 'step' || key === 'baseLocked') {
        renderWorkspaceTabs();
      }
      return true;
    }

    function isPrepBaseField(key) {
      return key === 'requirementMode'
        || key === 'requirementSupplement'
        || key === 'manualRequirementLabel'
        || key === 'manualRequirementBlocks'
        || key === 'caseImportMode';
    }

    function isPrepBaseLocked() {
      return getPrepState().baseLocked === true;
    }

    function getPrepMaxReachableStep() {
      if (isPrepBaseLocked()) return STEP_OPTIONS;
      if (!hasRequirementReady()) return STEP_REQUIREMENT;
      if (!hasCaseStepReady()) return STEP_CASES;
      return STEP_OPTIONS;
    }

    function clampPrepStep(step) {
      var next = Math.max(STEP_REQUIREMENT, Math.min(STEP_OPTIONS, Number(step) || STEP_REQUIREMENT));
      var maxStep = getPrepMaxReachableStep();
      if (next > maxStep) next = maxStep;
      return next;
    }

    function markPrepNeedsReconfirm(immediate) {
      var prep = getPrepState();
      if (prep.completed !== true) return false;
      prep.completed = false;
      persistXmindState(immediate === true);
      renderWorkspaceTabs();
      return true;
    }

    function normalizeText(value) {
      if (value === null || value === undefined) return '';
      return String(value).replace(/\r/g, '\n').replace(/\s+/g, ' ').trim();
    }

    function stringifyField(value) {
      if (Array.isArray(value)) {
        return value.map(function(item) { return normalizeText(item); }).filter(Boolean).join('；');
      }
      if (value && typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (err) {
          return '';
        }
      }
      return normalizeText(value);
    }

    function normalizeModuleTitle(value) {
      return stringifyField(value || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeModuleKey(value) {
      return normalizeModuleTitle(value).toLowerCase();
    }

    function normalizeCaseTitle(value) {
      return normalizeText(value).toLowerCase();
    }

    function normalizeUniqueStringList(list) {
      var seen = Object.create(null);
      return (Array.isArray(list) ? list : []).map(function(item) {
        return String(item || '').trim();
      }).filter(function(item) {
        if (!item || seen[item]) return false;
        seen[item] = true;
        return true;
      });
    }

    function buildBaselineModuleDeleteKey(moduleTitle) {
      return normalizeModuleKey(moduleTitle || '');
    }

    function buildBaselineCaseDeleteKey(moduleTitle, caseSignature) {
      var moduleKey = buildBaselineModuleDeleteKey(moduleTitle);
      var signature = String(caseSignature || '').trim();
      return moduleKey && signature ? (moduleKey + '::' + signature) : '';
    }

    function getDocumentRequirementLabelText() {
      var label = normalizePersistedRequirementLabel(state.requirementLabel);
      if (!label) {
        var activeRecord = getWorkspaceRecord(getActiveWorkspaceId());
        var recordShared = activeRecord && activeRecord.snapshot && activeRecord.snapshot.shared
          ? normalizeWorkspaceSharedState(activeRecord.snapshot.shared)
          : null;
        if (recordShared) {
          label = normalizePersistedRequirementLabel(recordShared.requirementLabel);
        }
      }
      if (!label) {
        label = normalizeRequirementLabelFromFileName(state.lastRawImportName || '');
      }
      return label;
    }

    function getManualRequirementLabelText() {
      return String(getPrepState().manualRequirementLabel || '').trim();
    }

    function normalizePersistedRequirementLabel(value) {
      var text = value === null || value === undefined ? '' : String(value || '').trim();
      if (!text || text === '当前需求') return '';
      return text;
    }

    function getRequirementLabelText() {
      var prep = getPrepState();
      var label = prep.requirementMode === 'manual'
        ? getManualRequirementLabelText()
        : getDocumentRequirementLabelText();
      return label || '当前需求';
    }

    function normalizeRequirementLabelFromFileName(fileName) {
      var text = String(fileName || '').trim();
      if (!text) return '';
      return text.replace(/\.[^.\s]{1,10}$/i, '').trim();
    }

    function stripCodeFence(text) {
      var raw = String(text || '').trim();
      var matched = raw.match(/^```[\w-]*\n([\s\S]*?)```$/);
      if (matched && matched[1]) return matched[1].trim();
      return raw;
    }

    function recordGenerationHistory(payload) {
      var xmindState = ensureState();
      var history = Array.isArray(xmindState.history) ? xmindState.history : [];
      var details = normalizeHistoryDetails(payload && payload.details);
      var diagnostics = normalizeHistoryDiagnostics(payload && payload.diagnostics);
      var dedupeRecords = normalizeHistoryDedupeRecords(payload && payload.dedupeRecords);
      var scope = payload && payload.scope === 'module' ? 'module' : 'root';
      var moduleCount = Number(payload && payload.moduleCount);
      var resultKind = payload && (
        payload.resultKind === 'no-change'
        || payload.resultKind === 'cancelled'
        || payload.resultKind === 'error'
      ) ? String(payload.resultKind) : 'changed';
      if (!Number.isFinite(moduleCount) || moduleCount < 0) moduleCount = details.length;
      history.unshift({
        id: 'history-' + String(Date.now()) + '-' + String(Math.floor(Math.random() * 100000)),
        scope: scope,
        locationLabel: buildHistoryLocationLabel(scope, payload && payload.moduleTitle),
        actionId: String(payload && payload.actionId ? payload.actionId : ''),
        actionLabel: String(payload && payload.actionLabel ? payload.actionLabel : ''),
        summaryText: payload && payload.summaryText ? String(payload.summaryText) : '',
        moduleCount: moduleCount,
        details: details,
        resultKind: resultKind,
        reasonText: payload && payload.reasonText ? String(payload.reasonText) : '',
        diagnostics: diagnostics,
        dedupeRecords: dedupeRecords,
        previewText: normalizeHistoryPreviewText(payload && payload.previewText),
        createdAt: Date.now(),
      });
      if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
      xmindState.history = history;
      xmindState.summaryResultKind = resultKind === 'error' ? 'error' : '';
      markHistoryUnreadNotice({ persist: false });
      if (summaryDialogController.isModeOpen('history')) {
        renderHistoryDialog();
      }
      persistXmindState(true);
    }

    function renderHistoryDialog() {
      if (!summaryDialogBodyEl) return;
      summaryDialogBodyEl.innerHTML = buildHistoryListHtml(ensureState().history || []);
    }

    function hideOpenMindContextMenu() {
      var mindElixirCoreApi = getMindElixirCoreApi();
      if (mindElixirCoreApi && typeof mindElixirCoreApi.hideOpenContextMenu === 'function') {
        try {
          mindElixirCoreApi.hideOpenContextMenu();
        } catch (err) {
          // ignore
        }
      }
      if (typeof document === 'undefined' || !document.querySelectorAll) return;
      var menus = document.querySelectorAll('.xmind-node-context-menu');
      if (!menus || !menus.length) return;
      Array.prototype.forEach.call(menus, function(menu) {
        if (!menu || !menu.classList) return;
        menu.classList.remove('is-open');
        if (menu.setAttribute) menu.setAttribute('aria-hidden', 'true');
      });
    }

    function ensureDedupeUiState() {
      var xmindState = ensureState();
      if (!xmindState.dedupe || typeof xmindState.dedupe !== 'object') {
        xmindState.dedupe = createDefaultDedupeState();
      }
      return xmindState.dedupe;
    }

    function ensureCoverageUiState() {
      var xmindState = ensureState();
      xmindState.coverage = normalizeCoverageState(xmindState.coverage);
      return xmindState.coverage;
    }

    function collectAiDedupeModulesFromContext(context) {
      var modules = [];
      (context && Array.isArray(context.list) ? context.list : []).forEach(function(entry) {
        if (!entry || !entry.aiModuleId) return;
        var cases = Array.isArray(entry.aiCases) ? entry.aiCases : [];
        var normalizedCases = cases.map(function(item) {
          return normalizeCaseItem(item, entry.title);
        }).filter(Boolean);
        if (!normalizedCases.length) return;
        modules.push({
          moduleId: String(entry.aiModuleId || ''),
          moduleKey: String(entry.moduleKey || normalizeModuleKey(entry.title || '')),
          module: normalizeModuleTitle(entry.title || ''),
          key_scenarios: entry.aiModule && Array.isArray(entry.aiModule.scenarios) ? entry.aiModule.scenarios.slice() : [],
          test_points: entry.aiModule && Array.isArray(entry.aiModule.points) ? entry.aiModule.points.slice() : [],
          coupled_modules: entry.aiModule && Array.isArray(entry.aiModule.coupled) ? entry.aiModule.coupled.slice() : [],
          cases: normalizedCases,
        });
      });
      return modules;
    }

    function collectCurrentAiDedupeModules(options) {
      return collectAiDedupeModulesFromContext(buildVisibleModuleContext(options));
    }

    function collectAiModulesWithoutCasesFromContext(context) {
      var result = [];
      (context && Array.isArray(context.list) ? context.list : []).forEach(function(entry) {
        if (!entry || !entry.aiModuleId) return;
        var cases = Array.isArray(entry.aiCases) ? entry.aiCases : [];
        if (cases.length > 0) return;
        result.push({
          moduleId: String(entry.aiModuleId || ''),
          moduleKey: String(entry.moduleKey || normalizeModuleKey(entry.title || '')),
          module: normalizeModuleTitle(entry.title || ''),
        });
      });
      return result;
    }

    function buildRootPipelineDedupeReadiness(context) {
      var visibleContext = ensureVisibleModuleContext(context);
      var pipeline = getRootPipelineState();
      var generatedDedupeModules = normalizeRootPipelineDedupeModules(
        pipeline && Array.isArray(pipeline.generatedDedupeModules)
          ? pipeline.generatedDedupeModules
          : []
      );
      if (hasRootPipelineDedupeCases(generatedDedupeModules)) {
        return {
          missingModules: [],
          dedupeModules: generatedDedupeModules,
          ready: true,
        };
      }
      var missingModules = collectAiModulesWithoutCasesFromContext(visibleContext);
      var dedupeModules = collectAiDedupeModulesFromContext(visibleContext);
      return {
        missingModules: missingModules,
        dedupeModules: dedupeModules,
        ready: missingModules.length === 0 && dedupeModules.length > 0,
      };
    }

    function hasVisibleAiCasesForDedupe() {
      return collectCurrentAiDedupeModules().length > 0;
    }

    function generateLocalId(prefix) {
      return String(prefix || 'xmind') + '-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 8);
    }

    function normalizeArrayField(value) {
      if (Array.isArray(value)) {
        return value.map(function(item) { return normalizeText(item); }).filter(Boolean);
      }
      var text = normalizeText(value);
      return text ? [text] : [];
    }

    function openStoreConfirmDialog(options) {
      var opts = options || {};
      var confirmDrawer = window.app && window.app.confirmDrawer ? window.app.confirmDrawer : null;
      if (confirmDrawer && typeof confirmDrawer.open === 'function') {
        return confirmDrawer.open({
          title: opts.title || '确认保存入库',
          message: opts.message || '',
          confirmText: opts.confirmText || '确认',
          cancelText: opts.cancelText || '取消',
        }).then(function(result) {
          return Boolean(result && result.ok === true);
        });
      }
      var ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(String(opts.message || '确认继续吗？'))
        : true;
      return Promise.resolve(ok === true);
    }

    function getConfiguredXmindTimeoutSec() {
      var timeoutSec = state && state.settings && Number(state.settings.timeoutSec)
        ? Math.max(30, Math.min(1800, Math.round(Number(state.settings.timeoutSec))))
        : 300;
      return timeoutSec;
    }

    function callXmindModelWithGuard(executor) {
      var timeoutSec = getConfiguredXmindTimeoutSec();
      var timeoutMs = timeoutSec * 1000 + 1500;
      return new Promise(function(resolve, reject) {
        var settled = false;
        var timer = setTimeout(function() {
          if (settled) return;
          settled = true;
          reject(new Error('模型调用超时（超过 ' + timeoutSec + ' 秒）'));
        }, timeoutMs);
        Promise.resolve().then(function() {
          return executor();
        }).then(function(result) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }).catch(function(err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
      });
    }

    async function buildRequirementPayload(contract, visibleContext, moduleEntry, options) {
      var opts = options || {};
      var requirementSource = getSelectedRequirementSource();
      var generationOptions = buildXmindGenerationOptionsSnapshot();
      var hardConstraintText = buildXmindHardConstraintText(contract, generationOptions);
      var visibleModulesSnapshot = Array.isArray(opts.visibleModulesSnapshot)
        ? cloneJson(opts.visibleModulesSnapshot, [])
        : buildVisibleModuleSnapshot(visibleContext);
      var isModuleScope = contract && String(contract.scope || '') === 'module';
      var aiLayerSnapshot = isModuleScope
        ? []
        : (contract && (
            contract.mode === 'regenerate_modules'
            || (contract.scope === 'root' && contract.mode === 'full_cases')
          )
          ? []
          : buildAiLayerSnapshot());
      var targetModuleSnapshot = moduleEntry
        ? {
            module: moduleEntry.title,
            visible_cases: getVisibleCasesForModuleEntry(moduleEntry).map(function(row) {
              return normalizeCaseItem(row.item, moduleEntry.title);
            }).filter(Boolean),
          }
        : null;
      var payloadCore = window.app && window.app.xmindGenerationPayloadCore
        ? window.app.xmindGenerationPayloadCore
        : null;
      var generationContext = payloadCore && typeof payloadCore.buildGenerationContext === 'function'
        ? payloadCore.buildGenerationContext({
            contract: contract,
            visibleModules: visibleModulesSnapshot,
            aiLayer: aiLayerSnapshot,
            targetModule: targetModuleSnapshot,
          })
        : {
            visibleModules: visibleModulesSnapshot,
            aiLayer: aiLayerSnapshot,
            targetModule: targetModuleSnapshot,
          };
      var sections = [];
      sections.push('【需求标识】\n' + getRequirementLabelText());
      sections.push('【operation_contract(JSON)】\n' + JSON.stringify(contract, null, 2));
      sections.push('【本轮生成选项(JSON)】\n' + JSON.stringify(generationOptions, null, 2));
      sections.push('【本轮生成选项说明】\n' + buildXmindGenerationOptionsSummary(generationOptions));
      if (hardConstraintText) {
        sections.push('【首轮生成硬约束】\n' + hardConstraintText);
      }
      sections.push('【当前可见模块与用例(JSON)】\n' + JSON.stringify(generationContext.visibleModules, null, 2));
      sections.push('【当前 AI 生成层(JSON)】\n' + JSON.stringify(generationContext.aiLayer, null, 2));
      if (generationContext.targetModule) {
        sections.push('【当前操作模块】\n' + JSON.stringify(generationContext.targetModule, null, 2));
      }
      if (requirementSource.mode === 'document') {
        sections.push('【需求正文】\n' + (requirementSource.text || '（无文本）'));
        if (requirementSource.supplement) sections.push('【需求补充】\n' + requirementSource.supplement);
        return {
          mode: 'document',
          text: sections.join('\n\n'),
          images: requirementSource.images,
        };
      }
      sections.push('【手填需求描述】\n' + (requirementSource.text || '（仅图片）'));
      return {
        mode: requirementSource.mode || 'manual',
        text: sections.join('\n\n'),
        images: requirementSource.images,
      };
    }

    function tryStartRootCoverageRetry(task, gapInfo, anchorNodeId) {
      if (!task || !gapInfo || gapInfo.shouldRetry !== true) return false;
      var retryTask = startManagedXmindTask(buildRootCoverageRetryTaskPayload(task, gapInfo));
      var rootState = ensureRootUiState();
      rootState.running = true;
      rootState.taskId = String(retryTask && retryTask.id ? retryTask.id : '');
      rootState.hideAiLayer = task.hadAiLayerBeforeAction === true;
      rootState.status = '';
      rootState.error = '';
      rootState.lastAction = String(task.actionId || rootState.lastAction || '');
      rootState.snapshotId = String(task.snapshotId || rootState.snapshotId || '');
      rootState.updatedAt = Date.now();
      notifyFloatingStatus('首轮结果未充分覆盖已开启要求，正在自动补强', 'warn', 3000);
      if (isDrawerOpen()) {
        render({ reason: 'root-coverage-retry', persist: false, anchorNodeId: anchorNodeId || getRootNodeId() });
      }
      persistXmindState(true);
      return true;
    }


    function setModuleRootPendingAction(moduleState, actionId) {
      if (!moduleState || typeof moduleState !== 'object') return;
      moduleState.rootPendingActionId = actionId ? String(actionId || '') : '';
      moduleState.updatedAt = Date.now();
    }

    function clearModuleRootPendingAction(moduleState, actionId) {
      if (!moduleState || typeof moduleState !== 'object') return;
      if (actionId && String(moduleState.rootPendingActionId || '') !== String(actionId || '')) return;
      moduleState.rootPendingActionId = '';
      moduleState.updatedAt = Date.now();
    }

    function markRootPendingModules(moduleEntries, actionId) {
      var list = Array.isArray(moduleEntries) ? moduleEntries : [];
      list.forEach(function(entry) {
        if (!entry || !entry.aiModuleId) return;
        setModuleRootPendingAction(ensureModuleUiState(entry.aiModuleId), actionId);
      });
    }

    function clearRootPendingModules(actionId) {
      var modulesState = ensureState().modules || {};
      Object.keys(modulesState).forEach(function(key) {
        clearModuleRootPendingAction(modulesState[key], actionId);
      });
    }



    function getNodeActions(nodeMeta) {
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : null;
      if (!meta) return [];
      var deleteAction = buildDeleteAction(nodeMeta);
      if (nodeMeta && Number(nodeMeta.selectionCount) > 1) {
        return hasDeleteTargets(nodeMeta) ? [deleteAction] : [];
      }
      if (meta.type === 'root') return getRootActions();
      if (meta.type === 'module') {
        var context = ensureVisibleModuleContext(buildVisibleModuleContext());
        var contextMap = context.map || {};
        return getModuleActions(contextMap[meta.moduleKey]).concat([deleteAction]);
      }
      if (isDeleteNodeType(meta.type)) {
        return [deleteAction];
      }
      return [];
    }


    function scheduleRender(reason) {
      if (isPendingOpenRenderHeld()) return false;
      queueStructureMindRender({ reason: reason || 'scheduled' });
      return true;
    }

    function resolveModuleEntryByMeta(meta) {
      var context = ensureVisibleModuleContext(buildVisibleModuleContext());
      var contextMap = context.map || {};
      return contextMap[meta && meta.moduleKey ? meta.moduleKey : ''] || null;
    }

    function ensurePrepReadyOrOpen() {
      if (isPrepCompleted()) return true;
      notifyStatus('请先完成生成前置准备', 'warn', { forceInline: true });
      openSummaryDialog(getPrepState().step || STEP_REQUIREMENT);
      return false;
    }

    function ensureActionAllowed(actionId, moduleEntry) {
      var actions = moduleEntry ? getModuleActions(moduleEntry) : getRootActions();
      for (var i = 0; i < actions.length; i += 1) {
        if (!actions[i] || actions[i].id !== actionId) continue;
        if (actions[i].disabled === true) {
          var blocker = resolveBlockingOperation(actionId, moduleEntry);
          notifyStatus(buildBlockedActionMessage(actionId, blocker), 'warn', { forceInline: true });
          return false;
        }
        return true;
      }
      notifyStatus('当前节点不支持该动作', 'warn', { forceInline: true });
      return false;
    }

    function clearCaseGenLayerForReplaceAll() {
      state.caseGenModules = [];
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      ensureState().modules = {};
      ensureState().hasModuleSkeleton = false;
    }

    function commitCaseList(moduleId, list, timingMs, message, selectionMode) {
      if (casesGenApi && typeof casesGenApi.commitModuleCases === 'function') {
        casesGenApi.commitModuleCases(moduleId, {
          rawResult: JSON.stringify(Array.isArray(list) ? list : [], null, 2),
          list: Array.isArray(list) ? list : [],
          hasResult: Array.isArray(list) && list.length > 0,
          timingMs: timingMs,
          statusText: message || '',
          statusType: message ? 'ok' : '',
          selectionMode: selectionMode || '',
        });
      } else {
        state.caseGenResults[moduleId] = JSON.stringify(Array.isArray(list) ? list : [], null, 2);
      }
    }

    function applyRootOutput(actionId, modules, visibleContext, durationMs) {
      visibleContext = ensureVisibleModuleContext(visibleContext);
      var visibleMap = visibleContext.map || {};
      var createdModules = 0;
      var affectedModules = 0;
      var addedCases = 0;
      var detailMap = {};
      var applyDiagnostics = {
        duplicateAgainstExistingCases: 0,
        duplicateWithinAddedCases: 0,
      };
      clearAllTopupHighlights();

      function collectDetail(moduleTitle, caseCount) {
        var title = normalizeModuleTitle(moduleTitle || '');
        var key = normalizeModuleKey(title || '') || ('module-' + String(Object.keys(detailMap).length + 1));
        if (!detailMap[key]) {
          detailMap[key] = {
            module: title || '未命名模块',
            caseCount: 0,
            durationMs: normalizeHistoryDurationMs(durationMs),
          };
        }
        var nextCount = Number(caseCount);
        if (!Number.isFinite(nextCount) || nextCount < 0) nextCount = 0;
        detailMap[key].caseCount += nextCount;
      }

      if (
        actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.FULL_MODULES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
      ) {
        clearCaseGenLayerForReplaceAll();
        (modules || []).forEach(function(item) {
          var record = ensureAiModuleRecord(item.module, item);
          createdModules += 1;
          collectDetail(item.module, 0);
          if (actionId === ROOT_ACTIONS.FULL_CASES) {
            commitCaseList(record.id, item.cases || [], durationMs, '', '');
            if ((item.cases || []).length) {
              affectedModules += 1;
              addedCases += (item.cases || []).length;
              collectDetail(item.module, (item.cases || []).length);
            }
          }
        });
        return {
          changed: createdModules > 0 || addedCases > 0,
          createdModules: createdModules,
          affectedModules: affectedModules,
          addedCases: addedCases,
          details: normalizeHistoryDetails(Object.keys(detailMap).map(function(key) { return detailMap[key]; })),
          diagnostics: applyDiagnostics,
        };
      }

      (modules || []).forEach(function(item) {
        var entryBefore = visibleMap[normalizeModuleKey(item.module)] || null;
        var existedBefore = Boolean(entryBefore && entryBefore.aiModule);
        var record = ensureAiModuleRecord(item.module, item);
        var moduleState = ensureModuleUiState(record.id);
        var existingAiCases = getAiCasesForModule(record.id);
        var visibleCases = entryBefore
          ? getVisibleCasesForModuleEntry(entryBefore).map(function(row) { return normalizeCaseItem(row.item, item.module); }).filter(Boolean)
          : existingAiCases.slice();
        if (!existedBefore) {
          createdModules += 1;
          collectDetail(item.module, 0);
          if (actionId === ROOT_ACTIONS.TOPUP_MODULES) {
            setModuleTopupHighlight(moduleState, item.module, 0, 0, { highlightScope: 'module' });
          }
        }
        if (item.cases && item.cases.length) {
          var merged = mergeCasesWithoutDuplicates(existingAiCases, item.cases, visibleCases);
          applyDiagnostics.duplicateAgainstExistingCases += getDiagnosticsMetric(merged.diagnostics, 'duplicateAgainstExisting');
          applyDiagnostics.duplicateWithinAddedCases += getDiagnosticsMetric(merged.diagnostics, 'duplicateWithinAdded');
          if (merged.appended.length > 0) {
            commitCaseList(record.id, merged.merged, durationMs, '', 'keep-valid');
            affectedModules += 1;
            addedCases += merged.appended.length;
            collectDetail(item.module, merged.appended.length);
            var baselineCount = entryBefore && Array.isArray(entryBefore.baselineCases) ? entryBefore.baselineCases.length : 0;
            if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES && !existedBefore) {
              setModuleTopupHighlight(moduleState, item.module, 0, merged.appended.length, { highlightScope: 'subtree' });
            } else {
              setModuleTopupHighlight(moduleState, item.module, baselineCount + existingAiCases.length, merged.appended.length);
            }
          }
        } else if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES && !existedBefore) {
          setModuleTopupHighlight(moduleState, item.module, 0, 0, { highlightScope: 'module' });
        }
      });
      return {
        changed: createdModules > 0 || affectedModules > 0,
        createdModules: createdModules,
        affectedModules: affectedModules,
        addedCases: addedCases,
        details: normalizeHistoryDetails(Object.keys(detailMap).map(function(key) { return detailMap[key]; })),
        diagnostics: applyDiagnostics,
      };
    }

    async function startManualAiDedupe() {
      if (hasAnyRunningGenerationOperation()) {
        notifyStatus('当前有 XMind 任务进行中，请等待完成后再去重', 'warn', { forceInline: true });
        return false;
      }
      var modules = collectCurrentAiDedupeModules();
      if (!modules.length) {
        notifyStatus('当前页签没有可去重的 AI 生成用例', 'warn', { forceInline: true });
        return false;
      }
      var caseCount = 0;
      modules.forEach(function(item) {
        caseCount += Array.isArray(item && item.cases) ? item.cases.length : 0;
      });
      var dedupeMode = getDedupeModeFromSettings();
      var modeText = getDedupeModeActionText(dedupeMode);
      var modeMessage = isDedupeSimplifyMode(dedupeMode)
        ? '该操作会优先保留覆盖全面、高质量的用例，并在不降低缺陷发现能力的前提下减少冗余。'
        : '该操作只删除或合并明显重复、高度重叠的用例，不主动压缩有独立覆盖价值的场景。';
      pendingManualDedupeConfirm = true;
      syncDedupeToolbarButton();
      try {
        var confirmed = await openStoreConfirmDialog({
          title: '确认 AI 用例去重',
          message: '即将对当前页签 ' + String(modules.length) + ' 个模块、' + String(caseCount) + ' 条 AI 生成用例执行' + modeText + '。' + modeMessage + '仅处理当前页签的 AI 生成层结果。是否继续？',
          confirmText: '确认去重',
          cancelText: '取消',
        });
        if (!confirmed) return false;
        return Boolean(startAiDedupeTask({
          source: 'manual-toolbar',
          modules: cloneJson(modules, []),
          dedupeMode: dedupeMode,
        }));
      } catch (err) {
        notifyStatus('AI 用例去重启动失败：' + (err && err.message ? err.message : '未知错误'), 'err', { forceInline: true });
        return false;
      } finally {
        pendingManualDedupeConfirm = false;
        syncDedupeToolbarButton();
      }
    }

    var eventBindingControllerFactory = ctx.eventBindingControllerFactory
      || (window.app && window.app.xmindCasegenEventBindingController
        ? window.app.xmindCasegenEventBindingController
        : null);
    if (!eventBindingControllerFactory || typeof eventBindingControllerFactory.create !== 'function') {
      throw new Error('xmindCasegenEventBindingController 未加载');
    }
    var eventBindingController = eventBindingControllerFactory.create({
      elements: {
        openBtn: openBtn,
        workspaceAddBtn: workspaceAddBtn,
        workspaceListEl: workspaceListEl,
        summaryBtn: summaryBtn,
        historyBtn: historyBtn,
        knowledgeRuleBtn: knowledgeRuleBtn,
        knowledgeAiBtn: knowledgeAiBtn,
        dedupeBtn: dedupeBtn,
        storeBtn: storeBtn,
        interruptBtn: interruptBtn,
        deleteUndoBtn: deleteUndoBtn,
        deleteRedoBtn: deleteRedoBtn,
        summaryCloseBtn: summaryCloseBtn,
        exportBtn: exportBtn,
        exportMarkdownBtn: exportMarkdownBtn,
      },
      documentObj: document,
      MutationObserver: typeof MutationObserver !== 'undefined' ? MutationObserver : null,
      debounce: debounce,
      bindCoverageDialog: function() { coverageDialogController.bind(); },
      bindPrepDialog: function() { prepDialogController.bind(); },
      openDrawer: open,
      createWorkspaceAndOpenPrep: createWorkspaceAndOpenPrep,
      deleteWorkspace: deleteWorkspace,
      getActiveWorkspaceId: getActiveWorkspaceId,
      switchWorkspace: switchWorkspace,
      closeSummaryDialog: closeSummaryDialog,
      openPrepDialog: function() {
        openSummaryDialog(getPrepState().step || STEP_REQUIREMENT);
      },
      openHistoryDialog: openHistoryDialog,
      openKnowledgeBaseDialog: openKnowledgeBaseDialog,
      startManualAiDedupe: startManualAiDedupe,
      handleStoreToLibrary: handleStoreToLibrary,
      interruptRunningXmindTasks: interruptRunningXmindTasks,
      undoLatestDeleteSelection: undoLatestDeleteSelection,
      redoLatestDeleteSelection: redoLatestDeleteSelection,
      exportCurrentXmind: exportCurrentXmind,
      exportCurrentMarkdown: exportCurrentMarkdown,
      isDrawerOpen: isDrawerOpen,
      getSummaryDialogState: getSummaryDialogState,
      syncDeleteHistoryButtons: syncDeleteHistoryButtons,
      syncKnowledgeBaseToolbarState: syncKnowledgeBaseToolbarState,
      updateSummary: updateSummary,
      renderOpenedSummaryDialog: renderOpenedSummaryDialog,
      scheduleRender: scheduleRender,
      setTimeout: function(handler, delay) { return setTimeout(handler, delay); },
    });

    ensureDrawer();
    bindViewStatePersistenceLifecycle();
    eventBindingController.bind();
    bindManagedXmindTasks();
    updateSummary();

    var api = {
      open: open,
      close: close,
      closeWorkspace: deleteWorkspace,
      activateWorkspace: activateWorkspace,
      openWorkspace: openWorkspaceFromProgressPanel,
      getWorkspaceProgressItems: listWorkspaceProgressItems,
      getWorkspaceModuleMirrorPayload: getWorkspaceModuleMirrorPayload,
      selectWorkspaceForMirror: selectWorkspaceForMirror,
      hydrateActiveWorkspaceSnapshot: hydrateActiveWorkspaceSnapshot,
      syncActiveWorkspaceSnapshot: syncActiveWorkspaceSnapshot,
      shouldDeferCasesGenPageRender: shouldDeferCasesGenPageRender,
      queueCasesGenPageRender: queueCasesGenPageRender,
      render: render,
      exportCurrentXmind: exportCurrentXmind,
      exportCurrentMarkdown: exportCurrentMarkdown,
      switchTab: switchTab,
      isOpen: isDrawerOpen,
      restoreAfterWorkflowReady: restoreDrawerAfterRefreshIfNeeded,
      resetAllState: resetXmindCasegenState,
      resetAfterStoreSuccess: resetAfterStoreSuccess,
    };
    window.app.xmindCasegenApi = api;
    syncCasesGenPageRender({ force: true });
    return api;
  }

  window.app = window.app || {};
  window.app.xmindCasegen = { init: init };
})();
