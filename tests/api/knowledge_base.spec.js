const { test, expect, request } = require('@playwright/test');
const http = require('http');

const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

async function login(ctx, username, password) {
  const res = await ctx.post(`${apiBase}/api/auth/login`, {
    data: { username, password },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.access_token;
}

async function createUser(ctx, adminHeaders) {
  const username = 'kb_user_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8);
  const password = 'Pwd123456';
  const res = await ctx.post(`${apiBase}/api/users`, {
    headers: adminHeaders,
    data: { username, password, role: 'user', level: 'member', is_active: true },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return {
    username,
    password,
    id: body.id,
  };
}

async function startKnowledgeBaseServer() {
  const server = http.createServer((req, res) => {
    const pathName = String(req.url || '').split('?')[0];

    if (pathName === '/ok/kb-manifest.json') {
      return sendJson(res, 200, {
        version: 1,
        generated_at: '2026-04-13T11:00:00+08:00',
        docs_dir: '_llm/docs',
        index_path: '_llm/search-index.json',
        doc_count: 2,
        entry_count: 2,
      });
    }
    if (pathName === '/ok/_llm/search-index.json') {
      return sendJson(res, 200, {
        version: 1,
        generated_at: '2026-04-13T11:00:00+08:00',
        entries: [
          {
            doc_id: '05_模式与活动/怪兽崛起',
            module: '模式与活动',
            title: '怪兽崛起',
            aliases: ['怪兽崛起玩法'],
            keywords: ['怪兽崛起', '骑士之家', '游戏机'],
            summary: '怪兽崛起入口位于骑士之家二楼游戏机，包含单人与联机玩法。',
            heading: '玩法与机制',
            text: '怪兽崛起入口位于骑士之家二楼游戏机。需要覆盖单人与联机两类流程。',
            clean_path: '_llm/docs/05_模式与活动/怪兽崛起.md',
            chunk_index: 0,
          },
          {
            doc_id: '03_角色与养成/角色',
            module: '角色与养成',
            title: '角色',
            aliases: ['角色系统'],
            keywords: ['登录', '账号', '异常提示'],
            summary: '登录模块需要覆盖账号异常与锁定。',
            heading: '登录模块',
            text: '登录模块需要覆盖账号锁定、异常提示与重试流程。',
            clean_path: '_llm/docs/03_角色与养成/角色.md',
            chunk_index: 1,
          },
        ],
      });
    }
    if (pathName === '/no-match/kb-manifest.json') {
      return sendJson(res, 200, {
        version: 1,
        generated_at: '2026-04-13T11:00:00+08:00',
        docs_dir: '_llm/docs',
        index_path: '_llm/search-index.json',
        doc_count: 1,
        entry_count: 1,
      });
    }
    if (pathName === '/no-match/_llm/search-index.json') {
      return sendJson(res, 200, {
        version: 1,
        generated_at: '2026-04-13T11:00:00+08:00',
        entries: [
          {
            doc_id: '01_宠物/宠物总览',
            module: '宠物',
            title: '宠物系统',
            aliases: ['宠物'],
            keywords: ['亲密度', '喂养'],
            summary: '宠物系统介绍。',
            heading: '概览',
            text: '宠物系统覆盖亲密度成长与喂养效果。',
            clean_path: '_llm/docs/01_宠物/宠物总览.md',
            chunk_index: 0,
          },
        ],
      });
    }
    if (pathName === '/manifest-missing/kb-manifest.json') {
      return sendJson(res, 404, { detail: 'missing' });
    }
    if (pathName === '/index-invalid/kb-manifest.json') {
      return sendJson(res, 200, {
        version: 1,
        generated_at: '2026-04-13T11:00:00+08:00',
        docs_dir: '_llm/docs',
        index_path: '_llm/search-index.json',
        doc_count: 1,
        entry_count: 1,
      });
    }
    if (pathName === '/index-invalid/_llm/search-index.json') {
      return sendRaw(res, 200, 'application/json', '{"entries":"broken"}');
    }

    return sendJson(res, 404, { detail: 'not found' });
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const addr = server.address();
  return {
    origin: `http://127.0.0.1:${addr.port}`,
    close() {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

function sendRaw(res, statusCode, contentType, body) {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

function sendJson(res, statusCode, body) {
  sendRaw(res, statusCode, 'application/json', JSON.stringify(body));
}

test.describe('knowledge base api', () => {
  test('knowledgeBaseBaseUrl 可通过现有设置接口保存、读取、覆盖和清空', async () => {
    const ctx = await request.newContext();
    try {
      const adminToken = await login(ctx, adminUser, adminPass);
      const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
      const userInfo = await createUser(ctx, adminHeaders);
      const userToken = await login(ctx, userInfo.username, userInfo.password);
      const userHeaders = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };

      const saveFirst = await ctx.put(`${apiBase}/api/settings`, {
        headers: userHeaders,
        data: {
          scope: 'user',
          items: [{ key: 'knowledgeBaseBaseUrl', value_json: 'http://192.168.50.10:8003/download/sk' }],
        },
      });
      expect(saveFirst.status()).toBe(200);
      const saveFirstBody = await saveFirst.json();
      expect(saveFirstBody[0].key).toBe('knowledgeBaseBaseUrl');
      expect(saveFirstBody[0].value_json).toBe('http://192.168.50.10:8003/download/sk');

      const listFirst = await ctx.get(`${apiBase}/api/settings?scope=user`, {
        headers: userHeaders,
      });
      expect(listFirst.status()).toBe(200);
      const listFirstBody = await listFirst.json();
      const firstSetting = listFirstBody.find((item) => item.key === 'knowledgeBaseBaseUrl');
      expect(firstSetting).toBeTruthy();
      expect(firstSetting.value_json).toBe('http://192.168.50.10:8003/download/sk');

      const saveSecond = await ctx.put(`${apiBase}/api/settings`, {
        headers: userHeaders,
        data: {
          scope: 'user',
          items: [{ key: 'knowledgeBaseBaseUrl', value_json: 'https://example.com/kb' }],
        },
      });
      expect(saveSecond.status()).toBe(200);
      const saveSecondBody = await saveSecond.json();
      expect(saveSecondBody[0].value_json).toBe('https://example.com/kb');

      const clearSetting = await ctx.put(`${apiBase}/api/settings`, {
        headers: userHeaders,
        data: {
          scope: 'user',
          items: [{ key: 'knowledgeBaseBaseUrl', value_json: '' }],
        },
      });
      expect(clearSetting.status()).toBe(200);
      const clearBody = await clearSetting.json();
      expect(clearBody[0].value_json).toBe('');

      const listFinal = await ctx.get(`${apiBase}/api/settings?scope=user`, {
        headers: userHeaders,
      });
      expect(listFinal.status()).toBe(200);
      const listFinalBody = await listFinal.json();
      const finalSetting = listFinalBody.find((item) => item.key === 'knowledgeBaseBaseUrl');
      expect(finalSetting).toBeTruthy();
      expect(finalSetting.value_json).toBe('');
    } finally {
      await ctx.dispose();
    }
  });

  test('knowledge base query 需要登录态', async () => {
    const ctx = await request.newContext();
    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/query`, {
        data: { base_url: 'http://127.0.0.1:65530/kb' },
      });
      expect([401, 403]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });

  test('knowledge base query 返回 ok、no_match、manifest_missing 与 index_invalid', async () => {
    const ctx = await request.newContext();
    const kbServer = await startKnowledgeBaseServer();
    try {
      const token = await login(ctx, adminUser, adminPass);
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      const okRes = await ctx.post(`${apiBase}/api/knowledge-base/query`, {
        headers,
        data: {
          base_url: `${kbServer.origin}/ok`,
          requirement_label: '怪兽崛起入口',
          requirement_text: '需求：怪兽崛起入口在骑士之家游戏机，需要覆盖登录模块异常提示。',
          module_title: '',
          action_scope: 'root',
          action_mode: 'full_modules',
        },
      });
      expect(okRes.status()).toBe(200);
      const okBody = await okRes.json();
      expect(okBody.status).toBe('ok');
      expect(okBody.used).toBe(true);
      expect(okBody.match_count).toBeGreaterThan(0);
      expect(okBody.used_chunk_count).toBeGreaterThan(0);
      expect(okBody.used_doc_count).toBeGreaterThan(0);
      expect(String(okBody.context_text || '')).toContain('怪兽崛起入口位于骑士之家二楼游戏机');
      expect(Array.isArray(okBody.hits)).toBeTruthy();
      expect(okBody.hits.some((item) => item && item.used === true)).toBeTruthy();
      expect(okBody.manifest_meta && okBody.manifest_meta.base_url).toBe(`${kbServer.origin}/ok`);

      const noMatchRes = await ctx.post(`${apiBase}/api/knowledge-base/query`, {
        headers,
        data: {
          base_url: `${kbServer.origin}/no-match`,
          requirement_label: '怪兽崛起入口',
          requirement_text: '需求：怪兽崛起入口在骑士之家游戏机。',
          module_title: '',
          action_scope: 'root',
          action_mode: 'full_modules',
        },
      });
      expect(noMatchRes.status()).toBe(200);
      const noMatchBody = await noMatchRes.json();
      expect(noMatchBody.status).toBe('no_match');
      expect(noMatchBody.used).toBe(false);
      expect(noMatchBody.match_count).toBe(0);
      expect(noMatchBody.context_text).toBe('');

      const manifestMissingRes = await ctx.post(`${apiBase}/api/knowledge-base/query`, {
        headers,
        data: {
          base_url: `${kbServer.origin}/manifest-missing`,
          requirement_label: '怪兽崛起入口',
          requirement_text: '需求：怪兽崛起入口在骑士之家游戏机。',
          module_title: '',
          action_scope: 'root',
          action_mode: 'full_modules',
        },
      });
      expect(manifestMissingRes.status()).toBe(200);
      const manifestMissingBody = await manifestMissingRes.json();
      expect(manifestMissingBody.status).toBe('manifest_missing');
      expect(manifestMissingBody.used).toBe(false);

      const indexInvalidRes = await ctx.post(`${apiBase}/api/knowledge-base/query`, {
        headers,
        data: {
          base_url: `${kbServer.origin}/index-invalid`,
          requirement_label: '怪兽崛起入口',
          requirement_text: '需求：怪兽崛起入口在骑士之家游戏机。',
          module_title: '',
          action_scope: 'root',
          action_mode: 'full_modules',
        },
      });
      expect(indexInvalidRes.status()).toBe(200);
      const indexInvalidBody = await indexInvalidRes.json();
      expect(indexInvalidBody.status).toBe('index_invalid');
      expect(indexInvalidBody.used).toBe(false);
    } finally {
      await kbServer.close();
      await ctx.dispose();
    }
  });

  test('knowledge base query 返回 invalid_url、unreachable 与 disabled', async () => {
    const ctx = await request.newContext();
    let closedServer = null;
    try {
      const token = await login(ctx, adminUser, adminPass);
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      const invalidRes = await ctx.post(`${apiBase}/api/knowledge-base/query`, {
        headers,
        data: {
          base_url: 'ftp://invalid-host/kb',
          requirement_label: '怪兽崛起入口',
          requirement_text: '需求：怪兽崛起入口在骑士之家游戏机。',
          module_title: '',
          action_scope: 'root',
          action_mode: 'full_modules',
        },
      });
      expect(invalidRes.status()).toBe(200);
      const invalidBody = await invalidRes.json();
      expect(invalidBody.status).toBe('invalid_url');
      expect(invalidBody.used).toBe(false);

      closedServer = await startKnowledgeBaseServer();
      const unreachableBaseUrl = `${closedServer.origin}/unreachable`;
      await closedServer.close();
      closedServer = null;

      const unreachableRes = await ctx.post(`${apiBase}/api/knowledge-base/query`, {
        headers,
        data: {
          base_url: unreachableBaseUrl,
          requirement_label: '怪兽崛起入口',
          requirement_text: '需求：怪兽崛起入口在骑士之家游戏机。',
          module_title: '',
          action_scope: 'root',
          action_mode: 'full_modules',
        },
      });
      expect(unreachableRes.status()).toBe(200);
      const unreachableBody = await unreachableRes.json();
      expect(unreachableBody.status).toBe('unreachable');
      expect(unreachableBody.used).toBe(false);

      const disabledRes = await ctx.post(`${apiBase}/api/knowledge-base/query`, {
        headers,
        data: {
          base_url: '',
          requirement_label: '怪兽崛起入口',
          requirement_text: '需求：怪兽崛起入口在骑士之家游戏机。',
          module_title: '',
          action_scope: 'root',
          action_mode: 'full_modules',
        },
      });
      expect(disabledRes.status()).toBe(200);
      const disabledBody = await disabledRes.json();
      expect(disabledBody.status).toBe('disabled');
      expect(disabledBody.used).toBe(false);
    } finally {
      if (closedServer) {
        await closedServer.close().catch(function() {});
      }
      await ctx.dispose();
    }
  });
});
