const { test, expect, request } = require('@playwright/test');

test.describe('missing cases api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: username, password: password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body && body.access_token).toBeTruthy();
    return body.access_token;
  }

  test('易漏模块与条目 CRUD', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-missing-case-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'missing case api spec' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const createTypeA = await ctx.post(`${apiBase}/api/missing-types`, {
      headers,
      data: { project_id: projectId, name: '类型A' },
    });
    expect(createTypeA.status()).toBe(201);
    const typeA = await createTypeA.json();
    expect(typeA && typeA.id).toBeTruthy();

    const createTypeB = await ctx.post(`${apiBase}/api/missing-types`, {
      headers,
      data: { project_id: projectId, name: '类型B' },
    });
    expect(createTypeB.status()).toBe(201);
    const typeB = await createTypeB.json();
    expect(typeB && typeB.id).toBeTruthy();

    const dupType = await ctx.post(`${apiBase}/api/missing-types`, {
      headers,
      data: { project_id: projectId, name: '类型A' },
    });
    expect(dupType.status()).toBe(409);

    const listTypes = await ctx.get(`${apiBase}/api/missing-types?project_id=${projectId}`, { headers });
    expect(listTypes.status()).toBe(200);
    const types = await listTypes.json();
    expect(Array.isArray(types)).toBe(true);
    expect(types.find((t) => String(t.id) === String(typeA.id))).toBeTruthy();

    const createModule = await ctx.post(`${apiBase}/api/missing-modules`, {
      headers,
      data: { project_id: projectId, name: '模块A' },
    });
    expect(createModule.status()).toBe(201);
    const module = await createModule.json();
    expect(module && module.id).toBeTruthy();

    const createModuleB = await ctx.post(`${apiBase}/api/missing-modules`, {
      headers,
      data: { project_id: projectId, name: '模块B' },
    });
    expect(createModuleB.status()).toBe(201);
    const moduleB = await createModuleB.json();
    expect(moduleB && moduleB.id).toBeTruthy();

    const dupRes = await ctx.post(`${apiBase}/api/missing-modules`, {
      headers,
      data: { project_id: projectId, name: '模块A' },
    });
    expect(dupRes.status()).toBe(409);

    const listModules = await ctx.get(`${apiBase}/api/missing-modules?project_id=${projectId}`, { headers });
    expect(listModules.status()).toBe(200);
    const modules = await listModules.json();
    expect(Array.isArray(modules)).toBe(true);
    expect(modules.find((m) => String(m.id) === String(module.id))).toBeTruthy();

    const createItem = await ctx.post(`${apiBase}/api/missing-modules/${module.id}/items`, {
      headers,
      data: { title: '易漏用例1', priority: 'P1', precondition: '无', steps: '步骤1', expected: '应提示', type_id: typeA.id },
    });
    expect(createItem.status()).toBe(201);
    const item = await createItem.json();
    expect(item && item.id).toBeTruthy();
    expect(item.module_name).toBe('模块A');
    expect(item.title).toBe('易漏用例1');
    expect(item.priority).toBe('P1');
    expect(String(item.type_id)).toBe(String(typeA.id));
    expect(item.type_name).toBe('类型A');

    const renameDup = await ctx.patch(`${apiBase}/api/missing-modules/${module.id}`, {
      headers,
      data: { name: '模块B' },
    });
    expect(renameDup.status()).toBe(409);

    const renameOk = await ctx.patch(`${apiBase}/api/missing-modules/${module.id}`, {
      headers,
      data: { name: '模块A-更新' },
    });
    expect(renameOk.status()).toBe(200);
    const renamed = await renameOk.json();
    expect(renamed.name).toBe('模块A-更新');

    const listItems = await ctx.get(`${apiBase}/api/missing-modules/${module.id}/items`, { headers });
    expect(listItems.status()).toBe(200);
    const items = await listItems.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(1);
    expect(String(items[0].type_id)).toBe(String(typeA.id));

    const inUseDelete = await ctx.delete(`${apiBase}/api/missing-types/${typeA.id}`, { headers });
    expect(inUseDelete.status()).toBe(409);
    const inUseBody = await inUseDelete.json();
    const inUseDetail = inUseBody && inUseBody.detail ? inUseBody.detail : {};
    expect(inUseDetail.code).toBe('MISSING_TYPE_IN_USE');

    const transferDelete = await ctx.delete(`${apiBase}/api/missing-types/${typeA.id}?transfer_to=${typeB.id}`, { headers });
    expect(transferDelete.status()).toBe(200);

    const listAfterTransfer = await ctx.get(`${apiBase}/api/missing-modules/${module.id}/items`, { headers });
    expect(listAfterTransfer.status()).toBe(200);
    const itemsAfter = await listAfterTransfer.json();
    expect(itemsAfter.length).toBe(1);
    expect(String(itemsAfter[0].type_id)).toBe(String(typeB.id));

    const typeFilterModules = await ctx.get(`${apiBase}/api/missing-modules?project_id=${projectId}&type_ids=${typeB.id}`, { headers });
    expect(typeFilterModules.status()).toBe(200);
    const modulesByType = await typeFilterModules.json();
    expect(modulesByType.find((m) => String(m.id) === String(module.id))).toBeTruthy();

    const updateItem = await ctx.patch(`${apiBase}/api/missing-modules/items/${item.id}`, {
      headers,
      data: { title: '易漏用例1-更新', expected: '应弹窗' },
    });
    expect(updateItem.status()).toBe(200);
    const updated = await updateItem.json();
    expect(updated.expected).toBe('应弹窗');
    expect(updated.title).toBe('易漏用例1-更新');

    const deleteItem = await ctx.delete(`${apiBase}/api/missing-modules/items/${item.id}`, { headers });
    expect(deleteItem.status()).toBe(200);

    const newUserName = `missing-type-user-${Date.now()}`;
    const newUserPass = 'missing-type-pass';
    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username: newUserName, password: newUserPass, role: 'user', level: 'member' },
    });
    expect(createUser.status()).toBe(201);
    const userId = (await createUser.json()).id;

    const assignProjects = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers,
      data: { user_id: userId, project_ids: [projectId] },
    });
    expect(assignProjects.status()).toBe(200);

    const userToken = await login(ctx, newUserName, newUserPass);
    const userHeaders = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };
    const deleteByUser = await ctx.delete(`${apiBase}/api/missing-types/${typeB.id}`, { headers: userHeaders });
    expect(deleteByUser.status()).toBe(403);

    const deleteTypeB = await ctx.delete(`${apiBase}/api/missing-types/${typeB.id}`, { headers });
    expect(deleteTypeB.status()).toBe(200);

    const deleteModule = await ctx.delete(`${apiBase}/api/missing-modules/${moduleB.id}`, { headers });
    expect(deleteModule.status()).toBe(200);

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });
});
