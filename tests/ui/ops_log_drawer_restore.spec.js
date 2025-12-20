const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
    timeout,
  });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout });
}

async function mockApi(page) {
  const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathName === '/api/users/me') return respond(200, admin);
    if (pathName === '/api/users' && method === 'GET') return respond(200, [admin]);
    if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
    if (pathName === '/api/ops' && method === 'GET') return respond(200, []);

    if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
    if (pathName === '/api/models' && method === 'GET') return respond(200, []);
    if (pathName === '/api/features' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);
    if (pathName === '/api/auth/logout') return respond(200, {});
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  });
}

test.describe('操作记录-查看记录抽屉恢复', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'test-token');
      } catch (_) {}
    });
  });

  test('未打开时不自动弹出抽屉', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-ops-log-view-v1', JSON.stringify({ hasViewed: true, drawerOpen: false }));
      } catch (_) {}
    });
    await mockApi(page);
    await gotoIndex(page);
    await waitAppReady(page, 30000);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('ops-log');
    });

    await expect(page.locator('#opsLogDrawer')).not.toHaveClass(/open/);
  });

  test('刷新前打开抽屉会自动恢复', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-ops-log-view-v1', JSON.stringify({ hasViewed: true, drawerOpen: true }));
      } catch (_) {}
    });
    await mockApi(page);
    await gotoIndex(page);
    await waitAppReady(page, 30000);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('ops-log');
    });

    await expect(page.locator('#opsLogDrawer')).toHaveClass(/open/);
  });
});
