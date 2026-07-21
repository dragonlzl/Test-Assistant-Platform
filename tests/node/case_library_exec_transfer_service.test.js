const assert = require('assert');
const fs = require('fs');
const path = require('path');
const owner = require('../../scripts/modules/caseLibrary/caseLibraryExecTransferService.js');

function testPureRules() {
  assert.strictEqual(owner.buildMatchKey({ module: ' A ', title: 'B', expected: ' C ' }), 'a::b::c');
  assert.strictEqual(owner.resolveCaseName({ id: 3 }, ''), '用例#3');
  assert.strictEqual(owner.matchesVersion(null, ''), true);
  assert.strictEqual(owner.matchesVersion(3, '3'), true);
  assert.strictEqual(owner.matchesVersion(4, 3), false);
  assert.deepStrictEqual(owner.mapExecCaseToPayload({
    module: 'M',
    title: 'T',
    expected: 'E',
    status: '通过',
    reuse_details: [{ id: 1 }],
  }), {
    module: 'M',
    title: 'T',
    expected: 'E',
    priority: null,
    precondition: null,
    steps: null,
    remark: null,
    status: '通过',
    reuse_details: [{ id: 1 }],
    defect_links: null,
  });
}

async function testDatabaseTransfer() {
  var payload = null;
  var confirmed = null;
  var active = [];
  var statuses = [];
  var assigned = [];
  var activated = 0;
  var service = owner.create({
    apiClient: {
      listExecSets: function(projectId) {
        assert.strictEqual(projectId, 1);
        return Promise.resolve([
          { id: 8, case_file_id: 5, version_id: 3, status: 'active' },
          { id: 9, case_file_id: 5, version_id: '3', status: 'active' },
          { id: 10, case_file_id: 5, version_id: 4, status: 'active' },
        ]);
      },
      listExecCases: function(execSetId) {
        assert.strictEqual(execSetId, 9);
        return Promise.resolve([{ module: 'M', title: 'T', expected: 'E', status: '通过' }]);
      },
      upsertExecSetFromCaseFile: function(nextPayload) {
        payload = nextPayload;
        return Promise.resolve({ id: 20 });
      },
    },
    getTempExecApi: function() {
      return {
        loadTempExecState: function() { active.push('loaded'); },
        setTempExecActive: function(id) { active.push(id); },
      };
    },
    getGlobalState: function() { return {}; },
    isExecDbEnabled: function() { return true; },
    setStatus: function(element, text, type) { statuses.push([text, type]); },
    openConfirmDrawer: function(options) { confirmed = options; return Promise.resolve({ ok: true }); },
    getVersionName: function(projectId, versionId) { return projectId + '-v' + versionId; },
    requestAssignDrawer: function(options) { assigned.push(options); },
    activateExecView: function() { activated += 1; },
  });

  var result = await service.transfer(
    { id: 5, project_id: 1, version_id: 2, file_name_clean: 'Alpha' },
    '',
    [],
    { execVersionId: 3, association_enabled: true, openAssignDrawer: true }
  );
  assert.deepStrictEqual(result, { ok: true });
  assert.ok(confirmed.message.indexOf('Alpha') !== -1);
  assert.deepStrictEqual(payload, {
    case_file_id: 5,
    mode: 'replace',
    prefer_result_source: 'import',
    import_cases: [{
      module: 'M',
      title: 'T',
      expected: 'E',
      priority: null,
      precondition: null,
      steps: null,
      remark: null,
      status: '通过',
      reuse_details: null,
      defect_links: null,
    }],
    exec_version_id: 3,
    association_enabled: true,
  });
  assert.deepStrictEqual(active, ['loaded', '20']);
  assert.deepStrictEqual(assigned, [{ caseName: 'Alpha', versionName: '1-v3' }]);
  assert.strictEqual(activated, 1);
  assert.deepStrictEqual(statuses[statuses.length - 1], ['已转到执行：Alpha', 'ok']);
}

async function testMemoryOverwritePreservesResults() {
  var defectLinks = [{ url: 'D-1' }];
  var reuseDetails = [{ method: 'auto' }];
  var state = {
    requirementLabel: 'R',
    tempExecFiles: [{
      id: 'existing',
      name: 'Alpha',
      scope: 'current',
      createdAt: 10,
      requirement: 'R0',
      reuseEnabled: true,
      reusePresets: [{ id: 2 }],
      versionId: 'v1',
      cases: [{
        module: 'Module',
        title: 'Case',
        expected: 'Done',
        actual: 'pass',
        remark: 'kept',
        defectLinks: defectLinks,
        reuseDetails: reuseDetails,
      }],
    }],
    tempExecPages: {},
  };
  var cleared = [];
  var active = [];
  var persisted = 0;
  var service = owner.create({
    getTempExecApi: function() {
      return {
        createTempExecFile: function(name, items, scope, id, createdAt, requirement) {
          return {
            id: id || 'new',
            name: name,
            scope: scope,
            createdAt: createdAt,
            requirement: requirement,
            cases: items.map(function(item) { return Object.assign({}, item); }),
          };
        },
        clearTempExecCaseStates: function(id) { cleared.push(id); },
        persistTempExecState: function() { persisted += 1; },
        syncTempExecFocus: function() {},
        setTempExecActive: function(id) { active.push(id); },
      };
    },
    getGlobalState: function() { return state; },
    isExecDbEnabled: function() { return false; },
    setStatus: function() {},
    confirmOverwrite: function() { return true; },
    getVersionName: function() { return 'v1'; },
  });

  var result = await service.transfer(null, ' alpha ', [{
    module: ' module ', title: 'CASE', expected: ' done ', priority: 'P1',
  }], { switchTab: false });
  assert.deepStrictEqual(result, { ok: true });
  assert.strictEqual(state.tempExecFiles.length, 1);
  var rebuilt = state.tempExecFiles[0];
  assert.strictEqual(rebuilt.id, 'existing');
  assert.strictEqual(rebuilt.cases[0].actual, 'pass');
  assert.strictEqual(rebuilt.cases[0].remark, 'kept');
  assert.deepStrictEqual(rebuilt.cases[0].defectLinks, defectLinks);
  assert.notStrictEqual(rebuilt.cases[0].defectLinks, defectLinks);
  assert.deepStrictEqual(rebuilt.cases[0].reuseDetails, reuseDetails);
  assert.strictEqual(rebuilt.reuseEnabled, true);
  assert.strictEqual(rebuilt.versionId, 'v1');
  assert.deepStrictEqual(cleared, ['existing']);
  assert.deepStrictEqual(active, ['existing']);
  assert.strictEqual(persisted, 1);
}

async function testReadinessAndEmptyGuards() {
  var notReady = owner.create({
    getTempExecApi: function() { return null; },
    getGlobalState: function() { return {}; },
  });
  assert.deepStrictEqual(await notReady.transfer(null, '', []), { ok: false, reason: 'not_ready' });

  var empty = owner.create({
    getTempExecApi: function() { return {}; },
    getGlobalState: function() { return {}; },
  });
  assert.deepStrictEqual(await empty.transfer(null, 'Empty', [{}]), { ok: false, reason: 'empty' });
}

function testOwnershipAndEntryOrder() {
  var root = path.resolve(__dirname, '../..');
  var parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  assert.ok(parent.indexOf('execTransferServiceOwner.create') !== -1);
  assert.ok(parent.indexOf('function transferItemsToTempExec') === -1);
  assert.ok(parent.indexOf('function buildExecMatchKey') === -1);
  assert.ok(parent.split('\n').length < 8400, 'caseLibrary.js should keep shrinking');

  var entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  entries.forEach(function(entry) {
    var html = fs.readFileSync(path.join(root, entry), 'utf8');
    var ownerIndex = html.indexOf('caseLibraryExecTransferService.js');
    var parentIndex = html.indexOf('scripts/modules/caseLibrary.js');
    assert.ok(ownerIndex >= 0, entry + ' is missing the execution transfer service');
    assert.ok(ownerIndex < parentIndex, entry + ' has invalid execution transfer service order');
  });
}

(async function run() {
  testPureRules();
  await testDatabaseTransfer();
  await testMemoryOverwritePreservesResults();
  await testReadinessAndEmptyGuards();
  testOwnershipAndEntryOrder();
  console.log('case library execution transfer service tests passed');
})().catch(function(error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
