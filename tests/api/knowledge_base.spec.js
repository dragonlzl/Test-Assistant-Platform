const { test, expect, request } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

test.describe('knowledge base api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';
  const externalKbBaseUrl = process.env.KNOWLEDGE_BASE_TEST_URL || '';
  const externalKbMissingBaseUrl = process.env.KNOWLEDGE_BASE_MISSING_URL || '';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username, password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.access_token;
  }

  function writeJson(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  }

  function writeText(filePath, text) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, text);
  }

  function createKbFixture(options) {
    const opts = options || {};
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tap-kb-'));
    const moduleSlug = opts.useChinesePath ? '01_核心机制' : '01_core';
    const relativeDocPath = opts.useChinesePath ? '01_核心机制/伤害计算.md' : '01_core/damage.md';
    const cleanDocPath = opts.useChinesePath ? '_llm/docs/01_核心机制/伤害计算.md' : '_llm/docs/01_core/damage.md';
    const sourceUrl = opts.useChinesePath ? 'https://kb.local/wiki/damage-cn' : 'https://kb.local/wiki/damage';
    const docId = opts.useChinesePath ? '01_核心机制__伤害计算' : '01_core__伤害计算';
    if (opts.withManifest !== false) {
      writeJson(path.join(dir, 'manifest.json'), [{
        module_slug: moduleSlug,
        module_title: '核心机制',
        title: '伤害计算',
        seed_title: '伤害计算',
        source_url: sourceUrl,
        relative_path: relativeDocPath,
      }]);
    }
    writeJson(path.join(dir, 'kb-manifest.json'), {
      version: 1,
      generated_at: '2026-04-15T10:00:00+08:00',
      docs_dir: '_llm/docs',
      index_path: '_llm/search-index.json',
      doc_count: opts.withManifest === false ? 0 : 1,
      entry_count: 2,
    });
    writeJson(path.join(dir, '_llm/search-index.json'), {
      version: 1,
      generated_at: '2026-04-15T10:00:00+08:00',
      entries: [{
        doc_id: docId,
        module: '核心机制',
        title: '伤害计算',
        aliases: ['伤害计算'],
        keywords: ['伤害', '暴击', '防御'],
        summary: '伤害计算涉及暴击、攻击力和防御减伤规则。',
        heading: '伤害计算',
        text: '伤害计算会受到暴击倍率、防御减伤和攻击速度等规则影响。',
        clean_path: cleanDocPath,
        chunk_index: 0,
      }, {
        doc_id: docId,
        module: '核心机制',
        title: '伤害计算',
        aliases: ['暴击倍率', '暴击'],
        keywords: ['暴击', '倍率'],
        summary: '暴击倍率会影响最终伤害，并受特定状态限制。',
        heading: '暴击倍率',
        text: '暴击倍率受职业状态和技能增益影响，异常状态下需要回退默认倍率。',
        clean_path: cleanDocPath,
        chunk_index: 1,
      }],
    });
    writeText(
      path.join(dir, cleanDocPath),
      '# 伤害计算\n\n暴击倍率、防御减伤和攻击速度都会影响最终伤害。\n\n## 暴击倍率\n\n暴击倍率会影响最终伤害，并受职业状态和技能增益限制。\n\n## 防御减伤\n\n防御减伤需要考虑护甲减免、穿透与异常状态叠加。\n\n## 攻击速度\n\n攻击速度会影响伤害节奏与技能触发频率。'
    );
    writeText(
      path.join(dir, relativeDocPath),
      '# 伤害计算\n\n- 模块：核心机制\n\n- 来源：' + sourceUrl + '\n\n## 正文\n\n暴击倍率、防御减伤和攻击速度都会影响最终伤害。\n\n## 暴击倍率\n\n暴击倍率会影响最终伤害，并受职业状态和技能增益限制。\n\n## 防御减伤\n\n防御减伤需要考虑护甲减免、穿透与异常状态叠加。\n\n## 攻击速度\n\n攻击速度会影响伤害节奏与技能触发频率。'
    );
    return dir;
  }

  async function startStaticServer(rootDir) {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const filePath = path.join(rootDir, decodeURIComponent(url.pathname));
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === '.json' ? 'application/json' : 'text/plain; charset=utf-8';
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.end(fs.readFileSync(filePath));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    return {
      baseUrl: `http://127.0.0.1:${address.port}/`,
      close: () => new Promise((resolve) => server.close(resolve)),
    };
  }

  async function startFlakyStaticServer(rootDir, closeOncePath) {
    const hitCount = {};
    const targetPath = String(closeOncePath || '/manifest.json');
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const pathname = url.pathname;
      hitCount[pathname] = (hitCount[pathname] || 0) + 1;
      if (pathname === targetPath && hitCount[pathname] === 1) {
        req.socket.destroy();
        return;
      }
      const filePath = path.join(rootDir, decodeURIComponent(pathname));
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === '.json' ? 'application/json' : 'text/plain; charset=utf-8';
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.end(fs.readFileSync(filePath));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    return {
      baseUrl: `http://127.0.0.1:${address.port}/`,
      hitCount,
      close: () => new Promise((resolve) => server.close(resolve)),
    };
  }

  test('validate endpoint accepts a valid shared knowledge base', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    let fixtureDir = null;
    let server = null;
    let baseUrl = externalKbBaseUrl;
    if (!baseUrl) {
      fixtureDir = createKbFixture();
      server = await startStaticServer(fixtureDir);
      baseUrl = server.baseUrl;
    }
    const normalizedBaseUrl = String(baseUrl || '').endsWith('/') ? String(baseUrl || '') : (String(baseUrl || '') + '/');

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/validate`, {
        headers,
        data: {
          base_url: normalizedBaseUrl,
          deep_check: true,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.normalized_base_url).toBe(normalizedBaseUrl);
      expect(body.manifest.doc_count).toBe(1);
      expect(body.manifest.entry_count).toBe(2);
      expect(body.missing_files).toEqual([]);
    } finally {
      if (server) await server.close();
      if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('catalog endpoint returns aggregated document directory', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fixtureDir = createKbFixture();
    const server = await startStaticServer(fixtureDir);

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/catalog`, {
        headers,
        data: {
          base_url: server.baseUrl,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.normalized_base_url).toBe(server.baseUrl);
      expect(Array.isArray(body.documents)).toBeTruthy();
      expect(body.documents).toHaveLength(1);
      expect(body.documents[0].doc_id).toBe('01_core__伤害计算');
      expect(body.documents[0].heading_samples).toContain('暴击倍率');
      expect(body.documents[0].clean_path).toBe('_llm/docs/01_core/damage.md');
    } finally {
      await server.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('documents endpoint returns markdown sections', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fixtureDir = createKbFixture();
    const server = await startStaticServer(fixtureDir);

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/documents`, {
        headers,
        data: {
          base_url: server.baseUrl,
          doc_ids: ['01_core__伤害计算'],
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.documents)).toBeTruthy();
      expect(body.documents).toHaveLength(1);
      expect(body.documents[0].doc_id).toBe('01_core__伤害计算');
      expect(body.documents[0].section_count).toBeGreaterThanOrEqual(3);
      expect(body.documents[0].sections[0].section_id).toContain('section-');
      const headings = body.documents[0].sections.map((item) => String(item.heading || ''));
      expect(headings).toContain('暴击倍率');
      expect(body.documents[0].sections.some((item) => String(item.content || '').includes('防御减伤'))).toBe(true);
    } finally {
      await server.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('validate endpoint rejects invalid base url', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const res = await ctx.post(`${apiBase}/api/knowledge-base/validate`, {
      headers,
      data: {
        base_url: 'file:///tmp/not-allowed',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(String(body.detail || '')).toContain('仅支持 http/https');
  });

  test('validate endpoint reports missing manifest clearly', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    let fixtureDir = null;
    let server = null;
    let baseUrl = externalKbMissingBaseUrl;
    if (!baseUrl) {
      fixtureDir = createKbFixture({ withManifest: false });
      server = await startStaticServer(fixtureDir);
      baseUrl = server.baseUrl;
    }
    const normalizedBaseUrl = String(baseUrl || '').endsWith('/') ? String(baseUrl || '') : (String(baseUrl || '') + '/');

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/validate`, {
        headers,
        data: {
          base_url: normalizedBaseUrl,
          deep_check: true,
        },
      });
      expect(res.status()).toBe(502);
      const body = await res.json();
      expect(String(body.detail || '')).toContain('manifest.json');
    } finally {
      if (server) await server.close();
      if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('search endpoint returns structured candidates', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    let fixtureDir = null;
    let server = null;
    let baseUrl = externalKbBaseUrl;
    if (!baseUrl) {
      fixtureDir = createKbFixture();
      server = await startStaticServer(fixtureDir);
      baseUrl = server.baseUrl;
    }
    const normalizedBaseUrl = String(baseUrl || '').endsWith('/') ? String(baseUrl || '') : (String(baseUrl || '') + '/');

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/search`, {
        headers,
        data: {
          base_url: normalizedBaseUrl,
          workspace_id: 'workspace-a',
          request_id: 'kb-req-1',
          requirement_label: '暴击伤害验证',
          requirement_text: '需要补充暴击倍率和防御减伤相关测试点',
          requirement_supplement: '验证攻击速度对输出节奏的影响',
          requirement_mode: 'manual',
          operation_type: 'full_cases',
          target_module: '伤害计算',
          visible_modules: [{
            module: '伤害计算',
            key_scenarios: ['暴击倍率'],
            test_points: ['防御减伤'],
            case_titles: ['暴击伤害结算'],
          }],
          visible_cases: [{ module: '伤害计算', title: '暴击伤害结算' }],
          operation_contract: {
            scope: 'root',
            mode: 'full_cases',
          },
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.normalized_base_url).toBe(normalizedBaseUrl);
      expect(Array.isArray(body.candidates)).toBeTruthy();
      expect(body.candidates.length).toBeGreaterThan(0);
      expect(body.candidates[0].title).toBe('伤害计算');
      expect(body.candidates[0].document_excerpt).toContain('暴击');
    } finally {
      if (server) await server.close();
      if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('search endpoint retries when shared server closes connection without response', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fixtureDir = createKbFixture();
    const server = await startFlakyStaticServer(fixtureDir, '/manifest.json');

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/search`, {
        headers,
        data: {
          base_url: server.baseUrl,
          workspace_id: 'workspace-retry',
          request_id: 'kb-req-retry',
          requirement_label: '伤害计算',
          requirement_text: '需要根据伤害计算补充暴击与防御减伤用例',
          requirement_mode: 'manual',
          operation_type: 'full_cases',
          target_module: '伤害计算',
          visible_modules: [],
          visible_cases: [],
          operation_contract: {
            scope: 'root',
            mode: 'full_cases',
          },
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.candidates)).toBeTruthy();
      expect(body.candidates.length).toBeGreaterThan(0);
      expect(server.hitCount['/manifest.json']).toBeGreaterThanOrEqual(2);
    } finally {
      await server.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('catalog endpoint retries when shared server closes connection without response', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fixtureDir = createKbFixture();
    const server = await startFlakyStaticServer(fixtureDir, '/manifest.json');

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/catalog`, {
        headers,
        data: {
          base_url: server.baseUrl,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.documents)).toBeTruthy();
      expect(body.documents.length).toBeGreaterThan(0);
      expect(server.hitCount['/manifest.json']).toBeGreaterThanOrEqual(2);
    } finally {
      await server.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('documents endpoint retries when shared server closes connection without response', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fixtureDir = createKbFixture();
    const server = await startFlakyStaticServer(fixtureDir, '/_llm/docs/01_core/damage.md');

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/documents`, {
        headers,
        data: {
          base_url: server.baseUrl,
          doc_ids: ['01_core__伤害计算'],
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.documents)).toBeTruthy();
      expect(body.documents.length).toBe(1);
      expect(server.hitCount['/_llm/docs/01_core/damage.md']).toBeGreaterThanOrEqual(2);
    } finally {
      await server.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('search endpoint supports chinese clean paths in shared knowledge base', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fixtureDir = createKbFixture({ useChinesePath: true });
    const server = await startStaticServer(fixtureDir);
    const normalizedBaseUrl = server.baseUrl;

    try {
      const res = await ctx.post(`${apiBase}/api/knowledge-base/search`, {
        headers,
        data: {
          base_url: normalizedBaseUrl,
          workspace_id: 'workspace-cn',
          request_id: 'kb-req-cn',
          requirement_label: '伤害计算',
          requirement_text: '需要根据伤害计算补充暴击与防御减伤用例',
          requirement_mode: 'manual',
          operation_type: 'full_cases',
          target_module: '伤害计算',
          visible_modules: [],
          visible_cases: [],
          operation_contract: {
            scope: 'root',
            mode: 'full_cases',
          },
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.candidates)).toBeTruthy();
      expect(body.candidates.length).toBeGreaterThan(0);
      expect(body.candidates[0].clean_path).toBe('_llm/docs/01_核心机制/伤害计算.md');
      expect(body.candidates[0].document_excerpt).toContain('暴击倍率');
    } finally {
      await server.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('documents endpoint rejects empty or unknown doc ids clearly', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fixtureDir = createKbFixture();
    const server = await startStaticServer(fixtureDir);

    try {
      const emptyRes = await ctx.post(`${apiBase}/api/knowledge-base/documents`, {
        headers,
        data: {
          base_url: server.baseUrl,
          doc_ids: [],
        },
      });
      expect(emptyRes.status()).toBe(400);
      const emptyBody = await emptyRes.json();
      expect(String(emptyBody.detail || '')).toContain('doc_ids 不能为空');

      const unknownRes = await ctx.post(`${apiBase}/api/knowledge-base/documents`, {
        headers,
        data: {
          base_url: server.baseUrl,
          doc_ids: ['unknown-doc'],
        },
      });
      expect(unknownRes.status()).toBe(404);
      const unknownBody = await unknownRes.json();
      expect(String(unknownBody.detail || '')).toContain('未找到指定知识库文档');
    } finally {
      await server.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('knowledgeBaseBaseUrl setting can be saved and read back', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const value = 'http://192.168.50.10:8003/sk/';
    const catalogLimit = 180000;
    const injectedLimit = 36000;
    const payloadLimit = 5200000;

    const saveRes = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: {
        scope: 'user',
        items: [
          { key: 'knowledgeBaseBaseUrl', value_json: value },
          { key: 'knowledgeBaseCatalogCharLimit', value_json: catalogLimit },
          { key: 'knowledgeBaseInjectedContextCharLimit', value_json: injectedLimit },
          { key: 'xmindRequestPayloadLimit', value_json: payloadLimit },
        ],
      },
    });
    expect(saveRes.status()).toBe(200);

    const listRes = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    const record = listBody.find((item) => item.key === 'knowledgeBaseBaseUrl');
    expect(record).toBeTruthy();
    expect(record.value_json).toBe(value);
    const catalogRecord = listBody.find((item) => item.key === 'knowledgeBaseCatalogCharLimit');
    expect(catalogRecord).toBeTruthy();
    expect(catalogRecord.value_json).toBe(catalogLimit);
    const injectedRecord = listBody.find((item) => item.key === 'knowledgeBaseInjectedContextCharLimit');
    expect(injectedRecord).toBeTruthy();
    expect(injectedRecord.value_json).toBe(injectedLimit);
    const payloadRecord = listBody.find((item) => item.key === 'xmindRequestPayloadLimit');
    expect(payloadRecord).toBeTruthy();
    expect(payloadRecord.value_json).toBe(payloadLimit);

    const clearRes = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: {
        scope: 'user',
        items: [
          { key: 'knowledgeBaseBaseUrl', value_json: '' },
          { key: 'knowledgeBaseCatalogCharLimit', value_json: null },
          { key: 'knowledgeBaseInjectedContextCharLimit', value_json: null },
          { key: 'xmindRequestPayloadLimit', value_json: null },
        ],
      },
    });
    expect(clearRes.status()).toBe(200);
  });
});
