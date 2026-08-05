'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenGenerationExecutionController.js'
));

var ROOT_ACTIONS = {
  FULL_CASES: 'root-full-cases',
  FULL_MODULES: 'root-full-modules',
  REGENERATE_MODULES: 'root-regenerate-modules',
  EXISTING_CASES: 'root-existing-cases',
  TOPUP_MODULES: 'root-topup-modules',
  TOPUP_MODULES_CASES: 'root-topup-modules-cases',
  APPEND_ALL: 'root-append-all',
  ROLLBACK: 'root-rollback',
};
var MODULE_ACTIONS = {
  FULL_CASES: 'module-full-cases',
  APPEND: 'module-append',
  ROLLBACK: 'module-rollback',
};

function clone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return fallback;
  }
}

function createHarness(overrides) {
  var pipeline = null;
  var rootState = {};
  var moduleStates = {};
  var entries = [
    { aiModuleId: 'module-a', moduleKey: 'module-a', title: '模块 A', aiModule: {} },
    { aiModuleId: 'module-b', moduleKey: 'module-b', title: '模块 B', aiModule: {} },
    { aiModuleId: 'module-c', moduleKey: 'module-c', title: '模块 C', aiModule: {} },
  ];
  var calls = {
    clearedPipelines: 0,
    completedModuleErrors: [],
    completedRootErrors: [],
    deleted: [],
    hiddenMenus: 0,
    inputModules: [],
    notices: [],
    payloads: [],
    persists: 0,
    renders: [],
    snapshots: [],
  };
  var idSequence = 0;
  var context = {
    list: entries,
    map: {
      'module-a': entries[0],
      'module-b': entries[1],
      'module-c': entries[2],
    },
  };
  var baseOptions = {
    rootActions: ROOT_ACTIONS,
    moduleActions: MODULE_ACTIONS,
    casesGenApi: {
      snapshotAllCaseGenState: function() { calls.snapshots.push('root'); return 'snapshot-root'; },
      snapshotModuleCases: function(moduleId) { calls.snapshots.push(moduleId); return 'snapshot-' + moduleId; },
      rollbackAllCaseGenState: function() { return true; },
      rollbackModuleCases: function() { return true; },
    },
    cloneJson: clone,
    getActiveWorkspaceId: function() { return 'workspace-1'; },
    getRootNodeId: function() { return 'root-node'; },
    getModuleNodeId: function(entry) { return entry ? 'node-' + entry.moduleKey : ''; },
    generateLocalId: function(prefix) { idSequence += 1; return prefix + '-' + String(idSequence); },
    createCaseGenOperationSnapshotLocal: function(scope, moduleId) { return 'local-' + scope + '-' + moduleId; },
    snapshotAllCaseGenStateLocal: function() { return 'snapshot-root-local'; },
    rollbackAllCaseGenStateLocal: function() { return true; },
    getLatestCaseGenOperationSnapshotLocal: function() { return null; },
    rollbackCaseGenOperationSnapshotLocal: function() { return true; },
    ensureAiModuleRecord: function(title, raw, moduleId) { return { id: moduleId, module: title }; },
    ensureRootUiState: function() { return rootState; },
    ensureModuleUiState: function(moduleId) {
      moduleStates[moduleId] = moduleStates[moduleId] || {};
      return moduleStates[moduleId];
    },
    ensureState: function() { return { rootSnapshotId: '' }; },
    hasAiCasesForModule: function() { return false; },
    hasAnyAiModules: function() { return false; },
    hasAnyAiCases: function() { return false; },
    getModuleHistoryActionLabel: function(actionId) { return 'module:' + actionId; },
    getRootHistoryActionLabel: function(actionId) { return 'root:' + actionId; },
    clearModuleTopupHighlight: function() {},
    clearAllTopupHighlights: function() {},
    clearDedupeOverviewSummary: function() {},
    setModuleRootPendingAction: function(state, actionId) { state.rootPendingActionId = actionId; },
    clearDeleteHistoryStacks: function() {},
    setAllModuleResultsVisibility: function() {},
    markRootPendingModules: function() {},
    flushLightweightMindStatus: function() {},
    scheduleRenderedRootMindStatusBadgeRefresh: function() {},
    queueStructureMindRender: function(options) { calls.renders.push({ kind: 'structure', options: options }); },
    queueStatusMindRender: function(options) { calls.renders.push({ kind: 'status', options: options }); },
    render: function(options) { calls.renders.push({ kind: 'render', options: options }); },
    notifyStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeFallbackCaseList: function(value) { return Array.isArray(value) ? value.slice() : []; },
    normalizeUniqueStringList: function(value) { return Array.isArray(value) ? value.slice() : []; },
    buildVisibleModuleContext: function() { return context; },
    ensureVisibleModuleContext: function(value) { return value || { list: [], map: {} }; },
    buildVisibleModuleSnapshot: function(value) {
      return (value && value.list ? value.list : []).map(function(entry) { return { module: entry.title }; });
    },
    getGenerationPayloadCore: function() {
      return {
        buildCompactVisibleModules: function(value) { return { compact: value }; },
      };
    },
    createOperationContract: function(actionId) { return { actionId: actionId }; },
    applyImportedBaselineCompletionPolicy: function(contract) { contract.importedBaseline = true; return contract; },
    applyExistingCasesCompletionPolicy: function(contract) { contract.existingCases = true; return contract; },
    buildXmindGenerationTaskInput: function(contract, visibleContext, moduleEntry) {
      calls.inputModules.push(moduleEntry ? moduleEntry.moduleKey : 'root');
      return Promise.resolve({ contract: contract, visibleContext: visibleContext });
    },
    buildModuleTaskPayload: function(entry, actionId, input, meta) {
      return Object.assign({ kind: 'module', actionId: actionId, input: input }, meta || {});
    },
    buildRootTaskPayload: function(actionId, input, meta) {
      return Object.assign({ kind: 'root', actionId: actionId, input: input }, meta || {});
    },
    startManagedXmindTask: function(payload) {
      calls.payloads.push(payload);
      return { id: 'task-' + String(calls.payloads.length) };
    },
    persistXmindState: function() { calls.persists += 1; },
    completeModuleTaskError: function(meta, err) {
      calls.completedModuleErrors.push({ meta: meta, error: err });
      if (meta && meta.moduleId && moduleStates[meta.moduleId]) moduleStates[meta.moduleId].running = false;
      return false;
    },
    completeRootTaskError: function(meta, err) {
      calls.completedRootErrors.push({ meta: meta, error: err });
      rootState.running = false;
      return false;
    },
    createRootPipelineState: function(value) {
      return Object.assign({ id: 'pipeline-1', pendingQueue: [] }, value || {});
    },
    getRootPipelineState: function() { return pipeline; },
    setRootPipelineState: function(value) { pipeline = value; return pipeline; },
    clearRootPipelineState: function() { calls.clearedPipelines += 1; pipeline = null; },
    updateRootPipelineState: function(updater) { if (pipeline) updater(pipeline); return pipeline; },
    replaceRootPipelinePendingQueue: function(pipelineId, descriptors) {
      if (pipeline && pipeline.id === pipelineId) pipeline.pendingQueue = (descriptors || []).slice();
    },
    shiftRootPipelinePendingDescriptor: function(pipelineId) {
      return pipeline && pipeline.id === pipelineId ? pipeline.pendingQueue.shift() || null : null;
    },
    resolveRootPipelineDescriptor: function(serialized, visibleContext) {
      if (!serialized) return null;
      return {
        moduleEntry: visibleContext.map[serialized.moduleKey] || null,
        actionId: serialized.actionId,
        fallbackCases: serialized.fallbackCases || [],
        rootPendingActionId: serialized.rootPendingActionId || '',
      };
    },
    collectRootPipelineRunningTasks: function() { return []; },
    appendRootPipelineDiagnostics: function(current, text) {
      current.diagnostics = (current.diagnostics || []).concat([text]);
    },
    normalizeRootPipelineTaskCount: function(value) { return Math.max(0, Number(value || 0) || 0); },
    shouldUseRootPipeline: function(actionId) { return actionId === ROOT_ACTIONS.FULL_CASES; },
    ensureActionAllowed: function() { return true; },
    ensurePrepReadyOrOpen: function() { return true; },
    hideOpenMindContextMenu: function() { calls.hiddenMenus += 1; },
    isDeleteActionId: function(actionId) { return actionId === 'delete'; },
    handleDeleteSelection: function(meta) { calls.deleted.push(meta); },
    resolveModuleEntryByMeta: function(meta) { return context.map[meta.moduleKey] || null; },
  };
  var controller = controllerFactory.create(Object.assign(baseOptions, overrides || {}));
  return {
    calls: calls,
    context: context,
    controller: controller,
    entries: entries,
    getPipeline: function() { return pipeline; },
    moduleStates: moduleStates,
    rootState: rootState,
    setPipeline: function(value) { pipeline = value; },
  };
}

async function verifyPendingQueueOrderAndFailureCompensation() {
  var attempted = [];
  var harness = createHarness({
    buildXmindGenerationTaskInput: function(contract, context, moduleEntry) {
      attempted.push(moduleEntry.moduleKey);
      if (moduleEntry.moduleKey === 'module-a') return Promise.reject(new Error('A failed to start'));
      return Promise.resolve({ contract: contract });
    },
  });
  harness.setPipeline({
    id: 'pipeline-queue',
    actionId: ROOT_ACTIONS.FULL_CASES,
    pendingQueue: [
      { moduleKey: 'module-a', actionId: MODULE_ACTIONS.FULL_CASES },
      { moduleKey: 'module-b', actionId: MODULE_ACTIONS.FULL_CASES },
    ],
  });

  assert.strictEqual(await harness.controller.pumpRootPipelineModuleQueue('pipeline-queue'), 1);
  assert.deepStrictEqual(attempted, ['module-a', 'module-b']);
  assert.strictEqual(harness.calls.completedModuleErrors.length, 1);
  assert.strictEqual(harness.calls.payloads.length, 1);
  assert.strictEqual(harness.calls.payloads[0].moduleKey, 'module-b');
  assert.strictEqual(harness.getPipeline().pendingQueue.length, 0);
}

async function verifyConcurrentDescriptorsAndFrozenSnapshot() {
  var active = 0;
  var maxActive = 0;
  var harness = createHarness({
    buildXmindGenerationTaskInput: function(contract, context, moduleEntry, options) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise(function(resolve) {
        setTimeout(function() {
          active -= 1;
          resolve({ contract: contract, frozen: options.visibleModulesSnapshot });
        }, 5);
      });
    },
  });
  var descriptors = harness.entries.map(function(entry) {
    return { moduleEntry: entry, actionId: MODULE_ACTIONS.FULL_CASES };
  });
  var pipeline = { id: 'pipeline-batch', actionId: ROOT_ACTIONS.FULL_CASES };
  harness.setPipeline(pipeline);

  assert.strictEqual(await harness.controller.startRootPipelineModuleTasks(pipeline, descriptors), 3);
  assert.strictEqual(maxActive, 3);
  assert.strictEqual(harness.calls.payloads.length, 3);
  harness.calls.payloads.forEach(function(payload) {
    assert.ok(payload.input.frozen && Array.isArray(payload.input.frozen.compact));
  });
  assert.strictEqual(pipeline.moduleTaskTotal, 3);
}

async function verifyRootBranchesAndStartFailure() {
  var pipelineHarness = createHarness();
  assert.strictEqual(await pipelineHarness.controller.runRootAction(ROOT_ACTIONS.FULL_CASES), true);
  assert.strictEqual(pipelineHarness.calls.payloads.length, 1);
  assert.strictEqual(pipelineHarness.calls.payloads[0].pipelineStage, 'discovery');
  assert.strictEqual(pipelineHarness.calls.payloads[0].rootPipelineId, 'pipeline-1');

  var directHarness = createHarness();
  assert.strictEqual(await directHarness.controller.runRootAction(ROOT_ACTIONS.FULL_MODULES), true);
  assert.strictEqual(directHarness.calls.payloads[0].pipelineStage, undefined);

  var failedHarness = createHarness({
    buildXmindGenerationTaskInput: function() { return Promise.reject(new Error('root input failed')); },
  });
  assert.strictEqual(await failedHarness.controller.runRootAction(ROOT_ACTIONS.FULL_CASES), false);
  assert.strictEqual(failedHarness.calls.completedRootErrors.length, 1);
  assert.strictEqual(failedHarness.calls.clearedPipelines, 1);
}

async function verifyBusyGuardsRollbackAndDispatch() {
  var guarded = createHarness({ ensureActionAllowed: function() { return false; } });
  assert.strictEqual(await guarded.controller.runRootAction(ROOT_ACTIONS.FULL_MODULES), false);
  assert.strictEqual(await guarded.controller.runModuleAction(guarded.entries[0], MODULE_ACTIONS.FULL_CASES), false);
  assert.strictEqual(guarded.calls.snapshots.length, 0);

  var rollback = createHarness();
  assert.strictEqual(await rollback.controller.runRootAction(ROOT_ACTIONS.ROLLBACK), true);
  assert.strictEqual(await rollback.controller.runModuleAction(rollback.entries[0], MODULE_ACTIONS.ROLLBACK), true);
  assert.strictEqual(rollback.calls.renders.filter(function(item) { return item.kind === 'render'; }).length, 2);

  assert.strictEqual(rollback.controller.handleNodeAction('delete', { nodeId: 'case-1' }), true);
  assert.strictEqual(rollback.calls.hiddenMenus, 1);
  assert.strictEqual(rollback.calls.deleted.length, 1);
}

function verifyOwnershipAndLoadingOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'startManagedModuleTask',
    'pumpRootPipelineModuleQueue',
    'startRootPipelineModuleTasks',
    'startRootPipeline',
    'runRootAction',
    'runModuleAction',
    'handleNodeAction',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by generation execution controller');
  });
  assert.ok(/generationExecutionControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenGenerationExecutionController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load generation execution before xmindCasegen');
  });
}

verifyPendingQueueOrderAndFailureCompensation()
  .then(verifyConcurrentDescriptorsAndFrozenSnapshot)
  .then(verifyRootBranchesAndStartFailure)
  .then(verifyBusyGuardsRollbackAndDispatch)
  .then(function() {
    verifyOwnershipAndLoadingOrder();
    console.log('xmind casegen generation execution controller tests passed');
  })
  .catch(function(err) {
    console.error(err);
    process.exitCode = 1;
  });
