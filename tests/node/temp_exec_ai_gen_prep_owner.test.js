'use strict';

var assert = require('assert');
var prepOwner = require('../../scripts/modules/tempExecAiGenPrepOwner.js');

function createHarness() {
  var state = {
    tempExecActiveId: 'file-1',
    assignments: {
      caseLibraryGenReasoning: 'medium',
      caseLibraryGenTemperature: 0.4,
    },
  };
  var ai = {
    loading: false,
    generated: false,
    modules: [],
    error: '',
    resultToken: '',
    taskSignature: '',
    requirementText: '登录需求',
  };
  var reason = '';
  var currentTask = null;
  var prepResult = { ok: true, value: { requirementText: '准备后需求' } };
  var prepPayloads = [];
  var toasts = [];
  var runs = [];
  var drawerOpens = 0;
  var drawerCloses = 0;
  var badgeClears = 0;
  var discardCalls = [];
  var syncCalls = 0;
  var owner = prepOwner.create({
    state: state,
    api: {
      getTempExecFile: function(id) {
        if (String(id) !== 'file-1') return null;
        return {
          id: 'file-1',
          name: '登录用例',
          projectId: 7,
          versionId: 8,
          cases: [{ title: '登录成功' }],
        };
      },
    },
    view: {
      openDrawer: function() { drawerOpens += 1; },
      closeDrawer: function() { drawerCloses += 1; },
      getDrawerReference: function() { return { id: 'drawer' }; },
    },
    toolbar: {
      resolveDisabledReason: function() { return reason; },
      clearResultBadge: function() { badgeClears += 1; },
    },
    taskState: {
      getCurrentTask: function() { return currentTask; },
      syncTaskState: function() { return Boolean(currentTask); },
    },
    getState: function() { return ai; },
    getPrepApi: function() {
      return {
        open: function(payload) {
          prepPayloads.push(payload);
          return Promise.resolve(prepResult);
        },
      };
    },
    getAssignedModel: function() { return { id: 'model-1' }; },
    getRequirementText: function() { return '输入框需求'; },
    syncContext: function() { syncCalls += 1; },
    discardResult: function(options) { discardCalls.push(options); },
    run: function(value) { runs.push(value); },
    showToast: function(text, type) { toasts.push([text, type]); },
    openConfirmDrawer: function() { return Promise.resolve({ ok: true }); },
  });
  return {
    state: state,
    ai: ai,
    owner: owner,
    prepPayloads: prepPayloads,
    toasts: toasts,
    runs: runs,
    discardCalls: discardCalls,
    setReason: function(value) { reason = value; },
    setTask: function(value) { currentTask = value; },
    setPrepResult: function(value) { prepResult = value; },
    getDrawerOpens: function() { return drawerOpens; },
    getDrawerCloses: function() { return drawerCloses; },
    getBadgeClears: function() { return badgeClears; },
    getSyncCalls: function() { return syncCalls; },
  };
}

async function testDirectAndPreparedOpen() {
  var harness = createHarness();
  harness.ai.generated = true;
  harness.ai.modules = [{ module: '登录', cases: [] }];
  assert.strictEqual(harness.owner.open(), true);
  assert.strictEqual(harness.getDrawerOpens(), 1);
  assert.strictEqual(harness.prepPayloads.length, 0);

  harness.ai.generated = false;
  harness.ai.modules = [];
  var opened = await harness.owner.open({
    forcePrep: true,
    discardExisting: true,
    closeDrawerBeforePrep: true,
  });
  assert.strictEqual(opened, true);
  assert.strictEqual(harness.getDrawerCloses(), 1);
  assert.strictEqual(harness.discardCalls.length, 1);
  assert.strictEqual(harness.prepPayloads[0].scene, 'temp-exec');
  assert.strictEqual(harness.prepPayloads[0].requirementText, '输入框需求');
  assert.strictEqual(harness.prepPayloads[0].reasoning, 'medium');
  assert.strictEqual(harness.prepPayloads[0].temperature, 0.4);
  assert.deepStrictEqual(harness.runs, [{ requirementText: '准备后需求' }]);
  assert.strictEqual(harness.getBadgeClears(), 2);
  assert.strictEqual(harness.getSyncCalls(), 1);
}

async function testDisabledAndRegenerate() {
  var harness = createHarness();
  harness.setReason('no-case');
  assert.strictEqual(harness.owner.open(), false);
  assert.strictEqual(harness.toasts[0][0], '请先选择执行用例。');

  harness.setReason('');
  var regenerated = await harness.owner.regenerate();
  assert.strictEqual(regenerated, true);
  assert.strictEqual(harness.discardCalls.length, 1);
  assert.strictEqual(harness.getDrawerCloses(), 1);
}

assert.ok(prepOwner && typeof prepOwner.create === 'function');
Promise.resolve()
  .then(testDirectAndPreparedOpen)
  .then(testDisabledAndRegenerate)
  .then(function() { console.log('temp exec AI generation prep owner tests passed'); })
  .catch(function(error) {
    console.error(error);
    process.exitCode = 1;
  });
