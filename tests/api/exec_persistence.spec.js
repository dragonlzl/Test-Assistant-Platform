const { test, expect, request } = require('@playwright/test');

test.describe('exec persistence api', () => {
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

  test('upsert/patch sync/archive restore/create-by-case_item', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-proj-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec persistence api' },
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
        file_name: '勾选用例-执行入库_result_20251213121212.json',
        source: 'apitest',
        items: [
          { module: '模块A', title: '用例A', expected: 'ok', priority: 'P0', precondition: '', steps: '', remark: '' },
          { module: '模块A', title: '用例B', expected: 'ok', priority: 'P1', precondition: '', steps: '', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const itemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsRes.status()).toBe(200);
    const items = await itemsRes.json();
    expect(items.length).toBe(2);

    const upsertRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertRes.status()).toBe(200);
    const execSet = await upsertRes.json();
    expect(execSet && execSet.id).toBeTruthy();
    expect(execSet.project_id).toBe(projectId);
    expect(execSet.version_id).toBe(versionId);
    expect(execSet.case_file_id).toBe(caseFileId);
    expect(execSet.status).toBe('active');
    const execSetId = execSet.id;

    // 执行集按用户隔离：同一个 case_file，不同用户应各自拥有一份 exec_set，且互不可访问/覆盖。
    const otherUsername = 'exec-user-' + Date.now();
    const createUserRes = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username: otherUsername, role: 'user', level: 'member' },
    });
    expect(createUserRes.status()).toBe(201);
    const otherUser = await createUserRes.json();
    expect(otherUser && otherUser.id).toBeTruthy();

    const assignRes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers,
      data: { user_id: otherUser.id, project_ids: [projectId] },
    });
    expect(assignRes.status()).toBe(200);

    const otherToken = await login(ctx, otherUsername, '12345678');
    const otherHeaders = { Authorization: `Bearer ${otherToken}`, 'Content-Type': 'application/json' };

    const otherUpsertRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: otherHeaders,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(otherUpsertRes.status()).toBe(200);
    const otherExecSet = await otherUpsertRes.json();
    expect(otherExecSet && otherExecSet.id).toBeTruthy();
    expect(otherExecSet.id).not.toBe(execSetId);
    expect(otherExecSet.case_file_id).toBe(caseFileId);

    const listMineRes = await ctx.get(`${apiBase}/api/exec/sets?project_id=${projectId}`, { headers });
    expect(listMineRes.status()).toBe(200);
    const mineSets = await listMineRes.json();
    expect(Array.isArray(mineSets)).toBeTruthy();
    expect(mineSets.some((s) => s && s.id === execSetId)).toBeTruthy();
    expect(mineSets.some((s) => s && s.id === otherExecSet.id)).toBeFalsy();

    const listOtherRes = await ctx.get(`${apiBase}/api/exec/sets?project_id=${projectId}`, { headers: otherHeaders });
    expect(listOtherRes.status()).toBe(200);
    const otherSets = await listOtherRes.json();
    expect(Array.isArray(otherSets)).toBeTruthy();
    expect(otherSets.some((s) => s && s.id === otherExecSet.id)).toBeTruthy();
    expect(otherSets.some((s) => s && s.id === execSetId)).toBeFalsy();

    const forbiddenRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers: otherHeaders });
    expect(forbiddenRes.status()).toBe(403);

    const listExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(listExecCasesRes.status()).toBe(200);
    const execCases = await listExecCasesRes.json();
    expect(execCases.length).toBe(2);
    const first = execCases[0];

    const updatedTitle = first.title + '（已更新）';
    const patchCaseRes = await ctx.patch(`${apiBase}/api/exec/cases/${first.id}`, {
      headers,
      data: { title: updatedTitle },
    });
    expect(patchCaseRes.status()).toBe(200);
    const patchedCase = await patchCaseRes.json();
    expect(patchedCase.title).toBe(updatedTitle);

    const itemsAfterTitleRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsAfterTitleRes.status()).toBe(200);
    const itemsAfterTitle = await itemsAfterTitleRes.json();
    const itemAfterTitle = itemsAfterTitle.find((it) => it.id === first.case_item_id);
    expect(itemAfterTitle && itemAfterTitle.title).toBe(updatedTitle);
    const itemUpdatedAtAfterTitle = itemAfterTitle.updated_at;

    const patchStatusRes = await ctx.patch(`${apiBase}/api/exec/cases/${first.id}`, {
      headers,
      data: { status: '通过', defect_links: ['BUG-1'] },
    });
    expect(patchStatusRes.status()).toBe(200);

    const itemsAfterStatusRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsAfterStatusRes.status()).toBe(200);
    const itemsAfterStatus = await itemsAfterStatusRes.json();
    const itemAfterStatus = itemsAfterStatus.find((it) => it.id === first.case_item_id);
    expect(itemAfterStatus.updated_at).toBe(itemUpdatedAtAfterTitle);

    const importCases = [
      {
        module: patchedCase.module,
        title: patchedCase.title,
        expected: patchedCase.expected,
        status: '失败',
        remark: 'import-remark',
        defect_links: ['BUG-9'],
        reuse_details: [],
      },
    ];
    const keepDbRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db', import_cases: importCases },
    });
    expect(keepDbRes.status()).toBe(200);
    const casesAfterKeepDbRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesAfterKeepDbRes.status()).toBe(200);
    const casesAfterKeepDb = await casesAfterKeepDbRes.json();
    const keepDbCase = casesAfterKeepDb.find((c) => c.id === first.id);
    expect(keepDbCase && keepDbCase.status).toBe('通过');

    const preferImportRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'import', import_cases: importCases },
    });
    expect(preferImportRes.status()).toBe(200);
    const casesAfterPreferImportRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesAfterPreferImportRes.status()).toBe(200);
    const casesAfterPreferImport = await casesAfterPreferImportRes.json();
    const preferImportCase = casesAfterPreferImport.find((c) => c.id === first.id);
    expect(preferImportCase && preferImportCase.status).toBe('失败');

    const archiveRes = await ctx.patch(`${apiBase}/api/exec/sets/${execSetId}`, {
      headers,
      data: { status: 'archived' },
    });
    expect(archiveRes.status()).toBe(200);

    const restoreRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(restoreRes.status()).toBe(200);
    const restoredSet = await restoreRes.json();
    expect(restoredSet.id).toBe(execSetId);
    expect(restoredSet.status).toBe('active');

    const execCasesAfterRestoreRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(execCasesAfterRestoreRes.status()).toBe(200);
    const execCasesAfterRestore = await execCasesAfterRestoreRes.json();
    const restoredFirst = execCasesAfterRestore.find((c) => c.id === first.id);
    expect(restoredFirst && restoredFirst.status).toBe('失败');

    const createItemRes = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items`, {
      headers,
      data: {
        module: '模块A',
        title: '新增用例',
        expected: 'ok-new',
        priority: 'P2',
        precondition: '',
        steps: '',
        remark: '',
      },
    });
    expect(createItemRes.status()).toBe(201);
    const newItem = await createItemRes.json();

    const lastCaseId = execCasesAfterRestore.length ? execCasesAfterRestore[execCasesAfterRestore.length - 1].id : null;
    const createExecCaseRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases`, {
      headers,
      data: { case_item_id: newItem.id, status: '未执行', after_case_id: lastCaseId },
    });
    expect(createExecCaseRes.status()).toBe(201);
    const createdExec = await createExecCaseRes.json();
    expect(createdExec.case_item_id).toBe(newItem.id);
    expect(createdExec.module).toBe(newItem.module);
    expect(createdExec.title).toBe(newItem.title);

    const blankExecRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases`, {
      headers,
      data: { status: '未执行' },
    });
    expect(blankExecRes.status()).toBe(201);
    const blankExec = await blankExecRes.json();
    expect(blankExec.case_item_id).toBe(null);

    const autoBindRes = await ctx.patch(`${apiBase}/api/exec/cases/${blankExec.id}`, {
      headers,
      data: { module: '模块Z', title: '临时用例', expected: 'ok-auto', priority: 'P1' },
    });
    expect(autoBindRes.status()).toBe(200);
    const autoBound = await autoBindRes.json();
    expect(autoBound.case_item_id).toBeTruthy();
    expect(autoBound.module).toBe('模块Z');
    expect(autoBound.title).toBe('临时用例');

    const foreignImportRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '勾选用例-另一个用例_result_20251213121212.json',
        source: 'apitest',
        items: [{ module: '模块B', title: '外部用例', expected: 'ok' }],
      },
    });
    expect(foreignImportRes.status()).toBe(201);
    const foreignCaseFileId = (await foreignImportRes.json()).id;
    const foreignItemsRes = await ctx.get(`${apiBase}/api/case-files/${foreignCaseFileId}/items`, { headers });
    expect(foreignItemsRes.status()).toBe(200);
    const foreignItems = await foreignItemsRes.json();
    expect(foreignItems.length).toBe(1);

    const badCreateRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases`, {
      headers,
      data: { case_item_id: foreignItems[0].id },
    });
    expect(badCreateRes.status()).toBe(400);

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect([200, 404]).toContain(delProj.status());

    // cleanup other user
    const delUser = await ctx.delete(`${apiBase}/api/users/${otherUser.id}`, { headers });
    expect([200, 404]).toContain(delUser.status());
  });
});
