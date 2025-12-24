const { test, expect, request } = require('@playwright/test');

test.describe('case library change version api', () => {
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

  test('admin can change case file version', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'change-ver-' + Date.now();
    const createProject = await ctx.post(`${apiBase}/api/projects`, {
      headers: headers,
      data: { name: projectName, description: 'change version api' },
    });
    expect(createProject.status()).toBe(201);
    const project = await createProject.json();

    const version1Res = await ctx.post(`${apiBase}/api/projects/${project.id}/versions`, {
      headers: headers,
      data: { name: 'v1' },
    });
    expect(version1Res.status()).toBe(201);
    const version1 = await version1Res.json();

    const version2Res = await ctx.post(`${apiBase}/api/projects/${project.id}/versions`, {
      headers: headers,
      data: { name: 'v2' },
    });
    expect(version2Res.status()).toBe(201);
    const version2 = await version2Res.json();

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers: headers,
      data: {
        project_id: project.id,
        version_id: version1.id,
        file_name: '切换版本用例_result_20251215101010.json',
        source: 'apitest',
        items: [
          {
            module: '登录',
            title: '正常登录',
            priority: 'P0',
            precondition: '已注册账号',
            steps: '1. 输入账号\n2. 输入密码\n3. 点击登录',
            expected: '登录成功',
            remark: '',
          },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    expect(caseFile.version_id).toBe(version1.id);

    const changeRes = await ctx.post(`${apiBase}/api/case-files/change-version`, {
      headers: headers,
      data: {
        project_id: project.id,
        target_version_id: version2.id,
        case_file_ids: [caseFile.id],
      },
    });
    expect(changeRes.status()).toBe(200);
    const changeBody = await changeRes.json();
    expect(changeBody.updated_ids).toContain(caseFile.id);

    const listRes = await ctx.get(`${apiBase}/api/case-files?project_id=${project.id}`, { headers: headers });
    expect(listRes.status()).toBe(200);
    const list = await listRes.json();
    const updated = list.find((item) => item.id === caseFile.id);
    expect(updated && updated.version_id).toBe(version2.id);

    const delProject = await ctx.delete(`${apiBase}/api/projects/${project.id}`, { headers: headers });
    expect([200, 404]).toContain(delProject.status());
  });
});
