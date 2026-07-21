const assert = require('assert');
const contract = require('../../scripts/ui/tableContract.js');
const model = require('../../scripts/modules/caseLibrary/caseLibrarySelectExecModel.js');
const adapterFactory = require('../../scripts/modules/caseLibrary/caseLibrarySelectExecTableAdapter.js');

function sourceFiles() {
  return [
    {
      id: 101,
      project_id: 1,
      version_id: 11,
      file_name_clean: ' Alpha ',
      reuse_enabled: true,
      importer_name: 'A',
      imported_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      association_count: 2,
    },
    {
      id: 102,
      project_id: 1,
      version_id: 12,
      file_name_clean: 'beta',
      reuse_enabled: false,
      importer_name: 'B',
      association_count: 0,
    },
    {
      id: 103,
      project_id: 1,
      version_id: 11,
      file_name_clean: 'Gamma',
      association_count: 1,
    },
  ];
}

function context() {
  return {
    projectId: 1,
    projectNameById: { 1: '项目一' },
    versionNameByProject: { 1: { 11: 'v1', 12: 'v2' } },
    execByFileId: {
      101: { active_users: ['甲', '甲', '乙'] },
      102: { active_users: [] },
    },
    associationSwitchByFileId: { 101: false, 103: true },
  };
}

function testStrictRowsAndNormalization() {
  assert.strictEqual(model.buildRowKey({ id: 101 }), 'case-library-select:101');
  assert.throws(function() { model.buildRowKey({}); }, /case file id is required/i);
  assert.throws(function() {
    model.normalizeRecords([
      { id: 101, project_id: 1 },
      { id: 101, project_id: 1 },
    ], context());
  }, /duplicate/i);

  var files = sourceFiles();
  var before = JSON.stringify(files);
  var rows = model.normalizeRecords(files, context());
  assert.strictEqual(JSON.stringify(files), before);
  assert.deepStrictEqual(rows.map(function(row) { return row.rowKey; }), [
    'case-library-select:101',
    'case-library-select:102',
    'case-library-select:103',
  ]);
  assert.strictEqual(rows[0].projectName, '项目一');
  assert.strictEqual(rows[0].versionName, 'v1');
  assert.strictEqual(rows[0].fileName, 'Alpha');
  assert.deepStrictEqual(rows[0].activeUsers, ['甲', '乙']);
  assert.strictEqual(rows[0].associationEnabled, false);
  assert.strictEqual(rows[1].associationEnabled, false);
  assert.strictEqual(rows[2].associationEnabled, true);
}

function testQueryPaginationAndSelection() {
  var rows = model.normalizeRecords(sourceFiles(), context());
  assert.deepStrictEqual(
    model.filterRecords(rows, { versionId: 11 }).map(function(row) { return row.id; }),
    [101, 103]
  );
  assert.deepStrictEqual(
    model.filterRecords(rows, { versionId: 11, searchText: ' BETA ' }).map(function(row) { return row.id; }),
    [102]
  );
  var page = model.paginate(rows, 99, 2);
  assert.deepStrictEqual(page.records.map(function(row) { return row.id; }), [103]);
  assert.strictEqual(page.pageIndex, 1);
  assert.deepStrictEqual(model.normalizeSelectionIds([103, '101', 103, 0, -1, 1.5]), [103, 101]);
  assert.deepStrictEqual(model.orderSelectionByRecords(rows, [103, 101]), [101, 103]);
  assert.deepStrictEqual(
    model.applyCurrentPageSelection(rows, [101], [rows[1], rows[2]], true),
    [101, 102, 103]
  );
  assert.deepStrictEqual(
    model.applyCurrentPageSelection(rows, [101, 102, 103], [rows[1], rows[2]], false),
    [101]
  );
  assert.deepStrictEqual(
    model.getCurrentPageSelectionState([rows[0], rows[1]], [101]),
    { total: 2, selected: 1, checked: false, indeterminate: true, disabled: false }
  );
}

function testAssociationRulesAndAdapter() {
  var files = sourceFiles();
  assert.deepStrictEqual(model.syncAssociationSwitchMap(files, { 101: false, 102: true, 999: true }), {
    101: false,
    102: false,
    103: true,
  });
  assert.deepStrictEqual(model.resolveAssociationDecision({ association_count: 0 }, true), {
    associationEnabled: false,
    requiresConfirmation: false,
  });
  assert.deepStrictEqual(model.resolveAssociationDecision({ association_count: 2 }, false), {
    associationEnabled: false,
    requiresConfirmation: true,
  });

  var rows = model.normalizeRecords(files, context());
  var events = [];
  var adapter = adapterFactory.create({
    records: rows,
    formatTime: function(value) { return value ? 'T:' + value : '--'; },
    onSelectionChange: function(record, checked) { events.push(['selected', record.id, checked]); },
    onAssociationChange: function(record, checked) { events.push(['association', record.id, checked]); },
    onAssociation: function(record) { events.push(['open', record.id]); },
    onExec: function(record) { events.push(['exec', record.id]); },
  });
  var table = contract.buildTableModel(adapter);
  assert.strictEqual(table.id, 'case-library-select-exec');
  assert.strictEqual(contract.normalizeAdapter(adapter).strictRowKey, true);
  assert.strictEqual(table.columns.length, 11);
  assert.strictEqual(table.records[0].fileName, 'Alpha [复]');
  assert.strictEqual(table.records[0].execStatus, '甲：执；乙：执');
  assert.strictEqual(table.records[1].execStatus, '未');
  assert.strictEqual(table.records[0].associationCountText, '关联(2)');

  adapter.onCellChange({ column: adapter.columns[0], record: rows[0], value: true });
  adapter.onCellChange({ column: adapter.columns[9], record: rows[0], value: true });
  adapter.onCellChange({ column: adapter.columns[9], record: rows[1], value: true });
  adapter.onAction({ action: 'association', record: rows[0] });
  adapter.onAction({ action: 'exec', record: rows[1] });
  assert.deepStrictEqual(events, [
    ['selected', 101, true],
    ['association', 101, true],
    ['open', 101],
    ['exec', 102],
  ]);
  assert.strictEqual(adapter.columns[9].disabled(rows[1]), true);
}

testStrictRowsAndNormalization();
testQueryPaginationAndSelection();
testAssociationRulesAndAdapter();
console.log('case library select exec model tests passed');
