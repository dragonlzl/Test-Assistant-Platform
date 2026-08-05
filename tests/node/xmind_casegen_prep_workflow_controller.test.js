'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenPrepWorkflowController.js'
));

function createElement() {
  var listeners = {};
  return {
    clicks: 0,
    dispatched: [],
    files: [],
    value: '',
    addEventListener: function(type, handler) { listeners[type] = handler; },
    click: function() { this.clicks += 1; },
    dispatchEvent: function(event) {
      this.dispatched.push(event);
      if (listeners[event.type]) listeners[event.type]({ target: this });
    },
    emit: function(type, event) { return listeners[type](event); },
  };
}

function createHarness(overrides) {
  var opts = overrides || {};
  var prep = { caseImportMode: '' };
  var fileInput = createElement();
  var caseFileInput = createElement();
  var fallbackButton = createElement();
  var bodyChildren = [];
  var elements = {
    fileInput: fileInput,
    caseFileInput: caseFileInput,
    caseLibraryImportSelectBtn: fallbackButton,
  };
  var documentObj = {
    body: { appendChild: function(el) { bodyChildren.push(el); } },
    createElement: function() { return createElement(); },
    getElementById: function(id) { return elements[id] || null; },
  };
  var windowObj = { app: {} };
  var calls = {
    appendedImages: [],
    confirms: [],
    fields: [],
    notices: [],
    renders: 0,
    resets: [],
    selectedLibrary: 0,
  };
  function FakeDataTransfer() {
    var files = [];
    this.files = files;
    this.items = { add: function(file) { files.push(file); } };
  }
  function FakeEvent(type, options) {
    this.type = type;
    this.bubbles = options && options.bubbles === true;
  }
  var xmindGenApi = {
    getCombinedCaseList: function() { return opts.caseList || []; },
    getCombinedCaseText: function() { return opts.caseText || ''; },
  };
  var controller = controllerFactory.create({
    documentObj: documentObj,
    windowObj: windowObj,
    DataTransfer: opts.disableDataTransfer === true ? null : FakeDataTransfer,
    Event: FakeEvent,
    xmindGenApi: xmindGenApi,
    getPrepState: function() { return prep; },
    isPrepBaseLocked: function() { return opts.locked === true; },
    setPrepField: function(key, value) {
      prep[key] = value;
      calls.fields.push({ key: key, value: value });
    },
    appendManualRequirementImages: function(files) {
      calls.appendedImages.push(files.slice());
      return Promise.resolve(opts.appendImagesResult !== false);
    },
    notifyStatus: function(text, type, duration) {
      calls.notices.push({ text: text, type: type, duration: duration });
    },
    renderOpenedSummaryDialog: function() { calls.renders += 1; },
    openStoreConfirmDialog: function(options) {
      calls.confirms.push(options);
      return Promise.resolve(opts.confirmReset !== false);
    },
    hasAnyRunningGenerationOperation: function() { return opts.running === true; },
    resetXmindCasegenState: function(options) {
      calls.resets.push(options);
      return true;
    },
    getCaseLibraryApi: function() {
      if (opts.libraryApi === false) return null;
      return { openImportSelectDrawer: function() { calls.selectedLibrary += 1; } };
    },
    now: function() { return 1000; },
  });
  return {
    bodyChildren: bodyChildren,
    calls: calls,
    caseFileInput: caseFileInput,
    controller: controller,
    fallbackButton: fallbackButton,
    fileInput: fileInput,
    prep: prep,
    windowObj: windowObj,
  };
}

function verifyCasesSummary() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.buildCasesSummaryInfo().done, false);
  harness.prep.caseImportMode = 'skip';
  assert.strictEqual(harness.controller.buildCasesSummaryInfo().done, true);
  assert.strictEqual(harness.controller.buildCasesSummaryInfo().title, '本次不导入已有用例');

  harness = createHarness({ caseText: 'raw cases' });
  harness.prep.caseImportMode = 'import';
  assert.strictEqual(harness.controller.buildCasesSummaryInfo().meta, '已存在文本，但尚未解析到有效用例。');

  harness = createHarness({ caseList: [{ title: '登录成功' }, { title: '登录失败' }] });
  harness.prep.caseImportMode = 'import';
  assert.strictEqual(harness.controller.buildCasesSummaryInfo().done, true);
  assert.ok(harness.controller.buildCasesSummaryInfo().meta.indexOf('2 条') >= 0);
}

function verifyFileTriggersAndDropDispatch() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.triggerRequirementImport(), true);
  assert.strictEqual(harness.fileInput.clicks, 1);
  assert.deepStrictEqual(harness.calls.fields[0], { key: 'requirementMode', value: 'document' });
  assert.strictEqual(harness.windowObj.app.__xmindCasegenScopedRequirementImportUntil, 11000);

  assert.strictEqual(harness.controller.triggerCasesImport(), true);
  assert.strictEqual(harness.caseFileInput.clicks, 1);
  var requirementFile = { name: 'requirement.docx' };
  var caseFile = { name: 'cases.xmind' };
  assert.strictEqual(harness.controller.importRequirementFileFromDrop(requirementFile), true);
  assert.strictEqual(harness.controller.importCasesFilesFromDrop([caseFile]), true);
  assert.deepStrictEqual(harness.fileInput.files, [requirementFile]);
  assert.deepStrictEqual(harness.caseFileInput.files, [caseFile]);
  assert.strictEqual(harness.fileInput.dispatched[0].type, 'change');
  assert.strictEqual(harness.fileInput.dispatched[0].bubbles, true);

  var unsupported = createHarness({ disableDataTransfer: true });
  assert.strictEqual(unsupported.controller.importRequirementFileFromDrop(requirementFile), false);
  assert.strictEqual(unsupported.calls.notices[0].type, 'warn');

  var locked = createHarness({ locked: true });
  assert.strictEqual(locked.controller.triggerRequirementImport(), false);
  assert.strictEqual(locked.controller.importCasesFilesFromDrop([caseFile]), false);
  assert.deepStrictEqual(locked.calls.fields, []);
}

async function verifyManualImagesAndLibrarySelection() {
  var harness = createHarness();
  var input = harness.controller.ensureManualImageInput();
  assert.strictEqual(harness.controller.ensureManualImageInput(), input);
  assert.strictEqual(harness.controller.getManualImageInputEl(), input);
  assert.strictEqual(harness.bodyChildren.length, 1);
  input.files = [{ name: 'screen.png' }];
  input.emit('change', { target: input });
  await Promise.resolve();
  assert.deepStrictEqual(harness.calls.appendedImages, [[{ name: 'screen.png' }]]);
  assert.strictEqual(harness.calls.renders, 1);
  assert.strictEqual(input.value, '');

  assert.strictEqual(harness.controller.triggerCasesLibrarySelect(), true);
  assert.strictEqual(harness.calls.selectedLibrary, 1);
  assert.strictEqual(harness.windowObj.app.__drawerSkipCloseId, 'xmindCaseGenDrawer');
  assert.deepStrictEqual(harness.windowObj.app.__drawerCloseGuard, {
    id: 'xmindCaseGenDrawer',
    until: 2600,
  });

  var fallback = createHarness({ libraryApi: false });
  assert.strictEqual(fallback.controller.triggerCasesLibrarySelect(), true);
  assert.strictEqual(fallback.fallbackButton.clicks, 1);
}

async function verifyResetFlow() {
  var running = createHarness({ running: true });
  assert.strictEqual(await running.controller.requestPrepReset(), false);
  assert.strictEqual(running.calls.confirms.length, 0);
  assert.strictEqual(running.calls.notices[0].type, 'warn');

  var cancelled = createHarness({ confirmReset: false });
  assert.strictEqual(await cancelled.controller.requestPrepReset(), false);
  assert.strictEqual(cancelled.calls.resets.length, 0);

  var confirmed = createHarness();
  assert.strictEqual(await confirmed.controller.requestPrepReset(), true);
  assert.deepStrictEqual(confirmed.calls.resets, [{
    reason: 'prep-manual-reset',
    reopenPrepDialog: true,
    toastText: '已重置当前 XMind 生成内容',
    toastDurationMs: 3000,
  }]);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'buildCasesSummaryInfo',
    'ensureManualImageInput',
    'triggerRequirementImport',
    'dispatchFilesToInput',
    'importRequirementFileFromDrop',
    'importCasesFilesFromDrop',
    'triggerCasesImport',
    'preserveXmindDrawerForNestedDrawer',
    'triggerCasesLibrarySelect',
    'requestPrepReset',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by prep workflow controller');
  });
  assert.ok(/prepWorkflowControllerFactory\.create\(/.test(parentSource));
  assert.ok(/getManualImageInputEl: prepWorkflowController\.getManualImageInputEl/.test(parentSource));
  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenPrepWorkflowController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load prep workflow controller first');
  });
}

(async function run() {
  verifyCasesSummary();
  verifyFileTriggersAndDropDispatch();
  await verifyManualImagesAndLibrarySelection();
  await verifyResetFlow();
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen prep workflow controller tests passed');
})().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
