const assert = require('assert');
const fs = require('fs');
const path = require('path');
const controllerFactory = require('../../scripts/modules/xmindCasegen/xmindCasegenOperationController.js');

const ROOT_ACTIONS = {
  FULL_CASES: 'root-full-cases',
  FULL_MODULES: 'root-full-modules',
  REGENERATE_MODULES: 'root-regenerate-modules',
  EXISTING_CASES: 'root-existing-cases',
  TOPUP_MODULES: 'root-topup-modules',
  TOPUP_MODULES_CASES: 'root-topup-modules-cases',
  APPEND_ALL: 'root-append-all',
  ROLLBACK: 'root-rollback',
};
const MODULE_ACTIONS = {
  FULL_CASES: 'module-full-cases',
  APPEND: 'module-append',
  ROLLBACK: 'module-rollback',
};

function createHarness(overrides) {
  const state = {
    caseGenModules: [
      { id: 'login-ai', title: '登录模块' },
      { id: 'order-ai', title: '订单模块' },
    ],
  };
  const aiCases = {
    'login-ai': [{ title: '登录成功' }],
    'order-ai': [],
  };
  const moduleUi = {};
  const localCalls = { get: 0, rollback: [], discard: [] };
  let managedTasks = null;
  let rootUi = {};
  let rootPipeline = null;
  let dedupeUi = {};
  let coverageUi = {};
  let operationSnapshot = null;
  let hasBaseline = false;

  const options = Object.assign({
    state: state,
    rootActions: ROOT_ACTIONS,
    moduleActions: MODULE_ACTIONS,
    getActiveWorkspaceId: function() { return 'workspace-a'; },
    getManagedXmindTaskListIfReady: function() { return managedTasks; },
    filterTasksByWorkspace: function(list, workspaceId) {
      return list.filter(function(task) { return task.workspaceId === workspaceId; });
    },
    ensureRootUiState: function() { return rootUi; },
    getRootPipelineState: function() { return rootPipeline; },
    isRootGenerationVisuallyRunning: function(value) { return value && value.running === true; },
    ensureDedupeUiState: function() { return dedupeUi; },
    normalizeDedupeMode: function(value) { return String(value || '').toLowerCase(); },
    ensureCoverageUiState: function() { return coverageUi; },
    ensureState: function() { return { modules: moduleUi }; },
    findAiModuleById: function(id) {
      return state.caseGenModules.filter(function(moduleRecord) {
        return moduleRecord.id === id;
      })[0] || null;
    },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    getAiCasesForModule: function(id) { return (aiCases[id] || []).slice(); },
    ensureModuleUiState: function(id) {
      if (!moduleUi[id]) moduleUi[id] = {};
      return moduleUi[id];
    },
    getDedupeRunningLabel: function(mode) { return mode === 'dedupe_simplify' ? 'AI用例去重与精简中' : 'AI用例去重中'; },
    getLatestCaseGenOperationSnapshotLocal: function() {
      localCalls.get += 1;
      return operationSnapshot;
    },
    rollbackCaseGenOperationSnapshotLocal: function(id) {
      localCalls.rollback.push(id);
      return id === 'snapshot-local';
    },
    discardCaseGenOperationSnapshotLocal: function(id) {
      localCalls.discard.push(id);
      return id === 'snapshot-local';
    },
    hasVisibleImportedBaselineCases: function() { return hasBaseline; },
    getVisibleCasesForModuleEntry: function(entry) { return entry.visibleCases || []; },
    now: function() { return 1000; },
  }, overrides || {});

  return {
    controller: controllerFactory.create(options),
    state: state,
    aiCases: aiCases,
    moduleUi: moduleUi,
    localCalls: localCalls,
    setManagedTasks: function(value) { managedTasks = value; },
    setRootUi: function(value) { rootUi = value; },
    setRootPipeline: function(value) { rootPipeline = value; },
    setDedupeUi: function(value) { dedupeUi = value; },
    setCoverageUi: function(value) { coverageUi = value; },
    setOperationSnapshot: function(value) { operationSnapshot = value; },
    setHasBaseline: function(value) { hasBaseline = value === true; },
  };
}

function actionIds(actions) {
  return actions.map(function(action) { return action.id; });
}

function findAction(actions, id) {
  return actions.filter(function(action) { return action.id === id; })[0] || null;
}

function verifyManagedTaskProjection() {
  const harness = createHarness();
  harness.setManagedTasks([
    { workspaceId: 'workspace-a', status: 'running', scope: 'root', rootPipelineActionId: ROOT_ACTIONS.FULL_CASES },
    { workspaceId: 'workspace-a', status: 'running', scope: 'module', actionId: MODULE_ACTIONS.APPEND, moduleId: 'login-ai', moduleKey: 'login', moduleTitle: '登录模块' },
    { workspaceId: 'workspace-a', status: 'running', scope: 'dedupe', dedupeMode: 'DEDUPE_SIMPLIFY', modelRequestBatchCompleted: 1, modelRequestBatchTotal: 3 },
    { workspaceId: 'workspace-a', status: 'running', scope: 'coverage' },
    { workspaceId: 'workspace-a', status: 'success', scope: 'root', actionId: ROOT_ACTIONS.FULL_MODULES },
    { workspaceId: 'workspace-b', status: 'running', scope: 'root', actionId: ROOT_ACTIONS.FULL_MODULES },
  ]);
  assert.deepStrictEqual(harness.controller.collectRunningGenerationOperations(), [
    { scope: 'root', actionId: ROOT_ACTIONS.FULL_CASES, label: '根节点' },
    { scope: 'module', actionId: MODULE_ACTIONS.APPEND, moduleId: 'login-ai', moduleKey: 'login', label: '登录模块' },
    { scope: 'dedupe', actionId: 'xmind-ai-dedupe', dedupeMode: 'dedupe_simplify', batchCompleted: 1, batchTotal: 3, label: 'AI用例去重' },
    { scope: 'coverage', actionId: 'xmind-requirement-coverage', label: '需求覆盖分析' },
  ]);

  harness.setRootUi({ running: true, lastAction: ROOT_ACTIONS.APPEND_ALL });
  harness.setManagedTasks([]);
  assert.deepStrictEqual(harness.controller.collectRunningGenerationOperations(), []);
}

function verifyUiFallbackProjection() {
  const harness = createHarness();
  harness.setRootUi({ running: true, lastAction: '' });
  harness.setRootPipeline({ actionId: ROOT_ACTIONS.TOPUP_MODULES });
  harness.setDedupeUi({
    running: false,
    terminalVisualRunning: true,
    terminalVisualUntil: 1200,
    dedupeMode: 'DEDUPE_ONLY',
  });
  harness.setCoverageUi({ running: true });
  harness.moduleUi['login-ai'] = { running: true, lastAction: MODULE_ACTIONS.FULL_CASES };
  assert.deepStrictEqual(harness.controller.collectRunningGenerationOperations(), [
    { scope: 'root', actionId: ROOT_ACTIONS.TOPUP_MODULES, label: '根节点' },
    { scope: 'dedupe', actionId: 'xmind-ai-dedupe', dedupeMode: 'dedupe_only', label: 'AI用例去重' },
    { scope: 'coverage', actionId: 'xmind-requirement-coverage', label: '需求覆盖分析' },
    { scope: 'module', actionId: MODULE_ACTIONS.FULL_CASES, moduleId: 'login-ai', moduleKey: '登录模块', label: '登录模块' },
  ]);
}

function verifyConflictMatrix() {
  const harness = createHarness();
  const loginEntry = { aiModuleId: 'login-ai', moduleKey: 'login' };
  const orderEntry = { aiModuleId: 'order-ai', moduleKey: 'order' };

  harness.setManagedTasks([{ workspaceId: 'workspace-a', status: 'running', scope: 'root', actionId: ROOT_ACTIONS.FULL_CASES }]);
  assert.strictEqual(harness.controller.isActionBlocked(MODULE_ACTIONS.FULL_CASES, loginEntry), true);
  harness.setManagedTasks([{ workspaceId: 'workspace-a', status: 'running', scope: 'root', actionId: ROOT_ACTIONS.TOPUP_MODULES }]);
  assert.strictEqual(harness.controller.isActionBlocked(MODULE_ACTIONS.FULL_CASES, loginEntry), false);

  harness.setManagedTasks([{ workspaceId: 'workspace-a', status: 'running', scope: 'module', actionId: MODULE_ACTIONS.APPEND, moduleId: 'login-ai', moduleKey: 'login', moduleTitle: '登录模块' }]);
  assert.strictEqual(harness.controller.isActionBlocked(ROOT_ACTIONS.FULL_CASES, null), true);
  assert.strictEqual(harness.controller.isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES, null), false);
  assert.strictEqual(harness.controller.isActionBlocked(MODULE_ACTIONS.APPEND, loginEntry), true);
  assert.strictEqual(harness.controller.isActionBlocked(MODULE_ACTIONS.APPEND, orderEntry), false);

  harness.setManagedTasks([{ workspaceId: 'workspace-a', status: 'running', scope: 'dedupe', dedupeMode: 'dedupe_simplify' }]);
  assert.strictEqual(harness.controller.isActionBlocked(ROOT_ACTIONS.TOPUP_MODULES, null), true);
  assert.strictEqual(harness.controller.isActionBlocked(MODULE_ACTIONS.FULL_CASES, loginEntry), true);
  assert.match(harness.controller.buildBlockedActionMessage(MODULE_ACTIONS.FULL_CASES, harness.controller.resolveBlockingOperation(MODULE_ACTIONS.FULL_CASES, loginEntry)), /去重与精简中/);

  harness.setManagedTasks([{ workspaceId: 'workspace-a', status: 'running', scope: 'coverage' }]);
  assert.strictEqual(harness.controller.isActionBlocked(MODULE_ACTIONS.APPEND, orderEntry), true);
}

function verifyMenusAndLabels() {
  const emptyHarness = createHarness();
  emptyHarness.state.caseGenModules = [];
  assert.deepStrictEqual(actionIds(emptyHarness.controller.getRootActions()), [
    ROOT_ACTIONS.FULL_CASES,
    ROOT_ACTIONS.FULL_MODULES,
  ]);

  const generatedHarness = createHarness();
  generatedHarness.setOperationSnapshot({ id: 'root-snapshot', scope: 'root' });
  const generatedActions = generatedHarness.controller.getRootActions();
  assert.strictEqual(findAction(generatedActions, ROOT_ACTIONS.FULL_CASES).label, '重新生成全量用例');
  assert.strictEqual(findAction(generatedActions, ROOT_ACTIONS.ROLLBACK).disabled, false);
  assert.deepStrictEqual(actionIds(generatedActions), [
    ROOT_ACTIONS.FULL_CASES,
    ROOT_ACTIONS.REGENERATE_MODULES,
    ROOT_ACTIONS.EXISTING_CASES,
    ROOT_ACTIONS.TOPUP_MODULES,
    ROOT_ACTIONS.TOPUP_MODULES_CASES,
    ROOT_ACTIONS.ROLLBACK,
  ]);

  generatedHarness.setHasBaseline(true);
  assert.deepStrictEqual(actionIds(generatedHarness.controller.getRootActions()), [
    ROOT_ACTIONS.REGENERATE_MODULES,
    ROOT_ACTIONS.TOPUP_MODULES,
    ROOT_ACTIONS.TOPUP_MODULES_CASES,
    ROOT_ACTIONS.APPEND_ALL,
    ROOT_ACTIONS.ROLLBACK,
  ]);

  generatedHarness.setOperationSnapshot({ id: 'module-snapshot', scope: 'module', moduleId: 'login-ai' });
  const moduleActions = generatedHarness.controller.getModuleActions({
    aiModuleId: 'login-ai',
    moduleKey: 'login',
    visibleCases: [{ title: '登录成功' }],
  });
  assert.strictEqual(findAction(moduleActions, MODULE_ACTIONS.FULL_CASES).label, '重新生成全量用例');
  assert.strictEqual(findAction(moduleActions, MODULE_ACTIONS.APPEND).disabled, false);
  assert.strictEqual(findAction(moduleActions, MODULE_ACTIONS.ROLLBACK).disabled, false);
}

function verifySnapshotPortsAndVisibility() {
  const localHarness = createHarness();
  localHarness.setOperationSnapshot({ id: 'snapshot-local' });
  assert.deepStrictEqual(localHarness.controller.getLatestCaseGenOperationSnapshotEntry(), { id: 'snapshot-local' });
  assert.strictEqual(localHarness.controller.rollbackCaseGenOperationSnapshotEntry('snapshot-local'), true);
  assert.strictEqual(localHarness.controller.discardCaseGenOperationSnapshotEntry('snapshot-local'), true);
  assert.deepStrictEqual(localHarness.localCalls.rollback, ['snapshot-local']);
  assert.deepStrictEqual(localHarness.localCalls.discard, ['snapshot-local']);

  const apiCalls = { get: 0, rollback: [], discard: [] };
  const apiHarness = createHarness({
    casesGenApi: {
      getLatestCaseGenOperationSnapshot: function() { apiCalls.get += 1; return { id: 'snapshot-api' }; },
      rollbackCaseGenOperationSnapshot: function(id) { apiCalls.rollback.push(id); return true; },
      discardCaseGenOperationSnapshot: function(id) { apiCalls.discard.push(id); return true; },
    },
  });
  assert.deepStrictEqual(apiHarness.controller.getLatestCaseGenOperationSnapshotEntry(), { id: 'snapshot-api' });
  assert.strictEqual(apiHarness.controller.rollbackCaseGenOperationSnapshotEntry('snapshot-api'), true);
  assert.strictEqual(apiHarness.controller.discardCaseGenOperationSnapshotEntry('snapshot-api'), true);
  assert.strictEqual(apiHarness.localCalls.get, 0);
  assert.deepStrictEqual(apiCalls, { get: 1, rollback: ['snapshot-api'], discard: ['snapshot-api'] });

  apiHarness.controller.setModuleResultsVisibility('login-ai', false);
  assert.strictEqual(apiHarness.moduleUi['login-ai'].hideResults, true);
  assert.strictEqual(apiHarness.moduleUi['login-ai'].updatedAt, 1000);
  apiHarness.controller.setAllModuleResultsVisibility(true);
  assert.strictEqual(apiHarness.moduleUi['login-ai'].hideResults, false);
  assert.strictEqual(apiHarness.moduleUi['order-ai'].hideResults, false);
}

function verifyOwnershipAndLoadOrder() {
  const repoRoot = path.join(__dirname, '..', '..');
  const parentSource = fs.readFileSync(path.join(repoRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  const ownerSource = fs.readFileSync(
    path.join(repoRoot, 'scripts/modules/xmindCasegen/xmindCasegenOperationController.js'),
    'utf8'
  );
  assert.match(ownerSource, /function collectRunningGenerationOperations\(/);
  assert.match(ownerSource, /function resolveBlockingOperation\(/);
  assert.match(ownerSource, /function getRootActions\(/);
  assert.doesNotMatch(parentSource, /function collectRunningGenerationOperations\(/);
  assert.doesNotMatch(parentSource, /function resolveBlockingOperation\(/);
  assert.doesNotMatch(parentSource, /function getRootActions\(/);
  assert.match(parentSource, /var collectRunningGenerationOperations = operationController\.collectRunningGenerationOperations;/);
  assert.match(parentSource, /var getRootActions = operationController\.getRootActions;/);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    const html = fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
    const ownerIndex = html.indexOf('xmindCasegenOperationController.js');
    const historyIndex = html.indexOf('xmindCasegenHistoryModel.js');
    const parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the operation owner');
    assert.ok(historyIndex > ownerIndex, fileName + ' must load the operation owner before the history model');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the operation owner before xmindCasegen.js');
  });
}

function run() {
  verifyManagedTaskProjection();
  verifyUiFallbackProjection();
  verifyConflictMatrix();
  verifyMenusAndLabels();
  verifySnapshotPortsAndVisibility();
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen operation controller tests passed');
}

run();
