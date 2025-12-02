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
    page.on('dialog', async (dialog) => {
      const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : '搜索需求';
      await dialog.accept(answer);
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      var keys = ['usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'];
      keys.forEach(function(key) {
        window.localStorage.removeItem(key);
      });
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('执行视图搜索与清空', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
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

    await expect(page.locator('#tempExecNav button[data-temp-file]')).toHaveCount(1, { timeout: 5000 });
    await page.click('#tempExecNav button[data-temp-file]');
    const caseRows = page.locator('#tempExecView table tbody tr').filter({ has: page.locator('[data-temp-case-remove]') });
    await expect(caseRows.first()).toBeVisible({ timeout: 15000 });
    await expect(caseRows).toHaveCount(3, { timeout: 15000 });

    const searchInput = page.locator('#tempExecView input[placeholder="搜索用例关键字"]');
    await searchInput.fill('登录');
    await page.click('#tempExecView button:has-text("搜索")');
    await expect(caseRows).toHaveCount(1, { timeout: 15000 });
    await expect(caseRows.first()).toContainText('登录');

    await page.click('#tempExecView button:has-text("清除")');
    await expect(caseRows).toHaveCount(3);
  });
});
