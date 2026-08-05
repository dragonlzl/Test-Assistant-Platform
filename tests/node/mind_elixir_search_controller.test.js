'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var context = vm.createContext({
  window: { app: {} },
  Array: Array,
  Boolean: Boolean,
  Math: Math,
  Number: Number,
  Object: Object,
  String: String,
  clearTimeout: clearTimeout,
  isFinite: isFinite,
  setTimeout: setTimeout,
});
var ownerSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/core/mindElixirSearchController.js'),
  'utf8'
);
vm.runInContext(ownerSource, context, { filename: 'scripts/core/mindElixirSearchController.js' });

var owner = context.window.app.mindElixirSearchController;
assert.ok(owner && typeof owner.create === 'function');
assert.strictEqual(owner.normalizeKeyword('  AbC  '), 'abc');

function createClassList() {
  var values = Object.create(null);
  return {
    add: function(name) { values[String(name)] = true; },
    remove: function(name) { delete values[String(name)]; },
    contains: function(name) { return values[String(name)] === true; },
  };
}

function createNodeElement(id, rect) {
  return {
    id: id,
    classList: createClassList(),
    getBoundingClientRect: function() { return rect; },
  };
}

var listeners = Object.create(null);
var focusCount = 0;
var searchInputEl = {
  value: '',
  selectionStart: 0,
  selectionEnd: 0,
  ownerDocument: {
    body: {
      contains: function(target) { return target === searchInputEl; },
    },
  },
  addEventListener: function(name, handler) { listeners[name] = handler; },
  removeEventListener: function(name, handler) {
    if (listeners[name] === handler) delete listeners[name];
  },
  focus: function() { focusCount += 1; },
  setSelectionRange: function(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  },
};
var searchCountEl = {
  textContent: '',
  classList: createClassList(),
};
var controlsEl = {
  querySelector: function(selector) {
    if (selector === '[data-mind-search-input]') return searchInputEl;
    if (selector === '[data-mind-search-count]') return searchCountEl;
    return null;
  },
};

var visibleRect = { left: 320, top: 200, width: 80, height: 20 };
var nodeElements = {
  root: createNodeElement('root', visibleRect),
  module1: createNodeElement('module1', visibleRect),
  case1: createNodeElement('case1', visibleRect),
  case2: createNodeElement('case2', visibleRect),
  hidden: createNodeElement('hidden', { left: 0, top: 0, width: 0, height: 0 }),
  steps1: createNodeElement('steps1', visibleRect),
};
var mindData = {
  id: 'root',
  topic: '支付需求',
  children: [{
    id: 'module1',
    topic: '支付模块',
    xmindMeta: { type: 'module' },
    children: [
      { id: 'case1', topic: '余额不足时支付失败', xmindMeta: { type: 'case' } },
      { id: 'case2', topic: '余额不足时支付提示', xmindMeta: { type: 'case' } },
      { id: 'hidden', topic: '余额不足隐藏节点', xmindMeta: { type: 'case' } },
      { id: 'steps1', topic: '余额不足时点击支付', xmindMeta: { type: 'steps' } },
    ],
  }],
};
var instance = {
  nodeData: mindData,
  map: { style: { transform: 'translate(0px, 0px) scale(1)' } },
  findEle: function(id) { return nodeElements[String(id)] || null; },
};
var viewerEl = {
  querySelectorAll: function() {
    return Object.keys(nodeElements).map(function(key) {
      return nodeElements[key];
    }).filter(function(node) {
      return node.classList.contains('xmind-search-hit')
        || node.classList.contains('xmind-search-active');
    });
  },
};
var canvasEl = {
  getBoundingClientRect: function() {
    return { left: 0, top: 0, width: 400, height: 300 };
  },
};
var transformWrites = [];

var collected = [];
owner.collectNodeIds(mindData, '余额不足', collected);
assert.deepStrictEqual(Array.prototype.slice.call(collected), ['case1', 'case2', 'hidden']);

var controller = owner.create({
  controlsEl: controlsEl,
  viewerEl: viewerEl,
  canvasEl: canvasEl,
  getInstance: function() { return instance; },
  findNodeElement: function(inst, id) { return inst.findEle(id); },
  resolveAnchorElement: function(nodeEl) { return nodeEl; },
  parseTransformState: function() { return { x: 0, y: 0, scale: 1 }; },
  writeTransformState: function(inst, state) {
    transformWrites.push({ x: state.x, y: state.y, scale: state.scale });
    return true;
  },
});

assert.strictEqual(typeof listeners.input, 'function');
assert.strictEqual(typeof listeners.keydown, 'function');
assert.strictEqual(searchCountEl.textContent, '0/0');

searchInputEl.value = '余额不足';
searchInputEl.selectionStart = searchInputEl.value.length;
searchInputEl.selectionEnd = searchInputEl.value.length;
listeners.input();
assert.strictEqual(searchCountEl.textContent, '1/2');
assert.strictEqual(nodeElements.case1.classList.contains('xmind-search-hit'), true);
assert.strictEqual(nodeElements.case2.classList.contains('xmind-search-hit'), true);
assert.strictEqual(nodeElements.hidden.classList.contains('xmind-search-hit'), false);
assert.strictEqual(nodeElements.steps1.classList.contains('xmind-search-hit'), false);
assert.strictEqual(nodeElements.case1.classList.contains('xmind-search-active'), true);
assert.ok(transformWrites.length >= 1);

var prevented = 0;
var stopped = 0;
listeners.keydown({
  key: 'Enter',
  shiftKey: false,
  preventDefault: function() { prevented += 1; },
  stopPropagation: function() { stopped += 1; },
});
assert.strictEqual(searchCountEl.textContent, '2/2');
assert.strictEqual(nodeElements.case2.classList.contains('xmind-search-active'), true);
listeners.keydown({
  key: 'Enter',
  shiftKey: true,
  preventDefault: function() { prevented += 1; },
  stopPropagation: function() { stopped += 1; },
});
assert.strictEqual(searchCountEl.textContent, '1/2');
assert.strictEqual(prevented, 2);
assert.strictEqual(stopped, 2);

controller.clear({ focusInput: true });
assert.strictEqual(searchInputEl.value, '');
assert.strictEqual(searchCountEl.textContent, '0/0');
assert.strictEqual(nodeElements.case1.classList.contains('xmind-search-hit'), false);
assert.ok(focusCount >= 1);

searchInputEl.value = '支付';
controller.run({ keepIndex: false });
assert.strictEqual(searchCountEl.textContent, '1/4');
controller.destroy();
assert.strictEqual(listeners.input, undefined);
assert.strictEqual(listeners.keydown, undefined);
assert.strictEqual(nodeElements.root.classList.contains('xmind-search-hit'), false);
assert.strictEqual(nodeElements.module1.classList.contains('xmind-search-hit'), false);

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.strictEqual(coreSource.indexOf('function runSearch('), -1);
assert.strictEqual(coreSource.indexOf('var searchState ='), -1);
assert.ok(coreSource.indexOf('searchControllerOwner.create') !== -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var ownerIndex = html.indexOf('./scripts/core/mindElixirSearchController.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(ownerIndex !== -1, relativePath + ' should load the search controller');
  assert.ok(coreIndex !== -1 && ownerIndex < coreIndex, relativePath + ' should load the owner first');
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicOwnerIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirSearchController.js'");
var dynamicCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(dynamicOwnerIndex !== -1);
assert.ok(dynamicCoreIndex !== -1 && dynamicOwnerIndex < dynamicCoreIndex);

console.log('mind_elixir_search_controller.test.js passed');
