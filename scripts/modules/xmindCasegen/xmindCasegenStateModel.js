(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenStateModel = api;
  }
})(function() {
  function defaultCloneJson(value, fallback) {
    if (value === undefined || value === null) return fallback;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return fallback;
    }
  }

  function defaultNormalizeUniqueStringList(list) {
    var result = [];
    var seen = {};
    (Array.isArray(list) ? list : []).forEach(function(item) {
      var text = item === null || item === undefined ? '' : String(item || '').trim();
      if (!text || seen[text]) return;
      seen[text] = true;
      result.push(text);
    });
    return result;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var stepRequirement = Number(opts.stepRequirement || 1) || 1;
    var dedupeModeOnly = String(opts.dedupeModeOnly || 'dedupe_only');
    var sharedCaseGenSettingKeys = Array.isArray(opts.sharedCaseGenSettingKeys)
      ? opts.sharedCaseGenSettingKeys.slice()
      : [];
    var cloneJson = typeof opts.cloneJson === 'function' ? opts.cloneJson : defaultCloneJson;
    var normalizeUniqueStringList = typeof opts.normalizeUniqueStringList === 'function'
      ? opts.normalizeUniqueStringList
      : defaultNormalizeUniqueStringList;
    var normalizeDedupeMode = typeof opts.normalizeDedupeMode === 'function'
      ? opts.normalizeDedupeMode
      : function(value) { return String(value || '') || dedupeModeOnly; };
    var normalizeHistoryDedupeRecords = typeof opts.normalizeHistoryDedupeRecords === 'function'
      ? opts.normalizeHistoryDedupeRecords
      : function(list) { return cloneJson(Array.isArray(list) ? list : [], []); };
    var normalizeRootPipelineDedupeModules = typeof opts.normalizeRootPipelineDedupeModules === 'function'
      ? opts.normalizeRootPipelineDedupeModules
      : function(list) { return cloneJson(Array.isArray(list) ? list : [], []); };
    var normalizeModuleTitle = typeof opts.normalizeModuleTitle === 'function'
      ? opts.normalizeModuleTitle
      : function(value) { return String(value || '').trim(); };
    var normalizeHistoryDurationMs = typeof opts.normalizeHistoryDurationMs === 'function'
      ? opts.normalizeHistoryDurationMs
      : function(value) {
        var number = Number(value || 0);
        return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
      };
    var normalizeHistoryDiagnostics = typeof opts.normalizeHistoryDiagnostics === 'function'
      ? opts.normalizeHistoryDiagnostics
      : normalizeUniqueStringList;
    var normalizePersistedRequirementLabel = typeof opts.normalizePersistedRequirementLabel === 'function'
      ? opts.normalizePersistedRequirementLabel
      : function(value) { return String(value || '').trim(); };
    var createDefaultKnowledgeBaseState = typeof opts.createDefaultKnowledgeBaseState === 'function'
      ? opts.createDefaultKnowledgeBaseState
      : function() { return {}; };
    var normalizeKnowledgeBaseState = typeof opts.normalizeKnowledgeBaseState === 'function'
      ? opts.normalizeKnowledgeBaseState
      : function(value) { return cloneJson(value && typeof value === 'object' ? value : {}, {}); };
    var areRestoreContextsCompatible = typeof opts.areRestoreContextsCompatible === 'function'
      ? opts.areRestoreContextsCompatible
      : function() { return true; };
    var createRootPipelineId = typeof opts.createRootPipelineId === 'function'
      ? opts.createRootPipelineId
      : function() { return ''; };
    var now = typeof opts.now === 'function' ? opts.now : function() { return Date.now(); };

    function createDefaultPrepState() {
      return {
        step: stepRequirement,
        requirementMode: '',
        requirementSupplement: '',
        manualRequirementLabel: '',
        manualRequirementBlocks: [],
        caseImportMode: '',
        baseLocked: false,
        completed: false,
      };
    }

    function createDefaultRootState() {
      return {
        lastAction: '',
        running: false,
        taskId: '',
        hideAiLayer: false,
        snapshotId: '',
        status: '',
        error: '',
        updatedAt: 0,
        pipeline: null,
      };
    }

    function createDefaultDedupeState() {
      return {
        running: false,
        taskId: '',
        status: '',
        error: '',
        dedupeMode: dedupeModeOnly,
        batchCompleted: 0,
        batchTotal: 0,
        lastResult: null,
        updatedAt: 0,
      };
    }

    function createDefaultCoverageState() {
      return {
        running: false,
        taskId: '',
        status: '',
        error: '',
        result: null,
        signature: '',
        selectedSegmentId: '',
        updatedAt: 0,
      };
    }

    function normalizeCoverageState(value) {
      var source = value && typeof value === 'object' ? value : {};
      var next = createDefaultCoverageState();
      next.running = source.running === true;
      next.taskId = source.taskId ? String(source.taskId || '') : '';
      next.status = source.status ? String(source.status || '') : '';
      next.error = source.error ? String(source.error || '') : '';
      next.result = source.result && typeof source.result === 'object'
        ? cloneJson(source.result, null)
        : null;
      next.signature = source.signature ? String(source.signature || '') : '';
      if (!next.signature && next.result && next.result.signature) {
        next.signature = String(next.result.signature || '');
      }
      next.selectedSegmentId = source.selectedSegmentId ? String(source.selectedSegmentId || '') : '';
      if (!next.selectedSegmentId && next.result && next.result.selectedSegmentId) {
        next.selectedSegmentId = String(next.result.selectedSegmentId || '');
      }
      next.updatedAt = Number(source.updatedAt || 0) || 0;
      return next;
    }

    function createDefaultViewState() {
      return {
        drawerOpen: false,
        fullscreen: false,
        transform: '',
        scaleVal: 1,
        scrollLeft: 0,
        scrollTop: 0,
        hasManualViewport: false,
        anchorState: null,
        toolbarCollapsed: false,
        collapsedNodeKeys: [],
        treeSourceSignature: '',
        updatedAt: 0,
      };
    }

    function normalizeStoredViewState(source, optionsValue) {
      var input = source && typeof source === 'object' ? source : {};
      var viewOptions = optionsValue || {};
      var next = createDefaultViewState();
      next.drawerOpen = viewOptions.drawerOpen === true || input.drawerOpen === true;
      next.fullscreen = viewOptions.fullscreen === true || input.fullscreen === true;
      next.transform = String(input.transform || '');
      next.scaleVal = Number(input.scaleVal || 1);
      if (!isFinite(next.scaleVal) || next.scaleVal <= 0) next.scaleVal = 1;
      next.scrollLeft = Number(input.scrollLeft || 0);
      if (!isFinite(next.scrollLeft) || next.scrollLeft < 0) next.scrollLeft = 0;
      next.scrollTop = Number(input.scrollTop || 0);
      if (!isFinite(next.scrollTop) || next.scrollTop < 0) next.scrollTop = 0;
      next.hasManualViewport = input.hasManualViewport === true && Boolean(next.transform);
      next.anchorState = input.anchorState && input.anchorState.nodeId
        ? {
          nodeId: String(input.anchorState.nodeId || ''),
          centerX: Number(input.anchorState.centerX || 0),
          centerY: Number(input.anchorState.centerY || 0),
        }
        : null;
      next.toolbarCollapsed = input.toolbarCollapsed === true;
      next.collapsedNodeKeys = normalizeUniqueStringList(input.collapsedNodeKeys);
      next.treeSourceSignature = String(input.treeSourceSignature || '');
      next.updatedAt = Number(input.updatedAt || 0);
      if (!isFinite(next.updatedAt) || next.updatedAt < 0) next.updatedAt = 0;
      return next;
    }

    function shouldPreferIncomingViewState(baseViewState, incomingViewState) {
      var base = normalizeStoredViewState(baseViewState);
      var incoming = normalizeStoredViewState(incomingViewState);
      if (!incoming.transform && incoming.updatedAt <= 0) return false;
      if (!base.transform && incoming.transform) return true;
      if (base.hasManualViewport !== true && incoming.hasManualViewport === true) return true;
      if (incoming.updatedAt > base.updatedAt) return true;
      if (incoming.updatedAt === base.updatedAt && incoming.transform && incoming.transform !== base.transform) {
        return true;
      }
      return false;
    }

    function mergeStoredViewState(baseViewState, incomingViewState) {
      var base = normalizeStoredViewState(baseViewState);
      var incoming = normalizeStoredViewState(incomingViewState);
      var preferIncoming = shouldPreferIncomingViewState(base, incoming);
      var merged = preferIncoming
        ? cloneJson(incoming, createDefaultViewState())
        : cloneJson(base, createDefaultViewState());
      var baseUpdatedAt = Number(base.updatedAt || 0);
      var incomingUpdatedAt = Number(incoming.updatedAt || 0);
      if (incomingUpdatedAt > baseUpdatedAt) {
        merged.drawerOpen = incoming.drawerOpen === true;
        merged.fullscreen = incoming.fullscreen === true;
      } else if (baseUpdatedAt > incomingUpdatedAt) {
        merged.drawerOpen = base.drawerOpen === true;
        merged.fullscreen = base.fullscreen === true;
      } else {
        merged.drawerOpen = preferIncoming ? incoming.drawerOpen === true : base.drawerOpen === true;
        merged.fullscreen = preferIncoming ? incoming.fullscreen === true : base.fullscreen === true;
      }
      if (!merged.transform && incoming.transform) {
        merged = cloneJson(incoming, createDefaultViewState());
        if (incomingUpdatedAt > baseUpdatedAt) {
          merged.drawerOpen = incoming.drawerOpen === true;
          merged.fullscreen = incoming.fullscreen === true;
        } else if (baseUpdatedAt > incomingUpdatedAt) {
          merged.drawerOpen = base.drawerOpen === true;
          merged.fullscreen = base.fullscreen === true;
        } else {
          merged.drawerOpen = incoming.drawerOpen === true;
          merged.fullscreen = incoming.fullscreen === true;
        }
      }
      merged.updatedAt = Math.max(baseUpdatedAt, incomingUpdatedAt, Number(merged.updatedAt || 0) || 0);
      return normalizeStoredViewState(merged);
    }

    function shouldRestoreViewportForViewState(viewState) {
      var normalized = normalizeStoredViewState(viewState);
      return normalized.hasManualViewport === true && Boolean(normalized.transform);
    }

    function cloneSelectionMap(source) {
      var result = {};
      var map = source && typeof source === 'object' ? source : {};
      Object.keys(map).forEach(function(key) {
        var list = [];
        var current = map[key];
        if (current && typeof current.forEach === 'function') {
          current.forEach(function(value) {
            var num = Number(value);
            if (Number.isFinite(num)) list.push(num);
          });
        } else if (Array.isArray(current)) {
          current.forEach(function(value) {
            var num = Number(value);
            if (Number.isFinite(num)) list.push(num);
          });
        }
        result[key] = list;
      });
      return result;
    }

    function createEmptyRequirementMedia() {
      return {
        docxImages: [],
        pastedImages: [],
        lastDocxImageCount: 0,
        updatedAt: now(),
      };
    }

    function createDefaultCaseGenSettings() {
      return {
        activeTab: 'settings',
        customRequirement: '',
        dedupeSimplify: false,
        needFunctionCondition: true,
        needNumericValidation: true,
        needBoundary: false,
        needMobile: false,
        needSpecial: false,
        specialRepeatOperation: false,
        specialMultiTouch: false,
        specialRepeatExecution: false,
        specialWeakNetwork: false,
        specialInterruptResume: false,
      };
    }

    function createEmptyWorkspaceSharedState() {
      return {
        requirementLabel: '',
        requirementLabelSource: '',
        lastRawImportName: '',
        rawText: '',
        caseText: '',
        importedCases: [],
        caseGenModules: [],
        caseGenSource: '',
        caseGenResults: {},
        caseSelections: {},
        caseGenSuggestions: {},
        caseGenModuleStatus: {},
        caseGenProgress: {},
        caseGenTiming: {},
        caseGenProgressNotice: {},
        caseGenSettings: createDefaultCaseGenSettings(),
        requirementMedia: createEmptyRequirementMedia(),
      };
    }

    function cloneCaseGenSettingsValue(value) {
      var next = createDefaultCaseGenSettings();
      var source = value && typeof value === 'object' ? value : {};
      sharedCaseGenSettingKeys.forEach(function(key) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) return;
        next[key] = cloneJson(source[key], source[key]);
      });
      next.activeTab = next.activeTab === 'settings' ? 'settings' : 'settings';
      next.customRequirement = String(next.customRequirement || '');
      next.dedupeSimplify = next.dedupeSimplify === true;
      next.needFunctionCondition = next.needFunctionCondition !== false;
      next.needNumericValidation = next.needNumericValidation !== false;
      next.needBoundary = next.needBoundary === true;
      next.needMobile = next.needMobile === true;
      next.needSpecial = next.needSpecial === true;
      next.specialRepeatOperation = next.specialRepeatOperation === true;
      next.specialMultiTouch = next.specialMultiTouch === true;
      next.specialRepeatExecution = next.specialRepeatExecution === true;
      next.specialWeakNetwork = next.specialWeakNetwork === true;
      next.specialInterruptResume = next.specialInterruptResume === true;
      return next;
    }

    function cloneRequirementMediaValue(value) {
      var source = value && typeof value === 'object' ? value : {};
      var next = createEmptyRequirementMedia();
      function cloneMediaList(list) {
        var result = [];
        (Array.isArray(list) ? list : []).forEach(function(item) {
          if (!item || typeof item !== 'object') return;
          var cloned = {};
          Object.keys(item).forEach(function(key) {
            cloned[key] = item[key];
          });
          result.push(cloned);
        });
        return result;
      }
      next.docxImages = cloneMediaList(source.docxImages);
      next.pastedImages = cloneMediaList(source.pastedImages);
      next.lastDocxImageCount = Number(source.lastDocxImageCount || 0);
      if (!Number.isFinite(next.lastDocxImageCount) || next.lastDocxImageCount < 0) {
        next.lastDocxImageCount = 0;
      }
      next.updatedAt = Number(source.updatedAt || 0) || now();
      return next;
    }

    function normalizeWorkspaceSharedState(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      return {
        requirementLabel: normalizePersistedRequirementLabel(source.requirementLabel),
        requirementLabelSource: String(source.requirementLabelSource || ''),
        lastRawImportName: String(source.lastRawImportName || ''),
        rawText: String(source.rawText || ''),
        caseText: String(source.caseText || ''),
        importedCases: cloneJson(source.importedCases, []),
        caseGenModules: cloneJson(source.caseGenModules, []),
        caseGenSource: String(source.caseGenSource || ''),
        caseGenResults: cloneJson(source.caseGenResults, {}),
        caseSelections: cloneSelectionMap(source.caseSelections),
        caseGenSuggestions: cloneJson(source.caseGenSuggestions, {}),
        caseGenModuleStatus: cloneJson(source.caseGenModuleStatus, {}),
        caseGenProgress: cloneJson(source.caseGenProgress, {}),
        caseGenTiming: cloneJson(source.caseGenTiming, {}),
        caseGenProgressNotice: cloneJson(source.caseGenProgressNotice, {}),
        caseGenSettings: cloneCaseGenSettingsValue(source.caseGenSettings),
        requirementMedia: cloneRequirementMediaValue(source.requirementMedia),
      };
    }

    function createRootPipelineState(payload) {
      var input = payload && typeof payload === 'object' ? payload : {};
      return {
        id: input.id ? String(input.id || '') : createRootPipelineId(),
        actionId: input.actionId ? String(input.actionId || '') : '',
        snapshotId: input.snapshotId ? String(input.snapshotId || '') : '',
        historyActionLabel: input.historyActionLabel ? String(input.historyActionLabel || '') : '',
        stage: input.stage ? String(input.stage || '') : '',
        discoveryStatus: input.discoveryStatus ? String(input.discoveryStatus || '') : '',
        hadAiContentBeforeAction: input.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: input.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: input.hadAiCasesBeforeAction === true,
        restoredAfterRefresh: input.restoredAfterRefresh === true,
        cancelled: input.cancelled === true,
        cancelReason: input.cancelReason ? String(input.cancelReason || '') : '',
        errorCount: Number(input.errorCount || 0),
        createdModules: Number(input.createdModules || 0),
        addedCases: Number(input.addedCases || 0),
        moduleTaskTotal: Number(input.moduleTaskTotal || 0),
        moduleTaskCompleted: Number(input.moduleTaskCompleted || 0),
        moduleTaskCompletedKeys: normalizeUniqueStringList(input.moduleTaskCompletedKeys || []),
        dedupeStatus: input.dedupeStatus ? String(input.dedupeStatus || '') : '',
        dedupeTaskId: input.dedupeTaskId ? String(input.dedupeTaskId || '') : '',
        dedupeMode: input.dedupeMode ? normalizeDedupeMode(input.dedupeMode) : '',
        dedupeBeforeCount: Number(input.dedupeBeforeCount || 0),
        dedupeAfterCount: Number(input.dedupeAfterCount || 0),
        dedupeRemovedCount: Number(input.dedupeRemovedCount || 0),
        dedupeError: input.dedupeError ? String(input.dedupeError || '') : '',
        dedupeRecords: normalizeHistoryDedupeRecords(input.dedupeRecords || input.removedCases || []),
        generatedDedupeModules: normalizeRootPipelineDedupeModules(input.generatedDedupeModules || []),
        detailMap: cloneJson(input.detailMap, {}) || {},
        diagnostics: Array.isArray(input.diagnostics) ? input.diagnostics.slice() : [],
        pendingQueue: Array.isArray(input.pendingQueue) ? cloneJson(input.pendingQueue, []) || [] : [],
        updatedAt: now(),
      };
    }

    function cloneRootPipelineSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return null;
      var cloned = createRootPipelineState({
        id: snapshot.id,
        actionId: snapshot.actionId,
        snapshotId: snapshot.snapshotId,
        historyActionLabel: snapshot.historyActionLabel,
        stage: snapshot.stage,
        discoveryStatus: snapshot.discoveryStatus,
        hadAiContentBeforeAction: snapshot.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: snapshot.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: snapshot.hadAiCasesBeforeAction === true,
        restoredAfterRefresh: snapshot.restoredAfterRefresh === true,
        cancelled: snapshot.cancelled === true,
        cancelReason: snapshot.cancelReason,
        errorCount: snapshot.errorCount,
        createdModules: snapshot.createdModules,
        addedCases: snapshot.addedCases,
        moduleTaskTotal: snapshot.moduleTaskTotal,
        moduleTaskCompleted: snapshot.moduleTaskCompleted,
        moduleTaskCompletedKeys: snapshot.moduleTaskCompletedKeys,
        dedupeStatus: snapshot.dedupeStatus,
        dedupeTaskId: snapshot.dedupeTaskId,
        dedupeMode: snapshot.dedupeMode,
        dedupeBeforeCount: snapshot.dedupeBeforeCount,
        dedupeAfterCount: snapshot.dedupeAfterCount,
        dedupeRemovedCount: snapshot.dedupeRemovedCount,
        dedupeError: snapshot.dedupeError,
        dedupeRecords: snapshot.dedupeRecords,
        generatedDedupeModules: snapshot.generatedDedupeModules,
        detailMap: snapshot.detailMap,
        diagnostics: snapshot.diagnostics,
        pendingQueue: snapshot.pendingQueue,
      });
      cloned.updatedAt = Number(snapshot.updatedAt || 0);
      if (!Number.isFinite(cloned.updatedAt) || cloned.updatedAt < 0) cloned.updatedAt = 0;
      return cloned;
    }

    function buildCompactRootPipelineRestoreSnapshot(snapshot) {
      var cloned = cloneRootPipelineSnapshot(snapshot);
      if (!cloned) return null;
      return {
        id: String(cloned.id || ''),
        actionId: String(cloned.actionId || ''),
        snapshotId: String(cloned.snapshotId || ''),
        historyActionLabel: String(cloned.historyActionLabel || ''),
        stage: String(cloned.stage || ''),
        discoveryStatus: String(cloned.discoveryStatus || ''),
        hadAiContentBeforeAction: cloned.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: cloned.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: cloned.hadAiCasesBeforeAction === true,
        restoredAfterRefresh: cloned.restoredAfterRefresh === true,
        cancelled: cloned.cancelled === true,
        cancelReason: String(cloned.cancelReason || ''),
        errorCount: Number(cloned.errorCount || 0) || 0,
        createdModules: Number(cloned.createdModules || 0) || 0,
        addedCases: Number(cloned.addedCases || 0) || 0,
        moduleTaskTotal: Number(cloned.moduleTaskTotal || 0) || 0,
        moduleTaskCompleted: Number(cloned.moduleTaskCompleted || 0) || 0,
        moduleTaskCompletedKeys: normalizeUniqueStringList(cloned.moduleTaskCompletedKeys || []),
        dedupeStatus: String(cloned.dedupeStatus || ''),
        dedupeTaskId: String(cloned.dedupeTaskId || ''),
        dedupeMode: cloned.dedupeMode ? normalizeDedupeMode(cloned.dedupeMode) : '',
        dedupeBeforeCount: Number(cloned.dedupeBeforeCount || 0) || 0,
        dedupeAfterCount: Number(cloned.dedupeAfterCount || 0) || 0,
        dedupeRemovedCount: Number(cloned.dedupeRemovedCount || 0) || 0,
        dedupeError: String(cloned.dedupeError || ''),
        dedupeRecords: normalizeHistoryDedupeRecords(cloned.dedupeRecords || []),
        generatedDedupeModules: normalizeRootPipelineDedupeModules(cloned.generatedDedupeModules || []),
        detailMap: cloneJson(cloned.detailMap, {}) || {},
        diagnostics: Array.isArray(cloned.diagnostics) ? cloned.diagnostics.slice() : [],
        pendingQueue: Array.isArray(cloned.pendingQueue) ? cloneJson(cloned.pendingQueue, []) || [] : [],
        updatedAt: Number(cloned.updatedAt || 0) || 0,
      };
    }

    function getRootPipelineSnapshotWeight(pipeline) {
      var detailMap = pipeline && pipeline.detailMap && typeof pipeline.detailMap === 'object'
        ? pipeline.detailMap
        : {};
      var detailCount = Object.keys(detailMap).length;
      var diagnosticsCount = Array.isArray(pipeline && pipeline.diagnostics) ? pipeline.diagnostics.length : 0;
      var dedupeRecordCount = Array.isArray(pipeline && pipeline.dedupeRecords) ? pipeline.dedupeRecords.length : 0;
      var generatedDedupeCount = Array.isArray(pipeline && pipeline.generatedDedupeModules) ? pipeline.generatedDedupeModules.length : 0;
      var pendingCount = Array.isArray(pipeline && pipeline.pendingQueue) ? pipeline.pendingQueue.length : 0;
      return (
        Number(pipeline && pipeline.createdModules || 0) * 1000
        + Number(pipeline && pipeline.addedCases || 0) * 10
        + Number(pipeline && pipeline.moduleTaskTotal || 0) * 5
        + Number(pipeline && pipeline.moduleTaskCompleted || 0) * 20
        + detailCount * 100
        + diagnosticsCount * 10
        + dedupeRecordCount * 10
        + generatedDedupeCount * 100
        + pendingCount
      );
    }

    function mergeRootPipelineSnapshot(baseSnapshot, incomingSnapshot) {
      var base = cloneRootPipelineSnapshot(baseSnapshot);
      var incoming = cloneRootPipelineSnapshot(incomingSnapshot);
      if (!base) return incoming;
      if (!incoming) return base;
      var baseId = String(base.id || '');
      var incomingId = String(incoming.id || '');
      if (baseId && incomingId && baseId !== incomingId) {
        return getRootPipelineSnapshotWeight(incoming) >= getRootPipelineSnapshotWeight(base)
          ? incoming
          : base;
      }

      function pickString(existingValue, nextValue) {
        var nextText = nextValue === null || nextValue === undefined ? '' : String(nextValue || '').trim();
        return nextText ? nextValue : existingValue;
      }

      base.id = pickString(base.id, incoming.id);
      base.actionId = pickString(base.actionId, incoming.actionId);
      base.snapshotId = pickString(base.snapshotId, incoming.snapshotId);
      base.historyActionLabel = pickString(base.historyActionLabel, incoming.historyActionLabel);
      base.stage = pickString(base.stage, incoming.stage);
      base.discoveryStatus = pickString(base.discoveryStatus, incoming.discoveryStatus);
      base.cancelReason = pickString(base.cancelReason, incoming.cancelReason);
      base.dedupeStatus = pickString(base.dedupeStatus, incoming.dedupeStatus);
      base.dedupeTaskId = pickString(base.dedupeTaskId, incoming.dedupeTaskId);
      if (incoming.dedupeMode && (incoming.dedupeStatus || incoming.dedupeTaskId || !base.dedupeMode)) {
        base.dedupeMode = normalizeDedupeMode(incoming.dedupeMode);
      } else if (base.dedupeMode) {
        base.dedupeMode = normalizeDedupeMode(base.dedupeMode);
      } else {
        base.dedupeMode = '';
      }
      base.dedupeError = pickString(base.dedupeError, incoming.dedupeError);
      base.hadAiContentBeforeAction = base.hadAiContentBeforeAction === true || incoming.hadAiContentBeforeAction === true;
      base.hadAiLayerBeforeAction = base.hadAiLayerBeforeAction === true || incoming.hadAiLayerBeforeAction === true;
      base.hadAiCasesBeforeAction = base.hadAiCasesBeforeAction === true || incoming.hadAiCasesBeforeAction === true;
      base.restoredAfterRefresh = base.restoredAfterRefresh === true || incoming.restoredAfterRefresh === true;
      base.cancelled = base.cancelled === true || incoming.cancelled === true;
      base.errorCount = Math.max(Number(base.errorCount || 0), Number(incoming.errorCount || 0));
      base.createdModules = Math.max(Number(base.createdModules || 0), Number(incoming.createdModules || 0));
      base.addedCases = Math.max(Number(base.addedCases || 0), Number(incoming.addedCases || 0));
      base.moduleTaskTotal = Math.max(Number(base.moduleTaskTotal || 0), Number(incoming.moduleTaskTotal || 0));
      base.moduleTaskCompleted = Math.max(Number(base.moduleTaskCompleted || 0), Number(incoming.moduleTaskCompleted || 0));
      base.moduleTaskCompletedKeys = normalizeUniqueStringList((base.moduleTaskCompletedKeys || []).concat(incoming.moduleTaskCompletedKeys || []));
      if (base.moduleTaskCompletedKeys.length > base.moduleTaskCompleted) {
        base.moduleTaskCompleted = base.moduleTaskCompletedKeys.length;
      }
      base.dedupeBeforeCount = Math.max(Number(base.dedupeBeforeCount || 0), Number(incoming.dedupeBeforeCount || 0));
      base.dedupeAfterCount = Math.max(Number(base.dedupeAfterCount || 0), Number(incoming.dedupeAfterCount || 0));
      base.dedupeRemovedCount = Math.max(Number(base.dedupeRemovedCount || 0), Number(incoming.dedupeRemovedCount || 0));
      base.updatedAt = Math.max(Number(base.updatedAt || 0), Number(incoming.updatedAt || 0));

      var mergedDetailMap = {};
      [base.detailMap, incoming.detailMap].forEach(function(map) {
        var source = map && typeof map === 'object' ? map : {};
        Object.keys(source).forEach(function(key) {
          var item = source[key];
          if (!item) return;
          var caseCount = Number(item.caseCount || 0);
          if (!Number.isFinite(caseCount) || caseCount < 0) caseCount = 0;
          if (!mergedDetailMap[key] || caseCount >= Number(mergedDetailMap[key].caseCount || 0)) {
            mergedDetailMap[key] = {
              module: normalizeModuleTitle(item.module || ''),
              caseCount: caseCount,
              durationMs: normalizeHistoryDurationMs(item.durationMs),
            };
          }
        });
      });
      base.detailMap = mergedDetailMap;
      base.diagnostics = normalizeHistoryDiagnostics((base.diagnostics || []).concat(incoming.diagnostics || []));
      base.dedupeRecords = normalizeHistoryDedupeRecords((base.dedupeRecords || []).concat(incoming.dedupeRecords || []));
      base.generatedDedupeModules = normalizeRootPipelineDedupeModules((base.generatedDedupeModules || []).concat(incoming.generatedDedupeModules || []));
      if (Array.isArray(incoming.pendingQueue) && incoming.pendingQueue.length >= (Array.isArray(base.pendingQueue) ? base.pendingQueue.length : 0)) {
        base.pendingQueue = cloneJson(incoming.pendingQueue, []) || [];
      }
      return base;
    }

    function createInitialXmindState(optionsValue) {
      var stateOptions = optionsValue || {};
      var nextViewState = createDefaultViewState();
      nextViewState.drawerOpen = stateOptions.drawerOpen === true;
      nextViewState.fullscreen = stateOptions.fullscreen === true;
      nextViewState.updatedAt = now();
      return {
        mode: 'modules',
        treeSourceSignature: '',
        hasModuleSkeleton: false,
        hasImportedBaseline: false,
        summaryResultKind: '',
        inlineStatusText: '',
        inlineStatusType: '',
        openButtonDotVisible: false,
        historyUnread: false,
        knowledgeBase: createDefaultKnowledgeBaseState(),
        dedupe: createDefaultDedupeState(),
        coverage: createDefaultCoverageState(),
        viewState: nextViewState,
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

    function createWorkspaceSnapshot(optionsValue) {
      var snapshotOptions = optionsValue || {};
      return {
        xmind: createInitialXmindState({
          drawerOpen: snapshotOptions.drawerOpen === true,
          fullscreen: snapshotOptions.fullscreen === true,
        }),
        shared: createEmptyWorkspaceSharedState(),
      };
    }

    function normalizeWorkspaceSnapshot(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindSnapshot = source.xmind && typeof source.xmind === 'object'
        ? cloneJson(source.xmind, createInitialXmindState())
        : createInitialXmindState();
      xmindSnapshot.knowledgeBase = normalizeKnowledgeBaseState(xmindSnapshot.knowledgeBase);
      if (!xmindSnapshot.dedupe || typeof xmindSnapshot.dedupe !== 'object') {
        xmindSnapshot.dedupe = createDefaultDedupeState();
      }
      xmindSnapshot.coverage = normalizeCoverageState(xmindSnapshot.coverage);
      if (!xmindSnapshot.viewState || typeof xmindSnapshot.viewState !== 'object') {
        xmindSnapshot.viewState = createDefaultViewState();
      }
      xmindSnapshot.viewState = normalizeStoredViewState(xmindSnapshot.viewState, {
        drawerOpen: xmindSnapshot.viewState.drawerOpen === true,
        fullscreen: xmindSnapshot.viewState.fullscreen === true,
      });
      return {
        xmind: xmindSnapshot,
        shared: normalizeWorkspaceSharedState(source.shared),
      };
    }

    function workspaceSnapshotHasContent(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindPart = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var sharedPart = source.shared && typeof source.shared === 'object' ? source.shared : {};
      if (Array.isArray(sharedPart.caseGenModules) && sharedPart.caseGenModules.length) return true;
      if (sharedPart.caseGenResults && Object.keys(sharedPart.caseGenResults).length) return true;
      if (Array.isArray(sharedPart.importedCases) && sharedPart.importedCases.length) return true;
      if (String(sharedPart.rawText || '').trim()) return true;
      if (String(sharedPart.caseText || '').trim()) return true;
      if (String(sharedPart.requirementLabel || '').trim()) return true;
      if (xmindPart.prep && xmindPart.prep.completed === true) return true;
      if (Array.isArray(xmindPart.history) && xmindPart.history.length) return true;
      return false;
    }

    function workspaceSnapshotHasGeneratedContent(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindPart = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var sharedPart = source.shared && typeof source.shared === 'object' ? source.shared : {};
      if (Array.isArray(sharedPart.caseGenModules) && sharedPart.caseGenModules.length) return true;
      if (sharedPart.caseGenResults && Object.keys(sharedPart.caseGenResults).length) return true;
      if (Array.isArray(xmindPart.history) && xmindPart.history.length) return true;
      return false;
    }

    function caseGenSettingsDifferFromDefault(settings) {
      var next = cloneCaseGenSettingsValue(settings);
      var defaults = createDefaultCaseGenSettings();
      return sharedCaseGenSettingKeys.some(function(key) {
        return JSON.stringify(next[key]) !== JSON.stringify(defaults[key]);
      });
    }

    function workspaceSnapshotHasPrepDraft(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var xmindPart = source.xmind && typeof source.xmind === 'object' ? source.xmind : {};
      var sharedPart = source.shared && typeof source.shared === 'object' ? source.shared : {};
      var prep = xmindPart.prep && typeof xmindPart.prep === 'object' ? xmindPart.prep : {};
      if (String(prep.requirementMode || '').trim()) return true;
      if (String(prep.requirementSupplement || '').trim()) return true;
      if (String(prep.manualRequirementLabel || '').trim()) return true;
      if (Array.isArray(prep.manualRequirementBlocks) && prep.manualRequirementBlocks.length) return true;
      if (String(prep.caseImportMode || '').trim()) return true;
      if (prep.completed === true || prep.baseLocked === true) return true;
      if (caseGenSettingsDifferFromDefault(sharedPart.caseGenSettings)) return true;
      return false;
    }

    function isMeaningfulRestoreResult(raw) {
      var text = raw === null || raw === undefined ? '' : String(raw || '').trim();
      return Boolean(text && !/^\[\s*\]$/.test(text));
    }

    function mergeRestoreResultMap(existingResults, nextResults) {
      var mergedResults = {};
      var currentResults = existingResults && typeof existingResults === 'object' ? existingResults : {};
      var incomingResults = nextResults && typeof nextResults === 'object' ? nextResults : {};
      Object.keys(currentResults).forEach(function(key) {
        mergedResults[key] = currentResults[key];
      });
      Object.keys(incomingResults).forEach(function(key) {
        if (isMeaningfulRestoreResult(incomingResults[key]) || !isMeaningfulRestoreResult(mergedResults[key])) {
          mergedResults[key] = incomingResults[key];
        }
      });
      return mergedResults;
    }

    function normalizeRestoreOperationSnapshots(list) {
      return (Array.isArray(list) ? list : []).map(function(item) {
        if (!item || typeof item !== 'object') return null;
        return {
          id: String(item.id || ''),
          scope: item.scope === 'module' ? 'module' : 'root',
          moduleId: item.moduleId ? String(item.moduleId || '') : '',
          caseGenModules: cloneJson(item.caseGenModules, []),
          caseGenResults: cloneJson(item.caseGenResults, {}),
          caseSelections: cloneJson(item.caseSelections, {}),
          caseGenSuggestions: cloneJson(item.caseGenSuggestions, {}),
          caseGenModuleStatus: cloneJson(item.caseGenModuleStatus, {}),
          caseGenProgress: cloneJson(item.caseGenProgress, {}),
          caseGenTiming: cloneJson(item.caseGenTiming, {}),
          caseGenSource: String(item.caseGenSource || ''),
          createdAt: Number(item.createdAt || 0),
        };
      }).filter(function(item) {
        return Boolean(item && item.id);
      });
    }

    function deriveNextOperationSnapshotId(list, fallback) {
      var nextId = Number(fallback || 0);
      if (!Number.isFinite(nextId) || nextId < 0) nextId = 0;
      (Array.isArray(list) ? list : []).forEach(function(item) {
        if (!item || !item.id) return;
        var match = String(item.id || '').match(/op-snap-(\d+)$/);
        if (!match) return;
        var value = Number(match[1]);
        if (!Number.isFinite(value) || value < 0) return;
        if ((value + 1) > nextId) nextId = value + 1;
      });
      return nextId > 0 ? nextId : 1;
    }

    function buildOperationSnapshotRestoreVersion(list, nextSnapshotId) {
      var normalizedList = normalizeRestoreOperationSnapshots(list);
      var latestCreatedAt = 0;
      normalizedList.forEach(function(item) {
        var createdAt = Number(item && item.createdAt || 0);
        if (!Number.isFinite(createdAt) || createdAt < 0) return;
        if (createdAt > latestCreatedAt) latestCreatedAt = createdAt;
      });
      return {
        list: normalizedList,
        length: normalizedList.length,
        latestCreatedAt: latestCreatedAt,
        nextSnapshotId: deriveNextOperationSnapshotId(normalizedList, nextSnapshotId),
      };
    }

    function shouldPreferRestoreOperationSnapshots(baseVersion, incomingVersion) {
      var base = baseVersion || buildOperationSnapshotRestoreVersion([], 1);
      var incoming = incomingVersion || buildOperationSnapshotRestoreVersion([], 1);
      if (!incoming.length) return false;
      if (!base.length) return true;
      if (incoming.nextSnapshotId > base.nextSnapshotId) return true;
      if (incoming.length > base.length) return true;
      if (incoming.latestCreatedAt > base.latestCreatedAt) return true;
      return false;
    }

    function mergeTaskRestoreContext(baseContext, incomingContext) {
      if (
        baseContext
        && incomingContext
        && areRestoreContextsCompatible(baseContext, incomingContext) !== true
      ) {
        return cloneJson(baseContext, {});
      }
      var base = baseContext && typeof baseContext === 'object' ? cloneJson(baseContext, {}) : {};
      var incoming = incomingContext && typeof incomingContext === 'object' ? cloneJson(incomingContext, {}) : {};

      function pickString(existingValue, nextValue) {
        var nextText = nextValue === null || nextValue === undefined ? '' : String(nextValue || '').trim();
        return nextText ? nextValue : existingValue;
      }

      base.workspaceId = pickString(base.workspaceId, incoming.workspaceId);
      base.workspaceGenerationId = pickString(base.workspaceGenerationId, incoming.workspaceGenerationId);
      base.workspaceCreatedAt = Number(base.workspaceCreatedAt || incoming.workspaceCreatedAt || 0) || 0;
      base.requirementFingerprint = pickString(base.requirementFingerprint, incoming.requirementFingerprint);
      base.requirementLabel = normalizePersistedRequirementLabel(pickString(base.requirementLabel, incoming.requirementLabel));
      base.requirementLabelSource = pickString(base.requirementLabelSource, incoming.requirementLabelSource);
      base.lastRawImportName = pickString(base.lastRawImportName, incoming.lastRawImportName);
      base.rawText = pickString(base.rawText, incoming.rawText);
      base.caseText = pickString(base.caseText, incoming.caseText);

      if (Array.isArray(incoming.importedCases) && incoming.importedCases.length) {
        base.importedCases = cloneJson(incoming.importedCases, []);
      }
      var baseModules = Array.isArray(base.caseGenModules) ? base.caseGenModules : [];
      var incomingModules = Array.isArray(incoming.caseGenModules) ? incoming.caseGenModules : [];
      if (incomingModules.length >= baseModules.length) {
        base.caseGenModules = cloneJson(incomingModules, []);
      }

      base.caseGenResults = mergeRestoreResultMap(base.caseGenResults, incoming.caseGenResults);
      var baseOperationVersion = buildOperationSnapshotRestoreVersion(base.operationSnapshots, base.nextSnapshotId);
      var incomingOperationVersion = buildOperationSnapshotRestoreVersion(incoming.operationSnapshots, incoming.nextSnapshotId);
      if (shouldPreferRestoreOperationSnapshots(baseOperationVersion, incomingOperationVersion)) {
        base.operationSnapshots = cloneJson(incomingOperationVersion.list, []);
        base.nextSnapshotId = incomingOperationVersion.nextSnapshotId;
      } else {
        base.operationSnapshots = cloneJson(baseOperationVersion.list, []);
        base.nextSnapshotId = Math.max(baseOperationVersion.nextSnapshotId, incomingOperationVersion.nextSnapshotId);
      }

      var baseHistory = Array.isArray(base.history) ? base.history : [];
      var incomingHistory = Array.isArray(incoming.history) ? incoming.history : [];
      if (incomingHistory.length >= baseHistory.length) base.history = cloneJson(incomingHistory, []);
      base.rootPipeline = mergeRootPipelineSnapshot(base.rootPipeline, incoming.rootPipeline);

      var basePrep = base.prep && typeof base.prep === 'object' ? base.prep : createDefaultPrepState();
      var incomingPrep = incoming.prep && typeof incoming.prep === 'object' ? incoming.prep : {};
      basePrep.step = Math.max(Number(basePrep.step || stepRequirement), Number(incomingPrep.step || stepRequirement));
      if (incomingPrep.requirementMode) basePrep.requirementMode = String(incomingPrep.requirementMode || '');
      if (incomingPrep.requirementSupplement) basePrep.requirementSupplement = String(incomingPrep.requirementSupplement || '');
      if (incomingPrep.manualRequirementLabel) basePrep.manualRequirementLabel = String(incomingPrep.manualRequirementLabel || '');
      if (Array.isArray(incomingPrep.manualRequirementBlocks) && incomingPrep.manualRequirementBlocks.length) {
        basePrep.manualRequirementBlocks = cloneJson(incomingPrep.manualRequirementBlocks, []);
      }
      if (incomingPrep.caseImportMode) basePrep.caseImportMode = String(incomingPrep.caseImportMode || '');
      basePrep.baseLocked = basePrep.baseLocked === true || incomingPrep.baseLocked === true;
      basePrep.completed = basePrep.completed === true || incomingPrep.completed === true;
      base.prep = basePrep;
      base.viewState = mergeStoredViewState(base.viewState, incoming.viewState);
      return base;
    }

    return {
      buildCompactRootPipelineRestoreSnapshot: buildCompactRootPipelineRestoreSnapshot,
      buildOperationSnapshotRestoreVersion: buildOperationSnapshotRestoreVersion,
      caseGenSettingsDifferFromDefault: caseGenSettingsDifferFromDefault,
      cloneCaseGenSettingsValue: cloneCaseGenSettingsValue,
      cloneRequirementMediaValue: cloneRequirementMediaValue,
      cloneRootPipelineSnapshot: cloneRootPipelineSnapshot,
      cloneSelectionMap: cloneSelectionMap,
      createDefaultCaseGenSettings: createDefaultCaseGenSettings,
      createDefaultCoverageState: createDefaultCoverageState,
      createDefaultDedupeState: createDefaultDedupeState,
      createDefaultPrepState: createDefaultPrepState,
      createDefaultRootState: createDefaultRootState,
      createDefaultViewState: createDefaultViewState,
      createEmptyRequirementMedia: createEmptyRequirementMedia,
      createEmptyWorkspaceSharedState: createEmptyWorkspaceSharedState,
      createInitialXmindState: createInitialXmindState,
      createRootPipelineState: createRootPipelineState,
      createWorkspaceSnapshot: createWorkspaceSnapshot,
      deriveNextOperationSnapshotId: deriveNextOperationSnapshotId,
      getRootPipelineSnapshotWeight: getRootPipelineSnapshotWeight,
      isMeaningfulRestoreResult: isMeaningfulRestoreResult,
      mergeRestoreResultMap: mergeRestoreResultMap,
      mergeRootPipelineSnapshot: mergeRootPipelineSnapshot,
      mergeStoredViewState: mergeStoredViewState,
      mergeTaskRestoreContext: mergeTaskRestoreContext,
      normalizeCoverageState: normalizeCoverageState,
      normalizeRestoreOperationSnapshots: normalizeRestoreOperationSnapshots,
      normalizeStoredViewState: normalizeStoredViewState,
      normalizeWorkspaceSharedState: normalizeWorkspaceSharedState,
      normalizeWorkspaceSnapshot: normalizeWorkspaceSnapshot,
      shouldPreferIncomingViewState: shouldPreferIncomingViewState,
      shouldPreferRestoreOperationSnapshots: shouldPreferRestoreOperationSnapshots,
      shouldRestoreViewportForViewState: shouldRestoreViewportForViewState,
      workspaceSnapshotHasContent: workspaceSnapshotHasContent,
      workspaceSnapshotHasGeneratedContent: workspaceSnapshotHasGeneratedContent,
      workspaceSnapshotHasPrepDraft: workspaceSnapshotHasPrepDraft,
    };
  }

  return { create: create };
});
