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

function loadCore(relativePath) {
  var source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

function buildCase(moduleIndex, caseIndex) {
  return {
    id: 'case-' + String(moduleIndex) + '-' + String(caseIndex),
    dedupe_id: 'dedupe-' + String(moduleIndex) + '-' + String(caseIndex),
    module: '模块' + String(moduleIndex),
    title: '模块' + String(moduleIndex) + ' 用例 ' + String(caseIndex),
    priority: 'P1',
    preconditions: '满足前置条件 ' + String(caseIndex),
    steps: ['1、执行操作 ' + String(caseIndex), '2、检查结果'],
    expected: '结果符合预期 ' + String(caseIndex),
  };
}

function buildModules() {
  var modules = [];
  for (var moduleIndex = 1; moduleIndex <= 18; moduleIndex += 1) {
    var caseCount = moduleIndex === 18 ? 18 : 10;
    var cases = [];
    for (var caseIndex = 1; caseIndex <= caseCount; caseIndex += 1) {
      cases.push(buildCase(moduleIndex, caseIndex));
    }
    modules.push({
      moduleId: 'module-' + String(moduleIndex),
      moduleKey: '模块' + String(moduleIndex),
      module: '模块' + String(moduleIndex),
      key_scenarios: ['场景' + String(moduleIndex)],
      test_points: ['测试点' + String(moduleIndex)],
      coupled_modules: [],
      cases: cases,
    });
  }
  return modules;
}

loadCore('scripts/core/xmindDedupeBatchCore.js');
loadCore('scripts/core/xmindCaseDedupeCore.js');

var batchCore = context.window.app.xmindDedupeBatchCore;
var dedupeCore = context.window.app.xmindCaseDedupeCore.init({});
var modules = buildModules();
var plan = batchCore.buildBatchPlan(modules, {
  maxCasesPerBatch: 60,
  maxConcurrentBatches: 5,
});

assert.strictEqual(plan.enabled, true);
assert.strictEqual(plan.totalCaseCount, 188);
assert.strictEqual(plan.batchCount, 4);
assert.strictEqual(plan.maxConcurrentBatches, 4);
assert.deepStrictEqual(Array.from(plan.batches).map(function(batch) {
  return batch.targetCaseCount;
}), [60, 60, 60, 8]);
assert.deepStrictEqual(Array.from(plan.batches).map(function(batch) {
  return batch.referenceCaseCount;
}), [0, 60, 120, 180]);
plan.batches.forEach(function(batch) {
  assert.ok(batch.targetCaseCount <= 60);
});

var targetCaseIds = [];
plan.batches.forEach(function(batch) {
  batch.modules.forEach(function(module) {
    module.cases.forEach(function(caseItem) {
      targetCaseIds.push(caseItem.id);
    });
  });
});
assert.strictEqual(targetCaseIds.length, 188);
assert.strictEqual(new Set(targetCaseIds).size, 188);

var finalBatchReference = plan.batches[3].referenceModules[0].cases[0];
assert.strictEqual(Object.prototype.hasOwnProperty.call(finalBatchReference, 'priority'), false);
assert.ok(Array.isArray(finalBatchReference.steps));
assert.strictEqual(finalBatchReference.dedupe_id, 'dedupe-1-1');
assert.strictEqual(finalBatchReference.title, modules[0].cases[0].title);
assert.strictEqual(finalBatchReference.preconditions, modules[0].cases[0].preconditions);
assert.deepStrictEqual(Array.from(finalBatchReference.steps), modules[0].cases[0].steps);
assert.strictEqual(finalBatchReference.expected, modules[0].cases[0].expected);

var batchRequest = dedupeCore.buildDedupeRequest({
  requirementLabel: '测试需求',
  requirementText: '完整需求正文必须保留',
  requirementSupplement: '补充约束',
  modules: plan.batches[1].modules,
  referenceModules: plan.batches[1].referenceModules,
  batchMode: true,
  batchIndex: 1,
  batchCount: plan.batchCount,
  dedupeMode: 'dedupe_only',
  source: 'auto-full',
});
assert.ok(batchRequest.requestText.indexOf('完整需求正文必须保留') !== -1);
assert.ok(batchRequest.requestText.indexOf('只读的跨批次用例摘要') !== -1);
assert.ok(batchRequest.prompt.indexOf('target_modules 是本批唯一可编辑用例') !== -1);
assert.ok(batchRequest.prompt.indexOf('不得返回或改写只读引用模块') !== -1);

var batchEntries = plan.batches.map(function(batch, batchIndex) {
  var resultModules = batch.modules.map(function(module, moduleIndex) {
    var cases = module.cases.slice();
    if (moduleIndex === 0 && cases.length) cases.shift();
    return {
      moduleId: module.moduleId,
      moduleKey: module.moduleKey,
      module: module.module,
      beforeCount: module.cases.length,
      afterCount: cases.length,
      usedFallback: false,
      cases: cases,
    };
  });
  return {
    id: batch.id,
    result: {
      modules: resultModules,
      removedCases: [{
        moduleKey: batch.modules[0].moduleKey,
        module: batch.modules[0].module,
        title: batch.modules[0].cases[0].title,
        actionType: 'duplicate',
      }],
      diagnostics: batchIndex === 0 ? ['首批诊断'] : [],
    },
  };
});
var merged = batchCore.mergeBatchResults(modules, batchEntries, { expectedBatches: plan.batches });
assert.strictEqual(merged.modules.length, 18);
assert.strictEqual(merged.beforeCount, 188);
assert.strictEqual(merged.afterCount, 184);
assert.strictEqual(merged.removedCount, 4);
assert.strictEqual(merged.removedCases.length, 4);
assert.ok(merged.diagnostics[0].indexOf('批次 1') !== -1);

var longModules = [{
  moduleId: 'long-module',
  moduleKey: 'long-module',
  module: '长字段模块',
  cases: [{
    id: 'long-1',
    dedupe_id: 'long-dedupe-1',
    title: '同一标题',
    preconditions: '前置条件相同但步骤末尾不同',
    steps: ['前置步骤', '末尾成功分支：允许提交'],
    expected: '末尾成功结果必须允许提交',
  }, {
    id: 'long-2',
    dedupe_id: 'long-dedupe-2',
    title: '同一标题',
    preconditions: '前置条件相同但步骤末尾不同',
    steps: ['前置步骤', '末尾失败分支：拒绝提交'],
    expected: '末尾失败结果必须拒绝提交',
  }],
}];
var longPlan = batchCore.buildBatchPlan(longModules, { maxCasesPerBatch: 1 });
var longReference = longPlan.batches[1].referenceModules[0].cases[0];
assert.strictEqual(longReference.steps[1], longModules[0].cases[0].steps[1]);
assert.strictEqual(longReference.expected, longModules[0].cases[0].expected);

var generatedIdModules = [{ moduleKey: 'stable-module', module: '稳定模块', cases: [
  { title: '第一条', preconditions: '', steps: ['一步'], expected: '成功' },
  { title: '第二条', preconditions: '', steps: ['二步'], expected: '失败' },
] }];
var generatedIdPlan = batchCore.buildBatchPlan(generatedIdModules, { maxCasesPerBatch: 1 });
assert.strictEqual(generatedIdPlan.batches[0].modules[0].cases[0].dedupe_id, 'batch:stable-module:1');
assert.strictEqual(generatedIdPlan.batches[1].modules[0].cases[0].dedupe_id, 'batch:stable-module:2');
assert.strictEqual(generatedIdPlan.batches[1].referenceModules[0].cases[0].dedupe_id, 'batch:stable-module:1');

var duplicateCases = [];
for (var duplicateIndex = 0; duplicateIndex < 61; duplicateIndex += 1) {
  duplicateCases.push({
    id: 'duplicate-' + String(duplicateIndex),
    dedupe_id: 'duplicate-dedupe-' + String(duplicateIndex),
    title: '完全重复用例',
    preconditions: '已登录',
    steps: ['打开页面', '点击提交'],
    expected: '提交成功',
  });
}
var duplicateModules = [{ moduleId: 'duplicate-module', moduleKey: 'duplicate-module', module: '重复模块', cases: duplicateCases }];
var duplicatePlan = batchCore.buildBatchPlan(duplicateModules, { maxCasesPerBatch: 60 });
var duplicateEntries = duplicatePlan.batches.map(function(batch) {
  return {
    id: batch.id,
    result: {
      modules: [{
        moduleId: 'duplicate-module',
        moduleKey: 'duplicate-module',
        module: '重复模块',
        usedFallback: false,
        cases: batch.index === 0 ? [duplicateCases[0]] : [],
      }],
      removedCases: [],
    },
  };
});
var duplicateMerged = batchCore.mergeBatchResults(duplicateModules, duplicateEntries, {
  expectedBatches: duplicatePlan.batches,
});
assert.strictEqual(duplicateMerged.modules[0].cases.length, 1);
assert.strictEqual(duplicateMerged.removedCount, 60);

assert.throws(function() {
  batchCore.mergeBatchResults(duplicateModules, duplicateEntries.slice(0, 1), {
    expectedBatches: duplicatePlan.batches,
  });
}, /结果不完整/);
assert.throws(function() {
  batchCore.mergeBatchResults(duplicateModules, [{
    id: duplicateEntries[0].id,
    result: { modules: [], removedCases: [] },
  }, duplicateEntries[1]], { expectedBatches: duplicatePlan.batches });
}, /缺少模块结果/);
assert.throws(function() {
  batchCore.mergeBatchResults(duplicateModules, [{
    id: duplicateEntries[0].id,
    result: { modules: [{ moduleKey: 'duplicate-module', module: '重复模块', cases: 'invalid' }], removedCases: [] },
  }, duplicateEntries[1]], { expectedBatches: duplicatePlan.batches });
}, /用例列表/);

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

var collidingModules = [
  { moduleKey: 'A B', module: '模块一', cases: [buildCase(1, 1)] },
  { moduleKey: 'ab', module: '模块二', cases: [buildCase(2, 1)] },
];
assert.throws(function() { batchCore.buildBatchPlan(collidingModules); }, /模块键重复/);
assert.throws(function() { batchCore.mergeBatchResults(collidingModules, []); }, /模块键重复/);

[null, 3, [], { module: '无效列表', cases: 'invalid' }, { moduleKey: 'missing-title', cases: [buildCase(1, 1)] }].forEach(function(module) {
  assert.throws(function() { batchCore.buildBatchPlan([module]); }, /无效/);
  assert.throws(function() { batchCore.mergeBatchResults([module], []); }, /无效/);
});
[null, 3, 'invalid', []].forEach(function(caseItem) {
  var invalidModules = [{ moduleKey: 'invalid-case', module: '无效用例', cases: [caseItem] }];
  assert.throws(function() { batchCore.buildBatchPlan(invalidModules); }, /无效用例/);
  assert.throws(function() { batchCore.mergeBatchResults(invalidModules, []); }, /无效用例/);
});
assert.throws(function() {
  batchCore.buildBatchPlan([{ moduleKey: 'duplicate-ids', module: '重复标识', cases: [buildCase(1, 1), buildCase(1, 1)] }]);
}, /用例标识重复/);

var emptyModules = [{ moduleKey: 'empty', module: '空模块', cases: [] }];
assert.strictEqual(batchCore.buildBatchPlan(emptyModules).moduleCount, 0);
assert.strictEqual(batchCore.mergeBatchResults(emptyModules, []).modules.length, 0);
var allRemovedEntries = cloneValue(duplicateEntries);
allRemovedEntries[0].result.modules[0].cases = [];
var allRemovedResult = batchCore.mergeBatchResults(duplicateModules, allRemovedEntries, { expectedBatches: duplicatePlan.batches });
assert.strictEqual(allRemovedResult.afterCount, 0);
assert.strictEqual(allRemovedResult.modules[0].usedFallback, false);

var protoModules = [{
  moduleId: '__proto__', moduleKey: '__proto__', module: '原型键模块', cases: [
    { dedupe_id: '__proto__', title: '第一条' },
    { dedupe_id: 'constructor', title: '第二条' },
  ],
}];
var protoPlan = batchCore.buildBatchPlan(protoModules, { maxCasesPerBatch: 1 });
assert.strictEqual(protoPlan.modules.length, 1);
assert.strictEqual(protoPlan.batches[1].referenceModules[0].cases[0].dedupe_id, '__proto__');
var protoEntries = Array.from(protoPlan.batches).map(function(batch) {
  return { id: batch.id, result: { modules: cloneValue(batch.modules) } };
});
assert.strictEqual(batchCore.mergeBatchResults(protoModules, protoEntries, { expectedBatches: protoPlan.batches }).afterCount, 2);

var wrongBatchEntries = cloneValue(duplicateEntries);
wrongBatchEntries[1].result.modules[0].cases = [duplicateCases[0]];
assert.throws(function() {
  batchCore.mergeBatchResults(duplicateModules, wrongBatchEntries, { expectedBatches: duplicatePlan.batches });
}, /非目标用例/);

['moduleId', 'module'].forEach(function(field) {
  var invalidIdentityEntries = cloneValue(duplicateEntries);
  invalidIdentityEntries[0].result.modules[0][field] = '被改写的身份';
  assert.throws(function() {
    batchCore.mergeBatchResults(duplicateModules, invalidIdentityEntries, { expectedBatches: duplicatePlan.batches });
  }, /模块(ID|标题)被改写/);
  assert.throws(function() {
    batchCore.mergeBatchResults(duplicateModules, invalidIdentityEntries);
  }, /模块(ID|标题)被改写/);
});

[null, 3, 'invalid', []].forEach(function(caseItem) {
  var invalidResultEntries = cloneValue(duplicateEntries);
  invalidResultEntries[0].result.modules[0].cases = [caseItem];
  assert.throws(function() {
    batchCore.mergeBatchResults(duplicateModules, invalidResultEntries, { expectedBatches: duplicatePlan.batches });
  }, /无效用例标识/);
});
var repeatedCaseEntries = cloneValue(duplicateEntries);
repeatedCaseEntries[0].result.modules[0].cases = [duplicateCases[0], duplicateCases[0]];
assert.throws(function() {
  batchCore.mergeBatchResults(duplicateModules, repeatedCaseEntries, { expectedBatches: duplicatePlan.batches });
}, /重复用例标识/);
assert.throws(function() {
  batchCore.mergeBatchResults(duplicateModules, [{ result: { modules: [{ moduleKey: 'unknown', module: '未知模块', cases: [] }] } }]);
}, /非目标模块/);
assert.throws(function() {
  batchCore.mergeBatchResults(duplicateModules, [{ result: { modules: [{
    moduleId: 'duplicate-module', moduleKey: 'duplicate-module', module: '重复模块', cases: [buildCase(99, 1)],
  }] } }]);
}, /非目标用例/);

console.log('xmind_dedupe_batch_core.test.js passed');
