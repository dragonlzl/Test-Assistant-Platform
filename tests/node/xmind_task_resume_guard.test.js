'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var appSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app.js'), 'utf8');
var workflowHtml = fs.readFileSync(path.join(projectRoot, 'ai-workflow.html'), 'utf8');
var caseLibraryHtml = fs.readFileSync(path.join(projectRoot, 'case-library.html'), 'utf8');

assert.match(appSource, /function canResumeTaskRequests\(\)\s*\{[\s\S]*?requestScheduler[\s\S]*?requestScheduler\.acquire/);
assert.match(appSource, /function resumeTasks\(options\)\s*\{\s*if \(!canResumeTaskRequests\(\)\) return 0;/);
assert.match(appSource, /function resumeOrphanedTasks\(\)\s*\{\s*if \(!canResumeTaskRequests\(\)\) return 0;/);

var workflowSchedulerIndex = workflowHtml.indexOf('./scripts/core/xmindRequestSchedulerCore.js');
var workflowAppIndex = workflowHtml.indexOf('./scripts/modules/app.js');
assert.ok(workflowSchedulerIndex >= 0 && workflowSchedulerIndex < workflowAppIndex);
assert.ok(caseLibraryHtml.indexOf('./scripts/modules/app.js') >= 0);
assert.strictEqual(caseLibraryHtml.indexOf('./scripts/core/xmindRequestSchedulerCore.js'), -1);

console.log('xmind_task_resume_guard.test.js passed');
