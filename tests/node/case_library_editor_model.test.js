const assert = require('assert');
const model = require('../../scripts/modules/caseLibrary/caseLibraryEditorModel.js');

function items() {
  return [
    { id: 501, module: '登录', title: '正常登录', priority: 'P0', precondition: '已注册', steps: '输入账号', expected: '进入首页' },
    { __localId: 'local-1', module: '支付', title: '余额不足', priority: 'P1', precondition: '', steps: '提交订单', expected: '提示余额不足' },
    { id: 503, module: '登录', title: '密码错误', priority: 'P1', precondition: '', steps: '输入错误密码', expected: '提示错误' },
  ];
}

function testNormalizeAndStableKeys() {
  var rows = model.normalizeRecords(items(), {
    caseFileId: 88,
    selectedIndexes: [1],
    locatedIndex: 2,
    isNewAdded: function(item) { return Boolean(item && item.__localId); },
  });
  assert.deepStrictEqual(rows.map(function(row) { return row.rowKey; }), [
    'case-library-editor:88:item:501',
    'case-library-editor:88:local:local-1',
    'case-library-editor:88:item:503',
  ]);
  assert.strictEqual(rows[0].number, 1);
  assert.strictEqual(rows[1].selected, true);
  assert.strictEqual(rows[1].isNewAdded, true);
  assert.strictEqual(rows[2].isLocated, true);
  assert.throws(function() {
    model.normalizeRecords([{ title: 'missing key' }], { caseFileId: 88 });
  }, /stable row key/i);
}

function testFilterPaginationAndSelection() {
  var rows = model.normalizeRecords(items(), { caseFileId: 88 });
  assert.deepStrictEqual(
    model.filterRecords(rows, '登录').map(function(row) { return row.sourceIndex; }),
    [0, 2]
  );
  assert.deepStrictEqual(
    model.filterRecords(rows, '余额不足').map(function(row) { return row.sourceIndex; }),
    [1]
  );
  var page = model.paginate(rows, 1, 2);
  assert.strictEqual(page.pageIndex, 1);
  assert.strictEqual(page.totalPages, 2);
  assert.deepStrictEqual(page.records.map(function(row) { return row.sourceIndex; }), [2]);
  assert.deepStrictEqual(model.applyPageSelection([0], rows.slice(1), true), [0, 1, 2]);
  assert.deepStrictEqual(model.applyPageSelection([0, 1, 2], rows.slice(1), false), [0]);
  assert.deepStrictEqual(model.pruneSelection(rows.slice(0, 2), [0, 2, 1]), [0, 1]);
}

testNormalizeAndStableKeys();
testFilterPaginationAndSelection();
console.log('case library editor model tests passed');
