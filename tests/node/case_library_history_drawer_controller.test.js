const assert = require('assert');
const fs = require('fs');
const path = require('path');
const owner = require('../../scripts/modules/caseLibrary/caseLibraryHistoryDrawerController.js');

function createStorage() {
  var values = Object.create(null);
  return {
    getItem: function(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    setItem: function(key, value) { values[key] = String(value); },
    removeItem: function(key) { delete values[key]; },
  };
}

function testEarlyBridgeBeforeControllerCreation() {
  var buttonListeners = {};
  var drawerClasses = Object.create(null);
  var button = {
    addEventListener: function(type, listener) { buttonListeners[type] = listener; },
  };
  var drawer = {
    classList: {
      add: function(name) { drawerClasses[name] = true; },
      remove: function(name) { delete drawerClasses[name]; },
    },
  };
  var root = {
    app: {},
    document: {
      getElementById: function(id) {
        if (id === 'openCaseLibraryHistoryDrawerBtn') return button;
        if (id === 'caseLibraryHistoryDrawer') return drawer;
        return null;
      },
    },
  };
  assert.strictEqual(owner.attachEarlyBridge(root), true);
  assert.strictEqual(owner.attachEarlyBridge(root), false);
  var stopped = false;
  buttonListeners.click({ stopImmediatePropagation: function() { stopped = true; } });
  assert.strictEqual(stopped, true);
  assert.strictEqual(root.app.__caseLibraryHistoryDrawerEarlyOpen, true);
  assert.strictEqual(drawerClasses.open, true);
}

function createElement(value) {
  var listeners = Object.create(null);
  var classes = Object.create(null);
  classes.hidden = true;
  return {
    value: value || '',
    disabled: false,
    hidden: true,
    innerHTML: '',
    textContent: '',
    listeners: listeners,
    addEventListener: function(type, listener) { listeners[type] = listener; },
    dispatch: function(type) { return listeners[type] ? listeners[type]({ target: this }) : undefined; },
    classList: {
      add: function(name) { classes[name] = true; },
      remove: function(name) { delete classes[name]; },
      contains: function(name) { return classes[name] === true; },
    },
    scrollIntoView: function() {},
  };
}

function createControllerOwner(kind, record) {
  return {
    create: function(options) {
      record.options = options;
      var state = kind === 'query'
        ? { searchText: '', pageIndex: 0, pageSize: options.pageSize }
        : { filter: '', pageIndex: 0, pageSize: options.pageSize };
      var rows = [];
      return {
        reset: function(context) {
          rows = [];
          state.pageIndex = 0;
          if (kind === 'query') state.searchText = context && context.searchText ? context.searchText : '';
          if (options.onStateChange) options.onStateChange();
        },
        setLoading: function(context) {
          rows = [];
          if (context && Object.prototype.hasOwnProperty.call(context, 'filter')) state.filter = context.filter;
          if (context && Object.prototype.hasOwnProperty.call(context, 'pageIndex')) state.pageIndex = context.pageIndex;
          if (options.onStateChange) options.onStateChange();
        },
        setData: function(nextRows, context) {
          rows = Array.isArray(nextRows) ? nextRows.slice() : [];
          if (context && Object.prototype.hasOwnProperty.call(context, 'filter')) state.filter = context.filter;
          if (context && Object.prototype.hasOwnProperty.call(context, 'pageIndex')) state.pageIndex = context.pageIndex;
          if (options.onStateChange) options.onStateChange();
        },
        setSearch: function(value) {
          state.searchText = String(value || '');
          state.pageIndex = 0;
          if (options.onStateChange) options.onStateChange();
        },
        setPageIndex: function(value) {
          state.pageIndex = Number(value) || 0;
          if (options.onStateChange) options.onStateChange();
        },
        setPageSize: function(value) { state.pageSize = value; },
        getState: function() { return Object.assign({}, state); },
        getRows: function() { return rows.slice(); },
      };
    },
  };
}

function createHarness(storage) {
  var queryRecord = {};
  var detailRecord = {};
  var requests = { query: [], detail: [] };
  var statuses = [];
  var hidden = [];
  var drawer = { closeCount: 0, close: function() { this.closeCount += 1; } };
  var state = {
    projects: [{ id: 1 }],
    projectNameById: { 1: 'Project One' },
    historyQueryDrawer: { projectId: null, versionId: null },
    historyDetail: { projectId: null, fileNameClean: '', isDeleted: false, versionId: null, restoring: false },
  };
  var dom = {
    historyDrawerProjectSelect: createElement(),
    historyDrawerVersionSelect: createElement(),
    historyDrawerSearchInput: createElement(),
    historyDrawerQueryBtn: createElement(),
    historyDrawerClearBtn: createElement(),
    historyDrawerStatus: createElement(),
    historyDrawerTableHost: createElement(),
    historyDrawerPaginationTop: createElement(),
    historyDrawerPaginationBottom: createElement(),
    historyDetailCard: createElement(),
    historyStatus: createElement(),
    historyCaseName: createElement(),
    historyRefreshBtn: createElement(),
    historyHideBtn: createElement(),
    historyAppendPill: createElement(),
    historyAddedPill: createElement(),
    historyUpdatedPill: createElement(),
    historyDeletedPill: createElement(),
    historyImportPill: createElement(),
    historyReimportPill: createElement(),
    historyFileDeletedPill: createElement(),
    historyPaginationTop: createElement(),
    historyPaginationBottom: createElement(),
    historyTableHost: createElement(),
  };
  var controller = owner.create({
    state: state,
    dom: dom,
    storage: storage || createStorage(),
    apiClient: {
      listCaseLibraryChangeFiles: function(query) {
        requests.query.push(query);
        return Promise.resolve([{ project_id: 1, file_name_clean: 'Alpha' }]);
      },
      getCaseLibraryChangeHistory: function(projectId, fileName, query) {
        requests.detail.push([projectId, fileName, query]);
        return Promise.resolve({ history: [{ id: 11, kind: 'updated' }], version_id: 3, is_deleted: false });
      },
    },
    queryControllerOwner: createControllerOwner('query', queryRecord),
    detailControllerOwner: createControllerOwner('detail', detailRecord),
    normalizeId: function(value) {
      if (value === '' || value === null || value === undefined) return null;
      return Number(value);
    },
    getPageSize: function() { return 20; },
    formatTime: function(value) { return 'T:' + value; },
    getVersionName: function(projectId, versionId) { return 'V' + versionId; },
    getProjectName: function(projectId) { return state.projectNameById[projectId] || 'P' + projectId; },
    setStatus: function(element, text, type) { statuses.push([element, text, type]); },
    syncProjectOptions: function() {},
    syncVersionOptionsWithAll: function(element) { element.innerHTML = '<option value="0">all</option>'; },
    loadVersions: function() { return Promise.resolve([{ id: 3 }]); },
    ensureProjectsReady: function() { return Promise.resolve(state.projects); },
    ensureDrawer: function(drawerId, buttons, onOpen) {
      drawer.drawerId = drawerId;
      drawer.buttons = buttons;
      drawer.onOpen = onOpen;
      return drawer;
    },
    getCurrentUserId: function() { return 7; },
    getCurrentLoginSeq: function() { return 'login-1'; },
    isAuthReady: function() { return true; },
    getProjects: function() { return state.projects; },
    persistLastView: function(view) { state.lastView = view; },
    hideEditorCard: function() { hidden.push('editor'); },
    hideMissingCard: function() { hidden.push('missing'); },
    hasEditorSelection: function() { return true; },
  });
  return {
    controller: controller,
    state: state,
    dom: dom,
    drawer: drawer,
    requests: requests,
    statuses: statuses,
    hidden: hidden,
    storage: storage,
    queryRecord: queryRecord,
    detailRecord: detailRecord,
  };
}

async function testQueryAndDetailWorkflow() {
  var storage = createStorage();
  var harness = createHarness(storage);
  harness.controller.bindEvents();
  harness.controller.bindEvents();
  harness.controller.initDrawer();
  assert.strictEqual(harness.drawer.drawerId, 'caseLibraryHistoryDrawer');
  assert.strictEqual(await harness.drawer.onOpen(), false);

  harness.dom.historyDrawerProjectSelect.value = '1';
  await harness.dom.historyDrawerProjectSelect.dispatch('change');
  assert.strictEqual(harness.state.historyQueryDrawer.projectId, 1);
  assert.strictEqual(harness.state.historyQueryDrawer.versionId, 0);
  assert.strictEqual(harness.dom.historyDrawerVersionSelect.disabled, false);

  var records = await harness.controller.loadQueryFiles();
  assert.strictEqual(records.length, 1);
  assert.deepStrictEqual(harness.requests.query[0], { project_id: 1, version_id: 0, limit: 500 });

  harness.state.historyDetail.projectId = '1';
  harness.state.historyDetail.fileNameClean = 'Alpha';
  harness.state.historyDetail.versionId = 3;
  harness.controller.setDetailVisible(true);
  var detail = await harness.controller.loadEntries(1, 'Alpha', { filter: 'updated', pageIndex: 2 });
  assert.strictEqual(detail.history.length, 1);
  assert.deepStrictEqual(harness.requests.detail[0], [
    '1',
    'Alpha',
    { limit: 800, version_id: 3 },
  ]);
  assert.deepStrictEqual(harness.hidden, ['editor', 'missing']);
  assert.strictEqual(harness.dom.historyCaseName.textContent, 'Project One / V3 / Alpha');
  assert.strictEqual(harness.controller.readDetailPersistedState().filter, 'updated');

  harness.controller.setPageSize(50);
  assert.strictEqual(harness.queryRecord.options.pageSize, 20);
  assert.strictEqual(harness.controller.ensureQueryController().getState().pageSize, 50);
  assert.strictEqual(harness.controller.ensureDetailController().getState().pageSize, 50);
}

async function testDetailRestoreAndHide() {
  var storage = createStorage();
  var first = createHarness(storage);
  first.state.historyDetail.projectId = '1';
  first.state.historyDetail.fileNameClean = 'Restored';
  first.state.historyDetail.versionId = 3;
  first.controller.ensureDetailController().setData([], { filter: 'deleted', pageIndex: 4 });
  first.controller.persistDetailSelection();

  var restored = createHarness(storage);
  assert.strictEqual(await restored.controller.restoreDetail(), true);
  assert.strictEqual(restored.state.historyDetail.fileNameClean, 'Restored');
  assert.strictEqual(restored.state.historyDetail.restoring, false);
  assert.strictEqual(restored.controller.ensureDetailController().getState().filter, 'deleted');
  assert.strictEqual(restored.controller.ensureDetailController().getState().pageIndex, 4);

  restored.controller.hideDetail();
  assert.strictEqual(restored.controller.isDetailVisible(), false);
  assert.strictEqual(restored.controller.readDetailPersistedState(), null);
  assert.strictEqual(restored.state.lastView, 'editor');
}

function testOwnershipAndEntryOrder() {
  var root = path.resolve(__dirname, '../..');
  var parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  assert.ok(parent.indexOf('historyDrawerControllerOwner.create') !== -1);
  assert.ok(parent.indexOf('function loadHistoryQueryDrawerFiles') === -1);
  assert.ok(parent.indexOf('function loadCaseLibraryHistoryEntries') === -1);
  assert.ok(parent.indexOf('function restoreHistoryDetailFromPersistedState') === -1);
  assert.ok(parent.split('\n').length < 8700, 'caseLibrary.js should keep shrinking');

  var entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  var scripts = [
    'caseLibraryHistoryQueryController.js',
    'caseLibraryHistoryDetailController.js',
    'caseLibraryHistoryDrawerController.js',
    'scripts/modules/caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    var html = fs.readFileSync(path.join(root, entry), 'utf8');
    var indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing a history owner');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2] && indexes[2] < indexes[3]);
  });
}

(async function run() {
  testEarlyBridgeBeforeControllerCreation();
  await testQueryAndDetailWorkflow();
  await testDetailRestoreAndHide();
  testOwnershipAndEntryOrder();
  console.log('case library history drawer controller tests passed');
})().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
