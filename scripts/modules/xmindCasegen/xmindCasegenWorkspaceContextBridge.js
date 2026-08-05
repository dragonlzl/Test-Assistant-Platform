(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenWorkspaceContextBridge = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var getHostState = typeof opts.getHostState === 'function'
      ? opts.getHostState
      : function() { return {}; };
    var getCasesGenApi = typeof opts.getCasesGenApi === 'function'
      ? opts.getCasesGenApi
      : function() { return null; };
    var getActiveWorkspaceId = typeof opts.getActiveWorkspaceId === 'function'
      ? opts.getActiveWorkspaceId
      : function() { return ''; };
    var isDrawerOpen = typeof opts.isDrawerOpen === 'function'
      ? opts.isDrawerOpen
      : function() { return false; };
    var workspaceShadowDepth = 0;
    var workspaceUiMutedDepth = 0;
    var shadowWorkspaceSharedState = null;

    function normalizeDepth(value) {
      var number = Number(value || 0);
      return Number.isFinite(number) ? Math.max(0, number) : 0;
    }

    function getActiveCaseGenView(state) {
      var settings = state && state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : null;
      if (settings && (settings.activeTab === 'xmind-modules' || settings.activeTab === 'modules')) {
        return 'xmind-modules';
      }
      return settings && settings.activeTab === 'legacy-modules' ? 'legacy-modules' : 'settings';
    }

    function syncLegacyWorkflowContext(options) {
      var casesGenApi = getCasesGenApi();
      if (!casesGenApi || typeof casesGenApi.syncLegacyCaseGenState !== 'function') return false;
      casesGenApi.syncLegacyCaseGenState(options && typeof options === 'object'
        ? options
        : { persist: false, force: true });
      return true;
    }

    function restoreLegacyWorkflowContext(options) {
      var casesGenApi = getCasesGenApi();
      if (!casesGenApi || typeof casesGenApi.restoreLegacyCaseGenState !== 'function') return false;
      var opts = options && typeof options === 'object' ? options : {};
      casesGenApi.restoreLegacyCaseGenState({
        allowWhileXmindMirror: opts.allowWhileXmindMirror === true,
        render: opts.render === true,
        persist: opts.persist === true,
        restoreInputs: opts.restoreInputs !== false,
        inputsOnly: opts.inputsOnly === true,
      });
      return true;
    }

    function finalizeLegacyWorkflowRestore() {
      return restoreLegacyWorkflowContext({
        allowWhileXmindMirror: true,
        render: false,
        persist: false,
        restoreInputs: true,
        inputsOnly: true,
      });
    }

    function shouldSyncLegacyBeforeOpen() {
      var state = getHostState() || {};
      if (String(state.activeTab || '') !== 'casesgen') return true;
      return getActiveCaseGenView(state) !== 'xmind-modules';
    }

    function shouldXmindOwnLiveWorkspaceState() {
      if (isDrawerOpen()) return true;
      var state = getHostState() || {};
      if (String(state.activeTab || '') !== 'casesgen') return false;
      return getActiveCaseGenView(state) === 'xmind-modules';
    }

    function shouldUseShadowWorkspaceContext(targetWorkspaceId) {
      var targetId = String(targetWorkspaceId || '');
      if (!targetId) return false;
      var currentWorkspaceId = String(getActiveWorkspaceId() || '');
      if (!currentWorkspaceId || targetId !== currentWorkspaceId) return true;
      return !shouldXmindOwnLiveWorkspaceState();
    }

    function getWorkspaceShadowDepth() {
      return workspaceShadowDepth;
    }

    function setWorkspaceShadowDepth(value) {
      workspaceShadowDepth = normalizeDepth(value);
      return workspaceShadowDepth;
    }

    function getWorkspaceUiMutedDepth() {
      return workspaceUiMutedDepth;
    }

    function setWorkspaceUiMutedDepth(value) {
      workspaceUiMutedDepth = normalizeDepth(value);
      return workspaceUiMutedDepth;
    }

    function getShadowWorkspaceSharedState() {
      return shadowWorkspaceSharedState;
    }

    function setShadowWorkspaceSharedState(value) {
      shadowWorkspaceSharedState = value || null;
      return shadowWorkspaceSharedState;
    }

    return {
      finalizeLegacyWorkflowRestore: finalizeLegacyWorkflowRestore,
      getShadowWorkspaceSharedState: getShadowWorkspaceSharedState,
      getWorkspaceShadowDepth: getWorkspaceShadowDepth,
      getWorkspaceUiMutedDepth: getWorkspaceUiMutedDepth,
      restoreLegacyWorkflowContext: restoreLegacyWorkflowContext,
      setShadowWorkspaceSharedState: setShadowWorkspaceSharedState,
      setWorkspaceShadowDepth: setWorkspaceShadowDepth,
      setWorkspaceUiMutedDepth: setWorkspaceUiMutedDepth,
      shouldSyncLegacyBeforeOpen: shouldSyncLegacyBeforeOpen,
      shouldUseShadowWorkspaceContext: shouldUseShadowWorkspaceContext,
      shouldXmindOwnLiveWorkspaceState: shouldXmindOwnLiveWorkspaceState,
      syncLegacyWorkflowContext: syncLegacyWorkflowContext,
    };
  }

  return { create: create };
});
