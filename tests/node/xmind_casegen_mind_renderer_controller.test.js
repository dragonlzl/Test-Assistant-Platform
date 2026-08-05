const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ownerPath = '../../scripts/modules/xmindCasegen/xmindCasegenMindRendererController.js';
const repoRoot = path.resolve(__dirname, '../..');

function createClassList(initial) {
  const values = {};
  (initial || []).forEach(function(name) { values[name] = true; });
  return {
    add: function() {
      Array.prototype.forEach.call(arguments, function(name) { values[name] = true; });
    },
    remove: function() {
      Array.prototype.forEach.call(arguments, function(name) { delete values[name]; });
    },
    contains: function(name) { return values[name] === true; },
    values: values,
  };
}

function createElement(tagName) {
  const attributes = {};
  const children = [];
  return {
    tagName: String(tagName || 'span').toUpperCase(),
    className: '',
    classList: createClassList(),
    attributes: attributes,
    children: children,
    parentNode: null,
    textContent: '',
    title: '',
    appendChild: function(child) {
      child.parentNode = this;
      children.push(child);
    },
    removeChild: function(child) {
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
      child.parentNode = null;
    },
    setAttribute: function(name, value) { attributes[name] = String(value); },
    removeAttribute: function(name) { delete attributes[name]; },
    querySelector: function() { return null; },
    closest: function() { return null; },
  };
}

function createHarness(factory, overrides) {
  const config = Object.assign({
    shadowDepth: 0,
    drawerOpen: true,
    activeWorkspace: true,
    restorePending: false,
  }, overrides || {});
  const mindContainer = createElement('div');
  mindContainer.innerHTML = '';
  const toolbar = createElement('div');
  toolbar.hidden = false;
  let mindInstance = null;
  let currentMindData = null;
  let restoreInFlight = false;
  const calls = {
    persists: [],
    debug: [],
    summary: 0,
    retry: [],
    invalidates: 0,
    destroys: 0,
    cleanup: 0,
    restoreInline: 0,
    renderMindMap: [],
    mountInline: 0,
    syncDelete: 0,
    bindTopup: 0,
    bindView: 0,
    syncTopup: 0,
    centers: [],
    searchRestores: [],
    setInstances: [],
    setMindData: [],
  };
  const mindData = { nodeData: { id: 'root-login', topic: '登录需求' } };
  const nextInstance = { id: 'mind-instance' };
  const coreApi = {
    renderMindMap: function(container, data, options) {
      calls.renderMindMap.push({ container: container, data: data, options: options });
      return nextInstance;
    },
  };
  const controller = factory.create({
    mindContainer: mindContainer,
    toolbarEl: toolbar,
    document: { createElement: createElement },
    escapeHtml: function(value) { return String(value || ''); },
    normalizeModuleKey: function(value) { return String(value || '').toLowerCase(); },
    isDeleteNodeType: function(type) { return type === 'case'; },
    buildDeleteTargetKey: function(meta) { return 'case::' + String(meta.caseSignature || ''); },
    isInvalidStoreModuleMeta: function(meta) { return meta.invalid === true; },
    isInvalidStoreCaseMeta: function(meta) { return meta.invalid === true; },
    getTopupHighlightMapElement: function() { return null; },
    getTopupHighlightViewerElement: function() { return null; },
    setTimer: function(handler) { handler(); return 1; },
    cleanupTopupHighlightPresentation: function() { calls.cleanup += 1; },
    restoreInlineControlsToBank: function() { calls.restoreInline += 1; },
    getWorkspaceShadowDepth: function() { return config.shadowDepth; },
    persistXmindState: function(immediate) { calls.persists.push(immediate); },
    setDebugState: function(value) { calls.debug.push(value); },
    updateSummary: function() { calls.summary += 1; },
    isDrawerOpen: function() { return config.drawerOpen; },
    shouldRestoreDrawerAfterRefresh: function() { return config.restorePending; },
    hasDrawerRestoreRetryTimer: function() { return false; },
    scheduleDrawerRestoreRetry: function(delay) { calls.retry.push(delay); },
    getViewState: function() { return { fullscreen: false }; },
    hasActiveWorkspace: function() { return config.activeWorkspace; },
    invalidateWorkspaceViewRestore: function() { calls.invalidates += 1; },
    destroyMind: function() { calls.destroys += 1; mindInstance = null; currentMindData = null; },
    captureMindSearchStateForRender: function() { return { query: 'login' }; },
    normalizeWorkspaceRenderViewState: function(value) { return value || null; },
    getRestorableViewState: function() { return null; },
    ensureState: function() { return { treeSourceSignature: 'tree-v1' }; },
    getRestorableDrawerState: function() { return null; },
    getRestoreDrawerOpenInFlight: function() { return restoreInFlight; },
    setRestoreDrawerOpenInFlight: function(value) { restoreInFlight = value === true; },
    getMindInstance: function() { return mindInstance; },
    setMindInstance: function(value) { mindInstance = value; calls.setInstances.push(value); },
    setCurrentMindData: function(value) { currentMindData = value; calls.setMindData.push(value); },
    buildMindData: function() { return mindData; },
    getMindElixirCoreApi: function() { return coreApi; },
    isMindElixirReady: function(api) { return Boolean(api && typeof api.renderMindMap === 'function'); },
    ensureMindElixirCoreApiReady: function() { return Promise.resolve(coreApi); },
    getRootNodeId: function() { return 'root-login'; },
    exportCurrentXmind: function() {},
    getNodeActions: function() { return []; },
    handleNodeAction: function() {},
    handleDeleteSelection: function() {},
    scheduleTopupHighlightSync: function() {},
    markManualViewportInteraction: function() {},
    persistViewportActionViewState: function() {},
    scheduleLightweightViewportCapture: function() {},
    scheduleCaptureCurrentViewState: function() {},
    mountInlineControls: function() { calls.mountInline += 1; },
    syncDeleteHistoryButtons: function() { calls.syncDelete += 1; },
    bindTopupHighlightPresentation: function() { calls.bindTopup += 1; },
    bindLiveViewStateCapture: function() { calls.bindView += 1; },
    syncTopupHighlightPresentation: function() { calls.syncTopup += 1; },
    centerRootNodeView: function(options) { calls.centers.push(options); },
    scheduleWorkspaceViewRestore: function() {},
    getActiveWorkspaceId: function() { return 'workspace-1'; },
    restoreMindSearchStateAfterRender: function(value) { calls.searchRestores.push(value); },
  });
  return {
    controller: controller,
    mindContainer: mindContainer,
    toolbar: toolbar,
    calls: calls,
    getMindInstance: function() { return mindInstance; },
    getCurrentMindData: function() { return currentMindData; },
  };
}

function verifyNodeDecoration(factory) {
  const harness = createHarness(factory);
  const node = createElement('me-tpc');
  const leftBranch = { classList: createClassList(['lhs']) };
  node.closest = function(selector) { return selector === 'me-main' ? leftBranch : null; };
  harness.controller.decorateNodeElement(node, {
    meta: {
      type: 'module',
      moduleKey: 'login',
      nodeId: 'module-login',
      status: 'running',
      statusLabel: '生成中',
      hasPendingBranch: true,
      topupHighlightToken: 'topup-1',
      topupHighlightLabel: '本轮追加',
      topupHighlightScope: 'cases',
      invalid: true,
    },
  });
  assert.strictEqual(node.classList.contains('xmind-casegen-node-module'), true);
  assert.strictEqual(node.classList.contains('xmind-casegen-node-flow-left'), true);
  assert.strictEqual(node.classList.contains('xmind-casegen-node-has-pending-branch'), true);
  assert.strictEqual(node.classList.contains('xmind-casegen-node-status-running'), true);
  assert.strictEqual(node.classList.contains('xmind-casegen-node-invalid'), true);
  assert.strictEqual(node.attributes['data-xmind-node-id'], 'module-login');
  assert.strictEqual(node.attributes['data-xmind-select-group'], 'module::login');
  assert.strictEqual(node.attributes['data-xmind-topup-highlight-token'], 'topup-1');
  assert.strictEqual(node.children.length, 1);
  assert.match(node.children[0].className, /xmind-node-status-badge/);

  const caseNode = createElement('me-tpc');
  harness.controller.decorateNodeElement(caseNode, {
    meta: { type: 'case', caseSignature: 'login-success', invalid: true },
  });
  assert.strictEqual(caseNode.attributes['data-xmind-select-group'], 'case::login-success');
  assert.strictEqual(caseNode.classList.contains('xmind-casegen-node-invalid'), true);

  const pending = createElement('me-tpc');
  harness.controller.decorateNodeElement(pending, { meta: { type: 'topup-placeholder' } });
  assert.strictEqual(pending.classList.contains('xmind-casegen-node-topup-placeholder'), true);
  assert.strictEqual(pending.children[0].className, 'xmind-node-topup-spinner');

  const pendingPath = createElement('path');
  harness.mindContainer.querySelectorAll = function() { return [pendingPath]; };
  assert.strictEqual(harness.controller.markDashedConnectorLink(pending, 'topup-pending'), true);
  assert.strictEqual(pendingPath.classList.contains('xmind-casegen-pending-link'), true);
  assert.strictEqual(pendingPath.attributes['data-xmind-casegen-link'], 'topup-pending');

  const errorNode = createElement('me-tpc');
  harness.controller.decorateNodeElement(errorNode, {
    meta: {
      type: 'root',
      nodeId: 'root-error',
      status: 'error',
      statusText: '生成失败详情',
    },
  });
  assert.strictEqual(errorNode.classList.contains('xmind-casegen-node-status-error'), true);
  assert.strictEqual(errorNode.children[0].textContent, '');
  assert.strictEqual(errorNode.children[0].children[0].textContent, '失败');
  assert.strictEqual(errorNode.children[0].title, '生成失败详情');
}

function verifyEmptyAndGuardedRender(factory) {
  const emptyHarness = createHarness(factory, { activeWorkspace: false });
  emptyHarness.controller.render({ reason: 'empty' });
  assert.strictEqual(emptyHarness.calls.destroys, 1);
  assert.strictEqual(emptyHarness.toolbar.hidden, true);
  assert.match(emptyHarness.mindContainer.innerHTML, /暂无生成页签/);
  assert.deepStrictEqual(emptyHarness.calls.persists, [false]);

  const shadowHarness = createHarness(factory, { shadowDepth: 1 });
  shadowHarness.controller.render({ reason: 'shadow' });
  assert.strictEqual(shadowHarness.calls.summary, 0);
  assert.deepStrictEqual(shadowHarness.calls.persists, [false]);

  const closedHarness = createHarness(factory, { drawerOpen: false, restorePending: true });
  closedHarness.controller.render({ reason: 'closed' });
  assert.deepStrictEqual(closedHarness.calls.retry, [120]);
  assert.strictEqual(closedHarness.calls.renderMindMap.length, 0);
}

function verifyMindRenderLifecycle(factory) {
  const harness = createHarness(factory);
  harness.controller.render({
    reason: 'contract',
    centerRootAfterRender: true,
    skipRestorableViewState: true,
  });
  assert.strictEqual(harness.calls.renderMindMap.length, 1);
  const renderCall = harness.calls.renderMindMap[0];
  assert.strictEqual(renderCall.container, harness.mindContainer);
  assert.strictEqual(renderCall.data.nodeData.topic, '登录需求');
  assert.strictEqual(renderCall.options.initialCenterNodeId, 'root-login');
  assert.strictEqual(renderCall.options.eagerInitialCenter, true);
  assert.strictEqual(renderCall.options.preserveViewState, false);
  assert.strictEqual(typeof renderCall.options.decorateNodeElement, 'function');
  assert.strictEqual(harness.getMindInstance().id, 'mind-instance');
  assert.strictEqual(harness.getCurrentMindData().nodeData.id, 'root-login');
  assert.strictEqual(harness.calls.mountInline, 1);
  assert.strictEqual(harness.calls.syncDelete, 1);
  assert.strictEqual(harness.calls.bindTopup, 1);
  assert.strictEqual(harness.calls.bindView, 1);
  assert.strictEqual(harness.calls.syncTopup, 1);
  assert.deepStrictEqual(harness.calls.centers, [{ persist: true, retryLimit: 7, retryDelayMs: 70 }]);
  assert.deepStrictEqual(harness.calls.searchRestores, [{ query: 'login' }]);
  assert.strictEqual(harness.calls.debug[harness.calls.debug.length - 1].phase, 'render-success');
}

function verifyOwnershipAndLoadOrder() {
  const parentSource = fs.readFileSync(path.join(repoRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  const ownerSource = fs.readFileSync(
    path.join(repoRoot, 'scripts/modules/xmindCasegen/xmindCasegenMindRendererController.js'),
    'utf8'
  );
  [
    'findConnectorSvgPaths',
    'markDashedConnectorLink',
    'decorateNodeElement',
    'renderEmptyWorkspaceState',
    'render',
  ].forEach(function(functionName) {
    const signature = new RegExp('function\\s+' + functionName + '\\s*\\(');
    assert.match(ownerSource, signature, functionName + ' must belong to the mind renderer owner');
    assert.doesNotMatch(parentSource, signature, functionName + ' must not remain in xmindCasegen.js');
  });
  assert.match(parentSource, /xmindCasegenMindRendererController/);
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    const html = fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
    const ownerIndex = html.indexOf('xmindCasegenMindRendererController.js');
    const parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the mind renderer owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the mind renderer owner before xmindCasegen.js');
  });
}

function run() {
  const factory = require(ownerPath);
  verifyNodeDecoration(factory);
  verifyEmptyAndGuardedRender(factory);
  verifyMindRenderLifecycle(factory);
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen mind renderer controller tests passed');
}

run();
