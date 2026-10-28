'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var source = fs.readFileSync(path.resolve(__dirname, '../../scripts/modules/casePageAiGenPrep.js'), 'utf8');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function caseItem(title, moduleName, extra) {
  return Object.assign({
    module: moduleName || '登录',
    title: title,
    priority: 'P1',
    precondition: '',
    steps: '输入账号并提交',
    expected: '展示账号对应结果',
    remark: '',
  }, extra || {});
}

function modules() {
  return [{
    module: '登录', moduleId: 'login', moduleKey: 'login', coverage: 60, missing: false,
    cases: [caseItem('账号登录'), caseItem('密码登录')],
  }, {
    module: '账户', moduleId: 'account', moduleKey: 'account', coverage: 40, missing: true,
    cases: [caseItem('账户登录', '账户')],
  }];
}

function retainedResponse(request) {
  return { generated_modules: plain(request.generated_cases_editable), removed_cases: [] };
}

function relation(sourceCase, targetCase, type) {
  var record = { type: type || 'duplicate_generated', dedupe_id: sourceCase.dedupe_id, reason: '相同测试目标' };
  record[type === 'merge' ? 'merged_into_id' : 'duplicate_with_id'] = targetCase.dedupe_id;
  return record;
}

async function run(responseBuilder, options) {
  var settings = options || {};
  var context = vm.createContext({
    window: { app: {} }, console: console,
    setTimeout: function() { return 0; }, clearTimeout: function() {},
  });
  vm.runInContext(source, context, { filename: 'scripts/modules/casePageAiGenPrep.js' });
  var api = context.window.app.casePageAiGenPrep.init({ state: {}, xmindKnowledgeBaseApi: {} });
  var parsed = { modules: settings.modules || modules() };
  var before = plain(parsed.modules);
  var originalCases = settings.originalCases || [caseItem('已有登录', '登录', { id: 42 })];
  var originalSnapshot = plain(originalCases);
  var sent = null;
  await api.applyAiDedupeToParsed(parsed, originalCases, { settings: { dedupeSimplify: settings.simplify === true } }, {
    model: { id: 'mock' },
    callModelWithConfig: async function(model, userText) {
      sent = JSON.parse(userText);
      var response = await responseBuilder(sent);
      return typeof response === 'string' ? response : JSON.stringify(response);
    },
  });
  assert.deepStrictEqual(originalCases, originalSnapshot, '原有用例不得被修改');
  return { result: plain(parsed), before: before, sent: sent };
}

async function rejected(responseBuilder, message, options) {
  var test = await run(responseBuilder, options);
  assert.match(test.result.ai_dedupe_error, message);
  assert.deepStrictEqual(test.result.modules, test.before, '异常响应必须完整保留生成结果');
  assert.strictEqual(test.result.ai_dedupe, undefined);
  assert.strictEqual(test.result.removed_cases, undefined);
  return test;
}

async function verifyFailures() {
  await rejected(function() { return {}; }, /缺少 generated_modules/);
  await rejected(function() { return { error: 'upstream failure' }; }, /错误对象/);
  await rejected(function(request) { return '解释说明\n' + JSON.stringify(retainedResponse(request)); }, /JSON 不完整或包含额外内容/);
  await rejected(function(request) { return JSON.stringify(retainedResponse(request)) + '\n输出未完成'; }, /JSON 不完整或包含额外内容/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[0].cases.pop();
    return response;
  }, /漏报删除关系/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[0].cases[0].dedupe_id = 'unknown';
    return response;
  }, /未知用例/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[0].module = '未知模块';
    return response;
  }, /未知模块/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[0].moduleId = 'wrong-id';
    return response;
  }, /模块身份被修改/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[1].cases.push(response.generated_modules[0].cases.pop());
    return response;
  }, /被移动到其他模块/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[0].cases[0].injected = true;
    return response;
  }, /非法字段/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[0].cases[0].id = 12;
    return response;
  }, /身份或元数据被修改/, {
    modules: [{ module: '登录', cases: [caseItem('登录', '登录', { id: 11 })] }],
    simplify: true,
  });
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[0].cases[0].expected += '错误改写';
    return response;
  }, /仅去重模式擅自改写/);
  for (var removedValue of [null, {}, 'invalid', [null], [[]]]) {
    await rejected(function(request) {
      var response = retainedResponse(request);
      response.removed_cases = removedValue;
      return response;
    }, /removed_cases 必须是数组|删除记录无效/);
  }
  await rejected(function(request) {
    var response = retainedResponse(request);
    response.removed_cases = [relation(request.original_cases_readonly[0], request.generated_cases_editable[0].cases[0])];
    return response;
  }, /删除未知用例/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    var removed = response.generated_modules[0].cases.pop();
    response.removed_cases = [relation(removed, response.generated_modules[0].cases[0], 'duplicate_with_original')];
    return response;
  }, /目标范围无效/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    var first = response.generated_modules[0].cases.shift();
    var second = response.generated_modules[0].cases.shift();
    var third = response.generated_modules[1].cases[0];
    response.removed_cases = [relation(first, second), relation(second, third)];
    return response;
  }, /保留目标也被删除/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    var removed = response.generated_modules[0].cases.pop();
    response.removed_cases = [relation(removed, response.generated_modules[0].cases[0])];
    response.generated_modules[0].cases[0].expected += '仍然非法改写';
    return response;
  }, /仅去重模式擅自改写/);
  await rejected(function(request) {
    var response = retainedResponse(request);
    var removed = response.generated_modules[0].cases.pop();
    response.removed_cases = [relation(removed, request.original_cases_readonly[0], 'merge')];
    return response;
  }, /合并目标必须是生成用例/);
  for (var protectedChange of [{ priority: 'P0' }, { precondition: '模型修改前置条件' }, { remark: '模型修改备注' }]) {
    await rejected(function(request) {
      var response = retainedResponse(request);
      Object.assign(response.generated_modules[0].cases[0], protectedChange);
      return response;
    }, /身份或元数据被修改/, { simplify: true });
  }
  await rejected(retainedResponse, /生成用例无效/, {
    modules: [{ module: '登录', cases: [null] }],
  });
}

async function verifySuccesses() {
  var kept = await run(retainedResponse);
  assert.strictEqual(kept.result.ai_dedupe.removedCount, 0);
  assert.strictEqual(kept.result.ai_dedupe_error, undefined);
  var empty = await run(function(request) {
    var response = retainedResponse(request);
    var removed = response.generated_modules[1].cases.pop();
    response.removed_cases = [relation(removed, response.generated_modules[0].cases[0])];
    return response;
  });
  assert.strictEqual(empty.result.modules[1].cases.length, 0, '合法跨模块去重可以删空模块');
  assert.strictEqual(empty.result.ai_dedupe.removedCount, 1);
  var omitted = await run(function(request) {
    var response = retainedResponse(request);
    var removedModule = response.generated_modules.pop();
    response.removed_cases = [relation(removedModule.cases[0], response.generated_modules[0].cases[0])];
    return response;
  });
  assert.strictEqual(omitted.result.modules.length, 1, '完整说明删除关系后可省略空模块');
  var original = await run(function(request) {
    var response = retainedResponse(request);
    var removed = response.generated_modules[0].cases.pop();
    response.removed_cases = [relation(removed, request.original_cases_readonly[0], 'duplicate_with_original')];
    return response;
  });
  assert.strictEqual(original.result.ai_dedupe.removedCount, 1, '请求和校验必须使用同一原有用例 ID');
  assert.strictEqual(original.sent.original_cases_readonly[0].dedupe_id, '42');
  var snakeId = await run(retainedResponse, { originalCases: [caseItem('已有用例', '登录', { case_id: 'snake-original' })] });
  assert.strictEqual(snakeId.sent.original_cases_readonly[0].dedupe_id, 'snake-original');
  var merged = await run(function(request) {
    var response = retainedResponse(request);
    var removed = response.generated_modules[0].cases.pop();
    var target = response.generated_modules[0].cases[0];
    target.expected += '，并验证合并覆盖';
    response.removed_cases = [relation(removed, target, 'merge')];
    response.generated_modules[0].coverage = 999;
    response.generated_modules[0].injected = true;
    return response;
  });
  assert.match(merged.result.modules[0].cases[0].expected, /合并覆盖/);
  assert.strictEqual(merged.result.modules[0].coverage, 60, '模型不得改写模块元数据');
  assert.strictEqual(merged.result.modules[0].injected, undefined);
  var simplified = await run(function(request) {
    var response = retainedResponse(request);
    response.generated_modules[0].cases[0].title = '精简后的账号登录';
    return response;
  }, { simplify: true });
  assert.strictEqual(simplified.result.modules[0].cases[0].title, '精简后的账号登录');
  var collision = await run(function(request) {
    var response = retainedResponse(request);
    var allIds = request.original_cases_readonly.concat(request.generated_cases_editable[0].cases).map(function(item) { return item.dedupe_id; });
    assert.strictEqual(new Set(allIds).size, allIds.length, '原有和生成用例必须使用不冲突的 ID');
    var removed = response.generated_modules[0].cases.pop();
    response.removed_cases = [relation(removed, request.original_cases_readonly[0], 'duplicate_with_original')];
    return response;
  }, {
    originalCases: [caseItem('原用例', '登录', { id: 'same' }), caseItem('另一原用例', '登录', { id: 'same' })],
    modules: [{ module: '登录', cases: [caseItem('登录', '登录', { id: 'same' }), caseItem('重复登录', '登录', { id: 'same' })] }],
  });
  assert.strictEqual(collision.result.ai_dedupe.removedCount, 1);
  var fenced = await run(function(request) { return '```json\n' + JSON.stringify(retainedResponse(request)) + '\n```'; });
  assert.strictEqual(fenced.result.ai_dedupe.removedCount, 0);
}

async function verifySchemas() {
  for (var field of ['title', 'priority', 'precondition', 'steps', 'expected']) {
    await rejected(function(request) {
      var response = retainedResponse(request);
      delete response.generated_modules[0].cases[0][field];
      return response;
    }, /缺少字段|标题无效|优先级无效/, { simplify: true });
  }
  for (var invalid of [{ title: '' }, { priority: 'P3' }, { precondition: {} }, { steps: [] }, { expected: [null] }]) {
    await rejected(function(request) {
      var response = retainedResponse(request);
      Object.assign(response.generated_modules[0].cases[0], invalid);
      return response;
    }, /字段无效|优先级无效/, { simplify: true });
  }
  var arrays = await run(retainedResponse, {
    modules: [{ module: '登录', cases: [caseItem('登录', '登录', { precondition: [], steps: ['输入账号', '提交'], expected: ['登录成功'] })] }],
  });
  assert.strictEqual(arrays.result.ai_dedupe.removedCount, 0);
}

async function main() {
  await verifyFailures();
  await verifySuccesses();
  await verifySchemas();
  console.log('case_page_ai_dedupe.test.js passed');
}

main().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
