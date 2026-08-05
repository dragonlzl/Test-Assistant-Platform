const assert = require('assert');
const fs = require('fs');
const path = require('path');
const controllerFactory = require('../../scripts/modules/xmindCasegen/xmindCasegenResultDeliveryController.js');

function createCase(title) {
  return {
    module: '登录模块',
    title: title || '登录成功校验',
    priority: 'P1',
    preconditions: '账号已存在',
    steps: ['1、进入登录页', '2、输入账号密码'],
    expected: '登录成功',
  };
}

function createHarness(overrides) {
  const calls = {
    newStores: [],
    appendStores: [],
    floating: [],
    status: [],
    success: [],
    renders: [],
    confirms: [],
    resets: [],
    deletes: [],
    blobs: [],
    texts: [],
  };
  const state = {
    importedCases: [],
    caseGenModules: [{ id: 'login-ai', title: '登录模块' }],
  };
  const aiCases = { 'login-ai': [createCase()] };
  const visibleContext = {
    list: [{
      moduleKey: 'login',
      aiModuleId: 'login-ai',
      title: '登录模块',
      baselineCases: [],
      aiCases: aiCases['login-ai'],
    }],
  };
  const timers = [];
  const controller = controllerFactory.create(Object.assign({
    state: state,
    casesGenApi: {
      openCaseGenDbStoreNewDrawerWithItems: function(items, options) {
        calls.newStores.push({ items: items, options: options });
      },
      openCaseGenDbStoreAppendDrawerWithItems: function(items, options) {
        calls.appendStores.push({ items: items, options: options });
      },
    },
    documentObj: {
      getElementById: function(id) {
        return id === 'caseGenStoreActionSelect' ? { value: 'append' } : null;
      },
    },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    normalizeCaseItem: function(value, moduleTitle) {
      if (!value) return null;
      return Object.assign({}, value, { module: value.module || moduleTitle });
    },
    buildCaseSignature: function(item) { return String(item && item.title || ''); },
    buildDeleteTargetKey: function(meta) {
      return [meta.type, meta.moduleKey, meta.caseSource, meta.caseSourceIndex, meta.caseSignature].join('::');
    },
    hasImportedBaselineCases: function() { return state.importedCases.length > 0; },
    buildVisibleModuleContext: function() { return visibleContext; },
    getVisibleCasesForModuleEntry: function(entry) {
      return (entry.baselineCases || []).map(function(item, index) {
        return { source: 'baseline', sourceIndex: index, caseSignature: item.title, item: item };
      }).concat((entry.aiCases || []).map(function(item, index) {
        return { source: 'ai', sourceIndex: index, caseSignature: item.title, item: item };
      }));
    },
    getAiCasesForModule: function(id) { return (aiCases[id] || []).slice(); },
    hasAnyRunningGenerationOperation: function() { return false; },
    notifyFloatingStatus: function(text, type, duration) { calls.floating.push({ text: text, type: type, duration: duration }); },
    notifyStatus: function(text, type, options) { calls.status.push({ text: text, type: type, options: options }); },
    notifySuccessToast: function(text, duration) { calls.success.push({ text: text, duration: duration }); },
    render: function(options) { calls.renders.push(options); },
    isDrawerOpen: function() { return true; },
    openStoreConfirmDialog: function(options) {
      calls.confirms.push(options);
      return Promise.resolve(true);
    },
    getActiveWorkspaceId: function() { return 'workspace-a'; },
    resetXmindCasegenState: function(options) { calls.resets.push(options); return true; },
    deleteWorkspace: function(id, options) { calls.deletes.push({ id: id, options: options }); return true; },
    getXmindCoreApi: function() {
      return {
        buildXmindPackageFromMindData: function(data, label) {
          return Promise.resolve({ fileName: label + '.xmind', blob: data });
        },
      };
    },
    getXmindMarkdownExportCoreApi: function() {
      return {
        buildMarkdownExportFromSnapshot: function() {
          return { fileName: '登录模块.md', content: '# 登录模块' };
        },
      };
    },
    getCurrentMindData: function() { return { root: true }; },
    getRequirementLabelText: function() { return '登录需求'; },
    buildVisibleModuleSnapshot: function() { return [{ module: '登录模块', cases: [createCase()] }]; },
    downloadBlob: function(fileName, blob) { calls.blobs.push({ fileName: fileName, blob: blob }); },
    downloadText: function(fileName, content) { calls.texts.push({ fileName: fileName, content: content }); },
    setTimeout: function(handler) { timers.push(handler); return timers.length; },
    clearTimeout: function() {},
  }, overrides || {}));
  return { controller: controller, calls: calls, state: state, aiCases: aiCases, visibleContext: visibleContext, timers: timers };
}

function verifyValidationAndMarkers() {
  const harness = createHarness();
  const valid = harness.controller.validateStoreScopeEntries(harness.controller.buildVisibleStoreScopeEntries());
  assert.strictEqual(valid.items.length, 1);
  assert.deepStrictEqual(valid.missingModules, []);
  assert.deepStrictEqual(valid.invalidCaseKeys, []);

  harness.visibleContext.list[0].aiCases = [];
  const invalid = harness.controller.validateAndMarkStoreScope(harness.controller.buildVisibleStoreScopeEntries());
  assert.strictEqual(invalid, null);
  assert.strictEqual(harness.controller.isInvalidStoreModuleMeta({ type: 'module', moduleKey: 'login' }), true);
  assert.deepStrictEqual(harness.controller.getStoreValidationSignature().modules, ['login']);
  assert.strictEqual(harness.calls.renders[0].reason, 'store-validation-mark');
  assert.match(harness.calls.floating[0].text, /未生成用例/);
  harness.controller.clearStoreValidationState(false);
  assert.strictEqual(harness.controller.isInvalidStoreModuleMeta({ type: 'module', moduleKey: 'login' }), false);
  assert.deepStrictEqual(harness.controller.getStoreValidationSignature(), { modules: [], cases: [] });
  assert.strictEqual(harness.calls.renders[1].reason, 'store-validation-clear');
}

async function verifyStoreRouting() {
  const newHarness = createHarness();
  assert.strictEqual(await newHarness.controller.handleStoreToLibrary(), true);
  assert.strictEqual(newHarness.calls.newStores.length, 1);
  assert.strictEqual(newHarness.calls.newStores[0].options.newAction, 'append');
  assert.strictEqual(newHarness.calls.newStores[0].options.workspaceId, 'workspace-a');

  const appendHarness = createHarness();
  appendHarness.state.importedCases = [{
    name: '登录基线',
    list: [createCase('登录基线用例')],
    meta: {
      sourceType: 'case-library-select',
      projectId: 1,
      versionId: 11,
      caseFileId: 101,
      fileName: '登录基线',
    },
  }];
  assert.strictEqual(await appendHarness.controller.handleStoreToLibrary(), true);
  assert.strictEqual(appendHarness.calls.confirms.length, 1);
  assert.strictEqual(appendHarness.calls.appendStores.length, 1);
  assert.strictEqual(appendHarness.calls.appendStores[0].options.caseFileId, 101);
  assert.strictEqual(appendHarness.calls.appendStores[0].items.length, 1);

  const runningHarness = createHarness({ hasAnyRunningGenerationOperation: function() { return true; } });
  assert.strictEqual(await runningHarness.controller.handleStoreToLibrary(), false);
  assert.match(runningHarness.calls.floating[0].text, /生成任务进行中/);
}

async function verifyResultDelivery() {
  const harness = createHarness();
  assert.strictEqual(harness.controller.resetAfterStoreSuccess({ showToast: true }), true);
  assert.strictEqual(harness.calls.resets.length, 1);
  assert.strictEqual(harness.calls.deletes.length, 0);
  assert.strictEqual(harness.calls.success[0].text, '用例入库成功');

  assert.strictEqual(harness.controller.resetAfterStoreSuccess({
    workspaceId: 'workspace-a',
    closeWorkspace: true,
    showToast: true,
  }), true);
  assert.strictEqual(harness.calls.deletes.length, 1);
  assert.strictEqual(harness.calls.deletes[0].options.skipConfirm, true);
  assert.strictEqual(harness.calls.success[1].text, '入库并关闭页签成功');

  assert.strictEqual(await harness.controller.exportCurrentXmind(), true);
  assert.strictEqual(harness.calls.blobs[0].fileName, '登录需求.xmind');
  assert.strictEqual(harness.controller.exportCurrentMarkdown(), true);
  assert.deepStrictEqual(harness.calls.texts[0], { fileName: '登录模块.md', content: '# 登录模块' });
}

function verifyOwnershipAndLoadOrder() {
  const repoRoot = path.join(__dirname, '..', '..');
  const parentSource = fs.readFileSync(path.join(repoRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  const ownerSource = fs.readFileSync(
    path.join(repoRoot, 'scripts/modules/xmindCasegen/xmindCasegenResultDeliveryController.js'),
    'utf8'
  );
  const mindDataSource = fs.readFileSync(
    path.join(repoRoot, 'scripts/modules/xmindCasegen/xmindCasegenMindDataModel.js'),
    'utf8'
  );
  assert.match(ownerSource, /async function handleStoreToLibrary\(/);
  assert.match(ownerSource, /function resetAfterStoreSuccess\(/);
  assert.doesNotMatch(parentSource, /async function handleStoreToLibrary\(/);
  assert.doesNotMatch(parentSource, /function validateStoreScopeEntries\(/);
  assert.doesNotMatch(parentSource, /function exportCurrentMarkdown\(/);
  assert.match(parentSource, /var handleStoreToLibrary = resultDeliveryController\.handleStoreToLibrary;/);
  assert.match(parentSource, /getStoreValidationSignature: function\(\) \{ return getStoreValidationSignature\(\); \}/);
  assert.match(mindDataSource, /validation: getStoreValidationSignature\(\)/);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    const html = fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
    const ownerIndex = html.indexOf('xmindCasegenResultDeliveryController.js');
    const parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the result delivery owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the result delivery owner before xmindCasegen.js');
  });
}

async function run() {
  verifyValidationAndMarkers();
  verifyOwnershipAndLoadOrder();
  await verifyStoreRouting();
  await verifyResultDelivery();
  console.log('xmind casegen result delivery controller tests passed');
}

run().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
