(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenManagedTaskController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function identity(value) {
    return value;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var cloneJson = typeof opts.cloneJson === 'function' ? opts.cloneJson : function(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    };
    var mergeTaskRestoreContext = typeof opts.mergeTaskRestoreContext === 'function'
      ? opts.mergeTaskRestoreContext : function(base, incoming) { return Object.assign({}, base || {}, incoming || {}); };
    var mergeStoredViewState = typeof opts.mergeStoredViewState === 'function'
      ? opts.mergeStoredViewState : function(base, incoming) { return Object.assign({}, base || {}, incoming || {}); };
    var createDefaultPrepState = typeof opts.createDefaultPrepState === 'function'
      ? opts.createDefaultPrepState : function() { return {}; };
    var createDefaultViewState = typeof opts.createDefaultViewState === 'function'
      ? opts.createDefaultViewState : function() { return {}; };
    var createDefaultRootState = typeof opts.createDefaultRootState === 'function'
      ? opts.createDefaultRootState : function() { return {}; };
    var createDefaultCaseGenSettings = typeof opts.createDefaultCaseGenSettings === 'function'
      ? opts.createDefaultCaseGenSettings : function() { return {}; };
    var createEmptyRequirementMedia = typeof opts.createEmptyRequirementMedia === 'function'
      ? opts.createEmptyRequirementMedia : function() { return {}; };
    var normalizeStoredViewState = typeof opts.normalizeStoredViewState === 'function'
      ? opts.normalizeStoredViewState : function(value) { return value && typeof value === 'object' ? value : {}; };
    var normalizeWorkspaceSharedState = typeof opts.normalizeWorkspaceSharedState === 'function'
      ? opts.normalizeWorkspaceSharedState : function(value) { return value && typeof value === 'object' ? value : {}; };
    var normalizeWorkspaceSnapshot = typeof opts.normalizeWorkspaceSnapshot === 'function'
      ? opts.normalizeWorkspaceSnapshot : function(value) { return value && typeof value === 'object' ? value : {}; };
    var createInitialXmindState = typeof opts.createInitialXmindState === 'function'
      ? opts.createInitialXmindState : function() { return {}; };
    var createEmptyWorkspaceSharedState = typeof opts.createEmptyWorkspaceSharedState === 'function'
      ? opts.createEmptyWorkspaceSharedState : function() { return {}; };
    var cloneModulesWithoutCases = typeof opts.cloneModulesWithoutCases === 'function'
      ? opts.cloneModulesWithoutCases : function(value) { return cloneJson(value, []); };
    var buildCompactRootPipelineRestoreSnapshot = typeof opts.buildCompactRootPipelineRestoreSnapshot === 'function'
      ? opts.buildCompactRootPipelineRestoreSnapshot : function(value) { return cloneJson(value, null); };
    var cloneRootPipelineSnapshot = typeof opts.cloneRootPipelineSnapshot === 'function'
      ? opts.cloneRootPipelineSnapshot : function(value) { return cloneJson(value, null); };
    var getWorkflowReady = typeof opts.getWorkflowReady === 'function' ? opts.getWorkflowReady : function() { return true; };
    var getTaskManager = typeof opts.getTaskManager === 'function' ? opts.getTaskManager : function() { return null; };
    var getRecoveryCore = typeof opts.getRecoveryCore === 'function' ? opts.getRecoveryCore : function() { return null; };
    var getActiveWorkspaceId = typeof opts.getActiveWorkspaceId === 'function'
      ? opts.getActiveWorkspaceId : function() { return ''; };
    var getWorkspaceRecord = typeof opts.getWorkspaceRecord === 'function'
      ? opts.getWorkspaceRecord : function() { return null; };
    var ensureWorkspaceRecordForTaskPort = typeof opts.ensureWorkspaceRecordForTask === 'function'
      ? opts.ensureWorkspaceRecordForTask : function() { return null; };
    var captureActiveRestoreContext = typeof opts.captureActiveRestoreContext === 'function'
      ? opts.captureActiveRestoreContext : function() { return {}; };
    var shouldApplyLiveRestore = typeof opts.shouldApplyLiveRestore === 'function'
      ? opts.shouldApplyLiveRestore : function() { return false; };
    var applyLiveRestoreContext = typeof opts.applyLiveRestoreContext === 'function'
      ? opts.applyLiveRestoreContext : function() { return false; };
    var onWorkspaceRecordsRestored = typeof opts.onWorkspaceRecordsRestored === 'function'
      ? opts.onWorkspaceRecordsRestored : noop;
    var getWorkspaceShadowDepth = typeof opts.getWorkspaceShadowDepth === 'function'
      ? opts.getWorkspaceShadowDepth : function() { return 0; };
    var clearRunningUiState = typeof opts.clearRunningUiState === 'function' ? opts.clearRunningUiState : noop;
    var applyRunningUiTask = typeof opts.applyRunningUiTask === 'function' ? opts.applyRunningUiTask : noop;
    var applyRootPipelineRunningUiState = typeof opts.applyRootPipelineRunningUiState === 'function'
      ? opts.applyRootPipelineRunningUiState : noop;
    var shouldRenderRunningTasksStructurally = typeof opts.shouldRenderRunningTasksStructurally === 'function'
      ? opts.shouldRenderRunningTasksStructurally : function() { return false; };
    var syncInterruptButton = typeof opts.syncInterruptButton === 'function' ? opts.syncInterruptButton : noop;
    var renderWorkspaceTabs = typeof opts.renderWorkspaceTabs === 'function' ? opts.renderWorkspaceTabs : noop;
    var persistManagedTaskWorkspaceState = typeof opts.persistManagedTaskWorkspaceState === 'function'
      ? opts.persistManagedTaskWorkspaceState : noop;
    var isDrawerOpen = typeof opts.isDrawerOpen === 'function' ? opts.isDrawerOpen : function() { return false; };
    var queueStructureRender = typeof opts.queueStructureRender === 'function' ? opts.queueStructureRender : noop;
    var queueStatusRender = typeof opts.queueStatusRender === 'function' ? opts.queueStatusRender : noop;
    var runInWorkspaceContextNow = typeof opts.runInWorkspaceContextNow === 'function'
      ? opts.runInWorkspaceContextNow : function(workspaceId, handler) { return Promise.resolve(handler(false)); };
    var showTerminalDedupeRunningState = typeof opts.showTerminalDedupeRunningState === 'function'
      ? opts.showTerminalDedupeRunningState : noop;
    var waitForDedupeMinVisibleDuration = typeof opts.waitForDedupeMinVisibleDuration === 'function'
      ? opts.waitForDedupeMinVisibleDuration : function() { return Promise.resolve(); };
    var completeCoverageTaskSuccess = typeof opts.completeCoverageTaskSuccess === 'function'
      ? opts.completeCoverageTaskSuccess : identity;
    var completeDedupeTaskSuccess = typeof opts.completeDedupeTaskSuccess === 'function'
      ? opts.completeDedupeTaskSuccess : identity;
    var completeRootTaskSuccess = typeof opts.completeRootTaskSuccess === 'function'
      ? opts.completeRootTaskSuccess : identity;
    var completeModuleTaskSuccess = typeof opts.completeModuleTaskSuccess === 'function'
      ? opts.completeModuleTaskSuccess : identity;
    var completeCoverageTaskError = typeof opts.completeCoverageTaskError === 'function'
      ? opts.completeCoverageTaskError : identity;
    var completeDedupeTaskError = typeof opts.completeDedupeTaskError === 'function'
      ? opts.completeDedupeTaskError : identity;
    var completeRootTaskError = typeof opts.completeRootTaskError === 'function'
      ? opts.completeRootTaskError : identity;
    var completeModuleTaskError = typeof opts.completeModuleTaskError === 'function'
      ? opts.completeModuleTaskError : identity;
    var pumpRootPipelineModuleQueue = typeof opts.pumpRootPipelineModuleQueue === 'function'
      ? opts.pumpRootPipelineModuleQueue : function() { return Promise.resolve(false); };
    var finalizeRootPipelineIfReady = typeof opts.finalizeRootPipelineIfReady === 'function'
      ? opts.finalizeRootPipelineIfReady : noop;
    var getManagedTaskAnchorNodeId = typeof opts.getManagedTaskAnchorNodeId === 'function'
      ? opts.getManagedTaskAnchorNodeId : function() { return ''; };
    var getRootPipelineState = typeof opts.getRootPipelineState === 'function'
      ? opts.getRootPipelineState : function() { return null; };
    var updateRootPipelineState = typeof opts.updateRootPipelineState === 'function'
      ? opts.updateRootPipelineState : noop;
    var getRootNodeId = typeof opts.getRootNodeId === 'function' ? opts.getRootNodeId : function() { return ''; };
    var addTaskEventListener = typeof opts.addTaskEventListener === 'function' ? opts.addTaskEventListener : noop;
    var maybeRescueRootPipelineTailRequest = typeof opts.maybeRescueRootPipelineTailRequest === 'function'
      ? opts.maybeRescueRootPipelineTailRequest : noop;
    var notifyFloatingStatus = typeof opts.notifyFloatingStatus === 'function' ? opts.notifyFloatingStatus : noop;
    var setTimer = typeof opts.setTimer === 'function' ? opts.setTimer : function(handler, delay) { return setTimeout(handler, delay); };
    var clearTimer = typeof opts.clearTimer === 'function' ? opts.clearTimer : function(timer) { clearTimeout(timer); };
    var logConsumeError = typeof opts.logConsumeError === 'function' ? opts.logConsumeError : noop;
    var now = typeof opts.now === 'function' ? opts.now : function() { return Date.now(); };

    var pendingReconcileTimer = 0;
    var processingMap = {};
    var listenerBound = false;
    var workspaceContextQueue = Promise.resolve();

    function isManagedTaskTerminal(task) {
      var status = task && task.status ? String(task.status || '') : '';
      return status === 'done' || status === 'error' || status === 'cancelled';
    }

    function getManagedXmindTaskListIfReady() {
      if (getWorkflowReady() !== true) return null;
      var manager = getTaskManager();
      if (!manager || typeof manager.getTasks !== 'function') return null;
      var list = manager.getTasks();
      return Array.isArray(list) ? list : [];
    }

    function listManagedXmindTasks() {
      var list = getManagedXmindTaskListIfReady();
      return Array.isArray(list) ? list : [];
    }

    function getTaskWorkspaceId(task) {
      if (!task || typeof task !== 'object') return '';
      if (task.workspaceId) return String(task.workspaceId || '');
      var restoreContext = task.restoreContext && typeof task.restoreContext === 'object'
        ? task.restoreContext
        : null;
      return restoreContext && restoreContext.workspaceId ? String(restoreContext.workspaceId || '') : '';
    }

    function filterTasksByWorkspace(tasks, workspaceId) {
      var targetId = String(workspaceId || '');
      return (Array.isArray(tasks) ? tasks : []).filter(function(task) {
        return Boolean(targetId && getTaskWorkspaceId(task) === targetId);
      });
    }

    function enrichWorkspaceRestoreContext(context, workspaceId, record) {
      var result = context && typeof context === 'object' ? context : {};
      var workspaceRecord = record && typeof record === 'object' ? record : null;
      result.workspaceId = String(workspaceId || result.workspaceId || '');
      result.workspaceGenerationId = String(
        result.workspaceGenerationId
        || (workspaceRecord && workspaceRecord.generationId ? workspaceRecord.generationId : '')
        || ''
      );
      result.workspaceCreatedAt = Number(
        result.workspaceCreatedAt
        || (workspaceRecord ? workspaceRecord.createdAt : 0)
        || 0
      ) || 0;
      var recoveryCore = getRecoveryCore();
      if (recoveryCore && typeof recoveryCore.buildRequirementFingerprint === 'function') {
        result.requirementFingerprint = recoveryCore.buildRequirementFingerprint(result);
      } else {
        result.requirementFingerprint = String(result.requirementFingerprint || '');
      }
      return result;
    }

    function buildRestoreContextFromWorkspaceSnapshot(snapshot, workspaceId, optionsValue) {
      var buildOptions = optionsValue || {};
      var compact = buildOptions.compact === true;
      var normalized = normalizeWorkspaceSnapshot(snapshot);
      var xmindSnapshot = normalized.xmind || createInitialXmindState();
      var sharedSnapshot = normalized.shared || createEmptyWorkspaceSharedState();
      var result = {
        workspaceId: String(workspaceId || ''),
        requirementLabel: sharedSnapshot.requirementLabel || '',
        requirementLabelSource: sharedSnapshot.requirementLabelSource || '',
        lastRawImportName: sharedSnapshot.lastRawImportName || '',
        rawText: sharedSnapshot.rawText || '',
        caseGenModules: compact
          ? cloneModulesWithoutCases(sharedSnapshot.caseGenModules)
          : cloneJson(sharedSnapshot.caseGenModules, []),
        rootPipeline: compact
          ? buildCompactRootPipelineRestoreSnapshot(xmindSnapshot.root && xmindSnapshot.root.pipeline ? xmindSnapshot.root.pipeline : null)
          : cloneRootPipelineSnapshot(xmindSnapshot.root && xmindSnapshot.root.pipeline ? xmindSnapshot.root.pipeline : null),
        prep: cloneJson(xmindSnapshot.prep, createDefaultPrepState()),
        viewState: cloneJson(normalizeStoredViewState(xmindSnapshot.viewState), createDefaultViewState()),
      };
      if (compact !== true) {
        result.caseText = sharedSnapshot.caseText || '';
        result.importedCases = cloneJson(sharedSnapshot.importedCases, []);
        result.caseGenResults = cloneJson(sharedSnapshot.caseGenResults, {});
        result.operationSnapshots = cloneJson(xmindSnapshot.operationSnapshots, []);
        result.nextSnapshotId = Number(xmindSnapshot.nextSnapshotId || 1);
        result.history = cloneJson(xmindSnapshot.history, []);
      }
      return enrichWorkspaceRestoreContext(
        result,
        workspaceId,
        buildOptions.record || getWorkspaceRecord(workspaceId)
      );
    }

    function buildManagedTaskRestoreContext(optionsValue) {
      var buildOptions = optionsValue || {};
      var targetWorkspaceId = String(buildOptions.workspaceId || getActiveWorkspaceId() || '');
      var activeWorkspaceId = String(getActiveWorkspaceId() || '');
      if (targetWorkspaceId && targetWorkspaceId !== activeWorkspaceId) {
        var targetRecord = getWorkspaceRecord(targetWorkspaceId);
        if (targetRecord && targetRecord.snapshot) {
          return buildRestoreContextFromWorkspaceSnapshot(targetRecord.snapshot, targetWorkspaceId, {
            compact: buildOptions.compact === true,
            record: targetRecord,
          });
        }
      }
      var captured = captureActiveRestoreContext({
        workspaceId: targetWorkspaceId,
        viewState: buildOptions.viewState && typeof buildOptions.viewState === 'object'
          ? buildOptions.viewState
          : null,
        compact: buildOptions.compact === true,
      });
      return enrichWorkspaceRestoreContext(
        cloneJson(captured, {}),
        targetWorkspaceId,
        getWorkspaceRecord(targetWorkspaceId)
      );
    }

    function getManagedTaskRestoreDecision(task) {
      var workspaceId = getTaskWorkspaceId(task);
      var record = workspaceId ? getWorkspaceRecord(workspaceId) : null;
      var recoveryCore = getRecoveryCore();
      if (!recoveryCore || typeof recoveryCore.evaluateTaskRestore !== 'function') {
        return {
          allowed: Boolean(record || (task && task.status === 'running')),
          recreateWorkspace: !record && Boolean(task && task.status === 'running'),
          reason: record ? 'compatible-fallback' : 'workspace-missing-fallback',
        };
      }
      return recoveryCore.evaluateTaskRestore(task, record ? {
        id: workspaceId,
        generationId: String(record.generationId || ''),
        createdAt: Number(record.createdAt || 0) || 0,
        restoreContext: buildRestoreContextFromWorkspaceSnapshot(record.snapshot, workspaceId, { record: record }),
      } : null);
    }

    function filterRestorableManagedTasks(tasks, optionsValue) {
      var filterOptions = optionsValue || {};
      var manager = getTaskManager();
      return (Array.isArray(tasks) ? tasks : []).filter(function(task) {
        var decision = getManagedTaskRestoreDecision(task);
        if (decision && decision.allowed === true) return true;
        if (
          filterOptions.clearInvalid === true
          && task
          && task.id
          && manager
          && typeof manager.clearTask === 'function'
        ) {
          manager.clearTask(task.id, 'stale-workspace');
        }
        return false;
      });
    }

    function syncManagedRunningUiState(optionsValue) {
      var syncOptions = optionsValue || {};
      if (getWorkspaceShadowDepth() > 0) {
        scheduleManagedTaskReconcile(syncOptions.reason || 'task-sync-shadow');
        return [];
      }
      var tasks = Array.isArray(syncOptions.tasks) ? syncOptions.tasks : listManagedXmindTasks();
      var runningTasks = filterTasksByWorkspace(tasks, getActiveWorkspaceId()).filter(function(task) {
        return task && task.status === 'running';
      });
      clearRunningUiState();
      runningTasks.forEach(applyRunningUiTask);
      applyRootPipelineRunningUiState(runningTasks);
      syncInterruptButton();
      renderWorkspaceTabs();
      if (syncOptions.persist === true) persistManagedTaskWorkspaceState(true);
      else if (syncOptions.persist !== false) persistManagedTaskWorkspaceState(false);
      if (syncOptions.render === true && isDrawerOpen()) {
        var renderOptions = {
          reason: syncOptions.reason || 'task-sync',
          persist: false,
          anchorNodeId: syncOptions.anchorNodeId || '',
        };
        if (shouldRenderRunningTasksStructurally(runningTasks)) queueStructureRender(renderOptions);
        else queueStatusRender(renderOptions);
      }
      return runningTasks;
    }

    function syncTaskContexts(taskIds, context, optionsValue) {
      var manager = getTaskManager();
      if (!manager || typeof manager.updateTasksContext !== 'function') return 0;
      var ids = Array.isArray(taskIds) ? taskIds.map(function(item) {
        return String(item || '');
      }).filter(Boolean) : [];
      if (!ids.length) return 0;
      var updateOptions = optionsValue || {};
      return Number(manager.updateTasksContext(function(nextContext) {
        var merged = mergeTaskRestoreContext(nextContext, context);
        if (updateOptions.replaceViewState === true && context.viewState) {
          merged.viewState = cloneJson(context.viewState, createDefaultViewState());
        }
        Object.keys(nextContext || {}).forEach(function(key) { delete nextContext[key]; });
        Object.keys(merged).forEach(function(key) {
          nextContext[key] = cloneJson(merged[key], merged[key]);
        });
      }, {
        taskIds: ids,
        onlyRunning: updateOptions.onlyRunning === true,
        action: updateOptions.action || 'context',
      }) || 0);
    }

    function syncRunningTaskRestoreContexts(workspaceId, optionsValue) {
      var syncOptions = optionsValue || {};
      var targetWorkspaceId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!targetWorkspaceId) return 0;
      var taskIds = filterTasksByWorkspace(listManagedXmindTasks(), targetWorkspaceId).filter(function(task) {
        return task && task.status === 'running' && task.id;
      }).map(function(task) {
        return String(task.id || '');
      }).filter(Boolean);
      if (!taskIds.length) return 0;
      return syncTaskContexts(taskIds, buildManagedTaskRestoreContext({
        workspaceId: targetWorkspaceId,
        viewState: syncOptions.viewState && typeof syncOptions.viewState === 'object' ? syncOptions.viewState : null,
        compact: false,
      }), {
        replaceViewState: syncOptions.replaceViewState === true,
        onlyRunning: true,
        action: 'context',
      });
    }

    function syncManagedTaskRestoreContexts(taskIds, optionsValue) {
      var syncOptions = optionsValue || {};
      return syncTaskContexts(taskIds, buildManagedTaskRestoreContext({
        workspaceId: syncOptions.workspaceId ? syncOptions.workspaceId : '',
        compact: syncOptions.compact === true,
      }), {
        onlyRunning: syncOptions.onlyRunning === true,
        action: syncOptions.action || 'context',
      });
    }

    function syncTerminalTaskRestoreContext(task) {
      var taskId = task && task.id ? String(task.id || '') : '';
      if (!taskId) return 0;
      return syncManagedTaskRestoreContexts([taskId], {
        onlyRunning: false,
        action: 'context',
        workspaceId: getTaskWorkspaceId(task),
        compact: false,
      });
    }

    function buildMergedManagedTaskRestoreContext(tasks) {
      var merged = null;
      (Array.isArray(tasks) ? tasks : []).forEach(function(task) {
        var restoreContext = task && task.restoreContext && typeof task.restoreContext === 'object'
          ? task.restoreContext
          : null;
        if (restoreContext) merged = mergeTaskRestoreContext(merged, restoreContext);
      });
      return merged;
    }

    function markRestoreContextRootPipelineRestoredAfterRefresh(restoreContext) {
      if (!restoreContext || !restoreContext.rootPipeline) return restoreContext;
      var pipeline = cloneRootPipelineSnapshot(restoreContext.rootPipeline);
      if (pipeline && pipeline.id) {
        pipeline.restoredAfterRefresh = true;
        restoreContext.rootPipeline = pipeline;
      }
      return restoreContext;
    }

    function markRunningTaskRestoreContextsRestoredAfterRefresh() {
      var manager = getTaskManager();
      if (!manager || typeof manager.updateTasksContext !== 'function') return 0;
      return Number(manager.updateTasksContext(function(nextContext) {
        markRestoreContextRootPipelineRestoredAfterRefresh(nextContext);
      }, {
        onlyRunning: true,
        action: 'context',
      }) || 0);
    }

    function applyRestoreContextToWorkspaceRecord(workspaceId, restoreContext) {
      var stableId = String(workspaceId || '');
      if (!stableId || !restoreContext) return false;
      var record = ensureWorkspaceRecordForTaskPort(stableId, restoreContext);
      if (!record) return false;
      var incomingContext = enrichWorkspaceRestoreContext(cloneJson(restoreContext, {}), stableId, record);
      var baseContext = buildRestoreContextFromWorkspaceSnapshot(record.snapshot, stableId);
      var recoveryCore = getRecoveryCore();
      if (
        recoveryCore
        && typeof recoveryCore.areRestoreContextsCompatible === 'function'
        && recoveryCore.areRestoreContextsCompatible(baseContext, incomingContext) !== true
      ) {
        return false;
      }
      var merged = mergeTaskRestoreContext(baseContext, incomingContext);
      var currentSnapshot = normalizeWorkspaceSnapshot(record.snapshot);
      var xmindSnapshot = currentSnapshot.xmind || createInitialXmindState();
      var sharedSnapshot = currentSnapshot.shared || createEmptyWorkspaceSharedState();
      xmindSnapshot.history = cloneJson(merged.history, []);
      xmindSnapshot.operationSnapshots = cloneJson(merged.operationSnapshots, []);
      xmindSnapshot.nextSnapshotId = Number(merged.nextSnapshotId || xmindSnapshot.nextSnapshotId || 1);
      xmindSnapshot.prep = cloneJson(merged.prep, createDefaultPrepState());
      xmindSnapshot.viewState = mergeStoredViewState(xmindSnapshot.viewState, merged.viewState);
      xmindSnapshot.root = xmindSnapshot.root && typeof xmindSnapshot.root === 'object'
        ? xmindSnapshot.root
        : createDefaultRootState();
      xmindSnapshot.root.pipeline = cloneRootPipelineSnapshot(merged.rootPipeline);
      record.snapshot = {
        xmind: xmindSnapshot,
        shared: normalizeWorkspaceSharedState({
          requirementLabel: merged.requirementLabel,
          requirementLabelSource: merged.requirementLabelSource,
          lastRawImportName: merged.lastRawImportName,
          rawText: merged.rawText,
          caseText: merged.caseText,
          importedCases: merged.importedCases,
          caseGenModules: merged.caseGenModules,
          caseGenResults: merged.caseGenResults,
          caseSelections: {},
          caseGenSuggestions: sharedSnapshot.caseGenSuggestions || {},
          caseGenModuleStatus: sharedSnapshot.caseGenModuleStatus || {},
          caseGenProgress: sharedSnapshot.caseGenProgress || {},
          caseGenTiming: sharedSnapshot.caseGenTiming || {},
          caseGenProgressNotice: sharedSnapshot.caseGenProgressNotice || {},
          caseGenSettings: sharedSnapshot.caseGenSettings || createDefaultCaseGenSettings(),
          requirementMedia: sharedSnapshot.requirementMedia || createEmptyRequirementMedia(),
        }),
      };
      record.updatedAt = now();
      return true;
    }

    function restoreWorkflowContextFromManagedTasks(tasks, optionsValue) {
      var restoreOptions = optionsValue || {};
      var restorableTasks = filterRestorableManagedTasks(tasks, {
        clearInvalid: restoreOptions.clearInvalidTasks === true,
      });
      var currentWorkspaceId = getActiveWorkspaceId();
      var scopedTasks = filterTasksByWorkspace(restorableTasks, currentWorkspaceId);
      var grouped = {};
      restorableTasks.forEach(function(task) {
        var workspaceId = getTaskWorkspaceId(task);
        if (!workspaceId || workspaceId === currentWorkspaceId) return;
        if (!grouped[workspaceId]) grouped[workspaceId] = [];
        grouped[workspaceId].push(task);
      });
      var restoredWorkspaceIds = [];
      Object.keys(grouped).forEach(function(workspaceId) {
        var merged = buildMergedManagedTaskRestoreContext(grouped[workspaceId]);
        if (restoreOptions.markRestoredAfterRefresh === true) {
          markRestoreContextRootPipelineRestoredAfterRefresh(merged);
        }
        if (merged && applyRestoreContextToWorkspaceRecord(workspaceId, merged)) {
          restoredWorkspaceIds.push(workspaceId);
        }
      });
      var restoreContext = buildMergedManagedTaskRestoreContext(scopedTasks);
      if (restoreOptions.markRestoredAfterRefresh === true) {
        markRestoreContextRootPipelineRestoredAfterRefresh(restoreContext);
      }
      var currentRecordChanged = restoreContext
        ? applyRestoreContextToWorkspaceRecord(currentWorkspaceId, restoreContext)
        : false;
      if (currentRecordChanged) restoredWorkspaceIds.push(currentWorkspaceId);
      if (restoredWorkspaceIds.length) onWorkspaceRecordsRestored(restoredWorkspaceIds, {
        currentWorkspaceId: currentWorkspaceId,
        liveOwned: shouldApplyLiveRestore() === true,
      });
      if (!restoreContext || shouldApplyLiveRestore() !== true) return currentRecordChanged;
      return applyLiveRestoreContext(restoreContext, restoreOptions) === true || currentRecordChanged;
    }

    function runInWorkspaceContext(workspaceId, handler) {
      var targetId = String(workspaceId || '');
      var queued = workspaceContextQueue.catch(function() {
        return null;
      }).then(function() {
        return runInWorkspaceContextNow(targetId, handler);
      });
      workspaceContextQueue = queued.then(function() { return null; }, function() { return null; });
      return queued;
    }

    function completeTask(task, err, optionsValue) {
      var completionOptions = optionsValue || {};
      if (task.status === 'done' && !err) {
        if (task.scope === 'coverage') return completeCoverageTaskSuccess(task);
        if (task.scope === 'dedupe') return completeDedupeTaskSuccess(task);
        if (task.scope === 'root') return completeRootTaskSuccess(task);
        return completeModuleTaskSuccess(task);
      }
      var errorOptions = err
        ? { renderReason: String(task.scope || 'module') + '-task-consume-error' }
        : completionOptions;
      if (task.scope === 'coverage') return completeCoverageTaskError(task, err, errorOptions);
      if (task.scope === 'dedupe') return completeDedupeTaskError(task, err, errorOptions);
      if (task.scope === 'root') return completeRootTaskError(task, err, errorOptions);
      return completeModuleTaskError(task, err, errorOptions);
    }

    function getTerminalErrorOptions(task) {
      var scope = String(task && task.scope ? task.scope : 'module');
      if (task && task.status === 'cancelled') {
        return { resultKind: 'cancelled', renderReason: scope + '-task-cancelled' };
      }
      return { renderReason: scope + '-task-error' };
    }

    function consumeManagedXmindTask(task) {
      if (!task || !task.id || !isManagedTaskTerminal(task)) return Promise.resolve(false);
      if (processingMap[task.id]) return processingMap[task.id];
      var initialRestoreDecision = getManagedTaskRestoreDecision(task);
      if (!initialRestoreDecision || initialRestoreDecision.allowed !== true) {
        var staleManager = getTaskManager();
        if (staleManager && typeof staleManager.clearTask === 'function') {
          staleManager.clearTask(task.id, 'stale-workspace');
        }
        return Promise.resolve(false);
      }
      var promise = runInWorkspaceContext(getTaskWorkspaceId(task), function() {
        return Promise.resolve()
          .then(function() {
            restoreWorkflowContextFromManagedTasks([task]);
            if (task.scope === 'dedupe') {
              showTerminalDedupeRunningState(task);
              return waitForDedupeMinVisibleDuration(task);
            }
            return null;
          })
          .then(function() {
            var currentRestoreDecision = getManagedTaskRestoreDecision(task);
            if (!currentRestoreDecision || currentRestoreDecision.allowed !== true) return false;
            return completeTask(task, null, getTerminalErrorOptions(task));
          })
          .catch(function(err) {
            logConsumeError(task, err);
            return completeTask(task, err);
          });
      }).finally(async function() {
        var manager = getTaskManager();
        if (manager && typeof manager.clearTask === 'function') manager.clearTask(task.id, 'handled');
        delete processingMap[task.id];
        var taskWorkspaceId = getTaskWorkspaceId(task);
        if (getWorkspaceRecord(taskWorkspaceId)) {
          await runInWorkspaceContext(taskWorkspaceId, async function() {
            if (!task.rootPipelineId) return;
            await pumpRootPipelineModuleQueue(String(task.rootPipelineId || ''), {
              workspaceId: taskWorkspaceId,
            });
            finalizeRootPipelineIfReady(String(task.rootPipelineId || ''), {
              anchorNodeId: getManagedTaskAnchorNodeId(task, null),
            });
          });
        }
        syncManagedRunningUiState({
          tasks: listManagedXmindTasks(),
          render: false,
          reason: 'task-consumed',
          persist: true,
        });
        scheduleManagedTaskReconcile('task-consumed-followup');
      });
      processingMap[task.id] = promise;
      return promise;
    }

    function consumeManagedTerminalTasks(tasks, preferredTask) {
      var pending = [];
      var seen = {};
      function enqueue(task) {
        var taskId = task && task.id ? String(task.id || '') : '';
        if (!taskId || seen[taskId] || !isManagedTaskTerminal(task)) return;
        seen[taskId] = true;
        pending.push(task);
      }
      enqueue(preferredTask);
      (Array.isArray(tasks) ? tasks : []).forEach(enqueue);
      pending.forEach(consumeManagedXmindTask);
      return pending.length;
    }

    function reconcileManagedXmindTasks(optionsValue) {
      var reconcileOptions = optionsValue || {};
      var manager = getTaskManager();
      if (!manager) {
        syncInterruptButton();
        return [];
      }
      var tasks = listManagedXmindTasks();
      var isWorkflowResume = reconcileOptions.resume === true && reconcileOptions.reason === 'workflow-ready';
      if (isWorkflowResume) {
        markRunningTaskRestoreContextsRestoredAfterRefresh();
        tasks = listManagedXmindTasks();
      }
      restoreWorkflowContextFromManagedTasks(tasks, {
        markRestoredAfterRefresh: isWorkflowResume,
        clearInvalidTasks: true,
      });
      tasks = listManagedXmindTasks();
      if (reconcileOptions.resume !== false && typeof manager.resumeTasks === 'function') {
        manager.resumeTasks({ force: true });
        tasks = listManagedXmindTasks();
      }
      syncManagedRunningUiState({
        tasks: tasks,
        render: reconcileOptions.render === true && isDrawerOpen(),
        reason: reconcileOptions.reason || 'task-reconcile',
        persist: reconcileOptions.persist === true,
      });
      var terminalTasks = tasks.filter(isManagedTaskTerminal);
      consumeManagedTerminalTasks(terminalTasks, null);
      var pipeline = getRootPipelineState();
      if (pipeline && pipeline.id && terminalTasks.length <= 0) {
        pumpRootPipelineModuleQueue(String(pipeline.id || ''), {
          workspaceId: getActiveWorkspaceId(),
        }).then(function() {
          finalizeRootPipelineIfReady(String(pipeline.id || ''), { anchorNodeId: getRootNodeId() });
        });
      }
      return tasks;
    }

    function scheduleManagedTaskReconcile(reason) {
      var nextReason = String(reason || 'task-reconcile-deferred');
      if (pendingReconcileTimer) {
        clearTimer(pendingReconcileTimer);
        pendingReconcileTimer = 0;
      }
      pendingReconcileTimer = setTimer(function() {
        pendingReconcileTimer = 0;
        if (getWorkspaceShadowDepth() > 0) {
          scheduleManagedTaskReconcile(nextReason);
          return;
        }
        reconcileManagedXmindTasks({
          resume: false,
          render: isDrawerOpen(),
          reason: nextReason,
          persist: true,
        });
      }, 40);
    }

    function handleTaskEvent(event) {
      var detail = event && event.detail ? event.detail : {};
      var task = detail && detail.task ? detail.task : null;
      var action = detail && detail.action ? String(detail.action || '') : '';
      var tasks = detail && Array.isArray(detail.tasks) ? detail.tasks : listManagedXmindTasks();
      var isRemovalAction = action === 'handled'
        || action === 'clear'
        || action === 'workspace-clear'
        || action === 'workspace-reset'
        || action === 'workspace-delete'
        || action === 'stale-workspace';
      if (getWorkspaceShadowDepth() > 0) {
        scheduleManagedTaskReconcile('task-event-' + (action || 'update'));
        return;
      }
      if (isRemovalAction) {
        syncInterruptButton();
        return;
      }
      if (task && isManagedTaskTerminal(task)) {
        consumeManagedTerminalTasks(tasks, task);
        return;
      }
      if (action !== 'heartbeat') {
        syncManagedRunningUiState({
          tasks: tasks,
          render: isDrawerOpen() && action !== 'context',
          reason: 'task-event-' + (action || 'update'),
          persist: action === 'start' || action === 'cancel' || action === 'done'
            || action === 'error' || action === 'suspend' || action === 'retry',
          anchorNodeId: task ? getManagedTaskAnchorNodeId(task, null) : '',
        });
      } else {
        maybeRescueRootPipelineTailRequest(task);
        syncInterruptButton();
      }
      if (!task) consumeManagedTerminalTasks(tasks, null);
    }

    function bindManagedXmindTasks() {
      if (listenerBound === true) return;
      addTaskEventListener(handleTaskEvent);
      listenerBound = true;
    }

    function interruptRunningXmindTasks() {
      var manager = getTaskManager();
      if (!manager || typeof manager.cancelTask !== 'function') {
        notifyFloatingStatus('中断能力未就绪，请刷新后重试', 'err', 5000);
        return false;
      }
      var runningTasks = filterTasksByWorkspace(listManagedXmindTasks(), getActiveWorkspaceId()).filter(function(task) {
        return task && task.status === 'running';
      });
      var pipeline = getRootPipelineState();
      var interruptedCount = 0;
      runningTasks.forEach(function(task) {
        if (!task || !task.id) return;
        if (manager.cancelTask(task.id, {
          reason: '已手动中断当前 XMind 生成任务',
          source: 'toolbar',
          abortReason: 'xmind-casegen-cancelled',
        })) interruptedCount += 1;
      });
      if (pipeline && pipeline.id) {
        updateRootPipelineState(function(current) {
          current.cancelled = true;
          current.cancelReason = '已手动中断当前 XMind 生成任务';
          current.pendingQueue = [];
        });
      }
      syncManagedRunningUiState({
        tasks: listManagedXmindTasks(),
        render: isDrawerOpen(),
        reason: interruptedCount > 0 ? 'task-cancel-all' : 'task-cancel-none',
        persist: true,
      });
      if (interruptedCount <= 0) {
        if (pipeline && Array.isArray(pipeline.pendingQueue) && pipeline.pendingQueue.length > 0) {
          finalizeRootPipelineIfReady(String(pipeline.id || ''), { anchorNodeId: getRootNodeId() });
          notifyFloatingStatus('已中断当前 XMind 生成任务', 'warn', 3000);
          return true;
        }
        notifyFloatingStatus('当前没有可中断的生成任务', 'warn', 3000);
        return false;
      }
      notifyFloatingStatus('已中断 ' + String(interruptedCount) + ' 个生成任务', 'warn', 3000);
      return true;
    }

    return {
      isManagedTaskTerminal: isManagedTaskTerminal,
      getManagedXmindTaskListIfReady: getManagedXmindTaskListIfReady,
      listManagedXmindTasks: listManagedXmindTasks,
      getTaskWorkspaceId: getTaskWorkspaceId,
      filterTasksByWorkspace: filterTasksByWorkspace,
      getManagedTaskRestoreDecision: getManagedTaskRestoreDecision,
      filterRestorableManagedTasks: filterRestorableManagedTasks,
      syncManagedRunningUiState: syncManagedRunningUiState,
      enrichWorkspaceRestoreContext: enrichWorkspaceRestoreContext,
      buildManagedTaskRestoreContext: buildManagedTaskRestoreContext,
      syncRunningTaskRestoreContexts: syncRunningTaskRestoreContexts,
      syncManagedTaskRestoreContexts: syncManagedTaskRestoreContexts,
      syncTerminalTaskRestoreContext: syncTerminalTaskRestoreContext,
      buildMergedManagedTaskRestoreContext: buildMergedManagedTaskRestoreContext,
      markRestoreContextRootPipelineRestoredAfterRefresh: markRestoreContextRootPipelineRestoredAfterRefresh,
      markRunningTaskRestoreContextsRestoredAfterRefresh: markRunningTaskRestoreContextsRestoredAfterRefresh,
      buildRestoreContextFromWorkspaceSnapshot: buildRestoreContextFromWorkspaceSnapshot,
      applyRestoreContextToWorkspaceRecord: applyRestoreContextToWorkspaceRecord,
      restoreWorkflowContextFromManagedTasks: restoreWorkflowContextFromManagedTasks,
      runInWorkspaceContext: runInWorkspaceContext,
      consumeManagedXmindTask: consumeManagedXmindTask,
      consumeManagedTerminalTasks: consumeManagedTerminalTasks,
      reconcileManagedXmindTasks: reconcileManagedXmindTasks,
      scheduleManagedTaskReconcile: scheduleManagedTaskReconcile,
      bindManagedXmindTasks: bindManagedXmindTasks,
      interruptRunningXmindTasks: interruptRunningXmindTasks,
    };
  }

  return { create: create };
});
