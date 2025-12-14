const { test, expect } = require('@playwright/test');

test.describe('管理员卡片可见性', () => {
  test.beforeEach(async ({ page }) => {
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
    await page.route('**/api/users/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'test_admin', role: 'admin' }),
      });
    });
    await page.route('**/api/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/users', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
  });

  test('刷新保持当前页可见且管理卡片不乱入', async ({ page }) => {
    // 切到用例执行
    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="tempexec"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);
    await expect(page.locator('#projectAdminHead')).toBeHidden();
    await expect(page.locator('#userAdminHead')).toBeHidden();

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);
    await expect(page.locator('#projectAdminHead')).toBeHidden();
    await expect(page.locator('#userAdminHead')).toBeHidden();

    // 切到项目管理，再切回执行，确保可见性正常
    await page.click('.tab-group-btn[data-group="manage"]');
    await page.click('[data-group-menu="manage"] [data-tab-btn="project-admin"]');
    await expect(page.locator('#projectAdminHead')).toBeVisible();
    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="tempexec"]');
    await expect(page.locator('#projectAdminHead')).toBeHidden();
  });
});
