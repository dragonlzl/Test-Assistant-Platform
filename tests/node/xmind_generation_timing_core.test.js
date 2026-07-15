'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var context = vm.createContext({
  window: { app: {} },
  Math: Math,
  Number: Number,
  Array: Array,
  Object: Object,
});
var source = fs.readFileSync(path.join(projectRoot, 'scripts/core/xmindGenerationTimingCore.js'), 'utf8');
vm.runInContext(source, context, { filename: 'scripts/core/xmindGenerationTimingCore.js' });

var core = context.window.app.xmindGenerationTimingCore;
var peerDurationsMs = [48000, 49000, 50000, 53000, 55000, 57000, 65000, 79000];
var evaluation = core.evaluateTailRequest({
  timeoutMs: 1800000,
  requestStartedAt: 1,
  now: 300001,
  remainingCount: 1,
  fallbackCaseCount: 12,
  peerDurationsMs: peerDurationsMs,
});

assert.strictEqual(evaluation.eligible, true);
assert.strictEqual(evaluation.shouldRescue, true);
assert.strictEqual(evaluation.baselineMs, 65000);
assert.strictEqual(evaluation.thresholdMs, 260000);
assert.strictEqual(evaluation.peerCount, 8);

assert.strictEqual(core.evaluateTailRequest({
  timeoutMs: 1800000,
  requestStartedAt: 1,
  now: 200001,
  remainingCount: 1,
  fallbackCaseCount: 12,
  peerDurationsMs: peerDurationsMs,
}).shouldRescue, false);

assert.strictEqual(core.evaluateTailRequest({
  timeoutMs: 1800000,
  requestStartedAt: 1,
  now: 300001,
  remainingCount: 1,
  fallbackCaseCount: 0,
  peerDurationsMs: peerDurationsMs,
}).eligible, false);

assert.strictEqual(core.evaluateTailRequest({
  timeoutMs: 1800000,
  requestStartedAt: 1,
  now: 300001,
  remainingCount: 1,
  fallbackCaseCount: 12,
  peerDurationsMs: [50000, 60000],
}).eligible, false);

assert.strictEqual(core.evaluateTailRequest({
  timeoutMs: 120000,
  requestStartedAt: 1,
  now: 120001,
  remainingCount: 1,
  fallbackCaseCount: 12,
  peerDurationsMs: peerDurationsMs,
}).eligible, false);

console.log('xmind_generation_timing_core.test.js passed');
