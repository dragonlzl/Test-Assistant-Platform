'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenDeleteController.js'
));

function cloneJson(value, fallback) {
  if (value === undefined) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function createHarness(options) {
  var opts = options || {};
  var state = {
    caseGenModules: [{ id: 'ai-login', title: '登录' }],
    caseGenResults: {
      'ai-login': [
        { title: '登录成功', expected: '进入首页' },
        { title: '密码错误', expected: '提示失败' },
      ],
    },
    caseSelections: { 'ai-login': { 0: true } },
    caseGenSuggestions: { 'ai-login': '建议' },
    caseGenModuleStatus: { 'ai-login': 'done' },
    caseGenProgress: { 'ai-login': { done: 2 } },
    caseGenTiming: { 'ai-login': 120 },
    caseGenSource: 'xmind',
  };
  var xmindState = {
    deleteUndoStack: [],
    deleteRedoStack: [],
    deletedBaselineModuleKeys: [],
    deletedBaselineCaseKeys: [],
    modules: { 'ai-login': { topupHighlight: { active: true } } },
    root: {},
  };
  var undoBtn = { disabled: true, title: '' };
  var redoBtn = { disabled: true, title: '' };
  var calls = {
    confirms: 0,
    invalidates: 0,
    notices: [],
    persists: 0,
    renders: [],
    syncs: 0,
    toolbarSyncs: 0,
  };
  var visibleContext = {
    map: {
      login: {
        key: 'login',
        title: '登录',
        aiModuleId: 'ai-login',
        baselineCases: [{ title: '账号不存在' }],
      },
    },
  };
  var idSeed = 0;
  var controller = controllerFactory.create({
    state: state,
    deleteUndoBtn: undoBtn,
    deleteRedoBtn: redoBtn,
    historyLimit: Number(opts.historyLimit || 80),
    deleteActionId: 'xmind-delete-selection',
    cloneJson: cloneJson,
    cloneSelectionMap: function(value) { return cloneJson(value || {}, {}); },
    restoreSelectionMap: function(value) { return cloneJson(value || {}, {}); },
    ensureState: function() { return xmindState; },
    generateLocalId: function() {
      idSeed += 1;
      return 'delete-' + String(idSeed);
    },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeCaseTitle: function(value) { return String(value || '').trim(); },
    buildCaseSignature: function(item) { return String(item && item.title ? item.title : ''); },
    ensureVisibleModuleContext: function(value) { return value; },
    buildVisibleModuleContext: function() { return visibleContext; },
    hideOpenMindContextMenu: function() {},
    getConfirmDrawer: function() {
      return {
        open: function() {
          calls.confirms += 1;
          return Promise.resolve({ ok: true });
        },
      };
    },
    rememberDeletedBaselineModule: function(moduleTitle) {
      var key = String(moduleTitle || '');
      if (xmindState.deletedBaselineModuleKeys.indexOf(key) !== -1) return false;
      xmindState.deletedBaselineModuleKeys.push(key);
      return true;
    },
    rememberDeletedBaselineCase: function(moduleTitle, signature) {
      var key = String(moduleTitle || '') + '::' + String(signature || '');
      if (xmindState.deletedBaselineCaseKeys.indexOf(key) !== -1) return false;
      xmindState.deletedBaselineCaseKeys.push(key);
      return true;
    },
    getAiCasesForModule: function(moduleId) {
      return Array.isArray(state.caseGenResults[moduleId]) ? state.caseGenResults[moduleId] : [];
    },
    findAiModuleById: function(moduleId) {
      return state.caseGenModules.filter(function(item) { return item.id === moduleId; })[0] || null;
    },
    commitCaseList: function(moduleId, list) { state.caseGenResults[moduleId] = cloneJson(list, []); },
    clearModuleTopupHighlight: function(moduleState) { moduleState.topupHighlight = null; },
    invalidateDeleteConflictingSnapshots: function() { calls.invalidates += 1; },
    hasImportedBaselineCases: function() { return xmindState.deletedBaselineModuleKeys.length === 0; },
    ensureRootUiState: function() { return xmindState.root; },
    syncCasesGenPageRender: function() { calls.syncs += 1; },
    syncInterruptButton: function() { calls.toolbarSyncs += 1; },
    notifyStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    render: function(payload) { calls.renders.push(payload); },
    persistXmindState: function() { calls.persists += 1; },
    hasAnyRunningGenerationOperation: function() { return opts.running === true; },
    now: function() { return 1234; },
  });
  return {
    calls: calls,
    controller: controller,
    redoBtn: redoBtn,
    state: state,
    undoBtn: undoBtn,
    xmindState: xmindState,
  };
}

function buildMeta(type, source, index, signature) {
  return {
    type: type,
    moduleKey: 'login',
    moduleTitle: '登录',
    caseTitle: signature,
    caseSource: source || '',
    caseSourceIndex: index === undefined ? -1 : index,
    caseSignature: signature || '',
  };
}

function verifySelectionPlan() {
  var harness = createHarness();
  var plan = harness.controller.buildDeleteSelectionPlan({
    selection: [
      { meta: buildMeta('module') },
      { meta: buildMeta('case', 'ai', 0, '登录成功') },
    ],
  });
  assert.strictEqual(plan.modules.length, 1);
  assert.strictEqual(plan.modules[0].deleteAiLayer, true);
  assert.strictEqual(plan.modules[0].deleteBaselineLayer, true);
  assert.deepStrictEqual(plan.cases, []);

  plan = harness.controller.buildDeleteSelectionPlan({
    selection: [
      { meta: buildMeta('case', 'ai', 0, '登录成功') },
      { meta: buildMeta('steps', 'ai', 0, '登录成功') },
    ],
  });
  assert.strictEqual(plan.modules.length, 0);
  assert.strictEqual(plan.cases.length, 1);
  assert.strictEqual(harness.controller.buildDeleteAction({ meta: buildMeta('case', 'ai', 0, '登录成功') }).disabled, false);
  assert.strictEqual(harness.controller.isDeleteActionId('xmind-delete-selection'), true);
}

async function verifyDeleteUndoRedoLifecycle() {
  var harness = createHarness();
  var deleted = await harness.controller.handleDeleteSelection({
    selection: [
      { meta: buildMeta('case', 'ai', 0, '登录成功') },
      { meta: buildMeta('case', 'baseline', 0, '账号不存在') },
    ],
  });
  assert.strictEqual(deleted, true);
  assert.strictEqual(harness.calls.confirms, 1);
  assert.deepStrictEqual(harness.state.caseGenResults['ai-login'].map(function(item) { return item.title; }), ['密码错误']);
  assert.deepStrictEqual(harness.xmindState.deletedBaselineCaseKeys, ['登录::账号不存在']);
  assert.strictEqual(harness.xmindState.deleteUndoStack.length, 1);
  assert.strictEqual(harness.undoBtn.disabled, false);
  assert.strictEqual(harness.redoBtn.disabled, true);

  assert.strictEqual(harness.controller.undoLatestDeleteSelection(), true);
  assert.deepStrictEqual(harness.state.caseGenResults['ai-login'].map(function(item) { return item.title; }), ['登录成功', '密码错误']);
  assert.deepStrictEqual(harness.xmindState.deletedBaselineCaseKeys, []);
  assert.strictEqual(harness.xmindState.deleteRedoStack.length, 1);
  assert.strictEqual(harness.undoBtn.disabled, true);
  assert.strictEqual(harness.redoBtn.disabled, false);

  assert.strictEqual(harness.controller.redoLatestDeleteSelection(), true);
  assert.deepStrictEqual(harness.state.caseGenResults['ai-login'].map(function(item) { return item.title; }), ['密码错误']);
  assert.deepStrictEqual(harness.xmindState.deletedBaselineCaseKeys, ['登录::账号不存在']);
  assert.strictEqual(harness.xmindState.root.lastAction, 'delete-redo');
  assert.strictEqual(harness.calls.persists, 3);
  assert.deepStrictEqual(harness.calls.renders.map(function(item) { return item.reason; }), [
    'delete-selection',
    'delete-undo',
    'delete-redo',
  ]);
}

function verifyModuleRemovalAndRunningGuard() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.removeAiModuleRecord('ai-login'), true);
  assert.strictEqual(harness.state.caseGenModules.length, 0);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(harness.state.caseGenResults, 'ai-login'), false);
  assert.strictEqual(harness.xmindState.hasModuleSkeleton, false);

  var runningHarness = createHarness({ running: true });
  return runningHarness.controller.handleDeleteSelection({ meta: buildMeta('case', 'ai', 0, '登录成功') })
    .then(function(result) {
      assert.strictEqual(result, false);
      assert.strictEqual(runningHarness.calls.confirms, 0);
      assert.strictEqual(runningHarness.calls.notices[0].type, 'warn');
    });
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'buildDeleteHistorySnapshotPayload',
    'syncDeleteHistoryButtons',
    'clearDeleteHistoryStacks',
    'undoLatestDeleteSelection',
    'redoLatestDeleteSelection',
    'buildDeleteSelectionPlan',
    'handleDeleteSelection',
    'removeAiModuleRecord',
    'buildDeleteAction',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by delete controller');
  });
  assert.ok(/deleteControllerFactory\.create\(/.test(parentSource));
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenDeleteController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load delete controller first');
  });
}

(async function run() {
  verifySelectionPlan();
  await verifyDeleteUndoRedoLifecycle();
  await verifyModuleRemovalAndRunningGuard();
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen delete controller tests passed');
})().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
