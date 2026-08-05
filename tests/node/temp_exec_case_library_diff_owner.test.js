const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ownerFactory = require('../../scripts/core/tempExecCaseLibraryDiffOwner.js');

function createClassList(initial) {
  const values = new Set(initial || []);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    toggle(value, force) {
      if (force === true) values.add(value);
      else if (force === false) values.delete(value);
      else if (values.has(value)) values.delete(value);
      else values.add(value);
    },
    contains(value) { return values.has(value); },
  };
}

function verifyPureRules() {
  assert.strictEqual(ownerFactory.normalizeDiffKind(' UPDATED '), 'updated');
  assert.strictEqual(ownerFactory.normalizeDiffKind('unknown'), '');
  assert.strictEqual(ownerFactory.normalizeCaseLibDiffItemId({ case_item_id: 12 }), '12');
  assert.strictEqual(ownerFactory.normalizeCaseLibDiffItemId({ caseItemId: 13 }), '13');
  const file = {
    cases: [
      { caseItemId: 10 },
      { case_item_id: 11 },
      { caseItemSourceId: 12 },
      { case_item_source_id: 13 },
    ],
  };
  assert.strictEqual(ownerFactory.findTempExecCaseIndexByItemId(file, 12), 2);
  assert.strictEqual(ownerFactory.findTempExecCaseIndexByItemId(file, '13'), 3);
  assert.strictEqual(ownerFactory.findTempExecCaseIndexByItemId(file, 99), -1);
}

function verifyViewWorkflow() {
  const changesButton = { disabled: false, classList: createClassList() };
  const caseTabs = { innerHTML: '' };
  const caseName = { textContent: '' };
  const status = {};
  const pills = ['appended', 'added', 'updated', 'deleted'].reduce((result, key) => {
    result[key] = { textContent: '', classList: createClassList() };
    return result;
  }, {});
  const store = {
    byExecSetId: {
      '7': {
        hasNewDiff: true,
        shouldAutoPopup: false,
        everChanged: true,
        summary: { added: 1 },
        diff: [{ kind: 'added', case_item_id: 70 }],
      },
    },
    filterByExecSetId: {},
  };
  let selected = '';
  let opened = 0;
  let tablePayload = null;
  const drawerElement = {
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    removeEventListener(type) { delete this.listeners[type]; },
  };
  const state = {
    activeTab: 'tempexec',
    tempExecActiveId: '7',
    tempExecFiles: [{ id: '7', execSetId: 7, name: '登录执行', cases: [{ caseItemId: 70 }] }],
  };
  const owner = ownerFactory.create({
    state,
    window: {
      app: {
        drawer: {
          createDrawer() {
            return { element: drawerElement, open() { opened += 1; } };
          },
        },
      },
    },
    dom: {
      changesButton,
      status,
      appendedPill: pills.appended,
      addedPill: pills.added,
      updatedPill: pills.updated,
      deletedPill: pills.deleted,
      caseName,
      caseTabs,
      tableHost: {},
    },
    controllerFactory: {
      create() {
        return {
          setData(meta, options) {
            tablePayload = { meta, options };
            return { summary: { appended: 0, added: 1, updated: 0, deleted: 0 } };
          },
          setLoading() {},
          destroy() {},
        };
      },
    },
    caseLibrarySyncApi: {
      ensureTempExecCaseLibraryDiffState() { return store; },
      hasUnackedCaseLibraryDiff(meta) { return Boolean(meta && meta.hasNewDiff); },
      listTempExecCaseLibraryDiffExecSetIds() { return ['7']; },
      getTempExecFileNameByExecSetId() { return '登录执行'; },
      setTempExecCaseLibraryDiffSelectedExecSetId(value) { selected = String(value || ''); },
      getTempExecCaseLibraryDiffSelectedExecSetId() { return selected; },
      hasCaseLibraryChangeSignal(meta) { return Boolean(meta && meta.diff && meta.diff.length); },
      tryAutoOpenTempExecRestoreDiff() { return false; },
      isTempExecTabActive() { return true; },
      maybeOpenTempExecCaseLibraryAutoPopup() { return false; },
      hasTempExecCaseLibraryAutoPopupSeen() { return false; },
    },
    getTempExecFile(id) {
      return state.tempExecFiles.find((file) => String(file.id) === String(id)) || null;
    },
    isDbMode() { return true; },
    getApiClient() { return null; },
    setStatus(element, text, tone) {
      element.text = text;
      element.tone = tone;
    },
  });

  owner.syncTempExecCaseLibraryChangesButton(state.tempExecFiles[0]);
  assert.strictEqual(changesButton.disabled, false);
  assert.strictEqual(changesButton.classList.contains('has-new'), true);
  assert.strictEqual(owner.openTempExecCaseLibraryDiffDrawer({ manual: true, execSetId: '7' }), true);
  assert.strictEqual(opened, 1);
  assert.strictEqual(selected, '7');
  assert.strictEqual(caseName.textContent, '登录执行');
  assert.ok(caseTabs.innerHTML.indexOf('data-case-lib-diff-exec-set="7"') !== -1);
  assert.strictEqual(pills.added.textContent, '新增 1');
  assert.strictEqual(tablePayload.options.execSetId, '7');
  assert.ok(status.text.indexOf('已同步用例变更到执行页') !== -1);
  owner.destroy();
  assert.deepStrictEqual(drawerElement.listeners, {});
}

function verifyOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const coreSource = fs.readFileSync(path.join(root, 'scripts/core/tempexecCore.js'), 'utf8');
  const ownerSource = fs.readFileSync(path.join(root, 'scripts/core/tempExecCaseLibraryDiffOwner.js'), 'utf8');
  assert.ok(coreSource.indexOf('caseLibraryDiffOwner.create') !== -1);
  assert.ok(coreSource.indexOf('function renderTempExecCaseLibraryDiff(') === -1);
  assert.ok(coreSource.indexOf('function locateTempExecCaseFromDiff(') === -1);
  assert.ok(coreSource.indexOf('function ensureTempExecCaseLibraryDiffDrawer(') === -1);
  assert.ok(coreSource.split('\n').length < 2550, 'tempexecCore.js should keep shrinking');
  assert.ok(ownerSource.indexOf('syncExecSetCaseLibrary') !== -1);
  assert.ok(ownerSource.indexOf('data-case-lib-diff-filter') !== -1);

  const entries = [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ];
  entries.forEach((entry) => {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const syncIndex = html.indexOf('tempExecCaseLibrarySyncOwner.js');
    const ownerIndex = html.indexOf('tempExecCaseLibraryDiffOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(syncIndex >= 0, entry + ' is missing the sync owner');
    assert.ok(ownerIndex >= 0, entry + ' is missing the diff owner');
    assert.ok(syncIndex < ownerIndex && ownerIndex < coreIndex, entry + ' has invalid diff owner order');
  });
}

verifyPureRules();
verifyViewWorkflow();
verifyOwnershipAndEntryOrder();
console.log('temp exec case library diff owner tests passed');
