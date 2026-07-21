const assert = require('assert');
const controllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryEditorPendingController.js');

function createElement(tagName) {
  var listeners = Object.create(null);
  return {
    tagName: tagName,
    className: '',
    textContent: '',
    children: [],
    parentNode: null,
    appendChild: function(child) {
      child.parentNode = this;
      this.children.push(child);
    },
    removeChild: function(child) {
      this.children = this.children.filter(function(entry) { return entry !== child; });
      child.parentNode = null;
    },
    addEventListener: function(type, listener) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener);
    },
    dispatch: function(type) {
      (listeners[type] || []).slice().forEach(function(listener) { listener(); });
    },
  };
}

function createDocument() {
  return {
    body: createElement('body'),
    createElement: createElement,
  };
}

function createEditor(items) {
  return {
    caseFile: { id: 101, file_name_clean: '登录用例' },
    items: items || [],
    batchAddCount: 5,
    pageIndex: 0,
    selection: new Set(),
    remarkOpen: new Set(),
    pendingOp: null,
    pendingTimer: null,
    pendingInterval: null,
    pendingToast: null,
    pendingRemaining: 0,
    pendingRender: false,
  };
}

function createHarness(editor, apiOverrides) {
  var documentRef = createDocument();
  var statuses = [];
  var logs = [];
  var intervals = [];
  var renderCount = 0;
  var syncCount = 0;
  var marked = [];
  var unmarked = [];
  var apiClient = Object.assign({
    createCaseItem: function(fileId, payload) {
      return Promise.resolve(Object.assign({ id: 900, case_file_id: fileId }, payload));
    },
    deleteCaseItem: function() { return Promise.resolve({ ok: true }); },
  }, apiOverrides || {});
  var controller = controllerFactory.create({
    apiClient: apiClient,
    document: documentRef,
    getEditor: function() { return editor; },
    setStatus: function(message, type) { statuses.push([message, type]); },
    renderEditor: function() { renderCount += 1; },
    syncBatchDeleteControls: function() { syncCount += 1; },
    syncBatchAddControls: function() { syncCount += 1; },
    markNewAdded: function(fileId, item) { marked.push([fileId, item]); },
    unmarkNewAdded: function(fileId, item) { unmarked.push([fileId, item]); },
    ensureItemKey: function(item, keyName, value) { item[keyName] = value || 'ui-key'; },
    getItemUiKey: function(item) { return item.__uiKey || 'existing-ui-key'; },
    normalizeText: function(value) {
      return value === null || value === undefined ? '' : String(value).trim();
    },
    buildInvisibleMarker: function(seed) { return 'marker:' + seed; },
    syncRowInput: function() {},
    logOperation: function() { logs.push(Array.from(arguments)); },
    isEditing: function() { return false; },
    captureAnchorRect: function() { return { left: 1, top: 2 }; },
    showBlockHint: function() {},
    getPageSize: function() { return 20; },
    persistBatchAddCount: function() {},
    scrollToIndex: function() {},
    openConfirm: function() { return Promise.resolve({ ok: true }); },
    getPreviousDrawer: function() { return null; },
    getBatchAddInput: function() { return null; },
    now: function() { return 1000; },
    random: function() { return 0.5; },
    setTimeout: function(callback) { callback(); return 1; },
    clearTimeout: function() {},
    setInterval: function(callback) { intervals.push(callback); return intervals.length; },
    clearInterval: function() {},
  });
  return {
    controller: controller,
    document: documentRef,
    statuses: statuses,
    logs: logs,
    intervals: intervals,
    marked: marked,
    unmarked: unmarked,
    renderCount: function() { return renderCount; },
    syncCount: function() { return syncCount; },
  };
}

function testInsertUndoLifecycle() {
  var base = { id: 1, module: '登录', priority: 'P0', title: '已有用例' };
  var editor = createEditor([base]);
  var harness = createHarness(editor);
  harness.controller.insertCaseItem(0, {});
  assert.strictEqual(editor.items.length, 2);
  assert.strictEqual(editor.pendingOp.type, 'insert');
  assert.strictEqual(editor.pendingRemaining, 8);
  assert.strictEqual(harness.document.body.children.length, 1);
  assert.ok(harness.document.body.children[0].children[0].textContent.indexOf('8s') !== -1);

  harness.document.body.children[0].children[1].dispatch('click');
  assert.deepStrictEqual(editor.items, [base]);
  assert.strictEqual(editor.pendingOp, null);
  assert.strictEqual(editor.pendingToast, null);
  assert.strictEqual(harness.document.body.children.length, 0);
  assert.deepStrictEqual(harness.statuses[harness.statuses.length - 1], ['已撤回增删操作（未入库）', 'ok']);
  assert.strictEqual(harness.unmarked.length, 0);
}

async function testBatchInsertPartialCommit() {
  var first = {
    __localId: 'local-a',
    __uiKey: 'ui-a',
    module: '模块A',
    title: '用例A',
    expected: '成功',
  };
  var second = {
    __localId: 'local-b',
    __uiKey: 'ui-b',
    module: '模块B',
    title: '用例B',
    expected: '失败',
  };
  var editor = createEditor([first, second]);
  editor.pendingOp = { type: 'insert_batch', itemKeys: ['local-a', 'local-b'] };
  var createCalls = 0;
  var harness = createHarness(editor, {
    createCaseItem: function(fileId, payload) {
      createCalls += 1;
      if (createCalls === 2) return Promise.reject(new Error('second failed'));
      return Promise.resolve(Object.assign({ id: 901, case_file_id: fileId }, payload));
    },
  });
  await harness.controller.commit();
  assert.strictEqual(editor.items[0].id, 901);
  assert.strictEqual(editor.items[0].__uiKey, 'ui-a');
  assert.strictEqual(editor.items[1], second);
  assert.strictEqual(editor.pendingOp, null);
  assert.strictEqual(harness.logs.length, 1);
  assert.strictEqual(harness.logs[0][0], 'batch_create_case_items');
  assert.strictEqual(harness.logs[0][3].success, 1);
  assert.strictEqual(harness.logs[0][3].fail, 1);
  assert.deepStrictEqual(harness.statuses[harness.statuses.length - 1], [
    '批量新增部分失败：成功 1 条，失败 1 条',
    'warn',
  ]);
}

async function testBatchRemovePartialCommit() {
  var first = { id: 1, title: 'A' };
  var second = { id: 2, title: 'B' };
  var remaining = { id: 3, title: 'C' };
  var editor = createEditor([remaining]);
  editor.pendingOp = {
    type: 'remove_batch',
    removed: [{ index: 1, item: second }, { index: 0, item: first }],
  };
  var harness = createHarness(editor, {
    deleteCaseItem: function(id) {
      return id === 2 ? Promise.reject(new Error('delete failed')) : Promise.resolve({ ok: true });
    },
  });
  await harness.controller.commit();
  assert.strictEqual(editor.items.indexOf(second) !== -1, true);
  assert.strictEqual(editor.items.indexOf(first), -1);
  assert.strictEqual(editor.pendingOp, null);
  assert.strictEqual(harness.logs[0][3].success, 1);
  assert.strictEqual(harness.logs[0][3].fail, 1);
  assert.deepStrictEqual(harness.statuses[harness.statuses.length - 1], [
    '批量删除部分失败：成功 1 条，失败 1 条',
    'warn',
  ]);
}

async function testSingleInsertValidationStopsCommit() {
  var local = { __localId: 'local-invalid', module: '', title: '', expected: '' };
  var editor = createEditor([local]);
  editor.pendingOp = { type: 'insert', itemKey: 'local-invalid' };
  var createCalls = 0;
  var harness = createHarness(editor, {
    createCaseItem: function() { createCalls += 1; return Promise.resolve({}); },
  });
  await harness.controller.commit();
  assert.strictEqual(createCalls, 0);
  assert.strictEqual(editor.pendingOp, null);
  assert.deepStrictEqual(harness.statuses[harness.statuses.length - 1], [
    '新增用例未入库：模块不能为空',
    'warn',
  ]);
}

async function run() {
  testInsertUndoLifecycle();
  await testBatchInsertPartialCommit();
  await testBatchRemovePartialCommit();
  await testSingleInsertValidationStopsCommit();
  console.log('case library editor pending controller tests passed');
}

run().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
