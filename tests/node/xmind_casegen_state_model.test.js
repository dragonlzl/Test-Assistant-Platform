'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var stateModelFactory = require(path.join(
  projectRoot,
  'scripts/modules/xmindCasegen/xmindCasegenStateModel.js'
));

function cloneJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return fallback;
  }
}

function normalizeUniqueStringList(list) {
  var result = [];
  var seen = {};
  (Array.isArray(list) ? list : []).forEach(function(item) {
    var text = item === null || item === undefined ? '' : String(item || '').trim();
    if (!text || seen[text]) return;
    seen[text] = true;
    result.push(text);
  });
  return result;
}

function normalizeDedupeMode(value) {
  return String(value || '') === 'dedupe_simplify' ? 'dedupe_simplify' : 'dedupe_only';
}

function normalizeHistoryDedupeRecords(list) {
  var seen = {};
  return (Array.isArray(list) ? list : []).filter(function(item) {
    var key = item && item.title ? String(item.title || '') : '';
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  }).map(function(item) { return cloneJson(item, {}); });
}

function normalizeRootPipelineDedupeModules(list) {
  var result = [];
  var indexes = {};
  (Array.isArray(list) ? list : []).forEach(function(item) {
    if (!item || !item.module) return;
    var key = String(item.module || '').toLowerCase();
    var normalized = cloneJson(item, {});
    normalized.cases = Array.isArray(normalized.cases) ? normalized.cases : [];
    if (indexes[key] === undefined) {
      indexes[key] = result.length;
      result.push(normalized);
      return;
    }
    if (normalized.cases.length >= result[indexes[key]].cases.length) {
      result[indexes[key]] = normalized;
    }
  });
  return result;
}

function normalizeHistoryDiagnostics(list) {
  return normalizeUniqueStringList(list);
}

var currentNow = 1000;
var stateModel = stateModelFactory.create({
  stepRequirement: 1,
  dedupeModeOnly: 'dedupe_only',
  sharedCaseGenSettingKeys: [
    'activeTab',
    'customRequirement',
    'dedupeSimplify',
    'needFunctionCondition',
    'needNumericValidation',
    'needBoundary',
    'needMobile',
    'needSpecial',
    'specialRepeatOperation',
    'specialMultiTouch',
    'specialRepeatExecution',
    'specialWeakNetwork',
    'specialInterruptResume',
  ],
  cloneJson: cloneJson,
  normalizeUniqueStringList: normalizeUniqueStringList,
  normalizeDedupeMode: normalizeDedupeMode,
  normalizeHistoryDedupeRecords: normalizeHistoryDedupeRecords,
  normalizeRootPipelineDedupeModules: normalizeRootPipelineDedupeModules,
  normalizeModuleTitle: function(value) { return String(value || '').trim(); },
  normalizeHistoryDurationMs: function(value) {
    var number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
  },
  normalizeHistoryDiagnostics: normalizeHistoryDiagnostics,
  normalizePersistedRequirementLabel: function(value) { return String(value || '').trim(); },
  createDefaultKnowledgeBaseState: function() { return { status: 'idle', source: 'test' }; },
  normalizeKnowledgeBaseState: function(value) {
    return value && typeof value === 'object'
      ? { status: String(value.status || 'idle'), source: String(value.source || 'test') }
      : { status: 'idle', source: 'test' };
  },
  areRestoreContextsCompatible: function(base, incoming) {
    return !base.workspaceId || !incoming.workspaceId || base.workspaceId === incoming.workspaceId;
  },
  createRootPipelineId: function() { return 'pipeline-generated'; },
  now: function() { return currentNow; },
});

function verifyDefaultStates() {
  assert.deepStrictEqual(stateModel.createDefaultPrepState(), {
    step: 1,
    requirementMode: '',
    requirementSupplement: '',
    manualRequirementLabel: '',
    manualRequirementBlocks: [],
    caseImportMode: '',
    baseLocked: false,
    completed: false,
  });
  assert.strictEqual(stateModel.createDefaultRootState().pipeline, null);
  assert.strictEqual(stateModel.createDefaultDedupeState().dedupeMode, 'dedupe_only');
  assert.strictEqual(stateModel.createDefaultCoverageState().selectedSegmentId, '');
  assert.strictEqual(stateModel.createDefaultViewState().scaleVal, 1);
  assert.strictEqual(stateModel.createDefaultCaseGenSettings().needFunctionCondition, true);
  assert.strictEqual(stateModel.createEmptyWorkspaceSharedState().caseGenModules.length, 0);

  var coverage = stateModel.normalizeCoverageState({
    running: true,
    result: { signature: 'coverage-signature', selectedSegmentId: 'segment-2' },
    updatedAt: '25',
  });
  assert.strictEqual(coverage.running, true);
  assert.strictEqual(coverage.signature, 'coverage-signature');
  assert.strictEqual(coverage.selectedSegmentId, 'segment-2');
  assert.strictEqual(coverage.updatedAt, 25);
}

function verifyViewStateRules() {
  var invalid = stateModel.normalizeStoredViewState({
    scaleVal: -2,
    scrollLeft: -1,
    scrollTop: 'bad',
    updatedAt: -5,
    collapsedNodeKeys: ['a', 'a', '', 'b'],
    hasManualViewport: true,
  });
  assert.strictEqual(invalid.scaleVal, 1);
  assert.strictEqual(invalid.scrollLeft, 0);
  assert.strictEqual(invalid.scrollTop, 0);
  assert.strictEqual(invalid.updatedAt, 0);
  assert.deepStrictEqual(invalid.collapsedNodeKeys, ['a', 'b']);
  assert.strictEqual(invalid.hasManualViewport, false);

  var base = {
    transform: 'matrix(1,0,0,1,10,10)',
    hasManualViewport: false,
    drawerOpen: true,
    fullscreen: false,
    updatedAt: 20,
  };
  var incoming = {
    transform: 'matrix(1,0,0,1,50,60)',
    hasManualViewport: true,
    drawerOpen: false,
    fullscreen: true,
    updatedAt: 10,
  };
  assert.strictEqual(stateModel.shouldPreferIncomingViewState(base, incoming), true);
  var merged = stateModel.mergeStoredViewState(base, incoming);
  assert.strictEqual(merged.transform, incoming.transform);
  assert.strictEqual(merged.hasManualViewport, true);
  assert.strictEqual(merged.drawerOpen, true);
  assert.strictEqual(merged.fullscreen, false);
  assert.strictEqual(merged.updatedAt, 20);
  assert.strictEqual(stateModel.shouldRestoreViewportForViewState(merged), true);
}

function verifySharedWorkspaceRules() {
  currentNow = 1200;
  var normalized = stateModel.normalizeWorkspaceSharedState({
    requirementLabel: '  登录需求  ',
    caseSelections: {
      login: new Set([1, 2, 2]),
    },
    caseGenSettings: {
      customRequirement: 123,
      needFunctionCondition: false,
      needBoundary: true,
    },
    requirementMedia: {
      docxImages: [{ id: 'img-1' }],
      lastDocxImageCount: -1,
      updatedAt: 0,
    },
  });
  assert.strictEqual(normalized.requirementLabel, '登录需求');
  assert.deepStrictEqual(normalized.caseSelections.login, [1, 2]);
  assert.strictEqual(normalized.caseGenSettings.customRequirement, '123');
  assert.strictEqual(normalized.caseGenSettings.needFunctionCondition, false);
  assert.strictEqual(normalized.caseGenSettings.needBoundary, true);
  assert.strictEqual(normalized.requirementMedia.lastDocxImageCount, 0);
  assert.strictEqual(normalized.requirementMedia.updatedAt, 1200);

  var emptySnapshot = stateModel.createWorkspaceSnapshot({ drawerOpen: true });
  assert.strictEqual(emptySnapshot.xmind.viewState.drawerOpen, true);
  assert.strictEqual(stateModel.workspaceSnapshotHasContent(emptySnapshot), false);
  assert.strictEqual(stateModel.workspaceSnapshotHasGeneratedContent(emptySnapshot), false);

  var generated = stateModel.normalizeWorkspaceSnapshot({
    xmind: { history: [{ id: 'history-1' }] },
    shared: { caseGenModules: [{ id: 'module-1' }] },
  });
  assert.strictEqual(stateModel.workspaceSnapshotHasContent(generated), true);
  assert.strictEqual(stateModel.workspaceSnapshotHasGeneratedContent(generated), true);
  assert.strictEqual(stateModel.workspaceSnapshotHasPrepDraft({
    xmind: { prep: { requirementSupplement: '补充说明' } },
    shared: {},
  }), true);
}

function verifyRootPipelineRules() {
  currentNow = 2000;
  var base = stateModel.createRootPipelineState({
    id: 'pipeline-1',
    actionId: 'root-full-cases',
    createdModules: 1,
    moduleTaskTotal: 2,
    moduleTaskCompleted: 1,
    moduleTaskCompletedKeys: ['login'],
    diagnostics: ['first'],
    detailMap: {
      login: { module: '登录', caseCount: 1, durationMs: 120.4 },
    },
    generatedDedupeModules: [{ module: '登录', cases: [{ title: 'a' }] }],
  });
  assert.strictEqual(base.updatedAt, 2000);
  assert.strictEqual(base.id, 'pipeline-1');

  var compact = stateModel.buildCompactRootPipelineRestoreSnapshot(base);
  assert.notStrictEqual(compact, base);
  assert.deepStrictEqual(compact.moduleTaskCompletedKeys, ['login']);

  var incoming = stateModel.cloneRootPipelineSnapshot(base);
  incoming.createdModules = 2;
  incoming.addedCases = 5;
  incoming.moduleTaskCompleted = 2;
  incoming.moduleTaskCompletedKeys = ['login', 'payment'];
  incoming.diagnostics = ['first', 'second'];
  incoming.detailMap.payment = { module: '支付', caseCount: 5, durationMs: 300.6 };
  incoming.updatedAt = 2500;
  var merged = stateModel.mergeRootPipelineSnapshot(base, incoming);
  assert.strictEqual(merged.createdModules, 2);
  assert.strictEqual(merged.addedCases, 5);
  assert.strictEqual(merged.moduleTaskCompleted, 2);
  assert.deepStrictEqual(merged.moduleTaskCompletedKeys, ['login', 'payment']);
  assert.deepStrictEqual(merged.diagnostics, ['first', 'second']);
  assert.strictEqual(merged.detailMap.payment.durationMs, 301);
  assert.ok(stateModel.getRootPipelineSnapshotWeight(merged) > stateModel.getRootPipelineSnapshotWeight(base));

  var heavierDifferent = stateModel.mergeRootPipelineSnapshot(base, {
    id: 'pipeline-2',
    createdModules: 3,
    addedCases: 8,
  });
  assert.strictEqual(heavierDifferent.id, 'pipeline-2');
}

function operationSnapshot(id, createdAt, resultText) {
  return {
    id: id,
    scope: 'root',
    caseGenModules: [],
    caseGenResults: { login: resultText },
    createdAt: createdAt,
  };
}

function verifyRestoreContextRules() {
  var version = stateModel.buildOperationSnapshotRestoreVersion([
    operationSnapshot('op-snap-2', 20, '[]'),
    operationSnapshot('op-snap-5', 50, '[{"title":"new"}]'),
    { id: '', createdAt: 100 },
  ], 3);
  assert.strictEqual(version.length, 2);
  assert.strictEqual(version.nextSnapshotId, 6);
  assert.strictEqual(version.latestCreatedAt, 50);

  var base = {
    workspaceId: 'workspace-1',
    requirementLabel: '登录需求',
    rawText: '旧正文',
    caseGenModules: [{ id: 'module-1' }],
    caseGenResults: { login: '[{"title":"old"}]', payment: '[]' },
    operationSnapshots: [operationSnapshot('op-snap-2', 20, '[{"title":"old"}]')],
    nextSnapshotId: 3,
    history: [{ id: 'history-1' }],
    prep: { step: 1, baseLocked: true, completed: false },
    viewState: { transform: 'matrix(1,0,0,1,1,1)', updatedAt: 10 },
  };
  var incoming = {
    workspaceId: 'workspace-1',
    rawText: '',
    caseGenModules: [{ id: 'module-1' }, { id: 'module-2' }],
    caseGenResults: { login: '[]', payment: '[{"title":"pay"}]' },
    operationSnapshots: [operationSnapshot('op-snap-5', 50, '[{"title":"new"}]')],
    nextSnapshotId: 6,
    history: [{ id: 'history-1' }, { id: 'history-2' }],
    prep: { step: 3, completed: true, manualRequirementBlocks: [{ type: 'text', text: '补充' }] },
    viewState: { transform: 'matrix(1,0,0,1,8,8)', hasManualViewport: true, updatedAt: 30 },
  };
  var merged = stateModel.mergeTaskRestoreContext(base, incoming);
  assert.strictEqual(merged.rawText, '旧正文');
  assert.strictEqual(merged.caseGenModules.length, 2);
  assert.strictEqual(merged.caseGenResults.login, '[{"title":"old"}]');
  assert.strictEqual(merged.caseGenResults.payment, '[{"title":"pay"}]');
  assert.strictEqual(merged.operationSnapshots[0].id, 'op-snap-5');
  assert.strictEqual(merged.nextSnapshotId, 6);
  assert.strictEqual(merged.history.length, 2);
  assert.strictEqual(merged.prep.step, 3);
  assert.strictEqual(merged.prep.baseLocked, true);
  assert.strictEqual(merged.prep.completed, true);
  assert.strictEqual(merged.viewState.transform, incoming.viewState.transform);

  var incompatible = stateModel.mergeTaskRestoreContext(base, {
    workspaceId: 'workspace-2',
    rawText: '不应合并',
  });
  assert.deepStrictEqual(incompatible, base);
}

function verifyOwnershipAndLoadOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  [
    'createDefaultPrepState',
    'normalizeStoredViewState',
    'createRootPipelineState',
    'normalizeWorkspaceSharedState',
    'normalizeWorkspaceSnapshot',
    'mergeTaskRestoreContext',
  ].forEach(function(name) {
    assert.ok(
      parentSource.indexOf('function ' + name + '(') === -1,
      name + ' must be owned by xmindCasegenStateModel'
    );
  });
  assert.ok(/stateModelFactory\.create\(/.test(parentSource));
  assert.ok(/createRootPipelineId: function\(\)/.test(parentSource));
  assert.strictEqual(parentSource.indexOf('createRootPipelineId: buildRootPipelineId'), -1);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var stateModelIndex = html.indexOf('./scripts/modules/xmindCasegen/xmindCasegenStateModel.js');
    var parentIndex = html.indexOf('./scripts/modules/xmindCasegen.js');
    assert.ok(stateModelIndex >= 0 && stateModelIndex < parentIndex, fileName + ' must load state model first');
  });
}

verifyDefaultStates();
verifyViewStateRules();
verifySharedWorkspaceRules();
verifyRootPipelineRules();
verifyRestoreContextRules();
verifyOwnershipAndLoadOrder();
console.log('xmind casegen state model tests passed');
