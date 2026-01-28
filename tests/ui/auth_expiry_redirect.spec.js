const { test, expect } = require('@playwright/test');

test.describe('登录过期跳转', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'test-token');
        localStorage.removeItem('tap-e2e-skip-auth');
      } catch (_) {}
    });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('保存设置触发登录跳转', async ({ page }) => {
    let sawSave = false;
    await page.route('**/api/**', (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const respond = (status, body) => route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body || {}),
      });
      if (url.indexOf('/api/users/me') !== -1) {
        return respond(200, { id: 1, username: 'admin', role: 'admin', level: 'leader' });
      }
      if (url.indexOf('/api/settings') !== -1) {
        if (method === 'PUT') {
          sawSave = true;
          return respond(401, { detail: 'unauthorized' });
        }
        return respond(200, []);
      }
      if (url.indexOf('/api/projects') !== -1) {
        return respond(200, []);
      }
      return respond(200, {});
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/settings.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.waitForFunction(
      () => window.app && window.app.apiClient && typeof window.app.apiClient.saveSettings === 'function',
      {},
      { timeout: 20000 }
    );
    const saveResponse = page.waitForResponse((res) => {
      return res.url().indexOf('/api/settings') !== -1 && res.request().method() === 'PUT';
    });
    await page.evaluate(() => {
      if (window.app && window.app.apiClient && typeof window.app.apiClient.setToken === 'function') {
        window.app.apiClient.setToken('test-token');
      }
      if (window.app && window.app.apiClient && typeof window.app.apiClient.saveSettings === 'function') {
        window.app.apiClient.saveSettings('user', [{ key: 'theme', value_json: 'dark' }]);
      }
    });
    await saveResponse;
    expect(sawSave).toBe(true);
    await page.waitForURL(/login\.html/);
    await expect(page.locator('#loginStatus')).toContainText('登录已过期');
  });
});
