const { test, expect, request } = require('@playwright/test');

test.describe('exec archive api', () => {
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

  test('archive requires reason when not all passed; members can view; admin can delete', async () => {
    const ctx = await request.newContext();
    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'archive-proj-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectName, description: 'exec archive api' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers: adminHeaders,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const userA = 'archive-user-a-' + Date.now();
    const userB = 'archive-user-b-' + Date.now();
    const createUserARes = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: userA, role: 'user', level: 'member' },
    });
    expect(createUserARes.status()).toBe(201);
    const userAId = (await createUserARes.json()).id;

    const createUserBRes = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: userB, role: 'user', level: 'member' },
    });
    expect(createUserBRes.status()).toBe(201);
    const userBId = (await createUserBRes.json()).id;

    const assignARes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: userAId, project_ids: [projectId] },
    });
    expect(assignARes.status()).toBe(200);
    const assignBRes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: userBId, project_ids: [projectId] },
    });
    expect(assignBRes.status()).toBe(200);

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers: adminHeaders,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '归档用例_result_20251217120000.json',
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

    const tokenA = await login(ctx, userA, '12345678');
    const headersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
    const tokenB = await login(ctx, userB, '12345678');
    const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    const upsertARes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersA,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertARes.status()).toBe(200);
    const execSetA = await upsertARes.json();
    expect(execSetA && execSetA.id).toBeTruthy();
    expect(execSetA.project_id).toBe(projectId);
    expect(execSetA.version_id).toBe(versionId);
    const execSetAId = execSetA.id;

    const casesARes = await ctx.get(`${apiBase}/api/exec/sets/${execSetAId}/cases`, { headers: headersA });
    expect(casesARes.status()).toBe(200);
    const casesA = await casesARes.json();
    expect(Array.isArray(casesA)).toBeTruthy();
    expect(casesA.length).toBe(2);
    const caseA1 = casesA[0];
    const caseA2 = casesA[1];

    const patch1Res = await ctx.patch(`${apiBase}/api/exec/cases/${caseA1.id}`, {
      headers: headersA,
      data: { status: '通过', remark: 'ok' },
    });
    expect(patch1Res.status()).toBe(200);
    const patch2Res = await ctx.patch(`${apiBase}/api/exec/cases/${caseA2.id}`, {
      headers: headersA,
      data: { status: '失败', remark: 'failed' },
    });
    expect(patch2Res.status()).toBe(200);

    const archiveMissingReasonRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetAId}/archive`, {
      headers: headersA,
      data: {},
    });
    expect(archiveMissingReasonRes.status()).toBe(400);
    const archiveMissingBody = await archiveMissingReasonRes.json();
    expect(archiveMissingBody && archiveMissingBody.detail).toBeTruthy();

    const archiveRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetAId}/archive`, {
      headers: headersA,
      data: { reason: '存在失败用例，仍需归档以便留存结果' },
    });
    expect(archiveRes.status()).toBe(200);
    const archivedRow = await archiveRes.json();
    expect(archivedRow && archivedRow.exec_set_id).toBe(execSetAId);
    expect(archivedRow.project_id).toBe(projectId);
    expect(archivedRow.version_id).toBe(versionId);
    expect(archivedRow.archived_by_name).toBe(userA);

    // 归档后：执行集默认列表不应再出现
    const listActiveRes = await ctx.get(`${apiBase}/api/exec/sets?project_id=${projectId}`, { headers: headersA });
    expect(listActiveRes.status()).toBe(200);
    const activeSets = await listActiveRes.json();
    expect(Array.isArray(activeSets)).toBeTruthy();
    expect(activeSets.some((s) => s && s.id === execSetAId)).toBeFalsy();

    // 同项目成员可查看归档列表与详情（跨用户可读）
    const listArchivesRes = await ctx.get(`${apiBase}/api/exec/archives?project_id=${projectId}`, { headers: headersB });
    expect(listArchivesRes.status()).toBe(200);
    const archives = await listArchivesRes.json();
    expect(Array.isArray(archives)).toBeTruthy();
    const matched = archives.find((x) => x && x.exec_set_id === execSetAId);
    expect(matched && matched.imported_by_name).toBe(userA);
    expect(matched && matched.archived_by_name).toBe(userA);

    const detailRes = await ctx.get(`${apiBase}/api/exec/archives/${execSetAId}`, { headers: headersB });
    expect(detailRes.status()).toBe(200);
    const detail = await detailRes.json();
    expect(detail && detail.exec_set_id).toBe(execSetAId);
    expect(Array.isArray(detail.cases)).toBeTruthy();
    expect(detail.cases.length).toBe(2);

    // 非管理员不可删除归档
    const deleteForbiddenRes = await ctx.delete(`${apiBase}/api/exec/archives/${execSetAId}`, { headers: headersB });
    expect(deleteForbiddenRes.status()).toBe(403);

    // 非 owner 不能改归档内容
    const forbiddenPatchRes = await ctx.patch(`${apiBase}/api/exec/cases/${caseA1.id}`, {
      headers: headersB,
      data: { remark: 'try-edit' },
    });
    expect(forbiddenPatchRes.status()).toBe(403);

    // 管理员可删除归档记录
    const deleteOkRes = await ctx.delete(`${apiBase}/api/exec/archives/${execSetAId}`, { headers: adminHeaders });
    expect(deleteOkRes.status()).toBe(200);

    const listAfterDeleteRes = await ctx.get(`${apiBase}/api/exec/archives?project_id=${projectId}`, { headers: adminHeaders });
    expect(listAfterDeleteRes.status()).toBe(200);
    const afterDelete = await listAfterDeleteRes.json();
    expect(Array.isArray(afterDelete)).toBeTruthy();
    expect(afterDelete.some((x) => x && x.exec_set_id === execSetAId)).toBeFalsy();
  });
});

