'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var appSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/app.js'), 'utf8');
var entryPages = [
  'index.html',
  'ai-tools.html',
  'ai-workflow.html',
  'case-exec.html',
  'case-library.html',
  'admin.html',
  'settings.html',
];
var moduleSpecs = [
  {
    file: 'appConfigContext.js',
    globalName: 'appConfigContext',
    removedPattern: /const providerDefaults = appConfig\.providerDefaults/,
    createCallPattern: /window\.app\.appConfigContext\.create\(appConfig\)/,
  },
  {
    file: 'appDomContext.js',
    globalName: 'appDomContext',
    removedPattern: /function ensureAutoWorkflowGhostFields\(/,
  },
  {
    file: 'appTaskLifecycleController.js',
    globalName: 'appTaskLifecycleController',
    removedPattern: /function syncMissingReminderAiTasks\(/,
  },
  {
    file: 'modelRuntime.js',
    globalName: 'modelRuntime',
    removedPattern: /function wrapCallModelWithTracking\(/,
  },
  {
    file: 'requirementMediaContextController.js',
    globalName: 'requirementMediaContextController',
    removedPattern: /function ensureMediaContextHintElement\(/,
  },
  {
    file: 'xmindAssetLoader.js',
    globalName: 'xmindAssetLoader',
    removedPattern: /const loadLocalScriptOnce = function/,
  },
  {
    file: 'workflowStepStateController.js',
    globalName: 'workflowStepStateController',
    removedPattern: /function ensureInProgressMap\(/,
  },
  {
    file: 'workflowValidationController.js',
    globalName: 'workflowValidationController',
    removedPattern: /function pickCoveragePayload\(/,
  },
  {
    file: 'workflowResetController.js',
    globalName: 'workflowResetController',
    removedPattern: /function createEmptyRequirementMediaState\(/,
  },
];
var fullLoadOrder = moduleSpecs.map(function(spec) { return spec.file; }).concat([
  'persistentModelTaskManager.js',
  'missingReminderAiManager.js',
  'caseLibraryAiGenManager.js',
  'xmindCaseGenTaskStore.js',
  'xmindCaseGenTaskManager.js',
  'autoWorkflowManager.js',
]);

moduleSpecs.forEach(function(spec) {
  var modulePath = path.join(projectRoot, 'scripts/modules/app', spec.file);
  var moduleSource = fs.readFileSync(modulePath, 'utf8');
  var moduleApi = require(modulePath);
  assert.strictEqual(typeof moduleApi.create, 'function', spec.file + ' should export create');
  assert.match(moduleSource, new RegExp('window\\.app\\.' + spec.globalName + ' = api'));
  assert.ok(!spec.removedPattern.test(appSource), spec.file + ' implementation should leave app.js');
  assert.match(
    appSource,
    spec.createCallPattern || new RegExp('window\\.app\\.' + spec.globalName + '\\.create\\(\\{')
  );
});

entryPages.forEach(function(page) {
  var source = fs.readFileSync(path.join(projectRoot, page), 'utf8');
  var previousIndex = -1;
  fullLoadOrder.forEach(function(file) {
    var currentIndex = source.indexOf('./scripts/modules/app/' + file);
    assert.ok(currentIndex > previousIndex, page + ' should load ' + file + ' in order');
    previousIndex = currentIndex;
  });
  assert.ok(source.indexOf('./scripts/modules/app.js') > previousIndex, page + ' should load app.js last');
});

async function verifyModelRuntime() {
  var root = { app: {} };
  var capturedOptions = null;
  var callCount = 0;
  var service = {
    createModelClient: function(options) {
      capturedOptions = options;
      return {
        callModelWithConfig: function() {
          callCount += 1;
          if (callCount === 1) return Promise.resolve('ok');
          return Promise.reject(Object.assign(new Error('model failed'), { name: 'ModelError' }));
        },
        callModelWithContent: function() { return Promise.resolve('content'); },
        abortAllRequests: function() { return 7; },
        abortRequestsByOwner: function() { return 2; },
      };
    },
  };
  var runtime = require(path.join(projectRoot, 'scripts/modules/app/modelRuntime.js')).create({
    root: root,
    state: { settings: { timeoutSec: 45 } },
    defaultSettings: { timeoutSec: 300 },
    modelClientService: service,
  });
  assert.strictEqual(capturedOptions.getTimeoutSec(), 45);
  assert.strictEqual(capturedOptions.modelIsR1({ model: 'DeepSeek-R1' }), true);
  assert.strictEqual(await runtime.callModelWithConfig(), 'ok');
  assert.strictEqual(runtime.getLastModelError(), null);
  await assert.rejects(runtime.callModelWithConfig(), /model failed/);
  assert.strictEqual(runtime.getLastModelError().message, 'model failed');
  assert.strictEqual(runtime.abortAllModelRequests(), 7);
  assert.strictEqual(runtime.abortModelRequestsByOwner('owner'), 2);
}

function verifyMediaContextController() {
  var controller = require(
    path.join(projectRoot, 'scripts/modules/app/requirementMediaContextController.js')
  ).create({
    state: {
      requirementMedia: {
        docxImages: [{ blob: true }, {}],
        pastedImages: [{ file: true }],
      },
    },
    dom: {},
    getAssignedModel: function() {
      return { name: 'vision-model', capabilities: ['Vision', 'image', 'vision'] };
    },
  });
  assert.deepStrictEqual(controller.getRequirementImageStats(), { total: 2, docx: 1, pasted: 1 });
  assert.deepStrictEqual(
    controller.normalizeModelCapabilityList({ capabilities: 'Vision, image, vision' }),
    ['Vision', 'image']
  );
  assert.strictEqual(controller.capabilitySupportsImage(['multimodal']), true);
  assert.strictEqual(controller.resolveModelImageCapability('review').supportsImage, true);
  controller.update();
}

async function verifyXmindAssetLoader() {
  var root = {
    app: {
      xmindCoreApi: {
        buildTempExecXmindPackage: function() { return 'temp-package'; },
        buildXmindPackageFromCases: function() { return 'cases-package'; },
      },
    },
    location: { href: 'http://test.local/app/index.html' },
  };
  var loader = require(path.join(projectRoot, 'scripts/modules/app/xmindAssetLoader.js')).create({
    root: root,
    xmindCore: {
      parseXmindFile: function(file) { return Promise.resolve({ text: file.name, list: [] }); },
    },
    extractRequirementLabelFromText: function(text) { return 'label:' + text; },
  });
  assert.strictEqual(loader.resolveAssetUrl('./x.js'), 'http://test.local/app/x.js');
  assert.strictEqual((await loader.lazyParseXmindFile({ name: 'sample' })).text, 'sample');
  assert.strictEqual(loader.lazyExtractRequirementLabel('raw'), 'label:raw');
  assert.strictEqual(await loader.lazyBuildTempExecXmindPackage({}, ''), 'temp-package');
  assert.strictEqual(await loader.lazyBuildCasesXmindPackage([], '', ''), 'cases-package');
  assert.strictEqual(root.app.ensureMindElixirCoreApi, loader.ensureMindElixirCoreApi);
}

function verifyWorkflowStepStateController() {
  var state = {};
  var updateCount = 0;
  var controller = require(
    path.join(projectRoot, 'scripts/modules/app/workflowStepStateController.js')
  ).create({
    state: state,
    api: { updateFlowStatus: function() { updateCount += 1; } },
  });
  controller.setStepWaiting('review', '等待确认');
  assert.strictEqual(typeof controller.triggerUpdateFlowStatus, 'function');
  assert.strictEqual(state.waitingSteps.review, true);
  assert.strictEqual(state.waitingReasons.review, '等待确认');
  assert.strictEqual(controller.isStepLocked('review'), true);
  controller.setStepInProgress('review');
  assert.strictEqual(state.waitingSteps.review, undefined);
  assert.strictEqual(state.inProgressSteps.review, true);
  controller.setStepFailed('clean', '清洗失败');
  assert.strictEqual(state.failedReasons.clean, '清洗失败');
  controller.clearAllFailedSteps();
  assert.deepStrictEqual(state.failedSteps, {});
  assert.ok(updateCount >= 4);
}

function verifyBootstrapContextOwners() {
  var configContext = require(path.join(projectRoot, 'scripts/modules/app/appConfigContext.js'));
  var domContext = require(path.join(projectRoot, 'scripts/modules/app/appDomContext.js'));
  var lifecycleController = require(
    path.join(projectRoot, 'scripts/modules/app/appTaskLifecycleController.js')
  );
  assert.strictEqual(typeof configContext.create, 'function');
  assert.strictEqual(typeof domContext.create, 'function');
  assert.strictEqual(typeof lifecycleController.create, 'function');
}

async function main() {
  verifyBootstrapContextOwners();
  await verifyModelRuntime();
  verifyMediaContextController();
  await verifyXmindAssetLoader();
  verifyWorkflowStepStateController();
  console.log('app_runtime_owner_modules.test.js passed');
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
