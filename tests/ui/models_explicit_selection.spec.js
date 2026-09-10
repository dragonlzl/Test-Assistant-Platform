const { test, expect } = require('@playwright/test');

test('具体模型保留声明能力，GPT-5.6 默认支持图片且不会把站点能力复制给其它模型', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.route('**/api/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.goto(base + '/login.html');
  await page.addScriptTag({ path: require('path').resolve(__dirname, '../../scripts/modules/models.js') });
  const result = await page.evaluate(() => {
    localStorage.setItem('cleaner-models-v1', JSON.stringify([
      {
        id: 'legacy', model: 'custom-vision', capabilities: ['vision', 'chat'],
        availableModels: [
          { id: 'custom-vision' },
          { id: 'text-only' },
          { id: 'gpt-5.6-sol' },
          { id: 'gpt-5.6-terra', capabilities: ['chat'] },
          { id: 'custom-explicit', capabilities: ['vision', 'reasoning'] },
          { id: 'gpt-5.4', capabilities: [] },
        ],
      },
    ]));
    const state = { models: [], assignments: {} };
    const api = window.app.models.init({
      state,
      config: { modelsKey: 'cleaner-models-v1', assignmentKey: 'test-assignment', defaultPrompts: {}, providerDefaults: {} },
      setStatus: function() {},
      dom: {},
    });
    return {
      models: ['custom-vision', 'text-only', 'gpt-5.6-sol', 'gpt-5.6-terra', 'custom-explicit', 'gpt-5.4']
        .map(id => ({ id, capabilities: api.resolveSiteModel('legacy', id).capabilities })),
      savedCapabilities: state.models[0].availableModels[4].capabilities,
    };
  });
  expect(result.models).toEqual([
    { id: 'custom-vision', capabilities: ['vision', 'chat'] },
    { id: 'text-only', capabilities: ['chat'] },
    { id: 'gpt-5.6-sol', capabilities: ['chat', 'vision', 'reasoning'] },
    { id: 'gpt-5.6-terra', capabilities: ['chat'] },
    { id: 'custom-explicit', capabilities: ['vision', 'reasoning'] },
    { id: 'gpt-5.4', capabilities: [] },
  ]);
  expect(result.savedCapabilities).toEqual(['vision', 'reasoning']);
});

test('模型管理不提供运行时默认模型，功能指派必须选择具体模型', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const user = { id: 7001, username: 'explicit_model_user', role: 'admin', level: 'leader' };
  const model = {
    id: 701,
    owner_id: user.id,
    name: '模型站点',
    config_json: {
      provider: 'custom',
      baseUrl: 'https://example.com/v1/responses',
      apiKey: 'sk-test',
      model: 'gpt-5.5',
      availableModels: [
        { id: 'gpt-5.5', name: 'GPT-5.5' },
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
      ],
    },
  };

  await page.addInitScript(() => {
    window.localStorage.setItem('tap-auth-token', 'explicit-model-token');
    window.localStorage.removeItem('cleaner-models-v1');
    window.localStorage.removeItem('cleaner-assignment-v1');
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const respond = (status, body) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (url.pathname === '/api/users/me') return respond(200, user);
    if (url.pathname === '/api/models' && method === 'GET') return respond(200, [model]);
    if (url.pathname === '/api/features' && method === 'GET') {
      return respond(200, [{
        id: 702,
        owner_id: user.id,
        name: 'default',
        config_json: {
          xmindCaseGenId: '701',
          xmindCaseGenModelId: '',
        },
      }]);
    }
    if (url.pathname === '/api/settings' && method === 'GET') return respond(200, []);
    if (url.pathname === '/api/projects' && method === 'GET') return respond(200, []);
    if (url.pathname === '/api/ops' && method === 'GET') return respond(200, []);
    return respond(200, {});
  });

  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await page.evaluate(() => {
    document.querySelectorAll('.tab-group .tab-submenu').forEach((menu) => menu.classList.remove('hidden'));
    document.querySelectorAll('.tab-group').forEach((group) => group.classList.add('open'));
    document.querySelectorAll('.tab-group .tab-group-btn').forEach((button) => button.classList.add('open'));
    document.querySelectorAll('[data-tab-btn]').forEach((button) => {
      button.classList.remove('hidden');
      button.classList.remove('role-hidden');
    });
    window.app.switchTab('assign');
  });

  await page.waitForURL(/ai-tools\.html/);
  await page.waitForFunction(() => window.app && window.app.core
    && typeof window.app.core.getAssignedModel === 'function');
  await expect(page.locator('#xmindCaseGenModelSelect')).toHaveValue('');
  const beforeSelection = await page.evaluate(() => {
    const api = window.app && window.app.core;
    const modelApi = api && typeof api.resolveSiteModel === 'function' ? api : null;
    let assignedError = '';
    try {
      api.getAssignedModel('xmindcasegen');
    } catch (error) {
      assignedError = error && error.message ? error.message : String(error);
    }
    const unresolved = modelApi ? modelApi.resolveSiteModel('701', '') : null;
    return {
      resolvedWithoutModel: unresolved,
      assignedError,
    };
  });
  expect(beforeSelection.resolvedWithoutModel).toBeNull();
  expect(beforeSelection.assignedError).toContain('未找到');

  await page.selectOption('#xmindCaseGenModelSelect', 'gpt-5.6-sol');
  await expect.poll(() => page.evaluate(() => {
    const api = window.app && window.app.core;
    return api && typeof api.getAssignedModel === 'function'
      ? api.getAssignedModel('xmindcasegen').model
      : '';
  })).toBe('gpt-5.6-sol');
});
