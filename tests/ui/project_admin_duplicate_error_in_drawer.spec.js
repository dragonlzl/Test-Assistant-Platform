const { test, expect } = require('@playwright/test');

test.describe('项目管理：重复项目提示在抽屉内', () => {
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
      { id: 1, name: 'Alpha', description: '第一个项目', created_at: '2024-10-01T12:00:00Z', versions: [] },
    ];
    await page.route('**/api/users/me', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', role: 'admin' }) });
    });
    await page.route('**/api/projects', (route) => {
      if (route.request().method().toUpperCase() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
      }
      if (route.request().method().toUpperCase() === 'POST') {
        // 模拟后端同名校验
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: '项目名已存在' }) });
      }
      return route.continue();
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.authReady === true, null, { timeout: 20000 });
  });

  test('新建同名项目时错误提示显示在抽屉内', async ({ page }) => {
    await page.click('.tab-group-btn[data-group="manage"]');
    await page.click('[data-group-menu="manage"] [data-tab-btn="project-admin"]');

    await page.click('#projectCreateBtn');
    await expect(page.locator('#projectDrawer')).toHaveClass(/open/);
    await page.fill('#projectNameInput', 'Alpha');
    await page.fill('#projectDescInput', 'dup');
    await page.click('#projectSaveBtn');

    await expect(page.locator('#projectFormStatus')).toContainText('项目名已存在');
    // 主要错误提示应在抽屉内，避免用户在列表页找不到错误原因。
    await expect(page.locator('#projectStatus')).not.toContainText('项目名已存在');
  });
});

