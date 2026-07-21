const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modelOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingDrawerModel.js');
const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingDrawerViewAdapter.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingDrawerController.js');

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
    innerHTML: '',
    textContent: '',
    disabled: false,
    checked: false,
    indeterminate: false,
    classList: createClassList(),
    addEventListener: function(name, handler) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(handler);
    },
    listeners: listeners,
  };
}

function createModel() {
  return modelOwner.create({
    resolvePage: function(total, pageIndex) {
      const totalPages = Math.max(1, Math.ceil(total / 2));
      const resolved = Math.max(0, Math.min(Number(pageIndex) || 0, totalPages - 1));
      return {
        pageIndex: resolved,
        totalPages: totalPages,
        start: resolved * 2,
        end: Math.min(total, resolved * 2 + 2),
      };
    },
    normalizeTypeId: function(value) { return value ? String(value) : null; },
    normalizeText: function(value) { return String(value || '').trim(); },
  });
}

function testModelContract() {
  const model = createModel();
  const drawer = {
    moduleId: null,
    modules: [
      { id: 1, name: '登录', item_count: 2 },
      { id: 2, name: '支付', item_count: 3 },
      { id: 3, name: '搜索', item_count: 0 },
    ],
    selection: new Set(['1', '3', '9']),
    pageIndex: 0,
    loading: false,
    processing: false,
  };
  const snapshot = model.buildSnapshot(drawer);
  assert.deepStrictEqual(snapshot.list.map(function(item) { return item.id; }), [1, 2]);
  assert.deepStrictEqual(Array.from(snapshot.selection), ['1', '3']);
  assert.strictEqual(snapshot.pageSelected, 1);
  assert.strictEqual(snapshot.totalItems, 5);
  assert.deepStrictEqual(Array.from(model.setPageSelection(snapshot, true)), ['1', '3', '2']);

  drawer.moduleId = 2;
  assert.deepStrictEqual(model.getVisibleModules(drawer).map(function(item) { return item.id; }), [2]);
  assert.strictEqual(model.findModuleById(drawer.modules, '3').name, '搜索');
  assert.strictEqual(model.isModuleComplete([{
    type_ids: ['1'],
    title: '密码错误',
    priority: 'P1',
    precondition: '账号存在',
    steps: '输入错误密码',
    expected: '提示失败',
  }]), true);
  assert.strictEqual(model.isModuleComplete([{ type_ids: [], title: '缺类型' }]), false);
}

function testViewContract() {
  const dom = {
    missingDrawerProjectSelect: createElement(),
    missingDrawerModuleSelect: createElement(),
    missingDrawerTypeSelect: createElement(),
    missingDrawerTypeGrid: createElement(),
    missingDrawerListBody: createElement(),
    missingDrawerPaginationTop: createElement(),
    missingDrawerPaginationBottom: createElement(),
    missingDrawerBatchViewBtn: createElement(),
    missingDrawerDeleteBtn: createElement(),
    missingDrawerExportXmindBtn: createElement(),
    missingDrawerExportExcelBtn: createElement(),
    missingDrawerSelectAll: createElement(),
    missingDrawerStatus: createElement(),
  };
  const view = viewOwner.create({
    dom: dom,
    escapeHtml: function(value) { return String(value || '').replace(/</g, '&lt;'); },
    setStatus: function(element, text) { if (element) element.textContent = text; },
    syncProjectOptions: function() {},
    syncModuleOptions: function() {},
    syncTypeOptions: function() {},
    setPagination: function(top, bottom, html) {
      top.innerHTML = html;
      bottom.innerHTML = html;
    },
    buildPagination: function() { return '<nav>分页</nav>'; },
  });
  const typeState = {
    types: [{ id: 1, name: '<安全>' }],
    selection: new Set(['1']),
    loading: false,
  };
  view.renderTypeFilters(typeState);
  assert.ok(dom.missingDrawerTypeGrid.innerHTML.indexOf('&lt;安全>') !== -1);

  const drawer = {
    projectId: 7,
    loading: false,
    moduleCompletion: { '1': true },
  };
  const snapshot = {
    list: [{ id: 1, name: '<登录>', item_count: 2 }],
    total: 1,
    totalItems: 2,
    page: { pageIndex: 0, totalPages: 1, start: 0, end: 1 },
    selection: new Set(['1']),
    busy: false,
    selectedCount: 1,
    pageSelected: 1,
    pageTotal: 1,
  };
  view.renderList(drawer, snapshot);
  assert.ok(dom.missingDrawerListBody.innerHTML.indexOf('&lt;登录>') !== -1);
  assert.ok(dom.missingDrawerListBody.innerHTML.indexOf('case-library-missing-module-complete') !== -1);
  assert.strictEqual(dom.missingDrawerSelectAll.checked, true);
  assert.strictEqual(dom.missingDrawerBatchViewBtn.disabled, false);
  assert.strictEqual(dom.missingDrawerStatus.textContent, '已加载 1 个模块，2 条易漏用例。');
}

async function testControllerContract() {
  const dom = {
    missingDrawerProjectSelect: createElement(),
    missingDrawerModuleSelect: createElement(),
    missingDrawerTypeSelect: createElement(),
    missingDrawerTypeAddBtn: createElement(),
    missingDrawerTypeManageBtn: createElement(),
    missingDrawerTypeGrid: createElement(),
    missingDrawerQueryBtn: createElement(),
    missingDrawerAddModuleBtn: createElement(),
    missingDrawerBatchViewBtn: createElement(),
    missingDrawerDeleteBtn: createElement(),
    missingDrawerExportXmindBtn: createElement(),
    missingDrawerExportExcelBtn: createElement(),
    missingDrawerSelectAll: createElement(),
    missingDrawerListBody: createElement(),
    missingTypeAddConfirmBtn: createElement(),
    missingTypeManageBody: createElement(),
  };
  const state = {
    projects: [{ id: 7, name: '项目' }],
    missingDrawer: {
      projectId: 7,
      moduleId: null,
      modules: [],
      loading: false,
      processing: false,
      selection: new Set(),
      pageIndex: 0,
      moduleCompletion: {},
      moduleCompletionLoading: {},
      moduleCompletionSeq: 0,
    },
    missingType: { projectId: 7, types: [], loading: false, selection: new Set() },
  };
  const snapshots = [];
  const view = {
    renderTypeFilters: function() {},
    syncTypeSelect: function() {},
    syncControls: function() {},
    renderList: function(drawer, snapshot) { snapshots.push(snapshot); },
    reset: function() {},
    prepareProjectOptions: function() {},
    setProjectValue: function(value) { dom.missingDrawerProjectSelect.value = value ? String(value) : ''; },
    getProjectValue: function() { return dom.missingDrawerProjectSelect.value; },
    getModuleValue: function() { return dom.missingDrawerModuleSelect.value; },
    getTypeValue: function() { return dom.missingDrawerTypeSelect.value; },
    clearTypeValue: function() { dom.missingDrawerTypeSelect.value = ''; },
    syncModuleSelect: function(drawer) { return drawer.moduleId || null; },
    clearModuleSelect: function() {},
    setDrawerStatus: function() {},
    showTypeLoading: function() {},
    showNoProject: function() {},
  };
  const importProjects = [];
  let viewed = null;
  const controller = controllerOwner.create({
    state: state,
    dom: dom,
    model: createModel(),
    view: view,
    missingImportController: {
      reset: function() {},
      prepareProjectOptions: function() {},
      getProjectId: function() { return 7; },
      setProjectId: function(id) { importProjects.push(id); },
    },
    normalizeId: function(value) { return value ? Number(value) : null; },
    normalizeTypeSelection: function() {},
    persistProject: function() {},
    readPersistedState: function() { return null; },
    getProjects: function() { return state.projects; },
    getPageSize: function() { return 2; },
    onTypesChanged: function() {},
    onViewModules: function(modules) { viewed = modules; },
    apiClient: {
      listMissingTypes: function() { return Promise.resolve([{ id: 3, name: '安全' }]); },
      listMissingModules: function() {
        return Promise.resolve([{ id: 11, name: '登录', item_count: 1 }]);
      },
      listMissingModuleItems: function() {
        return Promise.resolve([{
          type_ids: ['3'],
          title: '密码错误',
          priority: 'P1',
          precondition: '账号存在',
          steps: '输入错误密码',
          expected: '提示失败',
        }]);
      },
    },
  });

  await controller.loadTypes(7);
  await controller.loadModules(7);
  await new Promise(function(resolve) { setTimeout(resolve, 0); });
  assert.strictEqual(state.missingType.types.length, 1);
  assert.strictEqual(state.missingDrawer.modules.length, 1);
  assert.strictEqual(state.missingDrawer.moduleCompletion['11'], true);
  assert.ok(snapshots.length >= 2);

  controller.setModuleSelection(11, true);
  assert.strictEqual(controller.getSelectedModules().length, 1);
  controller.bindEvents();
  controller.bindEvents();
  assert.strictEqual(dom.missingDrawerProjectSelect.listeners.change.length, 1);
  assert.strictEqual(dom.missingDrawerListBody.listeners.click.length, 1);
  const button = {
    getAttribute: function() { return '11'; },
  };
  dom.missingDrawerListBody.listeners.click[0]({
    target: { closest: function(selector) { return selector.indexOf('missing-view') !== -1 ? button : null; } },
  });
  assert.strictEqual(viewed[0].id, 11);

  dom.missingDrawerProjectSelect.value = '8';
  controller.handleProjectChange();
  assert.strictEqual(state.missingDrawer.projectId, 8);
  assert.strictEqual(importProjects[importProjects.length - 1], 8);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const modelSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingDrawerModel.js'),
    'utf8'
  );
  const viewSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingDrawerViewAdapter.js'),
    'utf8'
  );
  const controllerSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingDrawerController.js'),
    'utf8'
  );
  assert.ok(parentSource.indexOf('missingDrawerControllerOwner.create') !== -1);
  assert.ok(parentSource.indexOf('function renderMissingDrawerList') === -1);
  assert.ok(parentSource.indexOf('function loadMissingDrawerModules') === -1);
  assert.ok(parentSource.indexOf('function handleMissingProjectChange') === -1);
  assert.ok(parentSource.indexOf('missingDrawerController.bindEvents();') !== -1);
  assert.ok(modelSource.indexOf('document.') === -1);
  assert.ok(modelSource.indexOf('apiClient') === -1);
  assert.ok(viewSource.indexOf('apiClient') === -1);
  assert.ok(controllerSource.indexOf('.innerHTML') === -1);

  const entries = [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ];
  const scripts = [
    'caseLibraryMissingImportController.js',
    'caseLibraryMissingDrawerModel.js',
    'caseLibraryMissingDrawerViewAdapter.js',
    'caseLibraryMissingDrawerController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing a drawer owner');
    for (let i = 1; i < indexes.length; i += 1) {
      assert.ok(indexes[i - 1] < indexes[i], entry + ' has invalid drawer owner order');
    }
  });
}

(async function run() {
  testModelContract();
  testViewContract();
  await testControllerContract();
  testOwnershipAndEntryOrder();
  console.log('case library missing drawer owner tests passed');
})().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
