'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ownerFactory = require('../../scripts/modules/tempExecReusePanelLifecycleOwner.js');

function createClassList(initial) {
  var values = Object.create(null);
  (initial || []).forEach(function(value) { values[value] = true; });
  return {
    add: function(value) { values[value] = true; },
    remove: function(value) { delete values[value]; },
    contains: function(value) { return Boolean(values[value]); },
  };
}

function createRow(top, bottom, panelHeight) {
  var panel = {
    offsetHeight: panelHeight,
    scrollHeight: panelHeight,
    getBoundingClientRect: function() { return { height: panelHeight }; },
  };
  var row = {
    offsetHeight: bottom - top,
    scrollHeight: bottom - top,
    getBoundingClientRect: function() { return { top: top, bottom: bottom, height: bottom - top }; },
    querySelector: function(selector) { return selector === '.reuse-panel' ? panel : null; },
  };
  return {
    panel: {
      offsetHeight: panelHeight,
      scrollHeight: panelHeight,
      getBoundingClientRect: function() { return { height: panelHeight }; },
      closest: function() { return row; },
    },
    row: row,
  };
}

function verifyVisibilityRules() {
  var above = { getBoundingClientRect: function() { return { top: -100, bottom: 0 }; } };
  var visible = { getBoundingClientRect: function() { return { top: 10, bottom: 40 }; } };
  var nearBelow = { getBoundingClientRect: function() { return { top: 900, bottom: 940 }; } };
  assert.strictEqual(ownerFactory.isRowOutOfView(above, 800), true);
  assert.strictEqual(ownerFactory.isRowInView(visible, 800), true);
  assert.strictEqual(ownerFactory.isRowNearView(nearBelow, 800, 150), true);
  assert.strictEqual(ownerFactory.isRowNearView(nearBelow, 800, 50), false);
}

function verifyLifecycle() {
  var state = { tempExecActiveId: 'file-1' };
  var openSet = new Set([0]);
  var renderCount = 0;
  var toggleCalls = [];
  var listeners = {};
  var rowParts = createRow(1000, 1120, 180);
  var view = {
    classList: createClassList(),
    querySelector: function(selector) {
      if (selector.indexOf('data-temp-reuse-panel-container="file-1"') !== -1) return rowParts.panel;
      if (selector.indexOf('data-temp-reuse-row="file-1"') !== -1) return rowParts.row;
      return null;
    },
    querySelectorAll: function() { return []; },
  };
  var browser = {
    innerHeight: 800,
    scrollY: 0,
    addEventListener: function(type, handler) { listeners[type] = handler; },
    requestAnimationFrame: function(callback) { callback(); },
  };
  var owner = ownerFactory.create({
    state: state,
    api: {
      ensureTempExecReuseOpen: function() { return openSet; },
      toggleTempExecReusePanel: function(fileId, indexes) {
        toggleCalls.push({ fileId: fileId, indexes: indexes });
      },
      renderTempExecView: function() { renderCount += 1; },
    },
    window: browser,
    document: {
      documentElement: { clientHeight: 800, scrollHeight: 2000, offsetHeight: 2000, scrollTop: 0 },
      body: { scrollHeight: 2000, offsetHeight: 2000 },
    },
    view: view,
    viewSection: { classList: createClassList() },
  });

  owner.autoCollapse();
  assert.strictEqual(openSet.size, 0);
  assert.strictEqual(renderCount, 1);
  assert.strictEqual(state.tempExecPreserveScrollOnce, true);
  assert.strictEqual(state.tempExecReusePlaceholders['file-1']['0'], 180);
  assert.deepStrictEqual(toggleCalls, []);

  owner.recordPanelHeight('file-1', [0]);
  assert.strictEqual(state.tempExecReusePanelHeights['file-1']['0'], 180);
  owner.clearPlaceholders('file-1', [0]);
  assert.strictEqual(state.tempExecReusePlaceholders['file-1']['0'], undefined);

  assert.strictEqual(owner.bind(), true);
  assert.strictEqual(owner.bind(), false);
  assert.strictEqual(typeof listeners.scroll, 'function');
  assert.strictEqual(typeof listeners.wheel, 'function');
}

function verifyOwnershipAndLoadOrder() {
  var projectRoot = path.join(__dirname, '..', '..');
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');
  var ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecReusePanelLifecycleOwner.js'), 'utf8');
  assert.match(ownerSource, /function autoCollapse\(/);
  assert.match(ownerSource, /function ensurePlaceholderObserver\(/);
  assert.match(ownerSource, /function schedulePanelHeightRecord\(/);
  assert.doesNotMatch(parentSource, /function autoCollapseTempExecReusePanels\(/);
  assert.doesNotMatch(parentSource, /function ensureTempExecReusePlaceholderObserver\(/);
  assert.doesNotMatch(parentSource, /function recordTempExecReusePanelHeight\(/);
  assert.match(parentSource, /tempExecReusePanelLifecycleOwner\.create\(\{/);

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
    var ownerIndex = html.indexOf('./scripts/modules/tempExecReusePanelLifecycleOwner.js');
    var parentIndex = html.indexOf('./scripts/modules/tempexec.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the reuse lifecycle owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the reuse lifecycle owner before tempexec');
  });
}

verifyVisibilityRules();
verifyLifecycle();
verifyOwnershipAndLoadOrder();
console.log('temp exec reuse panel lifecycle owner tests passed');
