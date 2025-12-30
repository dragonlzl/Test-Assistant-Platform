const { test, expect, request } = require('@playwright/test');

test.describe('exec personal fields api', () => {
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

  test('remark/defect links stay personal and do not sync to case library', async () => {
    const ctx = await request.newContext();
    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-personal-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectName, description: 'exec personal fields api' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers: adminHeaders,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const baseRemark = '基线备注';
    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers: adminHeaders,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: 'exec-personal-' + Date.now() + '.json',
        source: 'apitest',
        items: [
          { module: '模块A', title: '用例A', expected: 'ok', priority: 'P0', precondition: '', steps: '', remark: baseRemark },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const listItemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers: adminHeaders });
    expect(listItemsRes.status()).toBe(200);
    const items = await listItemsRes.json();
    expect(items.length).toBe(1);
    const caseItemId = items[0].id;

    const memberPass = 'Pwd123456';
    const memberAName = 'exec_personal_a_' + Date.now();
    const memberBName = 'exec_personal_b_' + Date.now();

    const createUserA = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: memberAName, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUserA.status()).toBe(201);
    const memberAId = (await createUserA.json()).id;

    const createUserB = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: memberBName, password: memberPass, role: 'user', level: 'member', is_active: true },
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

    const tokenA = await login(ctx, memberAName, memberPass);
    const tokenB = await login(ctx, memberBName, memberPass);
    const headersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
    const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    const createExecSetA = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersA,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetA.status()).toBe(200);
    const execSetAId = (await createExecSetA.json()).id;

    const listExecCasesA = await ctx.get(`${apiBase}/api/exec/sets/${execSetAId}/cases`, { headers: headersA });
    expect(listExecCasesA.status()).toBe(200);
    const execCasesA = await listExecCasesA.json();
    expect(execCasesA.length).toBe(1);
    const execCaseA = execCasesA[0];

    const personalRemark = '个人备注-' + Date.now();
    const patchRes = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseA.id}`, {
      headers: headersA,
      data: { remark: personalRemark, defect_links: ['BUG-1'] },
    });
    expect(patchRes.status()).toBe(200);

    const itemsAfterRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers: adminHeaders });
    expect(itemsAfterRes.status()).toBe(200);
    const itemsAfter = await itemsAfterRes.json();
    const matched = itemsAfter.find((it) => it.id === caseItemId);
    expect(matched && matched.remark).toBe(baseRemark);

    const createExecSetB = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersB,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetB.status()).toBe(200);
    const execSetBId = (await createExecSetB.json()).id;

    const listExecCasesB = await ctx.get(`${apiBase}/api/exec/sets/${execSetBId}/cases`, { headers: headersB });
    expect(listExecCasesB.status()).toBe(200);
    const execCasesB = await listExecCasesB.json();
    expect(execCasesB.length).toBe(1);
    const execCaseB = execCasesB[0];
    expect(execCaseB.remark).toBe(baseRemark);
    expect(Array.isArray(execCaseB.defect_links) ? execCaseB.defect_links.length : 0).toBe(0);
  });
});
