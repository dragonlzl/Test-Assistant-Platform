'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var appSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app.js'), 'utf8');
var runtimeSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/appRuntime.js'), 'utf8');
var prepSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/casePageAiGenPrep.js'), 'utf8');
var librarySource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/caseLibrary.js'), 'utf8');
var execSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');

var caseManagerStart = appSource.indexOf("const storagePrefix = 'tap-case-library-ai-gen-task:'");
var xmindManagerStart = appSource.indexOf("const storageKey = 'tap-xmind-casegen-tasks'");
assert.ok(caseManagerStart >= 0 && xmindManagerStart > caseManagerStart);
var caseManagerSource = appSource.slice(caseManagerStart, xmindManagerStart);

assert.match(caseManagerSource, /function createDeferredTask\(scene, payload\)[\s\S]*?preparationPending = true;/);
assert.match(caseManagerSource, /function activateTask\(scene, taskId, patch, options\)[\s\S]*?preparationPending = false;/);
assert.match(caseManagerSource, /function startTask\(scene, task, options\)[\s\S]*?if \(active\.preparationPending === true\) return Promise\.resolve\(active\);/);
assert.match(caseManagerSource, /task\.preparationPending !== true/);
assert.match(caseManagerSource, /remoteId: model\.remoteId !== undefined && model\.remoteId !== null \? model\.remoteId : null/);

var confirmStart = prepSource.indexOf('async function confirmAndBuild(scene)');
var generationContextStart = prepSource.indexOf('function buildGenerationContext', confirmStart);
var confirmSource = prepSource.slice(confirmStart, generationContextStart);
assert.ok(confirmStart >= 0 && generationContextStart > confirmStart);
assert.strictEqual(confirmSource.indexOf('await runKnowledgeBase('), -1);
assert.match(confirmSource, /后台任务已创建/);
assert.match(prepSource, /function prepareManagedGenerationTask\(task, preparationContext\)/);
assert.match(prepSource, /function resumeManagedPreparations\(\)/);
assert.match(prepSource, /buildRequestOptions: preparationContext/);
assert.match(prepSource, /userText: ''[\s\S]*?xmindPipeline: null/);

assert.match(librarySource, /startManagedGenerationTask\('case-library', taskPayload\)/);
assert.match(execSource, /startManagedGenerationTask\('temp-exec', taskPayload\)/);
assert.match(runtimeSource, /casePageAiGenPrep\.init\([\s\S]*?casePageAiGenPrepApi = casePageAiGenPrepApi/);

['case-library.html', 'case-exec.html', 'ai-workflow.html'].forEach(function(fileName) {
  var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
  var coordinatorIndex = html.indexOf('./scripts/core/retainedPreparationTask.js');
  var prepIndex = html.indexOf('./scripts/modules/casePageAiGenPrep.js');
  var appIndex = html.indexOf('./scripts/modules/app.js');
  assert.ok(coordinatorIndex >= 0 && coordinatorIndex < prepIndex, fileName + ' 缺少准备协调器或顺序错误');
  assert.ok(prepIndex >= 0 && prepIndex < appIndex, fileName + ' 生成准备模块顺序错误');
});

console.log('case_page_preparation_resume_guard.test.js passed');
