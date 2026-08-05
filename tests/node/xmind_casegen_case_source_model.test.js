'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenCaseSourceModel.js'
);

function createCase(moduleTitle, title) {
  return {
    module: moduleTitle,
    title: title,
    preconditions: '前置-' + title,
    steps: ['步骤-' + title],
    expected: '预期-' + title,
  };
}

function createHarness(factory) {
  var xmindState = {
    root: { hideAiLayer: false },
    modules: {
      'module-login': { hideResults: false },
      'module-payment': { hideResults: true },
    },
    hasModuleSkeleton: false,
  };
  var state = {
    caseGenModules: [
      { id: 'module-login', title: '登录', scenarios: ['登录场景'], points: ['登录校验'], coupled: [] },
      { id: 'module-payment', title: '支付', scenarios: [], points: [], coupled: [] },
    ],
    caseGenResults: {
      'module-login': JSON.stringify([createCase('登录', 'AI 登录成功')]),
      'module-payment': JSON.stringify([createCase('支付', 'AI 支付成功')]),
    },
  };
  var baseline = [createCase('登录', '基线登录失败')];
  var nextId = 0;
  var model = factory.create({
    getState: function() { return state; },
    stripCodeFence: function(value) { return String(value || '').replace(/^```json\s*|```$/g, '').trim(); },
    parseCaseList: function(raw) {
      try {
        var parsed = JSON.parse(String(raw || ''));
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    },
    deriveCaseListFromText: function(raw) {
      return String(raw || '').indexOf('legacy-case') !== -1
        ? [createCase('兼容', '旧文本用例')]
        : [];
    },
    buildDeletedBaselineModuleMapFromList: function(list) {
      var map = {};
      (list || []).forEach(function(key) { map[String(key)] = true; });
      return map;
    },
    buildDeletedBaselineCaseMapFromList: function(list) {
      var map = {};
      (list || []).forEach(function(key) { map[String(key)] = true; });
      return map;
    },
    normalizeModuleTitle: function(value) { return String(value || '').trim(); },
    normalizeModuleKey: function(value) { return String(value || '').trim().toLowerCase(); },
    buildBaselineCaseDeleteKey: function(moduleTitle, signature) { return moduleTitle + '::' + signature; },
    buildCaseSignature: function(item, moduleTitle) { return moduleTitle + '::' + item.title; },
    getVisibleBaselineCaseList: function() { return baseline; },
    getRootUiState: function() { return xmindState.root; },
    getModuleUiState: function(moduleId) { return xmindState.modules[moduleId] || {}; },
    ensureXmindState: function() { return xmindState; },
    normalizeCaseItem: function(item, moduleTitle) {
      return Object.assign({}, item, { module: moduleTitle });
    },
    generateLocalId: function(prefix) { nextId += 1; return prefix + '-' + nextId; },
    normalizeArrayField: function(value) {
      if (Array.isArray(value)) return value.map(String).filter(Boolean);
      return value ? [String(value)] : [];
    },
  });
  return {
    model: model,
    state: state,
    xmindState: xmindState,
    setBaseline: function(value) { baseline = value; },
  };
}

function verifyParsingAndSnapshotBaseline(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  assert.strictEqual(model.safeParseWorkspaceCaseList(JSON.stringify([createCase('登录', 'JSON 用例')])).length, 1);
  assert.strictEqual(model.safeParseWorkspaceCaseList('legacy-case').length, 1);

  var snapshot = {
    shared: {
      importedCases: [{
        list: [
          createCase('登录', '保留用例'),
          createCase('登录', '删除用例'),
          createCase('支付', '删除模块用例'),
        ],
      }],
    },
    xmind: {
      prep: { caseImportMode: 'import' },
      deletedBaselineModuleKeys: ['支付'],
      deletedBaselineCaseKeys: ['登录::登录::删除用例'],
    },
  };
  assert.deepStrictEqual(model.getSnapshotBaselineCaseList(snapshot).map(function(item) { return item.title; }), [
    '保留用例',
  ]);
}

function verifyLiveAndSnapshotContexts(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  var context = model.buildVisibleModuleContext();
  assert.deepStrictEqual(context.order, ['登录', '支付']);
  assert.strictEqual(context.map['登录'].baselineCases.length, 1);
  assert.strictEqual(context.map['登录'].aiCases.length, 1);
  assert.strictEqual(context.map['支付'].aiCases.length, 0);
  assert.deepStrictEqual(model.summarizeVisibleModuleContext(context), { moduleCount: 2, caseCount: 2 });
  assert.deepStrictEqual(model.getVisibleCasesForModuleEntry(context.map['登录']).map(function(row) {
    return row.source;
  }), ['baseline', 'ai']);

  harness.xmindState.root.hideAiLayer = true;
  var baselineOnly = model.buildVisibleModuleContext();
  assert.deepStrictEqual(baselineOnly.order, ['登录']);
  assert.strictEqual(baselineOnly.map['登录'].aiModule, null);

  var snapshot = {
    shared: {
      importedCases: [{ list: [createCase('登录', '快照基线')] }],
      caseGenModules: [{ id: 'snapshot-module', title: '消息' }],
      caseGenResults: { 'snapshot-module': JSON.stringify([createCase('消息', '快照 AI')]) },
    },
    xmind: {
      prep: { caseImportMode: 'import' },
      root: { hideAiLayer: false },
      modules: { 'snapshot-module': { hideResults: false } },
    },
  };
  var snapshotContext = model.buildWorkspaceVisibleModuleContextFromSnapshot(snapshot);
  assert.deepStrictEqual(snapshotContext.order, ['登录', '消息']);
  assert.strictEqual(snapshotContext.map['消息'].aiCases.length, 1);
}

function verifyModuleRecordsAndSnapshots(factory) {
  var harness = createHarness(factory);
  var model = harness.model;
  assert.strictEqual(model.findAiModuleById('module-login').title, '登录');
  assert.strictEqual(model.findAiModuleByTitle('登录').id, 'module-login');
  var existing = model.ensureAiModuleRecord('登录', {
    key_scenarios: ['更新场景'],
    test_points: ['更新校验'],
  });
  assert.strictEqual(existing.id, 'module-login');
  assert.deepStrictEqual(existing.scenarios, ['更新场景']);
  var created = model.ensureAiModuleRecord('消息', {
    coupled_modules: ['登录'],
  });
  assert.strictEqual(created.id, 'xmind-mod-1');
  assert.strictEqual(harness.xmindState.hasModuleSkeleton, true);

  var visible = model.buildVisibleModuleSnapshot(model.buildVisibleModuleContext());
  assert.strictEqual(visible[0].module, '登录');
  assert.strictEqual(visible[0].cases.length, 2);
  var ai = model.buildAiLayerSnapshot();
  assert.strictEqual(ai.length, 3);
  assert.strictEqual(ai[0].cases.length, 1);
}

function verifyContextNormalization(factory) {
  var model = createHarness(factory).model;
  var normalized = model.ensureVisibleModuleContext({
    list: [
      { title: '登录', moduleKey: '登录' },
      { title: '登录重复', moduleKey: '登录' },
      { title: '支付' },
    ],
  });
  assert.deepStrictEqual(normalized.order, ['登录', '支付']);
  assert.strictEqual(normalized.list.length, 2);
  assert.strictEqual(model.hasAiCasesForModule('module-login'), true);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  [
    'safeParseWorkspaceCaseList',
    'getSnapshotBaselineCaseList',
    'buildWorkspaceVisibleModuleContextFromSnapshot',
    'summarizeVisibleModuleContext',
    'parseCaseList',
    'getAiCasesForModule',
    'groupCasesByModule',
    'buildVisibleModuleContextFromSources',
    'buildVisibleModuleContext',
    'ensureVisibleModuleContext',
    'getVisibleCasesForModuleEntry',
    'hasAiCasesForModule',
    'findAiModuleByTitle',
    'findAiModuleById',
    'createAiModuleRecord',
    'ensureAiModuleRecord',
    'buildVisibleModuleSnapshot',
    'buildAiLayerSnapshot',
  ].forEach(function(name) {
    assert.match(ownerSource, new RegExp('function\\s+' + name + '\\s*\\('));
    assert.doesNotMatch(parentSource, new RegExp('function\\s+' + name + '\\s*\\('));
  });
  assert.match(parentSource, /xmindCasegenCaseSourceModel/);
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('xmindCasegenCaseSourceModel.js');
    var parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load case source first');
  });
}

function run() {
  var factory = require(ownerPath);
  verifyParsingAndSnapshotBaseline(factory);
  verifyLiveAndSnapshotContexts(factory);
  verifyModuleRecordsAndSnapshots(factory);
  verifyContextNormalization(factory);
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen case source model tests passed');
}

run();
