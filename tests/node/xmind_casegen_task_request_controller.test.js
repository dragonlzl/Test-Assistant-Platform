'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenTaskRequestController.js'
);
var factory = require(ownerPath);

function createHarness(withManager) {
  var calls = { restores: [], created: [], started: [] };
  var manager = withManager === false ? null : {
    createTask: function(payload) {
      calls.created.push(payload);
      return { id: 'task-1', payload: payload };
    },
    startTask: function(task, options) { calls.started.push({ task: task, options: options }); },
  };
  var controller = factory.create({
    dedupeActionId: 'dedupe-action',
    coverageActionId: 'coverage-action',
    dedupeStrength: 'conservative',
    cloneJson: function(value, fallback) {
      if (value === undefined || value === null) return fallback;
      return JSON.parse(JSON.stringify(value));
    },
    getActiveWorkspaceId: function() { return 'workspace-active'; },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeFallbackCaseList: function(list, moduleTitle) {
      return (Array.isArray(list) ? list : []).map(function(item) {
        return Object.assign({ module: moduleTitle }, item);
      });
    },
    normalizeDedupeMode: function(value) { return String(value || 'dedupe_only'); },
    isDedupeSimplifyMode: function(value) { return value === 'dedupe_simplify'; },
    buildManagedTaskRestoreContext: function(options) {
      calls.restores.push(options);
      return { workspaceId: options.workspaceId, compact: options.compact };
    },
    getXmindTaskManager: function() { return manager; },
  });
  return { calls: calls, controller: controller };
}

function createTaskInput() {
  return {
    prompt: '生成提示词',
    requestMode: 'vision',
    requestText: '需求正文',
    contentBlocks: [{ type: 'text', text: '需求正文' }],
    degradedToTextOnly: true,
    model: { id: 'model-1' },
    reasoning: 'medium',
    temperature: 0.3,
  };
}

function verifyGenerationPayloads() {
  var harness = createHarness();
  var input = createTaskInput();
  var rootPayload = harness.controller.buildRootTaskPayload('root-full-cases', input, {
    snapshotId: 'snapshot-1',
    contract: { scope: 'root' },
    hadAiCasesBeforeAction: true,
  });
  assert.strictEqual(rootPayload.workspaceId, 'workspace-active');
  assert.strictEqual(rootPayload.scope, 'root');
  assert.strictEqual(rootPayload.requestMode, 'vision');
  assert.deepStrictEqual(rootPayload.contentBlocks, input.contentBlocks);
  assert.notStrictEqual(rootPayload.contentBlocks, input.contentBlocks);
  assert.deepStrictEqual(rootPayload.restoreContext, { workspaceId: 'workspace-active', compact: true });

  var modulePayload = harness.controller.buildModuleTaskPayload({
    aiModuleId: 'module-1',
    moduleKey: 'login',
    title: ' 登录模块 ',
  }, 'module-full-cases', input, {
    fallbackCases: [{ title: '兜底用例' }],
    rootPipelineId: 'pipeline-1',
  });
  assert.strictEqual(modulePayload.scope, 'module');
  assert.strictEqual(modulePayload.moduleTitle, '登录模块');
  assert.strictEqual(modulePayload.fallbackCases[0].module, ' 登录模块 ');
  assert.strictEqual(modulePayload.rootPipelineId, 'pipeline-1');
}

function verifyAnalysisPayloadsAreTextOnly() {
  var harness = createHarness();
  var dedupeInput = Object.assign(createTaskInput(), {
    dedupeMode: 'dedupe_simplify',
    modules: [{ module: '登录模块', cases: [{ title: '登录成功' }] }],
    dedupeBatches: [{ batchId: 'batch-1' }],
    beforeCaseCount: 1,
    modelRequestBatch: [{ requestKey: 'request-1' }],
    modelRequestBatchConcurrency: 2,
    partialModulesResponseAllowed: true,
  });
  var dedupePayload = harness.controller.buildDedupeTaskPayload(dedupeInput, {
    dedupeSource: 'root-pipeline',
  });
  assert.strictEqual(dedupePayload.actionId, 'dedupe-action');
  assert.strictEqual(dedupePayload.requestMode, 'text');
  assert.deepStrictEqual(dedupePayload.contentBlocks, []);
  assert.strictEqual(dedupePayload.degradedToTextOnly, false);
  assert.strictEqual(dedupePayload.contract.simplify, true);
  assert.strictEqual(dedupePayload.contract.returnFullReplacement, true);
  assert.strictEqual(dedupePayload.contract.returnChangedModulesOnlyAllowed, false);
  assert.strictEqual(dedupePayload.contract.moduleReturnPolicy.returnAllInputModules, true);
  assert.strictEqual(dedupePayload.contract.moduleReturnPolicy.unchangedModulesMustBeReturned, true);
  assert.strictEqual(dedupePayload.contract.moduleReturnPolicy.partialModulesResponseAllowed, false);
  assert.strictEqual(dedupePayload.contract.reviewMethod, 'exhaustive_global_pairwise_scan');
  assert.strictEqual(dedupePayload.contract.duplicateDetectionPolicy.requireGlobalCaseScan, true);

  var coveragePayload = harness.controller.buildCoverageTaskPayload(Object.assign(createTaskInput(), {
    coverageSignature: 'coverage-1',
    coverageRequest: { segments: [{ id: 'segment-1' }] },
    segmentCount: 1,
    caseCount: 2,
  }), {});
  assert.strictEqual(coveragePayload.actionId, 'coverage-action');
  assert.strictEqual(coveragePayload.requestMode, 'text');
  assert.strictEqual(coveragePayload.historySuppressed, true);
  assert.strictEqual(coveragePayload.contract.directRequirementCoverageOnly, true);
}

function verifyTaskDispatch() {
  var harness = createHarness();
  var payload = { scope: 'root' };
  var task = harness.controller.startManagedXmindTask(payload);
  assert.strictEqual(task.id, 'task-1');
  assert.deepStrictEqual(harness.calls.created, [payload]);
  assert.deepStrictEqual(harness.calls.started[0].options, { force: true });
  assert.throws(function() {
    createHarness(false).controller.startManagedXmindTask(payload);
  }, /后台任务能力未就绪/);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'buildManagedTaskRequestEnvelope',
    'buildRootTaskPayload',
    'buildModuleTaskPayload',
    'buildDedupeTaskPayload',
    'buildCoverageTaskPayload',
    'startManagedXmindTask',
  ].forEach(function(name) {
    var signature = new RegExp('function\\s+' + name + '\\s*\\(');
    assert.match(ownerSource, signature, name + ' must belong to task request controller');
    assert.doesNotMatch(parentSource, signature, name + ' must leave xmindCasegen.js');
  });
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenTaskRequestController.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load task request owner first');
  });
}

verifyGenerationPayloads();
verifyAnalysisPayloadsAreTextOnly();
verifyTaskDispatch();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen task request controller tests passed');
