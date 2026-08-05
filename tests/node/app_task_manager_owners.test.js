'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var appSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app.js'), 'utf8');
var entryPages = [
  'index.html',
  'ai-tools.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
  'admin.html',
  'settings.html',
];
var sharedTaskManagerFile = 'persistentModelTaskManager.js';
var managerSpecs = [
  {
    file: 'missingReminderAiManager.js',
    factory: 'initMissingReminderAiManager',
    globalName: 'missingReminderAiManager',
  },
  {
    file: 'caseLibraryAiGenManager.js',
    factory: 'initCaseLibraryAiGenManager',
    globalName: 'caseLibraryAiGenManager',
  },
  {
    file: 'xmindCaseGenTaskManager.js',
    factory: 'initXmindCaseGenTaskManager',
    globalName: 'xmindCaseGenTaskManagerModule',
  },
  {
    file: 'autoWorkflowManager.js',
    factory: 'initAutoWorkflowManager',
    globalName: 'autoWorkflowManagerModule',
  },
];

var sharedTaskManagerPath = path.join(projectRoot, 'scripts/modules/app', sharedTaskManagerFile);
var sharedTaskManagerSource = fs.readFileSync(sharedTaskManagerPath, 'utf8');
var sharedTaskManagerApi = require(sharedTaskManagerPath);
assert.strictEqual(typeof sharedTaskManagerApi.create, 'function', 'shared task manager should export create');
assert.match(sharedTaskManagerSource, /window\.app\.persistentModelTaskManager = api/);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createMemoryStorage() {
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

managerSpecs.forEach(function(spec) {
  var modulePath = path.join(projectRoot, 'scripts/modules/app', spec.file);
  var moduleSource = fs.readFileSync(modulePath, 'utf8');
  var api = require(modulePath);
  assert.strictEqual(typeof api.init, 'function', spec.file + ' should export init');
  assert.match(moduleSource, new RegExp('function ' + escapeRegExp(spec.factory) + '\\('));
  assert.match(moduleSource, new RegExp('window\\.app\\.' + escapeRegExp(spec.globalName) + ' = api'));
  assert.ok(!new RegExp('function ' + escapeRegExp(spec.factory) + '\\(').test(appSource));
  assert.match(appSource, new RegExp('window\\.app\\.' + escapeRegExp(spec.globalName) + '\\.init\\(\\{'));
});

entryPages.forEach(function(page) {
  var source = fs.readFileSync(path.join(projectRoot, page), 'utf8');
  var previousIndex = source.indexOf('./scripts/modules/app/' + sharedTaskManagerFile);
  assert.ok(previousIndex >= 0, page + ' should load the shared task manager');
  managerSpecs.forEach(function(spec) {
    var scriptPath = './scripts/modules/app/' + spec.file;
    var currentIndex = source.indexOf(scriptPath);
    assert.ok(currentIndex > previousIndex, page + ' should load ' + spec.file + ' in order');
    previousIndex = currentIndex;
  });
  assert.ok(source.indexOf('./scripts/modules/app.js') > previousIndex, page + ' should load app.js last');
});

async function verifySharedTaskManagerContract() {
  var storage = createMemoryStorage();
  var manager = sharedTaskManagerApi.create({
    storage: storage,
    storagePrefix: 'test-managed-task:',
    taskIdPrefix: 'test-managed-task-',
    eventName: 'test-managed-task',
    scenes: ['scene-a'],
    executeTask: function(context) {
      assert.strictEqual(context.scene, 'scene-a');
      assert.strictEqual(context.userText, 'payload');
      return Promise.resolve('done-value');
    },
    buildSuccessPatch: function(result) { return { resultValue: result }; },
    formatError: function(message) { return 'failed:' + message; },
  });
  var task = manager.createTask('scene-a', {
    model: { baseUrl: 'http://model.test', model: 'test-model' },
    userText: 'payload',
  });
  assert.match(task.id, /^test-managed-task-/);
  await manager.startTask('scene-a', task, { force: true });
  var storedTask = manager.getTask('scene-a');
  assert.strictEqual(storedTask.status, 'done');
  assert.strictEqual(storedTask.resultValue, 'done-value');
  manager.updateTask('scene-a', { marker: 'updated' }, 'test-update');
  assert.strictEqual(manager.getTask('scene-a').marker, 'updated');
  manager.clearTask('scene-a');
  assert.strictEqual(manager.getTask('scene-a'), null);

  var failingManager = sharedTaskManagerApi.create({
    storage: storage,
    storagePrefix: 'test-failing-task:',
    taskIdPrefix: 'test-failing-task-',
    scenes: ['scene-b'],
    executeTask: function() { return Promise.reject(new Error('boom')); },
    formatError: function(message) { return 'failed:' + message; },
  });
  await failingManager.startTask('scene-b', failingManager.createTask('scene-b', {
    userText: 'payload',
  }), { force: true });
  assert.strictEqual(failingManager.getTask('scene-b').status, 'error');
  assert.strictEqual(failingManager.getTask('scene-b').error, 'failed:boom');
}

async function verifyManagedModelTask(moduleName, expectedField, modelResult) {
  global.localStorage = createMemoryStorage();
  var managerApi = require(path.join(projectRoot, 'scripts/modules/app', moduleName));
  var manager = managerApi.init({
    utils: {},
    callModelWithConfig: function() {
      return Promise.resolve(modelResult);
    },
  });
  var task = manager.createTask('case-library', {
    model: { id: 'model-1', baseUrl: 'http://model.test', model: 'test-model' },
    userText: '{}',
  });
  await manager.startTask('case-library', task, { force: true });
  var storedTask = manager.getTask('case-library');
  assert.strictEqual(storedTask.status, 'done');
  assert.deepStrictEqual(storedTask[expectedField], expectedField === 'resultIds' ? ['case-1'] : modelResult);
  manager.clearTask('case-library');
  assert.strictEqual(manager.getTask('case-library'), null);
}

async function verifyAutoWorkflowTask() {
  global.localStorage = createMemoryStorage();
  var runCount = 0;
  var persistCount = 0;
  var managerApi = require(path.join(projectRoot, 'scripts/modules/app/autoWorkflowManager.js'));
  var manager = managerApi.init({
    getSteps: function() {
      return [{
        key: 'prepare',
        label: '准备',
        run: function(context) {
          runCount += 1;
          context.prepared = true;
        },
        validate: function() { return true; },
      }];
    },
    persistWorkflowStateNow: function() { persistCount += 1; },
  });
  await manager.startTask(manager.createTask({ context: {} }), { force: true });
  var storedTask = manager.getTask();
  assert.strictEqual(storedTask.status, 'done');
  assert.strictEqual(runCount, 1);
  assert.strictEqual(persistCount, 1);
  manager.clearTask();
  assert.strictEqual(manager.getTask(), null);
}

function verifyXmindManagerApi() {
  var originalSetInterval = global.setInterval;
  global.setInterval = function() { return 0; };
  try {
    var managerApi = require(path.join(projectRoot, 'scripts/modules/app/xmindCaseGenTaskManager.js'));
    var manager = managerApi.init({ requestSchedulerCore: {} });
    [
      'createTask',
      'startTask',
      'getTask',
      'getTasks',
      'clearTask',
      'clearTasksForWorkspace',
      'clearAllTasks',
      'cancelTask',
      'failTask',
      'cancelAllRunning',
      'updateTasksContext',
      'resumeTasks',
      'buildTaskId',
      'normalizeModelSnapshot',
    ].forEach(function(name) {
      assert.strictEqual(typeof manager[name], 'function', 'xmind manager should expose ' + name);
    });
  } finally {
    global.setInterval = originalSetInterval;
  }
}

async function main() {
  var originalStorage = global.localStorage;
  try {
    await verifySharedTaskManagerContract();
    await verifyManagedModelTask('missingReminderAiManager.js', 'resultIds', '{"ids":["case-1"]}');
    await verifyManagedModelTask('caseLibraryAiGenManager.js', 'resultRaw', 'generated-cases');
    await verifyAutoWorkflowTask();
    verifyXmindManagerApi();
  } finally {
    if (originalStorage === undefined) delete global.localStorage;
    else global.localStorage = originalStorage;
  }
  console.log('app_task_manager_owners.test.js passed');
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
