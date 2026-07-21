const assert = require('assert');
const fs = require('fs');
const path = require('path');

const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryShareViewAdapter.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryShareController.js');

function createClassList() {
  const values = new Set();
  return {
    add: function(value) { values.add(value); },
    remove: function(value) { values.delete(value); },
    contains: function(value) { return values.has(value); },
  };
}

function createElement() {
  const listeners = {};
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    classList: createClassList(),
    addEventListener: function(name, handler) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(handler);
    },
    listeners: listeners,
  };
}

function buildDom() {
  return {
    shareDrawerCaseName: createElement(),
    shareDrawerSourceProject: createElement(),
    shareDrawerSourceVersion: createElement(),
    shareDrawerProjectSelect: createElement(),
    shareDrawerVersionSelect: createElement(),
    shareDrawerConfirmBtn: createElement(),
    shareDrawerStatus: createElement(),
  };
}

function setStatus(element, text, type) {
  element.textContent = text;
  element.statusType = type;
}

function testViewContract() {
  const dom = buildDom();
  const view = viewOwner.create({
    dom: dom,
    escapeHtml: function(value) { return String(value || '').replace(/</g, '&lt;'); },
    setStatus: setStatus,
  });
  const projectNames = {};
  view.renderProjectOptions([{ id: 2, name: '<项目>' }], projectNames);
  assert.ok(dom.shareDrawerProjectSelect.innerHTML.indexOf('&lt;项目>') !== -1);
  assert.strictEqual(projectNames[2], '<项目>');
  view.renderVersionOptions([{ id: 9, name: 'v9' }], {});
  assert.strictEqual(dom.shareDrawerVersionSelect.disabled, false);
  view.renderMeta([
    { id: 1, file_name_clean: '登录', project_id: 3, version_id: 4 },
    { id: 2, file_name_clean: '注册', project_id: 3, version_id: 5 },
  ], function() { return '来源项目'; }, function() { return '来源版本'; });
  assert.strictEqual(dom.shareDrawerCaseName.textContent, '已选 2 份用例');
  assert.strictEqual(dom.shareDrawerSourceProject.textContent, '来源项目');
  assert.strictEqual(dom.shareDrawerSourceVersion.textContent, '多个版本');
}

async function testControllerLifecycle() {
  const dom = buildDom();
  const state = { shareDrawer: {} };
  const statuses = [];
  const calls = [];
  const hints = [];
  let onOpen = null;
  let onClose = null;
  const drawerElement = { classList: createClassList() };
  const drawer = {
    element: drawerElement,
    open: function() { drawerElement.classList.add('open'); if (onOpen) onOpen(); },
    close: function() { drawerElement.classList.remove('open'); if (onClose) onClose(); },
  };
  const previousElement = { classList: createClassList() };
  previousElement.classList.add('open');
  let previousOpened = 0;
  let previousClosed = 0;
  const previousDrawer = {
    element: previousElement,
    open: function() { previousOpened += 1; previousElement.classList.add('open'); },
    close: function() { previousClosed += 1; previousElement.classList.remove('open'); },
  };
  const apiClient = {
    listProjects: function(options) {
      assert.strictEqual(options.scope, 'share');
      return Promise.resolve([{ id: 7, name: '目标项目' }]);
    },
    listProjectVersions: function(projectId, options) {
      assert.strictEqual(projectId, 7);
      assert.strictEqual(options.scope, 'share');
      return Promise.resolve([{ id: 8, name: 'v8' }]);
    },
    shareCaseFile: function(payload) {
      calls.push(payload);
      if (payload.case_file_id === 2) {
        return Promise.reject({ status: 409, payload: { detail: 'case_file_duplicate' } });
      }
      return Promise.resolve({ ok: true });
    },
  };
  const view = viewOwner.create({
    dom: dom,
    escapeHtml: function(value) { return String(value || ''); },
    setStatus: function(element, text, type) {
      setStatus(element, text, type);
      statuses.push({ text: text, type: type });
    },
  });
  const controller = controllerOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    view: view,
    ensureDrawer: function(id, buttons, openHandler, closeHandler) {
      assert.strictEqual(id, 'caseLibraryShareDrawer');
      onOpen = openHandler;
      onClose = closeHandler;
      return drawer;
    },
    openConfirmDrawer: function(options) {
      assert.ok(options.message.indexOf('目标项目') !== -1);
      return Promise.resolve({ ok: true });
    },
    normalizeId: function(value) { return value ? Number(value) : null; },
    getProjectName: function() { return '来源项目'; },
    getVersionName: function() { return '来源版本'; },
    captureAnchor: function() { return { left: 1, top: 2 }; },
    showBlockHint: function(rect, text) { hints.push(text); },
  });

  controller.bindEvents();
  controller.bindEvents();
  assert.strictEqual(dom.shareDrawerConfirmBtn.listeners.click.length, 1);
  assert.strictEqual(controller.open([
    { id: 1, file_name_clean: '登录', project_id: 3, version_id: 4 },
    { id: 2, file_name_clean: '注册', project_id: 3, version_id: 4 },
  ], { previousDrawer: previousDrawer }), true);
  assert.strictEqual(previousClosed, 1);
  await new Promise(function(resolve) { setImmediate(resolve); });
  assert.ok(dom.shareDrawerProjectSelect.innerHTML.indexOf('目标项目') !== -1);

  dom.shareDrawerProjectSelect.value = '7';
  await controller.handleProjectChange();
  dom.shareDrawerVersionSelect.value = '8';
  controller.handleVersionChange();
  assert.strictEqual(dom.shareDrawerConfirmBtn.disabled, false);
  assert.strictEqual(await controller.confirm(), true);
  assert.strictEqual(calls.length, 2);
  assert.ok(statuses.some(function(entry) { return entry.text.indexOf('共享成功：登录') !== -1; }));
  assert.ok(statuses.some(function(entry) { return entry.text.indexOf('已存在未共享：注册') !== -1; }));
  assert.strictEqual(hints.length, 1);

  drawer.close();
  assert.strictEqual(previousOpened, 1);
  assert.strictEqual(controller.getCaseFiles().length, 0);
  controller.invalidateCatalog();
  assert.strictEqual(controller.getState().projects.length, 0);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const view = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryShareViewAdapter.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryShareController.js'), 'utf8');
  assert.ok(parent.indexOf('shareControllerOwner.create') !== -1);
  assert.ok(parent.indexOf('function submitShareCaseFiles') === -1);
  assert.ok(parent.indexOf('function confirmShareCaseFile') === -1);
  assert.ok(parent.indexOf('shareController.open(files') !== -1);
  assert.ok(view.indexOf('apiClient') === -1);
  assert.ok(controller.indexOf('.innerHTML') === -1);

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  const scripts = ['caseLibraryShareViewAdapter.js', 'caseLibraryShareController.js', 'caseLibrary.js'];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing share owner');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2]);
  });
}

(async function run() {
  testViewContract();
  await testControllerLifecycle();
  testOwnershipAndEntryOrder();
  console.log('case library share owner tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
