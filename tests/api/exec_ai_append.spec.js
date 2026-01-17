const { test, expect, request } = require('@playwright/test');

test.describe('exec append cases api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: username, password: password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.access_token;
  }

  test('执行集追加用例可在列表中追加到末尾', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-ai-append-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec append api' },
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
        file_name: 'exec_ai_append_' + Date.now() + '.json',
        source: 'apitest',
        items: [{ module: '模块A', title: '原始用例', expected: 'ok', priority: 'P1', precondition: '', steps: '', remark: '' }],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFileId = (await importRes.json()).id;

    const execSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(execSetRes.status()).toBe(200);
    const execSetId = (await execSetRes.json()).id;

    const listBeforeRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(listBeforeRes.status()).toBe(200);
    const listBefore = await listBeforeRes.json();
    expect(Array.isArray(listBefore)).toBeTruthy();
    expect(listBefore.length).toBe(1);

    const createItemRes = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items`, {
      headers,
      data: {
        module: '模块A',
        title: '追加用例',
        expected: 'ok-new',
        priority: 'P2',
        precondition: '',
        steps: '',
        remark: '',
      },
    });
    expect(createItemRes.status()).toBe(201);
    const newItem = await createItemRes.json();

    const lastCaseId = listBefore[listBefore.length - 1].id;
    const appendRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases`, {
      headers,
      data: { case_item_id: newItem.id, status: '未执行', after_case_id: lastCaseId },
    });
    expect(appendRes.status()).toBe(201);

    const listAfterRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(listAfterRes.status()).toBe(200);
    const listAfter = await listAfterRes.json();
    expect(listAfter.length).toBe(2);
    expect(listAfter[listAfter.length - 1].title).toBe('追加用例');

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });
});
