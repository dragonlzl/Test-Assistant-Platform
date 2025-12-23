const { test, expect } = require('@playwright/test');

async function gotoIndexWithRetry(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/index.html';
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(url);
      return;
    } catch (err) {
      lastErr = err;
      const msg = err && err.message ? String(err.message) : String(err || '');
      const canRetry = msg.indexOf('ERR_EMPTY_RESPONSE') !== -1 || msg.indexOf('net::ERR_EMPTY_RESPONSE') !== -1;
      if (!canRetry || i === 2) throw err;
      await page.waitForTimeout(300);
    }
  }
  throw lastErr || new Error('page.goto failed');
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
  await page.waitForFunction((name) => {
    const nodes = document.querySelectorAll(`[data-tab-section="${name}"]`);
    if (!nodes || !nodes.length) return true;
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      if (el && el.classList && !el.classList.contains('hidden')) return true;
    }
    return false;
  }, tabName);
}

test.describe('文件导入导出与布局视图', () => {
  test.beforeEach(async ({ page }) => {
    page.__promptAnswers = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') {
        return respond(200, { id: 1, username: 'ui_admin', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
    });
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : 'UI自动化需求';
        await dialog.accept(answer);
        return;
      }
      await dialog.accept();
    });
    await gotoIndexWithRetry(page);
    await page.waitForFunction(
      () => window.app && window.app._inited === true && typeof window.app.switchTab === 'function',
      null,
      { timeout: 30000 }
    );
  });

  test('多模块文件导入导出', async ({ page }) => {
    await switchToTab(page, 'clean');
    await page.evaluate(() => {
      window.app.state.requirementLabel = 'UI测试需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    await page.fill('#rawText', '原始测试内容');
    const [rawDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#saveRawDebug', { force: true }),
    ]);
    expect(await rawDownload.suggestedFilename()).toMatch(/debug_RAW_/);
    await page.setInputFiles('#rawDebugFile', {
      name: 'raw_debug.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('#NODE:RAW\n导入后的原始内容'),
    });
    await expect(page.locator('#parseStatus')).toContainText('已从调试 TXT 导入');
    await expect(page.locator('#rawText')).toHaveValue('导入后的原始内容');

    await page.evaluate(() => {
      const el = document.getElementById('cleanedText');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = '清洗完成的内容';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const [cleanDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#saveCleanDebug', { force: true }),
    ]);
    expect(await cleanDownload.suggestedFilename()).toMatch(/debug_CLEANED_/);
    await page.setInputFiles('#cleanDebugFile', {
      name: 'clean_debug.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('#NODE:CLEANED\n导入后的清洗内容'),
    });
    await expect(page.locator('#cleanStatus')).toContainText('导入');
    await expect(page.locator('#cleanedText')).toHaveValue(/导入后的清洗内容/);

    await page.evaluate(() => {
      const el = document.getElementById('reviewResult');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = JSON.stringify([{ issue: '缺少约束' }], null, 2);
    });
    await page.evaluate(() => {
      const drawer = document.getElementById('autoCompareDrawer');
      if (!drawer || !drawer.classList || !drawer.classList.contains('open')) return;
      const mask = drawer.querySelector('.drawer-mask');
      if (mask && typeof mask.click === 'function') mask.click();
    });
    await page.click('#exportReviewResult', { force: true });
    const reviewPayload = JSON.stringify({
      requirement: 'UI测试需求',
      type: 'compare',
      data: [{ issue: '导入澄清' }],
    });
    await page.setInputFiles('#reviewImportFile', {
      name: 'review.json',
      mimeType: 'application/json',
      buffer: Buffer.from(reviewPayload),
    });
    await expect(page.locator('#reviewStatus')).toContainText('导入');
    await expect(page.locator('#reviewResult')).toHaveValue(/导入澄清/);

    await page.evaluate(() => {
      const el = document.getElementById('compareResult');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = JSON.stringify({ coverage: 75, missing: ['登录'] }, null, 2);
    });
    await page.click('#exportCompareResult', { force: true });
    const comparePayload = JSON.stringify({
      requirement: 'UI测试需求',
      type: 'compare',
      data: { coverage: 66, missing: ['导入缺失'] },
    });
    await page.setInputFiles('#compareImportFile', {
      name: 'compare.json',
      mimeType: 'application/json',
      buffer: Buffer.from(comparePayload),
    });
    await expect(page.locator('#compareStatus')).toContainText('导入');
    await expect(page.locator('#compareResult')).toHaveValue(/66/);
    await expect(page.locator('#compareResult')).toHaveValue(/导入缺失/);

    await page.evaluate(() => {
      const splitResult = document.getElementById('splitResult');
      if (splitResult) {
        splitResult.removeAttribute('readonly');
        splitResult.value = JSON.stringify([
          { module: '模块A', key_scenarios: ['登录'], test_points: ['验证登录'], coupled_modules: ['模块B'] },
        ], null, 2);
        splitResult.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    // 兜底：少数情况下会残留 Auto 对比抽屉遮挡点击，先关掉再继续。
    await page.evaluate(() => {
      const drawer = document.getElementById('autoCompareDrawer');
      if (!drawer || !drawer.classList || !drawer.classList.contains('open')) return;
      const mask = drawer.querySelector('.drawer-mask');
      if (mask && typeof mask.click === 'function') mask.click();
    });
    await page.click('#saveSplitDebug');
    await expect(page.locator('#splitStatus')).toContainText('已保存');
    await page.setInputFiles('#splitDebugFile', {
      name: 'split_debug.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('#NODE:SPLIT\n导入拆分结果'),
    });
    await expect(page.locator('#splitStatus')).toContainText('导入');
    await expect(page.locator('#splitResult')).toHaveValue(/导入拆分结果/);

    await page.evaluate(() => {
      const caseText = document.getElementById('caseText');
      if (caseText) {
        caseText.value = JSON.stringify([
          { module: '模块A', title: '登录成功', priority: 'P1', steps: ['step'], expected: 'ok' },
        ], null, 2);
        caseText.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.evaluate(() => {
      const drawer = document.getElementById('autoCompareDrawer');
      if (drawer && drawer.classList && drawer.classList.contains('open')) {
        const mask = drawer.querySelector('.drawer-mask');
        if (mask && typeof mask.click === 'function') mask.click();
      }
    });
    await page.evaluate(() => {
      const btn = document.getElementById('saveCaseDebug');
      if (btn && typeof btn.click === 'function') btn.click();
    });
    await expect(page.locator('#caseStatus')).toContainText('已保存');
    await page.setInputFiles('#caseDebugFile', {
      name: 'cases_debug.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('#NODE:CASES\n导入用例内容'),
    });
    await expect(page.locator('#caseStatus')).toContainText('导入');
    await expect(page.locator('#caseText')).toHaveValue(/导入用例内容/);

    await page.evaluate(() => {
      const casesResult = document.getElementById('casesCompareResult');
      if (casesResult) {
        casesResult.removeAttribute('readonly');
        casesResult.value = JSON.stringify({ coverage: 52, missing: [], extra: [] }, null, 2);
        casesResult.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const [casesExport] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportCasesCoverage', { force: true }),
    ]);
    expect(await casesExport.suggestedFilename()).toMatch(/cases_compare_.*\.txt$/);
    const coveragePayload = JSON.stringify({
      requirement: 'UI测试需求',
      type: 'cases_compare',
      data: {
        coverage: 88,
        missing: [{ module: '模块B', key_scenarios: ['补充场景'], test_points: ['补充点'], coupled_modules: [] }],
        extra: [],
      },
    }, null, 2);
    await page.setInputFiles('#importCasesCoverageFile', {
      name: 'cases_compare.json',
      mimeType: 'application/json',
      buffer: Buffer.from(coveragePayload),
    });
    await expect(page.locator('#casesCoverageStatus')).toContainText('已导入');
    await expect(page.locator('#casesCompareResult')).toHaveValue(/88/);
  });

  test('多标签布局与视图渲染正常', async ({ page }) => {
    const tabNames = await page.$$eval('[data-tab-btn]', (nodes) => nodes.map((el) => el.dataset.tabBtn));
    for (const name of tabNames) {
      const sectionCount = await page.locator(`[data-tab-section="${name}"]`).count();
      if (!sectionCount) continue;
      await switchToTab(page, name);
      if (name === 'tempexec') {
        await expect(page.locator('#tempexecFlowNav')).toBeVisible();
      } else {
        const sections = page.locator(`[data-tab-section="${name}"]`);
        if (await sections.count()) {
          await expect(sections.first()).toBeVisible();
        }
      }
    }

    await switchToTab(page, 'clean');
    await page.click('#toggleCleanViewBtn', { force: true });
    await expect(page.locator('#cleanViewDrawer')).toHaveClass(/open/);
    await expect(page.locator('#cleanViewContainer')).toBeVisible();
    await expect(page.locator('#cleanRawView')).toBeVisible();
    await page.click('#cleanViewDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    await expect(page.locator('#cleanViewDrawer')).not.toHaveClass(/open/);

    await switchToTab(page, 'casesgen');
    await expect(page.locator('[data-section-id="casesgen"]')).toBeVisible();

    await switchToTab(page, 'tempexec');
    await page.click('#openTempExecImportDrawerBtn');
    await expect(page.locator('#tempExecDropZone')).toBeVisible();
    await page.click('#tempExecImportDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/open/);

    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempVersionGrid')).toBeVisible();
    await page.click('#tempExecAssignDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);

    await switchToTab(page, 'auto');
    await expect(page.locator('#runAutoWorkflow')).toBeVisible();

    await switchToTab(page, 'clean');
    const layoutOk = await page.evaluate(() => {
      const layout = document.querySelector('[data-section-id="clean"] .layout');
      if (!layout) return false;
      const panes = layout.querySelectorAll('.pane');
      return panes.length >= 2;
    });
    expect(layoutOk).toBeTruthy();
  });

  test('视图展开与用例视图切换', async ({ page }) => {
    await switchToTab(page, 'clean');
    await page.waitForFunction(() => window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function');
    await page.click('#toggleCleanViewBtn', { force: true });
    await expect(page.locator('#cleanViewDrawer')).toHaveClass(/open/);
    await expect(page.locator('#cleanViewContainer')).toBeVisible();
    await page.click('#cleanViewDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    await expect(page.locator('#cleanViewDrawer')).not.toHaveClass(/open/);

    await page.evaluate(() => {
      const caseText = document.getElementById('caseText');
      if (!caseText) return;
      caseText.value = JSON.stringify([{ module: '模块A', title: '用例一', priority: 'P1', steps: ['step'], expected: 'ok' }], null, 2);
      caseText.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const caseViewBtn = page.locator('#caseViewBtn');
    await expect(caseViewBtn).toBeVisible();
    await caseViewBtn.click();
    await expect(page.locator('#caseViewDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseViewContainer')).toBeVisible();
    await page.click('#caseViewDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    await expect(page.locator('#caseViewDrawer')).not.toHaveClass(/open/);

    // 拆分视图入口依赖拆分解析结果，布局/交互测试仅校验清洗/用例视图抽屉即可。
  });

  test('功能工作流卡片布局完整', async ({ page }) => {
    await switchToTab(page, 'clean');
    const expectedTitles = [
      '导入需求文档',
      '需求评审',
      '需求澄清点视图',
      '需求清洗',
      '清洗结果视图',
      '对比完整性',
      '测试模块拆分',
      '拆分视图',
      '测试用例导入（XMind）',
      '测试用例视图',
      '测试用例覆盖对比',
      '缺失模块视图',
    ];
    const titles = await page.$$eval('section[data-tab-section="clean"] > h2', (nodes) => nodes.map((node) => node.textContent.trim()));
    for (const title of expectedTitles) {
      expect(titles).toContain(title);
    }
  });

  test('流程进度与按钮状态', async ({ page }) => {
    await switchToTab(page, 'clean');
    await page.fill('#rawText', '进度输入内容');
    await page.evaluate(() => {
      const el = document.getElementById('cleanedText');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = '清洗后的进度内容';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => {
      if (window.app && window.app.api && typeof window.app.api.updateFlowStatus === 'function') {
        window.app.api.updateFlowStatus();
      }
    });
    await page.waitForFunction(() => {
      const importStep = document.querySelector('#flowNav .step[data-target="import"]');
      return importStep && importStep.classList.contains('done');
    });

    const buttonGroups = [
      {
        tab: 'clean',
        items: [
          { selector: '#runReview', disabled: false },
          { selector: '#runClean', disabled: false },
          { selector: '#copyCleaned', disabled: false },
          { selector: '#compareBtn', disabled: false },
          { selector: '#splitBtn', disabled: false },
          { selector: '#casesCompareBtn', disabled: false },
          { selector: '#toggleCleanViewBtn', disabled: false },
          { selector: '#toggleCleanRawViewBtn', disabled: false },
        ],
      },
      {
        tab: 'auto',
        items: [
          { selector: '#runAutoWorkflow', disabled: false },
          { selector: '#autoMissingToggle', disabled: true },
          { selector: '#autoMissingCopy', disabled: true },
          { selector: '#autoMissingSmartFill', disabled: true },
          { selector: '#autoRecleanBtn', disabled: true },
          { selector: '#autoIgnoreCoverageBtn', disabled: true },
          { selector: '#autoFillCleanBtn', disabled: true },
          { selector: '#autoJumpCleanView', disabled: true },
          { selector: '#autoClarifyToggleBtn', disabled: true },
          { selector: '#autoClarifyConfirm', disabled: true },
        ],
      },
      {
        tab: 'tempexec',
        items: [
          { selector: '#openTempExecOverviewNavBtn', disabled: false },
          // DB 模式下用例执行改为“项目/版本分组”，不支持手动新建版本
          { selector: '#createTempVersionBtn', disabled: true },
          { selector: '#exportTempExecConfigBtn', disabled: true, hidden: true },
          { selector: '#importTempExecConfigBtn', disabled: true, hidden: true },
          { selector: '#exportTempExecXmindBtn', disabled: true },
          { selector: '#tempExecBackBtn', disabled: false },
        ],
      },
      {
        tab: 'casesgen',
        items: [
          { selector: '#exportCaseGen', disabled: true },
          // 临时屏蔽：用例执行页“常用用例模版”入口
          { selector: '#caseTemplateToggle', disabled: true },
        ],
      },
      {
        tab: 'assign',
        items: [
          { selector: '#saveAssignments', disabled: false },
          { selector: '#testCleanModel', disabled: false },
          { selector: '#testCompareModel', disabled: false },
          { selector: '#testSplitModel', disabled: false },
          { selector: '#testCasesModel', disabled: false },
          { selector: '#testCaseGenModel', disabled: false },
          { selector: '#saveDefaultPrompts', disabled: false },
          { selector: '#exportDefaultPrompts', disabled: false },
          { selector: '#importDefaultPrompts', disabled: false },
        ],
      },
    ];

    for (const group of buttonGroups) {
      await switchToTab(page, group.tab);
      for (const item of group.items) {
        const locator = page.locator(item.selector);
        await expect(locator).toHaveCount(1);
        if (Object.prototype.hasOwnProperty.call(item, 'hidden')) {
          if (item.hidden) await expect(locator).toBeHidden();
          else await expect(locator).toBeVisible();
        }
        if (item.disabled) {
          await expect(locator).toBeDisabled();
        } else {
          await expect(locator).toBeEnabled();
        }
      }
    }
  });
});
