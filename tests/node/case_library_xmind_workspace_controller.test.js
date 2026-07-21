const assert = require('assert');
const fs = require('fs');
const path = require('path');
const modelOwner = require('../../scripts/modules/caseLibrary/caseLibraryXmindModel.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryXmindWorkspaceController.js');

function createFixture() {
  const elements = {
    xmindStructureDrawerTitle: { textContent: '' },
    xmindStructureDrawerBody: {
      innerHTML: '',
      classList: {
        values: {},
        add: function(name) { this.values[name] = true; },
        remove: function(name) { delete this.values[name]; },
      },
    },
    caseLibraryXmindStructureViewer: { id: 'viewer' },
    caseLibraryWriterXmindStructureViewer: { id: 'writer' },
  };
  const documentRef = {
    title: 'Test',
    documentElement: {},
    getElementById: function(id) { return elements[id] || null; },
  };
  const windowRef = {
    app: {},
    location: { href: 'http://127.0.0.1/case-library.html' },
    listeners: {},
    history: {
      state: {},
      pushState: function(state) { this.state = state; },
      replaceState: function(state) { this.state = state; },
      go: function() {},
    },
    addEventListener: function(type, listener) { this.listeners[type] = listener; },
    removeEventListener: function(type) { delete this.listeners[type]; },
  };
  const storageData = {};
  const storage = {
    getItem: function(key) { return storageData[key] || null; },
    setItem: function(key, value) { storageData[key] = value; },
    removeItem: function(key) { delete storageData[key]; },
  };
  const editor = {
    caseFile: { id: 10, file_name_clean: '登录回归' },
    items: [{
      id: 1,
      module: '登录',
      title: '正常登录',
      priority: 'P1',
      precondition: '已注册',
      steps: '输入密码',
      expected: '成功',
    }],
  };
  const calls = [];
  let drawerOpen = null;
  let drawerClose = null;
  let renderOptions = null;
  let currentMindData = {
    nodeData: { id: 'root', topic: '用例：登录回归' },
  };
  const mindApi = {
    buildMindDataFromCases: function() { return currentMindData; },
    buildMindDataFromPaths: function() { return currentMindData; },
    buildPathsFromCases: function() { return [['登录', '正常登录']]; },
    renderMindMap: function(container, mindData, options) {
      calls.push(['render', container.id, mindData.nodeData.topic]);
      renderOptions = options;
      return {
        getData: function() { return currentMindData; },
      };
    },
    destroyMindMap: function(instance) { calls.push(['destroy', Boolean(instance)]); },
    refreshMindTheme: function() { calls.push(['theme']); },
  };
  function FakeMutationObserver(listener) {
    this.listener = listener;
    this.observe = function() { calls.push(['observe']); };
    this.disconnect = function() { calls.push(['disconnect']); };
  }
  const apiClient = {
    updateCaseItem: function(id, payload) {
      calls.push(['update', id, payload.priority]);
      return Promise.resolve({});
    },
    createCaseItem: function(id) { calls.push(['create', id]); return Promise.resolve({}); },
    deleteCaseItem: function(id) { calls.push(['delete', id]); return Promise.resolve({}); },
    listCaseItems: function(id) {
      calls.push(['list', id]);
      return Promise.resolve(editor.items);
    },
  };
  const model = modelOwner.create({
    normalizePriority: function(value) { return String(value || '').trim().toUpperCase(); },
    cleanFileName: function(value) { return String(value || '').trim().replace(/\.xmind$/i, ''); },
    buildImportItems: function(items) { return items || []; },
  });
  const controller = controllerOwner.create({
    model: model,
    document: documentRef,
    window: windowRef,
    storage: storage,
    MutationObserver: FakeMutationObserver,
    apiClient: apiClient,
    getMindApi: function() { return mindApi; },
    ensureDrawer: function(id, buttons, onOpen, onClose) {
      drawerOpen = onOpen;
      drawerClose = onClose;
      return {
        element: { addEventListener: function() {} },
        open: function() { if (drawerOpen) drawerOpen(); },
        close: function() { if (drawerClose) drawerClose(); },
      };
    },
    getEditor: function() { return editor; },
    getXmindBuilder: function() {
      return function() { return Promise.resolve({ blob: { size: 1 } }); };
    },
    getDownloadBlob: function() {
      return function(name) { calls.push(['download', name]); };
    },
    cleanFileName: function(value) { return String(value || '').trim().replace(/\.xmind$/i, ''); },
    sanitizeDownloadName: function(value, extension) { return value + extension; },
    setEditStatus: function(message, type) { calls.push(['edit-status', message, type]); },
    setMainStatus: function(message, type) { calls.push(['main-status', message, type]); },
    logOperation: function(action) { calls.push(['log', action]); },
    getCurrentUserId: function() { return 9; },
    onEditorItemsReloaded: function(items) { calls.push(['reload', items.length]); },
    onLocateEditorIndex: function(index) { calls.push(['locate', index]); },
    requestWriterPublish: function(items) {
      calls.push(['publish', items.length]);
      return Promise.resolve({ ok: true });
    },
  });
  return {
    controller: controller,
    calls: calls,
    editor: editor,
    elements: elements,
    storageData: storageData,
    setMindData: function(value) { currentMindData = value; },
    getRenderOptions: function() { return renderOptions; },
    closeDrawer: function() { if (drawerClose) drawerClose(); },
  };
}

async function testWriterLifecycle() {
  const fixture = createFixture();
  assert.strictEqual(fixture.controller.openWriter(), true);
  assert.strictEqual(fixture.elements.xmindStructureDrawerTitle.textContent, 'XMind 编写用例');
  assert.strictEqual(fixture.getRenderOptions().editableSessionKey, 'tap-case-library-writer-xmind-edit-9');
  assert.strictEqual(fixture.controller.deriveWriterPublishDefaultFileName([], null), '登录回归');
  await fixture.getRenderOptions().onSaveCases([
    { module: '登录', title: '正常登录', priority: 'P1', steps: '输入', expected: '成功' },
  ], {}, {});
  assert.ok(fixture.calls.some(function(call) { return call[0] === 'publish' && call[1] === 1; }));
  fixture.closeDrawer();
  assert.ok(fixture.calls.some(function(call) { return call[0] === 'destroy'; }));
}

async function testViewerSaveLocateAndExport() {
  const fixture = createFixture();
  assert.strictEqual(fixture.controller.openViewer(), true);
  assert.strictEqual(fixture.controller.locateViewerPath(['登录', '正常登录'], {
    buildPathsFromCases: function() { return [['登录', '正常登录']]; },
  }), 0);
  await fixture.controller.saveViewerCases([{
    module: '登录',
    title: '正常登录',
    priority: 'P2',
    precondition: '已注册',
    steps: '输入密码',
    expected: '成功',
  }], {});
  assert.ok(fixture.calls.some(function(call) { return call[0] === 'update' && call[2] === 'P2'; }));
  assert.ok(fixture.calls.some(function(call) { return call[0] === 'reload'; }));
  assert.strictEqual(await fixture.controller.exportCurrentViewer(), true);
  assert.ok(fixture.calls.some(function(call) { return call[0] === 'download'; }));
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const controllerSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryXmindWorkspaceController.js'),
    'utf8'
  );
  [
    'ensureCaseLibraryXmindDrawer',
    'exportCurrentCaseLibraryXmind',
    'saveCaseLibraryXmindCases',
    'openCaseLibraryXmindStructure',
    'readCaseLibraryWriterMindDataFromInstance',
    'exportCaseLibraryWriterCurrentXmind',
    'openCaseLibraryWriterStructure',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name), -1, name + ' leaked into the coordinator');
  });
  assert.ok(parentSource.indexOf('xmindWorkspaceControllerOwner.create') !== -1);
  assert.strictEqual(controllerSource.indexOf('window.app.state'), -1);
  assert.strictEqual(controllerSource.indexOf('window.app.apiClient'), -1);

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const modelIndex = html.indexOf('caseLibraryXmindModel.js');
    const controllerIndex = html.indexOf('caseLibraryXmindWorkspaceController.js');
    const parentIndex = html.indexOf('scripts/modules/caseLibrary.js');
    assert.ok(modelIndex >= 0 && controllerIndex >= 0 && parentIndex >= 0, entry + ' is missing an XMind owner');
    assert.ok(modelIndex < controllerIndex && controllerIndex < parentIndex, entry + ' has invalid XMind owner order');
  });
}

assert.throws(function() { controllerOwner.create({}); }, /model is required/);
Promise.resolve()
  .then(testWriterLifecycle)
  .then(testViewerSaveLocateAndExport)
  .then(testOwnershipAndEntryOrder)
  .then(function() { console.log('case library XMind workspace controller tests passed'); })
  .catch(function(error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
