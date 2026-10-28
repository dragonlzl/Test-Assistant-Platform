'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var context = vm.createContext({ window: { app: {} } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../scripts/core/xmindRequirementCoverageCore.js'), 'utf8'), context);
var core = context.window.app.xmindRequirementCoverageCore.init({});
var requirementText = '背景说明\n\n相同的要求\n\n相同的要求\n\n部分约束\n\n已经覆盖';
var result = {
  requirementText: requirementText,
  signature: 'source-signature',
  segments: core.splitRequirementText(requirementText),
  cases: [{ id: 'TC-001', module: '现有模块', title: '已有用例' }],
};
var statuses = ['context', 'uncovered', 'uncovered', 'partial', 'covered'];
result.segments.forEach(function(segment, index) { segment.status = statuses[index]; });
var snapshot = JSON.stringify(result);
var pending = {};
[0, 2, 3, 4].forEach(function(index) {
  var segment = result.segments[index];
  pending[segment.id] = { text: segment.text, manual: index !== 3, batch: index === 3 };
});
var request = core.buildSupplementRequest(result, pending);
assert.strictEqual(request.requirementText, requirementText);
assert.strictEqual(JSON.stringify(result), snapshot);
assert.strictEqual(request.cases[0].title, '已有用例');
assert.strictEqual(request.markedSegments.length, 4);
assert.strictEqual(request.markedSegments[0].role, 'context');
assert.strictEqual(request.markedSegments[1].status, 'uncovered');
assert.strictEqual(request.markedSegments[2].status, 'partial');
assert.strictEqual(request.markedSegments[3].status, 'covered');
assert.ok(request.markedRequirementText.indexOf('相同的要求\n\n【未覆盖待补充 REQ-003】\n相同的要求') !== -1);
assert.strictEqual(request.markedRequirementText.indexOf('REQ-002'), -1);
assert.strictEqual(request.markedRequirementText.replace(/【(?:已覆盖待补充|部分覆盖待补充|未覆盖待补充|上下文待补充) REQ-\d+】\n|\n【结束 REQ-\d+】/g, ''), requirementText);
assert.strictEqual(JSON.parse(request.requestText).operation_contract.append_only, true);
assert.strictEqual(core.getSupplementMarkedSegments(result, { 'REQ-001': { text: '过期内容', manual: true } }).length, 0);
assert.throws(function() { core.buildSupplementRequest(result, {}); }, /先标记/);
console.log('xmind_coverage_supplement_core.test.js passed');
