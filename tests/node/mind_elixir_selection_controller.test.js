'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var selectionModelOwner = require(path.join(projectRoot, 'scripts/core/mindElixirSelectionModel.js'));
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirSelectionController.js'));

assert.ok(owner && typeof owner.create === 'function');

function createClassList() {
  var values = Object.create(null);
  return {
    add: function(name) { values[name] = true; },
    remove: function(name) { delete values[name]; },
    contains: function(name) { return values[name] === true; },
  };
}

function createEventTarget() {
  var listeners = Object.create(null);
  return {
    listeners: listeners,
    addEventListener: function(type, listener) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(listener);
    },
    removeEventListener: function(type, listener) {
      var list = listeners[type] || [];
      listeners[type] = list.filter(function(item) { return item !== listener; });
    },
    dispatch: function(type, event) {
      var payload = event || {};
      payload.type = type;
      payload.preventDefault = payload.preventDefault || function() { this.prevented = true; };
      payload.stopPropagation = payload.stopPropagation || function() { this.stopped = true; };
      payload.stopImmediatePropagation = payload.stopImmediatePropagation || function() {
        this.immediateStopped = true;
      };
      (listeners[type] || []).slice().some(function(listener) {
        listener(payload);
        return payload.immediateStopped === true;
      });
      return payload;
    },
    listenerCount: function() {
      return Object.keys(listeners).reduce(function(total, key) {
        return total + listeners[key].length;
      }, 0);
    },
  };
}

function createNode(id, group, rect, preferred) {
  var attrs = {
    'data-nodeid': id,
    'data-xmind-select-group': group,
    'data-xmind-select-preferred': preferred === false ? '0' : '1',
  };
  return {
    tagName: 'ME-TPC',
    nodeObj: { id: id, parent: { id: 'root' } },
    classList: createClassList(),
    isConnected: true,
    getAttribute: function(name) { return attrs[name] || ''; },
    setAttribute: function(name, value) { attrs[name] = String(value); },
    getBoundingClientRect: function() { return rect; },
    closest: function(selector) { return selector === 'me-tpc' ? this : null; },
  };
}

function createViewer(nodes) {
  var target = createEventTarget();
  target.classList = createClassList();
  target.children = [];
  target.contains = function(node) { return nodes.indexOf(node) !== -1 || target.children.indexOf(node) !== -1; };
  target.getBoundingClientRect = function() {
    return { left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 };
  };
  target.querySelectorAll = function(selector) {
    if (selector === 'me-tpc') return nodes;
    if (selector === '.selected') return [];
    if (selector === 'me-tpc[data-xmind-select-group]') {
      return nodes.filter(function(node) { return Boolean(node.getAttribute('data-xmind-select-group')); });
    }
    if (selector === 'me-tpc.xmind-box-selected') {
      return nodes.filter(function(node) { return node.classList.contains('xmind-box-selected'); });
    }
    return [];
  };
  target.appendChild = function(child) {
    child.parentNode = target;
    child.isConnected = true;
    target.children.push(child);
  };
  target.removeChild = function(child) {
    target.children = target.children.filter(function(item) { return item !== child; });
    child.parentNode = null;
    child.isConnected = false;
  };
  return target;
}

function buildApi() {
  var first = createNode('first', 'case::first', {
    left: 10, top: 10, right: 40, bottom: 30, width: 30, height: 20,
  });
  var second = createNode('second', 'case::second', {
    left: 50, top: 10, right: 80, bottom: 30, width: 30, height: 20,
  });
  var outside = createNode('outside', 'case::outside', {
    left: 140, top: 60, right: 180, bottom: 85, width: 40, height: 25,
  });
  var nodes = [first, second, outside];
  var viewer = createViewer(nodes);
  var browser = createEventTarget();
  var state = { editing: false, pendingSave: false };
  var calls = { clear: 0, selected: [], buttons: 0 };
  var instance = {
    currentNodes: [],
    clearSelection: function() { calls.clear += 1; this.currentNodes = []; },
    selectNodes: function(next) { calls.selected = next.slice(); this.currentNodes = next.slice(); },
  };
  var api = owner.create({
    viewerEl: viewer,
    window: browser,
    document: {
      createElement: function() { return { className: '', style: {}, isConnected: false }; },
    },
    enabled: true,
    selectionModelOwner: selectionModelOwner,
    getInstance: function() { return instance; },
    isEditing: function() { return state.editing; },
    isPendingSave: function() { return state.pendingSave; },
    findNodeById: function(id) {
      return nodes.filter(function(node) { return node.nodeObj.id === id; })[0] || null;
    },
    collectNodeLocatePath: function(node) { return [node.nodeObj.id]; },
    resolveEventNode: function(event) { return event.node || null; },
    isCtrlModifierActive: function(event) { return Boolean(event && event.ctrlKey); },
    isEventInsideControls: function() { return false; },
    isEventInsideCanvas: function() { return true; },
    isNodeExpanderTarget: function() { return false; },
    updateEditButtons: function() { calls.buttons += 1; },
  });
  return {
    api: api,
    browser: browser,
    viewer: viewer,
    state: state,
    calls: calls,
    nodes: nodes,
  };
}

var context = buildApi();
assert.strictEqual(context.api.bind(), true);

var pointerEvent = context.viewer.dispatch('pointerdown', {
  button: 0,
  pointerType: 'mouse',
  ctrlKey: true,
  node: context.nodes[0],
  target: context.nodes[0],
  clientX: 20,
  clientY: 20,
});
assert.strictEqual(pointerEvent.prevented, true);
assert.deepStrictEqual(context.api.collect().map(function(node) { return node.nodeObj.id; }), ['first']);

context.viewer.dispatch('mousedown', {
  button: 0,
  ctrlKey: true,
  node: context.nodes[0],
  target: context.nodes[0],
  clientX: 20,
  clientY: 20,
});
assert.deepStrictEqual(context.api.collect().map(function(node) { return node.nodeObj.id; }), ['first']);

context.api.clear(true);
context.viewer.dispatch('pointerdown', {
  button: 0,
  pointerType: 'mouse',
  target: context.viewer,
  clientX: 5,
  clientY: 5,
});
context.browser.dispatch('pointermove', { clientX: 90, clientY: 40 });
context.browser.dispatch('pointerup', { clientX: 90, clientY: 40 });
assert.deepStrictEqual(
  context.api.collect().map(function(node) { return node.nodeObj.id; }).sort(),
  ['first', 'second']
);
assert.strictEqual(context.nodes[2].classList.contains('xmind-box-selected'), false);

context.api.handleReadOnlyClick({ ctrlKey: false, shiftKey: false, altKey: false, target: context.viewer }, context.nodes[2]);
assert.deepStrictEqual(context.api.collect().map(function(node) { return node.nodeObj.id; }), ['outside']);

context.state.editing = true;
context.api.clear(true);
context.viewer.dispatch('pointerdown', {
  button: 0,
  pointerType: 'mouse',
  target: context.viewer,
  clientX: 0,
  clientY: 0,
});
assert.deepStrictEqual(context.api.collect(), []);

assert.ok(context.viewer.listenerCount() > 0);
assert.ok(context.browser.listenerCount() > 0);
context.api.destroy();
assert.strictEqual(context.viewer.listenerCount(), 0);
assert.strictEqual(context.browser.listenerCount(), 0);
assert.strictEqual(context.viewer.children.length, 0);

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.ok(coreSource.indexOf('selectionControllerOwner.create') !== -1);
assert.strictEqual(coreSource.indexOf('function startBoxSelection('), -1);
assert.strictEqual(coreSource.indexOf('function moveBoxSelection('), -1);
assert.strictEqual(coreSource.indexOf('function beginModifierNodeSelection('), -1);

['index.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html'].forEach(function(fileName) {
  var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
  var modelIndex = html.indexOf('./scripts/core/mindElixirSelectionModel.js');
  var controllerIndex = html.indexOf('./scripts/core/mindElixirSelectionController.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(modelIndex !== -1 && controllerIndex > modelIndex, fileName + ' should load the model first');
  assert.ok(coreIndex > controllerIndex, fileName + ' should load the controller before the core');
});

var loaderSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'), 'utf8');
var loaderModelIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirSelectionModel.js'");
var loaderControllerIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirSelectionController.js'");
var loaderCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(loaderControllerIndex > loaderModelIndex);
assert.ok(loaderCoreIndex > loaderControllerIndex);

console.log('mind_elixir_selection_controller.test.js passed');
