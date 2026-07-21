'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var modelFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenCaseModel.js'
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

var model = modelFactory.create({
  normalizeText: normalizeText,
  stringifyField: stringifyField,
  normalizeModuleTitle: normalizeModuleTitle,
  normalizeCaseTitle: function(value) { return normalizeText(value).toLowerCase(); },
});

function verifyCaseNormalization() {
  var source = {
    module: ' 登录   模块 ',
    case_title: '1. 输入错误密码，确认错误提示',
    level: 'p2',
    precondition: ['已打开页面', '用户未登录'],
    actions: ['1. 输入错误密码', '2) 点击登录'],
    result: '显示错误提示',
  };
  var normalized = model.normalizeCaseItem(source, '备用模块');
  assert.deepStrictEqual(normalized, {
    module: '登录 模块',
    title: '输入错误密码，确认错误提示',
    priority: 'P2',
    preconditions: '已打开页面；用户未登录',
    steps: ['1、输入错误密码', '2、点击登录'],
    expected: '显示错误提示',
  });
  assert.deepStrictEqual(source.actions, ['1. 输入错误密码', '2) 点击登录']);

  assert.strictEqual(model.normalizeCasePriority('P0'), 'P0');
  assert.strictEqual(model.normalizeCasePriority('p3'), 'P1');
  assert.deepStrictEqual(model.normalizeCaseSteps('3. 提交表单'), ['1、提交表单']);
  assert.strictEqual(model.normalizeCaseItem(null, '登录'), null);
  assert.strictEqual(model.normalizeCaseItem({ title: '无预期' }, '登录').expected, '-');
  assert.strictEqual(
    model.compactCaseTitle('这是一个超过二十八个字符并且没有任何标点用于截断的特别特别长的用例标题').length,
    28
  );
}

function verifyFallbackDedupeAndSignature() {
  var list = model.normalizeFallbackCaseList([
    { title: '登录成功', priority: 'P0', steps: ['输入账号'], expected: '进入首页' },
    { title: ' 登录成功 ', priority: 'P2', steps: ['重复步骤'], expected: '重复结果' },
    null,
    { case_title: '登录失败', actions: '提交', result: '提示失败' },
  ], '登录');
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].priority, 'P0');
  assert.strictEqual(list[1].title, '登录失败');

  var left = {
    title: '支付成功',
    priority: 'p1',
    preconditions: '余额充足',
    steps: ['1、发起支付'],
    expected: '支付完成',
  };
  var right = {
    case_title: '支付成功',
    level: 'P1',
    precondition: '余额充足',
    actions: ['发起支付'],
    result: '支付完成',
  };
  assert.strictEqual(model.buildCaseSignature(left, '支付一'), model.buildCaseSignature(right, '支付二'));
  assert.strictEqual(model.buildCaseSignature(null, '支付'), '');
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  assert.match(parentSource, /window\.app\.xmindCasegenCaseModel/);
  assert.match(parentSource, /caseModelFactory\.create\(\{/);
  assert.ok(!/function normalizeCaseItem\(/.test(parentSource));
  assert.ok(!/function normalizeFallbackCaseList\(/.test(parentSource));
  assert.ok(!/function buildCaseSignature\(/.test(parentSource));
  ['index.html', 'ai-workflow.html'].forEach(function(page) {
    var source = fs.readFileSync(path.join(projectRoot, page), 'utf8');
    var modelIndex = source.indexOf('./scripts/modules/xmindCasegen/xmindCasegenCaseModel.js');
    var parentIndex = source.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(modelIndex >= 0 && modelIndex < parentIndex, page + ' must load case model first');
  });
}

verifyCaseNormalization();
verifyFallbackDedupeAndSignature();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen case model tests passed');
