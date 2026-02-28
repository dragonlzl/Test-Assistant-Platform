const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

test.describe('case-library 鉴权降级兜底', () => {
  test('users/me 首次失败时仍应渲染可见页签并自动重试恢复', async ({ page }) => {
    let meRequestCount = 0;
    const consoleLogs = [];

    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.addInitScript(() => {
      try {
        localStorage.removeItem('tap-e2e-skip-auth');
        localStorage.setItem('tap-auth-token', 'mock-auth-token');
        localStorage.setItem('tap-login-seq', 'mock-login-seq');
        sessionStorage.setItem('tap-active-tab-login-seq', 'mock-login-seq');
        sessionStorage.setItem('usecase-active-tab', 'case-library');
        // 避免测试环境误触发静态页自刷新，聚焦验证鉴权降级逻辑。
        sessionStorage.setItem('tap_bootstrap_reload_retry', '2');
      } catch (_) {
        // ignore
      }
    });

    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('file:') ||
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        url.startsWith('about:')
      ) {
        return route.continue();
      }
      return route.abort();
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) => route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

      if (path === '/api/users/me' && method === 'GET') {
        meRequestCount += 1;
        if (meRequestCount === 1) {
          return respond(503, { detail: 'temporary unavailable' });
        }
        return respond(200, {
          id: 4101,
          username: 'case_library_user',
          role: 'admin',
          level: 'leader',
        });
      }

      if (path === '/api/settings' && method === 'GET') return respond(200, []);
      if (path === '/api/models' && method === 'GET') return respond(200, []);
      if (path === '/api/features' && method === 'GET') return respond(200, []);
      if (path === '/api/projects' && method === 'GET') return respond(200, []);
      if (path.indexOf('/api/projects/') === 0 && path.indexOf('/versions') !== -1 && method === 'GET') return respond(200, []);
      if (path === '/api/case-files' && method === 'GET') return respond(200, []);
      if (path === '/api/case-files/shared' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/sets' && method === 'GET') return respond(200, []);
      return respond(200, method === 'GET' ? [] : {});
    });

    await page.goto(base + '/index.html?tab=case-library');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForFunction(() => {
      var sec = document.querySelector('section[data-tab-section="case-library"]');
      return !!sec && !sec.classList.contains('hidden');
    }, null, { timeout: 20000 });

    await page.waitForFunction(() => {
      return Boolean(window.app && window.app.authReady === true);
    }, null, { timeout: 20000 });

    const visibleMain = page.locator('section[data-tab-section="case-library"]');
    await expect(visibleMain).toBeVisible();
    expect(meRequestCount).toBeGreaterThanOrEqual(2);
    expect(consoleLogs.some((line) => line.indexOf('[authGuard] auth check failed, fallback tab rendered') !== -1)).toBeTruthy();
  });
});
