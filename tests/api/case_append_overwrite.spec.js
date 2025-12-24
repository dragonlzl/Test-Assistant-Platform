const { test, expect, request } = require('@playwright/test');

test.describe('case append overwrite api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: username, password: password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body && body.access_token).toBeTruthy();
    return body.access_token;
  }

  test('追加入库：同模块同标题存在时可覆盖或跳过', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-append-overwrite-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'append overwrite api spec' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '追加覆盖测试_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '登录', title: '正常登录', priority: 'P1', precondition: '无', steps: '旧步骤', expected: '旧预期', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFileId = (await importRes.json()).id;

    const list1 = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(list1.status()).toBe(200);
    const items1 = await list1.json();
    expect(items1.length).toBe(1);
    expect(items1[0].steps).toBe('旧步骤');

    // 同模块同标题但步骤不同：不算重复，应正常追加
    const appendDifferent = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items/append`, {
      headers,
      data: {
        overwrite_existing: false,
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '无', steps: '新步骤-不同', expected: '新预期-不同', remark: '' },
        ],
      },
    });
    expect(appendDifferent.status()).toBe(200);
    const diffOut = await appendDifferent.json();
    expect(diffOut && diffOut.appended).toBe(1);
    expect(diffOut && diffOut.skipped_existing_conflicts).toBe(0);

    const list2 = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(list2.status()).toBe(200);
    const items2 = await list2.json();
    expect(items2.length).toBe(2);

    const appendSkip = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items/append`, {
      headers,
      data: {
        overwrite_existing: false,
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '无', steps: '旧步骤', expected: '旧预期', remark: '跳过' },
        ],
      },
    });
    expect(appendSkip.status()).toBe(200);
    const skipOut = await appendSkip.json();
    expect(skipOut && skipOut.appended).toBe(0);
    expect(skipOut && skipOut.skipped_existing_conflicts).toBe(1);

    const list3 = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(list3.status()).toBe(200);
    const items3 = await list3.json();
    expect(items3.length).toBe(2);
    const base = items3.find((it) => it && it.steps === '旧步骤');
    expect(base && base.priority).toBe('P1');

    const appendOverwrite = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items/append`, {
      headers,
      data: {
        overwrite_existing: true,
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '无', steps: '旧步骤', expected: '旧预期', remark: '覆盖' },
        ],
      },
    });
    expect(appendOverwrite.status()).toBe(200);
    const overOut = await appendOverwrite.json();
    expect(overOut && overOut.appended).toBe(0);
    expect(overOut && overOut.overwritten).toBeGreaterThan(0);

    const list4 = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(list4.status()).toBe(200);
    const items4 = await list4.json();
    expect(items4.length).toBe(2);
    const updated = items4.find((it) => it && it.steps === '旧步骤');
    expect(updated && updated.expected).toBe('旧预期');
    expect(updated && updated.priority).toBe('P0');
    expect(updated && updated.remark).toBe('覆盖');
  });
});
