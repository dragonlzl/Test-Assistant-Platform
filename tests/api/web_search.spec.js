const { test, expect, request } = require('@playwright/test');

test.describe('web search api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username, password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body && body.access_token).toBeTruthy();
    return body.access_token;
  }

  test('未鉴权不可访问，鉴权后支持参数校验与查询', async () => {
    const ctx = await request.newContext();

    const unauthorized = await ctx.get(`${apiBase}/api/web-search?q=深圳%20今天天气`);
    expect([401, 403]).toContain(unauthorized.status());

    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}` };

    const invalid = await ctx.get(`${apiBase}/api/web-search?q=%20%20%20`, { headers });
    expect(invalid.status()).toBe(400);
    const invalidBody = await invalid.json();
    expect(String((invalidBody && invalidBody.detail) || '')).toContain('搜索关键词不能为空');

    const okOrTransient = await ctx.get(`${apiBase}/api/web-search?q=${encodeURIComponent('深圳 今天天气')}&limit=99`, { headers });
    const status = okOrTransient.status();
    expect([200, 502, 504]).toContain(status);
    const body = await okOrTransient.json();

    if (status === 200) {
      expect(body && body.ok).toBe(true);
      expect(body.query).toBe('深圳 今天天气');
      expect(Array.isArray(body.items)).toBeTruthy();
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.length).toBeLessThanOrEqual(10);
      expect(typeof body.provider).toBe('string');
    } else {
      expect(String((body && body.detail) || '')).toContain('搜索');
    }
  });
});
