'use strict';

var assert = require('assert');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var viewportFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenViewportStateController.js'
));
var sessionFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenViewSessionController.js'
));
var queueFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenRenderQueueController.js'
));

function cloneJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function createDefaultViewState() {
  return {
    drawerOpen: true,
    fullscreen: false,
    transform: '',
    scaleVal: 1,
    scrollLeft: 0,
    scrollTop: 0,
    hasManualViewport: false,
    anchorState: null,
    collapsedNodeKeys: [],
    treeSourceSignature: 'tree-1',
    updatedAt: 0,
  };
}

function createFakeTimers() {
  var nextId = 1;
  var jobs = {};
  return {
    clearTimeout: function(id) { delete jobs[id]; },
    setTimeout: function(handler, delay) {
      var id = nextId;
      nextId += 1;
      jobs[id] = { handler: handler, delay: Number(delay || 0) };
      return id;
    },
    countByDelay: function(delay) {
      return Object.keys(jobs).filter(function(id) { return jobs[id].delay === delay; }).length;
    },
    runByDelay: function(delay) {
      Object.keys(jobs).filter(function(id) {
        return jobs[id] && jobs[id].delay === delay;
      }).forEach(function(id) {
        var job = jobs[id];
        delete jobs[id];
        job.handler();
      });
    },
    runAll: function() {
      while (Object.keys(jobs).length) {
        var id = Object.keys(jobs)[0];
        var job = jobs[id];
        delete jobs[id];
        job.handler();
      }
    },
  };
}

function createHarness() {
  var timers = createFakeTimers();
  var viewState = createDefaultViewState();
  var state = { activeTab: 'casesgen', xmindCaseGen: { treeSourceSignature: 'tree-1', viewState: viewState } };
  var hostState = {
    activeWorkspaceId: 'workspace-1',
    mirrorWorkspaceId: 'workspace-1',
    workspaceOrder: ['workspace-1', 'workspace-2'],
    workspaces: {
      'workspace-1': { snapshot: { xmind: { viewState: cloneJson(viewState, {}) } } },
      'workspace-2': { snapshot: { xmind: { viewState: cloneJson(viewState, {}) } } },
    },
  };
  var canvas = { scrollLeft: 0, scrollTop: 0 };
  var map = { isConnected: true, style: { transform: 'translate3d(1px, 2px, 0px) scale(1)' } };
  var mindContainer = {
    querySelector: function(selector) {
      if (selector === '.map-canvas') return map;
      if (selector === '[data-mind-canvas]') return canvas;
      return null;
    },
    querySelectorAll: function() { return []; },
  };
  var mindInstance = {
    scaleVal: 1,
    __tapCaptureViewState: function() {
      return {
        transform: map.style.transform,
        scaleVal: 1,
        scrollLeft: canvas.scrollLeft,
        scrollTop: canvas.scrollTop,
      };
    },
  };
  var viewport = viewportFactory.create({
    mindContainer: mindContainer,
    drawerEl: { classList: { contains: function() { return false; } } },
    cloneJson: cloneJson,
    normalizeStoredViewState: function(value) { return Object.assign(createDefaultViewState(), cloneJson(value, {})); },
    createDefaultViewState: createDefaultViewState,
    ensureState: function() { return state.xmindCaseGen; },
    getHostState: function() { return state; },
    getMindInstance: function() { return mindInstance; },
    isDrawerOpen: function() { return true; },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    now: function() { return 1000; },
  });
  var session = sessionFactory.create({
    viewport: viewport,
    cloneJson: cloneJson,
    normalizeStoredViewState: function(value) { return Object.assign(createDefaultViewState(), cloneJson(value, {})); },
    createDefaultViewState: createDefaultViewState,
    createWorkspaceSnapshot: function() { return { xmind: { viewState: createDefaultViewState() } }; },
    createInitialXmindState: function() { return { viewState: createDefaultViewState() }; },
    ensureState: function() { return state.xmindCaseGen; },
    getHostState: function() { return state; },
    getWorkspaceHostState: function() { return hostState; },
    getWorkspaceOrder: function() { return hostState.workspaceOrder.slice(); },
    getWorkspaceRecord: function(id) { return hostState.workspaces[id] || null; },
    getActiveWorkspaceId: function() { return hostState.activeWorkspaceId; },
    getMindInstance: function() { return mindInstance; },
    isDrawerOpen: function() { return true; },
    scheduleTopupHighlightSync: function() {},
    setTimeout: timers.setTimeout,
    requestFrame: function(handler) { timers.setTimeout(handler, 0); },
    now: function() { return 1000; },
  });
  return {
    hostState: hostState,
    map: map,
    mindInstance: mindInstance,
    session: session,
    state: state,
    timers: timers,
    viewport: viewport,
  };
}

function verifyViewportCaptureContract() {
  var harness = createHarness();
  var captured = harness.viewport.captureCurrentViewState();
  assert.strictEqual(captured.transform, 'translate3d(1px, 2px, 0px) scale(1)');
  assert.strictEqual(captured.treeSourceSignature, 'tree-1');
}

function verifyStaleWorkspaceRestoreContract() {
  var harness = createHarness();
  harness.session.scheduleWorkspaceViewRestore({
    transform: 'translate3d(10px, 20px, 0px) scale(1)',
    scaleVal: 1,
  }, 'workspace-1');
  harness.hostState.activeWorkspaceId = 'workspace-2';
  harness.session.scheduleWorkspaceViewRestore({
    transform: 'translate3d(30px, 40px, 0px) scale(1.2)',
    scaleVal: 1.2,
  }, 'workspace-2');
  harness.timers.runAll();
  assert.strictEqual(harness.map.style.transform, 'translate3d(30px, 40px, 0px) scale(1.2)');
  assert.strictEqual(harness.mindInstance.scaleVal, 1.2);
}

function verifyRenderQueueContract() {
  var timers = createFakeTimers();
  var renders = [];
  var cancelledCaptures = 0;
  var queue = queueFactory.create({
    getViewState: createDefaultViewState,
    getMindInstance: function() { return {}; },
    isDrawerOpen: function() { return true; },
    captureCurrentViewState: createDefaultViewState,
    cancelPendingViewStateCapture: function() { cancelledCaptures += 1; },
    normalizeWorkspaceRenderViewState: function(value) { return value && value.transform ? value : null; },
    render: function(options) { renders.push(options); },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  queue.queueStatusMindRender({ reason: 'status' });
  queue.queueStructureMindRender({ reason: 'structure', persist: true });
  queue.queueTerminalMindRender({ reason: 'terminal', persist: false, centerRootAfterRender: true });
  assert.strictEqual(timers.countByDelay(500), 1);
  assert.strictEqual(timers.countByDelay(120), 1);
  timers.runByDelay(120);
  assert.strictEqual(renders.length, 1);
  assert.strictEqual(cancelledCaptures, 1);
  assert.strictEqual(renders[0].persist, false);
  assert.strictEqual(renders[0].centerRootAfterRender, true);
  assert.ok(renders[0].reason.indexOf('terminal') >= 0);
}

verifyViewportCaptureContract();
verifyStaleWorkspaceRestoreContract();
verifyRenderQueueContract();
console.log('xmind casegen view owner contracts passed');
