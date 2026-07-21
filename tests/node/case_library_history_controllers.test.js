const assert = require('assert');
const queryControllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryHistoryQueryController.js');
const detailControllerFactory = require('../../scripts/modules/caseLibrary/caseLibraryHistoryDetailController.js');

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

function createPageTarget(action, pageValue) {
  var attrs = {
    'data-history-page-action': action || '',
    'data-history-page-value': pageValue === undefined ? '' : String(pageValue),
  };
  return {
    getAttribute: function(name) { return attrs[name] || ''; },
    closest: function(selector) {
      return selector === '[data-history-page-action]' && action ? this : null;
    },
  };
}

function createTableHostHarness() {
  var mounts = [];
  return {
    mounts: mounts,
    api: {
      mount: function(hostEl, adapter, options) {
        var entry = {
          hostEl: hostEl,
          adapter: adapter,
          options: options,
          records: adapter.records.slice(),
          setRecordsCalls: [],
          resizeCalls: 0,
          destroyed: false,
        };
        entry.controller = {
          setRecords: function(records) {
            entry.records = records.slice();
            entry.setRecordsCalls.push(records.slice());
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

function querySource() {
  return [
    { project_id: 1, version_id: 11, case_file_id: 1, file_name_clean: 'Alpha' },
    { project_id: 1, version_id: 11, case_file_id: 2, file_name_clean: 'Beta' },
    { project_id: 1, version_id: 11, case_file_id: 3, file_name_clean: 'Gamma' },
  ];
}

function detailSource() {
  return [
    { id: 1, kind: 'updated', changed_fields: ['title'], old: { title: 'A' }, new: { title: 'B' } },
    { id: 2, kind: 'added', changed_fields: [], old: null, new: { title: 'C' } },
    { id: 3, kind: 'updated', changed_fields: ['steps'], old: { steps: '1' }, new: { steps: '2' } },
  ];
}

function testQueryControllerLifecycleAndCallbacks() {
  var hostEl = createElement();
  var searchEl = createElement();
  var paginationTop = createElement();
  var paginationBottom = createElement();
  var harness = createTableHostHarness();
  var opened = [];
  var states = [];
  var controller = queryControllerFactory.create({
    hostEl: hostEl,
    searchInputEl: searchEl,
    paginationTopEl: paginationTop,
    paginationBottomEl: paginationBottom,
    tableHost: harness.api,
    pageSize: 2,
    onOpen: function(record) { opened.push(record.rowKey); },
    onStateChange: function(state) { states.push(state); },
  });

  assert.strictEqual(harness.mounts.length, 1);
  assert.strictEqual(harness.mounts[0].options.semanticMaxRows, 200);
  assert.strictEqual(harness.mounts[0].adapter.emptyText, '请选择项目与版本后点击查询');
  assert.strictEqual(searchEl.listenerCount('input'), 1);
  assert.strictEqual(paginationTop.listenerCount('click'), 1);
  assert.strictEqual(paginationBottom.listenerCount('click'), 1);

  controller.setLoading();
  assert.strictEqual(harness.mounts.length, 2);
  assert.strictEqual(harness.mounts[0].destroyed, true);
  assert.strictEqual(harness.mounts[1].adapter.emptyText, '加载中...');

  controller.setData(querySource());
  assert.strictEqual(harness.mounts.length, 3);
  assert.strictEqual(harness.mounts[1].destroyed, true);
  assert.deepStrictEqual(harness.mounts[2].records.map(function(row) { return row.fileNameClean; }), [
    'Alpha',
    'Beta',
  ]);
  assert.strictEqual(controller.getState().total, 3);
  assert.strictEqual(controller.getState().filteredTotal, 3);

  searchEl.value = ' beta ';
  searchEl.dispatch('input', { target: searchEl });
  assert.strictEqual(controller.getState().searchText, ' beta ');
  assert.strictEqual(controller.getState().filteredTotal, 1);
  assert.deepStrictEqual(harness.mounts[2].records.map(function(row) { return row.fileNameClean; }), ['Beta']);

  controller.setSearch('');
  paginationTop.dispatch('click', { target: createPageTarget('next') });
  assert.strictEqual(controller.getState().pageIndex, 1);
  assert.deepStrictEqual(harness.mounts[2].records.map(function(row) { return row.fileNameClean; }), ['Gamma']);
  paginationBottom.dispatch('click', { target: createPageTarget('first') });
  assert.strictEqual(controller.getState().pageIndex, 0);

  harness.mounts[2].adapter.onAction({
    action: 'open-history',
    record: harness.mounts[2].records[0],
  });
  assert.deepStrictEqual(opened, ['history-file:1:11:id:1']);
  assert.strictEqual(states.length > 4, true);
  assert.strictEqual(states[states.length - 1].pageIndex, 0);

  controller.setData([]);
  assert.strictEqual(harness.mounts[2].adapter.emptyText, '暂无有改动记录的用例文件');
  assert.deepStrictEqual(harness.mounts[2].records, []);
  controller.reset({ searchText: '保留搜索' });
  assert.strictEqual(harness.mounts.length, 4);
  assert.strictEqual(harness.mounts[2].destroyed, true);
  assert.strictEqual(harness.mounts[3].adapter.emptyText, '请选择项目与版本后点击查询');
  assert.strictEqual(controller.getState().searchText, '保留搜索');
  assert.strictEqual(searchEl.value, '保留搜索');
  assert.strictEqual(controller.getState().total, 0);
  assert.strictEqual(controller.getState().loading, false);
  controller.reset();
  assert.strictEqual(controller.getState().searchText, '');
  assert.strictEqual(searchEl.value, '');

  controller.resize();
  assert.strictEqual(harness.mounts[3].resizeCalls, 1);
  controller.destroy();
  assert.strictEqual(harness.mounts[3].destroyed, true);
  assert.strictEqual(searchEl.listenerCount('input'), 0);
  assert.strictEqual(paginationTop.listenerCount('click'), 0);
  assert.strictEqual(paginationBottom.listenerCount('click'), 0);
}

function testDetailControllerLifecycleFilterPageAndCleanup() {
  var hostEl = createElement();
  var paginationTop = createElement();
  var paginationBottom = createElement();
  var updatedPill = createElement({ 'data-case-lib-history-filter': 'updated' });
  var addedPill = createElement({ 'data-case-lib-history-filter': 'added' });
  var harness = createTableHostHarness();
  var states = [];
  var controller = detailControllerFactory.create({
    hostEl: hostEl,
    filterElements: [updatedPill, addedPill],
    paginationTopEl: paginationTop,
    paginationBottomEl: paginationBottom,
    tableHost: harness.api,
    pageSize: 2,
    onStateChange: function(state) { states.push(state); },
  });

  assert.strictEqual(harness.mounts.length, 1);
  assert.strictEqual(harness.mounts[0].options.semanticMaxRows, 200);
  assert.strictEqual(harness.mounts[0].options.frozenColCount, 1);
  assert.strictEqual(updatedPill.listenerCount('click'), 1);
  controller.setLoading({ fileNameClean: '登录', pageIndex: 3 });
  assert.strictEqual(harness.mounts.length, 2);
  assert.strictEqual(harness.mounts[1].adapter.emptyText, '加载中...');
  assert.strictEqual(controller.getState().pageIndex, 3);
  controller.setLoading({ fileNameClean: '登录' });
  assert.strictEqual(controller.getState().pageIndex, 0);
  controller.setLoading({ fileNameClean: '登录', pageIndex: 3 });
  assert.strictEqual(controller.getState().pageIndex, 3);

  controller.setData(detailSource(), { fileNameClean: '登录', pageIndex: 1 });
  assert.strictEqual(harness.mounts.length, 3);
  assert.strictEqual(controller.getState().pageIndex, 1);
  assert.deepStrictEqual(harness.mounts[2].records.map(function(row) { return row.rowKey; }), [
    'history-event:3',
  ]);
  controller.setData(detailSource(), { fileNameClean: '登录' });
  assert.strictEqual(controller.getState().pageIndex, 0);
  assert.deepStrictEqual(harness.mounts[2].records.map(function(row) { return row.rowKey; }), [
    'history-event:1',
    'history-event:2',
  ]);
  assert.strictEqual(updatedPill.textContent, '改动 2');
  assert.strictEqual(addedPill.textContent, '新增 1');

  updatedPill.dispatch('click', { currentTarget: updatedPill, target: updatedPill });
  assert.strictEqual(controller.getState().filter, 'updated');
  assert.strictEqual(controller.getState().filteredTotal, 2);
  assert.strictEqual(updatedPill.classList.contains('active'), true);
  assert.deepStrictEqual(harness.mounts[2].records.map(function(row) { return row.rowKey; }), [
    'history-event:1',
    'history-event:3',
  ]);
  updatedPill.dispatch('click', { currentTarget: updatedPill, target: updatedPill });
  assert.strictEqual(controller.getState().filter, '');

  paginationTop.dispatch('click', { target: createPageTarget('next') });
  assert.strictEqual(controller.getState().pageIndex, 1);
  assert.deepStrictEqual(harness.mounts[2].records.map(function(row) { return row.rowKey; }), [
    'history-event:3',
  ]);
  controller.setPageSize(3);
  assert.strictEqual(controller.getState().pageIndex, 0);
  assert.strictEqual(controller.getState().pageSize, 3);
  assert.strictEqual(states.length > 4, true);

  controller.resize();
  assert.strictEqual(harness.mounts[2].resizeCalls, 1);
  controller.destroy();
  assert.strictEqual(harness.mounts[2].destroyed, true);
  assert.strictEqual(updatedPill.listenerCount('click'), 0);
  assert.strictEqual(addedPill.listenerCount('click'), 0);
  assert.strictEqual(paginationTop.listenerCount('click'), 0);
  assert.strictEqual(paginationBottom.listenerCount('click'), 0);
}

testQueryControllerLifecycleAndCallbacks();
testDetailControllerLifecycleFilterPageAndCleanup();
console.log('case library history controller tests passed');
