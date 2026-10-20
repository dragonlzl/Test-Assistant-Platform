const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadClient(page) {
  await page.addScriptTag({ path: path.resolve(__dirname, '../../services/modelClient.js') });
}

test('视觉检测用随机图片答案验证实际识图，并保留选中模型的协议与凭据', async ({ page }) => {
  await loadClient(page);
  const result = await page.evaluate(async () => {
    let answer = '';
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text) {
      answer = String(text);
      return originalFillText.apply(this, arguments);
    };
    const calls = [];
    let asyncCalls = 0;
    let directCalls = 0;
    window.app.services.modelTaskClient = { runModelRequest: async function() { asyncCalls += 1; throw new Error('不得创建生成任务'); } };
    const client = window.app.services.modelClient.createModelClient({
      proxyModelRequest: async function(body) {
        calls.push({ body, answer });
        return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'completed', output_text: answer }) };
      },
      fetchImpl: async function() { directCalls += 1; throw new Error('不得直连'); },
    });
    const results = [];
    for (const model of [
      { provider: 'custom', baseUrl: 'https://vision.example/v1/chat/completions', model: 'my-vision-model', apiKey: 'selected-site-key' },
      { provider: 'custom', baseUrl: 'https://vision.example/v1/responses', model: 'other-model', apiKey: 'other-site-key' },
      { provider: 'packycode', baseUrl: 'https://cf.api.fan/v1', model: 'gpt-6-astra', apiKey: 'packy-test-key' },
    ]) results.push(await client.verifyVisionSupport(model, { owner: 'workspace-1' }));
    CanvasRenderingContext2D.prototype.fillText = originalFillText;
    return { calls, results, asyncCalls, directCalls };
  });
  expect(result.results).toEqual(Array(3).fill({ status: 'supported', reason: 'verified' }));
  expect(result.asyncCalls).toBe(0);
  expect(result.directCalls).toBe(0);
  expect(result.calls).toHaveLength(3);
  expect(result.calls[0].body).toMatchObject({ api_key: 'selected-site-key', timeout_sec: 30, payload: { model: 'my-vision-model' } });
  expect(result.calls[1].body).toMatchObject({ api_key: 'other-site-key', payload: { model: 'other-model' } });
  expect(result.calls[2].body).toMatchObject({ api_key: 'packy-test-key', provider: 'packycode', base_url: 'https://cf.api.fan/v1/responses', payload: { model: 'gpt-6-astra', stream: true, store: false } });
  for (const call of result.calls) {
    const body = call.body.payload;
    const text = body.instructions || body.messages[0].content;
    const blocks = body.input ? body.input[0].content : body.messages[1].content;
    expect(text).toContain('[VISION_CAPABILITY_CHECK]');
    expect(text).not.toContain(call.answer);
    expect(blocks[0].text).not.toContain(call.answer);
    const dataUrl = blocks[1].image_url.url || blocks[1].image_url;
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(Buffer.from(dataUrl.split(',')[1], 'base64').subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
});

test('模型接受图片但忽略内容时不能通过视觉检测', async ({ page }) => {
  await loadClient(page);
  const result = await page.evaluate(async () => {
    let calls = 0;
    const client = window.app.services.modelClient.createModelClient({ proxyModelRequest: async function() {
      calls += 1;
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'NO_IMAGE' } }] }) };
    } });
    return { result: await client.verifyVisionSupport({ baseUrl: 'https://vision.example/v1/chat/completions', model: 'text-only' }), calls };
  });
  expect(result).toEqual({ result: { status: 'unsupported', reason: 'image-not-recognized' }, calls: 1 });
});

test('视觉检测区分明确拒绝图片与认证、网络、限流、服务异常且不回退重发', async ({ page }) => {
  await loadClient(page);
  const result = await page.evaluate(async () => {
    const cases = [
      { status: 400, message: 'This model does not support image inputs' },
      { status: 422, message: 'Unknown content type: input_image' },
      { status: 400, message: 'invalid API key' },
      { status: 401, message: 'Unauthorized' },
      { status: 403, message: 'Forbidden' },
      { status: 429, message: 'Rate limit exceeded' },
      { status: 503, message: 'upstream unavailable' },
      { status: 502, message: 'upstream does not support image inputs' },
      { error: 'Failed to fetch' },
    ];
    const results = [];
    let calls = 0;
    let directCalls = 0;
    for (const scenario of cases) {
      const client = window.app.services.modelClient.createModelClient({
        proxyModelRequest: async function() {
          calls += 1;
          if (scenario.error) throw new Error(scenario.error);
          return { ok: false, status: scenario.status, text: async () => JSON.stringify({ error: { message: scenario.message } }) };
        },
        fetchImpl: async function() { directCalls += 1; throw new Error('禁止重发'); },
      });
      results.push(await client.verifyVisionSupport({ provider: 'custom', baseUrl: 'https://vision.example/v1/chat/completions', model: 'my-model' }));
    }
    return { results, calls, directCalls };
  });
  expect(result.results.map(item => item.status)).toEqual(['unsupported', 'unsupported', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown']);
  expect(result.results[0].reason).toBe('image-rejected');
  expect(result.results[1].reason).toBe('image-rejected');
  expect(result.results[3].reason).toContain('401');
  expect(result.results[8].reason).toContain('Failed to fetch');
  expect(result.calls).toBe(9);
  expect(result.directCalls).toBe(0);
});

test('视觉检测超时返回未确认，主动中止保留取消语义并清理请求', async ({ page }) => {
  await loadClient(page);
  const result = await page.evaluate(async () => {
    let calls = 0;
    const makeClient = () => window.app.services.modelClient.createModelClient({
      clampTimeoutSeconds: () => 0.05,
      proxyModelRequest: async function(body, signal) {
        calls += 1;
        return new Promise((resolve, reject) => signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        }, { once: true }));
      },
    });
    const model = { baseUrl: 'https://vision.example/v1/chat/completions', model: 'my-model' };
    const timeoutClient = makeClient();
    const timeout = await timeoutClient.verifyVisionSupport(model, { owner: 'timeout-owner' });
    const afterTimeout = timeoutClient.abortRequestsByOwner('timeout-owner');
    const cancelClient = makeClient();
    const pending = cancelClient.verifyVisionSupport(model, { owner: 'cancel-owner' });
    const cancelCount = cancelClient.abortRequestsByOwner('cancel-owner', 'cancelled');
    let cancel;
    try { await pending; }
    catch (err) { cancel = { name: err.name, reason: err.abortReason }; }
    return { calls, timeout, afterTimeout, cancel, cancelCount, afterCancel: cancelClient.abortRequestsByOwner('cancel-owner') };
  });
  expect(result.calls).toBe(2);
  expect(result.timeout.status).toBe('unknown');
  expect(result.timeout.reason).toContain('超时');
  expect(result.afterTimeout).toBe(0);
  expect(result.cancelCount).toBe(1);
  expect(result.cancel.name).toBe('AbortError');
  expect(result.cancel.reason).toBe('request-aborted');
  expect(result.afterCancel).toBe(0);
});
