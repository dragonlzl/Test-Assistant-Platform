const { test, expect, request } = require('@playwright/test');

test.describe('auth login expiry', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const toleranceMs = 10 * 60 * 1000;

  test('login token expires in about 7 days', async () => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: adminUser, password: adminPass },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body && body.expires_at).toBeTruthy();
    const expiresAt = new Date(body.expires_at).getTime();
    expect(Number.isNaN(expiresAt)).toBeFalsy();
    const diff = expiresAt - Date.now();
    expect(diff).toBeGreaterThan(weekMs - toleranceMs);
    expect(diff).toBeLessThan(weekMs + toleranceMs);
  });
});
