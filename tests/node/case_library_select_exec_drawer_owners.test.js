const assert = require('assert');
const fs = require('fs');
const path = require('path');

const viewOwner = require('../../scripts/modules/caseLibrary/caseLibrarySelectExecViewAdapter.js');
const drawerControllerOwner = require('../../scripts/modules/caseLibrary/caseLibrarySelectExecDrawerController.js');
const workflow = require('../../scripts/modules/caseLibrary/caseLibrarySelectExecWorkflow.js');

function createElement() {
  const listeners = Object.create(null);
  return {
    value: '',
    innerHTML: '',
    textContent: '',
    disabled: false,
    clicks: 0,
    addEventListener: function(type, listener) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener);
    },
    dispatch: function(type) {
      (listeners[type] || []).slice().forEach(function(listener) {
        listener({ target: this, currentTarget: this });
      }, this);
    },
    listenerCount: function(type) { return (listeners[type] || []).length; },
    click: function() { this.clicks += 1; },
  };
}

function buildDom() {
  return {
    selectProjectSelect: createElement(),
    selectVersionSelect: createElement(),
    selectSearchInput: createElement(),
    selectConfirmBtn: createElement(),
    selectBatchExecBtn: createElement(),
    selectStatus: createElement(),
    selectOpenButton: createElement(),
  };
}

function createView(dom) {
  return viewOwner.create({
    dom: dom,
    setStatus: function(element, text, type) {
      element.textContent = text;
      element.statusType = type;
    },
    syncProjectOptions: function(select) {
      select.innerHTML = '<option value="">请选择项目</option><option value="7">项目七</option>';
    },
    syncVersionOptions: function(select) {
      select.innerHTML = '<option value="">全部版本</option><option value="70">v70</option>';
    },
  });
}

function testViewContract() {
  const dom = buildDom();
  const view = createView(dom);
  const calls = [];
  view.bindEvents({
    onProjectChange: function() { calls.push('project'); },
    onVersionChange: function() { calls.push('version'); },
    onRefresh: function() { calls.push('refresh'); },
    onBatchExec: function() { calls.push('batch'); },
  });
  view.bindEvents({});
  assert.strictEqual(dom.selectProjectSelect.listenerCount('change'), 1);
  assert.strictEqual(dom.selectVersionSelect.listenerCount('change'), 1);
  assert.strictEqual(dom.selectConfirmBtn.listenerCount('click'), 1);
  assert.strictEqual(dom.selectBatchExecBtn.listenerCount('click'), 1);
  dom.selectProjectSelect.dispatch('change');
  dom.selectVersionSelect.dispatch('change');
  dom.selectConfirmBtn.dispatch('click');
  dom.selectBatchExecBtn.dispatch('click');
  assert.deepStrictEqual(calls, ['project', 'version', 'refresh', 'batch']);

  view.reset();
  assert.strictEqual(dom.selectProjectSelect.value, '');
  assert.strictEqual(dom.selectVersionSelect.disabled, true);
  assert.strictEqual(dom.selectSearchInput.value, '');
  assert.strictEqual(view.renderVersions(7, 70, [{ id: 70 }]), 70);
  assert.strictEqual(dom.selectVersionSelect.value, '70');
  assert.strictEqual(dom.selectVersionSelect.disabled, false);
  assert.strictEqual(view.renderVersions(7, 71, [{ id: 70 }]), null);
  assert.strictEqual(view.clickOpenButton(), true);
  assert.strictEqual(dom.selectOpenButton.clicks, 1);
}

function deferred() {
  let resolve;
  const promise = new Promise(function(done) { resolve = done; });
  return { promise: promise, resolve: resolve };
}

function createHarness() {
  const dom = buildDom();
  const view = createView(dom);
  const state = {
    projects: [{ id: 7, name: '项目七' }],
    projectNameById: { 7: '项目七' },
    versionsByProject: { 7: [{ id: 70, name: 'v70' }] },
    versionNameByProject: { 7: { 70: 'v70' } },
  };
  const files = [
    { id: 701, project_id: 7, version_id: 70, file_name_clean: '登录用例' },
    { id: 702, project_id: 7, version_id: 70, file_name_clean: '支付用例' },
  ];
  let loadSeq = 0;
  let drawerOpen = false;
  let pendingFiles = null;
  let selectedFiles = [];
  let activeViewCount = 0;
  let confirmCount = 0;
  let skipRestoreCount = 0;
  const transfers = [];
  const persists = [];
  const listCalls = [];
  const listState = { projectId: null, versionId: null, searchText: '', files: [], processing: false };
  const listController = {
    reset: function() {
      listState.projectId = null;
      listState.versionId = null;
      listState.searchText = '';
      listState.files = [];
      selectedFiles = [];
      listCalls.push('reset');
    },
    setProject: function(value) {
      listState.projectId = value;
      listState.versionId = null;
      listState.files = [];
      selectedFiles = [];
      listCalls.push(['project', value]);
    },
    setVersion: function(value) {
      listState.versionId = value;
      listCalls.push(['version', value]);
    },
    setSearch: function(value) {
      listState.searchText = value;
      listCalls.push(['search', value]);
    },
    setLoading: function(context) {
      listState.projectId = context.projectId;
      listState.files = [];
      listCalls.push(['loading', context.resetAssociationSwitches === true]);
    },
    setData: function(records, context) {
      listState.projectId = context.projectId;
      listState.files = records.slice();
      listCalls.push(['data', records.length]);
    },
    getState: function() { return Object.assign({}, listState); },
    getSelectedFiles: function() { return selectedFiles.slice(); },
    setProcessing: function(value) {
      listState.processing = value === true;
      listCalls.push(['processing', listState.processing]);
    },
    clearSelection: function() {
      selectedFiles = [];
      listCalls.push('clear-selection');
    },
  };
  const drawer = {
    element: {
      classList: {
        contains: function(name) { return name === 'open' && drawerOpen; },
      },
    },
    open: function() { drawerOpen = true; },
    close: function() { drawerOpen = false; },
  };
  let drawerOnOpen = null;
  const apiClient = {
    listCaseFiles: function() { return pendingFiles ? pendingFiles.promise : Promise.resolve(files.slice()); },
    listExecSetsByCaseFile: function() {
      return Promise.resolve([{ case_file_id: 701, active_users: ['甲'] }]);
    },
    listCaseItems: function(fileId) { return Promise.resolve([{ id: fileId * 10 }]); },
    listExecSets: function() {
      return Promise.resolve([{ case_file_id: 701, version_id: 70, status: 'active' }]);
    },
  };
  const controller = drawerControllerOwner.create({
    state: state,
    apiClient: apiClient,
    model: {
      normalizeExecByFileId: function(execSets) { return { 701: execSets[0] }; },
    },
    workflow: workflow,
    view: view,
    getListController: function() { return listController; },
    normalizeId: function(value) {
      return value === '' || value === null || value === undefined ? null : Number(value);
    },
    ensureProjectsReady: function() { return Promise.resolve(state.projects); },
    loadVersions: function() { return Promise.resolve(state.versionsByProject[7]); },
    persistState: function(value) { persists.push(value || null); },
    readPersistedState: function() { return { user_id: 'user-1', project_id: 7, version_id: 70 }; },
    isAuthReady: function() { return true; },
    getCurrentUserId: function() { return 'user-1'; },
    nextLoadSeq: function() { loadSeq += 1; return loadSeq; },
    isLoadSeqCurrent: function(seq) { return seq === loadSeq; },
    resolveAssociation: function() { return Promise.resolve({ ok: true, association_enabled: true }); },
    transferItems: function(file, fileName, items, options) {
      transfers.push({ file: file, fileName: fileName, items: items, options: options });
      return Promise.resolve({ ok: true });
    },
    openConfirmDrawer: function() {
      confirmCount += 1;
      return Promise.resolve({ ok: true });
    },
    isExecDbEnabled: function() { return true; },
    getVersionDrawer: function() {
      return { open: function() { return Promise.resolve({ ok: true, versionId: 70 }); } };
    },
    ensureDrawer: function(id, openButtons, onOpen) {
      assert.strictEqual(id, 'caseLibrarySelectExecDrawer');
      assert.deepStrictEqual(openButtons, ['openCaseLibrarySelectExecDrawerBtn']);
      drawerOnOpen = onOpen;
      return drawer;
    },
    closeAllDrawers: function() { drawerOpen = false; },
    markSkipRestore: function() { skipRestoreCount += 1; },
    activateExecView: function() { activeViewCount += 1; },
    getVersionName: function() { return 'v70'; },
  });
  return {
    controller: controller,
    dom: dom,
    files: files,
    listState: listState,
    listCalls: listCalls,
    drawer: drawer,
    getDrawerOnOpen: function() { return drawerOnOpen; },
    setSelectedFiles: function(value) { selectedFiles = value.slice(); },
    setPendingFiles: function(value) { pendingFiles = value; },
    transfers: transfers,
    persists: persists,
    getActiveViewCount: function() { return activeViewCount; },
    getConfirmCount: function() { return confirmCount; },
    getSkipRestoreCount: function() { return skipRestoreCount; },
  };
}

async function testDrawerLifecycleAndExecution() {
  const harness = createHarness();
  const controller = harness.controller;
  assert.strictEqual(controller.initDrawer(), harness.drawer);
  assert.strictEqual(typeof harness.getDrawerOnOpen(), 'function');
  assert.strictEqual(await controller.prepare(), true);
  assert.strictEqual(harness.listState.projectId, 7);
  assert.strictEqual(harness.listState.versionId, 70);
  assert.strictEqual(harness.listState.files.length, 2);
  assert.strictEqual(harness.dom.selectProjectSelect.value, '7');
  assert.strictEqual(harness.dom.selectVersionSelect.value, '70');
  assert.ok(harness.persists.length > 0);

  harness.drawer.open();
  assert.strictEqual(await controller.execFile(harness.files[0]), true);
  assert.strictEqual(harness.transfers.length, 1);
  assert.strictEqual(harness.transfers[0].options.execVersionId, 70);
  assert.strictEqual(harness.transfers[0].options.association_enabled, true);
  assert.strictEqual(harness.getSkipRestoreCount(), 1);

  harness.setSelectedFiles(harness.files);
  harness.drawer.open();
  assert.strictEqual(await controller.batchExec(), true);
  assert.strictEqual(harness.transfers.length, 3);
  assert.strictEqual(harness.getConfirmCount(), 1);
  assert.strictEqual(harness.getActiveViewCount(), 1);
  assert.strictEqual(harness.listState.processing, false);
  assert.ok(harness.listCalls.some(function(call) { return call === 'clear-selection'; }));
}

async function testStaleLoadIsIgnored() {
  const harness = createHarness();
  const pending = deferred();
  harness.setPendingFiles(pending);
  harness.dom.selectProjectSelect.value = '7';
  const loading = harness.controller.handleProjectChange();
  harness.controller.reset();
  pending.resolve(harness.files.slice());
  assert.strictEqual(await loading, false);
  assert.strictEqual(harness.listState.projectId, null);
  assert.strictEqual(harness.listState.files.length, 0);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const view = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibrarySelectExecViewAdapter.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibrarySelectExecDrawerController.js'), 'utf8');
  assert.ok(parent.indexOf('selectExecDrawerControllerOwner.create') !== -1);
  assert.ok(parent.indexOf('function resetSelectDrawer') === -1);
  assert.ok(parent.indexOf('function handleSelectProjectChange') === -1);
  assert.ok(parent.indexOf('function batchExecSelectedCaseFilesFromSelectDrawer') === -1);
  assert.ok(parent.indexOf('function execCaseFileFromDrawer') === -1);
  assert.ok(view.indexOf('apiClient') === -1);
  assert.ok(view.indexOf('document.') === -1);
  assert.ok(controller.indexOf('.innerHTML') === -1);
  assert.ok(controller.indexOf('document.') === -1);
  assert.ok(parent.split('\n').length < 9600, 'caseLibrary.js should keep shrinking');

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  const scripts = [
    'caseLibrarySelectExecController.js',
    'caseLibrarySelectExecViewAdapter.js',
    'caseLibrarySelectExecDrawerController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing a select exec owner');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2] && indexes[2] < indexes[3], entry + ' has invalid owner order');
  });
}

async function run() {
  testViewContract();
  await testDrawerLifecycleAndExecution();
  await testStaleLoadIsIgnored();
  testOwnershipAndEntryOrder();
  console.log('case library select exec drawer owner tests passed');
}

run().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
