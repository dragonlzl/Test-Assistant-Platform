const { test, expect, request } = require('@playwright/test');

test.describe('auth unauthorized access', () => {
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  test('rejects invalid token for current user', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${apiBase}/api/users/me`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect([401, 403]).toContain(res.status());
  });
});
