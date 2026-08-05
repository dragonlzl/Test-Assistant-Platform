(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenDrawerSessionController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state || {};
    var drawerEl = opts.drawerEl || null;
    var drawerTitleEl = opts.drawerTitleEl || null;
    var drawerFullscreenPort = opts.drawerFullscreenPort || null;
    var drawerScrollLockPort = opts.drawerScrollLockPort || null;
    var workspace = opts.workspace || {};
    var view = opts.view || {};
    var ui = opts.ui || {};
    var workflow = opts.workflow || {};
    var environment = opts.environment || {};
    var scheduleTimeout = typeof opts.setTimeout === 'function' ? opts.setTimeout : function(handler, delay) {
      return setTimeout(handler, delay);
    };
    var cancelTimeout = typeof opts.clearTimeout === 'function' ? opts.clearTimeout : function(timerId) {
      clearTimeout(timerId);
    };
    var now = typeof opts.now === 'function' ? opts.now : function() { return Date.now(); };

    function port(owner, name, fallback) {
      return owner && typeof owner[name] === 'function' ? owner[name] : (fallback || noop);
    }

    var getActiveWorkspaceId = port(workspace, 'getActiveWorkspaceId', function() { return ''; });
    var getMirrorWorkspaceId = port(workspace, 'getMirrorWorkspaceId', getActiveWorkspaceId);
    var setMirrorWorkspaceSelection = port(workspace, 'setMirrorWorkspaceSelection');
    var hydrateWorkspaceSnapshot = port(workspace, 'hydrateWorkspaceSnapshot');
    var hydrateActiveWorkspaceSnapshot = port(workspace, 'hydrateActiveWorkspaceSnapshot');
    var switchWorkspace = port(workspace, 'switchWorkspace');
    var persistXmindState = port(workspace, 'persistXmindState');

    var getViewState = port(view, 'getViewState', function() { return {}; });
    var getWorkspaceStoredViewState = port(view, 'getWorkspaceStoredViewState', function() { return {}; });
    var clearWorkspaceFullscreenRestoreIntent = port(view, 'clearWorkspaceFullscreenRestoreIntent');
    var shouldRestoreWorkspaceViewport = port(view, 'shouldRestoreWorkspaceViewport', function() { return false; });
    var clearPendingOpenRenderHold = port(view, 'clearPendingOpenRenderHold');
    var beginPendingOpenRenderHold = port(view, 'beginPendingOpenRenderHold');
    var releasePendingOpenRenderHold = port(view, 'releasePendingOpenRenderHold');
    var persistDrawerClosedIntentState = port(view, 'persistDrawerClosedIntentState');
    var bindDrawerCloseIntentPersistence = port(view, 'bindDrawerCloseIntentPersistence');

    var syncOpenButtonState = port(ui, 'syncOpenButtonState');
    var setDebugState = port(ui, 'setDebugState');
    var closeSummaryDialog = port(ui, 'closeSummaryDialog');
    var render = port(ui, 'render');

    var createDefaultCaseGenSettings = port(workflow, 'createDefaultCaseGenSettings', function() { return {}; });
    var setCasesGenModulesView = port(workflow, 'setCasesGenModulesView');
    var hasManagedTaskRestoreContextForWorkspace = port(
      workflow,
      'hasManagedTaskRestoreContextForWorkspace',
      function() { return false; }
    );
    var resetMindCanvasBeforeDrawerOpen = port(workflow, 'resetMindCanvasBeforeDrawerOpen');
    var clearDrawerRestoreRetry = port(workflow, 'clearDrawerRestoreRetry');
    var clearStoreValidationState = port(workflow, 'clearStoreValidationState');
    var isPageSuspending = port(workflow, 'isPageSuspending', function() { return false; });
    var destroyMind = port(workflow, 'destroyMind');
    var finalizeLegacyWorkflowRestore = port(workflow, 'finalizeLegacyWorkflowRestore');
    var flushDeferredCasesGenPageRender = port(workflow, 'flushDeferredCasesGenPageRender');
    var persistWorkflowStateNow = port(workflow, 'persistWorkflowStateNow');
    var isDrawerManualCloseSuppressed = port(workflow, 'isDrawerManualCloseSuppressed', function() { return false; });
    var markDrawerManualCloseSuppressed = port(workflow, 'markDrawerManualCloseSuppressed');
    var shouldSyncLegacyBeforeOpen = port(workflow, 'shouldSyncLegacyBeforeOpen', function() { return false; });
    var syncLegacyWorkflowContext = port(workflow, 'syncLegacyWorkflowContext');
    var clearOpenButtonCompletionNotice = port(workflow, 'clearOpenButtonCompletionNotice');
    var switchTab = port(workflow, 'switchTab');

    var getDrawerInstance = port(environment, 'getDrawerInstance', function() { return null; });
    var setDrawerInstance = port(environment, 'setDrawerInstance');
    var getDrawerOpenRenderTimer = port(environment, 'getDrawerOpenRenderTimer', function() { return 0; });
    var setDrawerOpenRenderTimer = port(environment, 'setDrawerOpenRenderTimer');
    var getDeferredCloseTimer = port(environment, 'getDeferredCloseTimer', function() { return 0; });
    var setDeferredCloseTimer = port(environment, 'setDeferredCloseTimer');
    var getPendingOpenCenterRoot = port(environment, 'getPendingOpenCenterRoot', function() { return false; });
    var setPendingOpenCenterRoot = port(environment, 'setPendingOpenCenterRoot');
    var getPendingOpenResetCanvas = port(environment, 'getPendingOpenResetCanvas', function() { return false; });
    var setPendingOpenResetCanvas = port(environment, 'setPendingOpenResetCanvas');
    var getPendingOpenInstant = port(environment, 'getPendingOpenInstant', function() { return false; });
    var setPendingOpenInstant = port(environment, 'setPendingOpenInstant');
    var getPendingOpenSkipRestorable = port(environment, 'getPendingOpenSkipRestorable', function() { return false; });
    var setPendingOpenSkipRestorable = port(environment, 'setPendingOpenSkipRestorable');
    var getPendingOpenForceHydrate = port(environment, 'getPendingOpenForceHydrate', function() { return false; });
    var setPendingOpenForceHydrate = port(environment, 'setPendingOpenForceHydrate');
    var getPendingDrawerWorkspaceId = port(environment, 'getPendingDrawerWorkspaceId', function() { return ''; });
    var setPendingDrawerWorkspaceId = port(environment, 'setPendingDrawerWorkspaceId');
    var isDrawerOpenedViaDomRestore = port(environment, 'isDrawerOpenedViaDomRestore', function() { return false; });
    var setDrawerOpenedViaDomRestore = port(environment, 'setDrawerOpenedViaDomRestore');
    var isRestoreDrawerOpenInFlight = port(environment, 'isRestoreDrawerOpenInFlight', function() { return false; });
    var setRestoreDrawerOpenInFlight = port(environment, 'setRestoreDrawerOpenInFlight');
    var isDrawerOpen = port(environment, 'isDrawerOpen', function() { return false; });
    var createDrawer = port(environment, 'createDrawer', function() { return null; });

    function setDrawerFullscreenState(enabled) {
      if (!drawerEl || !drawerFullscreenPort || typeof drawerFullscreenPort.set !== 'function') return false;
      return drawerFullscreenPort.set(drawerEl, enabled === true);
    }

    function ensureDrawer() {
      var currentDrawer = getDrawerInstance();
      if (currentDrawer) return currentDrawer;
      currentDrawer = createDrawer({
        drawerId: 'xmindCaseGenDrawer',
        openButtons: [],
        closeButtons: ['closeXmindCaseGenDrawerBtn'],
        onOpen: function() {
          var shouldCenterRootAfterOpen = getPendingOpenCenterRoot() === true;
          var shouldResetCanvasAfterOpen = getPendingOpenResetCanvas() === true;
          var shouldSkipRestorableAfterOpen = getPendingOpenSkipRestorable() === true;
          var forceSnapshotHydrate = getPendingOpenForceHydrate() === true;
          var openInstant = getPendingOpenInstant() === true;
          var restoreOpening = isRestoreDrawerOpenInFlight() === true;
          var pendingWorkspaceId = getPendingDrawerWorkspaceId();
          var openWorkspaceId = pendingWorkspaceId
            ? String(pendingWorkspaceId || '')
            : String(getActiveWorkspaceId() || '');
          setPendingOpenCenterRoot(false);
          setPendingOpenResetCanvas(false);
          setPendingOpenSkipRestorable(false);
          setPendingOpenForceHydrate(false);
          setPendingOpenInstant(false);
          setPendingDrawerWorkspaceId('');
          getViewState().drawerOpen = true;
          if (restoreOpening) getViewState().fullscreen = false;
          getViewState().updatedAt = now();
          clearOpenButtonCompletionNotice({ persist: restoreOpening !== true });
          setDrawerFullscreenState(getViewState().fullscreen === true && restoreOpening !== true);
          setDebugState({ phase: 'drawer-open' });
          try {
            if (!restoreOpening) setCasesGenModulesView();
            if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
              state.caseGenSettings = createDefaultCaseGenSettings();
            }
            state.caseGenSettings.activeTab = 'xmind-modules';
          } catch (errView) {
            setDebugState({
              phase: 'drawer-open-set-view-error',
              error: errView && errView.message ? String(errView.message) : '未知错误',
            });
          }
          try {
            if (openWorkspaceId) setMirrorWorkspaceSelection(openWorkspaceId);
            var targetWorkspaceId = openWorkspaceId || String(getActiveWorkspaceId() || '');
            var shouldSkipSnapshotHydrate = forceSnapshotHydrate !== true
              && restoreOpening === true
              && hasManagedTaskRestoreContextForWorkspace(targetWorkspaceId);
            if (!shouldSkipSnapshotHydrate) {
              if (openWorkspaceId && openWorkspaceId !== String(getActiveWorkspaceId() || '')) {
                hydrateWorkspaceSnapshot(openWorkspaceId, { keepDrawerOpen: true });
              } else {
                hydrateActiveWorkspaceSnapshot({ keepDrawerOpen: true });
              }
            }
          } catch (errHydrate) {
            setDebugState({
              phase: 'drawer-open-hydrate-error',
              error: errHydrate && errHydrate.message ? String(errHydrate.message) : '未知错误',
              workspaceId: openWorkspaceId,
            });
          }
          if (drawerTitleEl) drawerTitleEl.textContent = 'XMind 用例生成';
          closeSummaryDialog({ skipPersist: true });
          if (shouldResetCanvasAfterOpen || shouldCenterRootAfterOpen) resetMindCanvasBeforeDrawerOpen();
          var currentTimer = getDrawerOpenRenderTimer();
          if (currentTimer) cancelTimeout(currentTimer);
          var renderDelayMs = restoreOpening
            ? (shouldSkipRestorableAfterOpen ? 120 : 0)
            : (openInstant ? 0 : 380);
          setDrawerOpenRenderTimer(scheduleTimeout(function() {
            setDrawerOpenRenderTimer(0);
            if (!isDrawerOpen()) {
              clearPendingOpenRenderHold();
              setDebugState({ phase: 'drawer-open-render-skipped-closed' });
              return;
            }
            try {
              render({
                reason: restoreOpening ? 'drawer-open-restore-async' : 'drawer-open',
                persist: false,
                centerRootAfterRender: shouldCenterRootAfterOpen,
                skipRestorableViewState: shouldCenterRootAfterOpen || shouldSkipRestorableAfterOpen,
              });
            } finally {
              releasePendingOpenRenderHold(180);
            }
          }, renderDelayMs));
        },
        onClose: function() {
          persistDrawerClosedIntentState(false);
          finalizeDrawerClosedLifecycle();
        },
      });
      if (!currentDrawer) return null;
      setDrawerInstance(currentDrawer);
      bindDrawerCloseIntentPersistence();
      return currentDrawer;
    }

    function openDrawerShell(options) {
      var openOptions = options || {};
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.open === 'function') {
        var closeTimer = getDeferredCloseTimer();
        if (closeTimer) {
          cancelTimeout(closeTimer);
          setDeferredCloseTimer(0);
        }
        setDrawerOpenedViaDomRestore(false);
        drawer.open({ instant: openOptions.instant === true });
        return true;
      }
      getViewState().drawerOpen = true;
      getViewState().updatedAt = now();
      syncOpenButtonState();
      render({
        reason: openOptions.reason || 'open-shell-fallback',
        centerRootAfterRender: openOptions.centerRootAfterRender === true,
        skipRestorableViewState: openOptions.centerRootAfterRender === true,
      });
      setPendingOpenCenterRoot(false);
      persistXmindState(true);
      return false;
    }

    function releaseDrawerOpenLayoutState() {
      if (drawerScrollLockPort && typeof drawerScrollLockPort.release === 'function') {
        drawerScrollLockPort.release('xmindCaseGenDrawer');
      }
    }

    function finalizeDrawerClosedLifecycle() {
      clearPendingOpenRenderHold();
      var closeTimer = getDeferredCloseTimer();
      if (closeTimer) cancelTimeout(closeTimer);
      setDeferredCloseTimer(0);
      setDrawerOpenedViaDomRestore(false);
      setPendingDrawerWorkspaceId('');
      var renderTimer = getDrawerOpenRenderTimer();
      if (renderTimer) cancelTimeout(renderTimer);
      setDrawerOpenRenderTimer(0);
      clearDrawerRestoreRetry('drawer-onclose');
      clearStoreValidationState(true);
      if (isPageSuspending()) {
        syncOpenButtonState();
        setDrawerFullscreenState(false);
        destroyMind();
        return;
      }
      finalizeLegacyWorkflowRestore();
      syncOpenButtonState();
      setDrawerFullscreenState(false);
      closeSummaryDialog({ skipPersist: true });
      destroyMind();
      flushDeferredCasesGenPageRender();
      persistWorkflowStateNow();
    }

    function open(options) {
      var openOptions = options || {};
      var wasOpen = isDrawerOpen();
      var useRestoreFastPath = openOptions.restoreOpening === true && !wasOpen;
      var allowManualCloseOverride = openOptions.userInitiated === true
        || openOptions.ignoreManualCloseSuppress === true;
      var openWorkspaceId = !wasOpen
        ? String(openOptions.workspaceId || (useRestoreFastPath ? getMirrorWorkspaceId() : getActiveWorkspaceId()) || '')
        : '';
      var targetWorkspaceIdBeforeOpen = openWorkspaceId || getActiveWorkspaceId();
      var restoreViewStateBeforeOpen = !wasOpen
        ? getWorkspaceStoredViewState(targetWorkspaceIdBeforeOpen)
        : null;
      var restoreWasFullscreen = Boolean(
        restoreViewStateBeforeOpen
        && restoreViewStateBeforeOpen.drawerOpen === true
        && restoreViewStateBeforeOpen.fullscreen === true
      );
      if (useRestoreFastPath && !allowManualCloseOverride && isDrawerManualCloseSuppressed()) {
        setDebugState({ phase: 'drawer-restore-skipped-manual-close' });
        return false;
      }
      if (!useRestoreFastPath) markDrawerManualCloseSuppressed(0);
      setRestoreDrawerOpenInFlight(useRestoreFastPath);
      if (!wasOpen && openWorkspaceId) {
        setPendingDrawerWorkspaceId(openWorkspaceId);
        setMirrorWorkspaceSelection(openWorkspaceId);
      } else if (!wasOpen) {
        setPendingDrawerWorkspaceId(String(getActiveWorkspaceId() || ''));
      }
      if (!wasOpen && !useRestoreFastPath && shouldSyncLegacyBeforeOpen()) {
        syncLegacyWorkflowContext({ persist: false, force: true });
      }
      if (!wasOpen && openWorkspaceId && openWorkspaceId !== getActiveWorkspaceId()) {
        switchWorkspace(openWorkspaceId, {
          reason: useRestoreFastPath ? 'workspace-open-restore-prepare' : 'workspace-open-prepare',
          centerRootAfterRender: false,
        });
      }
      if (useRestoreFastPath && restoreWasFullscreen) {
        clearWorkspaceFullscreenRestoreIntent(openWorkspaceId || getActiveWorkspaceId());
        setPendingOpenSkipRestorable(true);
      } else if (!wasOpen) {
        setPendingOpenSkipRestorable(false);
      }
      setPendingOpenForceHydrate(openOptions.forceSnapshotHydrate === true);
      setPendingOpenCenterRoot(!wasOpen && (
        restoreWasFullscreen
        || !shouldRestoreWorkspaceViewport(targetWorkspaceIdBeforeOpen, restoreViewStateBeforeOpen)
      ));
      setPendingOpenResetCanvas(!wasOpen);
      if (!wasOpen) beginPendingOpenRenderHold();
      setPendingOpenInstant(openOptions.instant === true || useRestoreFastPath);
      clearOpenButtonCompletionNotice({ persist: false });
      switchTab('casesgen');
      if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
        state.caseGenSettings = createDefaultCaseGenSettings();
      }
      if (!useRestoreFastPath) setCasesGenModulesView();
      else state.caseGenSettings.activeTab = 'xmind-modules';
      if (!wasOpen) {
        state.caseGenSettings.activeTab = 'xmind-modules';
        hydrateActiveWorkspaceSnapshot({ keepDrawerOpen: false });
        resetMindCanvasBeforeDrawerOpen();
      }
      return openDrawerShell({
        instant: getPendingOpenInstant() === true,
        centerRootAfterRender: getPendingOpenCenterRoot() === true,
        reason: useRestoreFastPath ? 'restore-open-shell' : 'open-fallback',
      });
    }

    function close() {
      clearPendingOpenRenderHold();
      markDrawerManualCloseSuppressed(1800);
      setRestoreDrawerOpenInFlight(false);
      var renderTimer = getDrawerOpenRenderTimer();
      if (renderTimer) cancelTimeout(renderTimer);
      setDrawerOpenRenderTimer(0);
      clearDrawerRestoreRetry('close-api');
      if (isDrawerOpenedViaDomRestore() && drawerEl && drawerEl.classList && isDrawerOpen()) {
        persistDrawerClosedIntentState(true);
        drawerEl.classList.remove('open');
        drawerEl.classList.remove('closing');
        setDrawerFullscreenState(false);
        releaseDrawerOpenLayoutState();
        syncOpenButtonState();
        var closeTimer = getDeferredCloseTimer();
        if (closeTimer) cancelTimeout(closeTimer);
        setDeferredCloseTimer(scheduleTimeout(function() {
          setDeferredCloseTimer(0);
          finalizeDrawerClosedLifecycle();
        }, 0));
        return true;
      }
      var drawer = ensureDrawer();
      if (drawer && typeof drawer.close === 'function') {
        persistDrawerClosedIntentState(true);
        drawer.close();
        return true;
      }
      persistDrawerClosedIntentState(false);
      releaseDrawerOpenLayoutState();
      finalizeDrawerClosedLifecycle();
      persistXmindState(true);
      return false;
    }

    return {
      close: close,
      ensureDrawer: ensureDrawer,
      finalizeDrawerClosedLifecycle: finalizeDrawerClosedLifecycle,
      open: open,
      openDrawerShell: openDrawerShell,
      releaseDrawerOpenLayoutState: releaseDrawerOpenLayoutState,
      setDrawerFullscreenState: setDrawerFullscreenState,
    };
  }

  return { create: create };
});
