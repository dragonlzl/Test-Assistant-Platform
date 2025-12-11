const { test, expect, request } = require('@playwright/test');

test.describe('非管理员项目可见性', () => {
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

  test('成员可读取自身项目分配并获取所属项目列表', async () => {
    const ctx = await request.newContext();
    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const projectName = 'member-proj-' + Date.now();
    const username = 'member_' + Date.now();
    const userPassword = 'Pwd123456';

    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectName, description: 'member only project' },
    });
    expect(createProj.status()).toBe(201);
    const projBody = await createProj.json();
    const projectId = projBody.id;

    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: username, password: userPassword, role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const userBody = await createUser.json();
    const userId = userBody.id;

    const assignRes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: userId, project_ids: [projectId] },
    });
    expect(assignRes.status()).toBe(200);

    const memberToken = await login(ctx, username, userPassword);
    const memberHeaders = { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' };

    const listRes = await ctx.get(`${apiBase}/api/projects`, { headers: memberHeaders });
    expect(listRes.status()).toBe(200);
    const projects = await listRes.json();
    expect(projects.some(function(p) { return p.id === projectId; })).toBeTruthy();

    const userProjectsRes = await ctx.get(`${apiBase}/api/users/${userId}/projects`, { headers: memberHeaders });
    expect(userProjectsRes.status()).toBe(200);
    const userProjects = await userProjectsRes.json();
    expect(userProjects.some(function(item) { return item.project_id === projectId; })).toBeTruthy();

    const forbidRes = await ctx.get(`${apiBase}/api/users/99999/projects`, { headers: memberHeaders });
    expect(forbidRes.status()).toBe(403);

    const delUser = await ctx.delete(`${apiBase}/api/users/${userId}`, { headers: adminHeaders });
    expect([200, 404]).toContain(delUser.status());
    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers: adminHeaders });
    expect([200, 404]).toContain(delProj.status());
  });
});
