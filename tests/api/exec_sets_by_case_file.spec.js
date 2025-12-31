const { test, expect, request } = require('@playwright/test');

test.describe('exec sets by case file api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function loginAs(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: username, password: password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body && body.access_token).toBeTruthy();
    expect(body && body.user && body.user.id).toBeTruthy();
    return { token: body.access_token, user: body.user };
  }

  test('同一项目多人选择执行：返回执行人员列表', async () => {
    const ctx = await request.newContext();
    const adminAuth = await loginAs(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminAuth.token}`, 'Content-Type': 'application/json' };

    const projectName = 'autotest-exec-sets-by-case-file-' + Date.now();
    const memberA = 'member_casefile_a_' + Date.now();
    const memberB = 'member_casefile_b_' + Date.now();
    const memberPass = 'Pwd123456';

    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectName, description: 'exec sets by case file api spec' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers: adminHeaders,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const createUserA = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: memberA, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUserA.status()).toBe(201);
    const memberAId = (await createUserA.json()).id;

    const createUserB = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: memberB, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUserB.status()).toBe(201);
    const memberBId = (await createUserB.json()).id;

    const assignA = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: memberAId, project_ids: [projectId] },
    });
    expect(assignA.status()).toBe(200);

    const assignB = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: memberBId, project_ids: [projectId] },
    });
    expect(assignB.status()).toBe(200);

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers: adminHeaders,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: 'casefile-' + Date.now() + '.xmind',
        source: 'api-test',
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '', steps: '1', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFileId = (await importRes.json()).id;

    const authA = await loginAs(ctx, memberA, memberPass);
    const headersA = { Authorization: `Bearer ${authA.token}`, 'Content-Type': 'application/json' };
    const authB = await loginAs(ctx, memberB, memberPass);
    const headersB = { Authorization: `Bearer ${authB.token}`, 'Content-Type': 'application/json' };

    const execSetARes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers: headersA,
      data: { project_id: projectId, version_id: versionId, name: 'exec-a', case_file_id: caseFileId },
    });
    expect(execSetARes.status()).toBe(201);
    const execSetAId = (await execSetARes.json()).id;

    const execSetBRes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers: headersB,
      data: { project_id: projectId, version_id: versionId, name: 'exec-b', case_file_id: caseFileId },
    });
    expect(execSetBRes.status()).toBe(201);
    const execSetBId = (await execSetBRes.json()).id;

    const byFileRes = await ctx.get(`${apiBase}/api/exec/sets/by-case-file?project_id=${projectId}`, {
      headers: headersA,
    });
    expect(byFileRes.status()).toBe(200);
    const rows = await byFileRes.json();
    expect(Array.isArray(rows)).toBeTruthy();
    const row = rows.find((r) => r && r.case_file_id === caseFileId);
    expect(row).toBeTruthy();
    expect(Array.isArray(row.active_users)).toBeTruthy();
    expect(row.active_users).toContain(memberA);
    expect(row.active_users).toContain(memberB);
    expect(row.exec_set_id).toBeTruthy();
    expect([execSetAId, execSetBId]).toContain(row.exec_set_id);

    const delRes = await ctx.delete(`${apiBase}/api/exec/sets/${execSetBId}`, { headers: headersB });
    expect(delRes.status()).toBe(200);

    const byFileAfterDelRes = await ctx.get(`${apiBase}/api/exec/sets/by-case-file?project_id=${projectId}`, {
      headers: headersA,
    });
    expect(byFileAfterDelRes.status()).toBe(200);
    const rowsAfterDel = await byFileAfterDelRes.json();
    const rowAfterDel = rowsAfterDel.find((r) => r && r.case_file_id === caseFileId);
    expect(rowAfterDel).toBeTruthy();
    expect(rowAfterDel.active_users).toContain(memberA);
    expect(rowAfterDel.active_users).not.toContain(memberB);
    expect(rowAfterDel.exec_set_id).toBe(execSetAId);

    // cleanup
    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers: adminHeaders });
    expect(delProj.status()).toBe(200);
    const delUserA = await ctx.post(`${apiBase}/api/users/${memberAId}/delete`, {
      headers: adminHeaders,
      data: { admin_password: adminPass },
    });
    expect(delUserA.status()).toBe(200);
    const delUserB = await ctx.post(`${apiBase}/api/users/${memberBId}/delete`, {
      headers: adminHeaders,
      data: { admin_password: adminPass },
    });
    expect(delUserB.status()).toBe(200);
  });
});
