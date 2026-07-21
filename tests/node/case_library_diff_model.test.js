const assert = require('assert');
const contract = require('../../scripts/ui/tableContract.js');
const semanticMirror = require('../../scripts/ui/tableSemanticMirror.js');
const vtableHost = require('../../scripts/ui/vtableHost.js');
const diffModel = require('../../scripts/modules/caseLibrary/caseLibraryDiffModel.js');
const diffTableAdapter = require('../../scripts/modules/caseLibrary/caseLibraryDiffTableAdapter.js');

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function findDiffRow(rows, title) {
  return rows.find(function(row) {
    var item = row.left || row.right;
    return item && item.title === title;
  });
}

function testLegacyTextKeyAndDedupeSemantics() {
  assert.strictEqual(diffModel.normalizeDiffText(null), '');
  assert.strictEqual(diffModel.normalizeDiffText(undefined), '');
  assert.strictEqual(diffModel.normalizeDiffText('  first\r\nsecond  '), 'first\nsecond');
  assert.strictEqual(diffModel.buildCaseItemKey(null), '');
  assert.strictEqual(diffModel.buildCaseItemKey({}), '::::::::');

  var aliased = {
    module_name: ' Billing ',
    title: ' LOGIN ',
    preconditions: ' Ready\r\n',
    steps: ' Run ',
    expected: ' DONE ',
  };
  var canonical = {
    module: 'billing',
    title: 'login',
    precondition: 'ready\n',
    steps: 'run',
    expected: 'done',
  };
  assert.strictEqual(diffModel.buildCaseItemKey(aliased), diffModel.buildCaseItemKey(canonical));

  var duplicate = Object.assign({}, canonical, { priority: 'P3' });
  var deduped = diffModel.dedupeCaseItemsByKey([aliased, duplicate, {}, {}]);
  assert.strictEqual(deduped.length, 2);
  assert.strictEqual(deduped[0], aliased);
  assert.deepStrictEqual(deduped[1], {});
  assert.strictEqual(diffModel.countUniqueCaseItemsByKey([aliased, duplicate, {}, {}]), 2);
}

function testImportDiffSemanticsAndImmutability() {
  var imported = [
    {
      module_name: ' Billing ',
      title: 'LOGIN',
      preconditions: 'Ready\r\n',
      steps: 'Run',
      expected: 'Done',
      priority: 'P0',
      remark: 'new',
    },
    {
      module: 'billing',
      title: ' login ',
      precondition: 'ready\n',
      steps: ' run ',
      expected: 'done',
      priority: 'P9',
    },
    {
      module: 'account',
      title: 'Added',
      precondition: '',
      steps: 'Create',
      expected: 'Created',
      priority: 'P2',
    },
    {
      module: 'common',
      title: 'Same',
      precondition: 'Ready',
      steps: 'Open',
      expected: 'Opened',
      priority: 'P2',
    },
  ];
  var stored = [
    {
      module: 'billing',
      title: 'login',
      precondition: 'ready',
      steps: 'run',
      expected: 'done',
      priority: 'P1',
      remark: 'old',
    },
    {
      module: 'archive',
      title: 'Removed',
      precondition: '',
      steps: 'Delete',
      expected: 'Deleted',
      priority: 'P1',
    },
    {
      module: 'common',
      title: 'Same',
      precondition: 'Ready',
      steps: 'Open',
      expected: 'Opened',
      priority: 'P2',
    },
  ];
  var importedBefore = cloneJson(imported);
  var storedBefore = cloneJson(stored);
  var rows = diffModel.buildImportDiffRows(imported, stored);

  assert.deepStrictEqual(imported, importedBefore);
  assert.deepStrictEqual(stored, storedBefore);
  assert.deepStrictEqual(rows.map(function(row) { return row.key; }), rows.map(function(row) {
    return row.key;
  }).slice().sort());
  assert.deepStrictEqual(rows.map(function(row) { return row.type; }).sort(), [
    'added',
    'changed',
    'removed',
    'same',
  ]);

  var changed = findDiffRow(rows, 'LOGIN');
  assert.strictEqual(changed.left, imported[0]);
  assert.strictEqual(changed.right, stored[0]);
  assert.deepStrictEqual(changed.diff, {
    priority: true,
    precondition: true,
    steps: true,
  });
  assert.strictEqual(findDiffRow(rows, 'Added').type, 'added');
  assert.strictEqual(findDiffRow(rows, 'Removed').type, 'removed');
  assert.strictEqual(findDiffRow(rows, 'Same').type, 'same');

  var expectedOnlyRows = diffModel.buildImportDiffRows([
    { module: 'm', title: 'Expected key', steps: 's', expected: 'left' },
  ], [
    { module: 'm', title: 'Expected key', steps: 's', expected: 'right' },
  ]);
  assert.deepStrictEqual(expectedOnlyRows.map(function(row) { return row.type; }).sort(), [
    'added',
    'removed',
  ]);
}

function testAppendOverwriteSemanticsAndAliases() {
  var appendItems = [
    {
      module: 'billing',
      title: 'Append changed',
      preconditions: 'ready',
      steps: 'run',
      expected: 'done',
      priority: 'P0',
      remark: 'new',
    },
    {
      module_name: ' billing ',
      title: ' append changed ',
      precondition: ' ready ',
      steps: ' run ',
      expected: ' done ',
      priority: 'P9',
      remark: 'ignored duplicate',
    },
    {
      module: 'account',
      title: 'Append added',
      steps: 'create',
      expected: 'created',
    },
  ];
  var stored = [
    {
      module: 'billing',
      title: 'append changed',
      precondition: 'ready',
      steps: 'run',
      expected: 'done',
      priority: 'P1',
      remark: 'old',
    },
    {
      module: 'archive',
      title: 'Stored only',
      steps: 'keep',
      expected: 'kept',
    },
  ];
  var appendBefore = cloneJson(appendItems);
  var storedBefore = cloneJson(stored);
  var rows = diffModel.buildAppendOverwriteDiffRows(appendItems, stored);

  assert.deepStrictEqual(appendItems, appendBefore);
  assert.deepStrictEqual(stored, storedBefore);
  assert.strictEqual(rows.some(function(row) { return row.type === 'removed'; }), false);
  assert.deepStrictEqual(rows.map(function(row) { return row.type; }).sort(), [
    'added',
    'changed',
    'same',
  ]);

  var changed = findDiffRow(rows, 'Append changed');
  assert.strictEqual(changed.left, appendItems[0]);
  assert.deepStrictEqual(changed.diff, {
    priority: true,
    precondition: false,
    steps: false,
    expected: false,
    remark: true,
  });
  assert.strictEqual(findDiffRow(rows, 'Stored only').type, 'same');

  assert.strictEqual(diffModel.compareCaseItemFieldsForAppendOverwrite(
    { expected: 'left' },
    { expected: 'right' }
  ).expected, true);
  var expectedOnlyRows = diffModel.buildAppendOverwriteDiffRows([
    { module: 'm', title: 'Expected key', steps: 's', expected: 'left' },
  ], [
    { module: 'm', title: 'Expected key', steps: 's', expected: 'right' },
  ]);
  assert.deepStrictEqual(expectedOnlyRows.map(function(row) { return row.type; }).sort(), [
    'added',
    'same',
  ]);
}

function testStrictStableKeysAndCellMetadata() {
  assert.throws(function() {
    contract.buildTableModel({
      id: 'strict-missing',
      rowKeyPolicy: 'strict',
      rowKey: function(record) { return record.key; },
      columns: [{ key: 'title' }],
      records: [{ id: 'fallback-id', title: 'Missing key' }],
    });
  }, /stable row key.*missing/i);

  assert.throws(function() {
    contract.buildTableModel({
      id: 'strict-duplicate',
      strictRowKey: true,
      columns: [{ key: 'title' }],
      records: [
        { id: 'duplicate', title: 'One' },
        { id: 'duplicate', title: 'Two' },
      ],
    });
  }, /stable row key.*duplicate/i);

  var records = [
    { id: 0, title: 'First\nline', status: 'changed' },
    { id: 2, title: 'Second', status: 'same' },
  ];
  var model = contract.buildTableModel({
    id: 'strict-metadata',
    strictRowKey: true,
    rowTone: function(record) { return record.status; },
    columns: [
      {
        key: 'title',
        tone: function(value, record, index) {
          return index === 0 && record.status === 'changed' && value ? 'warning' : '';
        },
        tooltip: true,
        multiline: function(value) { return String(value).indexOf('\n') >= 0; },
      },
      {
        key: 'status',
        tone: 'muted',
        tooltip: function(value, record) { return record.title + ': ' + value; },
        multiline: false,
      },
    ],
    records: records,
  });

  assert.strictEqual(model.records[0].__rowKey, '0');
  assert.strictEqual(model.rowKeyIndex['0'], 0);
  assert.strictEqual(model.records[0].__rowTone, 'changed');
  assert.deepStrictEqual(model.records[0].__cellMeta.title, {
    tone: 'warning',
    tooltip: 'First\nline',
    multiline: true,
  });
  assert.deepStrictEqual(model.records[0].__cellMeta.status, {
    tone: 'muted',
    tooltip: 'First\nline: changed',
    multiline: false,
  });

  var prototypeKeyModel = contract.buildTableModel({
    id: 'strict-prototype-key',
    strictRowKey: true,
    columns: [{ key: 'title' }],
    records: [{ id: '__proto__', title: 'Prototype key' }],
  });
  assert.strictEqual(prototypeKeyModel.records[0].__rowKey, '__proto__');
  assert.strictEqual(prototypeKeyModel.rowKeyIndex.__proto__, 0);

  var compatible = contract.buildTableModel({
    id: 'compatible-keys',
    rowKey: function(record) { return record.key; },
    columns: [{ key: 'title' }],
    records: [
      { key: 'same', title: 'One' },
      { key: 'same', title: 'Two' },
      { id: 0, title: 'Zero' },
      { title: 'Index fallback' },
    ],
  });
  assert.deepStrictEqual(compatible.records.map(function(record) { return record.__rowKey; }), [
    'same',
    'same--2',
    '0',
    '3',
  ]);
}

function testNormalizedSemanticWindow() {
  var rowKeyCalls = 0;
  var records = Array.from({ length: 10 }, function(_, index) {
    return { id: String(index), title: 'Row ' + index };
  });
  var model = contract.buildTableModel({
    id: 'semantic-window',
    strictRowKey: true,
    rowKey: function(record) {
      rowKeyCalls += 1;
      return record.id;
    },
    columns: [{ key: 'title' }],
    records: records,
  });
  assert.strictEqual(rowKeyCalls, 10);

  var windowed = semanticMirror.buildRecordWindow(model, {
    maxRows: 4,
    focusRowKey: '7',
  });
  assert.strictEqual(rowKeyCalls, 10);
  assert.strictEqual(windowed.total, 10);
  assert.strictEqual(windowed.startIndex, 5);
  assert.strictEqual(windowed.endIndex, 9);
  assert.strictEqual(windowed.truncated, true);
  assert.deepStrictEqual(windowed.records.map(function(record) { return record.__rowKey; }), [
    '5',
    '6',
    '7',
    '8',
  ]);
  assert.strictEqual(windowed.records[2], model.records[7]);
}

function testVTableToneAndStableFocusResolution() {
  var model = contract.buildTableModel({
    id: 'host-contract',
    strictRowKey: true,
    rowTone: 'added',
    columns: [
      { key: 'title', tone: 'changed', multiline: true },
      { key: 'status' },
    ],
    records: [{ id: 0, title: 'Wrapped', status: 'open' }],
  });
  var columns = vtableHost.buildColumns(model);
  assert.strictEqual(typeof columns[0].style, 'function');
  var style = columns[0].style({
    col: 0,
    row: 1,
    table: {
      getRecordByCell: function() { return model.records[0]; },
    },
  });
  assert.strictEqual(style.autoWrapText, true);
  assert.strictEqual(style.lineClamp, 2);
  assert.notStrictEqual(style.bgColor, '#ffffff');

  var target = vtableHost.resolveFocusTarget(model, { rowKey: 0, columnKey: 'title' });
  assert.deepStrictEqual(target, {
    rowKey: '0',
    recordIndex: 0,
    row: 1,
    columnKey: 'title',
    columnIndex: 0,
    col: 0,
    edit: false,
  });
  assert.strictEqual(vtableHost.resolveFocusTarget(model, 'missing'), null);

  var calls = [];
  assert.strictEqual(vtableHost.scrollToFocus({
    scrollToCell: function(position) { calls.push(['cell', position]); },
  }, target), true);
  assert.deepStrictEqual(calls, [['cell', { row: 1, col: 0 }]]);
}

function testReadOnlyDiffTableAdapter() {
  var rows = diffModel.buildImportDiffRows([
    {
      module_name: 'billing',
      title: 'Changed',
      preconditions: 'ready',
      steps: 'run',
      expected: 'done',
      priority: 'P0',
    },
  ], [
    {
      module: 'billing',
      title: 'changed',
      precondition: 'ready',
      steps: 'run',
      expected: 'done',
      priority: 'P1',
    },
  ]);
  var adapter = diffTableAdapter.create({
    id: 'case-library-import-diff-test',
    mode: 'import',
    records: rows,
  });

  assert.strictEqual(adapter.rowKeyPolicy, 'strict');
  assert.strictEqual(adapter.records, rows);
  assert.strictEqual(adapter.onCellChange, undefined);
  assert.strictEqual(adapter.columns.some(function(column) { return column.editable === true; }), false);
  assert.deepStrictEqual(adapter.columns.map(function(column) { return column.key; }), [
    'sequence',
    'type',
    'module',
    'title',
    'priority',
    'precondition',
    'steps',
    'expected',
  ]);

  var model = contract.buildTableModel(adapter);
  assert.strictEqual(model.records[0].__rowKey, rows[0].key);
  assert.strictEqual(model.records[0].__rowTone, 'changed');
  assert.strictEqual(model.records[0].type, '有差异');
  assert.strictEqual(model.records[0].precondition, 'ready');
  assert.strictEqual(model.records[0].priority, '导入：P0\n库中：P1');
  assert.strictEqual(model.records[0].__cellMeta.priority.tone, 'changed');
  assert.strictEqual(model.records[0].__cellMeta.priority.multiline, true);
  assert.strictEqual(model.records[0].__cellMeta.priority.tooltip, '导入：P0\n库中：P1');

  var appendAdapter = diffTableAdapter.create({
    mode: 'append_overwrite',
    records: [],
  });
  assert.strictEqual(appendAdapter.columns.some(function(column) {
    return column.key === 'remark';
  }), true);
}

testLegacyTextKeyAndDedupeSemantics();
testImportDiffSemanticsAndImmutability();
testAppendOverwriteSemanticsAndAliases();
testStrictStableKeysAndCellMetadata();
testNormalizedSemanticWindow();
testVTableToneAndStableFocusResolution();
testReadOnlyDiffTableAdapter();
console.log('case library diff model tests passed');
