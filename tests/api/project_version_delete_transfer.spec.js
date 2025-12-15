const { test, expect, request } = require('@playwright/test');

test.describe('project version delete transfer', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: adminUser, password: adminPass },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body && body.access_token).toBeTruthy();
    return body.access_token;
  }

  test('delete version: in-use requires transfer_to and moves case files', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const projectName = 'autotest-transfer-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'api transfer delete' },
    });
    expect(createProj.status()).toBe(201);
    const projBody = await createProj.json();
    const projectId = projBody.id;

    const ver1Res = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(ver1Res.status()).toBe(201);
    const ver1 = await ver1Res.json();

    const ver2Res = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v2' },
    });
    expect(ver2Res.status()).toBe(201);
    const ver2 = await ver2Res.json();

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: ver1.id,
        file_name: '用例A.xmind',
        items: [
          {
            module: '登录',
            title: '账号密码登录',
            priority: 'P1',
            precondition: '已注册账号',
            steps: '1. 输入账号\n2. 输入密码\n3. 点击登录',
            expected: '进入首页',
            remark: '',
          },
        ],
      },
    });
    expect(importRes.status()).toBe(201);

    const listCaseFiles = await ctx.get(`${apiBase}/api/case-files?project_id=${projectId}`, { headers });
    expect(listCaseFiles.status()).toBe(200);
    const caseFilesBefore = await listCaseFiles.json();
    const importedFile = caseFilesBefore.find((f) => f && f.file_name_clean === '用例A');
    expect(importedFile).toBeTruthy();

    const createExecSet = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: importedFile.id, mode: 'replace', prefer_result_source: 'db', preserve_results: true },
    });
    expect(createExecSet.status()).toBe(200);
    const execSet = await createExecSet.json();
    expect(execSet && execSet.version_id).toBe(ver1.id);

    const delNoTransfer = await ctx.delete(`${apiBase}/api/projects/${projectId}/versions/${ver1.id}`, { headers });
    expect(delNoTransfer.status()).toBe(409);
    const delNoTransferBody = await delNoTransfer.json();
    const conflictDetail = delNoTransferBody && delNoTransferBody.detail ? delNoTransferBody.detail : {};
    expect(conflictDetail && conflictDetail.code).toBe('VERSION_IN_USE');

    const delWithTransfer = await ctx.delete(
      `${apiBase}/api/projects/${projectId}/versions/${ver1.id}?transfer_to=${encodeURIComponent('v2')}`,
      { headers }
    );
    expect(delWithTransfer.status()).toBe(200);

    const listCases = await ctx.get(`${apiBase}/api/case-files?project_id=${projectId}`, { headers });
    expect(listCases.status()).toBe(200);
    const caseFiles = await listCases.json();
    const moved = caseFiles.find((f) => f && f.file_name_clean === '用例A');
    expect(moved).toBeTruthy();
    expect(moved.version_id).toBe(ver2.id);

    const listExecSets = await ctx.get(`${apiBase}/api/exec/sets?project_id=${projectId}`, { headers });
    expect(listExecSets.status()).toBe(200);
    const execSets = await listExecSets.json();
    const movedSet = execSets.find((s) => s && s.id === execSet.id);
    expect(movedSet).toBeTruthy();
    expect(movedSet.version_id).toBe(ver2.id);

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });
});
