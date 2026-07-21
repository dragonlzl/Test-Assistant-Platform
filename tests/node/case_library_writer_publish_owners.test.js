const assert = require('assert');
const fs = require('fs');
const path = require('path');

const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryWriterPublishViewAdapter.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryWriterPublishController.js');

function createElement() {
  const listeners = {};
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    addEventListener: function(name, handler) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(handler);
    },
    listeners: listeners,
  };
}

function buildDom() {
  return {
    writerPublishHint: createElement(),
    writerPublishFileNameInput: createElement(),
    writerPublishFileNameStatus: createElement(),
    writerPublishProjectSelect: createElement(),
    writerPublishVersionSelect: createElement(),
    writerPublishConfirmBtn: createElement(),
    writerPublishStatus: createElement(),
  };
}

function cleanFileName(value) {
  return String(value || '').replace(/\.[^.]+$/, '').trim();
}

function setStatus(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.statusType = type;
}

function createView(dom) {
  return viewOwner.create({
    dom: dom,
    setStatus: setStatus,
    cleanFileName: cleanFileName,
    syncProjectOptions: function(select) {
      select.innerHTML = '<option value="">请选择项目</option><option value="1">项目A</option>';
    },
    syncVersionOptions: function(select) {
      select.innerHTML = '<option value="">请选择版本</option><option value="2">v2</option>';
    },
  });
}

function createHarness(overrides) {
  const custom = overrides || {};
  const dom = buildDom();
  const state = {
    projects: [{ id: 1, name: '项目A' }],
    projectNameById: { 1: '项目A' },
    versionsByProject: { 1: [{ id: 2, name: 'v2' }] },
    versionNameByProject: { 1: { 2: 'v2' } },
    writer: {},
  };
  const view = createView(dom);
  let onOpen = null;
  let onClose = null;
  const drawer = {
    open: function() { if (onOpen) onOpen(); },
    close: function() { if (onClose) onClose(); },
  };
  const apiClient = custom.apiClient || {
    listCaseFiles: function() { return Promise.resolve([]); },
    importCaseFile: function() {
      return Promise.resolve({ id: 9, project_id: 1, version_id: 2, file_name_clean: '登录流程' });
    },
  };
  const reviewController = custom.reviewController || {
    openImportDiffForExternal: function() { return Promise.resolve({ ok: false }); },
  };
  const controller = controllerOwner.create({
    state: state,
    apiClient: apiClient,
    view: view,
    reviewController: reviewController,
    ensureDrawer: function(id, buttons, openHandler, closeHandler) {
      assert.strictEqual(id, 'caseLibraryWriterPublishDrawer');
      onOpen = openHandler;
      onClose = closeHandler;
      return drawer;
    },
    ensureProjectsReady: function() { return Promise.resolve(state.projects); },
    loadVersions: function() { return Promise.resolve(state.versionsByProject[1]); },
    normalizeId: function(value) { return value ? Number(value) : null; },
    cleanFileName: cleanFileName,
    validateItems: function() { return []; },
    sanitizeItems: function(items) { return items; },
    deriveDefaultFileName: function() { return '登录流程'; },
    getPreferredSelection: function() { return { projectId: 1, versionId: 2 }; },
    refreshCaseFiles: custom.refreshCaseFiles || function() { return Promise.resolve(); },
    openImportedCase: custom.openImportedCase || function() { return Promise.resolve(true); },
    onSuccessStatus: custom.onSuccessStatus || function() {},
    utils: custom.utils || {},
  });
  return {
    controller: controller,
    dom: dom,
    state: state,
    drawer: drawer,
  };
}

function flush() {
  return new Promise(function(resolve) { setImmediate(resolve); });
}

function testNormalizationAndView() {
  const normalized = controllerOwner.normalizeFileName('  登录流程.xmind  ', cleanFileName);
  assert.deepStrictEqual(normalized, {
    input: '登录流程.xmind',
    clean: '登录流程',
    fileName: '登录流程.xmind',
  });
  assert.deepStrictEqual(controllerOwner.normalizeFileName('  ', cleanFileName), {
    input: '', clean: '', fileName: '',
  });

  const dom = buildDom();
  const view = createView(dom);
  view.renderHint({ draftItems: [{}, {}], fileNameClean: '支付' });
  assert.ok(dom.writerPublishHint.textContent.indexOf('2 条') !== -1);
  view.syncFileNameStatus({ fileNameInput: '支付', fileNameClean: '支付', projectId: 1, fileNameDuplicate: true });
  assert.ok(dom.writerPublishFileNameStatus.textContent.indexOf('检测到同名用例') !== -1);
  view.syncConfirmEnabled({
    projectId: 1,
    versionId: 2,
    fileNameInput: '支付',
    fileNameClean: '支付',
    fileNameChecking: false,
    publishing: false,
    draftItems: [{}],
  });
  assert.strictEqual(dom.writerPublishConfirmBtn.disabled, false);
}

async function testDuplicateCheckRace() {
  const requests = [];
  const harness = createHarness({
    apiClient: {
      listCaseFiles: function() {
        return new Promise(function(resolve) { requests.push(resolve); });
      },
      importCaseFile: function() { return Promise.resolve(null); },
    },
  });
  harness.state.writer.projectId = 1;
  harness.controller.setFileName('旧名称', { skipCheck: true });
  const first = harness.controller.runDuplicateCheck();
  harness.controller.setFileName('新名称', { skipCheck: true });
  const second = harness.controller.runDuplicateCheck();
  requests[1]([{ id: 22, file_name_clean: '新名称' }]);
  await second;
  requests[0]([{ id: 11, file_name_clean: '旧名称' }]);
  await first;
  assert.strictEqual(harness.state.writer.fileNameClean, '新名称');
  assert.strictEqual(harness.state.writer.duplicateCaseFileId, 22);
}

async function testCloseRejectsPendingSave() {
  const harness = createHarness();
  const pending = harness.controller.requestPublish([{ title: '登录' }], null, null);
  await flush();
  harness.drawer.close();
  await assert.rejects(pending, function(error) {
    return error && error.silent === true && error.message === '已取消入库';
  });
}

async function testNormalImportAndEventDeduplication() {
  let opened = null;
  const harness = createHarness({
    openImportedCase: function(caseFile, projectId, cleanName) {
      opened = { caseFile: caseFile, projectId: projectId, cleanName: cleanName };
      return Promise.resolve(true);
    },
  });
  harness.controller.bindEvents();
  harness.controller.bindEvents();
  assert.strictEqual(harness.dom.writerPublishConfirmBtn.listeners.click.length, 1);
  assert.strictEqual(harness.dom.writerPublishProjectSelect.listeners.change.length, 1);
  assert.strictEqual(harness.dom.writerPublishFileNameInput.listeners.input.length, 1);

  const pending = harness.controller.requestPublish([{
    module: '登录', title: '成功登录', priority: 'P1', precondition: '已注册', steps: '登录', expected: '首页',
  }], null, null);
  await flush();
  assert.strictEqual(harness.dom.writerPublishConfirmBtn.disabled, false);
  assert.strictEqual(await harness.controller.confirm(), true);
  const result = await pending;
  assert.strictEqual(result.overwrite, false);
  await flush();
  assert.strictEqual(opened.projectId, 1);
  assert.strictEqual(opened.cleanName, '登录流程');
}

async function testSameNameOverwrite() {
  const importedPayloads = [];
  const harness = createHarness({
    apiClient: {
      listCaseFiles: function() { return Promise.resolve([]); },
      importCaseFile: function(payload) {
        importedPayloads.push(payload);
        return Promise.reject({
          message: '检测到同名用例',
          payload: { existing_case_file_id: 7 },
        });
      },
    },
    reviewController: {
      openImportDiffForExternal: function(payload) {
        assert.strictEqual(payload.source, 'xmind_writer');
        return Promise.resolve({
          ok: true,
          caseFile: { id: 7, project_id: 1, version_id: 2, file_name_clean: '登录流程' },
        });
      },
    },
  });
  const pending = harness.controller.requestPublish([{
    module: '登录', title: '成功登录', priority: 'P1', precondition: '已注册', steps: '登录', expected: '首页',
  }], null, null);
  await flush();
  assert.strictEqual(await harness.controller.confirm(), true);
  const result = await pending;
  assert.strictEqual(result.overwrite, true);
  assert.strictEqual(importedPayloads.length, 1);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const view = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryWriterPublishViewAdapter.js'),
    'utf8'
  );
  const controller = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryWriterPublishController.js'),
    'utf8'
  );
  assert.ok(parent.indexOf('writerPublishControllerOwner.create') !== -1);
  assert.ok(parent.indexOf('writerPublishController.requestPublish') !== -1);
  assert.ok(parent.indexOf('function confirmCaseLibraryWriterPublish') === -1);
  assert.ok(parent.indexOf('function runCaseLibraryWriterPublishFileNameDuplicateCheck') === -1);
  assert.ok(view.indexOf('apiClient') === -1);
  assert.ok(controller.indexOf('.innerHTML') === -1);
  assert.ok(controller.indexOf('document.') === -1);

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  const scripts = [
    'caseLibraryWriterPublishViewAdapter.js',
    'caseLibraryWriterPublishController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing writer publish owner');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2], entry + ' has invalid writer publish order');
  });
}

(async function run() {
  testNormalizationAndView();
  await testDuplicateCheckRace();
  await testCloseRejectsPendingSave();
  await testNormalImportAndEventDeduplication();
  await testSameNameOverwrite();
  testOwnershipAndEntryOrder();
  console.log('case library writer publish owner tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
