(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenOperationController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var casesGenApi = opts.casesGenApi || {};
    var ROOT_ACTIONS = opts.rootActions || {};
    var MODULE_ACTIONS = opts.moduleActions || {};
    var DEDUPE_ACTION_ID = String(opts.dedupeActionId || 'xmind-ai-dedupe');
    var COVERAGE_ACTION_ID = String(opts.coverageActionId || 'xmind-requirement-coverage');
    var getActiveWorkspaceId = port('getActiveWorkspaceId', function() { return ''; });
    var getManagedXmindTaskListIfReady = port('getManagedXmindTaskListIfReady', function() { return null; });
    var filterTasksByWorkspace = port('filterTasksByWorkspace', function(list) { return Array.isArray(list) ? list : []; });
    var ensureRootUiState = port('ensureRootUiState', function() { return {}; });
    var getRootPipelineState = port('getRootPipelineState', function() { return null; });
    var isRootGenerationVisuallyRunning = port('isRootGenerationVisuallyRunning', function(value) {
      return Boolean(value && value.running === true);
    });
    var ensureDedupeUiState = port('ensureDedupeUiState', function() { return {}; });
    var normalizeDedupeMode = port('normalizeDedupeMode', function(value) { return String(value || ''); });
    var ensureCoverageUiState = port('ensureCoverageUiState', function() { return {}; });
    var ensureState = port('ensureState', function() { return { modules: {} }; });
    var findAiModuleById = port('findAiModuleById', function() { return null; });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var getAiCasesForModule = port('getAiCasesForModule', function() { return []; });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return null; });
    var getDedupeRunningLabel = port('getDedupeRunningLabel', function() { return 'AI用例去重中'; });
    var getLatestCaseGenOperationSnapshotLocal = port('getLatestCaseGenOperationSnapshotLocal', function() { return null; });
    var rollbackCaseGenOperationSnapshotLocal = port('rollbackCaseGenOperationSnapshotLocal', function() { return false; });
    var discardCaseGenOperationSnapshotLocal = port('discardCaseGenOperationSnapshotLocal', function() { return false; });
    var hasVisibleImportedBaselineCases = port('hasVisibleImportedBaselineCases', function() { return false; });
    var getVisibleCasesForModuleEntry = port('getVisibleCasesForModuleEntry', function() { return []; });
    var now = port('now', function() { return Date.now(); });

    function hasAnyAiCases() {
      var modules = Array.isArray(state.caseGenModules) ? state.caseGenModules : [];
      for (var i = 0; i < modules.length; i += 1) {
        if (!modules[i] || !modules[i].id) continue;
        if (getAiCasesForModule(modules[i].id).length > 0) return true;
      }
      return false;
    }

    function hasAnyAiModules() {
      return Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
    }

    function isRootActionId(actionId) {
      return actionId === ROOT_ACTIONS.FULL_CASES
        || actionId === ROOT_ACTIONS.FULL_MODULES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
        || actionId === ROOT_ACTIONS.EXISTING_CASES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES
        || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES
        || actionId === ROOT_ACTIONS.APPEND_ALL
        || actionId === ROOT_ACTIONS.ROLLBACK;
    }

    function isModuleActionId(actionId) {
      return actionId === MODULE_ACTIONS.FULL_CASES
        || actionId === MODULE_ACTIONS.APPEND
        || actionId === MODULE_ACTIONS.ROLLBACK;
    }

    function isRollbackActionId(actionId) {
      return actionId === ROOT_ACTIONS.ROLLBACK || actionId === MODULE_ACTIONS.ROLLBACK;
    }

    function isRootModuleOnlyIncrementalAction(actionId) {
      return actionId === ROOT_ACTIONS.TOPUP_MODULES || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES;
    }

    function collectRunningGenerationOperations() {
      var activeWorkspaceId = getActiveWorkspaceId();
      var managedTasks = getManagedXmindTaskListIfReady();
      if (Array.isArray(managedTasks)) {
        var runningTasks = filterTasksByWorkspace(managedTasks, activeWorkspaceId).filter(function(task) {
          return task && task.status === 'running';
        });
        return runningTasks.map(function(task) {
          if (!task) return null;
          if (task.scope === 'root') {
            return {
              scope: 'root',
              actionId: String(task.actionId || task.rootPipelineActionId || ''),
              label: '根节点',
            };
          }
          if (task.scope === 'module') {
            return {
              scope: 'module',
              actionId: String(task.actionId || ''),
              moduleId: String(task.moduleId || ''),
              moduleKey: String(task.moduleKey || ''),
              label: task.moduleTitle ? String(task.moduleTitle || '') : '模块',
            };
          }
          if (task.scope === 'dedupe') {
            return {
              scope: 'dedupe',
              actionId: DEDUPE_ACTION_ID,
              dedupeMode: normalizeDedupeMode(task.dedupeMode),
              batchCompleted: Number(task.modelRequestBatchCompleted || 0),
              batchTotal: Number(task.modelRequestBatchTotal || (Array.isArray(task.dedupeBatches) ? task.dedupeBatches.length : 0)),
              label: 'AI用例去重',
            };
          }
          if (task.scope === 'coverage') {
            return {
              scope: 'coverage',
              actionId: COVERAGE_ACTION_ID,
              label: '需求覆盖分析',
            };
          }
          return null;
        }).filter(Boolean);
      }
      var operations = [];
      var rootState = ensureRootUiState();
      var rootActionId = rootState && rootState.lastAction ? String(rootState.lastAction || '') : '';
      var pipeline = getRootPipelineState();
      if (!rootActionId && pipeline && pipeline.actionId) rootActionId = String(pipeline.actionId || '');
      if (rootState && isRootGenerationVisuallyRunning(rootState) && rootActionId && rootActionId !== DEDUPE_ACTION_ID) {
        operations.push({ scope: 'root', actionId: rootActionId, label: '根节点' });
      }
      var dedupeState = ensureDedupeUiState();
      if (dedupeState.running === true) {
        operations.push({
          scope: 'dedupe',
          actionId: DEDUPE_ACTION_ID,
          dedupeMode: normalizeDedupeMode(dedupeState.dedupeMode),
          batchCompleted: Number(dedupeState.batchCompleted || 0),
          batchTotal: Number(dedupeState.batchTotal || 0),
          label: 'AI用例去重',
        });
      } else if (dedupeState.terminalVisualRunning === true && Number(dedupeState.terminalVisualUntil || 0) > now()) {
        operations.push({
          scope: 'dedupe',
          actionId: DEDUPE_ACTION_ID,
          dedupeMode: normalizeDedupeMode(dedupeState.dedupeMode),
          label: 'AI用例去重',
        });
      }
      var coverageState = ensureCoverageUiState();
      if (coverageState.running === true) {
        operations.push({ scope: 'coverage', actionId: COVERAGE_ACTION_ID, label: '需求覆盖分析' });
      }
      var modulesState = ensureState().modules || {};
      Object.keys(modulesState).forEach(function(key) {
        var moduleState = modulesState[key];
        if (!moduleState || moduleState.running !== true) return;
        var moduleRecord = findAiModuleById(key);
        operations.push({
          scope: 'module',
          actionId: String(moduleState.lastAction || ''),
          moduleId: String(key || ''),
          moduleKey: moduleRecord ? normalizeModuleKey(moduleRecord.title || moduleRecord.module || '') : '',
          label: moduleRecord && (moduleRecord.title || moduleRecord.module)
            ? String(moduleRecord.title || moduleRecord.module)
            : '模块',
        });
      });
      return operations;
    }

    function hasAnyRunningGenerationOperation() {
      return collectRunningGenerationOperations().length > 0;
    }

    function doesRootActionConflictWithModuleOperation(rootActionId) {
      if (isRollbackActionId(rootActionId)) return true;
      if (isRootModuleOnlyIncrementalAction(rootActionId)) return false;
      return true;
    }

    function doesModuleActionConflictWithRootOperation(rootActionId, moduleActionId) {
      if (isRollbackActionId(moduleActionId)) return true;
      if (isRootModuleOnlyIncrementalAction(rootActionId)) return false;
      return true;
    }

    function doesModuleActionConflictWithModuleOperation(actionId, moduleEntry, runningOperation) {
      if (!runningOperation) return false;
      if (isRollbackActionId(actionId)) return true;
      var targetModuleId = moduleEntry && moduleEntry.aiModuleId ? String(moduleEntry.aiModuleId || '') : '';
      var targetModuleKey = moduleEntry && moduleEntry.moduleKey ? String(moduleEntry.moduleKey || '') : '';
      if (targetModuleId && runningOperation.moduleId && targetModuleId === String(runningOperation.moduleId || '')) return true;
      if (targetModuleKey && runningOperation.moduleKey && targetModuleKey === String(runningOperation.moduleKey || '')) return true;
      return false;
    }

    function resolveBlockingOperation(actionId, moduleEntry) {
      var operations = collectRunningGenerationOperations();
      if (!operations.length) return null;
      for (var i = 0; i < operations.length; i += 1) {
        var operation = operations[i];
        if (!operation) continue;
        if (operation.scope === 'root') {
          if (isRootActionId(actionId)) return operation;
          if (isModuleActionId(actionId) && doesModuleActionConflictWithRootOperation(operation.actionId, actionId)) {
            return operation;
          }
          continue;
        }
        if (operation.scope === 'module') {
          if (isRootActionId(actionId) && doesRootActionConflictWithModuleOperation(actionId)) return operation;
          if (isModuleActionId(actionId) && doesModuleActionConflictWithModuleOperation(actionId, moduleEntry, operation)) {
            return operation;
          }
        }
        if (operation.scope === 'dedupe' || operation.scope === 'coverage') return operation;
      }
      return null;
    }

    function isActionBlocked(actionId, moduleEntry) {
      return Boolean(resolveBlockingOperation(actionId, moduleEntry));
    }

    function getRootFullCasesLabel(hasAiContent) {
      return hasAiContent ? '重新生成全量用例' : '生成全量用例';
    }

    function getModuleFullCasesLabel(moduleEntry) {
      var moduleId = moduleEntry && moduleEntry.aiModuleId ? String(moduleEntry.aiModuleId || '') : '';
      return moduleId && getAiCasesForModule(moduleId).length > 0 ? '重新生成全量用例' : '生成全量用例';
    }

    function setModuleResultsVisibility(moduleId, visible) {
      var moduleState = ensureModuleUiState(moduleId);
      if (!moduleState) return;
      moduleState.hideResults = visible !== true;
      moduleState.updatedAt = now();
    }

    function setAllModuleResultsVisibility(visible) {
      (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).forEach(function(mod) {
        if (!mod || !mod.id) return;
        setModuleResultsVisibility(mod.id, visible === true);
      });
    }

    function buildBlockedActionMessage(actionId, blocker) {
      if (!blocker) return '当前动作不可执行';
      if (blocker.scope === 'root') {
        if (isRootModuleOnlyIncrementalAction(blocker.actionId) && isModuleActionId(actionId)) {
          return '当前模块可继续生成，用例无冲突时允许并行';
        }
        return '当前有根节点生成任务会影响该操作，请等待完成后再试';
      }
      if (blocker.scope === 'module') {
        if (isRootModuleOnlyIncrementalAction(actionId)) return '';
        return blocker.label
          ? ('当前有模块生成任务进行中：' + blocker.label)
          : '当前有模块生成任务进行中，请等待完成后再试';
      }
      if (blocker.scope === 'dedupe') return getDedupeRunningLabel(blocker.dedupeMode) + '，请等待完成后再试';
      if (blocker.scope === 'coverage') return '需求覆盖分析中，请等待完成后再试';
      return '当前动作不可执行';
    }

    function getLatestCaseGenOperationSnapshotEntry() {
      if (casesGenApi && typeof casesGenApi.getLatestCaseGenOperationSnapshot === 'function') {
        return casesGenApi.getLatestCaseGenOperationSnapshot();
      }
      return getLatestCaseGenOperationSnapshotLocal();
    }

    function rollbackCaseGenOperationSnapshotEntry(snapshotId) {
      if (casesGenApi && typeof casesGenApi.rollbackCaseGenOperationSnapshot === 'function') {
        return casesGenApi.rollbackCaseGenOperationSnapshot(snapshotId) === true;
      }
      return rollbackCaseGenOperationSnapshotLocal(snapshotId) === true;
    }

    function discardCaseGenOperationSnapshotEntry(snapshotId) {
      if (casesGenApi && typeof casesGenApi.discardCaseGenOperationSnapshot === 'function') {
        return casesGenApi.discardCaseGenOperationSnapshot(snapshotId) === true;
      }
      return discardCaseGenOperationSnapshotLocal(snapshotId) === true;
    }

    function getRootActions() {
      var hasBaseline = hasVisibleImportedBaselineCases();
      var hasSkeleton = hasAnyAiModules();
      var hasAiCases = hasAnyAiCases();
      var fullCasesLabel = getRootFullCasesLabel(hasSkeleton || hasAiCases);
      var canRollback = Boolean(getLatestCaseGenOperationSnapshotEntry());
      if (!hasBaseline && !hasSkeleton && !hasAiCases) {
        return [
          { id: ROOT_ACTIONS.FULL_CASES, label: fullCasesLabel, disabled: isActionBlocked(ROOT_ACTIONS.FULL_CASES, null) },
          { id: ROOT_ACTIONS.FULL_MODULES, label: '生成全量模块', disabled: isActionBlocked(ROOT_ACTIONS.FULL_MODULES, null) },
        ];
      }
      if (!hasBaseline) {
        var actions = [{ id: ROOT_ACTIONS.FULL_CASES, label: fullCasesLabel, disabled: isActionBlocked(ROOT_ACTIONS.FULL_CASES, null) }];
        if (hasSkeleton) {
          actions.push({ id: ROOT_ACTIONS.REGENERATE_MODULES, label: '重新生成模块', disabled: isActionBlocked(ROOT_ACTIONS.REGENERATE_MODULES, null) });
        }
        return actions.concat([
          { id: ROOT_ACTIONS.EXISTING_CASES, label: '已有模块补全用例', disabled: isActionBlocked(ROOT_ACTIONS.EXISTING_CASES, null) },
          { id: ROOT_ACTIONS.TOPUP_MODULES, label: '补全模块', disabled: isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES, null) },
          { id: ROOT_ACTIONS.TOPUP_MODULES_CASES, label: '补全模块+用例', disabled: isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES_CASES, null) },
          { id: ROOT_ACTIONS.ROLLBACK, label: '放弃本次生成', disabled: !canRollback || hasAnyRunningGenerationOperation() },
        ]);
      }
      var baselineActions = [];
      if (hasSkeleton) {
        baselineActions.push({ id: ROOT_ACTIONS.REGENERATE_MODULES, label: '重新生成模块', disabled: isActionBlocked(ROOT_ACTIONS.REGENERATE_MODULES, null) });
      }
      return baselineActions.concat([
        { id: ROOT_ACTIONS.TOPUP_MODULES, label: '补全模块', disabled: isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES, null) },
        { id: ROOT_ACTIONS.TOPUP_MODULES_CASES, label: '补全模块+用例', disabled: isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES_CASES, null) },
        { id: ROOT_ACTIONS.APPEND_ALL, label: '追加生成全部模块+用例', disabled: isActionBlocked(ROOT_ACTIONS.APPEND_ALL, null) },
        { id: ROOT_ACTIONS.ROLLBACK, label: '放弃本次生成', disabled: !canRollback || hasAnyRunningGenerationOperation() },
      ]);
    }

    function getModuleActions(moduleEntry) {
      var moduleId = moduleEntry && moduleEntry.aiModuleId ? moduleEntry.aiModuleId : '';
      var latestOperation = getLatestCaseGenOperationSnapshotEntry();
      var canRollback = Boolean(
        latestOperation
        && latestOperation.scope === 'module'
        && String(latestOperation.moduleId || '') === String(moduleId || '')
      );
      var hasVisibleCases = getVisibleCasesForModuleEntry(moduleEntry).length > 0;
      return [
        { id: MODULE_ACTIONS.FULL_CASES, label: getModuleFullCasesLabel(moduleEntry), disabled: isActionBlocked(MODULE_ACTIONS.FULL_CASES, moduleEntry) },
        { id: MODULE_ACTIONS.APPEND, label: '追加生成', disabled: !hasVisibleCases || isActionBlocked(MODULE_ACTIONS.APPEND, moduleEntry) },
        { id: MODULE_ACTIONS.ROLLBACK, label: '放弃本次生成', disabled: !canRollback || hasAnyRunningGenerationOperation() },
      ];
    }

    return {
      buildBlockedActionMessage: buildBlockedActionMessage,
      collectRunningGenerationOperations: collectRunningGenerationOperations,
      discardCaseGenOperationSnapshotEntry: discardCaseGenOperationSnapshotEntry,
      doesModuleActionConflictWithModuleOperation: doesModuleActionConflictWithModuleOperation,
      doesModuleActionConflictWithRootOperation: doesModuleActionConflictWithRootOperation,
      doesRootActionConflictWithModuleOperation: doesRootActionConflictWithModuleOperation,
      getLatestCaseGenOperationSnapshotEntry: getLatestCaseGenOperationSnapshotEntry,
      getModuleActions: getModuleActions,
      getModuleFullCasesLabel: getModuleFullCasesLabel,
      getRootActions: getRootActions,
      getRootFullCasesLabel: getRootFullCasesLabel,
      hasAnyAiCases: hasAnyAiCases,
      hasAnyAiModules: hasAnyAiModules,
      hasAnyRunningGenerationOperation: hasAnyRunningGenerationOperation,
      isActionBlocked: isActionBlocked,
      isModuleActionId: isModuleActionId,
      isRollbackActionId: isRollbackActionId,
      isRootActionId: isRootActionId,
      isRootModuleOnlyIncrementalAction: isRootModuleOnlyIncrementalAction,
      resolveBlockingOperation: resolveBlockingOperation,
      rollbackCaseGenOperationSnapshotEntry: rollbackCaseGenOperationSnapshotEntry,
      setAllModuleResultsVisibility: setAllModuleResultsVisibility,
      setModuleResultsVisibility: setModuleResultsVisibility,
    };
  }

  return { create: create };
});
