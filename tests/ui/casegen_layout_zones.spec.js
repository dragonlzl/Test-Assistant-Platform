const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html?_=' + Date.now().toString(36));
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

test.describe('用例生成-页面分区', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('用例生成页按 通用/入库/模块 自上而下分区', async ({ page }) => {
    const token = 'token-casegen-layout';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('casesgen');
    });

    const zones = page.locator('[data-section-id="casesgen"] [data-casegen-zone]');
    await expect(zones).toHaveCount(3);

    const order = await page.evaluate(() => {
      const els = Array.prototype.slice.call(document.querySelectorAll('[data-section-id="casesgen"] [data-casegen-zone]'));
      return els.map((el) => (el && el.dataset ? el.dataset.casegenZone : ''));
    });
    expect(order).toEqual(['general', 'store', 'modules']);

    const storeLayout = await page.evaluate(() => {
      const container = document.querySelector('[data-casegen-zone="store"] .casegen-store-actions');
      if (!container) return null;
      return {
        flexDirection: window.getComputedStyle(container).flexDirection,
        rowCount: container.querySelectorAll('.casegen-store-row').length,
      };
    });
    expect(storeLayout).not.toBeNull();
    expect(storeLayout.flexDirection).toBe('column');
    expect(storeLayout.rowCount).toBe(3);

    await expect(page.locator('[data-casegen-zone="general"] #exportCaseGen')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="general"] #exportCaseGenXmind')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="general"] #toSplitFromCaseGen')).toBeVisible();

    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreActionSelect')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreNewBtn')).toBeVisible();
    await expect(page.locator('[data-casegen-zone="store"] #caseGenStoreAppendBtn')).toBeVisible();

    await expect(page.locator('[data-casegen-zone="modules"] #casesGenerationContainer')).toBeVisible();
  });
});
