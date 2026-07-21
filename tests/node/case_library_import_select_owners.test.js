const assert = require('assert');
const fs = require('fs');
const path = require('path');

const model = require('../../scripts/modules/caseLibrary/caseLibraryImportSelectModel.js');
const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryImportSelectViewAdapter.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryImportSelectController.js');

function createElement() {
  const listeners = {};
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    checked: false,
    indeterminate: false,
    addEventListener: function(name, handler) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(handler);
    },
    listeners: listeners,
  };
}

function buildDom() {
  return {
    importSelectProjectSelect: createElement(),
    importSelectVersionSelect: createElement(),
    importSelectSearchInput: createElement(),
    importSelectQueryBtn: createElement(),
    importSelectBatchBtn: createElement(),
    importSelectSelectAll: createElement(),
    importSelectStatus: createElement(),
    importSelectListBody: createElement(),
    importSelectPaginationTop: createElement(),
    importSelectPaginationBottom: createElement(),
  };
}

function testModelContract() {
  const files = [
    { id: 1, version_id: 10, file_name_clean: '登录用例' },
    { id: 2, version_id: 20, file_name_clean: '支付用例' },
    { id: 3, version_id: 10, file_name_clean: '登录异常' },
  ];
  assert.deepStrictEqual(model.filterFiles(files, 10, '登录').map(function(file) { return file.id; }), [1, 3]);
  assert.deepStrictEqual(model.filterFiles(files, 0, '').map(function(file) { return file.id; }), [1, 2, 3]);
  const snapshot = model.buildSnapshot({
    files: files,
    versionId: 10,
    searchText: '',
    pageIndex: 0,
    selection: new Set(['1', '2']),
  }, 1);
  assert.deepStrictEqual(Array.from(snapshot.selection), ['1']);
  assert.strictEqual(snapshot.records.length, 1);
  assert.strictEqual(snapshot.pageSelectionChecked, true);
  const nextSelection = model.setPageSelection(snapshot, false);
  assert.strictEqual(nextSelection.size, 0);
  assert.deepStrictEqual(model.mapCaseItem({
    module: ' 登录 ', title: '成功', priority: 'P1', precondition: '已注册', steps: '提交', expected: '首页',
  }), {
    module: '登录', title: '成功', priority: 'P1', preconditions: '已注册', steps: '提交', expected: '首页',
  });
}

function createHarness() {
  const dom = buildDom();
  const files = [
    { id: 501, project_id: 77, version_id: 7701, file_name_clean: '登录用例', item_count: 2, reuse_enabled: true },
    { id: 502, project_id: 77, version_id: 7701, file_name_clean: '支付用例', item_count: 1, reuse_enabled: false },
  ];
  const state = {
    importSelectDrawer: {},
    projectNameById: { 77: '导入项目' },
    versionsByProject: { 77: [{ id: 7701, name: 'v1' }] },
  };
  const drawer = {
    opened: 0,
    closed: 0,
    open: function() { this.opened += 1; },
    close: function() { this.closed += 1; },
  };
  const imported = [];
  const workflowStatuses = [];
  const casesApi = {
    addImportedCase: function(name, text, cases, meta) {
      imported.push({ name: name, text: text, cases: cases, meta: meta });
    },
  };
  const apiClient = {
    listCaseFiles: function(projectId) {
      assert.strictEqual(projectId, 77);
      return Promise.resolve(files.slice());
    },
    listCaseItems: function(fileId) {
      if (fileId === 501) {
        return Promise.resolve([
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '已注册', steps: '提交', expected: '成功' },
        ]);
      }
      return Promise.resolve([
        { module: '支付', title: '正常支付', priority: 'P0', precondition: '有余额', steps: '支付', expected: '成功' },
      ]);
    },
  };
  const view = viewOwner.create({
    dom: dom,
    setStatus: function(element, text, type) {
      if (!element) return;
      element.textContent = text;
      element.statusType = type;
    },
    escapeHtml: function(value) { return String(value || '').replace(/</g, '&lt;'); },
    syncProjectOptions: function(select) {
      select.innerHTML = '<option value="">请选择项目</option><option value="77">导入项目</option>';
    },
    syncVersionOptionsWithAll: function(select) {
      select.innerHTML = '<option value="">请选择版本</option><option value="0">全部版本</option><option value="7701">v1</option>';
    },
    getProjectName: function() { return '导入项目'; },
    getVersionName: function() { return 'v1'; },
  });
  const controller = controllerOwner.create({
    state: state,
    apiClient: apiClient,
    model: model,
    view: view,
    normalizeId: function(value) {
      if (value === '' || value === null || value === undefined) return null;
      return Number(value);
    },
    getPageSize: function() { return 20; },
    ensureProjectsReady: function() { return Promise.resolve([{ id: 77, name: '导入项目' }]); },
    loadVersions: function() { return Promise.resolve(state.versionsByProject[77]); },
    getVersions: function() { return state.versionsByProject[77]; },
    getDrawer: function() { return drawer; },
    closeAllDrawers: function() {},
    getCasesApi: function() { return casesApi; },
    syncWorkflowStatus: function(message, type) { workflowStatuses.push({ message: message, type: type }); },
  });
  return {
    controller: controller,
    dom: dom,
    state: state,
    drawer: drawer,
    imported: imported,
    workflowStatuses: workflowStatuses,
  };
}

async function testControllerLifecycle() {
  const harness = createHarness();
  const controller = harness.controller;
  controller.bindEvents();
  controller.bindEvents();
  assert.strictEqual(harness.dom.importSelectQueryBtn.listeners.click.length, 1);
  assert.strictEqual(harness.dom.importSelectListBody.listeners.change.length, 1);
  assert.strictEqual(harness.dom.importSelectListBody.listeners.click.length, 1);

  await controller.prepare();
  harness.dom.importSelectProjectSelect.value = '77';
  harness.dom.importSelectVersionSelect.value = '7701';
  harness.dom.importSelectSearchInput.value = '用例';
  assert.strictEqual(await controller.loadFiles(), true);
  assert.strictEqual(harness.state.importSelectDrawer.files.length, 2);
  assert.ok(harness.dom.importSelectListBody.innerHTML.indexOf('登录用例') !== -1);

  harness.dom.importSelectListBody.listeners.change[0]({
    target: {
      checked: true,
      getAttribute: function(name) { return name === 'data-case-lib-import-select' ? '501' : ''; },
    },
  });
  assert.deepStrictEqual(Array.from(harness.state.importSelectDrawer.selection), ['501']);
  assert.strictEqual(await controller.importSelected({ closeAfter: true }), true);
  assert.strictEqual(harness.drawer.closed, 1);
  assert.strictEqual(harness.imported.length, 1);
  assert.strictEqual(harness.imported[0].name, '登录用例');
  assert.strictEqual(harness.imported[0].meta.sourceType, 'case-library-select');
  assert.strictEqual(await controller.handleClose(), false);

  assert.strictEqual(await controller.importOne('502'), true);
  assert.strictEqual(harness.imported.length, 2);
  assert.strictEqual(harness.imported[1].name, '支付用例');
  assert.ok(harness.workflowStatuses.some(function(status) {
    return status.message.indexOf('已导入 1 份用例') !== -1;
  }));

  assert.strictEqual(controller.open(), true);
  assert.strictEqual(harness.drawer.opened, 1);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const view = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryImportSelectViewAdapter.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryImportSelectController.js'), 'utf8');
  assert.ok(parent.indexOf('importSelectControllerOwner.create') !== -1);
  assert.ok(parent.indexOf('importSelectController.open') !== -1);
  assert.ok(parent.indexOf('function renderImportSelectDrawerList') === -1);
  assert.ok(parent.indexOf('function importCaseFilesToWorkflow') === -1);
  assert.ok(parent.indexOf('function handleImportSelectDrawerClose') === -1);
  assert.ok(view.indexOf('apiClient') === -1);
  assert.ok(controller.indexOf('.innerHTML') === -1);
  assert.ok(controller.indexOf('document.') === -1);

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  const scripts = [
    'caseLibraryImportSelectModel.js',
    'caseLibraryImportSelectViewAdapter.js',
    'caseLibraryImportSelectController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing import select owner');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2] && indexes[2] < indexes[3]);
  });
}

(async function run() {
  testModelContract();
  await testControllerLifecycle();
  testOwnershipAndEntryOrder();
  console.log('case library import select owner tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
