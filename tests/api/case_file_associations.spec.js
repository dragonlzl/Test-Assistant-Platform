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

    const updateOpsRes = await ctx.get(`${apiBase}/api/ops?limit=200`, { headers });
    expect(updateOpsRes.status()).toBe(200);
    const updateOpsLogs = await updateOpsRes.json();
    const updateAssocLog = Array.isArray(updateOpsLogs)
      ? updateOpsLogs.find((item) => {
          if (!item || item.action !== 'update_case_file_association') return false;
          const detail = item.detail && typeof item.detail === 'object' ? item.detail : null;
          if (!detail) return false;
          return (
            Number(detail.association_id) === Number(createdAssoc.id) &&
            Number(detail.main_case_file_id) === Number(caseA.id)
          );
        })
      : null;
    expect(updateAssocLog).toBeTruthy();
    expect(updateAssocLog.detail.before_count).toBe(1);
    expect(updateAssocLog.detail.after_count).toBe(2);
    expect(String(updateAssocLog.detail.association_target_label || '')).toContain('编辑关联：');

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

  test('操作记录展示关联与取消关联的组合快照', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'assoc-oplog-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'association op-log spec' },
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
    const caseD = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `副用例D_${Date.now()}.json`,
      [
        { module: '结算', title: 'D-1', priority: 'P1', precondition: '无', steps: '步骤D1', expected: '结果D1', remark: '' },
      ]
    );

    const bItems = await listCaseItems(ctx, headers, caseB.id);
    const cItems = await listCaseItems(ctx, headers, caseC.id);
    const dItems = await listCaseItems(ctx, headers, caseD.id);
    expect(bItems.length).toBe(2);
    expect(cItems.length).toBe(1);
    expect(dItems.length).toBe(1);

    const createAssocBRes = await ctx.post(`${apiBase}/api/case-files/${caseA.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: caseB.id,
        selected_case_item_ids: [bItems[0].id, bItems[1].id],
      },
    });
    expect(createAssocBRes.status()).toBe(201);
    const assocB = await createAssocBRes.json();

    const createAssocCRes = await ctx.post(`${apiBase}/api/case-files/${caseA.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: caseC.id,
        selected_case_item_ids: [cItems[0].id],
      },
    });
    expect(createAssocCRes.status()).toBe(201);

    const deleteAssocBRes = await ctx.delete(
      `${apiBase}/api/case-files/${caseA.id}/associations/${assocB.id}`,
      { headers }
    );
    expect(deleteAssocBRes.status()).toBe(200);

    const createAssocDRes = await ctx.post(`${apiBase}/api/case-files/${caseA.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: caseD.id,
        selected_case_item_ids: [dItems[0].id],
      },
    });
    expect(createAssocDRes.status()).toBe(201);

    const mainName = String(caseA.file_name_clean || ('用例#' + caseA.id));
    const bName = String(caseB.file_name_clean || ('用例#' + caseB.id));
    const cName = String(caseC.file_name_clean || ('用例#' + caseC.id));
    const dName = String(caseD.file_name_clean || ('用例#' + caseD.id));

    const opsRes = await ctx.get(`${apiBase}/api/ops?limit=500`, { headers });
    expect(opsRes.status()).toBe(200);
    const opsLogsRaw = await opsRes.json();
    const assocLogs = Array.isArray(opsLogsRaw)
      ? opsLogsRaw.filter((item) => {
          if (!item || !item.action) return false;
          if (item.action !== 'create_case_file_association' && item.action !== 'delete_case_file_association') {
            return false;
          }
          if (Number(item.target_id) !== Number(caseA.id)) return false;
          const detail = item.detail && typeof item.detail === 'object' ? item.detail : null;
          if (!detail) return false;
          return Number(detail.main_case_file_id) === Number(caseA.id);
        })
      : [];

    expect(assocLogs.length).toBeGreaterThanOrEqual(4);

    const orderedLogs = assocLogs
      .slice()
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
      .slice(-4);

    expect(orderedLogs.map((item) => item.action)).toEqual([
      'create_case_file_association',
      'create_case_file_association',
      'delete_case_file_association',
      'create_case_file_association',
    ]);

    expect(orderedLogs[0].detail.association_snapshot_after).toBe(`${mainName}+${bName}2条`);
    expect(orderedLogs[0].detail.association_target_label).toBe(`关联用例：${mainName}+${bName}2条`);
    expect(orderedLogs[0].detail.before_count).toBe(0);
    expect(orderedLogs[0].detail.after_count).toBe(2);

    expect(orderedLogs[1].detail.association_snapshot_after).toBe(`${mainName}+${bName}2条+${cName}1条`);
    expect(orderedLogs[1].detail.association_target_label).toBe(
      `关联用例：${mainName}+${bName}2条+${cName}1条`
    );
    expect(orderedLogs[1].detail.before_count).toBe(2);
    expect(orderedLogs[1].detail.after_count).toBe(3);

    expect(orderedLogs[2].detail.association_snapshot_after).toBe(`${mainName}+${cName}1条`);
    expect(orderedLogs[2].detail.association_target_label).toBe(
      `取消关联：${mainName}+${cName}1条-${bName}2条`
    );
    expect(orderedLogs[2].detail.before_count).toBe(3);
    expect(orderedLogs[2].detail.after_count).toBe(1);

    expect(orderedLogs[3].detail.association_snapshot_after).toBe(`${mainName}+${cName}1条+${dName}1条`);
    expect(orderedLogs[3].detail.association_target_label).toBe(
      `关联用例：${mainName}+${cName}1条+${dName}1条`
    );
    expect(orderedLogs[3].detail.before_count).toBe(1);
    expect(orderedLogs[3].detail.after_count).toBe(2);

    const cleanup = await ctx.delete(`${apiBase}/api/projects/${project.id}`, { headers });
    expect([200, 404]).toContain(cleanup.status());
    await ctx.dispose();
  });

});
