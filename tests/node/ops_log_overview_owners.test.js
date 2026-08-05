'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '../..');
var auditModel = require(path.join(projectRoot, 'scripts/modules/opsLogAuditModel.js'));
var dataSourceFactory = require(path.join(projectRoot, 'scripts/modules/opsLogDataSource.js'));
var model = require(path.join(projectRoot, 'scripts/modules/opsLogOverviewModel.js'));
var controllerFactory = require(path.join(projectRoot, 'scripts/modules/opsLogOverviewController.js'));

function completeCaseDetail(overrides) {
  return Object.assign({
    module: '登录',
    title: '登录成功',
    precondition: '账号存在',
    steps: '输入账号并提交',
    expected: '进入首页',
  }, overrides || {});
}

function verifyContributionRules() {
  assert.deepStrictEqual(model.resolveContributionEntry({
    action: 'import_case_file',
    detail: { item_imported: 3 },
  }), { key: 'import', count: 3 });
  assert.deepStrictEqual(model.resolveContributionEntry({
    action: 'create_case_item',
    detail: completeCaseDetail(),
  }), { key: 'add', count: 1 });
  assert.strictEqual(model.resolveContributionEntry({
    action: 'create_case_item',
    detail: completeCaseDetail({ expected: '' }),
  }), null);
  assert.deepStrictEqual(model.resolveContributionEntry({
    action: 'update_case_item',
    detail: completeCaseDetail({ prev_complete: false, next_complete: true }),
  }), { key: 'add', count: 1 });
}

function verifySummaryAndSelection() {
  var logs = [
    { user_id: 1, username: 'admin', action: 'import_case_file', detail: { item_imported: 3 } },
    { user_id: 1, username: 'admin', action: 'create_case_item', detail: completeCaseDetail() },
    { user_id: 2, username: 'tester', action: 'delete_case_file', detail: { item_deleted_complete: 2 } },
  ];
  var summary = model.buildSummary(logs, { mode: 'contribution', userNameMap: {} });
  assert.deepStrictEqual(summary.behaviors.map(function(item) { return item.count; }), [3, 1, 0, 2]);
  var importUsers = model.selectActionUsers(summary, { all: false, import: true }, 'contribution');
  assert.strictEqual(importUsers.length, 1);
  assert.strictEqual(importUsers[0].name, 'admin');
  assert.strictEqual(importUsers[0].total, 3);
}

function verifyExecDeduplication() {
  var detail = completeCaseDetail({ exec_set_id: 9, status: '通过', changed_fields: ['status'] });
  var logs = [
    { user_id: 1, username: 'admin', action: 'update_exec_case', detail: detail },
    { user_id: 1, username: 'admin', action: 'update_exec_case', detail: detail },
    { user_id: 1, username: 'admin', action: 'archive_exec_set', detail: { actual_result_count: 4 } },
  ];
  var summary = model.buildSummary(logs, { mode: 'exec', userNameMap: {} });
  var users = model.selectExecUsers(summary, { all: true });
  assert.strictEqual(users.length, 1);
  assert.strictEqual(users[0].execCount, 1);
  assert.strictEqual(users[0].archiveCount, 4);
}

function verifyAuditModel() {
  auditModel.configure({
    overviewModel: model,
    formatTime: function(value) { return 'time:' + value; },
  });
  var log = {
    user_id: 1,
    username: 'admin',
    action: 'create_project',
    target_type: 'project',
    target_id: 3,
    detail: { name: 'Alpha' },
    created_at: '2026-07-27T00:00:00Z',
  };
  assert.strictEqual(auditModel.buildTargetLabel(log), '项目：Alpha');
  assert.strictEqual(auditModel.resolveActivityActionLabel(log), '新增');
  assert.strictEqual(auditModel.buildOpsLogExportRows([log])[1][0], 'time:2026-07-27T00:00:00Z');
}

async function verifyDataSource() {
  var calls = 0;
  var firstOptions = null;
  var source = dataSourceFactory.create({
    apiClient: {
      listOperationLogs: function(options) {
        calls += 1;
        if (!firstOptions) firstOptions = options;
        if (options.offset > 0) return Promise.resolve([]);
        return Promise.resolve([
          { id: 1, action: 'create_project', created_at: '2026-07-27T00:00:00Z' },
          { id: 2, action: 'auto_sync', created_at: '2026-07-27T00:00:00Z' },
        ]);
      },
    },
    isAutoOperation: function(log) { return log.action === 'auto_sync'; },
    isAllowedLog: function() { return true; },
    isTimeInRange: function() { return true; },
  });
  var logs = await source.fetchByRange({ startMs: null, endMs: null }, {});
  assert.strictEqual(calls, 1);
  assert.strictEqual(firstOptions.start_ms, undefined);
  assert.strictEqual(firstOptions.end_ms, undefined);
  assert.deepStrictEqual(logs.map(function(log) { return log.id; }), [1]);
}

function createClassList() {
  var values = {};
  return {
    add: function(name) { values[name] = true; },
    remove: function(name) { delete values[name]; },
    toggle: function(name, enabled) {
      if (enabled) values[name] = true;
      else delete values[name];
    },
    contains: function(name) { return Boolean(values[name]); },
  };
}

function createElement() {
  return {
    addEventListener: function() {},
    checked: false,
    classList: createClassList(),
    disabled: false,
    innerHTML: '',
    textContent: '',
    value: '',
  };
}

function createViewDom(prefix) {
  var lower = prefix.charAt(0).toLowerCase() + prefix.slice(1);
  var result = {};
  [
    'Card', 'List', 'Empty', 'Status', 'DrawerStatus', 'UserGrid', 'SelectAll', 'ApplyBtn',
    'UserEmpty', 'TimeRange', 'DateStart', 'DateEnd', 'BehaviorGrid', 'RefreshBtn', 'SelectionText'
  ].forEach(function(suffix) {
    result[lower + suffix] = createElement();
  });
  return result;
}

function verifyControllerBoundary() {
  var dom = Object.assign(
    {},
    createViewDom('activity'),
    createViewDom('contribution'),
    createViewDom('execContribution')
  );
  var state = {
    users: [{ id: 1, username: 'admin' }],
    overviewView: 'activity',
    activity: createViewState(),
    contribution: createViewState(),
    execContribution: createViewState(),
  };
  var controller = controllerFactory.create({
    state: state,
    dom: dom,
    model: model,
    canView: function() { return false; },
    normalizeView: function(value) { return value || 'activity'; },
    createDrawer: function() { return { close: function() {} }; },
    getDateRangeMs: function() { return { startMs: null, endMs: null }; },
  });
  controller.initialize();
  controller.notifyUsersChanged();
  controller.renderAll();
  assert.strictEqual(dom.activityEmpty.textContent, '仅管理员可查看活跃度');
  assert.strictEqual(dom.contributionEmpty.textContent, '仅管理员可查看用例贡献');
  assert.strictEqual(dom.execContributionEmpty.textContent, '仅管理员可查看用例执行贡献');
  assert.ok(dom.activityUserGrid.innerHTML.indexOf('admin') >= 0);
}

function createViewState() {
  return {
    drawer: null,
    usersLoaded: false,
    logsLoaded: false,
    loading: false,
    selectedUserIds: [],
    draftUserIds: [],
    selectedBehaviors: { all: true },
    timeRange: 'week',
    dateStart: '',
    dateEnd: '',
    hasSelection: false,
    logs: [],
    behaviors: [],
    colorMap: {},
    lastFetchedAt: 0,
  };
}

function verifyOwnershipAndLoadingOrder() {
  var parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/opsLog.js'), 'utf8');
  [
    'function buildContributionViewData(',
    'function buildExecContributionViewData(',
    'function renderActivityView(',
    'function refreshContributionView(',
    'function ensureExecContributionDrawer(',
  ].forEach(function(snippet) {
    assert.strictEqual(parentSource.indexOf(snippet), -1, 'parent still owns ' + snippet);
  });

  [
    'index.html', 'admin.html', 'ai-tools.html', 'ai-workflow.html',
    'case-exec.html', 'case-library.html', 'settings.html'
  ].forEach(function(fileName) {
    var html = fs.readFileSync(path.join(projectRoot, fileName), 'utf8');
    var auditIndex = html.indexOf('scripts/modules/opsLogAuditModel.js');
    var dataSourceIndex = html.indexOf('scripts/modules/opsLogDataSource.js');
    var modelIndex = html.indexOf('scripts/modules/opsLogOverviewModel.js');
    var controllerIndex = html.indexOf('scripts/modules/opsLogOverviewController.js');
    var parentIndex = html.indexOf('scripts/modules/opsLog.js');
    assert.ok(auditIndex >= 0, fileName + ' missing audit model');
    assert.ok(dataSourceIndex > auditIndex, fileName + ' data source loading order');
    assert.ok(modelIndex > dataSourceIndex, fileName + ' overview model loading order');
    assert.ok(controllerIndex > modelIndex, fileName + ' controller loading order');
    assert.ok(parentIndex > controllerIndex, fileName + ' parent loading order');
  });
}

verifyContributionRules();
verifySummaryAndSelection();
verifyExecDeduplication();
verifyAuditModel();
verifyControllerBoundary();
verifyOwnershipAndLoadingOrder();
verifyDataSource().then(function() {
  console.log('ops log owner tests passed');
}).catch(function(err) {
  console.error(err);
  process.exitCode = 1;
});
