'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirClipboardController.js'));

assert.ok(owner && typeof owner.create === 'function');

function createTarget() {
  var listeners = Object.create(null);
  return {
    addEventListener: function(type, listener) {
      listeners[type] = listener;
    },
    removeEventListener: function(type, listener) {
      if (listeners[type] === listener) delete listeners[type];
    },
    contains: function(target) { return target === this.controlsChild; },
    dispatch: function(type, event) {
      if (listeners[type]) listeners[type](event || {});
    },
    listeners: listeners,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildApi(overrides) {
  var root = { id: 'root', topic: '根', expanded: true, children: [] };
  var state = { editing: true, pendingSave: false, data: { nodeData: root } };
  var viewer = createTarget();
  var calls = { refresh: 0, prevented: 0, stopped: 0, history: 0, searches: 0, buttons: 0, toasts: [] };
  var api = owner.create(Object.assign({
    viewerEl: viewer,
    controlsEl: { contains: function(target) { return target === 'controls'; } },
    isEditing: function() { return state.editing; },
    isPendingSave: function() { return state.pendingSave; },
    isTypingTarget: function() { return false; },
    isInternalClipboardText: function() { return false; },
    parseIndentedTextToMindData: function() { return null; },
    normalizeClipboardPlainNodeTopic: function(text) { return String(text || '').trim(); },
    getInstance: function() {
      return {
        refresh: function(nextData) {
          calls.refresh += 1;
          state.data = clone(nextData);
        },
      };
    },
    getCurrentMindData: function() { return state.data; },
    createNode: function(topic) {
      return { id: 'new-node', topic: topic, expanded: true, children: [] };
    },
    cloneMindDataObject: clone,
    cloneMindNodeTree: clone,
    collectSelectedNodes: function() { return []; },
    findNodeWithParentById: function() { return null; },
    normalizeMindTopic: function(value) { return String(value || '').trim(); },
    clearValidationMarks: function() {},
    setApplyingHistory: function() {},
    pushHistorySnapshot: function() { calls.history += 1; },
    runSearch: function() { calls.searches += 1; },
    updateEditButtons: function() { calls.buttons += 1; },
    showToast: function(text) { calls.toasts.push(text); },
  }, overrides || {}));
  return { api: api, viewer: viewer, state: state, calls: calls };
}

function buildPasteEvent(text) {
  return {
    target: null,
    clipboardData: {
      getData: function() { return text; },
    },
    preventDefault: function() { this.prevented = true; },
    stopPropagation: function() { this.stopped = true; },
  };
}

var first = buildApi();
first.api.bind();
var event = buildPasteEvent('新增节点');
first.viewer.dispatch('paste', event);
assert.strictEqual(first.calls.refresh, 1);
assert.strictEqual(first.calls.history, 1);
assert.strictEqual(first.calls.searches, 1);
assert.strictEqual(first.calls.buttons, 1);
assert.strictEqual(event.prevented, true);
assert.strictEqual(event.stopped, true);
assert.strictEqual(first.state.data.nodeData.children[0].topic, '新增节点');
assert.ok(first.calls.toasts[0].indexOf('已新增子节点') === 0);

var structured = buildApi({
  parseIndentedTextToMindData: function() {
    return {
      rootTopic: '结构',
      nodeCount: 2,
      mindData: {
        nodeData: {
          id: 'parsed-root',
          topic: '结构',
          expanded: true,
          children: [{ id: 'child', topic: '子节点', expanded: true, children: [] }],
        },
      },
    };
  },
});
structured.api.bind();
var structuredEvent = buildPasteEvent('结构\n  子节点');
structured.viewer.dispatch('paste', structuredEvent);
assert.strictEqual(structured.state.data.nodeData.children[0].topic, '结构');
assert.ok(structured.calls.toasts[0].indexOf('已拼接结构') === 0);

var ignored = buildApi();
ignored.api.bind();
var ignoredEvent = buildPasteEvent('忽略');
ignoredEvent.target = 'controls';
ignored.viewer.dispatch('paste', ignoredEvent);
assert.strictEqual(ignored.calls.refresh, 0);
ignored.state.editing = false;
ignored.viewer.dispatch('paste', buildPasteEvent('仍然忽略'));
assert.strictEqual(ignored.calls.refresh, 0);
ignored.api.destroy();
ignored.viewer.dispatch('paste', buildPasteEvent('销毁后忽略'));
assert.strictEqual(ignored.calls.refresh, 0);

var source = fs.readFileSync(
  path.join(projectRoot, 'scripts/core/mindElixirCore.js'),
  'utf8'
);
assert.strictEqual(source.indexOf('function onViewerPaste('), -1);
assert.ok(source.indexOf('clipboardControllerOwner.create') !== -1);
assert.ok(source.indexOf('clipboardController.destroy') !== -1);

['index.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html'].forEach(function(fileName) {
  var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
  var ownerIndex = html.indexOf('./scripts/core/mindElixirClipboardController.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(ownerIndex !== -1, fileName + ' should load the clipboard controller');
  assert.ok(coreIndex > ownerIndex, fileName + ' should load the clipboard controller before the core');
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var loaderOwnerIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirClipboardController.js'");
var loaderCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(loaderOwnerIndex !== -1);
assert.ok(loaderCoreIndex > loaderOwnerIndex);

console.log('mind_elixir_clipboard_controller.test.js passed');
