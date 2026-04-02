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

test('Claude 模型走 Packy responses 地址时自动兼容为 chat/completions', async ({ page }) => {
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
    const request = { url: '', body: '' };
    const client = service.createModelClient({
      fetchImpl: async function mockFetch(url, options) {
        request.url = String(url || '');
        request.body = options && options.body ? String(options.body) : '';
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({ choices: [{ message: { content: 'ok' } }] });
          },
        };
      },
    });

    await client.callModelWithConfig(
      {
        baseUrl: 'https://www.packyapi.com/v1/responses',
        model: 'claude-sonnet-4-6',
        provider: 'custom',
      },
      'ping',
      '你是助手'
    );

    const body = request.body ? JSON.parse(request.body) : {};
    return {
      url: request.url,
      hasMessages: Array.isArray(body.messages),
      hasInput: Array.isArray(body.input),
    };
  });

  expect(captured.url).toContain('/v1/chat/completions');
  expect(captured.hasMessages).toBeTruthy();
  expect(captured.hasInput).toBeFalsy();
});

test('代理返回 503 时保留真实 HTTP 错误而不是退化成 Failed to fetch', async ({ page }) => {
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

  const errorMsg = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const client = service.createModelClient({
      proxyModelRequest: async function mockProxy() {
        return {
          ok: false,
          status: 503,
          text: async function mockText() {
            return JSON.stringify({
              detail: '连接模型服务失败：上游服务暂时不可用',
            });
          },
        };
      },
      fetchImpl: async function mockFetch() {
        throw new Error('Failed to fetch');
      },
    });
    try {
      await client.callModelWithConfig(
        { baseUrl: 'http://mock.model/api', model: 'mock-model' },
        '输入',
        '提示词'
      );
      return '';
    } catch (err) {
      return err && err.message ? err.message : String(err);
    }
  });

  expect(errorMsg).toBe('HTTP 503：连接模型服务失败：上游服务暂时不可用');
});

test('代理抛出明确错误且直连失败时优先保留代理错误', async ({ page }) => {
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

  const errorMsg = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const client = service.createModelClient({
      proxyModelRequest: async function mockProxy() {
        throw new Error('503 Service Unavailable');
      },
      fetchImpl: async function mockFetch() {
        throw new Error('Failed to fetch');
      },
    });
    try {
      await client.callModelWithConfig(
        { baseUrl: 'http://mock.model/api', model: 'mock-model' },
        '输入',
        '提示词'
      );
      return '';
    } catch (err) {
      return err && err.message ? err.message : String(err);
    }
  });

  expect(errorMsg).toBe('503 Service Unavailable');
});

test('DeepSeek 遇到 XMind 对象结构提示词时不误判为 JSON 数组', async ({ page }) => {
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
    const config = window.app && window.app.config ? window.app.config : null;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    if (!config || !config.defaultPrompts || !config.defaultPrompts.xmindcasegen) {
      throw new Error('XMind 默认提示词未加载');
    }
    const captured = { body: '' };
    const client = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        captured.body = options && options.body ? String(options.body) : '';
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({
              choices: [{
                message: {
                  content: '{"modules":[{"module":"登录模块","key_scenarios":["主流程"],"test_points":["账号密码校验"],"coupled_modules":[],"cases":[]}]}',
                },
              }],
            });
          },
        };
      },
    });
    const output = await client.callModelWithConfig(
      { baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-reasoner', provider: 'deepseek' },
      '输入',
      config.defaultPrompts.xmindcasegen
    );
    const body = captured.body ? JSON.parse(captured.body) : {};
    return {
      output: output,
      systemPrompt: body && body.messages && body.messages[0] ? String(body.messages[0].content || '') : '',
      responseFormat: body && body.response_format ? body.response_format : null,
    };
  });

  expect(result.output).toContain('"modules"');
  expect(result.systemPrompt).toMatch(/顶层必须是对象/);
  expect(result.systemPrompt).not.toMatch(/顶层必须是数组/);
  expect(result.responseFormat).toEqual({ type: 'json_object' });
});
