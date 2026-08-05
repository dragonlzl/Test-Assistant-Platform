const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ownerPath = '../../scripts/modules/xmindCasegen/xmindCasegenPrepDialogController.js';

function createClassList() {
  const values = {};
  return {
    add: function(name) { values[name] = true; },
    remove: function(name) { delete values[name]; },
    toggle: function(name, enabled) {
      if (enabled) values[name] = true;
      else delete values[name];
    },
    has: function(name) { return values[name] === true; },
  };
}

function createBody() {
  const listeners = {};
  const queryMap = {};
  const queryAllMap = {};
  return {
    innerHTML: '',
    listeners: listeners,
    queryMap: queryMap,
    queryAllMap: queryAllMap,
    addEventListener: function(name, handler) { listeners[name] = handler; },
    removeEventListener: function(name, handler) {
      if (listeners[name] === handler) delete listeners[name];
    },
    querySelector: function(selector) { return queryMap[selector] || null; },
    querySelectorAll: function(selector) { return queryAllMap[selector] || []; },
  };
}

function createHarness(controllerFactory) {
  const body = createBody();
  const prep = {
    step: 1,
    requirementMode: 'manual',
    requirementSupplement: '',
    manualRequirementLabel: '登录需求',
    manualRequirementBlocks: [
      { type: 'text', text: '验证登录流程' },
      { type: 'image', name: 'login.png', dataUrl: 'data:image/png;base64,AA==' },
    ],
    caseImportMode: 'import',
    baseLocked: false,
    completed: false,
  };
  const settings = {
    customRequirement: '',
    dedupeSimplify: false,
    needFunctionCondition: true,
    needNumericValidation: false,
    needBoundary: true,
    needMobile: false,
    needSpecial: false,
    specialRepeatOperation: false,
    specialMultiTouch: false,
    specialRepeatExecution: false,
    specialWeakNetwork: false,
    specialInterruptResume: false,
  };
  const readiness = { requirement: true, cases: true };
  const calls = {
    fields: [],
    optionDrafts: [],
    options: [],
    renders: 0,
    shellRenders: 0,
    centered: 0,
    persists: [],
    closes: [],
    toasts: [],
    statuses: [],
    schedules: [],
    requirementImports: 0,
    caseImports: 0,
    libraryImports: 0,
    imageInputClicks: 0,
    resets: 0,
    removedImages: [],
    manualTexts: [],
    pastedFiles: [],
    droppedRequirement: [],
    droppedCases: [],
  };

  const controller = controllerFactory.create({
    summaryDialogBodyEl: body,
    escapeHtml: function(value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
    cloneJson: function(value, fallback) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (error) {
        return fallback;
      }
    },
    isPrepDialogOpen: function() { return true; },
    getPrepState: function() { return prep; },
    clampPrepStep: function(value) { return Math.max(1, Math.min(3, Number(value) || 1)); },
    hasRequirementReady: function() { return readiness.requirement; },
    hasCaseStepReady: function() { return readiness.cases; },
    isPrepBaseLocked: function() { return prep.baseLocked === true; },
    getCaseGenSettingsSnapshot: function() { return settings; },
    applyCaseGenOptionDraft: function(key, value) {
      calls.optionDrafts.push([key, value]);
      settings[key] = value;
    },
    setPrepField: function(key, value) {
      calls.fields.push([key, value]);
      prep[key] = value;
      if (key !== 'completed' && key !== 'step' && key !== 'baseLocked') prep.completed = false;
      return true;
    },
    setCaseGenOption: function(key, value) {
      calls.options.push([key, value]);
      settings[key] = value;
    },
    persistXmindState: function(immediate) { calls.persists.push(immediate); },
    renderOpenedSummaryDialog: function() { calls.shellRenders += 1; },
    closeSummaryDialog: function(options) { calls.closes.push(options); },
    renderMind: function(options) { calls.renders += 1; calls.renderOptions = options; },
    centerRootNodeView: function() { calls.centered += 1; },
    notifySuccessToast: function(text, duration) { calls.toasts.push([text, duration]); },
    notifyStatus: function(text, type) { calls.statuses.push([text, type]); },
    scheduleRender: function(reason) { calls.schedules.push(reason); },
    getActiveKnowledgeBaseState: function() { return { usedInLatestGeneration: true }; },
    getDocumentRequirementText: function() { return '文档需求内容'; },
    getDocumentRequirementImportName: function() { return 'requirement.docx'; },
    getDocumentRequirementImageCount: function() { return 2; },
    getManualRequirementLabelText: function() { return prep.manualRequirementLabel; },
    getManualRequirementText: function() {
      const text = prep.manualRequirementBlocks.find(function(item) { return item.type === 'text'; });
      return text ? text.text : '';
    },
    getManualRequirementImages: function() {
      return prep.manualRequirementBlocks.filter(function(item) { return item.type === 'image'; });
    },
    buildCasesSummaryInfo: function() { return { title: 'cases.xlsx', meta: '2 个模块，8 条用例' }; },
    hasImportedBaselineCases: function() { return true; },
    hasAnyRunningGenerationOperation: function() { return false; },
    triggerRequirementImport: function() { calls.requirementImports += 1; },
    triggerCasesImport: function() { calls.caseImports += 1; },
    triggerCasesLibrarySelect: function() { calls.libraryImports += 1; },
    ensureManualImageInput: function() {
      return { click: function() { calls.imageInputClicks += 1; } };
    },
    requestPrepReset: function() { calls.resets += 1; },
    removeManualRequirementImage: function(index) { calls.removedImages.push(index); },
    setManualRequirementText: function(value) { calls.manualTexts.push(value); },
    appendManualRequirementImages: function(files) {
      calls.pastedFiles.push(files);
      return Promise.resolve(true);
    },
    importRequirementFileFromDrop: function(file) { calls.droppedRequirement.push(file); return true; },
    importCasesFilesFromDrop: function(files) { calls.droppedCases.push(files); return true; },
  });

  return {
    body: body,
    prep: prep,
    settings: settings,
    readiness: readiness,
    calls: calls,
    controller: controller,
  };
}

function verifyThreeStepRendering(controllerFactory) {
  const harness = createHarness(controllerFactory);
  harness.controller.renderPrepDialog();
  assert.match(harness.body.innerHTML, /需求导入/);
  assert.match(harness.body.innerHTML, /登录需求/);
  assert.match(harness.body.innerHTML, /login\.png/);
  assert.match(harness.body.innerHTML, /已使用知识库/);

  harness.prep.requirementMode = 'document';
  harness.controller.renderPrepDialog();
  assert.match(harness.body.innerHTML, /requirement\.docx/);
  assert.match(harness.body.innerHTML, /图片 2 张/);

  harness.prep.step = 2;
  harness.controller.renderPrepDialog();
  assert.match(harness.body.innerHTML, /是否导入用例/);
  assert.match(harness.body.innerHTML, /cases\.xlsx/);
  assert.match(harness.body.innerHTML, /2 个模块，8 条用例/);

  harness.prep.step = 3;
  harness.controller.renderPrepDialog();
  assert.match(harness.body.innerHTML, /生成选项/);
  assert.match(harness.body.innerHTML, /考虑功能使用条件/);
  assert.match(harness.body.innerHTML, /specialWeakNetwork/);

  harness.prep.baseLocked = true;
  harness.prep.step = 1;
  harness.controller.renderPrepDialog();
  assert.match(harness.body.innerHTML, /当前步骤仅可查看/);
  assert.match(harness.body.innerHTML, /disabled/);
}

function verifyDraftSynchronization(controllerFactory) {
  const harness = createHarness(controllerFactory);
  harness.prep.completed = true;
  harness.body.queryAllMap['input[name="xmindRequirementMode"]'] = [{}];
  harness.body.queryAllMap['input[name="xmindCaseImportMode"]'] = [{}];
  harness.body.queryMap['input[name="xmindRequirementMode"]:checked'] = { value: 'document' };
  harness.body.queryMap['input[name="xmindCaseImportMode"]:checked'] = { value: 'skip' };
  harness.body.queryMap['#xmindCaseGenRequirementSupplement'] = { value: '补充内容' };
  harness.body.queryMap['#xmindCaseGenManualRequirementLabel'] = { value: '新名称' };
  harness.body.queryMap['#xmindCaseGenManualRequirementText'] = { value: '新正文' };
  harness.body.queryMap['#xmindCaseGenOptionCustomRequirement'] = { value: '强调异常流程' };
  harness.body.queryAllMap['input[data-casegen-setting]'] = [{
    type: 'checkbox',
    checked: true,
    getAttribute: function() { return 'needMobile'; },
  }];

  assert.strictEqual(harness.controller.syncSummaryDraftIntoState(), true);
  assert.strictEqual(harness.prep.requirementMode, 'document');
  assert.strictEqual(harness.prep.caseImportMode, 'skip');
  assert.strictEqual(harness.prep.requirementSupplement, '补充内容');
  assert.strictEqual(harness.prep.manualRequirementLabel, '新名称');
  assert.strictEqual(harness.prep.manualRequirementBlocks[0].text, '新正文');
  assert.strictEqual(harness.prep.manualRequirementBlocks[1].name, 'login.png');
  assert.strictEqual(harness.prep.completed, false);
  assert.deepStrictEqual(harness.calls.optionDrafts, [
    ['customRequirement', '强调异常流程'],
    ['needMobile', true],
  ]);

  harness.prep.completed = true;
  harness.body.queryMap['#xmindCaseGenRequirementSupplement'].value = '再次修改';
  harness.controller.syncSummaryDraftIntoState({ preserveCompleted: true });
  assert.strictEqual(harness.prep.completed, true);
}

function verifyNavigationAndConfirmation(controllerFactory) {
  const harness = createHarness(controllerFactory);
  harness.readiness.requirement = false;
  assert.strictEqual(harness.controller.handlePrepNav('next'), false);
  assert.strictEqual(harness.prep.step, 1);

  harness.readiness.requirement = true;
  assert.strictEqual(harness.controller.handlePrepNav('next'), true);
  assert.strictEqual(harness.prep.step, 2);
  assert.strictEqual(harness.calls.shellRenders, 1);

  assert.strictEqual(harness.controller.handlePrepNav('prev'), true);
  assert.strictEqual(harness.prep.step, 1);

  harness.prep.step = 3;
  harness.prep.caseImportMode = 'import';
  assert.strictEqual(harness.controller.handlePrepNav('confirm'), true);
  assert.strictEqual(harness.prep.baseLocked, true);
  assert.strictEqual(harness.prep.completed, true);
  assert.strictEqual(harness.prep.step, 3);
  assert.deepStrictEqual(harness.calls.persists, [true]);
  assert.deepStrictEqual(harness.calls.closes, [{ skipPersist: true }]);
  assert.strictEqual(harness.calls.renders, 1);
  assert.strictEqual(harness.calls.centered, 1);
  assert.strictEqual(harness.calls.renderOptions.reason, 'prep-confirmed');
}

async function verifyDelegatedEvents(controllerFactory) {
  const harness = createHarness(controllerFactory);
  harness.controller.bind();
  assert.deepStrictEqual(Object.keys(harness.body.listeners).sort(), [
    'change', 'click', 'dragleave', 'dragover', 'drop', 'input', 'paste',
  ]);

  harness.body.listeners.change({ target: { name: 'xmindRequirementMode', value: 'document' } });
  assert.deepStrictEqual(harness.calls.fields[0], ['requirementMode', 'document']);

  harness.body.listeners.input({
    target: {
      value: '实时名称',
      getAttribute: function(name) { return name === 'data-prep-input' ? 'manualRequirementLabel' : ''; },
    },
  });
  assert.deepStrictEqual(harness.calls.fields[1], ['manualRequirementLabel', '实时名称']);

  const actionTarget = {
    getAttribute: function(name) { return name === 'data-prep-action' ? 'select-cases-library' : ''; },
  };
  harness.body.listeners.click({
    target: {
      closest: function(selector) { return selector === '[data-prep-action]' ? actionTarget : null; },
    },
  });
  assert.strictEqual(harness.calls.libraryImports, 1);

  const imageFile = { name: 'paste.png', type: 'image/png' };
  let pastePrevented = false;
  harness.body.listeners.paste({
    target: { getAttribute: function(name) { return name === 'data-manual-requirement-text' ? '1' : ''; } },
    clipboardData: {
      items: [{ kind: 'file', getAsFile: function() { return imageFile; } }],
    },
    preventDefault: function() { pastePrevented = true; },
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(pastePrevented, true);
  assert.strictEqual(harness.calls.pastedFiles[0][0], imageFile);
  assert.deepStrictEqual(harness.calls.statuses[0], ['已粘贴需求图片', 'ok']);

  const requirementZone = { classList: createClassList() };
  const droppedFile = { name: 'requirement.docx' };
  harness.body.listeners.drop({
    target: {
      closest: function(selector) {
        return selector === '#xmindCaseGenPrepRequirementDropzone' ? requirementZone : null;
      },
    },
    dataTransfer: { files: [droppedFile] },
    preventDefault: function() {},
  });
  assert.strictEqual(harness.calls.droppedRequirement[0], droppedFile);

  harness.controller.unbind();
  assert.deepStrictEqual(Object.keys(harness.body.listeners), []);
}

function verifyOwnershipAndLoadOrder() {
  const repoRoot = path.join(__dirname, '..', '..');
  const parentSource = fs.readFileSync(path.join(repoRoot, 'scripts/modules/xmindCasegen.js'), 'utf8');
  const ownerSource = fs.readFileSync(
    path.join(repoRoot, 'scripts/modules/xmindCasegen/xmindCasegenPrepDialogController.js'),
    'utf8'
  );
  [
    'syncSummaryDraftIntoState',
    'syncPrepDialogState',
    'renderRequirementStepCard',
    'renderCasesStepCard',
    'renderOptionsStepCard',
    'renderPrepDialog',
    'setPrepStep',
    'handlePrepNav',
  ].forEach(function(functionName) {
    const signature = new RegExp('function ' + functionName + '\\(');
    assert.match(ownerSource, signature, functionName + ' must belong to the prep owner');
    assert.doesNotMatch(parentSource, signature, functionName + ' must not remain in the giant entry');
  });
  assert.match(parentSource, /var prepDialogController = prepDialogControllerFactory\.create\(\{/);
  assert.match(parentSource, /var renderPrepDialog = prepDialogController\.renderPrepDialog;/);
  assert.match(parentSource, /var syncSummaryDraftIntoState = prepDialogController\.syncSummaryDraftIntoState;/);
  assert.match(parentSource, /prepDialogController\.bind\(\);/);

  ['index.html', 'ai-workflow.html'].forEach(function(fileName) {
    const html = fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
    const ownerIndex = html.indexOf('xmindCasegenPrepDialogController.js');
    const parentIndex = html.indexOf('scripts/modules/xmindCasegen.js');
    assert.ok(ownerIndex >= 0, fileName + ' must load the prep dialog owner');
    assert.ok(parentIndex > ownerIndex, fileName + ' must load the owner before xmindCasegen.js');
  });
}

async function run() {
  const controllerFactory = require(ownerPath);
  verifyThreeStepRendering(controllerFactory);
  verifyDraftSynchronization(controllerFactory);
  verifyNavigationAndConfirmation(controllerFactory);
  await verifyDelegatedEvents(controllerFactory);
  verifyOwnershipAndLoadOrder();
  console.log('xmind casegen prep dialog controller tests passed');
}

run().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
