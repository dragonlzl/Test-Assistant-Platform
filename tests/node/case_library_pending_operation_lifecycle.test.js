const assert = require('assert');
const lifecycleFactory = require('../../scripts/modules/caseLibrary/caseLibraryPendingOperationLifecycle.js');

function createElement() {
  var listeners = Object.create(null);
  return {
    children: [],
    parentNode: null,
    textContent: '',
    appendChild: function(child) {
      child.parentNode = this;
      this.children.push(child);
    },
    removeChild: function(child) {
      this.children = this.children.filter(function(entry) { return entry !== child; });
      child.parentNode = null;
    },
    addEventListener: function(type, listener) { listeners[type] = listener; },
    dispatch: function(type) { if (listeners[type]) listeners[type](); },
  };
}

function testUndoAndCleanup() {
  var state = { pendingOp: { type: 'insert' }, pendingRemaining: 0 };
  var body = createElement();
  var undoCalls = 0;
  var clearCalls = 0;
  var lifecycle = lifecycleFactory.create({
    getState: function() { return state; },
    document: { body: body, createElement: createElement },
    setInterval: function() { return 17; },
    clearInterval: function() {},
    clearTimeout: function() {},
    onUndo: function() { undoCalls += 1; },
    onClear: function() { clearCalls += 1; },
  });
  lifecycle.start('待提交');
  assert.strictEqual(state.pendingRemaining, 8);
  assert.strictEqual(state.pendingInterval, 17);
  assert.strictEqual(body.children.length, 1);
  assert.ok(body.children[0].children[0].textContent.indexOf('8s') !== -1);
  body.children[0].children[1].dispatch('click');
  assert.strictEqual(undoCalls, 1);
  lifecycle.clear();
  assert.strictEqual(state.pendingOp, null);
  assert.strictEqual(state.pendingToast, null);
  assert.strictEqual(body.children.length, 0);
  assert.strictEqual(clearCalls, 1);
}

function testCountdownCommits() {
  var state = { pendingOp: { type: 'remove' }, pendingRemaining: 0 };
  var intervalCallback = null;
  var commitCalls = 0;
  var lifecycle = lifecycleFactory.create({
    getState: function() { return state; },
    document: { body: createElement(), createElement: createElement },
    countdownSeconds: 2,
    setInterval: function(callback) { intervalCallback = callback; return 4; },
    clearInterval: function() {},
    clearTimeout: function() {},
    onCommit: function() { commitCalls += 1; },
  });
  lifecycle.start('待提交');
  intervalCallback();
  assert.strictEqual(state.pendingRemaining, 1);
  intervalCallback();
  assert.strictEqual(commitCalls, 1);
  assert.strictEqual(state.pendingInterval, null);
}

testUndoAndCleanup();
testCountdownCommits();
console.log('case library pending operation lifecycle tests passed');
