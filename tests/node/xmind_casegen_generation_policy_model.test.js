'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var caseModelFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenCaseModel.js'
));
var policyFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenGenerationPolicyModel.js'
));

var rootActions = {
  FULL_CASES: 'root-full-cases',
  FULL_MODULES: 'root-full-modules',
  REGENERATE_MODULES: 'root-regenerate-modules',
  EXISTING_CASES: 'root-existing-cases',
  TOPUP_MODULES: 'root-topup-modules',
  TOPUP_MODULES_CASES: 'root-topup-modules-cases',
  APPEND_ALL: 'root-append-all',
};
var moduleActions = {
  FULL_CASES: 'module-full-cases',
  APPEND: 'module-append',
};

function cloneJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return fallback;
  }
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r/g, '\n').replace(/\s+/g, ' ').trim();
}

function stringifyField(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return normalizeText(item); }).filter(Boolean).join('；');
  }
  if (value && typeof value === 'object') return JSON.stringify(value);
  return normalizeText(value);
}

function normalizeModuleTitle(value) {
  return stringifyField(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeArrayField(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return normalizeText(item); }).filter(Boolean);
  }
  var text = normalizeText(value);
  return text ? [text] : [];
}

var caseModel = caseModelFactory.create({
  normalizeText: normalizeText,
  stringifyField: stringifyField,
  normalizeModuleTitle: normalizeModuleTitle,
  normalizeCaseTitle: function(value) { return normalizeText(value).toLowerCase(); },
});
var policy = policyFactory.create({
  rootActions: rootActions,
  moduleActions: moduleActions,
  cloneJson: cloneJson,
  normalizeModuleTitle: normalizeModuleTitle,
  normalizeModuleKey: function(value) { return normalizeModuleTitle(value).toLowerCase(); },
  normalizeArrayField: normalizeArrayField,
  normalizeCaseTitle: function(value) { return normalizeText(value).toLowerCase(); },
  normalizeCaseItem: caseModel.normalizeCaseItem,
  getVisibleCasesForModuleEntry: function(entry) {
    return entry && Array.isArray(entry.rows) ? entry.rows : [];
  },
  normalizeHistoryLongText: function(value, maxLength) {
    var text = normalizeText(value);
    return text.length > maxLength ? (text.slice(0, maxLength) + '…') : text;
  },
});

function verifyOperationContracts() {
  assert.deepStrictEqual(policy.createOperationContract(rootActions.FULL_CASES), {
    scope: 'root',
    mode: 'full_cases',
    targetModule: '',
    allowNewModules: true,
    generateCasesForNewModules: false,
    generateCasesForExistingModules: false,
    dedupeAgainstVisibleModules: false,
    dedupeAgainstVisibleCases: false,
  });
  assert.strictEqual(
    policy.createOperationContract(rootActions.FULL_MODULES).dedupeAgainstVisibleModules,
    true
  );
  assert.strictEqual(
    policy.createOperationContract(rootActions.REGENERATE_MODULES).dedupeAgainstVisibleModules,
    false
  );

  var existing = policy.createOperationContract(rootActions.EXISTING_CASES);
  assert.strictEqual(existing.existingCasesCompletion, true);
  assert.strictEqual(existing.discoveryThenModuleCases, true);
  assert.strictEqual(existing.generationPolicy.source, 'xmind_existing_cases_completion');

  var topupCases = policy.createOperationContract(rootActions.TOPUP_MODULES_CASES);
  assert.strictEqual(topupCases.generateCasesForNewModules, true);
  assert.strictEqual(topupCases.generateCasesForExistingModules, false);

  var appendAll = policy.createOperationContract(rootActions.APPEND_ALL);
  assert.strictEqual(appendAll.importedBaselineCompletion, true);
  assert.strictEqual(appendAll.generationPolicy.source, 'xmind_imported_baseline_completion');

  var moduleAppend = policy.createOperationContract(moduleActions.APPEND, { title: '登录' });
  assert.strictEqual(moduleAppend.mode, 'module_append_cases');
  assert.strictEqual(moduleAppend.targetModule, '登录');
  assert.strictEqual(moduleAppend.dedupeAgainstVisibleCases, true);

  var moduleFull = policy.createOperationContract(moduleActions.FULL_CASES, { title: '支付' });
  assert.strictEqual(moduleFull.mode, 'module_full_cases');
  assert.strictEqual(moduleFull.dedupeAgainstVisibleCases, false);

  var fallback = policy.createOperationContract('unknown', { title: '其他' });
  assert.strictEqual(fallback.mode, 'module_full_cases');
  assert.strictEqual(fallback.dedupeAgainstVisibleCases, true);
}

function verifyCompletionPolicies() {
  var source = { scope: 'module', mode: 'module_append_cases', untouched: true };
  var existing = policy.applyExistingCasesCompletionPolicy(source);
  var imported = policy.applyImportedBaselineCompletionPolicy(source);
  assert.deepStrictEqual(source, { scope: 'module', mode: 'module_append_cases', untouched: true });
  assert.strictEqual(existing.existingCasesCompletion, true);
  assert.strictEqual(existing.generateCasesForExistingModules, true);
  assert.strictEqual(existing.generationPolicy.protectImportedCases, true);
  assert.strictEqual(imported.importedBaselineCompletion, true);
  assert.strictEqual(imported.generationPolicy.avoidImportedCaseLinearExpansion, true);
  assert.strictEqual(policy.getExistingCasesCompletionPolicy({}), null);
  assert.strictEqual(policy.getImportedBaselineCompletionPolicy({}), null);
  assert.strictEqual(
    policy.getExistingCasesCompletionPolicy({ mode: 'existing_modules_cases' }).source,
    'xmind_existing_cases_completion'
  );
  assert.strictEqual(
    policy.getImportedBaselineCompletionPolicy({ mode: 'append_all_modules_cases' }).source,
    'xmind_imported_baseline_completion'
  );
  var custom = { source: 'custom' };
  assert.strictEqual(policy.getExistingCasesCompletionPolicy({
    existingCasesCompletion: true,
    generationPolicy: custom,
  }), custom);
}

function verifyContractFiltering() {
  var visibleEntry = {
    rows: [{ item: { title: '已有用例' } }],
  };
  var visibleContext = {
    map: {
      login: visibleEntry,
    },
  };
  var input = [
    {
      module: ' Login ',
      scenarios: ['正常'],
      cases: [
        { title: '已有用例', expected: '旧结果' },
        { title: '新增用例', expected: '新结果' },
        { title: '新增用例', expected: '重复结果' },
      ],
    },
    { module: 'login', cases: [] },
    { module: '支付', cases: [{ title: '支付成功', expected: '完成' }] },
  ];
  var filtered = policy.filterModulesByContract(
    input,
    policy.createOperationContract(rootActions.APPEND_ALL),
    visibleContext
  );
  assert.strictEqual(filtered.list.length, 2);
  assert.deepStrictEqual(filtered.list[0].cases.map(function(item) { return item.title; }), ['新增用例']);
  assert.deepStrictEqual(filtered.list[1].cases.map(function(item) { return item.title; }), ['支付成功']);
  assert.strictEqual(filtered.diagnostics.inputModuleCount, 3);
  assert.strictEqual(filtered.diagnostics.inputCaseCount, 4);
  assert.strictEqual(filtered.diagnostics.outputModuleCount, 2);
  assert.strictEqual(filtered.diagnostics.outputCaseCount, 2);
  assert.strictEqual(filtered.diagnostics.skippedDuplicateOutputModules, 1);
  assert.strictEqual(filtered.diagnostics.skippedCaseDuplicateVisible, 1);
  assert.strictEqual(filtered.diagnostics.skippedCaseDuplicateWithinModule, 1);

  var modulesOnly = policy.filterModulesByContract(
    input,
    policy.createOperationContract(rootActions.FULL_MODULES),
    visibleContext
  );
  assert.strictEqual(modulesOnly.list.length, 1);
  assert.strictEqual(modulesOnly.list[0].module, '支付');
  assert.deepStrictEqual(modulesOnly.list[0].cases, []);
  assert.strictEqual(modulesOnly.diagnostics.skippedDuplicateVisibleModules, 1);
  assert.strictEqual(modulesOnly.diagnostics.clearedCasesForNewModules, 1);

  var moduleOnly = policy.filterModulesByContract(input, {
    scope: 'module',
    targetModule: 'Login',
    allowNewModules: false,
    generateCasesForNewModules: false,
    generateCasesForExistingModules: true,
    dedupeAgainstVisibleModules: false,
    dedupeAgainstVisibleCases: false,
  }, visibleContext);
  assert.strictEqual(moduleOnly.list.length, 1);
  assert.strictEqual(moduleOnly.diagnostics.skippedTargetMismatchModules, 1);
}

function verifyCaseMerge() {
  var existing = [{ title: '已有一' }];
  var visible = [{ title: '已有二' }];
  var added = [
    { title: '已有一' },
    { title: '已有二' },
    { title: '新增' },
    { title: '新增' },
  ];
  var merged = policy.mergeCasesWithoutDuplicates(existing, added, visible);
  assert.deepStrictEqual(merged.merged.map(function(item) { return item.title; }), ['已有一', '新增']);
  assert.deepStrictEqual(merged.appended.map(function(item) { return item.title; }), ['新增']);
  assert.deepStrictEqual(merged.diagnostics, {
    candidateCount: 4,
    appendedCount: 1,
    duplicateAgainstExisting: 2,
    duplicateWithinAdded: 1,
  });
  assert.strictEqual(existing.length, 1);
  assert.strictEqual(added.length, 4);
}

function verifyErrorsAndNoChangeReasons() {
  assert.strictEqual(
    policy.buildGenerationErrorInfo(new Error('request timeout 超时')).reasonText,
    '模型响应超时，请稍后重试。'
  );
  assert.strictEqual(
    policy.buildGenerationErrorInfo(new Error('HTTP 503 Service Unavailable')).reasonText,
    '模型服务暂时不可用，请稍后重试。'
  );
  assert.strictEqual(
    policy.buildGenerationErrorInfo(new Error('Failed to fetch')).reasonText,
    '模型连接失败，请检查网络后重试。'
  );
  assert.match(
    policy.buildGenerationErrorInfo(new Error('maximum context length exceeded')).reasonText,
    /模型上下文超限/
  );
  assert.strictEqual(
    policy.buildGenerationErrorInfo(new Error('XMind 请求体超出当前上限：10')).reasonText,
    'XMind 请求体超出当前上限：10'
  );

  var plainText = policy.buildRootNoChangeInfo(rootActions.TOPUP_MODULES, {}, {}, {
    parseStatus: 'plain-text',
    rawPreview: '模型说明文字',
  });
  assert.strictEqual(plainText.reasonText, '模型返回的是说明文字，不是系统可识别的结果。');
  assert.deepStrictEqual(plainText.diagnostics, ['返回格式：说明文字']);
  assert.strictEqual(plainText.previewText, '模型说明文字');

  var duplicateModules = policy.buildRootNoChangeInfo(rootActions.TOPUP_MODULES, {
    inputModuleCount: 1,
    outputModuleCount: 0,
    skippedDuplicateVisibleModules: 1,
  }, {}, {});
  assert.strictEqual(duplicateModules.reasonText, '当前模块已经覆盖，不需要再补充新模块。');
  assert.deepStrictEqual(duplicateModules.diagnostics, ['已有模块已覆盖 1 个']);

  var moduleDuplicate = policy.buildModuleNoChangeInfo(moduleActions.APPEND, {
    inputModuleCount: 1,
    inputCaseCount: 1,
    outputModuleCount: 1,
    skippedCaseDuplicateVisible: 1,
  }, {
    duplicateAgainstExisting: 1,
  }, {
    cases: [],
  }, {});
  assert.strictEqual(moduleDuplicate.reasonText, '当前模块已有用例已经覆盖，本轮没有补出新的用例。');
  assert.deepStrictEqual(moduleDuplicate.diagnostics, ['已有用例已覆盖 2 条']);

  assert.strictEqual(policy.getDiagnosticsMetric({ value: -1 }, 'value'), 0);
  assert.strictEqual(policy.getDiagnosticsMetric({ value: '3' }, 'value'), 3);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  assert.match(parentSource, /window\.app\.xmindCasegenGenerationPolicyModel/);
  assert.match(parentSource, /generationPolicyModelFactory\.create\(\{/);
  assert.ok(!/function createOperationContract\(/.test(parentSource));
  assert.ok(!/function filterModulesByContract\(/.test(parentSource));
  assert.ok(!/function mergeCasesWithoutDuplicates\(/.test(parentSource));
  assert.ok(!/function buildRootNoChangeInfo\(/.test(parentSource));
  assert.ok(!/function buildModuleNoChangeInfo\(/.test(parentSource));
  var moduleSuccessSource = parentSource.slice(
    parentSource.indexOf('function completeModuleTaskSuccess('),
    parentSource.indexOf('function completeModuleTaskError(')
  );
  assert.strictEqual((moduleSuccessSource.match(/caseCount: 0/g) || []).length, 1);
  ['index.html', 'ai-workflow.html'].forEach(function(page) {
    var source = fs.readFileSync(path.join(projectRoot, page), 'utf8');
    var modelIndex = source.indexOf('./scripts/modules/xmindCasegen/xmindCasegenGenerationPolicyModel.js');
    var parentIndex = source.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(modelIndex >= 0 && modelIndex < parentIndex, page + ' must load generation policy model first');
  });
}

verifyOperationContracts();
verifyCompletionPolicies();
verifyContractFiltering();
verifyCaseMerge();
verifyErrorsAndNoChangeReasons();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen generation policy model tests passed');
