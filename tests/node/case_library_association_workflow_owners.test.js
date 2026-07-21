const assert = require('assert');
const fs = require('fs');
const path = require('path');

const viewOwner = require('../../scripts/modules/caseLibrary/caseLibraryAssociationWorkflowViewAdapter.js');
const workflowOwner = require('../../scripts/modules/caseLibrary/caseLibraryAssociationWorkflowController.js');
const associationModel = require('../../scripts/modules/caseLibrary/caseLibraryAssociationModel.js');

function createElement() {
  const listeners = {};
  return {
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    addEventListener: function(name, handler) {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(handler);
    },
    listeners: listeners,
  };
}

function buildDom() {
  return {
    associationCaseName: createElement(),
    associationStatus: createElement(),
    associationAddBtn: createElement(),
    associationPickStatus: createElement(),
    associationPickVersionSelect: createElement(),
    associationPickRefreshBtn: createElement(),
    associationPickQueryBtn: createElement(),
    associationPickNextBtn: createElement(),
    associationPickSubCaseName: createElement(),
    associationPickConfirmBtn: createElement(),
    associationDeleteConfirmBtn: createElement(),
  };
}

function createDrawer() {
  return {
    opened: 0,
    closed: 0,
    open: function() { this.opened += 1; },
    close: function() { this.closed += 1; },
  };
}

function createHarness() {
  const dom = buildDom();
  const state = {
    versionsByProject: { 1: [{ id: 2, name: 'v2' }] },
    associationDrawer: {},
    associationPickDrawer: {},
  };
  const drawers = {
    select: createDrawer(),
    main: createDrawer(),
    pick: createDrawer(),
    item: createDrawer(),
    deleteConfirm: createDrawer(),
  };
  let associations = [];
  let createdPayload = null;
  let deletedId = null;
  let updatedCount = null;
  const listController = {
    loading: false,
    rows: [],
    setLoading: function() { this.loading = true; this.rows = []; },
    setData: function(rows) { this.loading = false; this.rows = rows.slice(); },
    reset: function() { this.loading = false; this.rows = []; },
    getState: function() { return { loading: this.loading }; },
    getRows: function() { return this.rows.slice(); },
  };
  const candidateController = {
    rows: [],
    reset: function() { this.rows = []; },
    setLoading: function() { this.rows = []; },
    setData: function(rows, context) {
      this.rows = rows.map(function(row) {
        return {
          id: row.id,
          fileNameClean: row.file_name_clean,
          selected: String(row.id) === String(context.selectedCandidateId || ''),
        };
      });
    },
    getRows: function() { return this.rows.slice(); },
    getState: function() { return { total: this.rows.length }; },
  };
  const itemController = {
    rows: [],
    selectedIds: [501],
    reset: function() { this.rows = []; },
    setLoading: function(context) { this.rows = []; this.selectedIds = (context.selectedItemIds || []).slice(); },
    setData: function(rows, context) {
      this.rows = rows.slice();
      this.selectedIds = (context.selectedItemIds || []).slice();
      if (!this.selectedIds.length && rows.length) this.selectedIds = [rows[0].id];
    },
    getRows: function() { return this.rows.slice(); },
    getSelectedItemIds: function() { return this.selectedIds.slice(); },
  };
  const selectController = {
    updateAssociationCount: function(caseFileId, count) { updatedCount = [caseFileId, count]; },
    getAssociationDecision: function() { return { associationEnabled: false, requiresConfirmation: true }; },
  };
  const apiClient = {
    listCaseFileAssociations: function() { return Promise.resolve(associations.slice()); },
    listCaseFileAssociationCandidates: function(mainId, options) {
      assert.strictEqual(mainId, 101);
      assert.strictEqual(options.version_id, 2);
      return Promise.resolve([{ id: 202, file_name_clean: '副用例' }]);
    },
    listCaseItems: function(subId) {
      assert.strictEqual(subId, 202);
      return Promise.resolve([{ id: 501, title: '副用例条目' }]);
    },
    createCaseFileAssociation: function(mainId, payload) {
      createdPayload = { mainId: mainId, payload: payload };
      associations = [{ id: 301, sub_case_file_id: 202, selected_case_item_ids: payload.selected_case_item_ids }];
      return Promise.resolve({ id: 301 });
    },
    updateCaseFileAssociation: function() { return Promise.resolve({ id: 301 }); },
    deleteCaseFileAssociation: function(mainId, associationId) {
      assert.strictEqual(mainId, 101);
      deletedId = associationId;
      associations = [];
      return Promise.resolve({ ok: true });
    },
  };
  const statuses = [];
  const view = viewOwner.create({
    dom: dom,
    setStatus: function(element, text, type) {
      if (element) {
        element.textContent = text;
        element.statusType = type;
      }
      statuses.push({ text: text, type: type });
    },
    syncVersionOptions: function(select) {
      select.innerHTML = '<option value="">请选择版本</option><option value="2">v2</option>';
    },
  });
  const workflow = workflowOwner.create({
    state: state,
    apiClient: apiClient,
    model: associationModel,
    view: view,
    getListController: function() { return listController; },
    getCandidateController: function() { return candidateController; },
    getItemController: function() { return itemController; },
    getSelectController: function() { return selectController; },
    getDrawers: function() { return drawers; },
    loadVersions: function() { return Promise.resolve(state.versionsByProject[1]); },
    normalizeId: function(value) { return value ? Number(value) : null; },
    openConfirmDrawer: function() { return Promise.resolve({ ok: true }); },
    showToast: function(text, type) { statuses.push({ text: text, type: type }); },
    resolveAssociationDecision: function() { return { associationEnabled: false, requiresConfirmation: true }; },
  });
  return {
    workflow: workflow,
    dom: dom,
    state: state,
    drawers: drawers,
    statuses: statuses,
    getCreatedPayload: function() { return createdPayload; },
    getDeletedId: function() { return deletedId; },
    getUpdatedCount: function() { return updatedCount; },
  };
}

async function testWorkflowLifecycle() {
  const harness = createHarness();
  const workflow = harness.workflow;
  workflow.bindEvents();
  workflow.bindEvents();
  assert.strictEqual(harness.dom.associationAddBtn.listeners.click.length, 1);
  assert.strictEqual(harness.dom.associationPickQueryBtn.listeners.click.length, 1);
  assert.strictEqual(harness.dom.associationPickConfirmBtn.listeners.click.length, 1);

  const mainCase = { id: 101, project_id: 1, version_id: 2, file_name_clean: '主用例' };
  assert.strictEqual(await workflow.openFromSelect(mainCase), true);
  assert.strictEqual(harness.drawers.main.opened, 1);
  assert.strictEqual(harness.dom.associationCaseName.textContent, '主用例');
  assert.ok(harness.dom.associationStatus.textContent.indexOf('当前暂无关联') !== -1);

  await workflow.openPick('create', mainCase, null);
  assert.strictEqual(harness.state.associationPickDrawer.versionId, 2);
  assert.strictEqual(harness.drawers.pick.opened, 1);
  await workflow.loadCandidates();
  workflow.handleCandidateSelect({ id: 202, fileNameClean: '副用例' });
  assert.strictEqual(await workflow.openItemsFromPick(), true);
  assert.strictEqual(harness.drawers.item.opened, 1);
  assert.strictEqual(await workflow.submitSelection(), true);
  assert.deepStrictEqual(harness.getCreatedPayload(), {
    mainId: 101,
    payload: { sub_case_file_id: 202, selected_case_item_ids: [501] },
  });
  assert.deepStrictEqual(harness.getUpdatedCount(), [101, 1]);

  assert.strictEqual(await workflow.requestDelete({ id: 301 }), true);
  assert.strictEqual(harness.drawers.deleteConfirm.opened, 1);
  assert.strictEqual(await workflow.confirmDelete(), true);
  assert.strictEqual(harness.getDeletedId(), 301);
  assert.deepStrictEqual(harness.getUpdatedCount(), [101, 0]);

  const decision = await workflow.resolveExecAssociation({ id: 101 });
  assert.deepStrictEqual(decision, { ok: true, association_enabled: false });
}

function testOwnershipAndEntryOrder() {
  const root = path.resolve(__dirname, '../..');
  const parent = fs.readFileSync(path.join(root, 'scripts/modules/caseLibrary.js'), 'utf8');
  const view = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryAssociationWorkflowViewAdapter.js'),
    'utf8'
  );
  const controller = fs.readFileSync(
    path.join(root, 'scripts/modules/caseLibrary/caseLibraryAssociationWorkflowController.js'),
    'utf8'
  );
  assert.ok(parent.indexOf('associationWorkflowControllerOwner.create') !== -1);
  assert.ok(parent.indexOf('associationWorkflowController.openFromSelect') !== -1);
  assert.ok(parent.indexOf('function openAssociationPickDrawer') === -1);
  assert.ok(parent.indexOf('function submitAssociationItemSelection') === -1);
  assert.ok(parent.indexOf('function confirmDeleteAssociationRow') === -1);
  assert.ok(view.indexOf('apiClient') === -1);
  assert.ok(controller.indexOf('.innerHTML') === -1);
  assert.ok(controller.indexOf('document.') === -1);

  const entries = ['admin.html', 'ai-tools.html', 'ai-workflow.html', 'case-exec.html', 'case-library.html', 'index.html', 'settings.html'];
  const scripts = [
    'caseLibraryAssociationWorkflowViewAdapter.js',
    'caseLibraryAssociationWorkflowController.js',
    'caseLibrary.js',
  ];
  entries.forEach(function(entry) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const indexes = scripts.map(function(script) { return html.indexOf(script); });
    assert.ok(indexes.every(function(index) { return index >= 0; }), entry + ' is missing association workflow owner');
    assert.ok(indexes[0] < indexes[1] && indexes[1] < indexes[2], entry + ' has invalid association workflow order');
  });
}

(async function run() {
  await testWorkflowLifecycle();
  testOwnershipAndEntryOrder();
  console.log('case library association workflow owner tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
