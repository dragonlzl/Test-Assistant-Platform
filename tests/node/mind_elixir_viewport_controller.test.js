'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var frameCallbacks = Object.create(null);
var nextFrameId = 1;
var windowListeners = Object.create(null);
var fakeWindow = {
  app: {},
  addEventListener: function(name, handler) { windowListeners[name] = handler; },
  removeEventListener: function(name, handler) {
    if (windowListeners[name] === handler) delete windowListeners[name];
  },
  requestAnimationFrame: function(callback) {
    var id = nextFrameId;
    nextFrameId += 1;
    frameCallbacks[id] = callback;
    return id;
  },
  cancelAnimationFrame: function(id) { delete frameCallbacks[id]; },
  getComputedStyle: function() { return { overflowY: 'visible' }; },
};
var context = vm.createContext({
  window: fakeWindow,
  document: { body: {} },
  Array: Array,
  Boolean: Boolean,
  Date: Date,
  Math: Math,
  Number: Number,
  Object: Object,
  String: String,
  clearTimeout: clearTimeout,
  isFinite: isFinite,
  setTimeout: setTimeout,
});
var ownerSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/core/mindElixirViewportController.js'),
  'utf8'
);
vm.runInContext(ownerSource, context, { filename: 'scripts/core/mindElixirViewportController.js' });

var owner = fakeWindow.app.mindElixirViewportController;
assert.ok(owner && typeof owner.create === 'function');
assert.strictEqual(owner.clampScale(4, 0.1, 2.5), 2.5);
assert.strictEqual(owner.clampScale(0.01, 0.1, 2.5), 0.1);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(owner.parseTransformState('translate3d(12px, -8px, 0px) scale(1.4)'))),
  { x: 12, y: -8, scale: 1.4 }
);

function createClassList() {
  var values = Object.create(null);
  return {
    add: function(name) { values[String(name)] = true; },
    remove: function(name) { delete values[String(name)]; },
    contains: function(name) { return values[String(name)] === true; },
  };
}

function createEventTarget() {
  var listeners = Object.create(null);
  return {
    listeners: listeners,
    addEventListener: function(name, handler) { listeners[name] = handler; },
    removeEventListener: function(name, handler) {
      if (listeners[name] === handler) delete listeners[name];
    },
  };
}

function flushFrames() {
  var ids = Object.keys(frameCallbacks);
  ids.forEach(function(id) {
    var callback = frameCallbacks[id];
    delete frameCallbacks[id];
    callback();
  });
}

var viewerEl = createEventTarget();
viewerEl.classList = createClassList();
viewerEl.contains = function(target) { return Boolean(target && target.insideViewer); };
viewerEl.parentElement = null;
var canvasEl = {
  getBoundingClientRect: function() {
    return { left: 20, top: 10, width: 400, height: 300 };
  },
};
var scaleCalls = [];
var moveCalls = [];
var instance = {
  scaleVal: 1,
  scaleSensitivity: 0.2,
  map: { style: { transform: '' } },
  nodeData: { id: 'root' },
  scale: function(value, center) {
    this.scaleVal = value;
    scaleCalls.push({ value: value, center: center });
  },
  move: function(deltaX, deltaY) { moveCalls.push([deltaX, deltaY]); },
  scaleFit: function() { this.scaleVal = 0.5; },
};
var viewReasons = [];
var beforeDragCount = 0;
var ctrlReleaseCount = 0;
var globalPointerCount = 0;

var controller = owner.create({
  viewerEl: viewerEl,
  canvasEl: canvasEl,
  getInstance: function() { return instance; },
  minScale: 0.1,
  maxScale: 2.5,
  defaultScaleStep: 0.1,
  enableCustomBoxSelection: false,
  isEventInsideControls: function(target) { return Boolean(target && target.insideControls); },
  isEventInsideCanvas: function(target) { return Boolean(target && target.insideCanvas); },
  isNodeExpanderTarget: function() { return false; },
  onBeforeCtrlDrag: function() { beforeDragCount += 1; },
  onCtrlRelease: function() { ctrlReleaseCount += 1; },
  onGlobalPointerDown: function() { globalPointerCount += 1; },
  onViewStateChange: function(payload) { viewReasons.push(payload.reason); },
});

assert.strictEqual(instance.scaleMin, 0.1);
assert.strictEqual(instance.scaleMax, 2.5);
assert.strictEqual(instance.__tapViewportInteracted, false);
assert.strictEqual(typeof instance.__tapSyncZoomMinScale, 'function');
assert.strictEqual(typeof viewerEl.listeners.wheel, 'function');
assert.strictEqual(typeof viewerEl.listeners.pointerdown, 'function');
assert.strictEqual(typeof windowListeners.pointermove, 'function');

controller.zoomBy(0.2);
assert.strictEqual(scaleCalls.length, 1);
assert.strictEqual(scaleCalls[0].value, 1.2);
assert.deepStrictEqual(JSON.parse(JSON.stringify(scaleCalls[0].center)), { x: 220, y: 160 });
assert.strictEqual(instance.__tapViewportInteracted, true);
assert.strictEqual(viewReasons[0], 'zoom-in');

var prevented = 0;
var stopped = 0;
viewerEl.listeners.wheel({
  type: 'wheel',
  target: { insideCanvas: true, insideViewer: true },
  ctrlKey: true,
  metaKey: false,
  deltaX: 0,
  deltaY: -10,
  clientX: 100,
  clientY: 120,
  preventDefault: function() { prevented += 1; },
  stopImmediatePropagation: function() { stopped += 1; },
});
assert.strictEqual(scaleCalls.length, 2);
assert.strictEqual(scaleCalls[1].value, 1.4);
assert.deepStrictEqual(JSON.parse(JSON.stringify(scaleCalls[1].center)), { x: 100, y: 120 });
assert.strictEqual(viewReasons[1], 'zoom-wheel');

viewerEl.listeners.wheel({
  type: 'wheel',
  target: { insideCanvas: true, insideViewer: true },
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  deltaX: 4,
  deltaY: 6,
  preventDefault: function() { prevented += 1; },
  stopImmediatePropagation: function() { stopped += 1; },
});
assert.strictEqual(moveCalls.length, 0);
flushFrames();
assert.deepStrictEqual(moveCalls, [[-4, -6]]);
assert.strictEqual(viewReasons[2], 'pan-wheel');
assert.strictEqual(prevented, 2);
assert.strictEqual(stopped, 2);

var dragTarget = { insideCanvas: true, insideViewer: true };
windowListeners.keydown({ key: 'Control', ctrlKey: true });
windowListeners.pointerdown({
  type: 'pointerdown',
  target: dragTarget,
  button: 0,
  buttons: 1,
  pointerType: 'mouse',
  pointerId: 7,
  ctrlKey: true,
  clientX: 30,
  clientY: 40,
  preventDefault: function() {},
  stopImmediatePropagation: function() {},
});
assert.strictEqual(globalPointerCount, 1);
assert.strictEqual(beforeDragCount, 1);
assert.strictEqual(viewerEl.classList.contains('is-ctrl-left-dragging'), true);
windowListeners.pointermove({
  pointerId: 7,
  buttons: 1,
  ctrlKey: true,
  clientX: 45,
  clientY: 55,
  preventDefault: function() {},
  stopImmediatePropagation: function() {},
});
flushFrames();
assert.deepStrictEqual(moveCalls[1], [15, 15]);
assert.strictEqual(viewReasons[3], 'pan-drag');
windowListeners.keyup({ key: 'Control', ctrlKey: false });
assert.strictEqual(ctrlReleaseCount, 1);
assert.strictEqual(viewerEl.classList.contains('is-ctrl-left-dragging'), false);

instance.map.style.transform = '';
assert.strictEqual(owner.writeTransformState(instance, { x: 3, y: 4, scale: 1.5 }), true);
assert.strictEqual(instance.map.style.transform, 'translate3d(3px, 4px, 0px) scale(1.5)');

controller.destroy();
assert.strictEqual(viewerEl.listeners.wheel, undefined);
assert.strictEqual(viewerEl.listeners.pointerdown, undefined);
assert.strictEqual(windowListeners.pointermove, undefined);
assert.strictEqual(instance.__tapSyncZoomMinScale, undefined);
assert.strictEqual(instance.__tapViewportInteracted, undefined);

var replacedMoveCalls = [];
var replacementInstance = {
  scaleVal: 1,
  map: { style: { transform: '' } },
  move: function(deltaX, deltaY) { replacedMoveCalls.push([deltaX, deltaY]); },
};
var replacementController = owner.create({
  viewerEl: viewerEl,
  canvasEl: canvasEl,
  getInstance: function() { return replacementInstance; },
  isEventInsideCanvas: function(target) { return Boolean(target && target.insideCanvas); },
});
replacementController.queuePan(8, 9, 'stale-pan', false);

var activeMoveCalls = [];
var activeInstance = {
  scaleVal: 1,
  map: { style: { transform: '' } },
  move: function(deltaX, deltaY) { activeMoveCalls.push([deltaX, deltaY]); },
};
var activeController = owner.create({
  viewerEl: viewerEl,
  canvasEl: canvasEl,
  getInstance: function() { return activeInstance; },
  isEventInsideCanvas: function(target) { return Boolean(target && target.insideCanvas); },
});
flushFrames();
assert.deepStrictEqual(replacedMoveCalls, []);
assert.strictEqual(replacementInstance.__tapViewportInteracted, undefined);
assert.strictEqual(typeof activeInstance.__tapSyncZoomMinScale, 'function');

viewerEl.listeners.wheel({
  type: 'wheel',
  target: { insideCanvas: true, insideViewer: true },
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  deltaX: 2,
  deltaY: 3,
  preventDefault: function() {},
  stopImmediatePropagation: function() {},
});
flushFrames();
assert.deepStrictEqual(activeMoveCalls, [[-2, -3]]);
activeController.destroy();

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.strictEqual(coreSource.indexOf('function zoomByWheelEvent('), -1);
assert.strictEqual(coreSource.indexOf('function moveCtrlLeftCanvasDrag('), -1);
assert.ok(coreSource.indexOf('viewportControllerOwner.create') !== -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var viewportIndex = html.indexOf('./scripts/core/mindElixirViewportController.js');
  var searchIndex = html.indexOf('./scripts/core/mindElixirSearchController.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(viewportIndex !== -1, relativePath + ' should load the viewport controller');
  assert.ok(searchIndex !== -1 && viewportIndex < searchIndex, relativePath + ' should load viewport before search');
  assert.ok(coreIndex !== -1 && searchIndex < coreIndex, relativePath + ' should load owners before core');
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicViewportIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirViewportController.js'");
var dynamicSearchIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirSearchController.js'");
var dynamicCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(dynamicViewportIndex !== -1);
assert.ok(dynamicSearchIndex !== -1 && dynamicViewportIndex < dynamicSearchIndex);
assert.ok(dynamicCoreIndex !== -1 && dynamicSearchIndex < dynamicCoreIndex);

console.log('mind_elixir_viewport_controller.test.js passed');
