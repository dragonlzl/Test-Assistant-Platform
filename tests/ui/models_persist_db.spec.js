const { test, expect } = require('@playwright/test');

test.describe('跨设备模型/指派/设置持久化', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const user = { id: 3001, username: 'persist_user', role: 'admin', level: 'leader' };

  function createApiHandler(serverState) {
    let modelSeq = 1;
    let featureSeq = 1;
    let settingSeq = 1;
    return async function(route) {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
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
        serverState.settingsCalls = (serverState.settingsCalls || 0) + 1;
        serverState.lastSettingsPayload = body;
        return respond(200, saved);
      }
      if (path === '/api/models' && method === 'GET') return respond(200, serverState.models);
      if (path === '/api/models' && method === 'POST') {
        const body = route.request().postDataJSON() || {};
        const now = new Date().toISOString();
        const item = {
          id: modelSeq++,
          owner_id: user.id,
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
        if (model) {
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
          owner_id: user.id,
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
        if (feature) {
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
  }

  async function setupPage(context, apiHandler) {
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        ['cleaner-models-v1', 'cleaner-assignment-v1', 'usecase-settings-v1', 'tempexec-page-size'].forEach((key) => {
          window.localStorage.removeItem(key);
        });
        window.localStorage.setItem('tap-auth-token', 'persist-token');
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
    await page.waitForSelector('#currentUsername', { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app._inited === true);
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

  test('保存后端数据后新会话自动加载', async ({ browser }) => {
    const serverState = { models: [], features: [], settings: [] };
    const apiHandler = createApiHandler(serverState);

    const contextA = await browser.newContext();
    const pageA = await setupPage(contextA, apiHandler);

    await pageA.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await pageA.waitForSelector('#createModelBtn', { state: 'visible' });
    await pageA.locator('#createModelBtn').scrollIntoViewIfNeeded();
    await pageA.click('#createModelBtn');
    await pageA.fill('#modelDisplayName', '跨端模型A');
    await pageA.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await pageA.fill('#modelApiKey', 'sk-test-a');
    await pageA.fill('#modelIdentifier', 'deepseek-test-a');
    await pageA.fill('#modelMaxTokens', '2048');
    await pageA.click('#saveModelBtn');
    await expect(pageA.locator('#modelList')).toContainText('跨端模型A');
    await expect.poll(() => serverState.models.length).toBeGreaterThan(0);
    const remoteModelId = String(serverState.models[0].id);

    await pageA.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    const selectIds = [
      'cleanModelSelect',
      'reviewModelSelect',
      'compareModelSelect',
      'splitModelSelect',
      'casesModelSelect',
      'caseGenModelSelect',
      'caseFilterModelSelect',
    ];
    await Promise.all(selectIds.map((sel) => pageA.waitForSelector(`#${sel}`)));
    await expect(pageA.locator('#cleanModelSelect')).toHaveValue(remoteModelId);
    await expect(pageA.locator('#compareModelSelect')).toHaveValue(remoteModelId);
    await pageA.fill('#cleanTemperature', '0.6');
    await pageA.fill('#compareTemperature', '0.3');
    await pageA.click('#saveAssignments');
    await expect(pageA.locator('#cleanAssignStatus')).toContainText('当前清洗模型');
    await expect.poll(() => serverState.features.length).toBe(1);

    await pageA.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await pageA.evaluate(() => {
      try {
        if (window.app && window.app.state && window.app.state.settings) {
          window.app.state.settings.otherSettingsDemo = { enabled: true };
        }
      } catch (err) {
        // ignore
      }
    });
    const priorityCheckboxA = pageA.locator('input[data-temp-exec-col="priority"]');
    await priorityCheckboxA.uncheck();
    await pageA.click('#saveTempExecColumns');
    await pageA.fill('#tempExecPageSizeInput', '33');
    await pageA.click('#saveTempExecPageSize');
    await expect.poll(() => serverState.settingsCalls || 0, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
    const lastPayload = serverState.lastSettingsPayload || {};
    const lastPageSizeItem = (lastPayload.items || []).find((item) => item.key === 'tempExecPageSize');
    expect(lastPageSizeItem && Number(lastPageSizeItem.value_json)).toBe(33);
    const lastOtherItem = (lastPayload.items || []).find((item) => item.key === 'otherSettingsDemo');
    expect(lastOtherItem && lastOtherItem.value_json && lastOtherItem.value_json.enabled).toBe(true);
    const pageSizeSetting = serverState.settings.find((item) => item.key === 'tempExecPageSize');
    if (pageSizeSetting && lastPageSizeItem) {
      pageSizeSetting.value_json = Number(lastPageSizeItem.value_json);
    }
    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(33);
    await expect.poll(() => {
      const cols = serverState.settings.find((item) => item.key === 'tempExecColumns');
      return cols && cols.value_json ? cols.value_json.priority : null;
    }, { timeout: 10000 }).toBe(false);
    expect(serverState.features[0].config_json.cleanId).toBe(remoteModelId);
    expect(serverState.features[0].config_json.cleanTemperature).toBeCloseTo(0.6);
    expect(serverState.features[0].config_json.compareTemperature).toBeCloseTo(0.3);

    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await setupPage(contextB, apiHandler);
    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await expect(pageB.locator('#modelList')).toContainText('跨端模型A');
    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    await expect(pageB.locator('#cleanModelSelect')).toHaveValue(remoteModelId);
    await expect(pageB.locator('#compareModelSelect')).toHaveValue(remoteModelId);
    await expect(pageB.locator('#cleanTemperature')).toHaveValue(/0\.6/);
    await expect(pageB.locator('#compareTemperature')).toHaveValue(/0\.3/);
    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(pageB.locator('#tempExecPageSizeInput')).toHaveValue('33', { timeout: 20000 });
    const priorityCheckboxB = pageB.locator('input[data-temp-exec-col="priority"]');
    await expect(priorityCheckboxB).not.toBeChecked();
    const otherValue = await pageB.evaluate(() => {
      try {
        return window.app && window.app.state && window.app.state.settings
          ? window.app.state.settings.otherSettingsDemo
          : null;
      } catch (err) {
        return null;
      }
    });
    expect(otherValue && otherValue.enabled).toBe(true);

    await contextB.close();
  });
});
