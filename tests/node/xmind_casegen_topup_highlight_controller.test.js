'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenTopupHighlightController.js'
));

function createFakeTimers() {
  var nextId = 1;
  var jobs = {};
  return {
    clearTimeout: function(id) { delete jobs[id]; },
    getJobs: function() {
      return Object.keys(jobs).map(function(id) { return jobs[id]; });
    },
    runAll: function() {
      var ids = Object.keys(jobs);
      ids.forEach(function(id) {
        var job = jobs[id];
        delete jobs[id];
        job.handler();
      });
    },
    setTimeout: function(handler, delay) {
      var id = nextId;
      nextId += 1;
      jobs[id] = { id: id, handler: handler, delay: Number(delay || 0) };
      return id;
    },
  };
}

function createHarness(overrides) {
  var timers = createFakeTimers();
  var rootState = { modules: {} };
  var debugStates = [];
  var localId = 0;
  var policyCalls = [];
  var options = {
    ensureState: function() { return rootState; },
    ensureModuleUiState: function(key) {
      var stableKey = String(key || '');
      if (!rootState.modules[stableKey]) rootState.modules[stableKey] = {};
      return rootState.modules[stableKey];
    },
    buildNodeId: function(parts) { return (parts || []).join('-'); },
    generateLocalId: function(prefix) {
      localId += 1;
      return String(prefix || 'topup') + '-' + String(localId);
    },
    setDebugState: function(value) { debugStates.push(value); },
    getRenderPolicyCore: function() {
      return {
        isManagedDecorationClassName: function(className) {
          return String(className || '').indexOf('xmind-casegen-topup') >= 0;
        },
        shouldScheduleTopupHighlightSync: function(changes) {
          policyCalls.push(changes);
          return changes.some(function(change) {
            return change.insideManaged !== true && change.managedOnly !== true;
          });
        },
      };
    },
    isNodeFlowLeft: function() { return false; },
    getMindInstance: function() { return null; },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    now: function() { return 1000; },
  };
  var controller = controllerFactory.create(Object.assign(options, overrides || {}));
  return {
    controller: controller,
    debugStates: debugStates,
    policyCalls: policyCalls,
    rootState: rootState,
    timers: timers,
  };
}

function createMutationNode(options) {
  var opts = options || {};
  return {
    className: opts.className || '',
    nodeType: 1,
    classList: {
      contains: function(name) { return opts.classNames && opts.classNames.indexOf(name) >= 0; },
    },
    closest: function(selector) {
      if (selector === '[data-xmind-casegen-topup-layer]' && opts.insideManaged) return this;
      if (selector === 'me-tpc' && opts.topic) return this;
      if (selector === 'svg' && opts.connector) return this;
      return null;
    },
    matches: function(selector) {
      if (selector === '[data-xmind-casegen-topup-layer]') return opts.managedLayer === true;
      if (selector === 'me-tpc') return opts.topic === true;
      if (selector === 'svg, path') return opts.connector === true;
      return false;
    },
  };
}

function verifyMarkerScopes() {
  var harness = createHarness();
  var moduleState = {};
  harness.rootState.modules['module-a'] = moduleState;
  var marker = harness.controller.setModuleTopupHighlight(
    moduleState,
    'module-a',
    2,
    3,
    { highlightScope: 'cases' }
  );
  assert.strictEqual(marker.highlightScope, 'cases');
  assert.strictEqual(harness.controller.getCaseTopupHighlight(
    harness.rootState.modules['module-a'],
    1
  ), null);
  assert.strictEqual(harness.controller.getCaseTopupHighlight(
    harness.rootState.modules['module-a'],
    3
  ).count, 3);
  assert.strictEqual(harness.controller.getModuleNodeTopupHighlight(
    harness.rootState.modules['module-a']
  ), null);

  harness.controller.setModuleTopupHighlight(
    harness.rootState.modules['module-a'],
    'module-a',
    0,
    0,
    { highlightScope: 'module' }
  );
  assert.strictEqual(
    harness.controller.getModuleNodeTopupHighlight(harness.rootState.modules['module-a']).highlightScope,
    'module'
  );

  harness.controller.setModuleTopupHighlight(
    harness.rootState.modules['module-a'],
    'module-a',
    0,
    2,
    { highlightScope: 'subtree' }
  );
  assert.strictEqual(
    harness.controller.getCaseTopupHighlight(harness.rootState.modules['module-a'], 99).highlightScope,
    'subtree'
  );
  assert.ok(harness.controller.buildTopupHighlightLabel(2, 'subtree').indexOf('2 条') >= 0);

  harness.controller.clearAllTopupHighlights();
  assert.strictEqual(harness.rootState.modules['module-a'].topupHighlight, null);
}

function verifyManagedMutationFiltering() {
  var harness = createHarness();
  var managedNode = createMutationNode({
    className: 'xmind-casegen-topup-highlight-frame',
    insideManaged: true,
  });
  var managedMutation = {
    type: 'childList',
    target: managedNode,
    addedNodes: [managedNode],
    removedNodes: [],
  };
  assert.strictEqual(harness.controller.shouldScheduleTopupHighlightForMutations([managedMutation]), false);
  assert.strictEqual(harness.policyCalls[0][0].insideManaged, true);
  assert.strictEqual(harness.policyCalls[0][0].managedOnly, true);

  var topicNode = createMutationNode({ topic: true });
  var topicMutation = {
    type: 'attributes',
    attributeName: 'class',
    target: topicNode,
    addedNodes: [],
    removedNodes: [],
  };
  assert.strictEqual(harness.controller.shouldScheduleTopupHighlightForMutations([topicMutation]), true);
  assert.strictEqual(harness.policyCalls[1][0].targetRole, 'topic');
}

function verifySyncSchedulingCoalesces() {
  var harness = createHarness();
  harness.controller.scheduleTopupHighlightSync();
  harness.controller.scheduleTopupHighlightSync();
  var jobs = harness.timers.getJobs();
  assert.strictEqual(jobs.length, 1);
  assert.strictEqual(jobs[0].delay, 40);
  harness.timers.runAll();
  assert.strictEqual(harness.timers.getJobs().length, 0);
  harness.controller.cleanupTopupHighlightPresentation();
}

function verifyGeometryHelpers() {
  var harness = createHarness();
  assert.deepStrictEqual(harness.controller.parsePathEdgePoint('M 1 2 C 3 4 5 6 7 8', 'start'), {
    x: 1,
    y: 2,
  });
  assert.deepStrictEqual(harness.controller.parsePathEdgePoint('M 1 2 C 3 4 5 6 7 8', 'end'), {
    x: 7,
    y: 8,
  });
}

function verifyOwnershipAndLoadingOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'cloneTopupHighlight',
    'setModuleTopupHighlight',
    'getCaseTopupHighlight',
    'getModuleNodeTopupHighlight',
    'renderOverlayConnectors',
    'cleanupTopupHighlightPresentation',
    'scheduleTopupHighlightSync',
    'syncTopupHighlightPresentation',
    'bindTopupHighlightPresentation',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by topup controller');
  });
  assert.ok(/topupHighlightControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenTopupHighlightController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load topup controller before xmindCasegen');
  });
}

verifyMarkerScopes();
verifyManagedMutationFiltering();
verifySyncSchedulingCoalesces();
verifyGeometryHelpers();
verifyOwnershipAndLoadingOrder();
console.log('xmind casegen topup highlight controller tests passed');
