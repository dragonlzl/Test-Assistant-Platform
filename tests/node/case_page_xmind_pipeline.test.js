'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var pipelineOwner = require(path.join(projectRoot, 'scripts/modules/casePageXmindPipeline.js'));

function testOwnershipAndLoadOrder() {
  var prepSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/casePageAiGenPrep.js'), 'utf8');
  var prepCoreSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/casePageAiGenPrepCore.js'), 'utf8');
  var managerSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/app/caseLibraryAiGenManager.js'),
    'utf8'
  );
  assert.strictEqual(prepSource.indexOf('function buildExternalXmindContract('), -1);
  assert.strictEqual(prepSource.indexOf('function buildExternalXmindPrompt('), -1);
  assert.strictEqual(prepSource.indexOf('function buildExternalXmindStagePayload('), -1);
  assert.strictEqual(prepSource.indexOf('xmindPipeline.buildContract('), -1);
  assert.ok(prepCoreSource.indexOf("pipeline.buildContract('append_all_modules_cases'") !== -1);
  assert.strictEqual(managerSource.indexOf('function normalizePipelineText('), -1);
  assert.strictEqual(managerSource.indexOf('function runXmindExternalPipeline('), -1);
  assert.ok(managerSource.indexOf('xmindPipeline.run({') !== -1);

  [
    'index.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'admin.html',
    'settings.html',
  ].forEach(function(fileName) {
    var source = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var pipelineIndex = source.indexOf('./scripts/modules/casePageXmindPipeline.js');
    var prepCoreIndex = source.indexOf('./scripts/modules/casePageAiGenPrepCore.js');
    var prepIndex = source.indexOf('./scripts/modules/casePageAiGenPrep.js');
    var managerIndex = source.indexOf('./scripts/modules/app/caseLibraryAiGenManager.js');
    assert.ok(pipelineIndex >= 0, fileName + ' should load the XMind pipeline owner');
    assert.ok(prepCoreIndex > pipelineIndex, fileName + ' should load preparation core after the XMind pipeline owner');
    assert.ok(prepIndex > prepCoreIndex, fileName + ' should load preparation UI after its core');
    assert.ok(managerIndex > pipelineIndex, fileName + ' should load the task manager after the XMind pipeline owner');
  });
}

function testPureContracts() {
  var appendContract = pipelineOwner.buildContract('module_append_cases', ' 登录 ');
  assert.deepStrictEqual(appendContract, {
    scope: 'module',
    mode: 'module_append_cases',
    targetModule: '登录',
    allowNewModules: false,
    generateCasesForNewModules: false,
    generateCasesForExistingModules: true,
    dedupeAgainstVisibleModules: false,
    dedupeAgainstVisibleCases: true,
  });
  assert.strictEqual(pipelineOwner.buildContract('append_all_modules_cases', '').scope, 'root');

  var source = { requirement_text: '登录需求' };
  var stagePayload = pipelineOwner.buildStagePayload(
    source,
    appendContract,
    [{ module: '登录' }],
    'module',
    { module: '登录' },
    [{ module: '支付' }],
    'append_all_modules_cases'
  );
  assert.deepStrictEqual(source, { requirement_text: '登录需求' });
  assert.strictEqual(stagePayload.operation_contract.mode, 'module_append_cases');
  assert.strictEqual(stagePayload.xmind_external_pipeline.stage, 'module');
  assert.strictEqual(stagePayload.current_operation_module.module, '登录');
  assert.match(pipelineOwner.buildPrompt('基础提示', appendContract), /operation_contract\(JSON\)/);

  var modules = pipelineOwner.normalizeModulesFromContent('```json\n' + JSON.stringify({
    modules: [{
      module_name: ' 登录 ',
      coverage: '88',
      cases: [{ title: ' 正常登录 ', priority: 'p0', expected: ['进入首页', '记录日志'] }],
    }],
  }) + '\n```');
  assert.strictEqual(modules.length, 1);
  assert.strictEqual(modules[0].module, '登录');
  assert.strictEqual(modules[0].moduleKey, '登录');
  assert.strictEqual(modules[0].coverage, 88);
  assert.strictEqual(modules[0].cases[0].priority, 'P0');
  assert.strictEqual(modules[0].cases[0].expected, '进入首页\n记录日志');
  assert.strictEqual(pipelineOwner.normalizeModulesFromContent('not-json').length, 0);
  assert.strictEqual(pipelineOwner.isLegacyOutput(JSON.stringify({
    missing_modules: [],
    existing_modules: [],
  })), true);
}

async function testPipelineExecution() {
  var currentTask = {
    id: 'pipeline-task-1',
    scene: 'case-library',
    status: 'running',
    pipelineModuleDone: 0,
  };
  var updates = [];
  var modelCalls = [];
  var runner = pipelineOwner.create({
    callModel: function(model, userText, prompt) {
      modelCalls.push({ model: model, userText: userText, prompt: prompt });
      if (modelCalls.length === 1) {
        return Promise.resolve(JSON.stringify({
          modules: [
            { module: '登录', coverage: 70, cases: [] },
            { module: '支付', coverage: 0, missing: true, cases: [] },
          ],
        }));
      }
      var payload = JSON.parse(userText);
      var moduleName = payload.current_operation_module.module;
      return Promise.resolve(JSON.stringify({
        modules: [{
          module: moduleName,
          coverage: moduleName === '登录' ? 95 : 90,
          cases: [{ title: moduleName + '新增用例', priority: 'P1', expected: '生成成功' }],
        }],
      }));
    },
    getTask: function() { return currentTask; },
    updateTask: function(scene, patch, action) {
      assert.strictEqual(scene, 'case-library');
      currentTask = Object.assign({}, currentTask, patch);
      updates.push({ patch: patch, action: action });
      return currentTask;
    },
  });
  var content = await runner.run({
    scene: 'case-library',
    model: { id: 'model-1' },
    userText: 'fallback payload',
    task: Object.assign({}, currentTask, {
      prompt: 'task prompt',
      reasoning: 'low',
      temperature: 0.2,
      xmindPipeline: {
        enabled: true,
        mode: 'append_all_modules_cases',
        moduleConcurrency: 2,
        promptBase: 'pipeline prompt',
        root: { prompt: 'root prompt', userText: 'root payload' },
        basePayload: { requirement_text: '登录和支付' },
        visibleModules: [{
          module: '登录',
          cases: [{ title: '已有登录用例' }],
        }],
      },
    }),
  });
  var result = JSON.parse(content);
  assert.strictEqual(modelCalls.length, 3);
  assert.deepStrictEqual(result.existing_modules.map(function(item) { return item.module; }), ['登录']);
  assert.deepStrictEqual(result.missing_modules.map(function(item) { return item.module; }), ['支付']);
  assert.strictEqual(result.existing_modules[0].cases[0].title, '登录新增用例');
  assert.deepStrictEqual(updates.map(function(item) { return item.action; }), [
    'pipeline-discovery',
    'pipeline-modules',
    'pipeline-module-done',
    'pipeline-module-done',
  ]);
  assert.strictEqual(currentTask.pipelineModuleDone, 2);
}

async function main() {
  assert.strictEqual(typeof pipelineOwner.create, 'function');
  testOwnershipAndLoadOrder();
  testPureContracts();
  await testPipelineExecution();
  console.log('case page XMind pipeline tests passed');
}

main().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
