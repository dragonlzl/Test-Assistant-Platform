'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenGenerationCompletionController.js'
));

var ROOT_ACTIONS = {
  FULL_CASES: 'root-full-cases',
  FULL_MODULES: 'root-full-modules',
  REGENERATE_MODULES: 'root-regenerate-modules',
  EXISTING_CASES: 'root-existing-cases',
  TOPUP_MODULES: 'root-topup-modules',
  TOPUP_MODULES_CASES: 'root-topup-modules-cases',
  APPEND_ALL: 'root-append-all',
};
var MODULE_ACTIONS = {
  FULL_CASES: 'module-full-cases',
  APPEND: 'module-append',
};

function createHarness(overrides) {
  var calls = {
    commits: [],
    discarded: [],
    histories: [],
    notices: [],
    persists: 0,
    renders: [],
    syncs: 0,
  };
  var rootState = { running: true, taskId: 'task-root', hideAiLayer: false };
  var moduleState = { running: true, taskId: 'task-module', hideResults: true };
  var state = { rootSnapshotId: 'root-snapshot', mode: 'full' };
  var controller = controllerFactory.create(Object.assign({
    rootActions: ROOT_ACTIONS,
    moduleActions: MODULE_ACTIONS,
    cloneJson: function(value, fallback) {
      try { return JSON.parse(JSON.stringify(value)); } catch (err) { return fallback; }
    },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    normalizeFallbackCaseList: function(value) { return Array.isArray(value) ? value.slice() : []; },
    normalizeUniqueStringList: function(value) { return Array.isArray(value) ? value.slice() : []; },
    normalizeHistoryDiagnostics: function(value) { return Array.isArray(value) ? value.slice() : []; },
    summarizeModelOutputText: function(value) { return String(value || ''); },
    createOperationContract: function(actionId) { return { actionId: actionId }; },
    normalizeModelModulesOutputDetailed: function() { return { list: [], diagnostics: [] }; },
    filterModulesByContract: function(list) { return { list: list || [], diagnostics: [] }; },
    buildVisibleModuleContext: function() {
      return {
        list: [{ aiModuleId: 'module-1', moduleKey: 'login', title: '登录', aiModule: {} }],
        map: { login: { aiModuleId: 'module-1', moduleKey: 'login', title: '登录', aiModule: {} } },
      };
    },
    ensureVisibleModuleContext: function(value) { return value || { list: [], map: {} }; },
    evaluateRootCoverageGaps: function() { return { shouldRetry: false }; },
    tryStartRootCoverageRetry: function() { return false; },
    applyRootOutput: function() {
      return { changed: true, createdModules: 2, addedCases: 4, details: [{ module: '登录', caseCount: 4 }], diagnostics: [] };
    },
    buildCoverageRetryHistoryDiagnostics: function() { return []; },
    buildRootNoChangeInfo: function() {
      return { resultKind: 'no-change', reasonText: '没有有效结果', diagnostics: [], previewText: '' };
    },
    buildModuleNoChangeInfo: function() {
      return { resultKind: 'no-change', reasonText: '没有有效用例', diagnostics: [], previewText: '' };
    },
    resolveModuleTaskResult: function() {
      return {
        normalizedOutput: { diagnostics: [] },
        filtered: { diagnostics: [] },
        targetOutput: {},
        visibleCases: [{ title: '旧用例' }],
        nextList: [{ title: '旧用例' }, { title: '新用例' }],
        appended: [{ title: '新用例' }],
        mergeDiagnostics: [],
      };
    },
    resolveTaskModuleEntry: function() {
      return { aiModuleId: 'module-1', moduleKey: 'login', title: '登录', aiModule: {} };
    },
    getAiCasesForModule: function() { return [{ title: '旧用例' }]; },
    commitCaseList: function(moduleId, list) { calls.commits.push({ moduleId: moduleId, list: list }); },
    ensureState: function() { return state; },
    ensureRootUiState: function() { return rootState; },
    ensureModuleUiState: function() { return moduleState; },
    getManagedTaskAnchorNodeId: function() { return 'root'; },
    getTaskModelRequestDurationMs: function() { return 120; },
    getRootHistoryActionLabel: function() { return '根节点生成'; },
    getModuleHistoryActionLabel: function() { return '模块生成'; },
    getGenerationFailureLabel: function() { return '生成失败'; },
    getTaskErrorMessage: function(task, err) { return err && err.message ? err.message : '失败'; },
    buildGenerationCancelledInfo: function() {
      return { resultKind: 'cancelled', reasonText: '用户中断', diagnostics: [], previewText: '' };
    },
    buildGenerationErrorInfo: function(err) {
      return { resultKind: 'error', reasonText: err.message, diagnostics: [], previewText: '' };
    },
    shouldSuppressTaskCancelToast: function() { return false; },
    recordGenerationHistory: function(payload) { calls.histories.push(payload); },
    notifyStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    notifyFloatingStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    discardCaseGenOperationSnapshotEntry: function(snapshotId) { calls.discarded.push(snapshotId); },
    rollbackCaseGenOperationSnapshotEntry: function() {},
    removeAiModuleRecord: function() {},
    markOpenButtonCompletionNotice: function() {},
    clearRootPendingModules: function() {},
    setAllModuleResultsVisibility: function() {},
    setModuleTopupHighlight: function() {},
    clearModuleTopupHighlight: function() {},
    clearModuleRootPendingAction: function() {},
    clearDeleteHistoryStacks: function() {},
    syncCasesGenPageRender: function() { calls.syncs += 1; },
    isDrawerOpen: function() { return true; },
    queueTerminalMindRender: function(options) { calls.renders.push(options); },
    persistManagedTaskWorkspaceState: function() { calls.persists += 1; },
    ensureRootPipelineStateFromTask: function() { return null; },
  }, overrides || {}));
  return { calls: calls, controller: controller, moduleState: moduleState, rootState: rootState, state: state };
}

function verifyRootSuccessAndNoChange() {
  var success = createHarness();
  assert.strictEqual(success.controller.completeRootTaskSuccess({
    id: 'root-success',
    scope: 'root',
    actionId: ROOT_ACTIONS.FULL_MODULES,
    resultRaw: '{}',
  }), true);
  assert.strictEqual(success.rootState.running, false);
  assert.strictEqual(success.state.mode, 'modules');
  assert.strictEqual(success.calls.histories.length, 1);
  assert.strictEqual(success.calls.notices[0].type, 'ok');
  assert.strictEqual(success.calls.persists, 1);

  var noChange = createHarness({
    applyRootOutput: function() {
      return { changed: false, createdModules: 0, addedCases: 0, details: [], diagnostics: [] };
    },
  });
  assert.strictEqual(noChange.controller.completeRootTaskSuccess({
    id: 'root-empty',
    scope: 'root',
    actionId: ROOT_ACTIONS.FULL_CASES,
    snapshotId: 'snapshot-empty',
  }), false);
  assert.deepStrictEqual(noChange.calls.discarded, ['snapshot-empty']);
  assert.strictEqual(noChange.calls.histories[0].resultKind, 'no-change');
  assert.strictEqual(noChange.calls.notices[0].type, 'warn');
}

function verifyModuleSuccessAndCancellation() {
  var success = createHarness();
  assert.strictEqual(success.controller.completeModuleTaskSuccess({
    id: 'module-success',
    scope: 'module',
    moduleId: 'module-1',
    moduleTitle: '登录',
    actionId: MODULE_ACTIONS.APPEND,
  }), true);
  assert.strictEqual(success.calls.commits.length, 1);
  assert.strictEqual(success.calls.histories[0].details[0].caseCount, 1);
  assert.strictEqual(success.moduleState.running, false);

  var cancelled = createHarness();
  assert.strictEqual(cancelled.controller.completeModuleTaskError({
    id: 'module-cancelled',
    scope: 'module',
    moduleId: 'module-1',
    moduleTitle: '登录',
    actionId: MODULE_ACTIONS.FULL_CASES,
  }, null, { resultKind: 'cancelled' }), false);
  assert.strictEqual(cancelled.calls.histories[0].resultKind, 'cancelled');
  assert.strictEqual(cancelled.calls.notices[0].type, 'warn');
  assert.strictEqual(cancelled.moduleState.status, '');
}

async function verifyFullCasesPipelinePreservesDiscoveryFallbackCases() {
  var pipeline = {
    id: 'pipeline-full-cases',
    actionId: ROOT_ACTIONS.FULL_CASES,
    createdModules: 0,
    moduleTaskTotal: 0,
    moduleTaskCompleted: 0,
    moduleTaskCompletedKeys: [],
  };
  var moduleEntry = {
    aiModuleId: 'module-login',
    moduleKey: '登录',
    title: '登录',
    aiModule: {},
  };
  var startedDescriptors = [];
  var discoveredModules = [{
    module: '登录',
    key_scenarios: ['登录成功'],
    test_points: ['状态校验'],
    coupled_modules: [],
    cases: [{ module: '登录', title: '登录成功首轮备用用例' }],
  }];
  var harness = createHarness({
    createOperationContract: function() {
      return {
        scope: 'root',
        mode: 'full_cases',
        allowNewModules: true,
        generateCasesForNewModules: false,
        generateCasesForExistingModules: false,
      };
    },
    normalizeModelModulesOutputDetailed: function() {
      return { list: discoveredModules, diagnostics: [] };
    },
    filterModulesByContract: function(list, contract) {
      return {
        list: list.map(function(item) {
          return Object.assign({}, item, {
            cases: contract.generateCasesForNewModules === true ? item.cases.slice() : [],
          });
        }),
        diagnostics: [],
      };
    },
    buildVisibleModuleContext: function() {
      return { list: [moduleEntry], map: { '登录': moduleEntry } };
    },
    cloneModulesWithoutCases: function(list) {
      return list.map(function(item) { return Object.assign({}, item, { cases: [] }); });
    },
    applyRootOutput: function() {
      return { changed: true, createdModules: 1, addedCases: 0, details: [], diagnostics: [] };
    },
    ensureRootPipelineStateFromTask: function() { return pipeline; },
    updateRootPipelineState: function(updater) { updater(pipeline); return pipeline; },
    getRootPipelineState: function() { return pipeline; },
    normalizeRootPipelineDedupeModules: function(value) { return value; },
    mergeRootPipelineDetails: function() {},
    startRootPipelineModuleTasks: function(currentPipeline, descriptors) {
      assert.strictEqual(currentPipeline, pipeline);
      startedDescriptors = descriptors;
      return Promise.resolve(descriptors.length);
    },
  });

  assert.strictEqual(await harness.controller.completeRootTaskSuccess({
    id: 'root-discovery',
    scope: 'root',
    actionId: ROOT_ACTIONS.FULL_CASES,
    rootPipelineId: pipeline.id,
    pipelineStage: 'discovery',
    workspaceId: 'workspace-1',
    resultRaw: '{}',
  }), true);
  assert.strictEqual(startedDescriptors.length, 1);
  assert.deepStrictEqual(startedDescriptors[0].fallbackCases, discoveredModules[0].cases);
}

async function verifyPipelineGuardAndOwnership() {
  var harness = createHarness();
  assert.strictEqual(await harness.controller.completeRootTaskSuccess({
    id: 'pipeline-missing',
    scope: 'root',
    rootPipelineId: 'pipeline-1',
    pipelineStage: 'discovery',
  }), false);

  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'handleRootPipelineDiscoveryTaskSuccess',
    'handleRootPipelineDiscoveryTaskError',
    'handleRootPipelineModuleTaskSuccess',
    'handleRootPipelineModuleTaskError',
    'completeRootTaskSuccess',
    'completeRootTaskError',
    'completeModuleTaskSuccess',
    'completeModuleTaskError',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by the generation completion controller');
  });
  assert.ok(/generationCompletionControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenGenerationCompletionController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load generation completion before xmindCasegen');
  });
}

verifyRootSuccessAndNoChange();
verifyModuleSuccessAndCancellation();
verifyFullCasesPipelinePreservesDiscoveryFallbackCases()
  .then(verifyPipelineGuardAndOwnership)
  .then(function() {
  console.log('xmind casegen generation completion controller tests passed');
}).catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
