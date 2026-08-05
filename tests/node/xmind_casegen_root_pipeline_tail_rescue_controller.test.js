'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenRootPipelineTailRescueController.js'
));

function createPipeline(overrides) {
  return Object.assign({
    id: 'pipeline-1',
    cancelled: false,
    dedupeStatus: '',
    pendingQueue: [],
    moduleTaskTotal: 3,
    moduleTaskCompleted: 2,
    detailMap: {
      fast: { durationMs: 800 },
      medium: { durationMs: 1200 },
      slow: { durationMs: 9999 },
    },
  }, overrides || {});
}

function createCandidate(overrides) {
  return Object.assign({
    id: 'task-slow',
    status: 'running',
    scope: 'module',
    rootPipelineId: 'pipeline-1',
    rootPipelineActionId: 'root-full-cases',
    moduleTitle: 'Slow',
    modelRequestStartedAt: 2000,
    requestMode: 'content',
    contentBlocks: [{ type: 'text', text: 'payload' }],
    fallbackCases: [{ title: '兜底用例' }],
  }, overrides || {});
}

function createHarness(options) {
  var harnessOptions = options || {};
  var pipeline = Object.prototype.hasOwnProperty.call(harnessOptions, 'pipeline')
    ? harnessOptions.pipeline
    : createPipeline();
  var candidate = harnessOptions.candidate || createCandidate();
  var tasks = harnessOptions.tasks || [candidate];
  var calls = {
    evaluations: [],
    failures: [],
  };
  var manager = {
    failTask: function(taskId, failure) {
      calls.failures.push({ taskId: taskId, failure: failure });
      return harnessOptions.failResult !== false;
    },
  };
  var timingCore = {
    evaluateTailRequest: function(input) {
      calls.evaluations.push(input);
      return harnessOptions.evaluation || {
        shouldRescue: true,
        elapsedMs: 3000,
        thresholdMs: 2500,
        timeoutMs: 300000,
        baselineMs: 1000,
        peerCount: 2,
      };
    },
  };
  var controller = controllerFactory.create({
    fullCasesActionId: 'root-full-cases',
    getTaskManager: function() { return harnessOptions.managerMissing === true ? null : manager; },
    getTimingCore: function() { return harnessOptions.timingCoreMissing === true ? null : timingCore; },
    listManagedTasks: function() { return tasks; },
    getRootPipelineState: function() { return pipeline; },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    normalizeHistoryDurationMs: function(value) { return Math.max(0, Number(value || 0) || 0); },
    normalizeRootPipelineTaskCount: function(value) { return Math.max(0, Number(value || 0) || 0); },
    normalizeFallbackCaseList: function(value) { return Array.isArray(value) ? value.slice() : []; },
    estimateTaskContentBlocksSize: function() { return 42; },
    getConfiguredTimeoutSec: function() { return 300; },
    now: function() { return 5000; },
  });
  return {
    calls: calls,
    candidate: candidate,
    controller: controller,
  };
}

function verifyEligibleTailRequestIsRescued() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.maybeRescue(harness.candidate), true);
  assert.deepStrictEqual(harness.calls.evaluations, [{
    timeoutMs: 300000,
    requestStartedAt: 2000,
    now: 5000,
    remainingCount: 1,
    fallbackCaseCount: 1,
    peerDurationsMs: [800, 1200],
  }]);
  assert.strictEqual(harness.calls.failures.length, 1);
  assert.strictEqual(harness.calls.failures[0].taskId, 'task-slow');
  assert.strictEqual(harness.calls.failures[0].failure.abortReason, 'xmind-casegen-tail-fallback');
  assert.strictEqual(harness.calls.failures[0].failure.meta.kind, 'root-module-tail-fallback');
  assert.strictEqual(harness.calls.failures[0].failure.meta.module, 'Slow');
  assert.strictEqual(harness.calls.failures[0].failure.meta.requestPayloadChars, 42);
}

function verifyRestoreSnapshotPipelineCanBeUsed() {
  var restoredPipeline = createPipeline();
  var candidate = createCandidate({
    restoreContext: { rootPipeline: restoredPipeline },
  });
  var harness = createHarness({
    pipeline: null,
    candidate: candidate,
  });
  assert.strictEqual(harness.controller.maybeRescue(candidate), true);
  assert.strictEqual(harness.calls.failures.length, 1);
}

function verifyEligibilityGuards() {
  var irrelevant = createHarness();
  assert.strictEqual(irrelevant.controller.maybeRescue({ scope: 'root', rootPipelineId: 'pipeline-1' }), false);
  assert.strictEqual(irrelevant.calls.evaluations.length, 0);

  var multipleCandidate = createCandidate({ id: 'task-peer', moduleTitle: 'Peer' });
  var multiple = createHarness({ tasks: [createCandidate(), multipleCandidate] });
  assert.strictEqual(multiple.controller.maybeRescue(multipleCandidate), false);

  var wrongActionCandidate = createCandidate({ rootPipelineActionId: 'root-full-modules' });
  var wrongAction = createHarness({ candidate: wrongActionCandidate });
  assert.strictEqual(wrongAction.controller.maybeRescue(wrongActionCandidate), false);

  var pending = createHarness({ pipeline: createPipeline({ pendingQueue: [{ module: '排队模块' }] }) });
  assert.strictEqual(pending.controller.maybeRescue(pending.candidate), false);

  var notSlow = createHarness({ evaluation: { shouldRescue: false } });
  assert.strictEqual(notSlow.controller.maybeRescue(notSlow.candidate), false);
  assert.strictEqual(notSlow.calls.failures.length, 0);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'resolveRootPipelineForManagedTask',
    'collectRootPipelinePeerDurations',
    'estimateManagedTaskRequestSize',
    'maybeRescueRootPipelineTailRequest',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by the tail rescue controller');
  });
  assert.ok(/rootPipelineTailRescueControllerFactory\.create\(/.test(parentSource));
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenRootPipelineTailRescueController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load the tail rescue controller first');
  });
}

verifyEligibleTailRequestIsRescued();
verifyRestoreSnapshotPipelineCanBeUsed();
verifyEligibilityGuards();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen root pipeline tail rescue controller tests passed');
