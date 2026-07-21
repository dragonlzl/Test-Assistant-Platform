const assert = require('assert');
const fs = require('fs');
const path = require('path');
const owner = require('../../scripts/modules/caseLibrary/caseLibraryXmindModel.js');

function createModel() {
  return owner.create({
    normalizePriority: function(value) { return String(value || '').trim().toUpperCase(); },
    cleanFileName: function(value) { return String(value || '').trim().replace(/\.xmind$/i, ''); },
    buildImportItems: function(items) {
      return (items || []).filter(function(item) { return item.module && item.title && item.expected; });
    },
  });
}

function testCaseNormalizationAndDiff() {
  const model = createModel();
  assert.deepStrictEqual(model.normalizeCase({
    module_name: ' 登录 ',
    case_title: ' 正常登录 ',
    level: 'p1',
    preconditions: ' 已注册 ',
    actions: ' 输入密码 ',
    result: ' 成功 ',
  }), {
    module: '登录',
    title: '正常登录',
    priority: 'p1',
    precondition: '已注册',
    preconditions: '已注册',
    steps: '输入密码',
    expected: '成功',
  });

  const diff = model.buildPatchDiff([
    { id: 1, module: '登录', title: '成功', priority: 'P1', precondition: '', steps: '旧步骤', expected: '完成' },
    { id: 2, module: '登录', title: '失败', priority: 'P1', precondition: '', steps: '错误密码', expected: '拒绝' },
    { id: 3, module: '支付', title: '取消', priority: 'P2', precondition: '', steps: '取消', expected: '关闭' },
  ], [
    { module: '登录', title: '成功', priority: 'P2', precondition: '', steps: '新步骤', expected: '完成' },
    { module: '登录', title: '失败', priority: 'P1', precondition: '', steps: '错误密码', expected: '拒绝' },
    { module: '搜索', title: '查询', priority: 'P1', precondition: '', steps: '输入', expected: '列表' },
  ]);
  assert.deepStrictEqual(diff.updates, [{
    id: 1,
    payload: {
      module: '登录',
      title: '成功',
      priority: 'P2',
      precondition: '',
      steps: '新步骤',
      expected: '完成',
    },
  }]);
  assert.strictEqual(diff.creates.length, 1);
  assert.strictEqual(diff.creates[0].payload.remark, '');
  assert.deepStrictEqual(diff.deletes, [{ id: 3 }]);
}

function testLocateAndDirectionRules() {
  const model = createModel();
  const items = [
    { module: '登录', title: '成功', priority: 'P1', steps: '登录', expected: '完成' },
    { module: '支付', title: '取消', priority: 'P2', steps: '取消', expected: '关闭' },
    { module: '搜索', title: '查询', priority: 'P1', steps: '输入', expected: '列表' },
  ];
  assert.strictEqual(model.findIndexByPath(['支付', '取消'], items), 1);
  assert.strictEqual(model.findIndexByPath(['不存在'], items), -1);
  assert.strictEqual(model.findIndexByPath(['custom'], items, function() {
    return [['first'], ['custom'], ['last']];
  }), 1);
  assert.strictEqual(model.resolveDirection(items), 'side');
  assert.strictEqual(model.resolveDirection(items.slice(0, 2)), 'right');
  assert.strictEqual(model.resolveRootNodeId({ nodeData: { id: 123 } }), '123');
}

function testWriterSessionMigration() {
  const model = createModel();
  assert.strictEqual(model.getWriterSessionKey(9), 'tap-case-library-writer-xmind-edit-9');
  assert.strictEqual(model.getWriterSessionKey(null), 'tap-case-library-writer-xmind-edit-guest');

  const legacy = model.migrateWriterSessionPayload({
    currentData: { nodeData: { children: [{ topic: '父模块：旧结构' }] } },
  });
  assert.strictEqual(legacy.action, 'remove');

  const source = {
    baseData: { nodeData: { topic: '编写用例' } },
    currentData: { nodeData: { topic: '用例' } },
    history: [{ nodeData: { topic: '其他标题' } }],
  };
  const migrated = model.migrateWriterSessionPayload(source);
  assert.strictEqual(migrated.action, 'update');
  assert.strictEqual(migrated.payload.baseData.nodeData.topic, model.getWriterRootTitle());
  assert.strictEqual(migrated.payload.currentData.nodeData.topic, model.getWriterRootTitle());
  assert.strictEqual(source.baseData.nodeData.topic, '编写用例');
  assert.strictEqual(model.migrateWriterSessionPayload({ currentData: { nodeData: { topic: '自定义' } } }).action, 'none');
}

function testWriterCaseRules() {
  const model = createModel();
  const valid = model.parseWriterTopics(['模块A', '用例A', 'p2', '前提', '步骤', '结果']);
  assert.strictEqual(valid.caseItem.priority, 'P2');
  assert.deepStrictEqual(valid.emptyIndexes, []);
  assert.deepStrictEqual(
    model.parseWriterTopics(['模块A', '', 'P1', '', '步骤', '结果']).emptyIndexes,
    [1, 3]
  );

  const mindData = {
    nodeData: {
      topic: '用例：登录回归.xmind',
      children: [{
        topic: '登录',
        children: [{
          topic: '正常登录',
          children: [{
            topic: 'p1',
            children: [{
              topic: '已注册',
              children: [{ topic: '输入密码', children: [{ topic: '成功' }] }],
            }],
          }],
        }],
      }],
    },
  };
  const cases = model.buildWriterExportCases(mindData);
  assert.strictEqual(cases.length, 1);
  assert.strictEqual(cases[0].priority, 'P1');
  assert.strictEqual(model.deriveWriterExportBaseName(mindData), '登录回归');
  assert.strictEqual(model.deriveWriterImportFileName(cases), '正常登录.xmind');
  assert.strictEqual(model.mapWriterCasesToImportItems(cases).length, 1);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const modelSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryXmindModel.js'),
    'utf8'
  );
  [
    'normalizeXmindCaseLibraryText',
    'normalizeXmindCaseLibraryCase',
    'buildCaseLibraryXmindPatchDiff',
    'resolveCaseLibraryXmindDirection',
    'buildCaseLibraryWriterExportCases',
    'parseCaseLibraryWriterTopics',
    'mapWriterCasesToImportItems',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name), -1, name + ' leaked into the coordinator');
  });
  assert.ok(parentSource.indexOf('xmindModelOwner.create') !== -1);
  assert.strictEqual(modelSource.indexOf('document.'), -1);
  assert.strictEqual(modelSource.indexOf('localStorage'), -1);
  assert.strictEqual(modelSource.indexOf('apiClient'), -1);

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const modelIndex = html.indexOf('caseLibraryXmindModel.js');
    const parentIndex = html.indexOf('scripts/modules/caseLibrary.js');
    assert.ok(modelIndex >= 0, entry + ' is missing the XMind model');
    assert.ok(parentIndex >= 0 && modelIndex < parentIndex, entry + ' has invalid XMind model order');
  });
}

testCaseNormalizationAndDiff();
testLocateAndDirectionRules();
testWriterSessionMigration();
testWriterCaseRules();
testOwnershipAndEntryOrder();
console.log('case library XMind model tests passed');
