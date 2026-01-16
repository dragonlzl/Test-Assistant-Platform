const { test, expect, request } = require('@playwright/test');

test.describe('workflow nav api', () => {
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

  test('health and project list available for workflow usage', async () => {
    const ctx = await request.newContext();
    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}` };
    const projectRes = await ctx.get(`${apiBase}/api/projects`, { headers });
    expect(projectRes.status()).toBe(200);
  });
});
