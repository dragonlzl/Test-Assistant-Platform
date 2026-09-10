'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var appSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app.js'), 'utf8');
var xmindSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
var knowledgeSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindKnowledgeBase.js'), 'utf8');
var workflowHtml = fs.readFileSync(path.join(projectRoot, 'ai-workflow.html'), 'utf8');
var caseLibraryHtml = fs.readFileSync(path.join(projectRoot, 'case-library.html'), 'utf8');

assert.match(appSource, /function canResumeTaskRequests\(\)\s*\{[\s\S]*?requestScheduler[\s\S]*?requestScheduler\.acquire/);
assert.match(appSource, /function resumeTasks\(options\)\s*\{\s*if \(!canResumeTaskRequests\(\)\) return 0;/);
assert.match(appSource, /function resumeOrphanedTasks\(\)\s*\{\s*if \(!canResumeTaskRequests\(\)\) return 0;/);
assert.match(appSource, /function createDeferredTask\(payload\)[\s\S]*?preparationPending = true;/);
assert.match(appSource, /function activateTask\(taskId, patch, options\)[\s\S]*?preparationPending = false;/);
assert.match(appSource, /function startTask\(task, options\)[\s\S]*?if \(active\.preparationPending === true\) return Promise\.resolve\(active\);/);
assert.match(appSource, /function resumeTasks\(options\)[\s\S]*?if \(task\.preparationPending === true\) return;/);
assert.match(appSource, /function resumeOrphanedTasks\(\)[\s\S]*?if \(task\.preparationPending === true\) return;/);
assert.match(appSource, /requestPayloadCompacted = true;/);
assert.match(appSource, /serialized\.compactedPayload === true/);
assert.strictEqual(
  (appSource.match(/remoteId: model\.remoteId !== undefined && model\.remoteId !== null \? model\.remoteId : null/g) || []).length,
  3
);
assert.match(xmindSource, /startPreparedManagedXmindTask\([\s\S]*?createAndStart\(taskPayload\)\.task/);
assert.match(xmindSource, /resumePendingTasks\(tasks\)[\s\S]*?manager\.resumeTasks/);
assert.match(knowledgeSource, /catalog-batch-/);
assert.match(knowledgeSource, /catalog-merge/);
assert.match(knowledgeSource, /section-selection/);

var workflowSchedulerIndex = workflowHtml.indexOf('./scripts/core/xmindRequestSchedulerCore.js');
var workflowPreparationIndex = workflowHtml.indexOf('./scripts/core/retainedPreparationTask.js');
var workflowXmindModuleIndex = workflowHtml.indexOf('./scripts/modules/xmindCasegen.js');
var workflowAppIndex = workflowHtml.indexOf('./scripts/modules/app.js');
assert.ok(workflowSchedulerIndex >= 0 && workflowSchedulerIndex < workflowAppIndex);
assert.ok(workflowPreparationIndex >= 0 && workflowPreparationIndex < workflowXmindModuleIndex);
assert.ok(caseLibraryHtml.indexOf('./scripts/modules/app.js') >= 0);
assert.ok(caseLibraryHtml.indexOf('./scripts/core/xmindRequestSchedulerCore.js') >= 0);
assert.ok(caseLibraryHtml.indexOf('./scripts/modules/xmindCasegen.js') >= 0);

console.log('xmind_task_resume_guard.test.js passed');
