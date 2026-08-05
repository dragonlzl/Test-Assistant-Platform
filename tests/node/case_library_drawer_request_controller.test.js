'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/caseLibrary/caseLibraryDrawerRequestController.js'
);
var owner = require(ownerPath);

function createStorage() {
  var values = Object.create(null);
  return {
    getItem: function(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem: function(key, value) {
      values[key] = String(value);
    },
    removeItem: function(key) {
      delete values[key];
    },
  };
}

function createHarness() {
  var active = false;
  var otherDrawerOpen = false;
  var selectOpenCount = 0;
  var missingOpenCount = 0;
  var closeAllCount = 0;
  var dispatched = [];
  var timers = [];
  var storage = createStorage();
  var missingElement = {
    classList: {
      contains: function(name) {
        return name === 'open' && missingOpenCount > 0;
      },
    },
  };
  var selectDrawer = {
    open: function() {
      selectOpenCount += 1;
      return true;
    },
  };
  var missingDrawer = {
    element: missingElement,
    open: function() {
      missingOpenCount += 1;
      return true;
    },
  };
  var windowStub = {
    app: {
      drawer: {
        closeAllDrawers: function() {
          closeAllCount += 1;
          otherDrawerOpen = false;
        },
      },
    },
    CustomEvent: function(type, options) {
      this.type = type;
      this.detail = options.detail;
    },
    dispatchEvent: function(event) {
      dispatched.push(event);
    },
  };
  var documentStub = {
    getElementById: function(id) {
      return id === 'caseLibraryMissingDrawer' ? missingElement : null;
    },
    querySelectorAll: function() {
      return otherDrawerOpen ? [{ id: 'otherDrawer' }] : [];
    },
  };
  var controller = owner.create({
    window: windowStub,
    document: documentStub,
    storage: storage,
    isCaseLibraryActive: function() { return active; },
    getSelectDrawer: function() { return selectDrawer; },
    getMissingDrawer: function() { return missingDrawer; },
    now: function() { return 1000; },
    setTimeout: function(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout: function() {},
  });

  return {
    controller: controller,
    storage: storage,
    window: windowStub,
    dispatched: dispatched,
    setActive: function(value) { active = Boolean(value); },
    setOtherDrawerOpen: function(value) { otherDrawerOpen = Boolean(value); },
    runNextTimer: function() {
      var callback = timers.shift();
      if (callback) callback();
    },
    getSelectOpenCount: function() { return selectOpenCount; },
    getMissingOpenCount: function() { return missingOpenCount; },
    getCloseAllCount: function() { return closeAllCount; },
  };
}

function verifyRequestStateContract() {
  var harness = createHarness();
  var controller = harness.controller;

  controller.requestSelect();
  assert.strictEqual(harness.window.app.__caseLibrarySelectExecRequest, true);
  assert.strictEqual(harness.storage.getItem('tap-case-library-select-exec-request'), '1');
  assert.strictEqual(controller.consumeSelect(), true);
  assert.strictEqual(controller.consumeSelect(), false);
  assert.strictEqual(harness.storage.getItem('tap-case-library-select-exec-request'), null);

  controller.requestMissing();
  assert.strictEqual(controller.peekMissing(), true);
  assert.strictEqual(harness.storage.getItem('tap-case-library-missing-drawer-request'), '1');
  assert.strictEqual(controller.consumeMissing(), true);
  assert.strictEqual(controller.peekMissing(), false);
}

function verifyInactiveDeferralContract() {
  var harness = createHarness();
  var controller = harness.controller;

  assert.strictEqual(controller.openSelect(), false);
  assert.strictEqual(harness.getSelectOpenCount(), 0);
  assert.strictEqual(controller.consumeSelect(), true);

  assert.strictEqual(controller.openMissing(), false);
  assert.strictEqual(harness.getMissingOpenCount(), 0);
  assert.strictEqual(controller.peekMissing(), true);

  harness.setActive(true);
  assert.strictEqual(controller.openSelect(), true);
  assert.strictEqual(harness.getSelectOpenCount(), 1);
  assert.strictEqual(controller.openMissing(), true);
  assert.strictEqual(harness.getMissingOpenCount(), 1);
  assert.strictEqual(controller.peekMissing(), false);
}

function verifyDelayedOpenContract() {
  var harness = createHarness();
  harness.setActive(true);
  harness.setOtherDrawerOpen(true);

  assert.strictEqual(harness.controller.openMissing(), true);
  assert.strictEqual(harness.getCloseAllCount(), 1);
  assert.strictEqual(harness.getMissingOpenCount(), 0);
  harness.runNextTimer();
  assert.strictEqual(harness.getMissingOpenCount(), 1);
  assert.strictEqual(harness.window.app.__drawerSkipCloseId, 'caseLibraryMissingDrawer');
  assert.strictEqual(harness.window.app.__drawerCloseGuard.id, 'caseLibraryMissingDrawer');
}

function verifyTempExecAssignmentContract() {
  var harness = createHarness();
  var payload = harness.controller.requestTempExecAssign({
    caseName: '回归用例',
    versionName: 'v8.2',
  });

  assert.strictEqual(payload.name, '回归用例');
  assert.strictEqual(payload.versionName, 'v8.2');
  assert.deepStrictEqual(harness.window.app.__tempExecAssignRequest, payload);
  assert.deepStrictEqual(
    JSON.parse(harness.storage.getItem('tap-temp-exec-assign-request')),
    payload
  );
  assert.strictEqual(harness.dispatched.length, 1);
  assert.strictEqual(harness.dispatched[0].type, 'temp-exec-assign-request');
  assert.deepStrictEqual(harness.dispatched[0].detail, payload);
}

function verifyOwnershipAndLoadOrder() {
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  var parentSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/caseLibrary.js'),
    'utf8'
  );
  var entryFiles = [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ];

  assert.ok(ownerSource.split('\n').length < 280, 'drawer request controller should remain focused');
  assert.ok(parentSource.indexOf('drawerRequestControllerOwner.create') !== -1);
  [
    'markSelectExecDrawerRequest',
    'markMissingDrawerRequest',
    'consumeSelectExecDrawerRequest',
    'consumeMissingDrawerRequest',
    'openMissingDrawerDirect',
    'scheduleMissingDrawerOpen',
  ].forEach(function(functionName) {
    assert.strictEqual(
      parentSource.indexOf('function ' + functionName + '('),
      -1,
      functionName + ' should be owned by the drawer request controller'
    );
  });
  assert.ok(
    parentSource.split('\n').length + ownerSource.split('\n').length + entryFiles.length < 4234,
    'production LOC should decrease after extraction, including entry declarations'
  );

  entryFiles.forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/caseLibrary/caseLibraryDrawerRequestController.js');
    var parentIndex = html.indexOf('./scripts/modules/caseLibrary.js');
    assert.ok(ownerIndex !== -1, fileName + ' must load the drawer request controller');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the controller before caseLibrary');
  });
}

assert.ok(owner && typeof owner.create === 'function');
verifyRequestStateContract();
verifyInactiveDeferralContract();
verifyDelayedOpenContract();
verifyTempExecAssignmentContract();
verifyOwnershipAndLoadOrder();
console.log('case_library_drawer_request_controller.test.js passed');
