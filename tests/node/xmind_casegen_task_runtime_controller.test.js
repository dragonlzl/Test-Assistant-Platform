'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenTaskRuntimeController.js'
);
var factory = require(ownerPath);

function createHarness() {
  var rootState = { running: false, taskId: '', lastAction: '', status: '', error: '' };
  var dedupeState = {};
  var coverageState = {};
  var moduleStates = {
    'module-1': { running: true, taskId: 'stale', rootPendingActionId: 'old', hideResults: true },
  };
  var pipeline = null;
  var calls = { visibility: [], pending: [], cleared: 0, interrupts: 0 };
  var controller = factory.create({
    rootActions: {
      EXISTING_CASES: 'root-existing-cases',
      TOPUP_MODULES: 'root-topup-modules',
      TOPUP_MODULES_CASES: 'root-topup-modules-cases',
    },
    moduleActions: { APPEND: 'module-append' },
    dedupeActionId: 'dedupe-action',
    ensureRootUiState: function() { return rootState; },
    ensureDedupeUiState: function() { return dedupeState; },
    ensureCoverageUiState: function() { return coverageState; },
    clearRootPendingModules: function() { calls.cleared += 1; },
    setAllModuleResultsVisibility: function(visible) { calls.visibility.push(visible); },
    ensureState: function() { return { modules: moduleStates }; },
    ensureModuleUiState: function(id) { return moduleStates[id] || null; },
    syncInterruptButton: function() { calls.interrupts += 1; },
    getRootPipelineState: function() { return pipeline; },
    ensureRootPipelineStateFromTask: function(task) {
      pipeline = { id: task.rootPipelineId, actionId: task.rootPipelineActionId, stage: 'discovering' };
      return pipeline;
    },
    collectRootPipelineRunningTasks: function(id, tasks) {
      return (tasks || []).filter(function(task) { return task.rootPipelineId === id; });
    },
    isRootPipelineUiActive: function(value) { return Boolean(value && value.stage !== 'done'); },
    setModuleRootPendingAction: function(moduleState, actionId) {
      moduleState.rootPendingActionId = actionId;
      calls.pending.push(actionId);
    },
    markRootPendingModules: function(entries, actionId) { calls.pending.push(actionId + ':' + entries.length); },
    buildVisibleModuleContext: function() {
      return { list: [{ aiModuleId: 'module-1', moduleKey: 'login', title: '登录模块' }] };
    },
    normalizeDedupeMode: function(value) { return String(value || 'dedupe_only'); },
    ensureVisibleModuleContext: function(value) { return value; },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    findAiModuleById: function(id) { return { id: id, title: '登录模块' }; },
    getAiCasesForModule: function() { return [{ title: '登录成功' }]; },
    getRootNodeId: function() { return 'root-1'; },
    getModuleNodeId: function(entry) { return 'node-' + entry.moduleKey; },
    buildModuleNodeId: function(key) { return 'node-' + key; },
    normalizeArrayField: function(value) { return Array.isArray(value) ? value.slice() : []; },
    now: function() { return 1000; },
  });
  return {
    calls: calls,
    controller: controller,
    coverageState: coverageState,
    dedupeState: dedupeState,
    moduleStates: moduleStates,
    rootState: rootState,
  };
}

function verifyRunningProjectionLifecycle() {
  var harness = createHarness();
  harness.controller.clearManagedTaskRunningUiProjection();
  assert.strictEqual(harness.rootState.running, false);
  assert.strictEqual(harness.moduleStates['module-1'].running, false);
  assert.strictEqual(harness.moduleStates['module-1'].hideResults, false);
  assert.deepStrictEqual(harness.calls.visibility, [true]);
  assert.strictEqual(harness.calls.interrupts, 1);

  harness.controller.applyManagedTaskRunningUiProjection({
    id: 'root-task',
    scope: 'root',
    actionId: 'root-existing-cases',
    hadAiCasesBeforeAction: true,
  });
  assert.strictEqual(harness.rootState.running, true);
  assert.strictEqual(harness.rootState.taskId, 'root-task');
  assert.ok(harness.calls.visibility.indexOf(false) >= 0);
  assert.ok(harness.calls.pending.indexOf('root-existing-cases:1') >= 0);

  harness.controller.applyManagedTaskRunningUiProjection({
    id: 'dedupe-task',
    scope: 'dedupe',
    dedupeMode: 'dedupe_simplify',
    modelRequestBatchCompleted: 1,
    modelRequestBatchTotal: 2,
  });
  assert.strictEqual(harness.dedupeState.status, 'running');
  assert.strictEqual(harness.dedupeState.batchTotal, 2);
  assert.strictEqual(harness.rootState.lastAction, 'dedupe-action');

  harness.controller.applyManagedTaskRunningUiProjection({ id: 'coverage-task', scope: 'coverage' });
  assert.strictEqual(harness.coverageState.status, 'running');
  harness.controller.applyManagedTaskRunningUiProjection({
    id: 'module-task',
    scope: 'module',
    moduleId: 'module-1',
    actionId: 'module-append',
    hadAiCasesBeforeAction: true,
  });
  assert.strictEqual(harness.moduleStates['module-1'].taskId, 'module-task');
  assert.strictEqual(harness.moduleStates['module-1'].hideResults, true);
}

function verifyStructuralAndPipelineProjection() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.isRunningTaskStructuralRenderRequired({
    scope: 'root', actionId: 'root-topup-modules',
  }), true);
  assert.strictEqual(harness.controller.isRunningTaskStructuralRenderRequired({
    scope: 'module', actionId: 'module-full-cases',
  }), false);
  assert.strictEqual(harness.controller.shouldRenderRunningTasksStructurally([
    { scope: 'module', actionId: 'module-append' },
  ]), true);

  harness.controller.applyRootPipelineRunningUiProjection([{
    id: 'pipeline-module-task',
    scope: 'module',
    moduleId: 'module-1',
    rootPipelineId: 'pipeline-1',
    rootPipelineActionId: 'root-existing-cases',
  }]);
  assert.strictEqual(harness.rootState.running, true);
  assert.strictEqual(harness.rootState.taskId, 'pipeline-1');
  assert.strictEqual(harness.moduleStates['module-1'].rootPendingActionId, 'root-existing-cases');
}

function verifyTaskInterpretationHelpers() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.getTaskErrorMessage({
    error: 'XMind 用例生成失败：请求超时',
  }), '请求超时');
  assert.strictEqual(harness.controller.getTaskErrorMessage(null, new Error('网络失败')), '网络失败');
  assert.strictEqual(harness.controller.buildGenerationCancelledInfo({
    cancelMeta: { reason: '用户取消' },
  }).reasonText, '用户取消');
  assert.strictEqual(harness.controller.shouldSuppressTaskCancelToast({
    cancelMeta: { source: 'toolbar' },
  }), true);

  var contextEntry = { aiModuleId: 'module-1', moduleKey: 'login', title: '登录模块' };
  assert.strictEqual(harness.controller.resolveTaskModuleEntry({ moduleKey: 'login' }, {
    list: [contextEntry], map: { login: contextEntry },
  }), contextEntry);
  var fallbackEntry = harness.controller.resolveTaskModuleEntry({
    moduleId: 'module-1', moduleTitle: ' 登录模块 ',
  }, { list: [], map: {} });
  assert.strictEqual(fallbackEntry.moduleKey, '登录模块');
  assert.strictEqual(fallbackEntry.aiCases.length, 1);
  assert.strictEqual(harness.controller.getManagedTaskAnchorNodeId({ rootPipelineId: 'pipeline-1' }), 'root-1');
  assert.strictEqual(harness.controller.getManagedTaskAnchorNodeId({
    scope: 'module', moduleKey: 'login',
  }), 'node-login');
  assert.deepStrictEqual(harness.controller.cloneModulesWithoutCases([{
    module: ' 登录模块 ',
    key_scenarios: ['登录'],
    test_points: ['账号'],
    coupled_modules: ['用户'],
    cases: [{ title: '不会保留' }],
  }]), [{
    module: '登录模块',
    key_scenarios: ['登录'],
    test_points: ['账号'],
    coupled_modules: ['用户'],
    cases: [],
  }]);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'clearManagedTaskRunningUiProjection',
    'applyRootPipelineRunningUiProjection',
    'shouldRenderRunningTasksStructurally',
    'applyManagedTaskRunningUiProjection',
    'getTaskErrorMessage',
    'buildGenerationCancelledInfo',
    'resolveTaskModuleEntry',
    'getManagedTaskAnchorNodeId',
    'cloneModulesWithoutCases',
  ].forEach(function(name) {
    var signature = new RegExp('function\\s+' + name + '\\s*\\(');
    assert.match(ownerSource, signature, name + ' must belong to task runtime controller');
    assert.doesNotMatch(parentSource, signature, name + ' must leave xmindCasegen.js');
  });
  assert.ok(parentSource.split('\n').length <= 4350, 'xmindCasegen.js should stay at or below 4350 lines');
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenTaskRuntimeController.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load task runtime owner first');
  });
}

verifyRunningProjectionLifecycle();
verifyStructuralAndPipelineProjection();
verifyTaskInterpretationHelpers();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen task runtime controller tests passed');
