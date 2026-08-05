(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenGenerationExecutionController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function defaultRunConcurrentTasks(items, concurrency, worker) {
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
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var ROOT_ACTIONS = opts.rootActions || {};
    var MODULE_ACTIONS = opts.moduleActions || {};
    var casesGenApi = opts.casesGenApi || {};
    var cloneJson = port('cloneJson', function(value, fallback) { return value === undefined ? fallback : value; });
    var getActiveWorkspaceId = port('getActiveWorkspaceId', function() { return ''; });
    var getRootNodeId = port('getRootNodeId', function() { return ''; });
    var getModuleNodeId = port('getModuleNodeId', function() { return ''; });
    var generateLocalId = port('generateLocalId', function(prefix) { return String(prefix || 'id') + '-' + String(Date.now()); });
    var createCaseGenOperationSnapshotLocal = port('createCaseGenOperationSnapshotLocal', function() { return ''; });
    var snapshotAllCaseGenStateLocal = port('snapshotAllCaseGenStateLocal', function() { return ''; });
    var rollbackAllCaseGenStateLocal = port('rollbackAllCaseGenStateLocal', function() { return false; });
    var getLatestCaseGenOperationSnapshotLocal = port('getLatestCaseGenOperationSnapshotLocal', function() { return null; });
    var rollbackCaseGenOperationSnapshotLocal = port('rollbackCaseGenOperationSnapshotLocal', function() { return false; });
    var ensureAiModuleRecord = port('ensureAiModuleRecord', function(title, raw, id) { return { id: id, module: title }; });
    var ensureRootUiState = port('ensureRootUiState', function() { return {}; });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return {}; });
    var ensureState = port('ensureState', function() { return {}; });
    var hasAiCasesForModule = port('hasAiCasesForModule', function() { return false; });
    var hasAnyAiModules = port('hasAnyAiModules', function() { return false; });
    var hasAnyAiCases = port('hasAnyAiCases', function() { return false; });
    var getModuleHistoryActionLabel = port('getModuleHistoryActionLabel', function() { return ''; });
    var getRootHistoryActionLabel = port('getRootHistoryActionLabel', function() { return ''; });
    var clearModuleTopupHighlight = port('clearModuleTopupHighlight');
    var clearAllTopupHighlights = port('clearAllTopupHighlights');
    var clearDedupeOverviewSummary = port('clearDedupeOverviewSummary');
    var setModuleRootPendingAction = port('setModuleRootPendingAction');
    var clearDeleteHistoryStacks = port('clearDeleteHistoryStacks');
    var setAllModuleResultsVisibility = port('setAllModuleResultsVisibility');
    var markRootPendingModules = port('markRootPendingModules');
    var flushLightweightMindStatus = port('flushLightweightMindStatus');
    var scheduleRenderedRootMindStatusBadgeRefresh = port('scheduleRenderedRootMindStatusBadgeRefresh');
    var queueStructureMindRender = port('queueStructureMindRender');
    var queueStatusMindRender = port('queueStatusMindRender');
    var render = port('render');
    var notifyStatus = port('notifyStatus');
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeFallbackCaseList = port('normalizeFallbackCaseList', function(value) { return Array.isArray(value) ? value : []; });
    var normalizeUniqueStringList = port('normalizeUniqueStringList', function(value) { return Array.isArray(value) ? value : []; });
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { list: [], map: {} }; });
    var ensureVisibleModuleContext = port('ensureVisibleModuleContext', function(value) { return value || { list: [], map: {} }; });
    var buildVisibleModuleSnapshot = port('buildVisibleModuleSnapshot', function(value) { return value && value.list ? value.list : []; });
    var getGenerationPayloadCore = port('getGenerationPayloadCore', function() {
      return typeof window !== 'undefined' && window.app ? window.app.xmindGenerationPayloadCore : null;
    });
    var createOperationContract = port('createOperationContract', function(actionId) { return { actionId: actionId }; });
    var applyImportedBaselineCompletionPolicy = port('applyImportedBaselineCompletionPolicy', function(value) { return value; });
    var applyExistingCasesCompletionPolicy = port('applyExistingCasesCompletionPolicy', function(value) { return value; });
    var buildXmindGenerationTaskInput = port('buildXmindGenerationTaskInput', function() { return Promise.resolve({}); });
    var buildModuleTaskPayload = port('buildModuleTaskPayload', function(entry, actionId, input, meta) { return meta || {}; });
    var buildRootTaskPayload = port('buildRootTaskPayload', function(actionId, input, meta) { return meta || {}; });
    var startManagedXmindTask = port('startManagedXmindTask', function() { return null; });
    var persistXmindState = port('persistXmindState');
    var completeModuleTaskError = port('completeModuleTaskError', function() { return false; });
    var completeRootTaskError = port('completeRootTaskError', function() { return false; });
    var createRootPipelineState = port('createRootPipelineState', function(value) { return value || {}; });
    var getRootPipelineState = port('getRootPipelineState', function() { return null; });
    var setRootPipelineState = port('setRootPipelineState');
    var clearRootPipelineState = port('clearRootPipelineState');
    var updateRootPipelineState = port('updateRootPipelineState');
    var replaceRootPipelinePendingQueue = port('replaceRootPipelinePendingQueue');
    var shiftRootPipelinePendingDescriptor = port('shiftRootPipelinePendingDescriptor', function() { return null; });
    var resolveRootPipelineDescriptor = port('resolveRootPipelineDescriptor', function() { return null; });
    var collectRootPipelineRunningTasks = port('collectRootPipelineRunningTasks', function() { return []; });
    var appendRootPipelineDiagnostics = port('appendRootPipelineDiagnostics');
    var normalizeRootPipelineTaskCount = port('normalizeRootPipelineTaskCount', function(value) { return Number(value || 0) || 0; });
    var runConcurrentTasks = port('runConcurrentTasks', defaultRunConcurrentTasks);
    var shouldUseRootPipeline = port('shouldUseRootPipeline', function() { return false; });
    var ensureActionAllowed = port('ensureActionAllowed', function() { return true; });
    var ensurePrepReadyOrOpen = port('ensurePrepReadyOrOpen', function() { return true; });
    var hideOpenMindContextMenu = port('hideOpenMindContextMenu');
    var isDeleteActionId = port('isDeleteActionId', function() { return false; });
    var handleDeleteSelection = port('handleDeleteSelection');
    var resolveModuleEntryByMeta = port('resolveModuleEntryByMeta', function() { return null; });
    var rootPipelinePumpMap = {};

    async function startManagedModuleTask(moduleEntry, actionId, taskOptions) {
      var actionOptions = taskOptions || {};
      if (!moduleEntry) return null;
      var taskWorkspaceId = String(actionOptions.workspaceId || getActiveWorkspaceId() || '');
      var anchorNodeId = Object.prototype.hasOwnProperty.call(actionOptions, 'anchorNodeId')
        ? String(actionOptions.anchorNodeId || '')
        : getModuleNodeId(moduleEntry);
      var moduleId = moduleEntry.aiModuleId || generateLocalId('xmind-mod');
      var createdModuleRecordBeforeTask = !moduleEntry.aiModuleId;
      var snapshotId = '';

      if (actionOptions.skipSnapshot !== true) {
        if (casesGenApi && typeof casesGenApi.snapshotModuleCases === 'function') {
          snapshotId = casesGenApi.snapshotModuleCases(moduleId) || '';
        } else {
          snapshotId = createCaseGenOperationSnapshotLocal('module', moduleId) || '';
        }
      }

      if (createdModuleRecordBeforeTask) {
        moduleEntry.aiModule = ensureAiModuleRecord(moduleEntry.title, {
          module: moduleEntry.title,
        }, moduleId);
        moduleEntry.aiModuleId = moduleEntry.aiModule.id;
      }

      var moduleState = ensureModuleUiState(moduleEntry.aiModuleId);
      var hadAiCasesBeforeAction = actionId === MODULE_ACTIONS.FULL_CASES && hasAiCasesForModule(moduleEntry.aiModuleId);
      var historyActionLabel = getModuleHistoryActionLabel(actionId, moduleEntry, hadAiCasesBeforeAction);
      moduleState.snapshotId = snapshotId;
      moduleState.lastAction = actionId;
      moduleState.running = true;
      moduleState.taskId = '';
      moduleState.status = '';
      moduleState.error = '';
      moduleState.updatedAt = Date.now();
      moduleState.hideResults = hadAiCasesBeforeAction;
      clearModuleTopupHighlight(moduleState);
      clearDedupeOverviewSummary({ clearTerminalVisual: true });
      if (actionOptions.rootPendingActionId) {
        setModuleRootPendingAction(moduleState, actionOptions.rootPendingActionId);
      }
      var moduleRunningRenderOptions = {
        reason: actionOptions.renderReason || 'module-running',
        anchorNodeId: anchorNodeId,
        persist: false,
      };
      if (
        createdModuleRecordBeforeTask
        || hadAiCasesBeforeAction
        || actionId === MODULE_ACTIONS.APPEND
        || actionOptions.rootPendingActionId
      ) {
        queueStructureMindRender(moduleRunningRenderOptions);
      } else {
        queueStatusMindRender(moduleRunningRenderOptions);
      }

      var moduleTaskMeta = {
        scope: 'module',
        workspaceId: taskWorkspaceId,
        actionId: actionId,
        moduleId: String(moduleEntry.aiModuleId || moduleId || ''),
        moduleKey: String(moduleEntry.moduleKey || ''),
        moduleTitle: normalizeModuleTitle(moduleEntry.title || ''),
        snapshotId: snapshotId,
        createdModuleBeforeAction: Object.prototype.hasOwnProperty.call(actionOptions, 'forceCreatedModuleBeforeAction')
          ? actionOptions.forceCreatedModuleBeforeAction === true
          : createdModuleRecordBeforeTask,
        hadAiCasesBeforeAction: hadAiCasesBeforeAction,
        fallbackCases: normalizeFallbackCaseList(actionOptions.fallbackCases, moduleEntry.title || ''),
        rootPipelineId: String(actionOptions.rootPipelineId || ''),
        rootPipelineActionId: String(actionOptions.rootPipelineActionId || ''),
        rootPipelineNewModule: actionOptions.rootPipelineNewModule === true,
        historySuppressed: actionOptions.historySuppressed === true,
        notifySuppressed: actionOptions.notifySuppressed === true,
      };

      try {
        var visibleContext = ensureVisibleModuleContext(buildVisibleModuleContext());
        var visibleContextMap = visibleContext.map || {};
        var resolvedEntry = visibleContextMap[moduleEntry.moduleKey] || moduleEntry;
        var contract = actionOptions.contractOverride || createOperationContract(actionId, resolvedEntry);
        if (
          String(actionOptions.rootPipelineActionId || '') === ROOT_ACTIONS.APPEND_ALL
          && actionOptions.rootPipelineNewModule !== true
          && (actionId === MODULE_ACTIONS.APPEND || actionId === MODULE_ACTIONS.FULL_CASES)
        ) {
          contract = applyImportedBaselineCompletionPolicy(contract);
        }
        if (
          String(actionOptions.rootPipelineActionId || '') === ROOT_ACTIONS.EXISTING_CASES
          && (actionId === MODULE_ACTIONS.APPEND || actionId === MODULE_ACTIONS.FULL_CASES)
        ) {
          contract = applyExistingCasesCompletionPolicy(contract);
        }
        var historyModuleTitle = normalizeModuleTitle(resolvedEntry && resolvedEntry.title ? resolvedEntry.title : moduleEntry.title);
        moduleTaskMeta.contract = cloneJson(contract, {});
        moduleTaskMeta.historyActionLabel = historyActionLabel;
        moduleTaskMeta.moduleTitle = historyModuleTitle;
        moduleTaskMeta.moduleKey = String(resolvedEntry && resolvedEntry.moduleKey ? resolvedEntry.moduleKey : moduleEntry.moduleKey || '');
        moduleTaskMeta.moduleId = String(resolvedEntry && resolvedEntry.aiModuleId ? resolvedEntry.aiModuleId : moduleEntry.aiModuleId || moduleId || '');
        var knowledgeBaseActionKey = actionOptions.knowledgeBaseActionKey
          ? String(actionOptions.knowledgeBaseActionKey || '')
          : String(actionOptions.rootPipelineId || '');
        var moduleTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, resolvedEntry, {
          workspaceId: taskWorkspaceId,
          knowledgeBaseActionKey: knowledgeBaseActionKey,
          visibleModulesSnapshot: actionOptions.visibleModulesSnapshot,
        });
        var moduleTask = startManagedXmindTask(buildModuleTaskPayload(resolvedEntry, actionId, moduleTaskInput, moduleTaskMeta));
        moduleState.taskId = String(moduleTask && moduleTask.id ? moduleTask.id : '');
        moduleState.updatedAt = Date.now();
        persistXmindState(true);
        return {
          task: moduleTask,
          moduleEntry: resolvedEntry,
          moduleState: moduleState,
        };
      } catch (err) {
        completeModuleTaskError(moduleTaskMeta, err, { renderReason: 'module-start-error' });
        return null;
      }
    }

    async function pumpRootPipelineModuleQueue(pipelineId, pumpOptions) {
      var targetId = String(pipelineId || '');
      var queueOptions = pumpOptions || {};
      if (!targetId) return 0;
      if (rootPipelinePumpMap[targetId]) return rootPipelinePumpMap[targetId];
      var pumpPromise = Promise.resolve().then(async function() {
        var pipeline = getRootPipelineState();
        if (!pipeline || String(pipeline.id || '') !== targetId) return 0;
        if (pipeline.cancelled === true) {
          replaceRootPipelinePendingQueue(targetId, []);
          return 0;
        }
        var runningTasks = collectRootPipelineRunningTasks(targetId);
        if (runningTasks.length > 0) return 0;
        var visibleContext = buildVisibleModuleContext();
        while (true) {
          var nextSerialized = shiftRootPipelinePendingDescriptor(targetId);
          if (!nextSerialized) return 0;
          var descriptor = resolveRootPipelineDescriptor(nextSerialized, visibleContext);
          if (!descriptor || !descriptor.moduleEntry || !descriptor.actionId) {
            updateRootPipelineState(function(current) {
              if (String(current.id || '') !== targetId) return;
              appendRootPipelineDiagnostics(current, '有 1 个待生成模块在当前画布中已不可用，已自动跳过');
            });
            visibleContext = buildVisibleModuleContext();
            continue;
          }
          var started = await startManagedModuleTask(descriptor.moduleEntry, descriptor.actionId, {
            workspaceId: String(queueOptions.workspaceId || getActiveWorkspaceId() || ''),
            skipSnapshot: true,
            historySuppressed: true,
            notifySuppressed: true,
            fallbackCases: normalizeFallbackCaseList(
              descriptor.fallbackCases,
              descriptor.moduleEntry && descriptor.moduleEntry.title ? descriptor.moduleEntry.title : ''
            ),
            rootPipelineId: pipeline && pipeline.id ? pipeline.id : '',
            rootPipelineActionId: pipeline && pipeline.actionId ? pipeline.actionId : '',
            rootPipelineNewModule: descriptor.rootPipelineNewModule === true,
            rootPendingActionId: descriptor.rootPendingActionId || '',
            forceCreatedModuleBeforeAction: descriptor.forceCreatedModuleBeforeAction === true,
            anchorNodeId: Object.prototype.hasOwnProperty.call(descriptor, 'anchorNodeId')
              ? String(descriptor.anchorNodeId || '')
              : '',
            renderReason: 'root-pipeline-module-running',
          });
          if (started && started.task && started.task.id) return 1;
          visibleContext = buildVisibleModuleContext();
        }
      }).finally(function() {
        delete rootPipelinePumpMap[targetId];
      });
      rootPipelinePumpMap[targetId] = pumpPromise;
      return pumpPromise;
    }

    async function startRootPipelineModuleTasks(pipeline, descriptors, taskOptions) {
      var list = Array.isArray(descriptors) ? descriptors : [];
      var targetId = pipeline && pipeline.id ? String(pipeline.id || '') : '';
      var taskWorkspaceId = String(
        taskOptions && taskOptions.workspaceId
          ? taskOptions.workspaceId
          : (getActiveWorkspaceId() || '')
      );
      if (!targetId) return 0;
      replaceRootPipelinePendingQueue(targetId, []);
      var validList = list.filter(function(descriptor) {
        return Boolean(descriptor && descriptor.moduleEntry && descriptor.actionId);
      });
      if (!validList.length) return 0;
      var frozenVisibleModulesSnapshot = buildVisibleModuleSnapshot(buildVisibleModuleContext());
      var payloadCore = getGenerationPayloadCore();
      if (payloadCore && typeof payloadCore.buildCompactVisibleModules === 'function') {
        frozenVisibleModulesSnapshot = payloadCore.buildCompactVisibleModules(frozenVisibleModulesSnapshot);
      }
      updateRootPipelineState(function(current) {
        if (String(current.id || '') !== targetId) return;
        current.moduleTaskTotal = Math.max(normalizeRootPipelineTaskCount(current.moduleTaskTotal), validList.length);
        current.moduleTaskCompletedKeys = normalizeUniqueStringList(current.moduleTaskCompletedKeys || []);
        current.moduleTaskCompleted = Math.max(
          normalizeRootPipelineTaskCount(current.moduleTaskCompleted),
          current.moduleTaskCompletedKeys.length
        );
      });
      var startedResults = await runConcurrentTasks(validList, validList.length || 1, async function(descriptor) {
        return await startManagedModuleTask(descriptor.moduleEntry, descriptor.actionId, {
          workspaceId: taskWorkspaceId,
          skipSnapshot: true,
          historySuppressed: true,
          notifySuppressed: true,
          fallbackCases: normalizeFallbackCaseList(
            descriptor.fallbackCases,
            descriptor.moduleEntry && descriptor.moduleEntry.title ? descriptor.moduleEntry.title : ''
          ),
          rootPipelineId: pipeline && pipeline.id ? pipeline.id : '',
          rootPipelineActionId: pipeline && pipeline.actionId ? pipeline.actionId : '',
          rootPipelineNewModule: descriptor.rootPipelineNewModule === true,
          rootPendingActionId: descriptor.rootPendingActionId || '',
          forceCreatedModuleBeforeAction: descriptor.forceCreatedModuleBeforeAction === true,
          anchorNodeId: Object.prototype.hasOwnProperty.call(descriptor, 'anchorNodeId')
            ? String(descriptor.anchorNodeId || '')
            : '',
          renderReason: 'root-pipeline-module-running',
          visibleModulesSnapshot: frozenVisibleModulesSnapshot,
        });
      });
      return (Array.isArray(startedResults) ? startedResults : []).filter(function(item) {
        return Boolean(item && item.task && item.task.id);
      }).length;
    }

    async function startRootPipeline(actionId, rootTaskMeta, visibleContext) {
      var rootState = ensureRootUiState();
      var taskWorkspaceId = String(
        rootTaskMeta && rootTaskMeta.workspaceId
          ? rootTaskMeta.workspaceId
          : (getActiveWorkspaceId() || '')
      );
      var pipeline = createRootPipelineState({
        actionId: actionId,
        snapshotId: rootTaskMeta && rootTaskMeta.snapshotId ? String(rootTaskMeta.snapshotId || '') : '',
        historyActionLabel: rootTaskMeta && rootTaskMeta.historyActionLabel ? String(rootTaskMeta.historyActionLabel || '') : '',
        hadAiContentBeforeAction: rootTaskMeta && rootTaskMeta.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: rootTaskMeta && rootTaskMeta.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: rootTaskMeta && rootTaskMeta.hadAiCasesBeforeAction === true,
        stage: 'discovering',
        discoveryStatus: 'running',
      });
      setRootPipelineState(pipeline);

      var contract = rootTaskMeta && rootTaskMeta.contract
        ? cloneJson(rootTaskMeta.contract, {})
        : createOperationContract(actionId, null);
      var rootTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, null, {
        workspaceId: taskWorkspaceId,
        knowledgeBaseActionKey: String(pipeline && pipeline.id ? pipeline.id : ''),
      });
      var rootTask = startManagedXmindTask(buildRootTaskPayload(actionId, rootTaskInput, {
        workspaceId: taskWorkspaceId,
        scope: 'root',
        actionId: actionId,
        snapshotId: rootTaskMeta && rootTaskMeta.snapshotId ? String(rootTaskMeta.snapshotId || '') : '',
        contract: cloneJson(contract, {}),
        historyActionLabel: rootTaskMeta && rootTaskMeta.historyActionLabel ? String(rootTaskMeta.historyActionLabel || '') : '',
        hadAiContentBeforeAction: rootTaskMeta && rootTaskMeta.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: rootTaskMeta && rootTaskMeta.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: rootTaskMeta && rootTaskMeta.hadAiCasesBeforeAction === true,
        rootPipelineId: pipeline.id,
        rootPipelineActionId: actionId,
        pipelineStage: 'discovery',
        historySuppressed: true,
        notifySuppressed: true,
        skipCoverageRetry: actionId !== ROOT_ACTIONS.FULL_CASES,
      }));
      rootState.taskId = String(rootTask && rootTask.id ? rootTask.id : '');
      rootState.updatedAt = Date.now();
      persistXmindState(true);
      return true;
    }

    async function runRootAction(actionId, actionOptions) {
      var rootOptions = actionOptions || {};
      if (!ensureActionAllowed(actionId, null)) return false;
      if (!ensurePrepReadyOrOpen()) return false;
      var rootState = ensureRootUiState();
      var anchorNodeId = rootOptions.anchorNodeId || getRootNodeId();
      if (actionId === ROOT_ACTIONS.ROLLBACK) {
        var rolledBack = false;
        if (casesGenApi && typeof casesGenApi.rollbackAllCaseGenState === 'function') {
          rolledBack = casesGenApi.rollbackAllCaseGenState() === true;
        }
        if (!rolledBack) rolledBack = rollbackAllCaseGenStateLocal() === true;
        if (rolledBack) {
          clearAllTopupHighlights();
          rootState.running = false;
          rootState.taskId = '';
          rootState.hideAiLayer = false;
          rootState.status = '';
          rootState.error = '';
          rootState.lastAction = ROOT_ACTIONS.ROLLBACK;
          rootState.snapshotId = '';
          clearDeleteHistoryStacks();
          notifyStatus('已放弃最近一次生成', 'ok');
          render({ reason: 'root-rollback', anchorNodeId: anchorNodeId });
        }
        return rolledBack;
      }

      var shouldResetAiLayerBeforeAction = actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES;
      var visibleContext = shouldResetAiLayerBeforeAction
        ? buildVisibleModuleContext({ includeAiLayer: false })
        : buildVisibleModuleContext();
      var contract = createOperationContract(actionId, null);
      var currentSnapshotId = '';
      var hadAiContentBeforeAction = hasAnyAiModules();
      var hadAiLayerBeforeAction = shouldResetAiLayerBeforeAction && hasAnyAiModules();
      var hadAiCasesBeforeAction = (
        actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
      ) && hasAnyAiCases();
      var historyActionLabel = getRootHistoryActionLabel(actionId, hadAiContentBeforeAction);
      var taskWorkspaceId = String(getActiveWorkspaceId() || '');
      var knowledgeBaseActionKey = generateLocalId('kb-action');
      if (casesGenApi && typeof casesGenApi.snapshotAllCaseGenState === 'function') {
        currentSnapshotId = String(casesGenApi.snapshotAllCaseGenState() || '');
      }
      if (!currentSnapshotId) currentSnapshotId = snapshotAllCaseGenStateLocal();
      rootState.snapshotId = String(currentSnapshotId || ensureState().rootSnapshotId || '');
      rootState.lastAction = actionId;
      rootState.running = true;
      rootState.taskId = '';
      rootState.hideAiLayer = hadAiLayerBeforeAction;
      rootState.status = '';
      rootState.error = '';
      rootState.updatedAt = Date.now();
      clearAllTopupHighlights();
      clearDedupeOverviewSummary({ clearTerminalVisual: true });
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) {
        markRootPendingModules(visibleContext.list, actionId);
      }
      if (hadAiCasesBeforeAction) setAllModuleResultsVisibility(false);
      var rootRunningRenderOptions = { reason: 'root-running', anchorNodeId: anchorNodeId, persist: false };
      flushLightweightMindStatus();
      scheduleRenderedRootMindStatusBadgeRefresh();
      if (
        hadAiLayerBeforeAction
        || hadAiCasesBeforeAction
        || actionId === ROOT_ACTIONS.EXISTING_CASES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES
      ) {
        queueStructureMindRender(rootRunningRenderOptions);
      } else {
        queueStatusMindRender(rootRunningRenderOptions);
      }
      var rootTaskMeta = {
        scope: 'root',
        workspaceId: taskWorkspaceId,
        actionId: actionId,
        snapshotId: currentSnapshotId,
        contract: cloneJson(contract, {}),
        historyActionLabel: historyActionLabel,
        hadAiContentBeforeAction: hadAiContentBeforeAction,
        hadAiLayerBeforeAction: hadAiLayerBeforeAction,
        hadAiCasesBeforeAction: hadAiCasesBeforeAction,
      };

      try {
        if (shouldUseRootPipeline(actionId)) {
          return await startRootPipeline(actionId, rootTaskMeta, visibleContext);
        }
        var rootTaskInput = await buildXmindGenerationTaskInput(contract, visibleContext, null, {
          workspaceId: taskWorkspaceId,
          knowledgeBaseActionKey: knowledgeBaseActionKey,
        });
        var rootTask = startManagedXmindTask(buildRootTaskPayload(actionId, rootTaskInput, rootTaskMeta));
        rootState.taskId = String(rootTask && rootTask.id ? rootTask.id : '');
        rootState.updatedAt = Date.now();
        persistXmindState(true);
        return true;
      } catch (err) {
        clearRootPipelineState();
        return completeRootTaskError(rootTaskMeta, err, { renderReason: 'root-start-error' });
      }
    }

    async function runModuleAction(moduleEntry, actionId, actionOptions) {
      var moduleOptions = actionOptions || {};
      if (!moduleEntry) return false;
      if (!ensureActionAllowed(actionId, moduleEntry)) return false;
      if (!ensurePrepReadyOrOpen()) return false;

      if (actionId === MODULE_ACTIONS.ROLLBACK) {
        var anchorNodeId = moduleOptions.anchorNodeId || getModuleNodeId(moduleEntry);
        if (moduleEntry.aiModuleId) {
          var rolledBack = false;
          if (casesGenApi && typeof casesGenApi.rollbackModuleCases === 'function') {
            rolledBack = casesGenApi.rollbackModuleCases(moduleEntry.aiModuleId) === true;
          } else {
            var latestLocalOperation = getLatestCaseGenOperationSnapshotLocal();
            if (
              latestLocalOperation
              && latestLocalOperation.scope === 'module'
              && String(latestLocalOperation.moduleId || '') === String(moduleEntry.aiModuleId || '')
            ) {
              rolledBack = rollbackCaseGenOperationSnapshotLocal(String(latestLocalOperation.id || '')) === true;
            }
          }
          if (rolledBack) {
            var rolledState = ensureModuleUiState(moduleEntry.aiModuleId);
            if (rolledState) rolledState.taskId = '';
            clearModuleTopupHighlight(rolledState);
            clearDeleteHistoryStacks();
            notifyStatus('已放弃该模块最近一次生成', 'ok');
            render({ reason: 'module-rollback', anchorNodeId: anchorNodeId });
          }
          return rolledBack;
        }
        return false;
      }
      var started = await startManagedModuleTask(moduleEntry, actionId, {
        renderReason: 'module-running',
        anchorNodeId: moduleOptions.anchorNodeId || getModuleNodeId(moduleEntry),
        knowledgeBaseActionKey: generateLocalId('kb-action'),
      });
      return Boolean(started && started.task && started.task.id);
    }

    function handleNodeAction(actionId, nodeMeta) {
      if (!actionId) return false;
      hideOpenMindContextMenu();
      if (isDeleteActionId(actionId)) {
        handleDeleteSelection(nodeMeta);
        return true;
      }
      var meta = nodeMeta && nodeMeta.meta ? nodeMeta.meta : {};
      if (meta.type === 'root') {
        runRootAction(actionId, {
          anchorNodeId: nodeMeta && nodeMeta.nodeId ? String(nodeMeta.nodeId) : getRootNodeId(),
        });
        return true;
      }
      if (meta.type === 'module') {
        var moduleEntry = resolveModuleEntryByMeta(meta);
        runModuleAction(moduleEntry, actionId, {
          anchorNodeId: nodeMeta && nodeMeta.nodeId ? String(nodeMeta.nodeId) : getModuleNodeId(moduleEntry),
        });
        return true;
      }
      return false;
    }

    return {
      startManagedModuleTask: startManagedModuleTask,
      pumpRootPipelineModuleQueue: pumpRootPipelineModuleQueue,
      startRootPipelineModuleTasks: startRootPipelineModuleTasks,
      startRootPipeline: startRootPipeline,
      runRootAction: runRootAction,
      runModuleAction: runModuleAction,
      handleNodeAction: handleNodeAction,
    };
  }

  return { create: create };
});
