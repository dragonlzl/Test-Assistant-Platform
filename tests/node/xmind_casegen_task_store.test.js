'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var storeApi = require(path.join(
  projectRoot,
  'scripts/modules/app/xmindCaseGenTaskStore.js'
));

function createMemoryStorage() {
  var values = Object.create(null);
  return {
    getItem: function(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem: function(key, value) { values[key] = String(value); },
    removeItem: function(key) { delete values[key]; },
  };
}

function createEventRoot(storage) {
  var events = [];
  function FakeCustomEvent(name, options) {
    this.type = name;
    this.detail = options && options.detail ? options.detail : null;
  }
  return {
    app: {},
    localStorage: storage,
    CustomEvent: FakeCustomEvent,
    dispatchEvent: function(event) { events.push(event); },
    events: events,
  };
}

function verifyTaskLifecyclePersistence() {
  var storage = createMemoryStorage();
  var root = createEventRoot(storage);
  var store = storeApi.create({ root: root });
  var task = store.createTask({
    id: 'task-1',
    prompt: 'generate',
    requestText: 'requirement',
    resultRaw: 'stale-result',
    model: { id: 'model-1', capabilities: ['vision'] },
  });
  assert.strictEqual(task.status, 'running');
  assert.strictEqual(task.requestOwner, 'xmind-casegen:task-1');
  assert.strictEqual(task.temperature, 0.2);
  assert.deepStrictEqual(task.model.capabilities, ['vision']);

  store.upsertTask(task, 'start');
  var running = store.getTask('task-1');
  assert.strictEqual(running.resultRaw, undefined);
  assert.strictEqual(running.prompt, 'generate');
  assert.strictEqual(root.events[root.events.length - 1].detail.action, 'start');

  running.status = 'done';
  running.resultRaw = '[{"title":"case"}]';
  store.upsertTask(running, 'done');
  var done = store.getTask('task-1');
  assert.strictEqual(done.prompt, '');
  assert.strictEqual(done.requestText, '');
  assert.strictEqual(done.requestOwner, '');
  assert.strictEqual(done.resultRaw, '[{"title":"case"}]');

  done.runnerId = 'runner-1';
  done.heartbeatAt = 123;
  store.updateTaskHeartbeat(done);
  var heartbeatEvent = root.events[root.events.length - 1];
  assert.strictEqual(heartbeatEvent.detail.action, 'heartbeat');
  assert.strictEqual(heartbeatEvent.detail.task.id, 'task-1');
  assert.deepStrictEqual(heartbeatEvent.detail.tasks, []);

  store.clearAll('reset');
  assert.deepStrictEqual(store.getTasks(), []);
  assert.strictEqual(root.events[root.events.length - 1].detail.action, 'reset');
}

function verifyCompactionFallback() {
  var storage = createMemoryStorage();
  var root = createEventRoot(storage);
  var store = storeApi.create({
    root: root,
    persistTaskStorageChars: 1500,
  });
  var task = store.createTask({
    id: 'compact-1',
    restoreContext: {
      workspaceId: 'workspace-1',
      caseGenModules: [{ module: 'M1', cases: [{ title: 'large-case' }] }],
      caseGenResults: { M1: 'x'.repeat(5000) },
      viewState: { drawerOpen: true },
    },
  });
  store.upsertTask(task, 'compact');
  var raw = storage.getItem('tap-xmind-casegen-tasks');
  assert.ok(raw && raw.length < 1500);
  var persisted = JSON.parse(raw)[0];
  assert.strictEqual(persisted.restoreContext.workspaceId, 'workspace-1');
  assert.strictEqual(persisted.restoreContext.caseGenResults, undefined);
  assert.deepStrictEqual(persisted.restoreContext.caseGenModules[0].cases, []);
}

function verifyInvalidStorageRecovery() {
  var storage = createMemoryStorage();
  storage.setItem('tap-xmind-casegen-tasks', '{invalid');
  var root = createEventRoot(storage);
  var store = storeApi.create({ root: root });
  assert.deepStrictEqual(store.getTasks(), []);
  assert.strictEqual(storage.getItem('tap-xmind-casegen-tasks'), null);
  assert.strictEqual(root.app.__xmindCasegenTaskStorageRecovered.reason, 'invalid');
}

function verifyUnavailableStorageFallback() {
  var root = { app: {} };
  Object.defineProperty(root, 'localStorage', {
    get: function() { throw new Error('storage denied'); },
  });
  var store = storeApi.create({ root: root });
  var task = store.createTask({ id: 'volatile-1' });
  store.upsertTask(task, 'volatile');
  assert.strictEqual(store.getTask('volatile-1').id, 'volatile-1');
  store.clearAll();
  assert.deepStrictEqual(store.getTasks(), []);
}

function verifyRequestPayloadOwnership() {
  var source = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  assert.match(source, /function buildManagedTaskRequestEnvelope\(/);
  assert.strictEqual((source.match(/return buildManagedTaskRequestEnvelope\(/g) || []).length, 4);
  assert.strictEqual((source.match(/prompt: String\(taskInput && taskInput\.prompt/g) || []).length, 1);
}

verifyTaskLifecyclePersistence();
verifyCompactionFallback();
verifyInvalidStorageRecovery();
verifyUnavailableStorageFallback();
verifyRequestPayloadOwnership();
console.log('xmind casegen task store tests passed');
