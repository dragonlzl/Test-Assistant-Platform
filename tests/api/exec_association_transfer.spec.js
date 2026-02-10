const { test, expect, request } = require('@playwright/test');

test.describe('exec association transfer api', () => {
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

  test('关联开关控制转执行组合条目，且主副冲突时禁止开启关联执行', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-assoc-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec association transfer api spec' },
    });
    expect(createProj.status()).toBe(201);
    const project = await createProj.json();

    const createVer = await ctx.post(`${apiBase}/api/projects/${project.id}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(createVer.status()).toBe(201);
    const version = await createVer.json();

    const mainCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `主用例Main_${Date.now()}.json`,
      [
        { module: '登录', title: 'M-1', priority: 'P0', precondition: '无', steps: '步骤M1', expected: '结果M1', remark: '' },
        { module: '登录', title: 'M-2', priority: 'P1', precondition: '无', steps: '步骤M2', expected: '结果M2', remark: '' },
      ]
    );

    const subCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `副用例Sub_${Date.now()}.json`,
      [
        { module: '支付', title: 'S-1', priority: 'P0', precondition: '无', steps: '步骤S1', expected: '结果S1', remark: '' },
        { module: '支付', title: 'S-2', priority: 'P1', precondition: '无', steps: '步骤S2', expected: '结果S2', remark: '' },
      ]
    );

    const subItems = await listCaseItems(ctx, headers, subCase.id);
    expect(Array.isArray(subItems)).toBeTruthy();
    expect(subItems.length).toBe(2);

    const createAssocRes = await ctx.post(`${apiBase}/api/case-files/${mainCase.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: subCase.id,
        selected_case_item_ids: [subItems[0].id],
      },
    });
    expect(createAssocRes.status()).toBe(201);

    const transferWithoutAssoc = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: false,
      },
    });
    expect(transferWithoutAssoc.status()).toBe(200);
    const execSetWithoutAssoc = await transferWithoutAssoc.json();
    expect(execSetWithoutAssoc.association_enabled).toBeFalsy();

    const listCasesWithoutAssocRes = await ctx.get(
      `${apiBase}/api/exec/sets/${execSetWithoutAssoc.id}/cases`,
      { headers }
    );
    expect(listCasesWithoutAssocRes.status()).toBe(200);
    const casesWithoutAssoc = await listCasesWithoutAssocRes.json();
    expect(Array.isArray(casesWithoutAssoc)).toBeTruthy();
    expect(casesWithoutAssoc.length).toBe(2);

    const transferWithAssoc = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: true,
      },
    });
    expect(transferWithAssoc.status()).toBe(200);
    const execSetWithAssoc = await transferWithAssoc.json();
    expect(execSetWithAssoc.id).toBe(execSetWithoutAssoc.id);
    expect(execSetWithAssoc.association_enabled).toBeTruthy();

    const listCasesWithAssocRes = await ctx.get(
      `${apiBase}/api/exec/sets/${execSetWithAssoc.id}/cases`,
      { headers }
    );
    expect(listCasesWithAssocRes.status()).toBe(200);
    const casesWithAssoc = await listCasesWithAssocRes.json();
    expect(Array.isArray(casesWithAssoc)).toBeTruthy();
    expect(casesWithAssoc.length).toBe(3);
    expect(String(casesWithAssoc[2].title || '')).toContain('S-1');

    const subAsMainAssocOnRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: subCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: true,
      },
    });
    expect(subAsMainAssocOnRes.status()).toBe(400);

    const transferBackWithoutAssoc = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: false,
      },
    });
    expect(transferBackWithoutAssoc.status()).toBe(200);

    const listCasesBackRes = await ctx.get(
      `${apiBase}/api/exec/sets/${execSetWithoutAssoc.id}/cases`,
      { headers }
    );
    expect(listCasesBackRes.status()).toBe(200);
    const casesBack = await listCasesBackRes.json();
    expect(Array.isArray(casesBack)).toBeTruthy();
    expect(casesBack.length).toBe(2);

    const cleanup = await ctx.delete(`${apiBase}/api/projects/${project.id}`, { headers });
    expect([200, 404]).toContain(cleanup.status());
  });

  test('关联引用执行更新后不应回写主用例且重复转执行不累积', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-assoc-no-pollute-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec association no pollution spec' },
    });
    expect(createProj.status()).toBe(201);
    const project = await createProj.json();

    const createVer = await ctx.post(`${apiBase}/api/projects/${project.id}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(createVer.status()).toBe(201);
    const version = await createVer.json();

    const mainCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `主用例MainNoPollute_${Date.now()}.json`,
      [
        { module: '登录', title: 'M-1', priority: 'P0', precondition: '无', steps: '步骤M1', expected: '结果M1', remark: '' },
        { module: '登录', title: 'M-2', priority: 'P1', precondition: '无', steps: '步骤M2', expected: '结果M2', remark: '' },
      ]
    );

    const subCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `副用例SubNoPollute_${Date.now()}.json`,
      [
        { module: '支付', title: 'S-1', priority: 'P0', precondition: '无', steps: '步骤S1', expected: '结果S1', remark: '' },
      ]
    );

    const subItems = await listCaseItems(ctx, headers, subCase.id);
    expect(Array.isArray(subItems)).toBeTruthy();
    expect(subItems.length).toBe(1);

    const createAssocRes = await ctx.post(`${apiBase}/api/case-files/${mainCase.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: subCase.id,
        selected_case_item_ids: [subItems[0].id],
      },
    });
    expect(createAssocRes.status()).toBe(201);

    const transferWithAssoc = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: true,
      },
    });
    expect(transferWithAssoc.status()).toBe(200);
    const execSet = await transferWithAssoc.json();

    const firstCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSet.id}/cases`, { headers });
    expect(firstCasesRes.status()).toBe(200);
    const firstCases = await firstCasesRes.json();
    expect(Array.isArray(firstCases)).toBeTruthy();
    expect(firstCases.length).toBe(3);
    const assocExecCase = firstCases.find((item) => String(item && item.title ? item.title : '') === 'S-1');
    expect(assocExecCase).toBeTruthy();
    expect(assocExecCase.case_item_id).toBeNull();
    expect(Number(assocExecCase.case_item_source_id)).toBe(Number(subItems[0].id));

    const updateAssocExecCaseRes = await ctx.patch(`${apiBase}/api/exec/cases/${assocExecCase.id}`, {
      headers,
      data: {
        status: '通过',
        actual_result: '关联引用执行通过',
        expected: '结果S1-用户1改动',
      },
    });
    expect(updateAssocExecCaseRes.status()).toBe(200);

    const mainItemsAfterUpdate = await listCaseItems(ctx, headers, mainCase.id);
    expect(Array.isArray(mainItemsAfterUpdate)).toBeTruthy();
    expect(mainItemsAfterUpdate.length).toBe(2);
    expect(mainItemsAfterUpdate.filter((item) => String(item && item.title ? item.title : '') === 'S-1').length).toBe(0);

    const subItemsAfterUpdate = await listCaseItems(ctx, headers, subCase.id);
    expect(Array.isArray(subItemsAfterUpdate)).toBeTruthy();
    expect(subItemsAfterUpdate.length).toBe(1);
    expect(String(subItemsAfterUpdate[0] && subItemsAfterUpdate[0].expected ? subItemsAfterUpdate[0].expected : '')).toBe('结果S1-用户1改动');

    const secondTransferRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'import',
        association_enabled: true,
      },
    });
    expect(secondTransferRes.status()).toBe(200);
    const secondSet = await secondTransferRes.json();
    expect(secondSet.id).toBe(execSet.id);

    const secondCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSet.id}/cases`, { headers });
    expect(secondCasesRes.status()).toBe(200);
    const secondCases = await secondCasesRes.json();
    expect(Array.isArray(secondCases)).toBeTruthy();
    expect(secondCases.length).toBe(3);
    expect(secondCases.filter((item) => String(item && item.title ? item.title : '') === 'S-1').length).toBe(1);

    const mainItemsAfterSecondTransfer = await listCaseItems(ctx, headers, mainCase.id);
    expect(Array.isArray(mainItemsAfterSecondTransfer)).toBeTruthy();
    expect(mainItemsAfterSecondTransfer.length).toBe(2);
    expect(mainItemsAfterSecondTransfer.filter((item) => String(item && item.title ? item.title : '') === 'S-1').length).toBe(0);

    const cleanup = await ctx.delete(`${apiBase}/api/projects/${project.id}`, { headers });
    expect([200, 404]).toContain(cleanup.status());
  });

  test('关联引用删除仅剔除组合并取消关联勾选', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const projectName = 'exec-assoc-delete-unlink-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec association delete unlinks selection' },
    });
    expect(createProj.status()).toBe(201);
    const project = await createProj.json();

    const createVer = await ctx.post(`${apiBase}/api/projects/${project.id}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(createVer.status()).toBe(201);
    const version = await createVer.json();

    const mainCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `主用例DeleteMain_${Date.now()}.json`,
      [
        { module: '登录', title: 'M-1', priority: 'P0', precondition: '无', steps: '步骤M1', expected: '结果M1', remark: '' },
        { module: '登录', title: 'M-2', priority: 'P1', precondition: '无', steps: '步骤M2', expected: '结果M2', remark: '' },
      ]
    );

    const subCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `副用例DeleteSub_${Date.now()}.json`,
      [
        { module: '支付', title: 'S-1', priority: 'P0', precondition: '无', steps: '步骤S1', expected: '结果S1', remark: '' },
      ]
    );

    const subItems = await listCaseItems(ctx, headers, subCase.id);
    expect(Array.isArray(subItems)).toBeTruthy();
    expect(subItems.length).toBe(1);

    const createAssocRes = await ctx.post(`${apiBase}/api/case-files/${mainCase.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: subCase.id,
        selected_case_item_ids: [subItems[0].id],
      },
    });
    expect(createAssocRes.status()).toBe(201);

    const transferRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: true,
      },
    });
    expect(transferRes.status()).toBe(200);
    const execSet = await transferRes.json();

    const listCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSet.id}/cases`, { headers });
    expect(listCasesRes.status()).toBe(200);
    const cases = await listCasesRes.json();
    expect(Array.isArray(cases)).toBeTruthy();
    expect(cases.length).toBe(3);
    const assocExecCase = cases.find((item) => String(item && item.title ? item.title : '') === 'S-1');
    expect(assocExecCase).toBeTruthy();

    const deleteExecCaseRes = await ctx.delete(`${apiBase}/api/exec/cases/${assocExecCase.id}`, { headers });
    expect(deleteExecCaseRes.status()).toBe(200);

    const assocListRes = await ctx.get(`${apiBase}/api/case-files/${mainCase.id}/associations`, { headers });
    expect(assocListRes.status()).toBe(200);
    const assocRows = await assocListRes.json();
    expect(Array.isArray(assocRows)).toBeTruthy();
    expect(assocRows.length).toBe(1);
    const selectedIds = Array.isArray(assocRows[0] && assocRows[0].selected_case_item_ids)
      ? assocRows[0].selected_case_item_ids
      : [];
    expect(selectedIds.length).toBe(0);

    const subItemsAfterDelete = await listCaseItems(ctx, headers, subCase.id);
    expect(Array.isArray(subItemsAfterDelete)).toBeTruthy();
    expect(subItemsAfterDelete.length).toBe(1);

    const transferAgainRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: true,
      },
    });
    expect(transferAgainRes.status()).toBe(200);

    const listCasesAgainRes = await ctx.get(`${apiBase}/api/exec/sets/${execSet.id}/cases`, { headers });
    expect(listCasesAgainRes.status()).toBe(200);
    const casesAgain = await listCasesAgainRes.json();
    expect(Array.isArray(casesAgain)).toBeTruthy();
    expect(casesAgain.length).toBe(2);
    expect(casesAgain.filter((item) => String(item && item.title ? item.title : '') === 'S-1').length).toBe(0);

    const cleanup = await ctx.delete(`${apiBase}/api/projects/${project.id}`, { headers });
    expect([200, 404]).toContain(cleanup.status());
  });

  test('副用例原用例外部改动会触发关联执行 diff 提示', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const projectName = 'exec-assoc-sub-diff-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec association sub-case diff sync' },
    });
    expect(createProj.status()).toBe(201);
    const project = await createProj.json();

    const createVer = await ctx.post(`${apiBase}/api/projects/${project.id}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(createVer.status()).toBe(201);
    const version = await createVer.json();

    const mainCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `主用例SubDiffMain_${Date.now()}.json`,
      [
        { module: '登录', title: 'M-1', priority: 'P0', precondition: '无', steps: '步骤M1', expected: '结果M1', remark: '' },
      ]
    );

    const subCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `副用例SubDiffSub_${Date.now()}.json`,
      [
        { module: '支付', title: 'S-1', priority: 'P0', precondition: '无', steps: '步骤S1', expected: '结果S1', remark: '' },
      ]
    );

    const subItems = await listCaseItems(ctx, headers, subCase.id);
    expect(Array.isArray(subItems)).toBeTruthy();
    expect(subItems.length).toBe(1);

    const createAssocRes = await ctx.post(`${apiBase}/api/case-files/${mainCase.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: subCase.id,
        selected_case_item_ids: [subItems[0].id],
      },
    });
    expect(createAssocRes.status()).toBe(201);

    const transferRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: true,
      },
    });
    expect(transferRes.status()).toBe(200);
    const execSet = await transferRes.json();

    const patchSubItemRes = await ctx.patch(`${apiBase}/api/case-files/items/${subItems[0].id}`, {
      headers,
      data: {
        expected: '结果S1-用户2改动',
      },
    });
    expect(patchSubItemRes.status()).toBe(200);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSet.id}/case-library-sync`, {
      headers,
      data: {},
    });
    expect(syncRes.status()).toBe(200);
    const syncBody = await syncRes.json();
    expect(syncBody && syncBody.has_new_diff).toBeTruthy();
    const diffRows = Array.isArray(syncBody && syncBody.diff) ? syncBody.diff : [];
    expect(diffRows.length).toBeGreaterThan(0);
    const hit = diffRows.find((row) => Number(row && row.case_item_id) === Number(subItems[0].id));
    expect(hit).toBeTruthy();
    const changedFields = Array.isArray(hit && hit.changed_fields) ? hit.changed_fields : [];
    expect(changedFields.includes('expected')).toBeTruthy();

    const cleanup = await ctx.delete(`${apiBase}/api/projects/${project.id}`, { headers });
    expect([200, 404]).toContain(cleanup.status());
  });


  test('副用例条目从库删除后，关联执行会同步删除并产出 diff', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-assoc-delete-from-library-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'assoc sub-case item delete should sync and diff' },
    });
    expect(createProj.status()).toBe(201);
    const project = await createProj.json();

    const createVer = await ctx.post(`${apiBase}/api/projects/${project.id}/versions`, {
      headers,
      data: { name: 'v1' },
    });
    expect(createVer.status()).toBe(201);
    const version = await createVer.json();

    const mainCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `主用例DeleteHitMain_${Date.now()}.json`,
      [
        { module: '登录', title: 'M-1', priority: 'P0', precondition: '无', steps: '步骤M1', expected: '结果M1', remark: '' },
      ]
    );

    const subCase = await importCaseFile(
      ctx,
      headers,
      project.id,
      version.id,
      `副用例DeleteHitSub_${Date.now()}.json`,
      [
        { module: '支付', title: 'S-1', priority: 'P0', precondition: '无', steps: '步骤S1', expected: '结果S1', remark: '' },
        { module: '支付', title: 'S-2', priority: 'P1', precondition: '无', steps: '步骤S2', expected: '结果S2', remark: '' },
      ]
    );

    const subItems = await listCaseItems(ctx, headers, subCase.id);
    expect(Array.isArray(subItems)).toBeTruthy();
    expect(subItems.length).toBe(2);

    const createAssocRes = await ctx.post(`${apiBase}/api/case-files/${mainCase.id}/associations`, {
      headers,
      data: {
        sub_case_file_id: subCase.id,
        selected_case_item_ids: [subItems[0].id, subItems[1].id],
      },
    });
    expect(createAssocRes.status()).toBe(201);

    const transferRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: {
        case_file_id: mainCase.id,
        exec_version_id: version.id,
        mode: 'replace',
        preserve_results: true,
        prefer_result_source: 'db',
        association_enabled: true,
      },
    });
    expect(transferRes.status()).toBe(200);
    const execSet = await transferRes.json();

    const firstExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSet.id}/cases`, { headers });
    expect(firstExecCasesRes.status()).toBe(200);
    const firstExecCases = await firstExecCasesRes.json();
    expect(Array.isArray(firstExecCases)).toBeTruthy();
    expect(firstExecCases.length).toBe(3);

    const deleteSubItem1Res = await ctx.delete(`${apiBase}/api/case-files/items/${subItems[0].id}`, { headers });
    expect(deleteSubItem1Res.status()).toBe(200);

    const assocAfterDelete1Res = await ctx.get(`${apiBase}/api/case-files/${mainCase.id}/associations`, { headers });
    expect(assocAfterDelete1Res.status()).toBe(200);
    const assocAfterDelete1 = await assocAfterDelete1Res.json();
    expect(Array.isArray(assocAfterDelete1)).toBeTruthy();
    expect(assocAfterDelete1.length).toBe(1);
    const selectedAfterDelete1 = Array.isArray(assocAfterDelete1[0] && assocAfterDelete1[0].selected_case_item_ids)
      ? assocAfterDelete1[0].selected_case_item_ids
      : [];
    expect(selectedAfterDelete1.length).toBe(1);
    expect(Number(selectedAfterDelete1[0])).toBe(Number(subItems[1].id));

    const sync1Res = await ctx.post(`${apiBase}/api/exec/sets/${execSet.id}/case-library-sync`, {
      headers,
      data: {},
    });
    expect(sync1Res.status()).toBe(200);
    const sync1 = await sync1Res.json();
    expect(sync1 && sync1.has_new_diff).toBeTruthy();
    expect(Number(sync1 && sync1.summary ? sync1.summary.deleted : 0)).toBe(1);
    const sync1DiffRows = Array.isArray(sync1 && sync1.diff) ? sync1.diff : [];
    const sync1Deleted = sync1DiffRows.find((row) => Number(row && row.case_item_id) === Number(subItems[0].id));
    expect(sync1Deleted).toBeTruthy();
    expect(String(sync1Deleted && sync1Deleted.kind ? sync1Deleted.kind : '')).toBe('deleted');

    const afterSync1CasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSet.id}/cases`, { headers });
    expect(afterSync1CasesRes.status()).toBe(200);
    const afterSync1Cases = await afterSync1CasesRes.json();
    expect(Array.isArray(afterSync1Cases)).toBeTruthy();
    expect(afterSync1Cases.length).toBe(2);
    expect(afterSync1Cases.filter((item) => String(item && item.title ? item.title : '') === 'S-1').length).toBe(0);
    expect(afterSync1Cases.filter((item) => String(item && item.title ? item.title : '') === 'S-2').length).toBe(1);

    const deleteSubItem2Res = await ctx.delete(`${apiBase}/api/case-files/items/${subItems[1].id}`, { headers });
    expect(deleteSubItem2Res.status()).toBe(200);

    const assocAfterDelete2Res = await ctx.get(`${apiBase}/api/case-files/${mainCase.id}/associations`, { headers });
    expect(assocAfterDelete2Res.status()).toBe(200);
    const assocAfterDelete2 = await assocAfterDelete2Res.json();
    expect(Array.isArray(assocAfterDelete2)).toBeTruthy();
    expect(assocAfterDelete2.length).toBe(0);

    const sync2Res = await ctx.post(`${apiBase}/api/exec/sets/${execSet.id}/case-library-sync`, {
      headers,
      data: {},
    });
    expect(sync2Res.status()).toBe(200);
    const sync2 = await sync2Res.json();
    expect(sync2 && sync2.has_new_diff).toBeTruthy();
    expect(Number(sync2 && sync2.summary ? sync2.summary.deleted : 0)).toBe(1);
    const sync2DiffRows = Array.isArray(sync2 && sync2.diff) ? sync2.diff : [];
    const sync2Deleted = sync2DiffRows.find((row) => Number(row && row.case_item_id) === Number(subItems[1].id));
    expect(sync2Deleted).toBeTruthy();
    expect(String(sync2Deleted && sync2Deleted.kind ? sync2Deleted.kind : '')).toBe('deleted');

    const afterSync2CasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSet.id}/cases`, { headers });
    expect(afterSync2CasesRes.status()).toBe(200);
    const afterSync2Cases = await afterSync2CasesRes.json();
    expect(Array.isArray(afterSync2Cases)).toBeTruthy();
    expect(afterSync2Cases.length).toBe(1);

    const cleanup = await ctx.delete(`${apiBase}/api/projects/${project.id}`, { headers });
    expect([200, 404]).toContain(cleanup.status());
    await ctx.dispose();
  });

});
