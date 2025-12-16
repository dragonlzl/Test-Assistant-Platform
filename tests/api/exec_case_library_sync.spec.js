const { test, expect, request } = require('@playwright/test');

test.describe('exec case library sync api', () => {
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

  test('用例库改动后：刷新同步返回 diff，已执行用例标记为“有改动”', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-lib-sync-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec case library sync api spec' },
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
        file_name: '同步测试_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '无', steps: '旧步骤', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const listItemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(listItemsRes.status()).toBe(200);
    const items = await listItemsRes.json();
    expect(items.length).toBe(1);
    const caseItemId = items[0].id;

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSet = await createExecSetRes.json();
    const execSetId = execSet.id;

    const listExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(listExecCasesRes.status()).toBe(200);
    const execCases = await listExecCasesRes.json();
    expect(execCases.length).toBe(1);
    const execCaseId = execCases[0].id;

    const markExecutedRes = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseId}`, {
      headers,
      data: { status: '通过' },
    });
    expect(markExecutedRes.status()).toBe(200);

    const updateItemRes = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers,
      data: { steps: '新步骤' },
    });
    expect(updateItemRes.status()).toBe(200);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.exec_set_id).toBe(execSetId);
    expect(sync && sync.has_new_diff).toBeTruthy();
    expect(sync && sync.summary && sync.summary.updated).toBe(1);
    expect(Array.isArray(sync.diff)).toBeTruthy();
    expect(sync.diff.some((d) => d && d.kind === 'updated')).toBeTruthy();

    const afterCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(afterCasesRes.status()).toBe(200);
    const afterCases = await afterCasesRes.json();
    expect(afterCases.length).toBe(1);
    expect(afterCases[0].steps).toBe('新步骤');
    expect(afterCases[0].status).toBe('有改动');

    const ackRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-diff/ack`, { headers, data: {} });
    expect(ackRes.status()).toBe(200);

    const syncAgainRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncAgainRes.status()).toBe(200);
    const syncAgain = await syncAgainRes.json();
    expect(syncAgain && syncAgain.has_new_diff).toBeFalsy();
    expect(syncAgain && syncAgain.should_auto_popup).toBeFalsy();
    expect(Array.isArray(syncAgain.diff)).toBeTruthy();
    expect(syncAgain.diff.length).toBeGreaterThan(0);

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });

  test('用例库删除条目后：sync 返回 deleted diff，并移除执行用例', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-lib-sync-del-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec case library sync delete diff spec' },
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
        file_name: '同步删除测试_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '支付', title: '发起支付', priority: 'P0', precondition: '无', steps: '步骤1', expected: '成功', remark: '' },
          { module: '支付', title: '取消支付', priority: 'P1', precondition: '无', steps: '步骤2', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const listItemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(listItemsRes.status()).toBe(200);
    const items = await listItemsRes.json();
    expect(items.length).toBe(2);
    const toDelete = items.find((it) => it && it.title === '取消支付');
    expect(toDelete && toDelete.id).toBeTruthy();

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSet = await createExecSetRes.json();
    const execSetId = execSet.id;

    const listExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(listExecCasesRes.status()).toBe(200);
    const execCases = await listExecCasesRes.json();
    expect(execCases.length).toBe(2);

    const delItemRes = await ctx.delete(`${apiBase}/api/case-files/items/${toDelete.id}`, { headers });
    expect(delItemRes.status()).toBe(200);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.exec_set_id).toBe(execSetId);
    expect(sync && sync.has_new_diff).toBeTruthy();
    expect(sync && sync.summary && sync.summary.deleted).toBe(1);
    expect(Array.isArray(sync.diff)).toBeTruthy();
    const deleted = sync.diff.find((d) => d && d.kind === 'deleted');
    expect(deleted).toBeTruthy();
    expect(deleted.old && deleted.old.title).toBe('取消支付');

    const afterCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(afterCasesRes.status()).toBe(200);
    const afterCases = await afterCasesRes.json();
    expect(afterCases.length).toBe(1);
    expect(afterCases[0].title).toBe('发起支付');

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });

  test('多次变更会记录历史：最新变更排在最前', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const projectName = 'autotest-case-lib-sync-hist-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec case library sync history spec' },
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
        file_name: '同步历史测试_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '账号', title: '修改密码', priority: 'P0', precondition: '已登录', steps: '步骤1', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const listItemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(listItemsRes.status()).toBe(200);
    const items = await listItemsRes.json();
    expect(items.length).toBe(1);
    const caseItemId = items[0].id;

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSetId = (await createExecSetRes.json()).id;

    const update1 = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers,
      data: { steps: '步骤2' },
    });
    expect(update1.status()).toBe(200);
    const sync1Res = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(sync1Res.status()).toBe(200);
    const sync1 = await sync1Res.json();
    expect(sync1 && sync1.has_new_diff).toBeTruthy();
    expect(Array.isArray(sync1.history)).toBeTruthy();
    expect(sync1.history.length).toBeGreaterThanOrEqual(1);

    const update2 = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers,
      data: { steps: '步骤3' },
    });
    expect(update2.status()).toBe(200);
    const sync2Res = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(sync2Res.status()).toBe(200);
    const sync2 = await sync2Res.json();
    expect(sync2 && sync2.has_new_diff).toBeTruthy();
    expect(Array.isArray(sync2.history)).toBeTruthy();
    expect(sync2.history.length).toBeGreaterThanOrEqual(2);
    expect(sync2.history[0] && sync2.history[0].operator).toBeTruthy();

    const first = sync2.history[0];
    const second = sync2.history[1];
    expect(first && first.diff_at).toBeTruthy();
    expect(second && second.diff_at).toBeTruthy();
    expect(Date.parse(first.diff_at)).toBeGreaterThanOrEqual(Date.parse(second.diff_at));

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });
});
