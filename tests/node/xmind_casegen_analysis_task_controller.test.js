'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenAnalysisTaskController.js'
));

function createHarness(options) {
  var harnessOptions = options || {};
  var dedupeState = {};
  var coverageState = {};
  var rootState = {};
  var calls = {
    histories: [],
    notices: [],
    persists: 0,
    renders: [],
    starts: [],
    syncRestore: 0,
    clearedHighlight: 0,
    clearedTimers: [],
    timerDelays: [],
    toolbarSyncs: 0,
  };
  var controller = controllerFactory.create({
    dedupeActionId: 'xmind-ai-dedupe',
    dedupeModeOnly: 'dedupe_only',
    dedupeMinVisibleMs: 260,
    dedupeTerminalGraceMs: 1200,
    dedupeTerminalVisualMs: 3200,
    cloneJson: function(value) { return JSON.parse(JSON.stringify(value)); },
    normalizeDedupeMode: function(value) { return String(value || 'dedupe_only'); },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    normalizeCaseItem: function(value) { return value || null; },
    normalizeHistoryDiagnostics: function(value) { return Array.isArray(value) ? value.slice() : []; },
    normalizeHistoryDedupeRecords: function(value) { return Array.isArray(value) ? value.slice() : []; },
    normalizeHistoryDurationMs: function(value) { return Number(value || 0) || 0; },
    ensureDedupeUiState: function() { return dedupeState; },
    ensureCoverageUiState: function() { return coverageState; },
    ensureRootUiState: function() { return rootState; },
    ensureModuleUiState: function() { return {}; },
    syncInterruptButton: function() {},
    hasAnyRunningGenerationOperation: function() { return false; },
    buildCoverageSourceRequest: function() { return { signature: 'coverage-1' }; },
    buildXmindCoverageTaskInput: function(request) { return { request: request }; },
    buildCoverageTaskPayload: function(input, options) { return { scope: 'coverage', input: input, options: options }; },
    buildXmindDedupeExecutionInput: function(modules) {
      return { modules: modules, beforeCaseCount: 1 };
    },
    buildDedupeTaskPayload: function(input, options) { return { scope: 'dedupe', input: input, options: options }; },
    startManagedXmindTask: function(payload) {
      var task = Object.assign({ id: 'task-' + payload.scope }, payload.options || {}, payload);
      calls.starts.push(task);
      return task;
    },
    getActiveWorkspaceId: function() { return 'workspace-1'; },
    collectCurrentAiDedupeModules: function() { return [{ moduleId: 'module-1', module: '登录', cases: [{ title: '登录' }] }]; },
    getDedupeModeFromSettings: function() { return 'dedupe_only'; },
    syncInlineToolbarOverview: function() { calls.toolbarSyncs += 1; },
    isDrawerOpen: function() { return true; },
    queueStatusMindRender: function(options) { calls.renders.push({ kind: 'status', options: options }); },
    queueTerminalMindRender: function(options) { calls.renders.push({ kind: 'terminal', options: options }); },
    getRootNodeId: function() { return 'root'; },
    notifyStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    notifyFloatingStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    persistManagedTaskWorkspaceState: function() { calls.persists += 1; },
    persistXmindState: function() {},
    syncTerminalTaskRestoreContext: function() { calls.syncRestore += 1; },
    getXmindRequirementCoverageCoreApi: function() {
      return {
        normalizeCoverageResult: function() {
          return { signature: 'coverage-result', selectedSegmentId: 'segment-1' };
        },
      };
    },
    getXmindCaseDedupeCoreApi: function() {
      return {
        normalizeDedupeResult: function() {
          return { modules: [], beforeCount: 1, afterCount: 1, removedCount: 0, diagnostics: [] };
        },
      };
    },
    getXmindDedupeBatchCoreApi: function() { return null; },
    getDedupeExecutionDiagnosticText: function() { return '未发现重复用例'; },
    getTaskErrorMessage: function(task, err) { return err && err.message ? err.message : '失败'; },
    buildGenerationCancelledInfo: function() {
      return { resultKind: 'cancelled', reasonText: '用户中断', diagnostics: [], previewText: '' };
    },
    buildGenerationErrorInfo: function(err) {
      return { resultKind: 'error', reasonText: err.message, diagnostics: [], previewText: '' };
    },
    shouldSuppressTaskCancelToast: function() { return false; },
    recordGenerationHistory: function(payload) { calls.histories.push(payload); },
    clearCoverageHighlightedCase: function() { calls.clearedHighlight += 1; },
    isCoverageDialogOpen: function() { return false; },
    renderCoverageDialog: function() {},
    clearDeleteHistoryStacks: function() {},
    saveActiveWorkspaceSnapshot: function() {},
    renderWorkspaceTabs: function() {},
    syncCasesGenPageRender: function() {},
    clearModuleTopupHighlight: function() {},
    commitCaseList: function() {},
    setTimer: function(handler, delay) {
      calls.timerDelays.push(delay);
      return 1;
    },
    clearTimer: function(timerId) { calls.clearedTimers.push(timerId); },
    now: function() { return Number(harnessOptions.now || 1000); },
  });
  return {
    calls: calls,
    controller: controller,
    coverageState: coverageState,
    dedupeState: dedupeState,
    rootState: rootState,
  };
}

function verifyTaskStartLifecycle() {
  var harness = createHarness();
  var coverageTask = harness.controller.startRequirementCoverageTask();
  assert.strictEqual(coverageTask.scope, 'coverage');
  assert.strictEqual(harness.coverageState.running, true);
  assert.strictEqual(harness.coverageState.taskId, 'task-coverage');

  var dedupeTask = harness.controller.startAiDedupeTask({ source: 'manual-toolbar' });
  assert.strictEqual(dedupeTask.scope, 'dedupe');
  assert.strictEqual(harness.dedupeState.running, true);
  assert.strictEqual(harness.rootState.lastAction, 'xmind-ai-dedupe');
  assert.strictEqual(harness.calls.starts.length, 2);
}

function verifyCoverageCompletion() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.completeCoverageTaskSuccess({
    id: 'coverage-done',
    scope: 'coverage',
    resultRaw: '{}',
  }), true);
  assert.strictEqual(harness.coverageState.status, 'done');
  assert.strictEqual(harness.coverageState.signature, 'coverage-result');
  assert.strictEqual(harness.calls.clearedHighlight, 1);
  assert.strictEqual(harness.calls.syncRestore, 1);
  assert.strictEqual(harness.calls.persists, 1);
}

function verifyDedupeCancellation() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.completeDedupeTaskError({
    id: 'dedupe-cancelled',
    scope: 'dedupe',
    dedupeSource: 'manual-toolbar',
    dedupeModules: [],
  }, null, { resultKind: 'cancelled' }), false);
  assert.strictEqual(harness.dedupeState.lastResult.status, 'cancelled');
  assert.strictEqual(harness.calls.histories[0].resultKind, 'cancelled');
  assert.strictEqual(harness.calls.notices[0].type, 'warn');
}

function verifyDedupeOverviewClearLifecycle() {
  var harness = createHarness();
  harness.dedupeState.lastResult = { status: 'done', removedCount: 2 };
  harness.controller.scheduleDedupeTerminalVisualState({ dedupeMode: 'dedupe_only' });
  assert.strictEqual(harness.dedupeState.terminalVisualRunning, true);
  assert.strictEqual(harness.dedupeState.terminalVisualUntil, 4200);

  var syncCountBeforeClear = harness.calls.toolbarSyncs;
  assert.strictEqual(harness.controller.clearDedupeOverviewSummary(), true);
  assert.strictEqual(harness.dedupeState.lastResult, null);
  assert.strictEqual(harness.dedupeState.terminalVisualRunning, false);
  assert.strictEqual(harness.dedupeState.terminalVisualUntil, 0);
  assert.strictEqual(harness.dedupeState.updatedAt, 1000);
  assert.deepStrictEqual(harness.calls.clearedTimers, [1]);
  assert.strictEqual(harness.calls.toolbarSyncs, syncCountBeforeClear + 1);
  assert.strictEqual(harness.controller.clearDedupeOverviewSummary(), false);
}

function verifyDedupeTerminalConsumeTiming() {
  var expiredHarness = createHarness({ now: 5000 });
  expiredHarness.controller.waitForDedupeMinVisibleDuration({
    dedupeVisibleStartedAt: 1000,
    minVisibleUntil: 4200,
  });
  assert.deepStrictEqual(expiredHarness.calls.timerDelays, []);

  var pendingHarness = createHarness({ now: 1000 });
  pendingHarness.controller.waitForDedupeMinVisibleDuration({
    dedupeVisibleStartedAt: 500,
    minVisibleUntil: 1600,
  });
  assert.deepStrictEqual(pendingHarness.calls.timerDelays, [600]);

  var legacyHarness = createHarness({ now: 1000 });
  legacyHarness.controller.waitForDedupeMinVisibleDuration({
    dedupeVisibleStartedAt: 900,
  });
  assert.deepStrictEqual(legacyHarness.calls.timerDelays, [1200]);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'setDedupeRunningState',
    'clearDedupeOverviewSummary',
    'scheduleDedupeTerminalVisualState',
    'startRequirementCoverageTask',
    'startAiDedupeTask',
    'normalizeManagedDedupeTaskResult',
    'completeDedupeTaskSuccess',
    'completeDedupeTaskError',
    'completeCoverageTaskSuccess',
    'completeCoverageTaskError',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by the analysis task controller');
  });
  assert.ok(/analysisTaskControllerFactory\.create\(/.test(parentSource));
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenAnalysisTaskController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load analysis task controller first');
  });
}

verifyTaskStartLifecycle();
verifyCoverageCompletion();
verifyDedupeCancellation();
verifyDedupeOverviewClearLifecycle();
verifyDedupeTerminalConsumeTiming();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen analysis task controller tests passed');
