const assert = require('assert');
const fs = require('fs');
const path = require('path');

const owner = require('../../scripts/modules/caseLibrary/caseLibraryViewStateStore.js');

function createStorage() {
  const values = {};
  return {
    getItem: function(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    setItem: function(key, value) { values[key] = String(value); },
    removeItem: function(key) { delete values[key]; },
    values,
  };
}

function testStoreContract() {
  const storage = createStorage();
  const store = owner.create({ storage });
  const editor = { user_id: 7, case_file_id: 18 };
  store.editor.write(editor);
  assert.deepStrictEqual(store.editor.read(), editor);
  store.editor.clear();
  assert.strictEqual(store.editor.read(), null);

  storage.setItem(owner.KEYS.missingView, '{invalid');
  assert.strictEqual(store.missingView.read(), null);
  storage.setItem(owner.KEYS.loginSeq, 'login-9');
  assert.strictEqual(store.getCurrentLoginSeq(), 'login-9');

  store.editDrawer.write({ project_id: 3 });
  store.selectDrawer.write({ project_id: 4 });
  assert.strictEqual(store.editDrawer.read().project_id, 3);
  assert.strictEqual(store.selectDrawer.read().project_id, 4);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  assert.ok(parentSource.indexOf('viewStateStoreOwner.create') !== -1);
  assert.ok(parentSource.indexOf("var editorPersistKey = 'tap-case-library-editor'") === -1);
  assert.ok(parentSource.indexOf("var editDrawerPersistKey = 'tap-case-library-edit-drawer'") === -1);

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const storeIndex = html.indexOf('caseLibraryViewStateStore.js');
    const parentIndex = html.indexOf('scripts/modules/caseLibrary.js');
    assert.ok(storeIndex >= 0, entry + ' is missing the view-state store');
    assert.ok(storeIndex < parentIndex, entry + ' loads the store after the coordinator');
  });
}

testStoreContract();
testOwnershipAndEntryOrder();
console.log('case library view state store tests passed');
