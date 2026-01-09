const { test, expect, request } = require('@playwright/test');

test.describe('exec overview api', () => {
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
    expect(body && body.user && body.user.id).toBeTruthy();
    return { token: body.access_token, user: body.user };
  }

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

  test('overview + overview cases 返回用户名与明细列表', async () => {
    const ctx = await request.newContext();
    const auth = await login(ctx);
    const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };

    const projectName = 'autotest-exec-overview-' + Date.now();
    const fileName = 'overview-case-file-' + Date.now() + '.xmind';

    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec overview api spec' },
    });
    expect(createProj.status()).toBe(201);
    const proj = await createProj.json();
    const projectId = proj.id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const ver = await verRes.json();
    const versionId = ver.id;

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: fileName,
        source: 'api-test',
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '', steps: '1', expected: '成功', remark: '' },
          { module: '登录', title: '密码错误', priority: 'P1', precondition: '', steps: '1', expected: '提示错误', remark: '' },
          { module: '注册', title: '正常注册', priority: 'P1', precondition: '', steps: '1', expected: '成功', remark: '' },
          { module: '注册', title: '重复注册', priority: 'P2', precondition: '', steps: '1', expected: '提示已存在', remark: '' },
          { module: '注册', title: '缺少字段', priority: 'P2', precondition: '', steps: '1', expected: '提示必填', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const itemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsRes.status()).toBe(200);
    const items = await itemsRes.json();
    expect(items.length).toBeGreaterThanOrEqual(5);
    const itemIds = items.slice(0, 5).map((it) => it.id);

    const execSetRes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers,
      data: { project_id: projectId, version_id: versionId, name: '需求-登录注册', source: String(caseFileId) },
    });
    expect(execSetRes.status()).toBe(201);
    const execSet = await execSetRes.json();

    const addRes = await ctx.post(`${apiBase}/api/exec/sets/${execSet.id}/cases/from-library`, {
      headers,
      data: { case_item_ids: itemIds },
    });
    expect(addRes.status()).toBe(201);
    const execCases = await addRes.json();
    expect(execCases.length).toBe(5);

    // 更新 4 条状态，留下 1 条 pending，便于验证各字段聚合是否正确。
    const statuses = ['通过', '失败', '阻塞', '不适用'];
    for (let i = 0; i < statuses.length; i++) {
      const patchRes = await ctx.patch(`${apiBase}/api/exec/cases/${execCases[i].id}`, {
        headers,
        data: { status: statuses[i] },
      });
      expect(patchRes.status()).toBe(200);
    }

    const overviewRes = await ctx.get(
      `${apiBase}/api/exec/overview?project_id=${projectId}&version_id=${versionId}`,
      { headers }
    );
    expect(overviewRes.status()).toBe(200);
    const overview = await overviewRes.json();
    expect(Array.isArray(overview)).toBeTruthy();
    const row = overview.find((r) => r.user_id === auth.user.id);
    expect(row).toBeTruthy();
    expect(row.username).toBe(auth.user.username);
    expect(row.total).toBe(5);
    expect(row.pending).toBe(1);
    expect(row.passed).toBe(1);
    expect(row.failed).toBe(1);
    expect(row.blocked).toBe(1);
    expect(row.not_applicable).toBe(1);

    const layoutRes = await ctx.get(
      `${apiBase}/api/exec/overview/layout?project_id=${projectId}&version_id=${versionId}`,
      { headers }
    );
    expect(layoutRes.status()).toBe(200);
    const layout = await layoutRes.json();
    expect(Array.isArray(layout)).toBeTruthy();
    const layoutUser = layout.find((u) => u && u.user_id === auth.user.id);
    expect(layoutUser).toBeTruthy();
    expect(layoutUser.username).toBe(auth.user.username);
    expect(Array.isArray(layoutUser.exec_sets)).toBeTruthy();
    expect(layoutUser.exec_sets.length).toBeGreaterThanOrEqual(1);

    const layoutLiteRes = await ctx.get(
      `${apiBase}/api/exec/overview/layout?project_id=${projectId}&version_id=${versionId}&include_sets=0`,
      { headers }
    );
    expect(layoutLiteRes.status()).toBe(200);
    const layoutLite = await layoutLiteRes.json();
    expect(Array.isArray(layoutLite)).toBeTruthy();
    const layoutLiteUser = layoutLite.find((u) => u && u.user_id === auth.user.id);
    expect(layoutLiteUser).toBeTruthy();
    expect(Array.isArray(layoutLiteUser.exec_sets)).toBeTruthy();
    expect(layoutLiteUser.exec_sets.length).toBe(0);
    expect(Array.isArray(layoutLiteUser.version_stats)).toBeTruthy();
    expect(layoutLiteUser.version_stats.length).toBeGreaterThanOrEqual(1);

    const layoutSetsRes = await ctx.get(
      `${apiBase}/api/exec/overview/layout/exec-sets?project_id=${projectId}&user_id=${auth.user.id}&version_id=${versionId}`,
      { headers }
    );
    expect(layoutSetsRes.status()).toBe(200);
    const layoutSets = await layoutSetsRes.json();
    expect(Array.isArray(layoutSets)).toBeTruthy();
    expect(layoutSets.some((s) => s && s.exec_set_id === execSet.id)).toBeTruthy();

    const casesRes = await ctx.get(
      `${apiBase}/api/exec/overview/cases?project_id=${projectId}&version_id=${versionId}&user_id=${auth.user.id}&limit=50`,
      { headers }
    );
    expect(casesRes.status()).toBe(200);
    const cases = await casesRes.json();
    expect(Array.isArray(cases)).toBeTruthy();
    expect(cases.length).toBe(5);
    expect(cases[0].exec_set_name).toBe('需求-登录注册');
    expect(cases[0].exec_case_id).toBeTruthy();

    // cleanup
    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });

  test('非管理员执行总览可查看同项目成员执行统计（只读）', async () => {
    const ctx = await request.newContext();
    const adminAuth = await login(ctx);
    const adminHeaders = { Authorization: `Bearer ${adminAuth.token}`, 'Content-Type': 'application/json' };

    const projectName = 'autotest-exec-overview-acl-' + Date.now();
    const fileName = 'overview-acl-case-file-' + Date.now() + '.xmind';
    const memberName = 'member_overview_' + Date.now();
    const memberPass = 'Pwd123456';

    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectName, description: 'exec overview acl spec' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers: adminHeaders,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: memberName, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const memberId = (await createUser.json()).id;

    const assignRes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: memberId, project_ids: [projectId] },
    });
    expect(assignRes.status()).toBe(200);

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers: adminHeaders,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: fileName,
        source: 'api-test',
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '', steps: '1', expected: '成功', remark: '' },
          { module: '登录', title: '密码错误', priority: 'P1', precondition: '', steps: '1', expected: '提示错误', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFileId = (await importRes.json()).id;

    const itemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers: adminHeaders });
    expect(itemsRes.status()).toBe(200);
    const items = await itemsRes.json();
    expect(items.length).toBeGreaterThanOrEqual(2);
    const itemIds = items.slice(0, 2).map((it) => it.id);

    const adminExecSetRes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers: adminHeaders,
      data: { project_id: projectId, version_id: versionId, name: 'admin-exec', source: String(caseFileId) },
    });
    expect(adminExecSetRes.status()).toBe(201);
    const adminExecSetId = (await adminExecSetRes.json()).id;

    const adminAddRes = await ctx.post(`${apiBase}/api/exec/sets/${adminExecSetId}/cases/from-library`, {
      headers: adminHeaders,
      data: { case_item_ids: itemIds },
    });
    expect(adminAddRes.status()).toBe(201);
    const adminCases = await adminAddRes.json();
    expect(adminCases.length).toBe(2);

    const memberAuth = await loginAs(ctx, memberName, memberPass);
    const memberHeaders = { Authorization: `Bearer ${memberAuth.token}`, 'Content-Type': 'application/json' };

    const memberExecSetRes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers: memberHeaders,
      data: { project_id: projectId, version_id: versionId, name: 'member-exec', source: String(caseFileId) },
    });
    expect(memberExecSetRes.status()).toBe(201);
    const memberExecSetId = (await memberExecSetRes.json()).id;

    const memberAddRes = await ctx.post(`${apiBase}/api/exec/sets/${memberExecSetId}/cases/from-library`, {
      headers: memberHeaders,
      data: { case_item_ids: itemIds },
    });
    expect(memberAddRes.status()).toBe(201);
    const memberCases = await memberAddRes.json();
    expect(memberCases.length).toBe(2);

    const overviewRes = await ctx.get(
      `${apiBase}/api/exec/overview?project_id=${projectId}&version_id=${versionId}`,
      { headers: memberHeaders }
    );
    expect(overviewRes.status()).toBe(200);
    const overview = await overviewRes.json();
    expect(Array.isArray(overview)).toBeTruthy();
    expect(overview.some((r) => r && r.user_id === adminAuth.user.id)).toBeTruthy();
    expect(overview.some((r) => r && r.user_id === memberId)).toBeTruthy();

    const layoutRes = await ctx.get(
      `${apiBase}/api/exec/overview/layout?project_id=${projectId}&version_id=${versionId}`,
      { headers: memberHeaders }
    );
    expect(layoutRes.status()).toBe(200);
    const layout = await layoutRes.json();
    expect(Array.isArray(layout)).toBeTruthy();
    expect(layout.some((u) => u && u.user_id === adminAuth.user.id)).toBeTruthy();
    expect(layout.some((u) => u && u.user_id === memberId)).toBeTruthy();

    const casesRes = await ctx.get(
      `${apiBase}/api/exec/overview/cases?project_id=${projectId}&version_id=${versionId}&user_id=${adminAuth.user.id}&limit=50`,
      { headers: memberHeaders }
    );
    expect(casesRes.status()).toBe(200);
    const cases = await casesRes.json();
    expect(Array.isArray(cases)).toBeTruthy();
    expect(cases.length).toBeGreaterThan(0);

    const adminExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${adminExecSetId}/cases`, {
      headers: memberHeaders,
    });
    expect(adminExecCasesRes.status()).toBe(200);
    const adminExecCases = await adminExecCasesRes.json();
    expect(Array.isArray(adminExecCases)).toBeTruthy();
    expect(adminExecCases.length).toBe(2);

    const delUser = await ctx.post(`${apiBase}/api/users/${memberId}/delete`, {
      headers: adminHeaders,
      data: { admin_password: adminPass },
    });
    expect([200, 404]).toContain(delUser.status());
    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers: adminHeaders });
    expect([200, 404]).toContain(delProj.status());
  });

  test('overview/layout 兼容 exec_set.version_id 为空：按 case_file 回填版本', async () => {
    const ctx = await request.newContext();
    const auth = await login(ctx);
    const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };

    const projectName = 'autotest-exec-overview-nullver-' + Date.now();
    const fileName = 'overview-nullver-case-file-' + Date.now() + '.xmind';

    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec overview null version spec' },
    });
    expect(createProj.status()).toBe(201);
    const proj = await createProj.json();
    const projectId = proj.id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const ver = await verRes.json();
    const versionId = ver.id;

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: fileName,
        source: 'api-test',
        items: [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '', steps: '1', expected: '成功', remark: '' },
          { module: '登录', title: '密码错误', priority: 'P1', precondition: '', steps: '1', expected: '提示错误', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const itemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsRes.status()).toBe(200);
    const items = await itemsRes.json();
    expect(items.length).toBeGreaterThanOrEqual(2);
    const itemIds = items.slice(0, 2).map((it) => it.id);

    const execSetRes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers,
      data: { project_id: projectId, version_id: null, name: '需求-版本为空', case_file_id: caseFileId, source: String(caseFileId) },
    });
    expect(execSetRes.status()).toBe(201);
    const execSet = await execSetRes.json();

    const addRes = await ctx.post(`${apiBase}/api/exec/sets/${execSet.id}/cases/from-library`, {
      headers,
      data: { case_item_ids: itemIds },
    });
    expect(addRes.status()).toBe(201);
    const execCases = await addRes.json();
    expect(execCases.length).toBe(2);

    const patchRes = await ctx.patch(`${apiBase}/api/exec/cases/${execCases[0].id}`, {
      headers,
      data: { status: '通过' },
    });
    expect(patchRes.status()).toBe(200);

    const overviewRes = await ctx.get(
      `${apiBase}/api/exec/overview?project_id=${projectId}&version_id=${versionId}`,
      { headers }
    );
    expect(overviewRes.status()).toBe(200);
    const overview = await overviewRes.json();
    const row = overview.find((r) => r.user_id === auth.user.id);
    expect(row).toBeTruthy();
    expect(row.total).toBe(2);

    const layoutRes = await ctx.get(
      `${apiBase}/api/exec/overview/layout?project_id=${projectId}&version_id=${versionId}`,
      { headers }
    );
    expect(layoutRes.status()).toBe(200);
    const layout = await layoutRes.json();
    const layoutUser = layout.find((u) => u && u.user_id === auth.user.id);
    expect(layoutUser).toBeTruthy();
    expect(layoutUser.exec_sets.some((s) => s && s.exec_set_id === execSet.id && s.version_id === versionId)).toBeTruthy();

    const casesRes = await ctx.get(
      `${apiBase}/api/exec/overview/cases?project_id=${projectId}&version_id=${versionId}&user_id=${auth.user.id}&limit=50`,
      { headers }
    );
    expect(casesRes.status()).toBe(200);
    const cases = await casesRes.json();
    expect(Array.isArray(cases)).toBeTruthy();
    expect(cases.length).toBe(2);
    expect(cases.every((c) => c.version_id === versionId)).toBeTruthy();

    // cleanup
    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });
});
