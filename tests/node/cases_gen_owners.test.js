'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');

var owners = {
  generation: require(path.join(projectRoot, 'scripts/core/casesGenGenerationOwner.js')),
  database: require(path.join(projectRoot, 'scripts/core/casesGenDbStoreOwner.js')),
  snapshot: require(path.join(projectRoot, 'scripts/core/casesGenSnapshotOwner.js')),
  result: require(path.join(projectRoot, 'scripts/core/casesGenResultOwner.js')),
};

Object.keys(owners).forEach(function(name) {
  assert.ok(owners[name] && typeof owners[name].create === 'function', name + ' owner must export create');
});

function verifyGenerationOwner() {
  var owner = owners.generation.create({
    runtime: {},
    state: {},
    config: {},
    defaultPrompts: {},
    unwrapRequirementPayload: function(value) { return { payload: value }; },
    extractJsonObjects: function() { return []; },
    stringifyCaseField: function(value) {
      return value === null || value === undefined ? '' : String(value).trim();
    },
  });
  var parsed = owner.parseGeneratedCases('[{"module":"登录","title":"成功"}]');
  assert.strictEqual(parsed.parsed.length, 1);
  assert.strictEqual(parsed.parsed[0].title, '成功');
  assert.deepStrictEqual(owner.chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.strictEqual(owner.resolveCaseGenBatchConcurrency(9), 5);
}

function verifyDatabaseOwner() {
  var owner = owners.database.create({
    runtime: {},
    state: {},
  });
  assert.strictEqual(owner.normalizeCaseGenDbStoreEntryName(' 登录需求_result_20260727_120000.xmind '), '登录需求');
  assert.strictEqual(owner.normalizeCaseGenDbStoreEntryName('登录/回归'), '登录_回归');
  assert.strictEqual(owner.buildCaseGenDbStoreFileName('登录/回归'), '登录_回归.xmind');
}

function verifySnapshotOwner() {
  var state = {
    caseGenModules: [{ id: 'login', title: '登录' }],
    caseGenResults: { login: '[{"title":"成功"}]' },
    caseSelections: { login: new Set([0]) },
    caseGenSuggestions: {},
    caseGenModuleStatus: {},
    caseGenProgress: {},
    caseGenTiming: {},
    caseGenSource: 'legacy',
  };
  var xmindState = {
    nextSnapshotId: 1,
    operationSnapshots: [],
    root: { snapshotId: '', running: false, status: '', error: '' },
    modules: {},
  };
  var renders = 0;
  var owner = owners.snapshot.create({
    runtime: { ALL_CASE_VIEW_ID: '__casegen_all__' },
    state: state,
    persistWorkflowState: function() {},
    ensureCaseModuleStatusState: function() { return state.caseGenModuleStatus; },
    ensureCaseModuleTimingState: function() { return state.caseGenTiming; },
    ensureCaseGenSettings: function() { return { activeTab: 'settings' }; },
    ensureXmindCaseGenState: function() { return xmindState; },
    ensureXmindCaseGenModuleState: function(moduleId) {
      if (!xmindState.modules[moduleId]) xmindState.modules[moduleId] = {};
      return xmindState.modules[moduleId];
    },
    closeCaseViewIfActive: function() {},
    refreshCaseSelectionUI: function() {},
    updateSupplementButtons: function() {},
    getCaseListForModule: function() { return []; },
    renderCaseGeneration: function() { renders += 1; },
  });
  var snapshotId = owner.snapshotAllCaseGenState();
  assert.strictEqual(snapshotId, 'op-snap-1');
  state.caseGenModules = [];
  state.caseGenResults = {};
  assert.strictEqual(owner.rollbackAllCaseGenState(), true);
  assert.strictEqual(state.caseGenModules[0].title, '登录');
  assert.strictEqual(state.caseGenResults.login, '[{"title":"成功"}]');
  assert.strictEqual(state.caseSelections.login.has(0), true);
  assert.strictEqual(renders, 1);
}

function verifyResultOwner() {
  var owner = owners.result.create({
    runtime: {},
    state: {},
    sanitizeCasesForExport: function(list) { return list; },
    wrapDataWithRequirement: function(data) { return { requirement: '登录需求', data: data }; },
    getSafeRequirementSlug: function() { return 'login'; },
    normalizeRequirementName: function(value) { return String(value || '').trim(); },
    formatCompactTimestamp: function() { return '20260727_120000'; },
  });
  var selected = owner.exportSelectedCasesData(
    new Set([1]),
    [{ title: '成功' }, { title: '失败' }],
    '登录',
    '登录需求'
  );
  assert.strictEqual(selected.count, 1);
  assert.strictEqual(selected.payload.data.cases[0].title, '失败');
  assert.strictEqual(selected.fileName, 'selected_login_登录_20260727_120000.json');

  var all = owner.exportAllModulesData(
    [{ id: 'login', title: ' 登录 ' }],
    { login: '[{"title":"成功"}]' },
    '登录需求'
  );
  assert.strictEqual(all.count, 1);
  assert.strictEqual(all.payload[0].module, '登录');
}

function verifyCoreOwnershipAndLoadOrder() {
  var corePath = path.join(projectRoot, 'scripts/core/casesGenCore.js');
  var coreSource = fs.readFileSync(corePath, 'utf8');
  var coreLineCount = coreSource.split(/\r?\n/).length - 1;
  assert.ok(coreLineCount <= 1400, 'casesGenCore must stay at or below 1400 lines');
  assert.doesNotMatch(coreSource, /function generateCasesForModule\(/);
  assert.doesNotMatch(coreSource, /function confirmCaseGenDbNewImport\(/);
  assert.doesNotMatch(coreSource, /function syncLegacyCaseGenState\(/);
  assert.doesNotMatch(coreSource, /function exportSelectedModulesToXmind\(/);
  assert.match(coreSource, /window\.app\.casesGenGenerationOwner/);
  assert.match(coreSource, /window\.app\.casesGenDbStoreOwner/);
  assert.match(coreSource, /window\.app\.casesGenSnapshotOwner/);
  assert.match(coreSource, /window\.app\.casesGenResultOwner/);

  var pages = [
    'index.html',
    'ai-workflow.html',
    'ai-tools.html',
    'admin.html',
    'case-exec.html',
    'case-library.html',
    'settings.html',
  ];
  var scripts = [
    'casesGenGenerationOwner.js',
    'casesGenDbStoreOwner.js',
    'casesGenSnapshotOwner.js',
    'casesGenResultOwner.js',
    'casesGenCore.js',
  ];
  pages.forEach(function(pageName) {
    var html = fs.readFileSync(path.join(projectRoot, pageName), 'utf8');
    var lastIndex = -1;
    scripts.forEach(function(scriptName) {
      var index = html.indexOf(scriptName);
      assert.ok(index > lastIndex, pageName + ' must load ' + scriptName + ' in owner order');
      lastIndex = index;
    });
  });
}

function verifyPublicApiAssembly() {
  global.window = {
    app: {
      casesGenGenerationOwner: owners.generation,
      casesGenDbStoreOwner: owners.database,
      casesGenSnapshotOwner: owners.snapshot,
      casesGenResultOwner: owners.result,
    },
  };
  global.document = { getElementById: function() { return null; } };
  var corePath = path.join(projectRoot, 'scripts/core/casesGenCore.js');
  delete require.cache[require.resolve(corePath)];
  require(corePath);
  var api = window.app.casesGenCore.init({ state: {}, dom: {}, handlers: {}, utils: {}, config: {} });
  assert.strictEqual(Object.keys(api).length, 63);
  assert.strictEqual(typeof api.generateCasesForModule, 'function');
  assert.strictEqual(typeof api.openCaseGenDbStoreNewDrawerWithItems, 'function');
  assert.strictEqual(typeof api.rollbackCaseGenOperationSnapshot, 'function');
  assert.strictEqual(typeof api.exportSelectedModulesToXmind, 'function');
}

verifyGenerationOwner();
verifyDatabaseOwner();
verifySnapshotOwner();
verifyResultOwner();
verifyCoreOwnershipAndLoadOrder();
verifyPublicApiAssembly();

console.log('cases gen owner tests passed');
