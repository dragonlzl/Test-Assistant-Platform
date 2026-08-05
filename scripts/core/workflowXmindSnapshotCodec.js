(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.workflowXmindSnapshotCodec = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var cloneJson = typeof opts.cloneJson === 'function'
      ? opts.cloneJson
      : function(value, fallback) {
          try {
            return JSON.parse(JSON.stringify(value));
          } catch (err) {
            return fallback;
          }
        };
    var normalizeImportedCases = typeof opts.normalizeImportedCases === 'function'
      ? opts.normalizeImportedCases
      : function(list) { return Array.isArray(list) ? list.slice() : []; };
    var createEmptyRequirementMediaSnapshot = typeof opts.createEmptyRequirementMediaSnapshot === 'function'
      ? opts.createEmptyRequirementMediaSnapshot
      : function() {
          return { docxImages: [], pastedImages: [], lastDocxImageCount: 0, updatedAt: 0 };
        };
    var workspaceHostKeys = {
      activeWorkspaceId: 1,
      mirrorWorkspaceId: 1,
      workspaceOrder: 1,
      workspaces: 1,
      nextWorkspaceSeq: 1,
      openButtonDotVisible: 1,
    };

    function createEmptySnapshot() {
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
        viewState: {
          drawerOpen: false,
          fullscreen: false,
          transform: '',
          scaleVal: 1,
          scrollLeft: 0,
          scrollTop: 0,
          collapsedNodeKeys: [],
          treeSourceSignature: '',
          updatedAt: 0,
        },
        history: [],
        operationSnapshots: [],
        lastOperationSnapshotId: '',
        rootSnapshotId: '',
        rootSnapshots: [],
        deletedBaselineModuleKeys: [],
        deletedBaselineCaseKeys: [],
        deleteUndoStack: [],
        deleteRedoStack: [],
        root: {
          lastAction: '',
          running: false,
          taskId: '',
          snapshotId: '',
          status: '',
          error: '',
          updatedAt: 0,
        },
        summaryCollapsed: false,
        prep: {
          step: 1,
          requirementMode: '',
          requirementSupplement: '',
          manualRequirementBlocks: [],
          caseImportMode: '',
          completed: false,
        },
        nextSnapshotId: 1,
        snapshots: [],
        modules: {},
      };
    }

    function compactCaseGenResult(value) {
      var text = value === null || value === undefined ? '' : String(value || '');
      if (!text) return '';
      try {
        return JSON.stringify(JSON.parse(text));
      } catch (err) {
        return text;
      }
    }

    function compactCaseGenResultsMap(map) {
      var source = map && typeof map === 'object' ? map : {};
      var next = {};
      Object.keys(source).forEach(function(key) {
        next[key] = compactCaseGenResult(source[key]);
      });
      return next;
    }

    function compactRootPipeline(pipeline) {
      var source = pipeline && typeof pipeline === 'object' ? pipeline : null;
      if (!source) return null;
      return {
        id: String(source.id || ''),
        actionId: String(source.actionId || ''),
        snapshotId: String(source.snapshotId || ''),
        historyActionLabel: String(source.historyActionLabel || ''),
        stage: String(source.stage || ''),
        discoveryStatus: String(source.discoveryStatus || ''),
        hadAiContentBeforeAction: source.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: source.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: source.hadAiCasesBeforeAction === true,
        cancelled: source.cancelled === true,
        cancelReason: String(source.cancelReason || ''),
        errorCount: Number(source.errorCount || 0) || 0,
        createdModules: Number(source.createdModules || 0) || 0,
        addedCases: Number(source.addedCases || 0) || 0,
        detailMap: cloneJson(source.detailMap, {}) || {},
        diagnostics: Array.isArray(source.diagnostics) ? source.diagnostics.slice() : [],
        pendingQueue: Array.isArray(source.pendingQueue) ? cloneJson(source.pendingQueue, []) : [],
        updatedAt: Number(source.updatedAt || 0) || 0,
      };
    }

    function compactRootState(rootState) {
      var source = rootState && typeof rootState === 'object' ? rootState : {};
      return {
        lastAction: String(source.lastAction || ''),
        running: source.running === true,
        taskId: String(source.taskId || ''),
        hideAiLayer: source.hideAiLayer === true,
        snapshotId: '',
        status: String(source.status || ''),
        error: String(source.error || ''),
        updatedAt: Number(source.updatedAt || 0) || 0,
        pipeline: compactRootPipeline(source.pipeline),
      };
    }

    function compactModuleState(moduleState) {
      var source = moduleState && typeof moduleState === 'object' ? moduleState : {};
      return {
        lastAction: String(source.lastAction || ''),
        running: source.running === true,
        taskId: String(source.taskId || ''),
        rootPendingActionId: String(source.rootPendingActionId || ''),
        snapshotId: '',
        status: String(source.status || ''),
        error: String(source.error || ''),
        hideResults: source.hideResults === true,
        updatedAt: Number(source.updatedAt || 0) || 0,
        topupHighlight: null,
        rollbackRestoreTopupHighlight: null,
      };
    }

    function compactModulesMap(map) {
      var source = map && typeof map === 'object' ? map : {};
      var next = {};
      Object.keys(source).forEach(function(key) {
        next[key] = compactModuleState(source[key]);
      });
      return next;
    }

    function buildPersistedSharedSnapshot(source) {
      var current = source && typeof source === 'object' ? source : {};
      return {
        requirementLabel: current.requirementLabel || '',
        requirementLabelSource: current.requirementLabelSource || '',
        lastRawImportName: current.lastRawImportName || '',
        rawText: current.rawText || '',
        caseText: current.caseText || '',
        importedCases: normalizeImportedCases(current.importedCases),
        caseGenModules: cloneJson(current.caseGenModules, []),
        caseGenSource: current.caseGenSource || '',
        caseGenResults: compactCaseGenResultsMap(current.caseGenResults),
        caseSelections: cloneJson(current.caseSelections, {}),
        caseGenSuggestions: cloneJson(current.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(current.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(current.caseGenProgress, {}),
        caseGenTiming: cloneJson(current.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(current.caseGenProgressNotice, {}),
        caseGenSettings: cloneJson(current.caseGenSettings, {}),
        requirementMedia: cloneJson(current.requirementMedia, createEmptyRequirementMediaSnapshot()),
      };
    }

    function compactXmindSnapshot(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var next = {};
      Object.keys(source).forEach(function(key) {
        if (workspaceHostKeys[key]) return;
        if (
          key === 'operationSnapshots'
          || key === 'rootSnapshots'
          || key === 'snapshots'
          || key === 'deleteUndoStack'
          || key === 'deleteRedoStack'
        ) {
          next[key] = [];
          return;
        }
        if (key === 'root') {
          next.root = compactRootState(source.root);
          return;
        }
        if (key === 'modules') {
          next.modules = compactModulesMap(source.modules);
          return;
        }
        next[key] = cloneJson(source[key], source[key]);
      });
      next.lastOperationSnapshotId = '';
      next.rootSnapshotId = '';
      if (!next.root || typeof next.root !== 'object') {
        next.root = compactRootState(null);
      } else {
        next.root.snapshotId = '';
      }
      if (next.modules && typeof next.modules === 'object') {
        Object.keys(next.modules).forEach(function(key) {
          if (!next.modules[key] || typeof next.modules[key] !== 'object') return;
          next.modules[key].snapshotId = '';
        });
      }
      return next;
    }

    function compactWorkspaceSnapshot(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      return {
        xmind: compactXmindSnapshot(source.xmind),
        shared: buildPersistedSharedSnapshot(source.shared),
      };
    }

    function compactWorkspaceRecord(id, record) {
      var source = record && typeof record === 'object' ? record : {};
      return {
        id: String(id || source.id || ''),
        seq: Number(source.seq || 0) || 0,
        name: String(source.name || ''),
        generationId: String(source.generationId || ''),
        pendingOpenPrep: source.pendingOpenPrep === true,
        updatedAt: Number(source.updatedAt || 0) || 0,
        createdAt: Number(source.createdAt || 0) || 0,
        snapshot: compactWorkspaceSnapshot(source.snapshot),
      };
    }

    function extractTopLevelSnapshot(source) {
      var current = source && typeof source === 'object' ? source : {};
      var next = {};
      Object.keys(current).forEach(function(key) {
        if (workspaceHostKeys[key]) return;
        next[key] = cloneJson(current[key], current[key]);
      });
      return next;
    }

    function shouldCompactActiveWorkspace(hostState, activeWorkspaceId, activeXmindSnapshot, activeSharedSnapshot) {
      var host = hostState && typeof hostState === 'object' ? hostState : null;
      if (!host || !host.workspaces || typeof host.workspaces !== 'object') return false;
      var stableId = activeWorkspaceId ? String(activeWorkspaceId || '') : '';
      if (!stableId) return false;
      var record = host.workspaces[stableId];
      if (!record || typeof record !== 'object') return false;
      var snapshot = record.snapshot && typeof record.snapshot === 'object' ? record.snapshot : null;
      if (!snapshot) return false;
      var recordXmind = snapshot.xmind && typeof snapshot.xmind === 'object' ? snapshot.xmind : null;
      var recordShared = snapshot.shared && typeof snapshot.shared === 'object' ? snapshot.shared : null;
      if (!recordXmind || !recordShared) return false;
      try {
        return JSON.stringify(recordXmind) === JSON.stringify(activeXmindSnapshot)
          && JSON.stringify(recordShared) === JSON.stringify(activeSharedSnapshot);
      } catch (err) {
        return false;
      }
    }

    function buildPersistedSnapshot(value, activeSharedSnapshot) {
      var source = value && typeof value === 'object' ? value : {};
      var host = {
        activeWorkspaceId: source.activeWorkspaceId ? String(source.activeWorkspaceId || '') : '',
        mirrorWorkspaceId: source.mirrorWorkspaceId ? String(source.mirrorWorkspaceId || '') : '',
        workspaceOrder: Array.isArray(source.workspaceOrder) ? cloneJson(source.workspaceOrder, []) : [],
        workspaces: {},
        nextWorkspaceSeq: Number(source.nextWorkspaceSeq || 1) || 1,
        openButtonDotVisible: source.openButtonDotVisible === true,
      };
      var activeWorkspaceId = host.activeWorkspaceId;
      var activeXmindSnapshot = compactXmindSnapshot(source);
      var sharedSnapshot = activeSharedSnapshot && typeof activeSharedSnapshot === 'object'
        ? activeSharedSnapshot
        : buildPersistedSharedSnapshot(null);
      Object.keys(activeXmindSnapshot).forEach(function(key) {
        host[key] = activeXmindSnapshot[key];
      });
      if (source.workspaces && typeof source.workspaces === 'object') {
        Object.keys(source.workspaces).forEach(function(workspaceId) {
          host.workspaces[workspaceId] = compactWorkspaceRecord(workspaceId, source.workspaces[workspaceId]);
        });
      }
      if (!activeWorkspaceId || !host.workspaces || typeof host.workspaces !== 'object') return host;
      if (!shouldCompactActiveWorkspace(host, activeWorkspaceId, activeXmindSnapshot, sharedSnapshot)) return host;
      var record = host.workspaces[activeWorkspaceId];
      if (!record || typeof record !== 'object') return host;
      record.snapshot = { __topLevelActiveSnapshot: true };
      host.workspaces[activeWorkspaceId] = record;
      return host;
    }

    function restoreActiveWorkspaceFromTopLevel(data) {
      var source = data && typeof data === 'object' ? data : null;
      if (!source || !source.xmindCaseGen || typeof source.xmindCaseGen !== 'object') return source;
      var host = source.xmindCaseGen;
      var activeWorkspaceId = host.activeWorkspaceId ? String(host.activeWorkspaceId || '') : '';
      if (!activeWorkspaceId) return source;
      if (!host.workspaces || typeof host.workspaces !== 'object') host.workspaces = {};
      var record = host.workspaces[activeWorkspaceId];
      if (!record || typeof record !== 'object') {
        record = {
          id: activeWorkspaceId,
          seq: 0,
          name: '',
          pendingOpenPrep: false,
          updatedAt: 0,
          createdAt: 0,
        };
      }
      var markerSnapshot = record.snapshot && typeof record.snapshot === 'object' ? record.snapshot : null;
      var needsInflate = !markerSnapshot
        || markerSnapshot.__topLevelActiveSnapshot === true
        || (!markerSnapshot.xmind && !markerSnapshot.shared);
      if (!needsInflate) return source;
      record.snapshot = {
        xmind: extractTopLevelSnapshot(host),
        shared: buildPersistedSharedSnapshot(source),
      };
      host.workspaces[activeWorkspaceId] = record;
      if (!Array.isArray(host.workspaceOrder)) {
        host.workspaceOrder = [activeWorkspaceId];
      } else if (host.workspaceOrder.indexOf(activeWorkspaceId) === -1) {
        host.workspaceOrder = host.workspaceOrder.concat([activeWorkspaceId]);
      }
      return source;
    }

    function prepareSnapshotData(data) {
      return restoreActiveWorkspaceFromTopLevel(cloneJson(data, data));
    }

    return {
      createEmptySnapshot: createEmptySnapshot,
      compactCaseGenResultsMap: compactCaseGenResultsMap,
      buildPersistedSharedSnapshot: buildPersistedSharedSnapshot,
      compactXmindSnapshot: compactXmindSnapshot,
      buildPersistedSnapshot: buildPersistedSnapshot,
      prepareSnapshotData: prepareSnapshotData,
    };
  }

  return { create: create };
});
