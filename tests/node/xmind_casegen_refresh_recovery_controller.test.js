'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenRefreshRecoveryController.js'
);
var factory = require(ownerPath);

function createHarness(options) {
  var config = options || {};
  var clock = 1000;
  var timerId = 0;
  var timers = {};
  var drawerOpen = config.drawerOpen === true;
  var hostState = { activeWorkspaceId: config.activeWorkspaceId || 'workspace-a' };
  var debugEntries = [];
  var calls = { apply: 0, reconcile: [], hydrate: 0, open: 0 };
  var records = config.records || {};
  var tasks = config.tasks || [];
  var controller = factory.create({
    state: { activeTab: config.activeTab || 'casesgen' },
    retryLimit: 3,
    getViewState: function() { return config.viewState || {}; },
    getActiveWorkspaceId: function() { return hostState.activeWorkspaceId; },
    getWorkspaceRecord: function(workspaceId) { return records[workspaceId] || null; },
    listManagedTasks: function() { return tasks; },
    isTaskTerminal: function(task) { return task && task.status === 'completed'; },
    filterTasksByWorkspace: function(list, workspaceId) {
      return list.filter(function(task) { return task.workspaceId === workspaceId; });
    },
    isDrawerOpen: function() { return drawerOpen; },
    openDrawer: function() { calls.open += 1; drawerOpen = true; },
    applyPendingSuspendViewStateCache: function() { calls.apply += 1; },
    reconcileManagedTasks: function(payload) { calls.reconcile.push(payload); },
    ensureWorkspaceHostState: function() { return hostState; },
    ensureActiveWorkspaceHydrated: function() { calls.hydrate += 1; },
    setDebugState: function(payload) { debugEntries.push(payload); },
    setTimer: function(handler, delay) {
      timerId += 1;
      timers[timerId] = { handler: handler, delay: delay };
      return timerId;
    },
    clearTimer: function(id) { delete timers[id]; },
    now: function() { return clock; },
  });
  return {
    calls: calls,
    controller: controller,
    debugEntries: debugEntries,
    hostState: hostState,
    advance: function(duration) { clock += duration; },
    runNextTimer: function() {
      var ids = Object.keys(timers);
      assert.ok(ids.length, 'expected a scheduled timer');
      var id = Number(ids[0]);
      var timer = timers[id];
      delete timers[id];
      timer.handler();
      return timer.delay;
    },
  };
}

var empty = createHarness();
empty.controller.restoreAfterWorkflowReady();
assert.strictEqual(empty.calls.apply, 1);
assert.strictEqual(empty.calls.reconcile.length, 1);
assert.strictEqual(empty.calls.hydrate, 1);
assert.strictEqual(empty.controller.hasRetryTimer(), false);

var snapshotRestore = createHarness({
  records: {
    'workspace-a': { snapshot: { xmind: { viewState: { drawerOpen: true } } } },
  },
});
assert.strictEqual(snapshotRestore.controller.hasRestoreIntent(), true);
snapshotRestore.controller.restoreAfterWorkflowReady();
assert.strictEqual(snapshotRestore.controller.hasRetryTimer(), true);
assert.strictEqual(snapshotRestore.runNextTimer(), 120);
assert.strictEqual(snapshotRestore.calls.open, 1);
assert.strictEqual(snapshotRestore.controller.hasRetryTimer(), true);
assert.strictEqual(snapshotRestore.runNextTimer(), 220);
assert.strictEqual(snapshotRestore.controller.hasRetryTimer(), false);

var taskRestore = createHarness({
  activeWorkspaceId: 'workspace-a',
  tasks: [{
    workspaceId: 'workspace-b',
    status: 'running',
    restoreContext: {
      workspaceId: 'workspace-b',
      viewState: { drawerOpen: true },
    },
  }],
});
assert.strictEqual(taskRestore.controller.getRestoreWorkspaceId(), 'workspace-b');
assert.strictEqual(taskRestore.controller.hasManagedTaskRestoreContextForWorkspace('workspace-b'), true);
taskRestore.controller.restoreAfterWorkflowReady();
assert.strictEqual(taskRestore.hostState.mirrorWorkspaceId, 'workspace-b');
assert.strictEqual(taskRestore.hostState.activeWorkspaceId, 'workspace-b');

var suppressed = createHarness({ viewState: { drawerOpen: true } });
suppressed.controller.markManualCloseSuppressed(500);
assert.strictEqual(suppressed.controller.isManualCloseSuppressed(), true);
assert.strictEqual(suppressed.controller.shouldRestoreAfterRefresh(), false);
suppressed.advance(500);
assert.strictEqual(suppressed.controller.isManualCloseSuppressed(), false);
assert.strictEqual(suppressed.controller.shouldRestoreAfterRefresh(), true);

var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
var ownerSource = fs.readFileSync(ownerPath, 'utf8');
[
  'hasRestoreIntent',
  'getRestoreWorkspaceId',
  'hasManagedTaskRestoreContextForWorkspace',
  'shouldRestoreAfterRefresh',
  'scheduleRetry',
  'restoreAfterWorkflowReady',
].forEach(function(name) {
  var signature = new RegExp('function\\s+' + name + '\\s*\\(');
  assert.match(ownerSource, signature, name + ' must belong to refresh recovery controller');
});

['index.html', 'ai-workflow.html'].forEach(function(fileName) {
  var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
  var ownerIndex = html.indexOf('xmindCasegenRefreshRecoveryController.js');
  var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
  assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load refresh recovery first');
});

console.log('xmind casegen refresh recovery controller tests passed');
