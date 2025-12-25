const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
  while (Date.now() < deadline) {
    last = await page.evaluate(() => {
      let token = '';
      try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
      return {
        hasApp: Boolean(window.app),
        authReady: Boolean(window.app && window.app.authReady === true),
        hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
        tab: window.app && window.app.state ? window.app.state.activeTab : '',
        token: token,
      };
    });
    if (last && last.hasApp && last.authReady && last.hasSwitchTab) return;
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

test.describe('执行总览版本选择深色主题样式', () => {
  test('深色主题下版本选择框箭头样式正常', async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'token-exec-overview-dark'); } catch (_) {}
      if (document && document.documentElement) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (pathName === '/api/users/me' && method === 'GET') {
        return respond(200, { id: 0, username: 'ui_admin', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await expect(page.locator('#execOverviewVersionSelect')).toHaveCount(1);

    const style = await page.evaluate(() => {
      var el = document.getElementById('execOverviewVersionSelect');
      if (!el || !window.getComputedStyle) return { backgroundImage: '', appearance: '' };
      var css = window.getComputedStyle(el);
      return {
        backgroundImage: css.backgroundImage || '',
        appearance: css.appearance || css.webkitAppearance || '',
      };
    });
    expect(style.backgroundImage).toContain('svg');
    expect(style.appearance).toBe('none');
  });
});
