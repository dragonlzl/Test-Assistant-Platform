const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ownerFactory = require('../../scripts/modules/tempExecDbImportWorkflowOwner.js');

function createStorage(initialValue) {
  const values = Object.assign({}, initialValue || {});
  return {
    values,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      values[key] = String(value);
    },
  };
}

function createElement(value) {
  const listeners = {};
  return {
    value: value || '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    selectedIndex: 0,
    options: [],
    listeners,
    classList: {
      values: new Set(),
      add(name) { this.values.add(name); },
      remove(name) { this.values.delete(name); },
    },
    addEventListener(name, handler) {
      listeners[name] = handler;
    },
  };
}

function verifyPureRules() {
  assert.strictEqual(ownerFactory.stripFileExt('/tmp/login.xlsx'), 'login');
  assert.strictEqual(ownerFactory.buildNameList(['A', 'B', 'C'], 2), 'A、B...（共 3 份）');
  assert.deepStrictEqual(
    ownerFactory.selectRemainingFiles(
      [{ name: 'A.xlsx' }, { name: 'B.xlsx' }, { name: 'C.xlsx' }],
      [{ file: 'A.xlsx' }],
      [{ duplicate: { file_name: 'C.xlsx' } }]
    ).map((file) => file.name),
    ['A.xlsx', 'C.xlsx']
  );
  assert.strictEqual(
    ownerFactory.buildFinalImportMessage(
      ['新增用例'],
      ['覆盖用例'],
      [{ name: '跳过用例', reason: '同名冲突已跳过' }],
      [{ name: '失败用例', reason: '格式错误' }]
    ),
    [
      '入库完成：成功 2，跳过 1，失败 1',
      '入库成功：新增用例',
      '覆盖导入成功：覆盖用例',
      '跳过 - 跳过用例：同名冲突已跳过',
      '失败 - 失败用例：格式错误',
    ].join('\n')
  );
}

async function verifyWorkflow() {
  const persisted = JSON.stringify({ user_id: '7', project_id: '2', version_id: '3' });
  const storage = createStorage({ 'tap-tempexec-import-drawer': persisted });
  const projectSelect = createElement('');
  const versionSelect = createElement('');
  const confirmButton = createElement('');
  const fileHint = createElement('');
  const fileInput = createElement('');
  const dropZone = createElement('');
  const diffOverwriteButton = createElement('');
  const diffState = { queue: { active: false, total: 0, index: -1 } };
  const statuses = [];
  const importCalls = [];
  let importDrawerClosed = 0;
  let importDrawerOpened = 0;
  let diffOpenCount = 0;
  const browser = {
    localStorage: storage,
    app: {
      authReady: true,
      state: {
        currentUser: { id: 7 },
        projects: [{ id: 2, name: '支付项目' }],
      },
      execVersionDrawer: {
        open(options) {
          assert.strictEqual(options.projectId, '2');
          assert.strictEqual(options.importVersionId, '3');
          return Promise.resolve({ ok: true, versionId: 9 });
        },
      },
      utils: { showCenterToast() {} },
    },
  };
  const apiClient = {
    listProjects() {
      return Promise.resolve([{ id: 2, name: '支付项目' }]);
    },
    listProjectVersions(projectId) {
      assert.strictEqual(String(projectId), '2');
      return Promise.resolve([{ id: 3, name: 'V3' }]);
    },
    listCaseItems() {
      return Promise.resolve([{ id: 1, module: '登录' }]);
    },
    listExecSets() {
      return Promise.resolve([]);
    },
  };
  const duplicateTask = {
    payload: {
      existing_case_file_id: 11,
      existing_file_name_clean: '登录',
      existing_version_id: 3,
    },
    duplicate: {
      project_id: 2,
      version_id: 3,
      file_name: '登录.xlsx',
      clean_name: '登录',
      items: [],
      exec_cases: [],
      has_result: false,
    },
  };
  const api = {
    importTempExecFiles() {},
    importTempExecFilesToDb(files, projectId, versionId, execVersionId) {
      importCalls.push({ files, projectId, versionId, execVersionId });
      return Promise.resolve({
        failed: [],
        imported_names: [],
        duplicates: [duplicateTask],
      });
    },
  };
  const owner = ownerFactory.create({
    state: browser.app.state,
    window: browser,
    storage,
    api,
    apiClient,
    dom: {
      projectSelect,
      versionSelect,
      confirmButton,
      fileHint,
      fileInput,
      dropZone,
      diffOverwriteButton,
    },
    importDrawer: {
      close() { importDrawerClosed += 1; },
      open() { importDrawerOpened += 1; },
    },
    setStatus(element, message, level) {
      statuses.push({ element, message, level });
    },
    escapeHtml(value) { return String(value); },
    getDiffState() { return diffState; },
    openDiffLoading() {},
    openDiff() {
      diffOpenCount += 1;
      diffState.external.resolve({ ok: true, overwrite: true });
    },
    detectExecCasesHasResult() { return false; },
  });

  await owner.init();
  assert.strictEqual(owner.getState().projectId, '2');
  assert.strictEqual(owner.getState().versionId, '3');
  assert.strictEqual(projectSelect.value, '2');
  assert.strictEqual(versionSelect.value, '3');
  assert.ok(projectSelect.listeners.change);
  assert.ok(versionSelect.listeners.change);
  assert.ok(confirmButton.listeners.click);
  assert.ok(diffOverwriteButton.listeners.click);

  const selectedFile = { name: '登录.xlsx' };
  assert.strictEqual(owner.selectFiles([selectedFile]), true);
  assert.strictEqual(fileHint.textContent, '已选择 1 份文件：登录.xlsx');
  assert.strictEqual(confirmButton.disabled, false);

  const result = await owner.handleConfirm();
  assert.strictEqual(importDrawerClosed, 1);
  assert.strictEqual(importDrawerOpened, 1);
  assert.strictEqual(diffOpenCount, 1);
  assert.strictEqual(importCalls.length, 1);
  assert.strictEqual(importCalls[0].execVersionId, 9);
  assert.deepStrictEqual(result.overwrittenNames, ['登录']);
  assert.strictEqual(owner.getState().pendingFiles.length, 0);
  assert.ok(statuses.some((entry) => entry.message.indexOf('入库完成：成功 1') !== -1));

  owner.invalidateProjectsCache();
  assert.strictEqual(owner.getState().projectsLoaded, false);
  assert.strictEqual(owner.getState().projectId, '');
  assert.strictEqual(owner.getState().versionId, '');
}

function verifyOwnershipAndLoadOrder() {
  const projectRoot = path.join(__dirname, '..', '..');
  const parentSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempexec.js'), 'utf8');
  const ownerSource = fs.readFileSync(path.join(projectRoot, 'scripts/modules/tempExecDbImportWorkflowOwner.js'), 'utf8');
  assert.match(ownerSource, /function openDiffForQueueTask\(/);
  assert.match(ownerSource, /function handleConfirm\(/);
  assert.match(ownerSource, /function ensureProjects\(/);
  assert.doesNotMatch(parentSource, /function openImportDiffForQueueTask\(/);
  assert.doesNotMatch(parentSource, /function handleImportProjectChange\(/);
  assert.doesNotMatch(parentSource, /function buildFinalImportMessage\(/);
  assert.match(parentSource, /tempExecDbImportWorkflowOwner\.create\(\{/);

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
    const workflowIndex = html.indexOf('./scripts/modules/tempExecDbImportWorkflowOwner.js');
    const parentIndex = html.indexOf('./scripts/modules/tempexec.js');
    assert.ok(workflowIndex >= 0, fileName + ' must load the database import workflow owner');
    assert.ok(parentIndex > workflowIndex, fileName + ' must load the workflow owner before tempexec');
  });
}

async function run() {
  verifyPureRules();
  await verifyWorkflow();
  verifyOwnershipAndLoadOrder();
  console.log('temp exec database import workflow owner tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
