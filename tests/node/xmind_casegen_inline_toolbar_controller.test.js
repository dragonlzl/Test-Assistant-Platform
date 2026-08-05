'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenInlineToolbarController.js'
));

function createClassList() {
  var names = {};
  return {
    add: function(name) { names[name] = true; },
    contains: function(name) { return names[name] === true; },
    remove: function(name) { delete names[name]; },
    toggle: function(name, enabled) {
      if (enabled) names[name] = true;
      else delete names[name];
    },
  };
}

function createButton(title) {
  var attributes = {};
  return {
    classList: createClassList(),
    disabled: false,
    innerHTML: '',
    title: title || '',
    getAttribute: function(name) { return attributes[name] || ''; },
    setAttribute: function(name, value) { attributes[name] = String(value); },
  };
}

function createHarness(overrides) {
  var viewState = { toolbarCollapsed: false, updatedAt: 0 };
  var dedupeState = {
    batchCompleted: 0,
    batchTotal: 0,
    dedupeMode: 'dedupe_only',
    lastResult: null,
    running: false,
    terminalVisualRunning: false,
    terminalVisualUntil: 0,
  };
  var ports = {
    getViewState: function() { return viewState; },
    ensureDedupeUiState: function() { return dedupeState; },
    ensureCoverageUiState: function() { return { running: false }; },
    buildVisibleModuleContext: function() {
      return {
        list: [
          { cases: [{ title: 'case-a' }, { title: 'case-b' }] },
          { cases: [{ title: 'case-c' }] },
        ],
      };
    },
    getVisibleCasesForModuleEntry: function(entry) { return entry.cases || []; },
    collectRunningGenerationOperations: function() { return []; },
    getRootPipelineState: function() { return null; },
    getDedupeModeFromSettings: function() { return 'dedupe_only'; },
    normalizeDedupeMode: function(value) { return value || 'dedupe_only'; },
    getDedupeModeActionText: function() { return '去重'; },
    getDedupeRunningLabel: function() { return 'AI用例去重中'; },
    getDedupeRunningHint: function() { return '去重进行中'; },
    hasAnyRunningGenerationOperation: function() { return false; },
    hasVisibleAiCasesForDedupe: function() { return true; },
    hasActiveWorkspace: function() { return true; },
    getSelectedRequirementSource: function() { return { text: '需求原文' }; },
    isCoverageDialogOpen: function() { return false; },
    isManualDedupeConfirming: function() { return false; },
    now: function() { return 1000; },
  };
  return {
    controller: controllerFactory.create(Object.assign(ports, overrides || {})),
    dedupeState: dedupeState,
    viewState: viewState,
  };
}

function verifyOverviewDerivation() {
  var harness = createHarness();
  var summary = harness.controller.getInlineToolbarOverviewSummary();
  assert.strictEqual(summary.moduleCount, 2);
  assert.strictEqual(summary.caseCount, 3);
  assert.strictEqual(summary.runningState, 'idle');
  assert.strictEqual(summary.runningLabel, '当前没有生成任务');

  harness.dedupeState.lastResult = {
    status: 'done',
    removedCount: 4,
    dedupeMode: 'dedupe_only',
  };
  summary = harness.controller.getInlineToolbarOverviewSummary();
  assert.strictEqual(summary.dedupe.removedCount, 4);
}

function verifyRunningOverview() {
  var harness = createHarness({
    collectRunningGenerationOperations: function() {
      return [{ scope: 'module', label: '登录流程' }];
    },
    getRootPipelineState: function() {
      return { moduleTaskCompleted: 2, moduleTaskTotal: 5 };
    },
  });
  var summary = harness.controller.getInlineToolbarOverviewSummary();
  assert.strictEqual(summary.runningCount, 1);
  assert.strictEqual(summary.runningState, 'running');
  assert.strictEqual(summary.runningLabel, '正在生成模块用例 2/5');
  assert.ok(summary.runningHint.indexOf('登录流程') >= 0);
}

function verifyButtonPolicies() {
  var interruptButton = createButton();
  var storeButton = createButton('保存入库');
  var exportButton = createButton('导出');
  var dedupeButton = createButton();
  var coverageButton = createButton();
  var harness = createHarness({
    interruptBtn: interruptButton,
    storeBtn: storeButton,
    exportBtn: exportButton,
    dedupeBtn: dedupeButton,
    coverageBtn: coverageButton,
    collectRunningGenerationOperations: function() { return [{ scope: 'module' }]; },
    hasAnyRunningGenerationOperation: function() { return true; },
  });
  harness.controller.syncInterruptButton();
  assert.strictEqual(interruptButton.disabled, false);
  assert.strictEqual(storeButton.disabled, true);
  assert.strictEqual(exportButton.disabled, true);
  assert.strictEqual(dedupeButton.disabled, true);
  assert.strictEqual(coverageButton.disabled, true);
}

function verifyOwnershipAndLoadingOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'restoreInlineControlsToBank',
    'syncInlineModelPicker',
    'setInlineToolbarCollapsed',
    'getInlineToolbarOverviewSummary',
    'syncInlineToolbarOverview',
    'mountInlineControls',
    'syncInterruptButton',
    'syncDedupeToolbarButton',
    'syncCoverageToolbarButton',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by toolbar controller');
  });
  assert.ok(/inlineToolbarControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenInlineToolbarController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load toolbar controller before xmindCasegen');
  });
}

verifyOverviewDerivation();
verifyRunningOverview();
verifyButtonPolicies();
verifyOwnershipAndLoadingOrder();
console.log('xmind casegen inline toolbar controller tests passed');
