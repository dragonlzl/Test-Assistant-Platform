const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ownerFactory = require('../../scripts/core/tempExecMissingReminderOwner.js');
const viewOwnerFactory = require('../../scripts/core/tempExecMissingReminderViewOwner.js');

function createHarness(overrides) {
  const state = {
    settings: {
      missingCaseReminderPlacement: 'bottom',
      missingCaseReminderMatchConfig: { type: true, module: true },
      missingCaseReminderAiEnabled: 'off',
    },
    assignments: {},
    tempExecActiveId: 'file-a',
    tempExecFiles: [{
      id: 'file-a',
      projectId: 'project-a',
      cases: [{
        module: '登录',
        title: '登录失败',
        priority: 'P0',
        preconditions: '账号已注册',
        steps: '输入错误密码',
        expected: '提示失败',
      }],
    }],
  };
  const modules = [{ id: 1, name: '登录', item_count: 1 }];
  const types = [{ id: 10, name: '失败' }];
  const items = [{
    id: 100,
    type_ids: [10],
    title: '错误密码登录',
    priority: 'P1',
    precondition: '账号已注册',
    steps: '输入错误密码',
    expected: '提示失败',
  }];
  const calls = { renders: 0, toasts: [] };
  const apiClient = {
    listMissingModules() { return Promise.resolve(modules); },
    listMissingTypes() { return Promise.resolve(types); },
    listMissingModuleItems() { return Promise.resolve(items); },
  };
  const options = Object.assign({
    state,
    window: { app: { config: { defaultPrompts: { missingreminder: 'prompt' } } } },
    document: { documentElement: { clientHeight: 800 } },
    stringifyCaseField(value) {
      return value === null || value === undefined ? '' : String(value);
    },
    buildMissingReminderKeywords(value) {
      return String(value || '').toLowerCase().split(/\s+/).filter(Boolean);
    },
    normalizeMissingReminderMatchConfig(value, fallback) {
      const base = fallback || { type: true, module: true };
      const source = value && typeof value === 'object' ? value : {};
      return {
        type: source.type === false ? false : base.type !== false,
        module: source.module === false ? false : base.module !== false,
      };
    },
    escapeHtml(value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    getApiClient() { return apiClient; },
    getTempExecFile(fileId) {
      return state.tempExecFiles.find((file) => file.id === fileId) || null;
    },
    missingReminderViewOwner: viewOwnerFactory,
    renderTempExecView() { calls.renders += 1; },
    appUtils: {
      showCenterToast(message, level) { calls.toasts.push([message, level]); },
      stripCodeFence(value) { return String(value || '').trim(); },
      extractJsonPayload() { return ''; },
    },
  }, overrides || {});
  return { state, modules, types, items, calls, apiClient, owner: ownerFactory.create(options) };
}

function verifyPureContracts() {
  const harness = createHarness();
  const owner = harness.owner;
  const reminder = owner.ensureTempExecMissingReminderState();
  assert.strictEqual(reminder.limit, 10);
  assert.strictEqual(owner.resolveMissingReminderPlacement(), 'bottom');
  assert.deepStrictEqual(owner.resolveMissingReminderMatchConfig(), { type: true, module: true });
  assert.strictEqual(owner.resolveMissingReminderAiEnabled(), 'off');

  const context = owner.buildTempExecAiCaseContext(harness.state.tempExecFiles[0].cases);
  assert.strictEqual(context.entries.length, 1);
  assert.strictEqual(context.entries[0].module, '登录');
  assert.match(context.searchText, /登录失败/);

  const fields = owner.buildTempExecReminderFieldTextMap(harness.state.tempExecFiles[0].cases);
  const score = owner.buildTempExecReminderScore({
    title: '登录失败',
    precondition: '账号已注册',
    steps: '错误密码',
    expected: '提示失败',
  }, fields);
  assert.strictEqual(score, 4);
  assert.strictEqual(owner.resolveTempExecMissingReminderScoreLevel(score), '高');
  assert.deepStrictEqual(owner.normalizeMissingReminderTypeIds([10, '10', 0, null, 11]), [10, 11]);
  assert.strictEqual(owner.formatTempExecMissingTypeLabel({
    type_ids: [10, 11],
    type_names: ['失败', '异常'],
  }), '失败、异常');
  assert.strictEqual(owner.resolveTempExecMissingReminderLibraryEmpty([]), true);
  assert.strictEqual(owner.resolveTempExecMissingReminderLibraryEmpty([{ item_count: 0 }]), true);
  assert.strictEqual(owner.resolveTempExecMissingReminderLibraryEmpty([{ item_count: 1 }]), false);

  reminder.items = [{
    module_name: '登录',
    type_ids: [10],
    type_names: ['失败'],
    title: '<失败>',
    priority: 'P1',
    match_score: 3,
  }];
  reminder.matchedModules = ['登录'];
  reminder.matchedTypes = ['失败'];
  reminder.hasMatch = true;
  const html = owner.buildTempExecMissingReminderTable(reminder);
  assert.match(html, /易漏用例参考/);
  assert.match(html, /&lt;失败&gt;/);
  assert.match(html, /模块：登录/);
  assert.deepStrictEqual(owner.parseTempExecMissingReminderAiIds('{"ids":[1,"2",1]}'), ['1', '2', '1']);
}

async function verifyLibraryRefreshAndLoad() {
  const harness = createHarness();
  const owner = harness.owner;
  owner.refreshTempExecMissingReminder();
  await new Promise((resolve) => setImmediate(resolve));
  const reminder = owner.ensureTempExecMissingReminderState();
  assert.strictEqual(reminder.hasMatch, true);
  assert.strictEqual(reminder.pending, true);
  assert.deepStrictEqual(reminder.matchedModules, ['登录']);
  assert.deepStrictEqual(reminder.matchedTypes, ['失败']);

  owner.loadTempExecMissingReminderItems();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(reminder.loading, false);
  assert.strictEqual(reminder.loaded, true);
  assert.strictEqual(reminder.items.length, 1);
  assert.strictEqual(reminder.items[0].module_name, '登录');
  assert.strictEqual(reminder.items[0].type_name, '失败');

  const candidates = await owner.fetchTempExecMissingReminderAiCandidates('project-a', '登录 失败');
  assert.strictEqual(candidates.items.length, 1);
  assert.deepStrictEqual(candidates.matchedModules, ['登录']);
  assert.deepStrictEqual(candidates.matchedTypes, ['失败']);
  assert.strictEqual(candidates.libraryEmpty, false);
}

function verifyAiContextAndTaskState() {
  let task = null;
  const manager = {
    getTask() { return task; },
    clearTask() { task = null; },
  };
  const harness = createHarness({
    window: {
      app: {
        missingReminderAi: manager,
        config: { defaultPrompts: { missingreminder: 'prompt' } },
      },
    },
  });
  harness.state.settings.missingCaseReminderAiEnabled = 'on';
  const owner = harness.owner;
  const reminder = owner.ensureTempExecMissingReminderState();
  assert.strictEqual(owner.syncTempExecMissingReminderAiContext(reminder), true);
  assert.match(reminder.aiContextSignature, /^project-a:/);

  task = {
    scene: 'temp-exec',
    status: 'done',
    contextSignature: reminder.aiContextSignature,
    projectId: 'project-a',
    resultIds: ['1'],
    itemMap: { 1: { title: 'AI 推荐用例' } },
    matchedModules: ['登录'],
    matchedTypes: ['失败'],
    libraryEmpty: false,
  };
  assert.strictEqual(owner.syncTempExecMissingReminderAiTaskState(reminder), true);
  assert.strictEqual(reminder.aiGenerated, true);
  assert.strictEqual(reminder.aiItems[0].title, 'AI 推荐用例');
  assert.strictEqual(owner.hasTempExecMissingReminderAiGenerated(reminder), true);

  owner.clearTempExecMissingReminderAi(reminder);
  assert.strictEqual(reminder.aiGenerated, false);
  assert.strictEqual(reminder.aiContextReady, false);
}

function verifyOwnershipAndLoadOrder() {
  const projectRoot = path.join(__dirname, '..', '..');
  const parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempexecCore.js'), 'utf8');
  const ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecMissingReminderOwner.js'), 'utf8');
  const viewSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecMissingReminderViewOwner.js'), 'utf8');
  assert.match(ownerSource, /function ensureTempExecMissingReminderState\(/);
  assert.match(ownerSource, /function refreshTempExecMissingReminder\(/);
  assert.match(ownerSource, /function runTempExecMissingReminderAiRecommend\(/);
  assert.doesNotMatch(parentSource, /function ensureTempExecMissingReminderState\(/);
  assert.doesNotMatch(parentSource, /function refreshTempExecMissingReminder\(/);
  assert.doesNotMatch(parentSource, /function runTempExecMissingReminderAiRecommend\(/);
  assert.match(parentSource, /missingReminderOwner\.create\(\{/);
  assert.match(parentSource, /missingReminderViewOwner: missingReminderViewOwner/);
  assert.doesNotMatch(ownerSource, /function buildTable\(/);
  assert.match(viewSource, /function buildTable\(/);
  assert.match(viewSource, /function renderRegion\(/);

  ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html',
    'case-library.html', 'index.html', 'settings.html'].forEach((fileName) => {
    const html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    const viewOwnerIndex = html.indexOf('tempExecMissingReminderViewOwner.js');
    const ownerIndex = html.indexOf('tempExecMissingReminderOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(viewOwnerIndex >= 0, fileName + ' must load the missing reminder view owner');
    assert.ok(ownerIndex > viewOwnerIndex, fileName + ' must load reminder view before reminder orchestration');
    assert.ok(ownerIndex >= 0, fileName + ' must load the missing reminder owner');
    assert.ok(coreIndex > ownerIndex, fileName + ' must load reminder owner before tempexecCore');
  });
}

async function run() {
  verifyPureContracts();
  await verifyLibraryRefreshAndLoad();
  verifyAiContextAndTaskState();
  verifyOwnershipAndLoadOrder();
  console.log('temp exec missing reminder owner tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
