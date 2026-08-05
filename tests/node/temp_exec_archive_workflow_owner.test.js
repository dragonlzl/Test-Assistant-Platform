'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ownerFactory = require('../../scripts/modules/tempExecArchiveWorkflowOwner.js');

function createClassList() {
  var values = Object.create(null);
  return {
    add: function(value) { values[value] = true; },
    remove: function(value) { delete values[value]; },
    contains: function(value) { return Boolean(values[value]); },
  };
}

function createElement() {
  return {
    classList: createClassList(),
    disabled: false,
    value: '',
    textContent: '',
    listeners: {},
    focusCount: 0,
    addEventListener: function(type, handler) { this.listeners[type] = handler; },
    focus: function() { this.focusCount += 1; },
  };
}

function createHarness() {
  var elements = {
    tempExecArchiveReasonHint: createElement(),
    tempExecArchiveReasonInput: createElement(),
    tempExecArchiveReasonConfirmBtn: createElement(),
    tempExecArchiveReasonCancelBtn: createElement(),
    tempExecArchiveReasonStatus: createElement(),
  };
  var drawerConfig = null;
  var drawerOpened = 0;
  var drawerClosed = 0;
  var closeAllCount = 0;
  var archiveCalls = [];
  var statusCalls = [];
  var renderCalls = [];
  var overviewCalls = 0;
  var toastCalls = 0;
  var confirmCalls = [];
  var confirmResult = { ok: true };
  var state = { tempExecFocus: ['file-1', 'file-2'] };
  var browser = { app: {} };
  var client = {
    archiveExecSet: function(execSetId, payload) {
      archiveCalls.push({ execSetId: execSetId, payload: payload });
      return Promise.resolve({ ok: true });
    },
  };
  var drawer = {
    element: { classList: createClassList() },
    open: function() {
      drawerOpened += 1;
      this.element.classList.add('open');
    },
    close: function() {
      drawerClosed += 1;
      this.element.classList.remove('open');
      if (drawerConfig && typeof drawerConfig.onClose === 'function') drawerConfig.onClose();
    },
  };
  var owner = ownerFactory.create({
    state: state,
    api: {
      getCaseExecutionDisplay: function(file, item) { return { label: item.status }; },
      persistTempExecState: function() { renderCalls.push('persist'); },
      saveTempExecFocus: function() { renderCalls.push('focus'); },
      renderTempExecNav: function() { renderCalls.push('nav'); },
      renderTempVersionGrid: function() { renderCalls.push('versions'); },
      renderTempFocusZone: function() { renderCalls.push('focus-zone'); },
      renderTempExecOverview: function() { renderCalls.push('overview'); },
      loadTempExecState: function() { renderCalls.push('load'); return Promise.resolve(); },
    },
    window: browser,
    document: {
      getElementById: function(id) { return elements[id] || null; },
    },
    drawerManager: {
      createDrawer: function(config) { drawerConfig = config; return drawer; },
      closeAllDrawers: function() { closeAllCount += 1; },
    },
    mainStatus: createElement(),
    setStatus: function(element, message, level) {
      statusCalls.push({ element: element, message: message, level: level });
    },
    showOverview: function() { overviewCalls += 1; },
    getApiClient: function() { return client; },
    getConfirmDrawer: function() {
      return {
        open: function(config) {
          confirmCalls.push(config);
          return Promise.resolve(confirmResult);
        },
      };
    },
    showSuccessToast: function() { toastCalls += 1; },
  });
  return {
    owner: owner,
    state: state,
    elements: elements,
    archiveCalls: archiveCalls,
    statusCalls: statusCalls,
    renderCalls: renderCalls,
    confirmCalls: confirmCalls,
    setConfirmResult: function(value) { confirmResult = value; },
    drawerOpened: function() { return drawerOpened; },
    drawerClosed: function() { return drawerClosed; },
    closeAllCount: function() { return closeAllCount; },
    overviewCalls: function() { return overviewCalls; },
    toastCalls: function() { return toastCalls; },
  };
}

function verifyPureRules() {
  var file = {
    cases: [
      { status: '通过' },
      { status: '不适用' },
      { status: '失败' },
      { status: '阻塞' },
      { status: '' },
    ],
  };
  var counts = ownerFactory.summarizeArchiveCases(file, function(source, item) {
    return { label: item.status };
  });
  assert.deepStrictEqual(counts, { pending: 1, failed: 1, blocked: 1, total: 5 });
  assert.strictEqual(
    ownerFactory.buildArchiveReasonHint(counts),
    '仍存在未通过用例（未执行 1 / 失败 1 / 阻塞 1），请填写归档原因后继续。'
  );
}

async function verifyPassedArchiveFlow() {
  var harness = createHarness();
  var afterArchiveCount = 0;
  var result = await harness.owner.requestArchive({
    id: 'file-1',
    execSetId: 42,
    cases: [{ status: '通过' }, { status: '不适用' }],
  }, {
    afterArchive: function() { afterArchiveCount += 1; },
  });
  assert.strictEqual(result, true);
  assert.strictEqual(harness.confirmCalls.length, 1);
  assert.strictEqual(harness.archiveCalls.length, 1);
  assert.deepStrictEqual(harness.archiveCalls[0], { execSetId: 42, payload: {} });
  assert.deepStrictEqual(harness.state.tempExecFocus, ['file-2']);
  assert.strictEqual(harness.toastCalls(), 1);
  assert.strictEqual(afterArchiveCount, 1);
  assert.ok(harness.renderCalls.indexOf('load') !== -1);
  assert.ok(harness.renderCalls.indexOf('focus-zone') !== -1);
}

async function verifyReasonArchiveFlow() {
  var harness = createHarness();
  var opened = await harness.owner.requestArchive({
    id: 'file-2',
    execSetId: 77,
    cases: [{ status: '失败' }, { status: '' }],
  });
  assert.strictEqual(opened, false);
  assert.strictEqual(harness.drawerOpened(), 1);
  assert.strictEqual(harness.closeAllCount(), 1);
  assert.strictEqual(harness.archiveCalls.length, 0);
  assert.strictEqual(
    harness.elements.tempExecArchiveReasonHint.textContent,
    '仍存在未通过用例（未执行 1 / 失败 1 / 阻塞 0），请填写归档原因后继续。'
  );
  assert.ok(harness.elements.tempExecArchiveReasonConfirmBtn.listeners.click);
  assert.ok(harness.elements.tempExecArchiveReasonCancelBtn.listeners.click);

  assert.strictEqual(await harness.owner.submitReason(), false);
  assert.ok(harness.elements.tempExecArchiveReasonInput.classList.contains('input-invalid'));
  assert.ok(harness.statusCalls.some(function(entry) { return entry.message === '归档原因不能为空'; }));

  harness.elements.tempExecArchiveReasonInput.value = '保留失败结果';
  assert.strictEqual(await harness.owner.submitReason(), true);
  assert.deepStrictEqual(harness.archiveCalls[0], {
    execSetId: 77,
    payload: { reason: '保留失败结果' },
  });
  assert.strictEqual(harness.drawerClosed(), 1);
  assert.deepStrictEqual(harness.state.tempExecFocus, ['file-1']);
  assert.strictEqual(harness.owner.getContext(), null);
  assert.ok(harness.overviewCalls() >= 1);
}

function verifyOwnershipAndLoadOrder() {
  var projectRoot = path.join(__dirname, '..', '..');
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');
  var ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecArchiveWorkflowOwner.js'), 'utf8');
  assert.match(ownerSource, /function requestArchive\(/);
  assert.match(ownerSource, /function submitReason\(/);
  assert.match(ownerSource, /function removeFocusAfterArchive\(/);
  assert.doesNotMatch(parentSource, /function requestTempExecArchive\(/);
  assert.doesNotMatch(parentSource, /function submitTempExecArchiveReason\(/);
  assert.doesNotMatch(parentSource, /function showTempExecArchiveSuccessToast\(/);
  assert.match(parentSource, /tempExecArchiveWorkflowOwner\.create\(\{/);

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/tempExecArchiveWorkflowOwner.js');
    var parentIndex = html.indexOf('./scripts/modules/tempexec.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the archive workflow owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the archive owner before tempexec');
  });
}

async function run() {
  verifyPureRules();
  await verifyPassedArchiveFlow();
  await verifyReasonArchiveFlow();
  verifyOwnershipAndLoadOrder();
  console.log('temp exec archive workflow owner tests passed');
}

run().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
