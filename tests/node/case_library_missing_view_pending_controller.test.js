const assert = require('assert');
const controllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryMissingViewPendingController.js');

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

function createView(items) {
  return {
    moduleIds: [11],
    items: items || [],
    selection: new Set(),
    pageIndex: 0,
    pendingOp: null,
    pendingTimer: null,
    pendingInterval: null,
    pendingToast: null,
    pendingRemaining: 0,
  };
}

function createHarness(view, apiOverrides) {
  var body = createElement();
  var statuses = [];
  var marked = [];
  var unmarked = [];
  var renderCount = 0;
  var syncCount = 0;
  var apiClient = Object.assign({
    createMissingModuleItem: function(moduleId, payload) {
      return Promise.resolve(Object.assign({ id: 90, module_id: moduleId }, payload));
    },
    deleteMissingModuleItem: function() { return Promise.resolve({ ok: true }); },
  }, apiOverrides || {});
  var controller = controllerFactory.create({
    apiClient: apiClient,
    document: { body: body, createElement: createElement },
    getView: function() { return view; },
    setStatus: function(message, type) { statuses.push([message, type]); },
    render: function() { renderCount += 1; },
    syncBatchDeleteControls: function() { syncCount += 1; },
    buildPayload: function(item) {
      return {
        title: String(item.title || '').trim(),
        expected: String(item.expected || '').trim(),
        type_ids: Array.isArray(item.type_ids) ? item.type_ids.filter(Boolean) : [],
      };
    },
    validatePayload: function(payload) {
      if (!payload || !payload.title) return '用例标题不能为空';
      if (!payload.expected) return '预期结果不能为空';
      return '';
    },
    syncRowInput: function() {},
    getItemUiKey: function(item) { return item.__uiKey || 'ui-existing'; },
    normalizeCreated: function(item) { item.normalized = true; return item; },
    ensureItemKey: function(item, keyName, value) { item[keyName] = value || 'ui-new'; },
    markNewAdded: function(moduleId, item) { marked.push([moduleId, item]); },
    unmarkNewAdded: function(moduleId, item) { unmarked.push([moduleId, item]); },
    captureAnchorRect: function() { return { left: 1, top: 2 }; },
    showBlockHint: function() {},
    getPageSize: function() { return 20; },
    getModuleName: function(moduleId) { return '模块' + moduleId; },
    openConfirm: function() { return Promise.resolve({ ok: true }); },
    getPreviousDrawer: function() { return null; },
    now: function() { return 1000; },
    random: function() { return 0.5; },
    setInterval: function() { return 1; },
    clearInterval: function() {},
    clearTimeout: function() {},
  });
  return {
    controller: controller,
    body: body,
    statuses: statuses,
    marked: marked,
    unmarked: unmarked,
    renderCount: function() { return renderCount; },
    syncCount: function() { return syncCount; },
  };
}

function testInsertAndUndo() {
  var view = createView([]);
  var harness = createHarness(view);
  harness.controller.addEmpty({});
  assert.strictEqual(view.items.length, 1);
  assert.strictEqual(view.items[0].module_id, 11);
  assert.strictEqual(view.items[0].module_name, '模块11');
  assert.strictEqual(view.pendingOp.type, 'insert');
  assert.strictEqual(harness.body.children.length, 1);
  harness.body.children[0].children[1].dispatch('click');
  assert.strictEqual(view.items.length, 0);
  assert.strictEqual(view.pendingOp, null);
  assert.deepStrictEqual(harness.statuses[harness.statuses.length - 1], ['已撤回增删操作（未入库）', 'ok']);
}

async function testInsertCommit() {
  var item = {
    __localId: 'missing-local-a',
    __uiKey: 'ui-a',
    module_id: 11,
    title: '登录易漏项',
    expected: '显示提示',
    type_ids: ['2'],
  };
  var view = createView([item]);
  view.pendingOp = { type: 'insert', itemKey: item.__localId };
  var harness = createHarness(view);
  await harness.controller.commit();
  assert.strictEqual(view.items[0].id, 90);
  assert.strictEqual(view.items[0].normalized, true);
  assert.strictEqual(view.items[0].__uiKey, 'ui-a');
  assert.strictEqual(view.pendingOp, null);
  assert.strictEqual(harness.marked.length, 1);
  assert.deepStrictEqual(harness.statuses[harness.statuses.length - 1], ['新增已入库', 'ok']);
}

async function testBatchRemovePartialCommit() {
  var first = { id: 1, module_id: 11, title: 'A' };
  var second = { id: 2, module_id: 11, title: 'B' };
  var remaining = { id: 3, module_id: 11, title: 'C' };
  var view = createView([remaining]);
  view.pendingOp = {
    type: 'remove_batch',
    removed: [{ index: 1, item: second }, { index: 0, item: first }],
  };
  var harness = createHarness(view, {
    deleteMissingModuleItem: function(id) {
      return id === 2 ? Promise.reject(new Error('failed')) : Promise.resolve({ ok: true });
    },
  });
  await harness.controller.commit();
  assert.strictEqual(view.items.indexOf(second) !== -1, true);
  assert.strictEqual(view.items.indexOf(first), -1);
  assert.strictEqual(view.pendingOp, null);
  assert.deepStrictEqual(harness.statuses[harness.statuses.length - 1], [
    '批量删除部分失败：成功 1 条，失败 1 条',
    'warn',
  ]);
}

async function testRemoveSelectedAndUndo() {
  var first = { id: 1, module_id: 11, title: 'A' };
  var second = { id: 2, module_id: 11, title: 'B' };
  var view = createView([first, second]);
  view.selection = new Set([0, 1]);
  var harness = createHarness(view);
  await harness.controller.removeSelected({});
  assert.strictEqual(view.items.length, 0);
  assert.strictEqual(view.pendingOp.type, 'remove_batch');
  harness.controller.undo();
  assert.deepStrictEqual(view.items, [first, second]);
  assert.strictEqual(view.pendingOp, null);
  assert.strictEqual(harness.unmarked.length, 2);
}

async function run() {
  testInsertAndUndo();
  await testInsertCommit();
  await testBatchRemovePartialCommit();
  await testRemoveSelectedAndUndo();
  console.log('case library missing view pending controller tests passed');
}

run().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
