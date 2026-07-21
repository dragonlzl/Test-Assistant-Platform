const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modelOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingReminderModel.js');
const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingReminderViewAdapter.js');
const controllerOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingReminderController.js');

function createClassList(initial) {
  const values = new Set(initial || []);
  return {
    add: function(value) { values.add(value); },
    remove: function(value) { values.delete(value); },
    contains: function(value) { return values.has(value); },
  };
}

function createTarget() {
  return {
    innerHTML: '',
    classList: createClassList(['hidden']),
    addEventListener: function() {},
  };
}

function createModel() {
  return modelOwner.create({
    stringifyCaseField: function(value) {
      return value === null || value === undefined ? '' : String(value).trim();
    },
    buildCaseSearchText: function(items, fields) {
      return (items || []).map(function(item) {
        return (fields || []).map(function(field) { return item[field] || ''; }).join(' ');
      }).join(' ').trim().toLowerCase();
    },
    buildKeywords: function(value) {
      return String(value || '').toLowerCase().split(/\s+/).filter(Boolean);
    },
    stripCodeFence: function(value) {
      return String(value || '').replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    },
  });
}

function testModelContract() {
  const model = createModel();
  const state = {};
  const reminder = model.ensureState(state);
  assert.strictEqual(state.missingReminder, reminder);
  assert.strictEqual(reminder.limit, 10);
  assert.deepStrictEqual(reminder.aiItems, []);

  assert.deepStrictEqual(model.resolveMatchConfig({ type: false, module: true }), {
    type: false,
    module: true,
  });
  assert.deepStrictEqual(model.resolveMatchConfig({ type: false, module: false }), {
    type: true,
    module: true,
  });

  const cases = [{
    module: '登录',
    title: '密码错误',
    priority: 'P1',
    precondition: '账号存在',
    steps: '输入错误密码',
    expected: '提示失败',
    remark: '安全检查',
  }];
  const searchContext = model.buildSearchContext(cases);
  const aiContext = model.buildAiContext(cases);
  assert.ok(searchContext.searchText.indexOf('安全检查') !== -1);
  assert.strictEqual(aiContext.entries[0].module, '登录');
  assert.ok(aiContext.searchText.indexOf('安全检查') === -1);

  const fieldTextMap = model.buildFieldTextMap(cases);
  assert.strictEqual(model.scoreItem({
    title: '密码',
    precondition: '账号',
    steps: '错误',
    expected: '失败',
  }, fieldTextMap), 4);
  assert.strictEqual(model.resolveScoreLevel(3), '高');
  assert.strictEqual(model.resolveScoreLevel(2), '中');
  assert.strictEqual(model.resolveScoreLevel(1), '低');

  assert.strictEqual(model.isLibraryEmpty([]), true);
  assert.strictEqual(model.isLibraryEmpty([{ id: 1 }]), false);
  assert.strictEqual(model.isLibraryEmpty([{ id: 1, item_count: 0 }]), true);
  assert.strictEqual(model.isLibraryEmpty([{ id: 1, item_count: 2 }]), false);

  const catalogs = model.matchCatalogs(
    [{ id: 1, name: '登录' }, { id: 2, name: '支付' }],
    [{ id: 3, name: '安全' }],
    '登录安全检查'
  );
  assert.deepStrictEqual(catalogs.moduleIds, ['1']);
  assert.deepStrictEqual(catalogs.typeIds, ['3']);
  assert.strictEqual(model.itemMatches(
    { module_id: '1', type_ids: ['9'] },
    catalogs.matchedModuleMap,
    catalogs.matchedTypeMap,
    { module: true, type: true },
    function(values) { return values || []; },
    'all'
  ), false);
  assert.strictEqual(model.itemMatches(
    { module_id: '1', type_ids: ['9'] },
    catalogs.matchedModuleMap,
    catalogs.matchedTypeMap,
    { module: true, type: true },
    function(values) { return values || []; },
    'any'
  ), true);

  const ranked = model.sortAndLimit([
    { title: '无关', expected: '失败' },
    { title: '密码', precondition: '账号', steps: '错误', expected: '失败' },
  ], fieldTextMap, { limit: 1 });
  assert.strictEqual(ranked.length, 1);
  assert.strictEqual(ranked[0].match_score, 4);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(ranked[0], '__score_index'), false);

  const snapshot = model.buildAiCandidateSnapshot(ranked, fieldTextMap, function() { return '安全'; });
  assert.strictEqual(snapshot.map['1'].type, '安全');
  const ids = model.parseAiIds('```json\n{"ids":["1","1","9"]}\n```');
  const selected = model.selectAiItems(ids, snapshot.itemMap);
  assert.strictEqual(selected.length, 1);
  assert.notStrictEqual(selected[0], snapshot.itemMap['1']);
  assert.strictEqual(model.hasAiGenerated({
    aiGenerated: true,
    aiContextSignature: 'same',
    aiSignature: 'same',
  }), true);
}

function testViewContract() {
  const top = createTarget();
  const bottom = createTarget();
  const model = createModel();
  let scrollBindings = 0;
  const view = viewOwner.create({
    top: top,
    bottom: bottom,
    escapeHtml: function(value) { return String(value || ''); },
    formatTypeLabel: function(item) { return item.type_name || '未分类'; },
    buildSummary: model.buildSummary,
    resolveLimit: model.resolveLimit,
    resolveScoreLevel: model.resolveScoreLevel,
    bindScrollHint: function() { scrollBindings += 1; },
  });
  const reminder = model.createDefaultState();
  reminder.hasMatch = true;
  reminder.items = [{
    module_name: '登录',
    type_name: '安全',
    title: '密码错误',
    match_score: 3,
  }];
  const result = view.render(reminder, { aiEnabled: false, placement: 'bottom' });
  assert.strictEqual(result.target, bottom);
  assert.strictEqual(result.visible, true);
  assert.ok(bottom.innerHTML.indexOf('易漏用例参考') !== -1);
  assert.ok(bottom.innerHTML.indexOf('密码错误') !== -1);
  assert.strictEqual(top.classList.contains('hidden'), true);
  assert.strictEqual(scrollBindings, 1);
}

function testControllerContract() {
  const state = {
    editor: {
      caseFile: { project_id: 7 },
      items: [{ module: '登录', title: '密码错误' }],
    },
  };
  const model = createModel();
  const renders = [];
  const listeners = [];
  const controller = controllerOwner.create({
    state: state,
    dom: {
      editCard: { classList: createClassList() },
      missingReminderTop: createTarget(),
      missingReminderBottom: createTarget(),
    },
    model: model,
    view: {
      render: function(reminder, options) {
        renders.push({ reminder: reminder, options: options });
        return { target: null, visible: false };
      },
      resolveTarget: function() { return null; },
      isInView: function() { return false; },
    },
    getSettings: function() { return { missingCaseReminderAiEnabled: 'on' }; },
    eventTarget: {
      addEventListener: function(name) { listeners.push(name); },
      removeEventListener: function() {},
    },
  });
  assert.strictEqual(controller.syncAiContext(), true);
  assert.ok(state.missingReminder.aiContextSignature.indexOf('7:') === 0);
  controller.render();
  assert.strictEqual(renders.length, 1);
  controller.bindEvents();
  controller.bindEvents();
  assert.deepStrictEqual(listeners, [
    'app-settings-loaded',
    'app-settings-updated',
    'missing-reminder-ai-task',
  ]);
}

async function testManagedTaskOwnership() {
  const state = {
    editor: {
      caseFile: { project_id: 7 },
      items: [{
        module: '登录',
        title: '密码错误',
        precondition: '账号存在',
        steps: '输入错误密码',
        expected: '提示失败',
      }],
    },
  };
  const model = createModel();
  const starts = [];
  let directCalls = 0;
  const manager = {
    createTask: function(scene, payload) {
      return Object.assign({ scene: scene, status: 'running' }, payload);
    },
    startTask: function(scene, task) { starts.push({ scene: scene, task: task }); },
  };
  const controller = controllerOwner.create({
    state: state,
    dom: { editCard: { classList: createClassList() } },
    model: model,
    view: {
      render: function() { return { target: null, visible: false }; },
      resolveTarget: function() { return null; },
      isInView: function() { return false; },
    },
    apiClient: {
      listMissingModules: function() {
        return Promise.resolve([{ id: 11, name: '登录', item_count: 1 }]);
      },
      listMissingTypes: function() {
        return Promise.resolve([{ id: 12, name: '错误' }]);
      },
      listMissingModuleItems: function() {
        return Promise.resolve([{
          id: 13,
          title: '密码错误',
          precondition: '账号存在',
          steps: '输入错误密码',
          expected: '提示失败',
          type_ids: ['12'],
        }]);
      },
    },
    getSettings: function() { return { missingCaseReminderAiEnabled: 'on' }; },
    getCore: function() {
      return {
        getAssignedModel: function() { return { id: 'model-1' }; },
        callModelWithConfig: function() {
          directCalls += 1;
          return Promise.resolve('{"ids":["1"]}');
        },
      };
    },
    getManager: function() { return manager; },
    normalizeTypeIds: function(values) { return Array.isArray(values) ? values.map(String) : []; },
    formatTypeLabel: function() { return '错误'; },
  });

  controller.triggerAiRecommend();
  await new Promise(function(resolve) { setTimeout(resolve, 30); });
  assert.strictEqual(starts.length, 1);
  assert.strictEqual(starts[0].scene, 'case-library');
  assert.strictEqual(directCalls, 0);
  assert.deepStrictEqual(Object.keys(starts[0].task.itemMap), ['1']);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const modelSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingReminderModel.js'),
    'utf8'
  );
  const viewSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingReminderViewAdapter.js'),
    'utf8'
  );
  const controllerSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingReminderController.js'),
    'utf8'
  );
  assert.ok(parentSource.indexOf('missingReminderControllerOwner.create') !== -1);
  assert.ok(parentSource.indexOf('function ensureMissingReminderState') === -1);
  assert.ok(parentSource.indexOf('function buildMissingReminderTable') === -1);
  assert.ok(parentSource.indexOf('function runMissingReminderAiRecommend') === -1);
  assert.ok(modelSource.indexOf('document.') === -1);
  assert.ok(modelSource.indexOf('innerHTML') === -1);
  assert.ok(modelSource.indexOf('apiClient') === -1);
  assert.ok(viewSource.indexOf('apiClient') === -1);
  assert.ok(viewSource.indexOf('setTimeout') === -1);
  assert.ok(controllerSource.indexOf('.innerHTML') === -1);
  assert.ok(controllerSource.indexOf('<table') === -1);

  const entries = [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ];
  const scripts = [
    'caseLibraryMissingReminderModel.js',
    'caseLibraryMissingReminderViewAdapter.js',
    'caseLibraryMissingReminderController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing a reminder script');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2] && indexes[2] < indexes[3]);
  });
}

(async function run() {
  testModelContract();
  testViewContract();
  testControllerContract();
  await testManagedTaskOwnership();
  testOwnershipAndEntryOrder();
  console.log('case library missing reminder owner tests passed');
})().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
