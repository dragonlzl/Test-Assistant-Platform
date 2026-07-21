const assert = require('assert');
const fs = require('fs');
const path = require('path');

const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryImportReviewViewAdapter.js');
const reviewOwner = require('../../scripts/modules/caseLibrary/caseLibraryImportReviewController.js');
const workflowOwner = require('../../scripts/modules/caseLibrary/caseLibraryImportWorkflowController.js');

function createClassList() {
  const values = new Set();
  return {
    add: function(value) { values.add(value); },
    remove: function(value) { values.delete(value); },
    contains: function(value) { return values.has(value); },
    toggle: function(value, enabled) {
      if (enabled) values.add(value);
      else values.delete(value);
    },
  };
}

function createElement() {
  const listeners = {};
  return {
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    classList: createClassList(),
    addEventListener: function(name, handler) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(handler);
    },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    listeners: listeners,
  };
}

function buildDom() {
  return {
    importDiffTableHost: createElement(),
    importDiffLocateBar: createElement(),
    importDiffTitle: createElement(),
    importDiffStatus: createElement(),
    importDiffMeta: createElement(),
    importDiffOverwriteBtn: createElement(),
    importInvalidTitle: createElement(),
    importInvalidStatus: createElement(),
    importInvalidLocateBar: createElement(),
    importInvalidBody: createElement(),
    importInvalidConfirmBtn: createElement(),
    importDuplicateTitle: createElement(),
    importDuplicateStatus: createElement(),
    importDuplicateBody: createElement(),
    importDuplicateConfirmBtn: createElement(),
    importStatus: createElement(),
    status: createElement(),
    importInput: createElement(),
  };
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value).replace(/</g, '&lt;');
}

function setStatus(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.statusType = type;
}

function buildKey(item) {
  return [item && item.module, item && item.title, item && item.precondition, item && item.steps, item && item.expected]
    .map(function(value) { return String(value || '').trim().toLowerCase(); })
    .join('|');
}

function testViewContract() {
  const dom = buildDom();
  const view = viewOwner.create({
    dom: dom,
    escapeHtml: escapeHtml,
    setStatus: setStatus,
    normalizePriority: function(value) { return String(value || '').trim().toUpperCase(); },
  });
  view.renderDuplicate({
    fileName: 'login.json',
    total: 2,
    uniqueCount: 1,
    duplicateCount: 1,
    rows: [
      { line: 1, keep: true, item: { module: '<登录>', title: '成功', expected: '进入首页' } },
      { line: 2, keep: false, item: { module: '<登录>', title: '成功', expected: '进入首页' } },
    ],
  }, function(name) { return name.replace('.json', ''); });
  assert.ok(dom.importDuplicateTitle.textContent.indexOf('login') !== -1);
  assert.ok(dom.importDuplicateBody.innerHTML.indexOf('&lt;登录>') !== -1);
  assert.ok(dom.importDuplicateBody.innerHTML.indexOf('移除') !== -1);

  const diffState = {
    mode: 'import',
    projectId: 1,
    importVersionId: 2,
    fileName: 'login.json',
    cleanName: 'login',
    importItems: [{ title: 'new' }],
    dbItems: [{ title: 'old' }],
    loading: false,
    confirming: false,
  };
  view.renderDiff(diffState, {
    projectName: '项目A',
    importVersionName: 'v2',
    dbVersionName: 'v1',
    leftCount: 1,
    rightCount: 1,
    counts: { added: 1, changed: 1, removed: 0 },
  });
  assert.ok(dom.importDiffMeta.textContent.indexOf('新增 1') !== -1);
  assert.strictEqual(dom.importDiffOverwriteBtn.disabled, false);
}

async function testReviewLifecycle() {
  const originalDocument = global.document;
  const dom = buildDom();
  const drawerElements = {
    caseLibraryImportDiffDrawer: createElement(),
    caseLibraryImportInvalidDrawer: createElement(),
    caseLibraryImportDuplicateDrawer: createElement(),
  };
  global.document = {
    getElementById: function(id) { return drawerElements[id] || null; },
  };
  const drawerById = {};
  const ensureDrawer = function(id, openButtons, onOpen, onClose) {
    const element = drawerElements[id] || createElement();
    const drawer = {
      element: element,
      open: function() { element.classList.add('open'); if (onOpen) onOpen(); },
      close: function() { element.classList.remove('open'); if (onClose) onClose(); },
    };
    drawerById[id] = drawer;
    return drawer;
  };
  const state = {
    projectNameById: { 1: '项目A' },
    importDrawer: { files: [], projectId: 1, versionId: 2, loading: false },
  };
  const imported = [];
  const apiClient = {
    listCaseItems: function() { return Promise.resolve([{ module: '登录', title: '旧用例' }]); },
    listCaseFiles: function() { return Promise.resolve([]); },
    importCaseFile: function(payload, options) {
      imported.push({ payload: payload, options: options });
      return Promise.resolve({ id: 99, file_name_clean: 'login' });
    },
    appendCaseItems: function() { return Promise.resolve({ appended: 1, overwritten: 1 }); },
  };
  const view = viewOwner.create({
    dom: dom,
    escapeHtml: escapeHtml,
    setStatus: setStatus,
    normalizePriority: function(value) { return String(value || '').trim().toUpperCase(); },
  });
  const review = reviewOwner.create({
    state: state,
    dom: dom,
    apiClient: apiClient,
    view: view,
    diffControllerOwner: {
      create: function() {
        return {
          setLoading: function() {},
          setData: function() {},
          getCounts: function() { return { added: 1, changed: 1, removed: 0 }; },
        };
      },
    },
    ensureDrawer: ensureDrawer,
    openConfirmDrawer: function() { return Promise.resolve({ ok: true }); },
    setStatus: setStatus,
    cleanFileName: function(value) { return String(value || '').replace(/\.[^.]+$/, ''); },
    extFromFileName: function() { return 'json'; },
    validateItems: function() { return []; },
    sanitizeItems: function(items) { return items; },
    buildItemKey: buildKey,
    dedupeItems: function(items) { return items; },
    countUniqueItems: function(items) { return items.length; },
    loadVersions: function() { return Promise.resolve([]); },
    getProjectName: function() { return '项目A'; },
    getVersionName: function(projectId, versionId) { return 'v' + versionId; },
    refreshCaseFiles: function() { return Promise.resolve(); },
  });
  review.initDrawers();
  review.bindEvents();
  review.bindEvents();
  assert.strictEqual(dom.importDiffOverwriteBtn.listeners.click.length, 1);

  const duplicate = review.buildDuplicateGroups([
    { _sourceLine: 1, module: '登录', title: '成功', expected: '首页' },
    { _sourceLine: 2, module: '登录', title: '成功', expected: '首页' },
  ]);
  assert.strictEqual(duplicate.duplicateCount, 1);
  const duplicatePromise = review.confirmDuplicates({
    fileName: 'login.json', total: 2, uniqueCount: 1, duplicateCount: 1, rows: duplicate.rows,
  });
  dom.importDuplicateConfirmBtn.listeners.click[0]();
  assert.strictEqual(await duplicatePromise, true);

  const externalPromise = review.openImportDiffForExternal({
    projectId: 1,
    versionId: 2,
    fileName: 'login.json',
    items: [{ module: '登录', title: '新用例' }],
    error: { payload: { existing_case_file_id: 8, existing_file_name_clean: 'login', existing_version_id: 1 } },
  });
  await Promise.resolve();
  await Promise.resolve();
  await review.confirmOverwrite();
  const result = await externalPromise;
  assert.strictEqual(result.ok, true);
  assert.strictEqual(imported.length, 1);
  assert.strictEqual(imported[0].options.overwrite, true);

  global.document = originalDocument;
}

function testWorkflowSummary() {
  const workflow = workflowOwner.create({
    state: {},
    dom: {},
    apiClient: {},
    reviewController: {},
  });
  const message = workflow.buildFinalMessage(
    ['新增A'],
    ['覆盖B'],
    [{ name: '跳过C', reason: '冲突' }],
    [{ name: '失败D', reason: '解析失败' }]
  );
  assert.ok(message.indexOf('成功 2 份') !== -1);
  assert.ok(message.indexOf('跳过 - 跳过C：冲突') !== -1);
  assert.ok(message.indexOf('失败 - 失败D：解析失败') !== -1);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const viewSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryImportReviewViewAdapter.js'), 'utf8');
  const workflowSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryImportWorkflowController.js'), 'utf8');
  assert.ok(parentSource.indexOf('importReviewControllerOwner.create') !== -1);
  assert.ok(parentSource.indexOf('importWorkflowControllerOwner.create') !== -1);
  assert.ok(parentSource.indexOf('function renderImportInvalidTable') === -1);
  assert.ok(parentSource.indexOf('function confirmOverwriteImportFromDiff') === -1);
  assert.ok(parentSource.indexOf('function openImportDiffForQueueTask') === -1);
  assert.ok(viewSource.indexOf('apiClient') === -1);
  assert.ok(workflowSource.indexOf('.innerHTML') === -1);

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  const scripts = [
    'caseLibraryImportReviewViewAdapter.js',
    'caseLibraryImportReviewController.js',
    'caseLibraryImportWorkflowController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing import review owner');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2] && indexes[2] < indexes[3]);
  });
}

(async function run() {
  testViewContract();
  await testReviewLifecycle();
  testWorkflowSummary();
  testOwnershipAndEntryOrder();
  console.log('case library import review owner tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
