const assert = require('assert');
const model = require('../../scripts/modules/execOverview/execOverviewExecSetModel.js');
const adapterFactory = require('../../scripts/modules/execOverview/execOverviewExecSetTableAdapter.js');
const tableContract = require('../../scripts/ui/tableContract.js');

const sourceRows = [
  {
    id: 101,
    module: '登录',
    title: '正常登录',
    actual_result: '',
    status: '通过',
    expected: '进入首页',
    remark: '主流程',
    updated_at: '2026-07-17T08:00:00Z',
  },
  {
    id: 102,
    module: '支付',
    title: '余额不足',
    actual_result: '提示余额不足',
    status: '失败',
    expected: '拦截支付',
    remark: '',
    updated_at: '2026-07-17T09:00:00Z',
  },
];

const records = model.normalizeRecords(sourceRows);
assert.strictEqual(records.length, 2);
assert.strictEqual(records[0].rowKey, 'exec-case:101');
assert.strictEqual(records[0].actualResult, '通过');
assert.strictEqual(records[1].actualResult, '提示余额不足');

assert.deepStrictEqual(
  model.filterRecords(records, '主流程').map((record) => record.id),
  [101]
);
assert.deepStrictEqual(
  model.filterRecords(records, '余额不足').map((record) => record.id),
  [102]
);

const paginationRecords = model.normalizeRecords(Array.from({ length: 6 }).map((_, index) => ({
  id: 200 + index + 1,
  module: '分页',
  title: '用例 ' + String(index + 1),
})));
const page = model.paginate(paginationRecords, 1, 5);
assert.strictEqual(page.pageIndex, 1);
assert.strictEqual(page.totalPages, 2);
assert.strictEqual(page.records[0].id, 206);

assert.throws(
  () => model.normalizeRecords([sourceRows[0], Object.assign({}, sourceRows[0])]),
  /duplicate/i
);
assert.throws(
  () => model.normalizeRecord({ title: '缺少稳定 ID' }),
  /stable id/i
);

const adapter = adapterFactory.create({
  records,
  formatTime: (value) => 'time:' + value,
});
const tableModel = tableContract.buildTableModel(adapter);
assert.deepStrictEqual(
  tableModel.columns.map((column) => column.title),
  ['模块', '用例标题', '实际结果', '更新时间']
);
assert.strictEqual(tableModel.records[0].__rowKey, 'exec-case:101');
assert.strictEqual(tableModel.records[0].actualResult, '通过');
assert.strictEqual(tableModel.records[0].updatedAt, 'time:2026-07-17T08:00:00Z');

console.log('exec overview exec set model tests passed');
