const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 412, username: 'sidebar_tab_user', role: 'user', level: 'member' };

function createApiHandler(serverState) {
  let settingSeq = 1;
  return async function(route) {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/users/me' && method === 'GET') return respond(200, user);
    if (path === '/api/settings' && method === 'GET') return respond(200, serverState.settings);
    if (path === '/api/settings' && method === 'PUT') {
      const body = route.request().postDataJSON() || {};
      const scope = body.scope || 'user';
      const items = Array.isArray(body.items) ? body.items : [];
      const now = new Date().toISOString();
      const saved = [];
      items.forEach((item) => {
        if (!item || !item.key) return;
        const ownerId = scope === 'global' ? null : user.id;
        let existing = serverState.settings.find(
          (row) => row.key === item.key && row.scope === scope && row.owner_id === ownerId
        );
        if (existing) {
          existing.value_json = item.value_json;
          existing.updated_at = now;
          saved.push(existing);
          return;
        }
        const next = {
          id: settingSeq++,
          scope,
          owner_id: ownerId,
          key: item.key,
          value_json: item.value_json,
          updated_at: now,
        };
        serverState.settings.push(next);
        saved.push(next);
      });
      return respond(200, saved);
    }
    if (path === '/api/projects' && method === 'GET') return respond(200, []);
    if (path === '/api/case-files' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') return respond(200, []);
    if (path === '/api/features' && method === 'GET') return respond(200, []);
    if (path === '/api/ops' && method === 'GET') return respond(200, []);
    return respond(200, method === 'GET' ? [] : {});
  };
}

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('侧边栏页签持久化', () => {
  test('用例生成进度/个人备忘页签切换可持久化', async ({ page }) => {
    const serverState = { settings: [] };
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'sidebar-tab-token'); } catch (err) {}
    });

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.route('**/api/**', createApiHandler(serverState));

    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await expect(page.locator('#sidebarTabCasegen')).toHaveClass(/is-active/);
    await page.click('#sidebarTabMemo');
    await expect(page.locator('#sidebarTabMemo')).toHaveClass(/is-active/);
    await expect(page.locator('[data-sidebar-panel="memo"]')).toHaveClass(/is-active/);

    await expect.poll(() => {
      return serverState.settings.some((item) => item.key === 'sidebarTabActive' && item.value_json === 'memo');
    }).toBeTruthy();

    await page.reload();
    await waitForAppReady(page);
    await page.waitForFunction(() => {
      const btn = document.getElementById('sidebarTabMemo');
      return btn && btn.classList.contains('is-active');
    });
    await expect(page.locator('[data-sidebar-panel="memo"]')).toHaveClass(/is-active/);
  });
});
