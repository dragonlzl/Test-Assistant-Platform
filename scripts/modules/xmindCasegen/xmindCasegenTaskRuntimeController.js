(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenTaskRuntimeController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var rootActions = opts.rootActions || {};
    var moduleActions = opts.moduleActions || {};
    var dedupeActionId = String(opts.dedupeActionId || 'xmind-ai-dedupe');
    var ensureRootUiState = port('ensureRootUiState', function() { return {}; });
    var ensureDedupeUiState = port('ensureDedupeUiState', function() { return {}; });
    var ensureCoverageUiState = port('ensureCoverageUiState', function() { return {}; });
    var clearRootPendingModules = port('clearRootPendingModules');
    var setAllModuleResultsVisibility = port('setAllModuleResultsVisibility');
    var ensureState = port('ensureState', function() { return { modules: {} }; });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return null; });
    var syncInterruptButton = port('syncInterruptButton');
    var getRootPipelineState = port('getRootPipelineState', function() { return null; });
    var ensureRootPipelineStateFromTask = port('ensureRootPipelineStateFromTask', function() { return null; });
    var collectRootPipelineRunningTasks = port('collectRootPipelineRunningTasks', function() { return []; });
    var isRootPipelineUiActive = port('isRootPipelineUiActive', function() { return false; });
    var setModuleRootPendingAction = port('setModuleRootPendingAction');
    var markRootPendingModules = port('markRootPendingModules');
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { list: [] }; });
    var normalizeDedupeMode = port('normalizeDedupeMode', function(value) { return String(value || ''); });
    var ensureVisibleModuleContext = port('ensureVisibleModuleContext', function(value) {
      return value && typeof value === 'object' ? value : { list: [], map: {} };
    });
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim(); });
    var findAiModuleById = port('findAiModuleById', function() { return null; });
    var getAiCasesForModule = port('getAiCasesForModule', function() { return []; });
    var getRootNodeId = port('getRootNodeId', function() { return ''; });
    var getModuleNodeId = port('getModuleNodeId', function() { return ''; });
    var buildModuleNodeId = port('buildModuleNodeId', function(value) { return String(value || ''); });
    var normalizeArrayField = port('normalizeArrayField', function(value) {
      return Array.isArray(value) ? value.slice() : [];
    });
    var now = port('now', function() { return Date.now(); });

    function clearManagedTaskRunningUiProjection() {
      var rootState = ensureRootUiState();
      rootState.running = false;
      rootState.taskId = '';
      rootState.hideAiLayer = false;
      var dedupeState = ensureDedupeUiState();
      dedupeState.running = false;
      dedupeState.taskId = '';
      dedupeState.status = '';
      dedupeState.batchCompleted = 0;
      dedupeState.batchTotal = 0;
      var coverageState = ensureCoverageUiState();
      coverageState.running = false;
      coverageState.taskId = '';
      if (coverageState.status === 'running') coverageState.status = '';
      clearRootPendingModules();
      setAllModuleResultsVisibility(true);
      Object.keys(ensureState().modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        if (!moduleState) return;
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.rootPendingActionId = '';
        moduleState.hideResults = false;
      });
      syncInterruptButton();
    }

    function applyRootPipelineRunningUiProjection(runningTasks) {
      var pipeline = getRootPipelineState();
      if ((!pipeline || !pipeline.id) && Array.isArray(runningTasks)) {
        var relatedTask = runningTasks.filter(function(task) {
          return Boolean(task && task.rootPipelineId);
        })[0] || null;
        if (relatedTask) pipeline = ensureRootPipelineStateFromTask(relatedTask);
      }
      if (!pipeline || !pipeline.id) return;
      var relatedTasks = collectRootPipelineRunningTasks(pipeline.id, runningTasks);
      var pipelineActive = isRootPipelineUiActive(pipeline, runningTasks);
      if (!relatedTasks.length && !pipelineActive) return;
      var dedupeTask = relatedTasks.filter(function(task) {
        return task && task.scope === 'dedupe';
      })[0] || null;
      var rootTask = relatedTasks.filter(function(task) {
        return task && task.scope === 'root';
      })[0] || null;
      var rootState = ensureRootUiState();
      rootState.running = true;
      rootState.taskId = dedupeTask
        ? String(dedupeTask.id || '')
        : (rootTask ? String(rootTask.id || '') : String(pipeline.id || ''));
      rootState.lastAction = dedupeTask || pipeline.stage === 'deduping'
        ? dedupeActionId
        : String(pipeline.actionId || rootState.lastAction || '');
      rootState.snapshotId = String(pipeline.snapshotId || rootState.snapshotId || '');
      rootState.hideAiLayer = !dedupeTask
        && pipeline.stage === 'discovering'
        && pipeline.hadAiLayerBeforeAction === true;
      rootState.updatedAt = now();
      if (pipeline.stage === 'discovering' && pipeline.hadAiCasesBeforeAction === true) {
        setAllModuleResultsVisibility(false);
      }
      relatedTasks.forEach(function(task) {
        if (!task || task.scope !== 'module' || !task.moduleId) return;
        if (String(task.rootPipelineActionId || '') === rootActions.EXISTING_CASES) {
          setModuleRootPendingAction(ensureModuleUiState(task.moduleId), rootActions.EXISTING_CASES);
        }
      });
    }

    function isRunningTaskStructuralRenderRequired(task) {
      if (!task || !task.scope) return false;
      var actionId = String(task.actionId || '');
      if (task.scope === 'root') {
        return Boolean(
          task.hadAiCasesBeforeAction === true
          || task.hadAiLayerBeforeAction === true
          || actionId === rootActions.EXISTING_CASES
          || actionId === rootActions.TOPUP_MODULES
          || actionId === rootActions.TOPUP_MODULES_CASES
        );
      }
      if (task.scope === 'module') {
        return Boolean(
          actionId === moduleActions.APPEND
          || task.hadAiCasesBeforeAction === true
          || task.createdModuleBeforeAction === true
          || task.rootPendingActionId
        );
      }
      return false;
    }

    function shouldRenderRunningTasksStructurally(tasks) {
      return (Array.isArray(tasks) ? tasks : []).some(function(task) {
        return isRunningTaskStructuralRenderRequired(task);
      });
    }

    function applyManagedTaskRunningUiProjection(task) {
      if (!task || !task.id) return;
      if (task.scope === 'root') {
        var rootState = ensureRootUiState();
        rootState.running = true;
        rootState.taskId = String(task.id || '');
        rootState.lastAction = String(task.actionId || rootState.lastAction || '');
        rootState.snapshotId = String(task.snapshotId || rootState.snapshotId || '');
        rootState.hideAiLayer = task.hadAiLayerBeforeAction === true;
        rootState.updatedAt = now();
        if (task.hadAiCasesBeforeAction === true) setAllModuleResultsVisibility(false);
        if (String(task.actionId || '') === rootActions.EXISTING_CASES) {
          markRootPendingModules(buildVisibleModuleContext().list, rootActions.EXISTING_CASES);
        }
        return;
      }
      if (task.scope === 'dedupe') {
        var dedupeState = ensureDedupeUiState();
        dedupeState.running = true;
        dedupeState.taskId = String(task.id || '');
        dedupeState.status = 'running';
        dedupeState.error = '';
        dedupeState.dedupeMode = normalizeDedupeMode(task.dedupeMode);
        dedupeState.batchCompleted = Number(task.modelRequestBatchCompleted || 0);
        dedupeState.batchTotal = Number(
          task.modelRequestBatchTotal || (Array.isArray(task.dedupeBatches) ? task.dedupeBatches.length : 0)
        );
        dedupeState.updatedAt = now();
        var dedupeRootState = ensureRootUiState();
        dedupeRootState.running = true;
        dedupeRootState.taskId = String(task.id || '');
        dedupeRootState.lastAction = dedupeActionId;
        dedupeRootState.updatedAt = now();
        return;
      }
      if (task.scope === 'coverage') {
        var coverageState = ensureCoverageUiState();
        coverageState.running = true;
        coverageState.taskId = String(task.id || '');
        coverageState.status = 'running';
        coverageState.error = '';
        coverageState.updatedAt = now();
        return;
      }
      if (task.scope === 'module' && task.moduleId) {
        var moduleState = ensureModuleUiState(task.moduleId);
        if (!moduleState) return;
        moduleState.running = true;
        moduleState.taskId = String(task.id || '');
        moduleState.lastAction = String(task.actionId || moduleState.lastAction || '');
        moduleState.snapshotId = String(task.snapshotId || moduleState.snapshotId || '');
        moduleState.hideResults = task.hadAiCasesBeforeAction === true;
        moduleState.updatedAt = now();
      }
    }

    function getTaskErrorMessage(task, err) {
      var message = '';
      if (task && task.error) message = String(task.error || '');
      if (!message && err && err.message) message = String(err.message || '');
      if (!message) message = '未知错误';
      return message.replace(/^XMind\s*用例生成失败[:：]\s*/i, '').trim() || '未知错误';
    }

    function buildGenerationCancelledInfo(task) {
      var reasonText = task && task.cancelMeta && task.cancelMeta.reason
        ? String(task.cancelMeta.reason || '')
        : '已手动中断当前 XMind 生成任务';
      return {
        resultKind: 'cancelled',
        reasonText: reasonText,
        diagnostics: [],
        previewText: '',
      };
    }

    function shouldSuppressTaskCancelToast(task) {
      return Boolean(task && task.cancelMeta && String(task.cancelMeta.source || '') === 'toolbar');
    }

    function resolveTaskModuleEntry(task, visibleContext) {
      var context = ensureVisibleModuleContext(visibleContext);
      var contextMap = context.map || {};
      if (task && task.moduleKey && contextMap[task.moduleKey]) return contextMap[task.moduleKey];
      if (task && task.moduleId) {
        var found = null;
        (Array.isArray(context.list) ? context.list : []).some(function(entry) {
          if (!entry || String(entry.aiModuleId || '') !== String(task.moduleId || '')) return false;
          found = entry;
          return true;
        });
        if (found) return found;
      }
      var moduleTitle = normalizeModuleTitle(task && task.moduleTitle ? task.moduleTitle : '');
      if (!moduleTitle) return null;
      var moduleId = task && task.moduleId ? String(task.moduleId || '') : '';
      return {
        moduleKey: normalizeModuleKey(moduleTitle),
        title: moduleTitle,
        baselineCases: [],
        aiCases: moduleId ? getAiCasesForModule(moduleId) : [],
        aiModule: moduleId ? findAiModuleById(moduleId) : null,
        aiModuleId: moduleId,
      };
    }

    function getManagedTaskAnchorNodeId(task, moduleEntry) {
      if (task && task.rootPipelineId) return getRootNodeId();
      if (task && task.scope === 'module') {
        if (moduleEntry) return getModuleNodeId(moduleEntry);
        return buildModuleNodeId(task && task.moduleKey ? task.moduleKey : 'module');
      }
      return getRootNodeId();
    }

    function cloneModulesWithoutCases(modules) {
      return (Array.isArray(modules) ? modules : []).map(function(item) {
        return {
          module: normalizeModuleTitle(item && item.module ? item.module : ''),
          key_scenarios: normalizeArrayField(item && item.key_scenarios),
          test_points: normalizeArrayField(item && item.test_points),
          coupled_modules: normalizeArrayField(item && item.coupled_modules),
          cases: [],
        };
      }).filter(function(item) {
        return Boolean(item && item.module);
      });
    }

    return {
      applyManagedTaskRunningUiProjection: applyManagedTaskRunningUiProjection,
      applyRootPipelineRunningUiProjection: applyRootPipelineRunningUiProjection,
      buildGenerationCancelledInfo: buildGenerationCancelledInfo,
      clearManagedTaskRunningUiProjection: clearManagedTaskRunningUiProjection,
      cloneModulesWithoutCases: cloneModulesWithoutCases,
      getManagedTaskAnchorNodeId: getManagedTaskAnchorNodeId,
      getTaskErrorMessage: getTaskErrorMessage,
      isRunningTaskStructuralRenderRequired: isRunningTaskStructuralRenderRequired,
      resolveTaskModuleEntry: resolveTaskModuleEntry,
      shouldRenderRunningTasksStructurally: shouldRenderRunningTasksStructurally,
      shouldSuppressTaskCancelToast: shouldSuppressTaskCancelToast,
    };
  }

  return { create: create };
});
