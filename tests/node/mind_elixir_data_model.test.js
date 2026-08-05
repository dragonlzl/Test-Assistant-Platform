'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/core/mindElixirDataModel.js'));

assert.ok(owner && typeof owner.create === 'function');

var nextId = 1;
var model = owner.create({
  idFactory: function() {
    var value = 'node-' + nextId;
    nextId += 1;
    return value;
  },
  xmindApi: {
    buildCaseFieldsForXmind: function(item, fallbackModule) {
      return [
        item.module || fallbackModule,
        item.title,
        item.priority || 'P1',
        item.preconditions || '-',
        item.steps || '-',
        item.expected,
      ];
    },
  },
});
assert.strictEqual(model.generateNodeId(), 'node-1');
assert.strictEqual(model.createNode('测试节点').topic, '测试节点');

var paths = model.buildPathsFromCases([
  { module: '账户', title: '登录成功', expected: '进入首页' },
  { module: '账户', title: '登录失败', priority: 'P2', expected: '提示错误' },
]);
assert.deepStrictEqual(paths, [
  ['账户', '登录成功', 'P1', '-', '-', '进入首页'],
  ['账户', '登录失败', 'P2', '-', '-', '提示错误'],
]);

var data = model.buildMindDataFromCases([
  { module: '账户', title: '登录成功', expected: '进入首页' },
  { module: '账户', title: '登录失败', priority: 'P2', expected: '提示错误' },
], { rootTitle: '回归用例' });
assert.strictEqual(data.nodeData.topic, '回归用例');
assert.strictEqual(data.nodeData.children.length, 1);
assert.strictEqual(data.nodeData.children[0].topic, '账户');
assert.strictEqual(data.nodeData.children[0].children.length, 2);
assert.strictEqual(Object.prototype.hasOwnProperty.call(data.nodeData, '_childIndex'), false);

var cloned = model.cloneMindDataObject(data);
assert.deepStrictEqual(cloned, data);
assert.notStrictEqual(cloned, data);
assert.strictEqual(model.buildMindDataSignature(cloned), JSON.stringify(data.nodeData));
cloned.nodeData.topic = '已修改';
assert.strictEqual(data.nodeData.topic, '回归用例');

var metaRoot = { id: 'meta-root', topic: '根节点', parent: null };
var metaChild = {
  id: 'meta-child',
  topic: '子节点',
  parent: metaRoot,
  xmindMeta: { caseId: 'case-1' },
};
var nodeEl = { nodeObj: metaChild };
var nodeMeta = model.buildNodeMeta(metaChild, '根节点', nodeEl);
assert.deepStrictEqual(nodeMeta.path, ['子节点']);
assert.strictEqual(nodeMeta.nodeId, 'meta-child');
assert.strictEqual(nodeMeta.nodeEl, nodeEl);
assert.deepStrictEqual(nodeMeta.meta, { caseId: 'case-1' });
assert.strictEqual(model.buildNodeMeta(null, '根节点', nodeEl), null);

var instanceData = { nodeData: { id: 'root', topic: '实例数据' } };
var instanceSnapshot = model.readMindDataFromInstance({
  getData: function() { return instanceData; },
});
assert.deepStrictEqual(instanceSnapshot, instanceData);
assert.notStrictEqual(instanceSnapshot, instanceData);

var stringSnapshot = model.readMindDataFromInstance({
  getData: function() { throw new Error('unavailable'); },
  getDataString: function() {
    return '{"nodeData":{"id":"string-root","topic":"字符串数据"}}';
  },
});
assert.strictEqual(stringSnapshot.nodeData.id, 'string-root');

var fallbackRoot = { id: 'fallback-root', topic: '回退数据', children: [] };
var fallbackChild = { id: 'child', topic: '子节点', parent: fallbackRoot };
fallbackRoot.children.push(fallbackChild);
var fallbackSnapshot = model.readMindDataFromInstance({ nodeData: fallbackRoot });
assert.strictEqual(fallbackSnapshot.nodeData.children[0].topic, '子节点');
assert.strictEqual(Object.prototype.hasOwnProperty.call(fallbackSnapshot.nodeData.children[0], 'parent'), false);
assert.strictEqual(model.readMindDataFromInstance(null), null);

assert.strictEqual(model.isMindElixirInternalClipboardText(JSON.stringify({
  magic: 'MIND-ELIXIR-WAIT-COPY',
  data: [],
})), true);
assert.strictEqual(model.isMindElixirInternalClipboardText('普通文本'), false);
assert.strictEqual(model.parseIndentedTextToMindData('根节点\n子节点'), null);

var parsed = model.parseIndentedTextToMindData('根节点\n  模块 A\n    用例 A\n  模块 B');
assert.ok(parsed && parsed.mindData && parsed.mindData.nodeData);
assert.strictEqual(parsed.nodeCount, 4);
assert.strictEqual(parsed.rootTopic, '根节点');
assert.strictEqual(parsed.mindData.nodeData.children.length, 2);
assert.strictEqual(parsed.mindData.nodeData.children[0].children[0].topic, '用例 A');
assert.strictEqual(model.normalizeClipboardPlainNodeTopic('  文本\r\n第二行  '), '文本\n第二行');

var baseData = model.buildMindDataFromPaths([
  ['模块', '用例 A', 'P1', '-', '步骤', '结果 A'],
  ['模块', '用例 B', 'P1', '-', '步骤', '结果 B'],
]);
var currentData = model.buildMindDataFromPaths([
  ['模块', '用例 A', 'P1', '-', '步骤', '结果 A'],
  ['模块', '用例 B 已修改', 'P1', '-', '步骤', '结果 B'],
  ['模块', '用例 C', 'P2', '-', '步骤', '结果 C'],
]);
assert.deepStrictEqual(model.calculateCaseChangeSummary(baseData, currentData), {
  modified: 1,
  added: 1,
  deleted: 0,
  total: 2,
});

var valid = model.validateMindDataCases(currentData);
assert.strictEqual(valid.ok, true);
assert.strictEqual(valid.cases.length, 3);
assert.strictEqual(valid.cases[2].priority, 'P2');

var invalid = model.validateMindDataCases({
  nodeData: {
    id: 'root',
    topic: '用例',
    children: [{
      id: 'module',
      topic: '模块',
      children: [{
        id: 'title',
        topic: '标题',
        children: [{
          id: 'priority',
          topic: 'P1',
          children: [{
            id: 'precondition',
            topic: '-',
            children: [{
              id: 'steps',
              topic: '步骤',
              children: [{ id: 'expected', topic: '-' }],
            }],
          }],
        }],
      }],
    }],
  },
});
assert.strictEqual(invalid.ok, false);
assert.deepStrictEqual(invalid.emptyNodeIds, ['expected']);
assert.ok(invalid.structuralNodeIds.indexOf('expected') !== -1);

var coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/mindElixirCore.js'), 'utf8');
assert.strictEqual(coreSource.indexOf('function parseIndentedTextToMindData('), -1);
assert.strictEqual(coreSource.indexOf('function validateMindDataCases('), -1);
assert.strictEqual(coreSource.indexOf('function readMindDataFromInstance('), -1);
assert.ok(coreSource.indexOf('dataModelOwner.create') !== -1);
assert.ok(coreSource.indexOf('var readMindDataFromInstance = dataModel.readMindDataFromInstance;') !== -1);
assert.ok(coreSource.indexOf('var buildMindNodeMeta = dataModel.buildNodeMeta;') !== -1);

[
  'index.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
].forEach(function(relativePath) {
  var html = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  var dataModelIndex = html.indexOf('./scripts/core/mindElixirDataModel.js');
  var viewportIndex = html.indexOf('./scripts/core/mindElixirViewportController.js');
  var coreIndex = html.indexOf('./scripts/core/mindElixirCore.js');
  assert.ok(dataModelIndex !== -1, relativePath + ' should load the data model');
  assert.ok(viewportIndex !== -1 && dataModelIndex < viewportIndex);
  assert.ok(coreIndex !== -1 && viewportIndex < coreIndex);
});

var loaderSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js'),
  'utf8'
);
var dynamicDataIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirDataModel.js'");
var dynamicViewportIndex = loaderSource.indexOf("loadLocalScriptOnce('./scripts/core/mindElixirViewportController.js'");
assert.ok(dynamicDataIndex !== -1);
assert.ok(dynamicViewportIndex !== -1 && dynamicDataIndex < dynamicViewportIndex);

console.log('mind_elixir_data_model.test.js passed');
