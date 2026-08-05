'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenGenerationSettingsModel.js'
);

function createDefaultSettings() {
  return {
    customRequirement: '',
    dedupeSimplify: false,
    needFunctionCondition: false,
    needNumericValidation: false,
    needBoundary: false,
    needMobile: false,
    needSpecial: false,
    specialRepeatOperation: false,
    specialMultiTouch: false,
    specialRepeatExecution: false,
    specialWeakNetwork: false,
    specialInterruptResume: false,
  };
}

function createHarness(factory) {
  var state = {
    assignments: { xmindCaseGenPrompt: '项目专用提示词' },
    caseGenSettings: Object.assign(createDefaultSettings(), {
      customRequirement: '  标题简洁  ',
      dedupeSimplify: true,
      needFunctionCondition: true,
      needBoundary: true,
      needSpecial: true,
      specialWeakNetwork: true,
    }),
  };
  var calls = {
    externalSettings: [],
    reconfirm: [],
    persists: [],
  };
  var existingPolicy = false;
  var importedPolicy = false;
  var model = factory.create({
    getState: function() { return state; },
    ensureCaseGenSettings: function() { return state.caseGenSettings; },
    createDefaultCaseGenSettings: createDefaultSettings,
    defaultPrompts: { xmindcasegen: '默认提示词' },
    dedupeModeOnly: 'dedupe_only',
    dedupeModeSimplify: 'dedupe_simplify',
    getExistingCasesCompletionPolicy: function() { return existingPolicy; },
    getImportedBaselineCompletionPolicy: function() { return importedPolicy; },
    getCaseGenPromptComponents: function(settings) {
      return settings.needBoundary ? ['边界附加组件'] : [];
    },
    setCaseGenSettingValue: function(key, value) { calls.externalSettings.push([key, value]); },
    markPrepNeedsReconfirm: function(immediate) { calls.reconfirm.push(immediate); },
    persistXmindState: function(immediate) { calls.persists.push(immediate); },
  });
  return {
    model: model,
    state: state,
    calls: calls,
    useExistingPolicy: function(value) { existingPolicy = value; },
    useImportedPolicy: function(value) { importedPolicy = value; },
  };
}

function verifySettingsSnapshot(factory) {
  var harness = createHarness(factory);
  var snapshot = harness.model.buildXmindGenerationOptionsSnapshot();
  assert.deepStrictEqual(snapshot, {
    customRequirement: '标题简洁',
    needFunctionCondition: true,
    needNumericValidation: false,
    needBoundary: true,
    needMobile: false,
    needSpecial: true,
    specialRepeatOperation: false,
    specialMultiTouch: false,
    specialRepeatExecution: false,
    specialWeakNetwork: true,
    specialInterruptResume: false,
  });
  harness.state.caseGenSettings.needSpecial = false;
  assert.strictEqual(harness.model.buildXmindGenerationOptionsSnapshot().specialWeakNetwork, false);
}

function verifyDedupeRules(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  assert.strictEqual(model.normalizeDedupeMode('unknown'), 'dedupe_only');
  assert.strictEqual(model.normalizeDedupeMode('dedupe_simplify'), 'dedupe_simplify');
  assert.strictEqual(model.isDedupeSimplifyMode('dedupe_simplify'), true);
  assert.strictEqual(model.getDedupeModeFromSettings(), 'dedupe_simplify');
  assert.strictEqual(model.getDedupeModeActionText('dedupe_only'), '仅去重');
  assert.strictEqual(model.getDedupeBatchProgressText({ batchCompleted: 8, batchTotal: 5 }), '5/5');
  assert.strictEqual(model.getDedupeRunningLabel('dedupe_simplify', {
    batchCompleted: 2,
    batchTotal: 5,
  }), 'AI 去重精简中 2/5');
  assert.match(model.getDedupeRunningHint('dedupe_only', { batchCompleted: 1, batchTotal: 3 }), /批次进度 1\/3/);
  assert.strictEqual(model.getDedupeRemovedSummaryText(2, 'dedupe_only'), '已去重 2 条用例');
  assert.match(model.getDedupeNoChangeSummaryText('dedupe_simplify'), /去重精简完成/);
  assert.match(model.getDedupeExecutionDiagnosticText(2, 'dedupe_simplify'), /已去重精简 2 条用例/);
}

function verifyOptionSummariesAndConstraints(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  var snapshot = model.buildXmindGenerationOptionsSnapshot();
  var summary = model.buildXmindGenerationOptionsSummary(snapshot);
  assert.match(summary, /额外要求：标题简洁/);
  assert.match(summary, /功能使用条件/);
  assert.match(summary, /边界/);
  assert.match(summary, /弱网/);
  assert.deepStrictEqual(model.buildEnabledXmindOptionLabels(snapshot), [
    '功能使用条件',
    '边界场景',
    '特殊场景',
  ]);
  assert.strictEqual(model.isRootFullGenerationContract({ scope: 'root', mode: 'full_cases' }), true);
  assert.strictEqual(model.isRootFullGenerationContract({ scope: 'module', mode: 'full_cases' }), false);

  var hard = model.buildXmindHardConstraintText({ scope: 'root', mode: 'full_cases' }, snapshot);
  assert.match(hard, /硬性覆盖要求/);
  assert.match(hard, /模块拆分阶段/);
  assert.match(hard, /解锁条件/);

  harness.useExistingPolicy(true);
  var existing = model.buildXmindHardConstraintText({ scope: 'root', mode: 'existing_cases' }, snapshot);
  assert.match(existing, /补全第一阶段/);
  assert.match(existing, /只返回缺失的新模块/);
  harness.useExistingPolicy(false);
  harness.useImportedPolicy(true);
  var imported = model.buildXmindHardConstraintText({ scope: 'root', mode: 'append_all' }, snapshot);
  assert.match(imported, /覆盖参考和去重基线/);
  assert.match(imported, /不要因为导入用例很多就机械扩写/);
}

function verifyMutationAndPrompt(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  model.applyCaseGenOptionToSharedSettings('needSpecial', false);
  assert.strictEqual(harness.state.caseGenSettings.needSpecial, false);
  assert.strictEqual(harness.state.caseGenSettings.specialWeakNetwork, false);
  model.setCaseGenOption('customRequirement', '更新要求');
  assert.strictEqual(harness.state.caseGenSettings.customRequirement, '更新要求');
  assert.deepStrictEqual(harness.calls.externalSettings, [['customRequirement', '更新要求']]);
  assert.deepStrictEqual(harness.calls.reconfirm, [false]);
  assert.deepStrictEqual(harness.calls.persists, [false]);

  harness.state.caseGenSettings.needBoundary = true;
  var prompt = model.buildXmindPrompt({ scope: 'root', mode: 'full_modules' });
  assert.match(prompt, /^默认提示词\n\n项目专用提示词/);
  assert.match(prompt, /边界附加组件/);
  assert.match(prompt, /【XMind 生成硬约束】/);
  assert.match(prompt, /operation_contract\(JSON\)：\{"scope":"root","mode":"full_modules"\}/);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'getCaseGenSettingsSnapshot',
    'buildXmindGenerationOptionsSnapshot',
    'normalizeDedupeMode',
    'isDedupeSimplifyMode',
    'getDedupeModeFromSettings',
    'getDedupeModeActionText',
    'getDedupeBatchProgressText',
    'getDedupeRunningLabel',
    'getDedupeRunningHint',
    'getDedupeRemovedSummaryText',
    'getDedupeNoChangeSummaryText',
    'getDedupeExecutionDiagnosticText',
    'buildXmindGenerationOptionsSummary',
    'buildEnabledXmindOptionLabels',
    'isRootFullGenerationContract',
    'buildXmindHardConstraintText',
    'applyCaseGenOptionToSharedSettings',
    'setCaseGenOption',
    'buildXmindPrompt',
  ].forEach(function(name) {
    assert.match(ownerSource, new RegExp('function\\s+' + name + '\\s*\\('));
    assert.doesNotMatch(parentSource, new RegExp('function\\s+' + name + '\\s*\\('));
  });
  assert.match(parentSource, /xmindCasegenGenerationSettingsModel/);
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenGenerationSettingsModel.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load generation settings first');
  });
}

function run() {
  var factory = require(ownerPath);
  verifySettingsSnapshot(factory);
  verifyDedupeRules(factory);
  verifyOptionSummariesAndConstraints(factory);
  verifyMutationAndPrompt(factory);
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen generation settings model tests passed');
}

run();
