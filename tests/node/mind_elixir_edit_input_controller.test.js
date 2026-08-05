'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var inputSelectionOwner = require(path.join(projectRoot, 'scripts/core/mindElixirInputSelectionController.js'));
var editInputOwner = require(path.join(projectRoot, 'scripts/core/mindElixirEditInputController.js'));

assert.ok(inputSelectionOwner && typeof inputSelectionOwner.create === 'function');
assert.ok(editInputOwner && typeof editInputOwner.create === 'function');

function createEventTarget() {
  var listeners = Object.create(null);
  return {
    listeners: listeners,
    nodeType: 1,
    addEventListener: function(type, listener) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(listener);
    },
    removeEventListener: function(type, listener) {
      listeners[type] = (listeners[type] || []).filter(function(item) { return item !== listener; });
    },
    dispatch: function(type, event) {
      var payload = event || {};
      payload.type = type;
      payload.target = payload.target || this;
      payload.preventDefault = payload.preventDefault || function() { this.prevented = true; };
      payload.stopPropagation = payload.stopPropagation || function() { this.propagationStopped = true; };
      payload.stopImmediatePropagation = payload.stopImmediatePropagation || function() {
        this.immediatePropagationStopped = true;
      };
      (listeners[type] || []).slice().forEach(function(listener) { listener(payload); });
      return payload;
    },
    dispatchEvent: function(event) {
      this.dispatch(event && event.type ? event.type : '', event || {});
      return true;
    },
    listenerCount: function() {
      return Object.keys(listeners).reduce(function(total, key) {
        return total + listeners[key].length;
      }, 0);
    },
  };
}

function wait(delayMs) {
  return new Promise(function(resolve) { setTimeout(resolve, delayMs); });
}

async function run() {
  var viewer = createEventTarget();
  var documentRef = createEventTarget();
  var input = createEventTarget();
  input.id = 'input-box';
  input.tagName = 'DIV';
  input.textContent = '原节点';
  input.value = '原节点';
  input.contains = function(target) { return target === input; };
  input.closest = function(selector) {
    if (selector === '#input-box' || selector === '[contenteditable]') return input;
    return null;
  };
  input.getAttribute = function(name) { return name === 'contenteditable' ? 'true' : ''; };
  input.focus = function() { documentRef.activeElement = input; };
  input.select = function() { input.selectCalls = Number(input.selectCalls || 0) + 1; };
  input.setSelectionRange = function(start, end) { input.selectionRange = [start, end]; };

  var node = createEventTarget();
  node.nodeObj = { id: 'node-1', topic: '登录节点' };
  node.getAttribute = function(name) { return name === 'data-xmind-select-group' ? 'case-node-1' : ''; };
  node.getBoundingClientRect = function() {
    return { left: 10, top: 10, right: 110, bottom: 50, width: 100, height: 40 };
  };
  node.closest = function(selector) {
    if (selector === 'me-tpc') return node;
    return null;
  };

  viewer.querySelectorAll = function(selector) { return selector === 'me-tpc' ? [node] : []; };
  viewer.contains = function(target) { return target === node || target === input; };
  documentRef.getElementById = function(id) { return id === 'input-box' ? input : null; };
  documentRef.elementsFromPoint = function() { return [node]; };
  documentRef.createRange = function() {
    return {
      startContainer: input,
      endContainer: input,
      selectNodeContents: function() {},
      collapse: function() {},
      setStart: function() {},
      deleteContents: function() {},
      insertNode: function() {},
      setStartAfter: function() {},
    };
  };
  documentRef.caretRangeFromPoint = function() { return documentRef.createRange(); };
  documentRef.createTextNode = function(text) { return { textContent: text }; };
  documentRef.createElement = function(tagName) { return { tagName: String(tagName || '').toUpperCase() }; };

  var calls = {
    beginEdit: 0,
    selection: 0,
    contextSelection: 0,
    focus: 0,
    update: 0,
    hideMenu: 0,
    dragReset: 0,
    mutation: 0,
    lineBreak: 0,
    insertText: [],
  };
  documentRef.execCommand = function(command, showUi, value) {
    if (command === 'insertLineBreak') {
      calls.lineBreak += 1;
      return true;
    }
    if (command === 'insertText') {
      calls.insertText.push(value);
      input.textContent = String(value || '');
      input.value = String(value || '');
      return true;
    }
    return false;
  };

  var selection = {
    rangeCount: 1,
    isCollapsed: true,
    getRangeAt: function() { return documentRef.createRange(); },
    removeAllRanges: function() {},
    addRange: function() {},
    toString: function() { return ''; },
  };
  var browser = {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    getSelection: function() { return selection; },
    Event: typeof Event === 'function' ? Event : null,
  };
  var state = { editing: true, pendingSave: false };
  var instance = {
    beginEdit: function(target) {
      assert.strictEqual(target, node);
      calls.beginEdit += 1;
    },
  };

  var api = editInputOwner.create({
    inputSelectionOwner: inputSelectionOwner,
    viewerEl: viewer,
    window: browser,
    document: documentRef,
    getInstance: function() { return instance; },
    isEditing: function() { return state.editing; },
    isPendingSave: function() { return state.pendingSave; },
    isEventInsideControls: function() { return false; },
    isNodeExpanderTarget: function() { return false; },
    isCtrlModifierActive: function() { return false; },
    collectSelectedNodes: function() { return [node]; },
    applySelectionNodes: function(nodes) {
      assert.deepStrictEqual(nodes, [node]);
      calls.selection += 1;
    },
    focusViewer: function() { calls.focus += 1; },
    updateEditButtons: function() { calls.update += 1; },
    selectNodeForContextMenu: function(target) {
      assert.strictEqual(target, node);
      calls.contextSelection += 1;
    },
    hideContextMenu: function() { calls.hideMenu += 1; },
    resetDragPreview: function() { calls.dragReset += 1; },
    onInputMutation: function() { calls.mutation += 1; },
  });

  assert.strictEqual(api.bind(), true);
  assert.strictEqual(api.bind(), false);
  assert.ok(viewer.listenerCount() > 0);
  assert.ok(documentRef.listenerCount() > 0);
  assert.strictEqual(api.isTypingTarget(input), true);
  assert.strictEqual(api.resolveEventNode({ target: node, clientX: 30, clientY: 20 }), node);

  viewer.dispatch('pointerdown', { button: 0, target: node, clientX: 30, clientY: 20 });
  viewer.dispatch('pointerup', { button: 0, target: node, clientX: 30, clientY: 20 });
  await wait(10);
  assert.ok(calls.selection >= 1);

  var keyboardEvent = {
    key: 'x',
    target: viewer,
    preventDefault: function() { this.prevented = true; },
    stopPropagation: function() { this.propagationStopped = true; },
  };
  assert.strictEqual(api.beginKeyboardEdit(keyboardEvent), true);
  assert.strictEqual(keyboardEvent.prevented, true);
  await wait(10);
  assert.strictEqual(calls.beginEdit, 1);
  assert.strictEqual(api.handleOperation({ name: 'beginEdit' }), true);
  await wait(40);
  assert.deepStrictEqual(calls.insertText, ['x']);
  assert.strictEqual(input.textContent, 'x');
  assert.ok(input.listenerCount() > 0);

  var enterEvent = viewer.dispatch('keydown', { key: 'Enter', target: input });
  assert.strictEqual(enterEvent.prevented, true);
  assert.strictEqual(calls.lineBreak, 1);

  viewer.dispatch('input', { target: input });
  assert.strictEqual(calls.mutation, 1);
  viewer.dispatch('pointerdown', { button: 0, target: input, clientX: 25, clientY: 20 });
  assert.ok(calls.hideMenu >= 1);
  assert.ok(calls.dragReset >= 1);

  assert.strictEqual(api.handleEditingDblClick({
    target: node,
    clientX: 40,
    clientY: 25,
    preventDefault: function() {},
    stopImmediatePropagation: function() {},
  }), true);
  await wait(10);
  assert.strictEqual(calls.beginEdit, 2);

  api.destroy();
  assert.strictEqual(viewer.listenerCount(), 0);
  assert.strictEqual(documentRef.listenerCount(), 0);
  assert.strictEqual(input.listenerCount(), 0);

  var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
  assert.ok(coreSource.indexOf('editInputControllerOwner.create') !== -1);
  assert.strictEqual(coreSource.indexOf('function placeInputCaretAtPoint('), -1);
  assert.strictEqual(coreSource.indexOf('function beginNodeEditBySingleClick('), -1);
  assert.strictEqual(coreSource.indexOf('editInputPointerState'), -1);

  ['index.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var inputSelectionIndex = html.indexOf('./scripts/core/mindElixirInputSelectionController.js');
    var editInputIndex = html.indexOf('./scripts/core/mindElixirEditInputController.js');
    var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
    assert.ok(editInputIndex > inputSelectionIndex, fileName + ' should load input selection before edit input');
    assert.ok(coreIndex > editInputIndex, fileName + ' should load edit input before core');
  });

  var loaderSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'), 'utf8');
  var loaderInputSelectionIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirInputSelectionController.js'");
  var loaderEditInputIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirEditInputController.js'");
  var loaderCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
  assert.ok(loaderEditInputIndex > loaderInputSelectionIndex);
  assert.ok(loaderCoreIndex > loaderEditInputIndex);

  console.log('mind_elixir_edit_input_controller.test.js passed');
}

run().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
