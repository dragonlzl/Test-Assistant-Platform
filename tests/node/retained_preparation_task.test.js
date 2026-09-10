const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(
  path.join(projectRoot, 'scripts', 'core', 'retainedPreparationTask.js'),
  'utf8'
);

function loadFactory() {
  const context = {
    window: { app: {} },
    Promise,
    String,
    Error,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'retainedPreparationTask.js' });
  return context.window.app.retainedPreparationTask;
}

function createManager(seedTasks) {
  const tasks = {};
  const calls = {
    created: [],
    activated: [],
    failed: [],
  };
  (seedTasks || []).forEach((task) => {
    tasks[task.id] = Object.assign({}, task);
  });
  return {
    calls,
    createDeferredTask(payload) {
      const task = Object.assign({
        id: 'deferred-' + String(calls.created.length + 1),
        status: 'running',
        preparationPending: true,
      }, payload);
      tasks[task.id] = task;
      calls.created.push(task.id);
      return Object.assign({}, task);
    },
    getTask(taskId) {
      return tasks[taskId] ? Object.assign({}, tasks[taskId]) : null;
    },
    activateTask(taskId, patch) {
      const current = tasks[taskId];
      if (!current || current.status !== 'running' || current.preparationPending !== true) {
        return current ? Object.assign({}, current) : null;
      }
      tasks[taskId] = Object.assign({}, current, patch, {
        preparationPending: false,
        preparationStatus: 'done',
      });
      calls.activated.push(taskId);
      return Object.assign({}, tasks[taskId]);
    },
    failTask(taskId, options) {
      if (!tasks[taskId]) return false;
      tasks[taskId].status = 'error';
      tasks[taskId].error = options && options.error ? String(options.error) : '';
      calls.failed.push(taskId);
      return true;
    },
    cancel(taskId) {
      if (!tasks[taskId]) return;
      tasks[taskId].status = 'cancelled';
    },
  };
}

async function testCreateAndActivate() {
  const factory = loadFactory();
  const manager = createManager();
  const stages = [];
  const coordinator = factory.init({
    manager,
    buildRequestOptions(task, stage) {
      stages.push(stage);
      return {
        owner: task.requestOwner,
        requestKey: task.requestOwner + ':' + stage,
      };
    },
    prepareTask(task, context) {
      const requestOptions = context.buildRequestOptions('catalog-batch-0');
      assert.strictEqual(requestOptions.owner, 'xmind-owner-1');
      return Promise.resolve({
        requestText: 'prepared payload',
        preparationContext: undefined,
      });
    },
  });
  const started = coordinator.createAndStart({
    requestOwner: 'xmind-owner-1',
    requestText: '',
  });
  assert.strictEqual(started.task.preparationPending, true);
  const activated = await started.promise;
  assert.strictEqual(activated.preparationPending, false);
  assert.strictEqual(activated.requestText, 'prepared payload');
  assert.deepStrictEqual(stages, ['catalog-batch-0']);
  assert.deepStrictEqual(manager.calls.activated, [started.task.id]);
}

async function testCancelledTaskDoesNotActivate() {
  const factory = loadFactory();
  const manager = createManager();
  let releasePreparation;
  const coordinator = factory.init({
    manager,
    prepareTask() {
      return new Promise((resolve) => {
        releasePreparation = resolve;
      });
    },
  });
  const started = coordinator.createAndStart({ requestOwner: 'xmind-owner-2' });
  await Promise.resolve();
  manager.cancel(started.task.id);
  releasePreparation({ requestText: 'must not activate' });
  const cancelled = await started.promise;
  assert.strictEqual(cancelled.status, 'cancelled');
  assert.deepStrictEqual(manager.calls.activated, []);
  assert.deepStrictEqual(manager.calls.failed, []);
}

async function testResumeOnlyPendingTasks() {
  const factory = loadFactory();
  const manager = createManager([
    { id: 'pending-1', status: 'running', preparationPending: true },
    { id: 'active-1', status: 'running', preparationPending: false },
    { id: 'cancelled-1', status: 'cancelled', preparationPending: true },
  ]);
  const preparedIds = [];
  const coordinator = factory.init({
    manager,
    prepareTask(task) {
      preparedIds.push(task.id);
      return Promise.resolve({ requestText: 'restored' });
    },
  });
  const resumed = coordinator.resumePendingTasks([
    manager.getTask('pending-1'),
    manager.getTask('active-1'),
    manager.getTask('cancelled-1'),
  ]);
  assert.strictEqual(resumed, 1);
  await coordinator.getRunningPromise('pending-1');
  assert.deepStrictEqual(preparedIds, ['pending-1']);
  assert.deepStrictEqual(manager.calls.activated, ['pending-1']);
}

Promise.resolve()
  .then(testCreateAndActivate)
  .then(testCancelledTaskDoesNotActivate)
  .then(testResumeOnlyPendingTasks)
  .then(() => {
    console.log('retained_preparation_task tests passed');
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
