const { test, expect, request } = require('@playwright/test');

test.describe('settings assistant keys', () => {
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

  test('可写入并读取 assistantEnabled/assistantModelId，普通用户不可写 global', async () => {
    const ctx = await request.newContext();

    const unauthorized = await ctx.get(`${apiBase}/api/settings?scope=all`);
    expect([401, 403]).toContain(unauthorized.status());

    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const username = 'assistant_cfg_user_' + Date.now();
    const password = 'Pwd123456';
    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username, password, role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const createdUser = await createUser.json();
    const userId = createdUser.id;

    const userToken = await login(ctx, username, password);
    const userHeaders = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };

    const saveAssistantSettings = await ctx.put(`${apiBase}/api/settings`, {
      headers: userHeaders,
      data: {
        scope: 'user',
        items: [
          { key: 'assistantEnabled', value_json: true },
          { key: 'assistantModelId', value_json: 'model-user-1' },
        ],
      },
    });
    expect(saveAssistantSettings.status()).toBe(200);

    const saveAssistantSettingsAgain = await ctx.put(`${apiBase}/api/settings`, {
      headers: userHeaders,
      data: {
        scope: 'user',
        items: [
          { key: 'assistantEnabled', value_json: false },
          { key: 'assistantModelId', value_json: 'model-user-2' },
        ],
      },
    });
    expect(saveAssistantSettingsAgain.status()).toBe(200);

    const userList = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers: userHeaders });
    expect(userList.status()).toBe(200);
    const userSettings = await userList.json();
    const enabledItem = userSettings.find((item) => item.key === 'assistantEnabled' && item.owner_id === userId);
    const modelItem = userSettings.find((item) => item.key === 'assistantModelId' && item.owner_id === userId);
    expect(enabledItem).toBeTruthy();
    expect(modelItem).toBeTruthy();
    expect(enabledItem.value_json).toBe(false);
    expect(modelItem.value_json).toBe('model-user-2');

    const denyGlobal = await ctx.put(`${apiBase}/api/settings`, {
      headers: userHeaders,
      data: {
        scope: 'global',
        items: [{ key: 'assistantEnabled', value_json: true }],
      },
    });
    expect(denyGlobal.status()).toBe(403);

    const saveGlobal = await ctx.put(`${apiBase}/api/settings`, {
      headers: adminHeaders,
      data: {
        scope: 'global',
        items: [
          { key: 'assistantEnabled', value_json: false },
          { key: 'assistantModelId', value_json: 'model-global' },
        ],
      },
    });
    expect(saveGlobal.status()).toBe(200);

    const listAfterGlobal = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers: userHeaders });
    expect(listAfterGlobal.status()).toBe(200);
    const settingsAfterGlobal = await listAfterGlobal.json();
    const globalEnabled = settingsAfterGlobal.find((item) => item.key === 'assistantEnabled' && item.owner_id === null);
    const globalModel = settingsAfterGlobal.find((item) => item.key === 'assistantModelId' && item.owner_id === null);
    expect(globalEnabled).toBeTruthy();
    expect(globalModel).toBeTruthy();
  });
});
