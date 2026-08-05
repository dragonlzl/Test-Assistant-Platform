'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenRootPipelineController.js'
));

var ROOT_ACTIONS = {
  FULL_CASES: 'root-full-cases',
  EXISTING_CASES: 'root-existing-cases',
  TOPUP_MODULES_CASES: 'root-topup-modules-cases',
  APPEND_ALL: 'root-append-all',
  FULL_MODULES: 'root-full-modules',
  REGENERATE_MODULES: 'root-regenerate-modules',
};
var MODULE_ACTIONS = {
  FULL_CASES: 'module-full-cases',
  APPEND: 'module-append',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPipeline(value) {
  return Object.assign({
    id: 'pipeline-' + Date.now(),
    actionId: ROOT_ACTIONS.FULL_CASES,
    snapshotId: '',
    historyActionLabel: '',
    stage: 'modules',
    discoveryStatus: 'done',
    hadAiContentBeforeAction: false,
    hadAiLayerBeforeAction: false,
    hadAiCasesBeforeAction: false,
    cancelled: false,
    cancelReason: '',
    errorCount: 0,
    createdModules: 0,
    addedCases: 0,
    moduleTaskTotal: 0,
    moduleTaskCompleted: 0,
    moduleTaskCompletedKeys: [],
    pendingQueue: [],
    detailMap: {},
    diagnostics: [],
    generatedDedupeModules: [],
  }, value || {});
}

function uniqueStrings(values) {
  var seen = {};
  return (Array.isArray(values) ? values : []).filter(function(value) {
    var text = String(value || '');
    if (!text || seen[text]) return false;
    seen[text] = true;
    return true;
  });
}

function createHarness() {
  var state = {
    xmindCaseGen: {
      root: {},
      rootSnapshotId: 'root-snapshot',
      mode: 'full',
    },
  };
  var calls = {
    history: [],
    notices: [],
    dedupe: [],
    renders: [],
    persist: 0,
  };
  var visibleContext = {
    list: [
      { aiModuleId: 'module-a', moduleKey: 'login', title: '登录', visibleCases: [{ id: 1 }] },
      { aiModuleId: 'module-b', moduleKey: 'payment', title: '支付', visibleCases: [] },
    ],
    map: {},
  };
  visibleContext.list.forEach(function(entry) { visibleContext.map[entry.moduleKey] = entry; });

  var controller = controllerFactory.create({
    ensureState: function() { return state.xmindCaseGen; },
    createRootPipelineState: createPipeline,
    mergeRootPipelineSnapshot: function(base, incoming) { return Object.assign({}, base || {}, incoming || {}); },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    normalizeFallbackCaseList: function(value) { return Array.isArray(value) ? clone(value) : []; },
    normalizeArrayField: function(value) { return Array.isArray(value) ? value.slice() : []; },
    normalizeHistoryDurationMs: function(value) { return Math.max(0, Math.round(Number(value) || 0)); },
    normalizeHistoryDiagnostics: uniqueStrings,
    normalizeHistoryDetails: function(value) { return Array.isArray(value) ? value.slice() : []; },
    ensureVisibleModuleContext: function(value) { return value || visibleContext; },
    getVisibleCasesForModuleEntry: function(entry) { return entry.visibleCases || []; },
    listManagedXmindTasks: function() { return []; },
    rootActions: ROOT_ACTIONS,
    moduleActions: MODULE_ACTIONS,
    getRootHistoryActionLabel: function(actionId) { return 'history:' + actionId; },
    normalizeDedupeMode: function(value) { return String(value || 'dedupe_only'); },
    getDedupeRemovedSummaryText: function(count) { return '已去重 ' + count + ' 条用例'; },
    getDedupeNoChangeSummaryText: function() { return '无重复用例'; },
    buildTopupHighlightLabel: function(count) { return '补充 ' + count; },
    buildVisibleModuleContext: function() { return visibleContext; },
    buildRootPipelineDedupeReadiness: function() {
      return { missingModules: [], dedupeModules: [{ module: '登录', cases: [{ id: 1 }] }] };
    },
    getDedupeModeFromSettings: function() { return 'dedupe_only'; },
    startAiDedupeTask: function(payload) { calls.dedupe.push(payload); },
    getActiveWorkspaceId: function() { return 'workspace-1'; },
    getDedupeModeActionText: function() { return '去重'; },
    notifyStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    clearRootPendingModules: function() {},
    setAllModuleResultsVisibility: function() {},
    markOpenButtonCompletionNotice: function() {},
    getGenerationFailureLabel: function() { return '生成失败'; },
    getFriendlyRootEmptyModulesText: function() { return '没有可生成模块'; },
    recordGenerationHistory: function(payload) { calls.history.push(payload); },
    discardCaseGenOperationSnapshotEntry: function() {},
    clearDeleteHistoryStacks: function() {},
    syncCasesGenPageRender: function() {},
    isDrawerOpen: function() { return true; },
    queueTerminalMindRender: function(payload) { calls.renders.push(payload); },
    persistManagedTaskWorkspaceState: function() { calls.persist += 1; },
  });
  return { state: state, calls: calls, controller: controller, visibleContext: visibleContext };
}

function verifyPipelineStateAndQueue() {
  var harness = createHarness();
  var controller = harness.controller;
  var pipeline = createPipeline({ id: 'pipeline-state', moduleTaskTotal: 2 });
  controller.setRootPipelineState(pipeline);
  controller.markRootPipelineModuleTaskCompleted({ id: 'task-a', rootPipelineId: 'pipeline-state' });
  controller.markRootPipelineModuleTaskCompleted({ id: 'task-a', rootPipelineId: 'pipeline-state' });
  assert.strictEqual(controller.getRootPipelineState().moduleTaskCompleted, 1);
  assert.strictEqual(controller.getRootPipelineState().moduleTaskCompletedKeys.length, 1);
  assert.strictEqual(controller.isRootPipelineModulePhaseComplete(controller.getRootPipelineState()), false);

  controller.replaceRootPipelinePendingQueue('pipeline-state', [{
    moduleEntry: harness.visibleContext.list[0],
    actionId: MODULE_ACTIONS.APPEND,
    rootPendingActionId: ROOT_ACTIONS.EXISTING_CASES,
  }]);
  var serialized = controller.shiftRootPipelinePendingDescriptor('pipeline-state');
  var resolved = controller.resolveRootPipelineDescriptor(serialized, harness.visibleContext);
  assert.strictEqual(resolved.moduleEntry.title, '登录');
  assert.strictEqual(resolved.actionId, MODULE_ACTIONS.APPEND);
  assert.strictEqual(controller.getRootPipelineState().pendingQueue.length, 0);

  var reconstructed = controller.ensureRootPipelineStateFromTask({
    rootPipelineId: 'pipeline-reconstructed',
    rootPipelineActionId: ROOT_ACTIONS.EXISTING_CASES,
    pipelineStage: 'modules',
  });
  assert.strictEqual(reconstructed.id, 'pipeline-reconstructed');
  assert.strictEqual(reconstructed.actionId, ROOT_ACTIONS.EXISTING_CASES);
}

function verifyFinalizationBranches() {
  var harness = createHarness();
  var controller = harness.controller;
  controller.setRootPipelineState(createPipeline({ id: 'pipeline-empty', snapshotId: 'snapshot-empty' }));
  assert.strictEqual(controller.finalizeRootPipelineIfReady('pipeline-empty', { anchorNodeId: 'root' }), false);
  assert.strictEqual(controller.getRootPipelineState(), null);
  assert.strictEqual(harness.calls.history.length, 1);
  assert.strictEqual(harness.calls.history[0].resultKind, 'no-change');
  assert.strictEqual(harness.calls.persist, 1);

  controller.setRootPipelineState(createPipeline({
    id: 'pipeline-dedupe',
    createdModules: 1,
    addedCases: 2,
  }));
  assert.strictEqual(controller.finalizeRootPipelineIfReady('pipeline-dedupe'), false);
  assert.strictEqual(harness.calls.dedupe.length, 1);
  assert.strictEqual(harness.calls.dedupe[0].rootPipelineId, 'pipeline-dedupe');
  assert.ok(controller.getRootPipelineState());
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'ensureRootUiState',
    'getRootPipelineState',
    'ensureRootPipelineStateFromTask',
    'serializeRootPipelineDescriptor',
    'replaceRootPipelinePendingQueue',
    'mergeRootPipelineDetails',
    'finalizeRootPipelineIfReady',
    'shouldUseRootPipeline',
    'buildRootPipelineTaskDescriptors',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by the root pipeline controller');
  });
  assert.ok(/rootPipelineControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenRootPipelineController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load the root pipeline controller first');
  });
}

verifyPipelineStateAndQueue();
verifyFinalizationBranches();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen root pipeline controller tests passed');
