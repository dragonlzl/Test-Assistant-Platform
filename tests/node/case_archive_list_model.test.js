const assert = require('assert');
const model = require('../../scripts/modules/caseArchive/caseArchiveListModel.js');
const adapterFactory = require('../../scripts/modules/caseArchive/caseArchiveListTableAdapter.js');
const controllerFactory = require('../../scripts/modules/caseArchive/caseArchiveListController.js');
const tableContract = require('../../scripts/ui/tableContract.js');

const sourceRows = Array.from({ length: 6 }).map((_, index) => ({
  exec_set_id: 101 + index,
  project_name: '项目A',
  version_name: 'v1',
  name: '归档用例 ' + String(index + 1),
  case_count: index + 1,
  rearchive_count: index,
  archive_state: index === 1 ? 'rerun' : 'archived',
  reuse_enabled: index % 2 === 0,
  imported_by_name: 'importer',
  imported_at: '2026-07-17T08:00:00Z',
  archived_by_name: 'archiver',
  archived_at: '2026-07-17T09:00:00Z',
}));

const records = model.normalizeRecords(sourceRows, { isAdmin: true });
assert.strictEqual(records[0].rowKey, 'case-archive:101');
assert.strictEqual(records[0].reuseText, '复用');
assert.strictEqual(records[1].archiveState, 'rerun');
assert.strictEqual(records[1].stateLabel, '重执');
assert.strictEqual(records[0].canDelete, true);

const page = model.paginate(records, 1, 5);
assert.strictEqual(page.pageIndex, 1);
assert.strictEqual(page.totalPages, 2);
assert.strictEqual(page.records[0].displayIndex, 6);
assert.strictEqual(page.records[0].execSetId, 106);

assert.throws(
  () => model.normalizeRecords([sourceRows[0], Object.assign({}, sourceRows[0])]),
  /duplicate/i
);
assert.throws(
  () => model.normalizeRecord({ name: '缺少执行集 ID' }),
  /stable id/i
);

const actions = [];
const adapter = adapterFactory.create({
  records: page.records,
  formatTime: (value) => 'time:' + value,
  onAction: (action, record) => actions.push([action, record.execSetId]),
});
const tableModel = tableContract.buildTableModel(adapter);
assert.strictEqual(tableModel.columns.length, 13);
assert.deepStrictEqual(
  tableModel.columns.map((column) => column.title),
  ['编号', '所属项目', '版本', '用例名', '用例条目数', '重归档次数', '状态', '复用类型', '导入人员', '导入时间', '归档人', '归档时间', '操作']
);
assert.strictEqual(tableModel.records[0].importedAt, 'time:2026-07-17T08:00:00Z');
adapter.onAction({ action: 'restore', record: page.records[0] });
assert.deepStrictEqual(actions, [['restore', 106]]);

function createEventRoot() {
  const listeners = {};
  return {
    addEventListener(type, listener) { listeners[type] = listener; },
    removeEventListener(type) { delete listeners[type]; },
    contains() { return true; },
  };
}

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
const paginationTop = { innerHTML: '' };
const paginationBottom = { innerHTML: '' };
const emptyEl = { classList: { toggle() {} } };
const controllerActions = [];
const controller = controllerFactory.create({
  hostEl: {},
  emptyEl,
  paginationTopEl: paginationTop,
  paginationBottomEl: paginationBottom,
  eventRoot: createEventRoot(),
  tableHost,
  pageSize: 5,
  formatTime: (value) => value,
  onAction: (action, record) => controllerActions.push([action, record.execSetId]),
});

assert.strictEqual(mounts.length, 0);
controller.setData(sourceRows, { isAdmin: false });
assert.strictEqual(mounts.length, 1);
assert.strictEqual(mounts[0].records.length, 5);
assert.match(paginationTop.innerHTML, /显示 1-5 \/ 共 6 条/);
assert.strictEqual(mounts[0].records[0].canDelete, false);

controller.movePage('next');
assert.strictEqual(mounts[0].records.length, 1);
assert.strictEqual(mounts[0].records[0].displayIndex, 6);
mounts[0].adapter.onAction({ action: 'view', record: mounts[0].records[0] });
assert.deepStrictEqual(controllerActions, [['view', 106]]);

controller.destroy();
console.log('case archive list model tests passed');
