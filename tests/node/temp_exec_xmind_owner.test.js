'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(projectRoot, 'scripts/modules/tempExecXmindOwner.js'));

function buildCase(overrides) {
  return Object.assign({
    module: '登录',
    title: '正常登录',
    priority: 'P1',
    preconditions: '已注册',
    steps: '输入账号和密码',
    expected: '进入首页',
  }, overrides || {});
}

function verifyPureModels() {
  var existing = [
    buildCase({ id: 11 }),
    buildCase({ id: 12, module: '旧模块', title: '旧用例', expected: '旧结果' }),
  ];
  var next = [
    buildCase({ priority: 'P0' }),
    buildCase({ module: '支付', title: '支付成功', expected: '显示成功页' }),
  ];
  var diff = owner.buildPatchDiff(existing, next);
  assert.strictEqual(diff.updates.length, 1);
  assert.strictEqual(diff.creates.length, 1);
  assert.strictEqual(diff.deletes.length, 1);
  assert.strictEqual(diff.merged.length, 2);
  assert.strictEqual(diff.merged[0].id, 11);
  assert.strictEqual(diff.merged[0].priority, 'P0');
  assert.strictEqual(diff.merged[1].actual, '未执行');

  assert.strictEqual(owner.findCaseIndexByPath(['登录', '正常登录'], existing, null), 0);
  assert.strictEqual(owner.findCaseIndexByPath(['不存在'], existing, null), -1);
  assert.strictEqual(owner.resolveDirection(next), 'right');
  assert.strictEqual(owner.resolveDirection([
    buildCase({ module: '一' }),
    buildCase({ module: '二' }),
    buildCase({ module: '三' }),
  ]), 'side');
  assert.deepStrictEqual(owner.normalizeCase({
    module_name: ' 模块 ',
    case_title: ' 标题 ',
    precondition: ' 前置 ',
    result: ' 结果 ',
  }), {
    module: '模块',
    title: '标题',
    priority: 'P1',
    preconditions: '前置',
    precondition: '前置',
    steps: '',
    expected: '结果',
  });
}

async function verifyLocalSave() {
  var active = { id: 'local-file', cases: [buildCase({ id: 'local-case' })] };
  var persisted = 0;
  var rendered = 0;
  var statuses = [];
  var logs = [];
  var instance = owner.create({
    state: { tempExecActiveId: 'local-file' },
    api: {
      getTempExecFile: function(id) { return id === 'local-file' ? active : null; },
      persistTempExecState: function() { persisted += 1; },
      renderTempExecView: function() { rendered += 1; },
    },
    window: { app: {} },
    setStatus: function(element, text, type) { statuses.push({ text: text, type: type }); },
    safeLogOperation: function(action, targetType, targetId, detail) {
      logs.push({ action: action, targetType: targetType, targetId: targetId, detail: detail });
    },
  });
  var result = await instance.saveCases([buildCase({ priority: 'P0' })], { source: 'test' });
  assert.deepStrictEqual(result, { changed: 1, updates: 1, creates: 0, deletes: 0 });
  assert.strictEqual(active.cases[0].id, 'local-case');
  assert.strictEqual(active.cases[0].priority, 'P0');
  assert.strictEqual(persisted, 1);
  assert.strictEqual(rendered, 1);
  assert.strictEqual(statuses[statuses.length - 1].text, 'XMind 编辑保存成功');
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].action, 'save_exec_xmind_structure');
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');
  var ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecXmindOwner.js'), 'utf8');
  assert.ok(parentSource.indexOf('tempExecXmindOwner.create') !== -1);
  assert.strictEqual(parentSource.indexOf('function normalizeXmindExecCase('), -1);
  assert.strictEqual(parentSource.indexOf('function buildTempExecXmindPatchDiff('), -1);
  assert.strictEqual(parentSource.indexOf('function saveTempExecXmindCases('), -1);
  assert.strictEqual(parentSource.indexOf('function openTempExecXmindStructure('), -1);
  assert.ok(ownerSource.indexOf('function buildPatchDiff(') !== -1);
  assert.ok(ownerSource.indexOf('function saveCases(') !== -1);
  assert.ok(ownerSource.indexOf('async function open(') !== -1);

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/tempExecXmindOwner.js');
    var parentIndex = html.indexOf('./scripts/modules/tempexec.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the temp exec XMind owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the XMind owner before temp exec');
  });
}

assert.ok(owner && typeof owner.create === 'function');
verifyPureModels();
verifyOwnershipAndLoadOrder();
verifyLocalSave()
  .then(function() { console.log('temp exec XMind owner tests passed'); })
  .catch(function(error) {
    console.error(error);
    process.exitCode = 1;
  });
