'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirSelectionModel.js'));

assert.ok(owner && typeof owner.create === 'function');

function node(id, parent, depth, anchor) {
  return {
    id: id,
    parent: parent || null,
    depth: depth || 0,
    anchor: anchor || null,
    selectable: true,
  };
}

var root = node('root', null, 0);
var parent = node('parent', root, 1);
var child = node('child', parent, 2);
var sibling = node('sibling', root, 1);
var alias = node('alias', root, 1, parent);
var model = owner.create({
  isSelectableNode: function(item) {
    return Boolean(item && item.selectable === true);
  },
  resolveNode: function(item, options) {
    if (options && options.preserveActualNodes === true) return item || null;
    return item && item.anchor ? item.anchor : item || null;
  },
  getIdentityKey: function(item) {
    return item && item.id ? item.id : '';
  },
  getParent: function(item) {
    return item && item.parent ? item.parent : null;
  },
  getNodeId: function(item) {
    return item && item.id ? item.id : '';
  },
  getNodeDepth: function(item) {
    return item && item.depth ? item.depth : 0;
  },
});

var normalized = model.normalizeNodes([alias, parent, null, { selectable: false }]);
assert.deepStrictEqual(normalized, [parent]);
assert.deepStrictEqual(
  model.normalizeNodes([alias, parent], { preserveActualNodes: true }),
  [alias, parent]
);

assert.deepStrictEqual(model.toggleNode([parent], alias), []);
assert.deepStrictEqual(model.toggleNode([parent], sibling), [parent, sibling]);
assert.strictEqual(model.toggleNode([parent], { selectable: false }), null);

var removable = model.collectRemovableNodes([child, sibling, parent, root]);
assert.deepStrictEqual(removable, [parent, sibling]);
assert.deepStrictEqual(model.collectRemovableNodes([root]), []);

assert.strictEqual(model.buildDefaultGroupDescriptor({ topic: '根节点' }), null);
assert.deepStrictEqual(model.buildDefaultGroupDescriptor({ topic: '根节点' }, { enabled: true }), {
  key: 'root::%E6%A0%B9%E8%8A%82%E7%82%B9',
  preferred: true,
});
assert.deepStrictEqual(model.buildDefaultGroupDescriptor({ path: [' 模块 A '] }, { enabled: true }), {
  key: 'module::%E6%A8%A1%E5%9D%97%20A',
  preferred: true,
});
assert.deepStrictEqual(model.buildDefaultGroupDescriptor({ path: ['模块 A', '用例 A', '字段'] }, { enabled: true }), {
  key: 'case::%E6%A8%A1%E5%9D%97%20A::%E7%94%A8%E4%BE%8B%20A',
  preferred: false,
});

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
var controllerSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/core/mindElixirSelectionController.js'),
  'utf8'
);
assert.ok(coreSource.indexOf('selectionControllerOwner.create') !== -1);
assert.strictEqual(coreSource.indexOf('selectionModelOwner.create({'), -1);
assert.ok(controllerSource.indexOf('selectionModelOwner.create') !== -1);
assert.ok(controllerSource.indexOf('selectionModel.normalizeNodes') !== -1);
assert.ok(controllerSource.indexOf('selectionModel.toggleNode') !== -1);
assert.ok(controllerSource.indexOf('selectionModel.collectRemovableNodes') !== -1);
assert.ok(controllerSource.indexOf('selectionModel.buildDefaultGroupDescriptor') !== -1);
assert.strictEqual(coreSource.indexOf('selected.sort(function(a, b) {'), -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var ownerIndex = html.indexOf('./scripts/core/mindElixirSelectionModel.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(ownerIndex !== -1, relativePath + ' should load the selection model');
  assert.ok(coreIndex !== -1 && ownerIndex < coreIndex, relativePath + ' should load the selection model first');
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicOwnerIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirSelectionModel.js'");
var dynamicCoreIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirCore.js'");
assert.ok(dynamicOwnerIndex !== -1);
assert.ok(dynamicCoreIndex !== -1 && dynamicOwnerIndex < dynamicCoreIndex);

console.log('mind_elixir_selection_model.test.js passed');
