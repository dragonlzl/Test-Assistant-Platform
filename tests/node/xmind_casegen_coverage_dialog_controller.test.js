'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenCoverageDialogController.js'
));

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createHarness(overrides) {
  var listeners = {};
  var buttonListeners = {};
  var coverageState = {
    running: false,
    error: '',
    signature: 'sig-1',
    selectedSegmentId: 'segment-1',
    result: {
      signature: 'sig-1',
      requirementText: '登录必须校验密码',
      summary: { total: 2, covered: 1, partial: 0, uncovered: 1, context: 0, coveragePercent: 50 },
      segments: [
        { id: 'segment-1', index: 0, text: '登录必须', status: 'covered', directCaseIds: ['case-1'], relatedCaseIds: [] },
        { id: 'segment-2', index: 1, text: '校验密码', status: 'uncovered', directCaseIds: [], relatedCaseIds: [] },
      ],
      cases: [
        { id: 'case-1', module: '登录', title: '正确密码登录', priority: 'P1' },
      ],
      unmappedCaseIds: [],
    },
  };
  var body = {
    innerHTML: '',
    addEventListener: function(type, handler) { listeners[type] = handler; },
    removeEventListener: function(type) { delete listeners[type]; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
  };
  var button = {
    addEventListener: function(type, handler) { buttonListeners[type] = handler; },
    removeEventListener: function(type) { delete buttonListeners[type]; },
  };
  var calls = {
    closed: 0,
    hiddenMenus: 0,
    notices: [],
    opened: 0,
    persists: 0,
    revokedUrls: [],
    started: [],
    tooltipHides: 0,
  };
  var tooltipController = {
    hide: function() { calls.tooltipHides += 1; },
    destroy: function() {},
  };
  var options = {
    summaryDialogBodyEl: body,
    coverageBtn: button,
    escapeHtml: escapeHtml,
    ensureCoverageUiState: function() { return coverageState; },
    buildCoverageSourceRequest: function() { return { signature: 'sig-1' }; },
    getSelectedRequirementSource: function() {
      return { text: '登录必须校验密码', mode: 'document', images: [] };
    },
    getCoverageCaseTooltipCore: function() {
      return { init: function() { return tooltipController; } };
    },
    getUrlApi: function() {
      return {
        createObjectURL: function() { return 'blob:coverage'; },
        revokeObjectURL: function(url) { calls.revokedUrls.push(url); },
      };
    },
    persistXmindState: function() { calls.persists += 1; },
    hasActiveWorkspace: function() { return true; },
    notifyFloatingStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    collectRunningGenerationOperations: function() { return []; },
    notifyStatus: function(text, type) { calls.notices.push({ text: text, type: type }); },
    hideOpenMindContextMenu: function() { calls.hiddenMenus += 1; },
    openCoverageDialogShell: function() { calls.opened += 1; },
    isCoverageDialogOpen: function() { return false; },
    closeSummaryDialog: function() { calls.closed += 1; },
    startRequirementCoverageTask: function(taskOptions) { calls.started.push(taskOptions || {}); },
    scheduleFrame: function(handler) { handler(); },
    now: function() { return 1000; },
  };
  var controller = controllerFactory.create(Object.assign(options, overrides || {}));
  return {
    body: body,
    buttonListeners: buttonListeners,
    calls: calls,
    controller: controller,
    coverageState: coverageState,
    listeners: listeners,
  };
}

function createClosestEvent(selector, attributes) {
  var element = {
    disabled: false,
    getAttribute: function(name) { return attributes[name] || ''; },
  };
  return {
    preventDefault: function() {},
    target: {
      closest: function(candidate) { return candidate === selector ? element : null; },
    },
  };
}

function verifyPureCoveragePolicies() {
  var harness = createHarness();
  assert.deepStrictEqual(harness.controller.getCoverageStatusMeta('partial'), {
    key: 'partial',
    label: '部分覆盖',
    className: 'is-partial',
  });
  assert.deepStrictEqual(harness.controller.getCoverageSegmentCaseIds({
    directCaseIds: ['case-1', 'case-1'],
    relatedCaseIds: ['case-2'],
  }), ['case-1', 'case-2']);
  assert.strictEqual(harness.controller.getCoverageCaseRelation({ relatedCaseIds: ['case-2'] }, 'case-2'), 'related');
  assert.strictEqual(harness.controller.findNextCoverageSegmentByStatus(
    harness.coverageState.result,
    'segment-1',
    'uncovered'
  ).id, 'segment-2');
}

function verifyRenderAndOpenLifecycle() {
  var harness = createHarness();
  harness.controller.renderCoverageDialog();
  assert.ok(harness.body.innerHTML.indexOf('50%') >= 0);
  assert.ok(harness.body.innerHTML.indexOf('登录必须') >= 0);
  assert.ok(harness.body.innerHTML.indexOf('正确密码登录') >= 0);

  harness.controller.openCoverageDialog();
  assert.strictEqual(harness.calls.opened, 1);
  assert.strictEqual(harness.calls.started.length, 0);
  assert.strictEqual(harness.calls.persists, 1);

  var empty = createHarness();
  empty.coverageState.result = null;
  empty.coverageState.signature = '';
  empty.controller.openCoverageDialog();
  assert.strictEqual(empty.calls.started.length, 1);
  assert.strictEqual(empty.calls.started[0].force, false);

  var missingWorkspace = createHarness({ hasActiveWorkspace: function() { return false; } });
  missingWorkspace.controller.openCoverageDialog();
  assert.strictEqual(missingWorkspace.calls.opened, 0);
  assert.strictEqual(missingWorkspace.calls.notices[0].type, 'warn');
}

function verifyClickDispatchAndBinding() {
  var harness = createHarness();
  harness.controller.bind();
  harness.controller.bind();
  assert.strictEqual(typeof harness.listeners.click, 'function');
  assert.strictEqual(typeof harness.buttonListeners.click, 'function');

  var segmentEvent = createClosestEvent('[data-coverage-selected-segment]', {
    'data-coverage-selected-segment': 'segment-2',
  });
  assert.strictEqual(harness.controller.handleClick(segmentEvent), true);
  assert.strictEqual(harness.coverageState.selectedSegmentId, 'segment-2');
  assert.ok(harness.calls.persists > 0);

  var caseEvent = createClosestEvent('[data-coverage-case]', {
    'data-coverage-case': 'case-1',
  });
  assert.strictEqual(harness.controller.handleClick(caseEvent), true);
  assert.strictEqual(harness.coverageState.selectedSegmentId, 'segment-1');

  harness.controller.clearHighlightedCase();
  harness.controller.unbind();
  assert.strictEqual(harness.listeners.click, undefined);
  assert.strictEqual(harness.buttonListeners.click, undefined);
}

function verifyOwnershipAndLoadingOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'getCoverageStatusMeta',
    'buildCoverageCaseMap',
    'getCoverageCaseDetail',
    'ensureCoverageCaseDetailTooltip',
    'hideCoverageCaseDetailTooltip',
    'getCoverageSegmentCaseIds',
    'getCoverageCaseRelation',
    'getCoverageCasePriorityMeta',
    'getCoverageCurrentRequestInfo',
    'isCoverageResultStale',
    'getSelectedCoverageSegment',
    'findCoverageSegmentsByCaseId',
    'getCoverageSelectedSegmentList',
    'buildCoverageSummaryHtml',
    'buildCoverageStatusJumpButton',
    'getCoverageSummaryCount',
    'buildCoverageSourceLegendHtml',
    'buildCoverageNoticeHtml',
    'readCoverageSourceScrollState',
    'restoreCoverageSourceScrollState',
    'findCoverageSourceSegmentElement',
    'readCoverageSourceAnchorState',
    'restoreCoverageSourceAnchorState',
    'releaseCoverageRequirementImageObjectUrls',
    'createCoverageRequirementImageUrl',
    'collectCoverageRequirementMediaItems',
    'buildCoverageSourceImageHtml',
    'buildCoverageSourceSegmentHtml',
    'buildCoverageDocumentHtml',
    'buildCoverageSourceHtml',
    'buildCoverageSelectedSegmentsHtml',
    'buildCoverageCaseListHtml',
    'scrollCoverageSourceSegmentIntoView',
    'findNextCoverageSegmentByStatus',
    'jumpToCoverageStatus',
    'renderCoverageDialog',
    'openCoverageDialog',
  ].forEach(function(name) {
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must be owned by coverage dialog controller');
  });
  assert.strictEqual(parentSource.indexOf('var coverageHighlightedCaseId'), -1);
  assert.ok(/coverageDialogControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenCoverageDialogController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0 && ownerIndex < parentIndex, fileName + ' must load coverage dialog before xmindCasegen');
  });
}

verifyPureCoveragePolicies();
verifyRenderAndOpenLifecycle();
verifyClickDispatchAndBinding();
verifyOwnershipAndLoadingOrder();
console.log('xmind casegen coverage dialog controller tests passed');
