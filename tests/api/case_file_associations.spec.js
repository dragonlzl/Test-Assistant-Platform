const { test, expect, request } = require('@playwright/test');

test.describe('case file association api', () => {
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

  async function importCaseFile(ctx, headers, projectId, versionId, fileName, items) {
    const res = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: fileName,
        source: 'api-test',
        items,
      },
    });
    expect(res.status()).toBe(201);
    return res.json();
  }

  async function listCaseItems(ctx, headers, caseFileId) {
    const res = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(res.status()).toBe(200);
    return res.json();
  }

  test('关联增改删、空勾选校验、反向关联禁止', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'assoc-api-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'association api spec' },
    });
    expect(createProj.status()).toBe(201);
    const project = await createProj.json();

    const createVer = await ctx.post(`${apiBase}/api/projects/${project.id}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(createVer.status()).toBe(201);
    const version = await createVer.json();

    const caseA = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `主用例A_${Date.now()}.json`,
      [
        { module: '登录', title: 'A-1', priority: 'P0', precondition: '无', steps: '步骤A1', expected: '结果A1', remark: '' },
        { module: '登录', title: 'A-2', priority: 'P1', precondition: '无', steps: '步骤A2', expected: '结果A2', remark: '' },
      ]
    );
    const caseB = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `副用例B_${Date.now()}.json`,
      [
        { module: '支付', title: 'B-1', priority: 'P0', precondition: '无', steps: '步骤B1', expected: '结果B1', remark: '' },
        { module: '支付', title: 'B-2', priority: 'P1', precondition: '无', steps: '步骤B2', expected: '结果B2', remark: '' },
      ]
    );
    const caseC = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `副用例C_${Date.now()}.json`,
      [
        { module: '订单', title: 'C-1', priority: 'P0', precondition: '无', steps: '步骤C1', expected: '结果C1', remark: '' },
      ]
    );

    const bItems = await listCaseItems(ctx, headers, caseB.id);
    expect(Array.isArray(bItems)).toBeTruthy();
    expect(bItems.length).toBe(2);

    const createAssocRes = await ctx.post(`${apiBase}/api/case-files/${caseA.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: caseB.id,
        selected_case_item_ids: [bItems[0].id],
      },
    });
    expect(createAssocRes.status()).toBe(201);
    const createdAssoc = await createAssocRes.json();
    expect(createdAssoc.main_case_file_id).toBe(caseA.id);
    expect(createdAssoc.sub_case_file_id).toBe(caseB.id);
    expect(createdAssoc.selected_count).toBe(1);

    const listAssocRes = await ctx.get(`${apiBase}/api/case-files/${caseA.id}/associations`, { headers });
    expect(listAssocRes.status()).toBe(200);
    const assocRows = await listAssocRes.json();
    expect(Array.isArray(assocRows)).toBeTruthy();
    expect(assocRows.length).toBe(1);
    expect(assocRows[0].sub_case_file_name).toContain('副用例B');

    const candidateForMainRes = await ctx.get(`${apiBase}/api/case-files/${caseA.id}/association-candidates?include_forbidden=1`, {
      headers,
    });
    expect(candidateForMainRes.status()).toBe(200);
    const mainCandidates = await candidateForMainRes.json();
    const duplicatedSubCandidate = Array.isArray(mainCandidates)
      ? mainCandidates.find((item) => item && item.id === caseB.id)
      : null;
    expect(duplicatedSubCandidate).toBeTruthy();
    expect(duplicatedSubCandidate.association_forbidden).toBeTruthy();
    expect(String(duplicatedSubCandidate.forbidden_reason || '')).toContain('已关联到当前主用例');

    const candidateForMainAvailableRes = await ctx.get(`${apiBase}/api/case-files/${caseA.id}/association-candidates?include_forbidden=0`, {
      headers,
    });
    expect(candidateForMainAvailableRes.status()).toBe(200);
    const mainAvailableCandidates = await candidateForMainAvailableRes.json();
    expect(Array.isArray(mainAvailableCandidates)).toBeTruthy();
    const duplicatedSubInAvailable = mainAvailableCandidates.find((item) => item && item.id === caseB.id);
    expect(duplicatedSubInAvailable).toBeFalsy();

    const updateAssocRes = await ctx.patch(
      `${apiBase}/api/case-files/${caseA.id}/associations/${createdAssoc.id}`,
      {
        headers,
        data: {
          selected_case_item_ids: [bItems[0].id, bItems[1].id],
        },
      }
    );
    expect(updateAssocRes.status()).toBe(200);
    const updatedAssoc = await updateAssocRes.json();
    expect(updatedAssoc.selected_count).toBe(2);

    const emptySelectRes = await ctx.post(`${apiBase}/api/case-files/${caseA.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: caseC.id,
        selected_case_item_ids: [],
      },
    });
    expect(emptySelectRes.status()).toBe(400);

    const selfAssocRes = await ctx.post(`${apiBase}/api/case-files/${caseA.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: caseA.id,
        selected_case_item_ids: [bItems[0].id],
      },
    });
    expect(selfAssocRes.status()).toBe(400);

    const reverseAssocRes = await ctx.post(`${apiBase}/api/case-files/${caseB.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: caseA.id,
        selected_case_item_ids: [bItems[0].id],
      },
    });
    expect(reverseAssocRes.status()).toBe(400);

    const candidateRes = await ctx.get(`${apiBase}/api/case-files/${caseB.id}/association-candidates?include_forbidden=1`, {
      headers,
    });
    expect(candidateRes.status()).toBe(200);
    const candidates = await candidateRes.json();
    const candidateA = Array.isArray(candidates)
      ? candidates.find((item) => item && item.id === caseA.id)
      : null;
    expect(candidateA).toBeTruthy();
    expect(candidateA.association_forbidden).toBeTruthy();

    const deleteAssocRes = await ctx.delete(
      `${apiBase}/api/case-files/${caseA.id}/associations/${createdAssoc.id}`,
      { headers }
    );
    expect(deleteAssocRes.status()).toBe(200);

    const listAfterDeleteRes = await ctx.get(`${apiBase}/api/case-files/${caseA.id}/associations`, { headers });
    expect(listAfterDeleteRes.status()).toBe(200);
    const rowsAfterDelete = await listAfterDeleteRes.json();
    expect(Array.isArray(rowsAfterDelete)).toBeTruthy();
    expect(rowsAfterDelete.length).toBe(0);

    const candidateAfterDeleteRes = await ctx.get(`${apiBase}/api/case-files/${caseA.id}/association-candidates?include_forbidden=0`, { headers });
    expect(candidateAfterDeleteRes.status()).toBe(200);
    const availableAfterDelete = await candidateAfterDeleteRes.json();
    expect(Array.isArray(availableAfterDelete)).toBeTruthy();
    const subBAfterDelete = availableAfterDelete.find((item) => item && item.id === caseB.id);
    expect(subBAfterDelete).toBeTruthy();

    const cleanup = await ctx.delete(`${apiBase}/api/projects/${project.id}`, { headers });
    expect([200, 404]).toContain(cleanup.status());
  });
});
