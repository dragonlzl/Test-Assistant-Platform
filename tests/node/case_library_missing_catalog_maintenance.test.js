const assert = require('assert');
const fs = require('fs');
const path = require('path');

const drawerModelOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingDrawerModel.js');
const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingCatalogMaintenanceViewAdapter.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingCatalogMaintenanceController.js');

function createElement() {
  const listeners = {};
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    addEventListener: function(name, handler) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(handler);
    },
    listeners: listeners,
  };
}

function createModel() {
  return drawerModelOwner.create({
    normalizeTypeId: function(value) { return value ? String(value) : null; },
    normalizeText: function(value) { return String(value || '').trim(); },
  });
}

function testMaintenanceRules() {
  const model = createModel();
  assert.strictEqual(model.isModuleDuplicateError({ status: 409 }), true);
  assert.strictEqual(model.isModuleDuplicateError({ payload: { detail: 'missing_module_duplicate' } }), true);
  assert.strictEqual(model.isTypeDuplicateError({ payload: { detail: { detail: 'missing_type_duplicate' } } }), true);
  assert.deepStrictEqual(model.readTypeInUseError({
    payload: { detail: { code: 'MISSING_TYPE_IN_USE', item_count: 3 } },
  }), { count: 3 });
  assert.deepStrictEqual(model.buildTypeTransferOptions([
    { id: 1, name: '功能' },
    { id: 2, name: '性能' },
  ], 1), [{ value: '2', label: '性能' }]);
}

function testViewContract() {
  const dom = {
    missingDrawerStatus: createElement(),
    missingTypeAddStatus: createElement(),
    missingTypeManageStatus: createElement(),
    missingAddStatus: createElement(),
    missingEditStatus: createElement(),
    missingTypeAddProjectName: createElement(),
    missingTypeNameInput: createElement(),
    missingTypeManageBody: createElement(),
    missingAddProjectName: createElement(),
    missingAddModuleNameInput: createElement(),
    missingEditProjectName: createElement(),
    missingEditModuleNameInput: createElement(),
  };
  const view = viewOwner.create({
    dom: dom,
    escapeHtml: function(value) { return String(value || '').replace(/</g, '&lt;'); },
    setStatus: function(element, text) { if (element) element.textContent = text; },
  });
  view.prepareTypeAdd('项目A');
  assert.strictEqual(dom.missingTypeAddProjectName.textContent, '项目A');
  dom.missingTypeNameInput.value = ' 安全 ';
  assert.strictEqual(view.getTypeName(), '安全');
  view.renderTypeManage([{ id: 1, name: '<功能>', item_count: 2 }], true);
  assert.ok(dom.missingTypeManageBody.innerHTML.indexOf('&lt;功能>') !== -1);
  assert.ok(dom.missingTypeManageBody.innerHTML.indexOf('data-case-lib-missing-type-delete="1"') !== -1);
  view.prepareModuleAdd('项目A');
  dom.missingAddModuleNameInput.value = ' 登录 ';
  assert.strictEqual(view.getModuleAddName(), '登录');
  view.prepareModuleEdit('项目A', '登录');
  assert.strictEqual(dom.missingEditModuleNameInput.value, '登录');
}

async function testControllerContract() {
  const dom = {
    missingAddConfirmBtn: createElement(),
    missingEditConfirmBtn: createElement(),
  };
  const state = {
    projectNameById: { 7: '项目A' },
    missingDrawer: {
      projectId: 7,
      moduleId: null,
      modules: [],
      selection: new Set(),
      processing: false,
      moduleCompletion: {},
      moduleCompletionLoading: {},
    },
    missingType: {
      types: [{ id: 1, name: '功能', item_count: 2 }, { id: 2, name: '性能', item_count: 1 }],
      selection: new Set(['1']),
    },
    missingTypeAdd: { projectId: 7, source: 'drawer', loading: false },
    missingTypeManage: { loading: false },
    missingAdd: { projectId: 7, loading: false },
    missingEdit: { moduleId: null, projectId: null, name: '', loading: false },
    missingView: {
      projectId: 7,
      modules: [],
      moduleIds: [],
      items: [{
        module_id: 11,
        module_name: '登录',
        type_ids: ['1'],
        type_names: ['功能'],
        type_name: '功能',
      }],
      typeFilters: new Set(['1']),
      selection: new Set(),
      pageIndex: 0,
    },
  };
  let typeName = '安全';
  let moduleAddName = '登录';
  let moduleEditName = '登录改名';
  const statuses = [];
  const view = {
    setDrawerStatus: function(text) { statuses.push(text); },
    setTypeAddStatus: function(text) { statuses.push(text); },
    setTypeManageStatus: function(text) { statuses.push(text); },
    setModuleAddStatus: function(text) { statuses.push(text); },
    setModuleEditStatus: function(text) { statuses.push(text); },
    prepareTypeAdd: function() {},
    getTypeName: function() { return typeName; },
    renderTypeManage: function() {},
    prepareModuleAdd: function() {},
    getModuleAddName: function() { return moduleAddName; },
    prepareModuleEdit: function() {},
    getModuleEditName: function() { return moduleEditName; },
  };
  const drawers = [];
  const toasts = [];
  let refreshModules = 0;
  let refreshViews = 0;
  const controller = controllerOwner.create({
    state: state,
    dom: dom,
    model: createModel(),
    view: view,
    drawerController: {
      syncTypeCatalog: function() {},
      loadTypes: function() { return Promise.resolve([]); },
      loadModules: function() { return Promise.resolve([]); },
      refreshModules: function() { refreshModules += 1; },
      getSelectedModules: function() {
        return state.missingDrawer.modules.filter(function(module) {
          return state.missingDrawer.selection.has(String(module.id));
        });
      },
      syncControls: function() {},
    },
    ensureDrawer: function(id, buttons, onOpen, onClose) {
      const drawer = {
        id: id,
        open: function() { if (onOpen) onOpen(); },
        close: function() { if (onClose) onClose(); },
      };
      drawers.push(drawer);
      return drawer;
    },
    openConfirmDrawer: function() { return Promise.resolve({ ok: true }); },
    isAdminUser: function() { return true; },
    canDeleteModules: function() { return true; },
    getProjectName: function() { return '项目A'; },
    getMainDrawer: function() { return { open: function() {} }; },
    showToast: function(text) { toasts.push(text); },
    normalizeTypeSelection: function() {},
    normalizeTypeId: function(value) { return value ? String(value) : null; },
    normalizeTypeIds: function(values) { return values.map(String); },
    ensureItemTypeSlots: function(item) { return item.type_ids || []; },
    resolveItemTypeNames: function(ids) {
      return ids.map(function(id) { return id === '2' ? '性能' : '功能'; });
    },
    formatItemTypeLabel: function(item) { return (item.type_names || []).join('、'); },
    renderTypePills: function() {},
    refreshTypeCells: function() {},
    normalizeViewTypeFilters: function() {},
    isMissingCardVisible: function() { return true; },
    renderMissingView: function() { refreshViews += 1; },
    updateMissingViewMeta: function() {},
    persistMissingView: function() {},
    clearMissingViewPersistence: function() {},
    apiClient: {
      createMissingType: function(payload) {
        return Promise.resolve({ id: 3, name: payload.name, item_count: 0 });
      },
      deleteMissingType: function(id, transferId) {
        return Promise.resolve({ moved_count: transferId ? 2 : 0 });
      },
      createMissingModule: function(payload) {
        return Promise.resolve({ id: 11, project_id: payload.project_id, name: payload.name, item_count: 0 });
      },
      updateMissingModule: function(id, payload) {
        return Promise.resolve({ id: id, project_id: 7, name: payload.name });
      },
      deleteMissingModule: function() { return Promise.resolve({ detail: 'ok' }); },
    },
  });

  controller.initDrawers();
  assert.strictEqual(drawers.length, 4);
  await controller.confirmTypeAdd();
  assert.strictEqual(state.missingType.types.length, 3);
  assert.ok(toasts.indexOf('添加成功') !== -1);

  controller.removeTypeById(1, 2, 2);
  assert.deepStrictEqual(state.missingView.items[0].type_ids, ['2']);
  assert.strictEqual(state.missingView.items[0].type_name, '性能');
  assert.strictEqual(state.missingType.types.find(function(type) { return type.id === 2; }).item_count, 3);

  await controller.confirmModuleAdd();
  assert.strictEqual(state.missingDrawer.modules[0].name, '登录');
  state.missingEdit.moduleId = 11;
  state.missingEdit.projectId = 7;
  await controller.confirmModuleEdit();
  assert.strictEqual(state.missingDrawer.modules[0].name, '登录改名');
  assert.strictEqual(state.missingView.items[0].module_name, '登录改名');
  assert.ok(refreshModules >= 2);
  assert.ok(refreshViews >= 1);

  state.missingDrawer.selection.add('11');
  await controller.deleteSelectedModules(null);
  assert.strictEqual(state.missingDrawer.modules.length, 0);
  assert.ok(statuses.indexOf('已删除 1 个模块') !== -1);

  controller.bindEvents();
  controller.bindEvents();
  assert.strictEqual(dom.missingAddConfirmBtn.listeners.click.length, 1);
  assert.strictEqual(dom.missingEditConfirmBtn.listeners.click.length, 1);
  typeName = '';
  moduleAddName = '';
  moduleEditName = '';
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const viewSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingCatalogMaintenanceViewAdapter.js'),
    'utf8'
  );
  const controllerSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingCatalogMaintenanceController.js'),
    'utf8'
  );
  assert.ok(parentSource.indexOf('missingCatalogMaintenanceControllerOwner.create') !== -1);
  assert.ok(parentSource.indexOf('function confirmMissingTypeAdd') === -1);
  assert.ok(parentSource.indexOf('function confirmMissingAddModule') === -1);
  assert.ok(parentSource.indexOf('function deleteSelectedMissingModules') === -1);
  assert.ok(parentSource.indexOf('missingCatalogMaintenanceController.initDrawers();') !== -1);
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
    'caseLibraryMissingDrawerController.js',
    'caseLibraryMissingCatalogMaintenanceViewAdapter.js',
    'caseLibraryMissingCatalogMaintenanceController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing maintenance owner');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2] && indexes[2] < indexes[3]);
  });
}

(async function run() {
  testMaintenanceRules();
  testViewContract();
  await testControllerContract();
  testOwnershipAndEntryOrder();
  console.log('case library missing catalog maintenance tests passed');
})().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
