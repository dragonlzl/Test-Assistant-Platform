const { test, expect, request } = require('@playwright/test');

test.describe('exec version isolation', () => {
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

  test('same case_file can execute in multiple exec versions with independent results', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-ver-iso-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec version isolation' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const v1Res = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, { headers, data: { name: 'v1' } });
    expect(v1Res.status()).toBe(201);
    const v1 = await v1Res.json();
    const v2Res = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, { headers, data: { name: 'v2' } });
    expect(v2Res.status()).toBe(201);
    const v2 = await v2Res.json();

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: v1.id,
        file_name: '用例A.json',
        items: [{ module: '模块', title: '用例A', expected: 'ok' }],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    expect(caseFile && caseFile.id).toBeTruthy();

    const upsertV1Res = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFile.id, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertV1Res.status()).toBe(200);
    const execSetV1 = await upsertV1Res.json();
    expect(execSetV1 && execSetV1.id).toBeTruthy();
    expect(execSetV1.version_id).toBe(v1.id);

    const casesV1Res = await ctx.get(`${apiBase}/api/exec/sets/${execSetV1.id}/cases`, { headers });
    expect(casesV1Res.status()).toBe(200);
    const casesV1 = await casesV1Res.json();
    expect(Array.isArray(casesV1)).toBeTruthy();
    expect(casesV1.length).toBe(1);
    const execCaseV1 = casesV1[0];

    const patchV1Res = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseV1.id}`, {
      headers,
      data: { status: '通过', remark: 'v1-ok' },
    });
    expect(patchV1Res.status()).toBe(200);

    const upsertV2Res = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFile.id, exec_version_id: v2.id, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertV2Res.status()).toBe(200);
    const execSetV2 = await upsertV2Res.json();
    expect(execSetV2 && execSetV2.id).toBeTruthy();
    expect(execSetV2.id).not.toBe(execSetV1.id);
    expect(execSetV2.version_id).toBe(v2.id);

    const casesV2Res = await ctx.get(`${apiBase}/api/exec/sets/${execSetV2.id}/cases`, { headers });
    expect(casesV2Res.status()).toBe(200);
    const casesV2 = await casesV2Res.json();
    expect(Array.isArray(casesV2)).toBeTruthy();
    expect(casesV2.length).toBe(1);
    const execCaseV2 = casesV2[0];

    const patchV2Res = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseV2.id}`, {
      headers,
      data: { status: '失败', remark: 'v2-fail' },
    });
    expect(patchV2Res.status()).toBe(200);

    const reGetV1Res = await ctx.get(`${apiBase}/api/exec/sets/${execSetV1.id}/cases`, { headers });
    expect(reGetV1Res.status()).toBe(200);
    const reCasesV1 = await reGetV1Res.json();
    expect(reCasesV1[0] && reCasesV1[0].status).toBe('通过');
    expect(reCasesV1[0] && reCasesV1[0].remark).toBe('v1-ok');

    const reGetV2Res = await ctx.get(`${apiBase}/api/exec/sets/${execSetV2.id}/cases`, { headers });
    expect(reGetV2Res.status()).toBe(200);
    const reCasesV2 = await reGetV2Res.json();
    expect(reCasesV2[0] && reCasesV2[0].status).toBe('失败');
    expect(reCasesV2[0] && reCasesV2[0].remark).toBe('v2-fail');

    const upsertV2AgainRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFile.id, exec_version_id: v2.id, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertV2AgainRes.status()).toBe(200);
    const execSetV2Again = await upsertV2AgainRes.json();
    expect(execSetV2Again && execSetV2Again.id).toBe(execSetV2.id);

    const listSetsRes = await ctx.get(`${apiBase}/api/exec/sets?project_id=${projectId}`, { headers });
    expect(listSetsRes.status()).toBe(200);
    const sets = await listSetsRes.json();
    expect(Array.isArray(sets)).toBeTruthy();
    const active = sets.filter((s) => s && s.status === 'active' && s.case_file_id === caseFile.id);
    expect(active.length).toBeGreaterThanOrEqual(2);
    const verIds = new Set(active.map((s) => String(s.version_id)));
    expect(verIds.has(String(v1.id))).toBeTruthy();
    expect(verIds.has(String(v2.id))).toBeTruthy();

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });

  test('import same content to another exec version should not mark existing executed cases as rerun', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-ver-sync-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec version sync isolation' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const v1Res = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, { headers, data: { name: 'v1' } });
    expect(v1Res.status()).toBe(201);
    const v1 = await v1Res.json();
    const v2Res = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, { headers, data: { name: 'v2' } });
    expect(v2Res.status()).toBe(201);
    const v2 = await v2Res.json();

    const items = [{ module: '模块', title: '用例A', expected: 'ok', priority: 'P1', precondition: '', steps: '1' }];
    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: v1.id,
        file_name: '用例A.json',
        items: items,
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    expect(caseFile && caseFile.id).toBeTruthy();

    const upsertV1Res = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFile.id, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertV1Res.status()).toBe(200);
    const execSetV1 = await upsertV1Res.json();
    expect(execSetV1 && execSetV1.id).toBeTruthy();
    expect(execSetV1.version_id).toBe(v1.id);

    const casesV1Res = await ctx.get(`${apiBase}/api/exec/sets/${execSetV1.id}/cases`, { headers });
    expect(casesV1Res.status()).toBe(200);
    const casesV1 = await casesV1Res.json();
    expect(Array.isArray(casesV1)).toBeTruthy();
    expect(casesV1.length).toBe(1);
    const execCaseV1 = casesV1[0];

    const patchV1Res = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseV1.id}`, {
      headers,
      data: { status: '通过', remark: 'v1-ok' },
    });
    expect(patchV1Res.status()).toBe(200);

    // 覆盖导入（内容一致）模拟“执行页导入同名用例并确认覆盖入库”，会更新 case_file.updated_at 触发同步检查。
    const overwriteRes = await ctx.post(`${apiBase}/api/case-files/import?overwrite=1`, {
      headers,
      data: {
        project_id: projectId,
        version_id: v1.id,
        file_name: '用例A.json',
        items: items,
      },
    });
    expect(overwriteRes.status()).toBe(200);

    // 选择另一个执行版本创建执行集（不应影响 v1 的已执行结果）。
    const upsertV2Res = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFile.id, exec_version_id: v2.id, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertV2Res.status()).toBe(200);
    const execSetV2 = await upsertV2Res.json();
    expect(execSetV2 && execSetV2.id).toBeTruthy();
    expect(execSetV2.version_id).toBe(v2.id);

    // 同步用例库变更：内容未变更时，不应把“执行备注”差异误判为用例变更并标记变更重跑。
    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetV1.id}/case-library-sync`, { headers });
    expect(syncRes.status()).toBe(200);
    const syncBody = await syncRes.json();
    expect(syncBody && syncBody.exec_set_id).toBe(execSetV1.id);
    expect(syncBody.has_new_diff).toBe(false);

    const reGetV1Res = await ctx.get(`${apiBase}/api/exec/sets/${execSetV1.id}/cases`, { headers });
    expect(reGetV1Res.status()).toBe(200);
    const reCasesV1 = await reGetV1Res.json();
    expect(reCasesV1[0] && reCasesV1[0].status).toBe('通过');
    expect(reCasesV1[0] && reCasesV1[0].remark).toBe('v1-ok');

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });
});
