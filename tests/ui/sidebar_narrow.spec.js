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

test.describe('左侧导航窄屏适配', () => {
  test('窄屏下侧边栏改为全宽并展开分组菜单', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'token-sidebar-narrow'); } catch (_) {}
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
    expect(layout.sidebarWidth).toBeGreaterThan(Math.floor(layout.viewportWidth * 0.9));

    await page.click('.tab-group-btn[data-group="cases"]');
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
  });
});
