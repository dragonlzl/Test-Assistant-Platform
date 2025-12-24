const { test, expect, request } = require('@playwright/test');

test.describe('settings/models/features + ops api', () => {
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

  test('settings, model configs, feature assignments scoped & permissioned', async () => {
    const ctx = await request.newContext();
    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const username = 'cfg_user_' + Date.now();
    const password = 'Pwd123456';
    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username, password, role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const userBody = await createUser.json();
    const userId = userBody.id;

    const userToken = await login(ctx, username, password);
    const userHeaders = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };

    // user scoped settings
    const saveUserSettings = await ctx.put(`${apiBase}/api/settings`, {
      headers: userHeaders,
      data: { scope: 'user', items: [{ key: 'page_size', value_json: { size: 30 } }] },
    });
    expect(saveUserSettings.status()).toBe(200);
    const userSettings = await saveUserSettings.json();
    expect(userSettings[0].owner_id).toBe(userId);

    const denyGlobalSettings = await ctx.put(`${apiBase}/api/settings`, {
      headers: userHeaders,
      data: { scope: 'global', items: [{ key: 'global_only', value_json: {} }] },
    });
    expect(denyGlobalSettings.status()).toBe(403);

    const saveGlobalSettings = await ctx.put(`${apiBase}/api/settings`, {
      headers: adminHeaders,
      data: { scope: 'global', items: [{ key: 'page_size', value_json: { size: 50 } }] },
    });
    expect(saveGlobalSettings.status()).toBe(200);

    const listUserSettings = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers: userHeaders });
    expect(listUserSettings.status()).toBe(200);
    const listBody = await listUserSettings.json();
    const hasGlobal = listBody.some((item) => item.owner_id === null && item.key === 'page_size');
    const hasUser = listBody.some((item) => item.owner_id === userId && item.key === 'page_size');
    expect(hasGlobal).toBeTruthy();
    expect(hasUser).toBeTruthy();

    const saveExecSettings = await ctx.put(`${apiBase}/api/settings`, {
      headers: userHeaders,
      data: {
        scope: 'user',
        items: [
          { key: 'tempExecColumns', value_json: { select: true, module: true, priority: false, steps: true } },
          { key: 'tempExecPageSize', value_json: 33 },
          { key: 'pageGuideSwitches', value_json: { auto: false, clean: true, tempexec: false } },
          { key: 'theme', value_json: 'dark' },
          { key: 'otherSettingsDemo', value_json: { enabled: true } },
        ],
      },
    });
    expect(saveExecSettings.status()).toBe(200);

    const listExecSettings = await ctx.get(`${apiBase}/api/settings?scope=all`, { headers: userHeaders });
    expect(listExecSettings.status()).toBe(200);
    const execSettingsBody = await listExecSettings.json();
    const pageSizeSetting = execSettingsBody.find((item) => item.key === 'tempExecPageSize' && item.owner_id === userId);
    expect(pageSizeSetting.value_json).toBe(33);
    const columnsSetting = execSettingsBody.find((item) => item.key === 'tempExecColumns' && item.owner_id === userId);
    expect(columnsSetting.value_json && columnsSetting.value_json.priority).toBe(false);
    const otherSetting = execSettingsBody.find((item) => item.key === 'otherSettingsDemo' && item.owner_id === userId);
    expect(otherSetting && otherSetting.value_json && otherSetting.value_json.enabled).toBe(true);
    const guideSetting = execSettingsBody.find((item) => item.key === 'pageGuideSwitches' && item.owner_id === userId);
    expect(guideSetting && guideSetting.value_json && guideSetting.value_json.auto).toBe(false);
    const themeSetting = execSettingsBody.find((item) => item.key === 'theme' && item.owner_id === userId);
    expect(themeSetting && themeSetting.value_json).toBe('dark');

    // model configs
    const createUserModel = await ctx.post(`${apiBase}/api/models`, {
      headers: userHeaders,
      data: { name: 'user-model-' + Date.now(), config_json: { key: 'v1' } },
    });
    expect(createUserModel.status()).toBe(201);
    const userModel = await createUserModel.json();

    const denyGlobalModel = await ctx.post(`${apiBase}/api/models`, {
      headers: userHeaders,
      data: { name: 'global-model-try', scope: 'global', config_json: {} },
    });
    expect(denyGlobalModel.status()).toBe(403);

    const createGlobalModel = await ctx.post(`${apiBase}/api/models`, {
      headers: adminHeaders,
      data: { name: 'global-model-' + Date.now(), scope: 'global', config_json: { provider: 'openai' } },
    });
    expect(createGlobalModel.status()).toBe(201);
    const globalModel = await createGlobalModel.json();

    const userModelsList = await ctx.get(`${apiBase}/api/models?scope=all`, { headers: userHeaders });
    expect(userModelsList.status()).toBe(200);
    const userModels = await userModelsList.json();
    const hasUserModel = userModels.some((m) => m.id === userModel.id);
    const hasGlobalModel = userModels.some((m) => m.id === globalModel.id);
    expect(hasUserModel).toBeTruthy();
    expect(hasGlobalModel).toBeTruthy();

    const updateUserModel = await ctx.patch(`${apiBase}/api/models/${userModel.id}`, {
      headers: userHeaders,
      data: { config_json: { key: 'v2' }, is_active: false },
    });
    expect(updateUserModel.status()).toBe(200);
    const updatedUserModel = await updateUserModel.json();
    expect(updatedUserModel.is_active).toBeFalsy();

    const denyUpdateGlobalModel = await ctx.patch(`${apiBase}/api/models/${globalModel.id}`, {
      headers: userHeaders,
      data: { is_active: false },
    });
    expect(denyUpdateGlobalModel.status()).toBe(403);

    const adminUpdateGlobalModel = await ctx.patch(`${apiBase}/api/models/${globalModel.id}`, {
      headers: adminHeaders,
      data: { is_active: false },
    });
    expect(adminUpdateGlobalModel.status()).toBe(200);

    // feature assignments
    const createUserFeature = await ctx.post(`${apiBase}/api/features`, {
      headers: userHeaders,
      data: { name: 'feature-user-' + Date.now(), config_json: { temperature: 0.2 } },
    });
    expect(createUserFeature.status()).toBe(201);
    const userFeature = await createUserFeature.json();

    const denyGlobalFeature = await ctx.post(`${apiBase}/api/features`, {
      headers: userHeaders,
      data: { name: 'feature-global-try', scope: 'global', config_json: {} },
    });
    expect(denyGlobalFeature.status()).toBe(403);

    const createGlobalFeature = await ctx.post(`${apiBase}/api/features`, {
      headers: adminHeaders,
      data: { name: 'feature-global-' + Date.now(), scope: 'global', config_json: { prompt: 'p' } },
    });
    expect(createGlobalFeature.status()).toBe(201);
    const globalFeature = await createGlobalFeature.json();

    const updateUserFeature = await ctx.patch(`${apiBase}/api/features/${userFeature.id}`, {
      headers: userHeaders,
      data: { config_json: { temperature: 0.3 } },
    });
    expect(updateUserFeature.status()).toBe(200);
    const updatedFeature = await updateUserFeature.json();
    expect(updatedFeature.config_json.temperature).toBe(0.3);

    const denyUpdateGlobalFeature = await ctx.patch(`${apiBase}/api/features/${globalFeature.id}`, {
      headers: userHeaders,
      data: { config_json: { prompt: 'override' } },
    });
    expect(denyUpdateGlobalFeature.status()).toBe(403);

    // operation logs
    const adminOps = await ctx.get(`${apiBase}/api/ops?limit=50`, { headers: adminHeaders });
    expect(adminOps.status()).toBe(200);
    const opsBody = await adminOps.json();
    expect(opsBody.length).toBeGreaterThan(0);
    expect(opsBody.some((op) => op.action && op.action.length > 0)).toBeTruthy();

    const userOps = await ctx.get(`${apiBase}/api/ops`, { headers: userHeaders });
    expect(userOps.status()).toBe(403);
  });
});
