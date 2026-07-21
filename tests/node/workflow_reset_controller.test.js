'use strict';

var assert = require('assert');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var resetModule = require(
  path.join(projectRoot, 'scripts/modules/app/workflowResetController.js')
);

function createHarness(options) {
  var opts = options || {};
  var statusNodes = {};
  var statusIds = [
    'parseStatus', 'reviewStatus', 'clarifyStatus', 'cleanStatus', 'compareStatus',
    'splitStatus', 'caseStatus', 'casesCoverageStatus', 'caseGenStatus',
    'autoWorkflowStatus', 'autoCompareStatus', 'autoRecleanStatus',
    'autoMissingStatus', 'missingViewStatus', 'autoClarifyStatus',
  ];
  statusIds.forEach(function(id) { statusNodes[id] = { id: id, textContent: 'old' }; });
  var autoCompareSuggestionInput = { value: 'old suggestion' };
  var documentRef = {
    getElementById: function(id) {
      if (id === 'autoCompareSuggestion') return autoCompareSuggestionInput;
      return statusNodes[id] || null;
    },
  };
  var dom = {
    rawText: { value: '' },
    reviewResultEl: { value: '' },
    cleanedTextEl: { value: '' },
    compareResultEl: { value: '' },
    splitResultEl: { value: '' },
    casesCompareResultEl: { value: '' },
    caseTextEl: { value: '' },
    fileName: { textContent: 'requirement.docx' },
    autoClarifyToggle: { checked: true },
  };
  var state = {
    requirementLabel: '当前需求',
    requirementLabelSource: 'default',
    requirementMedia: {},
    reviewRows: [],
    reviewClarifications: new Map(),
    reviewSelections: new Set(),
    reviewExpanded: new Set(),
    missingSelections: new Set(),
    caseGenLegacy: null,
    caseGenModules: [],
    caseGenResults: {},
    caseSelections: {},
    caseGenSuggestions: {},
    caseGenModuleStatus: {},
    caseGenProgress: {},
    caseGenTiming: {},
    caseGenProgressNotice: {},
    caseGenRunning: new Set(),
    importedCases: [],
  };
  var calls = {
    confirm: 0,
    cancel: 0,
    abort: 0,
    syncTask: 0,
    persist: 0,
    render: 0,
    statuses: 0,
  };
  var confirmResult = opts.confirmResult || { ok: false };
  var root = {
    app: {
      confirmDrawer: {
        open: function() {
          calls.confirm += 1;
          return Promise.resolve(confirmResult);
        },
      },
      xmindCasegenApi: {
        isOpen: function() { return opts.xmindDrawerOpen === true; },
      },
    },
    confirm: function() { return opts.nativeConfirm === true; },
  };
  var manager = {
    cancelTask: function() { calls.cancel += 1; return true; },
    getTask: function() { return { status: 'cancelled' }; },
    clearTask: function() {},
  };

  function render() { calls.render += 1; }
  var controller = resetModule.create({
    root: root,
    document: documentRef,
    state: state,
    dom: dom,
    setStatus: function(el, text) { calls.statuses += 1; el.textContent = text; },
    autoWorkflowManager: manager,
    syncAutoWorkflowTaskState: function() { calls.syncTask += 1; },
    abortAllModelRequests: function() { calls.abort += 1; },
    renderImportedCaseList: render,
    resetImportedCaseView: render,
    syncCaseTextWithImports: render,
    renderCaseGeneration: render,
    renderCaseGenProgressBoard: render,
    renderCleanView: render,
    renderCleanRawView: render,
    syncReviewViewFromResult: render,
    syncSplitView: render,
    updateMissingView: render,
    syncAutoCompareStatus: render,
    updateAutoClarifyVisibility: render,
    updateAutoMissingCard: render,
    renderAutoRawInfo: render,
    setCaseViewHint: render,
    triggerUpdateFlowStatus: render,
    requestPersistWorkflowStateNow: function() { calls.persist += 1; },
  });

  return {
    controller: controller,
    root: root,
    state: state,
    dom: dom,
    calls: calls,
    statusNodes: statusNodes,
    autoCompareSuggestionInput: autoCompareSuggestionInput,
    setConfirmResult: function(value) { confirmResult = value; },
  };
}

var emptyHarness = createHarness();
assert.strictEqual(emptyHarness.controller.hasWorkflowData(), false);
assert.strictEqual(emptyHarness.controller.hasLegacyCaseGenData(), false);
assert.strictEqual(emptyHarness.controller.hasXmindWorkspaceData(), false);

var resetHarness = createHarness();
resetHarness.dom.rawText.value = 'existing requirement';
resetHarness.dom.reviewResultEl.value = '[]';
resetHarness.state.requirementLabel = '需求A';
resetHarness.state.requirementLabelSource = 'user';
resetHarness.state.importedCases = [{ id: 'case-1' }];
resetHarness.state.caseGenLegacy = {
  modules: [{ title: '登录' }],
  results: { login: '[{"title":"成功"}]' },
  suggestions: {},
};
assert.strictEqual(resetHarness.controller.hasWorkflowData(), true);
assert.strictEqual(resetHarness.controller.hasLegacyCaseGenData(), true);
resetHarness.controller.resetWorkflowData();
assert.strictEqual(resetHarness.dom.rawText.value, '');
assert.strictEqual(resetHarness.dom.reviewResultEl.value, '');
assert.strictEqual(resetHarness.dom.fileName.textContent, '未选择文件');
assert.strictEqual(resetHarness.state.requirementLabel, '');
assert.deepStrictEqual(resetHarness.state.importedCases, []);
assert.deepStrictEqual(resetHarness.state.caseGenLegacy.modules, []);
assert.strictEqual(resetHarness.state.reviewClarifications instanceof Map, true);
assert.strictEqual(resetHarness.state.caseGenRunning instanceof Set, true);
assert.strictEqual(resetHarness.calls.persist, 1);
assert.ok(resetHarness.calls.render >= 10);
assert.ok(resetHarness.calls.statuses >= 10);
assert.strictEqual(resetHarness.autoCompareSuggestionInput.value, '');

var preserveHarness = createHarness();
preserveHarness.state.xmindCaseGen = {
  activeWorkspaceId: 'workspace-1',
  workspaceOrder: ['workspace-1'],
  workspaces: { 'workspace-1': { id: 'workspace-1' } },
};
preserveHarness.state.caseGenSettings = { activeTab: 'xmind-modules' };
preserveHarness.state.caseGenModules = [{ id: 'module-1', title: '登录' }];
preserveHarness.state.caseGenSource = 'xmind';
preserveHarness.state.caseGenResults = { 'module-1': '[{"title":"成功"}]' };
preserveHarness.state.caseSelections = { 'module-1': new Set([0, 1]) };
preserveHarness.state.caseGenSuggestions = { 'module-1': '补充边界' };
preserveHarness.state.caseGenModuleStatus = { 'module-1': 'done' };
preserveHarness.state.caseGenProgress = { 'module-1': 100 };
preserveHarness.state.caseGenTiming = { 'module-1': 25 };
preserveHarness.state.caseGenProgressNotice = { 'module-1': '完成' };
preserveHarness.state.caseGenRunning = new Set(['module-1']);
preserveHarness.controller.resetWorkflowData();
assert.deepStrictEqual(preserveHarness.state.caseGenModules, [{ id: 'module-1', title: '登录' }]);
assert.strictEqual(preserveHarness.state.caseGenSource, 'xmind');
assert.strictEqual(preserveHarness.state.caseSelections['module-1'] instanceof Set, true);
assert.deepStrictEqual(Array.from(preserveHarness.state.caseSelections['module-1']), [0, 1]);
assert.deepStrictEqual(Array.from(preserveHarness.state.caseGenRunning), ['module-1']);

var interruptHarness = createHarness();
assert.strictEqual(interruptHarness.controller.interruptActiveExecutions('manual stop'), true);
assert.strictEqual(interruptHarness.calls.cancel, 1);
assert.strictEqual(interruptHarness.calls.abort, 1);
assert.strictEqual(interruptHarness.calls.syncTask, 1);

(async function() {
  var guardHarness = createHarness();
  guardHarness.dom.rawText.value = 'existing';
  assert.strictEqual(await guardHarness.controller.guardRequirementImport(), false);
  assert.strictEqual(guardHarness.calls.confirm, 1);
  assert.strictEqual(guardHarness.calls.cancel, 0);
  guardHarness.setConfirmResult({ ok: true });
  assert.strictEqual(await guardHarness.controller.guardRequirementImport(), true);
  assert.strictEqual(guardHarness.calls.confirm, 2);
  assert.strictEqual(guardHarness.calls.cancel, 1);
  assert.strictEqual(guardHarness.dom.rawText.value, '');

  var noDataHarness = createHarness();
  assert.strictEqual(await noDataHarness.controller.guardRequirementImport(), true);
  assert.strictEqual(noDataHarness.calls.confirm, 0);
  console.log('workflow reset controller tests passed');
})().catch(function(err) {
  console.error(err);
  process.exit(1);
});
