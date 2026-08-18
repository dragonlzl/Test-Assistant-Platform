const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 101, username: 'settings_user', role: 'user', level: 'member' };

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
}

async function setupRoutes(page) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('tap-auth-token', 'settings-nav-token'); } catch (err) {}
  });

  await page.route('**/*', (route) => {
    const target = route.request().url();
    if (target.startsWith('http://localhost') || target.startsWith('http://127.0.0.1') || target.startsWith('file:')) {
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

    if (path === '/api/users/me' && method === 'GET') return respond(200, user);
    if (path === '/api/settings' && method === 'GET') return respond(200, []);
    if (path === '/api/settings' && method === 'PUT') return respond(200, []);
    if (path === '/api/projects' && method === 'GET') return respond(200, []);
    if (path.indexOf('/api/projects/') === 0 && path.indexOf('/versions') > -1 && method === 'GET') {
      return respond(200, []);
    }
    if (path === '/api/case-files' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') return respond(200, []);
    if (path === '/api/features' && method === 'GET') return respond(200, []);
    if (path === '/api/ops' && method === 'GET') return respond(200, []);
    return respond(200, method === 'GET' ? [] : {});
  });
}

async function waitForSettingsSectionTop(page, target) {
  await page.waitForFunction((id) => {
    var el = document.querySelector('[data-settings-section="' + id + '"]');
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < 240;
  }, target);
}

test.describe('设置页顶部导航', () => {
  test('设置导航只展示保留设置并支持定位', async ({ page }) => {
    await setupRoutes(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });

    await expect(page.locator('#flowNav')).toHaveCount(0);
    await expect(page.locator('#settingsHead')).toBeVisible();
    await expect(page.locator('#settingsNavFeishuBtn')).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#settingsNavColumnsBtn');
    await waitForSettingsSectionTop(page, 'tempexec-columns');

    await page.click('#settingsNavMiscBtn');
    await waitForSettingsSectionTop(page, 'misc');
  });
});
