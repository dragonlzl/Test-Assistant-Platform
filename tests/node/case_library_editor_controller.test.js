const assert = require('assert');
const controllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryEditorController.js');

function createElement(attributes) {
  var attrs = Object.assign({}, attributes || {});
  var listeners = Object.create(null);
  return {
    innerHTML: '',
    checked: false,
    indeterminate: false,
    disabled: false,
    value: '',
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

function pageTarget(action) {
  return {
    getAttribute: function(name) {
      return name === 'data-case-library-editor-page-action' ? action : null;
    },
    closest: function(selector) {
      return selector === '[data-case-library-editor-page-action]' ? this : null;
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
          focusTargets: [],
          destroyed: false,
        };
        entry.controller = {
          setRecords: function(records) { entry.records = records.slice(); },
          focus: function(target) { entry.focusTargets.push(target); return true; },
          resize: function() {},
          destroy: function() { entry.destroyed = true; },
        };
        mounts.push(entry);
        return entry.controller;
      },
    },
  };
}

function testControllerLifecycle() {
  var hostEl = createElement();
  var selectAllEl = createElement();
  var paginationTopEl = createElement();
  var paginationBottomEl = createElement();
  var harness = createTableHostHarness();
  var fieldChanges = [];
  var actions = [];
  var selections = [];
  var pageChanges = [];
  var controller = controllerFactory.create({
    hostEl: hostEl,
    selectAllEl: selectAllEl,
    paginationTopEl: paginationTopEl,
    paginationBottomEl: paginationBottomEl,
    tableHost: harness.api,
    pageSize: 2,
    onFieldChange: function(index, field, value) { fieldChanges.push([index, field, value]); },
    onAction: function(action, index) { actions.push([action, index]); },
    onSelectionChange: function(indexes) { selections.push(indexes); },
    onPageChange: function(index) { pageChanges.push(index); },
  });

  var source = [
    { id: 1, module: 'A', title: 'A1', expected: 'ok' },
    { id: 2, module: 'B', title: 'B1', expected: 'ok' },
    { id: 3, module: 'C', title: 'C1', expected: 'ok' },
  ];
  controller.setData(source, { caseFileId: 9, selectedIndexes: [1] });
  assert.strictEqual(controller.getState().total, 3);
  assert.strictEqual(controller.getState().totalPages, 2);
  assert.deepStrictEqual(controller.getPageRows().map(function(row) { return row.sourceIndex; }), [0, 1]);
  assert.strictEqual(selectAllEl.indeterminate, true);
  assert.ok(paginationTopEl.innerHTML.indexOf('显示 1-2 / 3 条') !== -1);

  harness.latest().adapter.onCellChange({
    column: { key: 'selected' },
    record: controller.getPageRows()[0],
    value: true,
  });
  assert.deepStrictEqual(selections[selections.length - 1], [0, 1]);
  harness.latest().adapter.onCellChange({
    column: { key: 'title' },
    record: controller.getPageRows()[0],
    value: 'A1 updated',
  });
  assert.deepStrictEqual(fieldChanges, [[0, 'title', 'A1 updated']]);
  harness.latest().adapter.onAction({ action: 'insert', record: controller.getPageRows()[0] });
  assert.deepStrictEqual(actions, [['insert', 0]]);

  paginationTopEl.dispatch('click', { target: pageTarget('next') });
  assert.deepStrictEqual(controller.getPageRows().map(function(row) { return row.sourceIndex; }), [2]);
  assert.strictEqual(pageChanges[pageChanges.length - 1], 1);
  controller.setSearch('B1');
  assert.deepStrictEqual(controller.getPageRows().map(function(row) { return row.sourceIndex; }), [1]);
  assert.strictEqual(controller.getState().pageIndex, 0);

  controller.setSearch('');
  controller.setLocatedIndex(2);
  controller.focusSourceIndex(2, 'module', true);
  assert.deepStrictEqual(harness.latest().focusTargets.pop(), {
    rowKey: 'case-library-editor:9:item:3',
    columnKey: 'module',
    edit: true,
  });
  controller.destroy();
  assert.strictEqual(selectAllEl.listenerCount('change'), 0);
  assert.strictEqual(harness.latest().destroyed, true);
}

testControllerLifecycle();
console.log('case library editor controller tests passed');
