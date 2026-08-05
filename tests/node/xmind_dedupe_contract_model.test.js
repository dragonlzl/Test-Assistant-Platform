'use strict';

var assert = require('assert');
var contractModel = require('../../scripts/core/xmindDedupeContractModel.js');

var modelContract = contractModel.buildModelOperationContract({
  dedupeMode: 'dedupe_only',
  strength: 'conservative',
  source: 'manual-toolbar',
});
assert.strictEqual(modelContract.dedupe_mode, 'dedupe_only');
assert.strictEqual(modelContract.simplify, false);
assert.strictEqual(modelContract.return_full_replacement, true);
assert.strictEqual(modelContract.return_changed_modules_only_allowed, false);
assert.deepStrictEqual(modelContract.module_return_policy, {
  return_all_input_modules: true,
  preserve_module_id_and_key: true,
  unchanged_modules_must_be_returned: true,
  partial_modules_response_allowed: false,
});
assert.strictEqual(modelContract.review_method, 'exhaustive_global_pairwise_scan');
assert.strictEqual(Object.prototype.hasOwnProperty.call(modelContract, 'batch_mode'), false);

var batchContract = contractModel.buildModelOperationContract({
  dedupeMode: 'dedupe_simplify',
  batchMode: true,
  batchIndex: 2,
  batchCount: 4,
  editableModuleKeys: ['module-a'],
  readonlyReferenceModuleKeys: ['module-b'],
});
assert.strictEqual(batchContract.simplify, true);
assert.strictEqual(batchContract.batch_mode, true);
assert.strictEqual(batchContract.batch_index, 2);
assert.deepStrictEqual(batchContract.editable_module_keys, ['module-a']);
assert.deepStrictEqual(batchContract.readonly_reference_module_keys, ['module-b']);
assert.strictEqual(batchContract.readonly_reference_policy.return_reference_modules, false);

var taskContract = contractModel.buildTaskOperationContract({
  dedupeMode: 'dedupe_simplify',
});
assert.strictEqual(taskContract.dedupeMode, 'dedupe_simplify');
assert.strictEqual(taskContract.returnFullReplacement, true);
assert.strictEqual(taskContract.returnChangedModulesOnlyAllowed, false);
assert.deepStrictEqual(taskContract.moduleReturnPolicy, {
  returnAllInputModules: true,
  preserveModuleIdAndKey: true,
  unchangedModulesMustBeReturned: true,
  partialModulesResponseAllowed: false,
});
assert.strictEqual(taskContract.reviewMethod, 'exhaustive_global_pairwise_scan');

var promptPolicy = contractModel.buildReturnPolicyPrompt({ batchMode: true });
assert.ok(promptPolicy.batchContextLines.join('\n').indexOf('全部 target_modules') !== -1);
assert.ok(promptPolicy.reviewLine.indexOf('全部可编辑输入模块') !== -1);
assert.ok(promptPolicy.reviewLine.indexOf('不得只返回发生变化的模块') !== -1);
assert.ok(promptPolicy.moduleConstraintLine.indexOf('不得省略未变化模块') !== -1);

console.log('xmind dedupe contract model tests passed');
