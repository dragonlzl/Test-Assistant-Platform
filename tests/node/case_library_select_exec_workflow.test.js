const assert = require('assert');
const workflow = require('../../scripts/modules/caseLibrary/caseLibrarySelectExecWorkflow.js');

async function testSingleSequence() {
  var calls = [];
  var result = await workflow.runSingle({
    file: { id: 101, file_name_clean: 'A' },
    resolveAssociation: function(file) {
      calls.push(['association', file.id]);
      return { ok: true, association_enabled: false };
    },
    chooseVersion: function(file) {
      calls.push(['version', file.id]);
      return { ok: true, versionId: 12 };
    },
    loadItems: function(file) {
      calls.push(['items', file.id]);
      return [{ id: 1 }];
    },
    transfer: function(file, items, context) {
      calls.push(['transfer', file.id, items.length, context.association_enabled, context.versionResult.versionId]);
      return { ok: true, execSetId: 900 };
    },
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.association_enabled, false);
  assert.deepStrictEqual(calls, [
    ['association', 101],
    ['version', 101],
    ['items', 101],
    ['transfer', 101, 1, false, 12],
  ]);

  var cancelled = await workflow.runSingle({
    file: { id: 101 },
    resolveAssociation: function() { return { ok: false }; },
  });
  assert.deepStrictEqual(cancelled, {
    ok: false,
    reason: 'association_cancelled',
  });
}

async function testBatchSequenceAndIsolation() {
  var files = [
    { id: 101, file_name_clean: 'A' },
    { id: 102, file_name_clean: 'B' },
    { id: 103, file_name_clean: 'C' },
  ];
  var calls = [];
  var result = await workflow.runBatch({
    files: files,
    chooseVersion: function(input) {
      calls.push(['version', input.map(function(file) { return file.id; })]);
      return { ok: true, versionId: 21 };
    },
    precheck: function(input, version) {
      calls.push(['precheck', input.length, version.versionId]);
      return { ok: true, skipConfirm: true };
    },
    resolveAssociation: function(file) {
      calls.push(['association', file.id]);
      if (file.id === 102) return { ok: false };
      return { ok: true, association_enabled: file.id === 103 };
    },
    loadItems: function(file) {
      calls.push(['items', file.id]);
      return [{ id: file.id * 10 }];
    },
    transfer: function(file, items, context) {
      calls.push([
        'transfer',
        file.id,
        items.length,
        context.association_enabled,
        context.skipActiveConfirm,
        context.versionResult.versionId,
      ]);
      return { ok: true };
    },
  });
  assert.strictEqual(result.successes, 2);
  assert.strictEqual(result.failures.length, 1);
  assert.strictEqual(result.failures[0].reason, 'association_cancelled');
  assert.deepStrictEqual(calls, [
    ['version', [101, 102, 103]],
    ['precheck', 3, 21],
    ['association', 101],
    ['items', 101],
    ['transfer', 101, 1, false, true, 21],
    ['association', 102],
    ['association', 103],
    ['items', 103],
    ['transfer', 103, 1, true, true, 21],
  ]);

  var cancelled = await workflow.runBatch({
    files: files,
    chooseVersion: function() { return { ok: false }; },
  });
  assert.strictEqual(cancelled.reason, 'version_cancelled');
  assert.strictEqual(cancelled.successes, 0);
}

async function run() {
  await testSingleSequence();
  await testBatchSequenceAndIsolation();
  console.log('case library select exec workflow tests passed');
}

run().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
