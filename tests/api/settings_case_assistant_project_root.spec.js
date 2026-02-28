const { test, expect, request } = require('@playwright/test');

test.describe('settings caseAssistantProjectRoot', () => {
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

  test('可写入并读取 Case Assistant 项目路径设置', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const firstPath = 'E:/workspace/case-assistant-demo';
    const saveFirst = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: { scope: 'user', items: [{ key: 'caseAssistantProjectRoot', value_json: firstPath }] },
    });
    expect(saveFirst.status()).toBe(200);

    const listFirst = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listFirst.status()).toBe(200);
    const listBody = await listFirst.json();
    const record = listBody.find((item) => item.key === 'caseAssistantProjectRoot');
    expect(record).toBeTruthy();
    expect(record.value_json).toBe(firstPath);

    const secondPath = '/Users/tester/work/case-assistant-next';
    const saveSecond = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: { scope: 'user', items: [{ key: 'caseAssistantProjectRoot', value_json: secondPath }] },
    });
    expect(saveSecond.status()).toBe(200);

    const listSecond = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listSecond.status()).toBe(200);
    const listSecondBody = await listSecond.json();
    const updated = listSecondBody.find((item) => item.key === 'caseAssistantProjectRoot');
    expect(updated).toBeTruthy();
    expect(updated.value_json).toBe(secondPath);
  });
});
