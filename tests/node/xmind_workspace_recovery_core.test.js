'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var projectRoot = path.resolve(__dirname, '../..');
var context = vm.createContext({
  window: { app: {} },
  Array: Array,
  JSON: JSON,
  Math: Math,
  Number: Number,
  Object: Object,
  String: String,
});
var source = fs.readFileSync(path.join(projectRoot, 'scripts/core/xmindWorkspaceRecoveryCore.js'), 'utf8');
vm.runInContext(source, context, { filename: 'scripts/core/xmindWorkspaceRecoveryCore.js' });

var core = context.window.app.xmindWorkspaceRecoveryCore;

var workspaceIdA = core.createWorkspaceId(1, 1000, 0.125);
var workspaceIdB = core.createWorkspaceId(1, 1001, 0.125);
assert.notStrictEqual(workspaceIdA, workspaceIdB);
assert.match(workspaceIdA, /^xmind-workspace-1-/);

var generationIdA = core.createWorkspaceGenerationId(1000, 0.25);
var generationIdB = core.createWorkspaceGenerationId(1001, 0.25);
assert.notStrictEqual(generationIdA, generationIdB);

var currentRequirement = {
  requirementLabel: '超界者二技能',
  rawText: '二技能命中目标后触发新的伤害效果。',
  prep: {
    requirementMode: 'document',
    requirementSupplement: '覆盖技能升级和冷却场景。',
  },
};
var staleRequirement = {
  requirementLabel: '超界者二技能',
  rawText: '金框商店展示入口、积分和购买状态。',
  prep: {
    requirementMode: 'document',
    requirementSupplement: '',
  },
};
assert.notStrictEqual(
  core.buildRequirementFingerprint(currentRequirement),
  core.buildRequirementFingerprint(staleRequirement)
);
assert.strictEqual(
  core.buildRequirementFingerprint({
    requirementLabel: '  超界者二技能  ',
    rawText: '二技能命中目标后触发新的伤害效果。\n',
    prep: {
      requirementMode: 'document',
      requirementSupplement: '覆盖技能升级和冷却场景。',
    },
  }),
  core.buildRequirementFingerprint(currentRequirement)
);

var workspace = {
  id: 'xmind-workspace-current',
  generationId: generationIdA,
  createdAt: 5000,
  restoreContext: Object.assign({
    workspaceId: 'xmind-workspace-current',
    workspaceGenerationId: generationIdA,
  }, currentRequirement),
};
var matchingTask = {
  id: 'task-current',
  status: 'done',
  workspaceId: 'xmind-workspace-current',
  createdAt: 6000,
  restoreContext: Object.assign({
    workspaceId: 'xmind-workspace-current',
    workspaceGenerationId: generationIdA,
  }, currentRequirement),
};
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(core.evaluateTaskRestore(matchingTask, workspace))),
  { allowed: true, recreateWorkspace: false, reason: 'compatible' }
);

var staleGenerationTask = Object.assign({}, matchingTask, {
  id: 'task-stale-generation',
  restoreContext: Object.assign({}, matchingTask.restoreContext, {
    workspaceGenerationId: generationIdB,
  }),
});
assert.strictEqual(core.evaluateTaskRestore(staleGenerationTask, workspace).allowed, false);
assert.strictEqual(core.evaluateTaskRestore(staleGenerationTask, workspace).reason, 'generation-mismatch');

var staleRequirementTask = Object.assign({}, matchingTask, {
  id: 'task-stale-requirement',
  restoreContext: Object.assign({
    workspaceId: 'xmind-workspace-current',
  }, staleRequirement),
});
assert.strictEqual(core.evaluateTaskRestore(staleRequirementTask, workspace).allowed, false);
assert.strictEqual(core.evaluateTaskRestore(staleRequirementTask, workspace).reason, 'requirement-mismatch');

var olderLegacyTask = Object.assign({}, matchingTask, {
  id: 'task-legacy-old',
  createdAt: 4000,
  restoreContext: Object.assign({
    workspaceId: 'xmind-workspace-current',
  }, currentRequirement),
});
assert.strictEqual(core.evaluateTaskRestore(olderLegacyTask, workspace).allowed, false);
assert.strictEqual(core.evaluateTaskRestore(olderLegacyTask, workspace).reason, 'legacy-task-older-than-workspace');

var validLegacyWorkspace = {
  id: 'xmind-workspace-legacy',
  createdAt: 5000,
  restoreContext: Object.assign({
    workspaceId: 'xmind-workspace-legacy',
  }, currentRequirement),
};
var validLegacyTask = {
  id: 'task-legacy-current',
  status: 'done',
  workspaceId: 'xmind-workspace-legacy',
  createdAt: 6000,
  restoreContext: Object.assign({
    workspaceId: 'xmind-workspace-legacy',
  }, currentRequirement),
};
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(core.evaluateTaskRestore(validLegacyTask, validLegacyWorkspace))),
  { allowed: true, recreateWorkspace: false, reason: 'compatible' }
);

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(core.evaluateTaskRestore({
    id: 'task-running-orphan',
    status: 'running',
    workspaceId: 'xmind-workspace-running',
    restoreContext: {
      workspaceId: 'xmind-workspace-running',
      workspaceGenerationId: generationIdA,
      requirementLabel: '后台恢复需求',
      rawText: '后台任务仍在生成。',
    },
  }, null))),
  { allowed: true, recreateWorkspace: true, reason: 'running-workspace-recovery' }
);
assert.strictEqual(core.evaluateTaskRestore({
  id: 'task-terminal-orphan',
  status: 'done',
  workspaceId: 'xmind-workspace-deleted',
  restoreContext: {
    workspaceId: 'xmind-workspace-deleted',
    requirementLabel: '已删除需求',
    rawText: '不应恢复。',
  },
}, null).allowed, false);
assert.strictEqual(core.evaluateTaskRestore({
  id: 'task-terminal-orphan',
  status: 'done',
  workspaceId: 'xmind-workspace-deleted',
  restoreContext: {
    workspaceId: 'xmind-workspace-deleted',
  },
}, null).reason, 'terminal-workspace-missing');

assert.strictEqual(core.areRestoreContextsCompatible(
  matchingTask.restoreContext,
  staleGenerationTask.restoreContext
), false);
assert.strictEqual(core.areRestoreContextsCompatible(
  matchingTask.restoreContext,
  Object.assign({}, matchingTask.restoreContext, { caseGenResults: { moduleA: '[]' } })
), true);

var indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
var workflowHtml = fs.readFileSync(path.join(projectRoot, 'ai-workflow.html'), 'utf8');
['index.html', 'ai-workflow.html'].forEach(function(fileName) {
  var html = fileName === 'index.html' ? indexHtml : workflowHtml;
  var recoveryIndex = html.indexOf('./scripts/core/xmindWorkspaceRecoveryCore.js');
  var casegenIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
  assert.ok(recoveryIndex >= 0 && recoveryIndex < casegenIndex, fileName + ' must load recovery core before XMind casegen');
});

console.log('xmind_workspace_recovery_core.test.js passed');
