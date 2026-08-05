const assert = require('assert');
const owner = require('../../scripts/modules/tempExecProjectAssignmentGridOwner');

function createGrid() {
  const listeners = {};
  const counts = {};
  return {
    listeners,
    counts,
    addEventListener(name, listener) {
      listeners[name] = listener;
      counts[name] = (counts[name] || 0) + 1;
    },
    querySelectorAll() { return []; },
    appendChild() {},
    insertBefore() {},
  };
}

function createTarget(matches) {
  return {
    closest(selector) { return matches[selector] || null; },
  };
}

const detached = owner.create({ state: {}, api: {} });
assert.strictEqual(detached.init(), false);
assert.deepStrictEqual(detached.parseProjectVersionKey('project-1||version||blue'), {
  projectId: 'project-1',
  versionId: 'version||blue',
});

const archivedRow = {
  dataset: { tempArchived: '1', tempFile: 'archived' },
  getBoundingClientRect() { return { top: 0, height: 20 }; },
};
const liveRow = {
  dataset: { tempFile: 'live' },
  getBoundingClientRect() { return { top: 20, height: 20 }; },
};
assert.strictEqual(detached.resolveInsertBeforeFileId({
  querySelectorAll() { return [archivedRow, liveRow]; },
}, 5), 'live');

const grid = createGrid();
const calls = { filter: [], projectMoves: [] };
const controller = owner.create({
  gridElement: grid,
  state: { tempExecFiles: [], projects: [], projectVersionsByProject: {} },
  document: {
    createElement() {
      return {
        className: '',
        classList: { toggle() {}, add() {}, remove() {} },
        dataset: {},
        setAttribute() {},
      };
    },
  },
  window: { app: {} },
  api: {
    setTempExecImportProjectFilter(value) { calls.filter.push(value); },
    reorderTempExecProject(source, target, options) {
      calls.projectMoves.push({ source, target, after: options.after });
    },
  },
});

assert.strictEqual(controller.init(), true);
assert.strictEqual(controller.init(), false);
assert.deepStrictEqual(
  Object.keys(grid.listeners).sort(),
  ['click', 'dragend', 'dragleave', 'dragover', 'dragstart', 'drop']
);
Object.keys(grid.counts).forEach((name) => assert.strictEqual(grid.counts[name], 1));

const filterButton = { dataset: { tempexecImportProjectFilter: 'project-2' } };
grid.listeners.click({
  target: createTarget({ '[data-tempexec-import-project-filter]': filterButton }),
});
assert.deepStrictEqual(calls.filter, ['project-2']);

const sourceProject = {
  dataset: { tempProjectCard: 'project-1' },
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 80 }; },
};
const sourceHeader = { dataset: { tempProjectDrag: 'project-1' } };
const transferred = {};
const dataTransfer = {
  effectAllowed: '',
  setData(type, value) { transferred[type] = value; },
  getData(type) { return transferred[type] || ''; },
  setDragImage() {},
};
grid.listeners.dragstart({
  target: createTarget({
    '[data-temp-project-card]': sourceProject,
    '[data-temp-project-drag]': sourceHeader,
  }),
  dataTransfer,
  clientX: 20,
  clientY: 20,
  preventDefault() {},
});
assert.strictEqual(dataTransfer.effectAllowed, 'move');
assert.strictEqual(transferred['text/temp-project'], 'project-1');

const targetProject = { dataset: { tempProjectCard: 'project-3' } };
grid.listeners.drop({
  target: createTarget({ '[data-temp-project-card]': targetProject }),
  dataTransfer,
  preventDefault() {},
});
assert.deepStrictEqual(calls.projectMoves, [
  { source: 'project-1', target: 'project-3', after: false },
]);

console.log('temp exec project assignment grid owner tests passed');
