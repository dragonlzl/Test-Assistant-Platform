const assert = require('assert');
const diffController = require('../../scripts/modules/caseLibrary/caseLibraryDiffController.js');

function createHostElement() {
  var attributes = Object.create(null);
  return {
    setAttribute: function(name, value) { attributes[name] = String(value); },
    removeAttribute: function(name) { delete attributes[name]; },
    getAttribute: function(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
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
          focusCalls: [],
          setRecordsCalls: [],
          destroyed: false,
          failNextFocus: false,
        };
        entry.controller = {
          focus: function(target) {
            entry.focusCalls.push(target);
            if (target && target.clear === true) return true;
            if (entry.failNextFocus) {
              entry.failNextFocus = false;
              return false;
            }
            return true;
          },
          setRecords: function(records) {
            entry.setRecordsCalls.push(records.slice());
            return records.length;
          },
          destroy: function() { entry.destroyed = true; },
        };
        mounts.push(entry);
        return entry.controller;
      },
    },
  };
}

function importPayload() {
  return {
    mode: 'import',
    importItems: [
      {
        module: 'account',
        title: 'Added',
        precondition: '',
        steps: 'create',
        expected: 'created',
        priority: 'P2',
      },
      {
        module: 'billing',
        title: 'Changed',
        precondition: 'ready',
        steps: 'run',
        expected: 'done',
        priority: 'P0',
      },
      {
        module: 'common',
        title: 'Same',
        precondition: 'ready',
        steps: 'open',
        expected: 'opened',
        priority: 'P2',
      },
    ],
    dbItems: [
      {
        module: 'archive',
        title: 'Removed',
        precondition: '',
        steps: 'delete',
        expected: 'deleted',
        priority: 'P1',
      },
      {
        module: 'billing',
        title: 'changed',
        precondition: 'ready',
        steps: 'run',
        expected: 'done',
        priority: 'P1',
      },
      {
        module: 'common',
        title: 'Same',
        precondition: 'ready',
        steps: 'open',
        expected: 'opened',
        priority: 'P2',
      },
    ],
  };
}

function appendPayload() {
  return {
    mode: 'append_overwrite',
    importItems: [
      {
        module: 'billing',
        title: 'Changed',
        precondition: 'ready',
        steps: 'run',
        expected: 'done',
        priority: 'P0',
        remark: 'new',
      },
    ],
    dbItems: [
      {
        module: 'billing',
        title: 'changed',
        precondition: 'ready',
        steps: 'run',
        expected: 'done',
        priority: 'P1',
        remark: 'old',
      },
    ],
  };
}

function hasColumn(adapter, key) {
  return adapter.columns.some(function(column) { return column.key === key; });
}

function testSummaryAndFocusContract() {
  assert.deepStrictEqual(diffController.summarize([
    { type: 'added' },
    { type: 'removed' },
    { type: 'changed' },
    { type: 'same' },
  ]), {
    added: 1,
    removed: 1,
    changed: 1,
    same: 1,
    different: 3,
    total: 4,
  });

  var hostEl = createHostElement();
  var harness = createTableHostHarness();
  var controller = diffController.create({ hostEl: hostEl, tableHost: harness.api });
  controller.setData(importPayload());
  var differences = controller.getRows().filter(function(row) { return row.type !== 'same'; });
  var table = harness.mounts[0];

  assert.deepStrictEqual(table.focusCalls, [{ clear: true }]);
  assert.strictEqual(controller.focusAt(-100), true);
  assert.deepStrictEqual(table.focusCalls[1], {
    rowKey: differences[0].key,
    columnKey: 'type',
  });
  assert.strictEqual(controller.getLocateIndex(), 0);
  assert.strictEqual(hostEl.getAttribute('data-active-row-key'), differences[0].key);

  table.failNextFocus = true;
  assert.strictEqual(controller.focusAt(999), false);
  assert.strictEqual(controller.getLocateIndex(), 0);
  assert.strictEqual(hostEl.getAttribute('data-active-row-key'), differences[0].key);

  assert.strictEqual(controller.focusAt(999), true);
  assert.strictEqual(controller.getLocateIndex(), differences.length - 1);
  assert.strictEqual(hostEl.getAttribute('data-active-row-key'), differences[differences.length - 1].key);

  controller.setData(importPayload());
  assert.strictEqual(controller.getLocateIndex(), -1);
  assert.strictEqual(hostEl.getAttribute('data-active-row-key'), null);
  assert.deepStrictEqual(table.focusCalls[table.focusCalls.length - 1], { clear: true });
}

function testModeAndEmptyTextLifecycle() {
  var hostEl = createHostElement();
  var harness = createTableHostHarness();
  var controller = diffController.create({ hostEl: hostEl, tableHost: harness.api });

  controller.setData(importPayload());
  assert.strictEqual(harness.mounts.length, 1);
  assert.strictEqual(harness.mounts[0].adapter.emptyText, '暂无差异数据');
  assert.strictEqual(hasColumn(harness.mounts[0].adapter, 'remark'), false);

  controller.setLoading('import');
  assert.strictEqual(harness.mounts.length, 2);
  assert.strictEqual(harness.mounts[0].destroyed, true);
  assert.strictEqual(harness.mounts[1].adapter.emptyText, '加载中...');
  assert.deepStrictEqual(harness.mounts[1].focusCalls, [{ clear: true }]);

  controller.setData(importPayload());
  assert.strictEqual(harness.mounts.length, 3);
  assert.strictEqual(harness.mounts[1].destroyed, true);
  assert.strictEqual(harness.mounts[2].adapter.emptyText, '暂无差异数据');

  controller.setData(appendPayload());
  assert.strictEqual(harness.mounts.length, 4);
  assert.strictEqual(harness.mounts[2].destroyed, true);
  assert.strictEqual(hasColumn(harness.mounts[3].adapter, 'remark'), true);

  controller.setData(importPayload());
  assert.strictEqual(harness.mounts.length, 5);
  assert.strictEqual(harness.mounts[3].destroyed, true);
  assert.strictEqual(hasColumn(harness.mounts[4].adapter, 'remark'), false);

  controller.setData(importPayload());
  assert.strictEqual(harness.mounts.length, 5);
  assert.strictEqual(harness.mounts[4].setRecordsCalls.length, 1);
  assert.deepStrictEqual(
    harness.mounts[4].focusCalls[harness.mounts[4].focusCalls.length - 1],
    { clear: true }
  );
}

testSummaryAndFocusContract();
testModeAndEmptyTextLifecycle();
console.log('case library diff controller tests passed');
