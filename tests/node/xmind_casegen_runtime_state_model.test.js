'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenRuntimeStateModel.js'
);
var factory = require(ownerPath);

function normalizeUniqueStringList(list) {
  var seen = {};
  return (Array.isArray(list) ? list : []).map(function(item) {
    return String(item || '').trim();
  }).filter(function(item) {
    if (!item || seen[item]) return false;
    seen[item] = true;
    return true;
  });
}

function createHarness() {
  var state = {
    modules: {},
    deletedBaselineModuleKeys: [],
    deletedBaselineCaseKeys: [],
  };
  var model = factory.create({
    ensureState: function() { return state; },
    buildBaselineModuleDeleteKey: function(value) {
      return String(value || '').trim().toLowerCase();
    },
    buildBaselineCaseDeleteKey: function(moduleTitle, signature) {
      var moduleKey = String(moduleTitle || '').trim().toLowerCase();
      var caseKey = String(signature || '').trim();
      return moduleKey && caseKey ? (moduleKey + '::' + caseKey) : '';
    },
    normalizeUniqueStringList: normalizeUniqueStringList,
  });
  return { model: model, state: state };
}

function verifyModuleRuntimeState() {
  var harness = createHarness();
  var moduleState = harness.model.ensureModuleUiState('module-a');
  assert.strictEqual(moduleState.running, false);
  assert.strictEqual(moduleState.taskId, '');
  assert.strictEqual(moduleState.topupHighlight, null);
  moduleState.status = 'running';
  assert.strictEqual(harness.model.ensureModuleUiState('module-a'), moduleState);
  assert.strictEqual(harness.model.ensureModuleUiState(''), null);
}

function verifyDeletedBaselineIndexes() {
  var harness = createHarness();
  harness.state.deletedBaselineModuleKeys = [' Login ', 'login', 'Checkout'];
  harness.state.deletedBaselineCaseKeys = ['login::case-1', ' checkout::case-2 ', ''];
  var moduleMap = harness.model.getDeletedBaselineModuleMap();
  var caseMap = harness.model.getDeletedBaselineCaseMap();
  assert.strictEqual(moduleMap.login, true);
  assert.strictEqual(moduleMap.checkout, true);
  assert.strictEqual(caseMap['login::case-1'], true);
  assert.strictEqual(caseMap['checkout::case-2'], true);

  harness.state.deletedBaselineModuleKeys = [];
  harness.state.deletedBaselineCaseKeys = ['login::case-1', 'login::case-2', 'checkout::case-3'];
  assert.strictEqual(harness.model.rememberDeletedBaselineModule('Login'), true);
  assert.strictEqual(harness.model.rememberDeletedBaselineModule(' login '), false);
  assert.deepStrictEqual(harness.state.deletedBaselineModuleKeys, ['login']);
  assert.deepStrictEqual(harness.state.deletedBaselineCaseKeys, ['checkout::case-3']);
  assert.strictEqual(harness.model.rememberDeletedBaselineCase('Checkout', 'case-4'), true);
  assert.strictEqual(harness.model.rememberDeletedBaselineCase('checkout', 'case-4'), false);
}

function createDefaultPrepState() {
  return {
    step: 1,
    requirementMode: '',
    requirementSupplement: '',
    manualRequirementLabel: '',
    manualRequirementBlocks: [],
    caseImportMode: '',
    baseLocked: false,
    completed: false,
  };
}

function verifyLiveRuntimeStateNormalization() {
  var hostState = { caseGenModules: [{ id: 'module-1' }] };
  var imported = true;
  var model = factory.create({
    getHostState: function() { return hostState; },
    stepRequirement: 1,
    stepOptions: 3,
    createDefaultKnowledgeBaseState: function() { return { status: 'idle' }; },
    createDefaultDedupeState: function() { return { running: false, taskId: '', status: '', error: '', updatedAt: 0 }; },
    createDefaultCoverageState: function() { return { running: false, selectedSegmentId: '' }; },
    createDefaultViewState: function() { return { drawerOpen: false, fullscreen: false, updatedAt: 0 }; },
    createDefaultRootState: function() { return { taskId: '', hideAiLayer: false, pipeline: null }; },
    createDefaultPrepState: createDefaultPrepState,
    normalizeStoredViewState: function(value) {
      return {
        drawerOpen: value && value.drawerOpen === true,
        fullscreen: value && value.fullscreen === true,
        updatedAt: Math.max(0, Number(value && value.updatedAt || 0) || 0),
      };
    },
    normalizeCoverageState: function(value) {
      return value && typeof value === 'object'
        ? { running: value.running === true, selectedSegmentId: String(value.selectedSegmentId || '') }
        : { running: false, selectedSegmentId: '' };
    },
    hasImportedBaselineCases: function() { return imported; },
    normalizeInlineStatusType: function(value) {
      return String(value || '') === 'warn' ? 'warn' : '';
    },
    normalizeKnowledgeBaseState: function(value) {
      return value && typeof value === 'object'
        ? { status: String(value.status || 'idle') }
        : { status: 'idle' };
    },
    normalizeRootPipelineDedupeModules: function(list) {
      return Array.isArray(list) ? list.filter(Boolean) : [];
    },
    normalizeUniqueStringList: normalizeUniqueStringList,
    normalizeFallbackCaseList: function(list, moduleTitle) {
      return (Array.isArray(list) ? list : []).map(function(item) {
        return { module: moduleTitle, title: String(item && item.title || '') };
      });
    },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
  });

  var initial = model.ensureState();
  assert.strictEqual(initial.hasModuleSkeleton, true);
  assert.strictEqual(initial.hasImportedBaseline, true);
  assert.deepStrictEqual(initial.workspaceOrder, []);
  assert.deepStrictEqual(initial.prep, createDefaultPrepState());

  hostState.xmindCaseGen = {
    activeWorkspaceId: 25,
    mirrorWorkspaceId: null,
    workspaceOrder: [' workspace-1 ', '', 'workspace-2'],
    workspaces: null,
    viewState: { drawerOpen: true, updatedAt: -4 },
    deletedBaselineModuleKeys: [' Login ', ''],
    deletedBaselineCaseKeys: [' login::case-1 ', ''],
    root: {
      taskId: 91,
      hideAiLayer: 1,
      pipeline: {
        id: 8,
        errorCount: -1,
        createdModules: '2',
        moduleTaskCompleted: 0,
        moduleTaskCompletedKeys: ['login', 'login', 'payment'],
        pendingQueue: [{
          moduleId: 5,
          moduleTitle: '登录',
          fallbackCases: [{ title: '成功' }],
        }, null],
      },
    },
    prep: {
      step: 9,
      requirementMode: 'manual',
      requirementSupplement: 7,
      manualRequirementLabel: ' 登录需求 ',
      manualRequirementBlocks: null,
      caseImportMode: 'invalid',
      baseLocked: false,
      completed: true,
    },
    dedupe: { running: 1, taskId: 9, status: null, error: 5, updatedAt: '12' },
    coverage: { running: true, selectedSegmentId: 3 },
    modules: { login: { taskId: 99 } },
    history: null,
    operationSnapshots: null,
    rootSnapshots: null,
    deleteUndoStack: null,
    deleteRedoStack: null,
    snapshots: null,
    nextSnapshotId: 'invalid',
    nextWorkspaceSeq: 'invalid',
    mode: 'unexpected',
    treeSourceSignature: 19,
    summaryResultKind: 'unexpected',
    inlineStatusText: 6,
    inlineStatusType: 'warn',
    openButtonDotVisible: 1,
    historyUnread: true,
    knowledgeBase: { status: 'ready' },
  };
  imported = false;
  var normalized = model.ensureState();
  assert.strictEqual(normalized.activeWorkspaceId, '25');
  assert.strictEqual(normalized.mirrorWorkspaceId, '');
  assert.deepStrictEqual(normalized.workspaceOrder, ['workspace-1', 'workspace-2']);
  assert.deepStrictEqual(normalized.workspaces, {});
  assert.strictEqual(normalized.viewState.drawerOpen, true);
  assert.deepStrictEqual(normalized.deletedBaselineModuleKeys, ['login']);
  assert.deepStrictEqual(normalized.deletedBaselineCaseKeys, ['login::case-1']);
  assert.strictEqual(normalized.root.taskId, '91');
  assert.strictEqual(normalized.root.hideAiLayer, false);
  assert.strictEqual(normalized.root.pipeline.errorCount, 0);
  assert.strictEqual(normalized.root.pipeline.createdModules, 2);
  assert.strictEqual(normalized.root.pipeline.moduleTaskCompleted, 2);
  assert.strictEqual(normalized.root.pipeline.pendingQueue.length, 1);
  assert.deepStrictEqual(normalized.root.pipeline.pendingQueue[0].fallbackCases, [{ module: '登录', title: '成功' }]);
  assert.strictEqual(normalized.prep.step, 3);
  assert.strictEqual(normalized.prep.baseLocked, true);
  assert.strictEqual(normalized.prep.completed, true);
  assert.strictEqual(normalized.prep.caseImportMode, '');
  assert.strictEqual(normalized.dedupe.running, false);
  assert.strictEqual(normalized.dedupe.taskId, '9');
  assert.strictEqual(normalized.coverage.selectedSegmentId, '3');
  assert.strictEqual(normalized.modules.login.taskId, '99');
  assert.strictEqual(normalized.nextSnapshotId, 1);
  assert.strictEqual(normalized.nextWorkspaceSeq, 1);
  assert.strictEqual(normalized.mode, 'modules');
  assert.strictEqual(normalized.hasImportedBaseline, false);
  assert.strictEqual(normalized.inlineStatusType, 'warn');
  assert.strictEqual(normalized.openButtonDotVisible, false);
  assert.strictEqual(normalized.historyUnread, true);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'ensureModuleUiState',
    'buildDeletedBaselineModuleMapFromList',
    'buildDeletedBaselineCaseMapFromList',
    'getDeletedBaselineModuleMap',
    'getDeletedBaselineCaseMap',
    'rememberDeletedBaselineModule',
    'rememberDeletedBaselineCase',
    'ensureState',
  ].forEach(function(name) {
    var signature = new RegExp('function\\s+' + name + '\\s*\\(');
    assert.match(ownerSource, signature, name + ' must belong to runtime state model');
    assert.doesNotMatch(parentSource, signature, name + ' must leave xmindCasegen.js');
  });
  assert.match(parentSource, /runtimeStateModelFactory\.create\(\{/);
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenRuntimeStateModel.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load runtime state model first');
  });
}

verifyModuleRuntimeState();
verifyDeletedBaselineIndexes();
verifyLiveRuntimeStateNormalization();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen runtime state model tests passed');
