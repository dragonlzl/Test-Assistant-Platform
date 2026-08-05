'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenEventBindingController.js'
));

function createEventTarget(attributes) {
  var listeners = {};
  var attrs = attributes || {};
  return {
    disabled: false,
    addEventListener: function(type, handler, capture) {
      listeners[type] = listeners[type] || [];
      listeners[type].push({ handler: handler, capture: capture === true });
    },
    dispatch: function(type, event) {
      var payload = event || {};
      if (!payload.target) payload.target = this;
      (listeners[type] || []).forEach(function(entry) { entry.handler(payload); });
      return payload;
    },
    getAttribute: function(name) { return attrs[name] || ''; },
    listenerCount: function(type) { return (listeners[type] || []).length; },
  };
}

function createHarness() {
  var elementIds = ['rawText', 'caseText', 'fileInput', 'caseFileInput', 'caseFileList'];
  var documentElements = {};
  elementIds.forEach(function(id) { documentElements[id] = createEventTarget(); });
  var documentObj = createEventTarget();
  documentObj.getElementById = function(id) { return documentElements[id] || null; };

  var elementNames = [
    'openBtn',
    'workspaceAddBtn',
    'workspaceListEl',
    'summaryBtn',
    'historyBtn',
    'knowledgeRuleBtn',
    'knowledgeAiBtn',
    'dedupeBtn',
    'storeBtn',
    'interruptBtn',
    'deleteUndoBtn',
    'deleteRedoBtn',
    'summaryCloseBtn',
    'exportBtn',
    'exportMarkdownBtn',
  ];
  var elements = {};
  elementNames.forEach(function(name) { elements[name] = createEventTarget(); });

  var timers = [];
  var observers = [];
  function FakeMutationObserver(handler) {
    this.handler = handler;
    this.observed = null;
    this.observe = function(target, options) {
      this.observed = { target: target, options: options };
    };
    observers.push(this);
  }
  var dialogState = { open: false, mode: 'prep' };
  var calls = {
    actions: [],
    deleted: [],
    renders: [],
    switches: [],
    summaryUpdates: 0,
  };
  function action(name) {
    return function() { calls.actions.push(name); };
  }
  var controller = controllerFactory.create({
    elements: elements,
    documentObj: documentObj,
    MutationObserver: FakeMutationObserver,
    debounce: function(handler, delay) {
      return function() { timers.push({ handler: handler, delay: delay }); };
    },
    setTimeout: function(handler, delay) {
      timers.push({ handler: handler, delay: delay });
      return timers.length;
    },
    bindCoverageDialog: action('bind-coverage'),
    bindPrepDialog: action('bind-prep'),
    openDrawer: action('open'),
    createWorkspaceAndOpenPrep: action('add-workspace'),
    deleteWorkspace: function(id) { calls.deleted.push(id); },
    getActiveWorkspaceId: function() { return 'workspace-active'; },
    switchWorkspace: function(id, options) { calls.switches.push({ id: id, options: options }); },
    closeSummaryDialog: function() {
      calls.actions.push('close-dialog');
      dialogState.open = false;
    },
    openPrepDialog: function() {
      calls.actions.push('open-prep');
      dialogState = { open: true, mode: 'prep' };
    },
    openHistoryDialog: function() {
      calls.actions.push('open-history');
      dialogState = { open: true, mode: 'history' };
    },
    openKnowledgeBaseDialog: function() {
      calls.actions.push('open-knowledge');
      dialogState = { open: true, mode: 'knowledge-base' };
    },
    startManualAiDedupe: action('dedupe'),
    handleStoreToLibrary: action('store'),
    interruptRunningXmindTasks: action('interrupt'),
    undoLatestDeleteSelection: function() {
      calls.actions.push('undo');
      return true;
    },
    redoLatestDeleteSelection: function() {
      calls.actions.push('redo');
      return true;
    },
    exportCurrentXmind: action('export-xmind'),
    exportCurrentMarkdown: action('export-markdown'),
    isDrawerOpen: function() { return true; },
    getSummaryDialogState: function() { return dialogState; },
    syncDeleteHistoryButtons: action('sync-delete'),
    syncKnowledgeBaseToolbarState: action('sync-knowledge'),
    updateSummary: function() { calls.summaryUpdates += 1; },
    renderOpenedSummaryDialog: action('render-dialog'),
    scheduleRender: function(reason) { calls.renders.push(reason); },
  });
  return {
    calls: calls,
    controller: controller,
    documentElements: documentElements,
    documentObj: documentObj,
    elements: elements,
    getDialogState: function() { return dialogState; },
    observers: observers,
    timers: timers,
  };
}

function createClosestTarget(closeTarget, tabTarget) {
  return {
    closest: function(selector) {
      if (selector === '[data-xmind-workspace-close]') return closeTarget || null;
      if (selector === '[data-xmind-workspace-tab]') return tabTarget || null;
      return null;
    },
  };
}

function verifyIdempotentButtonAndWorkspaceBinding() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.bind(), true);
  assert.strictEqual(harness.controller.bind(), false);
  assert.strictEqual(harness.elements.openBtn.listenerCount('click'), 1);
  assert.strictEqual(harness.documentObj.listenerCount('keydown'), 1);
  assert.deepStrictEqual(harness.calls.actions.slice(0, 4), [
    'bind-coverage',
    'bind-prep',
    'sync-delete',
    'sync-knowledge',
  ]);

  harness.elements.openBtn.dispatch('click');
  harness.elements.workspaceAddBtn.dispatch('click');
  harness.elements.workspaceAddBtn.disabled = true;
  harness.elements.workspaceAddBtn.dispatch('click');
  assert.strictEqual(harness.calls.actions.filter(function(name) { return name === 'add-workspace'; }).length, 1);

  var closeTarget = createEventTarget({ 'data-xmind-workspace-close': 'workspace-2' });
  var closeEvent = harness.elements.workspaceListEl.dispatch('click', {
    target: createClosestTarget(closeTarget, null),
    preventDefault: function() { this.prevented = true; },
    stopPropagation: function() { this.stopped = true; },
  });
  assert.deepStrictEqual(harness.calls.deleted, ['workspace-2']);
  assert.strictEqual(closeEvent.prevented, true);
  assert.strictEqual(closeEvent.stopped, true);

  var tabTarget = createEventTarget({ 'data-xmind-workspace-tab': 'workspace-3' });
  harness.elements.workspaceListEl.dispatch('click', { target: createClosestTarget(null, tabTarget) });
  assert.deepStrictEqual(harness.calls.switches, [{
    id: 'workspace-3',
    options: { reason: 'workspace-manual-switch', centerRootAfterRender: false },
  }]);
}

function verifyDialogAndToolbarCommands() {
  var harness = createHarness();
  harness.controller.bind();
  harness.elements.summaryBtn.dispatch('click');
  assert.deepStrictEqual(harness.getDialogState(), { open: true, mode: 'prep' });
  harness.elements.summaryBtn.dispatch('click');
  assert.strictEqual(harness.getDialogState().open, false);
  harness.elements.historyBtn.dispatch('click');
  assert.deepStrictEqual(harness.getDialogState(), { open: true, mode: 'history' });
  harness.elements.knowledgeRuleBtn.dispatch('click');
  harness.elements.knowledgeAiBtn.dispatch('click');

  [
    'dedupeBtn',
    'storeBtn',
    'interruptBtn',
    'deleteUndoBtn',
    'deleteRedoBtn',
    'summaryCloseBtn',
    'exportBtn',
    'exportMarkdownBtn',
  ].forEach(function(name) { harness.elements[name].dispatch('click'); });
  ['dedupe', 'store', 'interrupt', 'undo', 'redo', 'export-xmind', 'export-markdown'].forEach(function(name) {
    assert.ok(harness.calls.actions.indexOf(name) >= 0, name + ' command must be dispatched');
  });
}

function createKeyEvent(values) {
  return Object.assign({
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: { tagName: 'DIV' },
    preventDefault: function() { this.prevented = true; },
    stopPropagation: function() { this.stopped = true; },
  }, values || {});
}

function verifyKeyboardRouting() {
  var harness = createHarness();
  harness.controller.bind();
  harness.elements.summaryBtn.dispatch('click');
  harness.documentObj.dispatch('keydown', createKeyEvent({ key: 'Escape' }));
  assert.strictEqual(harness.getDialogState().open, false);

  var undoEvent = harness.documentObj.dispatch('keydown', createKeyEvent({ key: 'z', ctrlKey: true }));
  var redoEvent = harness.documentObj.dispatch('keydown', createKeyEvent({ key: 'Z', metaKey: true, shiftKey: true }));
  var redoYEvent = harness.documentObj.dispatch('keydown', createKeyEvent({ key: 'y', ctrlKey: true }));
  assert.strictEqual(undoEvent.prevented, true);
  assert.strictEqual(redoEvent.prevented, true);
  assert.strictEqual(redoYEvent.prevented, true);

  var undoCount = harness.calls.actions.filter(function(name) { return name === 'undo'; }).length;
  harness.documentObj.dispatch('keydown', createKeyEvent({
    key: 'z',
    ctrlKey: true,
    target: { tagName: 'TEXTAREA' },
  }));
  assert.strictEqual(harness.calls.actions.filter(function(name) { return name === 'undo'; }).length, undoCount);
  assert.strictEqual(harness.controller.isTypingLikeTarget({ isContentEditable: true }), true);
  assert.strictEqual(harness.controller.isTypingLikeTarget({ tagName: 'SELECT' }), true);
  assert.strictEqual(harness.controller.isTypingLikeTarget({ tagName: 'DIV' }), false);
}

function runTimerByDelay(harness, delay) {
  var index = harness.timers.findIndex(function(item) { return item.delay === delay; });
  assert.ok(index >= 0, 'timer with delay ' + String(delay) + ' must exist');
  var timer = harness.timers.splice(index, 1)[0];
  timer.handler();
}

function verifyRenderListenersAndMutationObserver() {
  var harness = createHarness();
  harness.controller.bind();
  harness.documentElements.rawText.dispatch('input');
  assert.strictEqual(harness.calls.summaryUpdates, 1);
  runTimerByDelay(harness, 120);
  assert.deepStrictEqual(harness.calls.renders, ['dom-input']);

  harness.documentElements.caseFileInput.dispatch('change');
  runTimerByDelay(harness, 220);
  assert.strictEqual(harness.calls.summaryUpdates, 2);
  assert.deepStrictEqual(harness.calls.renders, ['dom-input', 'file-change']);
  assert.ok(harness.calls.actions.indexOf('render-dialog') >= 0);

  assert.strictEqual(harness.observers.length, 1);
  assert.strictEqual(harness.observers[0].observed.target, harness.documentElements.caseFileList);
  assert.deepStrictEqual(harness.observers[0].observed.options, { childList: true, subtree: true });
  harness.observers[0].handler();
  assert.deepStrictEqual(harness.calls.renders, ['dom-input', 'file-change', 'case-list-mutation']);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  ['isTypingLikeTarget', 'bindButtons', 'bindRenderListeners'].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by event controller');
  });
  assert.ok(/eventBindingControllerFactory\.create\(/.test(parentSource));
  assert.ok(/eventBindingController\.bind\(\)/.test(parentSource));
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenEventBindingController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load event controller first');
  });
}

verifyIdempotentButtonAndWorkspaceBinding();
verifyDialogAndToolbarCommands();
verifyKeyboardRouting();
verifyRenderListenersAndMutationObserver();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen event binding controller tests passed');
