const assert = require('assert');
const listControllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryAssociationListController.js');
const candidateControllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryAssociationCandidateController.js');
const itemControllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryAssociationItemController.js');

function createClassList() {
  var values = Object.create(null);
  return {
    add: function(name) { values[name] = true; },
    remove: function(name) { delete values[name]; },
    toggle: function(name, force) {
      var next = force === undefined ? !values[name] : force === true;
      if (next) values[name] = true;
      else delete values[name];
      return next;
    },
    contains: function(name) { return values[name] === true; },
  };
}

function createElement(attributes) {
  var attrs = Object.assign({}, attributes || {});
  var listeners = Object.create(null);
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    checked: false,
    indeterminate: false,
    disabled: false,
    classList: createClassList(),
    setAttribute: function(name, value) { attrs[name] = String(value); },
    getAttribute: function(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    addEventListener: function(type, listener) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener);
    },
    removeEventListener: function(type, listener) {
      listeners[type] = (listeners[type] || []).filter(function(item) { return item !== listener; });
    },
    dispatch: function(type, event) {
      (listeners[type] || []).slice().forEach(function(listener) {
        listener(event || { target: this, currentTarget: this });
      }, this);
    },
    listenerCount: function(type) { return (listeners[type] || []).length; },
  };
}

function createPageTarget(action) {
  return {
    getAttribute: function(name) {
      return name === 'data-association-page-action' ? String(action || '') : '';
    },
    closest: function(selector) {
      return selector === '[data-association-page-action]' && action ? this : null;
    },
  };
}

function createTableHostHarness() {
  var mounts = [];
  return {
    mounts: mounts,
    latest: function() { return mounts[mounts.length - 1]; },
    api: {
      mount: function(hostEl, adapter, options) {
        var entry = {
          hostEl: hostEl,
          adapter: adapter,
          options: options,
          records: adapter.records.slice(),
          resizeCalls: 0,
          destroyed: false,
        };
        entry.controller = {
          setRecords: function(records) {
            entry.records = records.slice();
            return records.length;
          },
          resize: function() { entry.resizeCalls += 1; },
          destroy: function() { entry.destroyed = true; },
        };
        mounts.push(entry);
        return entry.controller;
      },
    },
  };
}

function associationSource() {
  return [
    {
      id: 31,
      main_case_file_id: 10,
      sub_case_file_id: 20,
      sub_case_file_name: '副用例 A',
      selected_case_item_ids: [201, 203],
    },
    {
      id: 32,
      main_case_file_id: 10,
      sub_case_file_id: 21,
      sub_case_file_name: '副用例 B',
      selected_case_item_ids: [211],
    },
  ];
}

function candidateSource() {
  return [
    { id: 20, project_id: 1, version_id: 11, file_name_clean: 'Alpha', item_count: 3 },
    { id: 21, project_id: 1, version_id: 11, file_name_clean: 'beta', item_count: 2 },
    {
      id: 22,
      project_id: 1,
      version_id: 11,
      file_name_clean: 'Forbidden',
      item_count: 1,
      association_forbidden: true,
      forbidden_reason: '已关联到当前主用例',
    },
  ];
}

function itemSource() {
  return [
    { id: 3, case_file_id: 20, module: 'M1', title: 'T3', steps: 'S3', expected: 'E3' },
    { id: 1, case_file_id: 20, module: 'M1', title: 'T1', steps: 'S1', expected: 'E1' },
    { id: 5, case_file_id: 20, module: 'M2', title: 'T5', steps: 'S5', expected: 'E5' },
    { id: 2, case_file_id: 20, module: 'M2', title: 'T2', steps: 'S2', expected: 'E2' },
    { id: 4, case_file_id: 20, module: 'M3', title: 'T4', steps: 'S4', expected: 'E4' },
  ];
}

function testListControllerLifecycle() {
  var hostEl = createElement();
  var harness = createTableHostHarness();
  var actions = [];
  var controller = listControllerFactory.create({
    hostEl: hostEl,
    tableHost: harness.api,
    onEdit: function(record) { actions.push(['edit', record.rowKey]); },
    onDelete: function(record) { actions.push(['delete', record.rowKey]); },
  });

  assert.strictEqual(harness.mounts.length, 1);
  assert.strictEqual(harness.latest().adapter.emptyText, '请选择主用例后查看关联');
  assert.strictEqual(controller.getState().phase, 'initial');
  controller.setLoading({ mainCaseFileId: 10 });
  assert.strictEqual(harness.latest().adapter.emptyText, '加载中...');
  assert.strictEqual(controller.getState().loading, true);
  controller.setData(associationSource(), { mainCaseFileId: 10 });
  assert.deepStrictEqual(controller.getRows().map(function(row) { return row.rowKey; }), [
    'association:10:31',
    'association:10:32',
  ]);
  assert.deepStrictEqual(harness.latest().records.map(function(row) { return row.selectedCount; }), [2, 1]);
  harness.latest().adapter.onAction({ action: 'edit', record: harness.latest().records[0] });
  harness.latest().adapter.onAction({ action: 'delete', record: harness.latest().records[1] });
  assert.deepStrictEqual(actions, [
    ['edit', 'association:10:31'],
    ['delete', 'association:10:32'],
  ]);
  controller.resize();
  assert.strictEqual(harness.latest().resizeCalls, 1);
  controller.destroy();
  assert.strictEqual(harness.latest().destroyed, true);
}

function testCandidateControllerSearchRadioAndCleanup() {
  var hostEl = createElement();
  var searchEl = createElement();
  var harness = createTableHostHarness();
  var selected = [];
  var controller = candidateControllerFactory.create({
    hostEl: hostEl,
    searchInputEl: searchEl,
    tableHost: harness.api,
    onSelect: function(record) { selected.push(record.rowKey); },
  });

  assert.strictEqual(harness.latest().adapter.emptyText, '请先选择版本并查询');
  assert.strictEqual(searchEl.listenerCount('input'), 1);
  controller.setLoading({ mainCaseFileId: 10 });
  assert.strictEqual(harness.latest().adapter.emptyText, '加载中...');
  controller.setData(candidateSource(), { mainCaseFileId: 10, selectedCandidateId: 20 });
  assert.strictEqual(controller.getState().total, 3);
  assert.strictEqual(controller.getState().selectedCandidateId, 20);
  assert.deepStrictEqual(harness.latest().records.map(function(row) { return row.selected; }), [true, false, false]);

  searchEl.value = ' BETA ';
  searchEl.dispatch('input', { target: searchEl });
  assert.strictEqual(controller.getState().filteredTotal, 1);
  assert.deepStrictEqual(harness.latest().records.map(function(row) { return row.rowKey; }), [
    'association-candidate:10:21',
  ]);
  controller.setSearch('');
  assert.strictEqual(controller.getState().filteredTotal, 3);

  var candidateAdapter = harness.latest().adapter;
  candidateAdapter.onCellChange({
    column: candidateAdapter.columns[0],
    record: controller.getRows()[1],
    value: true,
  });
  assert.strictEqual(controller.getState().selectedCandidateId, 21);
  assert.deepStrictEqual(harness.latest().records.map(function(row) { return row.selected; }), [false, true, false]);
  assert.deepStrictEqual(selected, ['association-candidate:10:21']);

  candidateAdapter.onCellChange({
    column: candidateAdapter.columns[0],
    record: controller.getRows()[2],
    value: true,
  });
  assert.strictEqual(controller.getState().selectedCandidateId, 21);
  assert.deepStrictEqual(selected, ['association-candidate:10:21']);
  assert.strictEqual(candidateAdapter.columns[0].disabled(controller.getRows()[2]), true);

  controller.destroy();
  assert.strictEqual(harness.latest().destroyed, true);
  assert.strictEqual(searchEl.listenerCount('input'), 0);
}

function testItemControllerPageSelectionAndCleanup() {
  var hostEl = createElement();
  var selectAllEl = createElement();
  var paginationTop = createElement();
  var paginationBottom = createElement();
  var harness = createTableHostHarness();
  var payloads = [];
  var controller = itemControllerFactory.create({
    hostEl: hostEl,
    selectAllEl: selectAllEl,
    paginationTopEl: paginationTop,
    paginationBottomEl: paginationBottom,
    tableHost: harness.api,
    pageSize: 2,
    onSelectionChange: function(ids) { payloads.push(ids.slice()); },
  });

  assert.strictEqual(harness.latest().adapter.emptyText, '请先在上一步选择副用例');
  assert.strictEqual(selectAllEl.listenerCount('change'), 1);
  assert.strictEqual(paginationTop.listenerCount('click'), 1);
  controller.setLoading({ subCaseFileId: 20 });
  assert.strictEqual(harness.latest().adapter.emptyText, '加载用例中...');
  controller.setData(itemSource(), { subCaseFileId: 20, selectedItemIds: [5, 2] });
  assert.deepStrictEqual(controller.getSelectedItemIds(), [5, 2]);
  assert.deepStrictEqual(controller.getPageRecords().map(function(row) { return row.id; }), [3, 1]);
  assert.strictEqual(selectAllEl.checked, false);

  var itemAdapter = harness.latest().adapter;
  itemAdapter.onCellChange({
    column: itemAdapter.columns[0],
    record: controller.getPageRecords()[0],
    value: true,
  });
  assert.deepStrictEqual(controller.getSelectedItemIds(), [3, 5, 2]);
  assert.deepStrictEqual(payloads[payloads.length - 1], [3, 5, 2]);

  selectAllEl.checked = true;
  selectAllEl.dispatch('change', { target: selectAllEl });
  assert.deepStrictEqual(controller.getSelectedItemIds(), [3, 1, 5, 2]);
  paginationTop.dispatch('click', { target: createPageTarget('next') });
  assert.strictEqual(controller.getState().pageIndex, 1);
  assert.deepStrictEqual(controller.getPageRecords().map(function(row) { return row.id; }), [5, 2]);
  assert.strictEqual(selectAllEl.checked, true);

  selectAllEl.checked = false;
  selectAllEl.dispatch('change', { target: selectAllEl });
  assert.deepStrictEqual(controller.getSelectedItemIds(), [3, 1]);
  assert.deepStrictEqual(payloads[payloads.length - 1], [3, 1]);
  controller.setPageSize(3);
  assert.strictEqual(controller.getState().pageIndex, 0);
  assert.strictEqual(controller.getState().pageSize, 3);
  assert.deepStrictEqual(controller.getPageRecords().map(function(row) { return row.id; }), [3, 1, 5]);
  assert.strictEqual(selectAllEl.indeterminate, true);

  controller.destroy();
  assert.strictEqual(harness.latest().destroyed, true);
  assert.strictEqual(selectAllEl.listenerCount('change'), 0);
  assert.strictEqual(paginationTop.listenerCount('click'), 0);
  assert.strictEqual(paginationBottom.listenerCount('click'), 0);
}

testListControllerLifecycle();
testCandidateControllerSearchRadioAndCleanup();
testItemControllerPageSelectionAndCleanup();
console.log('case library association controller tests passed');
