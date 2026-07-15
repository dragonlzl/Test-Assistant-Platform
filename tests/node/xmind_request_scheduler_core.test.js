'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var context = vm.createContext({
  window: { app: {} },
  Promise: Promise,
  Math: Math,
  Number: Number,
  Object: Object,
  Array: Array,
  String: String,
});
var source = fs.readFileSync(path.join(projectRoot, 'scripts/core/xmindRequestSchedulerCore.js'), 'utf8');
vm.runInContext(source, context, { filename: 'scripts/core/xmindRequestSchedulerCore.js' });

var core = context.window.app.xmindRequestSchedulerCore;

function wait(delayMs) {
  return new Promise(function(resolve) {
    setTimeout(resolve, delayMs);
  });
}

async function verifyWorkspaceIsolation() {
  var scheduler = core.createScheduler({ maxConcurrentPerWorkspace: 5 });
  var workspaceIds = ['a', 'b', 'c'];
  var activeByWorkspace = { a: 0, b: 0, c: 0 };
  var peakByWorkspace = { a: 0, b: 0, c: 0 };
  var totalActive = 0;
  var totalPeak = 0;
  var jobs = [];

  function run(workspaceId, index) {
    var requestKey = workspaceId + '-request-' + String(index);
    return scheduler.acquire({
      workspaceId: workspaceId,
      requestKey: requestKey,
      taskId: workspaceId + '-task-' + String(index),
    }).then(function(granted) {
      assert.strictEqual(granted, true);
      activeByWorkspace[workspaceId] += 1;
      totalActive += 1;
      peakByWorkspace[workspaceId] = Math.max(peakByWorkspace[workspaceId], activeByWorkspace[workspaceId]);
      totalPeak = Math.max(totalPeak, totalActive);
      return wait(20).then(function() {
        activeByWorkspace[workspaceId] -= 1;
        totalActive -= 1;
        assert.strictEqual(scheduler.release({
          workspaceId: workspaceId,
          requestKey: requestKey,
        }), true);
      });
    });
  }

  for (var index = 0; index < 12; index += 1) {
    workspaceIds.forEach(function(workspaceId) {
      jobs.push(run(workspaceId, index));
    });
  }
  await Promise.all(jobs);
  assert.deepStrictEqual(peakByWorkspace, { a: 5, b: 5, c: 5 });
  assert.strictEqual(totalPeak, 15);
  assert.strictEqual(scheduler.getSnapshot().length, 0);
}

async function verifyFifoAndCancellation() {
  var scheduler = core.createScheduler({ maxConcurrentPerWorkspace: 1 });
  var grantedOrder = [];
  var first = scheduler.acquire({
    workspaceId: 'workspace-fifo',
    requestKey: 'request-1',
    taskId: 'task-1',
  }).then(function(granted) {
    if (granted) grantedOrder.push('request-1');
    return granted;
  });
  var cancelled = scheduler.acquire({
    workspaceId: 'workspace-fifo',
    requestKey: 'request-2',
    taskId: 'task-2',
  });
  var third = scheduler.acquire({
    workspaceId: 'workspace-fifo',
    requestKey: 'request-3',
    taskId: 'task-3',
  }).then(function(granted) {
    if (granted) grantedOrder.push('request-3');
    return granted;
  });

  assert.strictEqual(await first, true);
  assert.strictEqual(scheduler.hasTask('task-1'), true);
  assert.strictEqual(scheduler.cancelTask('task-2'), 1);
  assert.strictEqual(await cancelled, false);
  assert.strictEqual(scheduler.release({
    workspaceId: 'workspace-fifo',
    requestKey: 'request-1',
  }), true);
  assert.strictEqual(await third, true);
  assert.deepStrictEqual(grantedOrder, ['request-1', 'request-3']);
  assert.strictEqual(scheduler.release({
    workspaceId: 'workspace-fifo',
    requestKey: 'request-3',
  }), true);
}

async function verifyTaskBatchCancellationAndClear() {
  var scheduler = core.createScheduler({ maxConcurrentPerWorkspace: 1 });
  assert.strictEqual(await scheduler.acquire({
    workspaceId: 'workspace-batch',
    requestKey: 'blocker',
    taskId: 'blocker-task',
  }), true);
  var batchOne = scheduler.acquire({
    workspaceId: 'workspace-batch',
    requestKey: 'dedupe:0',
    taskId: 'dedupe-task',
  });
  var batchTwo = scheduler.acquire({
    workspaceId: 'workspace-batch',
    requestKey: 'dedupe:1',
    taskId: 'dedupe-task',
  });
  var other = scheduler.acquire({
    workspaceId: 'workspace-batch',
    requestKey: 'other',
    taskId: 'other-task',
  });

  assert.strictEqual(scheduler.cancelTask('dedupe-task'), 2);
  assert.deepStrictEqual(await Promise.all([batchOne, batchTwo]), [false, false]);
  assert.strictEqual(scheduler.hasTask('dedupe-task'), false);
  assert.strictEqual(scheduler.clearQueued(), 1);
  assert.strictEqual(await other, false);
  assert.strictEqual(scheduler.cancelTask('blocker-task'), 0);
  assert.strictEqual(scheduler.hasTask('blocker-task'), true);
  assert.strictEqual(scheduler.release({
    workspaceId: 'workspace-batch',
    requestKey: 'blocker',
  }), true);
  assert.strictEqual(scheduler.hasTask('blocker-task'), false);
}

async function verifyLegacyWorkspaceFallback() {
  var scheduler = core.createScheduler({ maxConcurrentPerWorkspace: 1 });
  assert.strictEqual(await scheduler.acquire({
    workspaceId: '',
    requestKey: 'legacy-1',
    taskId: 'legacy-task-1',
  }), true);
  var queued = scheduler.acquire({
    requestKey: 'legacy-2',
    taskId: 'legacy-task-2',
  });
  var snapshot = scheduler.getSnapshot();
  assert.strictEqual(snapshot.length, 1);
  assert.strictEqual(snapshot[0].workspaceId, core.DEFAULT_WORKSPACE_ID);
  assert.strictEqual(snapshot[0].activeCount, 1);
  assert.strictEqual(snapshot[0].queuedCount, 1);
  assert.strictEqual(scheduler.release({
    workspaceId: '',
    requestKey: 'legacy-1',
  }), true);
  assert.strictEqual(await queued, true);
  assert.strictEqual(scheduler.release({
    requestKey: 'legacy-2',
  }), true);
}

Promise.resolve()
  .then(verifyWorkspaceIsolation)
  .then(verifyFifoAndCancellation)
  .then(verifyTaskBatchCancellationAndClear)
  .then(verifyLegacyWorkspaceFallback)
  .then(function() {
    console.log('xmind_request_scheduler_core.test.js passed');
  })
  .catch(function(err) {
    console.error(err);
    process.exitCode = 1;
  });
