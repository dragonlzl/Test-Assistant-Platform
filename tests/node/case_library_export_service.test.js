const assert = require('assert');
const fs = require('fs');
const path = require('path');

const serviceOwner = require('../../scripts/modules/caseLibrary/caseLibraryExportService.js');

function createFakeZipCtor() {
  function FakeZip(root, prefix) {
    this.root = root || { files: {} };
    this.prefix = prefix || '';
  }
  FakeZip.prototype.file = function(name, value) {
    this.root.files[this.prefix + name] = value;
    return this;
  };
  FakeZip.prototype.folder = function(name) {
    return new FakeZip(this.root, this.prefix + name + '/');
  };
  FakeZip.prototype.generateAsync = function(options) {
    return Promise.resolve({ files: this.root.files, options: options });
  };
  return FakeZip;
}

function escapeXml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function testWorkbookBuilders() {
  const FakeZip = createFakeZipCtor();
  const builder = function() { return Promise.resolve({ blob: {} }); };
  const service = serviceOwner.create({
    getJsZip: function() { return FakeZip; },
    getXmindApi: function() { return { buildXmindPackageFromCases: builder }; },
    escapeXmlText: escapeXml,
    escapeXmlTextPreserve: function(value) { return escapeXml(value).replace(/\n/g, '&#10;'); },
  });
  assert.strictEqual(service.hasJsZip(), true);
  assert.strictEqual(service.hasXmindBuilder(), true);
  assert.strictEqual(service.getXmindBuilder(), builder);

  const workbook = await service.buildSimpleXlsxBlob({
    sheets: [{ name: '登录&支付', rows: [['标题', '步骤'], ['成功', '第一步\n第二步']] }],
  });
  assert.strictEqual(workbook.options.type, 'blob');
  assert.ok(workbook.files['xl/workbook.xml'].indexOf('登录&amp;支付') !== -1);
  assert.ok(workbook.files['xl/worksheets/sheet1.xml'].indexOf('第一步&#10;第二步') !== -1);
  assert.ok(workbook.files['[Content_Types].xml'].indexOf('sheet1.xml') !== -1);

  const caseWorkbook = await service.buildCaseExcelBlob([{
    module: '登录', title: '成功登录', priority: 'P1', precondition: '已注册', steps: '提交', expected: '首页',
  }], '用例');
  assert.ok(caseWorkbook.files['xl/worksheets/sheet1.xml'].indexOf('成功登录') !== -1);

  const reuseWorkbook = await service.buildReuseTemplateBlob('复用模板');
  assert.ok(reuseWorkbook.files['xl/workbook.xml'].indexOf('复用模板') !== -1);
  assert.ok(reuseWorkbook.files['xl/workbook.xml'].indexOf('示例（执行页带结果，不参与导入）') !== -1);
}

async function testDependencyReloadAndDeduplication() {
  let zipReady = false;
  let xmindReady = false;
  const appended = [];
  const documentStub = {
    createElement: function() {
      return {
        attributes: {},
        setAttribute: function(name, value) { this.attributes[name] = value; },
      };
    },
    head: {
      appendChild: function(script) {
        appended.push(script.src);
        const key = script.attributes['data-case-lib-dyn'];
        if (key === 'jszip') zipReady = true;
        if (key === 'xmindCore') xmindReady = true;
        script.onload();
      },
    },
  };
  const service = serviceOwner.create({
    getJsZip: function() { return zipReady ? createFakeZipCtor() : null; },
    getXmindApi: function() {
      return xmindReady ? { buildXmindPackageFromCases: function() {} } : null;
    },
    getDocument: function() { return documentStub; },
    scheduleDelay: function(callback) { callback(); },
  });
  assert.strictEqual(await service.ensureReady(), true);
  assert.strictEqual(appended.length, 2);
  assert.ok(appended[0].indexOf('jszip.min.js') !== -1);
  assert.ok(appended[1].indexOf('xmindCore.js') !== -1);
  await service.ensureReady();
  assert.strictEqual(appended.length, 2);
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary/caseLibraryExportService.js'), 'utf8');
  assert.ok(parent.indexOf('exportServiceOwner.create') !== -1);
  assert.ok(parent.indexOf('exportService.buildSimpleXlsxBlob') !== -1);
  assert.ok(parent.indexOf('function buildSimpleXlsxBlob') === -1);
  assert.ok(parent.indexOf('function loadScriptWithRetry') === -1);
  assert.ok(service.indexOf('setStatus(') === -1);

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const serviceIndex = html.indexOf('caseLibraryExportService.js');
    const parentIndex = html.indexOf('caseLibrary.js');
    assert.ok(serviceIndex >= 0, entry + ' is missing export service');
    assert.ok(serviceIndex < parentIndex, entry + ' has invalid export service order');
  });
}

(async function run() {
  await testWorkbookBuilders();
  await testDependencyReloadAndDeduplication();
  testOwnershipAndEntryOrder();
  console.log('case library export service tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
