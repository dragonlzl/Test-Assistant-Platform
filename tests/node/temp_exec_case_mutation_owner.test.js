const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mutationFactory = require('../../scripts/core/tempExecCaseMutationOwner.js');

function verifyPureRules() {
  assert.strictEqual(mutationFactory.normalizeTempExecModuleName(' Login '), 'login');
  assert.strictEqual(mutationFactory.normalizeTempExecModuleName(null), '');
  assert.strictEqual(mutationFactory.resolveTempExecAppendIndex([
    { module: '登录' },
    { module: '支付' },
    { module: ' 登录 ' },
  ], '登录'), 3);
  assert.strictEqual(mutationFactory.resolveTempExecAppendIndex([{ module: '登录' }], '搜索'), 1);
  assert.deepStrictEqual(mutationFactory.resolveTempExecCaseFieldChange('priority', ' p0 '), {
    field: 'priority',
    value: 'P0',
    patch: { priority: 'P0' },
  });
  assert.deepStrictEqual(mutationFactory.resolveTempExecCaseFieldChange('preconditions', '已登录'), {
    field: 'preconditions',
    value: '已登录',
    patch: { precondition: '已登录' },
  });
  assert.strictEqual(mutationFactory.resolveTempExecCaseFieldChange('actual', '通过'), null);
}

async function verifyMutationWorkflow() {
  const file = {
    id: 'file-a',
    reuseEnabled: true,
    cases: [
      { execCaseId: 11, module: '登录', title: '正常登录', actual: '未执行', remark: '' },
      { execCaseId: 12, module: '支付', title: '正常支付', actual: '未执行', remark: '' },
    ],
  };
  const state = { tempExecUndoStack: [] };
  const selection = new Set([0, 1]);
  const patches = [];
  const pendingClears = [];
  const marked = new Set();
  let idSeed = 0;
  let uiSeed = 0;
  let persisted = 0;
  let rendered = 0;
  let clearedStates = 0;

  const owner = mutationFactory.create({
    state,
    getTempExecFile(fileId) {
      return fileId === file.id ? file : null;
    },
    ensureTempExecSelection() {
      return selection;
    },
    isDbMode() {
      return true;
    },
    queueExecCasePatchForItem(item, patch) {
      patches.push({ id: item.execCaseId || item._tempId, patch });
    },
    clearPendingExecCasePatch(tempId) {
      pendingClears.push(tempId);
    },
    persistTempExecState() {
      persisted += 1;
    },
    renderTempExecView() {
      rendered += 1;
    },
    renderTempExecNav() {
      rendered += 1;
    },
    renderTempVersionGrid() {
      rendered += 1;
    },
    clearTempExecCaseStates() {
      clearedStates += 1;
      selection.clear();
    },
    getTempExecCaseUiKeys(item) {
      return item && item.__uiKey ? [item.__uiKey] : [];
    },
    ensureTempExecNewAddedUiKey(item) {
      uiSeed += 1;
      item.__uiKey = 'ui-' + uiSeed;
    },
    markTempExecNewAdded(fileId, item) {
      marked.add(fileId + ':' + item.__uiKey);
    },
    unmarkTempExecNewAdded(fileId, item) {
      marked.delete(fileId + ':' + item.__uiKey);
    },
    isTempExecNewAdded(fileId, item) {
      return marked.has(fileId + ':' + item.__uiKey);
    },
    buildReuseDetailsFromPresets() {
      return [{ id: 'detail-1', text: 'Chrome', status: '未执行' }];
    },
    resolveReuseAggregateStatus() {
      return '阻塞';
    },
    generateTempExecId() {
      idSeed += 1;
      return 'temp-' + idSeed;
    },
    openConfirmDrawer() {
      return Promise.resolve({ ok: true });
    },
  });

  owner.updateTempExecResult(file.id, 0, '通过');
  assert.deepStrictEqual(file.cases.map((item) => item.actual), ['通过', '通过']);
  assert.deepStrictEqual(patches.slice(0, 2), [
    { id: 11, patch: { status: '通过' } },
    { id: 12, patch: { status: '通过' } },
  ]);

  owner.updateTempExecRemark(file.id, 0, '已验证');
  owner.updateTempExecCaseField(file.id, 0, 'priority', ' p0 ');
  owner.updateTempExecCaseField(file.id, 0, 'preconditions', '已登录');
  assert.strictEqual(file.cases[0].remark, '已验证');
  assert.strictEqual(file.cases[0].priority, 'P0');
  assert.strictEqual(file.cases[0].preconditions, '已登录');
  assert.deepStrictEqual(patches.slice(2), [
    { id: 11, patch: { remark: '已验证' } },
    { id: 11, patch: { priority: 'P0' } },
    { id: 11, patch: { precondition: '已登录' } },
  ]);

  selection.clear();
  owner.toggleTempExecSelection(file.id, 1, true);
  assert.deepStrictEqual(Array.from(selection), [1]);
  owner.toggleTempExecSelectAll(file.id, true, [0, 1]);
  assert.deepStrictEqual(Array.from(selection), [0, 1]);
  assert.strictEqual(state.tempExecPreserveScrollOnce, true);

  owner.insertTempExecCase(file.id, 0);
  assert.strictEqual(file.cases.length, 3);
  assert.strictEqual(file.cases[1].module, '登录');
  assert.strictEqual(file.cases[1].actual, '阻塞');
  assert.strictEqual(file.cases[1].pendingCreate, true);
  assert.strictEqual(state.tempExecUndoStack.length, 1);
  assert.strictEqual(owner.restoreTempExecUndo(), true);
  assert.strictEqual(file.cases.length, 2);
  assert.deepStrictEqual(pendingClears, ['temp-1']);

  const appendResult = owner.appendTempExecAiCases(file.id, [
    { module: '登录', title: '登录失败', expected: '提示失败' },
    { module: '搜索', title: '关键词搜索', priority: 'P2', expected: '展示结果' },
    { module: '', title: '无模块', expected: '忽略' },
  ]);
  assert.deepStrictEqual(appendResult, { ok: true, count: 2 });
  assert.deepStrictEqual(file.cases.map((item) => item.module), ['登录', '登录', '支付', '搜索']);
  assert.strictEqual(file.cases[1].priority, 'P1');
  assert.strictEqual(file.cases[3].priority, 'P2');

  const removedTitle = file.cases[2].title;
  owner.removeTempExecCase(file.id, 2);
  await Promise.resolve();
  assert.strictEqual(file.cases.some((item) => item.title === removedTitle), false);
  assert.strictEqual(owner.restoreTempExecUndo(), true);
  assert.strictEqual(file.cases[2].title, removedTitle);
  assert.ok(persisted >= 8);
  assert.ok(rendered >= 9);
  assert.ok(clearedStates >= 4);
}

function verifyOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const coreSource = fs.readFileSync(path.join(root, 'scripts/core/tempexecCore.js'), 'utf8');
  const ownerSource = fs.readFileSync(path.join(root, 'scripts/core/tempExecCaseMutationOwner.js'), 'utf8');
  assert.ok(coreSource.indexOf('caseMutationOwner.create') !== -1);
  assert.ok(coreSource.indexOf('function updateTempExecResult(') === -1);
  assert.ok(coreSource.indexOf('function startTempExecUndoTimer(') === -1);
  assert.ok(coreSource.indexOf('function insertTempExecCase(') === -1);
  assert.ok(coreSource.indexOf('function updateTempExecCaseField(') === -1);
  assert.ok(coreSource.split('\n').length < 2100, 'tempexecCore.js should stay below the mutation split target');
  assert.ok(ownerSource.indexOf('blockWhenMutationPending') !== -1);
  assert.ok(ownerSource.indexOf('resolveTempExecCaseFieldChange') !== -1);

  const entries = [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ];
  entries.forEach((entry) => {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const interactionIndex = html.indexOf('tempExecCaseInteractionOwner.js');
    const mutationIndex = html.indexOf('tempExecCaseMutationOwner.js');
    const reuseIndex = html.indexOf('tempExecReuseOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(interactionIndex >= 0, entry + ' is missing the interaction owner');
    assert.ok(mutationIndex >= 0, entry + ' is missing the mutation owner');
    assert.ok(reuseIndex >= 0, entry + ' is missing the reuse owner');
    assert.ok(interactionIndex < mutationIndex, entry + ' has invalid interaction/mutation order');
    assert.ok(mutationIndex < reuseIndex && reuseIndex < coreIndex, entry + ' has invalid mutation owner order');
  });
}

(async function run() {
  verifyPureRules();
  await verifyMutationWorkflow();
  verifyOwnershipAndEntryOrder();
  console.log('temp exec case mutation owner tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
