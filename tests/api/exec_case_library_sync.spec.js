const { test, expect, request } = require('@playwright/test');
const { execSync } = require('child_process');
const path = require('path');

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

  test('用例库改动后：刷新同步返回 diff，已执行用例标记为“变更重跑”', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const meRes = await ctx.get(`${apiBase}/api/users/me`, { headers });
    expect(meRes.status()).toBe(200);
    const me = await meRes.json();
    expect(me && me.id).toBeTruthy();
    const myId = me.id;

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
    expect(afterCases[0].status).toBe('变更重跑');

    const overviewRes = await ctx.get(
      `${apiBase}/api/exec/overview?project_id=${projectId}&version_id=${versionId}`,
      { headers }
    );
    expect(overviewRes.status()).toBe(200);
    const overview = await overviewRes.json();
    const mine = Array.isArray(overview) ? overview.find((row) => row && row.user_id === myId) : null;
    expect(mine).toBeTruthy();
    expect(mine.pending).toBe(1);
    expect(mine.passed).toBe(0);

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

  test('用例库改动首次同步应触发自动弹窗', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-lib-auto-popup-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec case lib auto popup' },
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
        file_name: '自动弹窗测试_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '登录', title: '登录成功', priority: 'P0', precondition: '无', steps: '步骤0', expected: '成功', remark: '' },
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

    const updateItemRes = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers,
      data: { steps: '步骤1' },
    });
    expect(updateItemRes.status()).toBe(200);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.exec_set_id).toBe(execSetId);
    expect(sync && sync.has_new_diff).toBeTruthy();
    expect(sync && sync.should_auto_popup).toBeTruthy();

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });

  test('未确认 diff 时再次同步仍需自动弹窗', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-lib-auto-popup-repeat-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec case lib auto popup repeat' },
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
        file_name: '自动弹窗重复_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '登录', title: '登录成功', priority: 'P0', precondition: '无', steps: '旧步骤', expected: '成功', remark: '' },
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

    const updateItemRes = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers,
      data: { steps: '新步骤' },
    });
    expect(updateItemRes.status()).toBe(200);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.has_new_diff).toBeTruthy();
    expect(sync && sync.should_auto_popup).toBeTruthy();

    const syncAgainRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncAgainRes.status()).toBe(200);
    const syncAgain = await syncAgainRes.json();
    expect(syncAgain && syncAgain.has_new_diff).toBeFalsy();
    expect(syncAgain && syncAgain.should_auto_popup).toBeTruthy();

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });

  test('复用类型变更只记录diff历史且不触发自动弹窗', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-lib-reuse-change-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'reuse change diff' },
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
        file_name: '复用类型变更_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '基础', title: '复用开关', priority: 'P1', precondition: '无', steps: '步骤', expected: 'ok', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSetId = (await createExecSetRes.json()).id;

    const toggleReuseRes = await ctx.patch(`${apiBase}/api/exec/sets/${execSetId}`, {
      headers,
      data: { reuse_enabled: true },
    });
    expect(toggleReuseRes.status()).toBe(200);

    const listCaseFilesRes = await ctx.get(`${apiBase}/api/case-files?project_id=${projectId}`, { headers });
    expect(listCaseFilesRes.status()).toBe(200);
    const listed = await listCaseFilesRes.json();
    const matchedFile = Array.isArray(listed) ? listed.find((f) => f && f.id === caseFileId) : null;
    expect(matchedFile && matchedFile.reuse_enabled).toBeTruthy();

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.has_new_diff).toBeFalsy();
    expect(sync && sync.should_auto_popup).toBeFalsy();
    expect(Array.isArray(sync.history)).toBeTruthy();
    expect(sync.history.length).toBeGreaterThan(0);
    const firstBatch = sync.history[0];
    expect(Array.isArray(firstBatch.diff)).toBeTruthy();
    const reuseEntry = firstBatch.diff.find((d) => d && d.kind === 'updated');
    expect(reuseEntry).toBeTruthy();
    expect(reuseEntry.old && reuseEntry.old.module).toBe('用例类型');
    expect(reuseEntry.old && reuseEntry.old.title).toBe('非复用');
    expect(reuseEntry.new && reuseEntry.new.title).toBe('复用');

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

  test('执行页新增用例入库后：其他执行集同步不重复新增', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-exec-dedupe-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec dedupe on case library sync' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const memberPass = 'Pwd123456';
    const memberAName = 'member_exec_dedupe_a_' + Date.now();
    const memberBName = 'member_exec_dedupe_b_' + Date.now();

    const createUserA = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username: memberAName, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUserA.status()).toBe(201);
    const memberAId = (await createUserA.json()).id;

    const createUserB = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username: memberBName, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUserB.status()).toBe(201);
    const memberBId = (await createUserB.json()).id;

    const assignA = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers,
      data: { user_id: memberAId, project_ids: [projectId] },
    });
    expect(assignA.status()).toBe(200);
    const assignB = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers,
      data: { user_id: memberBId, project_ids: [projectId] },
    });
    expect(assignB.status()).toBe(200);

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '执行同步去重_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '基础', title: '初始化', priority: 'P0', precondition: '无', steps: '步骤1', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const authA = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: memberAName, password: memberPass },
    });
    expect(authA.status()).toBe(200);
    const authABody = await authA.json();
    const headersA = { Authorization: `Bearer ${authABody.access_token}`, 'Content-Type': 'application/json' };

    const authB = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: memberBName, password: memberPass },
    });
    expect(authB.status()).toBe(200);
    const authBBody = await authB.json();
    const headersB = { Authorization: `Bearer ${authBBody.access_token}`, 'Content-Type': 'application/json' };

    const createExecSetARes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersA,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetARes.status()).toBe(200);
    const execSetAId = (await createExecSetARes.json()).id;

    const createExecSetBRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersB,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetBRes.status()).toBe(200);
    const execSetBId = (await createExecSetBRes.json()).id;

    const manualPayload = {
      module: '订单',
      title: '新增订单',
      expected: '成功',
      priority: 'P1',
      precondition: '已登录',
      steps: '步骤A',
    };

    const addBRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetBId}/cases`, {
      headers: headersB,
      data: manualPayload,
    });
    expect(addBRes.status()).toBe(201);
    const bManual = await addBRes.json();
    expect(bManual && bManual.case_item_id).toBeTruthy();

    const addARes = await ctx.post(`${apiBase}/api/exec/sets/${execSetAId}/cases`, {
      headers: headersA,
      data: manualPayload,
    });
    expect(addARes.status()).toBe(201);
    const aManual = await addARes.json();
    expect(aManual && aManual.case_item_id).toBeTruthy();
    expect(aManual.case_item_id).toBe(bManual.case_item_id);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetAId}/case-library-sync`, { headers: headersA, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.has_new_diff).toBeFalsy();
    expect(sync && sync.summary && sync.summary.added).toBe(0);
    expect(sync && sync.summary && sync.summary.updated).toBe(0);
    expect(sync && sync.summary && sync.summary.deleted).toBe(0);

    const listARes = await ctx.get(`${apiBase}/api/exec/sets/${execSetAId}/cases`, { headers: headersA });
    expect(listARes.status()).toBe(200);
    const listA = await listARes.json();
    expect(listA.length).toBe(2);
    const sameTitle = listA.filter((row) => row && row.title === manualPayload.title);
    expect(sameTitle.length).toBe(1);
    expect(sameTitle[0] && sameTitle[0].case_item_id).toBeTruthy();

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
    const delUserA = await ctx.post(`${apiBase}/api/users/${memberAId}/delete`, {
      headers,
      data: { admin_password: adminPass },
    });
    expect(delUserA.status()).toBe(200);
    const delUserB = await ctx.post(`${apiBase}/api/users/${memberBId}/delete`, {
      headers,
      data: { admin_password: adminPass },
    });
    expect(delUserB.status()).toBe(200);
  });

  test('执行页删除用例后：用例库记录删除并同步', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-exec-delete-sync-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec delete sync to case library' },
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
        file_name: '执行删除同步_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '账户', title: '注销账号', priority: 'P0', precondition: '已登录', steps: '步骤1', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;
    const fileNameClean = caseFile.file_name_clean;

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSetId = (await createExecSetRes.json()).id;

    const listExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(listExecCasesRes.status()).toBe(200);
    const execCases = await listExecCasesRes.json();
    expect(execCases.length).toBe(1);
    const execCaseId = execCases[0].id;

    const delRes = await ctx.delete(`${apiBase}/api/exec/cases/${execCaseId}`, { headers });
    expect(delRes.status()).toBe(200);

    const listItemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(listItemsRes.status()).toBe(200);
    const items = await listItemsRes.json();
    expect(items.length).toBe(0);

    const historyRes = await ctx.get(
      `${apiBase}/api/case-files/change-history?project_id=${projectId}&file_name_clean=${encodeURIComponent(fileNameClean)}&limit=50`,
      { headers }
    );
    expect(historyRes.status()).toBe(200);
    const history = await historyRes.json();
    expect(history && Array.isArray(history.history)).toBeTruthy();
    expect(history.history.some((h) => h && h.kind === 'deleted' && h.old && h.old.title === '注销账号')).toBeTruthy();

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });

  test('执行页新增用例自动入库：本人 sync 不触发新 diff 但可查看记录', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-exec-add-self-ack-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec add case auto bind diff history' },
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
        file_name: '执行新增同步_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '账户', title: '注册账号', priority: 'P0', precondition: '无', steps: '步骤1', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSetId = (await createExecSetRes.json()).id;

    const addRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases`, {
      headers,
      data: {
        module: '账户',
        title: '解绑手机号',
        expected: '成功',
        priority: 'P1',
        precondition: '已登录',
        steps: '步骤A',
      },
    });
    expect(addRes.status()).toBe(201);
    const added = await addRes.json();
    expect(added && added.case_item_id).toBeTruthy();

    const itemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsRes.status()).toBe(200);
    const items = await itemsRes.json();
    expect(items.length).toBe(2);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.has_new_diff).toBeFalsy();
    expect(sync && sync.should_auto_popup).toBeFalsy();
    expect(sync && sync.summary && sync.summary.added).toBe(1);
    expect(Array.isArray(sync.diff)).toBeTruthy();
    expect(sync.diff.some((d) => d && d.kind === 'added')).toBeTruthy();
    expect(Array.isArray(sync.history)).toBeTruthy();
    expect(sync.history.some((h) => h && Array.isArray(h.diff) && h.diff.some((d) => d && d.kind === 'added'))).toBeTruthy();

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

  test('执行页连续改动两次：其他执行集同步可看到两条记录', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-exec-sync-history-multi-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec double update history sync' },
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
        file_name: '执行页双次改动_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '账户', title: '修改资料', priority: 'P0', precondition: '已登录', steps: '步骤0', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const memberPass = 'Pwd123456';
    const memberBName = 'api_case_lib_b_' + Date.now();
    const createUserB = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username: memberBName, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUserB.status()).toBe(201);
    const memberBId = (await createUserB.json()).id;

    const assignB = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers,
      data: { user_id: memberBId, project_ids: [projectId] },
    });
    expect(assignB.status()).toBe(200);

    const tokenB = await login(ctx, memberBName, memberPass);
    const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    const createExecSetA = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetA.status()).toBe(200);
    const execSetAId = (await createExecSetA.json()).id;

    const createExecSetB = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersB,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetB.status()).toBe(200);
    const execSetBId = (await createExecSetB.json()).id;

    const listExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetAId}/cases`, { headers });
    expect(listExecCasesRes.status()).toBe(200);
    const execCases = await listExecCasesRes.json();
    expect(execCases.length).toBe(1);
    const execCaseId = execCases[0].id;

    const step1 = '步骤A_' + Date.now();
    const step2 = '步骤B_' + Date.now();
    const update1 = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseId}`, {
      headers,
      data: { steps: step1 },
    });
    expect(update1.status()).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const update2 = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseId}`, {
      headers,
      data: { steps: step2 },
    });
    expect(update2.status()).toBe(200);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetBId}/case-library-sync`, { headers: headersB, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.exec_set_id).toBe(execSetBId);
    expect(Array.isArray(sync.history)).toBeTruthy();
    expect(sync.history.length).toBeGreaterThanOrEqual(2);

    const diffSteps = [];
    sync.history.forEach((batch) => {
      const diffs = batch && Array.isArray(batch.diff) ? batch.diff : [];
      diffs.forEach((entry) => {
        if (entry && entry.new && entry.new.steps) diffSteps.push(entry.new.steps);
      });
    });
    expect(diffSteps).toContain(step1);
    expect(diffSteps).toContain(step2);

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
    const delUserB = await ctx.post(`${apiBase}/api/users/${memberBId}/delete`, {
      headers,
      data: { admin_password: adminPass },
    });
    expect(delUserB.status()).toBe(200);
  });

  test('追加入库：sync 返回 appended diff，且不影响已执行结果', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-lib-append-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'append to case file api spec' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const reqName = '追加测试_' + Date.now();
    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: reqName + '.json',
        source: 'api-test',
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '无', steps: '步骤1', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSetId = (await createExecSetRes.json()).id;

    const beforeCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(beforeCasesRes.status()).toBe(200);
    const beforeCases = await beforeCasesRes.json();
    expect(beforeCases.length).toBe(1);
    const execCaseId = beforeCases[0].id;

    const markExecutedRes = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseId}`, {
      headers,
      data: { status: '通过' },
    });
    expect(markExecutedRes.status()).toBe(200);

    const appendRes = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items/append`, {
      headers,
      data: {
        items: [
          { module: '登录', title: '登出', priority: 'P1', precondition: '已登录', steps: '步骤2', expected: '成功', remark: '' },
        ],
      },
    });
    expect(appendRes.status()).toBe(200);
    const appendBody = await appendRes.json();
    expect(appendBody && appendBody.appended).toBe(1);

    const historyRes = await ctx.get(
      `${apiBase}/api/case-files/change-history?project_id=${projectId}&file_name_clean=${encodeURIComponent(reqName)}`,
      { headers }
    );
    expect(historyRes.status()).toBe(200);
    const history = await historyRes.json();
    expect(history && Array.isArray(history.history)).toBeTruthy();
    expect(history.history.some((h) => h && h.kind === 'append')).toBe(true);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.exec_set_id).toBe(execSetId);
    expect(sync && sync.has_new_diff).toBeTruthy();
    expect(sync && sync.summary && sync.summary.appended).toBe(1);
    expect(Array.isArray(sync.diff)).toBeTruthy();
    expect(sync.diff.some((d) => d && d.kind === 'appended')).toBe(true);

    const afterCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(afterCasesRes.status()).toBe(200);
    const afterCases = await afterCasesRes.json();
    expect(afterCases.length).toBe(2);
    const keep = afterCases.find((it) => it && it.title === '正常登录');
    expect(keep && keep.status).toBe('通过');

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });

  test('用例库同步支持混合时区时间戳', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-lib-sync-tz-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec case library sync timezone' },
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
        file_name: '同步时区测试_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '登录', title: '登录成功', priority: 'P0', precondition: '无', steps: '步骤', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSet = await createExecSetRes.json();
    const execSetId = execSet.id;

    const dbPath = path.resolve(__dirname, '..', '..', 'data', 'apitest.db');
    const script = `
import sqlite3
db = r"""${dbPath}"""
conn = sqlite3.connect(db)
cur = conn.cursor()
cur.execute("UPDATE exec_sets SET case_file_base_updated_at=? WHERE id=?", ("2025-02-18T12:00:00+00:00", ${execSetId}))
cur.execute("UPDATE case_files SET updated_at=? WHERE id=?", ("2025-02-18 12:00:01", ${caseFileId}))
conn.commit()
conn.close()
`;
    execSync(`python3 - <<'PY'\n${script}\nPY`);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.exec_set_id).toBe(execSetId);
    expect(sync && sync.case_file_id).toBe(caseFileId);

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });

  test('用例库历史排序兼容混合时区', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'autotest-case-lib-sync-history-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec case library history sort' },
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
        file_name: '同步历史排序_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '登录', title: '登录成功', priority: 'P0', precondition: '无', steps: '步骤', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSet = await createExecSetRes.json();
    const execSetId = execSet.id;

    const dbPath = path.resolve(__dirname, '..', '..', 'data', 'apitest.db');
    const historyPayload = [
      {
        diff_at: '2025-02-18 10:00:00',
        operator: 'admin',
        summary: { appended: 0, added: 0, updated: 1, deleted: 0 },
        diff: [],
      },
      {
        diff_at: '2025-02-18T10:00:05+00:00',
        operator: 'admin',
        summary: { appended: 0, added: 1, updated: 0, deleted: 0 },
        diff: [],
      },
    ];
    const script = `
import sqlite3, json
db = r"""${dbPath}"""
conn = sqlite3.connect(db)
cur = conn.cursor()
cur.execute("UPDATE exec_sets SET case_file_diff_history_json=? WHERE id=?", (json.dumps(${JSON.stringify(historyPayload)}), ${execSetId}))
conn.commit()
conn.close()
`;
    execSync(`python3 - <<'PY'\n${script}\nPY`);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers, data: {} });
    expect(syncRes.status()).toBe(200);
    const sync = await syncRes.json();
    expect(sync && sync.exec_set_id).toBe(execSetId);
    expect(Array.isArray(sync.history)).toBeTruthy();
    expect(sync.history.length).toBeGreaterThanOrEqual(2);
    const firstTs = Date.parse(sync.history[0].diff_at || sync.history[0].diffAt || '');
    const secondTs = Date.parse(sync.history[1].diff_at || sync.history[1].diffAt || '');
    expect(Number.isFinite(firstTs)).toBeTruthy();
    expect(Number.isFinite(secondTs)).toBeTruthy();
    expect(firstTs).toBeGreaterThanOrEqual(secondTs);

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
  });
});
