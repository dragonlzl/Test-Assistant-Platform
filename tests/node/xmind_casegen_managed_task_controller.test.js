'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenManagedTaskController.js'
));

function clone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return fallback;
  }
}

function mergeContext(base, incoming) {
  return Object.assign({}, base || {}, incoming || {});
}

function createHarness() {
  var tasks = [];
  var taskContexts = {};
  var listeners = [];
  var records = {
    'workspace-1': {
      id: 'workspace-1',
      generationId: 'generation-1',
      createdAt: 100,
      snapshot: { xmind: {}, shared: {} },
    },
  };
  var calls = {
    cleared: [],
    completed: [],
    contextUpdates: [],
    liveRestores: [],
    recordRestores: [],
    renders: [],
    resumed: 0,
    interrupts: 0,
    rescues: 0,
    scheduled: [],
  };
  var manager = {
    getTasks: function() { return tasks.slice(); },
    clearTask: function(taskId, reason) {
      calls.cleared.push({ taskId: taskId, reason: reason });
      tasks = tasks.filter(function(task) { return String(task.id || '') !== String(taskId || ''); });
    },
    updateTasksContext: function(updater, options) {
      var ids = options && Array.isArray(options.taskIds)
        ? options.taskIds
        : tasks.map(function(task) { return task.id; });
      var count = 0;
      tasks.forEach(function(task) {
        if (ids.indexOf(task.id) === -1) return;
        if (options && options.onlyRunning === true && task.status !== 'running') return;
        var next = clone(taskContexts[task.id] || task.restoreContext || {}, {});
        updater(next, task);
        taskContexts[task.id] = next;
        task.restoreContext = clone(next, {});
        count += 1;
      });
      calls.contextUpdates.push({ options: options, count: count });
      return count;
    },
    resumeTasks: function() { calls.resumed += 1; },
  };
  var controller = controllerFactory.create({
    cloneJson: clone,
    mergeTaskRestoreContext: mergeContext,
    mergeStoredViewState: mergeContext,
    mergeRootPipelineSnapshot: mergeContext,
    mergeRestoreResultMap: mergeContext,
    buildOperationSnapshotRestoreVersion: function(list, nextId) {
      return { list: clone(list || [], []), nextSnapshotId: Number(nextId || 1) };
    },
    shouldPreferRestoreOperationSnapshots: function(current, incoming) {
      return incoming.list.length > current.list.length;
    },
    deriveNextOperationSnapshotId: function(list, nextId) { return Number(nextId || 1); },
    createDefaultPrepState: function() { return { step: 1 }; },
    createDefaultViewState: function() { return {}; },
    createDefaultRootState: function() { return {}; },
    createDefaultCaseGenSettings: function() { return {}; },
    createEmptyRequirementMedia: function() { return {}; },
    normalizeStoredViewState: function(value) { return Object.assign({}, value || {}); },
    normalizeWorkspaceSharedState: function(value) { return Object.assign({}, value || {}); },
    normalizeWorkspaceSnapshot: function(value) {
      return {
        xmind: Object.assign({}, value && value.xmind ? value.xmind : {}),
        shared: Object.assign({}, value && value.shared ? value.shared : {}),
      };
    },
    createInitialXmindState: function() { return {}; },
    createEmptyWorkspaceSharedState: function() { return {}; },
    cloneModulesWithoutCases: function(modules) { return clone(modules || [], []); },
    buildCompactRootPipelineRestoreSnapshot: function(value) { return clone(value, null); },
    cloneRootPipelineSnapshot: function(value) { return clone(value, null); },
    getWorkflowReady: function() { return true; },
    getTaskManager: function() { return manager; },
    getRecoveryCore: function() {
      return {
        buildRequirementFingerprint: function(context) {
          return String(context.requirementLabel || '') + ':' + String(context.rawText || '');
        },
        evaluateTaskRestore: function(task, record) {
          return {
            allowed: Boolean(record || task.status === 'running'),
            recreateWorkspace: !record && task.status === 'running',
          };
        },
        areRestoreContextsCompatible: function() { return true; },
      };
    },
    getActiveWorkspaceId: function() { return 'workspace-1'; },
    getWorkspaceRecord: function(workspaceId) { return records[workspaceId] || null; },
    ensureWorkspaceRecordForTask: function(workspaceId, restoreContext) {
      if (!records[workspaceId]) {
        records[workspaceId] = {
          id: workspaceId,
          generationId: restoreContext.workspaceGenerationId || '',
          createdAt: restoreContext.workspaceCreatedAt || 0,
          snapshot: { xmind: {}, shared: {} },
        };
      }
      return records[workspaceId];
    },
    captureActiveRestoreContext: function(options) {
      return {
        workspaceId: options.workspaceId,
        requirementLabel: '登录需求',
        rawText: '原始需求',
        caseGenModules: [{ module: '登录' }],
        viewState: options.viewState || { drawerOpen: true },
      };
    },
    shouldApplyLiveRestore: function() { return true; },
    applyLiveRestoreContext: function(context) {
      calls.liveRestores.push(clone(context, {}));
      return true;
    },
    onWorkspaceRecordsRestored: function(workspaceIds) {
      calls.recordRestores.push(workspaceIds.slice());
    },
    getWorkspaceShadowDepth: function() { return 0; },
    clearRunningUiState: function() {},
    applyRunningUiTask: function() {},
    applyRootPipelineRunningUiState: function() {},
    shouldRenderRunningTasksStructurally: function(tasksValue) {
      return tasksValue.some(function(task) { return task.structural === true; });
    },
    syncInterruptButton: function() { calls.interrupts += 1; },
    renderWorkspaceTabs: function() {},
    persistManagedTaskWorkspaceState: function() {},
    isDrawerOpen: function() { return true; },
    queueStructureRender: function(options) { calls.renders.push({ kind: 'structure', options: options }); },
    queueStatusRender: function(options) { calls.renders.push({ kind: 'status', options: options }); },
    runInWorkspaceContextNow: function(workspaceId, handler) {
      return Promise.resolve(handler(false, workspaceId));
    },
    showTerminalDedupeRunningState: function() {},
    waitForDedupeMinVisibleDuration: function() { return Promise.resolve(); },
    completeCoverageTaskSuccess: function(task) { calls.completed.push('coverage:done:' + task.id); return true; },
    completeDedupeTaskSuccess: function(task) { calls.completed.push('dedupe:done:' + task.id); return true; },
    completeRootTaskSuccess: function(task) { calls.completed.push('root:done:' + task.id); return true; },
    completeModuleTaskSuccess: function(task) { calls.completed.push('module:done:' + task.id); return true; },
    completeCoverageTaskError: function(task) { calls.completed.push('coverage:error:' + task.id); return false; },
    completeDedupeTaskError: function(task) { calls.completed.push('dedupe:error:' + task.id); return false; },
    completeRootTaskError: function(task) { calls.completed.push('root:error:' + task.id); return false; },
    completeModuleTaskError: function(task) { calls.completed.push('module:error:' + task.id); return false; },
    pumpRootPipelineModuleQueue: function() { return Promise.resolve(false); },
    finalizeRootPipelineIfReady: function() { return false; },
    getManagedTaskAnchorNodeId: function() { return 'root'; },
    getRootPipelineState: function() { return null; },
    getRootNodeId: function() { return 'root'; },
    addTaskEventListener: function(handler) { listeners.push(handler); },
    maybeRescueRootPipelineTailRequest: function() { calls.rescues += 1; },
    setTimer: function(handler, delay) {
      calls.scheduled.push({ handler: handler, delay: delay });
      return calls.scheduled.length;
    },
    clearTimer: function() {},
    logConsumeError: function() {},
  });
  return {
    calls: calls,
    controller: controller,
    listeners: listeners,
    manager: manager,
    records: records,
    setTasks: function(next) { tasks = next; },
    taskContexts: taskContexts,
  };
}

function verifyTaskIdentityAndRestorePolicy() {
  var harness = createHarness();
  harness.setTasks([
    { id: 'running-1', status: 'running', workspaceId: 'workspace-1' },
    { id: 'done-1', status: 'done', restoreContext: { workspaceId: 'workspace-2' } },
  ]);
  assert.strictEqual(harness.controller.listManagedXmindTasks().length, 2);
  assert.strictEqual(harness.controller.isManagedTaskTerminal({ status: 'done' }), true);
  assert.strictEqual(harness.controller.isManagedTaskTerminal({ status: 'running' }), false);
  assert.strictEqual(harness.controller.getTaskWorkspaceId({ restoreContext: { workspaceId: 'workspace-2' } }), 'workspace-2');
  assert.strictEqual(harness.controller.filterTasksByWorkspace(harness.controller.listManagedXmindTasks(), 'workspace-1').length, 1);
  assert.strictEqual(harness.controller.getManagedTaskRestoreDecision({ status: 'running', workspaceId: 'workspace-3' }).allowed, true);
  assert.strictEqual(harness.controller.getManagedTaskRestoreDecision({ status: 'done', workspaceId: 'workspace-3' }).allowed, false);
}

function verifyContextSyncAndWorkspaceRestore() {
  var harness = createHarness();
  harness.setTasks([
    { id: 'running-1', status: 'running', workspaceId: 'workspace-1', restoreContext: { seed: 'old' } },
  ]);
  assert.strictEqual(harness.controller.syncRunningTaskRestoreContexts('workspace-1'), 1);
  assert.strictEqual(harness.taskContexts['running-1'].requirementLabel, '登录需求');
  assert.strictEqual(harness.taskContexts['running-1'].requirementFingerprint, '登录需求:原始需求');

  var changed = harness.controller.restoreWorkflowContextFromManagedTasks([
    {
      id: 'done-current',
      status: 'done',
      workspaceId: 'workspace-1',
      restoreContext: { workspaceId: 'workspace-1', rawText: '恢复文本' },
    },
    {
      id: 'running-other',
      status: 'running',
      workspaceId: 'workspace-2',
      restoreContext: { workspaceId: 'workspace-2', rawText: '其他工作区' },
    },
  ]);
  assert.strictEqual(changed, true);
  assert.strictEqual(harness.calls.liveRestores.length, 1);
  assert.strictEqual(harness.calls.liveRestores[0].rawText, '恢复文本');
  assert.ok(harness.records['workspace-2']);
  assert.ok(harness.calls.recordRestores[0].indexOf('workspace-2') >= 0);
}

async function verifyTerminalConsumptionIsIdempotent() {
  var harness = createHarness();
  var task = {
    id: 'module-done',
    status: 'done',
    scope: 'module',
    workspaceId: 'workspace-1',
    restoreContext: { workspaceId: 'workspace-1' },
  };
  harness.setTasks([task]);
  var first = harness.controller.consumeManagedXmindTask(task);
  var second = harness.controller.consumeManagedXmindTask(task);
  assert.strictEqual(first, second);
  await first;
  assert.deepStrictEqual(harness.calls.completed, ['module:done:module-done']);
  assert.deepStrictEqual(harness.calls.cleared, [{ taskId: 'module-done', reason: 'handled' }]);
  assert.strictEqual(harness.calls.scheduled.length, 1);
}

function verifyBindingAndOwnership() {
  var harness = createHarness();
  harness.controller.bindManagedXmindTasks();
  harness.controller.bindManagedXmindTasks();
  assert.strictEqual(harness.listeners.length, 1);
  harness.listeners[0]({ detail: { action: 'heartbeat', task: { id: 'heartbeat', status: 'running' } } });
  assert.strictEqual(harness.calls.rescues, 1);

  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'isManagedTaskTerminal',
    'getManagedTaskRestoreDecision',
    'buildManagedTaskRestoreContext',
    'syncRunningTaskRestoreContexts',
    'restoreWorkflowContextFromManagedTasks',
    'consumeManagedXmindTask',
    'reconcileManagedXmindTasks',
    'bindManagedXmindTasks',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by the managed task controller');
  });
  assert.ok(/managedTaskControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenManagedTaskController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load the managed task controller first');
  });
}

verifyTaskIdentityAndRestorePolicy();
verifyContextSyncAndWorkspaceRestore();
verifyTerminalConsumptionIsIdempotent().then(function() {
  verifyBindingAndOwnership();
  console.log('xmind casegen managed task controller tests passed');
}).catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
