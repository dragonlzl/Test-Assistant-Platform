const assert = require('assert');
const fs = require('fs');
const path = require('path');

const navigationFactory = require('../../scripts/core/tempExecNavigationViewOwner.js');
const overviewFactory = require('../../scripts/core/tempExecOverviewViewOwner.js');

function verifyNavigationOwner() {
  const classList = {
    add() {},
    remove() {},
    toggle() {},
  };
  const tempExecNav = {
    classList,
    innerHTML: '',
    previousElementSibling: null,
    querySelectorAll() { return []; },
  };
  const state = {
    projects: [{ id: 'project-a' }],
    tempExecFiles: [
      { id: 'file-a', requirement: 'REQ-A', cases: [{}, {}] },
      { id: 'file-b', requirement: 'REQ-B', cases: [] },
    ],
    tempExecFocus: [],
    tempExecPlacement: { requirementOrder: ['REQ-A', 'REQ-B'] },
    tempExecReqCollapsed: false,
    tempExecVersionCollapsed: false,
  };
  let persisted = 0;
  let navRendered = 0;
  let versionRendered = 0;
  let scheduled = 0;
  const owner = navigationFactory.create({
    state,
    tempExecNav,
    normalizeRequirementName(value) { return String(value || '').trim(); },
    ensureTempExecPlacement() { return state.tempExecPlacement; },
    persistTempExecState() { persisted += 1; },
    scheduleTempExecUiSave() { scheduled += 1; },
    renderTempExecOverview() {},
  });

  assert.strictEqual(owner.getTempExecFileCaseCount(state.tempExecFiles[0]), 2);
  assert.strictEqual(owner.getTempExecFileCaseCount({ case_count: 7 }), 7);
  assert.strictEqual(owner.normalizeTempExecImportProjectFilterId('project-a'), 'project-a');
  assert.strictEqual(owner.normalizeTempExecImportProjectFilterId('missing'), '');

  owner.renderTempExecNav();
  const itemStart = tempExecNav.innerHTML.indexOf('<button type="button" data-temp-file="file-a"');
  const itemEnd = tempExecNav.innerHTML.indexOf('</button>', itemStart);
  const removeIndex = tempExecNav.innerHTML.indexOf('data-temp-remove="file-a"');
  assert.ok(itemStart >= 0 && itemEnd > itemStart, 'file action button must render');
  assert.ok(removeIndex > itemEnd, 'remove control must be outside the file action button');

  owner.setRenderPorts({
    renderTempExecNav() { navRendered += 1; },
    renderTempVersionGrid() { versionRendered += 1; },
  });
  owner.prioritizeTempExecUnassignedRequirements();
  assert.deepStrictEqual(state.tempExecPlacement.requirementOrder, ['REQ-A', 'REQ-B']);
  assert.strictEqual(navRendered, 1);

  owner.toggleTempExecRequirementZone();
  owner.toggleTempExecVersionZone();
  assert.strictEqual(state.tempExecReqCollapsed, true);
  assert.strictEqual(state.tempExecVersionCollapsed, true);
  assert.strictEqual(persisted, 2);
  assert.strictEqual(navRendered, 2);
  assert.strictEqual(versionRendered, 1);

  owner.setTempExecImportProjectFilter('project-a');
  assert.strictEqual(state.tempExecImportProjectFilterId, 'project-a');
  assert.strictEqual(versionRendered, 2);
  assert.strictEqual(scheduled, 1);
}

function verifyOverviewOwner() {
  const files = [
    {
      id: 'file-a',
      requirement: 'REQ-A',
      cases: [{ actual: '通过' }, { actual: '失败' }, { actual: '未执行' }],
    },
    { id: 'file-b', requirement: 'REQ-B', cases: [{ actual: '不适用' }] },
  ];
  const owner = overviewFactory.create({
    state: { tempExecFiles: files, tempExecFocus: [] },
    getCaseExecutionStatus(file, item) { return item.actual; },
    getTempExecFile(fileId) { return files.find((file) => file.id === fileId) || null; },
    normalizeRequirementName(value) { return String(value || '').trim(); },
    ensureRequirementOrder() { return ['REQ-B', 'REQ-A']; },
    ensureFileOrder(req, ids) { return ids; },
    isTempExecProjectLayoutEnabled() { return false; },
  });

  assert.deepStrictEqual(owner.buildTempExecSummary(files[0]), {
    total: 3,
    executed: 2,
    passed: 1,
    failed: 1,
    blocked: 0,
    unspecified: 0,
    pending: 1,
  });
  assert.strictEqual(owner.resolveTempExecState(files[0]), 'err');
  assert.strictEqual(owner.resolveTempExecState(files[1]), 'ok');
  assert.deepStrictEqual(owner.getTempExecOrderedFileIds(), ['file-b', 'file-a']);
  assert.strictEqual(owner.mapFilterToStatus('pending', '未执行'), true);
  assert.strictEqual(owner.mapFilterToStatus('failed', '通过'), false);
}

function verifyOwnershipAndLoadOrder() {
  const projectRoot = path.join(__dirname, '..', '..');
  const coreSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempexecCore.js'), 'utf8');
  const navigationSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecNavigationViewOwner.js'), 'utf8');
  const overviewSource = fs.readFileSync(path.join(projectRoot, 'scripts/core/tempExecOverviewViewOwner.js'), 'utf8');

  assert.doesNotMatch(coreSource, /function renderTempProjectGrid\(/);
  assert.doesNotMatch(coreSource, /function renderTempExecOverviewProjectLayout\(/);
  assert.match(coreSource, /function buildTempExecSummary\(file\) \{ return overviewViewApi\.buildTempExecSummary\(file\); \}/);
  assert.match(coreSource, /navigationViewOwner\.create\(\{/);
  assert.match(coreSource, /overviewViewOwner\.create\(\{/);
  assert.ok(navigationSource.split('\n').length <= 900, 'navigation owner must stay within 900 lines');
  assert.ok(overviewSource.split('\n').length <= 950, 'overview owner must stay within 950 lines');

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
    const navigationIndex = html.indexOf('tempExecNavigationViewOwner.js');
    const overviewIndex = html.indexOf('tempExecOverviewViewOwner.js');
    const coreIndex = html.indexOf('tempexecCore.js');
    assert.ok(navigationIndex >= 0, fileName + ' must load the navigation owner');
    assert.ok(overviewIndex > navigationIndex, fileName + ' must load overview after navigation');
    assert.ok(coreIndex > overviewIndex, fileName + ' must load view owners before tempexecCore');
  });
}

function run() {
  verifyNavigationOwner();
  verifyOverviewOwner();
  verifyOwnershipAndLoadOrder();
  console.log('temp exec view owner tests passed');
}

run();
