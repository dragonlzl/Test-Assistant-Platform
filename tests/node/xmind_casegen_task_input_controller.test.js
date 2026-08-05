'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenTaskInputController.js'
));

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return fallback;
  }
}

function createHarness(overrides) {
  var state = { settings: { xmindRequestPayloadLimit: 2000 } };
  var ports = {
    state: state,
    config: {
      defaultXmindRequestPayloadLimit: 2000,
      minXmindRequestPayloadLimit: 1,
      maxXmindRequestPayloadLimit: 10000,
    },
    xmindGenApi: {
      getAssignedModel: function() {
        return { id: 'model-1', baseUrl: 'https://model.test', model: 'casegen' };
      },
      getReasoningForType: function() { return 'medium'; },
      getTemperatureForType: function() { return 0.3; },
    },
    cloneJson: cloneJson,
    normalizeArrayField: function(value) { return Array.isArray(value) ? value : []; },
    normalizeHistoryDiagnostics: function(value) { return Array.isArray(value) ? value.slice() : []; },
    extractJsonPayloadDetailed: function(text) {
      try {
        return { payload: JSON.parse(String(text || '')) };
      } catch (err) {
        return { payload: null };
      }
    },
    buildXmindGenerationOptionsSnapshot: function() {
      return { needFunctionCondition: false, needNumericValidation: false };
    },
    isRootFullGenerationContract: function(contract) {
      return Boolean(contract && contract.scope === 'root');
    },
    buildXmindPrompt: function() { return 'generation-prompt'; },
    buildRequirementPayload: function() {
      return Promise.resolve({ mode: 'document', text: '需求正文', images: [] });
    },
    modelSupportsVision: function() { return false; },
    getActiveWorkspaceId: function() { return 'workspace-1'; },
    buildImageContentBlocks: function() {
      return Promise.resolve({ stats: { sent: 0 }, blocks: [] });
    },
    runKnowledgeBasePipelineForGeneration: function() {
      return Promise.resolve({ injectedContextText: '知识库上下文' });
    },
    getSelectedRequirementSource: function() {
      return { text: '登录需求', supplement: '补充条件' };
    },
    getPrepState: function() { return { requirementSupplement: '' }; },
    getRequirementLabelText: function() { return '登录'; },
    getXmindCaseDedupeCoreApi: function() {
      return {
        buildDedupeRequest: function(options) {
          return {
            prompt: 'dedupe-prompt',
            requestText: JSON.stringify(options.modules || []),
            modules: options.modules || [],
            dedupeMode: options.dedupeMode,
            beforeCaseCount: 2,
          };
        },
      };
    },
    getXmindDedupeBatchCoreApi: function() { return null; },
    normalizeDedupeMode: function(value) { return value || 'dedupe_only'; },
    getDedupeModeFromSettings: function() { return 'dedupe_only'; },
    getXmindRequirementCoverageCoreApi: function() {
      return {
        buildCoverageRequest: function(options) {
          return {
            prompt: 'coverage-prompt',
            requestText: options.requirementText,
            requirementText: options.requirementText,
            segments: [{ id: 'segment-1' }],
            cases: [{ id: 'case-1' }],
            signature: 'coverage-signature',
            segmentCount: 1,
            caseCount: 1,
          };
        },
      };
    },
    buildVisibleModuleContext: function() { return { list: [{ title: '登录' }] }; },
    buildVisibleModuleSnapshot: function() { return [{ module: '登录', cases: [{ title: '成功登录' }] }]; },
    getTaskWorkspaceId: function() { return 'workspace-1'; },
  };
  return {
    controller: controllerFactory.create(Object.assign(ports, overrides || {})),
    state: state,
  };
}

function verifyCoverageGapDerivation() {
  var harness = createHarness();
  var task = {
    requestText: ''
      + '【本轮生成选项(JSON)】\n'
      + JSON.stringify({ needFunctionCondition: true, needNumericValidation: true })
      + '\n\n【需求正文】\n角色达到 10 级后解锁，每天最多使用 3 次',
  };
  var gap = harness.controller.evaluateRootCoverageGaps(
    task,
    [{ module: '角色技能', cases: [{ title: '技能展示', expected: '页面正常展示' }] }],
    { scope: 'root' }
  );
  assert.strictEqual(gap.shouldRetry, true);
  assert.deepStrictEqual(gap.reasonLabels, ['功能使用条件', '数值验证']);

  var retry = harness.controller.buildRootCoverageRetryTaskPayload(Object.assign({
    id: 'task-1',
    requestText: task.requestText,
    contract: { scope: 'root' },
    coverageRetryCount: 0,
  }, task), gap);
  assert.strictEqual(retry.coverageRetryCount, 1);
  assert.ok(retry.requestText.indexOf('首轮生成补强指令') >= 0);
}

async function verifyTaskInputsAndLimits() {
  var harness = createHarness();
  var generation = await harness.controller.buildXmindGenerationTaskInput(
    { scope: 'root' },
    { list: [] },
    null,
    {}
  );
  assert.strictEqual(generation.prompt, 'generation-prompt');
  assert.strictEqual(generation.requestText, '需求正文\n\n知识库上下文');
  assert.strictEqual(generation.model.id, 'model-1');

  var dedupe = harness.controller.buildXmindDedupeExecutionInput([
    { module: '登录', cases: [{ title: 'A' }, { title: 'A' }] },
  ]);
  assert.strictEqual(dedupe.beforeCaseCount, 2);
  assert.strictEqual(dedupe.dedupeMode, 'dedupe_only');

  var coverageRequest = harness.controller.buildCoverageSourceRequest();
  var coverage = harness.controller.buildXmindCoverageTaskInput(coverageRequest);
  assert.strictEqual(coverage.segmentCount, 1);
  assert.strictEqual(coverage.caseCount, 1);
  assert.strictEqual(coverage.coverageSignature, 'coverage-signature');

  harness.state.settings.xmindRequestPayloadLimit = 5;
  assert.throws(function() {
    harness.controller.buildXmindCoverageTaskInput(Object.assign({}, coverageRequest, {
      requestText: '123456',
    }));
  }, /请求体超出当前上限/);
}

function verifyOwnershipAndLoadingOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'extractNamedSectionText',
    'evaluateRootCoverageGaps',
    'buildRootCoverageRetryTaskPayload',
    'estimateTaskContentBlocksSize',
    'buildXmindGenerationTaskInput',
    'buildXmindDedupeExecutionInput',
    'buildCoverageSourceRequest',
    'buildXmindCoverageTaskInput',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by task input controller');
  });
  assert.ok(/taskInputControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenTaskInputController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load task input controller before xmindCasegen');
  });
}

verifyCoverageGapDerivation();
verifyTaskInputsAndLimits().then(function() {
  verifyOwnershipAndLoadingOrder();
  console.log('xmind casegen task input controller tests passed');
}).catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
