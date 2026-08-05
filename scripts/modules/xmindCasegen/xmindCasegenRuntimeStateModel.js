(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenRuntimeStateModel = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var ensureStatePort = typeof opts.ensureState === 'function'
      ? opts.ensureState
      : function() { return { modules: {}, deletedBaselineModuleKeys: [], deletedBaselineCaseKeys: [] }; };
    var getHostState = typeof opts.getHostState === 'function' ? opts.getHostState : null;
    var stepRequirement = Number(opts.stepRequirement || 1) || 1;
    var stepOptions = Number(opts.stepOptions || 3) || 3;
    var buildBaselineModuleDeleteKey = typeof opts.buildBaselineModuleDeleteKey === 'function'
      ? opts.buildBaselineModuleDeleteKey
      : function(value) { return String(value || '').trim(); };
    var buildBaselineCaseDeleteKey = typeof opts.buildBaselineCaseDeleteKey === 'function'
      ? opts.buildBaselineCaseDeleteKey
      : function(moduleTitle, caseSignature) {
        var moduleKey = buildBaselineModuleDeleteKey(moduleTitle);
        var signature = String(caseSignature || '').trim();
        return moduleKey && signature ? (moduleKey + '::' + signature) : '';
      };
    var normalizeUniqueStringList = typeof opts.normalizeUniqueStringList === 'function'
      ? opts.normalizeUniqueStringList
      : function(list) {
        var seen = {};
        return (Array.isArray(list) ? list : []).map(function(item) {
          return String(item || '').trim();
        }).filter(function(item) {
          if (!item || seen[item]) return false;
          seen[item] = true;
          return true;
        });
      };
    var createDefaultKnowledgeBaseState = typeof opts.createDefaultKnowledgeBaseState === 'function'
      ? opts.createDefaultKnowledgeBaseState
      : function() { return {}; };
    var createDefaultDedupeState = typeof opts.createDefaultDedupeState === 'function'
      ? opts.createDefaultDedupeState
      : function() { return {}; };
    var createDefaultCoverageState = typeof opts.createDefaultCoverageState === 'function'
      ? opts.createDefaultCoverageState
      : function() { return {}; };
    var createDefaultViewState = typeof opts.createDefaultViewState === 'function'
      ? opts.createDefaultViewState
      : function() { return {}; };
    var createDefaultRootState = typeof opts.createDefaultRootState === 'function'
      ? opts.createDefaultRootState
      : function() { return {}; };
    var createDefaultPrepState = typeof opts.createDefaultPrepState === 'function'
      ? opts.createDefaultPrepState
      : function() { return { step: stepRequirement }; };
    var normalizeStoredViewState = typeof opts.normalizeStoredViewState === 'function'
      ? opts.normalizeStoredViewState
      : function(value) { return value && typeof value === 'object' ? value : {}; };
    var normalizeCoverageState = typeof opts.normalizeCoverageState === 'function'
      ? opts.normalizeCoverageState
      : function(value) { return value && typeof value === 'object' ? value : createDefaultCoverageState(); };
    var hasImportedBaselineCases = typeof opts.hasImportedBaselineCases === 'function'
      ? opts.hasImportedBaselineCases
      : function() { return false; };
    var normalizeInlineStatusType = typeof opts.normalizeInlineStatusType === 'function'
      ? opts.normalizeInlineStatusType
      : function(value) { return String(value || ''); };
    var normalizeKnowledgeBaseState = typeof opts.normalizeKnowledgeBaseState === 'function'
      ? opts.normalizeKnowledgeBaseState
      : function(value) { return value && typeof value === 'object' ? value : createDefaultKnowledgeBaseState(); };
    var normalizeRootPipelineDedupeModules = typeof opts.normalizeRootPipelineDedupeModules === 'function'
      ? opts.normalizeRootPipelineDedupeModules
      : function(list) { return Array.isArray(list) ? list : []; };
    var normalizeFallbackCaseList = typeof opts.normalizeFallbackCaseList === 'function'
      ? opts.normalizeFallbackCaseList
      : function(list) { return Array.isArray(list) ? list : []; };
    var normalizeModuleKey = typeof opts.normalizeModuleKey === 'function'
      ? opts.normalizeModuleKey
      : function(value) { return String(value || '').trim(); };

    function createInitialRuntimeState() {
      return {
        activeWorkspaceId: '',
        mirrorWorkspaceId: '',
        workspaceOrder: [],
        workspaces: {},
        nextWorkspaceSeq: 1,
        mode: 'modules',
        treeSourceSignature: '',
        hasModuleSkeleton: false,
        hasImportedBaseline: false,
        openButtonDotVisible: false,
        historyUnread: false,
        knowledgeBase: createDefaultKnowledgeBaseState(),
        dedupe: createDefaultDedupeState(),
        coverage: createDefaultCoverageState(),
        viewState: createDefaultViewState(),
        history: [],
        operationSnapshots: [],
        lastOperationSnapshotId: '',
        rootSnapshotId: '',
        rootSnapshots: [],
        deletedBaselineModuleKeys: [],
        deletedBaselineCaseKeys: [],
        deleteUndoStack: [],
        deleteRedoStack: [],
        root: createDefaultRootState(),
        summaryCollapsed: false,
        prep: createDefaultPrepState(),
        nextSnapshotId: 1,
        snapshots: [],
        modules: {},
      };
    }

    function normalizeNonNegativeNumber(value) {
      var number = Number(value || 0);
      return Number.isFinite(number) && number >= 0 ? number : 0;
    }

    function normalizeRootPipeline(pipeline) {
      if (!pipeline || typeof pipeline !== 'object') return null;
      pipeline.id = String(pipeline.id || '');
      pipeline.actionId = String(pipeline.actionId || '');
      pipeline.snapshotId = String(pipeline.snapshotId || '');
      pipeline.historyActionLabel = String(pipeline.historyActionLabel || '');
      pipeline.stage = String(pipeline.stage || '');
      pipeline.discoveryStatus = String(pipeline.discoveryStatus || '');
      pipeline.cancelReason = String(pipeline.cancelReason || '');
      pipeline.hadAiContentBeforeAction = pipeline.hadAiContentBeforeAction === true;
      pipeline.hadAiLayerBeforeAction = pipeline.hadAiLayerBeforeAction === true;
      pipeline.hadAiCasesBeforeAction = pipeline.hadAiCasesBeforeAction === true;
      pipeline.cancelled = pipeline.cancelled === true;
      pipeline.errorCount = normalizeNonNegativeNumber(pipeline.errorCount);
      pipeline.createdModules = normalizeNonNegativeNumber(pipeline.createdModules);
      pipeline.addedCases = normalizeNonNegativeNumber(pipeline.addedCases);
      pipeline.moduleTaskTotal = normalizeNonNegativeNumber(pipeline.moduleTaskTotal);
      pipeline.moduleTaskCompleted = normalizeNonNegativeNumber(pipeline.moduleTaskCompleted);
      pipeline.updatedAt = normalizeNonNegativeNumber(pipeline.updatedAt);
      if (!pipeline.detailMap || typeof pipeline.detailMap !== 'object') pipeline.detailMap = {};
      if (!Array.isArray(pipeline.diagnostics)) pipeline.diagnostics = [];
      pipeline.generatedDedupeModules = normalizeRootPipelineDedupeModules(pipeline.generatedDedupeModules || []);
      if (!Array.isArray(pipeline.moduleTaskCompletedKeys)) {
        pipeline.moduleTaskCompletedKeys = [];
      } else {
        pipeline.moduleTaskCompletedKeys = normalizeUniqueStringList(pipeline.moduleTaskCompletedKeys);
      }
      if (pipeline.moduleTaskCompletedKeys.length > pipeline.moduleTaskCompleted) {
        pipeline.moduleTaskCompleted = pipeline.moduleTaskCompletedKeys.length;
      }
      if (!Array.isArray(pipeline.pendingQueue)) {
        pipeline.pendingQueue = [];
      } else {
        pipeline.pendingQueue = pipeline.pendingQueue.map(function(item) {
          if (!item || typeof item !== 'object') return null;
          return {
            moduleId: String(item.moduleId || ''),
            moduleKey: String(item.moduleKey || ''),
            moduleTitle: String(item.moduleTitle || ''),
            actionId: String(item.actionId || ''),
            rootPendingActionId: String(item.rootPendingActionId || ''),
            rootPipelineNewModule: item.rootPipelineNewModule === true,
            forceCreatedModuleBeforeAction: item.forceCreatedModuleBeforeAction === true,
            anchorNodeId: String(item.anchorNodeId || ''),
            fallbackCases: normalizeFallbackCaseList(item.fallbackCases, String(item.moduleTitle || '')),
          };
        }).filter(Boolean);
      }
      return pipeline;
    }

    function normalizePrepState(prep) {
      prep.step = Math.max(stepRequirement, Math.min(stepOptions, Number(prep.step) || stepRequirement));
      prep.requirementMode = prep.requirementMode === 'manual'
        ? 'manual'
        : (prep.requirementMode === 'document' ? 'document' : '');
      prep.requirementSupplement = String(prep.requirementSupplement || '');
      prep.manualRequirementLabel = String(prep.manualRequirementLabel || '').trim();
      if (!Array.isArray(prep.manualRequirementBlocks)) prep.manualRequirementBlocks = [];
      prep.caseImportMode = prep.caseImportMode === 'import'
        ? 'import'
        : (prep.caseImportMode === 'skip' ? 'skip' : '');
      prep.baseLocked = prep.baseLocked === true || prep.completed === true;
      prep.completed = prep.completed === true;
    }

    function ensureState() {
      if (!getHostState) return ensureStatePort();
      var hostState = getHostState();
      if (!hostState || typeof hostState !== 'object') return createInitialRuntimeState();
      if (!hostState.xmindCaseGen || typeof hostState.xmindCaseGen !== 'object') {
        hostState.xmindCaseGen = createInitialRuntimeState();
      }
      var runtimeState = hostState.xmindCaseGen;
      if (!Array.isArray(runtimeState.history)) runtimeState.history = [];
      if (!Array.isArray(runtimeState.operationSnapshots)) runtimeState.operationSnapshots = [];
      if (!Array.isArray(runtimeState.rootSnapshots)) runtimeState.rootSnapshots = [];
      if (!Array.isArray(runtimeState.workspaceOrder)) runtimeState.workspaceOrder = [];
      if (!runtimeState.workspaces || typeof runtimeState.workspaces !== 'object') runtimeState.workspaces = {};
      if (!runtimeState.viewState || typeof runtimeState.viewState !== 'object') {
        runtimeState.viewState = createDefaultViewState();
      }
      runtimeState.viewState = normalizeStoredViewState(runtimeState.viewState, {
        drawerOpen: runtimeState.viewState.drawerOpen === true,
        fullscreen: runtimeState.viewState.fullscreen === true,
      });
      if (!Array.isArray(runtimeState.deletedBaselineModuleKeys)) runtimeState.deletedBaselineModuleKeys = [];
      if (!Array.isArray(runtimeState.deletedBaselineCaseKeys)) runtimeState.deletedBaselineCaseKeys = [];
      if (!Array.isArray(runtimeState.deleteUndoStack)) runtimeState.deleteUndoStack = [];
      if (!Array.isArray(runtimeState.deleteRedoStack)) runtimeState.deleteRedoStack = [];
      if (!Array.isArray(runtimeState.snapshots)) runtimeState.snapshots = [];
      if (!runtimeState.modules || typeof runtimeState.modules !== 'object') runtimeState.modules = {};
      if (!runtimeState.root || typeof runtimeState.root !== 'object') runtimeState.root = createDefaultRootState();
      if (!runtimeState.prep || typeof runtimeState.prep !== 'object') runtimeState.prep = createDefaultPrepState();
      if (!runtimeState.dedupe || typeof runtimeState.dedupe !== 'object') {
        runtimeState.dedupe = createDefaultDedupeState();
      }
      runtimeState.dedupe.running = runtimeState.dedupe.running === true;
      runtimeState.dedupe.taskId = String(runtimeState.dedupe.taskId || '');
      runtimeState.dedupe.status = String(runtimeState.dedupe.status || '');
      runtimeState.dedupe.error = String(runtimeState.dedupe.error || '');
      runtimeState.dedupe.updatedAt = Number(runtimeState.dedupe.updatedAt || 0) || 0;
      runtimeState.coverage = normalizeCoverageState(runtimeState.coverage);
      if (!Number.isFinite(Number(runtimeState.nextSnapshotId))) runtimeState.nextSnapshotId = 1;
      if (!Number.isFinite(Number(runtimeState.nextWorkspaceSeq))) runtimeState.nextWorkspaceSeq = 1;
      runtimeState.activeWorkspaceId = String(runtimeState.activeWorkspaceId || '');
      runtimeState.mirrorWorkspaceId = String(runtimeState.mirrorWorkspaceId || '');
      runtimeState.mode = runtimeState.mode === 'full' ? 'full' : 'modules';
      runtimeState.treeSourceSignature = String(runtimeState.treeSourceSignature || '');
      runtimeState.hasModuleSkeleton = Array.isArray(hostState.caseGenModules) && hostState.caseGenModules.length > 0;
      runtimeState.hasImportedBaseline = hasImportedBaselineCases();
      runtimeState.summaryResultKind = runtimeState.summaryResultKind === 'error' ? 'error' : '';
      runtimeState.inlineStatusText = String(runtimeState.inlineStatusText || '');
      runtimeState.inlineStatusType = normalizeInlineStatusType(runtimeState.inlineStatusType || '');
      runtimeState.openButtonDotVisible = runtimeState.openButtonDotVisible === true;
      runtimeState.historyUnread = runtimeState.historyUnread === true;
      runtimeState.knowledgeBase = normalizeKnowledgeBaseState(runtimeState.knowledgeBase);
      runtimeState.workspaceOrder = runtimeState.workspaceOrder.map(function(item) {
        return String(item || '').trim();
      }).filter(Boolean);
      runtimeState.lastOperationSnapshotId = String(runtimeState.lastOperationSnapshotId || '');
      runtimeState.rootSnapshotId = String(runtimeState.rootSnapshotId || '');
      runtimeState.root.taskId = String(runtimeState.root.taskId || '');
      runtimeState.root.pipeline = normalizeRootPipeline(runtimeState.root.pipeline);
      runtimeState.deletedBaselineModuleKeys = runtimeState.deletedBaselineModuleKeys
        .map(function(item) { return normalizeModuleKey(item); })
        .filter(Boolean);
      runtimeState.deletedBaselineCaseKeys = runtimeState.deletedBaselineCaseKeys
        .map(function(item) { return String(item || '').trim(); })
        .filter(Boolean);
      runtimeState.root.hideAiLayer = runtimeState.root.hideAiLayer === true;
      runtimeState.summaryCollapsed = runtimeState.summaryCollapsed === true;
      normalizePrepState(runtimeState.prep);
      Object.keys(runtimeState.modules).forEach(function(key) {
        var moduleState = runtimeState.modules[key];
        if (!moduleState || typeof moduleState !== 'object') return;
        moduleState.taskId = String(moduleState.taskId || '');
      });
      return runtimeState;
    }

    function ensureModuleUiState(moduleId) {
      var rootState = ensureState();
      var key = String(moduleId || '');
      if (!key) return null;
      if (!rootState.modules || typeof rootState.modules !== 'object') rootState.modules = {};
      if (!rootState.modules[key] || typeof rootState.modules[key] !== 'object') {
        rootState.modules[key] = {
          lastAction: '',
          running: false,
          taskId: '',
          rootPendingActionId: '',
          snapshotId: '',
          status: '',
          error: '',
          hideResults: false,
          updatedAt: 0,
          topupHighlight: null,
          rollbackRestoreTopupHighlight: null,
        };
      }
      return rootState.modules[key];
    }

    function buildDeletedBaselineModuleMapFromList(list) {
      var map = Object.create(null);
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var key = buildBaselineModuleDeleteKey(item);
        if (key) map[key] = true;
      });
      return map;
    }

    function buildDeletedBaselineCaseMapFromList(list) {
      var map = Object.create(null);
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var key = String(item || '').trim();
        if (key) map[key] = true;
      });
      return map;
    }

    function getDeletedBaselineModuleMap() {
      return buildDeletedBaselineModuleMapFromList(ensureState().deletedBaselineModuleKeys);
    }

    function getDeletedBaselineCaseMap() {
      return buildDeletedBaselineCaseMapFromList(ensureState().deletedBaselineCaseKeys);
    }

    function rememberDeletedBaselineModule(moduleTitle) {
      var key = buildBaselineModuleDeleteKey(moduleTitle);
      var xmindState = ensureState();
      if (!key) return false;
      if (!Array.isArray(xmindState.deletedBaselineModuleKeys)) xmindState.deletedBaselineModuleKeys = [];
      if (!Array.isArray(xmindState.deletedBaselineCaseKeys)) xmindState.deletedBaselineCaseKeys = [];
      if (xmindState.deletedBaselineModuleKeys.indexOf(key) !== -1) return false;
      xmindState.deletedBaselineModuleKeys.push(key);
      xmindState.deletedBaselineModuleKeys = normalizeUniqueStringList(xmindState.deletedBaselineModuleKeys);
      xmindState.deletedBaselineCaseKeys = normalizeUniqueStringList(xmindState.deletedBaselineCaseKeys.filter(function(item) {
        return String(item || '').indexOf(key + '::') !== 0;
      }));
      return true;
    }

    function rememberDeletedBaselineCase(moduleTitle, caseSignature) {
      var key = buildBaselineCaseDeleteKey(moduleTitle, caseSignature);
      var xmindState = ensureState();
      if (!key) return false;
      if (!Array.isArray(xmindState.deletedBaselineCaseKeys)) xmindState.deletedBaselineCaseKeys = [];
      if (xmindState.deletedBaselineCaseKeys.indexOf(key) !== -1) return false;
      xmindState.deletedBaselineCaseKeys.push(key);
      xmindState.deletedBaselineCaseKeys = normalizeUniqueStringList(xmindState.deletedBaselineCaseKeys);
      return true;
    }

    return {
      buildDeletedBaselineCaseMapFromList: buildDeletedBaselineCaseMapFromList,
      buildDeletedBaselineModuleMapFromList: buildDeletedBaselineModuleMapFromList,
      ensureState: ensureState,
      ensureModuleUiState: ensureModuleUiState,
      getDeletedBaselineCaseMap: getDeletedBaselineCaseMap,
      getDeletedBaselineModuleMap: getDeletedBaselineModuleMap,
      rememberDeletedBaselineCase: rememberDeletedBaselineCase,
      rememberDeletedBaselineModule: rememberDeletedBaselineModule,
    };
  }

  return { create: create };
});
