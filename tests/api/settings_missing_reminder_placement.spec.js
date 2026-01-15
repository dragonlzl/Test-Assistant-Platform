const { test, expect, request } = require('@playwright/test');

test.describe('settings missingCaseReminderPlacement', () => {
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

  test('可写入并读取易漏用例提醒区域设置', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const saveTop = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: { scope: 'user', items: [{ key: 'missingCaseReminderPlacement', value_json: 'top' }] },
    });
    expect(saveTop.status()).toBe(200);

    const listTop = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listTop.status()).toBe(200);
    const listTopBody = await listTop.json();
    const topRecord = listTopBody.find((item) => item.key === 'missingCaseReminderPlacement');
    expect(topRecord).toBeTruthy();
    expect(topRecord.value_json).toBe('top');

    const saveBottom = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: { scope: 'user', items: [{ key: 'missingCaseReminderPlacement', value_json: 'bottom' }] },
    });
    expect(saveBottom.status()).toBe(200);

    const listBottom = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listBottom.status()).toBe(200);
    const listBottomBody = await listBottom.json();
    const bottomRecord = listBottomBody.find((item) => item.key === 'missingCaseReminderPlacement');
    expect(bottomRecord).toBeTruthy();
    expect(bottomRecord.value_json).toBe('bottom');
  });

  test('可写入并读取易漏用例命中设定', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const matchConfig = { type: true, module: false };

    const saveMatch = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: { scope: 'user', items: [{ key: 'missingCaseReminderMatchConfig', value_json: matchConfig }] },
    });
    expect(saveMatch.status()).toBe(200);

    const listMatch = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listMatch.status()).toBe(200);
    const listMatchBody = await listMatch.json();
    const matchRecord = listMatchBody.find((item) => item.key === 'missingCaseReminderMatchConfig');
    expect(matchRecord).toBeTruthy();
    expect(matchRecord.value_json).toEqual(matchConfig);
  });
});
