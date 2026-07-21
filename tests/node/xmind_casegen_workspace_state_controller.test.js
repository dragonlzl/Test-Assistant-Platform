const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const stateModelFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenStateModel.js'
));
const controllerFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenWorkspaceStateController.js'
));

function cloneJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return fallback;
  }
}

function createHarness(options) {
  var opts = options || {};
  var nowValue = Number(opts.now || 1000);
  var generatedId = 0;
  var stateModel = stateModelFactory.create({
    cloneJson: cloneJson,
    now: function() { return nowValue; },
  });
  var state = opts.state || {
    xmindCaseGen: stateModel.createInitialXmindState(),
  };
  var liveSnapshot = stateModel.normalizeWorkspaceSnapshot(opts.liveSnapshot);
  var environment = {
    importedBaseline: opts.importedBaseline === true,
    drawerOpen: opts.drawerOpen !== false,
    drawerFullscreen: opts.drawerFullscreen === true,
    pageSuspending: opts.pageSuspending === true,
    shadowDepth: Number(opts.shadowDepth || 0),
  };
  var calls = {
    capture: [],
    applyShared: [],
    syncSummaryDraft: 0,
    drawerState: [],
    postHydrate: 0,
    persistDeferred: 0,
    persistImmediate: 0,
    syncRestoreContexts: 0,
    clearedTasks: [],
  };
  var taskManager = {
    clearTasksForWorkspace: function(workspaceId, taskOptions) {
      calls.clearedTasks.push({ workspaceId: workspaceId, options: taskOptions });
      return 2;
    },
  };
  var recoveryCore = {
    createWorkspaceId: function(seq) {
      return 'workspace-' + String(seq);
    },
    createWorkspaceGenerationId: function() {
      generatedId += 1;
      return 'generation-' + String(generatedId);
    },
  };
  var controller = controllerFactory.create({
    state: state,
    stateModel: stateModel,
    cloneJson: cloneJson,
    now: function() { return nowValue; },
    random: function() { return 0.25; },
    snapshotPort: {
      ensureActiveState: function() {
        if (!state.xmindCaseGen || typeof state.xmindCaseGen !== 'object') {
          state.xmindCaseGen = stateModel.createInitialXmindState();
        }
        return state.xmindCaseGen;
      },
      captureCurrent: function(captureOptions) {
        calls.capture.push(cloneJson(captureOptions || {}, {}));
        return stateModel.normalizeWorkspaceSnapshot(liveSnapshot);
      },
      applyShared: function(snapshot) {
        calls.applyShared.push(stateModel.normalizeWorkspaceSharedState(snapshot));
      },
      syncSummaryDraft: function() {
        calls.syncSummaryDraft += 1;
      },
      setDrawerState: function(drawerOpen, fullscreen) {
        calls.drawerState.push({ drawerOpen: drawerOpen, fullscreen: fullscreen });
        state.xmindCaseGen.viewState.drawerOpen = drawerOpen === true;
        state.xmindCaseGen.viewState.fullscreen = fullscreen === true;
      },
      postHydrate: function() {
        calls.postHydrate += 1;
      },
    },
    persistencePort: {
      persistDeferred: function() { calls.persistDeferred += 1; },
      persistImmediate: function() { calls.persistImmediate += 1; },
      syncRestoreContexts: function() { calls.syncRestoreContexts += 1; },
    },
    environmentPort: {
      hasImportedBaseline: function() { return environment.importedBaseline; },
      isDrawerOpen: function() { return environment.drawerOpen; },
      isDrawerFullscreen: function() { return environment.drawerFullscreen; },
      isPageSuspending: function() { return environment.pageSuspending; },
      getShadowDepth: function() { return environment.shadowDepth; },
    },
    getTaskManager: function() { return taskManager; },
    getRecoveryCore: function() { return recoveryCore; },
    deriveLiveWorkspaceName: function(fallback) { return 'live:' + fallback; },
    normalizeRequirementLabelFromFileName: function(fileName) {
      return String(fileName || '').replace(/\.[^.]+$/, '');
    },
  });

  return {
    calls: calls,
    controller: controller,
    environment: environment,
    setLiveSnapshot: function(snapshot) {
      liveSnapshot = stateModel.normalizeWorkspaceSnapshot(snapshot);
    },
    setNow: function(value) { nowValue = Number(value); },
    state: state,
    stateModel: stateModel,
  };
}

function verifyHostAndActiveSnapshotOwnership() {
  var harness = createHarness({
    state: {
      xmindCaseGen: {
        mode: 'full',
        workspaceOrder: ['second', 'first', 'second'],
        workspaces: {
          first: { seq: 1, name: 'first', snapshot: {} },
          second: { seq: 2, name: 'second', snapshot: {} },
          third: { seq: 3, name: 'third', snapshot: {} },
        },
        activeWorkspaceId: 'missing',
        mirrorWorkspaceId: 'missing',
        nextWorkspaceSeq: 4,
      },
    },
  });
  var controller = harness.controller;
  var host = controller.ensureWorkspaceHostState();
  assert.deepStrictEqual(host.workspaceOrder, ['second', 'first', 'third']);
  assert.strictEqual(host.activeWorkspaceId, 'second');
  assert.strictEqual(host.mirrorWorkspaceId, 'second');
  assert.strictEqual(host.workspaces.first.generationId, 'generation-2');

  var extracted = controller.extractActiveXmindStateSnapshot();
  assert.strictEqual(extracted.mode, 'full');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(extracted, 'workspaces'), false);
  controller.applyActiveXmindStateSnapshot({ mode: 'modules', history: [{ id: 'history-1' }] });
  assert.strictEqual(harness.state.xmindCaseGen.mode, 'modules');
  assert.strictEqual(harness.state.xmindCaseGen.history.length, 1);
  assert.deepStrictEqual(harness.state.xmindCaseGen.workspaceOrder, ['second', 'first', 'third']);
}

function verifyWorkspaceCreateSaveAndProtection() {
  var harness = createHarness({
    liveSnapshot: { shared: { rawText: '需求正文' } },
  });
  var controller = harness.controller;
  var workspaceId = controller.ensureWorkspaceRecordFromCurrentContent();
  assert.strictEqual(workspaceId, 'workspace-1');
  assert.strictEqual(controller.getActiveWorkspaceId(), workspaceId);
  assert.strictEqual(controller.getMirrorWorkspaceId(), workspaceId);
  assert.strictEqual(controller.getWorkspaceRecord(workspaceId).name, 'live:生成1');

  harness.setNow(2000);
  harness.setLiveSnapshot({
    xmind: { history: [{ id: 'history-new' }] },
    shared: { caseGenModules: [{ id: 'module-new' }] },
  });
  assert.strictEqual(controller.saveActiveWorkspaceSnapshot(), true);
  assert.strictEqual(controller.getWorkspaceRecord(workspaceId).updatedAt, 2000);
  assert.strictEqual(controller.getWorkspaceRecord(workspaceId).snapshot.shared.caseGenModules.length, 1);
  assert.strictEqual(harness.calls.syncSummaryDraft, 1);

  harness.setLiveSnapshot({
    xmind: { history: [{ id: 'history-replacement' }] },
    shared: { caseGenModules: [{ id: 'module-new' }] },
  });
  controller.saveActiveWorkspaceSnapshot({
    forceShared: true,
    preserveExistingXmind: true,
    overrideViewState: {
      drawerOpen: true,
      fullscreen: true,
      transform: 'matrix(1,0,0,1,10,20)',
      hasManualViewport: true,
    },
  });
  var preservedXmind = controller.getWorkspaceRecord(workspaceId).snapshot.xmind;
  assert.strictEqual(preservedXmind.history[0].id, 'history-new');
  assert.strictEqual(preservedXmind.viewState.transform, 'matrix(1,0,0,1,10,20)');

  harness.environment.pageSuspending = true;
  harness.setLiveSnapshot({ shared: {} });
  controller.saveActiveWorkspaceSnapshot();
  assert.strictEqual(controller.getWorkspaceRecord(workspaceId).snapshot.shared.caseGenModules.length, 1);

  harness.environment.pageSuspending = false;
  harness.environment.drawerOpen = false;
  harness.setLiveSnapshot({ shared: { rawText: '不应覆盖抽屉快照' } });
  controller.saveActiveWorkspaceSnapshot();
  assert.strictEqual(controller.getWorkspaceRecord(workspaceId).snapshot.shared.rawText, '');

  assert.strictEqual(controller.captureWorkspaceSnapshot(workspaceId).xmind.history.length, 0);
  assert.ok(harness.calls.syncSummaryDraft >= 4);
}

function verifyHydrateResetAndNames() {
  var harness = createHarness({ drawerFullscreen: true });
  var controller = harness.controller;
  var host = controller.ensureWorkspaceHostState();
  var record = controller.createWorkspaceRecord('workspace-1', {
    seq: 1,
    name: '登录需求',
    snapshot: {
      xmind: { mode: 'full', history: [{ id: 'history-1' }] },
      shared: { lastRawImportName: 'login.docx' },
    },
  });
  host.workspaceOrder.push(record.id);
  host.workspaces[record.id] = record;
  host.activeWorkspaceId = record.id;
  host.mirrorWorkspaceId = record.id;

  assert.strictEqual(controller.hydrateWorkspaceSnapshot(record.id, { keepDrawerOpen: true }), true);
  assert.strictEqual(harness.calls.applyShared[0].requirementLabel, '登录需求');
  assert.strictEqual(harness.calls.applyShared[0].requirementLabelSource, 'workspace');
  assert.deepStrictEqual(harness.calls.drawerState[0], { drawerOpen: true, fullscreen: true });
  assert.strictEqual(harness.calls.postHydrate, 1);
  var hydratedRecord = controller.getWorkspaceRecord(record.id);
  assert.strictEqual(controller.buildWorkspaceDisplayName(hydratedRecord), '登录需求');

  assert.strictEqual(controller.resetActiveWorkspaceRecordNameToDefault(), true);
  hydratedRecord = controller.getWorkspaceRecord(record.id);
  assert.strictEqual(hydratedRecord.name, '生成1');
  assert.strictEqual(controller.buildWorkspaceDisplayName(hydratedRecord), 'login');
  assert.strictEqual(controller.resetActiveWorkspaceRecordSnapshotToInitial(false, false), true);
  hydratedRecord = controller.getWorkspaceRecord(record.id);
  assert.strictEqual(hydratedRecord.snapshot.xmind.viewState.drawerOpen, false);
}

function verifyPersistenceGenerationAndTasks() {
  var harness = createHarness({
    importedBaseline: true,
    liveSnapshot: { shared: { rawText: '需求正文' } },
  });
  var controller = harness.controller;
  var workspaceId = controller.ensureWorkspaceRecordFromCurrentContent();
  var previousGeneration = controller.getWorkspaceRecord(workspaceId).generationId;

  controller.persistXmindState(false);
  assert.strictEqual(harness.state.xmindCaseGen.hasImportedBaseline, true);
  assert.strictEqual(harness.calls.persistDeferred, 1);
  assert.strictEqual(harness.calls.persistImmediate, 0);
  controller.persistManagedTaskWorkspaceState(true);
  assert.strictEqual(harness.calls.persistImmediate, 1);
  assert.strictEqual(harness.calls.syncRestoreContexts, 1);

  assert.strictEqual(controller.clearManagedTasksForWorkspace(workspaceId, {
    includeRunning: true,
    action: 'test-clear',
  }), 2);
  assert.deepStrictEqual(harness.calls.clearedTasks[0], {
    workspaceId: workspaceId,
    options: { includeRunning: true, action: 'test-clear' },
  });
  assert.notStrictEqual(controller.rotateWorkspaceGeneration(workspaceId), previousGeneration);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'persistXmindState',
    'persistManagedTaskWorkspaceState',
    'extractActiveXmindStateSnapshot',
    'applyActiveXmindStateSnapshot',
    'buildWorkspaceId',
    'buildWorkspaceGenerationId',
    'createWorkspaceRecord',
    'normalizeWorkspaceRecord',
    'getWorkspaceHostState',
    'isDefaultWorkspaceRecordName',
    'buildDefaultWorkspaceRecordName',
    'resetActiveWorkspaceRecordNameToDefault',
    'resetActiveWorkspaceRecordSnapshotToInitial',
    'captureWorkspaceSnapshot',
    'ensureWorkspaceHostState',
    'getActiveWorkspaceId',
    'getMirrorWorkspaceId',
    'getWorkspaceUiSelectedId',
    'setMirrorWorkspaceSelection',
    'getWorkspaceRecord',
    'clearManagedTasksForWorkspace',
    'rotateWorkspaceGeneration',
    'ensureWorkspaceRecordFromCurrentContent',
    'saveActiveWorkspaceSnapshot',
    'hydrateWorkspaceSnapshot',
    'buildWorkspaceDisplayName',
  ].forEach(function(name) {
    assert.ok(
      parentSource.indexOf('function ' + name + '(') === -1,
      name + ' must be owned by xmindCasegenWorkspaceStateController'
    );
  });
  [
    'primeLegacyWorkflowContextForClose',
    'buildLegacyRestoreSignature',
    'shouldApplyDrawerLegacyRestoreSnapshot',
    'collectRootPipelineTerminalTasks',
    'hasManualRequirementContent',
    'hasDocumentRequirementContent',
    'getRequirementContextText',
    'buildRequirementSummaryInfo',
    'buildSummaryCardsHtml',
    'buildKnowledgeBaseVisibleModuleSummary',
    'buildKnowledgeBaseVisibleCaseSummary',
    'resolveTopupHighlightHost',
    'hasAnyVisibleContent',
    'hasOnlyAiModuleSkeleton',
    'applyDrawerOpenLayoutState',
  ].forEach(function(name) {
    assert.ok(parentSource.indexOf('function ' + name + '(') === -1, name + ' must remain retired');
  });
  assert.match(parentSource, /function buildVisibleModuleContextFromSources\(/);
  var snapshotContextSource = parentSource.slice(
    parentSource.indexOf('function buildWorkspaceVisibleModuleContextFromSnapshot('),
    parentSource.indexOf('function summarizeVisibleModuleContext(')
  );
  var liveContextSource = parentSource.slice(
    parentSource.indexOf('function buildVisibleModuleContext('),
    parentSource.indexOf('function ensureVisibleModuleContext(')
  );
  assert.match(snapshotContextSource, /return buildVisibleModuleContextFromSources\(/);
  assert.match(liveContextSource, /return buildVisibleModuleContextFromSources\(/);
  assert.ok(/workspaceStateControllerFactory\.create\(/.test(parentSource));

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var stateModelIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenStateModel.js');
    var controllerIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenWorkspaceStateController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(
      stateModelIndex >= 0 && stateModelIndex < controllerIndex && controllerIndex < parentIndex,
      fileName + ' must load state model and workspace controller before parent'
    );
  });
}

verifyHostAndActiveSnapshotOwnership();
verifyWorkspaceCreateSaveAndProtection();
verifyHydrateResetAndNames();
verifyPersistenceGenerationAndTasks();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen workspace state controller tests passed');
