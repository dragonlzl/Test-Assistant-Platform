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
    if (last && last.hasApp && last.authReady && last.hasSwitchTab) {
      await page.waitForFunction(() => window.app && window.app.uiReady === true, null, { timeout: 5000 });
      return;
    }
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

test.describe('左侧导航窄屏适配', () => {
  test('窄屏固定 68px 主栏并使用可关闭的 240px 二级覆盖层', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'token-sidebar-narrow');
        localStorage.removeItem('tap-navigation-context-collapsed-v1');
      } catch (_) {}
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
    await expect(page.locator('.sidebar')).toBeVisible();

    const layout = await page.evaluate(() => {
      var sidebar = document.querySelector('.sidebar');
      var layout = document.querySelector('.app-layout');
      return {
        sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : 0,
        viewportWidth: window.innerWidth,
        columns: layout && window.getComputedStyle ? window.getComputedStyle(layout).gridTemplateColumns : '',
      };
    });
    expect(layout.sidebarWidth).toBe(68);
    expect(layout.columns.split(' ')[0]).toBe('68px');
    await expect(page.locator('.tap-nav-context')).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('.tap-nav-backdrop')).toBeHidden();

    await page.click('.tap-nav-rail-item[data-nav-group="cases"]');
    await expect(page.locator('.tap-nav-context')).toBeVisible();
    await expect(page.locator('.tap-nav-backdrop')).toBeVisible();
    await expect.poll(async () => page.locator('.tap-nav-context').evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(240);
    const submenu = page.locator('.tab-group-btn[data-group="cases"] + .tab-submenu');
    await expect(submenu).toBeVisible();

    const menuLayout = await page.evaluate(() => {
      function rect(el) {
        if (!el) return null;
        var box = el.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y), bottom: Math.round(box.bottom) };
      }
      var btn = document.querySelector('.tab-group-btn[data-group="cases"]');
      var menu = btn ? btn.parentElement.querySelector('.tab-submenu') : null;
      return { btn: rect(btn), menu: rect(menu) };
    });
    expect(menuLayout.btn).toBeTruthy();
    expect(menuLayout.menu).toBeTruthy();
    const menuPosition = await page.evaluate(() => {
      var menu = document.querySelector('.tab-group-btn[data-group="cases"] + .tab-submenu');
      if (!menu || !window.getComputedStyle) return '';
      return window.getComputedStyle(menu).position;
    });
    expect(menuPosition).toBe('static');

    await page.click('.tap-nav-backdrop');
    await expect(page.locator('.tap-nav-context')).toHaveCSS('visibility', 'hidden');

    await page.click('.tap-nav-rail-item[data-nav-group="cases"]');
    await expect(page.locator('.tap-nav-context')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tap-nav-context')).toHaveCSS('visibility', 'hidden');

    const desktopPreference = await page.evaluate(() => {
      try { return localStorage.getItem('tap-navigation-context-collapsed-v1'); } catch (_) { return null; }
    });
    expect(desktopPreference).toBeNull();
  });
});
