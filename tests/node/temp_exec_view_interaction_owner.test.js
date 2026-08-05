const assert = require('assert');
const owner = require('../../scripts/modules/tempExecViewInteractionOwner');

function createView() {
  const listeners = {};
  const counts = {};
  return {
    listeners,
    counts,
    addEventListener(name, listener) {
      listeners[name] = listener;
      counts[name] = (counts[name] || 0) + 1;
    },
    removeEventListener(name, listener) {
      if (listeners[name] === listener) delete listeners[name];
    },
  };
}

function createTarget(selector, dataset, extras) {
  const target = Object.assign({
    dataset: dataset || {},
    value: '',
    checked: false,
    textContent: '',
    innerText: '',
    closest(requested) { return requested === selector ? target : null; },
  }, extras || {});
  return target;
}

assert.deepStrictEqual(owner.parseIndexList('0,2,nope,4'), [0, 2, 4]);
assert.strictEqual(owner.normalizeEditableText({
  dataset: { tempEditField: 'priority' },
  innerText: ' p1\n',
}, true), 'P1');

const view = createView();
const calls = {
  search: 0,
  remove: 0,
  render: 0,
  mark: 0,
  clear: 0,
  schedule: 0,
  edit: [],
};
const state = {};
const reuseOpen = new Set();
const interaction = owner.create({
  viewElement: view,
  state,
  document: {},
  window: {},
  api: {
    renderTempExecView() { calls.render += 1; },
    applyTempExecSearch() { calls.search += 1; },
    removeTempExecCase() { calls.remove += 1; },
    ensureTempExecReuseOpen() { return reuseOpen; },
    updateTempExecCaseField(...args) { calls.edit.push(args); },
  },
  reuseLifecycle: {
    markManualToggle() { calls.mark += 1; },
    clearPlaceholders() { calls.clear += 1; },
    schedulePanelHeightRecord() { calls.schedule += 1; },
  },
});

assert.strictEqual(interaction.init(), true);
assert.strictEqual(interaction.init(), false);
assert.deepStrictEqual(Object.keys(view.listeners).sort(), ['change', 'click', 'focusin', 'focusout', 'input', 'keydown']);
assert.strictEqual(view.counts.keydown, 1);

let prevented = 0;
const searchTarget = createTarget('', { tempSearchInput: 'file-1' }, { value: 'smoke' });
view.listeners.keydown({ target: searchTarget, key: 'Enter', preventDefault() { prevented += 1; } });
assert.strictEqual(calls.search, 1);
assert.strictEqual(prevented, 1);

const removeTarget = createTarget('[data-temp-case-remove]', {
  tempCaseRemove: 'file-1',
  index: '2',
}, {
  getBoundingClientRect() {
    return { left: 1, top: 2, width: 3, height: 4, bottom: 6 };
  },
});
view.listeners.click({ target: removeTarget });
assert.strictEqual(calls.remove, 1);

const toggleAllTarget = createTarget('[data-temp-reuse-toggle-all]', {
  tempReuseToggleAll: 'file-1',
  tempVisible: '0,2',
  tempExpanded: '0',
});
view.listeners.click({ target: toggleAllTarget });
assert.deepStrictEqual(Array.from(reuseOpen), [0, 2]);
assert.strictEqual(state.tempExecReuseBatchExpanded['file-1'], true);
assert.strictEqual(state.tempExecPreserveScrollOnce, true);
assert.strictEqual(calls.mark, 1);
assert.strictEqual(calls.clear, 1);
assert.strictEqual(calls.schedule, 1);
assert.strictEqual(calls.render, 1);

const editTarget = createTarget('', {
  tempEditField: 'priority',
  tempEditFile: 'file-1',
  tempEditIndex: '3',
}, { innerText: 'p1' });
view.listeners.focusin({ target: editTarget });
editTarget.innerText = 'p2';
view.listeners.focusout({ target: editTarget });
assert.deepStrictEqual(calls.edit, [['file-1', 3, 'priority', 'P2']]);

interaction.destroy();
assert.strictEqual(interaction.isBound(), false);
assert.deepStrictEqual(Object.keys(view.listeners), []);

console.log('temp exec view interaction owner tests passed');
