'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirEditActionPolicy.js'));

assert.ok(owner && typeof owner.create === 'function');

var rootNode = { id: 'root', parent: null };
var childNode = { id: 'child', parent: rootNode };
var policy = owner.create({
  getNodeParent: function(node) {
    return node && node.parent ? node.parent : null;
  },
});

assert.deepStrictEqual(policy.resolve({
  editing: false,
  selectedNodes: [childNode],
  historyIndex: 1,
  historyLength: 3,
}), {
  canAdd: false,
  canDelete: false,
  canUndo: false,
  canRedo: false,
});

assert.deepStrictEqual(policy.resolve({
  editing: true,
  selectedNodes: [rootNode],
  historyIndex: 1,
  historyLength: 3,
}), {
  canAdd: true,
  canDelete: false,
  canUndo: true,
  canRedo: true,
});

assert.deepStrictEqual(policy.resolve({
  editing: true,
  selectedNodes: [rootNode, childNode],
  historyIndex: 2,
  historyLength: 3,
}), {
  canAdd: false,
  canDelete: true,
  canUndo: true,
  canRedo: false,
});

assert.deepStrictEqual(policy.resolve({
  editing: true,
  pendingSave: true,
  selectedNodes: [childNode],
  historyIndex: 1,
  historyLength: 3,
}), {
  canAdd: false,
  canDelete: false,
  canUndo: false,
  canRedo: false,
});

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.ok(coreSource.indexOf('editActionPolicyOwner.create') !== -1);
assert.ok(coreSource.indexOf('editActionPolicy.resolve') !== -1);
assert.strictEqual(coreSource.indexOf('var canRedo = editing && historyEntries.length'), -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var ownerIndex = html.indexOf('./scripts/core/mindElixirEditActionPolicy.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(ownerIndex !== -1, relativePath + ' should load the edit action policy');
  assert.ok(coreIndex !== -1 && ownerIndex < coreIndex, relativePath + ' should load the edit action policy first');
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicOwnerIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirEditActionPolicy.js'");
var dynamicCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(dynamicOwnerIndex !== -1);
assert.ok(dynamicCoreIndex !== -1 && dynamicOwnerIndex < dynamicCoreIndex);

console.log('mind_elixir_edit_action_policy.test.js passed');
