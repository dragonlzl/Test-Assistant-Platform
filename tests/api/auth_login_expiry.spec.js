const fs = require('fs');
const path = require('path');
const { test, expect, request } = require('@playwright/test');

test.describe('auth login expiry', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';
  const defaultWeekMs = 7 * 24 * 60 * 60 * 1000;
  const toleranceMs = 10 * 60 * 1000;

  function parsePositiveNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  }

  function resolveTokenTtlMs() {
    const authConfigPath = path.resolve(__dirname, '../../config/auth.json');
    let data = null;
    try {
      const raw = fs.readFileSync(authConfigPath, 'utf-8');
      data = JSON.parse(raw);
    } catch (_) {
      data = null;
    }
    if (data && typeof data === 'object') {
      const minutes = parsePositiveNumber(data.token_ttl_minutes);
      if (minutes) return minutes * 60 * 1000;
      const days = parsePositiveNumber(data.token_ttl_days);
      if (days) return days * 24 * 60 * 60 * 1000;
    }
    return defaultWeekMs;
  }

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
    const expectedMs = resolveTokenTtlMs();
    expect(diff).toBeGreaterThan(expectedMs - toleranceMs);
    expect(diff).toBeLessThan(expectedMs + toleranceMs);
  });
});
