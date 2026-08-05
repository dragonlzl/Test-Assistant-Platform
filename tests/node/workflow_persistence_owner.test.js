'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var xmindSnapshotCodecModule = require(path.join(projectRoot, 'scripts/core/workflowXmindSnapshotCodec.js'));
var snapshotModelModule = require(path.join(projectRoot, 'scripts/core/workflowSnapshotModel.js'));
var restoreControllerModule = require(path.join(projectRoot, 'scripts/core/workflowSnapshotRestoreController.js'));
var ownerModule = require(path.join(projectRoot, 'scripts/core/workflowPersistenceOwner.js'));
var cloneJson = require(path.join(projectRoot, 'scripts/core/jsonCloneCore.js')).cloneJson;

function createElement(initialValue) {
  return {
    value: initialValue || '',
    checked: false,
    textContent: '',
    listeners: {},
    addEventListener: function(type, handler) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(handler);
    },
  };
}

function createHarness(overrides) {
  var opts = overrides || {};
  var values = {};
  var removed = [];
  var writes = [];
  var taskClearReasons = [];
  var toasts = [];
  var dom = {
    rawText: createElement(''),
    fileName: createElement(''),
    reviewResultEl: createElement(''),
    cleanedTextEl: createElement(''),
    compareResultEl: createElement(''),
    splitResultEl: createElement(''),
    casesCompareResultEl: createElement(''),
    caseTextEl: createElement(''),
    autoClarifyToggle: createElement(''),
  };
  var suggestionInput = createElement('');
  var state = opts.state || {
    currentUser: { id: 7 },
    caseGenSettings: {
      needFunctionCondition: true,
      needNumericValidation: true,
    },
    caseSelections: {},
    missingSelections: new Set(),
  };
  var localStorage = {
    getItem: function(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    removeItem: function(key) {
      delete values[key];
      removed.push(key);
    },
  };
  var storage = {
    setJson: function(key, value) {
      writes.push({ key: key, value: value });
      values[key] = JSON.stringify(value);
    },
    getJson: function(key, fallback) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) return fallback;
      try {
        return JSON.parse(values[key]);
      } catch (err) {
        return fallback;
      }
    },
    remove: function(key) {
      delete values[key];
      removed.push(key);
    },
  };
  var browser = { app: {}, localStorage: localStorage };
  var owner = ownerModule.create({
    state: state,
    dom: dom,
    window: browser,
    localStorage: localStorage,
    storage: storage,
    cloneJson: cloneJson,
    debounce: function(handler) { return handler; },
    showCenterToast: function() { toasts.push(Array.prototype.slice.call(arguments)); },
    autoCompareSuggestionInput: suggestionInput,
    workflowStorageKey: 'workflow-test',
    workflowSnapshotMaxChars: opts.workflowSnapshotMaxChars,
    xmindTaskStoragePreclearChars: opts.xmindTaskStoragePreclearChars,
    getTaskManager: function() {
      return {
        clearAllTasks: function(reason) { taskClearReasons.push(reason); },
      };
    },
  });
  return {
    owner: owner,
    state: state,
    dom: dom,
    suggestionInput: suggestionInput,
    values: values,
    writes: writes,
    removed: removed,
    taskClearReasons: taskClearReasons,
    toasts: toasts,
    storage: storage,
  };
}

assert.strictEqual(typeof ownerModule.create, 'function');
assert.strictEqual(typeof xmindSnapshotCodecModule.create, 'function');
assert.strictEqual(typeof snapshotModelModule.create, 'function');
assert.strictEqual(typeof restoreControllerModule.create, 'function');

var harness = createHarness();
harness.dom.rawText.value = '需求正文';
harness.state.requirementLabel = '登录优化';
harness.state.requirementLabelSource = 'manual';
harness.state.caseGenResults = { login: '[ { "name": "正常登录" } ]' };
harness.state.caseSelections = { login: new Set([0, 2]) };
harness.state.missingSelections = new Set([3]);
harness.owner.setRestoring(true);
harness.owner.persistNow();
assert.strictEqual(harness.writes.length, 0, 'restoring should suppress persistence');
harness.owner.setRestoring(false);
harness.owner.persistNow();
assert.strictEqual(harness.writes.length, 1);
assert.strictEqual(harness.writes[0].key, 'workflow-test');
assert.strictEqual(harness.writes[0].value.user_id, '7');
assert.strictEqual(harness.writes[0].value.data.caseGenResults.login, '[{"name":"正常登录"}]');
assert.deepStrictEqual(harness.writes[0].value.data.caseSelections.login, [0, 2]);
assert.strictEqual(harness.state.workflowNavSnapshot.rawText, '需求正文');

var restored = createHarness();
restored.values['workflow-test'] = JSON.stringify(harness.writes[0].value);
assert.strictEqual(restored.owner.restore(), true);
assert.strictEqual(restored.dom.rawText.value, '需求正文');
assert.strictEqual(restored.state.requirementLabel, '登录优化');
assert.deepStrictEqual(Array.from(restored.state.caseSelections.login), [0, 2]);
assert.deepStrictEqual(Array.from(restored.state.missingSelections), [3]);
assert.strictEqual(restored.state.autoRunning, false);
assert.strictEqual(restored.state.xmindCaseGen.mode, 'modules');

var listenerHarness = createHarness();
listenerHarness.owner.bindListeners();
listenerHarness.owner.bindListeners();
assert.strictEqual(listenerHarness.dom.rawText.listeners.input.length, 1);
assert.strictEqual(listenerHarness.suggestionInput.listeners.input.length, 1);
assert.strictEqual(listenerHarness.dom.autoClarifyToggle.listeners.change.length, 1);
listenerHarness.dom.rawText.value = 'listener content';
listenerHarness.dom.rawText.listeners.input[0]();
assert.strictEqual(listenerHarness.writes.length, 1);

var emptyHarness = createHarness();
emptyHarness.values['workflow-test'] = 'old';
emptyHarness.owner.persistNow();
assert.strictEqual(emptyHarness.writes.length, 0);
assert.ok(emptyHarness.removed.indexOf('workflow-test') >= 0);
assert.strictEqual(emptyHarness.owner.snapshotHasContent({ data: {
  xmindCaseGen: { activeWorkspaceId: 'workspace-1' },
} }), true);
assert.strictEqual(emptyHarness.owner.snapshotHasContent({ data: {
  xmindCaseGen: { prep: { requirementSupplement: 'extra context' } },
} }), true);

var oversizeHarness = createHarness({ workflowSnapshotMaxChars: 10 });
oversizeHarness.values['workflow-test'] = '01234567890';
assert.strictEqual(oversizeHarness.owner.preclearOversizeWorkflowSnapshotBeforeModuleInit(), true);
assert.strictEqual(oversizeHarness.state.workflowRecoveryNotice.reason, 'oversize');
assert.deepStrictEqual(oversizeHarness.taskClearReasons, ['workflow-oversize-preinit-reset']);
assert.strictEqual(oversizeHarness.owner.flushRecoveryNotice(), true);
assert.strictEqual(oversizeHarness.toasts.length, 1);
assert.strictEqual(oversizeHarness.owner.flushRecoveryNotice(), false);

var taskHarness = createHarness({ xmindTaskStoragePreclearChars: 5 });
taskHarness.values['tap-xmind-casegen-tasks'] = '123456';
assert.strictEqual(taskHarness.owner.preclearOversizeXmindTaskStorageBeforeModuleInit(), true);
assert.strictEqual(taskHarness.values['tap-xmind-casegen-tasks'], undefined);
assert.strictEqual(taskHarness.owner.applySnapshot(null), false);

var runtimeSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/appRuntime.js'), 'utf8');
var ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/workflowPersistenceOwner.js'), 'utf8');
var modelSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/workflowSnapshotModel.js'), 'utf8');
var codecSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/workflowXmindSnapshotCodec.js'), 'utf8');
assert.match(runtimeSource, /window\.app\.workflowPersistenceOwner/);
assert.ok(!/function buildWorkflowSnapshot\(/.test(runtimeSource));
assert.ok(!/function applyWorkflowSnapshot\(/.test(runtimeSource));
assert.ok(!/function bindWorkflowPersistenceListeners\(/.test(runtimeSource));
assert.match(ownerSource, /workflowSnapshotModelFactory\.create\(\{/);
assert.match(ownerSource, /workflowSnapshotRestoreControllerFactory\.create\(\{/);
assert.ok(!/function compactXmindSnapshotForPersistence\(/.test(ownerSource));
assert.ok(!/function normalizeXmindCaseGenState\(/.test(ownerSource));
assert.match(modelSource, /workflowXmindSnapshotCodecFactory\.create\(\{/);
assert.ok(!/function compactXmindSnapshot\(/.test(modelSource));
assert.ok(!/function restoreActiveWorkspaceFromTopLevel\(/.test(modelSource));
assert.match(codecSource, /function compactXmindSnapshot\(/);
assert.match(codecSource, /function restoreActiveWorkspaceFromTopLevel\(/);

[
  'admin.html',
  'ai-tools.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
  'index.html',
  'settings.html',
].forEach(function(fileName) {
  var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
  var codecIndex = html.indexOf('./scripts/core/workflowXmindSnapshotCodec.js');
  var modelIndex = html.indexOf('./scripts/core/workflowSnapshotModel.js');
  var restoreIndex = html.indexOf('./scripts/core/workflowSnapshotRestoreController.js');
  var ownerIndex = html.indexOf('./scripts/core/workflowPersistenceOwner.js');
  assert.ok(codecIndex >= 0 && codecIndex < modelIndex, fileName + ' must load XMind codec before snapshot model');
  assert.ok(modelIndex < restoreIndex, fileName + ' must load snapshot model before restore controller');
  assert.ok(restoreIndex < ownerIndex, fileName + ' must load restore controller before persistence owner');
});

console.log('workflow_persistence_owner.test.js passed');
