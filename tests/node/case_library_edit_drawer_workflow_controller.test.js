'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(
  projectRoot,
  'scripts/modules/caseLibrary/caseLibraryEditDrawerWorkflowController.js'
));

function createElement(value) {
  return {
    value: value || '',
    disabled: false,
    innerHTML: '',
  };
}

function verifyFilterAndShareFlow() {
  var state = {
    editDrawer: {
      files: [{ id: 7, file_name_clean: '登录用例', item_count: 2 }],
      execByFileId: {},
      loading: false,
      selection: new Set([7]),
    },
  };
  var dom = {
    editDrawerVersionSelect: createElement('3'),
    editDrawerOwnerFilterSelect: createElement('mine'),
    editDrawerFileSearchInput: createElement('登录'),
    editDrawerStatus: createElement(),
  };
  var calls = [];
  var listController = {
    setVersion: function(value) { calls.push(['version', value]); },
    setOwnerFilter: function(value, touched) { calls.push(['owner', value, touched]); },
    setSearch: function(value) { calls.push(['search', value]); },
    getVisibleFiles: function() { return state.editDrawer.files; },
    getSelectedFiles: function() { return state.editDrawer.files; },
  };
  var shared = [];
  var instance = owner.create({
    state: state,
    dom: dom,
    getListController: function() { return listController; },
    normalizeId: function(value) { return value ? Number(value) : null; },
    setStatus: function(element, message, type) { calls.push(['status', message, type]); },
    persistState: function(payload) { calls.push(['persist', payload]); },
    isDrawerOpen: function() { return true; },
    getShareController: function() {
      return { open: function(files, options) { shared.push([files, options]); return true; } };
    },
    getDrawer: function() { return { id: 'edit-drawer' }; },
    logOperation: function(action) { calls.push(['log', action]); },
  });

  instance.handleVersionChange();
  instance.handleOwnerFilterChange();
  instance.handleFileSearchInput();
  instance.openShareFromSelection();

  assert.deepStrictEqual(calls[0], ['version', 3]);
  assert.ok(calls.some(function(call) { return call[0] === 'owner' && call[1] === 'mine'; }));
  assert.ok(calls.some(function(call) { return call[0] === 'search' && call[1] === '登录'; }));
  assert.strictEqual(shared.length, 1);
  assert.strictEqual(shared[0][0][0].id, 7);
  assert.strictEqual(shared[0][1].previousDrawer.id, 'edit-drawer');
}

function verifyLoadFlow() {
  var state = {
    projectNameById: { 2: '项目A' },
    versionNameByProject: {},
    editDrawer: {
      projectId: 2,
      versionId: 4,
      files: [],
      execByFileId: {},
      loading: false,
      selection: new Set(),
    },
  };
  var dom = {
    editDrawerProjectSelect: createElement('2'),
    editDrawerVersionSelect: createElement('4'),
    editDrawerStatus: createElement(),
  };
  var listController = {
    getState: function() { return { projectId: 2, versionId: 4 }; },
    setLoading: function(payload) { state.editDrawer.loading = true; assert.strictEqual(payload.projectId, 2); },
    getVisibleFiles: function() { return state.editDrawer.files; },
    setData: function() {},
    syncControls: function() {},
  };
  var received = null;
  var statuses = [];
  var instance = owner.create({
    state: state,
    dom: dom,
    apiClient: {
      listCaseFiles: function() { return Promise.resolve([{ id: 11, item_count: 3 }]); },
      listExecSetsByCaseFile: function() { return Promise.resolve([{ case_file_id: 11 }]); },
    },
    getListController: function() { return listController; },
    setListData: function(files, execSets, options) {
      received = { files: files, execSets: execSets, options: options };
      state.editDrawer.files = files;
    },
    normalizeId: function(value) { return value ? Number(value) : null; },
    loadVersions: function(projectId) { assert.strictEqual(projectId, 2); return Promise.resolve([{ id: 4 }]); },
    syncVersionOptions: function() {},
    syncChangeVersionOptions: function() {},
    setStatus: function(element, message, type) { statuses.push([message, type]); },
    persistState: function() {},
    isDrawerOpen: function() { return true; },
    getCurrentUserId: function() { return 5; },
  });

  return instance.loadFiles().then(function() {
    assert.ok(received);
    assert.strictEqual(received.files[0].id, 11);
    assert.strictEqual(received.execSets[0].case_file_id, 11);
    assert.strictEqual(received.options.projectId, 2);
    assert.ok(statuses.some(function(entry) { return entry[0].indexOf('已加载 1 份') === 0; }));
  });
}

function verifyOwnershipAndLoadOrder() {
  var ownerSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/caseLibrary/caseLibraryEditDrawerWorkflowController.js'),
    'utf8'
  );
  var parentSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/caseLibrary.js'),
    'utf8'
  );
  assert.ok(ownerSource.split('\n').length < 700, 'edit drawer workflow owner should remain focused');
  assert.ok(parentSource.indexOf('editDrawerWorkflowOwner.create') !== -1);
  [
    'resetEditDrawer',
    'openShareDrawerFromSelection',
    'exportEditDrawerSelectionToXmind',
    'exportEditDrawerSelectionToExcel',
    'confirmEditDrawerChangeVersion',
    'deleteSelectedCaseFiles',
    'loadEditDrawerFiles',
  ].forEach(function(functionName) {
    assert.strictEqual(
      parentSource.indexOf('function ' + functionName + '('),
      -1,
      functionName + ' should be owned by the edit drawer workflow controller'
    );
  });

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var listIndex = html.indexOf('./scripts/modules/caseLibrary/caseLibraryEditListController.js');
    var ownerIndex = html.indexOf('./scripts/modules/caseLibrary/caseLibraryEditDrawerWorkflowController.js');
    var parentIndex = html.indexOf('./scripts/modules/caseLibrary.js');
    assert.ok(ownerIndex > listIndex, fileName + ' must load the workflow after the list controller');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the workflow before caseLibrary');
  });
}

assert.ok(owner && typeof owner.create === 'function');
verifyFilterAndShareFlow();
verifyLoadFlow().then(function() {
  verifyOwnershipAndLoadOrder();
  console.log('case_library_edit_drawer_workflow_controller.test.js passed');
}).catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
