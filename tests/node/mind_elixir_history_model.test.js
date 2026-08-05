'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirHistoryModel.js'));

assert.ok(owner && typeof owner.create === 'function');

function data(id) {
  return { nodeData: { id: id } };
}

var model = owner.create({
  cloneData: function(value) {
    if (!value || !value.nodeData) return null;
    return JSON.parse(JSON.stringify(value));
  },
  getSignature: function(value) {
    return JSON.stringify(value.nodeData);
  },
});

var firstData = data('first');
var first = model.appendSnapshot([], -1, firstData, { reset: true });
assert.strictEqual(first.historyIndex, 0);
assert.strictEqual(first.changed, true);
assert.notStrictEqual(first.entries[0].data, firstData);

var duplicate = model.appendSnapshot(first.entries, first.historyIndex, data('first'));
assert.strictEqual(duplicate.changed, false);
assert.strictEqual(duplicate.entries, first.entries);

var second = model.appendSnapshot(first.entries, 0, data('second'));
assert.strictEqual(second.historyIndex, 1);
assert.deepStrictEqual(second.entries.map(function(entry) { return entry.data.nodeData.id; }), ['first', 'second']);

var branched = model.appendSnapshot(second.entries, 0, data('branch'));
assert.strictEqual(branched.historyIndex, 1);
assert.deepStrictEqual(branched.entries.map(function(entry) { return entry.data.nodeData.id; }), ['first', 'branch']);

var restored = model.restoreHistory([data('first'), null, data('second')], 99);
assert.strictEqual(restored.historyIndex, 1);
assert.deepStrictEqual(restored.entries.map(function(entry) { return entry.data.nodeData.id; }), ['first', 'second']);
assert.strictEqual(model.restoreHistory([], 0), null);

var persisted = model.buildPersistedHistory([
  model.createEntry(data('one')),
  model.createEntry(data('two')),
  model.createEntry(data('three')),
], 0, 2);
assert.deepStrictEqual(persisted.history.map(function(entry) { return entry.nodeData.id; }), ['two', 'three']);
assert.strictEqual(persisted.historyIndex, 0);

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.ok(coreSource.indexOf('historyModelOwner.create') !== -1);
var historyCreateIndex = coreSource.indexOf('var historyModel = historyModelOwner.create');
assert.ok(coreSource.indexOf('var cloneMindDataObject = dataModel.cloneMindDataObject;') < historyCreateIndex);
assert.ok(coreSource.indexOf('var buildMindDataSignature = dataModel.buildMindDataSignature;') < historyCreateIndex);
assert.strictEqual(coreSource.indexOf('snapshotSignature('), -1);
assert.ok(coreSource.indexOf('historyModel.appendSnapshot') !== -1);
assert.ok(coreSource.indexOf('historyModel.restoreHistory') !== -1);
assert.ok(coreSource.indexOf('historyModel.buildPersistedHistory') !== -1);
assert.strictEqual(coreSource.indexOf('function buildHistoryEntry('), -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var ownerIndex = html.indexOf('./scripts/core/mindElixirHistoryModel.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(ownerIndex !== -1, relativePath + ' should load the history model');
  assert.ok(coreIndex !== -1 && ownerIndex < coreIndex, relativePath + ' should load the history model first');
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicOwnerIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirHistoryModel.js'");
var dynamicCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(dynamicOwnerIndex !== -1);
assert.ok(dynamicCoreIndex !== -1 && dynamicOwnerIndex < dynamicCoreIndex);

console.log('mind_elixir_history_model.test.js passed');
