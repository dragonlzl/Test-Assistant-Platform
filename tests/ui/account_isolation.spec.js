const { test, expect } = require('@playwright/test');

test.describe('账号配置隔离', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

  test('不同账号的模型与其他设置不共享', async ({ browser }) => {
    const userA = { id: 4001, username: 'user_a', role: 'admin', level: 'leader' };
    const userB = { id: 4002, username: 'user_b', role: 'admin', level: 'leader' };
    const serverState = { models: [], features: [], settings: [] };
    let currentUser = userA;
    let modelSeq = 1;
    let featureSeq = 1;
    let settingSeq = 1;

    const apiHandler = async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, currentUser);

      if (path === '/api/settings' && method === 'GET') {
        const ownerParam = url.searchParams.get('owner_id');
        const effectiveOwner = ownerParam !== null ? Number(ownerParam) : currentUser.id;
        const list = serverState.settings.filter((row) => {
          if (!row) return false;
          if (row.scope === 'global') return true;
          return row.scope === 'user' && row.owner_id === effectiveOwner;
        });
        return respond(200, list);
      }
      if (path === '/api/settings' && method === 'PUT') {
        const body = route.request().postDataJSON() || {};
        const scope = body.scope || 'user';
        const items = Array.isArray(body.items) ? body.items : [];
        const now = new Date().toISOString();
        const saved = [];
        items.forEach((item) => {
          if (!item || !item.key) return;
          const ownerId = scope === 'global' ? null : currentUser.id;
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
        serverState.settingsCalls = (serverState.settingsCalls || 0) + 1;
        serverState.lastSettingsPayload = body;
        return respond(200, saved);
      }

      if (path === '/api/models' && method === 'GET') {
        const ownerParam = url.searchParams.get('owner_id');
        const effectiveOwner = ownerParam !== null ? Number(ownerParam) : currentUser.id;
        const list = serverState.models.filter((row) => row.owner_id === effectiveOwner);
        return respond(200, list);
      }
      if (path === '/api/models' && method === 'POST') {
        const body = route.request().postDataJSON() || {};
        const now = new Date().toISOString();
        const item = {
          id: modelSeq++,
          owner_id: currentUser.id,
          name: body.name || 'model',
          config_json: body.config_json || {},
          is_active: body.is_active !== false,
          created_at: now,
          updated_at: now,
        };
        serverState.models.push(item);
        return respond(201, item);
      }
      if (path.match(/^\/api\/models\/\d+/) && method === 'PATCH') {
        const id = parseInt(path.split('/').pop(), 10);
        const body = route.request().postDataJSON() || {};
        const model = serverState.models.find((m) => m.id === id);
        if (model && model.owner_id === currentUser.id) {
          if (body.name) model.name = body.name;
          if (body.config_json !== undefined) model.config_json = body.config_json;
          if (body.is_active !== undefined) model.is_active = body.is_active;
          model.updated_at = new Date().toISOString();
          return respond(200, model);
        }
        return respond(404, { detail: 'not found' });
      }

      if (path === '/api/features' && method === 'GET') return respond(200, serverState.features);
      if (path === '/api/features' && method === 'POST') {
        const body = route.request().postDataJSON() || {};
        const now = new Date().toISOString();
        const item = {
          id: featureSeq++,
          owner_id: currentUser.id,
          name: body.name || 'feature',
          config_json: body.config_json || {},
          created_at: now,
          updated_at: now,
        };
        serverState.features.push(item);
        return respond(201, item);
      }
      if (path.match(/^\/api\/features\/\d+/) && method === 'PATCH') {
        const id = parseInt(path.split('/').pop(), 10);
        const body = route.request().postDataJSON() || {};
        const feature = serverState.features.find((f) => f.id === id);
        if (feature && feature.owner_id === currentUser.id) {
          if (body.name) feature.name = body.name;
          if (body.config_json !== undefined) feature.config_json = body.config_json;
          feature.updated_at = new Date().toISOString();
          return respond(200, feature);
        }
        return respond(404, { detail: 'not found' });
      }

      if (path === '/api/projects' && method === 'GET') return respond(200, []);
      if (path === '/api/ops') return respond(200, []);
      if (path === '/api/auth/logout') return respond(200, {});
      return respond(200, {});
    };

    async function openPage(context) {
      const page = await context.newPage();
      await page.addInitScript(() => {
        try {
          localStorage.setItem('tap-auth-token', 'isolation-token');
          const originalReplace = window.location.replace.bind(window.location);
          window.location.replace = function(url) {
            if (url && url.indexOf('login.html') !== -1) return;
            return originalReplace(url);
          };
        } catch (err) {
          // ignore
        }
      });
      await page.route('**/*', (route) => {
        const target = route.request().url();
        if (target.startsWith('http://localhost') || target.startsWith('http://127.0.0.1') || target.startsWith('file:')) {
          return route.continue();
        }
        return route.abort();
      });
      await page.route('**/api/**', apiHandler);
      await page.goto(base + '/index.html');
      await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
      await page.evaluate(() => {
        document.querySelectorAll('.tab-group .tab-submenu').forEach(function(menu) {
          menu.classList.remove('hidden');
        });
        document.querySelectorAll('.tab-group').forEach(function(group) {
          group.classList.add('open');
        });
        document.querySelectorAll('.tab-group .tab-group-btn').forEach(function(btn) {
          btn.classList.add('open');
        });
        document.querySelectorAll('[data-tab-btn]').forEach(function(btn) {
          btn.classList.remove('hidden');
          btn.classList.remove('role-hidden');
        });
      });
      return page;
    }

    const context = await browser.newContext();
    const page = await openPage(context);

    // 账号 A 配置模型与分页
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await page.waitForSelector('#createModelBtn', { state: 'visible' });
    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', 'A-model');
    await page.fill('#modelBaseUrl', 'https://example.com/a');
    await page.fill('#modelApiKey', 'sk-a');
    await page.fill('#modelIdentifier', 'model-a');
    await page.fill('#modelMaxTokens', '1024');
    await page.click('#saveModelBtn');
    await expect(page.locator('#modelList')).toContainText('A-model');
    await expect.poll(() => serverState.models.length).toBe(1);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await page.fill('#tempExecPageSizeInput', '31');
    await page.click('#saveTempExecPageSize');
    await expect.poll(() => serverState.settingsCalls || 0).toBeGreaterThan(0);

    // 切换到账号 B，页面刷新后不应看到 A 的配置
    currentUser = userB;
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
    await page.evaluate(() => {
      document.querySelectorAll('.tab-group .tab-submenu').forEach(function(menu) {
        menu.classList.remove('hidden');
      });
      document.querySelectorAll('.tab-group').forEach(function(group) {
        group.classList.add('open');
      });
      document.querySelectorAll('.tab-group .tab-group-btn').forEach(function(btn) {
        btn.classList.add('open');
      });
      document.querySelectorAll('[data-tab-btn]').forEach(function(btn) {
        btn.classList.remove('hidden');
        btn.classList.remove('role-hidden');
      });
    });

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await expect(page.locator('#modelList')).not.toContainText('A-model');
    await expect(page.locator('#modelList')).toContainText('尚未配置模型');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#tempExecPageSizeInput')).toHaveValue('20');

    // 账号 B 自己配置，再切回账号 A 应只恢复 A 的配置
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', 'B-model');
    await page.fill('#modelBaseUrl', 'https://example.com/b');
    await page.fill('#modelApiKey', 'sk-b');
    await page.fill('#modelIdentifier', 'model-b');
    await page.fill('#modelMaxTokens', '1024');
    await page.click('#saveModelBtn');
    await expect(page.locator('#modelList')).toContainText('B-model');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await page.fill('#tempExecPageSizeInput', '22');
    await page.click('#saveTempExecPageSize');

    currentUser = userA;
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
    await page.evaluate(() => {
      document.querySelectorAll('.tab-group .tab-submenu').forEach(function(menu) {
        menu.classList.remove('hidden');
      });
      document.querySelectorAll('.tab-group').forEach(function(group) {
        group.classList.add('open');
      });
      document.querySelectorAll('.tab-group .tab-group-btn').forEach(function(btn) {
        btn.classList.add('open');
      });
      document.querySelectorAll('[data-tab-btn]').forEach(function(btn) {
        btn.classList.remove('hidden');
        btn.classList.remove('role-hidden');
      });
    });

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await expect(page.locator('#modelList')).toContainText('A-model');
    await expect(page.locator('#modelList')).not.toContainText('B-model');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#tempExecPageSizeInput')).toHaveValue('31');

    await context.close();
  });
});

