const { test, expect, request } = require('@playwright/test');

test.describe('case library change history api', () => {
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

  test('记录导入/重导/增删改/整份删除，并在删除后仍可查询历史', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'case-lib-history-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'case library history api' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '历史测试_' + Date.now() + '.json',
        source: 'apitest',
        items: [
          {
            module: '登录',
            title: '正常登录',
            expected: '登录成功',
            precondition: '已注册账号',
            steps: '旧步骤',
            priority: 'P0',
            remark: '',
          },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const fileNameClean = caseFile.file_name_clean;
    const caseFileId = caseFile.id;

    const listFilesRes = await ctx.get(
      `${apiBase}/api/case-files/change-history/files?project_id=${projectId}&version_id=${versionId}&limit=50`,
      { headers }
    );
    expect(listFilesRes.status()).toBe(200);
    const changedFiles = await listFilesRes.json();
    const found = Array.isArray(changedFiles)
      ? changedFiles.find((f) => f && f.project_id === projectId && f.file_name_clean === fileNameClean)
      : null;
    expect(found).toBeTruthy();
    expect(found && found.total_events).toBeGreaterThanOrEqual(1);
    expect(found && found.last_operator).toBe(adminUser);

    const historyRes = await ctx.get(
      `${apiBase}/api/case-files/change-history?project_id=${projectId}&file_name_clean=${encodeURIComponent(fileNameClean)}&limit=50`,
      { headers }
    );
    expect(historyRes.status()).toBe(200);
    const history = await historyRes.json();
    expect(history && history.project_id).toBe(projectId);
    expect(Array.isArray(history && history.history)).toBeTruthy();
    expect(history.history.some((h) => h && h.kind === 'import' && h.operator === adminUser)).toBeTruthy();

    const listItemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(listItemsRes.status()).toBe(200);
    const items = await listItemsRes.json();
    expect(items.length).toBe(1);
    const caseItemId = items[0].id;

    const patchRes = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers,
      data: { steps: '新步骤' },
    });
    expect(patchRes.status()).toBe(200);

    const createItemRes = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items`, {
      headers,
      data: { module: '登录', title: '新增用例', expected: 'ok', precondition: '', steps: '' },
    });
    expect(createItemRes.status()).toBe(201);
    const createdItem = await createItemRes.json();
    const deleteItemRes = await ctx.delete(`${apiBase}/api/case-files/items/${createdItem.id}`, { headers });
    expect(deleteItemRes.status()).toBe(200);

    const overwriteRes = await ctx.post(`${apiBase}/api/case-files/import?overwrite=1`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: fileNameClean + '.json',
        source: 'apitest',
        items: [
          { module: '登录', title: '覆盖后', expected: 'ok', steps: '覆盖步骤' },
        ],
      },
    });
    expect(overwriteRes.status()).toBe(200);

    const delFileRes = await ctx.delete(`${apiBase}/api/case-files/${caseFileId}`, { headers });
    expect(delFileRes.status()).toBe(200);

    const listFilesAfterDeleteRes = await ctx.get(
      `${apiBase}/api/case-files/change-history/files?project_id=${projectId}&version_id=${versionId}&limit=50`,
      { headers }
    );
    expect(listFilesAfterDeleteRes.status()).toBe(200);
    const changedFilesAfterDelete = await listFilesAfterDeleteRes.json();
    const afterDelete = Array.isArray(changedFilesAfterDelete)
      ? changedFilesAfterDelete.find((f) => f && f.project_id === projectId && f.file_name_clean === fileNameClean)
      : null;
    expect(afterDelete).toBeTruthy();
    expect(afterDelete && afterDelete.is_deleted).toBeTruthy();

    const historyAfterDeleteRes = await ctx.get(
      `${apiBase}/api/case-files/change-history?project_id=${projectId}&file_name_clean=${encodeURIComponent(fileNameClean)}&limit=200`,
      { headers }
    );
    expect(historyAfterDeleteRes.status()).toBe(200);
    const historyAfterDelete = await historyAfterDeleteRes.json();
    expect(historyAfterDelete && historyAfterDelete.is_deleted).toBeTruthy();
    expect(historyAfterDelete.history.some((h) => h && h.kind === 'updated')).toBeTruthy();
    expect(historyAfterDelete.history.some((h) => h && h.kind === 'added')).toBeTruthy();
    expect(historyAfterDelete.history.some((h) => h && h.kind === 'deleted')).toBeTruthy();
    expect(historyAfterDelete.history.some((h) => h && h.kind === 'reimport')).toBeTruthy();
    expect(historyAfterDelete.history.some((h) => h && h.kind === 'file_deleted')).toBeTruthy();

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect([200, 404]).toContain(delProj.status());
  });
});
