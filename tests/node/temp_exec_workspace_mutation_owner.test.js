const assert = require('assert');
const fs = require('fs');
const path = require('path');

const workspaceFactory = require('../../scripts/core/tempExecWorkspaceMutationOwner.js');

function verifyPureRules() {
  assert.strictEqual(workspaceFactory.normalizeWorkspaceId(12), '12');
  assert.strictEqual(workspaceFactory.normalizeWorkspaceId(null), '');
  assert.deepStrictEqual(workspaceFactory.normalizeWorkspaceFileIds(['1', 2, null]), ['1', '2']);
  assert.deepStrictEqual(workspaceFactory.normalizeWorkspaceFileIds('1, 2,,'), ['1', '2']);
  assert.deepStrictEqual(workspaceFactory.reorderWorkspaceIds(['a', 'b', 'c'], 'a', 'c', false), ['b', 'a', 'c']);
  assert.deepStrictEqual(workspaceFactory.reorderWorkspaceIds(['a', 'b', 'c'], 'a', 'c', true), ['b', 'c', 'a']);
}

async function verifyWorkspaceMutationWorkflow() {
  const placement = {
    projectOrder: ['p1', 'p2', 'p3'],
    versionOrderByProject: { p1: ['v1', 'v2'], p2: ['v1', 'v2'] },
    fileOrder: { REQ: ['1', '2', '3', '4', '5'] },
    fileOrderByProjectVersion: {
      p1: { v1: ['1'], v2: ['2'] },
      p2: { v1: ['3', '5'], v2: ['4'] },
    },
  };
  const state = {
    tempExecFiles: [
      { id: '1', execSetId: 11, projectId: 'p1', versionId: 'v1', scope: 'current' },
      { id: '2', execSetId: 12, projectId: 'p1', versionId: 'v2', scope: 'current' },
      { id: '3', execSetId: 13, projectId: 'p2', versionId: 'v1', scope: 'current' },
    ],
    tempExecActiveId: '1',
    tempExecFocus: ['1', '2', '3'],
    tempExecSelections: { 1: new Set([0]) },
    tempExecRemarkOpen: { 1: new Set([0]) },
    tempExecReuseOpen: { 1: new Set([0]) },
    tempExecReuseBatchExpanded: { 1: true },
    tempExecPages: { 1: 2 },
    tempExecDefectOpen: { 1: new Set([0]) },
    tempExecPresetDraft: { fileId: '1' },
    tempExecArchivedFiles: [
      { id: 'archive-p1', projectId: 'p1', versionId: 'v1' },
      { id: 'archive-p2', projectId: 'p2', versionId: 'v1' },
    ],
    tempExecArchivedHidden: [],
  };
  const calls = {
    removedFromVersion: [],
    clearedDiff: [],
    deletedExecSets: [],
    activeIds: [],
    loads: 0,
    persisted: 0,
    focusSaved: 0,
    gridRenders: 0,
    viewRenders: 0,
    overviewRenders: 0,
    statuses: [],
  };
  let dbMode = false;
  const client = {
    deleteExecSet(execSetId) {
      calls.deletedExecSets.push(execSetId);
      return Promise.resolve();
    },
  };
  const owner = workspaceFactory.create({
    state,
    tempExecStatus: {},
    isDbMode() {
      return dbMode;
    },
    isTempExecProjectLayoutEnabled() {
      return true;
    },
    getApiClient() {
      return client;
    },
    clearTempExecCaseLibraryDiffMeta(execSetId, options) {
      calls.clearedDiff.push([execSetId, options]);
    },
    loadTempExecState() {
      calls.loads += 1;
    },
    removeTempExecFromVersion(fileId, options) {
      calls.removedFromVersion.push([fileId, options]);
    },
    ensureTempExecPlacement() {
      return placement;
    },
    removeFileFromOrder(requirement, fileId) {
      placement.fileOrder[requirement] = placement.fileOrder[requirement]
        .filter((id) => String(id) !== String(fileId));
    },
    saveTempExecFocus() {
      calls.focusSaved += 1;
    },
    persistTempExecState() {
      calls.persisted += 1;
    },
    setTempExecActive(fileId) {
      state.tempExecActiveId = fileId;
      calls.activeIds.push(fileId);
    },
    renderTempVersionGrid() {
      calls.gridRenders += 1;
    },
    renderTempExecView() {
      calls.viewRenders += 1;
    },
    renderTempExecOverview() {
      calls.overviewRenders += 1;
    },
    setStatus(element, text, tone) {
      calls.statuses.push([text, tone]);
    },
  });

  owner.reorderTempExecProject('p1', 'p3', { after: true });
  assert.deepStrictEqual(placement.projectOrder, ['p2', 'p3', 'p1']);
  owner.reorderTempExecProjectVersion('p1', 'v2', 'v1');
  assert.deepStrictEqual(placement.versionOrderByProject.p1, ['v2', 'v1']);
  owner.reorderTempExecFileInProjectVersion('p2', 'v1', '3', '5');
  assert.deepStrictEqual(placement.fileOrderByProjectVersion.p2.v1, ['3', '5']);

  owner.removeTempExecFile('1');
  assert.deepStrictEqual(state.tempExecFiles.map((file) => file.id), ['2', '3']);
  assert.strictEqual(state.tempExecActiveId, '2');
  assert.deepStrictEqual(state.tempExecFocus, ['2', '3']);
  assert.strictEqual(state.tempExecSelections['1'], undefined);
  assert.strictEqual(state.tempExecPresetDraft, null);
  assert.deepStrictEqual(calls.clearedDiff, [['11', { render: true }]]);
  assert.deepStrictEqual(placement.fileOrder.REQ, ['2', '3', '4', '5']);

  owner.removeTempExecProject('p1');
  assert.deepStrictEqual(state.tempExecFiles.map((file) => file.id), ['3']);
  assert.strictEqual(state.tempExecArchivedHidden.includes('p1::'), true);
  assert.deepStrictEqual(state.tempExecArchivedFiles.map((file) => file.id), ['archive-p2']);

  state.tempExecFiles.push({ id: '4', execSetId: 14, projectId: 'p2', versionId: 'v2', scope: 'current' });
  state.tempExecFocus.push('4');
  owner.removeTempExecProjectVersion('p2', 'v2');
  assert.deepStrictEqual(state.tempExecFiles.map((file) => file.id), ['3']);
  assert.strictEqual(state.tempExecArchivedHidden.includes('p2::v2'), true);

  owner.dissolveTempExecArchivedProjectVersion('p2', 'v1');
  assert.deepStrictEqual(state.tempExecArchivedFiles, []);
  assert.strictEqual(state.tempExecArchivedHidden.includes('archive-p2'), true);

  state.tempExecFiles.push({
    id: '5',
    execSetId: 15,
    projectId: 'p2',
    versionId: 'v1',
    scope: 'current',
    restoredFromId: 'archive-source',
  });
  state.tempExecFocus.push('5');
  dbMode = true;
  owner.removeTempExecFile('5');
  await Promise.resolve();
  await Promise.resolve();
  assert.deepStrictEqual(calls.deletedExecSets, [15]);
  assert.strictEqual(calls.loads, 1);
  assert.ok(calls.persisted >= 8);
  assert.ok(calls.focusSaved >= 4);
  assert.ok(calls.gridRenders >= 8);
  assert.ok(calls.overviewRenders >= 3);
}

function verifyOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const coreSource = fs.readFileSync(path.join(root, 'scripts/core/tempexecCore.js'), 'utf8');
  const ownerSource = fs.readFileSync(path.join(root, 'scripts/core/tempExecWorkspaceMutationOwner.js'), 'utf8');
  assert.ok(coreSource.indexOf('workspaceMutationOwner.create') !== -1);
  assert.ok(coreSource.indexOf('function removeTempExecFile(') === -1);
  assert.ok(coreSource.indexOf('function bulkRemoveTempExecFiles(') === -1);
  assert.ok(coreSource.indexOf('function reorderTempExecProject(') === -1);
  assert.ok(coreSource.indexOf('function dissolveTempExecArchivedProjectVersion(') === -1);
  assert.ok(coreSource.split('\n').length < 1850, 'tempexecCore.js should stay below the workspace split target');
  assert.ok(ownerSource.indexOf('requestSingleExecSetDelete') !== -1);
  assert.ok(ownerSource.indexOf('clearFileUiState') !== -1);

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
    const caseMutationIndex = html.indexOf('tempExecCaseMutationOwner.js');
    const workspaceMutationIndex = html.indexOf('tempExecWorkspaceMutationOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(caseMutationIndex >= 0, entry + ' is missing the case mutation owner');
    assert.ok(workspaceMutationIndex > caseMutationIndex, entry + ' has invalid mutation owner order');
    assert.ok(coreIndex > workspaceMutationIndex, entry + ' must load workspace mutation before tempexecCore');
  });
}

(async function run() {
  verifyPureRules();
  await verifyWorkspaceMutationWorkflow();
  verifyOwnershipAndEntryOrder();
  console.log('temp exec workspace mutation owner tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
