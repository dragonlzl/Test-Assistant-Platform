(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenDeleteController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var deleteUndoBtn = opts.deleteUndoBtn || null;
    var deleteRedoBtn = opts.deleteRedoBtn || null;
    var HISTORY_LIMIT = Math.max(1, Number(opts.historyLimit || 80));
    var DELETE_ACTION_ID = String(opts.deleteActionId || 'xmind-delete-selection');
    var cloneJson = port('cloneJson', function(value) { return value; });
    var cloneSelectionMap = port('cloneSelectionMap', function(value) { return value || {}; });
    var restoreSelectionMap = port('restoreSelectionMap', function(value) { return value || {}; });
    var ensureState = port('ensureState', function() { return {}; });
    var generateLocalId = port('generateLocalId', function() { return 'xmind-delete'; });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeCaseTitle = port('normalizeCaseTitle', function(value) { return String(value || '').trim(); });
    var buildCaseSignature = port('buildCaseSignature', function(item) {
      return normalizeCaseTitle(item && item.title);
    });
    var ensureVisibleModuleContext = port('ensureVisibleModuleContext', function(value) { return value || { map: {} }; });
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { map: {} }; });
    var hideOpenMindContextMenu = port('hideOpenMindContextMenu');
    var getConfirmDrawer = port('getConfirmDrawer', function() { return null; });
    var confirmFallback = port('confirmFallback', function() { return true; });
    var rememberDeletedBaselineModule = port('rememberDeletedBaselineModule', function() { return false; });
    var rememberDeletedBaselineCase = port('rememberDeletedBaselineCase', function() { return false; });
    var getAiCasesForModule = port('getAiCasesForModule', function() { return []; });
    var findAiModuleById = port('findAiModuleById', function() { return null; });
    var commitCaseList = port('commitCaseList');
    var clearModuleTopupHighlight = port('clearModuleTopupHighlight');
    var invalidateDeleteConflictingSnapshots = port('invalidateDeleteConflictingSnapshots');
    var hasImportedBaselineCases = port('hasImportedBaselineCases', function() { return false; });
    var ensureRootUiState = port('ensureRootUiState', function() { return {}; });
    var syncCasesGenPageRender = port('syncCasesGenPageRender');
    var syncInterruptButton = port('syncInterruptButton');
    var notifyStatus = port('notifyStatus');
    var render = port('render');
    var persistXmindState = port('persistXmindState');
    var hasAnyRunningGenerationOperation = port('hasAnyRunningGenerationOperation', function() { return false; });
    var now = port('now', function() { return Date.now(); });

    function buildDeleteHistorySnapshotPayload() {
      return {
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenResults: cloneJson(state.caseGenResults, {}),
        caseSelections: cloneSelectionMap(state.caseSelections),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenSource: String(state.caseGenSource || ''),
        deletedBaselineModuleKeys: cloneJson(ensureState().deletedBaselineModuleKeys, []),
        deletedBaselineCaseKeys: cloneJson(ensureState().deletedBaselineCaseKeys, []),
      };
    }

    function hasDeleteUndoHistory() {
      var xmindState = ensureState();
      return Array.isArray(xmindState.deleteUndoStack) && xmindState.deleteUndoStack.length > 0;
    }

    function hasDeleteRedoHistory() {
      var xmindState = ensureState();
      return Array.isArray(xmindState.deleteRedoStack) && xmindState.deleteRedoStack.length > 0;
    }

    function syncDeleteHistoryButtons() {
      var hasUndo = hasDeleteUndoHistory();
      var hasRedo = hasDeleteRedoHistory();
      if (deleteUndoBtn) {
        deleteUndoBtn.disabled = !hasUndo;
        deleteUndoBtn.title = hasUndo
          ? '撤回最近一次删除（Ctrl/Cmd+Z）'
          : '暂无可撤回的删除';
      }
      if (deleteRedoBtn) {
        deleteRedoBtn.disabled = !hasRedo;
        deleteRedoBtn.title = hasRedo
          ? '恢复最近一次撤回的删除（Ctrl/Cmd+Shift+Z）'
          : '暂无可恢复的删除';
      }
      syncInterruptButton();
    }

    function clearDeleteHistoryStacks() {
      var xmindState = ensureState();
      var hadHistory = (xmindState.deleteUndoStack && xmindState.deleteUndoStack.length)
        || (xmindState.deleteRedoStack && xmindState.deleteRedoStack.length);
      xmindState.deleteUndoStack = [];
      xmindState.deleteRedoStack = [];
      syncDeleteHistoryButtons();
      return Boolean(hadHistory);
    }

    function buildDeleteSummaryText(plan) {
      var modulesCount = plan && Array.isArray(plan.modules) ? plan.modules.length : 0;
      var casesCount = plan && Array.isArray(plan.cases) ? plan.cases.length : 0;
      var parts = [];
      if (modulesCount > 0) parts.push(String(modulesCount) + ' 个模块');
      if (casesCount > 0) parts.push(String(casesCount) + ' 条用例');
      return parts.join('、') || '当前选中内容';
    }

    function pushDeleteHistoryEntry(plan, beforeSnapshot, afterSnapshot) {
      var xmindState = ensureState();
      var entry = {
        id: generateLocalId('xmind-delete'),
        summaryText: buildDeleteSummaryText(plan),
        moduleCount: Array.isArray(plan && plan.modules) ? plan.modules.length : 0,
        caseCount: Array.isArray(plan && plan.cases) ? plan.cases.length : 0,
        before: cloneJson(beforeSnapshot, null),
        after: cloneJson(afterSnapshot, null),
        createdAt: now(),
      };
      xmindState.deleteUndoStack = Array.isArray(xmindState.deleteUndoStack) ? xmindState.deleteUndoStack : [];
      xmindState.deleteRedoStack = [];
      xmindState.deleteUndoStack.push(entry);
      if (xmindState.deleteUndoStack.length > HISTORY_LIMIT) {
        xmindState.deleteUndoStack = xmindState.deleteUndoStack.slice(xmindState.deleteUndoStack.length - HISTORY_LIMIT);
      }
      syncDeleteHistoryButtons();
      return entry;
    }

    function applyDeleteHistorySnapshot(snapshot, actionId) {
      if (!snapshot || typeof snapshot !== 'object') return false;
      state.caseGenModules = cloneJson(snapshot.caseGenModules, []);
      state.caseGenResults = cloneJson(snapshot.caseGenResults, {});
      state.caseSelections = restoreSelectionMap(snapshot.caseSelections);
      state.caseGenSuggestions = cloneJson(snapshot.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJson(snapshot.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJson(snapshot.caseGenProgress, {});
      state.caseGenTiming = cloneJson(snapshot.caseGenTiming, {});
      state.caseGenSource = String(snapshot.caseGenSource || '');
      ensureState().deletedBaselineModuleKeys = cloneJson(snapshot.deletedBaselineModuleKeys, []);
      ensureState().deletedBaselineCaseKeys = cloneJson(snapshot.deletedBaselineCaseKeys, []);
      ensureState().modules = {};
      invalidateDeleteConflictingSnapshots();
      ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      ensureState().hasImportedBaseline = hasImportedBaselineCases();
      ensureRootUiState().lastAction = String(actionId || '');
      ensureRootUiState().updatedAt = now();
      syncCasesGenPageRender();
      syncDeleteHistoryButtons();
      return true;
    }

    function undoLatestDeleteSelection() {
      var xmindState = ensureState();
      var list = Array.isArray(xmindState.deleteUndoStack) ? xmindState.deleteUndoStack : [];
      if (!list.length) return false;
      var entry = list.pop();
      if (!entry || !entry.before) {
        syncDeleteHistoryButtons();
        return false;
      }
      xmindState.deleteRedoStack = Array.isArray(xmindState.deleteRedoStack) ? xmindState.deleteRedoStack : [];
      xmindState.deleteRedoStack.push(entry);
      if (xmindState.deleteRedoStack.length > HISTORY_LIMIT) {
        xmindState.deleteRedoStack = xmindState.deleteRedoStack.slice(xmindState.deleteRedoStack.length - HISTORY_LIMIT);
      }
      if (!applyDeleteHistorySnapshot(entry.before, 'delete-undo')) return false;
      notifyStatus('已撤回删除：' + String(entry.summaryText || '当前选中内容'), 'ok');
      render({ reason: 'delete-undo' });
      persistXmindState(true);
      return true;
    }

    function redoLatestDeleteSelection() {
      var xmindState = ensureState();
      var list = Array.isArray(xmindState.deleteRedoStack) ? xmindState.deleteRedoStack : [];
      if (!list.length) return false;
      var entry = list.pop();
      if (!entry || !entry.after) {
        syncDeleteHistoryButtons();
        return false;
      }
      xmindState.deleteUndoStack = Array.isArray(xmindState.deleteUndoStack) ? xmindState.deleteUndoStack : [];
      xmindState.deleteUndoStack.push(entry);
      if (xmindState.deleteUndoStack.length > HISTORY_LIMIT) {
        xmindState.deleteUndoStack = xmindState.deleteUndoStack.slice(xmindState.deleteUndoStack.length - HISTORY_LIMIT);
      }
      if (!applyDeleteHistorySnapshot(entry.after, 'delete-redo')) return false;
      notifyStatus('已恢复删除：' + String(entry.summaryText || '当前选中内容'), 'ok');
      render({ reason: 'delete-redo' });
      persistXmindState(true);
      return true;
    }

    function isDeleteActionId(actionId) {
      return actionId === DELETE_ACTION_ID;
    }

    function isDeleteNodeType(type) {
      return type === 'module'
        || type === 'case'
        || type === 'priority'
        || type === 'preconditions'
        || type === 'steps'
        || type === 'expected';
    }

    function buildDeleteTargetKey(meta) {
      if (!meta || !meta.type) return '';
      if (meta.type === 'module') {
        return 'module::' + String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || ''));
      }
      if (!isDeleteNodeType(meta.type)) return '';
      return [
        'case',
        String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || '')),
        String(meta.caseSource || ''),
        String(Number(meta.caseSourceIndex)),
        String(meta.caseSignature || normalizeCaseTitle(meta.caseTitle || ''))
      ].join('::');
    }

    function buildDeleteSelectionPlan(nodeMeta) {
      var selection = nodeMeta && Array.isArray(nodeMeta.selection) && nodeMeta.selection.length
        ? nodeMeta.selection
        : (nodeMeta ? [nodeMeta] : []);
      var visibleContext = ensureVisibleModuleContext(buildVisibleModuleContext());
      var visibleMap = visibleContext.map || {};
      var moduleTargets = {};
      var caseTargets = {};

      selection.forEach(function(item) {
        var meta = item && item.meta ? item.meta : null;
        if (!meta || !isDeleteNodeType(meta.type)) return;
        var moduleKey = String(meta.moduleKey || normalizeModuleKey(meta.moduleTitle || ''));
        var moduleEntry = moduleKey ? visibleMap[moduleKey] : null;
        var moduleTitle = normalizeModuleTitle(
          meta.moduleTitle
          || (moduleEntry && moduleEntry.title)
          || ''
        );
        if (!moduleKey && !moduleTitle) return;
        if (meta.type === 'module') {
          if (!moduleTargets[moduleKey]) {
            moduleTargets[moduleKey] = {
              type: 'module',
              key: buildDeleteTargetKey(meta),
              moduleKey: moduleKey,
              moduleTitle: moduleTitle || '模块',
              moduleId: moduleEntry && moduleEntry.aiModuleId ? String(moduleEntry.aiModuleId || '') : '',
              deleteAiLayer: Boolean(moduleEntry && moduleEntry.aiModuleId),
              deleteBaselineLayer: Boolean(moduleEntry && Array.isArray(moduleEntry.baselineCases) && moduleEntry.baselineCases.length > 0),
            };
          } else {
            moduleTargets[moduleKey].deleteAiLayer = moduleTargets[moduleKey].deleteAiLayer || Boolean(moduleEntry && moduleEntry.aiModuleId);
            moduleTargets[moduleKey].deleteBaselineLayer = moduleTargets[moduleKey].deleteBaselineLayer || Boolean(moduleEntry && Array.isArray(moduleEntry.baselineCases) && moduleEntry.baselineCases.length > 0);
          }
          return;
        }
        if (!moduleEntry && !moduleTitle) return;
        caseTargets[buildDeleteTargetKey(meta)] = {
          type: 'case',
          moduleKey: moduleKey,
          moduleTitle: moduleTitle || '模块',
          moduleId: moduleEntry && moduleEntry.aiModuleId ? String(moduleEntry.aiModuleId || '') : '',
          caseTitle: String(meta.caseTitle || ''),
          caseSource: String(meta.caseSource || ''),
          caseSourceIndex: Number.isFinite(Number(meta.caseSourceIndex)) ? Number(meta.caseSourceIndex) : -1,
          caseSignature: String(meta.caseSignature || ''),
        };
      });

      Object.keys(caseTargets).forEach(function(key) {
        var target = caseTargets[key];
        if (target && target.moduleKey && moduleTargets[target.moduleKey]) {
          delete caseTargets[key];
        }
      });

      return {
        modules: Object.keys(moduleTargets).map(function(key) { return moduleTargets[key]; }),
        cases: Object.keys(caseTargets).map(function(key) { return caseTargets[key]; }),
      };
    }

    function hasDeleteTargets(nodeMeta) {
      var plan = buildDeleteSelectionPlan(nodeMeta);
      return Boolean((plan.modules && plan.modules.length) || (plan.cases && plan.cases.length));
    }

    function confirmDeleteSelection(plan) {
      hideOpenMindContextMenu();
      var confirmDrawer = getConfirmDrawer();
      var summary = buildDeleteSummaryText(plan);
      var message = '确认删除选中的 ' + summary + '？删除后会以当前树为新的基线，之前的“放弃本次生成”回退记录将失效。';
      if (!confirmDrawer || typeof confirmDrawer.open !== 'function') {
        return Promise.resolve(confirmFallback(message) === true);
      }
      return confirmDrawer.open({
        title: '确认删除',
        message: message,
        confirmText: '确认删除',
        cancelText: '取消',
        danger: true,
      }).then(function(result) {
        return Boolean(result && result.ok === true);
      });
    }

    function removeAiModuleRecord(moduleId) {
      var targetId = String(moduleId || '');
      if (!targetId) return false;
      var beforeCount = Array.isArray(state.caseGenModules) ? state.caseGenModules.length : 0;
      state.caseGenModules = (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).filter(function(mod) {
        return !mod || String(mod.id || '') !== targetId;
      });
      delete state.caseGenResults[targetId];
      delete state.caseSelections[targetId];
      delete state.caseGenSuggestions[targetId];
      delete state.caseGenModuleStatus[targetId];
      delete state.caseGenProgress[targetId];
      delete state.caseGenTiming[targetId];
      if (ensureState().modules && ensureState().modules[targetId]) {
        delete ensureState().modules[targetId];
      }
      ensureState().hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      return beforeCount !== state.caseGenModules.length;
    }

    function removeAiCasesFromModule(moduleId, targets) {
      var targetId = String(moduleId || '');
      var list = getAiCasesForModule(targetId);
      var targetList = Array.isArray(targets) ? targets.slice() : [];
      var moduleRecord = findAiModuleById(targetId);
      var moduleTitle = moduleRecord ? normalizeModuleTitle(moduleRecord.title || moduleRecord.module || '') : '';
      var removedCount = 0;
      if (!targetId || !list.length || !targetList.length) return 0;
      var nextList = list.filter(function(item, index) {
        var shouldDelete = targetList.some(function(target) {
          if (!target || String(target.caseSource || '') !== 'ai') return false;
          var targetIndex = Number(target.caseSourceIndex);
          if (Number.isFinite(targetIndex) && targetIndex !== index) return false;
          if (target.caseSignature) {
            return String(target.caseSignature || '') === buildCaseSignature(item, moduleTitle);
          }
          if (target.caseTitle) {
            return normalizeCaseTitle(target.caseTitle) === normalizeCaseTitle(item && item.title);
          }
          return true;
        });
        if (shouldDelete) {
          removedCount += 1;
          return false;
        }
        return true;
      });
      if (!removedCount) return 0;
      commitCaseList(targetId, nextList, null, '', '');
      return removedCount;
    }

    async function handleDeleteSelection(nodeMeta) {
      hideOpenMindContextMenu();
      if (hasAnyRunningGenerationOperation()) {
        notifyStatus('当前有生成任务进行中，请等待完成后再删除', 'warn', { forceInline: true });
        return false;
      }
      var plan = buildDeleteSelectionPlan(nodeMeta);
      if (!plan.modules.length && !plan.cases.length) {
        notifyStatus('当前选中节点不支持删除', 'warn', { forceInline: true });
        return false;
      }
      var confirmed = await confirmDeleteSelection(plan);
      if (!confirmed) return false;
      var beforeSnapshot = buildDeleteHistorySnapshotPayload();
      var changed = false;
      var affectedModuleIds = {};

      plan.modules.forEach(function(target) {
        if (!target) return;
        if (target.deleteBaselineLayer === true) {
          changed = rememberDeletedBaselineModule(target.moduleTitle) || changed;
        }
        if (target.deleteAiLayer === true && target.moduleId) {
          affectedModuleIds[String(target.moduleId || '')] = true;
          changed = removeAiModuleRecord(target.moduleId) || changed;
        }
      });

      var aiCaseTargetsByModule = {};
      plan.cases.forEach(function(target) {
        if (!target) return;
        if (target.caseSource === 'baseline') {
          changed = rememberDeletedBaselineCase(target.moduleTitle, target.caseSignature) || changed;
          return;
        }
        if (target.caseSource === 'ai' && target.moduleId) {
          var key = String(target.moduleId || '');
          if (!aiCaseTargetsByModule[key]) aiCaseTargetsByModule[key] = [];
          aiCaseTargetsByModule[key].push(target);
        }
      });

      Object.keys(aiCaseTargetsByModule).forEach(function(moduleId) {
        var removedCount = removeAiCasesFromModule(moduleId, aiCaseTargetsByModule[moduleId]);
        if (removedCount > 0) {
          affectedModuleIds[moduleId] = true;
          changed = true;
        }
      });

      if (!changed) {
        notifyStatus('当前选中内容未发生变化', 'warn', { forceInline: true });
        return false;
      }

      Object.keys(affectedModuleIds).forEach(function(moduleId) {
        var moduleState = ensureState().modules ? ensureState().modules[moduleId] : null;
        if (moduleState) clearModuleTopupHighlight(moduleState);
      });
      invalidateDeleteConflictingSnapshots();
      pushDeleteHistoryEntry(plan, beforeSnapshot, buildDeleteHistorySnapshotPayload());
      syncCasesGenPageRender();
      notifyStatus('已删除 ' + buildDeleteSummaryText(plan), 'ok');
      render({ reason: 'delete-selection' });
      persistXmindState(true);
      return true;
    }

    function buildDeleteAction(nodeMeta) {
      var enabled = hasDeleteTargets(nodeMeta) && !hasAnyRunningGenerationOperation();
      return {
        id: DELETE_ACTION_ID,
        label: '删除',
        disabled: !enabled,
      };
    }

    return {
      applyDeleteHistorySnapshot: applyDeleteHistorySnapshot,
      buildDeleteAction: buildDeleteAction,
      buildDeleteHistorySnapshotPayload: buildDeleteHistorySnapshotPayload,
      buildDeleteSelectionPlan: buildDeleteSelectionPlan,
      buildDeleteSummaryText: buildDeleteSummaryText,
      buildDeleteTargetKey: buildDeleteTargetKey,
      clearDeleteHistoryStacks: clearDeleteHistoryStacks,
      confirmDeleteSelection: confirmDeleteSelection,
      handleDeleteSelection: handleDeleteSelection,
      hasDeleteRedoHistory: hasDeleteRedoHistory,
      hasDeleteTargets: hasDeleteTargets,
      hasDeleteUndoHistory: hasDeleteUndoHistory,
      isDeleteActionId: isDeleteActionId,
      isDeleteNodeType: isDeleteNodeType,
      pushDeleteHistoryEntry: pushDeleteHistoryEntry,
      redoLatestDeleteSelection: redoLatestDeleteSelection,
      removeAiCasesFromModule: removeAiCasesFromModule,
      removeAiModuleRecord: removeAiModuleRecord,
      syncDeleteHistoryButtons: syncDeleteHistoryButtons,
      undoLatestDeleteSelection: undoLatestDeleteSelection,
    };
  }

  return { create: create };
});
