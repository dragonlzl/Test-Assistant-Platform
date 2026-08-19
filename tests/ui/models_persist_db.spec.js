const { test, expect } = require('@playwright/test');

test.describe('跨设备模型/指派/设置持久化', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  // 使用 string 类型 id 模拟真实环境可能出现的类型差异，验证合并逻辑的鲁棒性。
  const user = { id: '3001', username: 'persist_user', role: 'admin', level: 'leader' };

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

  async function waitForAppReady(page) {
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
  }

  async function setupPage(context, apiHandler, options) {
    const opts = options || {};
    const page = await context.newPage();
    await page.addInitScript((init) => {
      try {
        ['cleaner-models-v1', 'cleaner-assignment-v1', 'usecase-settings-v1', 'tempexec-page-size'].forEach((key) => {
          window.localStorage.removeItem(key);
        });
        window.localStorage.setItem('tap-auth-token', 'persist-token');
        if (init && init.localSettings) {
          window.localStorage.setItem('usecase-settings-v1', JSON.stringify(init.localSettings));
        }
      } catch (err) {
        // ignore
      }
    }, { localSettings: opts.localSettings || null });
    await page.route('**/*', (route) => {
      const target = route.request().url();
      if (target.startsWith('http://localhost') || target.startsWith('http://127.0.0.1') || target.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.route('**/api/**', apiHandler);
    await page.goto(base + (opts.path || '/index.html'));
    await page.waitForLoadState('domcontentloaded');
    // 等待核心全局对象就绪即可，避免依赖 bootstrap/initApp 时序造成测试波动。
    await waitForAppReady(page);
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
      'xmindCaseGenModelSelect',
      'caseFilterModelSelect',
      'missingReminderModelSelect',
      'caseLibraryGenModelSelect',
    ];
    await Promise.all(selectIds.map((sel) => pageA.waitForSelector(`#${sel}`)));
    await expect(pageA.locator('#xmindCaseGenModelSelect')).toHaveValue(remoteModelId);
    await expect(pageA.locator('#caseLibraryGenModelSelect')).toHaveValue(remoteModelId);
    await pageA.fill('#xmindCaseGenTemperature', '0.6');
    await pageA.fill('#caseLibraryGenTemperature', '0.3');
    await pageA.locator('.assignment-feature-actions [data-save-assignments]').first().click();
    await expect(pageA.locator('#xmindCaseGenAssignStatus')).toContainText('当前 XMind 用例生成模型');
    await expect.poll(() => serverState.features.length).toBe(1);

    await pageA.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(pageA.locator('#feishuWebhook')).toHaveCount(0);
    const priorityCheckboxA = pageA.locator('input[data-temp-exec-col="priority"]');
    await priorityCheckboxA.uncheck();
    await pageA.fill('#tempExecPageSizeInput', '33');
    await pageA.click('#saveTempExecPageSize');
    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(33);
    await expect.poll(() => {
      const cols = serverState.settings.find((item) => item.key === 'tempExecColumns');
      return cols && cols.value_json ? cols.value_json.priority : null;
    }, { timeout: 10000 }).toBe(false);
    expect(serverState.features[0].config_json.xmindCaseGenId).toBe(remoteModelId);
    expect(serverState.features[0].config_json.xmindCaseGenTemperature).toBeCloseTo(0.6);
    expect(serverState.features[0].config_json.caseLibraryGenTemperature).toBeCloseTo(0.3);

    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await setupPage(contextB, apiHandler);
    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await expect(pageB.locator('#modelList')).toContainText('跨端模型A');
    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    await expect(pageB.locator('#xmindCaseGenModelSelect')).toHaveValue(remoteModelId);
    await expect(pageB.locator('#caseLibraryGenModelSelect')).toHaveValue(remoteModelId);
    await expect(pageB.locator('#xmindCaseGenTemperature')).toHaveValue(/0\.6/);
    await expect(pageB.locator('#caseLibraryGenTemperature')).toHaveValue(/0\.3/);
    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(pageB.locator('#tempExecPageSizeInput')).toHaveValue('33', { timeout: 20000 });
    await expect(pageB.locator('#feishuWebhook')).toHaveCount(0);
    const priorityCheckboxB = pageB.locator('input[data-temp-exec-col="priority"]');
    await expect(priorityCheckboxB).not.toBeChecked();

    await contextB.close();
  });

  test('旧设置可读取但不会展示或随保留设置重新写入', async ({ browser }) => {
    const serverState = {
      models: [],
      features: [],
      settings: [
        { id: 1, scope: 'user', owner_id: user.id, key: 'feishuWebhook', value_json: 'https://legacy.example/hook' },
        { id: 2, scope: 'user', owner_id: user.id, key: 'feishuMention', value_json: 'ou_legacy' },
        { id: 3, scope: 'user', owner_id: user.id, key: 'pageGuideSwitches', value_json: { auto: false } },
        { id: 4, scope: 'user', owner_id: user.id, key: 'tempExecPageSize', value_json: 28 },
      ],
    };
    const apiHandler = createApiHandler(serverState);
    const context = await browser.newContext();
    const page = await setupPage(context, apiHandler);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#feishuWebhook')).toHaveCount(0);
    await expect(page.locator('#pageGuideSelectAll')).toHaveCount(0);
    await expect(page.locator('#tempExecPageSizeInput')).toHaveValue('28', { timeout: 20000 });

    const deprecatedInState = await page.evaluate(() => {
      var settings = window.app && window.app.state ? window.app.state.settings : {};
      return ['feishuWebhook', 'feishuMention', 'pageGuideSwitches'].filter(function(key) {
        return settings && Object.prototype.hasOwnProperty.call(settings, key);
      });
    });
    expect(deprecatedInState).toEqual([]);

    await page.fill('#tempExecPageSizeInput', '36');
    await page.click('#saveTempExecPageSize');
    await expect.poll(() => serverState.lastSettingsPayload || null, { timeout: 10000 }).not.toBeNull();
    const savedKeys = (serverState.lastSettingsPayload.items || []).map((item) => item.key);
    expect(savedKeys).toEqual(['tempExecPageSize']);

    await context.close();
  });

  test('登录态忽略本地缓存并以最后保存为准（含未保存草稿回退）', async ({ browser }) => {
    const serverState = { models: [], features: [], settings: [] };
    const apiHandler = createApiHandler(serverState);

    const contextA = await browser.newContext();
    const pageA = await setupPage(contextA, apiHandler);
    await pageA.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await pageA.fill('#tempExecPageSizeInput', '31');
    await pageA.click('#saveTempExecPageSize');
    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(31);

    // B 带着本地旧缓存登录，但因有 token，应忽略本地并加载服务器 31。
    const contextB = await browser.newContext();
    const pageB = await setupPage(contextB, apiHandler, {
      localSettings: { tempExecPageSize: 22 },
    });
    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(pageB.locator('#tempExecPageSizeInput')).toHaveValue('31', { timeout: 20000 });

    // A 在未保存的情况下修改为 40，不应入库。
    await pageA.fill('#tempExecPageSizeInput', '40');

    // B 保存为 50，后端变为 50。
    await pageB.fill('#tempExecPageSizeInput', '50');
    await pageB.click('#saveTempExecPageSize');
    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(50);

    // A 刷新（草稿丢弃）后应看到 50。
    await pageA.reload();
    await pageA.waitForLoadState('domcontentloaded');
    await waitForAppReady(pageA);
    await pageA.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(pageA.locator('#tempExecPageSizeInput')).toHaveValue('50', { timeout: 20000 });

    await contextA.close();
    await contextB.close();
  });

  test('保存单项设置不会覆盖其他设置（避免跨设备互相回退）', async ({ browser }) => {
    const serverState = { models: [], features: [], settings: [] };
    const apiHandler = createApiHandler(serverState);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await setupPage(contextA, apiHandler);
    const pageB = await setupPage(contextB, apiHandler);

    await pageA.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await pageA.fill('#tempExecPageSizeInput', '31');
    await pageA.click('#saveTempExecPageSize');
    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(31);

    // 模拟 B 本地页容量仍是旧值，但只保存“列显示”，不应把页容量覆盖回去。
    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await pageB.fill('#tempExecPageSizeInput', '20');
    const priorityCheckboxB = pageB.locator('input[data-temp-exec-col="priority"]');
    await priorityCheckboxB.uncheck();

    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(31);
    await expect.poll(() => {
      const cols = serverState.settings.find((item) => item.key === 'tempExecColumns');
      return cols && cols.value_json ? cols.value_json.priority : null;
    }, { timeout: 10000 }).toBe(false);

    await contextA.close();
    await contextB.close();
  });

  test('已登录会话在重新获得焦点时刷新远端设置', async ({ browser }) => {
    const serverState = { models: [], features: [], settings: [] };
    const apiHandler = createApiHandler(serverState);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await setupPage(contextA, apiHandler);
    const pageB = await setupPage(contextB, apiHandler);

    await pageA.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await pageA.fill('#tempExecPageSizeInput', '31');
    await pageA.click('#saveTempExecPageSize');
    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(31);

    await pageB.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await pageB.fill('#tempExecPageSizeInput', '55');
    await pageB.click('#saveTempExecPageSize');
    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(55);

    // 模拟电脑 A 回到页面获得焦点后自动拉取远端最新设置
    await pageA.waitForTimeout(1600);
    await pageA.evaluate(() => {
      try {
        window.dispatchEvent(new Event('focus'));
      } catch (err) {
        // ignore
      }
    });
    await expect(pageA.locator('#tempExecPageSizeInput')).toHaveValue('55', { timeout: 20000 });

    await contextA.close();
    await contextB.close();
  });

  test('执行页导入配置触发分页设置落库并跨会话恢复', async ({ browser }) => {
    const serverState = { models: [], features: [], settings: [] };
    const apiHandler = createApiHandler(serverState);

    const contextA = await browser.newContext();
    const pageA = await setupPage(contextA, apiHandler, { path: '/case-exec.html?tab=tempexec' });
    pageA.on('dialog', (dialog) => dialog.accept());
    await pageA.waitForSelector('#importTempExecConfigFile', { state: 'attached' });

    const snapshot = {
      type: 'tempexec_snapshot_v1',
      requirement: 'demo',
      files: [{ id: 'file-1', name: 'demo-file', cases: [{}] }],
      versions: [],
      focus: [],
      pageSize: 44,
      columns: {},
    };
    await pageA.setInputFiles('#importTempExecConfigFile', {
      name: 'tempexec_snapshot.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot)),
    });
    await pageA.evaluate(() => {
      var input = document.getElementById('importTempExecConfigFile');
      if (input) {
        try {
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) {
          // ignore
        }
      }
    });

    await expect.poll(() => serverState.settingsCalls || 0, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => {
      const pageSize = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return pageSize ? Number(pageSize.value_json) : null;
    }, { timeout: 10000 }).toBe(44);

    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await setupPage(contextB, apiHandler, { path: '/settings.html?tab=settings' });
    await expect(pageB.locator('#tempExecPageSizeInput')).toHaveValue('44', { timeout: 20000 });

    await contextB.close();
  });
});
