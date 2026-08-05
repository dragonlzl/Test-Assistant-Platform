'use strict';

var assert = require('assert');
var toolbarOwner = require('../../scripts/modules/tempExecAiGenToolbarOwner.js');
var storeOwner = require('../../scripts/modules/caseLibrary/caseLibraryAiGenStore.js');

function createClassList() {
  var values = new Set();
  return {
    add: function(value) { values.add(value); },
    remove: function(value) { values.delete(value); },
    contains: function(value) { return values.has(value); },
  };
}

function createButton() {
  return {
    classList: createClassList(),
    disabled: false,
    textContent: '',
    attributes: {},
    removeAttribute: function(name) { delete this.attributes[name]; },
    setAttribute: function(name, value) { this.attributes[name] = String(value); },
  };
}

function testToolbarAndBadgeOwnership() {
  var state = {
    tempExecActiveId: 'file-1',
    tempExecFocus: [],
  };
  var ai = {
    caseFileId: 'file-1',
    requirementText: '登录需求',
    loading: false,
    resultToken: '',
    readResultToken: '',
    hasUnreadResult: false,
  };
  var files = {
    'file-1': { id: 'file-1', status: 'active' },
    'file-2': { id: 'file-2', status: 'active' },
  };
  var refreshCount = 0;
  var store = storeOwner.create({
    state: state,
    getCurrentUserId: function() { return 'user-1'; },
    storage: null,
    badgeStateKey: 'tempExecAiGenBadge',
    appendStateKey: 'tempExecAiGenAppend',
    badgeTokenKeys: [
      'result_token',
      'ai_read_token',
      'focus_read_token',
      'assign_entry_read_token',
      'assign_item_read_token',
    ],
  });
  var dom = {
    button: createButton(),
    runBtn: createButton(),
    assignDrawerBtn: createButton(),
    requirementInput: { value: '登录需求' },
  };
  var owner = toolbarOwner.create({
    state: state,
    store: store,
    dom: dom,
    api: {
      getTempExecFile: function(id) { return files[String(id)] || null; },
      renderTempFocusZone: function() { refreshCount += 1; },
      renderTempVersionGrid: function() { refreshCount += 1; },
      renderTempExecNav: function() { refreshCount += 1; },
    },
    getState: function() { return ai; },
    normalizeText: function(value) { return String(value || '').trim(); },
    hasAssignedModel: function() { return true; },
  });

  assert.strictEqual(owner.resolveDisabledReason(), '');
  owner.syncRunButton();
  assert.strictEqual(dom.runBtn.disabled, false);

  owner.markResultReady('task-1', 'file-1');
  assert.strictEqual(ai.resultToken, 'task-1');
  assert.strictEqual(ai.hasUnreadResult, true);
  assert.strictEqual(dom.button.classList.contains('has-badge'), true);
  assert.strictEqual(refreshCount, 3);

  owner.clearResultBadge();
  assert.strictEqual(ai.readResultToken, 'task-1');
  assert.strictEqual(ai.hasUnreadResult, false);
  assert.strictEqual(dom.button.classList.contains('has-badge'), false);

  store.updateBadgeRecord('file-2', { result_token: 'task-2' });
  owner.syncAssignEntryBadge();
  assert.strictEqual(dom.assignDrawerBtn.classList.contains('case-library-ai-gen-dot'), true);
  owner.markAssignEntryBadgeRead();
  assert.strictEqual(dom.assignDrawerBtn.classList.contains('case-library-ai-gen-dot'), false);

  store.updateBadgeRecord('file-2', { result_token: 'task-3' });
  files['file-2'].status = 'archived';
  owner.syncAssignEntryBadge();
  assert.strictEqual(dom.assignDrawerBtn.classList.contains('case-library-ai-gen-dot'), false);

  state.tempExecActiveId = '';
  assert.strictEqual(owner.resolveDisabledReason(), 'no-case');
}

assert.ok(toolbarOwner && typeof toolbarOwner.create === 'function');
testToolbarAndBadgeOwnership();
console.log('temp exec AI generation toolbar owner tests passed');
