'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var factory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenDrawerSessionController.js'
));

function createHarness() {
  var state = { caseGenSettings: { activeTab: 'settings' } };
  var viewState = { drawerOpen: false, fullscreen: false, updatedAt: 0 };
  var drawerOpen = false;
  var drawerInstance = null;
  var drawerOptions = null;
  var renderTimer = 0;
  var closeTimer = 0;
  var nextTimer = 1;
  var pending = {
    centerRoot: false,
    resetCanvas: false,
    instant: false,
    skipRestorable: false,
    forceHydrate: false,
    workspaceId: '',
    domRestore: false,
    restoreInFlight: false,
  };
  var calls = {
    beginHold: 0,
    hydrate: 0,
    persistClosed: [],
    render: [],
    resetCanvas: 0,
    syncOpen: 0,
  };
  var timers = {};

  var controller = factory.create({
    state: state,
    drawerEl: {
      classList: {
        remove: function() {},
      },
    },
    drawerTitleEl: { textContent: '' },
    drawerFullscreenPort: { set: function() { return true; } },
    drawerScrollLockPort: { release: function() {} },
    workspace: {
      getActiveWorkspaceId: function() { return 'workspace-1'; },
      getMirrorWorkspaceId: function() { return 'workspace-1'; },
      setMirrorWorkspaceSelection: function() {},
      hydrateWorkspaceSnapshot: function() { calls.hydrate += 1; return true; },
      hydrateActiveWorkspaceSnapshot: function() { calls.hydrate += 1; return true; },
      switchWorkspace: function() { return true; },
      persistXmindState: function() {},
    },
    view: {
      getViewState: function() { return viewState; },
      getWorkspaceStoredViewState: function() { return viewState; },
      clearWorkspaceFullscreenRestoreIntent: function() {},
      shouldRestoreWorkspaceViewport: function() { return false; },
      clearPendingOpenRenderHold: function() {},
      beginPendingOpenRenderHold: function() { calls.beginHold += 1; },
      releasePendingOpenRenderHold: function() {},
      persistDrawerClosedIntentState: function(immediate) { calls.persistClosed.push(immediate); },
      bindDrawerCloseIntentPersistence: function() {},
    },
    ui: {
      syncOpenButtonState: function() { calls.syncOpen += 1; },
      setDebugState: function() {},
      closeSummaryDialog: function() {},
      render: function(options) { calls.render.push(options); },
    },
    workflow: {
      createDefaultCaseGenSettings: function() { return { activeTab: 'settings' }; },
      setCasesGenModulesView: function() {},
      hasManagedTaskRestoreContextForWorkspace: function() { return false; },
      resetMindCanvasBeforeDrawerOpen: function() { calls.resetCanvas += 1; },
      clearDrawerRestoreRetry: function() {},
      clearStoreValidationState: function() {},
      isPageSuspending: function() { return false; },
      destroyMind: function() {},
      finalizeLegacyWorkflowRestore: function() {},
      flushDeferredCasesGenPageRender: function() {},
      persistWorkflowStateNow: function() {},
      isDrawerManualCloseSuppressed: function() { return false; },
      markDrawerManualCloseSuppressed: function() {},
      shouldSyncLegacyBeforeOpen: function() { return false; },
      syncLegacyWorkflowContext: function() {},
      captureDrawerLegacyRestoreSnapshot: function() {},
      clearOpenButtonCompletionNotice: function() {},
      switchTab: function() {},
    },
    environment: {
      getDrawerInstance: function() { return drawerInstance; },
      setDrawerInstance: function(value) { drawerInstance = value; },
      getDrawerOpenRenderTimer: function() { return renderTimer; },
      setDrawerOpenRenderTimer: function(value) { renderTimer = value; },
      getDeferredCloseTimer: function() { return closeTimer; },
      setDeferredCloseTimer: function(value) { closeTimer = value; },
      getPendingOpenCenterRoot: function() { return pending.centerRoot; },
      setPendingOpenCenterRoot: function(value) { pending.centerRoot = value; },
      getPendingOpenResetCanvas: function() { return pending.resetCanvas; },
      setPendingOpenResetCanvas: function(value) { pending.resetCanvas = value; },
      getPendingOpenInstant: function() { return pending.instant; },
      setPendingOpenInstant: function(value) { pending.instant = value; },
      getPendingOpenSkipRestorable: function() { return pending.skipRestorable; },
      setPendingOpenSkipRestorable: function(value) { pending.skipRestorable = value; },
      getPendingOpenForceHydrate: function() { return pending.forceHydrate; },
      setPendingOpenForceHydrate: function(value) { pending.forceHydrate = value; },
      getPendingDrawerWorkspaceId: function() { return pending.workspaceId; },
      setPendingDrawerWorkspaceId: function(value) { pending.workspaceId = value; },
      isDrawerOpenedViaDomRestore: function() { return pending.domRestore; },
      setDrawerOpenedViaDomRestore: function(value) { pending.domRestore = value; },
      isRestoreDrawerOpenInFlight: function() { return pending.restoreInFlight; },
      setRestoreDrawerOpenInFlight: function(value) { pending.restoreInFlight = value; },
      isDrawerOpen: function() { return drawerOpen; },
      createDrawer: function(options) {
        drawerOptions = options;
        return {
          open: function() {
            drawerOpen = true;
            options.onOpen();
          },
          close: function() {
            drawerOpen = false;
            options.onClose();
          },
        };
      },
    },
    setTimeout: function(handler) {
      var id = nextTimer;
      nextTimer += 1;
      timers[id] = handler;
      return id;
    },
    clearTimeout: function(id) { delete timers[id]; },
    now: function() { return 1000; },
  });

  return {
    calls: calls,
    controller: controller,
    getDrawerOptions: function() { return drawerOptions; },
    getDrawerOpen: function() { return drawerOpen; },
    state: state,
    timers: timers,
    viewState: viewState,
  };
}

function verifyDrawerOpenCloseLifecycle() {
  var harness = createHarness();
  var first = harness.controller.ensureDrawer();
  assert.ok(first);
  assert.strictEqual(harness.controller.ensureDrawer(), first);
  assert.strictEqual(harness.getDrawerOptions().drawerId, 'xmindCaseGenDrawer');

  assert.strictEqual(harness.controller.open({ instant: true }), true);
  assert.strictEqual(harness.getDrawerOpen(), true);
  assert.strictEqual(harness.viewState.drawerOpen, true);
  assert.strictEqual(harness.state.caseGenSettings.activeTab, 'xmind-modules');
  assert.strictEqual(harness.calls.beginHold, 1);
  assert.ok(harness.calls.hydrate > 0);
  assert.ok(harness.calls.resetCanvas > 0);

  assert.strictEqual(harness.controller.close(), true);
  assert.strictEqual(harness.getDrawerOpen(), false);
  assert.deepStrictEqual(harness.calls.persistClosed, [true, false]);
}

function verifyOwnershipAndLoadOrder() {
  var ownerPath = path.join(
    projectRoot,
    'scripts/modules/xmindCasegen/xmindCasegenDrawerSessionController.js'
  );
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'setDrawerFullscreenState',
    'ensureDrawer',
    'openDrawerShell',
    'releaseDrawerOpenLayoutState',
    'finalizeDrawerClosedLifecycle',
    'open',
    'close',
  ].forEach(function(name) {
    assert.match(ownerSource, new RegExp('function ' + name + '\\('));
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must leave parent coordinator');
  });
  assert.match(parentSource, /drawerSessionControllerFactory\.create\(/);
  assert.ok(parentSource.split('\n').length <= 5000, 'xmindCasegen.js should stay at or below 5000 lines');
  assert.ok(ownerSource.split('\n').length <= 500, 'drawer session owner should stay at or below 500 lines');

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var drawerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenDrawerSessionController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(drawerIndex >= 0 && drawerIndex < parentIndex, fileName + ' must load drawer session before parent');
  });
}

verifyDrawerOpenCloseLifecycle();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen drawer session controller tests passed');
