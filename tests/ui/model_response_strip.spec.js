const { test, expect } = require('@playwright/test');

test('HTTP 200 的模型失败响应在文本和多模态调用中保留诊断且不返回部分结果', async ({ page }) => {
  await page.addScriptTag({ path: require('path').resolve(__dirname, '../../services/modelClient.js') });
  const results = await page.evaluate(async () => {
    const failedResponse = {
      id: 'resp-failed-test',
      status: 'failed',
      error: { code: 'server_error', message: 'Request could not be completed' },
      output_text: '{"modules":[]}',
    };
    const sseBody = [
      'event: response.created',
      'data: ' + JSON.stringify({ type: 'response.created', response: { id: failedResponse.id, status: 'in_progress' } }),
      '',
      'event: response.output_text.delta',
      'data: ' + JSON.stringify({ type: 'response.output_text.delta', delta: '{"modules":[]}' }),
      '',
      'event: response.failed',
      'data: ' + JSON.stringify({ type: 'response.failed', response: failedResponse }),
      '',
    ].join('\n');
    const results = [];
    for (const format of ['sse', 'json']) {
      for (const mode of ['text', 'content']) {
        const diagnostics = [];
        const body = format === 'sse' ? sseBody : JSON.stringify(failedResponse);
        window.app.services.modelTaskClient = {
          runModelRequest: async function() {
            return {
              ok: true,
              status: 200,
              modelTaskMetadata: { upstreamStatus: 200, responseStatus: 'failed' },
              text: async function() { return body; },
            };
          },
        };
        const client = window.app.services.modelClient.createModelClient({});
        const model = { baseUrl: 'https://mock.invalid/v1/responses', model: 'gpt-5.6-sol', stream: format === 'sse' };
        const options = { onResponseDiagnostics: (info) => diagnostics.push(info) };
        let error = null;
        let returned = false;
        try {
          if (mode === 'content') {
            await client.callModelWithContent(model, [{ type: 'text', text: '输入' }], '提示', options);
          } else {
            await client.callModelWithConfig(model, '输入', '提示', '', 0.2, options);
          }
          returned = true;
        } catch (err) {
          error = { message: err.message, code: err.code, metadata: err.responseMetadata };
        }
        results.push({ format, mode, returned, error, diagnostics });
      }
    }
    return results;
  });
  expect(results).toHaveLength(4);
  for (const result of results) {
    expect(result.returned).toBe(false);
    expect(result.error.message).toBe('Request could not be completed');
    expect(result.error.code).toBe('server_error');
    expect(result.error.metadata.responseId).toBe('resp-failed-test');
    expect(result.error.metadata.responseStatus).toBe('failed');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].upstreamStatus).toBe(200);
    expect(result.diagnostics[0].responseStatus).toBe('failed');
    expect(result.diagnostics[0].errorCode).toBe('server_error');
    expect(result.diagnostics[0].rawLength).toBeGreaterThan(0);
    expect(result.diagnostics[0].contentLength).toBe(0);
    expect(result.diagnostics[0].isSse).toBe(result.format === 'sse');
  }
});

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
    const payloads = { deepseek: '', other: '', content: '' };
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
    const contentClient = service.createModelClient({
      fetchImpl: async function mockContentFetch(_, options) {
        payloads.content = options && options.body ? options.body : '';
        return {
          ok: true,
          text: async function mockContentText() {
            return JSON.stringify({ choices: [{ message: { content: 'done' } }] });
          },
        };
      },
    });
    await contentClient.callModelWithContent(
      { baseUrl: 'https://api.moonshot.cn/v1/chat/completions', model: 'k2', provider: 'kimi' },
      [{ type: 'text', text: '输入' }],
      '普通提示',
      { maxTokens: 80000 }
    );
    return payloads;
  });

  const deepseekBody = JSON.parse(captured.deepseek || '{}');
  expect(deepseekBody.response_format).toEqual({ type: 'json_object' });
  const otherBody = JSON.parse(captured.other || '{}');
  expect(otherBody.response_format).toBeUndefined();
  const contentBody = JSON.parse(captured.content || '{}');
  expect(contentBody.max_tokens).toBeUndefined();
  expect(contentBody.max_output_tokens).toBeUndefined();
  expect(deepseekBody.max_output_tokens).toBeUndefined();
  expect(deepseekBody.max_tokens).toBeUndefined();
  expect(otherBody.max_output_tokens).toBeUndefined();
  expect(otherBody.max_tokens).toBeUndefined();
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

test('GPT-5 裸官网地址自动补全为 Responses API 端点', async ({ page }) => {
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
            return JSON.stringify({ output_text: 'ok' });
          },
        };
      },
    });

    await client.callModelWithConfig(
      {
        baseUrl: 'https://codex-for.example.com',
        model: 'gpt-5.6-sol',
        provider: 'custom',
      },
      'ping',
      '你是助手'
    );

    const body = request.body ? JSON.parse(request.body) : {};
    return {
      url: request.url,
      hasInput: Array.isArray(body.input),
      hasMessages: Array.isArray(body.messages),
    };
  });

  expect(captured.url).toBe('https://codex-for.example.com/v1/responses');
  expect(captured.hasInput).toBeTruthy();
  expect(captured.hasMessages).toBeFalsy();
});

test('Responses API 启用流式时能解析 SSE 内容', async ({ page }) => {
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
    const request = { body: '' };
    const client = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        request.body = options && options.body ? String(options.body) : '';
        return {
          ok: true,
          text: async function mockText() {
            return [
              'event: response.output_text.delta',
              'data: {"type":"response.output_text.delta","delta":"hel","output_index":0}',
              '',
              'event: response.output_text.delta',
              'data: {"type":"response.output_text.delta","delta":"lo","output_index":0}',
              '',
              'event: response.output_text.done',
              'data: {"type":"response.output_text.done","text":"hello","output_index":0}',
              '',
            ].join('\n');
          },
        };
      },
    });

    const content = await client.callModelWithConfig(
      { baseUrl: 'https://other.example/v1/responses', model: 'gpt-5.4', stream: true },
      'ping',
      '任意提示'
    );

    const body = request.body ? JSON.parse(request.body) : {};
    return {
      content,
      stream: body.stream,
    };
  });

  expect(captured.stream).toBeTruthy();
  expect(captured.content).toBe('hello');
});

test('Responses API 标记输出截断时提示 token 上限而非 JSON 格式错误', async ({ page }) => {
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

  const error = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    const client = service.createModelClient({
      fetchImpl: async function mockFetch() {
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({
              status: 'incomplete',
              incomplete_details: { reason: 'max_output_tokens' },
              usage: { input_tokens: 1800, output_tokens: 80000, total_tokens: 81800 },
              output: [{ type: 'message', content: [{ type: 'output_text', text: '{"modules":[' }] }],
            });
          },
        };
      },
    });
    try {
      await client.callModelWithConfig(
        { baseUrl: 'https://mock.model/v1/responses', model: 'gpt-5.6-sol', maxTokens: 80000 },
        '输入',
        '请返回 JSON'
      );
      return '';
    } catch (err) {
      return err && err.message ? err.message : String(err);
    }
  });

  expect(error).toContain('输出达到 token 上限');
  expect(error).toContain('输入 1800');
  expect(error).not.toContain('输出不是合法 JSON');
});

test('Packycode 类型使用后端最小请求并校验完成结果', async ({ page }) => {
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
    const request = { body: '' };
    const client = service.createModelClient({
      proxyModelRequest: async function(body) {
        request.body = JSON.stringify(body.payload);
        return {
          ok: true,
          status: 200,
          text: async function mockText() {
            return JSON.stringify({ status: 'completed', output_text: 'ok' });
          },
        };
      },
    });

    const content = await client.callModelWithConfig(
      { provider: 'packycode', baseUrl: 'https://www.packyapi.com/v1/responses', model: 'gpt-5.4', stream: true, maxTokens: 1024 },
      '需求正文',
      '需求评审提示词',
      '',
      0.2,
      { transport: 'proxy' }
    );

    const body = request.body ? JSON.parse(request.body) : {};
    return {
      content,
      hasInstructions: Object.prototype.hasOwnProperty.call(body, 'instructions'),
      hasTemperature: Object.prototype.hasOwnProperty.call(body, 'temperature'),
      inputText: body && body.input && body.input[0] && body.input[0].content && body.input[0].content[0]
        ? String(body.input[0].content[0].text || '')
        : '',
    };
  });

  expect(captured.content).toBe('ok');
  expect(captured.hasInstructions).toBeTruthy();
  expect(captured.hasTemperature).toBeFalsy();
  expect(captured.inputText).not.toContain('需求评审提示词');
  expect(captured.inputText).toContain('需求正文');
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

test('GPT-5.6 推理等级映射到 Responses 与 Chat Completions 请求', async ({ page }) => {
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

  const payloads = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const captured = [];
    const client = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        captured.push(options && options.body ? JSON.parse(options.body) : {});
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({
              output_text: 'ok',
              choices: [{ message: { content: 'ok' } }],
            });
          },
        };
      },
    });
    await client.callModelWithConfig(
      {
        baseUrl: 'https://api.openai.com/v1/responses',
        model: 'gpt-5.6-sol',
        provider: 'custom',
        reasoningEffort: 'high',
      },
      '输入',
      '提示词'
    );
    await client.callModelWithConfig(
      {
        baseUrl: 'https://api.openai.com/v1/responses',
        model: 'gpt-5.6-sol',
        provider: 'custom',
        reasoningEffort: 'high',
      },
      '输入',
      '提示词',
      'low'
    );
    await client.callModelWithConfig(
      {
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-5.6-sol',
        provider: 'custom',
      },
      '输入',
      '提示词',
      'xhigh'
    );
    return captured;
  });

  expect(payloads[0].reasoning).toEqual({ effort: 'high' });
  expect(payloads[1].reasoning).toEqual({ effort: 'low' });
  expect(payloads[2].reasoning_effort).toBe('xhigh');
  expect(payloads[0].temperature).toBeUndefined();
  expect(payloads[1].temperature).toBeUndefined();
  expect(payloads[2].temperature).toBeUndefined();
});

test('多模态模型请求不携带 Temperature 参数', async ({ page }) => {
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
    let body = {};
    const client = service.createModelClient({
      fetchImpl: async function mockFetch(_, options) {
        body = options && options.body ? JSON.parse(options.body) : {};
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({ choices: [{ message: { content: 'ok' } }] });
          },
        };
      },
    });
    await client.callModelWithContent(
      { baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'vision-model' },
      [
        { type: 'text', text: '请识别图片' },
        { type: 'image', dataUrl: 'data:image/png;base64,AAAA' },
      ],
      '图片提示词',
      { temperature: 0.9 }
    );
    return body;
  });

  expect(payload.temperature).toBeUndefined();
});

test('模型响应诊断回调记录长度、尾部和上游限制元数据', async ({ page }) => {
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
    const diagnostics = [];
    const client = service.createModelClient({
      fetchImpl: async function mockFetch() {
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({
              status: 'incomplete',
              incomplete_details: { reason: 'max_output_tokens' },
              usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
              choices: [{ message: { content: '{"modules":[' } }],
            });
          },
        };
      },
    });
    let errorCode = '';
    try {
      await client.callModelWithConfig(
        { baseUrl: 'http://mock.model/api', model: 'mock-model' },
        '输入',
        '提示',
        '',
        0.2,
        {
          scene: 'root',
          owner: 'xmind-casegen:test-diagnostics',
          onResponseDiagnostics: (info) => diagnostics.push(info),
        }
      );
    } catch (err) {
      errorCode = err && err.code ? String(err.code) : '';
    }
    return { diagnostics, errorCode };
  });

  expect(result.errorCode).toBe('MODEL_OUTPUT_TOKEN_LIMIT');
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0].responseStatus).toBe('incomplete');
  expect(result.diagnostics[0].incompleteReason).toBe('max_output_tokens');
  expect(result.diagnostics[0].rawLength).toBeGreaterThan(0);
  expect(result.diagnostics[0].rawTailPreview).toContain('max_output_tokens');
});

test('HTTP 504 HTML 错误页会保留状态并显示简洁原因', async ({ page }) => {
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
    const diagnostics = [];
    const client = service.createModelClient({
      fetchImpl: async function mockFetch() {
        return {
          ok: false,
          status: 504,
          text: async function mockText() {
            return '<!DOCTYPE html><html><head><title>ERROR</title></head><body>Generated by cloudfront</body></html>';
          },
        };
      },
    });
    let error = '';
    try {
      await client.callModelWithConfig(
        { baseUrl: 'http://mock.model/api', model: 'mock-model' },
        '输入',
        '提示',
        '',
        0.2,
        {
          scene: 'module',
          owner: 'xmind-casegen:test-http-504',
          onResponseDiagnostics: (info) => diagnostics.push(info),
        }
      );
    } catch (err) {
      error = err && err.message ? String(err.message) : String(err);
    }
    return { error, diagnostics };
  });

  expect(result.error).toBe('HTTP 504：上游返回 HTML 错误页（页面标题：ERROR）');
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0].upstreamStatus).toBe(504);
  expect(result.diagnostics[0].isHtml).toBeTruthy();
});
