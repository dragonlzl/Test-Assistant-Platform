'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenWorkspaceContextBridge.js'
);
var bridgeFactory = require(ownerPath);

function createHarness(options) {
  var values = options || {};
  var state = values.state || {};
  var casesGenApi = values.casesGenApi || null;
  var activeWorkspaceId = values.activeWorkspaceId || '';
  var drawerOpen = values.drawerOpen === true;
  var bridge = bridgeFactory.create({
    getHostState: function() { return state; },
    getCasesGenApi: function() { return casesGenApi; },
    getActiveWorkspaceId: function() { return activeWorkspaceId; },
    isDrawerOpen: function() { return drawerOpen; },
  });
  return {
    bridge: bridge,
    setActiveWorkspaceId: function(value) { activeWorkspaceId = String(value || ''); },
    setCasesGenApi: function(value) { casesGenApi = value || null; },
    setDrawerOpen: function(value) { drawerOpen = value === true; },
    state: state,
  };
}

function verifyLateLegacyApiDelegation() {
  var calls = [];
  var harness = createHarness();
  assert.strictEqual(harness.bridge.syncLegacyWorkflowContext(), false);
  assert.strictEqual(harness.bridge.restoreLegacyWorkflowContext(), false);

  harness.setCasesGenApi({
    syncLegacyCaseGenState: function(options) { calls.push(['sync', options]); },
    restoreLegacyCaseGenState: function(options) { calls.push(['restore', options]); },
  });
  assert.strictEqual(harness.bridge.syncLegacyWorkflowContext(), true);
  assert.deepStrictEqual(calls[0], ['sync', { persist: false, force: true }]);
  assert.strictEqual(harness.bridge.syncLegacyWorkflowContext({ persist: true, force: false }), true);
  assert.deepStrictEqual(calls[1], ['sync', { persist: true, force: false }]);

  assert.strictEqual(harness.bridge.restoreLegacyWorkflowContext({
    allowWhileXmindMirror: 1,
    render: true,
    persist: false,
    restoreInputs: false,
    inputsOnly: true,
  }), true);
  assert.deepStrictEqual(calls[2], ['restore', {
    allowWhileXmindMirror: false,
    render: true,
    persist: false,
    restoreInputs: false,
    inputsOnly: true,
  }]);

  assert.strictEqual(harness.bridge.finalizeLegacyWorkflowRestore(), true);
  assert.deepStrictEqual(calls[3], ['restore', {
    allowWhileXmindMirror: true,
    render: false,
    persist: false,
    restoreInputs: true,
    inputsOnly: true,
  }]);
}

function verifyWorkspaceOwnershipRules() {
  var harness = createHarness({
    state: { activeTab: 'review', caseGenSettings: { activeTab: 'settings' } },
    activeWorkspaceId: 'workspace-1',
  });
  assert.strictEqual(harness.bridge.shouldSyncLegacyBeforeOpen(), true);
  assert.strictEqual(harness.bridge.shouldXmindOwnLiveWorkspaceState(), false);

  harness.state.activeTab = 'casesgen';
  harness.state.caseGenSettings.activeTab = 'modules';
  assert.strictEqual(harness.bridge.shouldSyncLegacyBeforeOpen(), false);
  assert.strictEqual(harness.bridge.shouldXmindOwnLiveWorkspaceState(), true);
  assert.strictEqual(harness.bridge.shouldUseShadowWorkspaceContext('workspace-1'), false);

  harness.state.caseGenSettings.activeTab = 'legacy-modules';
  assert.strictEqual(harness.bridge.shouldSyncLegacyBeforeOpen(), true);
  assert.strictEqual(harness.bridge.shouldXmindOwnLiveWorkspaceState(), false);
  assert.strictEqual(harness.bridge.shouldUseShadowWorkspaceContext('workspace-1'), true);
  assert.strictEqual(harness.bridge.shouldUseShadowWorkspaceContext('workspace-2'), true);
  assert.strictEqual(harness.bridge.shouldUseShadowWorkspaceContext(''), false);

  harness.setDrawerOpen(true);
  assert.strictEqual(harness.bridge.shouldXmindOwnLiveWorkspaceState(), true);
  assert.strictEqual(harness.bridge.shouldUseShadowWorkspaceContext('workspace-1'), false);
  harness.setDrawerOpen(false);
  harness.setActiveWorkspaceId('');
  assert.strictEqual(harness.bridge.shouldUseShadowWorkspaceContext('workspace-1'), true);
}

function verifyShadowContextState() {
  var harness = createHarness();
  assert.strictEqual(harness.bridge.getWorkspaceShadowDepth(), 0);
  assert.strictEqual(harness.bridge.getWorkspaceUiMutedDepth(), 0);
  assert.strictEqual(harness.bridge.getShadowWorkspaceSharedState(), null);

  harness.bridge.setWorkspaceShadowDepth('3');
  harness.bridge.setWorkspaceUiMutedDepth(-2);
  var sharedState = { customRequirement: '登录需求' };
  harness.bridge.setShadowWorkspaceSharedState(sharedState);
  assert.strictEqual(harness.bridge.getWorkspaceShadowDepth(), 3);
  assert.strictEqual(harness.bridge.getWorkspaceUiMutedDepth(), 0);
  assert.strictEqual(harness.bridge.getShadowWorkspaceSharedState(), sharedState);

  harness.bridge.setWorkspaceShadowDepth('invalid');
  harness.bridge.setShadowWorkspaceSharedState(0);
  assert.strictEqual(harness.bridge.getWorkspaceShadowDepth(), 0);
  assert.strictEqual(harness.bridge.getShadowWorkspaceSharedState(), null);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var drawerSource = fs.readFileSync(path.join(
    projectRoot,
    'scripts/modules/xmindCasegen/xmindCasegenDrawerSessionController.js'
  ), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'syncLegacyWorkflowContext',
    'restoreLegacyWorkflowContext',
    'finalizeLegacyWorkflowRestore',
    'shouldSyncLegacyBeforeOpen',
    'shouldXmindOwnLiveWorkspaceState',
    'shouldUseShadowWorkspaceContext',
  ].forEach(function(name) {
    var signature = new RegExp('function\\s+' + name + '\\s*\\(');
    assert.match(ownerSource, signature, name + ' must belong to workspace context bridge');
    assert.doesNotMatch(parentSource, signature, name + ' must leave xmindCasegen.js');
  });
  assert.doesNotMatch(parentSource, /drawerLegacyRestoreSnapshot/);
  assert.doesNotMatch(parentSource, /var\s+workspaceShadowDepth\s*=/);
  assert.doesNotMatch(parentSource, /var\s+workspaceUiMutedDepth\s*=/);
  assert.doesNotMatch(parentSource, /var\s+shadowWorkspaceSharedState\s*=/);
  assert.doesNotMatch(parentSource, /\bworkspaceShadowDepth\b/);
  assert.doesNotMatch(parentSource, /\bworkspaceUiMutedDepth\b/);
  assert.doesNotMatch(parentSource, /\bshadowWorkspaceSharedState\b/);
  assert.doesNotMatch(drawerSource, /captureDrawerLegacyRestoreSnapshot/);
  assert.match(parentSource, /workspaceContextBridgeFactory\.create\(\{/);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenWorkspaceContextBridge.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load workspace context bridge first');
  });
}

verifyLateLegacyApiDelegation();
verifyWorkspaceOwnershipRules();
verifyShadowContextState();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen workspace context bridge tests passed');
