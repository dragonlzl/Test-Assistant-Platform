const { test, expect } = require('@playwright/test');

test.describe('执行视图导入导出与拖拽', () => {
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

  async function openTempExecDrawer(page) {
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
  }
  async function closeTempExecDrawer(page) {
    const drawer = page.locator('#tempExecAssignDrawer');
    const isOpen = await drawer.evaluate((el) => el.classList.contains('open'));
    if (!isOpen) return;
    await page.click('#closeTempExecAssignDrawerBtn', { trial: false });
    await expect(drawer).not.toHaveClass(/open/);
  }
  async function confirmDrawerInput(page, value) {
    const drawer = page.locator('#appConfirmDrawer');
    await drawer.waitFor({ state: 'attached' });
    await page.waitForFunction(() => {
      const el = document.getElementById('appConfirmDrawer');
      return el && el.classList.contains('open');
    }).catch(() => {});
    const isOpen = await drawer.evaluate((el) => el.classList.contains('open')).catch(() => false);
    if (!isOpen) return;
    await expect(page.locator('#appConfirmDrawerInputRow')).toBeVisible();
    await page.fill('#appConfirmDrawerInput', value);
    await page.click('#appConfirmDrawerConfirmBtn');
  }
  async function createTempVersion(page, name) {
    await page.click('#createTempVersionBtn');
    await confirmDrawerInput(page, name);
  }

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
      try {
        localStorage.removeItem('usecase-temp-exec-v1');
        localStorage.removeItem('tempexec-focus-v1');
        localStorage.removeItem('tempexec-page-size');
        localStorage.removeItem('usecase-active-tab');
      } catch (_) {}
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') {
        // e2e: 约定 user.id = 0 时不走 DB 入库，避免自动化需要补齐整套后端链路。
        return respond(200, { id: 0, username: 'ui_admin', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
    });
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : 'UI执行需求';
        await dialog.accept(answer);
        return;
      }
      await dialog.accept();
    });
    await gotoIndexWithRetry(page);
    let last = null;
    for (let i = 0; i < 3; i += 1) {
      try {
        last = await page.evaluate(() => ({
          hasApp: Boolean(window.app),
          inited: Boolean(window.app && window.app._inited === true),
          hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
          path: (window.location && window.location.pathname) ? String(window.location.pathname) : '',
        }));
      } catch (err) {
        last = null;
      }
      if (last && last.hasApp && last.inited && last.hasSwitchTab) break;
      if (i < 2) {
        await page.waitForTimeout(200);
        await gotoIndexWithRetry(page);
      }
    }
    await page.waitForFunction(
      () => window.app && window.app._inited === true && typeof window.app.switchTab === 'function',
      null,
      { timeout: 30000 }
    );
    await page.evaluate(() => {
      localStorage.removeItem('usecase-card-collapse-v1');
    });
  });

  test('导入导出、拖拽与配置恢复', async ({ page }) => {
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      window.app.state.requirementLabel = 'UI执行需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });
    await openTempExecDrawer(page);

    const execFileA = {
      name: 'execA.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录', steps: '步骤1', expected: '成功' },
        { module: '模块A', title: '退出', steps: '步骤2', expected: '成功' },
      ], null, 2)),
    };
    const execFileB = {
      name: 'execB.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块B', title: '下单', steps: '填写信息', expected: '下单成功' },
      ], null, 2)),
    };
    page.__promptAnswers.push('UI执行需求');
    page.__promptAnswers.push('支付需求');
    await page.setInputFiles('#tempExecInput', [execFileA, execFileB]);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });
    const reqCount = await page.locator('#tempExecNav [data-temp-req]').count();
    expect(reqCount).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => {
      window.app.state.models = [{
        id: 'model-export-ui',
        name: 'UI模型',
        provider: 'custom',
        baseUrl: 'http://localhost/mock',
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 2048,
      }];
      localStorage.setItem('cleaner-models-v1', JSON.stringify(window.app.state.models));
      window.app.state.assignments = Object.assign({}, window.app.state.assignments, {
        cleanPrompt: 'clean-prompt-ui',
        cleanTemperature: 0.4,
        cleanReasoning: 'medium',
      });
      localStorage.setItem('cleaner-assignment-v1', JSON.stringify(window.app.state.assignments));
    });
    await expect(page.locator('#exportTempExecConfigBtn')).toBeHidden();
    await expect(page.locator('#importTempExecConfigBtn')).toBeHidden();
    await closeTempExecDrawer(page);
    // 执行视图不再提供“导出本次执行JSON”按钮

    const activeFileName = await page.evaluate(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const activeId = state && state.tempExecActiveId ? state.tempExecActiveId : '';
      const files = state && Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      const target = files.find((item) => item && item.id === activeId);
      return target && target.name ? target.name : '';
    });
    const baseName = activeFileName ? activeFileName.replace(/\.[^.]+$/, '') : 'temp_exec';
    const safeBase = baseName.replace(/[\\/:*?"<>|]/g, '_') || 'temp_exec';
    const escapedBase = safeBase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

    await page.waitForFunction(() => {
      const hasZip = typeof window.JSZip !== 'undefined' || typeof JSZip !== 'undefined';
      const api = window.app && (window.app.xmindCoreApi || window.app.xmindCore);
      const hasXmind = api && typeof api.buildXmindPackageFromCases === 'function';
      return Boolean(hasZip && hasXmind);
    }, {}, { timeout: 60000 });
    await expect(page.locator('#exportTempExecXmindBtn')).toBeEnabled();
    await expect(page.locator('#exportTempExecCasesXmindBtn')).toBeEnabled();

    const [xmindDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#exportTempExecXmindBtn'),
    ]);
    const resultName = await xmindDownload.suggestedFilename();
    expect(resultName).toMatch(new RegExp(`^${escapedBase}_result_\\d{14}\\.xmind$`));

    const [plainXmindDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#exportTempExecCasesXmindBtn'),
    ]);
    const plainName = await plainXmindDownload.suggestedFilename();
    expect(plainName).toMatch(new RegExp(`^${escapedBase}_\\d{14}\\.xmind$`));
    await openTempExecDrawer(page);

    await createTempVersion(page, '版本A');
    await createTempVersion(page, '版本B');
    await expect(page.locator('#tempVersionGrid [data-temp-version]')).toHaveCount(2);

    const firstReq = page.locator('#tempExecNav [data-temp-req]').first();
    const firstVersion = page.locator('#tempVersionGrid [data-temp-version]').first();
    const firstVersionBody = firstVersion.locator('.temp-version-body');
    await firstVersionBody.scrollIntoViewIfNeeded();
    await firstReq.dragTo(firstVersionBody);
    await expect(firstVersion.locator('[data-temp-req-key]')).toHaveCount(1);

    const versionReq = firstVersion.locator('[data-temp-req]').first();
    const secondVersion = page.locator('#tempVersionGrid [data-temp-version]').nth(1);
    const secondVersionBody = secondVersion.locator('.temp-version-body');
    await versionReq.dragTo(secondVersionBody);
    await expect(secondVersion.locator('[data-temp-req-key]')).toHaveCount(1);

    const versionBox = secondVersion.locator('[data-temp-req-key]').first();
    const navPool = page.locator('[data-temp-req-pool]');
    await versionBox.dragTo(navPool);
    await expect(page.locator('#tempExecNav')).toContainText('UI执行需求');

    const focusZone = page.locator('#tempFocusBlock [data-temp-focus-zone]');
    const navFileRow = page.locator('#tempExecNav .temp-req-row[data-temp-file]', { hasText: 'execA.json' });
    await navFileRow.dragTo(focusZone);
    await expect(focusZone.locator('button[data-temp-file]')).toHaveCount(1);
    const focusNames = await page.$$eval('#tempFocusBlock button[data-temp-file]', (nodes) => nodes.map((btn) => btn.textContent || ''));
    expect(focusNames.some((text) => text.indexOf('execA.json') !== -1)).toBeTruthy();

    const navRows = page.locator('#tempExecNav .temp-req-row[data-temp-file]');
    const navRowCount = await navRows.count();
    expect(navRowCount).toBeGreaterThanOrEqual(2);
    await navRows.nth(navRowCount - 1).dragTo(navRows.first());
    const navOrder = await page.$$eval('#tempExecNav .temp-req-row[data-temp-file] .name-text', (nodes) => nodes.map((el) => (el.textContent || '').trim()));
    expect(navOrder).toContain('execA.json');
    expect(navOrder).toContain('execB.json');

    const firstNavButton = page.locator('#tempExecNav button[data-temp-file]').first();
    const activeNavName = (await firstNavButton.locator('.name-text').textContent()) || '';
    await firstNavButton.click();
    await expect(page.locator('#tempExecToolbar')).toContainText('当前文件');
    await expect(page.locator('#tempExecToolbar')).toContainText(activeNavName.trim());
    const resultSelect = page.locator('#tempExecView select[data-temp-result]').first();
    await resultSelect.selectOption('通过');
    const secondResultSelect = page.locator('#tempExecView select[data-temp-result]').nth(1);
    await secondResultSelect.selectOption('失败');
    await expect(resultSelect).toHaveValue('通过');
    await expect(secondResultSelect).toHaveValue('失败');
    await page.waitForFunction(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const activeId = state && state.tempExecActiveId ? state.tempExecActiveId : '';
      const files = state && Array.isArray(state.tempExecFiles) ? state.tempExecFiles : [];
      const file = files.find((item) => item && item.id === activeId);
      const cases = file && Array.isArray(file.cases) ? file.cases : [];
      if (cases.length < 2) return false;
      return String(cases[0].actual || '') === '通过' && String(cases[1].actual || '') === '失败';
    });

    await closeTempExecDrawer(page);
    const overviewNav = page.locator('#openTempExecOverviewNavBtn');
    await overviewNav.scrollIntoViewIfNeeded();
    await overviewNav.click();
    await expect(page.locator('#tempExecOverview')).toContainText('执行进度');
    await expect(page.locator('.temp-overview-section-title', { hasText: '当前执行区' })).toBeVisible();
    const overviewCount = await page.locator('#tempExecOverview .temp-overview-entry').count();
    expect(overviewCount).toBeGreaterThanOrEqual(2);
    const fileCount = await page.locator('#tempExecOverview [data-temp-file]').count();
    expect(fileCount).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#tempExecOverviewDrawer')).toHaveClass(/open/);
    await page.click('#tempExecBackBtn');
    await expect(page.locator('#tempExecOverviewDrawer')).not.toHaveClass(/open/);

    const snapshot = await page.evaluate(() => JSON.stringify({
      type: 'tempexec_snapshot_v1',
      generatedAt: new Date().toISOString(),
      requirement: window.app.state.requirementLabel || '',
      files: window.app.state.tempExecFiles,
      versions: window.app.state.tempExecVersions,
      focus: window.app.state.tempExecFocus || [],
      pageSize: window.app.state.tempExecPageSize || 0,
      columns: (window.app.state.settings && window.app.state.settings.tempExecColumns) || {},
      activeId: window.app.state.tempExecActiveId || '',
      placement: window.app.state.tempExecPlacement || { requirementOrder: [], fileOrder: {}, versionOrder: [] },
    }));
    await page.evaluate(() => {
      const keys = ['usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'];
      keys.forEach((key) => window.localStorage.removeItem(key));
    });
    await page.reload();
    await page.waitForFunction(
      () => window.app && window.app._inited === true && typeof window.app.switchTab === 'function',
      null,
      { timeout: 30000 }
    );
    await switchToTab(page, 'tempexec');
    await openTempExecDrawer(page);
    await expect(page.locator('#tempExecNav .temp-req-row[data-temp-file]')).toHaveCount(0);

    await page.setInputFiles('#importTempExecConfigFile', {
      name: 'snapshot.json',
      mimeType: 'application/json',
      buffer: Buffer.from(snapshot),
    });
    await expect(page.locator('#tempExecStatus')).toContainText('执行页面配置已导入', { timeout: 5000 });
    await expect(page.locator('#tempExecNav .temp-req-row[data-temp-file]')).toHaveCount(2);
  });

  test('从版本拖回需求区不改变版本排序', async ({ page }) => {
    await page.evaluate(() => {
      ['usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'].forEach(function(key) {
        window.localStorage.removeItem(key);
      });
    });
    await page.reload();
    await page.waitForFunction(
      () => window.app && window.app._inited === true && typeof window.app.switchTab === 'function',
      null,
      { timeout: 30000 }
    );
    page.__promptAnswers = [];
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '版本排序需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });
    await openTempExecDrawer(page);

    const execFile = {
      name: 'req-sort.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录', steps: '步骤1', expected: '成功' },
        { module: '模块A', title: '退出', steps: '步骤2', expected: '成功' },
      ], null, 2)),
    };
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });
    const navReqList = page.locator('#tempExecNav [data-temp-req]');
    expect(await navReqList.count()).toBeGreaterThan(0);

    await createTempVersion(page, '版本A');
    await createTempVersion(page, '版本B');
    await expect(page.locator('#tempVersionGrid [data-temp-version]')).toHaveCount(2);

    const versionOrderBefore = await page.$$eval('#tempVersionGrid [data-temp-version] .title', (nodes) => nodes.map((n) => (n.textContent || '').trim()));
    expect(versionOrderBefore).toHaveLength(2);

    const navReq = navReqList.first();
    await navReq.scrollIntoViewIfNeeded();
    const firstVersionBody = page.locator('#tempVersionGrid [data-temp-version]').first().locator('.temp-version-body');
    await firstVersionBody.scrollIntoViewIfNeeded();
    await navReq.dragTo(firstVersionBody, { timeout: 10000 });
    expect(await firstVersionBody.locator('[data-temp-req]').count()).toBeGreaterThan(0);

    const versionReqBox = firstVersionBody.locator('[data-temp-req]').first();
    const navPool = page.locator('[data-temp-req-pool]');
    await versionReqBox.dragTo(navPool);

    const versionOrderAfter = await page.$$eval('#tempVersionGrid [data-temp-version] .title', (nodes) => nodes.map((n) => (n.textContent || '').trim()));
    expect(versionOrderAfter).toEqual(versionOrderBefore);
  });

  test('用例复用状态选择展示颜色', async ({ page }) => {
    await switchToTab(page, 'tempexec');
    await openTempExecDrawer(page);
    const execFile = {
      name: 'reuse.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录', steps: '步骤1', expected: '成功' },
      ], null, 2)),
    };
    await page.setInputFiles('#tempExecInput', [execFile]);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入');
    await page.click('#closeTempExecAssignDrawerBtn');

    const reuseToggle = page.locator('[data-temp-reuse-toggle]').first();
    await reuseToggle.check();

    const reuseBtn = page.locator('[data-temp-reuse-panel]').first();
    await reuseBtn.click();
    const reuseAddBtn = page.locator('[data-temp-reuse-add]').first();
    await reuseAddBtn.click();
    await reuseAddBtn.click();

    const statusSelect = page.locator('[data-temp-reuse-status]').first();
    const statusSelectSecond = page.locator('[data-temp-reuse-status]').nth(1);
    await expect(statusSelect).toHaveClass(/pending/);
    await statusSelect.selectOption('通过');
    await statusSelectSecond.selectOption('不适用');
    const statusBtn = page.locator('[data-temp-reuse-panel]').first();
    await expect(statusBtn).toHaveClass(/passed/);
    await expect(statusBtn).toContainText('通过');

    await statusSelectSecond.selectOption('失败');
    await expect(statusBtn).toHaveClass(/failed/);
    await expect(statusBtn).toContainText('失败');
  });

  test('需求区与版本区支持收起展开', async ({ page }) => {
    await switchToTab(page, 'tempexec');
    await openTempExecDrawer(page);
    const reqToggle = page.locator('#toggleTempReq');
    const versionToggle = page.locator('#toggleTempVersion');
    await expect(reqToggle).toBeVisible();
    await expect(versionToggle).toBeVisible();

    await reqToggle.click();
    await expect(page.locator('#tempExecNav')).toHaveClass(/collapsed/);
    await expect(page.locator('#tempExecNav')).toContainText('已收起');
    await reqToggle.click();
    await expect(page.locator('#tempExecNav')).not.toHaveClass(/collapsed/);

    await versionToggle.click();
    await expect(page.locator('#tempVersionGrid')).toHaveClass(/collapsed/);
    await expect(page.locator('#tempVersionGrid')).toContainText('已收起');
    await versionToggle.click();
    await expect(page.locator('#tempVersionGrid')).not.toHaveClass(/collapsed/);
  });
});
