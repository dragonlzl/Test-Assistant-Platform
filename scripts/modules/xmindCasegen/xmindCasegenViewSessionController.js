(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenViewSessionController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var viewport = opts.viewport || {};
    var getViewState = port('getViewState', viewport.getViewState || function() { return {}; });
    var captureVisibleMindViewStateFromDom = port(
      'captureVisibleMindViewStateFromDom',
      viewport.captureVisibleMindViewStateFromDom || function() { return null; }
    );
    var buildCurrentMindDataSnapshot = port(
      'buildCurrentMindDataSnapshot',
      viewport.buildCurrentMindDataSnapshot || function() { return null; }
    );
    var collectCollapsedNodeKeysFromMindData = port(
      'collectCollapsedNodeKeysFromMindData',
      viewport.collectCollapsedNodeKeysFromMindData || function() { return []; }
    );
    var applyCurrentMindViewState = port(
      'applyCurrentMindViewState',
      viewport.applyCurrentMindViewState || function() { return false; }
    );
    var applyCurrentMindAnchorState = port(
      'applyCurrentMindAnchorState',
      viewport.applyCurrentMindAnchorState || function() { return false; }
    );
    var invalidateRootCenterRequest = port(
      'invalidateRootCenterRequest',
      viewport.invalidateRootCenterRequest || function() { return 0; }
    );
    var cancelPendingViewStateCapture = port(
      'cancelPendingViewStateCapture',
      viewport.cancelPendingViewStateCapture || function() { return false; }
    );
    var cloneJson = port('cloneJson', function(value, fallback) { return value || fallback; });
    var normalizeUniqueStringList = port('normalizeUniqueStringList', function(items) {
      return Array.isArray(items) ? items.slice() : [];
    });
    var normalizeStoredViewState = port('normalizeStoredViewState', function(value) { return value || {}; });
    var createDefaultViewState = port('createDefaultViewState', function() { return {}; });
    var createWorkspaceSnapshot = port('createWorkspaceSnapshot', function() { return {}; });
    var createInitialXmindState = port('createInitialXmindState', function() { return {}; });
    var ensureState = port('ensureState', function() { return {}; });
    var getHostState = port('getHostState', function() { return {}; });
    var getWorkspaceHostState = port('getWorkspaceHostState', function() { return {}; });
    var getWorkspaceOrder = port('getWorkspaceOrder', function() { return []; });
    var getWorkspaceRecord = port('getWorkspaceRecord', function() { return null; });
    var getActiveWorkspaceId = port('getActiveWorkspaceId', function() { return ''; });
    var getMindInstance = port('getMindInstance', function() { return null; });
    var getCurrentMindData = port('getCurrentMindData', function() { return null; });
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var shouldRestoreViewportForViewState = port('shouldRestoreViewportForViewState', function() { return false; });
    var persistWorkflowState = port('persistWorkflowState');
    var persistWorkflowStateNow = port('persistWorkflowStateNow');
    var saveActiveWorkspaceSnapshot = port('saveActiveWorkspaceSnapshot');
    var syncRunningTaskRestoreContexts = port('syncRunningTaskRestoreContexts');
    var syncSummaryDraftIntoState = port('syncSummaryDraftIntoState');
    var getXmindTaskManager = port('getXmindTaskManager', function() { return null; });
    var isSummaryDialogOpen = port('isSummaryDialogOpen', function() { return false; });
    var isDrawerOpenedViaDomRestore = port('isDrawerOpenedViaDomRestore', function() { return false; });
    var closeDrawer = port('closeDrawer');
    var scheduleTopupHighlightSync = port('scheduleTopupHighlightSync');
    var scheduleTimeout = port('setTimeout', function(handler, delay) { return setTimeout(handler, delay); });
    var requestFrame = port('requestFrame', function(handler) {
      if (typeof window !== 'undefined' && window && typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame(handler);
      }
      return scheduleTimeout(handler, 0);
    });
    var now = port('now', function() { return Date.now(); });
    var sessionStore = opts.sessionStorage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    var windowObj = opts.windowObj || (typeof window !== 'undefined' ? window : null);
    var documentObj = opts.documentObj || (typeof document !== 'undefined' ? document : null);
    var drawerEl = opts.drawerEl || null;
    var suspendViewStateCacheKey = String(opts.suspendViewStateCacheKey || 'tap-xmind-casegen-suspend-view-v1');
    var drawerCloseIntentBound = false;
    var workspaceViewRestoreToken = 0;
    var viewStateBeforeUnloadBound = false;
    var pageSuspending = false;
    var pageSuspendPersistAt = 0;

    function readSuspendViewStateCache() {
      if (!sessionStore) return null;
      try {
        var raw = sessionStore.getItem(suspendViewStateCacheKey);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) { return null; }
    }

    function writeSuspendViewStateCache(payload) {
      if (!sessionStore) return false;
      try {
        sessionStore.setItem(suspendViewStateCacheKey, JSON.stringify(payload || {}));
        return true;
      } catch (err) { return false; }
    }

    function clearSuspendViewStateCache() {
      if (!sessionStore) return false;
      try {
        sessionStore.removeItem(suspendViewStateCacheKey);
        return true;
      } catch (err) { return false; }
    }

    function invalidateWorkspaceViewRestore() {
      workspaceViewRestoreToken += 1;
      return workspaceViewRestoreToken;
    }

    function markPageSuspending(flag) {
      pageSuspending = flag === true;
    }

    function isPageSuspending() {
      if (pageSuspending === true) return true;
      return Boolean(documentObj && documentObj.visibilityState === 'hidden');
    }

    function captureSuspendFriendlyViewState() {
      var baseViewState = cloneJson(getViewState(), createDefaultViewState()) || createDefaultViewState();
      var drawerFullscreen = drawerEl && drawerEl.classList
        ? drawerEl.classList.contains('xmind-drawer-fullscreen')
        : (baseViewState.fullscreen === true);
      if (drawerFullscreen === true) {
        var lightView = cloneJson(baseViewState, createDefaultViewState()) || createDefaultViewState();
        lightView.drawerOpen = isDrawerOpen();
        lightView.fullscreen = false;
        lightView.transform = '';
        lightView.scaleVal = 1;
        lightView.scrollLeft = 0;
        lightView.scrollTop = 0;
        lightView.hasManualViewport = false;
        lightView.anchorState = null;
        lightView.collapsedNodeKeys = normalizeUniqueStringList(baseViewState.collapsedNodeKeys);
        lightView.treeSourceSignature = String(ensureState().treeSourceSignature || baseViewState.treeSourceSignature || '');
        lightView.updatedAt = now();
        return normalizeStoredViewState(lightView, { drawerOpen: lightView.drawerOpen === true, fullscreen: false });
      }
      var currentMindData = getCurrentMindData();
      var mindData = currentMindData || buildCurrentMindDataSnapshot();
      var nextView = captureVisibleMindViewStateFromDom({
        baseViewState: baseViewState,
        includeAnchor: false,
        includeCollapsed: false,
        preserveExistingAnchor: true,
      }) || baseViewState;
      if (!Array.isArray(nextView.collapsedNodeKeys) || !nextView.collapsedNodeKeys.length) {
        nextView.collapsedNodeKeys = mindData && mindData.nodeData
          ? collectCollapsedNodeKeysFromMindData(mindData.nodeData)
          : normalizeUniqueStringList(baseViewState.collapsedNodeKeys);
      }
      nextView.drawerOpen = isDrawerOpen();
      nextView.fullscreen = drawerEl && drawerEl.classList
        ? drawerEl.classList.contains('xmind-drawer-fullscreen') : (baseViewState.fullscreen === true);
      nextView.treeSourceSignature = String(ensureState().treeSourceSignature || baseViewState.treeSourceSignature || '');
      nextView.updatedAt = now();
      return normalizeStoredViewState(nextView, {
        drawerOpen: nextView.drawerOpen === true,
        fullscreen: nextView.fullscreen === true,
      });
    }

    function persistDrawerClosedIntentState(useImmediate) {
      var nextView = captureVisibleMindViewStateFromDom()
        || cloneJson(getViewState(), createDefaultViewState()) || createDefaultViewState();
      var updatedAt = now();
      nextView.drawerOpen = false;
      nextView.fullscreen = false;
      nextView.updatedAt = updatedAt;
      ensureState().viewState = cloneJson(nextView, createDefaultViewState());
      getWorkspaceOrder().forEach(function(workspaceId) {
        var record = getWorkspaceRecord(workspaceId);
        if (!record) return;
        if (!record.snapshot || typeof record.snapshot !== 'object') record.snapshot = createWorkspaceSnapshot();
        if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
          record.snapshot.xmind = createInitialXmindState();
        }
        var baseView = normalizeStoredViewState(record.snapshot.xmind.viewState, {
          drawerOpen: false,
          fullscreen: false,
        });
        baseView.drawerOpen = false;
        baseView.fullscreen = false;
        baseView.updatedAt = updatedAt;
        record.snapshot.xmind.viewState = cloneJson(baseView, createDefaultViewState());
        record.updatedAt = updatedAt;
      });
      saveActiveWorkspaceSnapshot({
        preserveExistingXmind: true,
        preserveRecordName: true,
        skipSummaryDraftSync: true,
        skipViewStateCapture: true,
        overrideViewState: nextView,
      });
      if (useImmediate === true) {
        persistWorkflowStateNow();
        var manager = getXmindTaskManager();
        if (manager && typeof manager.updateTasksContext === 'function') {
          manager.updateTasksContext(function(nextContext) {
            var nextTaskViewState = normalizeStoredViewState(nextContext && nextContext.viewState, {
              drawerOpen: false,
              fullscreen: false,
            });
            nextTaskViewState.drawerOpen = false;
            nextTaskViewState.fullscreen = false;
            nextTaskViewState.updatedAt = updatedAt;
            nextContext.viewState = cloneJson(nextTaskViewState, createDefaultViewState());
          }, { action: 'context' });
        }
        syncRunningTaskRestoreContexts(getActiveWorkspaceId(), {
          viewState: nextView,
          replaceViewState: true,
        });
      } else {
        persistWorkflowState();
      }
    }

    function applyPendingSuspendViewStateCache() {
      var cached = readSuspendViewStateCache();
      if (!cached || typeof cached !== 'object') return false;
      var cachedViewState = cached.viewState && typeof cached.viewState === 'object'
        ? normalizeStoredViewState(cached.viewState, {
          drawerOpen: cached.viewState.drawerOpen === true,
          fullscreen: cached.viewState.fullscreen === true,
        }) : null;
      if (!cachedViewState) {
        clearSuspendViewStateCache();
        return false;
      }
      if (cached.activeTab && String(cached.activeTab || '') !== 'casesgen') {
        clearSuspendViewStateCache();
        return false;
      }
      var host = getWorkspaceHostState();
      var targetWorkspaceId = String(cached.workspaceId || '');
      if (targetWorkspaceId && host.workspaces && host.workspaces[targetWorkspaceId]) {
        host.activeWorkspaceId = targetWorkspaceId;
        host.mirrorWorkspaceId = targetWorkspaceId;
      } else {
        targetWorkspaceId = String(host.activeWorkspaceId || '');
        host.mirrorWorkspaceId = targetWorkspaceId;
      }
      ensureState().viewState = cloneJson(cachedViewState, createDefaultViewState());
      if (targetWorkspaceId && host.workspaces && host.workspaces[targetWorkspaceId]) {
        var record = host.workspaces[targetWorkspaceId];
        if (!record.snapshot || typeof record.snapshot !== 'object') record.snapshot = createWorkspaceSnapshot();
        if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
          record.snapshot.xmind = createInitialXmindState();
        }
        record.snapshot.xmind.viewState = cloneJson(cachedViewState, createDefaultViewState());
        record.updatedAt = now();
      }
      clearSuspendViewStateCache();
      return true;
    }

    function persistSuspendIntentStateNow() {
      var currentTime = now();
      if (pageSuspendPersistAt > 0 && currentTime - pageSuspendPersistAt < 180) return false;
      pageSuspendPersistAt = currentTime;
      cancelPendingViewStateCapture();
      if (isSummaryDialogOpen() === true) syncSummaryDraftIntoState({ preserveCompleted: true });
      var nextView = captureSuspendFriendlyViewState();
      var hostState = getHostState();
      ensureState().viewState = cloneJson(nextView, createDefaultViewState());
      var activeWorkspaceId = String(getActiveWorkspaceId() || '');
      var record = getWorkspaceRecord(activeWorkspaceId);
      if (record) {
        if (!record.snapshot || typeof record.snapshot !== 'object') record.snapshot = createWorkspaceSnapshot();
        if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
          record.snapshot.xmind = createInitialXmindState();
        }
        record.snapshot.xmind.viewState = cloneJson(nextView, createDefaultViewState());
        record.updatedAt = currentTime;
      }
      writeSuspendViewStateCache({
        activeTab: String(hostState.activeTab || ''),
        workspaceId: activeWorkspaceId,
        viewState: cloneJson(nextView, createDefaultViewState()),
        updatedAt: currentTime,
      });
      syncRunningTaskRestoreContexts(activeWorkspaceId, { viewState: nextView, replaceViewState: true });
      return true;
    }

    function bindDrawerCloseIntentPersistence() {
      if (drawerCloseIntentBound || !drawerEl || !drawerEl.querySelector) return;
      drawerCloseIntentBound = true;
      var closeBtn = documentObj && documentObj.getElementById
        ? documentObj.getElementById('closeXmindCaseGenDrawerBtn') : null;
      var maskEl = drawerEl.querySelector('.drawer-mask');
      function markClosingState(event) {
        if (isDrawerOpenedViaDomRestore() === true) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          if (event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          closeDrawer();
          return;
        }
        persistDrawerClosedIntentState(true);
      }
      if (closeBtn && closeBtn.addEventListener) closeBtn.addEventListener('click', markClosingState, true);
      if (maskEl && maskEl.addEventListener) maskEl.addEventListener('click', markClosingState, true);
    }

    function scheduleWorkspaceViewRestore(viewState, workspaceId) {
      var stableWorkspaceId = String(workspaceId || '');
      var restoreView = normalizeWorkspaceRenderViewState(viewState);
      var token = invalidateWorkspaceViewRestore();
      invalidateRootCenterRequest();
      if (!stableWorkspaceId || !restoreView || !restoreView.transform) return;
      var runRestore = function() {
        var mindInstance = getMindInstance();
        if (token !== workspaceViewRestoreToken) return;
        if (!isDrawerOpen()) return;
        if (stableWorkspaceId !== String(getActiveWorkspaceId() || '')) return;
        if (mindInstance && mindInstance.__tapViewportInteracted === true) return;
        applyCurrentMindViewState(restoreView);
        if (restoreView.skipAnchorAlign !== true && restoreView.anchorState) {
          applyCurrentMindAnchorState(restoreView.anchorState);
        }
        scheduleTopupHighlightSync();
      };
      requestFrame(function() {
        runRestore();
        requestFrame(runRestore);
      });
      [0, 16, 48, 96, 180, 320].forEach(function(delayMs) {
        scheduleTimeout(runRestore, delayMs);
      });
    }

    function normalizeWorkspaceRenderViewState(viewState, normalizeOptions) {
      var source = viewState && typeof viewState === 'object' ? viewState : null;
      var normalizeOpts = normalizeOptions || {};
      if (!source) return null;
      var transform = String(source.transform || '');
      if (!transform) return null;
      return {
        transform: transform,
        scaleVal: Number(source.scaleVal || 1),
        scrollLeft: Number(source.scrollLeft || 0),
        scrollTop: Number(source.scrollTop || 0),
        skipAnchorAlign: source.skipAnchorAlign === true || normalizeOpts.skipAnchorAlign === true,
        anchorState: source.anchorState && source.anchorState.nodeId ? {
          nodeId: String(source.anchorState.nodeId || ''),
          centerX: Number(source.anchorState.centerX || 0),
          centerY: Number(source.anchorState.centerY || 0),
        } : null,
      };
    }

    function getWorkspaceStoredViewState(workspaceId) {
      var stableId = String(workspaceId || getActiveWorkspaceId() || '');
      if (!stableId) return normalizeStoredViewState(getViewState());
      var record = getWorkspaceRecord(stableId);
      if (record && record.snapshot && record.snapshot.xmind && record.snapshot.xmind.viewState
        && typeof record.snapshot.xmind.viewState === 'object') {
        return normalizeStoredViewState(record.snapshot.xmind.viewState);
      }
      if (stableId === String(getActiveWorkspaceId() || '')) return normalizeStoredViewState(getViewState());
      return createDefaultViewState();
    }

    function clearWorkspaceFullscreenRestoreIntent(workspaceId) {
      var stableId = String(workspaceId || getActiveWorkspaceId() || '');
      var storedView = getWorkspaceStoredViewState(stableId);
      var hadFullscreen = storedView && storedView.drawerOpen === true && storedView.fullscreen === true;
      if (!hadFullscreen) return false;
      storedView.fullscreen = false;
      storedView.updatedAt = now();
      if (stableId === String(getActiveWorkspaceId() || '')) {
        ensureState().viewState = cloneJson(storedView, createDefaultViewState());
      }
      var record = getWorkspaceRecord(stableId);
      if (record) {
        if (!record.snapshot || typeof record.snapshot !== 'object') record.snapshot = createWorkspaceSnapshot();
        if (!record.snapshot.xmind || typeof record.snapshot.xmind !== 'object') {
          record.snapshot.xmind = createInitialXmindState();
        }
        record.snapshot.xmind.viewState = cloneJson(storedView, createDefaultViewState());
        record.updatedAt = now();
      }
      return true;
    }

    function shouldRestoreWorkspaceViewport(workspaceId, viewState) {
      var source = viewState && typeof viewState === 'object'
        ? viewState : getWorkspaceStoredViewState(workspaceId);
      return shouldRestoreViewportForViewState(source);
    }

    function getRestorableViewState(treeSignature) {
      var viewState = normalizeStoredViewState(getViewState());
      if (viewState.drawerOpen !== true) return null;
      if (!viewState.transform || viewState.hasManualViewport !== true) return null;
      if (String(viewState.treeSourceSignature || '') !== String(treeSignature || '')) return null;
      return {
        transform: String(viewState.transform || ''),
        scaleVal: Number(viewState.scaleVal || 1),
        scrollLeft: Number(viewState.scrollLeft || 0),
        scrollTop: Number(viewState.scrollTop || 0),
        skipAnchorAlign: true,
        anchorState: viewState.anchorState && viewState.anchorState.nodeId ? {
          nodeId: String(viewState.anchorState.nodeId || ''),
          centerX: Number(viewState.anchorState.centerX || 0),
          centerY: Number(viewState.anchorState.centerY || 0),
        } : null,
      };
    }

    function getRestorableDrawerState(treeSignature) {
      var viewState = getViewState();
      if (viewState.drawerOpen !== true) return null;
      if (treeSignature && String(viewState.treeSourceSignature || '') !== String(treeSignature || '')) return null;
      return { fullscreen: viewState.fullscreen === true };
    }

    function getCollapsedNodeKeyMap() {
      var viewState = getViewState();
      var map = Object.create(null);
      (Array.isArray(viewState.collapsedNodeKeys) ? viewState.collapsedNodeKeys : []).forEach(function(item) {
        var key = String(item || '').trim();
        if (key) map[key] = true;
      });
      return map;
    }

    function bindViewStatePersistenceLifecycle() {
      if (viewStateBeforeUnloadBound) return;
      viewStateBeforeUnloadBound = true;
      if (windowObj && typeof windowObj.addEventListener === 'function') {
        windowObj.addEventListener('beforeunload', function() {
          markPageSuspending(true);
          if (isDrawerOpen()) persistSuspendIntentStateNow();
        }, true);
        windowObj.addEventListener('pagehide', function() {
          markPageSuspending(true);
          if (isDrawerOpen()) persistSuspendIntentStateNow();
        }, true);
      }
      if (documentObj && typeof documentObj.addEventListener === 'function') {
        documentObj.addEventListener('visibilitychange', function() {
          if (documentObj.visibilityState === 'visible') {
            markPageSuspending(false);
            pageSuspendPersistAt = 0;
            return;
          }
          if (documentObj.visibilityState !== 'hidden') return;
          markPageSuspending(true);
          if (isDrawerOpen()) persistSuspendIntentStateNow();
        }, true);
      }
    }

    return {
      applyPendingSuspendViewStateCache: applyPendingSuspendViewStateCache,
      bindDrawerCloseIntentPersistence: bindDrawerCloseIntentPersistence,
      bindViewStatePersistenceLifecycle: bindViewStatePersistenceLifecycle,
      captureSuspendFriendlyViewState: captureSuspendFriendlyViewState,
      clearSuspendViewStateCache: clearSuspendViewStateCache,
      clearWorkspaceFullscreenRestoreIntent: clearWorkspaceFullscreenRestoreIntent,
      getCollapsedNodeKeyMap: getCollapsedNodeKeyMap,
      getRestorableDrawerState: getRestorableDrawerState,
      getRestorableViewState: getRestorableViewState,
      getWorkspaceStoredViewState: getWorkspaceStoredViewState,
      invalidateWorkspaceViewRestore: invalidateWorkspaceViewRestore,
      isPageSuspending: isPageSuspending,
      normalizeWorkspaceRenderViewState: normalizeWorkspaceRenderViewState,
      persistDrawerClosedIntentState: persistDrawerClosedIntentState,
      persistSuspendIntentStateNow: persistSuspendIntentStateNow,
      readSuspendViewStateCache: readSuspendViewStateCache,
      scheduleWorkspaceViewRestore: scheduleWorkspaceViewRestore,
      shouldRestoreWorkspaceViewport: shouldRestoreWorkspaceViewport,
      writeSuspendViewStateCache: writeSuspendViewStateCache,
    };
  }

  return { create: create };
});
