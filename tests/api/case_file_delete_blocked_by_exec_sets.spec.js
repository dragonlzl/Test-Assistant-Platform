const { test, expect, request } = require('@playwright/test');

test.describe('case file delete guarded by exec sets', () => {
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

  test('执行集中存在关联用例文件时，删除用例库文件应被拦截；解散后可删除', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-file-delete-guard-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'case file delete guard api spec' },
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
        file_name: '删除拦截测试_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '无', steps: '1', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFileId = (await importRes.json()).id;

    const execSetRes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers,
      data: { project_id: projectId, version_id: versionId, name: 'exec-delete-guard', case_file_id: caseFileId },
    });
    expect(execSetRes.status()).toBe(201);
    const execSetId = (await execSetRes.json()).id;

    const deleteBlockedRes = await ctx.delete(`${apiBase}/api/case-files/${caseFileId}`, { headers });
    expect(deleteBlockedRes.status()).toBe(400);
    const blockedBody = await deleteBlockedRes.json();
    expect(blockedBody && blockedBody.detail).toBeTruthy();
    expect(blockedBody.detail && blockedBody.detail.detail).toContain('执行页');
    expect(blockedBody.detail && blockedBody.detail.detail).toContain('解散');

    const delExecSetRes = await ctx.delete(`${apiBase}/api/exec/sets/${execSetId}`, { headers });
    expect(delExecSetRes.status()).toBe(200);

    const deleteOkRes = await ctx.delete(`${apiBase}/api/case-files/${caseFileId}`, { headers });
    expect(deleteOkRes.status()).toBe(200);

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });
});

