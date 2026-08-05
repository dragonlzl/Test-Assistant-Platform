'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirDragController.js'));

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
      listeners[type] = (listeners[type] || []).filter(function(item) { return item !== listener; });
    },
    dispatch: function(type, event) {
      var payload = event || {};
      payload.type = type;
      payload.preventDefault = payload.preventDefault || function() { this.prevented = true; };
      (listeners[type] || []).slice().forEach(function(listener) { listener(payload); });
      return payload;
    },
    listenerCount: function() {
      return Object.keys(listeners).reduce(function(total, key) {
        return total + listeners[key].length;
      }, 0);
    },
  };
}

function createElement(className) {
  var attrs = Object.create(null);
  return {
    className: className || '',
    classList: createClassList(),
    style: {},
    textContent: '',
    parentNode: null,
    setAttribute: function(name, value) { attrs[name] = String(value); },
    removeAttribute: function(name) { delete attrs[name]; },
    getAttribute: function(name) { return attrs[name] || ''; },
    querySelector: function() { return null; },
    getBoundingClientRect: function() { return { width: 80, height: 24 }; },
  };
}

function findNodeWithParentById(rootNode, nodeId, parentNode) {
  if (!rootNode) return null;
  if (String(rootNode.id || '') === String(nodeId || '')) {
    return { node: rootNode, parent: parentNode || null };
  }
  var children = Array.isArray(rootNode.children) ? rootNode.children : [];
  for (var i = 0; i < children.length; i += 1) {
    var found = findNodeWithParentById(children[i], nodeId, rootNode);
    if (found) return found;
  }
  return null;
}

function buildContext() {
  var viewer = createEventTarget();
  viewer.classList = createClassList();
  var browser = createEventTarget();
  browser.getComputedStyle = function(element) { return element.style; };
  var body = {
    children: [],
    appendChild: function(element) {
      element.parentNode = body;
      body.children.push(element);
    },
    removeChild: function(element) {
      body.children = body.children.filter(function(item) { return item !== element; });
      element.parentNode = null;
    },
  };
  var documentRef = {
    body: body,
    createElement: function() { return createElement(''); },
    querySelector: function() { return null; },
  };
  var main = { classList: createClassList() };
  main.classList.add('rhs');
  var capturedPointerId = null;
  var releasedPointerId = null;
  var node = createElement('mind-node');
  node.nodeObj = { id: 'branch', topic: '登录流程' };
  node.closest = function(selector) {
    if (selector === 'me-tpc') return node;
    if (selector === 'me-main') return main;
    return null;
  };
  node.setPointerCapture = function(pointerId) { capturedPointerId = pointerId; };
  node.hasPointerCapture = function(pointerId) { return capturedPointerId === pointerId; };
  node.releasePointerCapture = function(pointerId) { releasedPointerId = pointerId; capturedPointerId = null; };

  var nativeGhost = createElement('mind-elixir-ghost');
  nativeGhost.style.display = 'block';
  var data = {
    nodeData: {
      id: 'root', topic: '根节点', children: [{
        id: 'branch', topic: '登录流程', direction: 1, children: [
          { id: 'leaf', topic: '成功登录', direction: 1, children: [] },
        ],
      }],
    },
  };
  var calls = { refresh: 0, moved: 0, clearTimer: 0, initSide: 0 };
  var instance = {
    LEFT: 0,
    RIGHT: 1,
    SIDE: 2,
    direction: 1,
    nodeData: data.nodeData,
    dragged: [],
    __tapDetachedNodes: [nativeGhost],
    container: {
      querySelector: function(selector) {
        if (selector !== 'me-root > me-tpc') return null;
        return { getBoundingClientRect: function() { return { left: 80, width: 40 }; } };
      },
    },
    initSide: function() { calls.initSide += 1; this.direction = this.SIDE; },
    refresh: function(nextData) { calls.refresh += 1; this.nodeData = nextData.nodeData; },
  };
  var state = { editing: true, pendingSave: false, modifiedSelection: false };
  var api = owner.create({
    viewerEl: viewer,
    window: browser,
    document: documentRef,
    setTimeout: function(callback) { callback(); return 1; },
    getInstance: function() { return instance; },
    isEditing: function() { return state.editing; },
    isPendingSave: function() { return state.pendingSave; },
    isEventInsideControls: function() { return false; },
    isNodeExpanderTarget: function() { return false; },
    isTypingTarget: function() { return false; },
    selectModifiedNodeFromEvent: function() { return state.modifiedSelection; },
    clearClickEditTimer: function() { calls.clearTimer += 1; },
    collectSelectedNodes: function() { return [node]; },
    findNodeElement: function() { return node; },
    getCurrentMindData: function() { return data; },
    findNodeWithParentById: findNodeWithParentById,
    refreshMindData: function(nextData) {
      instance.refresh(nextData);
      return true;
    },
    onRootSideMoved: function() { calls.moved += 1; },
  });
  return {
    api: api,
    viewer: viewer,
    browser: browser,
    body: body,
    node: node,
    nativeGhost: nativeGhost,
    data: data,
    state: state,
    calls: calls,
    instance: instance,
    getCapturedPointerId: function() { return capturedPointerId; },
    getReleasedPointerId: function() { return releasedPointerId; },
  };
}

var context = buildContext();
assert.strictEqual(context.api.bind(), true);
assert.strictEqual(context.api.bind(), false);

var rightDown = context.viewer.dispatch('pointerdown', {
  button: 2,
  pointerType: 'mouse',
  pointerId: 7,
  target: context.node,
});
assert.strictEqual(rightDown.prevented, true);
assert.strictEqual(context.getCapturedPointerId(), 7);
assert.strictEqual(context.viewer.classList.contains('is-right-dragging'), true);
assert.strictEqual(context.api.shouldSuppressContextMenu(), true);

context.browser.dispatch('pointerup', { pointerId: 7, buttons: 0 });
assert.strictEqual(context.getReleasedPointerId(), 7);
assert.strictEqual(context.viewer.classList.contains('is-right-dragging'), false);
assert.strictEqual(context.api.shouldSuppressContextMenu(), true);

var legacyDown = { button: 2, preventDefault: function() { this.prevented = true; } };
assert.strictEqual(context.api.beginLegacyRightDrag(legacyDown), true);
assert.strictEqual(legacyDown.prevented, true);
context.browser.dispatch('mouseup', { buttons: 0 });

context.viewer.dispatch('pointerdown', {
  button: 0,
  pointerId: 9,
  clientX: 150,
  clientY: 40,
  target: context.node,
});
context.browser.dispatch('pointermove', {
  pointerId: 9,
  buttons: 1,
  clientX: 120,
  clientY: 60,
});
assert.strictEqual(context.body.children.length, 1);
assert.strictEqual(context.body.children[0].textContent, '登录流程');
assert.strictEqual(context.body.children[0].style.display, 'block');
assert.strictEqual(context.body.children[0].style.transform, 'translate(132px, 72px)');

context.instance.dragged = [context.node];
context.browser.dispatch('pointermove', {
  pointerId: 9,
  buttons: 1,
  clientX: 110,
  clientY: 55,
});
assert.strictEqual(context.nativeGhost.classList.contains('xmind-floating-ghost-active'), true);
assert.strictEqual(context.nativeGhost.textContent, '登录流程');
assert.strictEqual(context.nativeGhost.style.transform, 'translate(70px, 43px)');

context.browser.dispatch('pointerup', {
  pointerId: 9,
  buttons: 0,
  clientX: 40,
  clientY: 55,
});
assert.strictEqual(context.calls.initSide, 1);
assert.strictEqual(context.calls.refresh, 1);
assert.strictEqual(context.calls.moved, 1);
assert.strictEqual(context.data.nodeData.children[0].direction, 0);
assert.strictEqual(context.data.nodeData.children[0].children[0].direction, 0);
assert.strictEqual(context.body.children[0].style.display, 'none');
assert.strictEqual(context.nativeGhost.classList.contains('xmind-floating-ghost-active'), false);

assert.ok(context.viewer.listenerCount() > 0);
assert.ok(context.browser.listenerCount() > 0);
context.api.destroy();
assert.strictEqual(context.viewer.listenerCount(), 0);
assert.strictEqual(context.browser.listenerCount(), 0);
assert.strictEqual(context.body.children.length, 0);

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.ok(coreSource.indexOf('dragControllerOwner.create') !== -1);
assert.strictEqual(coreSource.indexOf('function syncDragGhostFollowPointer('), -1);
assert.strictEqual(coreSource.indexOf('function moveRootNodeAcrossSide('), -1);
assert.strictEqual(coreSource.indexOf('rightDragGestureBlock'), -1);

['index.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html'].forEach(function(fileName) {
  var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
  var selectionIndex = html.indexOf('./scripts/core/mindElixirSelectionController.js');
  var dragIndex = html.indexOf('./scripts/core/mindElixirDragController.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(dragIndex > selectionIndex, fileName + ' should load selection before drag');
  assert.ok(coreIndex > dragIndex, fileName + ' should load drag before core');
});

var loaderSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'), 'utf8');
var loaderSelectionIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirSelectionController.js'");
var loaderDragIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirDragController.js'");
var loaderCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(loaderDragIndex > loaderSelectionIndex);
assert.ok(loaderCoreIndex > loaderDragIndex);

console.log('mind_elixir_drag_controller.test.js passed');
