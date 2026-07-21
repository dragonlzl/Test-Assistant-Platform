const assert = require('assert');
const fs = require('fs');
const path = require('path');
const owner = require('../../scripts/modules/caseLibrary/caseLibraryExportController.js');

function testXmindMapping() {
  assert.deepStrictEqual(owner.mapMissingItemsToXmind([
    { title: '', priority: 'P1', precondition: 'ready', steps: 'step', expected: 'done' },
  ], 'Module'), [{
    module: 'Module',
    title: '易漏用例1',
    priority: 'P1',
    precondition: 'ready',
    steps: 'step',
    expected: 'done',
  }]);
}

async function testMissingExports() {
  var downloads = [];
  var statuses = [];
  var xmindButton = { disabled: false };
  var excelButton = { disabled: false };
  var modules = [{ id: 1, name: 'One' }];
  var controller = owner.create({
    state: { missingDrawer: { loading: false } },
    dom: {
      missingDrawerStatus: {},
      missingDrawerExportXmindBtn: xmindButton,
      missingDrawerExportExcelBtn: excelButton,
    },
    apiClient: {
      listMissingModuleItems: function() {
        return Promise.resolve([{ title: 'Case', priority: 'P1', expected: 'Done' }]);
      },
    },
    getSelectedModules: function() { return modules; },
    getXmindBuilder: function() {
      return function(items, name) {
        assert.strictEqual(items[0].module, 'One');
        assert.strictEqual(name, 'One');
        return Promise.resolve({ blob: 'xmind-blob' });
      };
    },
    getDownloadBlob: function() {
      return function(name, blob) { downloads.push([name, blob]); };
    },
    sanitizeDownloadName: function(name, extension) { return name + extension; },
    setStatus: function(element, text, type) { statuses.push([text, type]); },
  });

  assert.deepStrictEqual(await controller.exportMissingToXmind(), { success: 1, fail: 0 });
  assert.deepStrictEqual(downloads, [['One.xmind', 'xmind-blob']]);
  assert.strictEqual(xmindButton.disabled, false);
  assert.deepStrictEqual(statuses[statuses.length - 1], ['导出完成：成功 1 个模块，失败 0 个模块', 'ok']);
}

async function testBatchExcelWithPartialFailure() {
  var downloads = [];
  var zipFiles = [];
  var errors = [];
  function FakeZip() {}
  FakeZip.prototype.file = function(name, blob) { zipFiles.push([name, blob]); };
  FakeZip.prototype.generateAsync = function() { return Promise.resolve('zip-blob'); };
  var modules = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }];
  var controller = owner.create({
    state: { missingDrawer: { loading: false } },
    dom: { missingDrawerStatus: {}, missingDrawerExportExcelBtn: { disabled: false } },
    apiClient: {
      listMissingModuleItems: function(id) {
        return id === 1 ? Promise.resolve([{ module_id: 1, title: 'Case' }]) : Promise.reject(new Error('failed'));
      },
    },
    getSelectedModules: function() { return modules; },
    getDownloadBlob: function() {
      return function(name, blob) { downloads.push([name, blob]); };
    },
    getJsZip: function() { return FakeZip; },
    sanitizeDownloadName: function(name, extension) { return name + extension; },
    buildSimpleXlsxBlob: function(options) {
      assert.strictEqual(options.sheets[0].rows[1][0], 'Module#1');
      return Promise.resolve('excel-blob');
    },
    getMissingModuleName: function(id) { return 'Module#' + id; },
    setStatus: function() {},
    logError: function(error) { errors.push(error.message); },
  });

  assert.deepStrictEqual(await controller.exportMissingToExcel(), { success: 1, fail: 1 });
  assert.deepStrictEqual(zipFiles, [['One.xlsx', 'excel-blob']]);
  assert.deepStrictEqual(downloads, [['易漏用例批量导出_excel.zip', 'zip-blob']]);
  assert.deepStrictEqual(errors, ['failed']);
}

async function testTemplateDownloads() {
  var downloads = [];
  var logs = [];
  var controller = owner.create({
    state: {},
    dom: { importStatus: {}, importExcelTemplateTypeSelect: { value: 'reuse' } },
    getDownloadBlob: function() {
      return function(name, blob) { downloads.push([name, blob]); };
    },
    getXmindBuilder: function() {
      return function(items, name) {
        assert.strictEqual(items[0].title, '用例标题');
        assert.strictEqual(name, '用例导入模板');
        return Promise.resolve({ blob: 'xmind-template' });
      };
    },
    sanitizeDownloadName: function(name, extension) { return name + extension; },
    buildReuseTemplateBlob: function(name) {
      assert.strictEqual(name, '用例导入模板（复用）');
      return Promise.resolve('excel-template');
    },
    setStatus: function() {},
    logOperation: function(action, targetType, targetId, detail) {
      logs.push([action, targetType, targetId, detail]);
    },
  });

  assert.strictEqual(await controller.downloadImportExcelTemplate(), true);
  assert.strictEqual(await controller.downloadImportXmindTemplate(), true);
  assert.deepStrictEqual(downloads, [
    ['用例导入模板（复用）.xlsx', 'excel-template'],
    ['用例导入模板.xmind', 'xmind-template'],
  ]);
  assert.strictEqual(logs[0][0], 'export_case_template_excel');
  assert.strictEqual(logs[1][0], 'export_case_template_xmind');
}

function testOwnershipAndEntryOrder() {
  var root = path.resolve(__dirname, '../..');
  var parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  assert.ok(parent.indexOf('exportControllerOwner.create') !== -1);
  assert.ok(parent.indexOf('function exportMissingSelectionToXmind') === -1);
  assert.ok(parent.indexOf('function downloadImportExcelTemplate') === -1);
  assert.ok(parent.split('\n').length < 8200, 'caseLibrary.js should keep shrinking');

  var entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  entries.forEach(function(entry) {
    var html = fs.readFileSync(path.join(root, entry), 'utf8');
    var serviceIndex = html.indexOf('caseLibraryExportService.js');
    var controllerIndex = html.indexOf('caseLibraryExportController.js');
    var parentIndex = html.indexOf('scripts/modules/caseLibrary.js');
    assert.ok(serviceIndex >= 0 && controllerIndex >= 0, entry + ' is missing an export owner');
    assert.ok(serviceIndex < controllerIndex && controllerIndex < parentIndex, entry + ' has invalid export owner order');
  });
}

(async function run() {
  testXmindMapping();
  await testMissingExports();
  await testBatchExcelWithPartialFailure();
  await testTemplateDownloads();
  testOwnershipAndEntryOrder();
  console.log('case library export controller tests passed');
})().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
