const { test, expect } = require('@playwright/test');

test('模型响应含代码块包装也能被剥离', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const results = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const clientWithChoice = service.createModelClient({
      fetchImpl: async function mockFetch() {
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({
              choices: [
                {
                  message: {
                    content: "'''json\n[{\"module\":\"模块X\",\"key_scenarios\":[\"场景A\"]}]\n'''",
                  },
                },
              ],
            });
          },
        };
      },
    });
    const sanitizedChoice = await clientWithChoice.callModelWithConfig(
      { baseUrl: 'http://mock.model/api', model: 'mock-model' },
      '用户输入',
      '提示词示例'
    );

    const clientWithRawText = service.createModelClient({
      fetchImpl: async function mockRawFetch() {
        return {
          ok: true,
          text: async function mockRawText() {
            return "```json\n{\"hello\":\"world\"}\n```";
          },
        };
      },
    });
    const sanitizedRaw = await clientWithRawText.callModelWithConfig(
      { baseUrl: 'http://mock.model/api', model: 'mock-model' },
      '任意输入',
      '任意提示'
    );

    return { sanitizedChoice, sanitizedRaw };
  });

  expect(results.sanitizedChoice).toBe('[{"module":"模块X","key_scenarios":["场景A"]}]');
  expect(results.sanitizedRaw).toBe('{"hello":"world"}');
});

test('DeepSeek JSON 模式自动附加 response_format', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const captured = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const payloads = { deepseek: '', other: '' };
    const deepseekClient = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        payloads.deepseek = options && options.body ? options.body : '';
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] });
          },
        };
      },
    });
    await deepseekClient.callModelWithConfig(
      { baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', provider: 'deepseek' },
      '输入',
      '请严格输出 JSON：{"ok": true}'
    );
    const otherClient = service.createModelClient({
      fetchImpl: async function mockOtherFetch(_, options) {
        payloads.other = options && options.body ? options.body : '';
        return {
          ok: true,
          text: async function mockOtherText() {
            return JSON.stringify({ choices: [{ message: { content: 'done' } }] });
          },
        };
      },
    });
    await otherClient.callModelWithConfig(
      { baseUrl: 'https://api.moonshot.cn/v1/chat/completions', model: 'k2', provider: 'kimi' },
      '输入',
      '普通文本'
    );
    return payloads;
  });

  const deepseekBody = JSON.parse(captured.deepseek || '{}');
  expect(deepseekBody.response_format).toEqual({ type: 'json_object' });
  const otherBody = JSON.parse(captured.other || '{}');
  expect(otherBody.response_format).toBeUndefined();
});

test('DeepSeek JSON 数组输出严格校验', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const results = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const capture = { systemPrompt: '' };
    const validClient = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        const body = options && options.body ? JSON.parse(options.body) : {};
        capture.systemPrompt = body && body.messages && body.messages[0] ? body.messages[0].content : '';
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({ choices: [{ message: { content: '[{\"ok\":true}]' } }] });
          },
        };
      },
    });
    const output = await validClient.callModelWithConfig(
      { baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', provider: 'deepseek' },
      '输入',
      '请严格输出 JSON 数组：[{"ok":true}]'
    );

    const invalidClient = service.createModelClient({
      fetchImpl: async function mockInvalidFetch() {
        return {
          ok: true,
          text: async function mockInvalidText() {
            return JSON.stringify({ choices: [{ message: { content: '{\"ok\":true}' } }] });
          },
        };
      },
    });
    let errorMsg = '';
    try {
      await invalidClient.callModelWithConfig(
        { baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', provider: 'deepseek' },
        '输入',
        '请严格输出 JSON 数组：[{"ok":true}]'
      );
    } catch (err) {
      errorMsg = err && err.message ? err.message : String(err);
    }
    return { output, errorMsg, systemPrompt: capture.systemPrompt };
  });

  expect(results.output).toBe('[{"ok":true}]');
  expect(results.errorMsg).toMatch(/JSON 数组/);
  expect(results.systemPrompt).toMatch(/顶层必须是数组/);
});

test('Responses 接口可解析输出并使用 input 字段', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const result = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const payloads = { body: '' };
    const client = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        payloads.body = options && options.body ? options.body : '';
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({
              output: [
                {
                  content: [{ type: 'output_text', text: 'pong' }],
                },
              ],
            });
          },
        };
      },
    });
    const output = await client.callModelWithConfig(
      { baseUrl: 'https://api.openai.com/v1/responses', model: 'gpt-5.2', provider: 'openai' },
      '用户输入',
      '系统提示'
    );
    return { output, body: payloads.body };
  });

  const payload = JSON.parse(result.body || '{}');
  expect(Array.isArray(payload.input)).toBe(true);
  const roles = (payload.input || []).map(item => item && item.role).filter(Boolean);
  expect(roles).toContain('system');
  expect(roles).toContain('user');
  const contentText = JSON.stringify(payload.input || []);
  expect(contentText).toContain('系统提示');
  expect(contentText).toContain('用户输入');
  expect(payload.messages).toBeUndefined();
  expect(result.output).toBe('pong');
});

test('SSE 响应可解析输出内容', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const result = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const client = service.createModelClient({
      fetchImpl: async function mockFetch() {
        return {
          ok: true,
          text: async function mockText() {
            return [
              'event: response',
              'data: {"choices":[{"delta":{"content":"po"}}]}',
              '',
              'data: {"choices":[{"delta":{"content":"ng"}}]}',
              '',
              'data: [DONE]',
              ''
            ].join('\\n');
          },
        };
      },
    });
    return client.callModelWithConfig(
      { baseUrl: 'http://mock.model/api', model: 'mock-model' },
      '输入',
      '提示'
    );
  });

  expect(result).toBe('pong');
});

test('Responses 兼容模式发送字符串 input 并启用 stream', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const payload = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    let captured = '';
    const client = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        captured = options && options.body ? options.body : '';
        return {
          ok: true,
          text: async function mockText() {
            return 'data: {"choices":[{"delta":{"content":"pong"}}]}\n\ndata: [DONE]\n';
          },
        };
      },
    });
    await client.callModelWithConfig(
      { baseUrl: 'https://api.openai.com/v1/responses', model: 'gpt-5.2', responsesCompat: true },
      '用户输入',
      '系统提示'
    );
    return captured;
  });

  const body = JSON.parse(payload || '{}');
  expect(typeof body.input).toBe('string');
  expect(body.input).toContain('系统提示');
  expect(body.input).toContain('用户输入');
  expect(body.stream).toBe(true);
});

test('Responses 缺少 input 报错时可自动回退格式', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const result = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const payloads = [];
    let callCount = 0;
    const client = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        payloads.push(options && options.body ? options.body : '');
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: false,
            status: 400,
            text: async function mockErrText() {
              return JSON.stringify({
                error: {
                  message: 'Invalid request: either \"messages\" (OpenAI format) or \"input\" (Response API format) is required',
                  code: 'missing_required_fields',
                },
              });
            },
          };
        }
        return {
          ok: true,
          text: async function mockOkText() {
            return JSON.stringify({
              output: [
                {
                  content: [{ type: 'output_text', text: 'pong' }],
                },
              ],
            });
          },
        };
      },
    });
    const output = await client.callModelWithConfig(
      { baseUrl: 'https://api.openai.com/v1/responses', model: 'gpt-5.2', responsesCompat: true },
      '用户输入',
      '系统提示'
    );
    return { output, payloads };
  });

  const first = JSON.parse(result.payloads[0] || '{}');
  const second = JSON.parse(result.payloads[1] || '{}');
  expect(typeof first.input).toBe('string');
  expect(Array.isArray(second.input)).toBe(true);
  expect(result.output).toBe('pong');
});

test('Responses 503 时移除 reasoning_effort 重试', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const result = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const payloads = [];
    let callCount = 0;
    const client = service.createModelClient({
      modelIsR1: function() { return true; },
      fetchImpl: async function mockFetch(_, options) {
        payloads.push(options && options.body ? options.body : '');
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: false,
            status: 503,
            text: async function mockErrText() {
              return JSON.stringify({
                error: {
                  message: '所有供应商暂时不可用，请稍后重试',
                  type: 'service_unavailable_error',
                  code: 'service_unavailable_error',
                },
              });
            },
          };
        }
        return {
          ok: true,
          text: async function mockOkText() {
            return JSON.stringify({
              output: [
                {
                  content: [{ type: 'output_text', text: 'pong' }],
                },
              ],
            });
          },
        };
      },
    });
    const output = await client.callModelWithConfig(
      { baseUrl: 'https://api.openai.com/v1/responses', model: 'gpt-5.2', maxTokens: 512 },
      '用户输入',
      '系统提示',
      'medium'
    );
    return { output, payloads };
  });

  const first = JSON.parse(result.payloads[0] || '{}');
  const second = JSON.parse(result.payloads[1] || '{}');
  expect(first.reasoning_effort).toBe('medium');
  expect(second.reasoning_effort).toBeUndefined();
  expect(result.output).toBe('pong');
});
