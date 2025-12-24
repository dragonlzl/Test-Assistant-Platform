const { test, expect } = require('@playwright/test');

test.describe('项目管理页签刷新后数据保持', () => {
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
        localStorage.setItem('tap-auth-token', 'test-token');
      } catch (_) {}
      const originalReplace = window.location.replace.bind(window.location);
      window.location.replace = function(url) {
        if (url && url.indexOf('login.html') !== -1) return;
        return originalReplace(url);
      };
    });

    const projects = [
      { id: 1, name: 'Alpha', description: '第一个项目', created_at: '2024-10-01T12:00:00Z', versions: [{ id: 11, name: 'v1.0' }] },
      { id: 2, name: 'Beta', description: '', created_at: '2024-11-11T09:00:00Z', versions: [] },
    ];
    await page.route('**/api/users/me', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'admin', role: 'admin', level: 'leader' }) });
    });
    await page.route('**/api/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
    });
    await page.route('**/api/users/1/projects', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/settings', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/ops', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('刷新后仍停留在项目管理且列表自动加载', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.authReady === true, null, { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="manage"]');
    await expect(page.locator('[data-group-menu="manage"]')).toBeVisible();
    await page.click('[data-group-menu="manage"] [data-tab-btn="project-admin"]');
    await expect(page.locator('section[data-tab-section="project-admin"]')).toBeVisible();
    await expect(page.locator('#projectTableBody tr')).toHaveCount(2);
    await expect(page.locator('#projectTableBody')).toContainText('Alpha');

    await page.reload();
    await page.waitForFunction(() => window.app && window.app.state && window.app.authReady === true, null, { timeout: 20000 });
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''))).toBe('project-admin');
    await expect(page.locator('section[data-tab-section="project-admin"]')).toBeVisible();
    await expect(page.locator('#projectTableBody tr')).toHaveCount(2);
    await expect(page.locator('#projectTableBody')).toContainText('Alpha');
  });
});
