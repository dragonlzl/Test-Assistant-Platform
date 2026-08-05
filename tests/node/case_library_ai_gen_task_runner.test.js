const assert = require('assert');
const taskRunnerOwner = require('../../scripts/modules/caseLibrary/caseLibraryAiGenTaskRunner.js');
const sharedTaskRunnerOwner = require('../../scripts/modules/casePageAiGenTaskRunner.js');

function createModel() {
  return {
    buildModuleList: function(items) { return items.map(function(item) { return item.module; }); },
    buildCasePayload: function(items) { return items.map(function(item) { return { title: item.title }; }); },
    buildSignature: function(fileId, requirementText, modules) {
      return [fileId, requirementText, modules.join(',')].join('|');
    },
    resolveGenerationMode: function(prepContext) {
      return prepContext && prepContext.mode ? prepContext.mode : '';
    },
    parseResult: function(raw) { return typeof raw === 'string' ? JSON.parse(raw) : raw; },
  };
}

function createHarness() {
  let manager = null;
  let prepApi = null;
  const modelCalls = [];
  const core = {
    getAssignedModel: function(feature) {
      assert.strictEqual(feature, 'caselibrarygen');
      return { id: 'model-1' };
    },
    callModelWithConfig: function(model, userText, prompt, reasoning, temperature) {
      modelCalls.push({ model: model, userText: userText, prompt: prompt, reasoning: reasoning, temperature: temperature });
      return Promise.resolve(JSON.stringify({ modules: [{ module: '登录', cases: [] }] }));
    },
  };
  const runner = taskRunnerOwner.create({
    model: createModel(),
    getManager: function() { return manager; },
    getCore: function() { return core; },
    getPrepApi: function() { return prepApi; },
    getAssignments: function() {
      return {
        caseLibraryGenReasoning: 'medium',
        caseLibraryGenTemperature: 0.4,
      };
    },
    appendPrompt: function(prompt) { return prompt + '|guide'; },
    getDefaultPrompt: function() { return 'default-prompt'; },
    resolveCoverageThreshold: function() { return 85; },
    now: function() { return 1000; },
    random: function() { return 0.5; },
  });
  return {
    core: core,
    modelCalls: modelCalls,
    runner: runner,
    setManager: function(value) { manager = value; },
    setPrepApi: function(value) { prepApi = value; },
  };
}

function prepare(harness, prepContext) {
  return harness.runner.prepare({
    caseFile: {
      id: 12,
      file_name_clean: '登录用例',
      project_id: 3,
      version_id: 4,
    },
    items: [{ module: '登录', title: '成功登录' }],
    requirementText: '登录需求',
    requirementFileName: 'requirement.docx',
    prepContext: prepContext || null,
  });
}

function testPreparationAndManagedStart() {
  const harness = createHarness();
  harness.setPrepApi({
    enrichPrompt: function(prompt) { return prompt + '|enriched'; },
    enrichPayload: function(payload) {
      return Object.assign({}, payload, { supplement: 'extra' });
    },
  });
  const prepared = prepare(harness, { mode: 'enhanced' });
  assert.strictEqual(prepared.prompt, 'default-prompt|guide|enriched');
  assert.strictEqual(prepared.signature, '12|登录需求|登录');
  assert.strictEqual(prepared.generationMode, 'enhanced');
  assert.strictEqual(prepared.coverageThreshold, 85);
  assert.strictEqual(prepared.reasoning, 'medium');
  assert.strictEqual(prepared.temperature, 0.4);
  assert.strictEqual(JSON.parse(prepared.userText).supplement, 'extra');
  assert.ok(prepared.runToken.indexOf('local-rs-') === 0);

  const calls = [];
  const manager = {
    getTask: function() { return null; },
    createTask: function(scene, payload) {
      calls.push({ type: 'create', scene: scene, payload: payload });
      return Object.assign({ id: 'task-1', scene: scene, status: 'running' }, payload);
    },
    startTask: function(scene, task) { calls.push({ type: 'start', scene: scene, task: task }); },
  };
  harness.setManager(manager);
  const execution = harness.runner.start(prepared);
  assert.strictEqual(execution.mode, 'managed');
  assert.strictEqual(execution.task.id, 'task-1');
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[0].payload.requirementFileName, 'requirement.docx');
  assert.strictEqual(calls[0].payload.coverageThreshold, 85);

  manager.getTask = function() {
    return { status: 'running', caseFileId: 99, caseFileName: '其他用例' };
  };
  assert.deepStrictEqual(harness.runner.getRunningConflict(12).type, 'other-file');
  manager.getTask = function() { return { status: 'running', caseFileId: 12 }; };
  assert.deepStrictEqual(harness.runner.getRunningConflict(12).type, 'same-file');
  manager.getTask = function() { return { status: 'running', caseFileId: null }; };
  assert.strictEqual(harness.runner.getRunningConflict(12), null);
}

async function testDirectExecution() {
  const harness = createHarness();
  let dedupeCalls = 0;
  let dedupeStarted = 0;
  harness.setPrepApi({
    applyAiDedupeToParsed: function(parsed, sourceCases, prepContext, options) {
      dedupeCalls += 1;
      assert.strictEqual(sourceCases[0].title, '当前用例');
      assert.strictEqual(prepContext.mode, 'normal');
      assert.strictEqual(options.model.id, 'model-1');
      return Promise.resolve(Object.assign({}, parsed, { deduped: true }));
    },
  });
  const prepared = prepare(harness, { mode: 'normal' });
  const execution = harness.runner.start(prepared, {
    getSourceCases: function() { return [{ title: '当前用例' }]; },
    onDedupeStart: function() { dedupeStarted += 1; },
  });
  assert.strictEqual(execution.mode, 'direct');
  const parsed = await execution.promise;
  assert.strictEqual(parsed.deduped, true);
  assert.strictEqual(dedupeCalls, 1);
  assert.strictEqual(dedupeStarted, 1);
  assert.strictEqual(harness.modelCalls.length, 1);
}

async function testManagedResultResolution() {
  const harness = createHarness();
  const updates = [];
  harness.setManager({
    updateTask: function(scene, patch, action) {
      updates.push({ scene: scene, patch: patch, action: action });
    },
  });
  let resolveDedupe;
  harness.setPrepApi({
    applyAiDedupeToParsed: function() {
      return new Promise(function(resolve) { resolveDedupe = resolve; });
    },
  });
  const task = {
    id: 'task-2',
    resultRaw: JSON.stringify({ modules: [{ module: '支付', cases: [] }] }),
    prepContext: { mode: 'enhanced' },
    model: { id: 'model-1' },
    reasoning: '',
    temperature: 0.2,
  };
  const first = harness.runner.resolveManagedResult(task, { sourceCases: [] });
  const second = harness.runner.resolveManagedResult(task, { sourceCases: [] });
  assert.strictEqual(first.kind, 'pending');
  assert.strictEqual(first.started, true);
  assert.strictEqual(second.started, false);
  assert.strictEqual(second.promise, first.promise);
  await Promise.resolve();
  resolveDedupe({ modules: [{ module: '支付', cases: [] }], deduped: true });
  const result = await first.promise;
  assert.strictEqual(result.deduped, true);
  assert.strictEqual(updates.length, 1);
  assert.strictEqual(updates[0].action, 'semantic-dedupe');
  assert.strictEqual(updates[0].patch.semanticDedupeError, '');
  const cached = harness.runner.resolveManagedResult(task, { sourceCases: [] });
  assert.strictEqual(cached.kind, 'ready');
  assert.strictEqual(cached.parsed.deduped, true);
  harness.runner.clear(task.id);

  const invalidatedTask = Object.assign({}, task, { id: 'task-3' });
  const invalidated = harness.runner.resolveManagedResult(invalidatedTask, { sourceCases: [] });
  await Promise.resolve();
  harness.runner.clear(invalidatedTask.id);
  resolveDedupe({ modules: [], invalidated: true });
  await invalidated.promise;
  assert.strictEqual(updates.length, 1);

  const restarted = harness.runner.resolveManagedResult(invalidatedTask, { sourceCases: [] });
  assert.strictEqual(restarted.started, true);
  await Promise.resolve();
  resolveDedupe({ modules: [], restarted: true });
  await restarted.promise;
}

function testTempExecSceneContract() {
  let currentTask = null;
  const calls = [];
  const manager = {
    getTask: function(scene) {
      assert.strictEqual(scene, 'temp-exec');
      return currentTask;
    },
    createTask: function(scene, payload) {
      currentTask = Object.assign({ id: 'temp-task-1', scene: scene, status: 'running' }, payload);
      calls.push({ type: 'create', scene: scene, payload: payload });
      return currentTask;
    },
    startTask: function(scene, task, options) {
      calls.push({ type: 'start', scene: scene, task: task, options: options || null });
    },
  };
  const runner = sharedTaskRunnerOwner.create({
    scene: 'temp-exec',
    runTokenPrefix: 'temp-exec',
    model: createModel(),
    getManager: function() { return manager; },
    getCore: function() {
      return {
        getAssignedModel: function() { return { id: 'model-temp' }; },
        callModelWithConfig: function() { return Promise.resolve('{}'); },
      };
    },
    getAssignments: function() { return {}; },
    getDefaultPrompt: function() { return 'prompt'; },
    resolveFileMeta: function(file) {
      return {
        id: file.id,
        name: file.name,
        projectId: file.projectId,
        versionId: file.versionId,
      };
    },
    now: function() { return 2000; },
    random: function() { return 0.25; },
  });
  const prepared = runner.prepare({
    caseFile: { id: 'exec-1', name: '执行用例', projectId: 8, versionId: 9 },
    items: [{ module: '支付', title: '支付成功' }],
    requirementText: '支付需求',
  });
  assert.ok(prepared.runToken.indexOf('temp-exec-1jk-') === 0);
  const execution = runner.start(prepared);
  assert.strictEqual(execution.mode, 'managed');
  assert.strictEqual(calls[0].scene, 'temp-exec');
  assert.strictEqual(calls[0].payload.caseFileName, '执行用例');
  assert.strictEqual(calls[0].payload.versionIdAtRun, 9);
  assert.strictEqual(calls[0].payload.versionAssigned, true);
  assert.strictEqual(runner.getCurrentTask('exec-1'), currentTask);
  runner.resume(true);
  assert.strictEqual(calls[calls.length - 1].options.force, true);
}

async function main() {
  assert.strictEqual(taskRunnerOwner, sharedTaskRunnerOwner);
  testPreparationAndManagedStart();
  await testDirectExecution();
  await testManagedResultResolution();
  testTempExecSceneContract();
  console.log('case library AI generation task runner tests passed');
}

main().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
