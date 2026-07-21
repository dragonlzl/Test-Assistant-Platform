'use strict';

var assert = require('assert');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var validationModule = require(
  path.join(projectRoot, 'scripts/modules/app/workflowValidationController.js')
);

function createHarness(overrides) {
  var opts = overrides || {};
  var state = {
    validationFailedSteps: {},
    validationFailedReasons: {},
  };
  var dom = {
    reviewResultEl: { value: '' },
    cleanedTextEl: { value: '' },
    compareResultEl: { value: '' },
    splitResultEl: { value: '' },
    casesCompareResultEl: { value: '' },
  };
  var splitModules = [];
  var caseList = [];
  var hasCaseSource = false;
  var lockedSteps = {};

  function unwrapRequirementPayload(text) {
    var parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { payload: text };
    }
    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'payload')) {
      return parsed;
    }
    return { payload: text };
  }

  var controller = validationModule.create({
    dom: dom,
    api: {
      hasCaseSource: function() { return hasCaseSource; },
      getCombinedCaseList: function() { return caseList; },
    },
    ensureValidationFailedMap: function() { return state.validationFailedSteps; },
    ensureValidationFailedReasonMap: function() { return state.validationFailedReasons; },
    isStepLocked: function(step) { return lockedSteps[step] === true; },
    unwrapRequirementPayload: unwrapRequirementPayload,
    stripRequirementHeader: function(text) { return text.replace(/^HEADER\s*/, ''); },
    shouldExpectCleanJson: function() { return opts.expectCleanJson !== false; },
    isCoveragePayload: function(data) {
      return Boolean(data && typeof data === 'object'
        && Object.prototype.hasOwnProperty.call(data, 'coverage'));
    },
    clampCoveragePercent: function(value) {
      var num = Number(value);
      return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : null;
    },
    parseSplitModules: function() { return splitModules; },
    hasCaseSource: function() { return hasCaseSource; },
  });

  return {
    controller: controller,
    state: state,
    dom: dom,
    setSplitModules: function(value) { splitModules = value; },
    setCaseList: function(value) { caseList = value; },
    setHasCaseSource: function(value) { hasCaseSource = value; },
    setLocked: function(step, value) { lockedSteps[step] = value === true; },
  };
}

var nestedHarness = createHarness();
assert.deepStrictEqual(
  nestedHarness.controller.pickCoveragePayload({ data: { nested: [{ coverage: 87 }] } }),
  { coverage: 87 }
);
assert.strictEqual(
  nestedHarness.controller.parseCoveragePayloadFromText(
    JSON.stringify({ type: 'compare', payload: JSON.stringify({ data: { coverage: 92 } }) }),
    'compare'
  ).coverage,
  92
);
assert.strictEqual(
  nestedHarness.controller.parseCoveragePayloadFromText(
    JSON.stringify({ type: 'cases_compare', payload: JSON.stringify({ coverage: 92 }) }),
    'compare'
  ),
  null
);

var reviewHarness = createHarness();
reviewHarness.dom.reviewResultEl.value = 'not-json';
assert.strictEqual(reviewHarness.controller.validateReviewResult(), true);
assert.strictEqual(reviewHarness.state.validationFailedSteps.review, true);
assert.strictEqual(reviewHarness.state.validationFailedReasons.review, '评审结果格式异常');
reviewHarness.dom.reviewResultEl.value = '[]';
assert.strictEqual(reviewHarness.controller.validateReviewResult(), true);
assert.strictEqual(reviewHarness.state.validationFailedSteps.review, undefined);
reviewHarness.setLocked('review', true);
reviewHarness.dom.reviewResultEl.value = 'not-json';
assert.strictEqual(reviewHarness.controller.validateReviewResult(), false);
assert.strictEqual(reviewHarness.state.validationFailedSteps.review, undefined);

var cleanHarness = createHarness();
cleanHarness.dom.cleanedTextEl.value = 'invalid';
assert.strictEqual(cleanHarness.controller.validateCleanResult(), true);
assert.strictEqual(cleanHarness.state.validationFailedSteps.clean, true);
cleanHarness.dom.cleanedTextEl.value = 'HEADER {"summary":"ok"}';
assert.strictEqual(cleanHarness.controller.validateCleanResult(), true);
assert.strictEqual(cleanHarness.state.validationFailedSteps.clean, undefined);

var flowHarness = createHarness();
flowHarness.dom.reviewResultEl.value = '[]';
flowHarness.dom.cleanedTextEl.value = '{"summary":"ok"}';
flowHarness.dom.compareResultEl.value = JSON.stringify({
  type: 'compare',
  payload: JSON.stringify({ coverage: 100, missing: [] }),
});
flowHarness.dom.splitResultEl.value = '[{"module":"登录"}]';
flowHarness.dom.casesCompareResultEl.value = JSON.stringify({
  type: 'cases_compare',
  payload: JSON.stringify({ coverage: 100, missing: [] }),
});
flowHarness.setSplitModules([{ module: '登录' }]);
flowHarness.setHasCaseSource(true);
flowHarness.setCaseList([{ title: '登录成功' }]);
assert.strictEqual(flowHarness.controller.validateFlowData(), false);
assert.deepStrictEqual(flowHarness.state.validationFailedSteps, {});

flowHarness.dom.compareResultEl.value = '{"coverage":"invalid"}';
assert.strictEqual(flowHarness.controller.validateFlowData(), true);
assert.strictEqual(flowHarness.state.validationFailedSteps.compare, true);
assert.strictEqual(flowHarness.controller.getValidationFailureReason('cases-upload'), '用例导入格式异常');

console.log('workflow validation controller tests passed');
