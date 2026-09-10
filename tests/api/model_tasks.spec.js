const http = require('http');
const { test, expect, request } = require('@playwright/test');

test.describe.configure({ mode: 'serial' });

test.describe('backend model tasks', () => {
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  let modelServer;
  let modelBaseUrl;

  test.beforeAll(async () => {
    modelServer = http.createServer((req, res) => {
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        let payload = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch (_) {}
        const delayMs = Math.max(0, Number(payload.test_delay_ms || 0));
        setTimeout(() => {
          if (res.destroyed || res.writableEnded) return;
          if (payload.test_marker === 'truncated-response') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'incomplete',
              incomplete_details: { reason: 'max_output_tokens' },
              usage: { input_tokens: 1800, output_tokens: 4096, total_tokens: 5896 },
              output: [{ type: 'message', content: [{ type: 'output_text', text: '{"modules":[' }] }],
            }));
            return;
          }
          const content = JSON.stringify({
            authorization: req.headers.authorization || '',
            marker: payload.test_marker || '',
            model: payload.model || '',
            hasOutputTokenLimit: Object.prototype.hasOwnProperty.call(payload, 'max_tokens')
              || Object.prototype.hasOwnProperty.call(payload, 'max_output_tokens'),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'completed',
            choices: [{ message: { content }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
          }));
        }, delayMs);
      });
    });
    await new Promise((resolve, reject) => {
      modelServer.once('error', reject);
      modelServer.listen(0, '127.0.0.1', resolve);
    });
    const address = modelServer.address();
    modelBaseUrl = `http://127.0.0.1:${address.port}/v1/chat/completions`;
  });

  test.afterAll(async () => {
    if (!modelServer) return;
    await new Promise((resolve) => modelServer.close(resolve));
  });

  async function login(ctx, username, password) {
    const response = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username, password },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).access_token;
  }

  async function waitForStatus(ctx, headers, taskId, statuses) {
    const expected = Array.isArray(statuses) ? statuses : [statuses];
    const deadline = Date.now() + 8000;
    let body = null;
    while (Date.now() < deadline) {
      const response = await ctx.get(`${apiBase}/api/model-tasks/${taskId}`, { headers });
      expect(response.status()).toBe(200);
      body = await response.json();
      if (expected.includes(body.status)) return body;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`task ${taskId} did not reach ${expected.join(',')}: ${JSON.stringify(body)}`);
  }

  async function createUser(ctx, headers, suffix) {
    const username = `model_task_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const password = 'Pwd123456';
    const response = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username, password, role: 'user', level: 'member', is_active: true },
    });
    expect(response.status()).toBe(201);
    return { body: await response.json(), username, password };
  }

  async function createModel(ctx, headers, name, apiKey) {
    const response = await ctx.post(`${apiBase}/api/models`, {
      headers,
      data: {
        name,
        scope: 'user',
        config_json: {
          provider: 'custom',
          baseUrl: modelBaseUrl,
          apiKey,
          model: 'mock-model',
          maxTokens: 1024,
        },
      },
    });
    expect(response.status()).toBe(201);
    return response.json();
  }

  function taskPayload(modelId, owner, requestKey, marker, delayMs) {
    return {
      model_config_id: modelId,
      payload: {
        model: 'requested-model',
        test_marker: marker,
        test_delay_ms: delayMs || 0,
        max_tokens: 1024,
        max_output_tokens: 2048,
      },
      timeout_sec: 30,
      scene: 'api-test',
      owner_key: owner,
      idempotency_key: requestKey,
    };
  }

  test('isolates users, resumes idempotently, and cancels only the caller tasks', async () => {
    const ctx = await request.newContext();
    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    const userA = await createUser(ctx, adminHeaders, 'a');
    const userB = await createUser(ctx, adminHeaders, 'b');
    const tokenA = await login(ctx, userA.username, userA.password);
    const tokenB = await login(ctx, userB.username, userB.password);
    const headersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
    const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };
    const modelA = await createModel(ctx, headersA, `model-a-${Date.now()}`, 'key-a');
    const modelAReplacement = await createModel(ctx, headersA, `model-a-replacement-${Date.now()}`, 'key-a-new');
    const modelB = await createModel(ctx, headersB, `model-b-${Date.now()}`, 'key-b');

    const missingRequestedModelPayload = taskPayload(
      modelA.id,
      'owner-a-missing-model',
      'request-a-missing-model',
      'missing-model',
      0
    );
    delete missingRequestedModelPayload.payload.model;
    const missingRequestedModel = await ctx.post(`${apiBase}/api/model-tasks`, {
      headers: headersA,
      data: missingRequestedModelPayload,
    });
    expect(missingRequestedModel.status()).toBe(400);
    expect((await missingRequestedModel.json()).detail).toContain('必须指定具体模型');

    const firstCreate = await ctx.post(`${apiBase}/api/model-tasks`, {
      headers: headersA,
      data: taskPayload(modelA.id, 'owner-a', 'request-a-1', 'first-a', 0),
    });
    expect(firstCreate.status()).toBe(202);
    const firstTask = await firstCreate.json();
    const duplicateCreate = await ctx.post(`${apiBase}/api/model-tasks`, {
      headers: headersA,
      data: taskPayload(modelA.id, 'owner-a', 'request-a-1', 'ignored-duplicate', 0),
    });
    expect(duplicateCreate.status()).toBe(202);
    expect((await duplicateCreate.json()).id).toBe(firstTask.id);

    const conflictingModelCreate = await ctx.post(`${apiBase}/api/model-tasks`, {
      headers: headersA,
      data: taskPayload(modelAReplacement.id, 'owner-a', 'request-a-1', 'wrong-model', 0),
    });
    expect(conflictingModelCreate.status()).toBe(409);

    const completedA = await waitForStatus(ctx, headersA, firstTask.id, 'succeeded');
    const upstreamA = JSON.parse(completedA.response_body);
    const contentA = JSON.parse(upstreamA.choices[0].message.content);
    expect(contentA.authorization).toBe('Bearer key-a');
    expect(contentA.marker).toBe('first-a');
    expect(contentA.model).toBe('requested-model');
    expect(contentA.hasOutputTokenLimit).toBeFalsy();
    expect(completedA.response_status).toBe('completed');
    expect(completedA.configured_model).toBe('mock-model');
    expect(completedA.request_model).toBe('requested-model');
    expect(completedA.request_endpoint).toBe(modelBaseUrl);
    expect(completedA.finish_reason).toBe('stop');
    expect(completedA.usage_json.total_tokens).toBe(30);

    const truncatedResponse = await ctx.post(`${apiBase}/api/model-tasks`, {
      headers: headersA,
      data: taskPayload(modelA.id, 'owner-a-truncated', 'request-a-truncated', 'truncated-response', 0),
    });
    expect(truncatedResponse.status()).toBe(202);
    const truncatedTask = await waitForStatus(
      ctx,
      headersA,
      (await truncatedResponse.json()).id,
      'succeeded'
    );
    expect(truncatedTask.response_status).toBe('incomplete');
    expect(truncatedTask.incomplete_details.reason).toBe('max_output_tokens');
    expect(truncatedTask.usage_json.input_tokens).toBe(1800);

    const forbiddenRead = await ctx.get(`${apiBase}/api/model-tasks/${firstTask.id}`, { headers: headersB });
    expect(forbiddenRead.status()).toBe(403);
    const forbiddenModel = await ctx.post(`${apiBase}/api/model-tasks`, {
      headers: headersB,
      data: taskPayload(modelA.id, 'owner-b', 'request-b-forbidden', 'forbidden', 0),
    });
    expect(forbiddenModel.status()).toBe(403);

    const sharedOwner = `shared-owner-${Date.now()}`;
    const slowAResponse = await ctx.post(`${apiBase}/api/model-tasks`, {
      headers: headersA,
      data: taskPayload(modelA.id, sharedOwner, `${sharedOwner}:a`, 'slow-a', 3000),
    });
    const slowBResponse = await ctx.post(`${apiBase}/api/model-tasks`, {
      headers: headersB,
      data: taskPayload(modelB.id, sharedOwner, `${sharedOwner}:b`, 'slow-b', 700),
    });
    expect(slowAResponse.status()).toBe(202);
    expect(slowBResponse.status()).toBe(202);
    const slowA = await slowAResponse.json();
    const slowB = await slowBResponse.json();
    await waitForStatus(ctx, headersA, slowA.id, ['running', 'succeeded']);

    const cancelResponse = await ctx.post(`${apiBase}/api/model-tasks/cancel-by-owner`, {
      headers: headersA,
      data: { owner_key: sharedOwner },
    });
    expect(cancelResponse.status()).toBe(200);
    const cancelled = await cancelResponse.json();
    expect(cancelled.task_ids).toContain(slowA.id);
    expect(cancelled.task_ids).not.toContain(slowB.id);
    await waitForStatus(ctx, headersA, slowA.id, 'cancelled');
    const completedB = await waitForStatus(ctx, headersB, slowB.id, 'succeeded');
    const upstreamB = JSON.parse(completedB.response_body);
    const contentB = JSON.parse(upstreamB.choices[0].message.content);
    expect(contentB.authorization).toBe('Bearer key-b');
    expect(contentB.marker).toBe('slow-b');

    const listB = await ctx.get(`${apiBase}/api/model-tasks?scene=api-test`, { headers: headersB });
    expect(listB.status()).toBe(200);
    const listBodyB = await listB.json();
    expect(listBodyB.some((item) => item.id === firstTask.id)).toBeFalsy();
    expect(listBodyB.some((item) => item.id === slowB.id)).toBeTruthy();
    await ctx.dispose();
  });
});
