'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var model = require(path.join(projectRoot, 'scripts/modules/tempExecImportDiffModel.js'));
var owner = require(path.join(projectRoot, 'scripts/modules/tempExecImportDiffOwner.js'));

function buildItem(overrides) {
  return Object.assign({
    id: 1,
    module: '登录',
    title: '正常登录',
    priority: 'P1',
    precondition: '已注册',
    steps: '输入账号和密码',
    expected: '进入首页',
  }, overrides || {});
}

function verifyModel() {
  assert.strictEqual(model.detectExecCasesHasResult([{ status: '未执行', remark: '', defect_links: [] }], false), false);
  assert.strictEqual(model.detectExecCasesHasResult([{ status: '通过' }], false), true);
  assert.strictEqual(model.detectExecCasesHasResult([{
    reuse_details: [{ status: '未执行', note: '待补充' }],
  }], true), true);

  var comparison = model.buildComparison({
    importItems: [
      buildItem({ priority: 'P0' }),
      buildItem({ id: 2, module: '支付', title: '支付成功', expected: '显示成功页' }),
    ],
    importExecCases: [{
      module: '登录',
      title: '正常登录',
      expected: '进入首页',
      status: '失败',
      remark: '导入结果',
      defect_links: [{ url: 'https://example.test/bug-1' }],
    }],
    databaseItems: [
      buildItem({ priority: 'P1' }),
      buildItem({ id: 3, module: '搜索', title: '搜索成功', expected: '显示结果' }),
    ],
    databaseExecCases: [{
      case_item_id: 1,
      status: '通过',
      remark: '执行结果',
      defect_links: [],
    }],
    includeResult: true,
  });
  assert.deepStrictEqual(comparison.counts, { added: 1, removed: 1, changed: 1, total: 3 });
  var changed = comparison.rows.filter(function(row) { return row.type === 'changed'; })[0];
  assert.strictEqual(changed.diff.priority, true);
  assert.strictEqual(changed.diff.actual, true);
  assert.strictEqual(changed.left.defect, 'https://example.test/bug-1');
}

function verifyOwnerState() {
  var state = {
    loading: false,
    confirming: false,
    importItems: [],
    importExecCases: [],
    diffCounts: { added: 0, removed: 0, changed: 0, total: 0 },
    queue: { active: false, total: 0, index: -1 },
  };
  var instance = owner.create({
    model: model,
    getState: function() { return state; },
    setStatus: function() {},
  });
  instance.openLoading({
    fileName: '登录用例.xlsx',
    cleanName: '登录用例',
    projectId: 1,
    importVersionId: 2,
    dbCaseFileId: 3,
    importItems: [buildItem()],
  });
  assert.strictEqual(state.loading, true);
  assert.strictEqual(state.cleanName, '登录用例');
  assert.strictEqual(state.importItems.length, 1);
  instance.open({
    dbItems: [buildItem()],
    dbExecCases: [],
    dbReuseEnabled: false,
    dbHasResult: false,
    importHasResult: false,
  });
  assert.strictEqual(state.loading, false);
  assert.deepStrictEqual(state.diffCounts, { added: 0, removed: 0, changed: 0, total: 0 });
}

function verifyOwnerConfirmLifecycleOption() {
  var state = {
    loading: false,
    confirming: false,
    projectId: 1,
    importVersionId: 2,
    dbCaseFileId: 3,
    cleanName: '登录用例',
    importItems: [buildItem()],
    importExecCases: [],
    dbHasResult: true,
    importHasResult: true,
  };
  var confirmOptions = [];
  var instance = owner.create({
    model: model,
    getState: function() { return state; },
    getApiClient: function() {
      return {
        importCaseFile: function() { return Promise.reject(new Error('should not import')); },
        upsertExecSetFromCaseFile: function() { return Promise.reject(new Error('should not upsert')); },
      };
    },
    openConfirmDrawer: function(options) {
      confirmOptions.push(options);
      return Promise.resolve(confirmOptions.length === 1 ? { ok: true } : { ok: false });
    },
    setStatus: function() {},
  });
  return instance.confirmOverwrite().then(function() {
    assert.strictEqual(confirmOptions.length, 2);
    assert.strictEqual(confirmOptions[0].resolveAfterClose, true);
    assert.strictEqual(confirmOptions[1].resolveAfterClose, true);
    assert.strictEqual(state.confirming, false);
  });
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');
  var modelSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecImportDiffModel.js'), 'utf8');
  var ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecImportDiffOwner.js'), 'utf8');
  assert.ok(parentSource.indexOf('tempExecImportDiffOwner.create') !== -1);
  assert.strictEqual(parentSource.indexOf('function normalizeDiffText('), -1);
  assert.strictEqual(parentSource.indexOf('function flattenDiffRows('), -1);
  assert.strictEqual(parentSource.indexOf('function openImportDiffDrawer('), -1);
  assert.strictEqual(parentSource.indexOf('function confirmOverwriteImportFromDiff('), -1);
  assert.ok(modelSource.indexOf('function buildComparison(') !== -1);
  assert.ok(ownerSource.indexOf('function confirmOverwrite(') !== -1);
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
    var modelIndex = html.indexOf('./scripts/modules/tempExecImportDiffModel.js');
    var ownerIndex = html.indexOf('./scripts/modules/tempExecImportDiffOwner.js');
    var parentIndex = html.indexOf('./scripts/modules/tempexec.js');
    assert.ok(modelIndex >= 0, fileName + ' must load the temp exec import diff model');
    assert.ok(ownerIndex > modelIndex, fileName + ' must load the import diff owner after its model');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load temp exec after the import diff owner');
  });
}

assert.ok(model && typeof model.buildComparison === 'function');
assert.ok(owner && typeof owner.create === 'function');
verifyModel();
verifyOwnerState();
verifyOwnerConfirmLifecycleOption().then(function() {
  verifyOwnershipAndLoadOrder();
  console.log('temp exec import diff owner tests passed');
}).catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
