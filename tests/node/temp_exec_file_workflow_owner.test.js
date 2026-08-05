const assert = require('assert');
const fs = require('fs');
const path = require('path');

const fileWorkflowFactory = require('../../scripts/core/tempExecFileWorkflowOwner.js');

function verifyPureRules() {
  assert.deepStrictEqual(fileWorkflowFactory.createEmptyTempExecPlacement(), {
    requirementOrder: [],
    fileOrder: {},
    versionOrder: [],
    projectOrder: [],
    versionOrderByProject: {},
    fileOrderByProjectVersion: {},
  });
  assert.deepStrictEqual(fileWorkflowFactory.stripTempExecExecutionFields({
    module: '登录',
    title: '正常登录',
    actual: '通过',
    remark: '完成',
    defectLinks: [{ url: 'bug' }],
    reuseDetails: [{ text: 'Chrome' }],
    actual_result: '通过',
  }), {
    module: '登录',
    title: '正常登录',
  });
}

async function verifyFileWorkflow() {
  const state = {
    requirementLabel: '',
    tempExecActiveId: 'active-file',
    tempExecFiles: [{
      id: 'active-file',
      name: '登录执行',
      requirement: 'REQ-LOGIN',
      cases: [{
        module: '登录',
        title: '正常登录',
        expected: '成功',
        actual: '通过',
        remark: '完成',
        defectLinks: [{ url: 'bug' }],
        reuseDetails: [{ text: 'Chrome' }],
      }],
    }],
    tempExecFocus: ['active-file'],
    tempExecPages: {},
  };
  const calls = {
    downloads: [],
    exportCases: null,
    inserted: [],
    requirementOrders: [],
    focusSaves: 0,
    focusSyncs: 0,
    placementSyncs: 0,
    persisted: 0,
    activeIds: [],
    labels: [],
    statuses: [],
  };
  let generatedId = 0;
  const owner = fileWorkflowFactory.create({
    state,
    tempExecStatus: {},
    normalizeRequirementName(value) {
      return String(value || '').trim();
    },
    getRequirementLabel() {
      return state.requirementLabel;
    },
    ensureRequirementLabel() {
      return 'REQ-FALLBACK';
    },
    setRequirementLabel(value, source) {
      state.requirementLabel = value;
      calls.labels.push([value, source]);
    },
    stripTimestampSuffix(value) {
      return value;
    },
    buildTempExecXmindPackage(file, requirement) {
      assert.strictEqual(file.id, 'active-file');
      assert.strictEqual(requirement, 'REQ-LOGIN');
      return Promise.resolve({ blob: 'exec-blob', fileName: 'exec.xmind', count: 1 });
    },
    buildXmindPackageFromCases(cases, fileName, requirement) {
      calls.exportCases = { cases, fileName, requirement };
      return Promise.resolve({ blob: 'cases-blob' });
    },
    getTempExecFileBaseName() {
      return 'login_cases';
    },
    formatCompactTimestamp() {
      return '20260728_120000';
    },
    downloadBlob(fileName, blob) {
      calls.downloads.push([fileName, blob]);
    },
    setStatus(element, text, tone) {
      calls.statuses.push([text, tone]);
    },
    getTempExecFile(fileId) {
      return state.tempExecFiles.find((file) => file.id === fileId) || null;
    },
    generateTempExecId() {
      generatedId += 1;
      return 'generated-' + generatedId;
    },
    normalizeTempExecCases(cases, fileId) {
      return (cases || []).map((item) => Object.assign({ normalizedFor: fileId }, item));
    },
    insertFileIntoOrder(requirement, fileId) {
      calls.inserted.push([requirement, fileId]);
    },
    ensureRequirementOrder(requirements) {
      calls.requirementOrders.push(requirements.slice());
    },
    saveTempExecFocus() {
      calls.focusSaves += 1;
    },
    parseTempExecImportFile(file) {
      return Promise.resolve({
        cases: [{ module: '模块', title: file.name, expected: '成功' }],
        requirementFromContent: file.name.indexOf('a.') === 0 ? 'REQ-A' : 'REQ-B',
        hasResult: file.name.indexOf('b.') === 0,
        inferredReuse: file.name.indexOf('b.') === 0,
      });
    },
    ensureTempExecReplacement() {
      return true;
    },
    syncTempExecFocus() {
      calls.focusSyncs += 1;
    },
    ensureTempExecPlacement() {
      return state.tempExecPlacement;
    },
    syncTempExecPlacement() {
      calls.placementSyncs += 1;
    },
    persistTempExecState() {
      calls.persisted += 1;
    },
    setTempExecActive(fileId) {
      state.tempExecActiveId = fileId;
      calls.activeIds.push(fileId);
    },
  });

  await owner.exportTempExecToXmind();
  await owner.exportTempExecCasesToXmind();
  assert.deepStrictEqual(calls.downloads, [
    ['exec.xmind', 'exec-blob'],
    ['login_cases_20260728_120000.xmind', 'cases-blob'],
  ]);
  assert.deepStrictEqual(calls.exportCases.cases, [{
    module: '登录',
    title: '正常登录',
    expected: '成功',
  }]);
  assert.strictEqual(calls.exportCases.fileName, '登录执行');
  assert.strictEqual(calls.exportCases.requirement, 'REQ-LOGIN');

  const created = owner.createTempExecFile('手工文件', [{ title: '用例' }], 'history', 'manual-id', 123, 'REQ-MANUAL');
  assert.strictEqual(created.id, 'manual-id');
  assert.strictEqual(created.scope, 'history');
  assert.strictEqual(created.createdAt, 123);
  assert.strictEqual(created.cases[0].normalizedFor, 'manual-id');

  state.requirementLabel = '';
  state.tempExecFiles = [];
  state.tempExecActiveId = '';
  state.tempExecFocus = [];
  await owner.importTempExecFiles([{ name: 'b.json' }, { name: 'a.json' }]);
  assert.deepStrictEqual(state.tempExecFiles.map((file) => file.name), ['a.json', 'b.json']);
  assert.deepStrictEqual(state.tempExecFiles.map((file) => file.id), ['generated-1', 'generated-2']);
  assert.strictEqual(state.tempExecFiles[1].reuseEnabled, true);
  assert.strictEqual(state.tempExecFiles[1].cases[0].normalizedFor, undefined);
  assert.strictEqual(state.tempExecPages['generated-1'], 0);
  assert.strictEqual(state.tempExecPages['generated-2'], 0);
  assert.deepStrictEqual(calls.activeIds, ['generated-2']);
  assert.strictEqual(calls.focusSaves, 1);
  assert.strictEqual(calls.focusSyncs, 1);
  assert.strictEqual(calls.placementSyncs, 1);
  assert.strictEqual(calls.persisted, 1);
  assert.ok(calls.labels.some(([value, source]) => value === 'REQ-A' && source === 'import'));
  assert.ok(calls.statuses.some(([text, tone]) => text === '已导入 2 份测试用例' && tone === 'ok'));
}

function verifyOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const coreSource = fs.readFileSync(path.join(root, 'scripts/core/tempexecCore.js'), 'utf8');
  const ownerSource = fs.readFileSync(path.join(root, 'scripts/core/tempExecFileWorkflowOwner.js'), 'utf8');
  assert.ok(coreSource.indexOf('fileWorkflowOwner.create') !== -1);
  assert.ok(coreSource.indexOf('function exportTempExecToXmind(') === -1);
  assert.ok(coreSource.indexOf('function exportTempExecCasesToXmind(') === -1);
  assert.ok(coreSource.indexOf('function createTempExecFile(') === -1);
  assert.ok(coreSource.indexOf('function importTempExecFiles(') === -1);
  assert.ok(coreSource.split('\n').length < 1700, 'tempexecCore.js should stay below the file workflow split target');
  assert.ok(ownerSource.indexOf('stripTempExecExecutionFields') !== -1);
  assert.ok(ownerSource.indexOf('resolveExportRequirement') !== -1);

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach((entry) => {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const workspaceIndex = html.indexOf('tempExecWorkspaceMutationOwner.js');
    const fileWorkflowIndex = html.indexOf('tempExecFileWorkflowOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(workspaceIndex >= 0, entry + ' is missing the workspace mutation owner');
    assert.ok(fileWorkflowIndex > workspaceIndex, entry + ' has invalid file workflow order');
    assert.ok(coreIndex > fileWorkflowIndex, entry + ' must load file workflow before tempexecCore');
  });
}

(async function run() {
  verifyPureRules();
  await verifyFileWorkflow();
  verifyOwnershipAndEntryOrder();
  console.log('temp exec file workflow owner tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
