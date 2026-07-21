(function(factory) {
  var root = typeof window !== 'undefined' ? window : null;
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenWorkspaceStateController = api;
  }
})(function() {
  var WORKSPACE_HOST_KEYS = {
    activeWorkspaceId: 1, mirrorWorkspaceId: 1, workspaceOrder: 1,
    workspaces: 1, nextWorkspaceSeq: 1, openButtonDotVisible: 1,
  };

  function create(options) {
    var opts = options || {};
    var state = opts.state;
    var stateModel = opts.stateModel;
    if (!stateModel) throw new Error('xmindCasegenStateModel is required');
    var cloneJson = opts.cloneJson;
    var now = typeof opts.now === 'function' ? opts.now : function() { return Date.now(); };
    var random = typeof opts.random === 'function' ? opts.random : function() { return Math.random(); };
    var snapshotPort = opts.snapshotPort;
    var persistencePort = opts.persistencePort;
    var environmentPort = opts.environmentPort;
    var getTaskManager = opts.getTaskManager;
    var getRecoveryCore = opts.getRecoveryCore;
    var deriveLiveWorkspaceName = opts.deriveLiveWorkspaceName;
    var normalizeRequirementLabelFromFileName = opts.normalizeRequirementLabelFromFileName;

    function buildWorkspaceId(seq) {
      var recoveryCore = getRecoveryCore();
      if (recoveryCore && typeof recoveryCore.createWorkspaceId === 'function') {
        return recoveryCore.createWorkspaceId(seq, now(), random());
      }
      return 'xmind-workspace-' + String(seq || 1) + '-' + now().toString(36) + '-' + random().toString(36).slice(2, 10);
    }

    function buildWorkspaceGenerationId() {
      var recoveryCore = getRecoveryCore();
      if (recoveryCore && typeof recoveryCore.createWorkspaceGenerationId === 'function') {
        return recoveryCore.createWorkspaceGenerationId(now(), random());
      }
      return 'xmind-generation-' + now().toString(36) + '-' + random().toString(36).slice(2, 10);
    }

    function createWorkspaceRecord(id, options) {
      var recordOptions = options || {};
      var currentTime = now();
      var createdAt = Number(recordOptions.createdAt || currentTime);
      if (!Number.isFinite(createdAt) || createdAt <= 0) createdAt = currentTime;
      return {
        id: String(id || ''),
        seq: Number(recordOptions.seq || 0) || 0,
        name: String(recordOptions.name || ''),
        generationId: String(recordOptions.generationId || '') || buildWorkspaceGenerationId(),
        pendingOpenPrep: recordOptions.pendingOpenPrep === true,
        updatedAt: currentTime,
        createdAt: createdAt,
        snapshot: stateModel.normalizeWorkspaceSnapshot(recordOptions.snapshot),
      };
    }

    function normalizeWorkspaceRecord(id, record) {
      var source = record && typeof record === 'object' ? record : {};
      var normalized = createWorkspaceRecord(id, {
        seq: source.seq,
        name: source.name,
        generationId: source.generationId,
        createdAt: source.createdAt,
        pendingOpenPrep: source.pendingOpenPrep === true,
        snapshot: source.snapshot,
      });
      normalized.updatedAt = Number(source.updatedAt || normalized.updatedAt);
      if (!Number.isFinite(normalized.updatedAt) || normalized.updatedAt <= 0) normalized.updatedAt = now();
      normalized.createdAt = Number(source.createdAt || normalized.updatedAt);
      if (!Number.isFinite(normalized.createdAt) || normalized.createdAt <= 0) {
        normalized.createdAt = normalized.updatedAt;
      }
      return normalized;
    }

    function getWorkspaceHostState() {
      var host = state.xmindCaseGen && typeof state.xmindCaseGen === 'object' ? state.xmindCaseGen : {};
      if (!Array.isArray(host.workspaceOrder)) host.workspaceOrder = [];
      if (!host.workspaces || typeof host.workspaces !== 'object') host.workspaces = {};
      host.activeWorkspaceId = String(host.activeWorkspaceId || '');
      host.mirrorWorkspaceId = String(host.mirrorWorkspaceId || '');
      host.openButtonDotVisible = host.openButtonDotVisible === true;
      host.nextWorkspaceSeq = Number(host.nextWorkspaceSeq || 1);
      if (!Number.isFinite(host.nextWorkspaceSeq) || host.nextWorkspaceSeq < 1) host.nextWorkspaceSeq = 1;
      state.xmindCaseGen = host;
      return host;
    }

    function ensureWorkspaceHostState() {
      var host = getWorkspaceHostState();
      var order = Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
      var nextWorkspaces = {};
      order.forEach(function(id) {
        var stableId = String(id || '').trim();
        if (!stableId || nextWorkspaces[stableId]) return;
        nextWorkspaces[stableId] = normalizeWorkspaceRecord(stableId, host.workspaces[stableId]);
      });
      Object.keys(host.workspaces || {}).forEach(function(id) {
        var stableId = String(id || '').trim();
        if (!stableId || nextWorkspaces[stableId]) return;
        nextWorkspaces[stableId] = normalizeWorkspaceRecord(stableId, host.workspaces[stableId]);
        order.push(stableId);
      });
      host.workspaceOrder = order.filter(function(id, index) {
        return id && order.indexOf(id) === index;
      });
      host.workspaces = nextWorkspaces;
      if (!host.activeWorkspaceId && host.workspaceOrder.length) {
        host.activeWorkspaceId = String(host.workspaceOrder[0] || '');
      }
      if (host.activeWorkspaceId && host.workspaceOrder.indexOf(host.activeWorkspaceId) === -1) {
        host.activeWorkspaceId = host.workspaceOrder[0] ? String(host.workspaceOrder[0] || '') : '';
      }
      if (!host.mirrorWorkspaceId && host.activeWorkspaceId) {
        host.mirrorWorkspaceId = String(host.activeWorkspaceId || '');
      }
      if (host.mirrorWorkspaceId && host.workspaceOrder.indexOf(host.mirrorWorkspaceId) === -1) {
        host.mirrorWorkspaceId = host.activeWorkspaceId
          ? String(host.activeWorkspaceId || '')
          : (host.workspaceOrder[0] ? String(host.workspaceOrder[0] || '') : '');
      }
      return host;
    }

    function getActiveWorkspaceId() {
      return String(ensureWorkspaceHostState().activeWorkspaceId || '');
    }

    function getMirrorWorkspaceId() {
      var host = ensureWorkspaceHostState();
      if (host.mirrorWorkspaceId && host.workspaces[host.mirrorWorkspaceId]) {
        return String(host.mirrorWorkspaceId || '');
      }
      if (host.activeWorkspaceId && host.workspaces[host.activeWorkspaceId]) {
        return String(host.activeWorkspaceId || '');
      }
      return host.workspaceOrder.length ? String(host.workspaceOrder[0] || '') : '';
    }

    function getWorkspaceUiSelectedId() {
      return environmentPort.isDrawerOpen() ? getActiveWorkspaceId() : getMirrorWorkspaceId();
    }

    function setMirrorWorkspaceSelection(workspaceId) {
      var host = ensureWorkspaceHostState();
      var stableId = String(workspaceId || '');
      if (!stableId || !host.workspaces[stableId]) {
        stableId = host.activeWorkspaceId
          ? String(host.activeWorkspaceId || '')
          : (host.workspaceOrder[0] ? String(host.workspaceOrder[0] || '') : '');
      }
      host.mirrorWorkspaceId = stableId;
      return stableId;
    }

    function getWorkspaceRecord(workspaceId) {
      var host = ensureWorkspaceHostState();
      var stableId = workspaceId ? String(workspaceId || '') : String(host.activeWorkspaceId || '');
      if (!stableId) return null;
      return host.workspaces && host.workspaces[stableId] ? host.workspaces[stableId] : null;
    }

    function extractActiveXmindStateSnapshot() {
      var source = state.xmindCaseGen && typeof state.xmindCaseGen === 'object' ? state.xmindCaseGen : {};
      var next = stateModel.createInitialXmindState({
        drawerOpen: source.viewState && source.viewState.drawerOpen === true,
        fullscreen: source.viewState && source.viewState.fullscreen === true,
      });
      Object.keys(source).forEach(function(key) {
        if (WORKSPACE_HOST_KEYS[key]) return;
        next[key] = cloneJson(source[key], source[key]);
      });
      return next;
    }

    function applyActiveXmindStateSnapshot(snapshot) {
      var source = snapshot && typeof snapshot === 'object' ? snapshot : {};
      var next = stateModel.createInitialXmindState({
        drawerOpen: source.viewState && source.viewState.drawerOpen === true,
        fullscreen: source.viewState && source.viewState.fullscreen === true,
      });
      Object.keys(source).forEach(function(key) {
        if (WORKSPACE_HOST_KEYS[key]) return;
        next[key] = cloneJson(source[key], source[key]);
      });
      var host = state.xmindCaseGen && typeof state.xmindCaseGen === 'object' ? state.xmindCaseGen : {};
      Object.keys(host).forEach(function(key) {
        if (!WORKSPACE_HOST_KEYS[key]) return;
        next[key] = cloneJson(host[key], host[key]);
      });
      state.xmindCaseGen = next;
    }

    function isDefaultWorkspaceRecordName(value) {
      var text = value === null || value === undefined ? '' : String(value || '').trim();
      if (!text) return true;
      return /^生成\d+$/u.test(text);
    }

    function buildDefaultWorkspaceRecordName(seq) {
      var value = Number(seq || 0);
      if (!Number.isFinite(value) || value <= 0) value = 1;
      return '生成' + String(value);
    }

    function buildWorkspaceDisplayName(record) {
      var snapshot = record && record.snapshot ? record.snapshot : {};
      var shared = snapshot.shared && typeof snapshot.shared === 'object' ? snapshot.shared : {};
      var xmind = snapshot.xmind && typeof snapshot.xmind === 'object' ? snapshot.xmind : {};
      var prep = xmind.prep && typeof xmind.prep === 'object' ? xmind.prep : {};
      var recordName = record && record.name ? String(record.name || '').trim() : '';
      var label = shared.requirementLabel ? String(shared.requirementLabel || '').trim() : '';
      if (label === '当前需求') label = '';
      if (!label && prep.requirementMode === 'manual') {
        label = prep.manualRequirementLabel ? String(prep.manualRequirementLabel || '').trim() : '';
      }
      if (!label && !isDefaultWorkspaceRecordName(recordName)) label = recordName;
      if (!label && shared.lastRawImportName) {
        label = normalizeRequirementLabelFromFileName(shared.lastRawImportName || '');
      }
      if (!label) label = recordName;
      if (!label) label = buildDefaultWorkspaceRecordName(record && record.seq);
      return label;
    }

    function resetActiveWorkspaceRecordNameToDefault() {
      var host = ensureWorkspaceHostState();
      var activeId = String(host.activeWorkspaceId || '');
      if (!activeId || !host.workspaces[activeId]) return false;
      host.workspaces[activeId].name = buildDefaultWorkspaceRecordName(host.workspaces[activeId].seq);
      host.workspaces[activeId].updatedAt = now();
      return true;
    }

    function resetActiveWorkspaceRecordSnapshotToInitial(drawerOpen, fullscreen) {
      var host = ensureWorkspaceHostState();
      var activeId = String(host.activeWorkspaceId || '');
      if (!activeId || !host.workspaces[activeId]) return false;
      host.workspaces[activeId].snapshot = stateModel.createWorkspaceSnapshot({
        drawerOpen: drawerOpen === true,
        fullscreen: fullscreen === true,
      });
      host.workspaces[activeId].updatedAt = now();
      return true;
    }

    function captureWorkspaceSnapshot(workspaceId) {
      var host = ensureWorkspaceHostState();
      var stableId = String(workspaceId || '');
      if (!stableId || !host.workspaces[stableId]) return null;
      if (stableId === String(host.activeWorkspaceId || '')) {
        snapshotPort.syncSummaryDraft();
        host.workspaces[stableId].snapshot = snapshotPort.captureCurrent();
        host.workspaces[stableId].updatedAt = now();
      }
      return host.workspaces[stableId].snapshot || null;
    }

    function ensureWorkspaceRecordFromCurrentContent(options) {
      var ensureOptions = options || {};
      var host = ensureWorkspaceHostState();
      if (host.activeWorkspaceId && host.workspaces[host.activeWorkspaceId]) return String(host.activeWorkspaceId || '');
      if (host.workspaceOrder.length > 0) return String(host.activeWorkspaceId || '');
      var currentSnapshot = snapshotPort.captureCurrent({
        skipSummaryDraftSync: ensureOptions.skipSummaryDraftSync === true,
        skipViewStateCapture: ensureOptions.skipViewStateCapture === true,
        overrideViewState: ensureOptions.overrideViewState && typeof ensureOptions.overrideViewState === 'object'
          ? ensureOptions.overrideViewState
          : null,
      });
      if (!stateModel.workspaceSnapshotHasContent(currentSnapshot)) return '';
      var seq = Number(host.nextWorkspaceSeq || 1);
      if (!Number.isFinite(seq) || seq < 1) seq = 1;
      var workspaceId = buildWorkspaceId(seq);
      host.nextWorkspaceSeq = seq + 1;
      host.workspaces[workspaceId] = createWorkspaceRecord(workspaceId, {
        seq: seq,
        name: deriveLiveWorkspaceName(buildDefaultWorkspaceRecordName(seq)),
        pendingOpenPrep: false,
        snapshot: currentSnapshot,
      });
      host.workspaceOrder.push(workspaceId);
      host.activeWorkspaceId = workspaceId;
      host.mirrorWorkspaceId = workspaceId;
      return workspaceId;
    }

    function saveActiveWorkspaceSnapshot(options) {
      var saveOptions = options || {};
      var host = ensureWorkspaceHostState();
      var activeId = String(host.activeWorkspaceId || '');
      if (!activeId || !host.workspaces[activeId]) {
        activeId = ensureWorkspaceRecordFromCurrentContent(saveOptions);
        host = ensureWorkspaceHostState();
      }
      if (!activeId || !host.workspaces[activeId]) return false;
      if (saveOptions.skipSummaryDraftSync !== true) snapshotPort.syncSummaryDraft();
      var computedSnapshot = snapshotPort.captureCurrent({
        skipSummaryDraftSync: true,
        skipViewStateCapture: saveOptions.skipViewStateCapture === true,
        overrideViewState: saveOptions.overrideViewState && typeof saveOptions.overrideViewState === 'object'
          ? saveOptions.overrideViewState
          : null,
      });
      var existingSnapshot = host.workspaces[activeId].snapshot || null;
      var existingXmindSnapshot = existingSnapshot && existingSnapshot.xmind
        ? cloneJson(existingSnapshot.xmind, stateModel.createInitialXmindState())
        : null;
      var existingSharedSnapshot = existingSnapshot && existingSnapshot.shared
        ? stateModel.normalizeWorkspaceSharedState(existingSnapshot.shared)
        : null;
      var shouldPreserveGeneratedShared = Boolean(
        saveOptions.forceShared !== true
        && existingSharedSnapshot
        && environmentPort.isPageSuspending()
        && stateModel.workspaceSnapshotHasGeneratedContent({ shared: existingSharedSnapshot })
        && !stateModel.workspaceSnapshotHasGeneratedContent({ shared: computedSnapshot.shared })
      );
      if (shouldPreserveGeneratedShared) computedSnapshot.shared = existingSharedSnapshot;
      if (
        !shouldPreserveGeneratedShared
        && saveOptions.forceShared !== true
        && environmentPort.isDrawerOpen() !== true
        && Number(environmentPort.getShadowDepth() || 0) <= 0
        && existingSnapshot
      ) {
        computedSnapshot.shared = stateModel.normalizeWorkspaceSharedState(existingSnapshot.shared);
      }
      if (saveOptions.preserveExistingXmind === true && existingXmindSnapshot) {
        if (saveOptions.overrideViewState && typeof saveOptions.overrideViewState === 'object') {
          existingXmindSnapshot.viewState = stateModel.normalizeStoredViewState(saveOptions.overrideViewState, {
            drawerOpen: saveOptions.overrideViewState.drawerOpen === true,
            fullscreen: saveOptions.overrideViewState.fullscreen === true,
          });
        }
        computedSnapshot.xmind = existingXmindSnapshot;
      }
      host.workspaces[activeId].snapshot = computedSnapshot;
      if (saveOptions.preserveRecordName !== true) {
        host.workspaces[activeId].name = deriveLiveWorkspaceName(host.workspaces[activeId].name);
      }
      host.workspaces[activeId].updatedAt = now();
      return true;
    }

    function hydrateWorkspaceSnapshot(workspaceId, options) {
      var hydrateOptions = options || {};
      var host = ensureWorkspaceHostState();
      var stableId = String(workspaceId || '');
      var record = stableId && host.workspaces[stableId] ? host.workspaces[stableId] : null;
      if (!record) return false;
      var sharedSnapshot = stateModel.normalizeWorkspaceSharedState(
        record.snapshot && record.snapshot.shared ? record.snapshot.shared : null
      );
      if (!sharedSnapshot.requirementLabel && !isDefaultWorkspaceRecordName(record.name)) {
        sharedSnapshot.requirementLabel = String(record.name || '').trim();
        if (!sharedSnapshot.requirementLabelSource) sharedSnapshot.requirementLabelSource = 'workspace';
      }
      host.activeWorkspaceId = stableId;
      host.mirrorWorkspaceId = stableId;
      snapshotPort.applyShared(sharedSnapshot);
      applyActiveXmindStateSnapshot(record.snapshot && record.snapshot.xmind ? record.snapshot.xmind : null);
      var activeHost = getWorkspaceHostState();
      activeHost.activeWorkspaceId = stableId;
      activeHost.mirrorWorkspaceId = stableId;
      activeHost.workspaceOrder = host.workspaceOrder.slice();
      activeHost.workspaces = host.workspaces;
      activeHost.nextWorkspaceSeq = host.nextWorkspaceSeq;
      activeHost.openButtonDotVisible = host.openButtonDotVisible === true;
      if (Object.prototype.hasOwnProperty.call(hydrateOptions, 'keepDrawerOpen')) {
        var keepDrawerOpen = hydrateOptions.keepDrawerOpen === true;
        snapshotPort.setDrawerState(
          keepDrawerOpen,
          keepDrawerOpen && environmentPort.isDrawerFullscreen()
        );
      }
      snapshotPort.postHydrate();
      return true;
    }

    function clearManagedTasksForWorkspace(workspaceId, options) {
      var stableId = String(workspaceId || '');
      var manager = getTaskManager();
      if (!stableId || !manager || typeof manager.clearTasksForWorkspace !== 'function') return 0;
      var clearOptions = options || {};
      return Number(manager.clearTasksForWorkspace(stableId, {
        includeRunning: clearOptions.includeRunning === true,
        action: clearOptions.action || 'workspace-clear',
      }) || 0);
    }

    function rotateWorkspaceGeneration(workspaceId) {
      var record = getWorkspaceRecord(workspaceId);
      if (!record) return '';
      record.generationId = buildWorkspaceGenerationId();
      record.updatedAt = now();
      return record.generationId;
    }

    function persistXmindState(useImmediate, options) {
      var persistOptions = options || {};
      var activeState = snapshotPort.ensureActiveState();
      activeState.hasImportedBaseline = environmentPort.hasImportedBaseline() === true;
      saveActiveWorkspaceSnapshot({ forceShared: persistOptions.forceShared === true });
      if (useImmediate === true) {
        persistencePort.persistImmediate();
        persistencePort.syncRestoreContexts();
      } else persistencePort.persistDeferred();
    }

    function persistManagedTaskWorkspaceState(useImmediate) {
      persistXmindState(useImmediate, { forceShared: true });
    }

    return {
      applyActiveXmindStateSnapshot: applyActiveXmindStateSnapshot,
      buildDefaultWorkspaceRecordName: buildDefaultWorkspaceRecordName,
      buildWorkspaceDisplayName: buildWorkspaceDisplayName,
      buildWorkspaceId: buildWorkspaceId,
      captureWorkspaceSnapshot: captureWorkspaceSnapshot,
      clearManagedTasksForWorkspace: clearManagedTasksForWorkspace,
      createWorkspaceRecord: createWorkspaceRecord,
      ensureWorkspaceHostState: ensureWorkspaceHostState,
      ensureWorkspaceRecordFromCurrentContent: ensureWorkspaceRecordFromCurrentContent,
      extractActiveXmindStateSnapshot: extractActiveXmindStateSnapshot,
      getActiveWorkspaceId: getActiveWorkspaceId,
      getMirrorWorkspaceId: getMirrorWorkspaceId,
      getWorkspaceHostState: getWorkspaceHostState,
      getWorkspaceRecord: getWorkspaceRecord,
      getWorkspaceUiSelectedId: getWorkspaceUiSelectedId,
      hydrateWorkspaceSnapshot: hydrateWorkspaceSnapshot,
      isDefaultWorkspaceRecordName: isDefaultWorkspaceRecordName,
      persistManagedTaskWorkspaceState: persistManagedTaskWorkspaceState,
      persistXmindState: persistXmindState,
      resetActiveWorkspaceRecordNameToDefault: resetActiveWorkspaceRecordNameToDefault,
      resetActiveWorkspaceRecordSnapshotToInitial: resetActiveWorkspaceRecordSnapshotToInitial,
      rotateWorkspaceGeneration: rotateWorkspaceGeneration,
      saveActiveWorkspaceSnapshot: saveActiveWorkspaceSnapshot,
      setMirrorWorkspaceSelection: setMirrorWorkspaceSelection,
    };
  }

  return { create: create };
});
