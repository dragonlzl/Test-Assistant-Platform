(function(root, factory) {
  var defaultContractModel = root && root.app ? root.app.xmindDedupeContractModel : null;
  if (typeof module !== 'undefined' && module.exports) {
    defaultContractModel = require('../../core/xmindDedupeContractModel.js');
  }
  var api = factory(defaultContractModel);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenTaskRequestController = api;
  }
})(typeof window !== 'undefined' ? window : null, function(defaultContractModel) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var dedupeActionId = String(opts.dedupeActionId || 'xmind-ai-dedupe');
    var coverageActionId = String(opts.coverageActionId || 'xmind-requirement-coverage');
    var dedupeStrength = String(opts.dedupeStrength || 'conservative');
    var dedupeContractModel = opts.dedupeContractModel || defaultContractModel;
    if (!dedupeContractModel || typeof dedupeContractModel.buildTaskOperationContract !== 'function') {
      throw new Error('xmindDedupeContractModel 未加载');
    }
    var cloneJson = typeof opts.cloneJson === 'function' ? opts.cloneJson : function(value, fallback) {
      if (value === undefined || value === null) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    };
    var getActiveWorkspaceId = typeof opts.getActiveWorkspaceId === 'function'
      ? opts.getActiveWorkspaceId : function() { return ''; };
    var normalizeModuleTitle = typeof opts.normalizeModuleTitle === 'function'
      ? opts.normalizeModuleTitle : function(value) { return String(value || '').trim(); };
    var normalizeFallbackCaseList = typeof opts.normalizeFallbackCaseList === 'function'
      ? opts.normalizeFallbackCaseList : function(value) { return cloneJson(value, []); };
    var normalizeDedupeMode = typeof opts.normalizeDedupeMode === 'function'
      ? opts.normalizeDedupeMode : function(value) { return String(value || 'dedupe_only'); };
    var isDedupeSimplifyMode = typeof opts.isDedupeSimplifyMode === 'function'
      ? opts.isDedupeSimplifyMode : function(value) { return String(value || '') === 'dedupe_simplify'; };
    var buildManagedTaskRestoreContext = typeof opts.buildManagedTaskRestoreContext === 'function'
      ? opts.buildManagedTaskRestoreContext : function() { return {}; };
    var getXmindTaskManager = typeof opts.getXmindTaskManager === 'function'
      ? opts.getXmindTaskManager : function() { return null; };

    function buildManagedTaskRequestEnvelope(payload, taskInput, workspaceId, optionsValue) {
      var envelopeOptions = optionsValue || {};
      return Object.assign({}, payload || {}, {
        prompt: String(taskInput && taskInput.prompt ? taskInput.prompt : ''),
        requestMode: envelopeOptions.forceText === true
          ? 'text'
          : String(taskInput && taskInput.requestMode ? taskInput.requestMode : 'text'),
        requestText: String(taskInput && taskInput.requestText ? taskInput.requestText : ''),
        contentBlocks: envelopeOptions.forceText === true ? [] : cloneJson(taskInput && taskInput.contentBlocks, []),
        degradedToTextOnly: envelopeOptions.forceText === true
          ? false
          : taskInput && taskInput.degradedToTextOnly === true,
        model: cloneJson(taskInput && taskInput.model, null),
        reasoning: String(taskInput && taskInput.reasoning ? taskInput.reasoning : ''),
        temperature: Number(taskInput && taskInput.temperature),
        restoreContext: buildManagedTaskRestoreContext({
          workspaceId: workspaceId,
          compact: true,
        }),
      });
    }

    function buildRootTaskPayload(actionId, taskInput, optionsValue) {
      var taskOptions = optionsValue || {};
      var taskWorkspaceId = String(taskOptions.workspaceId || getActiveWorkspaceId() || '');
      return buildManagedTaskRequestEnvelope({
        workspaceId: taskWorkspaceId,
        scope: 'root',
        actionId: actionId,
        snapshotId: String(taskOptions.snapshotId || ''),
        contract: cloneJson(taskOptions.contract, {}),
        historyActionLabel: String(taskOptions.historyActionLabel || ''),
        hadAiContentBeforeAction: taskOptions.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: taskOptions.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: taskOptions.hadAiCasesBeforeAction === true,
        rootPipelineId: String(taskOptions.rootPipelineId || ''),
        rootPipelineActionId: String(taskOptions.rootPipelineActionId || ''),
        pipelineStage: String(taskOptions.pipelineStage || ''),
        historySuppressed: taskOptions.historySuppressed === true,
        notifySuppressed: taskOptions.notifySuppressed === true,
        skipCoverageRetry: taskOptions.skipCoverageRetry === true,
      }, taskInput, taskWorkspaceId);
    }

    function buildModuleTaskPayload(moduleEntry, actionId, taskInput, optionsValue) {
      var taskOptions = optionsValue || {};
      var taskWorkspaceId = String(taskOptions.workspaceId || getActiveWorkspaceId() || '');
      return buildManagedTaskRequestEnvelope({
        workspaceId: taskWorkspaceId,
        scope: 'module',
        actionId: actionId,
        moduleId: String(taskOptions.moduleId || (moduleEntry && moduleEntry.aiModuleId) || ''),
        moduleKey: String(taskOptions.moduleKey || (moduleEntry && moduleEntry.moduleKey) || ''),
        moduleTitle: normalizeModuleTitle(taskOptions.moduleTitle || (moduleEntry && moduleEntry.title) || ''),
        snapshotId: String(taskOptions.snapshotId || ''),
        contract: cloneJson(taskOptions.contract, {}),
        historyActionLabel: String(taskOptions.historyActionLabel || ''),
        createdModuleBeforeAction: taskOptions.createdModuleBeforeAction === true,
        hadAiCasesBeforeAction: taskOptions.hadAiCasesBeforeAction === true,
        fallbackCases: normalizeFallbackCaseList(
          taskOptions.fallbackCases,
          taskOptions.moduleTitle || (moduleEntry && moduleEntry.title) || ''
        ),
        rootPipelineId: String(taskOptions.rootPipelineId || ''),
        rootPipelineActionId: String(taskOptions.rootPipelineActionId || ''),
        rootPipelineNewModule: taskOptions.rootPipelineNewModule === true,
        historySuppressed: taskOptions.historySuppressed === true,
        notifySuppressed: taskOptions.notifySuppressed === true,
      }, taskInput, taskWorkspaceId);
    }

    function buildDedupeTaskPayload(taskInput, optionsValue) {
      var taskOptions = optionsValue || {};
      var taskWorkspaceId = String(taskOptions.workspaceId || getActiveWorkspaceId() || '');
      var dedupeMode = normalizeDedupeMode(
        taskInput && taskInput.dedupeMode ? taskInput.dedupeMode : taskOptions.dedupeMode
      );
      return buildManagedTaskRequestEnvelope({
        workspaceId: taskWorkspaceId,
        scope: 'dedupe',
        actionId: dedupeActionId,
        dedupeSource: String(taskOptions.dedupeSource || 'manual-toolbar'),
        dedupeStrength: dedupeStrength,
        dedupeMode: dedupeMode,
        dedupeModules: cloneJson(taskInput && taskInput.modules, []),
        dedupeBatches: cloneJson(taskInput && taskInput.dedupeBatches, []),
        dedupeBeforeCount: Number(taskInput && taskInput.beforeCaseCount || 0),
        modelRequestBatch: cloneJson(taskInput && taskInput.modelRequestBatch, []),
        modelRequestBatchConcurrency: Number(taskInput && taskInput.modelRequestBatchConcurrency || 0),
        modelRequestBatchCompleted: 0,
        dedupeVisibleStartedAt: Number(taskOptions.dedupeVisibleStartedAt || 0) || 0,
        minVisibleUntil: Number(taskOptions.minVisibleUntil || 0) || 0,
        contract: dedupeContractModel.buildTaskOperationContract({
          dedupeMode: dedupeMode,
          strength: dedupeStrength,
        }),
        dedupePartialModulesResponseAllowed: taskInput && taskInput.partialModulesResponseAllowed === true,
        rootPipelineId: String(taskOptions.rootPipelineId || ''),
        rootPipelineActionId: String(taskOptions.rootPipelineActionId || ''),
        historySuppressed: taskOptions.historySuppressed === true,
        notifySuppressed: taskOptions.notifySuppressed === true,
      }, taskInput, taskWorkspaceId, { forceText: true });
    }

    function buildCoverageTaskPayload(taskInput, optionsValue) {
      var taskOptions = optionsValue || {};
      var taskWorkspaceId = String(taskOptions.workspaceId || getActiveWorkspaceId() || '');
      return buildManagedTaskRequestEnvelope({
        workspaceId: taskWorkspaceId,
        scope: 'coverage',
        actionId: coverageActionId,
        coverageSource: String(taskOptions.coverageSource || 'manual-toolbar'),
        coverageSignature: String(taskInput && taskInput.coverageSignature || ''),
        coverageRequest: cloneJson(taskInput && taskInput.coverageRequest, {}),
        segmentCount: Number(taskInput && taskInput.segmentCount || 0),
        caseCount: Number(taskInput && taskInput.caseCount || 0),
        contract: {
          scope: 'xmind_requirement_coverage',
          mode: 'requirement_coverage',
          caseScope: 'current_visible_cases',
          directRequirementCoverageOnly: true,
          preserveRequirementText: true,
        },
        historySuppressed: true,
        notifySuppressed: false,
      }, taskInput, taskWorkspaceId, { forceText: true });
    }

    function startManagedXmindTask(taskPayload) {
      var manager = getXmindTaskManager();
      if (!manager || typeof manager.createTask !== 'function' || typeof manager.startTask !== 'function') {
        throw new Error('XMind 后台任务能力未就绪，请刷新后重试');
      }
      var task = manager.createTask(taskPayload);
      manager.startTask(task, { force: true });
      return task;
    }

    return {
      buildCoverageTaskPayload: buildCoverageTaskPayload,
      buildDedupeTaskPayload: buildDedupeTaskPayload,
      buildManagedTaskRequestEnvelope: buildManagedTaskRequestEnvelope,
      buildModuleTaskPayload: buildModuleTaskPayload,
      buildRootTaskPayload: buildRootTaskPayload,
      startManagedXmindTask: startManagedXmindTask,
    };
  }

  return { create: create };
});
