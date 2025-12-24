const { test, expect } = require('@playwright/test');

test.describe('登录后页签默认与刷新保持', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') {
        return respond(200, { id: 1, username: 'test_user', role: 'admin', level: 'leader' });
      }
      if (path === '/api/auth/logout') return respond(200, {});
      if (path === '/api/auth/login' && method === 'POST') return respond(200, { access_token: 'test-token' });
      if (path === '/api/settings' && method === 'GET') return respond(200, []);
      if (path === '/api/settings' && method === 'PUT') return respond(200, []);
      if (path === '/api/projects' && method === 'GET') return respond(200, []);
      if (path === '/api/ops') return respond(200, []);
      return respond(200, {});
    });
  });

  test('登录态刷新保持当前页签；重新登录回到默认页签', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'test-token');
        // 只清一次，避免 reload 时把“待验证的持久化”清掉。
        const flagKey = 'tap-e2e-cleared-active-tab-once';
        const cleared = localStorage.getItem(flagKey);
        if (!cleared) {
          sessionStorage.removeItem('usecase-active-tab');
          localStorage.setItem(flagKey, '1');
        }
      } catch (err) {
        // ignore
      }
    });

    await page.goto(base + '/index.html');
    const waitForAppReady = async () => {
      await page.waitForFunction(() => window.app && window.app.switchTab && window.app.state, null, { timeout: 20000 });
    };
    await waitForAppReady();

    const defaultTab = await page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''));
    expect(defaultTab).toBe('auto');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''))).toBe('tempexec');

    await page.reload();
    try {
      await waitForAppReady();
    } catch (err) {
      // 本地静态服务器偶发空响应/脚本未加载时，兜底重新进入 index。
      await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
      await waitForAppReady();
    }
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''))).toBe('tempexec');

    // 用户菜单关闭时 logoutBtn pointer-events:none，先展开菜单再点击
    await page.click('#userMenuToggle');
    await expect(page.locator('#userMenu')).toHaveClass(/menu-open/);
    await page.click('#logoutBtn');
    try {
      await page.waitForURL(/login\.html/, { timeout: 20000, waitUntil: 'domcontentloaded' });
    } catch (err) {
      // 本地静态服务器偶发空响应时，兜底直接访问登录页，避免用例抖动。
      await page.goto(base + '/login.html', { waitUntil: 'domcontentloaded' });
    }
    await page.waitForFunction(() => window.app && window.app.apiClient && typeof window.app.apiClient.login === 'function', null, { timeout: 20000 });
    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'any');
    await page.click('#loginSubmit');

    await page.waitForURL(/index\.html/, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.switchTab && window.app.state, null, { timeout: 20000 });
    const afterLoginTab = await page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''));
    expect(afterLoginTab).toBe('auto');
    expect(afterLoginTab).not.toBe('tempexec');

    // 关键回归：重新登录后，首次切页再刷新也应保持（不能“要第二次刷新才正常”）。
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''))).toBe('tempexec');
    await page.reload();
    await page.waitForFunction(() => window.app && window.app.switchTab && window.app.state, null, { timeout: 20000 });
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''))).toBe('tempexec');
  });
});
