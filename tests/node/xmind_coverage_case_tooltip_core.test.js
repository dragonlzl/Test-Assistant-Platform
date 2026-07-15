'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var context = vm.createContext({
  window: { app: {} },
  Array: Array,
  Math: Math,
  Number: Number,
  Object: Object,
  String: String,
});
var source = fs.readFileSync(path.join(projectRoot, 'scripts/core/xmindCoverageCaseTooltipCore.js'), 'utf8');
vm.runInContext(source, context, { filename: 'scripts/core/xmindCoverageCaseTooltipCore.js' });

var core = context.window.app.xmindCoverageCaseTooltipCore;
var detail = core.normalizeCaseDetail({
  module: '登录模块',
  title: '登录成功校验',
  preconditions: '账号已存在',
  steps: ['1、进入登录页', '2、输入正确账号密码'],
  expected: '进入首页',
});

assert.strictEqual(detail.module, '登录模块');
assert.strictEqual(detail.title, '登录成功校验');
assert.strictEqual(detail.preconditions, '账号已存在');
assert.deepStrictEqual(Array.prototype.slice.call(detail.steps), ['1、进入登录页', '2、输入正确账号密码']);
assert.strictEqual(detail.expected, '进入首页');

var leftPosition = core.computeTooltipPosition(
  { left: 700, top: 200, right: 900, bottom: 240, width: 200, height: 40 },
  { width: 360, height: 220 },
  { width: 1200, height: 800 },
  12
);
assert.deepStrictEqual(JSON.parse(JSON.stringify(leftPosition)), {
  left: 328,
  top: 110,
  placement: 'left',
});

var rightPosition = core.computeTooltipPosition(
  { left: 80, top: 100, right: 220, bottom: 140, width: 140, height: 40 },
  { width: 360, height: 220 },
  { width: 1200, height: 800 },
  12
);
assert.strictEqual(rightPosition.left, 232);
assert.strictEqual(rightPosition.placement, 'right');

console.log('xmind_coverage_case_tooltip_core.test.js passed');
