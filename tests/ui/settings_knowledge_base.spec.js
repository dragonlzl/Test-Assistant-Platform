const { test, expect } = require('@playwright/test');

test.describe('settings knowledgeBaseBaseUrl', () => {
  test('知识库服务器地址可保存、标准化并在刷新后恢复', async ({ page }) => {
    const token = 'token-settings-knowledge-base';
    const user = { id: 501, username: 'demo_user_settings_kb', role: 'user', level: 'member' };
    const settingsStore = [];

    await page.addInitScript((payload) => {
      try {
        localStorage.setItem('tap-auth-token', payload.token);
      } catch (_) {}
    }, { token });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const headers = route.request().headers();
      const respond = (status, body) => route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

      if (pathName === '/api/users/me' && method === 'GET') {
        if ((headers.authorization || '') !== `Bearer ${token}`) {
          return respond(401, { detail: 'unauthorized' });
        }
        return respond(200, user);
      }
      if (pathName === '/api/settings' && method === 'GET') {
        return respond(200, settingsStore.slice());
      }
      if (pathName === '/api/settings' && method === 'PUT') {
        const body = route.request().postDataJSON ? route.request().postDataJSON() : {};
        const items = body && Array.isArray(body.items) ? body.items : [];
        const saved = [];
        items.forEach((item) => {
          if (!item || !item.key) return;
          const key = String(item.key || '');
          let existing = settingsStore.find((row) => row && row.key === key);
          if (!existing) {
            existing = {
              id: settingsStore.length + saved.length + 1,
              key,
              scope: 'user',
              owner_id: user.id,
              updated_at: new Date().toISOString(),
            };
            settingsStore.push(existing);
          }
          existing.value_json = item.value_json;
          existing.updated_at = new Date().toISOString();
          saved.push({ ...existing });
        });
        return respond(200, saved);
      }
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
      return respond(200, []);
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/settings.html?_=' + Date.now().toString(36));
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.settingsReady === true, {}, { timeout: 20000 });

    await page.fill('#knowledgeBaseBaseUrlInput', 'http://192.168.50.10:8003/download/sk/');
    await page.click('#saveKnowledgeBaseBaseUrl');
    await expect(page.locator('#knowledgeBaseBaseUrlStatus')).toContainText('知识库地址已保存');

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.settingsReady === true, {}, { timeout: 20000 });
    await expect(page.locator('#knowledgeBaseBaseUrlInput')).toHaveValue('http://192.168.50.10:8003/download/sk');
  });
});
