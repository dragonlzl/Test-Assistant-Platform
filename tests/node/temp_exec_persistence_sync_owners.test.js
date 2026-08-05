const assert = require('assert');
const fs = require('fs');
const path = require('path');

const persistenceFactory = require('../../scripts/core/tempExecPersistenceOwner.js');
const syncFactory = require('../../scripts/core/tempExecCaseLibrarySyncOwner.js');
const parserFactory = require('../../scripts/core/tempExecImportParserOwner.js');
const dbImportFactory = require('../../scripts/core/tempExecDbImportOwner.js');
const reuseFactory = require('../../scripts/core/tempExecReuseOwner.js');

function createStorage() {
  const values = {};
  return {
    values,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      values[key] = String(value);
    },
    removeItem(key) {
      delete values[key];
    },
  };
}

async function verifyPersistenceOwner() {
  const storage = createStorage();
  const sessionStorage = createStorage();
  const patchCalls = [];
  let pageResetCalls = 0;
  const client = {
    updateExecCase(id, patch) {
      patchCalls.push([id, patch]);
      return Promise.resolve();
    },
    listExecSets() { return Promise.resolve([]); },
    listExecCases() { return Promise.resolve([]); },
  };
  const state = {
    tempExecFiles: [{ id: 'file-a', cases: [] }],
    tempExecVersions: [{ id: 'version-a' }],
    tempExecPlacement: { requirementOrder: ['REQ-A'] },
    tempExecFocus: ['file-a'],
    tempExecActiveId: 'file-a',
  };
  const windowRef = {
    app: {
      authReady: false,
      apiClient: client,
      state,
    },
  };
  const owner = persistenceFactory.create({
    state,
    window: windowRef,
    storage,
    sessionStorage,
    tempExecStorageKey: 'temp-state',
    tempExecFocusStorageKey: 'temp-focus',
    defaultPlacement: {},
    defaultTempExecPageSize: 20,
    patchDelayMs: 0,
    serializeTempExecFiles() { return state.tempExecFiles.slice(); },
    serializeTempExecVersions() { return state.tempExecVersions.slice(); },
    resetTempExecPages() { pageResetCalls += 1; },
  });

  assert.strictEqual(owner.isDbMode(), false);
  assert.strictEqual(owner.refreshTempExecStateOnTabActivation(), null);
  assert.strictEqual(pageResetCalls, 0);
  owner.persistTempExecState();
  const saved = JSON.parse(storage.values['temp-state']);
  assert.strictEqual(saved.activeId, 'file-a');
  assert.deepStrictEqual(saved.files, state.tempExecFiles);

  storage.values['temp-focus'] = JSON.stringify(['file-a', 1]);
  owner.loadTempExecFocus();
  assert.deepStrictEqual(state.tempExecFocus, ['file-a']);
  owner.saveTempExecFocus();
  assert.strictEqual(storage.values['temp-focus'], JSON.stringify(['file-a']));

  windowRef.app.authReady = true;
  state.currentUser = { id: 7 };
  assert.strictEqual(owner.isDbMode(), true);
  owner.queueExecCasePatch(11, { status: '通过' });
  owner.queueExecCasePatch(11, { remark: 'done' });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepStrictEqual(patchCalls, [[11, { status: '通过', remark: 'done' }]]);

  assert.strictEqual(owner.normalizeExecCaseStatus({ status: 'pending' }), '未执行');
  assert.strictEqual(owner.normalizeExecCaseRemark({ status: 'pending', actual_result: '补充说明' }), '补充说明');
  const mapped = owner.mapExecCaseToTempCase({
    id: 9,
    module: '登录',
    title: '正常登录',
    status: '通过',
    defect_links: 'https://example.com/bug/1',
  });
  assert.strictEqual(mapped.execCaseId, 9);
  assert.strictEqual(mapped.actual, '通过');
  assert.strictEqual(mapped.defectLinks.length, 1);
}

function verifySyncOwner() {
  const sessionStorage = createStorage();
  const state = {
    activeTab: 'tempexec',
    tempExecActiveId: '12',
    tempExecFiles: [{ id: '12', execSetId: 12, caseFileId: 3 }],
  };
  const opened = [];
  const windowRef = {
    app: { __tempexecCaseLibrarySyncSeq: 2, config: {} },
  };
  const owner = syncFactory.create({
    state,
    window: windowRef,
    sessionStorage,
    getTempExecFile(id) {
      return state.tempExecFiles.find((file) => String(file.id) === String(id)) || null;
    },
    openTempExecCaseLibraryDiffDrawer(options) {
      opened.push(options);
      return true;
    },
    syncTempExecCaseLibraryChangesButton() {},
    renderTempExecCaseLibraryDiffCaseTabs() {},
  });

  assert.strictEqual(owner.parseDbTimeMs('2026-07-24 03:00:00'), Date.parse('2026-07-24T03:00:00Z'));
  const meta = owner.applyTempExecCaseLibrarySyncMeta(state.tempExecFiles[0], {
    exec_set_id: 12,
    case_file_id: 3,
    should_auto_popup: true,
    has_new_diff: true,
    last_diff_at: '2026-07-24T03:00:00Z',
    summary: { added: 1 },
  });
  assert.strictEqual(meta.summary.added, 1);
  assert.strictEqual(owner.hasCaseLibraryChangeSignal(meta), true);
  assert.strictEqual(owner.getTempExecFileNameByExecSetId('12'), '执行集#12');
  state.tempExecFiles[0].name = '登录执行集';
  assert.strictEqual(owner.getTempExecFileNameByExecSetId('12'), '登录执行集');
  assert.strictEqual(owner.maybeOpenTempExecCaseLibraryAutoPopup(true, '12'), true);
  assert.deepStrictEqual(opened, [{ auto: true, execSetId: '12' }]);
  assert.strictEqual(owner.consumeTempExecCaseLibrarySyncTrigger(), true);
  assert.strictEqual(owner.consumeTempExecCaseLibrarySyncTrigger(), false);
}

async function verifyImportParserOwner() {
  let detailSeed = 0;
  const owner = parserFactory.create({
    tempExecResultOptions: ['未执行', '通过', '失败'],
    generateDefectLinkId() {
      detailSeed += 1;
      return 'defect-' + detailSeed;
    },
    generateReuseDetailId() {
      detailSeed += 1;
      return 'detail-' + detailSeed;
    },
    normalizeRequirementName(value) {
      return String(value || '').trim();
    },
    deriveCaseListFromText() { return []; },
    parseXmindFile() { return Promise.resolve({ text: '', list: [] }); },
  });

  const rows = [
    ['模块', '用例标题', '预期结果', '实际结果', '备注', '缺陷链接'],
    ['登录', '正常登录', '登录成功', '通过', 'ok', 'https://example.com/bug/1'],
  ];
  const parsedRows = owner.buildTempExecCasesFromXlsxRows(rows);
  assert.strictEqual(parsedRows.cases.length, 1);
  assert.strictEqual(parsedRows.hasResult, true);
  assert.strictEqual(parsedRows.cases[0].defectLinks.length, 1);

  const jsonFile = {
    name: 'login.json',
    text() {
      return Promise.resolve(JSON.stringify({
        requirement: 'REQ-LOGIN',
        cases: [{ module: '登录', title: '正常登录', expected: '成功' }],
      }));
    },
  };
  const parsedFile = await owner.parseTempExecImportFile(jsonFile);
  assert.strictEqual(parsedFile.requirementFromContent, 'REQ-LOGIN');
  assert.strictEqual(parsedFile.cases.length, 1);
  assert.strictEqual(owner.buildCaseItemPayloadFromTempCase(parsedFile.cases[0]).module, '登录');
}

async function verifyDbImportOwnerFallback() {
  let localImports = 0;
  const owner = dbImportFactory.create({
    isDbMode() { return false; },
    importTempExecFiles() {
      localImports += 1;
      return Promise.resolve();
    },
  });
  const result = await owner.importTempExecFilesToDb([], '', '', '');
  assert.strictEqual(localImports, 1);
  assert.deepStrictEqual(result, { imported: 0, failed: [], mode: 'local' });
}

function verifyReuseOwner() {
  let detailSeed = 0;
  let presetSeed = 0;
  let persisted = 0;
  let rendered = 0;
  const reuseOpen = new Set();
  const file = {
    id: 'reuse-file',
    projectId: 'project-1',
    reuseEnabled: true,
    reusePresets: [{ id: 'preset-1', text: 'Android' }],
    cases: [{ actual: '未执行', reuseDetails: [] }],
  };
  const state = { tempExecPresetDraft: null };
  const owner = reuseFactory.create({
    state,
    generateReuseDetailId() {
      detailSeed += 1;
      return 'detail-' + detailSeed;
    },
    generateReusePresetId() {
      presetSeed += 1;
      return 'preset-new-' + presetSeed;
    },
    getTempExecFile(fileId) {
      return fileId === file.id ? file : null;
    },
    isReuseDetailRemoved(detail) {
      return Boolean(detail && detail.removed);
    },
    ensureTempExecReuseOpen(fileId) {
      return fileId === file.id ? reuseOpen : new Set();
    },
    persistTempExecState() { persisted += 1; },
    renderTempExecView() { rendered += 1; },
  });

  assert.strictEqual(owner.applyPresetsToCase(file, file.cases[0]), true);
  assert.strictEqual(file.cases[0].reuseDetails.length, 1);
  assert.strictEqual(file.cases[0].reuseDetails[0].presetId, 'preset-1');
  assert.strictEqual(owner.applyPresetsToCase(file, file.cases[0]), false);
  assert.deepStrictEqual(owner.aggregateReuseDetails([
    { status: '通过' },
    { status: '失败' },
    { status: '阻塞', removed: true },
    { status: '不适用' },
    { status: '未执行' },
  ]), { pending: 1, passed: 1, failed: 1, blocked: 0, unspecified: 1 });
  assert.strictEqual(owner.resolveReuseAggregateStatus([{ status: '失败' }]), '失败');
  assert.strictEqual(owner.resolveReuseAggregateStatus([{ status: '不适用' }]), '不适用');
  assert.deepStrictEqual(owner.getCaseExecutionDisplay(file, { actual: '变更重跑' }), {
    label: '变更重跑',
    className: 'changed',
  });

  owner.toggleTempExecReusePanel(file.id, [0]);
  assert.deepStrictEqual(Array.from(reuseOpen), [0]);
  owner.toggleTempExecReusePanel(file.id, [0]);
  assert.deepStrictEqual(Array.from(reuseOpen), []);

  owner.startTempExecPresetDraft(file.id);
  owner.updateTempExecPresetDraft('iOS');
  owner.confirmTempExecPresetDraft(file.id);
  assert.strictEqual(file.reusePresets.length, 2);
  assert.strictEqual(file.cases[0].reuseDetails.length, 2);
  assert.strictEqual(state.tempExecPresetDraft, null);
  assert.strictEqual(persisted, 1);
  assert.ok(rendered >= 2);
}

function verifyOwnershipAndLoadOrder() {
  const projectRoot = path.join(__dirname, '..', '..');
  const parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempexecCore.js'), 'utf8');
  const persistenceSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecPersistenceOwner.js'), 'utf8');
  const syncSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecCaseLibrarySyncOwner.js'), 'utf8');
  const parserSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecImportParserOwner.js'), 'utf8');
  const dbImportSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecDbImportOwner.js'), 'utf8');
  const reuseSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecReuseOwner.js'), 'utf8');
  const mutationSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecCaseMutationOwner.js'), 'utf8');
  const workspaceMutationSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecWorkspaceMutationOwner.js'), 'utf8');
  const fileWorkflowSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecFileWorkflowOwner.js'), 'utf8');

  assert.match(persistenceSource, /function persistTempExecState\(/);
  assert.match(persistenceSource, /function loadTempExecStateFromDb\(/);
  assert.match(syncSource, /function normalizeCaseLibrarySyncMeta\(/);
  assert.match(parserSource, /function buildTempExecCasesFromXlsxRows\(/);
  assert.match(dbImportSource, /function importTempExecFilesToDb\(/);
  assert.match(reuseSource, /function ensureReusePresets\(/);
  assert.match(reuseSource, /function renderReusePresetPanel\(/);
  assert.match(reuseSource, /function handleTempExecReuseToggle\(/);
  assert.match(mutationSource, /function updateTempExecResult\(/);
  assert.match(mutationSource, /function insertTempExecCase\(/);
  assert.match(workspaceMutationSource, /function removeTempExecFile\(/);
  assert.match(workspaceMutationSource, /function reorderTempExecProject\(/);
  assert.match(fileWorkflowSource, /function exportTempExecToXmind\(/);
  assert.match(fileWorkflowSource, /function importTempExecFiles\(/);
  assert.doesNotMatch(parentSource, /function persistTempExecState\(/);
  assert.doesNotMatch(parentSource, /function loadTempExecStateFromDb\(/);
  assert.doesNotMatch(parentSource, /function normalizeCaseLibrarySyncMeta\(/);
  assert.doesNotMatch(parentSource, /function buildTempExecCasesFromXlsxRows\(/);
  assert.doesNotMatch(parentSource, /function importTempExecFilesToDb\(/);
  assert.doesNotMatch(parentSource, /function ensureReusePresets\(/);
  assert.doesNotMatch(parentSource, /function renderReusePresetPanel\(/);
  assert.doesNotMatch(parentSource, /function handleTempExecReuseToggle\(/);
  assert.doesNotMatch(parentSource, /function updateTempExecResult\(/);
  assert.doesNotMatch(parentSource, /function insertTempExecCase\(/);
  assert.doesNotMatch(parentSource, /function removeTempExecFile\(/);
  assert.doesNotMatch(parentSource, /function reorderTempExecProject\(/);
  assert.doesNotMatch(parentSource, /function exportTempExecToXmind\(/);
  assert.doesNotMatch(parentSource, /function importTempExecFiles\(/);
  assert.match(parentSource, /persistenceOwner\.create\(\{/);
  assert.match(parentSource, /caseLibrarySyncOwner\.create\(\{/);
  assert.doesNotMatch(parentSource, /caseLibrarySyncApi\.getTempExecFileNameByExecSetId\(execSetId\)/);
  assert.match(parentSource, /importParserOwner\.create\(\{/);
  assert.match(parentSource, /dbImportOwner\.create\(\{/);
  assert.match(parentSource, /reuseOwner\.create\(\{/);
  assert.match(parentSource, /caseMutationOwner\.create\(\{/);
  assert.match(parentSource, /workspaceMutationOwner\.create\(\{/);
  assert.match(parentSource, /fileWorkflowOwner\.create\(\{/);
  assert.match(parentSource, /var persistTempExecStatePort = function\(\)/);
  assert.strictEqual(
    (parentSource.match(/persistTempExecState: persistTempExecStatePort/g) || []).length,
    8
  );
  assert.match(parentSource, /var ensureReusePresets = reuseApi\.ensureReusePresets;/);

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach((fileName) => {
    const html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    const syncIndex = html.indexOf('tempExecCaseLibrarySyncOwner.js');
    const parserIndex = html.indexOf('tempExecImportParserOwner.js');
    const persistenceIndex = html.indexOf('tempExecPersistenceOwner.js');
    const dbImportIndex = html.indexOf('tempExecDbImportOwner.js');
    const reuseIndex = html.indexOf('tempExecReuseOwner.js');
    const mutationIndex = html.indexOf('tempExecCaseMutationOwner.js');
    const workspaceMutationIndex = html.indexOf('tempExecWorkspaceMutationOwner.js');
    const fileWorkflowIndex = html.indexOf('tempExecFileWorkflowOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(syncIndex >= 0, fileName + ' must load the sync owner');
    assert.ok(parserIndex > syncIndex, fileName + ' must load the parser after sync');
    assert.ok(persistenceIndex > parserIndex, fileName + ' must load persistence after parser');
    assert.ok(dbImportIndex > persistenceIndex, fileName + ' must load db import after persistence');
    assert.ok(mutationIndex >= 0, fileName + ' must load the mutation owner');
    assert.ok(workspaceMutationIndex > mutationIndex, fileName + ' must load workspace mutation after case mutation');
    assert.ok(fileWorkflowIndex > workspaceMutationIndex, fileName + ' must load file workflow after workspace mutation');
    assert.ok(reuseIndex > dbImportIndex, fileName + ' must load reuse after db import');
    assert.ok(fileWorkflowIndex < reuseIndex, fileName + ' must load file owners before reuse');
    assert.ok(coreIndex > reuseIndex, fileName + ' must load all owners before tempexecCore');
  });
}

async function run() {
  await verifyPersistenceOwner();
  verifySyncOwner();
  await verifyImportParserOwner();
  await verifyDbImportOwnerFallback();
  verifyReuseOwner();
  verifyOwnershipAndLoadOrder();
  console.log('temp exec persistence and sync owner tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
