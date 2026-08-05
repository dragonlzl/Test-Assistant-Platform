'use strict';

var assert = require('assert');
var taskStateOwner = require('../../scripts/modules/tempExecAiGenTaskStateOwner.js');

function createHarness() {
  var state = { tempExecActiveId: 'file-1' };
  var ai = {
    caseFileId: 'file-1',
    requirementText: '',
    requirementFileName: '',
    loading: false,
    generated: false,
    error: '',
    modules: [],
    selection: new Set(),
    runToken: '',
    taskSignature: '',
    resultGeneratedCount: 0,
    resultDedupeCount: 0,
  };
  var files = {
    'file-1': { id: 'file-1', status: 'active', versionId: 'v1', cases: [{ title: '已有用例' }] },
    'file-2': { id: 'file-2', status: 'active', versionId: 'v1', cases: [] },
  };
  var currentTask = null;
  var resolution = null;
  var statuses = [];
  var renders = 0;
  var managerClears = 0;
  var toolbarCalls = {
    button: 0,
    run: 0,
    assign: 0,
    badges: 0,
    ready: [],
  };
  var appendReset = [];
  var owner = taskStateOwner.create({
    state: state,
    api: {
      getTempExecFile: function(id) { return files[String(id)] || null; },
    },
    model: {
      resolveGenerationMode: function(prepContext) { return prepContext && prepContext.mode || ''; },
      formatCompleteStatus: function() { return '生成完成'; },
      applyAppendMap: function(modules, map) {
        if (modules[0]) modules[0].appendMap = map;
      },
    },
    store: {
      resetAppendRecord: function(fileId, token) { appendReset.push([fileId, token]); },
      getAppendMap: function() { return { appended: true }; },
    },
    taskRunner: {
      getCurrentTask: function(fileId) {
        return currentTask && String(currentTask.caseFileId) === String(fileId) ? currentTask : null;
      },
      resume: function() { return currentTask; },
      resolveManagedResult: function() { return resolution; },
    },
    toolbar: {
      syncRunButton: function() { toolbarCalls.run += 1; },
      syncButton: function() { toolbarCalls.button += 1; },
      syncAssignEntryBadge: function() { toolbarCalls.assign += 1; },
      syncBadgeForFile: function() { toolbarCalls.badges += 1; },
      markResultReady: function(token, fileId) { toolbarCalls.ready.push([token, fileId]); },
    },
    getState: function() { return ai; },
    getManager: function() {
      return { clearTask: function() { managerClears += 1; } };
    },
    callbacks: {
      setStatus: function(text, type) { statuses.push([text, type]); },
      renderResult: function() { renders += 1; },
      prepareParsedResult: function(parsed) { return parsed; },
      applyResultStats: function(target) {
        target.resultGeneratedCount = 2;
        target.resultDedupeCount = 1;
      },
      setRequirementText: function(value) { ai.renderedRequirement = value; },
      setRequirementFileName: function(value) { ai.renderedFileName = value; },
    },
  });
  return {
    state: state,
    ai: ai,
    files: files,
    owner: owner,
    statuses: statuses,
    toolbarCalls: toolbarCalls,
    appendReset: appendReset,
    getRenders: function() { return renders; },
    getManagerClears: function() { return managerClears; },
    setTask: function(task) { currentTask = task; },
    setResolution: function(value) { resolution = value; },
  };
}

function testRunningAndReadyState() {
  var harness = createHarness();
  var runningTask = {
    id: 'task-1',
    scene: 'temp-exec',
    status: 'running',
    caseFileId: 'file-1',
    contextSignature: 'sig-1',
    requirementText: '登录需求',
    requirementFileName: 'requirement.docx',
    prepContext: { mode: 'enhanced' },
  };
  harness.setTask(runningTask);
  assert.strictEqual(harness.owner.applyTaskState(runningTask), true);
  assert.strictEqual(harness.ai.loading, true);
  assert.strictEqual(harness.ai.generationMode, 'enhanced');
  assert.strictEqual(harness.ai.renderedRequirement, '登录需求');
  assert.strictEqual(harness.ai.renderedFileName, 'requirement.docx');

  var readyTask = Object.assign({}, runningTask, {
    status: 'done',
    resultRaw: '{"modules":[]}',
  });
  harness.setTask(readyTask);
  harness.setResolution({
    kind: 'ready',
    parsed: { modules: [{ module: '登录', cases: [{ title: '失败登录' }] }] },
  });
  assert.strictEqual(harness.owner.applyTaskState(readyTask), true);
  assert.strictEqual(harness.ai.generated, true);
  assert.strictEqual(harness.ai.modules.length, 1);
  assert.deepStrictEqual(harness.ai.modules[0].appendMap, { appended: true });
  assert.deepStrictEqual(harness.appendReset, [['file-1', 'task-1']]);
  assert.deepStrictEqual(harness.toolbarCalls.ready, [['task-1', 'file-1']]);
  assert.ok(harness.getRenders() >= 2);
}

function testBackgroundAndDiscardedState() {
  var harness = createHarness();
  var backgroundTask = {
    id: 'task-2',
    scene: 'temp-exec',
    status: 'done',
    caseFileId: 'file-2',
    contextSignature: 'sig-2',
  };
  harness.setTask(backgroundTask);
  assert.strictEqual(harness.owner.applyTaskState(backgroundTask), false);
  assert.deepStrictEqual(harness.toolbarCalls.ready, [['task-2', 'file-2']]);

  harness.files['file-2'].status = 'archived';
  assert.strictEqual(harness.owner.applyTaskState(backgroundTask), false);
  assert.strictEqual(harness.getManagerClears(), 1);

  harness.setTask({
    id: 'task-3',
    scene: 'temp-exec',
    status: 'running',
    caseFileId: 'file-1',
    contextSignature: 'sig-3',
  });
  assert.strictEqual(harness.owner.syncTaskState(true), true);
  assert.strictEqual(harness.toolbarCalls.badges, 1);
}

assert.ok(taskStateOwner && typeof taskStateOwner.create === 'function');
testRunningAndReadyState();
testBackgroundAndDiscardedState();
console.log('temp exec AI generation task state owner tests passed');
