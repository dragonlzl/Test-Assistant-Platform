const { test, expect } = require('@playwright/test');

test.describe('多页面拆分入口', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.removeItem('tap-auth-token');
      } catch (_) {}
    });
  });

  test('各页面可加载并展示默认页签', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const targets = [
      { path: '/ai-workflow.html', selector: '[data-tab-section="auto"]' },
      { path: '/ai-tools.html', selector: '[data-tab-section="assign"]' },
      { path: '/case-exec.html', selector: '[data-tab-section="tempexec"]' },
      { path: '/case-library.html', selector: '[data-tab-section="case-library"]' },
      { path: '/admin.html', selector: '[data-tab-section="project-admin"]' },
      { path: '/settings.html', selector: '[data-tab-section="settings"]' },
    ];

    for (let i = 0; i < targets.length; i += 1) {
      const entry = targets[i];
      await page.goto(base + entry.path);
      const section = page.locator(entry.selector).first();
      await section.waitFor({ state: 'visible', timeout: 20000 });
      await expect(section).toBeVisible();
    }
  });

  test('跨页面签切换可自动跳转', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/ai-workflow.html');
    await page.locator('[data-tab-section="auto"]').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => {
      return window.app && typeof window.app.switchTab === 'function';
    }, null, { timeout: 20000 });
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await page.waitForURL('**/case-exec.html*', { timeout: 15000 });
    await expect(page.locator('[data-tab-section="tempexec"]').first()).toBeVisible();
  });

  test('一键执行进行中跨页面切换保持同一页面', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/ai-workflow.html');
    await page.locator('[data-tab-section="auto"]').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
    await page.evaluate(() => {
      var snapshot = {
        version: 1,
        user_id: '',
        updated_at: Date.now(),
        data: {
          rawText: '需求内容',
          reviewResult: '[]',
          cleanedText: '{"summary":"ok"}',
          compareResult: '',
          splitResult: '',
          casesCompareResult: '',
          caseText: '用例列表',
          importedCases: [],
          inProgressStep: '',
          inProgressSteps: { compare: true },
          waitingSteps: {},
          failedSteps: {},
          validationFailedSteps: {},
          failedReasons: {},
          waitingReasons: {},
          validationFailedReasons: {},
          autoRunning: true,
        },
      };
      try {
        localStorage.setItem('usecase-workflow-state-v1', JSON.stringify(snapshot));
      } catch (_) {}
      if (window.app && window.app.state) window.app.state.autoRunning = true;
    });
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await page.waitForURL('**/index.html*tab=tempexec*', { timeout: 15000 });
    await expect(page.locator('[data-tab-section="tempexec"]').first()).toBeVisible();
  });

  test('用例执行页选择用例执行直接打开抽屉', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await expect(page.locator('[data-tab-section="tempexec"]').first()).toBeVisible();
    await page.click('#openTempExecCaseLibraryBtn');
    await expect(page).toHaveURL(/case-exec\.html/);
    await expect(page.locator('#caseLibrarySelectExecDrawer')).toHaveClass(/open/);
  });

  test('执行分配添加执行用例直接打开抽屉', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await expect(page.locator('[data-tab-section="tempexec"]').first()).toBeVisible();
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
    await page.click('#tempExecAddCaseFromLibraryBtn');
    await expect(page).toHaveURL(/case-exec\.html/);
    await expect(page.locator('#caseLibrarySelectExecDrawer')).toHaveClass(/open/);
  });

  test('转到执行后可自动打开执行分配并提示', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.addInitScript((payload) => {
      try {
        sessionStorage.setItem('tap-temp-exec-assign-request', JSON.stringify(payload));
      } catch (_) {}
    }, { name: '登录用例', versionName: '版本A' });
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
    await expect(page.locator('.temp-center-toast').first())
      .toContainText('用例：【登录用例】已成功转到用例执行页内，请在当前【执行分配】页内查看选择。');
  });

  test('页签切换支持前进后退', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/ai-workflow.html');
    await page.locator('[data-tab-section="auto"]').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => {
      return window.app && typeof window.app.switchTab === 'function';
    }, null, { timeout: 20000 });
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('clean');
      }
    });
    await page.waitForURL('**/ai-workflow.html*tab=clean*', { timeout: 15000 });
    await expect(page.locator('[data-tab-section="clean"]').first()).toBeVisible();
    await page.goBack();
    await page.waitForURL('**/ai-workflow.html*tab=auto*', { timeout: 15000 });
    await expect(page.locator('[data-tab-section="auto"]').first()).toBeVisible();
    await page.goForward();
    await page.waitForURL('**/ai-workflow.html*tab=clean*', { timeout: 15000 });
    await expect(page.locator('[data-tab-section="clean"]').first()).toBeVisible();
  });
});
