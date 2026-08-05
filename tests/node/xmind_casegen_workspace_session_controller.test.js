'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var factory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenWorkspaceSessionController.js'
));

function cloneJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function createViewState() {
  return {
    drawerOpen: true,
    fullscreen: false,
    transform: '',
    scaleVal: 1,
    scrollLeft: 0,
    scrollTop: 0,
    hasManualViewport: false,
    anchorState: null,
    collapsedNodeKeys: [],
    updatedAt: 0,
  };
}

function createSnapshot(label, moduleCount, caseCount) {
  var modules = [];
  for (var index = 0; index < moduleCount; index += 1) {
    modules.push({
      id: 'module-' + String(index + 1),
      title: '模块' + String(index + 1),
      cases: new Array(caseCount).fill(null).map(function(_, caseIndex) {
        return { title: '用例' + String(caseIndex + 1) };
      }),
    });
  }
  return {
    xmind: {
      prep: { completed: true, requirementMode: 'document' },
      viewState: createViewState(),
      summaryResultKind: '',
    },
    shared: {
      requirementLabel: label,
      requirementLabelSource: 'document',
      rawText: label,
      caseText: '',
      importedCases: [],
      caseGenModules: modules,
      caseGenResults: {},
      caseSelections: {},
      caseGenSuggestions: {},
      caseGenModuleStatus: {},
      caseGenProgress: {},
      caseGenTiming: {},
      caseGenProgressNotice: {},
      caseGenSettings: { activeTab: 'xmind-modules', storeMode: 'new' },
      requirementMedia: {},
    },
  };
}

function createHarness() {
  var host = {
    activeWorkspaceId: 'workspace-1',
    mirrorWorkspaceId: 'workspace-1',
    workspaceOrder: ['workspace-1', 'workspace-2'],
    nextWorkspaceSeq: 3,
    workspaces: {
      'workspace-1': {
        id: 'workspace-1',
        seq: 1,
        name: '需求一',
        pendingOpenPrep: false,
        snapshot: createSnapshot('需求一', 1, 2),
      },
      'workspace-2': {
        id: 'workspace-2',
        seq: 2,
        name: '需求二',
        pendingOpenPrep: false,
        snapshot: createSnapshot('需求二', 2, 1),
      },
    },
  };
  var state = {
    activeTab: 'casesgen',
    requirementLabel: '需求一',
    requirementLabelSource: 'document',
    lastRawImportName: '',
    importedCases: [],
    caseGenModules: cloneJson(host.workspaces['workspace-1'].snapshot.shared.caseGenModules, []),
    caseGenSource: '',
    caseGenResults: {},
    caseSelections: {},
    caseGenSuggestions: {},
    caseGenModuleStatus: {},
    caseGenProgress: {},
    caseGenTiming: {},
    caseGenProgressNotice: {},
    caseGenSettings: { activeTab: 'xmind-modules', storeMode: 'new' },
    requirementMedia: {},
    xmindCaseGen: host,
  };
  var elements = {
    rawText: { value: '需求一正文' },
    caseText: { value: '' },
    fileName: { textContent: '未选择文件' },
    fileInput: { value: '' },
    caseFileInput: { value: '' },
  };
  var workspaceListEl = { innerHTML: '' };
  var workspaceAddBtn = {
    disabled: false,
    textContent: '',
    title: '',
    classList: { toggle: function() {} },
  };
  var calls = {
    hydrate: [],
    persist: 0,
    render: [],
    openPrep: [],
    notices: [],
    cleared: [],
  };
  var runningTasks = [];
  var activeXmind = cloneJson(host.workspaces['workspace-1'].snapshot.xmind, {});
  var shadowShared = null;

  function normalizeShared(value) {
    return Object.assign({
      requirementLabel: '',
      requirementLabelSource: '',
      lastRawImportName: '',
      rawText: '',
      caseText: '',
      importedCases: [],
      caseGenModules: [],
      caseGenResults: {},
      caseSelections: {},
      caseGenSuggestions: {},
      caseGenModuleStatus: {},
      caseGenProgress: {},
      caseGenTiming: {},
      caseGenProgressNotice: {},
      caseGenSettings: { activeTab: 'xmind-modules', storeMode: 'new' },
      requirementMedia: {},
    }, cloneJson(value, {}));
  }

  var workspace = {
    ensureState: function() { return activeXmind; },
    extractActiveXmindStateSnapshot: function() { return cloneJson(activeXmind, {}); },
    applyActiveXmindStateSnapshot: function(value) { activeXmind = cloneJson(value, {}); },
    createWorkspaceRecord: function(id, options) {
      return {
        id: id,
        seq: options.seq,
        name: options.name,
        pendingOpenPrep: options.pendingOpenPrep === true,
        snapshot: cloneJson(options.snapshot, {}),
      };
    },
    getWorkspaceHostState: function() { return host; },
    ensureWorkspaceHostState: function() { return host; },
    getActiveWorkspaceId: function() { return host.activeWorkspaceId; },
    getWorkspaceUiSelectedId: function() { return host.mirrorWorkspaceId || host.activeWorkspaceId; },
    setMirrorWorkspaceSelection: function(id) { host.mirrorWorkspaceId = id; return id; },
    getWorkspaceRecord: function(id) { return host.workspaces[id || host.activeWorkspaceId] || null; },
    captureWorkspaceSnapshot: function(id) { return host.workspaces[id] ? host.workspaces[id].snapshot : null; },
    clearManagedTasksForWorkspace: function(id, options) {
      calls.cleared.push([id, options]);
      return 1;
    },
    rotateWorkspaceGeneration: function() { return 'generation-next'; },
    saveActiveWorkspaceSnapshot: function() { return true; },
    hydrateWorkspaceSnapshot: function(id, options) {
      calls.hydrate.push([id, options]);
      host.activeWorkspaceId = id;
      host.mirrorWorkspaceId = id;
      activeXmind = cloneJson(host.workspaces[id].snapshot.xmind, {});
      return true;
    },
    buildWorkspaceDisplayName: function(record) { return record ? record.name : ''; },
    buildWorkspaceId: function(seq) { return 'workspace-' + String(seq); },
    buildDefaultWorkspaceRecordName: function(seq) { return '生成' + String(seq); },
    isDefaultWorkspaceRecordName: function(value) { return /^生成\d+$/.test(value || ''); },
    resetActiveWorkspaceRecordNameToDefault: function() { return true; },
    resetActiveWorkspaceRecordSnapshotToInitial: function() { return true; },
    persistXmindState: function() { calls.persist += 1; },
  };

  var controller = factory.create({
    state: state,
    documentObj: { getElementById: function(id) { return elements[id] || null; } },
    drawerEl: { classList: { contains: function() { return false; } } },
    workspaceListEl: workspaceListEl,
    workspaceAddBtn: workspaceAddBtn,
    workspaceLimit: 3,
    stepRequirement: 1,
    model: {
      cloneJson: cloneJson,
      cloneSelectionMap: function(value) { return cloneJson(value, {}); },
      restoreSelectionMap: function(value) { return cloneJson(value, {}); },
      normalizeWorkspaceSharedState: normalizeShared,
      cloneCaseGenSettingsValue: function(value) { return cloneJson(value, {}); },
      createDefaultCaseGenSettings: function() { return { activeTab: 'settings', storeMode: 'new' }; },
      normalizePersistedRequirementLabel: function(value) { return String(value || '').trim(); },
      normalizeRequirementLabelFromFileName: function(value) { return String(value || '').replace(/\.[^.]+$/, ''); },
      cloneRequirementMediaValue: function(value) { return cloneJson(value, {}); },
      createInitialXmindState: function() { return { prep: {}, viewState: createViewState() }; },
      createWorkspaceSnapshot: function() { return createSnapshot('', 0, 0); },
      createDefaultViewState: createViewState,
      normalizeStoredViewState: function(value) { return Object.assign(createViewState(), cloneJson(value, {})); },
      workspaceSnapshotHasContent: function(snapshot) {
        return Boolean(snapshot && snapshot.shared && (
          snapshot.shared.rawText || (snapshot.shared.caseGenModules || []).length
        ));
      },
      workspaceSnapshotHasPrepDraft: function(snapshot) {
        return Boolean(snapshot && snapshot.xmind && snapshot.xmind.prep && snapshot.xmind.prep.completed);
      },
      workspaceSnapshotHasGeneratedContent: function(snapshot) {
        return Boolean(snapshot && snapshot.shared && (snapshot.shared.caseGenModules || []).length);
      },
      summarizeVisibleModuleContext: function(context) {
        var modules = context && Array.isArray(context.modules) ? context.modules : [];
        return {
          moduleCount: modules.length,
          caseCount: modules.reduce(function(total, item) { return total + (item.cases || []).length; }, 0),
        };
      },
      buildVisibleModuleContext: function() { return { modules: state.caseGenModules || [] }; },
      buildWorkspaceVisibleModuleContextFromSnapshot: function(snapshot) {
        return { modules: snapshot && snapshot.shared ? snapshot.shared.caseGenModules || [] : [] };
      },
      escapeHtml: function(value) { return String(value || ''); },
    },
    workspace: workspace,
    view: {
      getViewState: function() { return activeXmind.viewState || createViewState(); },
      captureCurrentViewState: function() { return activeXmind.viewState || createViewState(); },
      captureVisibleMindViewStateFromDom: function() { return activeXmind.viewState || createViewState(); },
      getWorkspaceStoredViewState: function(id) { return host.workspaces[id].snapshot.xmind.viewState; },
      shouldRestoreWorkspaceViewport: function() { return false; },
      normalizeWorkspaceRenderViewState: function(value) { return value; },
    },
    tasks: {
      listManagedXmindTasks: function() { return runningTasks.slice(); },
      getTaskWorkspaceId: function(task) { return task.workspaceId; },
      filterTasksByWorkspace: function(list, id) {
        return list.filter(function(task) { return task.workspaceId === id; });
      },
      isManagedTaskTerminal: function(task) { return task.status === 'done'; },
    },
    ui: {
      syncCasesGenPageRender: function() {},
      syncCasegenProgressSidebar: function() {},
      syncOpenButtonState: function() {},
      syncKnowledgeBaseToolbarState: function() {},
      renderOpenedSummaryDialog: function() {},
      openSummaryDialog: function(step) { calls.openPrep.push(step); },
      closeSummaryDialog: function() {},
      notifyInlineStatus: function() {},
      notifyFloatingStatus: function(text) { calls.notices.push(text); },
      render: function(options) { calls.render.push(options); },
      openStoreConfirmDialog: function() { return Promise.resolve(true); },
    },
    workflow: {
      getPrepState: function() { return activeXmind.prep || {}; },
      getManualRequirementLabelText: function() { return ''; },
      getDocumentRequirementLabelText: function() { return state.requirementLabel; },
      getCasesCoreApi: function() { return null; },
      hasImportedBaselineCases: function() { return false; },
      shouldXmindOwnLiveWorkspaceState: function() { return false; },
      syncSummaryDraftIntoState: function() {},
    },
    environment: {
      getWorkspaceShadowDepth: function() { return 0; },
      getShadowWorkspaceSharedState: function() { return shadowShared; },
      setShadowWorkspaceSharedState: function(value) { shadowShared = value; },
      isDrawerOpen: function() { return true; },
      isDrawerFullscreen: function() { return false; },
    },
    now: function() { return 1000; },
  });

  return {
    calls: calls,
    controller: controller,
    host: host,
    runningTasks: runningTasks,
    state: state,
    workspaceAddBtn: workspaceAddBtn,
    workspaceListEl: workspaceListEl,
  };
}

function verifyWorkspacePresentationAndSwitch() {
  var harness = createHarness();
  var items = harness.controller.listWorkspaceProgressItems();
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].moduleCount, 1);
  assert.strictEqual(items[0].caseCount, 2);
  assert.strictEqual(harness.controller.renderWorkspaceTabs(), true);
  assert.match(harness.workspaceListEl.innerHTML, /需求一/);
  assert.match(harness.workspaceListEl.innerHTML, /2 用例/);

  assert.strictEqual(harness.controller.switchWorkspace('workspace-2', { reason: 'test-switch' }), true);
  assert.strictEqual(harness.host.activeWorkspaceId, 'workspace-2');
  assert.strictEqual(harness.calls.hydrate.length, 1);
  assert.strictEqual(harness.calls.render[0].reason, 'test-switch');
  assert.strictEqual(harness.calls.render[0].centerRootAfterRender, true);
}

function verifyCreateLimitAndDeleteGuard() {
  var harness = createHarness();
  assert.strictEqual(harness.controller.createWorkspaceAndOpenPrep(), true);
  assert.deepStrictEqual(harness.host.workspaceOrder, ['workspace-1', 'workspace-2', 'workspace-3']);
  assert.strictEqual(harness.workspaceAddBtn.disabled, true);
  assert.strictEqual(harness.calls.openPrep[harness.calls.openPrep.length - 1], 1);
  assert.strictEqual(harness.controller.createWorkspaceAndOpenPrep(), false);
  assert.match(harness.calls.notices[0], /最多仅支持 3 个/);

  harness.runningTasks.push({ workspaceId: 'workspace-2', status: 'running', scope: 'module' });
  assert.strictEqual(harness.controller.deleteWorkspace('workspace-2', { skipConfirm: true }), false);
  assert.ok(harness.host.workspaces['workspace-2']);
  harness.runningTasks.length = 0;
  assert.strictEqual(harness.controller.deleteWorkspace('workspace-2', { skipConfirm: true }), true);
  assert.strictEqual(Boolean(harness.host.workspaces['workspace-2']), false);
  assert.strictEqual(harness.calls.cleared.length, 1);
}

function verifyOwnershipAndLoadOrder() {
  var ownerPath = path.join(
    projectRoot,
    'scripts/modules/xmindCasegen/xmindCasegenWorkspaceSessionController.js'
  );
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'buildCurrentSharedWorkspaceSnapshot',
    'applySharedWorkspaceSnapshot',
    'getWorkspaceSnapshotRequirementIdentity',
    'getCurrentWorkspaceRequirementIdentity',
    'currentActiveWorkspaceHasContent',
    'deriveLiveWorkspaceRecordName',
    'resetWorkflowStateForXmind',
    'resetXmindCasegenState',
    'updateSummary',
    'hasActiveWorkspace',
    'ensureActiveWorkspaceHydrated',
    'getWorkspaceOrder',
    'isWorkspaceDirty',
    'workspaceNeedsCloseConfirm',
    'getWorkspaceTaskList',
    'hasWorkspaceRunningTasks',
    'getRunningDedupeTaskCount',
    'getRunningCoverageTaskCount',
    'hasWorkspaceFailedState',
    'listWorkspaceProgressItems',
    'getWorkspaceModuleMirrorPayload',
    'buildWorkspaceTabSummary',
    'renderWorkspaceTabs',
    'createWorkspaceSnapshotFromCurrent',
    'clearCurrentWorkspaceUiBeforeSwitch',
    'switchWorkspace',
    'activateWorkspace',
    'selectWorkspaceForMirror',
    'hydrateActiveWorkspaceSnapshot',
    'syncActiveWorkspaceSnapshot',
    'createWorkspaceAndOpenPrep',
    'openWorkspaceFromProgressPanel',
    'getWorkspaceDeleteConfirmMessage',
    'deleteWorkspace',
    'captureActiveManagedTaskRestoreContext',
    'ensureWorkspaceRecordForManagedTask',
    'applyManagedTaskLiveRestoreContext',
    'handleManagedTaskWorkspaceRecordsRestored',
    'runInWorkspaceContextNow',
  ].forEach(function(name) {
    assert.match(ownerSource, new RegExp('function ' + name + '\\('), name + ' must be owned by workspace session');
    assert.strictEqual(parentSource.indexOf('function ' + name + '('), -1, name + ' must leave parent coordinator');
  });
  assert.match(parentSource, /workspaceSessionControllerFactory\.create\(/);
  assert.ok(parentSource.split('\n').length <= 5200, 'xmindCasegen.js should stay at or below 5200 lines');
  assert.ok(ownerSource.split('\n').length <= 1700, 'workspace session owner should stay at or below 1700 lines');

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var stateIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenWorkspaceStateController.js');
    var sessionIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenWorkspaceSessionController.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(
      stateIndex >= 0 && stateIndex < sessionIndex && sessionIndex < parentIndex,
      fileName + ' must load workspace state and session owners before parent'
    );
  });
}

verifyWorkspacePresentationAndSwitch();
verifyCreateLimitAndDeleteGuard();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen workspace session controller tests passed');
