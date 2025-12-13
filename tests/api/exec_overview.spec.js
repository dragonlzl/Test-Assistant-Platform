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
});

