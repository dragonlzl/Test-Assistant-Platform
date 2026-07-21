const assert = require('assert');
const fs = require('fs');
const path = require('path');
const parserOwner = require('../../scripts/modules/caseLibrary/caseLibraryImportFileParser.js');

function textFile(name, content) {
  return {
    name: name,
    text: function() { return Promise.resolve(content); },
  };
}

function createHarness() {
  var xlsxCalls = [];
  var core = {
    deriveCaseListFromText: function(text) {
      return [{ module: 'text', title: text, priority: 'P2', precondition: 'ready', steps: ['one', 'two'], expected: 'done' }];
    },
    parseXmindFile: function() {
      return Promise.resolve({
        rootTitle: 'root',
        paths: [
          ['root', 'module', 'title', 'p1', 'ready', 'step', 'done'],
          ['root', 'short', 'path'],
        ],
      });
    },
  };
  var parser = parserOwner.create({
    getCore: function() { return core; },
    getXlsxCore: function() {
      return {
        parseXlsxFileToRows: function(file) {
          xlsxCalls.push(file.name);
          return Promise.resolve([
            ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'],
            ['excel', 'case', 'P0', 'ready', 'step', 'done'],
          ]);
        },
      };
    },
  });
  return { parser: parser, xlsxCalls: xlsxCalls };
}

function testPureTransforms() {
  var items = parserOwner.buildItems([
    { '模块': ' module ', '用例标题': ' title ', '优先级': 'p1', '前提条件': '-', '操作步骤': ['one', 'two'], '预期结果': ' done ' },
    { module: '-', title: '-', expected: '-' },
  ]);
  assert.strictEqual(items.length, 1);
  assert.deepStrictEqual(items[0], {
    module: 'module',
    title: 'title',
    expected: 'done',
    priority: 'p1',
    precondition: '',
    steps: 'one\ntwo',
    remark: null,
    _sourceLine: 1,
  });
  assert.strictEqual(parserOwner.normalizePriority(' p2 '), 'P2');

  var invalid = parserOwner.validateItems(items);
  assert.strictEqual(invalid.length, 1);
  assert.strictEqual(invalid[0].line, 1);
  assert.strictEqual(invalid[0].err.precondition, true);
  assert.strictEqual(items[0].priority, 'P1');

  assert.deepStrictEqual(parserOwner.sanitizeItems([Object.assign({ _sourceLine: 8 }, items[0])]), [{
    module: 'module',
    title: 'title',
    expected: 'done',
    priority: 'P1',
    precondition: '',
    steps: 'one\ntwo',
    remark: null,
  }]);
}

async function testFileParsers() {
  var harness = createHarness();
  var json = await harness.parser.parseFile(textFile('cases.json', JSON.stringify({ cases: [{
    module: 'json', title: 'case', priority: 'P1', precondition: 'ready', steps: 'step', expected: 'done',
  }] })));
  assert.strictEqual(json.items[0].module, 'json');

  var text = await harness.parser.parseFile(textFile('cases.txt', 'plain case'));
  assert.strictEqual(text.items[0].title, 'plain case');
  assert.strictEqual(text.items[0].steps, 'one\ntwo');

  var xmind = await harness.parser.parseFile({ name: 'cases.xmind' });
  assert.strictEqual(xmind.items.length, 2);
  assert.strictEqual(xmind.items[0].module, 'module');
  assert.strictEqual(xmind.structuralErrors.length, 1);
  assert.deepStrictEqual(xmind.structuralErrors[0].segments, ['short', 'path']);

  var xlsx = await harness.parser.parseFile({ name: 'cases.xlsx' });
  assert.strictEqual(xlsx.items[0].module, 'excel');
  assert.deepStrictEqual(harness.xlsxCalls, ['cases.xlsx']);
}

function testOwnershipAndEntryOrder() {
  var root = path.resolve(__dirname, '../..');
  var parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  assert.ok(parent.indexOf('importFileParserOwner.create') !== -1);
  assert.ok(parent.indexOf('function parseImportFile') === -1);
  assert.ok(parent.indexOf('function parseXlsxSharedStrings') === -1);
  assert.ok(parent.indexOf('function buildImportItems') === -1);
  assert.ok(parent.split('\n').length < 9100, 'caseLibrary.js should keep shrinking');

  var entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  entries.forEach(function(entry) {
    var html = fs.readFileSync(path.join(root, entry), 'utf8');
    var ownerIndex = html.indexOf('caseLibraryImportFileParser.js');
    var parentIndex = html.indexOf('scripts/modules/caseLibrary.js');
    assert.ok(ownerIndex >= 0, entry + ' is missing the import file parser');
    assert.ok(ownerIndex < parentIndex, entry + ' has invalid import parser order');
  });
}

(async function run() {
  testPureTransforms();
  await testFileParsers();
  testOwnershipAndEntryOrder();
  console.log('case library import file parser tests passed');
})().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
