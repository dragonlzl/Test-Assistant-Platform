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
assert.strictEqual(typeof finalBatchReference.steps, 'string');
assert.ok(finalBatchReference.steps.length <= 280);

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
var merged = batchCore.mergeBatchResults(modules, batchEntries);
assert.strictEqual(merged.modules.length, 18);
assert.strictEqual(merged.beforeCount, 188);
assert.strictEqual(merged.afterCount, 184);
assert.strictEqual(merged.removedCount, 4);
assert.strictEqual(merged.removedCases.length, 4);
assert.ok(merged.diagnostics[0].indexOf('批次 1') !== -1);

console.log('xmind_dedupe_batch_core.test.js passed');
