'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var jsonCloneCore = require(path.join(projectRoot, 'scripts/core/jsonCloneCore.js'));
var cloneJson = jsonCloneCore.cloneJson;
var fallback = { fallback: true };
var source = { nested: { value: 1 }, list: ['a', 'b'] };
var cloned = cloneJson(source, fallback);

assert.deepStrictEqual(cloned, source);
assert.notStrictEqual(cloned, source);
assert.notStrictEqual(cloned.nested, source.nested);
assert.strictEqual(cloneJson(null, fallback), fallback);
assert.strictEqual(cloneJson(undefined, fallback), fallback);

var cyclic = {};
cyclic.self = cyclic;
assert.strictEqual(cloneJson(cyclic, fallback), fallback);

[
  'admin.html',
  'ai-tools.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
  'index.html',
  'settings.html',
].forEach(function(fileName) {
  var sourceText = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
  var cloneCoreIndex = sourceText.indexOf('./scripts/core/jsonCloneCore.js');
  var snapshotModelIndex = sourceText.indexOf('./scripts/core/workflowSnapshotModel.js');
  var restoreControllerIndex = sourceText.indexOf('./scripts/core/workflowSnapshotRestoreController.js');
  var persistenceOwnerIndex = sourceText.indexOf('./scripts/core/workflowPersistenceOwner.js');
  var appRuntimeIndex = sourceText.indexOf('./scripts/core/appRuntime.js');
  assert.ok(cloneCoreIndex >= 0, fileName + ' must load jsonCloneCore');
  assert.ok(snapshotModelIndex >= 0, fileName + ' must load workflowSnapshotModel');
  assert.ok(restoreControllerIndex >= 0, fileName + ' must load workflowSnapshotRestoreController');
  assert.ok(persistenceOwnerIndex >= 0, fileName + ' must load workflowPersistenceOwner');
  assert.ok(cloneCoreIndex < snapshotModelIndex, fileName + ' must load jsonCloneCore before workflowSnapshotModel');
  assert.ok(snapshotModelIndex < restoreControllerIndex, fileName + ' must load workflowSnapshotModel before workflowSnapshotRestoreController');
  assert.ok(restoreControllerIndex < persistenceOwnerIndex, fileName + ' must load workflowSnapshotRestoreController before workflowPersistenceOwner');
  assert.ok(persistenceOwnerIndex < appRuntimeIndex, fileName + ' must load workflowPersistenceOwner before appRuntime');
});

var xmindCasegenSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/xmindCasegen.js'),
  'utf8'
);
assert.ok(
  xmindCasegenSource.indexOf('var cloneJson = window.app.jsonCloneCore.cloneJson;')
    < xmindCasegenSource.indexOf('cloneJson: cloneJson'),
  'xmindCasegen must bind cloneJson before injecting it into controllers'
);

console.log('json_clone_core.test.js passed');
