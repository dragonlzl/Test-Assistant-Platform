const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modelOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingImportModel.js');
const parserOwner = require('../../scripts/modules/caseLibrary/caseLibraryMissingImportFileParser.js');

function buildItemKey(item) {
  return [
    item && item.module,
    item && item.title,
    item && item.precondition,
    item && item.steps,
    item && item.expected,
  ].map(function(value) { return String(value || '').trim().toLowerCase(); }).join('|');
}

function dedupeItems(items) {
  const seen = {};
  return (items || []).filter(function(item) {
    const key = buildItemKey(item);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function createModel() {
  return modelOwner.create({
    normalizePriorityInput: function(value) {
      const text = String(value || '').trim();
      return text ? text.toUpperCase() : '';
    },
    normalizeDiffText: function(value) {
      return String(value || '').trim().replace(/\s+/g, ' ');
    },
    buildCaseItemKey: buildItemKey,
    dedupeCaseItemsByKey: dedupeItems,
  });
}

function testModelRules() {
  const model = createModel();
  assert.deepStrictEqual(model.normalizeItem({
    module: ' 登录 ',
    title: ' 密码错误 ',
    priority: 'p2',
    preconditions: ' 已注册 ',
    steps: ' 输入错误密码 ',
    expected: ' 提示失败 ',
    remark: null,
  }), {
    module: '登录',
    title: '密码错误',
    expected: '提示失败',
    priority: 'P2',
    precondition: '已注册',
    steps: '输入错误密码',
    remark: null,
  });

  const validHeader = ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果', '备注'];
  assert.deepStrictEqual(model.validateHeaderRow(validHeader), { ok: true, missing: [] });
  assert.deepStrictEqual(model.validateHeaderRow(['模块', '用例标题']), {
    ok: false,
    missing: ['优先级', '前提条件', '操作步骤', '预期结果'],
  });

  assert.deepStrictEqual(model.validateItems([
    { module: '登录', title: '', expected: '' },
    { module: '支付', title: '成功', expected: '完成' },
  ]), [{ index: 0, module: false, title: true, expected: true }]);

  const goodItem = {
    _sourceLine: 3,
    module: ' 登录 ',
    title: ' 密码错误 ',
    priority: 'p1',
    precondition: '账号存在',
    steps: '输入错误密码',
    expected: '提示失败',
  };
  const summary = model.buildParseSummary([
    {
      file: { name: 'one.xmind' },
      result: {
        items: [
          {
            _sourceLine: 2,
            module: '错误层级',
            title: '应过滤',
            expected: '不导入',
          },
          goodItem,
        ],
        structuralErrors: [{ line: 2, depth: 2, segments: ['错误层级', '应过滤'] }],
      },
    },
    { file: { name: 'two.xlsx' }, result: { items: [goodItem], structuralErrors: [] } },
  ]);
  assert.strictEqual(summary.items.length, 1);
  assert.strictEqual(summary.items[0].module, '登录');
  assert.strictEqual(summary.items[0].priority, 'P1');
  assert.strictEqual(summary.structuralErrors.length, 1);
  assert.deepStrictEqual(summary.invalid, []);
  assert.strictEqual(summary.statusType, 'warn');
  assert.ok(summary.statusText.indexOf('字段层级不足 1 条') !== -1);

  const failed = model.buildParseSummary([
    { file: { name: 'bad.txt' }, result: { error: '格式错误' } },
    { file: { name: 'ok.xlsx' }, result: { items: [goodItem] } },
  ]);
  assert.deepStrictEqual(failed.items, []);
  assert.strictEqual(failed.statusType, 'err');
  assert.strictEqual(failed.statusText, '导入失败：bad.txt - 格式错误');

  const groups = model.buildGroups([
    { module: '登录', title: 'A' },
    { module: ' 登录 ', title: 'B' },
    { module: '支付', title: 'C' },
  ]);
  assert.strictEqual(groups.length, 2);
  assert.strictEqual(groups[0].items.length, 2);
  assert.strictEqual(model.buildExistingItemKeySet([goodItem])[buildItemKey(goodItem)], true);
  assert.strictEqual(model.countPendingItems([{ items: [1, 2] }, { items: [3] }]), 3);
  assert.ok(model.formatStructuralDetail({
    depth: 2,
    segments: ['登录', '密码错误'],
  }).indexOf('缺少：优先级、前提条件、操作步骤、预期结果') !== -1);
}

async function testFileParserBoundary() {
  const model = createModel();
  let xmindInput = null;
  let xlsxRows = [];
  const parser = parserOwner.create({
    getCore: function() {
      return {
        parseXmindFile: function(file) {
          xmindInput = file;
          return Promise.resolve({ paths: [['登录', '密码错误']], rootTitle: '根节点' });
        },
      };
    },
    buildFromXmindPaths: function(paths, rootTitle) {
      return {
        items: [{ module: rootTitle, title: paths[0][1], expected: '提示失败' }],
        structuralErrors: [],
      };
    },
    parseXlsxRows: function() { return Promise.resolve(xlsxRows); },
    buildFromXlsxRows: function(rows) {
      return [{ module: rows[1][0], title: rows[1][1], expected: rows[1][5] }];
    },
    validateHeaderRow: model.validateHeaderRow,
  });

  const unsupported = await parser.parse({ name: 'cases.csv' });
  assert.strictEqual(unsupported.error, '仅支持导入 .xmind 或 .xlsx 文件');

  const xmindFile = { name: 'cases.xmind' };
  const xmind = await parser.parse(xmindFile);
  assert.strictEqual(xmindInput, xmindFile);
  assert.strictEqual(xmind.items[0].module, '根节点');

  xlsxRows = [];
  const empty = await parser.parse({ name: 'cases.xlsx' });
  assert.strictEqual(empty.error, 'Excel 解析失败：未找到数据');

  xlsxRows = [['模块', '用例标题']];
  const invalidHeader = await parser.parse({ name: 'cases.xlsx' });
  assert.strictEqual(invalidHeader.error, 'Excel 表头与漏测用例导出格式不一致');

  xlsxRows = [
    ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'],
    ['登录', '密码错误', 'P1', '账号存在', '输入错误密码', '提示失败'],
  ];
  const xlsx = await parser.parse({ name: 'cases.XLSX' });
  assert.deepStrictEqual(xlsx.items, [{ module: '登录', title: '密码错误', expected: '提示失败' }]);

  const noXmindCore = parserOwner.create({ getCore: function() { return null; } });
  const missingCore = await noXmindCore.parse({ name: 'cases.xmind' });
  assert.strictEqual(missingCore.error, '缺少 XMind 解析能力');
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parentSource = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const modelSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingImportModel.js'),
    'utf8'
  );
  const parserSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingImportFileParser.js'),
    'utf8'
  );
  const viewSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingImportViewAdapter.js'),
    'utf8'
  );
  const controllerSource = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryMissingImportController.js'),
    'utf8'
  );

  assert.ok(parentSource.indexOf('missingImportModelOwner.create') !== -1);
  assert.ok(parentSource.indexOf('missingImportFileParserOwner.create') !== -1);
  assert.ok(parentSource.indexOf('missingImportViewOwner.create') !== -1);
  assert.ok(parentSource.indexOf('missingImportControllerOwner.create') !== -1);
  assert.ok(parentSource.indexOf('function normalizeMissingImportItem') === -1);
  assert.ok(parentSource.indexOf('function validateMissingImportHeaderRow') === -1);
  assert.ok(parentSource.indexOf('function validateMissingImportItems') === -1);
  assert.ok(parentSource.indexOf('function buildMissingImportGroups') === -1);
  assert.ok(parentSource.indexOf('function handleMissingImportFiles') === -1);
  assert.ok(parentSource.indexOf('function confirmMissingImportToDb') === -1);
  assert.ok(parentSource.indexOf('missingImportController.bindEvents();') !== -1);
  assert.ok(modelSource.indexOf('document.') === -1);
  assert.ok(modelSource.indexOf('innerHTML') === -1);
  assert.ok(modelSource.indexOf('apiClient') === -1);
  assert.ok(modelSource.indexOf('FileReader') === -1);
  assert.ok(parserSource.indexOf('document.') === -1);
  assert.ok(parserSource.indexOf('innerHTML') === -1);
  assert.ok(parserSource.indexOf('apiClient') === -1);
  assert.ok(parserSource.indexOf('state.') === -1);
  assert.ok(viewSource.indexOf('apiClient') === -1);
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
    'caseLibraryMissingImportModel.js',
    'caseLibraryMissingImportFileParser.js',
    'caseLibraryMissingImportViewAdapter.js',
    'caseLibraryMissingImportController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing an import owner');
    assert.ok(
      indexes[0] < indexes[1]
        && indexes[1] < indexes[2]
        && indexes[2] < indexes[3]
        && indexes[3] < indexes[4],
      entry + ' has invalid import owner order'
    );
  });
}

(async function run() {
  testModelRules();
  await testFileParserBoundary();
  testOwnershipAndEntryOrder();
  console.log('case library missing import owner tests passed');
})().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
