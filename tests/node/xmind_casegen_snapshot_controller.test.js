const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ownerPath = '../../scripts/modules/xmindCasegen/xmindCasegenSnapshotController.js';

function createHarness(controllerFactory) {
  const state = {
    caseGenModules: [{ id: 'login-ai', title: '登录模块' }],
    caseGenResults: { 'login-ai': [{ title: '登录成功' }] },
    caseSelections: { 'login-ai': { selected: true } },
    caseGenSuggestions: { login: ['补充异常场景'] },
    caseGenModuleStatus: { 'login-ai': 'done' },
    caseGenProgress: { completed: 1, total: 1 },
    caseGenTiming: { 'login-ai': 120 },
    caseGenSource: 'xmind',
  };
  const xmindState = {
    nextSnapshotId: 1,
    operationSnapshots: [],
    lastOperationSnapshotId: '',
    rootSnapshotId: '',
    root: {
      snapshotId: '',
      running: false,
      taskId: '',
      hideAiLayer: false,
      status: '',
      error: '',
      updatedAt: 0,
    },
    modules: {
      'login-ai': {
        snapshotId: '',
        running: false,
        taskId: '',
        rootPendingActionId: '',
        status: '',
        error: '',
        hideResults: false,
        lastAction: '',
        updatedAt: 0,
        topupHighlight: null,
      },
    },
    snapshots: [],
    rootSnapshots: [],
    hasModuleSkeleton: true,
  };
  const calls = {
    clearAllTopups: 0,
    clearModuleTopups: [],
    clearDeleteHistory: 0,
    renders: 0,
    persists: [],
  };
  let nowValue = 1000;

  function clone(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  const controller = controllerFactory.create({
    state: state,
    rootActions: { ROLLBACK: 'root-rollback' },
    cloneJson: clone,
    cloneSelectionMap: function(value) { return clone(value, {}); },
    restoreSelectionMap: function(value) { return clone(value, {}); },
    ensureState: function() { return xmindState; },
    ensureModuleUiState: function(id) {
      if (!xmindState.modules[id]) xmindState.modules[id] = {};
      return xmindState.modules[id];
    },
    clearAllTopupHighlights: function() { calls.clearAllTopups += 1; },
    clearModuleTopupHighlight: function(moduleState) {
      calls.clearModuleTopups.push(moduleState);
      moduleState.topupHighlight = null;
    },
    clearDeleteHistoryStacks: function() { calls.clearDeleteHistory += 1; },
    syncCasesGenPageRender: function() { calls.renders += 1; },
    persistXmindState: function(immediate) { calls.persists.push(immediate); },
    now: function() { return nowValue; },
  });

  return {
    controller: controller,
    state: state,
    xmindState: xmindState,
    calls: calls,
    setNow: function(value) { nowValue = value; },
  };
}

function verifyCreateDiscardAndPointers(controllerFactory) {
  const harness = createHarness(controllerFactory);
  const rootId = harness.controller.createCaseGenOperationSnapshotLocal('root', '');
  assert.strictEqual(rootId, 'op-snap-1');
  assert.strictEqual(harness.xmindState.nextSnapshotId, 2);
  assert.strictEqual(harness.xmindState.lastOperationSnapshotId, rootId);
  assert.strictEqual(harness.xmindState.rootSnapshotId, rootId);
  assert.strictEqual(harness.xmindState.root.snapshotId, rootId);
  assert.strictEqual(harness.xmindState.root.updatedAt, 1000);

  const rootSnapshot = harness.xmindState.operationSnapshots[0];
  harness.state.caseGenModules[0].title = '已修改模块';
  harness.state.caseGenResults['login-ai'][0].title = '已修改用例';
  assert.strictEqual(rootSnapshot.caseGenModules[0].title, '登录模块');
  assert.strictEqual(rootSnapshot.caseGenResults['login-ai'][0].title, '登录成功');

  harness.setNow(2000);
  const moduleId = harness.controller.createCaseGenOperationSnapshotLocal('module', 'login-ai');
  assert.strictEqual(moduleId, 'op-snap-2');
  assert.strictEqual(harness.xmindState.rootSnapshotId, '');
  assert.strictEqual(harness.xmindState.root.snapshotId, '');
  assert.strictEqual(harness.xmindState.modules['login-ai'].snapshotId, moduleId);
  assert.strictEqual(harness.controller.getLatestCaseGenOperationSnapshotLocal().id, moduleId);

  assert.strictEqual(harness.controller.discardCaseGenOperationSnapshotLocal('missing'), false);
  assert.strictEqual(harness.controller.discardCaseGenOperationSnapshotLocal(moduleId), true);
  assert.strictEqual(harness.xmindState.lastOperationSnapshotId, rootId);
  assert.strictEqual(harness.xmindState.root.snapshotId, rootId);
  assert.strictEqual(harness.xmindState.modules['login-ai'].snapshotId, '');
}

function verifyRollback(controllerFactory) {
  const harness = createHarness(controllerFactory);
  const snapshotId = harness.controller.createCaseGenOperationSnapshotLocal('module', 'login-ai');
  harness.state.caseGenModules = [{ id: 'order-ai', title: '订单模块' }];
  harness.state.caseGenResults = { 'order-ai': [{ title: '下单成功' }] };
  harness.state.caseSelections = {};
  harness.state.caseGenSource = 'changed';
  harness.xmindState.root.running = true;
  harness.xmindState.root.taskId = 'root-task';
  harness.xmindState.root.status = '生成中';
  harness.xmindState.modules['login-ai'].running = true;
  harness.xmindState.modules['login-ai'].taskId = 'module-task';
  harness.xmindState.modules['login-ai'].status = '生成中';
  harness.xmindState.modules['login-ai'].hideResults = true;

  harness.setNow(3000);
  assert.strictEqual(harness.controller.rollbackCaseGenOperationSnapshotLocal(snapshotId), true);
  assert.strictEqual(harness.state.caseGenModules[0].title, '登录模块');
  assert.strictEqual(harness.state.caseGenResults['login-ai'][0].title, '登录成功');
  assert.strictEqual(harness.state.caseSelections['login-ai'].selected, true);
  assert.strictEqual(harness.state.caseGenSource, 'xmind');
  assert.strictEqual(harness.xmindState.operationSnapshots.length, 0);
  assert.strictEqual(harness.xmindState.root.lastAction, 'root-rollback');
  assert.strictEqual(harness.xmindState.root.running, false);
  assert.strictEqual(harness.xmindState.root.taskId, '');
  assert.strictEqual(harness.xmindState.modules['login-ai'].lastAction, 'rollback');
  assert.strictEqual(harness.xmindState.modules['login-ai'].hideResults, false);
  assert.deepStrictEqual(harness.calls.persists, [true]);
  assert.strictEqual(harness.calls.renders, 1);
  assert.strictEqual(harness.calls.clearDeleteHistory, 1);
  assert.strictEqual(harness.calls.clearAllTopups, 1);
  assert.strictEqual(harness.controller.rollbackCaseGenOperationSnapshotLocal(snapshotId), false);
}

function verifyGlobalSnapshotAliases(controllerFactory) {
  const harness = createHarness(controllerFactory);
  assert.strictEqual(harness.controller.snapshotAllCaseGenStateLocal(), 'op-snap-1');
  harness.state.caseGenModules = [];
  assert.strictEqual(harness.controller.rollbackAllCaseGenStateLocal(), true);
  assert.strictEqual(harness.state.caseGenModules.length, 1);
  assert.strictEqual(harness.controller.rollbackAllCaseGenStateLocal(), false);
}

function verifyDeleteInvalidation(controllerFactory) {
  const harness = createHarness(controllerFactory);
  harness.xmindState.snapshots = [{ id: 'legacy-module' }];
  harness.xmindState.rootSnapshots = [{ id: 'legacy-root' }];
  harness.xmindState.operationSnapshots = [{ id: 'op-snap-1' }];
  harness.xmindState.lastOperationSnapshotId = 'op-snap-1';
  harness.xmindState.rootSnapshotId = 'op-snap-1';
  harness.xmindState.root = Object.assign(harness.xmindState.root, {
    snapshotId: 'op-snap-1',
    running: true,
    taskId: 'root-task',
    hideAiLayer: true,
    status: '生成中',
    error: 'err',
  });
  harness.xmindState.modules['login-ai'] = Object.assign(harness.xmindState.modules['login-ai'], {
    snapshotId: 'op-snap-1',
    running: true,
    taskId: 'module-task',
    rootPendingActionId: 'root-action',
    status: '生成中',
    error: 'err',
    hideResults: true,
    topupHighlight: { active: true },
  });

  harness.controller.invalidateDeleteConflictingSnapshots();
  assert.deepStrictEqual(harness.xmindState.snapshots, []);
  assert.deepStrictEqual(harness.xmindState.rootSnapshots, []);
  assert.deepStrictEqual(harness.xmindState.operationSnapshots, []);
  assert.strictEqual(harness.xmindState.root.running, false);
  assert.strictEqual(harness.xmindState.root.hideAiLayer, false);
  assert.strictEqual(harness.xmindState.modules['login-ai'].running, false);
  assert.strictEqual(harness.xmindState.modules['login-ai'].hideResults, false);
  assert.strictEqual(harness.calls.clearModuleTopups.length, 1);
  assert.strictEqual(harness.calls.clearAllTopups, 1);
}

function verifyStaleModuleCleanup(controllerFactory) {
  const harness = createHarness(controllerFactory);
  harness.xmindState.modules['stale-ai'] = { running: false };
  harness.xmindState.snapshots = [
    { id: 'keep-existing', moduleId: 'login-ai', moduleExistsBefore: true },
    { id: 'drop-stale', moduleId: 'stale-ai', moduleExistsBefore: true },
    { id: 'keep-new', moduleId: 'stale-ai', moduleExistsBefore: false },
    { id: 'drop-root-without-module', moduleId: '', moduleExistsBefore: false },
  ];
  harness.controller.clearStaleModuleUiState();
  assert.strictEqual(harness.xmindState.modules['stale-ai'], undefined);
  assert.deepStrictEqual(harness.xmindState.snapshots.map(function(item) { return item.id; }), [
    'keep-existing',
    'keep-new',
  ]);
}

function verifyOwnershipAndLoadOrder() {
  const repoRoot = path.join(__dirname, '..', '..');
  const parentSource = fs.readFileSync(path.join(repoRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  const ownerSource = fs.readFileSync(
    path.join(repoRoot, 'scripts/modules/xmindCasegen/xmindCasegenSnapshotController.js'),
    'utf8'
  );
  assert.match(ownerSource, /function createCaseGenOperationSnapshotLocal\(/);
  assert.match(ownerSource, /function rollbackCaseGenOperationSnapshotLocal\(/);
  assert.match(ownerSource, /function invalidateDeleteConflictingSnapshots\(/);
  assert.doesNotMatch(parentSource, /function createCaseGenOperationSnapshotLocal\(/);
  assert.doesNotMatch(parentSource, /function rollbackCaseGenOperationSnapshotLocal\(/);
  assert.doesNotMatch(parentSource, /function invalidateDeleteConflictingSnapshots\(/);
  assert.match(parentSource, /var createCaseGenOperationSnapshotLocal = snapshotController\.createCaseGenOperationSnapshotLocal;/);
  assert.match(parentSource, /var invalidateDeleteConflictingSnapshots = snapshotController\.invalidateDeleteConflictingSnapshots;/);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    const html = fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
    const snapshotIndex = html.indexOf('xmindCasegenSnapshotController.js');
    const operationIndex = html.indexOf('xmindCasegenOperationController.js');
    const historyIndex = html.indexOf('xmindCasegenHistoryModel.js');
    const parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(snapshotIndex >= 0, fileName + ' must load the snapshot owner');
    assert.ok(operationIndex > snapshotIndex, fileName + ' must load snapshot before operation');
    assert.ok(historyIndex > snapshotIndex, fileName + ' must load snapshot before history');
    assert.ok(parentIndex > snapshotIndex, fileName + ' must load snapshot before xmindCasegen.js');
  });
}

function run() {
  const controllerFactory = require(ownerPath);
  verifyCreateDiscardAndPointers(controllerFactory);
  verifyRollback(controllerFactory);
  verifyGlobalSnapshotAliases(controllerFactory);
  verifyDeleteInvalidation(controllerFactory);
  verifyStaleModuleCleanup(controllerFactory);
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen snapshot controller tests passed');
}

run();
