const assert = require('assert');
const aiGenModelOwner = require('../../scripts/modules/caseLibrary/caseLibraryAiGenModel.js');
const aiGenStoreOwner = require('../../scripts/modules/caseLibrary/caseLibraryAiGenStore.js');

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

testModelContract();
testStoreContract();
console.log('case library AI generation owner tests passed');
