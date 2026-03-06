const { test, expect } = require('@playwright/test');

test.describe('登录过期时间返回', () => {
  let loginResponseBody = null;
  let expectedExpiresAt = '';
  let forceUserMeError = false;
  let requireAuthHeader = false;

  test.beforeEach(async ({ page }) => {
    forceUserMeError = false;
    requireAuthHeader = false;
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    expectedExpiresAt = new Date(Date.now() + weekMs).toISOString();
    loginResponseBody = null;
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/auth/login' && method === 'POST') {
        loginResponseBody = { access_token: 'login-expire-token', expires_at: expectedExpiresAt };
        return respond(200, loginResponseBody);
      }
      if (path === '/api/users/me') {
        if (requireAuthHeader) {
          const auth = String(route.request().headers()['authorization'] || '');
          if (!auth || auth !== 'Bearer safe-token') {
            return respond(401, { detail: 'unauthorized' });
          }
        }
        if (forceUserMeError) return respond(500, { detail: 'server error' });
        return respond(200, { id: 1, username: 'test_user', role: 'admin', level: 'leader' });
      }
      if (path === '/api/auth/logout') return respond(200, {});
      if (path === '/api/settings' && method === 'GET') return respond(200, []);
      if (path === '/api/settings' && method === 'PUT') return respond(200, []);
      if (path === '/api/projects' && method === 'GET') return respond(200, []);
      if (path === '/api/ops') return respond(200, []);
      return respond(200, {});
    });
  });

  test('登录返回 expires_at 并写入 token', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/login.html');

    await page.fill('#loginUsername', 'admin');
    await page.fill('#loginPassword', 'any');
    await page.click('#loginSubmit');

    await page.waitForURL(/index\.html/, { timeout: 20000 });
    expect(loginResponseBody && loginResponseBody.expires_at).toBe(expectedExpiresAt);
    expect(loginResponseBody && loginResponseBody.access_token).toBe('login-expire-token');
    const stored = await page.evaluate(() => {
      try {
        return localStorage.getItem('tap-auth-token');
      } catch (err) {
        return '';
      }
    });
    expect(stored).toBe('login-expire-token');
  });

  test('校验接口异常时不清除 token、不跳转登录页', async ({ page }) => {
    forceUserMeError = true;
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'keep-token'); } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');

    await page.waitForTimeout(800);
    await expect.poll(() => page.url()).not.toMatch(/login\.html/);
    const stored = await page.evaluate(() => {
      try {
        return localStorage.getItem('tap-auth-token');
      } catch (err) {
        return '';
      }
    });
    expect(stored).toBe('keep-token');
  });

  test('本地 token 含非 Latin-1 字符时应降级为未登录并跳转登录页', async ({ page }) => {
    requireAuthHeader = true;
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', '测试🔒token'); } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await expect.poll(() => page.url(), { timeout: 20000 }).toMatch(/login\.html/);
    const stored = await page.evaluate(() => {
      try {
        return localStorage.getItem('tap-auth-token') || '';
      } catch (err) {
        return '';
      }
    });
    expect(stored).toBe('');
  });
});
