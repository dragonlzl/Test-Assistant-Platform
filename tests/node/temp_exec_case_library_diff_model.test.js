const assert = require('assert');
const model = require('../../scripts/modules/tempExecCaseLibraryDiff/tempExecCaseLibraryDiffModel.js');
const adapterFactory = require('../../scripts/modules/tempExecCaseLibraryDiff/tempExecCaseLibraryDiffTableAdapter.js');
const controllerFactory = require('../../scripts/modules/tempExecCaseLibraryDiff/tempExecCaseLibraryDiffController.js');
const tableContract = require('../../scripts/ui/tableContract.js');

const meta = {
  history: [
    {
      diffAt: '2026-07-18T08:00:00Z',
      operator: 'alice',
      summary: { appended: 0, added: 0, updated: 1, deleted: 1 },
      diff: [
        {
          kind: 'updated',
          case_item_id: 101,
          changed_fields: ['steps'],
          old: { module: '登录', title: '正常登录', steps: '旧步骤', expected: '成功' },
          new: { module: '登录', title: '正常登录', steps: '新步骤', expected: '成功' },
        },
        {
          kind: 'deleted',
          case_item_id: 102,
          changed_fields: [],
          old: { module: '登录', title: '旧用例', steps: '旧步骤', expected: '成功' },
          new: null,
        },
      ],
    },
    {
      diffAt: '2026-07-17T08:00:00Z',
      operator: 'bob',
      summary: { appended: 1, added: 0, updated: 0, deleted: 0 },
      diff: [
        {
          kind: 'appended',
          case_item_id: 103,
          changed_fields: [],
          old: null,
          new: { module: '支付', title: '追加用例', steps: '步骤', expected: '成功' },
        },
      ],
    },
  ],
};

const file = {
  _casesLoading: false,
  cases: [
    { caseItemId: 101 },
    { case_item_source_id: 103 },
  ],
};

const view = model.buildView(meta, { execSetId: 5001, file });
assert.strictEqual(view.allRecords.length, 3);
assert.deepStrictEqual(view.summary, { appended: 1, added: 0, updated: 1, deleted: 1 });
assert.strictEqual(view.allRecords[0].kind, 'updated');
assert.strictEqual(view.allRecords[0].operator, 'alice');
assert.strictEqual(view.allRecords[0].cells.steps, '旧：旧步骤\n新：新步骤');
assert.strictEqual(view.allRecords[0].canLocate, true);
assert.strictEqual(view.allRecords[1].kind, 'deleted');
assert.strictEqual(view.allRecords[1].canLocate, false);
assert.match(view.allRecords[0].rowKey, /^temp-exec-case-library-diff:5001:/);
assert.strictEqual(new Set(view.allRecords.map((record) => record.rowKey)).size, 3);

const appendedView = model.buildView(meta, { execSetId: 5001, file, filter: 'appended' });
assert.deepStrictEqual(appendedView.records.map((record) => record.kind), ['appended']);

const filteredFileView = model.buildView(meta, {
  execSetId: 5001,
  file: { _casesLoading: false, cases: [{ caseItemId: 101 }] },
});
assert.deepStrictEqual(filteredFileView.allRecords.map((record) => record.kind), ['updated', 'deleted']);
assert.deepStrictEqual(filteredFileView.summary, { appended: 0, added: 0, updated: 1, deleted: 1 });

const fallbackView = model.buildView({
  lastDiffAt: '2026-07-18T09:00:00Z',
  summary: { added: 1 },
  diff: [{
    kind: 'added',
    case_item_id: 201,
    changed_fields: [],
    old: null,
    new: { module: '搜索', title: '新增搜索', expected: '展示结果' },
  }],
}, { execSetId: 5002 });
assert.strictEqual(fallbackView.records.length, 1);
assert.strictEqual(fallbackView.records[0].kindLabel, '新增');

const adapter = adapterFactory.create({ records: view.records });
const tableModel = tableContract.buildTableModel(adapter);
assert.deepStrictEqual(
  tableModel.columns.map((column) => column.title),
  ['类型', '修改时间', '操作人员', '模块', '用例标题', '前提条件', '操作步骤', '预期结果']
);
assert.strictEqual(tableModel.records[0].__rowKey, view.records[0].rowKey);
assert.strictEqual(tableModel.records[0].steps, '旧：旧步骤\n新：新步骤');
assert.strictEqual(tableModel.records[0].__cellMeta.steps.tone, 'changed');

const listeners = {};
const hostEl = {
  addEventListener(type, listener) { listeners[type] = listener; },
  removeEventListener(type) { delete listeners[type]; },
};
const mounts = [];
const tableHost = {
  mount(host, mountedAdapter) {
    const mount = { host, adapter: mountedAdapter, records: mountedAdapter.records, destroyed: false };
    mounts.push(mount);
    return {
      setRecords(records) { mount.records = records; },
      resize() {},
      destroy() { mount.destroyed = true; },
    };
  },
};
const activated = [];
const controller = controllerFactory.create({
  hostEl,
  tableHost,
  onRowActivate(record, payload) { activated.push([record.caseItemId, payload.source]); },
});
assert.strictEqual(mounts.length, 0);
const state = controller.setData(meta, { execSetId: 5001, file, filter: 'updated' });
assert.strictEqual(mounts.length, 1);
assert.strictEqual(state.records.length, 1);
mounts[0].adapter.onCellClick({ record: state.records[0], source: 'canvas' });
assert.deepStrictEqual(activated, [['101', 'canvas']]);
controller.setLoading();
assert.strictEqual(mounts.length, 2);
assert.strictEqual(mounts[0].destroyed, true);
controller.destroy();
assert.deepStrictEqual(listeners, {});

console.log('temp exec case library diff model tests passed');
