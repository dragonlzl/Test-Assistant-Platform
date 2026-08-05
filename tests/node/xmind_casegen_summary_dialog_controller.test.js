'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenSummaryDialogController.js'
));

function createClassList() {
  var values = {};
  return {
    contains: function(name) { return values[name] === true; },
    toggle: function(name, enabled) { values[name] = enabled === true; },
  };
}

function createElement() {
  var attributes = {};
  return {
    attributes: attributes,
    classList: createClassList(),
    hidden: false,
    textContent: '',
    setAttribute: function(name, value) { attributes[name] = String(value); },
  };
}

function createHarness(options) {
  var values = options || {};
  var active = values.active !== false;
  var locked = values.locked === true;
  var prep = { step: values.step || 1 };
  var calls = [];
  var elements = {
    overlayEl: createElement(),
    dialogEl: createElement(),
    titleEl: createElement(),
    descEl: createElement(),
    bodyEl: createElement(),
    prepBtn: createElement(),
    historyBtn: createElement(),
    knowledgeRuleBtn: createElement(),
    knowledgeAiBtn: createElement(),
    coverageBtn: createElement(),
  };
  var controller = controllerFactory.create({
    elements: elements,
    stepRequirement: 1,
    stepOptions: 3,
    hasActiveWorkspace: function() { return active; },
    notifyNoWorkspace: function() { calls.push('notify-no-workspace'); },
    hideOpenMindContextMenu: function() { calls.push('hide-context-menu'); },
    getPrepState: function() { return prep; },
    isPrepBaseLocked: function() { return locked; },
    clampPrepStep: function(step) { return Math.max(1, Math.min(3, Number(step) || 1)); },
    syncSummaryDraftIntoState: function() { calls.push('sync-draft'); },
    renderPrep: function() { calls.push('render-prep'); },
    renderHistory: function() { calls.push('render-history'); },
    renderKnowledgeBase: function() { calls.push('render-knowledge'); },
    renderCoverage: function() { calls.push('render-coverage'); },
    hideCoverageTooltip: function() { calls.push('hide-coverage-tooltip'); },
    persistState: function(immediate) { calls.push('persist-' + String(immediate)); },
    releaseCoverageResources: function() { calls.push('release-coverage'); },
    renderWorkspaceTabs: function() { calls.push('render-tabs'); },
    clearHistoryUnreadNotice: function() { calls.push('clear-history-unread'); },
    syncHistoryButtonState: function() { calls.push('sync-history-button'); },
  });
  return {
    calls: calls,
    controller: controller,
    elements: elements,
    prep: prep,
    setActive: function(value) { active = value === true; },
  };
}

function verifyInitialStateAndWorkspaceGuard() {
  var harness = createHarness({ active: false });
  assert.deepStrictEqual(harness.controller.getState(), { open: false, mode: 'prep' });
  assert.strictEqual(harness.controller.isOpen(), false);
  assert.strictEqual(harness.controller.isModeOpen('prep'), false);
  assert.strictEqual(harness.controller.openPrep(2), false);
  assert.deepStrictEqual(harness.controller.getState(), { open: false, mode: 'prep' });
  assert.deepStrictEqual(harness.calls, ['notify-no-workspace']);
}

function verifyPrepModeAndDomProjection() {
  var harness = createHarness({ step: 1 });
  assert.strictEqual(harness.controller.openPrep(2), true);
  assert.deepStrictEqual(harness.controller.getState(), { open: true, mode: 'prep' });
  assert.strictEqual(harness.prep.step, 2);
  assert.strictEqual(harness.elements.overlayEl.hidden, false);
  assert.strictEqual(harness.elements.overlayEl.attributes['aria-hidden'], 'false');
  assert.strictEqual(harness.elements.overlayEl.classList.contains('is-open'), true);
  assert.strictEqual(harness.elements.overlayEl.classList.contains('hidden'), false);
  assert.strictEqual(harness.elements.prepBtn.attributes['aria-expanded'], 'true');
  assert.strictEqual(harness.elements.historyBtn.attributes['aria-expanded'], 'false');
  assert.strictEqual(harness.elements.titleEl.textContent, '生成前置准备');
  assert.ok(harness.elements.descEl.textContent.indexOf('3 步') >= 0);
  assert.deepStrictEqual(harness.calls, [
    'hide-context-menu',
    'sync-history-button',
    'render-prep',
  ]);
}

function verifyLockedPrepAndModeDispatch() {
  var harness = createHarness({ locked: true, step: 1 });
  harness.controller.openPrep(1);
  assert.strictEqual(harness.prep.step, 3);
  harness.calls.length = 0;
  harness.controller.openHistory();
  assert.strictEqual(harness.controller.isModeOpen('history'), true);
  assert.strictEqual(harness.elements.titleEl.textContent, '生成记录');
  assert.deepStrictEqual(harness.calls, [
    'hide-context-menu',
    'sync-history-button',
    'render-history',
    'clear-history-unread',
  ]);
  harness.calls.length = 0;
  harness.controller.openKnowledgeBase();
  assert.strictEqual(harness.controller.isModeOpen('knowledge-base'), true);
  assert.strictEqual(harness.elements.knowledgeRuleBtn.attributes['aria-expanded'], 'true');
  assert.deepStrictEqual(harness.calls, [
    'hide-context-menu',
    'sync-history-button',
    'render-knowledge',
  ]);
  harness.calls.length = 0;
  harness.controller.openCoverageShell();
  assert.strictEqual(harness.controller.isModeOpen('coverage'), true);
  assert.strictEqual(harness.elements.coverageBtn.attributes['aria-expanded'], 'true');
  assert.strictEqual(harness.elements.dialogEl.classList.contains('xmind-casegen-coverage-dialog'), true);
  assert.strictEqual(harness.elements.bodyEl.classList.contains('xmind-casegen-coverage-dialog-body'), true);
  assert.deepStrictEqual(harness.calls, ['sync-history-button', 'render-coverage']);
}

function verifyRenderGuardAndCloseSideEffects() {
  var harness = createHarness();
  harness.controller.openCoverageShell();
  harness.calls.length = 0;
  harness.controller.renderOpen();
  assert.deepStrictEqual(harness.calls, ['hide-coverage-tooltip', 'render-coverage']);
  harness.calls.length = 0;
  harness.controller.close({ skipPersist: true });
  assert.deepStrictEqual(harness.controller.getState(), { open: false, mode: 'coverage' });
  assert.strictEqual(harness.elements.overlayEl.hidden, true);
  assert.strictEqual(harness.elements.overlayEl.attributes['aria-hidden'], 'true');
  assert.strictEqual(harness.elements.dialogEl.classList.contains('xmind-casegen-coverage-dialog'), false);
  assert.deepStrictEqual(harness.calls, [
    'hide-coverage-tooltip',
    'sync-draft',
    'sync-history-button',
    'release-coverage',
    'render-tabs',
  ]);

  var inactiveHarness = createHarness();
  inactiveHarness.controller.openHistory();
  inactiveHarness.calls.length = 0;
  inactiveHarness.setActive(false);
  assert.strictEqual(inactiveHarness.controller.renderOpen(), false);
  assert.strictEqual(inactiveHarness.controller.isOpen(), false);
  assert.strictEqual(inactiveHarness.calls.indexOf('persist-true'), -1);
}

function verifySingleOwnerAndScriptOrder() {
  var entrySource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  assert.strictEqual(entrySource.indexOf('var summaryDialogOpen'), -1);
  assert.strictEqual(entrySource.indexOf('var summaryDialogMode'), -1);
  assert.strictEqual(entrySource.indexOf('function applySummaryDialogState'), -1);
  assert.ok(entrySource.indexOf('xmindCasegenSummaryDialogController') >= 0);
  assert.ok(
    entrySource.indexOf('hasActiveWorkspace: function() { return hasActiveWorkspace(); },') >= 0,
    'summary dialog owner must resolve the workspace port after workspace controller setup'
  );

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenSummaryDialogController.js');
    var entryIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load summary dialog owner');
    assert.ok(ownerIndex < entryIndex, fileName + ' must load summary dialog owner before entry');
  });
}

verifyInitialStateAndWorkspaceGuard();
verifyPrepModeAndDomProjection();
verifyLockedPrepAndModeDispatch();
verifyRenderGuardAndCloseSideEffects();
verifySingleOwnerAndScriptOrder();
console.log('xmind casegen summary dialog controller tests passed');
