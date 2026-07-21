const assert = require('assert');
const model = require('../../scripts/modules/tempExecImportDuplicate/tempExecImportDuplicateModel.js');
const adapterFactory = require('../../scripts/modules/tempExecImportDuplicate/tempExecImportDuplicateTableAdapter.js');
const controllerFactory = require('../../scripts/modules/tempExecImportDuplicate/tempExecImportDuplicateController.js');
const tableContract = require('../../scripts/ui/tableContract.js');

const entries = [
  {
    line: 2,
    keep: true,
    payload: {
      module: '战斗',
      title: '普通攻击',
      priority: 'P1',
      precondition: '进入战斗',
      steps: '点击攻击',
      expected: '造成伤害',
      remark: 'payload remark',
    },
    source: {
      actual: '伤害 10',
      remark: 'source remark',
      defectLinks: [{ url: 'BUG-1' }, 'BUG-2'],
    },
  },
  {
    line: 3,
    keep: false,
    payload: {
      module: '战斗',
      title: '普通攻击',
      priority: 'P1',
      precondition: '进入战斗',
      steps: '点击攻击',
      expected: '造成伤害',
    },
    source: {},
  },
];

const records = model.normalizeRecords(entries);
assert.strictEqual(records.length, 2);
assert.strictEqual(records[0].rowKey, 'temp-exec-import-duplicate:2:keep');
assert.strictEqual(records[0].remark, 'source remark');
assert.strictEqual(records[0].defects, 'BUG-1\nBUG-2');
assert.strictEqual(records[0].actionText, '保留');
assert.strictEqual(records[1].actionText, '移除');

assert.throws(
  () => model.normalizeRecords([entries[0], Object.assign({}, entries[0])]),
  /duplicate/i
);

const adapter = adapterFactory.create({ records });
const tableModel = tableContract.buildTableModel(adapter);
assert.deepStrictEqual(
  tableModel.columns.map((column) => column.title),
  ['行号', '模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果', '实际结果', '备注', '缺陷链接', '处理']
);
assert.strictEqual(tableModel.records[0].__rowKey, 'temp-exec-import-duplicate:2:keep');
assert.strictEqual(tableModel.records[0].actionText, '保留');

const mounts = [];
const tableHost = {
  mount(hostEl, mountedAdapter) {
    const entry = { hostEl, adapter: mountedAdapter, records: mountedAdapter.records };
    mounts.push(entry);
    return {
      setRecords(nextRecords) { entry.records = nextRecords; },
      destroy() {},
    };
  },
};
const controller = controllerFactory.create({ hostEl: {}, tableHost });
assert.strictEqual(mounts.length, 0);
assert.strictEqual(controller.setData(entries), 2);
assert.strictEqual(mounts.length, 1);
assert.strictEqual(mounts[0].records.length, 2);
assert.strictEqual(controller.reset(), 0);
assert.strictEqual(mounts[0].records.length, 0);
controller.destroy();

console.log('temp exec import duplicate model tests passed');
