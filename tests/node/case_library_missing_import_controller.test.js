const assert = require('assert');

const modelOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingImportModel.js');
const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingImportViewAdapter.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingImportController.js');

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

function buildKey(item) {
  return [item && item.module, item && item.title, item && item.expected]
    .map(function(value) { return String(value || '').trim().toLowerCase(); })
    .join('|');
}

function createModel() {
  return modelOwner.create({
    normalizePriorityInput: function(value) { return String(value || '').trim().toUpperCase(); },
    normalizeDiffText: function(value) { return String(value || '').trim(); },
    buildCaseItemKey: buildKey,
    dedupeCaseItemsByKey: function(items) {
      const seen = {};
      return (items || []).filter(function(item) {
        const key = buildKey(item);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    },
  });
}

function testViewContract() {
  const dom = {
    missingImportConfirmBtn: createElement(),
    missingImportFileHint: createElement(),
    missingImportProjectSelect: createElement(),
    missingImportDropZone: createElement(),
    missingImportInput: createElement(),
    missingImportStatus: createElement(),
    missingImportDiffStatus: createElement(),
    missingImportDiffMeta: createElement(),
    missingImportStructureWrap: createElement(),
    missingImportStructureBody: createElement(),
    missingImportDiffBody: createElement(),
    missingImportDiffConfirmBtn: createElement(),
  };
  const statuses = [];
  const view = viewOwner.create({
    dom: dom,
    escapeHtml: function(value) {
      return String(value || '').replace(/</g, '&lt;');
    },
    setStatus: function(element, text, type) {
      if (element) element.textContent = text;
      statuses.push({ text: text, type: type });
    },
    formatStructuralDetail: function() { return '结构详情'; },
    countPendingItems: function(entries) {
      return (entries || []).reduce(function(total, entry) {
        return total + (entry && entry.items ? entry.items.length : 0);
      }, 0);
    },
  });

  const importState = {
    projectId: 7,
    files: [{ name: 'one.xlsx' }, { name: 'two.xmind' }, { name: 'three.xlsx' }],
    items: [{ title: 'A' }],
    structuralErrors: [],
    invalid: [],
    loading: false,
    pending: false,
  };
  view.renderFileHint(importState);
  view.syncConfirmEnabled(importState);
  assert.ok(dom.missingImportFileHint.textContent.indexOf('已选择 3 个') !== -1);
  assert.strictEqual(Boolean(dom.missingImportConfirmBtn.disabled), false);
  view.setProjectValue(9);
  assert.strictEqual(view.getProjectValue(), '9');

  view.renderDiffSummary({
    rows: [{ type: 'added', left: { module: '<登录>', title: '密码错误', expected: '提示失败' } }],
    structuralErrors: [{ line: 2, depth: 2 }],
    pendingItemsByModule: [{ items: [{ title: '密码错误' }] }],
  }, {
    newCount: 1,
    duplicateCount: 2,
    overlapModules: 1,
    importCount: 3,
  });
  assert.ok(dom.missingImportDiffBody.innerHTML.indexOf('&lt;登录>') !== -1);
  assert.ok(dom.missingImportStructureBody.innerHTML.indexOf('结构详情') !== -1);
  assert.strictEqual(dom.missingImportDiffConfirmBtn.disabled, false);
  assert.ok(statuses.some(function(entry) { return entry.text.indexOf('重复跳过 2 条') !== -1; }));
}

async function testControllerLifecycle() {
  const dom = {
    missingImportInput: createElement(),
    missingImportDropZone: createElement(),
    missingImportProjectSelect: createElement(),
    missingImportConfirmBtn: createElement(),
    missingImportDiffConfirmBtn: createElement(),
  };
  const state = {
    missingImport: {
      projectId: 7,
      files: [],
      items: [],
      structuralErrors: [],
      loading: false,
      pending: false,
      invalid: [],
    },
    missingImportDiff: {
      projectId: null,
      rows: [],
      newItems: [],
      duplicateCount: 0,
      pendingItemsByModule: [],
      structuralErrors: [],
    },
    missingDrawer: { projectId: 7 },
  };
  const model = createModel();
  const statusLog = [];
  const view = {
    syncConfirmEnabled: function() {},
    renderFileHint: function() {},
    setImportStatus: function(text, type) { statusLog.push({ text: text, type: type }); },
    getProjectValue: function() { return dom.missingImportProjectSelect.value; },
    setProjectValue: function(value) { dom.missingImportProjectSelect.value = value ? String(value) : ''; },
    setDropZoneActive: function() {},
    clearFileInput: function() {},
    renderDiffSummary: function() {},
    clearDiff: function() {},
  };
  const importedDuplicate = { module: '登录', title: '密码错误', expected: '提示失败' };
  const importedNew = { module: '支付', title: '支付成功', expected: '进入结果页' };
  const createdModules = [];
  const createdItems = [];
  let drawerOpenCount = 0;
  let drawerCloseCount = 0;
  let reloadCount = 0;
  let projectChangeCount = 0;
  const controller = controllerOwner.create({
    state: state,
    dom: dom,
    model: model,
    fileParser: {
      parse: function() {
        return Promise.resolve({ items: [importedDuplicate, importedNew], structuralErrors: [] });
      },
    },
    view: view,
    normalizeId: function(value) { return value ? Number(value) : null; },
    buildCaseItemKey: buildKey,
    buildImportDiffRows: function(left, right) {
      return left.concat(right).map(function(item) { return { type: 'added', left: item }; });
    },
    ensureDrawer: function() {
      return {
        open: function() { drawerOpenCount += 1; },
        close: function() { drawerCloseCount += 1; },
      };
    },
    syncProjectOptions: function() {},
    onProjectChange: function() { projectChangeCount += 1; },
    reloadModules: function() { reloadCount += 1; },
    apiClient: {
      listMissingModules: function() {
        return Promise.resolve([{ id: 11, name: '登录' }]);
      },
      listMissingModuleItems: function() {
        return Promise.resolve([importedDuplicate]);
      },
      createMissingModule: function(payload) {
        createdModules.push(payload);
        return Promise.resolve({ id: 22, name: payload.name });
      },
      createMissingModuleItem: function(moduleId, payload) {
        createdItems.push({ moduleId: moduleId, payload: payload });
        return Promise.resolve({ id: createdItems.length });
      },
    },
  });

  await controller.handleFiles([{ name: 'cases.xlsx' }]);
  assert.strictEqual(state.missingImport.items.length, 2);
  assert.ok(statusLog.some(function(entry) { return entry.text === '已识别 2 条漏测用例'; }));

  await controller.confirm();
  assert.strictEqual(drawerOpenCount, 1);
  assert.strictEqual(state.missingImportDiff.duplicateCount, 1);
  assert.strictEqual(model.countPendingItems(state.missingImportDiff.pendingItemsByModule), 1);

  const merged = await controller.executeMerge(state.missingImportDiff);
  assert.strictEqual(merged, true);
  assert.deepStrictEqual(createdModules, [{ project_id: 7, name: '支付' }]);
  assert.strictEqual(createdItems.length, 1);
  assert.strictEqual(createdItems[0].moduleId, 22);
  assert.strictEqual(reloadCount, 1);
  assert.ok(statusLog.some(function(entry) { return entry.text.indexOf('重复跳过 1 条') !== -1; }));

  dom.missingImportProjectSelect.value = '8';
  controller.handleProjectChange();
  assert.strictEqual(controller.getProjectId(), 8);
  assert.strictEqual(projectChangeCount, 1);

  controller.bindEvents();
  controller.bindEvents();
  assert.strictEqual(dom.missingImportInput.listeners.change.length, 1);
  assert.strictEqual(dom.missingImportDropZone.listeners.dragover.length, 1);
  assert.strictEqual(dom.missingImportProjectSelect.listeners.change.length, 1);
  assert.strictEqual(dom.missingImportConfirmBtn.listeners.click.length, 1);
  assert.strictEqual(dom.missingImportDiffConfirmBtn.listeners.click.length, 1);
  await dom.missingImportDiffConfirmBtn.listeners.click[0]();
  await Promise.resolve();
  assert.ok(drawerCloseCount >= 0);
}

(async function run() {
  testViewContract();
  await testControllerLifecycle();
  console.log('case library missing import controller tests passed');
})().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
