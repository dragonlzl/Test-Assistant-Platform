'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/modules/tempExecFocusInteractionOwner.js'));

function createClassList() {
  var values = Object.create(null);
  return {
    add: function(name) { values[name] = true; },
    remove: function(name) { delete values[name]; },
    contains: function(name) { return values[name] === true; },
  };
}

function createTarget(name) {
  var target = {
    name: name || '',
    children: [],
    parentNode: null,
    dataset: {},
    style: {},
    className: '',
    classList: createClassList(),
    listeners: Object.create(null),
    clientWidth: 100,
    scrollWidth: 100,
    scrollLeft: 0,
    offsetWidth: 20,
    addEventListener: function(type, listener) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(listener);
    },
    removeEventListener: function(type, listener) {
      var list = this.listeners[type] || [];
      this.listeners[type] = list.filter(function(item) { return item !== listener; });
    },
    dispatch: function(type, event) {
      var payload = event || {};
      if (!payload.target) payload.target = this;
      if (!payload.currentTarget) payload.currentTarget = this;
      (this.listeners[type] || []).slice().forEach(function(listener) { listener(payload); });
    },
    appendChild: function(child) {
      if (!child) return child;
      if (child.parentNode && child.parentNode !== this && child.parentNode.removeChild) child.parentNode.removeChild(child);
      if (this.children.indexOf(child) === -1) this.children.push(child);
      child.parentNode = this;
      return child;
    },
    insertBefore: function(child, reference) {
      if (!child) return child;
      this.removeChild(child);
      var index = this.children.indexOf(reference);
      if (index < 0) index = this.children.length;
      this.children.splice(index, 0, child);
      child.parentNode = this;
      return child;
    },
    removeChild: function(child) {
      var index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      if (child) child.parentNode = null;
      return child;
    },
    querySelector: function(selector) {
      return this.children.find(function(child) {
        if (selector === '.temp-focus-scrollbar') return child.className === 'temp-focus-scrollbar';
        if (selector === '.temp-focus-scrollbar-thumb') return child.className === 'temp-focus-scrollbar-thumb';
        return false;
      }) || null;
    },
    querySelectorAll: function(selector) {
      if (selector !== 'button[data-temp-file]') return [];
      return this.children.filter(function(child) { return child && child.dataset && child.dataset.tempFile; });
    },
    getBoundingClientRect: function() { return { left: 0, width: 100 }; },
  };
  return target;
}

function createDocument() {
  var document = createTarget('document');
  document.createElement = function(tagName) {
    var element = createTarget(tagName);
    element.tagName = String(tagName || '').toUpperCase();
    element.setAttribute = function(name, value) { this[name] = String(value); };
    return element;
  };
  return document;
}

function createButton(fileId) {
  var button = createTarget('button');
  button.dataset.tempFile = fileId;
  button.closest = function(selector) {
    return selector === 'button[data-temp-file]' ? button : null;
  };
  button.getBoundingClientRect = function() { return { left: 0, width: 40 }; };
  return button;
}

function verifyOwnerBehavior() {
  var document = createDocument();
  var windowObject = createTarget('window');
  windowObject.app = {};
  var focusBlock = createTarget('focus-block');
  var viewFocusBlock = createTarget('view-focus-block');
  var focusZone = createTarget('focus-zone');
  var viewFocusZone = createTarget('view-focus-zone');
  var button = createButton('file-a');
  focusBlock.appendChild(button);
  focusZone.appendChild(createButton('file-b'));

  var calls = { active: [], focus: [], badge: [], switched: 0, scrolled: 0, removed: 0 };
  var state = { tempExecActiveId: 'file-b' };
  var api = owner.create({
    state: state,
    document: document,
    window: windowObject,
    focusBlock: focusBlock,
    focusZone: focusZone,
    viewFocusBlock: viewFocusBlock,
    viewFocusZone: viewFocusZone,
    api: {
      getTempExecFile: function(id) { return id === 'file-a' || id === 'file-b' ? { id: id, name: id } : null; },
      setTempExecActive: function(id) { calls.active.push(id); state.tempExecActiveId = id; },
      addTempExecFocus: function(id) { calls.focus.push(['add', id]); },
      insertTempExecFocus: function(id, index) { calls.focus.push(['insert', id, index]); },
    },
    switchTab: function(name) { if (name === 'tempexec') calls.switched += 1; },
    scrollToViewTop: function() { calls.scrolled += 1; },
    confirmRemoveFocus: function(id) { if (id === 'file-a') calls.removed += 1; },
    markFocusBadgeRead: function(id) { calls.badge.push(id); },
    setDragContext: function() {},
    openAssignDrawer: function() {},
    debounce: function(fn) { return fn; },
  });

  focusBlock.dispatch('click', { target: button });
  assert.deepStrictEqual(calls.active, ['file-a']);
  assert.deepStrictEqual(calls.badge, ['file-a']);
  assert.strictEqual(calls.switched, 1);
  assert.strictEqual(calls.scrolled, 1);

  focusZone.dispatch('dragover', {
    target: focusZone,
    currentTarget: focusZone,
    clientX: 10,
    dataTransfer: { getData: function() { return 'file-a'; } },
    preventDefault: function() {},
  });
  assert.strictEqual(focusZone._focusIndicator.dataset.dropIndex, '0');
  focusZone.dispatch('drop', {
    target: focusZone,
    currentTarget: focusZone,
    clientX: 10,
    dataTransfer: { getData: function() { return 'file-a'; } },
    preventDefault: function() {},
  });
  assert.deepStrictEqual(calls.focus, [['insert', 'file-a', 0]]);

  api.destroy();
  focusBlock.dispatch('click', { target: button });
  assert.strictEqual(calls.active.length, 1);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');
  assert.strictEqual(parentSource.indexOf('function bindFocusBlockEvents('), -1);
  assert.strictEqual(parentSource.indexOf('function bindFocusZoneDragDrop('), -1);
  assert.ok(parentSource.indexOf('tempExecFocusInteractionOwner.create') !== -1);

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
    var ownerIndex = html.indexOf('./scripts/modules/tempExecFocusInteractionOwner.js');
    var parentIndex = html.indexOf('./scripts/modules/tempexec.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the focus interaction owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the focus interaction owner first');
  });
}

assert.ok(owner && typeof owner.create === 'function');
verifyOwnerBehavior();
verifyOwnershipAndLoadOrder();
console.log('temp exec focus interaction owner tests passed');
