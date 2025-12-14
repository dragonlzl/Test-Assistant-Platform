const { test, expect, request } = require('@playwright/test');

test.describe('case library api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: username, password: password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.access_token;
  }

  test('import/list/update/to-exec basic flow', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'case-lib-proj-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'case lib api' },
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
        file_name: '勾选用例-登录_result_20251213121212.json',
        source: 'apitest',
        items: [
          {
            module: '登录',
            title: '正常登录',
            priority: 'P0',
            precondition: '已注册账号',
            steps: '1. 输入账号\\n2. 输入密码\\n3. 点击登录',
            expected: '登录成功',
            remark: '',
          },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    expect(caseFile.file_name_clean).toBe('登录');
    const caseFileId = caseFile.id;

    const importSpaceRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '勾选用例 账号登录_result_20251213121212.json',
        source: 'apitest',
        items: [
          {
            module: '登录',
            title: '账号登录',
            expected: 'ok',
          },
        ],
      },
    });
    expect(importSpaceRes.status()).toBe(201);
    const caseFileSpace = await importSpaceRes.json();
    expect(caseFileSpace.file_name_clean).toBe('账号登录');

    const importUnicodeSepRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '勾选用例　全角空格测试_result_20251213121212.json',
        source: 'apitest',
        items: [
          {
            module: '登录',
            title: '全角空格测试',
            expected: 'ok',
          },
        ],
      },
    });
    expect(importUnicodeSepRes.status()).toBe(201);
    const caseFileUnicodeSep = await importUnicodeSepRes.json();
    expect(caseFileUnicodeSep.file_name_clean).toBe('全角空格测试');

    const importRes2 = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '武器大师任务_result_20251209170512_result_20251209170546.xmind',
        source: 'apitest',
        items: [
          {
            module: '冒烟',
            title: '正常进入',
            expected: '进入成功',
          },
        ],
      },
    });
    expect(importRes2.status()).toBe(201);
    const caseFile2 = await importRes2.json();
    expect(caseFile2.file_name_clean).toBe('武器大师任务');

    const dupRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '登录.json',
        items: [
          {
            module: '登录',
            title: '重复导入',
            expected: 'x',
          },
        ],
      },
    });
    expect(dupRes.status()).toBe(400);

    const verRes2 = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v2' },
    });
    expect(verRes2.status()).toBe(201);
    const versionId2 = (await verRes2.json()).id;
    const crossVerRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId2,
        file_name: '登录.json',
        items: [
          {
            module: '登录',
            title: '跨版本允许同名',
            expected: 'ok',
          },
        ],
      },
    });
    expect(crossVerRes.status()).toBe(201);

    const listFilesRes = await ctx.get(`${apiBase}/api/case-files?project_id=${projectId}`, { headers });
    expect(listFilesRes.status()).toBe(200);
    const listFiles = await listFilesRes.json();
    expect(listFiles.some((f) => f.id === caseFileId)).toBeTruthy();
    const listed = listFiles.find((f) => f.id === caseFileId);
    expect(listed.importer_name).toBe(adminUser);
    expect(listed.last_updated_by_name).toBe(adminUser);

    const listItemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(listItemsRes.status()).toBe(200);
    const items = await listItemsRes.json();
    expect(items.length).toBe(1);
    const caseItemId = items[0].id;

    const dupInFileRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '重复条目测试.json',
        source: 'apitest',
        items: [
          { module: '登录', title: '重复条目', expected: 'ok' },
          { module: '登录', title: '重复条目', expected: 'ok' },
        ],
      },
    });
    expect(dupInFileRes.status()).toBe(201);
    const dupInFile = await dupInFileRes.json();
    const dupItemsRes = await ctx.get(`${apiBase}/api/case-files/${dupInFile.id}/items`, { headers });
    expect(dupItemsRes.status()).toBe(200);
    const dupItems = await dupItemsRes.json();
    expect(dupItems.length).toBe(1);

    const patchRes = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers,
      data: { title: '正常登录（已更新）', module: '登录', expected: items[0].expected },
    });
    expect(patchRes.status()).toBe(200);
    const patched = await patchRes.json();
    expect(patched.title).toBe('正常登录（已更新）');

    const createItemRes = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items`, {
      headers,
      data: {
        module: '登录',
        title: '新增用例',
        expected: 'ok',
        priority: 'P1',
        precondition: '',
        steps: '',
        remark: '',
      },
    });
    expect(createItemRes.status()).toBe(201);
    const createdItem = await createItemRes.json();
    expect(createdItem && createdItem.id).toBeTruthy();

    const deleteItemRes = await ctx.delete(`${apiBase}/api/case-files/items/${createdItem.id}`, { headers });
    expect(deleteItemRes.status()).toBe(200);

    const execSetRes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers,
      data: { project_id: projectId, version_id: versionId, name: 'exec-from-case-lib', source: 'case_file:' + caseFileId },
    });
    expect(execSetRes.status()).toBe(201);
    const execSetId = (await execSetRes.json()).id;

    const addRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases/from-library`, {
      headers,
      data: { case_item_ids: [caseItemId] },
    });
    expect(addRes.status()).toBe(201);

    const listExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(listExecCasesRes.status()).toBe(200);
    const execCases = await listExecCasesRes.json();
    expect(execCases.length).toBe(1);

    const dupAdd = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases/from-library`, {
      headers,
      data: { case_item_ids: [caseItemId] },
    });
    expect(dupAdd.status()).toBe(400);

    // cleanup
    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect([200, 404]).toContain(delProj.status());
  });
});
