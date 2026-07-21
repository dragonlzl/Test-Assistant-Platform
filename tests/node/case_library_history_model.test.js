const assert = require('assert');
const contract = require('../../scripts/ui/tableContract.js');
const historyModel = require('../../scripts/modules/caseLibrary/caseLibraryHistoryModel.js');
const queryAdapterFactory = require('../../scripts/modules/caseLibrary/caseLibraryHistoryQueryTableAdapter.js');
const detailAdapterFactory = require('../../scripts/modules/caseLibrary/caseLibraryHistoryDetailTableAdapter.js');

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function testKindsLabelsAndTones() {
  var expected = {
    append: ['追加', 'added'],
    added: ['新增', 'added'],
    updated: ['改动', 'changed'],
    deleted: ['删除', 'removed'],
    import: ['导入', 'muted'],
    reimport: ['重导', 'changed'],
    file_deleted: ['整份删除', 'removed'],
    version_changed: ['版本变更', 'changed'],
  };
  Object.keys(expected).forEach(function(kind) {
    var meta = historyModel.getKindMeta(kind.toUpperCase());
    assert.strictEqual(meta.kind, kind);
    assert.strictEqual(meta.label, expected[kind][0]);
    assert.strictEqual(meta.tone, expected[kind][1]);
  });
  assert.deepStrictEqual(historyModel.getKindMeta(' custom '), {
    kind: 'custom',
    label: 'custom',
    tone: 'muted',
  });
  assert.deepStrictEqual(historyModel.getKindMeta(''), {
    kind: '',
    label: '--',
    tone: 'muted',
  });
}

function testQueryNormalizationKeysSearchAndPagination() {
  var source = [
    {
      project_id: 1,
      version_id: 11,
      case_file_id: 101,
      file_name_clean: ' 登录 ',
      is_deleted: false,
      last_changed_at: '2026-01-01T01:00:00Z',
      last_operator: 'operator-a',
      importer_name: 'importer-a',
      imported_at: '2025-12-01T01:00:00Z',
      last_updated_by_name: 'updater-a',
      updated_at: '2026-01-01T01:00:00Z',
      total_events: 3,
    },
    {
      project_id: 2,
      version_id: 21,
      case_file_id: null,
      file_name_clean: '搜索 / 历史',
      is_deleted: true,
      last_changed_at: '2026-01-02T01:00:00Z',
      last_operator: 'operator-b',
      total_events: 1,
    },
  ];
  var before = cloneJson(source);
  var rows = historyModel.normalizeQueryRecords(source);

  assert.deepStrictEqual(source, before);
  assert.notStrictEqual(rows[0], source[0]);
  assert.strictEqual(rows[0].rowKey, 'history-file:1:11:id:101');
  assert.strictEqual(
    rows[1].rowKey,
    'history-file:2:21:name:' + encodeURIComponent('搜索 / 历史')
  );
  assert.strictEqual(rows[0].fileNameClean, '登录');
  assert.strictEqual(rows[1].isDeleted, true);
  assert.deepStrictEqual(historyModel.filterQueryRecords(rows, ' 登 '), [rows[0]]);
  assert.deepStrictEqual(historyModel.filterQueryRecords(rows, '历史'), [rows[1]]);
  assert.deepStrictEqual(historyModel.filterQueryRecords(rows, ''), rows);

  var page = historyModel.paginate([0, 1, 2, 3, 4], 99, 2);
  assert.deepStrictEqual(page, {
    records: [4],
    pageIndex: 2,
    pageSize: 2,
    total: 5,
    totalPages: 3,
    start: 4,
    end: 5,
  });
  assert.strictEqual(historyModel.paginate([0, 1], -5, 1).pageIndex, 0);
  assert.strictEqual(historyModel.paginate([], 9, 0).pageIndex, 0);
}

function buildDetailSource() {
  return [
    {
      id: 1,
      kind: 'updated',
      changed_at: '2026-01-03T01:00:00Z',
      operator: 'demo',
      changed_fields: ['title', 'steps'],
      old: {
        module: '账户',
        title: '旧标题',
        precondition: '已登录',
        steps: '旧步骤',
        expected: '成功',
      },
      new: {
        module: '账户',
        title: '新标题',
        precondition: '已登录',
        steps: '新步骤',
        expected: '成功',
      },
    },
    {
      id: 2,
      kind: 'import',
      changed_at: '2026-01-02T01:00:00Z',
      operator: 'demo',
      changed_fields: [],
      old: null,
      new: null,
    },
    {
      id: 3,
      kind: 'added',
      changed_at: '2026-01-01T01:00:00Z',
      operator: 'demo',
      changed_fields: [],
      old: null,
      new: {
        module: '账户',
        title: '新增标题',
        precondition: '',
        steps: '新增步骤',
        expected: '新增结果',
      },
    },
  ];
}

function testDetailValidationSnapshotsFilterAndSummary() {
  assert.throws(function() {
    historyModel.normalizeDetailRecords([{ kind: 'updated' }], { fileNameClean: '登录' });
  }, /detail id.*required/i);
  assert.throws(function() {
    historyModel.normalizeDetailRecords([{ id: 1 }, { id: 1 }], { fileNameClean: '登录' });
  }, /detail id.*duplicate/i);

  var source = buildDetailSource();
  var before = cloneJson(source);
  var rows = historyModel.normalizeDetailRecords(source, { fileNameClean: '登录' });
  assert.deepStrictEqual(source, before);
  assert.notStrictEqual(rows[0].oldSnapshot, source[0].old);
  assert.notStrictEqual(rows[0].changedFields, source[0].changed_fields);
  assert.strictEqual(rows[0].rowKey, 'history-event:1');
  assert.strictEqual(rows[0].kindLabel, '改动');
  assert.strictEqual(rows[0].kindTone, 'changed');
  assert.strictEqual(rows[0].cells.title, '旧：旧标题\n新：新标题');
  assert.strictEqual(rows[0].cells.steps, '旧：旧步骤\n新：新步骤');
  assert.strictEqual(rows[0].cells.module, '账户');
  assert.strictEqual(rows[0].changedFieldMap.title, true);
  assert.strictEqual(rows[0].changedFieldMap.module, undefined);
  assert.strictEqual(rows[1].cells.module, '-');
  assert.strictEqual(rows[1].cells.title, '导入');
  assert.strictEqual(rows[1].cells.expected, '-');
  assert.strictEqual(rows[2].cells.title, '新增标题');

  assert.deepStrictEqual(historyModel.filterDetailRecords(rows, 'UPDATED'), [rows[0]]);
  assert.deepStrictEqual(historyModel.filterDetailRecords(rows, ''), rows);
  assert.deepStrictEqual(historyModel.summarizeDetailRecords(rows), {
    append: 0,
    added: 1,
    updated: 1,
    deleted: 0,
    import: 1,
    reimport: 0,
    file_deleted: 0,
    version_changed: 0,
    total: 3,
  });
}

function testReadOnlyAdapters() {
  var opened = [];
  var queryRows = historyModel.normalizeQueryRecords([
    {
      project_id: 2,
      version_id: 21,
      case_file_id: null,
      file_name_clean: '已删除用例',
      is_deleted: true,
      last_changed_at: 'changed-at',
      importer_name: 'importer',
      imported_at: 'imported-at',
      last_updated_by_name: 'updater',
      updated_at: 'updated-at',
    },
  ]);
  var queryAdapter = queryAdapterFactory.create({
    records: queryRows,
    formatTime: function(value) { return 'T:' + value; },
    getVersionName: function(projectId, versionId) { return 'V:' + projectId + ':' + versionId; },
    onOpen: function(record, payload) { opened.push([record, payload.action]); },
  });
  assert.strictEqual(queryAdapter.rowKeyPolicy, 'strict');
  assert.strictEqual(queryAdapter.onCellChange, undefined);
  assert.deepStrictEqual(queryAdapter.columns.map(function(column) { return column.key; }), [
    'lastChangedAt',
    'fileName',
    'versionName',
    'importerName',
    'importedAt',
    'updatedBy',
    'updatedAt',
    'actions',
  ]);
  var queryTableModel = contract.buildTableModel(queryAdapter);
  assert.strictEqual(queryTableModel.records[0].__rowKey, queryRows[0].rowKey);
  assert.strictEqual(queryTableModel.records[0].__rowTone, 'removed');
  assert.strictEqual(queryTableModel.records[0].fileName, '已删除用例（已删除）');
  assert.strictEqual(queryTableModel.records[0].lastChangedAt, 'T:changed-at');
  assert.strictEqual(queryTableModel.records[0].versionName, 'V:2:21');
  assert.strictEqual(queryTableModel.records[0].actions, '历史详情');
  queryAdapter.onAction({ action: 'open-history', record: queryRows[0] });
  assert.deepStrictEqual(opened, [[queryRows[0], 'open-history']]);

  var detailRows = historyModel.normalizeDetailRecords(buildDetailSource(), { fileNameClean: '登录' });
  var detailAdapter = detailAdapterFactory.create({
    records: detailRows,
    formatTime: function(value) { return 'T:' + value; },
  });
  assert.strictEqual(detailAdapter.rowKeyPolicy, 'strict');
  assert.strictEqual(detailAdapter.onAction, undefined);
  assert.deepStrictEqual(detailAdapter.columns.map(function(column) { return column.key; }), [
    'kind',
    'changedAt',
    'operator',
    'fileName',
    'module',
    'title',
    'precondition',
    'steps',
    'expected',
  ]);
  var detailTableModel = contract.buildTableModel(detailAdapter);
  assert.strictEqual(detailTableModel.records[0].__rowKey, 'history-event:1');
  assert.strictEqual(detailTableModel.records[0].kind, '改动');
  assert.strictEqual(detailTableModel.records[0].__cellMeta.kind.tone, 'changed');
  assert.strictEqual(detailTableModel.records[0].__cellMeta.title.tone, 'changed');
  assert.strictEqual(detailTableModel.records[0].__cellMeta.title.multiline, true);
  assert.strictEqual(detailTableModel.records[0].title, '旧：旧标题\n新：新标题');
}

testKindsLabelsAndTones();
testQueryNormalizationKeysSearchAndPagination();
testDetailValidationSnapshotsFilterAndSummary();
testReadOnlyAdapters();
console.log('case library history model tests passed');
