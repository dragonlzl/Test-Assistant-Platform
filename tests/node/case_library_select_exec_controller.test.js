const assert = require('assert');
const controllerFactory = require('../../scripts/modules/caseLibrary/caseLibrarySelectExecController.js');

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
      return name === 'data-select-page-action' ? action : null;
    },
    closest: function(selector) {
      return selector === '[data-select-page-action]' ? this : null;
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
    { id: 101, project_id: 1, version_id: 11, file_name_clean: 'Alpha', association_count: 2 },
    { id: 102, project_id: 1, version_id: 12, file_name_clean: 'Beta', association_count: 0 },
    { id: 103, project_id: 1, version_id: 11, file_name_clean: 'Gamma', association_count: 1 },
  ];
}

function testControllerLifecycle() {
  var hostEl = createElement();
  var searchEl = createElement();
  var selectAllEl = createElement();
  var batchButtonEl = createElement();
  var paginationTopEl = createElement();
  var paginationBottomEl = createElement();
  var harness = createTableHostHarness();
  var actions = [];
  var snapshots = [];
  var controller = controllerFactory.create({
    hostEl: hostEl,
    searchInputEl: searchEl,
    selectAllEl: selectAllEl,
    batchButtonEl: batchButtonEl,
    paginationTopEl: paginationTopEl,
    paginationBottomEl: paginationBottomEl,
    tableHost: harness.api,
    pageSize: 2,
    onAssociation: function(file) { actions.push(['association', file.id]); },
    onExec: function(file) { actions.push(['exec', file.id]); },
    onAssociationToggle: function(file, enabled) { actions.push(['toggle', file.id, enabled]); },
    onStateChange: function(state) { snapshots.push(state); },
  });

  assert.strictEqual(harness.latest().adapter.emptyText, '请选择项目后自动刷新。');
  assert.strictEqual(searchEl.listenerCount('input'), 1);
  assert.strictEqual(selectAllEl.listenerCount('change'), 1);
  controller.setLoading({ projectId: 1 });
  assert.strictEqual(harness.latest().adapter.emptyText, '加载中...');
  controller.setData(files(), {
    projectId: 1,
    projectNameById: { 1: '项目一' },
    versionNameByProject: { 1: { 11: 'v1', 12: 'v2' } },
    validVersionIds: [11, 12],
    execSets: [{ case_file_id: 101, active_users: ['甲'] }],
  });
  assert.strictEqual(controller.getState().total, 3);
  assert.strictEqual(controller.getState().totalPages, 2);
  assert.deepStrictEqual(controller.getRows().map(function(row) { return row.id; }), [101, 102]);
  assert.ok(paginationTopEl.innerHTML.indexOf('显示 1-2 / 3 条') !== -1);

  harness.latest().adapter.onCellChange({
    column: harness.latest().adapter.columns[0],
    record: controller.getRows()[0],
    value: true,
  });
  assert.deepStrictEqual(controller.getSelectedFiles().map(function(file) { return file.id; }), [101]);
  assert.strictEqual(batchButtonEl.disabled, false);
  selectAllEl.checked = true;
  selectAllEl.dispatch('change', { target: selectAllEl });
  assert.deepStrictEqual(controller.getSelectedFiles().map(function(file) { return file.id; }), [101, 102]);

  paginationTopEl.dispatch('click', { target: createPageTarget('next') });
  assert.deepStrictEqual(controller.getRows().map(function(row) { return row.id; }), [103]);
  assert.strictEqual(selectAllEl.checked, false);

  controller.setVersion(11);
  assert.deepStrictEqual(controller.getRows().map(function(row) { return row.id; }), [101, 103]);
  searchEl.value = 'beta';
  searchEl.dispatch('input', { target: searchEl });
  assert.strictEqual(controller.getState().versionId, null);
  assert.deepStrictEqual(controller.getRows().map(function(row) { return row.id; }), [102]);
  searchEl.value = '';
  searchEl.dispatch('input', { target: searchEl });
  assert.strictEqual(controller.getState().versionId, 11);

  var row101 = controller.getAllRows()[0];
  harness.latest().adapter.onCellChange({
    column: harness.latest().adapter.columns[9],
    record: row101,
    value: false,
  });
  assert.deepStrictEqual(controller.getAssociationDecision(101), {
    associationEnabled: false,
    requiresConfirmation: true,
  });
  harness.latest().adapter.onAction({ action: 'association', record: row101 });
  harness.latest().adapter.onAction({ action: 'exec', record: controller.getAllRows()[1] });
  assert.deepStrictEqual(actions, [
    ['toggle', 101, false],
    ['association', 101],
    ['exec', 102],
  ]);

  controller.updateAssociationCount(102, 3);
  assert.deepStrictEqual(controller.getAssociationDecision(102), {
    associationEnabled: false,
    requiresConfirmation: true,
  });
  controller.setProcessing(true);
  assert.strictEqual(batchButtonEl.disabled, true);
  controller.clearSelection();
  assert.strictEqual(controller.getSelectedFiles().length, 0);
  controller.resize();
  assert.strictEqual(harness.latest().resizeCalls, 1);
  assert.ok(snapshots.length > 0);
  controller.destroy();
  assert.strictEqual(searchEl.listenerCount('input'), 0);
  assert.strictEqual(selectAllEl.listenerCount('change'), 0);
  assert.strictEqual(harness.latest().destroyed, true);
}

testControllerLifecycle();
console.log('case library select exec controller tests passed');
