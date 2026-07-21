const assert = require('assert');
const controllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryEditListController.js');

function createElement(attributes) {
  var attrs = Object.assign({}, attributes || {});
  var listeners = Object.create(null);
  return {
    value: '',
    innerHTML: '',
    checked: false,
    indeterminate: false,
    disabled: false,
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
      return name === 'data-edit-list-page-action' ? action : null;
    },
    closest: function(selector) {
      return selector === '[data-edit-list-page-action]' ? this : null;
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
          destroyed: false,
          resizeCalls: 0,
        };
        entry.controller = {
          setRecords: function(records) { entry.records = records.slice(); },
          destroy: function() { entry.destroyed = true; },
          resize: function() { entry.resizeCalls += 1; },
        };
        mounts.push(entry);
        return entry.controller;
      },
    },
  };
}

function files() {
  return [
    { id: 101, project_id: 1, version_id: 11, file_name_clean: 'Alpha', importer_id: 9 },
    { id: 102, project_id: 1, version_id: 12, file_name_clean: 'Beta', importer_id: 10, source: 'share:2' },
    { id: 103, project_id: 1, version_id: 11, file_name_clean: 'Gamma', last_updated_by: 9 },
  ];
}

function testControllerLifecycle() {
  var hostEl = createElement();
  var selectAllEl = createElement();
  var paginationTopEl = createElement();
  var paginationBottomEl = createElement();
  var deleteButtonEl = createElement();
  var exportButtonEl = createElement();
  var changeVersionSelectEl = createElement();
  var changeVersionButtonEl = createElement();
  var harness = createTableHostHarness();
  var actions = [];
  var snapshots = [];
  var selectionSnapshots = [];
  var controller = controllerFactory.create({
    hostEl: hostEl,
    selectAllEl: selectAllEl,
    paginationTopEl: paginationTopEl,
    paginationBottomEl: paginationBottomEl,
    actionButtonEls: [exportButtonEl],
    deleteButtonEl: deleteButtonEl,
    changeVersionSelectEl: changeVersionSelectEl,
    changeVersionButtonEl: changeVersionButtonEl,
    canDelete: function() { return true; },
    tableHost: harness.api,
    pageSize: 2,
    onEdit: function(file) { actions.push(file.id); },
    onStateChange: function(state) { snapshots.push(state); },
    onSelectionChange: function(state) { selectionSnapshots.push(state.selectedIds); },
  });

  assert.strictEqual(harness.latest().adapter.emptyText, '请选择项目后自动刷新。');
  controller.setLoading({ projectId: 1 });
  assert.strictEqual(harness.latest().adapter.emptyText, '加载中...');
  controller.setData(files(), {
    projectId: 1,
    currentUserId: 9,
    projectNameById: { 1: '项目一' },
    versionNameByProject: { 1: { 11: 'v1', 12: 'v2' } },
  });
  assert.strictEqual(controller.getState().total, 3);
  assert.strictEqual(controller.getState().totalPages, 2);
  assert.deepStrictEqual(controller.getPageRows().map(function(row) { return row.id; }), [101, 102]);
  assert.ok(paginationTopEl.innerHTML.indexOf('显示 1-2 / 3 条') !== -1);

  harness.latest().adapter.onCellChange({
    column: harness.latest().adapter.columns[0],
    record: controller.getPageRows()[0],
    value: true,
  });
  assert.deepStrictEqual(controller.getSelectedFiles().map(function(file) { return file.id; }), [101]);
  assert.strictEqual(exportButtonEl.disabled, false);
  assert.strictEqual(deleteButtonEl.disabled, false);
  selectAllEl.checked = true;
  selectAllEl.dispatch('change', { target: selectAllEl });
  assert.deepStrictEqual(controller.getSelectedFiles().map(function(file) { return file.id; }), [101, 102]);
  assert.deepStrictEqual(selectionSnapshots[selectionSnapshots.length - 1], [101, 102]);

  paginationTopEl.dispatch('click', { target: createPageTarget('next') });
  assert.deepStrictEqual(controller.getPageRows().map(function(row) { return row.id; }), [103]);
  assert.strictEqual(selectAllEl.checked, false);

  controller.setOwnerFilter('me', true);
  assert.deepStrictEqual(controller.getVisibleFiles().map(function(file) { return file.id; }), [101, 103]);
  assert.deepStrictEqual(controller.getSelectedFiles().map(function(file) { return file.id; }), [101]);
  controller.setSearch('gamma');
  assert.deepStrictEqual(controller.getVisibleFiles().map(function(file) { return file.id; }), [103]);
  assert.deepStrictEqual(controller.getSelectedFiles(), []);
  controller.setSearch('');
  controller.setVersion(11);
  assert.deepStrictEqual(controller.getVisibleFiles().map(function(file) { return file.id; }), [101, 103]);

  changeVersionSelectEl.value = '12';
  changeVersionSelectEl.disabled = false;
  controller.setSelected(101, true);
  controller.syncControls();
  assert.strictEqual(changeVersionButtonEl.disabled, false);
  harness.latest().adapter.onAction({ action: 'edit', record: controller.getPageRows()[0] });
  assert.deepStrictEqual(actions, [101]);

  controller.setProcessing(true);
  assert.strictEqual(exportButtonEl.disabled, true);
  controller.setProcessing(false);
  controller.resize();
  assert.strictEqual(harness.latest().resizeCalls, 1);
  assert.ok(snapshots.length > 0);
  controller.destroy();
  assert.strictEqual(selectAllEl.listenerCount('change'), 0);
  assert.strictEqual(harness.latest().destroyed, true);
}

testControllerLifecycle();
console.log('case library edit list controller tests passed');
