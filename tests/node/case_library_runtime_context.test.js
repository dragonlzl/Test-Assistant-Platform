'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var owner = require(path.join(
  projectRoot,
  'scripts/modules/caseLibrary/caseLibraryRuntimeContext.js'
));

function verifyContextFactory() {
  var requestedIds = [];
  var documentStub = {
    getElementById: function(id) {
      requestedIds.push(id);
      return { id: id };
    },
  };
  var first = owner.create({ document: documentStub });
  var second = owner.create({ document: documentStub });

  assert.strictEqual(first.dom.root.id, 'caseLibrary');
  assert.strictEqual(first.dom.editDrawerProjectSelect.id, 'caseLibraryEditProjectSelect');
  assert.strictEqual(first.dom.historyTableHost.id, 'caseLibraryHistoryTableHost');
  assert.ok(requestedIds.length > 100, 'the runtime context should collect the complete DOM registry');

  assert.deepStrictEqual(first.state.projects, []);
  assert.strictEqual(first.state.editDrawer.ownerFilter, 'all');
  assert.ok(first.state.editDrawer.selection instanceof Set);
  assert.ok(first.state.editor.selection instanceof Set);
  assert.ok(first.state.missingView.typeFilters instanceof Set);

  assert.notStrictEqual(first.state, second.state);
  assert.notStrictEqual(first.state.editDrawer, second.state.editDrawer);
  assert.notStrictEqual(first.state.editDrawer.selection, second.state.editDrawer.selection);
  first.state.projects.push({ id: 1 });
  first.state.editDrawer.selection.add(9);
  assert.deepStrictEqual(second.state.projects, []);
  assert.strictEqual(second.state.editDrawer.selection.size, 0);
}

function verifyOwnershipAndLoadOrder() {
  var ownerSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/caseLibrary/caseLibraryRuntimeContext.js'),
    'utf8'
  );
  var parentSource = fs.readFileSync(
    path.join(projectRoot, 'scripts/modules/caseLibrary.js'),
    'utf8'
  );
  assert.ok(ownerSource.split('\n').length < 500, 'runtime context owner should remain focused');
  assert.ok(parentSource.indexOf('runtimeContextOwner.create') !== -1);
  assert.strictEqual(parentSource.indexOf('var dom = {'), -1);
  assert.strictEqual(parentSource.indexOf('var state = {'), -1);
  assert.ok(parentSource.split('\n').length < 4500, 'caseLibrary.js should reach its target range');

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var ownerIndex = html.indexOf('./scripts/modules/caseLibrary/caseLibraryRuntimeContext.js');
    var parentIndex = html.indexOf('./scripts/modules/caseLibrary.js');
    assert.ok(ownerIndex !== -1, fileName + ' must load the runtime context owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the runtime context before caseLibrary');
  });
}

assert.ok(owner && typeof owner.create === 'function');
verifyContextFactory();
verifyOwnershipAndLoadOrder();
console.log('case_library_runtime_context.test.js passed');
