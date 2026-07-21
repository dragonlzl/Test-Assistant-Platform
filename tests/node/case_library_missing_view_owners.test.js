const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modelOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingViewModel.js');
const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingViewAdapter.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingViewController.js');

function createModel() {
  return modelOwner.create({
    normalizeText: function(value) { return value === null || value === undefined ? '' : String(value).trim(); },
    normalizePriority: function(value) { return String(value || '').toUpperCase(); },
    normalizeTypeId: function(value) { return value === null || value === undefined || value === '' ? null : String(value); },
    normalizeTypeIds: function(values) {
      return (Array.isArray(values) ? values : []).map(String).filter(Boolean);
    },
    collectTypeIds: function(item) {
      return (item && Array.isArray(item.type_ids) ? item.type_ids : []).map(String).filter(Boolean);
    },
    resolveTypeNames: function(ids, names) { return Array.isArray(names) ? names.slice() : []; },
    resolveTypeLabel: function(id, fallback) { return fallback || (id ? ('类型#' + id) : '未分类'); },
  });
}

function createTarget() {
  const listeners = [];
  return {
    innerHTML: '',
    textContent: '',
    disabled: false,
    listeners,
    addEventListener: function(name) { listeners.push(name); },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
  };
}

function testModelContract() {
  const model = createModel();
  const payload = model.buildItemPayload({
    title: ' 登录失败 ',
    priority: 'p2',
    expected: ' 提示错误 ',
    type_ids: ['1', '2'],
  });
  assert.strictEqual(payload.title, '登录失败');
  assert.strictEqual(payload.priority, 'P2');
  assert.strictEqual(payload.expected, '提示错误');
  assert.deepStrictEqual(payload.type_ids, ['1', '2']);
  assert.strictEqual(model.validatePayload(payload), '');
  assert.strictEqual(model.validatePayload({ title: '', expected: '' }), '用例标题不能为空');

  const items = [
    { type_ids: ['1'] },
    { type_ids: ['2'] },
    { type_ids: [] },
  ];
  assert.deepStrictEqual(model.getFilteredIndexes(items, new Set(['2'])), [1]);
  assert.deepStrictEqual(model.getFilteredIndexes(items, new Set(['none'])), [2]);
  assert.deepStrictEqual(model.resolvePage(items, new Set(), 9, 2), {
    filteredIndexes: [0, 1, 2],
    pagedIndexes: [2],
    total: 3,
    totalPages: 2,
    pageIndex: 1,
    pageSize: 2,
    start: 2,
    end: 3,
  });
  assert.strictEqual(model.hasDuplicateType(['1', '2'], 1, '1'), true);
  assert.deepStrictEqual(model.buildTypePills(items, [{ id: 2, name: '性能' }, { id: 1, name: '功能' }]), [
    { key: '2', label: '性能', count: 1 },
    { key: '1', label: '功能', count: 1 },
    { key: 'none', label: '未分类', count: 1 },
  ]);
}

function testViewContract() {
  const model = createModel();
  const missingView = createTarget();
  const missingTypePills = createTarget();
  const missingBatchDeleteBtn = createTarget();
  const missingProject = createTarget();
  const missingModules = createTarget();
  const state = {
    projectId: 7,
    modules: [{ id: 10, name: '登录' }],
    items: [{
      id: 1,
      module_id: 10,
      module_name: '登录',
      type_ids: ['2'],
      title: '登录失败',
      priority: 'p1',
      expected: '提示错误',
    }],
    selection: new Set([0]),
    typeFilters: new Set(['2']),
    pageIndex: 0,
  };
  const view = viewOwner.create({
    dom: { missingView, missingTypePills, missingBatchDeleteBtn, missingProject, missingModules },
    model,
    getView: function() { return state; },
    getTypes: function() { return [{ id: 2, name: '异常' }]; },
    getProjectName: function() { return '项目A'; },
    ensureTypeSlots: function(item) { return item.type_ids; },
    normalizePriority: function(value) { return String(value || '').toUpperCase(); },
    getPageSize: function() { return 10; },
  });
  view.updateMeta();
  const page = view.render();
  assert.strictEqual(missingProject.textContent, '项目A');
  assert.strictEqual(missingModules.textContent, '登录');
  assert.strictEqual(page.total, 1);
  assert.ok(missingView.innerHTML.indexOf('登录失败') !== -1);
  assert.ok(missingView.innerHTML.indexOf('P1') !== -1);
  assert.ok(missingTypePills.innerHTML.indexOf('异常 1') !== -1);
  assert.strictEqual(missingBatchDeleteBtn.disabled, false);
}

async function testControllerContract() {
  const model = createModel();
  const missingView = createTarget();
  const missingTypePills = createTarget();
  const missingBatchDeleteBtn = createTarget();
  const state = {
    modules: [],
    items: [],
    selection: new Set(),
    typeFilters: new Set(),
    pageIndex: 0,
  };
  const renders = [];
  const updates = [];
  const view = {
    render: function() { renders.push('render'); },
    updateMeta: function() {},
    refreshTypeCell: function() {},
    renderTypePills: function() {},
    syncBatchDeleteControls: function() {},
    resolveTypeLabel: function(id) { return '类型#' + id; },
  };
  const controller = controllerOwner.create({
    dom: { missingView, missingTypePills, missingBatchDeleteBtn },
    apiClient: {
      listMissingModuleItems: function() {
        return Promise.resolve([{ id: 5, title: '失败提示', expected: '展示错误', type_ids: ['1'] }]);
      },
      updateMissingModuleItem: function(id, payload) {
        updates.push({ id, payload });
        return Promise.resolve({ id, title: '失败提示', expected: '展示错误', type_ids: payload.type_ids || ['1'] });
      },
    },
    model,
    view,
    getView: function() { return state; },
    getPageSize: function() { return 10; },
    normalizeItem: function(item) { return item; },
    normalizeTypeId: function(value) { return value === '' ? null : String(value); },
    ensureTypeSlots: function(item) {
      if (!Array.isArray(item.type_ids) || !item.type_ids.length) item.type_ids = [''];
      return item.type_ids;
    },
    collectTypeIds: function(item) { return item.type_ids.filter(Boolean); },
  });
  const loaded = await controller.loadItems([{ id: 9, name: '登录' }]);
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].module_id, 9);
  assert.strictEqual(loaded[0].module_name, '登录');
  controller.handleItemTypeChange(0, 0, '2');
  await new Promise(function(resolve) { setTimeout(resolve, 0); });
  assert.deepStrictEqual(updates[0], { id: 5, payload: { type_ids: ['2'] } });
  controller.bindEvents();
  controller.bindEvents();
  assert.deepStrictEqual(missingView.listeners, ['click', 'change', 'input', 'focusout']);
  assert.deepStrictEqual(missingTypePills.listeners, ['click']);
  assert.deepStrictEqual(missingBatchDeleteBtn.listeners, ['click']);
  assert.ok(renders.length >= 1);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const modelSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingViewModel.js'), 'utf8');
  const viewSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingViewAdapter.js'), 'utf8');
  const controllerSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingViewController.js'), 'utf8');
  assert.ok(parentSource.indexOf('missingViewControllerOwner.create') !== -1);
  assert.ok(parentSource.indexOf('function renderMissingViewTable') === -1);
  assert.ok(parentSource.indexOf('function scheduleMissingAutoSave') === -1);
  assert.ok(parentSource.indexOf('function openMissingViewForModules') === -1);
  assert.ok(modelSource.indexOf('document.') === -1);
  assert.ok(modelSource.indexOf('innerHTML') === -1);
  assert.ok(modelSource.indexOf('apiClient') === -1);
  assert.ok(viewSource.indexOf('apiClient') === -1);
  assert.ok(controllerSource.indexOf('.innerHTML') === -1);
  assert.ok(controllerSource.indexOf('<table') === -1);

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  const scripts = [
    'caseLibraryMissingViewModel.js',
    'caseLibraryMissingViewAdapter.js',
    'caseLibraryMissingViewController.js',
    'caseLibraryMissingViewPendingController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing a missing-view script');
    assert.ok(indexes.every(function(index, i) { return i === 0 || indexes[i - 1] < index; }));
  });
}

(async function run() {
  testModelContract();
  testViewContract();
  await testControllerContract();
  testOwnershipAndEntryOrder();
  console.log('case library missing view owner tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
