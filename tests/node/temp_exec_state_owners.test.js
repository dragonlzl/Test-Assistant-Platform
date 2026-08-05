const assert = require('assert');
const fs = require('fs');
const path = require('path');

const snapshotFactory = require('../../scripts/core/tempExecStateSnapshotOwner.js');
const placementFactory = require('../../scripts/core/tempExecPlacementVersionOwner.js');
const interactionFactory = require('../../scripts/core/tempExecCaseInteractionOwner.js');

function normalizeRequirementName(value) {
  return String(value || '').trim();
}

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
  };
}

function verifySnapshotOwner() {
  const state = {
    settings: {},
    tempExecFiles: [],
    tempExecVersions: [],
    tempExecPages: {},
  };
  const calls = {
    versions: [],
    renders: 0,
    persisted: 0,
    pageSize: 0,
  };
  let idSeed = 0;
  const owner = snapshotFactory.create({
    state,
    storage: createStorage(),
    normalizeRequirementName,
    generateTempExecId() {
      idSeed += 1;
      return 'file-' + idSeed;
    },
    generateReuseDetailId() {
      idSeed += 1;
      return 'detail-' + idSeed;
    },
    generateReusePresetId() {
      idSeed += 1;
      return 'preset-' + idSeed;
    },
    generateDefectLinkId() {
      idSeed += 1;
      return 'defect-' + idSeed;
    },
    stringifyCaseField(value) {
      return value === null || value === undefined ? '' : String(value);
    },
    getRequirementLabel() {
      return 'REQ-DEFAULT';
    },
    applyVersionAssignments(versions) {
      calls.versions = versions;
      state.tempExecVersions = versions.slice();
    },
    resetTempExecPages() {
      state.tempExecPages = {};
    },
    applyTempExecPageSize(value) {
      calls.pageSize = value;
    },
    syncTempExecPlacement() {},
    persistTempExecState() {
      calls.persisted += 1;
    },
    renderTempExecNav() {
      calls.renders += 1;
    },
    renderTempExecView() {
      calls.renders += 1;
    },
    renderTempVersionGrid() {
      calls.renders += 1;
    },
  });

  const cases = owner.normalizeTempExecCases([{
    module_name: '登录',
    case_title: '正常登录',
    level: 'P0',
    actions: '输入账号',
    result: '登录成功',
    reuseDetails: [{ text: 'Chrome', status: '通过' }],
    defectLinks: [{ url: 'example.com/bug/1' }],
  }], 'file-a');
  assert.strictEqual(cases.length, 1);
  assert.strictEqual(cases[0].module, '登录');
  assert.strictEqual(cases[0].title, '正常登录');
  assert.strictEqual(cases[0].reuseDetails[0].status, '通过');
  assert.strictEqual(cases[0].defectLinks[0].url, 'example.com/bug/1');

  const placement = owner.normalizeTempExecPlacement({
    requirementOrder: [' REQ-1 ', ''],
    fileOrder: { ' REQ-1 ': [1, 'file-a', null] },
    projectOrder: [9],
  });
  assert.deepStrictEqual(placement.requirementOrder, ['REQ-1']);
  assert.deepStrictEqual(placement.fileOrder['REQ-1'], ['1', 'file-a']);
  assert.deepStrictEqual(placement.projectOrder, ['9']);

  owner.applyTempExecSnapshot({
    requirement: 'REQ-IMPORTED',
    files: [{
      id: 'file-a',
      name: '登录用例',
      cases,
      requirement: 'REQ-1',
      reusePresets: [{ id: 'preset-a', text: 'Chrome' }],
    }],
    versions: [{ id: 'version-a', name: 'V1', fileIds: ['file-a'] }],
    focus: ['file-a', 'missing'],
    activeId: 'file-a',
    pageSize: 50,
    placement,
  });
  assert.strictEqual(state.tempExecFiles.length, 1);
  assert.strictEqual(state.tempExecActiveId, 'file-a');
  assert.deepStrictEqual(state.tempExecFocus, ['file-a']);
  assert.strictEqual(calls.versions.length, 1);
  assert.strictEqual(calls.pageSize, 50);
  assert.strictEqual(calls.persisted, 1);
  assert.strictEqual(calls.renders, 3);
}

function verifyPlacementOwner() {
  const state = {
    settings: {},
    tempExecFiles: [
      { id: 'file-a', requirement: 'REQ-A', versionId: '', cases: [{}, {}], createdAt: 20 },
      { id: 'file-b', requirement: 'REQ-B', versionId: '', cases: [{}], createdAt: 10 },
    ],
    tempExecVersions: [],
    tempExecPages: {},
  };
  const storage = createStorage();
  let persisted = 0;
  const owner = placementFactory.create({
    state,
    storage,
    normalizeRequirementName,
    normalizeTempExecPlacement(value) {
      return Object.assign({
        requirementOrder: [],
        fileOrder: {},
        versionOrder: [],
        projectOrder: [],
        versionOrderByProject: {},
        fileOrderByProjectVersion: {},
      }, value || {});
    },
    normalizeTempExecName(value) {
      return String(value || '').trim().toLowerCase();
    },
    generateTempVersionId() {
      return 'version-a';
    },
    getTempExecFile(fileId) {
      return state.tempExecFiles.find((file) => file.id === fileId) || null;
    },
    getTempExecFilesByRequirement(requirement) {
      return state.tempExecFiles.filter((file) => file.requirement === requirement);
    },
    persistTempExecState() {
      persisted += 1;
    },
  });

  owner.syncTempExecPlacement();
  assert.deepStrictEqual(state.tempExecPlacement.requirementOrder, ['REQ-A', 'REQ-B']);
  assert.deepStrictEqual(state.tempExecPlacement.fileOrder['REQ-A'], ['file-a']);
  assert.deepStrictEqual(state.tempExecPlacement.fileOrder['REQ-B'], ['file-b']);

  owner.applyVersionAssignments([{
    id: 'version-a',
    name: '版本 A',
    fileIds: ['file-a', 'file-a', 'missing'],
  }]);
  assert.deepStrictEqual(state.tempExecVersions[0].fileIds, ['file-a']);
  assert.strictEqual(state.tempExecFiles[0].versionId, 'version-a');
  assert.strictEqual(state.tempExecFiles[1].versionId, '');
  assert.deepStrictEqual(owner.getVersionRequirementBlocks(state.tempExecVersions[0]), [{
    key: 'REQ-A::1',
    req: 'REQ-A',
    ids: ['file-a'],
  }]);

  const firstPageSize = owner.applyTempExecPageSize(500);
  assert.deepStrictEqual(firstPageSize, { size: 200, changed: true });
  assert.strictEqual(storage.values['tempexec-page-size'], '200');
  assert.strictEqual(owner.getTempExecPageSize(), 200);
  assert.ok(persisted >= 0);
}

async function verifyInteractionOwner() {
  const file = {
    id: 'file-a',
    cases: [{ defectLinks: [] }],
  };
  const state = {};
  const patches = [];
  const opened = [];
  let persisted = 0;
  let rendered = 0;
  const owner = interactionFactory.create({
    state,
    window: {
      open(url, target) {
        opened.push([url, target]);
      },
    },
    generateDefectLinkId() {
      return 'defect-a';
    },
    getTempExecFile(fileId) {
      return fileId === file.id ? file : null;
    },
    isDbMode() {
      return true;
    },
    queueExecCasePatchForItem(item, patch) {
      patches.push([item, patch]);
    },
    persistTempExecState() {
      persisted += 1;
    },
    renderTempExecView() {
      rendered += 1;
    },
    openConfirmDrawer() {
      return Promise.resolve({ ok: true });
    },
  });

  assert.strictEqual(owner.ensureTempExecSelection('file-a') instanceof Set, true);
  owner.ensureTempExecSelection('file-a').add(0);
  owner.clearTempExecCaseStates('file-a');
  assert.strictEqual(owner.ensureTempExecSelection('file-a').size, 0);

  owner.addTempExecDefectLink('file-a', 0);
  assert.deepStrictEqual(file.cases[0].defectLinks, [{ id: 'defect-a', url: '' }]);
  owner.updateTempExecDefectLink('file-a', 0, 'defect-a', 'example.com/bug/1');
  owner.openTempExecDefectLink('file-a', 0, 'defect-a');
  assert.deepStrictEqual(opened, [['https://example.com/bug/1', '_blank']]);
  owner.removeTempExecDefectLink('file-a', 0, 'defect-a');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepStrictEqual(file.cases[0].defectLinks, []);
  assert.strictEqual(patches.length, 3);
  assert.strictEqual(persisted, 3);
  assert.strictEqual(rendered, 2);

  owner.applyTempExecSearch('file-a', ' Login ', ' Login ');
  assert.deepStrictEqual(state.tempExecSearch, {
    fileId: 'file-a',
    term: 'login',
    raw: ' Login ',
  });
}

function verifyOwnershipAndLoadOrder() {
  const projectRoot = path.join(__dirname, '..', '..');
  const parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempexecCore.js'), 'utf8');
  assert.doesNotMatch(parentSource, /function normalizeTempExecCases\(/);
  assert.doesNotMatch(parentSource, /function ensureTempExecPlacement\(/);
  assert.doesNotMatch(parentSource, /function ensureTempExecSelection\(/);
  assert.match(parentSource, /stateSnapshotOwner\.create\(\{/);
  assert.match(parentSource, /placementVersionOwner\.create\(\{/);
  assert.match(parentSource, /caseInteractionOwner\.create\(\{/);

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
    const snapshotIndex = html.indexOf('tempExecStateSnapshotOwner.js');
    const placementIndex = html.indexOf('tempExecPlacementVersionOwner.js');
    const interactionIndex = html.indexOf('tempExecCaseInteractionOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(snapshotIndex >= 0, fileName + ' must load the snapshot owner');
    assert.ok(placementIndex > snapshotIndex, fileName + ' must load placement after snapshot');
    assert.ok(interactionIndex > placementIndex, fileName + ' must load interaction after placement');
    assert.ok(coreIndex > interactionIndex, fileName + ' must load owners before tempexecCore');
  });
}

async function run() {
  verifySnapshotOwner();
  verifyPlacementOwner();
  await verifyInteractionOwner();
  verifyOwnershipAndLoadOrder();
  console.log('temp exec state owner tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
