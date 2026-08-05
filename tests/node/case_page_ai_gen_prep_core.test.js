'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var prepCoreOwner = require(path.join(projectRoot, 'scripts/modules/casePageAiGenPrepCore.js'));
var xmindPipeline = require(path.join(projectRoot, 'scripts/modules/casePageXmindPipeline.js'));

function testOwnershipAndLoadOrder() {
  var prepSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/casePageAiGenPrep.js'), 'utf8');
  assert.strictEqual(prepSource.indexOf('function runKnowledgeBase('), -1);
  assert.strictEqual(prepSource.indexOf('function buildGenerationContext('), -1);
  assert.strictEqual(prepSource.indexOf('function buildProtectedAiDedupePrompt('), -1);
  assert.strictEqual(prepSource.indexOf('function decodeXmlEntities('), -1);
  assert.ok(prepSource.indexOf('prepCore.runKnowledgeBase(') !== -1);
  assert.ok(prepSource.indexOf('fileParser.read(file)') !== -1);

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
    var coreIndex = source.indexOf('./scripts/modules/casePageAiGenPrepCore.js');
    var parserIndex = source.indexOf('./scripts/modules/casePageAiGenFileParser.js');
    var prepIndex = source.indexOf('./scripts/modules/casePageAiGenPrep.js');
    assert.ok(coreIndex > pipelineIndex, fileName + ' should load preparation core after pipeline');
    assert.ok(parserIndex > coreIndex, fileName + ' should load file parser after preparation core');
    assert.ok(prepIndex > parserIndex, fileName + ' should load preparation UI after file parser');
    assert.ok(prepIndex > coreIndex, fileName + ' should load preparation UI after its core');
  });
}

function createFixture() {
  var knowledgeCalls = [];
  var modelCalls = [];
  var nowValue = 1000;
  var knowledgeApi = {
    normalizeBaseUrl: function(value) { return String(value || '').replace(/\/$/, ''); },
    buildQueryKey: function(options) {
      return options.baseUrl + '|' + JSON.stringify(options.queryContext || {});
    },
    createDefaultState: function() {
      return {
        baseUrl: '',
        enabled: false,
        ruleSearch: { status: 'disabled', reason: '' },
        aiFilter: { status: 'disabled', reason: '' },
        injectedContextText: '',
        selectedSections: [],
        warnings: [],
      };
    },
    getStageLabel: function(status) { return 'stage:' + status; },
    runPipeline: function(options) {
      knowledgeCalls.push(options);
      var state = {
        baseUrl: options.baseUrl,
        enabled: true,
        ruleSearch: { status: 'done', reason: '' },
        aiFilter: { status: 'done', reason: '' },
        injectedContextText: '知识库上下文',
        selectedSections: [{ heading: '登录规则' }],
        warnings: [],
      };
      options.onStateChange(state);
      return Promise.resolve(state);
    },
  };
  var core = prepCoreOwner.create({
    state: {
      settings: { knowledgeBaseBaseUrl: 'https://kb.example.com/' },
      assignments: { xmindCaseGenPrompt: '自定义提示' },
    },
    config: {
      defaultPrompts: { xmindcasegen: '默认提示' },
      caseWritingStyleGuidePrompt: 'AI_CASE_WRITING_STYLE_GUIDE.md\n风格规则',
    },
    xmindPipeline: xmindPipeline,
    xmindKnowledgeBaseApi: knowledgeApi,
    callModelWithConfig: function(model, userText, prompt) {
      modelCalls.push({ model: model, userText: userText, prompt: prompt });
      return Promise.resolve(JSON.stringify({
        generated_modules: [{
          module: '登录',
          cases: [{ title: '保留用例', expected: '登录成功' }],
        }],
        removed_cases: [{ title: '重复用例', reason: '重复' }],
        summary: { removed: 1 },
      }));
    },
    now: function() {
      nowValue += 1;
      return nowValue;
    },
  });
  return {
    core: core,
    knowledgeCalls: knowledgeCalls,
    modelCalls: modelCalls,
  };
}

function testPurePreparationContracts(fixture) {
  var core = fixture.core;
  var settingsSnapshot = core.snapshotSettings();
  assert.strictEqual(settingsSnapshot.casePageGenerationMode, 'enhanced');
  assert.strictEqual(settingsSnapshot.needFunctionCondition, true);
  assert.strictEqual(settingsSnapshot.needNumericValidation, true);
  assert.strictEqual(settingsSnapshot.dedupeSimplify, false);
  var cases = core.normalizeCaseList([
    { module_name: ' 登录 ', case_title: ' 正常登录 ', priority: 'p0', expected: ['成功', '留痕'] },
    {},
  ]);
  assert.deepStrictEqual(cases, [{
    module: '登录',
    title: '正常登录',
    priority: 'P0',
    precondition: '',
    steps: '',
    expected: '成功\n留痕',
    remark: '',
  }]);
  assert.deepStrictEqual(core.buildModuleList(cases), ['登录']);
  assert.strictEqual(core.groupCasesByModule(cases)[0].cases[0].preconditions, '');
  assert.strictEqual(core.getGenerationModeMeta('enhanced').coveragePolicy, 'ignore_for_generation');
  assert.strictEqual(core.isEnhancedGenerationContext({ settings: { casePageGenerationMode: 'precise' } }), false);
  assert.strictEqual(core.getStageLabel('done'), 'stage:done');

  var settings = {
    casePageGenerationMode: 'enhanced',
    customRequirement: '关注审计日志',
    dedupeSimplify: true,
    needFunctionCondition: true,
    needNumericValidation: false,
    needBoundary: true,
    needMobile: false,
    needSpecial: false,
  };
  var prep = core.buildGenerationContext({
    context: { displayName: '登录用例', caseFileId: 'file-1', cases: cases },
    requirementText: '登录需求',
    requirementSupplement: '补充说明',
    requirementFileName: 'login.md',
    requirementMode: 'file',
    allowRequirementDocument: true,
  }, settings, {
    enabled: true,
    ruleSearch: { status: 'done' },
    aiFilter: { status: 'done' },
    injectedContextText: '知识库上下文',
  });
  assert.strictEqual(prep.payloadExtra.locked_imported_cases.readonly, true);
  assert.strictEqual(prep.payloadExtra.locked_imported_cases.case_count, 1);
  assert.strictEqual(prep.payloadExtra.coverage_threshold_can_skip_module, false);
  assert.match(prep.promptContext, /知识库上下文/);
  assert.match(core.enrichPrompt('基础提示', prep), /风格规则/);
  assert.strictEqual(core.enrichPayload({ stable: true }, prep).stable, true);

  var pipeline = core.buildXmindEnhancedPipelineRequest({
    scene: 'case-library',
    caseFileId: 'file-1',
    displayName: '登录用例',
    existingCases: cases,
    coverageThreshold: 80,
  }, prep);
  assert.strictEqual(pipeline.enabled, true);
  assert.strictEqual(pipeline.visibleModules[0].module, '登录');
  assert.strictEqual(JSON.parse(pipeline.root.userText).coverage_threshold, 80);
}

async function testKnowledgeBaseCache(fixture) {
  var transitions = [];
  var options = {
    scene: 'case-library',
    context: { displayName: '登录用例', caseFileId: 'file-1' },
    requirementText: '登录需求',
    requirementSupplement: '',
    requirementMode: 'manual',
    allowRequirementDocument: true,
    model: { id: 'model-1' },
    onStateChange: function(state) { transitions.push(state); },
  };
  var first = await fixture.core.runKnowledgeBase(options);
  var second = await fixture.core.runKnowledgeBase(options);
  assert.strictEqual(first.injectedContextText, '知识库上下文');
  assert.strictEqual(second.cached, true);
  assert.strictEqual(fixture.knowledgeCalls.length, 1);
  assert.strictEqual(transitions.length, 1);
  assert.match(fixture.knowledgeCalls[0].workspaceId, /^case-page-case-library-file-1$/);
}

async function testProtectedAiDedupe(fixture) {
  var parsed = {
    modules: [{
      module: '登录',
      cases: [
        { title: '保留用例', expected: '登录成功' },
        { title: '重复用例', expected: '登录成功' },
      ],
    }],
  };
  var result = await fixture.core.applyAiDedupeToParsed(
    parsed,
    [{ module: '登录', title: '原始用例', expected: '登录成功' }],
    { requirementText: '登录需求', settings: { dedupeSimplify: true } },
    {
      model: { id: 'model-1' },
      reasoning: 'low',
      temperature: 0.2,
      callModelWithConfig: function(model, userText, prompt) {
        fixture.modelCalls.push({ model: model, userText: userText, prompt: prompt });
        return Promise.resolve(JSON.stringify({
          generated_modules: [{
            module: '登录',
            cases: [{ title: '保留用例', expected: '登录成功' }],
          }],
          removed_cases: [{ title: '重复用例', reason: '重复' }],
          summary: { removed: 1 },
        }));
      },
    }
  );
  assert.strictEqual(fixture.modelCalls.length, 1);
  var request = JSON.parse(fixture.modelCalls[0].userText);
  assert.strictEqual(request.operation_contract.original_cases_readonly, true);
  assert.strictEqual(request.original_cases_readonly[0].title, '原始用例');
  assert.strictEqual(result.modules[0].cases.length, 1);
  assert.strictEqual(result.ai_dedupe.beforeCount, 2);
  assert.strictEqual(result.ai_dedupe.removedCount, 1);
}

async function main() {
  assert.strictEqual(typeof prepCoreOwner.create, 'function');
  testOwnershipAndLoadOrder();
  var fixture = createFixture();
  testPurePreparationContracts(fixture);
  await testKnowledgeBaseCache(fixture);
  await testProtectedAiDedupe(fixture);
  console.log('case page AI generation preparation core tests passed');
}

main().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
