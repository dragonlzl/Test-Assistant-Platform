const { test, expect, request } = require('@playwright/test');

test.describe('operation logs', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username, password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.access_token;
  }

  test('user can post event, admin can list, non-admin cannot list', async () => {
    const ctx = await request.newContext();
    const adminToken = await login(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    const adminUserPageHeaders = {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      'X-TAP-Page': 'user-admin',
    };
    const adminProjectPageHeaders = {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      'X-TAP-Page': 'project-admin',
    };

    // import_case_file 的操作日志需带 source，便于前端区分“执行页面入库/用例库页面入库”
    const projectName = 'opslog-proj-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectName, description: 'ops log project' },
    });
    expect(createProj.status()).toBe(201);
    const projBody = await createProj.json();
    const projectId = projBody.id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers: adminHeaders,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const verBody = await verRes.json();
    const versionId = verBody.id;

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers: { ...adminHeaders, 'X-TAP-Page': 'case-library' },
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: `opslog-case-${Date.now()}.xmind`,
        source: 'tempexec',
        items: [{ module: 'm', title: 't', expected: 'e' }],
      },
    });
    expect(importRes.status()).toBe(201);

    const username = 'ops_user_' + Date.now();
    const password = 'Pwd123456';
    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers: adminUserPageHeaders,
      data: { username, password, role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const created = await createUser.json();
    const userId = created.id;

    const userToken = await login(ctx, username, password);
    const userHeaders = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };

    const nonAdminList = await ctx.get(`${apiBase}/api/ops?limit=10`, { headers: userHeaders });
    expect([401, 403]).toContain(nonAdminList.status());

    const postEvent = await ctx.post(`${apiBase}/api/ops/event`, {
      headers: userHeaders,
      data: { action: 'export_case_files_xmind', target_type: 'case_file', target_id: 123, detail: { count: 1 } },
    });
    expect(postEvent.status()).toBe(201);
    const createdLog = await postEvent.json();
    expect(createdLog.action).toBe('export_case_files_xmind');
    expect(createdLog.user_id).toBe(userId);

    const assignRes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminUserPageHeaders,
      data: { user_id: userId, project_ids: [projectId] },
    });
    expect(assignRes.status()).toBe(200);

    const resetRes = await ctx.post(`${apiBase}/api/users/${userId}/reset_password`, {
      headers: adminUserPageHeaders,
    });
    expect(resetRes.status()).toBe(200);

    const deleteProjectName = 'opslog-del-proj-' + Date.now();
    const createDelProj = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminProjectPageHeaders,
      data: { name: deleteProjectName, description: 'ops log delete project' },
    });
    expect(createDelProj.status()).toBe(201);
    const delProjBody = await createDelProj.json();
    const deleteProjectId = delProjBody.id;

    const createDelVersion = await ctx.post(`${apiBase}/api/projects/${deleteProjectId}/versions`, {
      headers: adminProjectPageHeaders,
      data: { name: 'v-del' },
    });
    expect(createDelVersion.status()).toBe(201);
    const delVersionBody = await createDelVersion.json();
    const deleteVersionId = delVersionBody.id;

    const deleteVersionRes = await ctx.delete(`${apiBase}/api/projects/${deleteProjectId}/versions/${deleteVersionId}`, {
      headers: adminProjectPageHeaders,
    });
    expect(deleteVersionRes.status()).toBe(200);

    const deleteProjectRes = await ctx.delete(`${apiBase}/api/projects/${deleteProjectId}`, {
      headers: adminProjectPageHeaders,
    });
    expect(deleteProjectRes.status()).toBe(200);

    const adminList = await ctx.get(`${apiBase}/api/ops?limit=50`, { headers: adminHeaders });
    expect(adminList.status()).toBe(200);
    const list = await adminList.json();
    expect(Array.isArray(list)).toBeTruthy();
    expect(
      list.some((row) => row && row.action === 'import_case_file' && row.detail && row.detail.source === 'tempexec'),
    ).toBeTruthy();
    expect(list.some((row) => row && row.action === 'export_case_files_xmind' && row.user_id === userId)).toBeTruthy();
    const assignLog = list.find((row) => row && row.action === 'assign_projects' && row.target_id === userId);
    expect(assignLog && assignLog.detail && assignLog.detail.username).toBe(username);
    expect(assignLog && assignLog.detail && assignLog.detail.page).toBe('user-admin');
    const resetLog = list.find((row) => row && row.action === 'reset_password' && row.target_id === userId);
    expect(resetLog && resetLog.detail && resetLog.detail.username).toBe(username);
    const deleteVersionLog = list.find((row) => row && row.action === 'delete_version' && row.target_id === deleteVersionId);
    const deleteVersionName = deleteVersionLog && deleteVersionLog.detail
      ? (deleteVersionLog.detail.version_name || deleteVersionLog.detail.name || '')
      : '';
    expect(deleteVersionName).toBe('v-del');
    expect(deleteVersionLog && deleteVersionLog.detail && deleteVersionLog.detail.project_name).toBe(deleteProjectName);
    const deleteProjectLog = list.find((row) => row && row.action === 'delete_project' && row.target_id === deleteProjectId);
    const deleteProjectLabel = deleteProjectLog && deleteProjectLog.detail
      ? (deleteProjectLog.detail.project_name || deleteProjectLog.detail.name || '')
      : '';
    expect(deleteProjectLabel).toBe(deleteProjectName);

    const userOnlyList = await ctx.get(`${apiBase}/api/ops?limit=50&user_id=${userId}`, { headers: adminHeaders });
    expect(userOnlyList.status()).toBe(200);
    const userLogs = await userOnlyList.json();
    expect(userLogs.length).toBeGreaterThan(0);
    expect(userLogs.every((row) => row && row.user_id === userId)).toBeTruthy();

    const delUser = await ctx.post(`${apiBase}/api/users/${userId}/delete`, {
      headers: adminHeaders,
      data: { admin_password: adminPass },
    });
    expect(delUser.status()).toBe(200);
  });
});
