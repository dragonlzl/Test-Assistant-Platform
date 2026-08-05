(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenSnapshotController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var state = opts.state || {};
    var ROOT_ACTIONS = opts.rootActions || {};
    var cloneJson = port('cloneJson', function(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    });
    var cloneSelectionMap = port('cloneSelectionMap', function(value) { return cloneJson(value, {}); });
    var restoreSelectionMap = port('restoreSelectionMap', function(value) { return cloneJson(value, {}); });
    var ensureState = port('ensureState', function() {
      return {
        nextSnapshotId: 1,
        operationSnapshots: [],
        root: {},
        modules: {},
        snapshots: [],
        rootSnapshots: [],
      };
    });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return {}; });
    var clearAllTopupHighlights = port('clearAllTopupHighlights');
    var clearModuleTopupHighlight = port('clearModuleTopupHighlight');
    var clearDeleteHistoryStacks = port('clearDeleteHistoryStacks');
    var syncCasesGenPageRender = port('syncCasesGenPageRender');
    var persistXmindState = port('persistXmindState');
    var now = port('now', function() { return Date.now(); });

    function getLatestCaseGenOperationSnapshotLocal() {
      var xmindState = ensureState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      return list.length ? list[list.length - 1] : null;
    }

    function syncCaseGenOperationPointersLocal() {
      var xmindState = ensureState();
      var latest = getLatestCaseGenOperationSnapshotLocal();
      xmindState.lastOperationSnapshotId = latest && latest.id ? String(latest.id || '') : '';
      xmindState.rootSnapshotId = latest && latest.scope === 'root'
        ? String(latest.id || '')
        : '';
      xmindState.root.snapshotId = String(xmindState.rootSnapshotId || '');
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        if (latest && latest.scope === 'module' && String(latest.moduleId || '') === String(key || '')) {
          moduleState.snapshotId = String(latest.id || '');
        } else {
          moduleState.snapshotId = '';
        }
      });
    }

    function createCaseGenOperationSnapshotLocal(scope, moduleId) {
      var xmindState = ensureState();
      var snapshotId = 'op-snap-' + String(xmindState.nextSnapshotId || 1);
      xmindState.nextSnapshotId = Number(xmindState.nextSnapshotId || 1) + 1;
      xmindState.operationSnapshots.push({
        id: snapshotId,
        scope: scope === 'module' ? 'module' : 'root',
        moduleId: moduleId ? String(moduleId || '') : '',
        caseGenModules: cloneJson(state.caseGenModules, []),
        caseGenResults: cloneJson(state.caseGenResults, {}),
        caseSelections: cloneSelectionMap(state.caseSelections),
        caseGenSuggestions: cloneJson(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(state.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(state.caseGenProgress, {}),
        caseGenTiming: cloneJson(state.caseGenTiming, {}),
        caseGenSource: String(state.caseGenSource || ''),
        createdAt: now(),
      });
      syncCaseGenOperationPointersLocal();
      xmindState.root.updatedAt = now();
      return snapshotId;
    }

    function discardCaseGenOperationSnapshotLocal(snapshotId) {
      var targetId = String(snapshotId || '');
      if (!targetId) return false;
      var xmindState = ensureState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      var nextList = list.filter(function(item) {
        return item && String(item.id || '') !== targetId;
      });
      if (nextList.length === list.length) return false;
      xmindState.operationSnapshots = nextList;
      syncCaseGenOperationPointersLocal();
      return true;
    }

    function applyCaseGenOperationSnapshotLocal(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return false;
      var xmindState = ensureState();
      state.caseGenModules = cloneJson(snapshot.caseGenModules, []);
      state.caseGenResults = cloneJson(snapshot.caseGenResults, {});
      state.caseSelections = restoreSelectionMap(snapshot.caseSelections);
      state.caseGenSuggestions = cloneJson(snapshot.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJson(snapshot.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJson(snapshot.caseGenProgress, {});
      state.caseGenTiming = cloneJson(snapshot.caseGenTiming, {});
      state.caseGenSource = String(snapshot.caseGenSource || '');
      xmindState.hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      xmindState.root.lastAction = ROOT_ACTIONS.ROLLBACK;
      xmindState.root.running = false;
      xmindState.root.taskId = '';
      xmindState.root.status = '';
      xmindState.root.error = '';
      xmindState.root.updatedAt = now();
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.rootPendingActionId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        moduleState.lastAction = 'rollback';
        moduleState.updatedAt = now();
      });
      syncCaseGenOperationPointersLocal();
      clearAllTopupHighlights();
      clearDeleteHistoryStacks();
      syncCasesGenPageRender();
      persistXmindState(true);
      return true;
    }

    function rollbackCaseGenOperationSnapshotLocal(snapshotId) {
      var xmindState = ensureState();
      var targetId = String(snapshotId || '');
      var snapshot = null;
      var index = -1;
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      if (targetId) {
        for (var i = list.length - 1; i >= 0; i -= 1) {
          var item = list[i];
          if (!item || String(item.id || '') !== targetId) continue;
          snapshot = item;
          index = i;
          break;
        }
      } else if (list.length) {
        index = list.length - 1;
        snapshot = list[index];
      }
      if (!snapshot || index < 0) return false;
      xmindState.operationSnapshots.splice(index, 1);
      return applyCaseGenOperationSnapshotLocal(snapshot);
    }

    function snapshotAllCaseGenStateLocal() {
      return createCaseGenOperationSnapshotLocal('root', '');
    }

    function rollbackAllCaseGenStateLocal() {
      var latest = getLatestCaseGenOperationSnapshotLocal();
      if (!latest) return false;
      return rollbackCaseGenOperationSnapshotLocal(String(latest.id || '')) === true;
    }

    function invalidateDeleteConflictingSnapshots() {
      var xmindState = ensureState();
      xmindState.snapshots = [];
      xmindState.rootSnapshots = [];
      xmindState.operationSnapshots = [];
      xmindState.lastOperationSnapshotId = '';
      xmindState.rootSnapshotId = '';
      if (xmindState.root) {
        xmindState.root.snapshotId = '';
        xmindState.root.running = false;
        xmindState.root.taskId = '';
        xmindState.root.hideAiLayer = false;
        xmindState.root.status = '';
        xmindState.root.error = '';
      }
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureModuleUiState(key);
        if (!moduleState) return;
        moduleState.snapshotId = '';
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.rootPendingActionId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        clearModuleTopupHighlight(moduleState);
      });
      clearAllTopupHighlights();
    }

    function clearStaleModuleUiState() {
      var rootState = ensureState();
      var valid = {};
      (state.caseGenModules || []).forEach(function(moduleRecord) {
        if (!moduleRecord || !moduleRecord.id) return;
        valid[String(moduleRecord.id)] = true;
      });
      Object.keys(rootState.modules).forEach(function(key) {
        if (!valid[key]) delete rootState.modules[key];
      });
      rootState.snapshots = rootState.snapshots.filter(function(item) {
        if (!item) return false;
        if (!item.moduleId) return false;
        return item.moduleExistsBefore !== true || valid[String(item.moduleId || '')] || item.moduleExistsBefore === false;
      });
    }

    return {
      applyCaseGenOperationSnapshotLocal: applyCaseGenOperationSnapshotLocal,
      clearStaleModuleUiState: clearStaleModuleUiState,
      createCaseGenOperationSnapshotLocal: createCaseGenOperationSnapshotLocal,
      discardCaseGenOperationSnapshotLocal: discardCaseGenOperationSnapshotLocal,
      getLatestCaseGenOperationSnapshotLocal: getLatestCaseGenOperationSnapshotLocal,
      invalidateDeleteConflictingSnapshots: invalidateDeleteConflictingSnapshots,
      rollbackAllCaseGenStateLocal: rollbackAllCaseGenStateLocal,
      rollbackCaseGenOperationSnapshotLocal: rollbackCaseGenOperationSnapshotLocal,
      snapshotAllCaseGenStateLocal: snapshotAllCaseGenStateLocal,
      syncCaseGenOperationPointersLocal: syncCaseGenOperationPointersLocal,
    };
  }

  return { create: create };
});
