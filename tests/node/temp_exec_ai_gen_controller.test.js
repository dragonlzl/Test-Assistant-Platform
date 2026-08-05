'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerOwner = require(path.join(projectRoot, 'scripts/modules/tempExecAiGenController.js'));
var viewOwner = require(path.join(projectRoot, 'scripts/modules/tempExecAiGenViewOwner.js'));
var modelOwner = require(path.join(projectRoot, 'scripts/modules/caseLibrary/caseLibraryAiGenModel.js'));
var storeOwner = require(path.join(projectRoot, 'scripts/modules/caseLibrary/caseLibraryAiGenStore.js'));
var diffModel = require(path.join(projectRoot, 'scripts/modules/caseLibrary/caseLibraryDiffModel.js'));
var taskRunnerOwner = require(path.join(projectRoot, 'scripts/modules/casePageAiGenTaskRunner.js'));
var toolbarOwner = require(path.join(projectRoot, 'scripts/modules/tempExecAiGenToolbarOwner.js'));
var taskStateOwner = require(path.join(projectRoot, 'scripts/modules/tempExecAiGenTaskStateOwner.js'));
var prepOwner = require(path.join(projectRoot, 'scripts/modules/tempExecAiGenPrepOwner.js'));
var fileParserOwner = require(path.join(projectRoot, 'scripts/modules/casePageAiGenFileParser.js'));

function createDocument() {
  return {
    getElementById: function() { return null; },
  };
}

function createController() {
  var state = { tempExecActiveId: 'file-1', tempExecFocus: [] };
  var windowObject = { app: { state: { currentUser: { id: 'user-1' } } } };
  var api = {
    getTempExecFile: function(id) {
      return String(id) === 'file-1' ? { id: 'file-1', cases: [], status: 'active' } : null;
    },
  };
  return {
    state: state,
    controller: controllerOwner.create({
      state: state,
      core: {},
      utils: {},
      config: {},
      api: api,
      context: {},
      document: createDocument(),
      window: windowObject,
      modelOwner: modelOwner,
      storeOwner: storeOwner,
      diffModel: diffModel,
      viewOwner: viewOwner,
      taskRunnerOwner: taskRunnerOwner,
      toolbarOwner: toolbarOwner,
      taskStateOwner: taskStateOwner,
      prepOwner: prepOwner,
      fileParserOwner: fileParserOwner,
      getCurrentUserId: function() { return 'user-1'; },
      setStatus: function() {},
      showToast: function() {},
      openConfirmDrawer: function() { return Promise.resolve({ ok: false }); },
    }),
  };
}

function verifyControllerContract() {
  var setup = createController();
  var controller = setup.controller;
  var ai = controller.getState();
  assert.ok(ai.selection instanceof Set);
  assert.deepStrictEqual(ai.modules, []);
  assert.strictEqual(typeof controller.syncContext, 'function');
  assert.strictEqual(typeof controller.applyTaskState, 'function');
  assert.strictEqual(typeof controller.markFocusBadgeRead, 'function');
  assert.strictEqual(typeof controller.appendSelection, 'function');

  controller.setRequirementText('  登录需求  ');
  assert.strictEqual(ai.requirementText, '  登录需求  ');

  ai.modules = [{
    module: '登录',
    cases: [{
      __aiKey: 'case-1',
      __aiCaseKey: 'case-key-1',
      title: '成功登录',
      priority: 'P1',
      preconditions: '已注册',
      steps: '输入账号',
      expected: '进入首页',
    }],
  }];
  controller.selectAll();
  assert.strictEqual(ai.selection.has('case-1'), true);
  controller.setSelection('case-1', false);
  assert.strictEqual(ai.selection.has('case-1'), false);
  controller.markFocusBadgeRead('file-1');
  controller.markAssignItemBadgeRead('file-1');
  controller.syncAssignEntryBadge();
  assert.strictEqual(controller.applyTaskState({ scene: 'other' }), false);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');
  var ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecAiGenController.js'), 'utf8');
  var viewSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecAiGenViewOwner.js'), 'utf8');
  var taskSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/casePageAiGenTaskRunner.js'), 'utf8');
  var toolbarSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecAiGenToolbarOwner.js'), 'utf8');
  var taskStateSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecAiGenTaskStateOwner.js'), 'utf8');
  var prepSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecAiGenPrepOwner.js'), 'utf8');
  var fileParserSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/casePageAiGenFileParser.js'), 'utf8');
  assert.strictEqual(parentSource.indexOf('function renderTempExecAiGenResult('), -1);
  assert.strictEqual(parentSource.indexOf('function runTempExecAiGen('), -1);
  assert.strictEqual(parentSource.indexOf('function appendTempExecAiGenSelection('), -1);
  assert.ok(parentSource.indexOf('tempExecAiGenControllerOwner.create') !== -1);
  assert.ok(ownerSource.indexOf('function renderTempExecAiGenResult(') !== -1);
  assert.ok(ownerSource.indexOf('function runTempExecAiGen(') !== -1);
  assert.strictEqual(ownerSource.indexOf('buildXmindEnhancedPipelineRequest'), -1);
  assert.strictEqual(ownerSource.indexOf('applyAiDedupeToParsed'), -1);
  assert.ok(viewSource.indexOf('function renderResult(') !== -1);
  assert.ok(viewSource.indexOf('function bindEvents(') !== -1);
  assert.ok(taskSource.indexOf('function resolveManagedResult(') !== -1);
  assert.ok(toolbarSource.indexOf('function markResultReady(') !== -1);
  assert.strictEqual(ownerSource.indexOf('function markTempExecAiGenResultReady('), -1);
  assert.ok(taskStateSource.indexOf('function applyTaskState(') !== -1);
  assert.strictEqual(ownerSource.indexOf('function applyTempExecAiGenTaskState('), -1);
  assert.ok(prepSource.indexOf('function shouldOpenDrawerDirect(') !== -1);
  assert.strictEqual(ownerSource.indexOf('function openTempExecAiGenPrepAndRun('), -1);
  assert.ok(fileParserSource.indexOf('function extractDocxText(') !== -1);
  assert.strictEqual(ownerSource.indexOf('function createTempExecAiGenDocxParser('), -1);
  assert.strictEqual(ownerSource.indexOf('function decodeTempExecAiGenXmlEntities('), -1);
  assert.ok(parentSource.indexOf('taskRunnerOwner: window.app && window.app.casePageAiGenTaskRunner') !== -1);
  assert.ok(parentSource.indexOf('toolbarOwner: window.app && window.app.tempExecAiGenToolbarOwner') !== -1);
  assert.ok(parentSource.indexOf('taskStateOwner: window.app && window.app.tempExecAiGenTaskStateOwner') !== -1);
  assert.ok(parentSource.indexOf('prepOwner: window.app && window.app.tempExecAiGenPrepOwner') !== -1);
  assert.ok(parentSource.indexOf('fileParserOwner: window.app && window.app.casePageAiGenFileParser') !== -1);
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
    var ownerIndex = html.indexOf('./scripts/modules/tempExecAiGenController.js');
    var viewIndex = html.indexOf('./scripts/modules/tempExecAiGenViewOwner.js');
    var taskIndex = html.indexOf('./scripts/modules/casePageAiGenTaskRunner.js');
    var toolbarIndex = html.indexOf('./scripts/modules/tempExecAiGenToolbarOwner.js');
    var taskStateIndex = html.indexOf('./scripts/modules/tempExecAiGenTaskStateOwner.js');
    var prepIndex = html.indexOf('./scripts/modules/tempExecAiGenPrepOwner.js');
    var fileParserIndex = html.indexOf('./scripts/modules/casePageAiGenFileParser.js');
    var legacyFileParserIndex = html.indexOf('./scripts/modules/caseLibrary/caseLibraryAiGenFileParser.js');
    var parentIndex = html.indexOf('./scripts/modules/tempexec.js');
    assert.ok(taskIndex >= 0, fileName + ' must load the shared AI generation task runner');
    assert.ok(toolbarIndex > taskIndex, fileName + ' must load the toolbar owner after the task runner');
    assert.ok(taskStateIndex > toolbarIndex, fileName + ' must load the task state owner after the toolbar');
    assert.ok(prepIndex > taskStateIndex, fileName + ' must load the prep owner after the task state owner');
    assert.ok(viewIndex >= 0, fileName + ' must load the AI generation view owner');
    assert.ok(viewIndex > prepIndex, fileName + ' must load the prep owner before the view owner');
    assert.ok(ownerIndex > viewIndex, fileName + ' must load the AI generation view owner first');
    assert.ok(fileParserIndex >= 0, fileName + ' must load the shared AI generation file parser');
    assert.ok(ownerIndex > fileParserIndex, fileName + ' must load the shared file parser before the controller');
    assert.ok(ownerIndex >= 0, fileName + ' must load the AI generation controller');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the AI generation controller first');
    assert.ok(legacyFileParserIndex > fileParserIndex, fileName + ' must load the legacy parser adapter after the shared parser');
  });
}

assert.ok(controllerOwner && typeof controllerOwner.create === 'function');
verifyControllerContract();
verifyOwnershipAndLoadOrder();
console.log('temp exec AI generation controller tests passed');
