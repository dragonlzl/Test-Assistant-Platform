const assert = require('assert');
const fs = require('fs');
const path = require('path');
const aiGenModelOwner = require('../../scripts/modules/caseLibrary/caseLibraryAiGenModel.js');
const diffModel = require('../../scripts/modules/caseLibrary/caseLibraryDiffModel.js');
const aiGenStoreOwner = require('../../scripts/modules/caseLibrary/caseLibraryAiGenStore.js');

const projectRoot = path.resolve(__dirname, '../..');

function createMemoryStorage() {
  const values = Object.create(null);
  return {
    getItem: function(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    setItem: function(key, value) { values[key] = String(value); },
    removeItem: function(key) { delete values[key]; },
  };
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n').trim();
}

function buildCaseKey(item) {
  return [item.module, item.title, item.precondition, item.steps, item.expected]
    .map(normalizeText)
    .join('::')
    .toLowerCase();
}

function testModelContract() {
  let nextKey = 0;
  const model = aiGenModelOwner.create({
    normalizeText: normalizeText,
    normalizePriority: function(value) { return normalizeText(value).toUpperCase(); },
    buildCaseKey: buildCaseKey,
    hashText: function(value) { return 'hash:' + value; },
    stripCodeFence: function(value) { return normalizeText(value).replace(/^```json\s*/i, '').replace(/```$/, ''); },
    createAiKey: function() { nextKey += 1; return 'ai-' + nextKey; },
  });

  const hostState = {};
  const aiState = model.ensureState(hostState);
  assert.strictEqual(hostState.aiGen, aiState);
  assert.ok(aiState.selection instanceof Set);
  assert.deepStrictEqual(aiState.modules, []);

  assert.deepStrictEqual(model.buildModuleList([
    { module: ' Login ' },
    { module: 'login' },
    { module: 'Billing' },
    { module: '' },
  ]), ['Login', 'Billing']);
  assert.deepStrictEqual(model.buildCasePayload([{
    module: ' Login ',
    title: ' Success ',
    priority: 'p1',
    precondition: ' Ready ',
    steps: ' Submit ',
    expected: ' Home ',
    remark: ' Note ',
  }]), [{
    module: 'Login',
    title: 'Success',
    priority: 'P1',
    precondition: 'Ready',
    steps: 'Submit',
    expected: 'Home',
    remark: 'Note',
  }]);
  assert.strictEqual(model.resolveCoverageThreshold('49'), 50);
  assert.strictEqual(model.resolveCoverageThreshold('101'), 100);
  assert.strictEqual(model.resolveCoverageThreshold('bad'), 90);
  assert.strictEqual(model.resolveGenerationMode({ settings: { casePageGenerationMode: ' enhanced ' } }), 'enhanced');
  assert.ok(model.buildSignature(7, 'requirement', ['Login'], {
    settings: { casePageGenerationMode: 'enhanced' },
    requirementSupplement: 'extra',
  }).indexOf('hash:7|requirement|Login|') === 0);

  const parsed = model.parseResult(JSON.stringify({
    missing_modules: [{
      module: 'Billing',
      coverage: 35,
      cases: [{ title: 'Pay', steps: ['Open', 'Submit'], expected: 'Paid' }],
    }],
    existing_modules: [{
      module: 'Login',
      coverage: 80,
      cases: [{ title: 'Success', priority: 'p2', preconditions: ['Ready'], steps: 'Submit', expected: 'Home' }],
    }],
  }));
  assert.strictEqual(parsed.modules.length, 2);
  assert.strictEqual(parsed.modules[0].missing, true);
  assert.strictEqual(parsed.modules[0].cases[0].steps, 'Open\nSubmit');
  assert.strictEqual(parsed.modules[1].cases[0].priority, 'P2');
  assert.strictEqual(parsed.modules[0].cases[0].__aiKey, 'ai-1');
  assert.ok(parsed.modules[0].cases[0].__aiCaseKey);

  const stats = model.buildResultStats({
    modules: parsed.modules,
    ai_dedupe: { beforeCount: 4, removedCount: 2 },
  });
  assert.deepStrictEqual(stats, { generatedCount: 4, dedupeCount: 2 });
  aiState.modules = parsed.modules;
  aiState.resultGeneratedCount = stats.generatedCount;
  aiState.resultDedupeCount = stats.dedupeCount;
  assert.strictEqual(model.formatCompleteStatus(aiState), '生成完成：生成 4 条，去重 2 条');

  const selection = model.buildSelection(parsed.modules);
  assert.strictEqual(selection.size, 2);
  assert.strictEqual(model.collectSelectedCases(parsed.modules, selection).length, 2);
  const appendedKey = parsed.modules[0].cases[0].__aiCaseKey;
  model.applyAppendMap(parsed.modules, { [appendedKey]: true });
  assert.strictEqual(parsed.modules[0].cases[0].__aiAppended, true);
  assert.strictEqual(model.countSelectableCases(parsed.modules), 1);
}

function testStoreContract() {
  const storage = createMemoryStorage();
  let userId = 'user-1';
  let clock = 100;
  const state = {};
  const store = aiGenStoreOwner.create({
    state: state,
    storage: storage,
    getCurrentUserId: function() { return userId; },
    now: function() { clock += 1; return clock; },
  });

  store.updateBadgeRecord(12, { result_token: 'result-1' });
  assert.strictEqual(store.hasNavBadge(), true);
  store.markNavBadgesRead();
  assert.strictEqual(store.hasNavBadge(), false);
  assert.strictEqual(store.shouldShowEditBadge(12), true);
  store.markEditBadgeRead(12);
  assert.strictEqual(store.shouldShowEditBadge(12), false);

  store.resetAppendRecord(12, 'result-1');
  store.markAppendKeys(12, 'result-1', ['a', 'b']);
  assert.deepStrictEqual(store.getAppendMap(12, 'result-1'), { a: true, b: true });
  assert.deepStrictEqual(store.getAppendMap(12, 'other'), {});

  const restoredState = {};
  const restored = aiGenStoreOwner.create({
    state: restoredState,
    storage: storage,
    getCurrentUserId: function() { return userId; },
    now: function() { return 200; },
  });
  assert.strictEqual(restored.getBadgeRecord(12, false).result_token, 'result-1');
  assert.deepStrictEqual(restored.getAppendMap(12, 'result-1'), { a: true, b: true });

  userId = 'user-2';
  assert.strictEqual(store.getBadgeRecord(12, false), null);
  assert.deepStrictEqual(store.getAppendMap(12, 'result-1'), {});
}

function testConfigurableStoreContract() {
  const storage = createMemoryStorage();
  const state = {};
  const store = aiGenStoreOwner.create({
    state: state,
    storage: storage,
    getCurrentUserId: function() { return 'exec-user'; },
    now: function() { return 300; },
    badgeStorageKey: 'exec-badges',
    appendStorageKey: 'exec-appended',
    badgeStateKey: 'tempExecAiGenBadge',
    appendStateKey: 'tempExecAiGenAppend',
    badgeTokenKeys: [
      'result_token',
      'ai_read_token',
      'focus_read_token',
      'assign_entry_read_token',
      'assign_item_read_token',
    ],
  });

  store.updateBadgeRecord(42, {
    result_token: 'result-42',
    focus_read_token: '',
    assign_entry_read_token: '',
  });
  assert.strictEqual(state.tempExecAiGenBadge.user_id, 'exec-user');
  assert.strictEqual(store.shouldShowBadge(42, 'focus_read_token'), true);
  assert.strictEqual(store.hasUnreadBadges('assign_entry_read_token'), true);
  assert.strictEqual(store.markBadgeRead(42, 'focus_read_token'), true);
  assert.strictEqual(store.shouldShowBadge(42, 'focus_read_token'), false);
  assert.strictEqual(store.markAllBadgesRead('assign_entry_read_token'), true);
  assert.strictEqual(store.hasUnreadBadges('assign_entry_read_token'), false);
  assert.ok(storage.getItem('exec-badges'));

  store.resetAppendRecord(42, 'result-42');
  store.markAppendKeys(42, 'result-42', ['case-key']);
  assert.deepStrictEqual(store.getAppendMap(42, 'result-42'), { 'case-key': true });
  assert.strictEqual(state.tempExecAiGenAppend.user_id, 'exec-user');
  assert.ok(storage.getItem('exec-appended'));
}

function testTempExecCompatibility() {
  let nextKey = 0;
  function normalizeExecText(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map(normalizeExecText).filter(Boolean).join('\n');
    return String(value).replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').trim();
  }
  const model = aiGenModelOwner.create({
    normalizeText: normalizeExecText,
    normalizePriority: function(value) {
      const text = value === null || value === undefined ? '' : String(value).trim();
      return text && (text.charAt(0) === 'p' || text.charAt(0) === 'P') ? 'P' + text.slice(1) : text;
    },
    buildCaseKey: diffModel.buildCaseItemKey,
    hashText: function(value) { return 'exec:' + String(value || '').length; },
    createAiKey: function() { nextKey += 1; return 'exec-ai-' + nextKey; },
  });

  assert.deepStrictEqual(model.buildCasePayload([{
    module: '\u200bLogin',
    title: 'Success',
    priority: 'p1',
    preconditions: ['Ready', 'Signed out'],
    steps: ['Open', 'Submit'],
    expected: 'Home',
  }]), [{
    module: 'Login',
    title: 'Success',
    priority: 'P1',
    precondition: 'Ready\nSigned out',
    steps: 'Open\nSubmit',
    expected: 'Home',
    remark: '',
  }]);

  const parsed = model.parseResult(JSON.stringify({
    modules: [{
      module: 'Login',
      missing: false,
      cases: [{ title: 'Success', priority: 'p1', preconditions: ['Ready'], expected: 'Home' }],
    }],
    ai_dedupe: { beforeCount: 2, removedCount: 1 },
    removed_cases: [{ title: 'Duplicate' }],
  }));
  assert.strictEqual(parsed.modules[0].cases[0].precondition, 'Ready');
  assert.strictEqual(parsed.modules[0].cases[0].priority, 'P1');
  assert.deepStrictEqual(parsed.ai_dedupe, { beforeCount: 2, removedCount: 1 });
  assert.strictEqual(parsed.removed_cases.length, 1);
  assert.deepStrictEqual(model.buildResultStats(parsed), { generatedCount: 2, dedupeCount: 1 });
  assert.strictEqual(model.formatResultStats({ resultGeneratedCount: 2, resultDedupeCount: 1 }), '生成 2 条，去重 1 条');
}

function testTempExecOwnership() {
  const tempExecSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');
  const tempExecAiGenControllerSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecAiGenController.js'), 'utf8');
  const casePageAiGenTaskRunnerSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/casePageAiGenTaskRunner.js'),
    'utf8'
  );
  const runtimeSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/appRuntime.js'), 'utf8');
  [
    'buildTempExecAiGenCaseKey',
    'buildTempExecAiGenModuleList',
    'buildTempExecAiGenCasePayload',
    'buildTempExecAiGenSignature',
    'normalizeTempExecAiGenCase',
    'applyTempExecAiGenAppendMap',
    'countTempExecAiGenModuleCases',
    'normalizeTempExecAiGenCount',
    'formatTempExecAiGenCompleteStatus',
  ].forEach(function(name) {
    assert.ok(tempExecSource.indexOf('function ' + name + '(') === -1, name + ' should remain owned by the shared model');
  });
  assert.doesNotMatch(tempExecSource, /tempExecAiGenModelOwner\.create\(\{/);
  assert.doesNotMatch(tempExecSource, /tempExecAiGenStoreOwner\.create\(\{/);
  assert.doesNotMatch(tempExecSource, /tempExecAiGenModel\.buildCasePayload\(currentFile\.cases/);
  assert.match(tempExecAiGenControllerSource, /tempExecAiGenModelOwner\.create\(\{/);
  assert.match(tempExecAiGenControllerSource, /tempExecAiGenStoreOwner\.create\(\{/);
  assert.doesNotMatch(tempExecAiGenControllerSource, /tempExecAiGenModel\.buildCasePayload\(currentFile\.cases/);
  assert.doesNotMatch(tempExecAiGenControllerSource, /buildXmindEnhancedPipelineRequest/);
  assert.match(tempExecAiGenControllerSource, /tempExecAiGenTaskRunner\.prepare\(\{/);
  assert.match(casePageAiGenTaskRunnerSource, /aiGenModel\.buildCasePayload\(items\)/);
  assert.match(casePageAiGenTaskRunnerSource, /function resolveManagedResult\(task, context\)/);
  assert.match(tempExecSource, /tempExecAiGenControllerOwner\.create\(\{/);
  assert.match(runtimeSource, /caseLibraryAiGenModelOwner: window\.app && window\.app\.caseLibrary/);
  assert.match(runtimeSource, /caseLibraryAiGenStoreOwner: window\.app && window\.app\.caseLibrary/);
  assert.match(runtimeSource, /caseLibraryDiffModel: window\.app && window\.app\.caseLibrary/);
  [
    'readTempExecAiGenBadgePersistedState',
    'writeTempExecAiGenBadgePersistedState',
    'ensureTempExecAiGenAppendState',
    'getTempExecAiGenAppendRecord',
  ].forEach(function(name) {
    assert.ok(tempExecSource.indexOf('function ' + name + '(') === -1, name + ' should remain owned by the shared store');
  });

  [
    'index.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'admin.html',
    'settings.html',
  ].forEach(function(page) {
    const source = fs.readFileSync(path.join(projectRoot, page), 'utf8');
    const appIndex = source.indexOf('./scripts/modules/app.js');
    const diffIndex = source.indexOf('./scripts/modules/caseLibrary/caseLibraryDiffModel.js');
    const modelIndex = source.indexOf('./scripts/modules/caseLibrary/caseLibraryAiGenModel.js');
    const storeIndex = source.indexOf('./scripts/modules/caseLibrary/caseLibraryAiGenStore.js');
    const taskRunnerIndex = source.indexOf('./scripts/modules/casePageAiGenTaskRunner.js');
    assert.ok(diffIndex >= 0 && diffIndex < appIndex, page + ' should load the diff model before app init');
    assert.ok(modelIndex >= 0 && modelIndex < appIndex, page + ' should load the AI model before app init');
    assert.ok(storeIndex >= 0 && storeIndex < appIndex, page + ' should load the AI store before app init');
    assert.ok(taskRunnerIndex >= 0 && taskRunnerIndex < appIndex, page + ' should load the AI task runner before app init');
  });
}

testModelContract();
testStoreContract();
testConfigurableStoreContract();
testTempExecCompatibility();
testTempExecOwnership();
console.log('case library AI generation owner tests passed');
