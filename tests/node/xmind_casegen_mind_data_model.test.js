const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ownerPath = '../../scripts/modules/xmindCasegen/xmindCasegenMindDataModel.js';
const repoRoot = path.resolve(__dirname, '../..');

function clone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return fallback;
  }
}

function createHarness(factory) {
  const rootActions = {
    EXISTING_CASES: 'root-existing-cases',
    TOPUP_MODULES: 'root-topup-modules',
    TOPUP_MODULES_CASES: 'root-topup-modules-cases',
  };
  const moduleActions = { APPEND: 'module-append' };
  const state = {
    modules: {
      'module-login': {
        running: true,
        lastAction: 'module-append',
        rootPendingActionId: '',
        status: '',
        error: '',
        hideResults: false,
        topupHighlight: {
          token: 'topup-1',
          label: '本轮追加',
          startIndex: 0,
          count: 1,
          highlightScope: 'cases',
        },
      },
    },
    treeSourceSignature: '',
  };
  const rootState = {
    running: false,
    lastAction: '',
    status: '',
    error: '',
    hideAiLayer: false,
  };
  const prep = { requirementMode: 'manual', completed: true };
  const collapsed = { 'module:登录模块': true };
  const caseItem = {
    title: '登录成功',
    priority: 'P1',
    preconditions: '账号存在',
    steps: '输入账号密码',
    expected: '登录成功',
  };
  const visibleContext = {
    list: [{
      title: '登录模块',
      moduleKey: 'login',
      aiModuleId: 'module-login',
      cases: [{
        item: caseItem,
        source: 'ai',
        sourceIndex: 0,
        caseSignature: 'login-success',
      }],
    }],
    map: {},
  };
  const calls = {
    staleCleanup: 0,
    buildContext: 0,
    visibleCases: 0,
  };
  const model = factory.create({
    rootActions: rootActions,
    moduleActions: moduleActions,
    dedupeActionId: 'xmind-ai-dedupe',
    ensureVisibleModuleContext: function(value) { return value || visibleContext; },
    buildVisibleModuleContext: function() { calls.buildContext += 1; return visibleContext; },
    getRequirementLabelText: function() { return '登录需求'; },
    getPrepState: function() { return prep; },
    hasImportedBaselineCases: function() { return true; },
    getCombinedCaseText: function() { return '导入基线'; },
    buildVisibleModuleSnapshot: function(context) {
      return context.list.map(function(entry) {
        return { title: entry.title, cases: entry.cases.length };
      });
    },
    ensureState: function() { return state; },
    ensureRootUiState: function() { return rootState; },
    ensureModuleUiState: function(moduleId) { return state.modules[moduleId] || null; },
    cloneTopupHighlight: function(value) { return clone(value, null); },
    cloneJson: clone,
    isRootGenerationVisuallyRunning: function(value) { return value && value.running === true; },
    getStoreValidationSignature: function() { return 'validation-v1'; },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    buildViewStateNodeKey: function(meta, topic) {
      return String(meta && meta.type || '') + ':' + String(topic || '');
    },
    getXmindCoreApi: function() {
      return {
        buildCaseFieldsForXmind: function(item, moduleTitle) {
          return [moduleTitle, item.title, item.priority, item.preconditions, item.steps, item.expected];
        },
      };
    },
    buildCaseSignature: function(item, moduleTitle) { return moduleTitle + '::' + item.title; },
    clearStaleModuleUiState: function() { calls.staleCleanup += 1; },
    getCollapsedNodeKeyMap: function() { return collapsed; },
    getVisibleCasesForModuleEntry: function(entry) { calls.visibleCases += 1; return entry.cases; },
    getCaseTopupHighlight: function(moduleState, index) {
      return moduleState && index === 0 ? moduleState.topupHighlight : null;
    },
    getModuleNodeTopupHighlight: function(moduleState) { return moduleState ? moduleState.topupHighlight : null; },
    now: function() { return 1234; },
  });
  return {
    model: model,
    state: state,
    rootState: rootState,
    prep: prep,
    collapsed: collapsed,
    visibleContext: visibleContext,
    calls: calls,
  };
}

function verifyStableIds(factory) {
  const harness = createHarness(factory);
  assert.strictEqual(harness.model.buildNodeId(['root', 'Login Case']), 'root_Login-Case');
  assert.strictEqual(harness.model.buildNodeId(['', null]), 'node_1234');
  const loginId = harness.model.buildModuleNodeId('login');
  assert.match(loginId, /^module_login_[a-z0-9]+$/);
  assert.strictEqual(harness.model.getModuleNodeId({ moduleKey: 'login' }), loginId);
  assert.notStrictEqual(harness.model.buildModuleNodeId('login-a'), harness.model.buildModuleNodeId('login-b'));
}

function verifyTreeShapeAndVisuals(factory) {
  const harness = createHarness(factory);
  const data = harness.model.buildMindData();
  assert.strictEqual(data.nodeData.topic, '登录需求');
  assert.strictEqual(data.nodeData.xmindMeta.type, 'root');
  assert.strictEqual(data.nodeData.children.length, 1);
  const moduleNode = data.nodeData.children[0];
  assert.strictEqual(moduleNode.topic, '登录模块');
  assert.strictEqual(moduleNode.expanded, false);
  assert.strictEqual(moduleNode.xmindMeta.status, 'running');
  assert.strictEqual(moduleNode.xmindMeta.hasPendingBranch, true);
  assert.strictEqual(moduleNode.xmindMeta.topupHighlightToken, 'topup-1');
  assert.strictEqual(moduleNode.children.length, 2);
  assert.strictEqual(moduleNode.children[0].topic, '登录成功');
  assert.strictEqual(moduleNode.children[0].xmindMeta.type, 'case');
  assert.strictEqual(moduleNode.children[0].xmindMeta.topupHighlightToken, 'topup-1');
  assert.strictEqual(moduleNode.children[0].children[0].topic, 'P1');
  assert.strictEqual(moduleNode.children[0].children[0].children[0].topic, '账号存在');
  assert.strictEqual(moduleNode.children[1].xmindMeta.type, 'topup-placeholder');
  assert.strictEqual(moduleNode.children[1].topic, '追加生成中');
  assert.ok(harness.state.treeSourceSignature.indexOf('登录需求') !== -1);
}

function verifyCacheAndInvalidation(factory) {
  const harness = createHarness(factory);
  const first = harness.model.buildMindData();
  const visibleCallsAfterFirst = harness.calls.visibleCases;
  const second = harness.model.buildMindData();
  assert.strictEqual(second, first);
  assert.strictEqual(harness.calls.visibleCases, visibleCallsAfterFirst);
  assert.strictEqual(harness.model.getCacheState().data, first);

  harness.state.modules['module-login'].running = false;
  harness.state.modules['module-login'].lastAction = '';
  const third = harness.model.buildMindData();
  assert.notStrictEqual(third, first);
  assert.strictEqual(third.nodeData.children[0].xmindMeta.status, '');
  assert.strictEqual(third.nodeData.children[0].children.length, 1);

  harness.state.modules['module-login'].status = 'error';
  harness.state.modules['module-login'].error = '生成失败';
  const fourth = harness.model.buildMindData();
  assert.notStrictEqual(fourth, third);
  assert.strictEqual(fourth.nodeData.children[0].xmindMeta.status, 'error');
  assert.strictEqual(fourth.nodeData.children[0].xmindMeta.statusText, '生成失败');

  harness.model.clearCache();
  assert.strictEqual(harness.model.getCacheState().data, null);
}

function verifyRootPendingAndSignature(factory) {
  const harness = createHarness(factory);
  harness.state.modules['module-login'].running = false;
  harness.state.modules['module-login'].lastAction = '';
  harness.rootState.running = true;
  harness.rootState.lastAction = 'root-topup-modules';
  const data = harness.model.buildMindData();
  const children = data.nodeData.children;
  assert.strictEqual(children[children.length - 1].topic, '补全模块中');
  assert.strictEqual(data.nodeData.xmindMeta.status, 'running');

  const visual = JSON.parse(harness.model.buildMindDataVisualSignature(
    'tree-v1',
    { z: true, a: true, ignored: false },
    harness.visibleContext,
    harness.rootState
  ));
  assert.deepStrictEqual(visual.collapsed, ['a', 'z']);
  assert.strictEqual(visual.validation, 'validation-v1');
}

function verifyOwnershipAndLoadOrder() {
  const parentSource = fs.readFileSync(path.join(repoRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  const ownerSource = fs.readFileSync(
    path.join(repoRoot, 'scripts/modules/xmindCasegen/xmindCasegenMindDataModel.js'),
    'utf8'
  );
  [
    'buildTreeSignature',
    'buildMindDataVisualSignature',
    'buildStableNodeId',
    'buildCaseTree',
    'buildMindData',
  ].forEach(function(functionName) {
    const signature = new RegExp('function\\s+' + functionName + '\\s*\\(');
    assert.match(ownerSource, signature, functionName + ' must belong to the mind data owner');
    assert.doesNotMatch(parentSource, signature, functionName + ' must not remain in xmindCasegen.js');
  });
  assert.match(parentSource, /xmindCasegenMindDataModel/);
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    const html = fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
    const ownerIndex = html.indexOf('xmindCasegenMindDataModel.js');
    const parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the mind data owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the mind data owner before xmindCasegen.js');
  });
}

function run() {
  const factory = require(ownerPath);
  verifyStableIds(factory);
  verifyTreeShapeAndVisuals(factory);
  verifyCacheAndInvalidation(factory);
  verifyRootPendingAndSignature(factory);
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen mind data model tests passed');
}

run();
