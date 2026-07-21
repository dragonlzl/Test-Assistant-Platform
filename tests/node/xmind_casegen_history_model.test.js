'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var modelFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenHistoryModel.js'
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

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var model = modelFactory.create({
  escapeHtml: escapeHtml,
  normalizeModuleTitle: function(value) { return String(value || '').replace(/\s+/g, ' ').trim(); },
  normalizeModuleKey: function(value) { return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase(); },
  rootActions: rootActions,
  moduleActions: moduleActions,
  getRootFullCasesLabel: function(hadAiContent) {
    return hadAiContent ? '重新生成全部' : '生成全部';
  },
  getModuleFullCasesLabel: function(entry) {
    return entry && entry.hasCases ? '重新生成模块' : '生成模块';
  },
  getRequirementLabelText: function() { return '登录需求'; },
});

function verifyLabelsAndDurations() {
  assert.strictEqual(model.getRootHistoryActionLabel(rootActions.FULL_CASES, false), '生成全部');
  assert.strictEqual(model.getRootHistoryActionLabel(rootActions.FULL_CASES, true), '重新生成全部');
  assert.strictEqual(model.getRootHistoryActionLabel(rootActions.TOPUP_MODULES_CASES), '补全模块+用例');
  assert.strictEqual(model.getModuleHistoryActionLabel(moduleActions.FULL_CASES, { hasCases: true }), '重新生成模块');
  assert.strictEqual(model.getModuleHistoryActionLabel(moduleActions.APPEND), '追加生成');
  assert.strictEqual(
    model.getGenerationFailureLabel('module', moduleActions.FULL_CASES, { hadAiCasesBeforeAction: true }),
    '重新生成失败'
  );
  assert.strictEqual(model.buildHistoryLocationLabel('root'), '根节点 · 登录需求');
  assert.strictEqual(model.buildHistoryLocationLabel('module', '  登录   模块 '), '模块节点 · 登录 模块');
  assert.strictEqual(model.normalizeHistoryDurationMs(1555.4), 1555);
  assert.strictEqual(model.formatHistoryDuration(1555), '1.6 秒');
  assert.strictEqual(model.formatHistoryDuration(61000), '1 分 1 秒');
  assert.strictEqual(model.getTaskModelRequestDurationMs({
    modelRequestTotalDurationMs: 2300,
    modelRequestDurationMs: 1200,
    durationMs: 5000,
  }), 2300);
  assert.match(model.formatHistoryTimestamp(1700000000000), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.strictEqual(model.formatHistoryTimestamp(0), '-');
}

function verifyNormalization() {
  assert.deepStrictEqual(model.normalizeHistoryDetails([
    { module: ' 登录 ', caseCount: 2, durationMs: 1200 },
    { moduleTitle: '登录', caseCount: 3, durationMs: 1800 },
    { module: '支付', caseCount: -1, durationMs: 900 },
  ]), [
    { module: '登录', caseCount: 5, durationMs: 1800 },
    { module: '支付', caseCount: 0, durationMs: 900 },
  ]);
  assert.deepStrictEqual(
    model.normalizeHistoryDiagnostics(['失败一', '', '失败一', '失败二']),
    ['失败一', '失败二']
  );
  assert.strictEqual(model.normalizeHistoryPreviewText('x'.repeat(150)).length, 141);

  var records = model.normalizeHistoryDedupeRecords([
    {
      module: '登录',
      title: '重复校验',
      type: 'duplicate',
      duplicateOf: '登录成功',
      duplicatePoint: '原因：校验目标相同，描述不同',
      reason: '原因：覆盖重复，删除冗余项',
    },
    {
      module: '登录',
      title: '重复校验',
      type: 'duplicate',
      duplicateOf: '登录成功',
      duplicatePoint: '原因：校验目标相同，描述不同',
      reason: '原因：覆盖重复，删除冗余项',
    },
    {
      module: '支付',
      mergedFrom: ['支付成功', '支付完成'],
      mergedInto: '支付结果校验',
      reason: '场景可以合并',
    },
  ]);
  assert.strictEqual(records.length, 2);
  assert.deepStrictEqual(records[0], {
    module: '登录',
    title: '重复校验',
    reason: '覆盖重复',
    actionType: 'duplicate',
    duplicateOf: '登录成功',
    duplicatePoint: '校验目标相同',
    mergedInto: '',
    mergedFrom: [],
  });
  assert.strictEqual(records[1].actionType, 'merge');
  assert.deepStrictEqual(records[1].mergedFrom, ['支付成功', '支付完成']);
}

function verifyMarkup() {
  var html = model.buildHistoryListHtml([{
    locationLabel: '根节点 · <登录>',
    actionLabel: '生成全量模块',
    moduleCount: 1,
    createdAt: 1700000000000,
    details: [{ module: '<script>', caseCount: 2, durationMs: 1200 }],
    diagnostics: ['错误信息：<模型失败>', '已保留结果'],
    dedupeRecords: [{
      module: '登录',
      title: '<重复用例>',
      type: 'duplicate',
      duplicateOf: '登录成功',
      duplicatePoint: '校验目标相同',
    }],
    previewText: '<raw>',
  }]);
  assert.match(html, /xmind-casegen-history-card/);
  assert.match(html, /已去重 1 条用例/);
  assert.match(html, /is-duplicate/);
  assert.match(html, /错误信息：/);
  assert.ok(html.indexOf('&lt;登录&gt;') !== -1);
  assert.ok(html.indexOf('&lt;script&gt;') !== -1);
  assert.ok(html.indexOf('<script>') === -1);
  assert.match(model.buildHistoryListHtml([]), /暂无生成记录/);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  assert.match(parentSource, /window\.app\.xmindCasegenHistoryModel/);
  assert.match(parentSource, /historyModelFactory\.create\(\{/);
  assert.ok(!/function normalizeHistoryDedupeRecords\(/.test(parentSource));
  assert.ok(!/function buildHistoryDiagnosticSectionsHtml\(/.test(parentSource));
  ['index.html', 'ai-workflow.html'].forEach(function(page) {
    var source = fs.readFileSync(path.join(projectRoot, page), 'utf8');
    var modelIndex = source.indexOf('./scripts/modules/xmindCasegen/xmindCasegenHistoryModel.js');
    var parentIndex = source.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(modelIndex >= 0 && modelIndex < parentIndex, page + ' must load history model first');
  });
}

verifyLabelsAndDurations();
verifyNormalization();
verifyMarkup();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen history model tests passed');
