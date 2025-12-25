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

test.describe('一键执行导航窄屏适配', () => {
  test('步骤导航在窄屏下支持横向滚动', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'token-auto-flow'); } catch (_) {}
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
    await expect(page.locator('#flowNav')).toBeVisible();

    const layout = await page.evaluate(() => {
      var el = document.querySelector('#flowNav .flow-steps');
      if (!el || !window.getComputedStyle) {
        return { overflowX: '', scrollWidth: 0, clientWidth: 0 };
      }
      return {
        overflowX: window.getComputedStyle(el).overflowX,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    expect(layout.overflowX).toBe('auto');
    expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
  });
});
