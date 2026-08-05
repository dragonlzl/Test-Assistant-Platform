'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenViewLifecycleController.js'
));

function cloneJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function createDefaultViewState() {
  return {
    drawerOpen: false,
    fullscreen: false,
    transform: '',
    scaleVal: 1,
    scrollLeft: 0,
    scrollTop: 0,
    hasManualViewport: false,
    anchorState: null,
    collapsedNodeKeys: [],
    treeSourceSignature: '',
    updatedAt: 0,
  };
}

function normalizeStoredViewState(value, defaults) {
  var source = value && typeof value === 'object' ? value : {};
  var fallback = defaults && typeof defaults === 'object' ? defaults : {};
  return Object.assign(createDefaultViewState(), fallback, cloneJson(source, {}));
}

function createFakeTimers() {
  var nextId = 1;
  var jobs = {};
  return {
    clearTimeout: function(id) { delete jobs[id]; },
    getJobs: function() {
      return Object.keys(jobs).map(function(id) { return jobs[id]; });
    },
    runByDelay: function(delay) {
      var matched = Object.keys(jobs).filter(function(id) {
        return jobs[id] && jobs[id].delay === delay;
      });
      matched.forEach(function(id) {
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
    setTimeout: function(handler, delay) {
      var id = nextId;
      nextId += 1;
      jobs[id] = { id: id, handler: handler, delay: Number(delay || 0) };
      return id;
    },
  };
}

function createClassList(initial) {
  var map = {};
  (initial || []).forEach(function(name) { map[name] = true; });
  return {
    contains: function(name) { return map[name] === true; },
  };
}

function createHarness(overrides) {
  var timers = createFakeTimers();
  var viewState = createDefaultViewState();
  viewState.drawerOpen = true;
  viewState.hasManualViewport = true;
  viewState.treeSourceSignature = 'tree-1';
  var hostState = {
    activeWorkspaceId: 'workspace-1',
    mirrorWorkspaceId: 'workspace-1',
    workspaceOrder: ['workspace-1', 'workspace-2'],
    workspaces: {
      'workspace-1': { snapshot: { xmind: { viewState: cloneJson(viewState, {}) } }, updatedAt: 0 },
      'workspace-2': { snapshot: { xmind: { viewState: cloneJson(viewState, {}) } }, updatedAt: 0 },
    },
  };
  var state = {
    activeTab: 'casesgen',
    xmindCaseGen: {
      treeSourceSignature: 'tree-1',
      viewState: viewState,
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
  var sessionValues = {};
  var calls = {
    deferredPersists: 0,
    immediatePersists: 0,
    lightweightFlushes: 0,
    renders: [],
    restoreSyncs: [],
  };
  var options = {
    mindContainer: mindContainer,
    drawerEl: { classList: createClassList(['open']) },
    cloneJson: cloneJson,
    normalizeUniqueStringList: function(items) {
      return Array.from(new Set(Array.isArray(items) ? items : []));
    },
    normalizeModuleKey: function(value) { return String(value || '').toLowerCase(); },
    normalizeStoredViewState: normalizeStoredViewState,
    createDefaultViewState: createDefaultViewState,
    createWorkspaceSnapshot: function() { return { xmind: { viewState: createDefaultViewState() } }; },
    createInitialXmindState: function() { return { viewState: createDefaultViewState() }; },
    ensureState: function() { return state.xmindCaseGen; },
    getHostState: function() { return state; },
    getWorkspaceHostState: function() { return hostState; },
    getWorkspaceOrder: function() { return hostState.workspaceOrder.slice(); },
    getWorkspaceRecord: function(id) { return hostState.workspaces[id] || null; },
    getActiveWorkspaceId: function() { return hostState.activeWorkspaceId; },
    getWorkspaceShadowDepth: function() { return 0; },
    getWorkspaceUiMutedDepth: function() { return 0; },
    getMindInstance: function() { return mindInstance; },
    getCurrentMindData: function() { return null; },
    isDrawerOpen: function() { return true; },
    getRequirementLabelText: function() { return '登录'; },
    shouldRestoreViewportForViewState: function(source) {
      return Boolean(source && source.transform && source.hasManualViewport === true);
    },
    persistXmindState: function(immediate) {
      if (immediate === true) calls.immediatePersists += 1;
      else calls.deferredPersists += 1;
    },
    persistWorkflowState: function() { calls.deferredPersists += 1; },
    persistWorkflowStateNow: function() { calls.immediatePersists += 1; },
    saveActiveWorkspaceSnapshot: function() {},
    syncRunningTaskRestoreContexts: function(workspaceId, syncOptions) {
      calls.restoreSyncs.push({ workspaceId: workspaceId, options: syncOptions });
    },
    render: function(renderOptions) { calls.renders.push({ kind: 'render', options: renderOptions }); },
    flushLightweightMindStatus: function() { calls.lightweightFlushes += 1; },
    scheduleTopupHighlightSync: function() {},
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    requestFrame: function(handler) { timers.setTimeout(handler, 0); },
    now: function() { return 1000; },
    sessionStorage: {
      getItem: function(key) { return sessionValues[key] || null; },
      setItem: function(key, value) { sessionValues[key] = String(value); },
      removeItem: function(key) { delete sessionValues[key]; },
    },
  };
  var controller = controllerFactory.create(Object.assign(options, overrides || {}));
  return {
    calls: calls,
    canvas: canvas,
    controller: controller,
    hostState: hostState,
    map: map,
    mindInstance: mindInstance,
    sessionValues: sessionValues,
    state: state,
    timers: timers,
  };
}

function verifyRenderQueuePriorityAndDeadline() {
  var harness = createHarness();
  harness.controller.queueStatusMindRender({ reason: 'status' });
  harness.controller.queueStructureMindRender({ reason: 'structure', persist: true });
  harness.controller.queueTerminalMindRender({
    reason: 'terminal',
    persist: false,
    centerRootAfterRender: true,
  });

  var jobs = harness.timers.getJobs();
  assert.strictEqual(jobs.filter(function(job) { return job.delay === 500; }).length, 1);
  assert.strictEqual(jobs.filter(function(job) { return job.delay === 120; }).length, 1);

  harness.timers.runByDelay(120);
  assert.strictEqual(harness.calls.renders.length, 1);
  assert.strictEqual(harness.calls.renders[0].kind, 'render');
  assert.strictEqual(harness.calls.renders[0].options.persist, false);
  assert.strictEqual(harness.calls.renders[0].options.centerRootAfterRender, true);
  assert.ok(harness.calls.renders[0].options.reason.indexOf('terminal') >= 0);
  assert.strictEqual(harness.timers.getJobs().length, 0);
}

function verifyStaleWorkspaceRestoreCannotWin() {
  var harness = createHarness();
  harness.controller.scheduleWorkspaceViewRestore({
    transform: 'translate3d(10px, 20px, 0px) scale(1)',
    scaleVal: 1,
  }, 'workspace-1');
  harness.hostState.activeWorkspaceId = 'workspace-2';
  harness.controller.scheduleWorkspaceViewRestore({
    transform: 'translate3d(30px, 40px, 0px) scale(1.2)',
    scaleVal: 1.2,
  }, 'workspace-2');
  harness.timers.runAll();
  assert.strictEqual(harness.map.style.transform, 'translate3d(30px, 40px, 0px) scale(1.2)');
  assert.strictEqual(harness.mindInstance.scaleVal, 1.2);
}

function verifyDrawerCloseIntentIsPersistedEverywhere() {
  var taskContext = { viewState: { drawerOpen: true, fullscreen: true } };
  var harness = createHarness({
    getXmindTaskManager: function() {
      return {
        updateTasksContext: function(updater) { updater(taskContext); },
      };
    },
  });
  harness.controller.persistDrawerClosedIntentState(true);
  assert.strictEqual(harness.state.xmindCaseGen.viewState.drawerOpen, false);
  assert.strictEqual(harness.state.xmindCaseGen.viewState.fullscreen, false);
  harness.hostState.workspaceOrder.forEach(function(id) {
    var stored = harness.hostState.workspaces[id].snapshot.xmind.viewState;
    assert.strictEqual(stored.drawerOpen, false);
    assert.strictEqual(stored.fullscreen, false);
  });
  assert.strictEqual(taskContext.viewState.drawerOpen, false);
  assert.strictEqual(taskContext.viewState.fullscreen, false);
  assert.strictEqual(harness.calls.restoreSyncs.length, 1);
}

function verifySuspendCacheRestoresActiveWorkspace() {
  var harness = createHarness();
  var cachedView = createDefaultViewState();
  cachedView.drawerOpen = true;
  cachedView.transform = 'translate3d(90px, 80px, 0px) scale(1.1)';
  cachedView.hasManualViewport = true;
  harness.controller.writeSuspendViewStateCache({
    activeTab: 'casesgen',
    workspaceId: 'workspace-2',
    viewState: cachedView,
  });
  assert.strictEqual(harness.controller.applyPendingSuspendViewStateCache(), true);
  assert.strictEqual(harness.hostState.activeWorkspaceId, 'workspace-2');
  assert.strictEqual(harness.state.xmindCaseGen.viewState.transform, cachedView.transform);
  assert.strictEqual(harness.controller.readSuspendViewStateCache(), null);
}

function verifyOwnershipAndLoadingOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var lifecycleSource = fs.readFileSync(path.join(
    projectRoot,
    'scripts/modules/xmindCasegen/xmindCasegenViewLifecycleController.js'
  ), 'utf8');
  [
    'captureCurrentViewState',
    'captureVisibleMindViewStateFromDom',
    'scheduleWorkspaceViewRestore',
    'normalizeQueuedMindRenderMode',
    'mergeQueuedMindRenderOptions',
    'flushQueuedMindRender',
    'bindLiveViewStateCapture',
    'centerRootNodeView',
    'bindViewStatePersistenceLifecycle',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by view lifecycle controller');
    assert.strictEqual(lifecycleSource.indexOf('function ' + name + '('), -1, name + ' must stay outside the thin lifecycle facade');
  });
  assert.ok(/viewLifecycleControllerFactory\.create\(/.test(parentSource));
  assert.ok(/viewportFactory\.create\(/.test(lifecycleSource));
  assert.ok(/sessionFactory\.create\(/.test(lifecycleSource));
  assert.ok(/queueFactory\.create\(/.test(lifecycleSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var viewportIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenViewportStateController.js');
    var sessionIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenViewSessionController.js');
    var queueIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenRenderQueueController.js');
    var facadeIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenViewLifecycleController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(viewportIndex >= 0 && viewportIndex < facadeIndex, fileName + ' must load viewport before lifecycle facade');
    assert.ok(sessionIndex >= 0 && sessionIndex < facadeIndex, fileName + ' must load session before lifecycle facade');
    assert.ok(queueIndex >= 0 && queueIndex < facadeIndex, fileName + ' must load render queue before lifecycle facade');
    assert.ok(facadeIndex >= 0 && facadeIndex < parentIndex, fileName + ' must load lifecycle facade before xmindCasegen');
  });
}

verifyRenderQueuePriorityAndDeadline();
verifyStaleWorkspaceRestoreCannotWin();
verifyDrawerCloseIntentIsPersistedEverywhere();
verifySuspendCacheRestoresActiveWorkspace();
verifyOwnershipAndLoadingOrder();
console.log('xmind casegen view lifecycle controller tests passed');
