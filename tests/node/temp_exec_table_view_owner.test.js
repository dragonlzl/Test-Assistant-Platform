const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tableViewFactory = require('../../scripts/core/tempExecTableViewOwner.js');

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createOwner(state, options) {
  const opts = options || {};
  return tableViewFactory.create(Object.assign({
    state,
    escapeHtml,
    escapeHtmlPreserve: escapeHtml,
    ensureTempExecColumns() { return {}; },
    getTempExecPageSize() { return 20; },
    getCaseExecutionStatus(file, item) { return item.actual || '未执行'; },
    mapFilterToStatus(key, status) {
      if (key === 'pending') return status === '未执行';
      return key === status;
    },
    ensureTempExecSelection() { return new Set(); },
    ensureTempExecRemarkOpen() { return new Set(); },
    ensureTempExecReuseOpen() { return new Set(); },
    ensureTempExecDefectOpen() { return new Set(); },
    ensureTempExecPageIndex(fileId) { return state.tempExecPages[fileId] || 0; },
  }, opts));
}

function verifyTableRendering() {
  const file = {
    id: 'file-a',
    name: '执行用例',
    cases: [{
      module: '登录',
      title: '正常登录',
      priority: 'P0',
      preconditions: '已注册',
      steps: '输入账号',
      expected: '登录成功',
      actual: '未执行',
      remark: '',
      defectLinks: [],
    }],
  };
  const state = {
    tempExecFiles: [file],
    tempExecPages: { 'file-a': 0 },
    tempExecSearch: { fileId: '', term: '', raw: '' },
    tempExecStatusFilter: { fileId: '', status: '' },
  };
  const owner = createOwner(state);
  const html = owner.renderTempExecTable(file);

  assert.match(html, /data-temp-case-row="file-a"/);
  assert.match(html, /data-temp-edit-field="title"/);
  assert.match(html, /data-temp-page-action="file-a"/);
  assert.strictEqual((html.match(/<th>前提条件<\/th>/g) || []).length, 1);
  assert.strictEqual(owner.isRequiredTempExecColumn('title'), true);
  assert.strictEqual(owner.isRequiredTempExecColumn('module'), false);
}

function verifyFilteringAndPagination() {
  const cases = [];
  for (let index = 0; index < 25; index += 1) {
    cases.push({
      module: '模块',
      title: '用例' + (index + 1),
      actual: index < 20 ? '通过' : '未执行',
      remark: '',
      defectLinks: [],
    });
  }
  const file = { id: 'file-b', name: '分页用例', cases };
  const state = {
    tempExecFiles: [file],
    tempExecPages: { 'file-b': 1 },
    tempExecSearch: { fileId: '', term: '', raw: '' },
    tempExecStatusFilter: { fileId: '', status: '' },
  };
  const owner = createOwner(state);
  const html = owner.renderTempExecTable(file);
  assert.match(html, /显示 21-25 \/ 25 条/);
  assert.match(html, /data-index="20"/);
  assert.doesNotMatch(html, /data-index="19"/);

  state.tempExecStatusFilter = { fileId: 'file-b', status: 'pending' };
  state.tempExecPages['file-b'] = 1;
  const filtered = owner.renderTempExecTable(file);
  assert.strictEqual(state.tempExecPages['file-b'], 0);
  assert.match(filtered, /显示 1-5 \/ 5 条/);
}

function verifyAssociationComposition() {
  const owner = createOwner({ tempExecFiles: [], tempExecPages: {} });
  const parts = owner.buildTempExecAssociationComposeParts({
    id: 'file-c',
    name: '主用例',
    associationEnabled: true,
    cases: [
      { caseItemId: 1 },
      { caseItemSourceId: 9 },
    ],
    associationRows: [{
      sub_case_file_id: 2,
      sub_case_file_name: '副用例',
      selected_count: 1,
    }],
  });
  assert.deepStrictEqual(parts, [
    { name: '主用例', role: '主', count: 1 },
    { name: '副用例', role: '副', count: 1 },
  ]);
}

function verifyOwnershipAndLoadOrder() {
  const projectRoot = path.join(__dirname, '..', '..');
  const coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempexecCore.js'), 'utf8');
  const ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecTableViewOwner.js'), 'utf8');

  assert.doesNotMatch(coreSource, /function buildTempExecPagination\(/);
  assert.doesNotMatch(coreSource, /function renderDefectLinks\(/);
  assert.doesNotMatch(coreSource, /function renderTempExecAssociationComposeHtml\(/);
  assert.match(coreSource, /function renderTempExecView\(\) \{ return tableViewApi \? tableViewApi\.renderTempExecView\(\)/);
  assert.match(coreSource, /tableViewOwner\.create\(\{/);
  assert.match(ownerSource, /data-temp-missing-reminder-slot/);
  assert.ok(ownerSource.split('\n').length <= 750, 'table view owner must stay within 750 lines');

  [
    'admin.html',
    'ai-tools.html',
    'ai-workflow.html',
    'case-exec.html',
    'case-library.html',
    'index.html',
    'settings.html',
  ].forEach((fileName) => {
    const html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    const overviewIndex = html.indexOf('tempExecOverviewViewOwner.js');
    const tableIndex = html.indexOf('tempExecTableViewOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(tableIndex > overviewIndex, fileName + ' must load table view after overview view');
    assert.ok(coreIndex > tableIndex, fileName + ' must load table view before tempexec core');
  });
}

function run() {
  verifyTableRendering();
  verifyFilteringAndPagination();
  verifyAssociationComposition();
  verifyOwnershipAndLoadOrder();
  console.log('temp exec table view owner tests passed');
}

run();
