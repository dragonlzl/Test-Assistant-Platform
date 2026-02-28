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

    const savePath = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: {
        scope: 'user',
        items: [{ key: 'caseAssistantProjectRoot', value_json: 'E:/workspace/demo-project' }],
      },
    });
    expect(savePath.status()).toBe(200);

    const listPath = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listPath.status()).toBe(200);
    const listPathBody = await listPath.json();
    const record = listPathBody.find((item) => item.key === 'caseAssistantProjectRoot');
    expect(record).toBeTruthy();
    expect(record.value_json).toBe('E:/workspace/demo-project');

    const clearPath = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: {
        scope: 'user',
        items: [{ key: 'caseAssistantProjectRoot', value_json: '' }],
      },
    });
    expect(clearPath.status()).toBe(200);

    const listAfterClear = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listAfterClear.status()).toBe(200);
    const listAfterClearBody = await listAfterClear.json();
    const cleared = listAfterClearBody.find((item) => item.key === 'caseAssistantProjectRoot');
    expect(cleared).toBeTruthy();
    expect(cleared.value_json).toBe('');
  });
});
