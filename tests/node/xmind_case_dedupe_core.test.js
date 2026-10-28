'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var context = vm.createContext({
  window: { app: {} },
  console: console,
  JSON: JSON,
  Math: Math,
  Number: Number,
  Object: Object,
  Array: Array,
  String: String,
});
vm.runInContext(
  fs.readFileSync(path.join(projectRoot, 'scripts/core/xmindCaseDedupeCore.js'), 'utf8'),
  context,
  { filename: 'scripts/core/xmindCaseDedupeCore.js' }
);

var core = context.window.app.xmindCaseDedupeCore.init({});

function makeCase(id, title, extra) {
  var item = {
    id: id,
    module: '登录',
    title: title,
    priority: 'P1',
    preconditions: '用户已注册',
    steps: ['输入账号', '点击登录'],
    expected: '登录成功',
    remark: '保留大小写与备注差异',
  };
  Object.keys(extra || {}).forEach(function(key) { item[key] = extra[key]; });
  return item;
}

var original = [{
  moduleId: 'm-login',
  moduleKey: '登录',
  module: '登录',
  cases: [
    makeCase('source-1', '正常登录'),
    makeCase('source-2', '正常登录-重复'),
    makeCase('source-3', '锁定账号', { expected: '拒绝登录' }),
  ],
}];
var prepared = core.prepareDedupeModules(original, { idPrefix: 'generated' });
assert.strictEqual(prepared[0].cases[0].dedupe_id, 'source-1');
assert.strictEqual(prepared[0].cases[1].dedupe_id, 'source-2');
assert.strictEqual(prepared[0].cases[2].dedupe_id, 'source-3');
assert.strictEqual(original[0].cases[0].dedupe_id, undefined);

function resultPayload(modules, removedCases) {
  return JSON.stringify({ modules: modules, removed_cases: removedCases || [] });
}

var retained = prepared[0].cases[0];
var duplicate = prepared[0].cases[1];
var keptLocked = prepared[0].cases[2];
retained.meta = { id: 'source-meta', role: 'x' };
var valid = core.normalizeDedupeResult(resultPayload([{
  moduleId: 'm-login',
  moduleKey: '登录',
  module: '登录',
  cases: [retained, keptLocked],
}], [{
  type: 'duplicate',
  dedupe_id: duplicate.dedupe_id,
  duplicate_with_id: retained.dedupe_id,
  reason: '步骤重复',
}]), prepared, { dedupeMode: 'dedupe_only' });
assert.strictEqual(valid.removedCount, 1);
assert.strictEqual(valid.removedCases[0].duplicateWithId, retained.dedupe_id);
assert.strictEqual(valid.modules[0].cases.length, 2);
var titleResult = core.normalizeDedupeResult(resultPayload([{
  moduleKey: '登录', module: '登录', cases: [retained, keptLocked],
}], [{ type: 'duplicate', module: '登录', title: duplicate.title, duplicate_with: retained.title }]), prepared);
assert.strictEqual(titleResult.removedCount, 1);
assert.strictEqual(titleResult.removedCases[0].dedupe_id, duplicate.dedupe_id);
var merged = core.normalizeDedupeResult(resultPayload([{
  moduleId: 'm-login',
  moduleKey: '登录',
  module: '登录',
  cases: [Object.assign({}, retained, { title: '合并后的登录用例', expected: '登录结果符合预期' }), keptLocked],
}], [{
  type: 'merge',
  merged_from_ids: [duplicate.dedupe_id],
  merged_into_id: retained.dedupe_id,
  reason: '场景已合并',
}]), prepared, { dedupeMode: 'dedupe_only' });
assert.strictEqual(merged.removedCount, 1);
assert.strictEqual(merged.removedCases[0].mergedIntoId, retained.dedupe_id);
var mergedMany = core.normalizeDedupeResult(resultPayload([{
  moduleKey: '登录', module: '登录', cases: [Object.assign({}, retained, { expected: '合并校验' })],
}], [{
  type: 'merge', merged_from_ids: [duplicate.dedupe_id, keptLocked.dedupe_id], merged_into_id: retained.dedupe_id,
}]), prepared);
var mergedWithRetainedSource = core.normalizeDedupeResult(resultPayload([{
  moduleKey: '登录', module: '登录', cases: [Object.assign({}, retained, { expected: '合并校验' }), keptLocked],
}], [{
  type: 'merge', merged_from_ids: [retained.dedupe_id, duplicate.dedupe_id], merged_into_id: retained.dedupe_id,
}]), prepared);
assert.strictEqual(mergedWithRetainedSource.removedCount, 1);
var mergedReplay = core.normalizeDedupeResult(resultPayload(mergedMany.modules, mergedMany.removedCases), prepared);
assert.strictEqual(mergedReplay.removedCount, 2);
assert.strictEqual(mergedReplay.removedCases.length, 2);

function assertThrows(fn, text) {
  assert.throws(fn, function(error) {
    return error && String(error.message || error).indexOf(text) !== -1;
  });
}

assertThrows(function() {
  core.prepareDedupeModules([
    { moduleKey: '重复模块', module: '重复模块', cases: [makeCase('duplicate-module-1', '用例一')] },
    { moduleKey: ' 重复模块 ', module: '另一个标题', cases: [makeCase('duplicate-module-2', '用例二')] },
  ]);
}, '模块键重复');
var protoModule = core.prepareDedupeModules([{
  moduleId: 'm-proto',
  moduleKey: '__proto__',
  module: '原型键模块',
  cases: [makeCase('proto-1', '原型键用例')],
}]);
assert.strictEqual(protoModule.length, 1);
assert.strictEqual(protoModule[0].moduleKey, '__proto__');

function assertInvalidModuleInput(invalidModules) {
  assertThrows(function() { core.prepareDedupeModules(invalidModules); }, '输入');
  assertThrows(function() { core.buildDedupeRequest({ modules: invalidModules }); }, '输入');
  assertThrows(function() {
    core.normalizeDedupeResult('{"modules":[],"removed_cases":[]}', invalidModules);
  }, '输入');
  assertThrows(function() {
    core.buildDedupeRequest({ modules: original, referenceModules: invalidModules });
  }, '只读参考');
  assertThrows(function() {
    core.normalizeDedupeResult('{"modules":[],"removed_cases":[]}', prepared, {
      referenceModules: invalidModules, allowPartialModulesResponse: true,
    });
  }, '只读参考');
}
[7, 'invalid', {}].forEach(assertInvalidModuleInput);
[null, 7, 'invalid', [], {}, { module: '无效列表', cases: 'invalid' }].forEach(function(item) {
  assertInvalidModuleInput([item]);
});
[null, undefined, 7, 'invalid', []].forEach(function(caseItem) {
  assertInvalidModuleInput([{ module: '非法用例', cases: [makeCase('valid-before-invalid', '有效用例'), caseItem] }]);
});
var sparseCases = [];
sparseCases.length = 1;
assertInvalidModuleInput([{ module: '稀疏用例列表', cases: sparseCases }]);
var sparseModules = [];
sparseModules.length = 1;
assertInvalidModuleInput(sparseModules);
var circularCase = { title: '不可序列化用例' };
circularCase.self = circularCase;
assertInvalidModuleInput([{ module: '循环引用', cases: [circularCase] }]);
var emptyInputModules = [{ module: '合法空模块', cases: [] }];
assert.strictEqual(core.prepareDedupeModules(emptyInputModules).length, 0);
assert.strictEqual(core.buildDedupeRequest({ modules: emptyInputModules, referenceModules: emptyInputModules }).referenceModules.length, 0);
assert.strictEqual(core.normalizeDedupeResult('{"modules":[],"removed_cases":[]}', emptyInputModules, {
  referenceModules: emptyInputModules,
}).modules.length, 0);

assertThrows(function() {
  core.normalizeDedupeResult('not json', prepared);
}, 'JSON');
assertThrows(function() { core.normalizeDedupeResult('{}', prepared); }, 'modules');
assertThrows(function() { core.normalizeDedupeResult('{"removed_cases":[]}', prepared); }, 'modules');
assertThrows(function() { core.normalizeDedupeResult('{"modules":[],"removed_cases":{}}', prepared); }, 'removed_cases');
var noOp = core.normalizeDedupeResult('{"modules":[],"removed_cases":[]}', prepared, { allowPartialModulesResponse: true });
assert.strictEqual(noOp.removedCount, 0);
assert.strictEqual(noOp.afterCount, 3);
assertThrows(function() {
  core.normalizeDedupeResult('{"modules":[],"removed_cases":[]}', prepared, { allowPartialModulesResponse: false });
}, '未返回全部模块');
assertThrows(function() {
  core.normalizeDedupeResult(JSON.stringify({ error: 'upstream unavailable' }), prepared);
}, '错误对象');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{
    moduleKey: '未知模块',
    module: '未知模块',
    cases: [],
  }]), prepared);
}, '未知');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([
    { moduleKey: '登录', module: '登录', cases: [retained, keptLocked] },
    { moduleKey: '登录', module: '登录', cases: [retained, keptLocked] },
  ]), prepared);
}, '重复返回模块');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [retained] }]), prepared);
}, '未返回');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [retained, keptLocked] }], [{
    type: 'duplicate',
    dedupe_id: duplicate.dedupe_id,
    reason: '没有目标',
  }]), prepared);
}, '保留目标');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [retained, keptLocked] }], [{
    type: 'duplicate',
    dedupe_id: duplicate.dedupe_id,
    duplicate_with_id: duplicate.dedupe_id,
  }]), prepared);
}, '相同');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [retained, duplicate, keptLocked] }], [{
    type: 'duplicate', dedupe_id: duplicate.dedupe_id, duplicate_with_id: retained.dedupe_id,
  }]), prepared);
}, '仍在输出');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [
    Object.assign({}, retained, { dedupe_id: '不存在的ID' }), duplicate, keptLocked,
  ] }]), prepared);
}, '目标不存在');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [
    Object.assign({}, retained, { id: '伪造数据库ID' }), duplicate, keptLocked,
  ] }]), prepared, { dedupeMode: 'dedupe_simplify' });
}, '标识被改写');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [keptLocked] }], [{
    type: 'duplicate',
    dedupe_id: duplicate.dedupe_id,
    duplicate_with_id: retained.dedupe_id,
  }, {
    type: 'duplicate',
    dedupe_id: retained.dedupe_id,
    duplicate_with_id: keptLocked.dedupe_id,
  }]), prepared);
}, '也被删除');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [retained, keptLocked] }], [{
    type: 'duplicate',
    dedupe_id: duplicate.dedupe_id,
    duplicate_with_id: retained.dedupe_id,
  }, {
    type: 'duplicate',
    dedupe_id: duplicate.dedupe_id,
    duplicate_with_id: retained.dedupe_id,
  }]), prepared);
}, '重复删除');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [
    Object.assign({}, retained, { expected: '允许登录' }),
    keptLocked,
  ] }]), prepared);
}, '擅自改写');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [
    Object.assign({}, retained, { model_confidence: 0.99 }),
    duplicate,
    keptLocked,
  ] }]), prepared);
}, '非法字段');

var simplified = core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [
  Object.assign({}, retained, { title: '登录成功（精简）', steps: ['登录'], expected: '成功' }),
  duplicate,
  keptLocked,
] }]), prepared, { dedupeMode: 'dedupe_simplify' });
assert.strictEqual(simplified.modules[0].cases[0].dedupe_id, retained.dedupe_id);
assert.strictEqual(simplified.removedCount, 0);

function normalizeSimplifiedCase(caseItem) {
  return core.normalizeDedupeResult(resultPayload([{
    moduleId: 'm-login', moduleKey: '登录', module: '登录', cases: [caseItem, duplicate, keptLocked],
  }]), prepared, { dedupeMode: 'dedupe_simplify' });
}
assertThrows(function() { normalizeSimplifiedCase({ dedupe_id: retained.dedupe_id }); }, '关键内容字段');
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { title: {} })); }, '关键内容字段');
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { steps: [] })); }, '关键内容字段');
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { expected: {} })); }, '关键内容字段');
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { priority: 'P9' })); }, '优先级无效');
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { priority: '' })); }, '优先级不能为空');
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { remark: '模型修改的备注' })); }, '元数据被改写');
assertThrows(function() {
  normalizeSimplifiedCase(Object.assign({}, retained, { meta: { id: 'tampered-meta', role: 'x' } }));
}, '元数据被改写');
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { module: '未知模块' })); }, '元数据被改写');
var withoutMetadata = Object.assign({}, retained);
delete withoutMetadata.remark;
delete withoutMetadata.priority;
var preservedMetadata = normalizeSimplifiedCase(withoutMetadata);
assert.strictEqual(preservedMetadata.modules[0].cases[0].remark, retained.remark);
assert.strictEqual(preservedMetadata.modules[0].cases[0].priority, retained.priority);
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { preconditions: '' })); }, '元数据被改写');
assertThrows(function() { normalizeSimplifiedCase(Object.assign({}, retained, { priority: 'P0' })); }, '元数据被改写');
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{
    moduleId: '伪造模块ID', moduleKey: '登录', module: '登录', cases: [retained, duplicate, keptLocked],
  }]), prepared, { dedupeMode: 'dedupe_simplify' });
}, '模块ID被改写');
var aliasModules = core.prepareDedupeModules([{
  moduleId: 'm-alias', moduleKey: '别名', module: '别名', cases: [{
    case_title: '别名用例', level: 'P2', precondition: '', actions: ['执行'], result: '结果', remark: '备注',
  }],
}]);
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{
    moduleKey: '别名', module: '别名', cases: [Object.assign({}, aliasModules[0].cases[0], { result: '' })],
  }]), aliasModules, { dedupeMode: 'dedupe_simplify' });
}, '关键内容字段');

var reference = [{
  moduleId: 'm-old',
  moduleKey: '历史登录',
  module: '历史登录',
  cases: [makeCase('reference-1', '旧登录')],
}];
var preparedReference = core.prepareDedupeModules(reference, { idPrefix: 'reference' });
var sameKeyReference = core.prepareDedupeModules([{ moduleId: 'm-login', moduleKey: '登录', module: '登录', cases: [makeCase('history-1', '历史重复')] }], { idPrefix: 'reference' });
var crossModule = core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [keptLocked] }], [{
  type: 'duplicate',
  dedupe_id: retained.dedupe_id,
  duplicate_with_id: preparedReference[0].cases[0].dedupe_id,
  duplicate_with_module_key: '历史登录',
  reason: '跨模块重复',
}, {
  type: 'duplicate',
  dedupe_id: duplicate.dedupe_id,
  duplicate_with_id: preparedReference[0].cases[0].dedupe_id,
  duplicate_with_module_key: '历史登录',
  reason: '跨模块重复',
}]), prepared, { referenceModules: preparedReference });
assert.strictEqual(crossModule.removedCount, 2);
var sameKeyCrossBatch = core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [duplicate, keptLocked] }], [{
  type: 'duplicate',
  dedupe_id: retained.dedupe_id,
  duplicate_with_id: sameKeyReference[0].cases[0].dedupe_id,
  reason: '跨批次重复',
}]), prepared, { referenceModules: sameKeyReference });
assert.strictEqual(sameKeyCrossBatch.removedCount, 1);
assertThrows(function() {
  core.normalizeDedupeResult(resultPayload([{ moduleKey: '登录', module: '登录', cases: [duplicate, keptLocked] }], [{
    type: 'merge',
    merged_from_ids: [duplicate.dedupe_id],
    merged_into_id: preparedReference[0].cases[0].dedupe_id,
    reason: '错误地合并到只读历史用例',
  }]), prepared, { referenceModules: preparedReference });
}, '只读参考');

var manyCases = [];
for (var index = 0; index < 61; index += 1) {
  manyCases.push(makeCase('many-' + String(index), '完全相同'));
}
var manyModules = core.prepareDedupeModules([{ moduleId: 'm-many', moduleKey: '重复', module: '重复', cases: manyCases }]);
var manyRemoved = manyModules[0].cases.slice(1).map(function(item) {
  return {
    type: 'duplicate',
    dedupe_id: item.dedupe_id,
    duplicate_with_id: manyModules[0].cases[0].dedupe_id,
    reason: '完全重复',
  };
});
var manyResult = core.normalizeDedupeResult(resultPayload([{
  moduleId: 'm-many',
  moduleKey: '重复',
  module: '重复',
  cases: [manyModules[0].cases[0]],
}], manyRemoved), manyModules);
assert.strictEqual(manyResult.modules[0].cases.length, 1);
assert.strictEqual(manyResult.removedCases.length, 60);
assert.strictEqual(manyResult.removedCount, 60);

console.log('xmind_case_dedupe_core.test.js passed');
