const { test, expect } = require('@playwright/test');

test.describe('项目管理列表与抽屉', () => {
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', role: 'admin' }) });
    });
    await page.route('**/api/projects', (route) => {
      if (route.request().method().toUpperCase() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
      }
      if (route.request().method().toUpperCase() === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 3, name: 'Gamma', description: '新增', created_at: new Date().toISOString(), versions: [] }) });
      }
      return route.continue();
    });
    await page.route('**/api/projects/*/versions', (route) => {
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 21, name: 'v2.0', created_at: new Date().toISOString() }) });
    });
    await page.route('**/api/projects/*', (route) => {
      if (route.request().method().toUpperCase() === 'PATCH') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: route.request().postData() || '{}' });
      }
      return route.continue();
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
  });

  test('列表渲染且抽屉开关正常', async ({ page }) => {
    const manageBtn = page.locator('.tab-group-btn', { hasText: '管理' });
    await manageBtn.click();
    await page.click('[data-group-menu="manage"] [data-tab-btn="project-admin"]');

    const rows = page.locator('#projectTableBody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Alpha');
    await expect(rows.nth(1)).toContainText('Beta');

    await page.click('#projectCreateBtn');
    const drawer = page.locator('#projectDrawer');
    await expect(drawer).toHaveClass(/open/);
    await page.fill('#projectNameInput', 'Gamma');
    await page.fill('#projectDescInput', '新增');
    await page.click('#projectSaveBtn');
    await expect(drawer).not.toHaveClass(/open/);

    await page.locator('[data-action="edit-project"]').first().click();
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#projectNameInput')).toHaveValue('Alpha');
    await page.evaluate(() => {
      var closer = document.querySelector('#projectDrawer [data-drawer-close="projectDrawer"]');
      if (closer && typeof closer.click === 'function') closer.click();
    });
    await expect(drawer).not.toHaveClass(/open/);
  });
});
