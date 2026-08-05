'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var controllerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenKnowledgeBaseController.js'
);
var source = fs.readFileSync(controllerPath, 'utf8');
var sandbox = {
  console: console,
  Promise: Promise,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  window: { app: {} },
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: controllerPath });

var factory = sandbox.window.app.xmindCasegenKnowledgeBaseController;
assert.ok(factory && typeof factory.create === 'function');

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return fallback;
  }
}

function createStageState(status) {
  return {
    status: status || 'disabled',
    requestId: '',
    reason: '',
    error: '',
    candidateCount: 0,
    selectedCount: 0,
  };
}

function createDefaultState() {
  return {
    baseUrl: '',
    enabled: false,
    workspaceId: '',
    queryKey: '',
    latestRequestId: '',
    lastOperation: '',
    validation: { status: 'disabled', normalizedBaseUrl: '' },
    ruleSearch: createStageState('disabled'),
    aiFilter: createStageState('disabled'),
    catalogItems: [],
    candidates: [],
    selectedDocuments: [],
    documentSections: [],
    selectedSections: [],
    selectedItems: [],
    usedInLatestGeneration: false,
    injectedContextText: '',
    latestError: '',
    warnings: [],
    updatedAt: 0,
  };
}

function normalizeState(value) {
  var sourceValue = value && typeof value === 'object' ? cloneJson(value, {}) : {};
  var next = createDefaultState();
  Object.keys(sourceValue).forEach(function(key) {
    next[key] = sourceValue[key];
  });
  next.ruleSearch = Object.assign(createStageState('disabled'), sourceValue.ruleSearch || {});
  next.aiFilter = Object.assign(createStageState('disabled'), sourceValue.aiFilter || {});
  return next;
}

function normalizeBaseUrl(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/\/+$/, '') + '/';
}

function buildQueryKey(input) {
  var queryContext = input && input.queryContext ? input.queryContext : {};
  return JSON.stringify({
    baseUrl: normalizeBaseUrl(input && input.baseUrl),
    requirementLabel: queryContext.requirementLabel || '',
    requirementText: queryContext.requirementText || '',
    requirementSupplement: queryContext.requirementSupplement || '',
    requirementMode: queryContext.requirementMode || '',
  });
}

var state = {
  settings: { knowledgeBaseBaseUrl: 'http://kb.example/sk' },
};
var activeWorkspaceId = 'workspace-a';
var records = {
  'workspace-a': {
    id: 'workspace-a',
    snapshot: { xmind: { knowledgeBase: createDefaultState() } },
    updatedAt: 0,
  },
  'workspace-b': {
    id: 'workspace-b',
    snapshot: { xmind: { knowledgeBase: createDefaultState() } },
    updatedAt: 0,
  },
};
var liveXmindState = records['workspace-a'].snapshot.xmind;
var persistCount = 0;
var activeChangeCount = 0;
var pipelineCallCount = 0;
var requestSequence = 0;
var pendingRuns = [];

var knowledgeBaseApi = {
  createDefaultState: createDefaultState,
  normalizeState: normalizeState,
  normalizeBaseUrl: normalizeBaseUrl,
  buildQueryKey: buildQueryKey,
  runPipeline: function(input) {
    pipelineCallCount += 1;
    input.onStateChange(normalizeState({
      baseUrl: input.baseUrl,
      enabled: true,
      workspaceId: input.workspaceId,
      queryKey: buildQueryKey(input),
      latestRequestId: input.requestId,
      ruleSearch: { status: 'pending', requestId: input.requestId },
      aiFilter: { status: 'skipped', requestId: input.requestId },
    }));
    return new Promise(function(resolve) {
      pendingRuns.push(function() {
        resolve(normalizeState({
          baseUrl: input.baseUrl,
          enabled: true,
          workspaceId: input.workspaceId,
          queryKey: buildQueryKey(input),
          latestRequestId: input.requestId,
          lastOperation: input.queryContext.operationType,
          validation: { status: 'done', normalizedBaseUrl: input.baseUrl },
          ruleSearch: {
            status: 'done',
            requestId: input.requestId,
            candidateCount: 1,
            selectedCount: 1,
          },
          aiFilter: {
            status: 'done',
            requestId: input.requestId,
            candidateCount: 1,
            selectedCount: 1,
          },
          selectedDocuments: [{ docId: 'doc-1' }],
          selectedSections: [{ sectionId: 'section-1' }],
          selectedItems: [{ sectionId: 'section-1' }],
          usedInLatestGeneration: true,
          injectedContextText: 'knowledge-context',
        }));
      });
    });
  },
};

var controller = factory.create({
  state: state,
  knowledgeBaseApi: knowledgeBaseApi,
  cloneJson: cloneJson,
  ensureXmindState: function() { return liveXmindState; },
  getActiveWorkspaceId: function() { return activeWorkspaceId; },
  getWorkspaceRecord: function(workspaceId) { return records[workspaceId] || null; },
  createWorkspaceSnapshot: function() { return { xmind: { knowledgeBase: createDefaultState() } }; },
  createInitialXmindState: function() { return { knowledgeBase: createDefaultState() }; },
  getSelectedRequirementSource: function() {
    return {
      mode: 'manual',
      text: '技能按钮与冷却校验',
      supplement: '覆盖异常恢复',
    };
  },
  getRequirementLabelText: function() { return '需求A'; },
  generateLocalId: function(prefix) {
    requestSequence += 1;
    return String(prefix || 'id') + '-' + String(requestSequence);
  },
  callModelWithConfig: function() { return Promise.resolve('{}'); },
  callModelWithGuard: function(run) { return run(); },
  persistWorkflowState: function() { persistCount += 1; },
  onActiveStateChange: function() { activeChangeCount += 1; },
  getWorkspaceShadowDepth: function() { return 0; },
  now: function() { return 1700000000000 + requestSequence; },
});

assert.ok(typeof controller.getActiveState === 'function');
assert.ok(typeof controller.getWorkspaceState === 'function');
assert.ok(typeof controller.setWorkspaceState === 'function');
assert.ok(typeof controller.runForGeneration === 'function');
assert.ok(typeof controller.shouldAcceptState === 'function');
assert.ok(typeof controller.canReuseState === 'function');

async function run() {
  var contract = { mode: 'root-full-cases' };
  var firstRun = controller.runForGeneration(
    contract,
    {},
    null,
    { id: 'model-1' },
    '',
    0.2,
    'workspace-a',
    'action-1'
  );
  var secondRun = controller.runForGeneration(
    contract,
    {},
    null,
    { id: 'model-1' },
    '',
    0.2,
    'workspace-a',
    'action-1'
  );

  assert.strictEqual(pipelineCallCount, 1, 'same action/query should share one in-flight pipeline');
  assert.strictEqual(pendingRuns.length, 1);
  pendingRuns.shift()();

  var results = await Promise.all([firstRun, secondRun]);
  assert.strictEqual(results[0].injectedContextText, 'knowledge-context');
  assert.strictEqual(results[1].injectedContextText, 'knowledge-context');
  assert.strictEqual(controller.getActiveState().usedInLatestGeneration, true);
  assert.ok(persistCount > 0);
  assert.ok(activeChangeCount > 0);

  var reused = await controller.runForGeneration(
    contract,
    {},
    null,
    { id: 'model-1' },
    '',
    0.2,
    'workspace-a',
    'action-2'
  );
  assert.strictEqual(pipelineCallCount, 1, 'completed matching state should be reused');
  assert.strictEqual(reused.usedInLatestGeneration, true);
  assert.strictEqual(reused.lastOperation, 'root-full-cases');

  var currentState = normalizeState({
    latestRequestId: 'request-new',
    ruleSearch: { status: 'done', requestId: 'request-new' },
    aiFilter: { status: 'done', requestId: 'request-new' },
  });
  var staleState = normalizeState({
    latestRequestId: 'request-old',
    ruleSearch: { status: 'done', requestId: 'request-old' },
    aiFilter: { status: 'done', requestId: 'request-old' },
  });
  var replacementPending = normalizeState({
    latestRequestId: 'request-next',
    ruleSearch: { status: 'pending', requestId: 'request-next' },
    aiFilter: { status: 'skipped', requestId: 'request-next' },
  });
  assert.strictEqual(controller.shouldAcceptState(currentState, staleState), false);
  assert.strictEqual(controller.shouldAcceptState(currentState, replacementPending), true);

  controller.setWorkspaceState('workspace-b', normalizeState({
    workspaceId: 'workspace-b',
    enabled: true,
    latestRequestId: 'workspace-b-request',
    ruleSearch: { status: 'done', requestId: 'workspace-b-request' },
    aiFilter: { status: 'skipped', requestId: 'workspace-b-request' },
  }), { force: true });
  assert.strictEqual(controller.getWorkspaceState('workspace-b').workspaceId, 'workspace-b');
  assert.notStrictEqual(
    controller.getWorkspaceState('workspace-b').latestRequestId,
    controller.getWorkspaceState('workspace-a').latestRequestId
  );

  state.settings.knowledgeBaseBaseUrl = '';
  var skipped = await controller.runForGeneration(
    { mode: 'module-full-cases' },
    {},
    null,
    { id: 'model-1' },
    '',
    0.2,
    'workspace-a',
    'action-disabled'
  );
  assert.strictEqual(skipped, null);
  assert.strictEqual(controller.getActiveState().enabled, false);
  assert.strictEqual(controller.getActiveState().ruleSearch.status, 'disabled');
  assert.match(controller.getActiveState().ruleSearch.reason, /未配置共享知识库地址/);
  assert.strictEqual(pipelineCallCount, 1);

  var xmindCasegenSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/xmindCasegen.js'),
    'utf8'
  );
  assert.ok(!/var knowledgeBasePipelinePromiseMap\s*=/.test(xmindCasegenSource));
  assert.ok(!/var knowledgeBaseActionResultMap\s*=/.test(xmindCasegenSource));
  assert.ok(!/function canReuseKnowledgeBaseState\(/.test(xmindCasegenSource));
  assert.match(xmindCasegenSource, /xmindCasegenKnowledgeBaseController/);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenKnowledgeBaseController.js');
    var entryIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < entryIndex, fileName + ' should load knowledge-base owner first');
  });

  console.log('xmind_casegen_knowledge_base_controller.test.js passed');
}

run().catch(function(err) {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
