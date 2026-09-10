const { test, expect } = require('@playwright/test');

test('全局指派后修改 XMind 指派最终使用功能级模型', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const user = { id: 3001, username: 'assignment_user', role: 'admin', level: 'leader' };
  const models = [
    {
      id: 101,
      owner_id: user.id,
      name: '模型站点 A',
      config_json: {
        baseUrl: 'https://example.com/a',
        apiKey: 'sk-a',
        model: 'model-a',
        availableModels: [{ id: 'model-a', name: '模型 A' }],
      },
    },
    {
      id: 102,
      owner_id: user.id,
      name: '模型站点 B',
      config_json: {
        baseUrl: 'https://example.com/b',
        apiKey: 'sk-b',
        model: 'model-b',
        availableModels: [{ id: 'model-b', name: '模型 B' }],
      },
    },
  ];
  let feature = null;
  let featureRecords = null;
  let featureSeq = 1;
  let createInFlight = false;

  function respond(route, status, body) {
    return route.fulfill({
      status: status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  }

  function delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  await page.addInitScript(function() {
    window.localStorage.setItem('tap-auth-token', 'assignment-test-token');
    window.localStorage.removeItem('cleaner-models-v1');
    window.localStorage.removeItem('cleaner-assignment-v1');
    window.localStorage.removeItem('usecase-settings-v1');
  });
  await page.route('**/*', function(route) {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.route('**/api/**', async function(route) {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path === '/api/users/me') return respond(route, 200, user);
    if (path === '/api/models' && method === 'GET') return respond(route, 200, models);
    if (path === '/api/features' && method === 'GET') {
      return respond(route, 200, featureRecords || (feature ? [feature] : []));
    }
    if (path === '/api/features' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      if (createInFlight || feature) return respond(route, 400, { detail: '功能指派名称已存在' });
      createInFlight = true;
      await delay(150);
      createInFlight = false;
      feature = {
        id: featureSeq++,
        owner_id: user.id,
        name: body.name || 'default',
        config_json: body.config_json || {},
      };
      return respond(route, 201, feature);
    }
    if (path === '/api/features/1' && method === 'PATCH') {
      const body = route.request().postDataJSON() || {};
      if (!feature) return respond(route, 404, { detail: '功能指派不存在' });
      feature.config_json = body.config_json || {};
      return respond(route, 200, feature);
    }
    if (path === '/api/settings' && method === 'GET') return respond(route, 200, []);
    if (path === '/api/settings' && method === 'PUT') return respond(route, 200, []);
    if (path === '/api/projects' && method === 'GET') return respond(route, 200, []);
    if (path === '/api/ops' && method === 'GET') return respond(route, 200, []);
    return respond(route, 200, {});
  });

  await page.goto(base + '/index.html');
  await page.waitForFunction(function() { return window.app && window.app._inited === true; });
  await page.evaluate(function() {
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
    window.app.switchTab('assign');
  });

  await expect(page.locator('#globalAssignModelSelect')).toHaveValue('');
  await page.selectOption('#globalAssignModelSelect', 'model-a');
  await page.click('#applyGlobalAssignBtn');
  await page.selectOption('#xmindCaseGenModelSelect', 'model-b');

  await expect.poll(function() {
    return feature && feature.config_json ? feature.config_json.xmindCaseGenModelId : '';
  }, { timeout: 10000 }).toBe('model-b');
  await expect.poll(async function() {
    return page.evaluate(function() {
      var api = window.app && window.app.core;
      var assigned = window.app && window.app.state && window.app.state.assignments;
      var model = null;
      try {
        model = api && typeof api.getAssignedModel === 'function'
          ? api.getAssignedModel('xmindcasegen')
          : null;
      } catch (err) {
        model = null;
      }
      return {
        assignedModelId: assigned && assigned.xmindCaseGenModelId,
        resolvedModel: model && model.model,
      };
    });
  }, { timeout: 10000 }).toEqual({ assignedModelId: 'model-b', resolvedModel: 'model-b' });

  featureRecords = [
    {
      id: 1,
      owner_id: user.id,
      name: 'default',
      updated_at: '2026-09-02T03:00:00.000Z',
      config_json: Object.assign({}, feature.config_json, {
        xmindCaseGenId: '101',
        xmindCaseGenModelId: 'model-a',
      }),
    },
    {
      id: 2,
      owner_id: user.id,
      name: 'default',
      updated_at: '2026-09-02T04:00:00.000Z',
      config_json: feature.config_json,
    },
  ];
  await page.reload();
  await page.waitForFunction(function() { return window.app && window.app._inited === true; });
  await page.evaluate(function() {
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
    window.app.switchTab('assign');
  });
  await expect(page.locator('#xmindCaseGenModelSelect')).toHaveValue('model-b');

  await page.evaluate(function() {
    var state = window.app && window.app.state;
    var client = window.app && window.app.apiClient;
    if (!state || !client) return;
    state.models.push({
      id: '103',
      remoteId: 103,
      name: '模型站点 C',
      provider: 'custom',
      baseUrl: 'https://example.com/c',
      apiKey: 'sk-c',
      model: 'model-b',
      availableModels: [{ id: 'model-b', name: '模型 B（C）' }],
    });
    var select = document.getElementById('xmindCaseGenModelSelect');
    var option = document.createElement('option');
    option.value = 'model-b';
    option.setAttribute('data-site-id', '103');
    option.textContent = '模型站点 C · model-b';
    select.appendChild(option);
    option.selected = true;
    window.__assignmentTestPayload = null;
    client.proxyModelRequest = function(payload) {
      window.__assignmentTestPayload = payload;
      return Promise.resolve({
        ok: true,
        status: 200,
        text: function() {
          return Promise.resolve(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
        },
      });
    };
  });
  await page.click('#testXmindCaseGenModel');
  await expect.poll(function() {
    return page.evaluate(function() {
      return window.__assignmentTestPayload && window.__assignmentTestPayload.api_key;
    });
  }).toBe('sk-c');
});
