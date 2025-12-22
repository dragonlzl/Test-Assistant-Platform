const { test, expect } = require('@playwright/test');

test.describe('临时执行搜索功能', () => {
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
      if (pathName === '/api/users/me' && method === 'GET') {
        // e2e: user.id = 0 不走 DB 入库，避免静态模式误触发 API。
        return respond(200, { id: 0, username: 'ui_admin', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
    });
    page.on('dialog', async (dialog) => {
      const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : '搜索需求';
      await dialog.accept(answer);
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
    await page.evaluate(() => {
      var keys = ['usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'];
      keys.forEach(function(key) {
        window.localStorage.removeItem(key);
      });
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
  });

  test('执行视图搜索与清空', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '搜索需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'search.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '下单支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('搜索需求');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/closing/);
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await expect(navButtons.first()).toBeVisible();
    await navButtons.first().click({ force: true });
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });
    const caseRows = page.locator('#tempExecView table tbody tr').filter({ has: page.locator('[data-temp-case-remove]') });
    await expect(caseRows.first()).toBeVisible({ timeout: 15000 });
    await expect(caseRows).toHaveCount(3, { timeout: 15000 });

    const searchInput = page.locator('#tempExecToolbar input[placeholder="搜索用例关键字"]');
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    await searchInput.fill('登录');
    await page.click('#tempExecToolbar button:has-text("搜索")');
    await expect(caseRows).toHaveCount(1, { timeout: 15000 });
    await expect(caseRows.first()).toContainText('登录');

    await page.click('#tempExecToolbar button:has-text("清除")');
    await expect(caseRows).toHaveCount(3);
  });

  test('删除用例改为确认抽屉', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '搜索需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'search.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '下单支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('搜索需求');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await navButtons.first().click({ force: true });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });
    const caseRows = page.locator('#tempExecView table tbody tr').filter({ has: page.locator('[data-temp-case-remove]') });
    await expect(caseRows).toHaveCount(3, { timeout: 15000 });

    await caseRows.first().locator('[data-temp-case-remove]').click();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toHaveText('确定删除该条用例吗？此操作不可撤销。');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(caseRows).toHaveCount(2, { timeout: 15000 });
  });
});
