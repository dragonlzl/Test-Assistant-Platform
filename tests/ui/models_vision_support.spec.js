const { test, expect } = require('@playwright/test');

async function openVisionSettings(page) {
  const user = { id: 7701, username: 'vision_settings_user', role: 'admin', level: 'leader' };
  let model = {
    id: 771, owner_id: user.id, name: '视觉设置测试站点',
    config_json: {
      provider: 'custom', baseUrl: 'https://vision-test.invalid/v1', apiKey: 'test-only',
      availableModels: [
        { id: 'opaque-model', capabilities: ['chat', 'reasoning'] },
        { id: 'gpt-5.6-sol' },
        { id: 'declared-vision', capabilities: ['vision', 'chat'] },
      ],
    },
  };
  const saves = [];
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('vision-settings-init')) {
      localStorage.clear();
      sessionStorage.setItem('vision-settings-init', '1');
    }
    localStorage.setItem('tap-auth-token', 'vision-settings-test-token');
  });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    return route.abort();
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/users/me') return respond(user);
    if (url.pathname === '/api/models' && request.method() === 'GET') return respond([model]);
    if (url.pathname === '/api/models/771' && request.method() === 'PATCH') {
      const payload = request.postDataJSON();
      saves.push(payload);
      model = Object.assign({}, model, payload);
      return respond(model);
    }
    if (url.pathname === '/api/model-proxy/models') return respond({ data: [
      { id: 'OPAQUE-MODEL', capabilities: ['chat', 'reasoning', 'vision'] },
      { id: 'gpt-5.6-sol' },
      { id: 'declared-vision', capabilities: [] },
      { id: 'new-model', capabilities: ['chat'] },
    ] });
    if (url.pathname === '/api/features' || url.pathname === '/api/settings'
      || url.pathname === '/api/projects' || url.pathname === '/api/ops') return respond([]);
    return respond({});
  });
  await page.goto('/ai-tools.html?tab=models');
  await page.waitForFunction(() => window.app && window.app._inited === true
    && window.app.core && typeof window.app.core.getAssignedModel === 'function');
  await expect(page.locator('#modelList')).toContainText('视觉设置测试站点');
  await page.locator('#modelList [data-edit]').click();
  return { saves };
}

async function resolveCapabilities(page) {
  return page.evaluate(() => {
    const core = window.app.core;
    const assignments = core.state.assignments;
    const previousSite = assignments.xmindCaseGenId;
    const previousModel = assignments.xmindCaseGenModelId;
    try {
      assignments.xmindCaseGenId = '771';
      return ['opaque-model', 'gpt-5.6-sol', 'declared-vision'].map(id => {
        assignments.xmindCaseGenModelId = id;
        const model = core.getAssignedModel('xmindcasegen');
        return { id, visionSupport: model.visionSupport, capabilities: model.capabilities };
      });
    } finally {
      assignments.xmindCaseGenId = previousSite;
      assignments.xmindCaseGenModelId = previousModel;
    }
  });
}

test('每个具体模型可选择视觉支持并保存到远端和本地，刷新后仍生效且保留原能力', async ({ page }) => {
  const fixture = await openVisionSettings(page);
  const select = index => page.locator('[data-model-vision-support="' + index + '"]');
  await expect(select(0)).toHaveValue('auto');
  await expect(select(1)).toHaveValue('auto');
  await expect(page.locator('.model-available-item').nth(0)).toContainText('未识别为支持（供应商/已有配置）');
  await expect(page.locator('.model-available-item').nth(1)).toContainText('支持（名称推断）');
  await select(0).selectOption('supported');
  await select(1).selectOption('unsupported');
  await page.click('#saveModelBtn');
  await expect(page.locator('#modelFormStatus')).toContainText('模型已更新');
  expect(fixture.saves).toHaveLength(1);
  const saved = fixture.saves[0].config_json.availableModels;
  expect(saved.map(item => item.visionSupport)).toEqual(['supported', 'unsupported', 'auto']);
  expect(saved[0].capabilities).toEqual(['chat', 'reasoning']);
  expect(saved[2].capabilities).toEqual(['vision', 'chat']);
  expect(await resolveCapabilities(page)).toEqual([
    { id: 'opaque-model', visionSupport: 'supported', capabilities: ['chat', 'reasoning', 'vision'] },
    { id: 'gpt-5.6-sol', visionSupport: 'unsupported', capabilities: ['chat', 'reasoning'] },
    { id: 'declared-vision', visionSupport: 'auto', capabilities: ['vision', 'chat'] },
  ]);
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('cleaner-models-v1'))[0].availableModels);
  expect(local.map(item => item.visionSupport)).toEqual(['supported', 'unsupported', 'auto']);
  await page.reload();
  await expect(page.locator('#modelList')).toContainText('视觉设置测试站点');
  await page.locator('#modelList [data-edit]').click();
  await expect(select(0)).toHaveValue('supported');
  await expect(select(1)).toHaveValue('unsupported');
  await select(0).selectOption('auto');
  await page.click('#saveModelBtn');
  await expect(page.locator('#modelFormStatus')).toContainText('模型已更新');
  expect((await resolveCapabilities(page))[0]).toEqual({
    id: 'opaque-model', visionSupport: 'auto', capabilities: ['chat', 'reasoning'],
  });
});

test('重新获取供应商模型列表保留各模型的视觉选择并更新自动识别数据', async ({ page }) => {
  const fixture = await openVisionSettings(page);
  await page.locator('[data-model-vision-support="0"]').selectOption('supported');
  await page.locator('[data-model-vision-support="1"]').selectOption('unsupported');
  await page.click('#fetchModelListBtn');
  await expect(page.locator('#modelListFetchStatus')).toContainText('已获取 4 个模型');
  await expect(page.locator('[data-model-vision-support="0"]')).toHaveValue('supported');
  await expect(page.locator('[data-model-vision-support="1"]')).toHaveValue('unsupported');
  await expect(page.locator('[data-model-vision-support="2"]')).toHaveValue('auto');
  await expect(page.locator('[data-model-vision-support="3"]')).toHaveValue('auto');
  await expect(page.locator('.model-available-item').nth(2)).toContainText('未识别为支持（供应商/已有配置）');
  await page.click('#saveModelBtn');
  await expect(page.locator('#modelFormStatus')).toContainText('模型已更新');
  const saved = fixture.saves[0].config_json.availableModels;
  expect(saved[0]).toMatchObject({ id: 'OPAQUE-MODEL', visionSupport: 'supported', capabilities: ['chat', 'reasoning', 'vision'] });
  expect(saved[2]).toMatchObject({ id: 'declared-vision', visionSupport: 'auto', capabilities: [] });
  expect((await resolveCapabilities(page))[2].capabilities).toEqual([]);
});
