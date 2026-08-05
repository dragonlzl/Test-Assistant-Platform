(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.casesGenSnapshotOwner = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var runtime = opts.runtime || {};
    var state = opts.state;
    var renderImportedCaseList = opts.renderImportedCaseList;
    var syncCaseTextWithImports = opts.syncCaseTextWithImports;
    var persistWorkflowState = opts.persistWorkflowState;
    var ensureCaseModuleStatusState = typeof opts.ensureCaseModuleStatusState === 'function' ? opts.ensureCaseModuleStatusState : noop;
    var ensureXmindCaseGenState = typeof opts.ensureXmindCaseGenState === 'function' ? opts.ensureXmindCaseGenState : noop;
    var shouldDeferXmindCasegenMirrorRender = typeof opts.shouldDeferXmindCasegenMirrorRender === 'function' ? opts.shouldDeferXmindCasegenMirrorRender : noop;
    var queueDeferredXmindCasegenMirrorRender = typeof opts.queueDeferredXmindCasegenMirrorRender === 'function' ? opts.queueDeferredXmindCasegenMirrorRender : noop;
    var ensureXmindCaseGenModuleState = typeof opts.ensureXmindCaseGenModuleState === 'function' ? opts.ensureXmindCaseGenModuleState : noop;
    var ensureCaseModuleTimingState = typeof opts.ensureCaseModuleTimingState === 'function' ? opts.ensureCaseModuleTimingState : noop;
    var closeCaseViewIfActive = typeof opts.closeCaseViewIfActive === 'function' ? opts.closeCaseViewIfActive : noop;
    var ensureCaseGenSettings = typeof opts.ensureCaseGenSettings === 'function' ? opts.ensureCaseGenSettings : noop;
    var updateSupplementButtons = typeof opts.updateSupplementButtons === 'function' ? opts.updateSupplementButtons : noop;
    var refreshCaseSelectionUI = typeof opts.refreshCaseSelectionUI === 'function' ? opts.refreshCaseSelectionUI : noop;
    var getCaseListForModule = typeof opts.getCaseListForModule === 'function' ? opts.getCaseListForModule : noop;
    var renderCaseGeneration = typeof opts.renderCaseGeneration === 'function' ? opts.renderCaseGeneration : noop;

    function cloneJsonValue(value, fallback) {
      if (value === undefined) return fallback;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (err) {
        return fallback;
      }
    }

    function cloneSelectionSet(selection) {
      if (!selection || typeof selection.forEach !== 'function') return [];
      var result = [];
      selection.forEach(function(idx) {
        var num = Number(idx);
        if (Number.isFinite(num)) result.push(num);
      });
      return result;
    }

    function createEmptyLegacyCaseGenState() {
      return {
        requirementLabel: '',
        requirementLabelSource: '',
        lastRawImportName: '',
        rawText: '',
        caseText: '',
        importedCases: [],
        requirementMedia: {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        },
        modules: [],
        source: '',
        results: {},
        selections: {},
        suggestions: {},
        moduleStatus: {},
        progress: {},
        timing: {},
        progressNotice: {},
        running: [],
      };
    }

    function cloneCaseGenRunningState(source) {
      var values = [];
      if (source instanceof Set) {
        values = Array.from(source);
      } else if (Array.isArray(source)) {
        values = source.slice();
      }
      return values.filter(function(item) {
        if (item === null || item === undefined) return false;
        if (typeof item === 'string') return item.trim() !== '';
        return true;
      });
    }

    function restoreCaseGenRunningSet(list) {
      return new Set(cloneCaseGenRunningState(list));
    }

    function ensureLegacyCaseGenState() {
      if (!state.caseGenLegacy || typeof state.caseGenLegacy !== 'object') {
        state.caseGenLegacy = createEmptyLegacyCaseGenState();
      }
      state.caseGenLegacy.requirementLabel = String(state.caseGenLegacy.requirementLabel || '');
      state.caseGenLegacy.requirementLabelSource = String(state.caseGenLegacy.requirementLabelSource || '');
      state.caseGenLegacy.lastRawImportName = String(state.caseGenLegacy.lastRawImportName || '');
      state.caseGenLegacy.rawText = String(state.caseGenLegacy.rawText || '');
      state.caseGenLegacy.caseText = String(state.caseGenLegacy.caseText || '');
      if (!Array.isArray(state.caseGenLegacy.importedCases)) state.caseGenLegacy.importedCases = [];
      if (!state.caseGenLegacy.requirementMedia || typeof state.caseGenLegacy.requirementMedia !== 'object') {
        state.caseGenLegacy.requirementMedia = {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        };
      }
      if (!Array.isArray(state.caseGenLegacy.requirementMedia.docxImages)) state.caseGenLegacy.requirementMedia.docxImages = [];
      if (!Array.isArray(state.caseGenLegacy.requirementMedia.pastedImages)) state.caseGenLegacy.requirementMedia.pastedImages = [];
      if (!Number.isFinite(Number(state.caseGenLegacy.requirementMedia.lastDocxImageCount))) {
        state.caseGenLegacy.requirementMedia.lastDocxImageCount = 0;
      }
      if (!Number.isFinite(Number(state.caseGenLegacy.requirementMedia.updatedAt))) {
        state.caseGenLegacy.requirementMedia.updatedAt = 0;
      }
      if (!Array.isArray(state.caseGenLegacy.modules)) state.caseGenLegacy.modules = [];
      state.caseGenLegacy.source = String(state.caseGenLegacy.source || '');
      if (!state.caseGenLegacy.results || typeof state.caseGenLegacy.results !== 'object') state.caseGenLegacy.results = {};
      if (!state.caseGenLegacy.selections || typeof state.caseGenLegacy.selections !== 'object') state.caseGenLegacy.selections = {};
      if (!state.caseGenLegacy.suggestions || typeof state.caseGenLegacy.suggestions !== 'object') state.caseGenLegacy.suggestions = {};
      if (!state.caseGenLegacy.moduleStatus || typeof state.caseGenLegacy.moduleStatus !== 'object') state.caseGenLegacy.moduleStatus = {};
      if (!state.caseGenLegacy.progress || typeof state.caseGenLegacy.progress !== 'object') state.caseGenLegacy.progress = {};
      if (!state.caseGenLegacy.timing || typeof state.caseGenLegacy.timing !== 'object') state.caseGenLegacy.timing = {};
      if (!state.caseGenLegacy.progressNotice || typeof state.caseGenLegacy.progressNotice !== 'object') {
        state.caseGenLegacy.progressNotice = {};
      }
      state.caseGenLegacy.running = cloneCaseGenRunningState(state.caseGenLegacy.running);
      return state.caseGenLegacy;
    }

    function cloneCaseSelectionMap() {
      var result = {};
      var source = state.caseSelections && typeof state.caseSelections === 'object'
        ? state.caseSelections
        : {};
      Object.keys(source).forEach(function(key) {
        result[key] = cloneSelectionSet(source[key]);
      });
      return result;
    }

    function buildCurrentCaseGenSharedSnapshot() {
      return {
        modules: cloneJsonValue(state.caseGenModules, []),
        source: String(state.caseGenSource || ''),
        results: cloneJsonValue(state.caseGenResults, {}),
        selections: cloneCaseSelectionMap(),
        suggestions: cloneJsonValue(state.caseGenSuggestions, {}),
        moduleStatus: cloneJsonValue(ensureCaseModuleStatusState(), {}),
        progress: cloneJsonValue(state.caseGenProgress, {}),
        timing: cloneJsonValue(ensureCaseModuleTimingState(), {}),
        progressNotice: cloneJsonValue(state.caseGenProgressNotice, {}),
      };
    }

    function caseGenSnapshotHasOutputContent(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      if (Array.isArray(source.modules) && source.modules.length) return true;
      if (source.results && typeof source.results === 'object' && Object.keys(source.results).length) return true;
      if (source.suggestions && typeof source.suggestions === 'object' && Object.keys(source.suggestions).length) return true;
      if (source.moduleStatus && typeof source.moduleStatus === 'object' && Object.keys(source.moduleStatus).length) return true;
      if (source.progress && typeof source.progress === 'object' && Object.keys(source.progress).length) return true;
      if (source.timing && typeof source.timing === 'object' && Object.keys(source.timing).length) return true;
      if (source.progressNotice && typeof source.progressNotice === 'object' && Object.keys(source.progressNotice).length) return true;
      if (Array.isArray(source.running) && source.running.length) return true;
      return false;
    }

    function shouldRestoreLegacyCaseGenForRender() {
      var legacy = ensureLegacyCaseGenState();
      var current = buildCurrentCaseGenSharedSnapshot();
      if (caseGenSnapshotHasOutputContent(legacy)) return true;
      return !caseGenSnapshotHasOutputContent(current);
    }

    function buildCurrentLegacyWorkflowInputSnapshot() {
      var rawTextEl = typeof document !== 'undefined' ? document.getElementById('rawText') : null;
      var caseTextEl = typeof document !== 'undefined' ? document.getElementById('caseText') : null;
      return {
        requirementLabel: String(state.requirementLabel || ''),
        requirementLabelSource: String(state.requirementLabelSource || ''),
        lastRawImportName: String(state.lastRawImportName || ''),
        rawText: rawTextEl && rawTextEl.value ? String(rawTextEl.value || '') : '',
        caseText: caseTextEl && caseTextEl.value ? String(caseTextEl.value || '') : '',
        importedCases: cloneJsonValue(state.importedCases, []),
        requirementMedia: cloneJsonValue(state.requirementMedia, {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        }),
      };
    }

    function syncLegacyCaseGenState(options) {
      var opts = options || {};
      if (shouldDeferXmindCasegenMirrorRender()) {
        queueDeferredXmindCasegenMirrorRender();
        return ensureLegacyCaseGenState();
      }
      var settings = ensureCaseGenSettings();
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var xmindDrawerOpen = Boolean(xmindApi && typeof xmindApi.isOpen === 'function' && xmindApi.isOpen());
      if (
        opts.force !== true
        && (xmindDrawerOpen || settings.activeTab === 'xmind-modules' || settings.activeTab === 'modules')
      ) {
        return ensureLegacyCaseGenState();
      }
      var legacy = ensureLegacyCaseGenState();
      var current = buildCurrentCaseGenSharedSnapshot();
      var workflowInputs = buildCurrentLegacyWorkflowInputSnapshot();
      legacy.requirementLabel = workflowInputs.requirementLabel;
      legacy.requirementLabelSource = workflowInputs.requirementLabelSource;
      legacy.lastRawImportName = workflowInputs.lastRawImportName;
      legacy.rawText = workflowInputs.rawText;
      legacy.caseText = workflowInputs.caseText;
      legacy.importedCases = workflowInputs.importedCases;
      legacy.requirementMedia = workflowInputs.requirementMedia;
      legacy.modules = current.modules;
      legacy.source = current.source;
      legacy.results = current.results;
      legacy.selections = current.selections;
      legacy.suggestions = current.suggestions;
      legacy.moduleStatus = current.moduleStatus;
      legacy.progress = current.progress;
      legacy.timing = current.timing;
      legacy.progressNotice = current.progressNotice;
      legacy.running = cloneCaseGenRunningState(state.caseGenRunning);
      if (!opts || opts.persist !== false) {
        persistWorkflowState();
      }
      return legacy;
    }

    function restoreLegacyCaseGenState(options) {
      var opts = options || {};
      if (shouldDeferXmindCasegenMirrorRender()) {
        queueDeferredXmindCasegenMirrorRender();
        return false;
      }
      var settings = ensureCaseGenSettings();
      var activeView = settings && (settings.activeTab === 'xmind-modules' || settings.activeTab === 'modules')
        ? 'xmind-modules'
        : (settings && settings.activeTab === 'legacy-modules' ? 'legacy-modules' : 'settings');
      var xmindApi = window.app && window.app.xmindCasegenApi ? window.app.xmindCasegenApi : null;
      var xmindDrawerOpen = Boolean(xmindApi && typeof xmindApi.isOpen === 'function' && xmindApi.isOpen());
      if (
        opts.allowWhileXmindMirror !== true
        && activeView === 'xmind-modules'
        && !xmindDrawerOpen
      ) {
        return false;
      }
      var legacy = ensureLegacyCaseGenState();
      if (opts.restoreInputs === true) {
        var rawTextEl = typeof document !== 'undefined' ? document.getElementById('rawText') : null;
        var fileNameEl = typeof document !== 'undefined' ? document.getElementById('fileName') : null;
        var caseTextEl = typeof document !== 'undefined' ? document.getElementById('caseText') : null;
        state.requirementLabel = String(legacy.requirementLabel || '');
        state.requirementLabelSource = String(legacy.requirementLabelSource || '');
        state.lastRawImportName = String(legacy.lastRawImportName || '');
        state.importedCases = cloneJsonValue(legacy.importedCases, []);
        state.requirementMedia = cloneJsonValue(legacy.requirementMedia, {
          docxImages: [],
          pastedImages: [],
          lastDocxImageCount: 0,
          updatedAt: 0,
        });
        if (rawTextEl) rawTextEl.value = String(legacy.rawText || '');
        if (fileNameEl) {
          fileNameEl.textContent = state.lastRawImportName ? String(state.lastRawImportName || '') : '未选择文件';
        }
        if (caseTextEl) caseTextEl.value = String(legacy.caseText || '');
        renderImportedCaseList();
        syncCaseTextWithImports();
      }
      if (opts.inputsOnly === true) {
        if (opts.persist !== false) {
          persistWorkflowState();
        }
        return true;
      }
      state.caseGenModules = cloneJsonValue(legacy.modules, []);
      state.caseGenSource = String(legacy.source || '');
      state.caseGenResults = cloneJsonValue(legacy.results, {});
      state.caseSelections = {};
      Object.keys(legacy.selections || {}).forEach(function(key) {
        state.caseSelections[key] = restoreSelectionSet(legacy.selections[key]);
      });
      state.caseGenSuggestions = cloneJsonValue(legacy.suggestions, {});
      state.caseGenModuleStatus = cloneJsonValue(legacy.moduleStatus, {});
      state.caseGenProgress = cloneJsonValue(legacy.progress, {});
      state.caseGenTiming = cloneJsonValue(legacy.timing, {});
      state.caseGenProgressNotice = cloneJsonValue(legacy.progressNotice, {});
      state.caseGenRunning = restoreCaseGenRunningSet(legacy.running);
      if (opts.render !== false) {
        renderCaseGeneration();
      }
      if (opts.persist !== false) {
        persistWorkflowState();
      }
      return true;
    }

    function getLegacyCaseGenRenderState() {
      var legacy = ensureLegacyCaseGenState();
      return {
        modules: Array.isArray(legacy.modules) ? legacy.modules : [],
        source: String(legacy.source || ''),
        results: legacy.results && typeof legacy.results === 'object' ? legacy.results : {},
        selections: legacy.selections && typeof legacy.selections === 'object' ? legacy.selections : {},
        suggestions: legacy.suggestions && typeof legacy.suggestions === 'object' ? legacy.suggestions : {},
        moduleStatus: legacy.moduleStatus && typeof legacy.moduleStatus === 'object' ? legacy.moduleStatus : {},
        progress: legacy.progress && typeof legacy.progress === 'object' ? legacy.progress : {},
        timing: legacy.timing && typeof legacy.timing === 'object' ? legacy.timing : {},
      };
    }

    function buildOperationSnapshotPayload(scope, moduleId) {
      return {
        id: 'op-snap-' + String(ensureXmindCaseGenState().nextSnapshotId),
        scope: scope === 'module' ? 'module' : 'root',
        moduleId: moduleId ? String(moduleId || '') : '',
        caseGenModules: cloneJsonValue(state.caseGenModules, []),
        caseGenResults: cloneJsonValue(state.caseGenResults, {}),
        caseSelections: cloneCaseSelectionMap(),
        caseGenSuggestions: cloneJsonValue(state.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJsonValue(ensureCaseModuleStatusState(), {}),
        caseGenProgress: cloneJsonValue(state.caseGenProgress, {}),
        caseGenTiming: cloneJsonValue(ensureCaseModuleTimingState(), {}),
        caseGenSource: String(state.caseGenSource || ''),
        createdAt: Date.now(),
      };
    }

    function getLatestCaseGenOperationSnapshot() {
      var xmindState = ensureXmindCaseGenState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      return list.length ? list[list.length - 1] : null;
    }

    function syncCaseGenOperationPointers() {
      var xmindState = ensureXmindCaseGenState();
      var latest = getLatestCaseGenOperationSnapshot();
      xmindState.lastOperationSnapshotId = latest && latest.id ? String(latest.id || '') : '';
      xmindState.rootSnapshotId = latest && latest.scope === 'root'
        ? String(latest.id || '')
        : '';
      xmindState.root.snapshotId = String(xmindState.rootSnapshotId || '');
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureXmindCaseGenModuleState(key);
        if (latest && latest.scope === 'module' && String(latest.moduleId || '') === String(key || '')) {
          moduleState.snapshotId = String(latest.id || '');
        } else {
          moduleState.snapshotId = '';
        }
      });
    }

    function createCaseGenOperationSnapshot(scope, moduleId) {
      var xmindState = ensureXmindCaseGenState();
      var snapshot = buildOperationSnapshotPayload(scope, moduleId);
      xmindState.nextSnapshotId += 1;
      xmindState.operationSnapshots.push(snapshot);
      syncCaseGenOperationPointers();
      xmindState.root.updatedAt = Date.now();
      if (moduleId) {
        var moduleState = ensureXmindCaseGenModuleState(moduleId);
        if (moduleState) moduleState.updatedAt = Date.now();
      }
      return String(snapshot.id || '');
    }

    function discardCaseGenOperationSnapshot(snapshotId) {
      var targetId = String(snapshotId || '');
      if (!targetId) return false;
      var xmindState = ensureXmindCaseGenState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      var nextList = list.filter(function(item) {
        return item && String(item.id || '') !== targetId;
      });
      if (nextList.length === list.length) return false;
      xmindState.operationSnapshots = nextList;
      syncCaseGenOperationPointers();
      return true;
    }

    function applyOperationSnapshot(snapshot, rollbackAction) {
      if (!snapshot || typeof snapshot !== 'object') return false;
      state.caseGenModules = cloneJsonValue(snapshot.caseGenModules, []);
      state.caseGenResults = cloneJsonValue(snapshot.caseGenResults, {});
      state.caseSelections = {};
      Object.keys(snapshot.caseSelections || {}).forEach(function(key) {
        state.caseSelections[key] = restoreSelectionSet(snapshot.caseSelections[key]);
      });
      state.caseGenSuggestions = cloneJsonValue(snapshot.caseGenSuggestions, {});
      state.caseGenModuleStatus = cloneJsonValue(snapshot.caseGenModuleStatus, {});
      state.caseGenProgress = cloneJsonValue(snapshot.caseGenProgress, {});
      state.caseGenTiming = cloneJsonValue(snapshot.caseGenTiming, {});
      state.caseGenSource = String(snapshot.caseGenSource || '');
      var xmindState = ensureXmindCaseGenState();
      xmindState.hasModuleSkeleton = Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
      xmindState.root.lastAction = rollbackAction || 'rollback';
      xmindState.root.running = false;
      xmindState.root.status = '';
      xmindState.root.error = '';
      xmindState.root.updatedAt = Date.now();
      Object.keys(xmindState.modules || {}).forEach(function(key) {
        var moduleState = ensureXmindCaseGenModuleState(key);
        moduleState.running = false;
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        moduleState.lastAction = rollbackAction || 'rollback';
        moduleState.updatedAt = Date.now();
      });
      syncCaseGenOperationPointers();
      closeCaseViewIfActive(runtime.ALL_CASE_VIEW_ID);
      (Array.isArray(state.caseGenModules) ? state.caseGenModules : []).forEach(function(mod) {
        if (!mod || !mod.id) return;
        refreshCaseSelectionUI(mod.id);
        updateSupplementButtons(mod.id, getCaseListForModule(mod.id).length > 0);
      });
      renderCaseGeneration();
      persistWorkflowState();
      return true;
    }

    function rollbackCaseGenOperationSnapshot(snapshotId) {
      var targetId = String(snapshotId || '');
      var xmindState = ensureXmindCaseGenState();
      var list = Array.isArray(xmindState.operationSnapshots) ? xmindState.operationSnapshots : [];
      var snapshot = null;
      var index = -1;
      if (targetId) {
        for (var i = list.length - 1; i >= 0; i -= 1) {
          if (!list[i] || String(list[i].id || '') !== targetId) continue;
          snapshot = list[i];
          index = i;
          break;
        }
      } else if (list.length) {
        index = list.length - 1;
        snapshot = list[index];
      }
      if (!snapshot || index < 0) return false;
      xmindState.operationSnapshots.splice(index, 1);
      return applyOperationSnapshot(snapshot, 'rollback');
    }

    function snapshotModuleCases(moduleId) {
      if (!moduleId) return '';
      return createCaseGenOperationSnapshot('module', moduleId);
    }

    function findModuleSnapshot(moduleId, snapshotId) {
      var xmindState = ensureXmindCaseGenState();
      var targetId = snapshotId ? String(snapshotId) : '';
      for (var i = xmindState.snapshots.length - 1; i >= 0; i -= 1) {
        var item = xmindState.snapshots[i];
        if (!item || String(item.moduleId || '') !== String(moduleId || '')) continue;
        if (targetId && String(item.id || '') !== targetId) continue;
        return item;
      }
      return null;
    }

    function restoreSelectionSet(list) {
      var set = new Set();
      if (!Array.isArray(list)) return set;
      list.forEach(function(idx) {
        var num = Number(idx);
        if (Number.isFinite(num)) set.add(num);
      });
      return set;
    }

    function rollbackModuleCases(moduleId) {
      if (!moduleId) return false;
      var latest = getLatestCaseGenOperationSnapshot();
      if (!latest || latest.scope !== 'module' || String(latest.moduleId || '') !== String(moduleId || '')) {
        return false;
      }
      return rollbackCaseGenOperationSnapshot(String(latest.id || '')) === true;
    }

    function snapshotAllCaseGenState() {
      return createCaseGenOperationSnapshot('root', '');
    }

    function rollbackAllCaseGenState() {
      var latest = getLatestCaseGenOperationSnapshot();
      if (!latest) return false;
      return rollbackCaseGenOperationSnapshot(String(latest.id || '')) === true;
    }

    return {
      cloneJsonValue: cloneJsonValue,
      cloneSelectionSet: cloneSelectionSet,
      createEmptyLegacyCaseGenState: createEmptyLegacyCaseGenState,
      cloneCaseGenRunningState: cloneCaseGenRunningState,
      restoreCaseGenRunningSet: restoreCaseGenRunningSet,
      ensureLegacyCaseGenState: ensureLegacyCaseGenState,
      cloneCaseSelectionMap: cloneCaseSelectionMap,
      buildCurrentCaseGenSharedSnapshot: buildCurrentCaseGenSharedSnapshot,
      caseGenSnapshotHasOutputContent: caseGenSnapshotHasOutputContent,
      shouldRestoreLegacyCaseGenForRender: shouldRestoreLegacyCaseGenForRender,
      buildCurrentLegacyWorkflowInputSnapshot: buildCurrentLegacyWorkflowInputSnapshot,
      syncLegacyCaseGenState: syncLegacyCaseGenState,
      restoreLegacyCaseGenState: restoreLegacyCaseGenState,
      getLegacyCaseGenRenderState: getLegacyCaseGenRenderState,
      buildOperationSnapshotPayload: buildOperationSnapshotPayload,
      getLatestCaseGenOperationSnapshot: getLatestCaseGenOperationSnapshot,
      syncCaseGenOperationPointers: syncCaseGenOperationPointers,
      createCaseGenOperationSnapshot: createCaseGenOperationSnapshot,
      discardCaseGenOperationSnapshot: discardCaseGenOperationSnapshot,
      applyOperationSnapshot: applyOperationSnapshot,
      rollbackCaseGenOperationSnapshot: rollbackCaseGenOperationSnapshot,
      snapshotModuleCases: snapshotModuleCases,
      findModuleSnapshot: findModuleSnapshot,
      restoreSelectionSet: restoreSelectionSet,
      rollbackModuleCases: rollbackModuleCases,
      snapshotAllCaseGenState: snapshotAllCaseGenState,
      rollbackAllCaseGenState: rollbackAllCaseGenState,
    };
  }

  return { create: create };
});
