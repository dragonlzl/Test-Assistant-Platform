(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenViewLifecycleController = api;
  }
})(typeof window !== 'undefined' ? window : null, function(root) {
  function resolveFactory(options, optionName, globalName, modulePath) {
    var opts = options && typeof options === 'object' ? options : {};
    if (opts[optionName] && typeof opts[optionName].create === 'function') return opts[optionName];
    if (root && root.app && root.app[globalName]
      && typeof root.app[globalName].create === 'function') return root.app[globalName];
    if (typeof require === 'function') {
      try {
        var required = require(modulePath);
        if (required && typeof required.create === 'function') return required;
      } catch (err) {}
    }
    throw new Error(globalName + ' 未加载');
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var viewportFactory = resolveFactory(
      opts,
      'viewportStateControllerFactory',
      'xmindCasegenViewportStateController',
      './xmindCasegenViewportStateController.js'
    );
    var sessionFactory = resolveFactory(
      opts,
      'viewSessionControllerFactory',
      'xmindCasegenViewSessionController',
      './xmindCasegenViewSessionController.js'
    );
    var queueFactory = resolveFactory(
      opts,
      'renderQueueControllerFactory',
      'xmindCasegenRenderQueueController',
      './xmindCasegenRenderQueueController.js'
    );
    var viewport = viewportFactory.create(opts);
    var session = sessionFactory.create(Object.assign({}, opts, {
      viewport: viewport,
      getViewState: viewport.getViewState,
      captureVisibleMindViewStateFromDom: viewport.captureVisibleMindViewStateFromDom,
      cancelPendingViewStateCapture: viewport.cancelPendingViewStateCapture,
      buildCurrentMindDataSnapshot: viewport.buildCurrentMindDataSnapshot,
      collectCollapsedNodeKeysFromMindData: viewport.collectCollapsedNodeKeysFromMindData,
      applyCurrentMindViewState: viewport.applyCurrentMindViewState,
      applyCurrentMindAnchorState: viewport.applyCurrentMindAnchorState,
      invalidateRootCenterRequest: viewport.invalidateRootCenterRequest,
    }));
    var queue = queueFactory.create(Object.assign({}, opts, {
      getViewState: viewport.getViewState,
      captureCurrentViewState: viewport.captureCurrentViewState,
      cancelPendingViewStateCapture: viewport.cancelPendingViewStateCapture,
      captureRenderedMindAnchorStateByNodeId: viewport.captureRenderedMindAnchorStateByNodeId,
      normalizeWorkspaceRenderViewState: session.normalizeWorkspaceRenderViewState,
    }));

    return {
      applyPendingSuspendViewStateCache: session.applyPendingSuspendViewStateCache,
      beginPendingOpenRenderHold: queue.beginPendingOpenRenderHold,
      bindDrawerCloseIntentPersistence: session.bindDrawerCloseIntentPersistence,
      bindLiveViewStateCapture: viewport.bindLiveViewStateCapture,
      bindViewStatePersistenceLifecycle: session.bindViewStatePersistenceLifecycle,
      buildViewStateNodeKey: viewport.buildViewStateNodeKey,
      cancelQueuedMindRender: queue.cancelQueuedMindRender,
      captureCurrentViewState: viewport.captureCurrentViewState,
      captureMindSearchStateForRender: queue.captureMindSearchStateForRender,
      captureVisibleMindViewStateFromDom: viewport.captureVisibleMindViewStateFromDom,
      centerRootNodeView: viewport.centerRootNodeView,
      clearPendingOpenRenderHold: queue.clearPendingOpenRenderHold,
      clearSuspendViewStateCache: session.clearSuspendViewStateCache,
      clearWorkspaceFullscreenRestoreIntent: session.clearWorkspaceFullscreenRestoreIntent,
      flushQueuedMindRender: queue.flushQueuedMindRender,
      getCollapsedNodeKeyMap: session.getCollapsedNodeKeyMap,
      getRestorableDrawerState: session.getRestorableDrawerState,
      getRestorableViewState: session.getRestorableViewState,
      getViewState: viewport.getViewState,
      getWorkspaceStoredViewState: session.getWorkspaceStoredViewState,
      invalidateWorkspaceViewRestore: session.invalidateWorkspaceViewRestore,
      isPageSuspending: session.isPageSuspending,
      isPendingOpenRenderHeld: queue.isPendingOpenRenderHeld,
      markManualViewportInteraction: viewport.markManualViewportInteraction,
      normalizeWorkspaceRenderViewState: session.normalizeWorkspaceRenderViewState,
      persistDrawerClosedIntentState: session.persistDrawerClosedIntentState,
      persistSuspendIntentStateNow: session.persistSuspendIntentStateNow,
      persistViewportActionViewState: viewport.persistViewportActionViewState,
      prepareMindDestroy: viewport.prepareMindDestroy,
      queueStatusMindRender: queue.queueStatusMindRender,
      queueStructureMindRender: queue.queueStructureMindRender,
      queueTerminalMindRender: queue.queueTerminalMindRender,
      readSuspendViewStateCache: session.readSuspendViewStateCache,
      releasePendingOpenRenderHold: queue.releasePendingOpenRenderHold,
      restoreMindSearchStateAfterRender: queue.restoreMindSearchStateAfterRender,
      scheduleCaptureCurrentViewState: viewport.scheduleCaptureCurrentViewState,
      scheduleLightweightViewportCapture: viewport.scheduleLightweightViewportCapture,
      scheduleWorkspaceViewRestore: session.scheduleWorkspaceViewRestore,
      shouldRestoreWorkspaceViewport: session.shouldRestoreWorkspaceViewport,
      writeSuspendViewStateCache: session.writeSuspendViewStateCache,
    };
  }

  return { create: create };
});
