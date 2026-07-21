const assert = require('assert');
const model = require('../../scripts/modules/caseLibrary/caseLibraryEditListModel.js');

function files() {
  return [
    {
      id: 101,
      project_id: 1,
      version_id: 11,
      file_name_clean: '登录回归',
      importer_id: 9,
      importer_name: '甲',
      item_count: 12,
      reuse_enabled: true,
      association_count: 2,
    },
    {
      id: 102,
      project_id: 1,
      version_id: 12,
      file_name_clean: '支付回归',
      importer_id: 10,
      last_updated_by: 9,
      importer_name: '乙',
      source: 'share:2:12',
      item_count: 8,
    },
    {
      id: 103,
      project_id: 1,
      version_id: 11,
      file_name_clean: '背包基础',
      importer_id: 10,
      importer_name: '乙',
      item_count: 5,
    },
  ];
}

function testNormalizeAndFilter() {
  const rows = model.normalizeRecords(files(), {
    projectNameById: { 1: '战魂铭人' },
    versionNameByProject: { 1: { 11: 'v1', 12: 'v2' } },
    execSets: [{ case_file_id: 101, active_users: ['执行人A', '执行人A'] }],
    aiBadgeByFileId: { 102: true },
  });
  assert.deepStrictEqual(rows.map(function(row) { return row.rowKey; }), [
    'case-library-edit:101',
    'case-library-edit:102',
    'case-library-edit:103',
  ]);
  assert.strictEqual(rows[0].projectName, '战魂铭人');
  assert.strictEqual(rows[0].versionName, 'v1');
  assert.deepStrictEqual(rows[0].activeUsers, ['执行人A']);
  assert.strictEqual(rows[0].reuseText, '是');
  assert.strictEqual(rows[1].isShared, true);
  assert.strictEqual(rows[1].showAiDot, true);

  assert.deepStrictEqual(model.filterRecords(rows, { versionId: 11 }).map(function(row) {
    return row.id;
  }), [101, 103]);
  assert.deepStrictEqual(model.filterRecords(rows, { ownerFilter: 'me', currentUserId: 9 }).map(function(row) {
    return row.id;
  }), [101, 102]);
  assert.deepStrictEqual(model.filterRecords(rows, { ownerFilter: 'shared' }).map(function(row) {
    return row.id;
  }), [102]);
  assert.deepStrictEqual(model.filterRecords(rows, { searchText: '支付' }).map(function(row) {
    return row.id;
  }), [102]);
  assert.deepStrictEqual(model.filterRecords(rows, {
    versionId: 11,
    ownerFilter: 'me',
    currentUserId: 9,
    searchText: '登录',
  }).map(function(row) { return row.id; }), [101]);
  assert.throws(function() {
    model.normalizeRecords([files()[0], Object.assign({}, files()[0])], {});
  }, /duplicate/);
}

function testPaginationAndSelection() {
  const rows = model.normalizeRecords(files(), {});
  const page = model.paginate(rows, 0, 2);
  assert.deepStrictEqual(page.records.map(function(row) { return row.id; }), [101, 102]);
  let selected = model.applyCurrentPageSelection(rows, [], page.records, true);
  assert.deepStrictEqual(selected, [101, 102]);
  selected = model.applyCurrentPageSelection(rows, selected, [rows[2]], true);
  assert.deepStrictEqual(selected, [101, 102, 103]);
  selected = model.pruneSelection(rows.slice(1), selected);
  assert.deepStrictEqual(selected, [102, 103]);
  assert.deepStrictEqual(model.getCurrentPageSelectionState(page.records, [101]), {
    total: 2,
    selected: 1,
    checked: false,
    indeterminate: true,
    disabled: false,
  });
  assert.deepStrictEqual(model.summarize(rows), { fileCount: 3, itemCount: 25 });
}

testNormalizeAndFilter();
testPaginationAndSelection();
console.log('case library edit list model tests passed');
