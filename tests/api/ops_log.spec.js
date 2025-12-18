const { test, expect, request } = require('@playwright/test');

test.describe('operation logs', () => {
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

  test('user can post event, admin can list, non-admin cannot list', async () => {
    const ctx = await request.newContext();
    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const username = 'ops_user_' + Date.now();
    const password = 'Pwd123456';
    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username, password, role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const created = await createUser.json();
    const userId = created.id;

    const userToken = await login(ctx, username, password);
    const userHeaders = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };

    const nonAdminList = await ctx.get(`${apiBase}/api/ops?limit=10`, { headers: userHeaders });
    expect([401, 403]).toContain(nonAdminList.status());

    const postEvent = await ctx.post(`${apiBase}/api/ops/event`, {
      headers: userHeaders,
      data: { action: 'export_case_files_xmind', target_type: 'case_file', target_id: 123, detail: { count: 1 } },
    });
    expect(postEvent.status()).toBe(201);
    const createdLog = await postEvent.json();
    expect(createdLog.action).toBe('export_case_files_xmind');
    expect(createdLog.user_id).toBe(userId);

    const adminList = await ctx.get(`${apiBase}/api/ops?limit=50`, { headers: adminHeaders });
    expect(adminList.status()).toBe(200);
    const list = await adminList.json();
    expect(Array.isArray(list)).toBeTruthy();
    expect(list.some((row) => row && row.action === 'export_case_files_xmind' && row.user_id === userId)).toBeTruthy();

    const delUser = await ctx.post(`${apiBase}/api/users/${userId}/delete`, {
      headers: adminHeaders,
      data: { admin_password: adminPass },
    });
    expect(delUser.status()).toBe(200);
  });
});

