const assert = require('assert');
const contract = require('../../scripts/ui/tableContract.js');
const associationModel = require('../../scripts/modules/caseLibrary/caseLibraryAssociationModel.js');
const listAdapterFactory = require('../../scripts/modules/caseLibrary/caseLibraryAssociationListTableAdapter.js');
const candidateAdapterFactory = require('../../scripts/modules/caseLibrary/caseLibraryAssociationCandidateTableAdapter.js');
const itemAdapterFactory = require('../../scripts/modules/caseLibrary/caseLibraryAssociationItemTableAdapter.js');

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function associationSource() {
  return [
    {
      id: 31,
      main_case_file_id: 10,
      sub_case_file_id: 20,
      sub_case_file_name: ' 副用例 A ',
      selected_case_item_ids: [203, '201', 203, 0, -1],
      selected_count: 99,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    },
  ];
}

function candidateSource() {
  return [
    {
      id: 20,
      project_id: 1,
      version_id: 11,
      file_name_clean: ' Alpha Cases ',
      item_count: 3,
      association_count: 0,
      association_forbidden: false,
      forbidden_reason: null,
    },
    {
      id: 21,
      project_id: 1,
      version_id: 11,
      file_name_clean: 'beta cases',
      item_count: 2,
      association_count: 1,
      association_forbidden: true,
      forbidden_reason: '已关联到当前主用例',
    },
  ];
}

function itemSource() {
  return [
    {
      id: 203,
      case_file_id: 20,
      module: '支付',
      title: '支付成功',
      priority: 'P1',
      precondition: '已登录\n余额充足',
      steps: '1. 下单\n2. 支付',
      expected: '支付成功\n生成订单',
    },
    {
      id: 201,
      case_file_id: 20,
      module: '登录',
      title: '正常登录',
      priority: 'P0',
      precondition: '账号可用',
      steps: '输入账号密码',
      expected: '登录成功',
    },
    {
      id: 202,
      case_file_id: 20,
      module: '登录',
      title: '密码错误',
      priority: 'P2',
      precondition: '账号可用',
      steps: '输入错误密码',
      expected: '提示错误',
    },
  ];
}

function testStrictKeysAndValidation() {
  assert.strictEqual(
    associationModel.buildAssociationRowKey({ id: 31, main_case_file_id: 10 }),
    'association:10:31'
  );
  assert.strictEqual(
    associationModel.buildCandidateRowKey({ id: 20 }, { mainCaseFileId: 10 }),
    'association-candidate:10:20'
  );
  assert.strictEqual(
    associationModel.buildItemRowKey({ id: 203 }, { subCaseFileId: 20 }),
    'association-item:20:203'
  );

  assert.throws(function() {
    associationModel.buildAssociationRowKey({ id: 31 });
  }, /main.*required/i);
  assert.throws(function() {
    associationModel.buildAssociationRowKey({ main_case_file_id: 10 });
  }, /association.*required/i);
  assert.throws(function() {
    associationModel.buildCandidateRowKey({ id: 20 }, {});
  }, /main.*required/i);
  assert.throws(function() {
    associationModel.buildCandidateRowKey({}, { mainCaseFileId: 10 });
  }, /candidate.*required/i);
  assert.throws(function() {
    associationModel.buildItemRowKey({ id: 203 }, {});
  }, /sub.*required/i);
  assert.throws(function() {
    associationModel.buildItemRowKey({}, { subCaseFileId: 20 });
  }, /item.*required/i);

  assert.throws(function() {
    associationModel.normalizeAssociationRecords([
      { id: 31, main_case_file_id: 10 },
      { id: 31, main_case_file_id: 10 },
    ]);
  }, /duplicate/i);
  assert.throws(function() {
    associationModel.normalizeCandidateRecords([{ id: 20 }, { id: 20 }], { mainCaseFileId: 10 });
  }, /duplicate/i);
  assert.throws(function() {
    associationModel.normalizeItemRecords([{ id: 203 }, { id: 203 }], { subCaseFileId: 20 });
  }, /duplicate/i);
}

function testNormalizationIsImmutable() {
  var associations = associationSource();
  var candidates = candidateSource();
  var items = itemSource();
  var associationsBefore = cloneJson(associations);
  var candidatesBefore = cloneJson(candidates);
  var itemsBefore = cloneJson(items);

  var normalizedAssociations = associationModel.normalizeAssociationRecords(associations);
  var normalizedCandidates = associationModel.normalizeCandidateRecords(candidates, {
    mainCaseFileId: 10,
    selectedCandidateId: 20,
  });
  var normalizedItems = associationModel.normalizeItemRecords(items, {
    subCaseFileId: 20,
    selectedItemIds: [201, 203],
  });

  assert.deepStrictEqual(associations, associationsBefore);
  assert.deepStrictEqual(candidates, candidatesBefore);
  assert.deepStrictEqual(items, itemsBefore);
  assert.notStrictEqual(normalizedAssociations[0], associations[0]);
  assert.notStrictEqual(normalizedCandidates[0], candidates[0]);
  assert.notStrictEqual(normalizedItems[0], items[0]);

  assert.deepStrictEqual(normalizedAssociations[0], {
    rowKey: 'association:10:31',
    id: 31,
    mainCaseFileId: 10,
    subCaseFileId: 20,
    subCaseName: '副用例 A',
    selectedItemIds: [203, 201],
    selectedCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  });
  assert.strictEqual(normalizedCandidates[0].rowKey, 'association-candidate:10:20');
  assert.strictEqual(normalizedCandidates[0].fileNameClean, 'Alpha Cases');
  assert.strictEqual(normalizedCandidates[0].selected, true);
  assert.strictEqual(normalizedCandidates[0].forbidden, false);
  assert.strictEqual(normalizedCandidates[1].forbidden, true);
  assert.strictEqual(normalizedCandidates[1].forbiddenReason, '已关联到当前主用例');
  assert.strictEqual(normalizedItems[0].rowKey, 'association-item:20:203');
  assert.strictEqual(normalizedItems[0].selected, true);
  assert.strictEqual(normalizedItems[1].selected, true);
  assert.strictEqual(normalizedItems[2].selected, false);
  assert.deepStrictEqual(normalizedItems.map(function(item) { return item.index; }), [1, 2, 3]);
}

function testCandidateSearchSelectionAndPagination() {
  var candidates = associationModel.normalizeCandidateRecords(candidateSource(), {
    mainCaseFileId: 10,
  });
  assert.deepStrictEqual(
    associationModel.filterCandidateRecords(candidates, ' ALPHA '),
    [candidates[0]]
  );
  assert.deepStrictEqual(
    associationModel.filterCandidateRecords(candidates, 'BeTa'),
    [candidates[1]]
  );
  assert.strictEqual(associationModel.filterCandidateRecords(candidates, 'beta')[0].forbidden, true);
  assert.deepStrictEqual(associationModel.filterCandidateRecords(candidates, ''), candidates);

  assert.deepStrictEqual(
    associationModel.normalizeSelectionIds([203, '201', 203, 0, -1, 1.5, 'bad', 202]),
    [203, 201, 202]
  );
  var items = itemSource();
  assert.deepStrictEqual(
    associationModel.orderSelectionByItems(items, [202, 203, 999, 201]),
    [203, 201, 202]
  );

  var page = associationModel.paginate(items, 99, 2);
  assert.deepStrictEqual(page, {
    records: [items[2]],
    pageIndex: 1,
    pageSize: 2,
    total: 3,
    totalPages: 2,
    start: 2,
    end: 3,
  });
  assert.strictEqual(associationModel.paginate(items, -4, 2).pageIndex, 0);
  assert.strictEqual(associationModel.paginate([], 4, 0).pageIndex, 0);

  var allItems = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
    { id: 4 },
    { id: 5 },
  ];
  var currentPage = [{ id: 3 }, { id: 4 }];
  assert.deepStrictEqual(
    associationModel.applyCurrentPageSelection(allItems, [1, 5], currentPage, true),
    [1, 3, 4, 5]
  );
  assert.deepStrictEqual(
    associationModel.applyCurrentPageSelection(allItems, [1, 3, 4, 5], currentPage, false),
    [1, 5]
  );
  assert.deepStrictEqual(
    associationModel.getCurrentPageSelectionState(currentPage, [1, 3]),
    { total: 2, selected: 1, checked: false, indeterminate: true, disabled: false }
  );
  assert.deepStrictEqual(
    associationModel.getCurrentPageSelectionState([], [1]),
    { total: 0, selected: 0, checked: false, indeterminate: false, disabled: true }
  );
}

function testAssociationTableAdapters() {
  var associations = associationModel.normalizeAssociationRecords(associationSource());
  var candidates = associationModel.normalizeCandidateRecords(candidateSource(), {
    mainCaseFileId: 10,
    selectedCandidateId: 20,
  });
  var items = associationModel.normalizeItemRecords(itemSource(), {
    subCaseFileId: 20,
    selectedItemIds: [203],
  });
  var actions = [];
  var selectedCandidates = [];
  var toggledItems = [];

  var listAdapter = listAdapterFactory.create({
    records: associations,
    onEdit: function(record) { actions.push(['edit', record.rowKey]); },
    onDelete: function(record) { actions.push(['delete', record.rowKey]); },
  });
  assert.strictEqual(listAdapter.rowKeyPolicy, 'strict');
  assert.strictEqual(listAdapter.strictRowKey, true);
  assert.deepStrictEqual(listAdapter.columns.map(function(column) { return column.key; }), [
    'subCaseName',
    'selectedCount',
    'actions',
  ]);
  listAdapter.onAction({ action: 'edit', record: associations[0] });
  listAdapter.onAction({ action: 'delete', record: associations[0] });
  assert.deepStrictEqual(actions, [
    ['edit', 'association:10:31'],
    ['delete', 'association:10:31'],
  ]);

  var candidateAdapter = candidateAdapterFactory.create({
    records: candidates,
    getVersionName: function(projectId, versionId) { return 'V:' + projectId + ':' + versionId; },
    onSelect: function(record) { selectedCandidates.push(record.rowKey); },
  });
  assert.strictEqual(candidateAdapter.rowKeyPolicy, 'strict');
  assert.strictEqual(candidateAdapter.strictRowKey, true);
  assert.deepStrictEqual(candidateAdapter.columns.map(function(column) { return column.key; }), [
    'selected',
    'fileName',
    'versionName',
    'itemCount',
  ]);
  assert.strictEqual(candidateAdapter.columns[0].kind, 'radio');
  assert.strictEqual(candidateAdapter.columns[0].disabled(candidates[0]), false);
  assert.strictEqual(candidateAdapter.columns[0].disabled(candidates[1]), true);
  candidateAdapter.onCellChange({ column: candidateAdapter.columns[0], record: candidates[0], value: true });
  assert.deepStrictEqual(selectedCandidates, ['association-candidate:10:20']);
  var candidateTableModel = contract.buildTableModel(candidateAdapter);
  assert.strictEqual(candidateTableModel.records[0].selected, true);
  assert.strictEqual(candidateTableModel.records[1].selected, false);

  var itemAdapter = itemAdapterFactory.create({
    records: items,
    onToggle: function(record, value) { toggledItems.push([record.rowKey, value]); },
  });
  assert.strictEqual(itemAdapter.rowKeyPolicy, 'strict');
  assert.strictEqual(itemAdapter.strictRowKey, true);
  assert.deepStrictEqual(itemAdapter.columns.map(function(column) { return column.key; }), [
    'selected',
    'index',
    'module',
    'title',
    'priority',
    'precondition',
    'steps',
    'expected',
  ]);
  assert.strictEqual(itemAdapter.columns[0].kind, 'checkbox');
  assert.strictEqual(itemAdapter.columns[5].multiline, true);
  assert.strictEqual(itemAdapter.columns[6].multiline, true);
  assert.strictEqual(itemAdapter.columns[7].multiline, true);
  itemAdapter.onCellChange({ column: itemAdapter.columns[0], record: items[1], value: true });
  assert.deepStrictEqual(toggledItems, [['association-item:20:201', true]]);
  var itemTableModel = contract.buildTableModel(itemAdapter);
  assert.strictEqual(itemTableModel.records[0].selected, true);
  assert.strictEqual(itemTableModel.records[1].selected, false);
  assert.strictEqual(itemTableModel.records[0].__cellMeta.steps.multiline, true);
}

testStrictKeysAndValidation();
testNormalizationIsImmutable();
testCandidateSearchSelectionAndPagination();
testAssociationTableAdapters();
console.log('case library association model tests passed');
