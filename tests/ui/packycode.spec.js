const { test, expect } = require('@playwright/test');
const path = require('path');

test('Packycode 文本、多图请求通过代理保留协议，代理错误不回退直连', async ({ page }) => {
  await page.addScriptTag({ path: path.resolve(__dirname, '../../services/modelClient.js') });
  const result = await page.evaluate(async () => {
    const calls = [];
    let directCalls = 0;
    let failure = false;
    const client = window.app.services.modelClient.createModelClient({
      proxyModelRequest: async function(body) {
        calls.push(body);
        if (failure) throw new Error('Failed to fetch');
        return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'completed', output_text: '{"modules":[]}', usage: { total_tokens: 23 } }) };
      },
      fetchImpl: async function() { directCalls += 1; throw new Error('不得直连'); },
    });
    const model = { provider: 'packycode', baseUrl: 'https://cf.api.fan/v1/chat/completions', model: 'gpt-6-astra', apiKey: 'test-only', stream: false };
    const text = await client.callModelWithConfig(model, '需求', '规则', 'low', 0.2, { transport: 'proxy' });
    await client.callModelWithContent(model, [
      { type: 'text', text: '双图评审' },
      { type: 'image', dataUrl: 'data:image/png;base64,a' },
      { type: 'image', dataUrl: 'data:image/png;base64,b' },
    ], '', { transport: 'proxy' });
    failure = true;
    let error = '';
    try { await client.callModelWithConfig(model, '需求', '规则', '', 0.2, { transport: 'proxy' }); }
    catch (err) { error = err.message; }
    return { calls, text, directCalls, error };
  });
  expect(result.text).toBe('{"modules":[]}');
  expect(result.calls).toHaveLength(3);
  expect(result.directCalls).toBe(0);
  expect(result.error).toBe('Failed to fetch');
  expect(result.calls[0].base_url).toBe('https://cf.api.fan/v1/responses');
  expect(result.calls[0].provider).toBe('packycode');
  expect(result.calls[0].payload).toMatchObject({ instructions: '规则', stream: true, store: false, max_output_tokens: 16384, reasoning: { effort: 'low' } });
  expect(result.calls[1].payload.instructions).toBe('请完成用户请求。');
  expect(result.calls[1].payload.reasoning.effort).toBe('high');
  expect(result.calls[1].payload.input[0].content).toEqual([
    { type: 'input_text', text: '双图评审' },
    { type: 'input_image', image_url: 'data:image/png;base64,a' },
    { type: 'input_image', image_url: 'data:image/png;base64,b' },
  ]);
});

async function openApp(page, target) {
  await page.route('**/api/**', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('tap-e2e-skip-auth', '1');
  });
  await page.goto(target);
  await page.waitForFunction(() => window.app && window.app._inited === true);
}

test('选择 Packycode 使用已验证入口和模型，流式配置保存后保持', async ({ page }) => {
  await openApp(page, '/ai-tools.html?tab=models');
  await page.click('#createModelBtn');
  await page.selectOption('#modelProvider', 'packycode');
  await expect(page.locator('#modelBaseUrl')).toHaveValue('https://cf.api.fan/v1');
  await expect(page.locator('#modelAvailableList')).toContainText('gpt-6-astra');
  await expect(page.locator('#modelStreamMode')).toHaveValue('stream');
  await expect(page.locator('#modelStreamMode')).toBeDisabled();
  await page.fill('#modelDisplayName', 'Packycode 测试站点');
  await page.fill('#modelApiKey', 'test-only');
  await page.click('#saveModelBtn');
  await expect(page.locator('#modelFormStatus')).toContainText('模型已保存');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cleaner-models-v1'))[0]);
  expect(saved.provider).toBe('packycode');
  expect(saved.stream).toBe(true);
  let captured;
  let fail = false;
  await page.route('**/api/model-proxy', route => {
    captured = route.request().postDataJSON();
    return route.fulfill({
      status: fail ? 502 : 200, contentType: 'application/json',
      body: fail ? '{"detail":"Packycode 流提前中断"}' : '{"status":"completed","output_text":"OK"}',
    });
  });
  await page.evaluate(() => window.app.switchTab('assign'));
  const modelValue = await page.locator('#xmindCaseGenModelSelect option').evaluateAll(options => {
    return options.find(option => option.textContent.indexOf('gpt-6-astra') !== -1).value;
  });
  await page.selectOption('#xmindCaseGenModelSelect', modelValue);
  await page.click('#testXmindCaseGenModel');
  await expect(page.locator('#xmindCaseGenAssignStatus')).toContainText('测试成功');
  expect(captured.provider).toBe('packycode');
  expect(captured.payload.model).toBe('gpt-6-astra');
  fail = true;
  await page.click('#testXmindCaseGenModel');
  await expect(page.locator('#xmindCaseGenAssignStatus')).toContainText('测试失败');
  await expect(page.locator('#xmindCaseGenAssignStatus')).toContainText('流提前中断');
  await page.evaluate(() => window.app.switchTab('models'));
  await page.locator('#modelList [data-edit]').click();
  await expect(page.locator('#modelProvider')).toHaveValue('packycode');
  await expect(page.locator('#modelStreamMode')).toBeDisabled();
  await page.selectOption('#modelProvider', 'custom');
  await expect(page.locator('#modelStreamMode')).toBeEnabled();
});

test('Packycode 代理 API 保留供应商字段', async ({ page }) => {
  await openApp(page, '/ai-tools.html?tab=models');
  let captured;
  await page.route('**/api/model-proxy', route => {
    captured = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"completed","output_text":"OK"}' });
  });
  await page.evaluate(() => window.app.apiClient.proxyModelRequest({ provider: 'packycode', base_url: 'https://cf.api.fan/v1/responses', payload: {} }));
  expect(captured.provider).toBe('packycode');
});

test('只有 packycode 类型启用最小请求，同域名自定义及其他类型保持原请求', async ({ page }) => {
  await page.addScriptTag({ path: path.resolve(__dirname, '../../services/modelClient.js') });
  const result = await page.evaluate(async () => {
    const calls = [];
    const service = window.app.services.modelClient;
    const client = service.createModelClient({ proxyModelRequest: async body => {
      calls.push(body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'completed', output_text: 'OK' }) };
    } });
    for (const model of [
      { provider: 'packycode', baseUrl: 'https://cf.api.fan/v1/responses', model: 'gpt-6-astra' },
      { provider: 'custom', baseUrl: 'https://cf.api.fan/v1/responses', model: 'gpt-6-astra' },
      { provider: 'custom', baseUrl: 'https://cf.api.fan/v1/responses', model: 'claude-sonnet-4-6' },
      { provider: 'custom', baseUrl: 'https://other.example/v1/responses', model: 'gpt-6-astra' },
      { provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
      { provider: 'custom', baseUrl: 'https://cf.api.fan.evil.example/v1/responses', model: 'gpt-6-astra' },
    ]) await client.callModelWithConfig(model, '需求', '规则', '', 0.2, { transport: 'proxy' });
    const detected = ['cf.api.fan', 'slb-v1.api.fan', 'codex-api.packycode.com', 'packyapi.com', 'www.packyapi.com'].map(host => {
      return service.isPackycodeModel({ provider: 'custom', baseUrl: 'https://' + host + '/v1', model: 'codex-auto-review' });
    });
    return { calls, detected };
  });
  expect(result.detected.every(value => value === false)).toBe(true);
  expect(result.calls[0]).toMatchObject({ provider: 'packycode', payload: { stream: true, store: false, max_output_tokens: 16384 } });
  expect(result.calls[2].base_url).toBe('https://cf.api.fan/v1/chat/completions');
  expect(result.calls[2].payload.messages[0]).toEqual({ role: 'system', content: '规则' });
  expect(result.calls[4].base_url).toBe('https://api.deepseek.com/chat/completions');
  for (const call of result.calls.slice(1)) {
    expect(call.provider).toBeUndefined();
    expect(call.payload.max_output_tokens).toBeUndefined();
    expect(call.payload.store).toBeUndefined();
    expect(call.payload.stream).toBe(false);
  }
});

for (const batch of [false, true]) {
  const provider = 'packycode';
  test('Packycode 用例生成 503 不自动重试：' + provider + (batch ? '分批' : '单次'), async ({ page }) => {
    await openApp(page, '/ai-workflow.html?tab=casesgen');
    const result = await page.evaluate(async ({ batch, provider }) => {
      let calls = 0;
      window.app.services.modelTaskClient.runModelRequest = async function() {
        calls += 1;
        throw new Error('HTTP 503 upstream unavailable');
      };
      const payload = {
        model: { provider, baseUrl: 'https://cf.api.fan/v1', model: 'gpt-6-astra', remoteId: 1 },
        requestText: '生成用例', prompt: '只返回 JSON',
      };
      if (batch) payload.modelRequestBatch = [{ requestText: '生成用例', prompt: '只返回 JSON' }];
      const task = await window.app.xmindCaseGenTaskManager.startTask(payload, { force: true });
      return { calls, status: task.status, retryCount: task.retryCount, error: task.error };
    }, { batch, provider });
    expect(result.calls).toBe(1);
    expect(result.status).toBe('error');
    expect(result.retryCount).toBe(0);
    expect(result.error).toContain('503');
  });
}
