'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var appSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app.js'), 'utf8');
var taskManagerSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindCaseGenTaskManager.js'),
  'utf8'
);
var taskStoreSource = fs.readFileSync(
  path.join(projectRoot, 'scripts/modules/app/xmindCaseGenTaskStore.js'),
  'utf8'
);
var workflowHtml = fs.readFileSync(path.join(projectRoot, 'ai-workflow.html'), 'utf8');
var caseLibraryHtml = fs.readFileSync(path.join(projectRoot, 'case-library.html'), 'utf8');

assert.ok(!/function initXmindCaseGenTaskManager\(/.test(appSource));
assert.match(appSource, /window\.app\.xmindCaseGenTaskManagerModule\.init\(\{/);
assert.match(taskStoreSource, /function compactTaskRestoreContext\(/);
assert.ok(!/function compactTaskRestoreContext\(/.test(taskManagerSource));
assert.match(taskManagerSource, /taskStoreModule\.create\(\{/);
assert.match(taskManagerSource, /function canResumeTaskRequests\(\)\s*\{[\s\S]*?requestScheduler[\s\S]*?requestScheduler\.acquire/);
assert.match(taskManagerSource, /function resumeTasks\(options\)\s*\{\s*if \(!canResumeTaskRequests\(\)\) return 0;/);
assert.match(taskManagerSource, /function resumeOrphanedTasks\(\)\s*\{\s*if \(!canResumeTaskRequests\(\)\) return 0;/);

var workflowSchedulerIndex = workflowHtml.indexOf('./scripts/core/xmindRequestSchedulerCore.js');
var workflowStoreIndex = workflowHtml.indexOf('./scripts/modules/app/xmindCaseGenTaskStore.js');
var workflowManagerIndex = workflowHtml.indexOf('./scripts/modules/app/xmindCaseGenTaskManager.js');
var workflowAppIndex = workflowHtml.indexOf('./scripts/modules/app.js');
assert.ok(workflowSchedulerIndex >= 0 && workflowSchedulerIndex < workflowManagerIndex);
assert.ok(workflowStoreIndex >= 0 && workflowStoreIndex < workflowManagerIndex);
assert.ok(workflowManagerIndex < workflowAppIndex);
assert.ok(
  caseLibraryHtml.indexOf('./scripts/modules/app/xmindCaseGenTaskStore.js')
    < caseLibraryHtml.indexOf('./scripts/modules/app/xmindCaseGenTaskManager.js')
);
assert.ok(
  caseLibraryHtml.indexOf('./scripts/modules/app/xmindCaseGenTaskManager.js')
    < caseLibraryHtml.indexOf('./scripts/modules/app.js')
);

console.log('xmind_task_resume_guard.test.js passed');
