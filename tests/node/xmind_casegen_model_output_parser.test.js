'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var caseModelFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenCaseModel.js'
));
var parserFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenModelOutputParser.js'
));

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

var caseModel = caseModelFactory.create({
  normalizeText: normalizeText,
  stringifyField: stringifyField,
  normalizeModuleTitle: normalizeModuleTitle,
  normalizeCaseTitle: function(value) { return normalizeText(value).toLowerCase(); },
});
var parser = parserFactory.create({
  stripCodeFence: function(text) {
    var raw = String(text || '').trim();
    var matched = raw.match(/^```[\w-]*\n([\s\S]*?)```$/);
    return matched && matched[1] ? matched[1].trim() : raw;
  },
  normalizeModuleTitle: normalizeModuleTitle,
  normalizeArrayField: function(value) {
    if (Array.isArray(value)) {
      return value.map(function(item) { return normalizeText(item); }).filter(Boolean);
    }
    var text = normalizeText(value);
    return text ? [text] : [];
  },
  normalizeCaseItem: caseModel.normalizeCaseItem,
});

function verifyStructuredOutput() {
  var output = parser.normalizeModelModulesOutputDetailed('```json\n' + JSON.stringify({
    modules: [
      {
        module: ' 登录 ',
        scenarios: '正常登录',
        points: ['账号校验'],
        coupled: ['安全'],
        cases: [
          { title: '登录成功', priority: 'P0', steps: ['输入账号'], expected: '进入首页' },
          null,
        ],
      },
      'invalid-module',
    ],
  }) + '\n```');

  assert.strictEqual(output.list.length, 1);
  assert.deepStrictEqual(output.list[0], {
    module: '登录',
    key_scenarios: ['正常登录'],
    test_points: ['账号校验'],
    coupled_modules: ['安全'],
    cases: [{
      module: '登录',
      title: '登录成功',
      priority: 'P0',
      preconditions: '',
      steps: ['1、输入账号'],
      expected: '进入首页',
    }],
  });
  assert.deepStrictEqual(output.diagnostics, {
    rawHasText: true,
    rawPreview: output.diagnostics.rawPreview,
    parseStatus: 'json',
    parseMode: 'direct',
    payloadKind: 'object',
    sourceKind: 'modules',
    missingModulesArray: false,
    emptyModulesArray: false,
    moduleCandidateCount: 2,
    normalizedModuleCount: 1,
    skippedNonObjectModules: 1,
    caseCandidateCount: 2,
    normalizedCaseCount: 1,
    skippedInvalidCases: 1,
  });
}

function verifyExtractionFallbacks() {
  var objectSlice = parser.normalizeModelModulesOutputDetailed('模型结果： {"data":[]} 完成');
  assert.strictEqual(objectSlice.diagnostics.parseMode, 'object-slice');
  assert.strictEqual(objectSlice.diagnostics.sourceKind, 'data');
  assert.strictEqual(objectSlice.diagnostics.emptyModulesArray, true);

  var arraySlice = parser.normalizeModelModulesOutputDetailed('结果： [1, 2] 完成');
  assert.strictEqual(arraySlice.diagnostics.parseMode, 'array-slice');
  assert.strictEqual(arraySlice.diagnostics.sourceKind, 'root-array');
  assert.strictEqual(arraySlice.diagnostics.skippedNonObjectModules, 2);

  var rootArray = parser.normalizeModelModulesOutputDetailed('[{"name":"支付","cases":[]}]');
  assert.strictEqual(rootArray.diagnostics.parseMode, 'direct');
  assert.strictEqual(rootArray.diagnostics.sourceKind, 'root-array');
  assert.strictEqual(rootArray.list[0].module, '支付');

  var missing = parser.normalizeModelModulesOutputDetailed('{"message":"ok"}');
  assert.strictEqual(missing.diagnostics.missingModulesArray, true);
  assert.strictEqual(missing.diagnostics.payloadKind, 'object');

  var scalar = parser.extractJsonPayloadDetailed('"ok"');
  assert.strictEqual(scalar.payload, 'ok');
  assert.strictEqual(scalar.diagnostics.parseMode, 'direct');

  var invalid = parser.extractJsonPayloadDetailed('{invalid');
  assert.strictEqual(invalid.payload, null);
  assert.strictEqual(invalid.diagnostics.parseStatus, 'invalid-json');

  var plain = parser.extractJsonPayloadDetailed('模型没有返回结构化数据');
  assert.strictEqual(plain.diagnostics.parseStatus, 'plain-text');
  assert.strictEqual(plain.diagnostics.rawHasText, true);

  var empty = parser.extractJsonPayloadDetailed('');
  assert.strictEqual(empty.diagnostics.parseStatus, 'empty');
  assert.strictEqual(empty.diagnostics.rawHasText, false);
}

function verifyOutputTextLimits() {
  assert.strictEqual(parser.summarizeModelOutputText('  a   b  ', 10), 'a b');
  assert.strictEqual(parser.summarizeModelOutputText('x'.repeat(20), 5), 'xxxxx…');
  assert.strictEqual(parser.normalizeHistoryLongText('y'.repeat(2100), 2000).length, 2001);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  assert.match(parentSource, /window\.app\.xmindCasegenModelOutputParser/);
  assert.match(parentSource, /modelOutputParserFactory\.create\(\{/);
  assert.ok(!/function extractJsonPayloadDetailed\(/.test(parentSource));
  assert.ok(!/function normalizeModelModulesOutputDetailed\(/.test(parentSource));
  assert.ok(!/function extractJsonPayload\(/.test(parentSource));
  assert.ok(!/function normalizeModelModulesOutput\(/.test(parentSource));
  ['index.html', 'ai-workflow.html'].forEach(function(page) {
    var source = fs.readFileSync(path.join(projectRoot, page), 'utf8');
    var caseModelIndex = source.indexOf('./scripts/modules/xmindCasegen/xmindCasegenCaseModel.js');
    var parserIndex = source.indexOf('./scripts/modules/xmindCasegen/xmindCasegenModelOutputParser.js');
    var parentIndex = source.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(caseModelIndex >= 0 && caseModelIndex < parserIndex, page + ' must load case model first');
    assert.ok(parserIndex >= 0 && parserIndex < parentIndex, page + ' must load output parser before parent');
  });
}

verifyStructuredOutput();
verifyExtractionFallbacks();
verifyOutputTextLimits();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen model output parser tests passed');
