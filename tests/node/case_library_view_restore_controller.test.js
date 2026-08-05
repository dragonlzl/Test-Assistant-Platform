'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var ownerPath = path.join(
  projectRoot,
  'scripts/modules/caseLibrary/caseLibraryViewRestoreController.js'
);
var owner = require(ownerPath);

function createHarness(options) {
  var opts = options || {};
  var calls = [];
  var results = Object.assign({ editor: false, history: false, missing: false }, opts.results || {});
  var controller = owner.create({
    isAuthReady: function() { return opts.authReady !== false; },
    getCurrentUserId: function() { return opts.userId === undefined ? 7 : opts.userId; },
    getCurrentLoginSeq: function() { return opts.loginSeq || 'login-7'; },
    readLastView: function() { calls.push('read:last'); return opts.lastView || null; },
    readEditor: function() { calls.push('read:editor'); return opts.editor || null; },
    readHistory: function() { calls.push('read:history'); return opts.history || null; },
    readMissing: function() { calls.push('read:missing'); return opts.missing || null; },
    restoreEditor: function() { calls.push('restore:editor'); return Promise.resolve(results.editor); },
    restoreHistory: function() { calls.push('restore:history'); return Promise.resolve(results.history); },
    restoreMissing: function() { calls.push('restore:missing'); return Promise.resolve(results.missing); },
    prepareEditor: function() { calls.push('prepare:editor'); },
    prepareMissing: function() { calls.push('prepare:missing'); },
    hideMissing: function() { calls.push('hide:missing'); },
  });
  return { controller: controller, calls: calls };
}

async function verifyExplicitViewContract() {
  var harness = createHarness({
    lastView: { user_id: 7, view: 'history' },
    results: { history: false, editor: true },
  });
  assert.strictEqual(await harness.controller.restoreLastSelection(), 'editor');
  assert.deepStrictEqual(harness.calls, [
    'read:last',
    'restore:history',
    'prepare:editor',
    'restore:editor',
  ]);
}

async function verifyLoginIdentityAndMissingFallback() {
  var harness = createHarness({
    userId: null,
    loginSeq: 'login-9',
    lastView: { login_seq: 'login-9', view: 'missing' },
    results: { missing: false, editor: false, history: true },
  });
  assert.strictEqual(await harness.controller.restoreLastSelection(), 'history');
  assert.deepStrictEqual(harness.calls, [
    'read:last',
    'prepare:missing',
    'restore:missing',
    'hide:missing',
    'prepare:editor',
    'restore:editor',
    'restore:history',
  ]);
}

async function verifyTimestampFallbackContract() {
  var harness = createHarness({
    lastView: { user_id: 99, view: 'editor' },
    editor: { saved_at: 10 },
    history: { saved_at: 20 },
    missing: { saved_at: 30 },
    results: { missing: false, editor: true },
  });
  assert.strictEqual(await harness.controller.restoreLastSelection(), 'editor');
  assert.deepStrictEqual(harness.calls, [
    'read:last',
    'read:editor',
    'read:history',
    'read:missing',
    'restore:missing',
    'hide:missing',
    'prepare:editor',
    'restore:editor',
  ]);

  assert.deepStrictEqual(
    owner.resolveRestorePlan('', { editor: 40, history: 20, missing: 30 }),
    [
      { view: 'editor', prepare: 'editor' },
      { view: 'missing' },
    ]
  );
}

async function verifyAuthShortCircuit() {
  var harness = createHarness({ authReady: false });
  assert.strictEqual(await harness.controller.restoreLastSelection(), null);
  assert.deepStrictEqual(harness.calls, []);
}

function countLines(source) {
  return source ? source.split('\n').length : 0;
}

function verifyOwnershipAndLoadOrder() {
  var ownerSource = fs.readFileSync(ownerPath, 'utf8');
  var parentSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/caseLibrary.js'),
    'utf8'
  );
  var entryFiles = [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ];

  assert.ok(parentSource.indexOf('viewRestoreControllerOwner.create') !== -1);
  assert.strictEqual(parentSource.indexOf('function restoreCaseLibraryLastSelection('), -1);
  [
    'ensureCaseLibraryAiGenState',
    'syncCaseLibraryAiGenContext',
    'openCaseLibraryAiGenPrepAndRun',
    'appendCaseLibraryAiGenSelection',
  ].forEach(function(functionName) {
    assert.strictEqual(
      parentSource.indexOf('function ' + functionName + '('),
      -1,
      functionName + ' should be a direct controller reference'
    );
  });
  assert.ok(countLines(ownerSource) < 140, 'view restore controller should remain focused');
  assert.ok(
    countLines(parentSource) + countLines(ownerSource) + entryFiles.length < 3944,
    'production LOC should decrease after extraction, including entry declarations'
  );

  entryFiles.forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/caseLibrary/caseLibraryViewRestoreController.js');
    var parentIndex = html.indexOf('./scripts/modules/caseLibrary.js');
    assert.ok(ownerIndex !== -1, fileName + ' must load the view restore controller');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the controller before caseLibrary');
  });
}

async function run() {
  assert.ok(owner && typeof owner.create === 'function');
  assert.strictEqual(typeof owner.resolveRestorePlan, 'function');
  await verifyExplicitViewContract();
  await verifyLoginIdentityAndMissingFallback();
  await verifyTimestampFallbackContract();
  await verifyAuthShortCircuit();
  verifyOwnershipAndLoadOrder();
  console.log('case_library_view_restore_controller.test.js passed');
}

run().catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
