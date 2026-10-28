const { test, expect } = require('@playwright/test');
const { installPersistentModelTaskRoute } = require('./helpers/persistent_model_task_mock');

const REQUIREMENT_LINES = [
  '1. 用户登录成功后进入首页',
  '2. 用户退出登录后清除会话并回到登录页',
  '3. 用户可以重置已遗忘的登录密码',
  '4. 背景上下文：登录模块服务于所有注册用户',
].concat(Array.from({ length: 24 }, (_, index) => (
  String(index + 5) + '. 背景上下文补充说明 ' + String(index + 1) + '，用于验证需求原文长内容的独立滚动和操作区可见性'
)));
const REQUIREMENT_TEXT = REQUIREMENT_LINES.join('\n');

function makeCase(moduleName, title) {
  return {
    module: moduleName,
    title: title,
    priority: 'P1',
    preconditions: '注册账号已存在',
    steps: ['1、进入登录页', '2、执行对应操作'],
    expected: '展示对应结果',
  };
}

const ORIGINAL_CASE = makeCase('登录模块', '原有登录成功校验');
const APPENDED_CASE = makeCase('登录模块', '新增退出登录会话清理校验');
const NEW_MODULE_CASE = makeCase('密码模块', '新增忘记密码校验');

function coverageResponse(options) {
  const input = options || {};
  return JSON.stringify({
    segments: REQUIREMENT_LINES.map((line, index) => ({
      segmentId: 'REQ-' + String(index + 1).padStart(3, '0'),
      status: ['covered', 'partial', 'uncovered', 'context'][Math.min(index, 3)],
      caseIds: index === 0 ? (input.caseIds || ['TC-001']) : [],
      relatedCaseIds: index === 1 ? (input.relatedCaseIds || ['TC-001']) : [],
      reason: index > 2 ? '背景上下文' : '本地覆盖结果',
    })),
    unmapped_case_ids: [],
  });
}

function supplementResponse() {
  return JSON.stringify({
    modules: [{
      module: '登录模块',
      key_scenarios: ['登录与退出'],
      test_points: ['退出后清理会话'],
      coupled_modules: [],
      cases: [APPENDED_CASE],
    }, {
      module: '密码模块',
      key_scenarios: ['重置密码'],
      test_points: ['忘记密码'],
      coupled_modules: [],
      cases: [NEW_MODULE_CASE],
    }],
  });
}

async function installLocalApis(page, options) {
  const input = options || {};
  const token = 'coverage-supplement-local-token';
  const user = { id: 892, username: 'coverage-supplement-local', role: 'user', level: 'member' };
  await page.addInitScript((authToken) => {
    try { localStorage.setItem('tap-auth-token', authToken); } catch (_) {}
    try {
      if (!sessionStorage.getItem('__coverage-supplement-initialized')) {
        localStorage.removeItem('usecase-workflow-state-v1');
        sessionStorage.removeItem('usecase-active-tab');
        sessionStorage.setItem('__coverage-supplement-initialized', '1');
      }
    } catch (_) {}
  }, token);
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return route.continue();
    return route.abort();
  });
  await page.route('**/api/**', (route) => {
    const pathName = new URL(route.request().url()).pathname;
    let body = [];
    if (pathName === '/api/users/me') body = user;
    if (pathName === '/api/models') {
      body = [{
        id: 901,
        name: 'Local coverage supplement model',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: 'https://model.invalid/v1/chat/completions',
          apiKey: 'local-mock-key',
          model: 'local-coverage-model',
          maxTokens: 2048,
        },
      }];
    }
    if (pathName === '/api/features') {
      body = [{
        id: 5001,
        name: 'default',
        owner_id: user.id,
        scope: 'user',
        config_json: {
          xmindCaseGenId: '901',
          xmindCaseGenModelId: 'local-coverage-model',
          xmindCaseGenPrompt: '根据需求生成用例',
          xmindCaseGenTemperature: 0.2,
        },
      }];
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const requestBodies = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname !== '/api/model-tasks' || request.method() !== 'POST') return;
    requestBodies.push(request.postDataJSON());
  });
  const tasks = await installPersistentModelTaskRoute(page, {
    completeAfterMs: 700,
    responseTexts: input.responseTexts || [coverageResponse(), supplementResponse(), coverageResponse(), supplementResponse()],
  });
  return { tasks, requestBodies };
}

async function openDrawer(page) {
  if (!await page.locator('#xmindCaseGenDrawer').evaluate((drawer) => drawer.classList.contains('open'))) {
    await page.locator('#xmindCaseGenOpenBtn').click();
  }
  await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
  await expect(page.locator('#xmindCaseGenWorkspaceAddBtn')).toBeVisible();
}

async function seedGeneratedWorkspace(page, options) {
  const input = options || {};
  await page.locator('#xmindCaseGenWorkspaceAddBtn').click();
  await expect(page.locator('#xmindCaseGenWorkspaceList [data-xmind-workspace-tab]')).toHaveCount(1);
  await page.locator('#xmindCaseGenSummaryCloseBtn').click();
  await page.evaluate(({ requirementText, aiCases, baselineCases }) => {
    var app = window.app;
    var state = app.state;
    var host = state.xmindCaseGen;
    var record = host.workspaces[host.activeWorkspaceId];
    var modules = [{ id: 'coverage-login-module', title: '登录模块', scenarios: ['登录'], points: ['登录成功'], coupled: [] }];
    var results = { 'coverage-login-module': JSON.stringify(aiCases) };
    var prep = {
      step: 3,
      requirementMode: 'document',
      requirementSupplement: '',
      caseImportMode: baselineCases.length ? 'import' : 'skip',
      completed: true,
    };
    record.name = '需求覆盖补充回归';
    Object.assign(record.snapshot.shared, {
      requirementLabel: record.name,
      requirementLabelSource: 'ui-test',
      lastRawImportName: 'coverage-local.docx',
      rawText: requirementText,
      caseGenModules: modules,
      caseGenResults: results,
      caseSelections: {},
      caseGenSuggestions: {},
      caseGenModuleStatus: {},
      caseGenProgress: {},
      caseGenTiming: {},
      importedCases: baselineCases.length ? [{
        name: 'coverage-baseline.json',
        text: JSON.stringify(baselineCases),
        list: baselineCases,
      }] : [],
    });
    record.snapshot.xmind.prep = prep;
    Object.assign(state, record.snapshot.shared);
    host.prep = prep;
    document.getElementById('rawText').value = requirementText;
    app.xmindCasegenApi.hydrateActiveWorkspaceSnapshot();
    app.xmindCasegenApi.render({ reason: 'coverage-supplement-test-seed', persist: false });
    app.persistWorkflowStateNow();
  }, {
    requirementText: REQUIREMENT_TEXT,
    aiCases: input.aiCases || [ORIGINAL_CASE],
    baselineCases: input.baselineCases || [],
  });
}

async function setupCoverage(page, options) {
  const controls = await installLocalApis(page, options);
  await page.goto('/ai-workflow.html?tab=casesgen');
  await page.waitForFunction(() => window.app && window.app._inited === true && window.app.xmindCasegenApi);
  await page.waitForFunction(() => String(window.app.state.assignments.xmindCaseGenId) === '901');
  await openDrawer(page);
  await seedGeneratedWorkspace(page, options);
  await page.locator('#xmindCaseGenCoverageBtn').evaluate((button) => button.click());
  await expect(page.locator('.xmind-casegen-coverage-segment.is-covered')).toHaveCount(1);
  await expect(page.locator('.xmind-casegen-coverage-segment.is-partial')).toHaveCount(1);
  await expect(page.locator('.xmind-casegen-coverage-segment.is-uncovered')).toHaveCount(1);
  await expect(page.locator('.xmind-casegen-coverage-actions')).toBeVisible();
  return controls;
}

function action(page, name) {
  return page.locator('[data-coverage-action="' + name + '"]');
}

function segment(page, index) {
  return page.locator('[data-coverage-segment="REQ-' + String(index).padStart(3, '0') + '"]');
}

async function toggleSegment(page, index) {
  await segment(page, index).click();
  await action(page, 'toggle-pending').click();
}

async function readVisibleCases(page) {
  return page.evaluate(() => {
    var state = window.app.state;
    return state.caseGenModules.map(function(moduleItem) {
      var cases = [];
      try { cases = JSON.parse(state.caseGenResults[moduleItem.id] || '[]'); } catch (_) {}
      return { module: moduleItem.title, titles: cases.map(function(caseItem) { return caseItem.title; }) };
    });
  });
}

async function deleteCoverageCase(page, caseId) {
  await page.locator('[data-coverage-case-delete="' + caseId + '"]').click();
  const confirmation = page.locator('dialog.xmind-casegen-coverage-confirm-dialog');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('确认删除用例');
  return confirmation;
}

async function readCoverageReferences(page) {
  return page.evaluate(() => {
    var coverage = window.app.state.xmindCaseGen.coverage;
    var result = coverage && coverage.result ? coverage.result : {};
    return {
      caseIds: (result.cases || []).map(function(item) { return item.id; }),
      segmentCaseIds: (result.segments || []).reduce(function(ids, item) {
        return ids.concat(item.caseIds || [], item.directCaseIds || [], item.relatedCaseIds || []);
      }, []),
    };
  });
}

async function readCoverageBackground(page) {
  return page.evaluate(() => {
    var map = document.querySelector('#xmindCaseGenMindContainer .map-canvas');
    return {
      scrollY: window.scrollY,
      mapTransform: map ? window.getComputedStyle(map).transform : null,
    };
  });
}

async function expectCoverageScrollAtEnd(scroller) {
  await expect.poll(() => scroller.evaluate((element) => (
    Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop)
  ))).toBeLessThanOrEqual(1);
}

function requestText(body) {
  const payload = body && body.payload ? body.payload : {};
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  return messages.map((message) => {
    if (typeof message.content === 'string') return message.content;
    return (Array.isArray(message.content) ? message.content : []).map((part) => part.text || '').join('\n');
  }).join('\n');
}

test.describe('需求覆盖补充用例', () => {
  test('所有覆盖状态均可手动标记，撤销批量只清除批量来源并在刷新后保留', async ({ page }) => {
    const controls = await setupCoverage(page);
    await expect(action(page, 'supplement')).toBeDisabled();
    await toggleSegment(page, 1);
    await expect(segment(page, 1)).toHaveClass(/is-pending/);
    await toggleSegment(page, 1);
    await expect(segment(page, 1)).not.toHaveClass(/is-pending/);
    await toggleSegment(page, 3);
    await expect(segment(page, 3)).toHaveClass(/is-pending/);
    await toggleSegment(page, 3);
    await expect(segment(page, 3)).not.toHaveClass(/is-pending/);
    await toggleSegment(page, 2);
    await toggleSegment(page, 4);
    await action(page, 'mark-gaps').click();
    await expect(segment(page, 2)).toHaveClass(/is-pending/);
    await expect(segment(page, 3)).toHaveClass(/is-pending/);
    await expect(segment(page, 4)).toHaveClass(/is-pending/);
    const counts = page.locator('.xmind-casegen-coverage-pending-counts');
    await expect(counts).toContainText(/未覆盖\s*1/);
    await expect(counts).toContainText(/部分覆盖\s*1/);
    await expect(counts).toContainText(/上下文\s*1/);
    await action(page, 'clear-batch').click();
    await expect(segment(page, 2)).toHaveClass(/is-pending/);
    await expect(segment(page, 3)).not.toHaveClass(/is-pending/);
    await expect(segment(page, 4)).toHaveClass(/is-pending/);
    await expect(action(page, 'supplement')).toBeEnabled();
    await page.locator('#xmindCaseGenSummaryCloseBtn').click();
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.xmindCasegenApi);
    await openDrawer(page);
    await page.locator('#xmindCaseGenCoverageBtn').evaluate((button) => button.click());
    await expect(segment(page, 2)).toHaveClass(/is-pending/);
    await expect(segment(page, 3)).not.toHaveClass(/is-pending/);
    await expect(segment(page, 4)).toHaveClass(/is-pending/);
    expect(controls.tasks.getCreateCalls()).toHaveLength(1);
  });

  test('二次确认默认自动分析，取消不发出补充请求且操作区完整位于视口内', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const controls = await setupCoverage(page);
    await action(page, 'mark-gaps').click();
    const layout = await page.evaluate(() => {
      var dialog = document.getElementById('xmindCaseGenSummaryDialog');
      var body = document.getElementById('xmindCaseGenSummaryDialogBody');
      var overlay = document.getElementById('xmindCaseGenSummaryOverlay');
      var actions = document.querySelector('.xmind-casegen-coverage-actions');
      var documentPanel = document.querySelector('.xmind-casegen-coverage-segment-list');
      var rect = actions.getBoundingClientRect();
      return {
        actionsTop: rect.top,
        actionsBottom: rect.bottom,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        dialogWidth: dialog.getBoundingClientRect().width,
        dialogTop: dialog.getBoundingClientRect().top,
        dialogBottom: dialog.getBoundingClientRect().bottom,
        bodyOverflow: body.scrollHeight - body.clientHeight,
        overlayOverflow: overlay.scrollHeight - overlay.clientHeight,
        documentOverflow: documentPanel.scrollHeight - documentPanel.clientHeight,
      };
    });
    expect(layout.actionsTop).toBeGreaterThanOrEqual(0);
    expect(layout.actionsBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.dialogTop).toBeGreaterThanOrEqual(0);
    expect(layout.dialogBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.dialogWidth).toBeGreaterThanOrEqual(layout.viewportWidth - 40);
    expect(layout.bodyOverflow).toBeLessThanOrEqual(2);
    expect(layout.overlayOverflow).toBeLessThanOrEqual(2);
    expect(layout.documentOverflow).toBeGreaterThan(0);
    await page.screenshot({ path: 'output/playwright/xmind-coverage-supplement-desktop.png' });
    await action(page, 'supplement').click();
    const confirmation = page.locator('dialog.xmind-casegen-coverage-confirm-dialog');
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator('[data-coverage-auto-analyze]')).toBeChecked();
    await page.screenshot({ path: 'output/playwright/xmind-coverage-supplement-confirm.png' });
    await confirmation.locator('[data-coverage-cancel]').click();
    await expect(confirmation).not.toBeVisible();
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    expect(controls.tasks.getCreateCalls()).toHaveLength(1);
    expect(controls.tasks.getProxyCallCount()).toBe(0);
  });

  test('追加已有及新模块，关闭覆盖界面后仍用干净原文和新增用例自动分析', async ({ page }) => {
    const controls = await setupCoverage(page);
    await action(page, 'mark-gaps').click();
    await toggleSegment(page, 4);
    await action(page, 'supplement').click();
    const confirmation = page.locator('dialog.xmind-casegen-coverage-confirm-dialog');
    await confirmation.locator('[data-coverage-confirm]').click();
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('#xmindCaseGenSummaryDialogBody')).toContainText('正在补充');
    await expect(action(page, 'toggle-pending')).toBeDisabled();
    await expect(action(page, 'mark-gaps')).toBeDisabled();
    await expect(action(page, 'supplement')).toBeDisabled();
    await expect.poll(() => controls.tasks.getCreateCalls().length).toBe(2);
    await page.locator('#xmindCaseGenSummaryCloseBtn').click();
    await expect.poll(() => controls.tasks.getCreateCalls().length, { timeout: 20000 }).toBe(3);
    await expect.poll(() => readVisibleCases(page)).toEqual([
      { module: '登录模块', titles: [ORIGINAL_CASE.title, APPENDED_CASE.title] },
      { module: '密码模块', titles: [NEW_MODULE_CASE.title] },
    ]);
    await expect.poll(() => page.locator('#xmindCaseGenCoverageBtn').textContent()).not.toContain('分析中');
    expect(controls.tasks.getCancelCalls()).toHaveLength(0);
    expect(controls.tasks.getProxyCallCount()).toBe(0);
    const supplementText = requestText(controls.requestBodies[1]);
    expect(supplementText).toContain('coverageSupplement');
    expect(supplementText).toContain(ORIGINAL_CASE.title);
    expect(supplementText).toContain('待补充');
    expect(supplementText).toContain(REQUIREMENT_LINES[1]);
    expect(supplementText).toContain(REQUIREMENT_LINES[2]);
    expect(supplementText).toContain(REQUIREMENT_LINES[3]);
    expect(supplementText).toContain('【部分覆盖待补充 REQ-002】');
    expect(supplementText).toContain('【未覆盖待补充 REQ-003】');
    expect(supplementText).toContain('【上下文待补充 REQ-004】');
    const analysisText = requestText(controls.requestBodies[2]);
    expect(analysisText).toContain('xmind_requirement_coverage');
    expect(analysisText).toContain(REQUIREMENT_TEXT);
    expect(analysisText).toContain(ORIGINAL_CASE.title);
    expect(analysisText).toContain(APPENDED_CASE.title);
    expect(analysisText).toContain(NEW_MODULE_CASE.title);
    expect(analysisText).not.toContain('【待补充');
    expect(await page.locator('#rawText').inputValue()).toBe(REQUIREMENT_TEXT);
    await page.locator('#xmindCaseGenCoverageBtn').evaluate((button) => button.click());
    await expect(segment(page, 2)).toHaveClass(/is-supplemented/);
    await expect(segment(page, 3)).toHaveClass(/is-supplemented/);
    await expect(segment(page, 4)).toHaveClass(/is-supplemented/);
    await expect(segment(page, 4)).toContainText('后补充');
    await expect(page.locator('[data-coverage-jump="supplemented"]').first()).toBeVisible();
    await toggleSegment(page, 1);
    await action(page, 'supplement').click();
    await confirmation.locator('[data-coverage-auto-analyze]').uncheck();
    await confirmation.locator('[data-coverage-confirm]').click();
    await expect(segment(page, 1)).toHaveClass(/is-supplemented/, { timeout: 20000 });
    await expect(segment(page, 2)).toHaveClass(/is-supplemented/);
    await expect(segment(page, 3)).toHaveClass(/is-supplemented/);
    await expect(segment(page, 4)).toHaveClass(/is-supplemented/);
    await expect(page.locator('.xmind-casegen-coverage-segment.is-pending')).toHaveCount(0);
    expect(controls.tasks.getCreateCalls()).toHaveLength(4);
    await page.locator('#xmindCaseGenSummaryCloseBtn').click();
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.xmindCasegenApi);
    await openDrawer(page);
    await page.locator('#xmindCaseGenCoverageBtn').evaluate((button) => button.click());
    for (const index of [1, 2, 3, 4]) {
      await expect(segment(page, index)).toHaveClass(/is-supplemented/);
    }
    expect(controls.tasks.getCreateCalls()).toHaveLength(4);
  });

  test('取消自动分析后仅执行补充，原用例保留且可继续手动分析', async ({ page }) => {
    const controls = await setupCoverage(page);
    await toggleSegment(page, 3);
    await action(page, 'supplement').click();
    const confirmation = page.locator('dialog.xmind-casegen-coverage-confirm-dialog');
    await confirmation.locator('[data-coverage-auto-analyze]').uncheck();
    await confirmation.locator('[data-coverage-confirm]').click();
    await expect.poll(() => readVisibleCases(page)).toEqual([
      { module: '登录模块', titles: [ORIGINAL_CASE.title, APPENDED_CASE.title] },
      { module: '密码模块', titles: [NEW_MODULE_CASE.title] },
    ]);
    await expect(action(page, 'reanalyze')).toBeEnabled();
    expect(controls.tasks.getCreateCalls()).toHaveLength(2);
    expect(await page.locator('#rawText').inputValue()).toBe(REQUIREMENT_TEXT);
    await action(page, 'reanalyze').click();
    await expect.poll(() => controls.tasks.getCreateCalls().length).toBe(3);
  });

  test('模型返回无效内容时保留待补充标记，不记录后补充或自动重分析', async ({ page }) => {
    const controls = await setupCoverage(page, {
      responseTexts: [coverageResponse(), '这不是有效的用例 JSON'],
    });
    await action(page, 'mark-gaps').click();
    await action(page, 'supplement').click();
    const confirmation = page.locator('dialog.xmind-casegen-coverage-confirm-dialog');
    await expect(confirmation.locator('[data-coverage-auto-analyze]')).toBeChecked();
    await confirmation.locator('[data-coverage-confirm]').click();
    await expect(page.locator('.xmind-casegen-coverage-action-status.is-error')).toBeVisible();
    await expect(segment(page, 2)).toHaveClass(/is-pending/);
    await expect(segment(page, 3)).toHaveClass(/is-pending/);
    await expect(page.locator('.xmind-casegen-coverage-segment.is-supplemented')).toHaveCount(0);
    await expect(action(page, 'supplement')).toBeEnabled();
    expect(await readVisibleCases(page)).toEqual([{ module: '登录模块', titles: [ORIGINAL_CASE.title] }]);
    expect(controls.tasks.getCreateCalls()).toHaveLength(2);
    expect(controls.tasks.getProxyCallCount()).toBe(0);
  });
});

test.describe('需求覆盖对应用例删除', () => {
  test('取消不删除，确认同步清理所有片段引用且刷新后保留', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const remainingCase = makeCase('登录模块', '保留的登录失败校验');
    const controls = await setupCoverage(page, {
      aiCases: [ORIGINAL_CASE, remainingCase],
      responseTexts: [coverageResponse({ caseIds: ['TC-001', 'TC-002'] })],
    });
    await toggleSegment(page, 3);
    await segment(page, 1).click();
    let confirmation = await deleteCoverageCase(page, 'TC-001');
    await expect(confirmation).toContainText(ORIGINAL_CASE.title);
    await page.screenshot({ path: 'output/playwright/xmind-coverage-delete-confirm.png' });
    await confirmation.getByRole('button', { name: '取消', exact: true }).click();
    await expect(confirmation).not.toBeVisible();
    await expect(page.locator('[data-coverage-case-delete="TC-001"]')).toBeVisible();
    await page.screenshot({ path: 'output/playwright/xmind-coverage-delete-desktop.png' });
    expect(await readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [ORIGINAL_CASE.title, remainingCase.title],
    }]);
    confirmation = await deleteCoverageCase(page, 'TC-001');
    await confirmation.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(confirmation).not.toBeVisible();
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect.poll(() => readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [remainingCase.title],
    }]);
    await expect(page.locator('[data-coverage-case-delete="TC-001"]')).toHaveCount(0);
    await expect(segment(page, 3)).toHaveClass(/is-pending/);
    await segment(page, 2).click();
    await expect(page.locator('.xmind-casegen-coverage-case-title')).toHaveCount(0);
    const references = await readCoverageReferences(page);
    expect(references.caseIds).not.toContain('TC-001');
    expect(references.segmentCaseIds).not.toContain('TC-001');
    await page.locator('#xmindCaseGenSummaryCloseBtn').click();
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.xmindCasegenApi);
    await openDrawer(page);
    expect(await readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [remainingCase.title],
    }]);
    await page.locator('#xmindCaseGenCoverageBtn').evaluate((button) => button.click());
    await expect(segment(page, 3)).toHaveClass(/is-pending/);
    await segment(page, 2).click();
    await expect(page.locator('.xmind-casegen-coverage-case-title')).toHaveCount(0);
    expect(controls.tasks.getCreateCalls()).toHaveLength(1);
    expect(controls.tasks.getProxyCallCount()).toBe(0);
  });

  test('连续删除不会因用例位置变化误删后面的用例', async ({ page }) => {
    const middleCase = makeCase('登录模块', '应保留的中间用例');
    const finalCase = makeCase('登录模块', '需要删除的末尾用例');
    await setupCoverage(page, {
      aiCases: [ORIGINAL_CASE, middleCase, finalCase],
      responseTexts: [coverageResponse({
        caseIds: ['TC-001', 'TC-002', 'TC-003'],
        relatedCaseIds: ['TC-002', 'TC-003'],
      })],
    });
    await segment(page, 1).click();
    let confirmation = await deleteCoverageCase(page, 'TC-001');
    await confirmation.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.locator('[data-coverage-case]')).toHaveCount(2);
    const finalCaseId = await page.locator('[data-coverage-case]').filter({ hasText: finalCase.title }).getAttribute('data-coverage-case');
    confirmation = await deleteCoverageCase(page, finalCaseId);
    await expect(confirmation).toContainText(finalCase.title);
    await confirmation.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect.poll(() => readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [middleCase.title],
    }]);
    await expect(page.locator('.xmind-casegen-coverage-case-title')).toHaveText([middleCase.title]);
    await segment(page, 2).click();
    await expect(page.locator('.xmind-casegen-coverage-case-title')).toHaveText([middleCase.title]);
    await page.locator('#xmindCaseGenSummaryCloseBtn').click();
    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeEnabled();
    await page.locator('#xmindCaseGenDeleteUndoBtn').click();
    await expect.poll(() => readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [middleCase.title, finalCase.title],
    }]);
    await page.locator('#xmindCaseGenDeleteUndoBtn').click();
    await expect.poll(() => readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [ORIGINAL_CASE.title, middleCase.title, finalCase.title],
    }]);
  });

  test('同名基线和 AI 用例删除时按来源定位，并支持撤回基线删除', async ({ page }) => {
    const baselineCase = Object.assign({}, ORIGINAL_CASE, { expected: '导入基线中的登录结果' });
    await setupCoverage(page, {
      aiCases: [ORIGINAL_CASE],
      baselineCases: [baselineCase],
      responseTexts: [coverageResponse({ caseIds: ['TC-001', 'TC-002'] })],
    });
    await segment(page, 1).click();
    const confirmation = await deleteCoverageCase(page, 'TC-001');
    await confirmation.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.locator('[data-coverage-case]')).toHaveCount(1);
    await expect(page.locator('.xmind-casegen-coverage-case-title')).toHaveText([ORIGINAL_CASE.title]);
    expect(await readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [ORIGINAL_CASE.title],
    }]);
    const deletedState = await page.evaluate(() => ({
      imports: window.app.state.importedCases,
      baselineDeletes: window.app.state.xmindCaseGen.deletedBaselineCaseKeys,
    }));
    expect(deletedState.imports[0].list).toEqual([baselineCase]);
    expect(deletedState.baselineDeletes).toHaveLength(1);
    await segment(page, 2).click();
    await expect(page.locator('.xmind-casegen-coverage-case-title')).toHaveCount(0);
    await page.locator('#xmindCaseGenSummaryCloseBtn').click();
    await expect(page.locator('#xmindCaseGenDeleteUndoBtn')).toBeEnabled();
    await page.locator('#xmindCaseGenDeleteUndoBtn').click();
    await expect.poll(() => page.evaluate(() => window.app.state.xmindCaseGen.deletedBaselineCaseKeys.length)).toBe(0);
    expect(await readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [ORIGINAL_CASE.title],
    }]);
  });

  test('旧覆盖结果缺少删除定位信息时仍按完整内容删除同名指定用例', async ({ page }) => {
    const sameTitleCase = Object.assign({}, ORIGINAL_CASE, {
      steps: ['1、进入登录页', '2、输入错误密码并提交'],
      expected: '提示密码错误并保留登录页',
    });
    await setupCoverage(page, {
      aiCases: [ORIGINAL_CASE, sameTitleCase],
      responseTexts: [coverageResponse({ caseIds: ['TC-001', 'TC-002'] })],
    });
    await page.evaluate(() => {
      window.app.state.xmindCaseGen.coverage.result.cases.forEach(function(item) {
        delete item.deleteMeta;
      });
    });
    await segment(page, 2).click();
    await segment(page, 1).click();
    await expect(page.locator('[data-coverage-case-delete="TC-002"]')).toBeEnabled();
    const confirmation = await deleteCoverageCase(page, 'TC-002');
    await confirmation.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.locator('[data-coverage-case]')).toHaveCount(1);
    const remainingCases = await page.evaluate(() => JSON.parse(window.app.state.caseGenResults['coverage-login-module']));
    expect(remainingCases).toHaveLength(1);
    expect(remainingCases[0]).toMatchObject(ORIGINAL_CASE);
    await expect(page.locator('[data-coverage-case-delete="TC-001"]')).toBeEnabled();
  });

  test('确认框打开期间用例内容变化时拒绝执行过期删除', async ({ page }) => {
    const remainingCase = makeCase('登录模块', '原有的其他登录校验');
    const changedCase = makeCase('登录模块', '确认期间新增的登录校验');
    await setupCoverage(page, {
      aiCases: [ORIGINAL_CASE, remainingCase],
      responseTexts: [coverageResponse({ caseIds: ['TC-001', 'TC-002'] })],
    });
    await segment(page, 1).click();
    const confirmation = await deleteCoverageCase(page, 'TC-001');
    await page.evaluate((newCase) => {
      var state = window.app.state;
      var cases = JSON.parse(state.caseGenResults['coverage-login-module']);
      state.caseGenResults['coverage-login-module'] = JSON.stringify(cases.concat([newCase]));
    }, changedCase);
    await confirmation.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(confirmation).not.toBeVisible();
    await expect(page.locator('#xmindCaseGenStatus')).toContainText('当前页签或用例已变化');
    expect(await readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [ORIGINAL_CASE.title, remainingCase.title, changedCase.title],
    }]);
    await expect(page.locator('#xmindCaseGenSummaryOverlay')).toHaveClass(/is-open/);
    await expect(page.locator('[data-coverage-case="TC-001"]')).toBeVisible();
  });

  test('旧覆盖结果中相同基线已移除时不可误删剩余 AI 用例', async ({ page }) => {
    await setupCoverage(page, {
      aiCases: [ORIGINAL_CASE],
      baselineCases: [ORIGINAL_CASE],
      responseTexts: [coverageResponse({ caseIds: ['TC-001', 'TC-002'] })],
    });
    await page.evaluate(() => {
      window.app.state.xmindCaseGen.coverage.result.cases.forEach(function(item) {
        delete item.deleteMeta;
      });
      window.app.state.importedCases = [];
    });
    await segment(page, 2).click();
    await segment(page, 1).click();
    await expect(page.locator('[data-coverage-case]')).toHaveCount(2);
    await expect(page.locator('[data-coverage-case-delete="TC-001"]')).toBeDisabled();
    await expect(page.locator('[data-coverage-case-delete="TC-002"]')).toBeDisabled();
    expect(await readVisibleCases(page)).toEqual([{
      module: '登录模块', titles: [ORIGINAL_CASE.title],
    }]);
  });
});

test.describe('需求覆盖滚轮交互', () => {
  test('需求原文支持真实滚轮上下滚动，到边界及关闭重开均不影响背景', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupCoverage(page);
    const source = page.locator('.xmind-casegen-coverage-segment-list');
    await expect(page.locator('#xmindCaseGenMindContainer .map-canvas')).toHaveCount(1);
    await expect.poll(() => source.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
    await source.evaluate((element) => { element.scrollTop = 0; });
    const background = await readCoverageBackground(page);
    await source.hover();
    await page.mouse.wheel(0, 240);
    await expect.poll(() => source.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const downPosition = await source.evaluate((element) => element.scrollTop);
    await page.mouse.wheel(0, -120);
    await expect.poll(() => source.evaluate((element) => element.scrollTop)).toBeLessThan(downPosition);
    expect(await readCoverageBackground(page)).toEqual(background);
    await page.mouse.wheel(0, 100000);
    await expectCoverageScrollAtEnd(source);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(150);
    await expectCoverageScrollAtEnd(source);
    expect(await readCoverageBackground(page)).toEqual(background);
    await page.mouse.wheel(0, -100000);
    await expect.poll(() => source.evaluate((element) => element.scrollTop)).toBe(0);
    await page.mouse.wheel(0, -1200);
    await page.waitForTimeout(150);
    expect(await readCoverageBackground(page)).toEqual(background);
    await segment(page, 1).focus();
    await source.evaluate((element) => { element.scrollTop = 0; });
    await page.keyboard.press('PageDown');
    await expect.poll(() => source.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const touchAndBackgroundLock = await source.evaluate((element) => {
      var sourceTouch = new Event('touchmove', { bubbles: true, cancelable: true });
      element.dispatchEvent(sourceTouch);
      var backgroundTouch = new Event('touchmove', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(backgroundTouch);
      var backgroundWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 240 });
      document.body.dispatchEvent(backgroundWheel);
      return {
        sourceTouchPrevented: sourceTouch.defaultPrevented,
        backgroundTouchPrevented: backgroundTouch.defaultPrevented,
        backgroundWheelPrevented: backgroundWheel.defaultPrevented,
      };
    });
    expect(touchAndBackgroundLock).toEqual({
      sourceTouchPrevented: false,
      backgroundTouchPrevented: true,
      backgroundWheelPrevented: true,
    });
    expect(await readCoverageBackground(page)).toEqual(background);
    await page.locator('#xmindCaseGenSummaryCloseBtn').click();
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('body')).toHaveClass(/drawer-open/);
    await page.locator('#xmindCaseGenCoverageBtn').evaluate((button) => button.click());
    await expect(source).toBeVisible();
    await source.evaluate((element) => { element.scrollTop = 0; });
    const reopenedBackground = await readCoverageBackground(page);
    await source.hover();
    await page.mouse.wheel(0, 240);
    await expect.poll(() => source.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await readCoverageBackground(page)).toEqual(reopenedBackground);
  });

  test('对应用例区独立响应真实滚轮，需求原文位置和底部操作区保持固定', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const cases = Array.from({ length: 35 }, (_, index) => (
      makeCase('登录模块', '登录用例独立滚动校验 ' + String(index + 1))
    ));
    await setupCoverage(page, {
      aiCases: cases,
      responseTexts: [coverageResponse({
        caseIds: cases.map((caseItem, index) => 'TC-' + String(index + 1).padStart(3, '0')),
      })],
    });
    await segment(page, 1).click();
    const source = page.locator('.xmind-casegen-coverage-segment-list');
    const caseList = page.locator('.xmind-casegen-coverage-case-list');
    const actions = page.locator('.xmind-casegen-coverage-actions');
    await expect(caseList.locator('[data-coverage-case]')).toHaveCount(cases.length);
    await expect.poll(() => caseList.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
    const sourcePosition = await source.evaluate((element) => element.scrollTop);
    const actionBounds = await actions.boundingBox();
    expect(actionBounds).not.toBeNull();
    expect(actionBounds.y).toBeGreaterThanOrEqual(0);
    expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(800);
    const background = await readCoverageBackground(page);
    await caseList.hover();
    await page.mouse.wheel(0, 360);
    await expect.poll(() => caseList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const downPosition = await caseList.evaluate((element) => element.scrollTop);
    await page.mouse.wheel(0, -120);
    await expect.poll(() => caseList.evaluate((element) => element.scrollTop)).toBeLessThan(downPosition);
    expect(await source.evaluate((element) => element.scrollTop)).toBe(sourcePosition);
    await page.mouse.wheel(0, 100000);
    await expectCoverageScrollAtEnd(caseList);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(150);
    await expectCoverageScrollAtEnd(caseList);
    expect(await source.evaluate((element) => element.scrollTop)).toBe(sourcePosition);
    const scrolledActionBounds = await actions.boundingBox();
    expect(scrolledActionBounds.y).toBeCloseTo(actionBounds.y, 1);
    expect(scrolledActionBounds.height).toBeCloseTo(actionBounds.height, 1);
    await expect(action(page, 'mark-gaps')).toBeInViewport();
    await expect(action(page, 'supplement')).toBeInViewport();
    expect(await readCoverageBackground(page)).toEqual(background);
  });
});
