const { test, expect, request } = require('@playwright/test');

test.describe('case library share api', () => {
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

  test('member can share case file to other project and detect duplicates', async () => {
    const ctx = await request.newContext();
    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectNameA = 'share-src-' + Date.now();
    const projectNameB = 'share-dst-' + Date.now();

    const createProjA = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectNameA, description: 'share source' },
    });
    expect(createProjA.status()).toBe(201);
    const projectA = await createProjA.json();

    const createProjB = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectNameB, description: 'share target' },
    });
    expect(createProjB.status()).toBe(201);
    const projectB = await createProjB.json();

    const versionARes = await ctx.post(`${apiBase}/api/projects/${projectA.id}/versions`, {
      headers: adminHeaders,
      data: { name: 'v1' },
    });
    expect(versionARes.status()).toBe(201);
    const versionA = await versionARes.json();

    const versionBRes = await ctx.post(`${apiBase}/api/projects/${projectB.id}/versions`, {
      headers: adminHeaders,
      data: { name: 'v1' },
    });
    expect(versionBRes.status()).toBe(201);
    const versionB = await versionBRes.json();

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers: adminHeaders,
      data: {
        project_id: projectA.id,
        version_id: versionA.id,
        file_name: '共享登录用例_result_20251213121212.json',
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
          {
            module: '登录',
            title: '密码错误',
            priority: 'P1',
            precondition: '已注册账号',
            steps: '1. 输入账号\n2. 输入错误密码\n3. 点击登录',
            expected: '提示错误',
            remark: '',
          },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const sourceCaseFile = await importRes.json();

    const username = 'share_user_' + Date.now();
    const userPassword = 'Pwd123456';
    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: username, password: userPassword, role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const user = await createUser.json();

    const assignRes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: user.id, project_ids: [projectA.id] },
    });
    expect(assignRes.status()).toBe(200);

    const userToken = await login(ctx, username, userPassword);
    const userHeaders = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };

    const shareProjectsRes = await ctx.get(`${apiBase}/api/projects?scope=share`, { headers: userHeaders });
    expect(shareProjectsRes.status()).toBe(200);
    const shareProjects = await shareProjectsRes.json();
    expect(shareProjects.some((item) => item.id === projectB.id)).toBeTruthy();

    const shareVersionsRes = await ctx.get(`${apiBase}/api/projects/${projectB.id}/versions?scope=share`, {
      headers: userHeaders,
    });
    expect(shareVersionsRes.status()).toBe(200);
    const shareVersions = await shareVersionsRes.json();
    expect(shareVersions.some((item) => item.id === versionB.id)).toBeTruthy();

    const shareRes = await ctx.post(`${apiBase}/api/case-files/share`, {
      headers: userHeaders,
      data: {
        case_file_id: sourceCaseFile.id,
        target_project_id: projectB.id,
        target_version_id: versionB.id,
      },
    });
    expect(shareRes.status()).toBe(201);
    const sharedCaseFile = await shareRes.json();
    expect(sharedCaseFile.project_id).toBe(projectB.id);
    expect(sharedCaseFile.file_name_clean).toBe(sourceCaseFile.file_name_clean);

    const dupRes = await ctx.post(`${apiBase}/api/case-files/share`, {
      headers: userHeaders,
      data: {
        case_file_id: sourceCaseFile.id,
        target_project_id: projectB.id,
        target_version_id: versionB.id,
      },
    });
    expect(dupRes.status()).toBe(409);

    const listFilesRes = await ctx.get(`${apiBase}/api/case-files?project_id=${projectB.id}`, { headers: adminHeaders });
    expect(listFilesRes.status()).toBe(200);
    const listFiles = await listFilesRes.json();
    expect(listFiles.some((item) => item.id === sharedCaseFile.id)).toBeTruthy();

    const listItemsRes = await ctx.get(`${apiBase}/api/case-files/${sharedCaseFile.id}/items`, { headers: adminHeaders });
    expect(listItemsRes.status()).toBe(200);
    const listItems = await listItemsRes.json();
    expect(listItems.length).toBe(2);

    const delUser = await ctx.post(`${apiBase}/api/users/${user.id}/delete`, {
      headers: adminHeaders,
      data: { admin_password: adminPass },
    });
    expect([200, 404]).toContain(delUser.status());
    const delProjA = await ctx.delete(`${apiBase}/api/projects/${projectA.id}`, { headers: adminHeaders });
    expect([200, 404]).toContain(delProjA.status());
    const delProjB = await ctx.delete(`${apiBase}/api/projects/${projectB.id}`, { headers: adminHeaders });
    expect([200, 404]).toContain(delProjB.status());
  });
});
