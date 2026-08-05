'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenStatusProjectionController.js'
);
var factory = require(ownerPath);

function createClassList(initial) {
  var values = {};
  (initial || []).forEach(function(name) { values[name] = true; });
  return {
    add: function() {
      Array.prototype.forEach.call(arguments, function(name) { values[name] = true; });
    },
    remove: function() {
      Array.prototype.forEach.call(arguments, function(name) { delete values[name]; });
    },
    toggle: function(name, enabled) {
      if (enabled) values[name] = true;
      else delete values[name];
    },
    contains: function(name) { return values[name] === true; },
  };
}

function createElement(tagName) {
  var attributes = {};
  var children = [];
  return {
    tagName: String(tagName || 'span').toUpperCase(),
    attributes: attributes,
    children: children,
    className: '',
    classList: createClassList(),
    nodeObj: null,
    parentNode: null,
    textContent: '',
    title: '',
    appendChild: function(child) {
      child.parentNode = this;
      children.push(child);
    },
    removeChild: function(child) {
      var index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
      child.parentNode = null;
    },
    getAttribute: function(name) { return attributes[name] || ''; },
    setAttribute: function(name, value) { attributes[name] = String(value); },
    querySelector: function(selector) {
      if (selector !== '.xmind-node-status-badge') return null;
      for (var i = 0; i < children.length; i += 1) {
        if (String(children[i].className || '').indexOf('xmind-node-status-badge') >= 0) return children[i];
      }
      return null;
    },
  };
}

function createHarness() {
  var state = { openButtonDotVisible: false, historyUnread: false };
  var rootState = { running: true, lastAction: 'xmind-ai-dedupe', status: '', error: '' };
  var moduleStates = {
    'module-a': { running: true, rootPendingActionId: '', status: '', error: '' },
  };
  var rootNode = createElement('me-tpc');
  rootNode.nodeObj = { id: 'root-1', topic: '登录需求', xmindMeta: { type: 'root' } };
  var moduleNode = createElement('me-tpc');
  moduleNode.nodeObj = { id: 'module-node-a', xmindMeta: { nodeId: 'module-node-a', type: 'module' } };
  var nodes = [rootNode, moduleNode];
  var mindContainer = {
    querySelector: function(selector) {
      if (selector === 'me-tpc.xmind-casegen-node-root') {
        return rootNode.classList.contains('xmind-casegen-node-root') ? rootNode : null;
      }
      if (selector === 'me-root > me-tpc') return rootNode;
      return null;
    },
    querySelectorAll: function(selector) { return selector === 'me-tpc' ? nodes : []; },
  };
  var openBtn = createElement('button');
  var historyBtn = createElement('button');
  var config = { drawerOpen: false, historyOpen: false, mindReady: true };
  var calls = {
    persists: [],
    progress: 0,
    interrupt: 0,
    workspaces: 0,
    toolbar: 0,
    timers: [],
  };
  var controller = factory.create({
    openBtn: openBtn,
    historyBtn: historyBtn,
    mindContainer: mindContainer,
    document: { createElement: createElement },
    dedupeActionId: 'xmind-ai-dedupe',
    existingCasesActionId: 'root-existing-cases',
    ensureState: function() { return state; },
    persistXmindState: function(immediate) { calls.persists.push(immediate); },
    isDrawerOpen: function() { return config.drawerOpen; },
    isHistoryDialogOpen: function() { return config.historyOpen; },
    getCasesGenApi: function() { return null; },
    renderCaseGenProgressBoard: function() { calls.progress += 1; },
    getMindInstance: function() { return config.mindReady ? { id: 'mind-1' } : null; },
    getRootNodeId: function() { return 'root-1'; },
    getRequirementLabelText: function() { return '登录需求'; },
    ensureRootUiState: function() { return rootState; },
    isRootGenerationVisuallyRunning: function(value) { return value.running === true; },
    buildVisibleModuleContext: function() { return { list: [{ aiModuleId: 'module-a' }] }; },
    ensureVisibleModuleContext: function(value) { return value; },
    ensureModuleUiState: function(moduleId) { return moduleStates[moduleId] || null; },
    getModuleNodeId: function() { return 'module-node-a'; },
    syncInterruptButton: function() { calls.interrupt += 1; },
    renderWorkspaceTabs: function() { calls.workspaces += 1; },
    syncInlineToolbarOverview: function() { calls.toolbar += 1; },
    setTimeout: function(handler, delay) {
      calls.timers.push({ handler: handler, delay: delay });
      return calls.timers.length;
    },
  });
  return {
    calls: calls,
    config: config,
    controller: controller,
    historyBtn: historyBtn,
    moduleNode: moduleNode,
    moduleStates: moduleStates,
    openBtn: openBtn,
    rootNode: rootNode,
    rootState: rootState,
    state: state,
  };
}

function verifyNoticeProjection() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.markOpenButtonCompletionNotice(), true);
  assert.strictEqual(harness.state.openButtonDotVisible, true);
  assert.strictEqual(harness.openBtn.classList.contains('has-notice-dot'), true);
  assert.strictEqual(harness.openBtn.attributes['aria-expanded'], 'false');
  assert.match(harness.openBtn.attributes['aria-label'], /后台完成结果/);
  assert.deepStrictEqual(harness.calls.persists, [true]);
  assert.strictEqual(harness.controller.markOpenButtonCompletionNotice(), false);
  assert.deepStrictEqual(harness.calls.persists, [true]);
  assert.strictEqual(harness.controller.clearOpenButtonCompletionNotice({ persist: false }), true);
  assert.strictEqual(harness.openBtn.classList.contains('has-notice-dot'), false);

  harness.config.historyOpen = true;
  assert.strictEqual(harness.controller.markHistoryUnreadNotice(), false);
  assert.strictEqual(harness.state.historyUnread, false);
  harness.config.historyOpen = false;
  assert.strictEqual(harness.controller.markHistoryUnreadNotice(), true);
  assert.strictEqual(harness.historyBtn.classList.contains('has-notice-dot'), true);
  assert.match(harness.historyBtn.attributes['aria-label'], /新的生成记录/);
  assert.strictEqual(harness.controller.clearHistoryUnreadNotice(), true);
  assert.strictEqual(harness.historyBtn.classList.contains('has-notice-dot'), false);
  assert.ok(harness.calls.progress >= 3);
}

function verifyMindStatusProjection() {
  var harness = createHarness();
  harness.config.drawerOpen = true;
  harness.controller.syncRenderedMindStatusBadges();
  assert.strictEqual(harness.rootNode.classList.contains('xmind-casegen-node-status-running'), true);
  assert.strictEqual(harness.rootNode.children.length, 1);
  assert.strictEqual(harness.rootNode.children[0].children[1].textContent, '去重中');
  assert.strictEqual(harness.rootNode.nodeObj.xmindMeta.status, 'running');
  assert.strictEqual(harness.moduleNode.classList.contains('xmind-casegen-node-status-running'), true);
  assert.strictEqual(harness.moduleNode.children[0].children[1].textContent, '生成中');

  harness.rootState.running = false;
  harness.rootState.status = 'error';
  harness.rootState.error = '根任务失败';
  harness.moduleStates['module-a'] = {
    running: false,
    rootPendingActionId: '',
    status: 'error',
    error: '模块失败',
  };
  harness.controller.syncRenderedMindStatusBadges();
  assert.strictEqual(harness.rootNode.classList.contains('xmind-casegen-node-status-error'), true);
  assert.strictEqual(harness.rootNode.children[0].title, '根任务失败');
  assert.strictEqual(harness.moduleNode.classList.contains('xmind-casegen-node-status-error'), true);
  assert.strictEqual(harness.moduleNode.children[0].title, '模块失败');

  harness.controller.scheduleRenderedRootMindStatusBadgeRefresh();
  assert.deepStrictEqual(harness.calls.timers.map(function(item) { return item.delay; }), [0, 80, 220]);
  harness.controller.flushLightweightMindStatus();
  assert.strictEqual(harness.calls.interrupt, 1);
  assert.strictEqual(harness.calls.workspaces, 1);
  assert.strictEqual(harness.calls.toolbar, 1);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'hasOpenButtonCompletionNotice',
    'syncOpenButtonState',
    'markHistoryUnreadNotice',
    'getRenderedMindNodeStableId',
    'findRenderedMindNodeByStableId',
    'syncRenderedMindNodeStatus',
    'syncRenderedMindStatusBadges',
    'flushLightweightMindStatus',
  ].forEach(function(name) {
    var signature = new RegExp('function\\s+' + name + '\\s*\\(');
    assert.match(ownerSource, signature, name + ' must belong to status projection controller');
    assert.doesNotMatch(parentSource, signature, name + ' must leave xmindCasegen.js');
  });
  assert.match(parentSource, /statusProjectionControllerFactory\.create\(\{/);
  assert.ok(parentSource.split('\n').length <= 4650, 'xmindCasegen.js should stay at or below 4650 lines');
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenStatusProjectionController.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load status projection first');
  });
}

verifyNoticeProjection();
verifyMindStatusProjection();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen status projection controller tests passed');
