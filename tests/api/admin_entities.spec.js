const { test, expect, request } = require('@playwright/test');

test.describe('admin projects & users', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: adminUser, password: adminPass },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.access_token;
  }

  test('project CRUD + version + user CRUD/assign', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const projectName = 'autotest-' + Date.now();
    const username = 'user_' + Date.now();

    // create project
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'api spec project' },
    });
    expect(createProj.status()).toBe(201);
    const projBody = await createProj.json();
    const projectId = projBody.id;

    // create version
    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const verBody = await verRes.json();
    const versionId = verBody.id;

    // create user
    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username, password: 'Pwd123456', role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const userBody = await createUser.json();
    const userId = userBody.id;

    // assign project
    const assignRes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers,
      data: { user_id: userId, project_ids: [projectId] },
    });
    expect(assignRes.status()).toBe(200);

    // fetch user projects
    const userProjRes = await ctx.get(`${apiBase}/api/users/${userId}/projects`, { headers });
    expect(userProjRes.status()).toBe(200);
    const userProjects = await userProjRes.json();
    expect(userProjects.some(p => p.project_id === projectId)).toBeTruthy();

    // cleanup: delete user
    const delUser = await ctx.delete(`${apiBase}/api/users/${userId}`, { headers });
    expect(delUser.status()).toBe(200);

    // cleanup: delete version & project
    const delVer = await ctx.delete(`${apiBase}/api/projects/${projectId}/versions/${versionId}`, { headers });
    expect([200, 404]).toContain(delVer.status());
    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });
});
