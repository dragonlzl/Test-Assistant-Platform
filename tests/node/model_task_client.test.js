const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'services', 'modelTaskClient.js'), 'utf8');

function loadClient(apiClient) {
  const context = {
    window: { app: { apiClient, services: {} } },
    AbortController,
    Promise,
    Number,
    String,
    Math,
    Date,
    Error,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'modelTaskClient.js' });
  return context.window.app.services.modelTaskClient;
}

async function testPollingAndStableKeys() {
  const createdPayloads = [];
  let polls = 0;
  const api = {
    createModelTask(payload) {
      createdPayloads.push(payload);
      return Promise.resolve({ id: 'task-1', status: 'queued' });
    },
    getModelTask() {
      polls += 1;
      if (polls === 1) return Promise.resolve({ id: 'task-1', status: 'running' });
      return Promise.resolve({
        id: 'task-1',
        status: 'succeeded',
        upstream_status: 200,
        response_content_type: 'application/json',
        response_body: '{"ok":true}',
      });
    },
    cancelModelTasksByOwner() {
      return Promise.resolve({ cancelled_count: 0, task_ids: [] });
    },
  };
  const client = loadClient(api);
  const task = { id: 'page-task-7', requestOwner: 'case-page:7', retryCount: 0, scene: 'case-library' };
  const options = client.buildRequestOptions(task, 'semantic-dedupe');
  assert.strictEqual(options.owner, 'case-page:7');
  assert.strictEqual(options.requestKey, 'case-page:7:semantic-dedupe:attempt-0');

  const response = await client.runModelRequest({
    model: { id: '12' },
    payload: { messages: [] },
    timeoutSec: 90,
    owner: options.owner,
    requestKey: options.requestKey,
    scene: options.scene,
  });
  assert.strictEqual(response.status, 200);
  assert.strictEqual(await response.text(), '{"ok":true}');
  assert.strictEqual(createdPayloads.length, 1);
  assert.strictEqual(createdPayloads[0].model_config_id, 12);
  assert.strictEqual(createdPayloads[0].owner_key, 'case-page:7');
  assert.strictEqual(createdPayloads[0].idempotency_key, options.requestKey);
  assert.ok(polls >= 2);
}

async function testAbortCancelsOwner() {
  const cancelledOwners = [];
  const api = {
    createModelTask() {
      return Promise.resolve({ id: 'task-running', status: 'running' });
    },
    getModelTask() {
      return Promise.resolve({ id: 'task-running', status: 'running' });
    },
    cancelModelTasksByOwner(owner) {
      cancelledOwners.push(owner);
      return Promise.resolve({ cancelled_count: 1, task_ids: ['task-running'] });
    },
  };
  const client = loadClient(api);
  const controller = new AbortController();
  const pending = client.runModelRequest({
    model: { remoteId: 21 },
    payload: {},
    owner: 'xmind-owner-1',
    requestKey: 'xmind-owner-1:request:attempt-0',
  }, controller.signal);
  setTimeout(() => controller.abort('manual-cancel'), 20);
  await assert.rejects(pending, (err) => err && err.name === 'AbortError');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepStrictEqual(cancelledOwners, ['xmind-owner-1']);
}

async function testBackendTaskIsRequired() {
  const clientWithoutApi = loadClient({});
  await assert.rejects(
    clientWithoutApi.runModelRequest({ model: { remoteId: 9 }, payload: {} }),
    (err) => err && err.code === 'MODEL_TASK_BACKEND_REQUIRED'
  );

  const clientWithoutRemoteModel = loadClient({
    createModelTask() {
      throw new Error('must not create');
    },
    getModelTask() {
      return Promise.resolve(null);
    },
  });
  await assert.rejects(
    clientWithoutRemoteModel.runModelRequest({ model: { id: 'model-local' }, payload: {} }),
    (err) => err && err.code === 'MODEL_TASK_BACKEND_REQUIRED'
  );
}

function testRequestKeyIncludesModelIdentity() {
  const client = loadClient({});
  const first = client.scopeRequestKeyToModel('xmind-owner:request:attempt-0', {
    remoteId: 101,
    configUpdatedAt: '2026-09-02T08:00:00.000Z',
  });
  const second = client.scopeRequestKeyToModel('xmind-owner:request:attempt-0', {
    remoteId: 101,
    configUpdatedAt: '2026-09-02T08:01:00.000Z',
  });
  const recreated = client.scopeRequestKeyToModel('xmind-owner:request:attempt-0', {
    remoteId: 102,
    configUpdatedAt: '2026-09-02T08:00:00.000Z',
  });
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first, recreated);
  assert.ok(first.indexOf(':model-101:version-2026-09-02T08-00-00.000Z') !== -1);
}

Promise.resolve()
  .then(testPollingAndStableKeys)
  .then(testAbortCancelsOwner)
  .then(testBackendTaskIsRequired)
  .then(testRequestKeyIncludesModelIdentity)
  .then(() => {
    console.log('modelTaskClient tests passed');
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
