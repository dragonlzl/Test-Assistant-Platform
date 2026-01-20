const { test, expect, request } = require('@playwright/test');

test.describe('settings caseGenAgent', () => {
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

  test('可写入并读取用例生成 Agent 设置', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const saveFirst = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: {
        scope: 'user',
        items: [
          { key: 'caseGenAgentEnabled', value_json: 'on' },
          { key: 'caseGenAgentCoverageThreshold', value_json: 82 },
        ],
      },
    });
    expect(saveFirst.status()).toBe(200);

    const listFirst = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listFirst.status()).toBe(200);
    const listBody = await listFirst.json();
    const enabledRecord = listBody.find((item) => item.key === 'caseGenAgentEnabled');
    const thresholdRecord = listBody.find((item) => item.key === 'caseGenAgentCoverageThreshold');
    expect(enabledRecord).toBeTruthy();
    expect(thresholdRecord).toBeTruthy();
    expect(enabledRecord.value_json).toBe('on');
    expect(thresholdRecord.value_json).toBe(82);

    const saveSecond = await ctx.put(`${apiBase}/api/settings`, {
      headers,
      data: {
        scope: 'user',
        items: [
          { key: 'caseGenAgentEnabled', value_json: 'off' },
          { key: 'caseGenAgentCoverageThreshold', value_json: 75 },
        ],
      },
    });
    expect(saveSecond.status()).toBe(200);

    const listSecond = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers });
    expect(listSecond.status()).toBe(200);
    const listSecondBody = await listSecond.json();
    const updatedEnabled = listSecondBody.find((item) => item.key === 'caseGenAgentEnabled');
    const updatedThreshold = listSecondBody.find((item) => item.key === 'caseGenAgentCoverageThreshold');
    expect(updatedEnabled).toBeTruthy();
    expect(updatedThreshold).toBeTruthy();
    expect(updatedEnabled.value_json).toBe('off');
    expect(updatedThreshold.value_json).toBe(75);
  });
});
