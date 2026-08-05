'use strict';

var assert = require('assert');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var codecModule = require(path.join(projectRoot, 'scripts/core/workflowXmindSnapshotCodec.js'));
var cloneJson = require(path.join(projectRoot, 'scripts/core/jsonCloneCore.js')).cloneJson;

function normalizeImportedCases(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function(item, index) {
    var source = item && typeof item === 'object' ? item : {};
    return {
      id: source.id ? String(source.id) : ('case-' + index),
      name: source.name ? String(source.name) : ('test-' + index),
      text: source.text ? String(source.text) : '',
      list: Array.isArray(source.list) ? source.list : [],
    };
  });
}

function createEmptyRequirementMediaSnapshot() {
  return {
    docxImages: [],
    pastedImages: [],
    lastDocxImageCount: 0,
    updatedAt: 0,
  };
}

assert.strictEqual(typeof codecModule.create, 'function');

var codec = codecModule.create({
  cloneJson: cloneJson,
  normalizeImportedCases: normalizeImportedCases,
  createEmptyRequirementMediaSnapshot: createEmptyRequirementMediaSnapshot,
});

var emptyA = codec.createEmptySnapshot();
var emptyB = codec.createEmptySnapshot();
assert.strictEqual(emptyA.mode, 'modules');
assert.deepStrictEqual(emptyA.workspaceOrder, []);
emptyA.workspaceOrder.push('changed');
assert.deepStrictEqual(emptyB.workspaceOrder, [], 'empty snapshots must not share mutable arrays');

assert.deepStrictEqual(codec.compactCaseGenResultsMap({
  login: '[ { "name": "normal" } ]',
  fallback: 'not-json',
}), {
  login: '[{"name":"normal"}]',
  fallback: 'not-json',
});

var shared = codec.buildPersistedSharedSnapshot({
  requirementLabel: 'login flow',
  rawText: 'user logs in',
  importedCases: [{ id: 1, name: 'login', text: 'case', list: [] }],
  caseGenResults: { login: '[ { "name": "normal" } ]' },
});
assert.strictEqual(shared.importedCases[0].id, '1');
assert.strictEqual(shared.caseGenResults.login, '[{"name":"normal"}]');

var activeXmind = {
  mode: 'full',
  history: [{ id: 'history-1' }],
  operationSnapshots: [{ id: 'operation-1' }],
  rootSnapshots: [{ id: 'root-1' }],
  snapshots: [{ id: 'snapshot-1' }],
  deleteUndoStack: [{ id: 'undo-1' }],
  deleteRedoStack: [{ id: 'redo-1' }],
  root: {
    running: true,
    taskId: 'task-root',
    snapshotId: 'root-snapshot',
    status: 'running',
    pipeline: {
      id: 'pipeline-1',
      pendingQueue: [{ moduleKey: 'login' }],
    },
  },
  modules: {
    login: {
      running: true,
      taskId: 'task-module',
      snapshotId: 'module-snapshot',
      status: 'running',
      topupHighlight: { id: 'temporary-highlight' },
    },
  },
};
var compactActive = codec.compactXmindSnapshot(activeXmind);
assert.deepStrictEqual(compactActive.operationSnapshots, []);
assert.deepStrictEqual(compactActive.rootSnapshots, []);
assert.deepStrictEqual(compactActive.snapshots, []);
assert.deepStrictEqual(compactActive.deleteUndoStack, []);
assert.deepStrictEqual(compactActive.deleteRedoStack, []);
assert.strictEqual(compactActive.root.snapshotId, '');
assert.strictEqual(compactActive.modules.login.snapshotId, '');
assert.strictEqual(compactActive.modules.login.topupHighlight, null);
assert.deepStrictEqual(compactActive.root.pipeline.pendingQueue, [{ moduleKey: 'login' }]);

var hostSource = Object.assign({
  activeWorkspaceId: 'workspace-1',
  mirrorWorkspaceId: 'workspace-1',
  workspaceOrder: ['workspace-1'],
  nextWorkspaceSeq: 2,
  openButtonDotVisible: true,
}, activeXmind);
hostSource.workspaces = {
  'workspace-1': {
    id: 'workspace-1',
    seq: 1,
    name: 'login workspace',
    snapshot: {
      xmind: activeXmind,
      shared: shared,
    },
  },
};

var persisted = codec.buildPersistedSnapshot(hostSource, shared);
assert.deepStrictEqual(persisted.workspaces['workspace-1'].snapshot, {
  __topLevelActiveSnapshot: true,
});
assert.deepStrictEqual(persisted.operationSnapshots, []);
assert.strictEqual(persisted.root.snapshotId, '');

var wrapped = {
  rawText: shared.rawText,
  requirementLabel: shared.requirementLabel,
  importedCases: shared.importedCases,
  caseGenResults: shared.caseGenResults,
  xmindCaseGen: persisted,
};
var prepared = codec.prepareSnapshotData(wrapped);
assert.notStrictEqual(prepared, wrapped, 'prepare must return a cloned data object');
assert.strictEqual(
  prepared.xmindCaseGen.workspaces['workspace-1'].snapshot.xmind.root.snapshotId,
  ''
);
assert.strictEqual(
  prepared.xmindCaseGen.workspaces['workspace-1'].snapshot.shared.requirementLabel,
  'login flow'
);
assert.deepStrictEqual(wrapped.xmindCaseGen.workspaces['workspace-1'].snapshot, {
  __topLevelActiveSnapshot: true,
}, 'prepare must not mutate the persisted snapshot');

console.log('workflow_xmind_snapshot_codec.test.js passed');
