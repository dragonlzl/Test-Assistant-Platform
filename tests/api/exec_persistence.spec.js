const { test, expect, request } = require('@playwright/test');
const { execSync } = require('child_process');
const path = require('path');

test.describe('exec persistence api', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';
  const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

  async function login(ctx, username, password) {
    const res = await ctx.post(`${apiBase}/api/auth/login`, {
      data: { username: username, password: password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.access_token;
  }

  test('upsert/patch sync/archive restore/create-by-case_item', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-proj-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec persistence api' },
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
        file_name: '勾选用例-执行入库_result_20251213121212.json',
        source: 'apitest',
        items: [
          { module: '模块A', title: '用例A', expected: 'ok', priority: 'P0', precondition: '', steps: '', remark: '' },
          { module: '模块A', title: '用例B', expected: 'ok', priority: 'P1', precondition: '', steps: '', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const itemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsRes.status()).toBe(200);
    const items = await itemsRes.json();
    expect(items.length).toBe(2);

    const upsertRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertRes.status()).toBe(200);
    const execSet = await upsertRes.json();
    expect(execSet && execSet.id).toBeTruthy();
    expect(execSet.project_id).toBe(projectId);
    expect(execSet.version_id).toBe(versionId);
    expect(execSet.case_file_id).toBe(caseFileId);
    expect(execSet.status).toBe('active');
    const execSetId = execSet.id;

    // 默认非复用，切换为复用后应同步到用例库（case_files.reuse_enabled = true）。
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

    // 执行页取消勾选复用：应同步到用例库（case_files.reuse_enabled = false），避免后续导入/同步又反向开启。
    const toggleReuseOffRes = await ctx.patch(`${apiBase}/api/exec/sets/${execSetId}`, {
      headers,
      data: { reuse_enabled: false },
    });
    expect(toggleReuseOffRes.status()).toBe(200);

    const listCaseFilesOffRes = await ctx.get(`${apiBase}/api/case-files?project_id=${projectId}`, { headers });
    expect(listCaseFilesOffRes.status()).toBe(200);
    const listedOff = await listCaseFilesOffRes.json();
    const matchedFileOff = Array.isArray(listedOff) ? listedOff.find((f) => f && f.id === caseFileId) : null;
    expect(matchedFileOff && matchedFileOff.reuse_enabled).toBeFalsy();

    // 兼容旧数据：exec_sets.case_file_id 为空但 source 内含 case_file_id 时，复用开关也应同步到用例库。
    // 使用另一份用例文件隔离验证，避免影响后续“from-case-file upsert 复用同一 exec_set”断言。
    const legacyImportRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: 'legacy-source_result_20251216121212.json',
        source: 'apitest',
        items: [
          { module: '模块L', title: '用例L', expected: 'ok', priority: 'P0', precondition: '', steps: '', remark: '' },
        ],
      },
    });
    expect(legacyImportRes.status()).toBe(201);
    const legacyCaseFile = await legacyImportRes.json();
    const legacyCaseFileId = legacyCaseFile.id;
    expect(legacyCaseFileId).toBeTruthy();

    const legacySetRes = await ctx.post(`${apiBase}/api/exec/sets`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        name: 'legacy-source-set',
        source: `case_file:${legacyCaseFileId}`,
        reuse_enabled: false,
        reuse_presets: [],
      },
    });
    expect(legacySetRes.status()).toBe(201);
    const legacySet = await legacySetRes.json();
    expect(legacySet && legacySet.id).toBeTruthy();
    expect(legacySet.case_file_id).toBeFalsy();

    const legacyToggleOnRes = await ctx.patch(`${apiBase}/api/exec/sets/${legacySet.id}`, {
      headers,
      data: { reuse_enabled: true },
    });
    expect(legacyToggleOnRes.status()).toBe(200);

    const legacyListOnRes = await ctx.get(`${apiBase}/api/case-files?project_id=${projectId}`, { headers });
    expect(legacyListOnRes.status()).toBe(200);
    const legacyListedOn = await legacyListOnRes.json();
    const legacyMatchedOn = Array.isArray(legacyListedOn) ? legacyListedOn.find((f) => f && f.id === legacyCaseFileId) : null;
    expect(legacyMatchedOn && legacyMatchedOn.reuse_enabled).toBeTruthy();

    const legacyToggleOffRes = await ctx.patch(`${apiBase}/api/exec/sets/${legacySet.id}`, {
      headers,
      data: { reuse_enabled: false },
    });
    expect(legacyToggleOffRes.status()).toBe(200);

    const legacyListOffRes = await ctx.get(`${apiBase}/api/case-files?project_id=${projectId}`, { headers });
    expect(legacyListOffRes.status()).toBe(200);
    const legacyListedOff = await legacyListOffRes.json();
    const legacyMatchedOff = Array.isArray(legacyListedOff) ? legacyListedOff.find((f) => f && f.id === legacyCaseFileId) : null;
    expect(legacyMatchedOff && legacyMatchedOff.reuse_enabled).toBeFalsy();

    // 关闭后再次转执行/同步：不应被用例库“反向开启”为复用。
    const upsertAgainRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertAgainRes.status()).toBe(200);
    const upsertAgain = await upsertAgainRes.json();
    expect(upsertAgain && upsertAgain.id).toBe(execSetId);
    expect(upsertAgain.reuse_enabled).toBeFalsy();

    // 执行集按用户隔离：同一个 case_file，不同用户应各自拥有一份 exec_set，且互不可访问/覆盖。
    const otherUsername = 'exec-user-' + Date.now();
    const createUserRes = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username: otherUsername, role: 'user', level: 'member' },
    });
    expect(createUserRes.status()).toBe(201);
    const otherUser = await createUserRes.json();
    expect(otherUser && otherUser.id).toBeTruthy();

    const assignRes = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers,
      data: { user_id: otherUser.id, project_ids: [projectId] },
    });
    expect(assignRes.status()).toBe(200);

    const otherToken = await login(ctx, otherUsername, '12345678');
    const otherHeaders = { Authorization: `Bearer ${otherToken}`, 'Content-Type': 'application/json' };

    const otherUpsertRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: otherHeaders,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(otherUpsertRes.status()).toBe(200);
    const otherExecSet = await otherUpsertRes.json();
    expect(otherExecSet && otherExecSet.id).toBeTruthy();
    expect(otherExecSet.id).not.toBe(execSetId);
    expect(otherExecSet.case_file_id).toBe(caseFileId);

    const listMineRes = await ctx.get(`${apiBase}/api/exec/sets?project_id=${projectId}`, { headers });
    expect(listMineRes.status()).toBe(200);
    const mineSets = await listMineRes.json();
    expect(Array.isArray(mineSets)).toBeTruthy();
    expect(mineSets.some((s) => s && s.id === execSetId)).toBeTruthy();
    const mineSet = mineSets.find((s) => s && s.id === execSetId);
    expect(mineSet && mineSet.case_count).toBe(2);
    expect(mineSets.some((s) => s && s.id === otherExecSet.id)).toBeFalsy();

    const listOtherRes = await ctx.get(`${apiBase}/api/exec/sets?project_id=${projectId}`, { headers: otherHeaders });
    expect(listOtherRes.status()).toBe(200);
    const otherSets = await listOtherRes.json();
    expect(Array.isArray(otherSets)).toBeTruthy();
    expect(otherSets.some((s) => s && s.id === otherExecSet.id)).toBeTruthy();
    expect(otherSets.some((s) => s && s.id === execSetId)).toBeFalsy();

    // 执行结果写入按个人隔离：非管理员不可修改他人的执行集；但用例列表接口允许同项目成员只读访问（供执行总览等场景查看）。
    const forbiddenPatchRes = await ctx.patch(`${apiBase}/api/exec/sets/${execSetId}`, {
      headers: otherHeaders,
      data: { requirement: 'forbidden' },
    });
    expect(forbiddenPatchRes.status()).toBe(403);

    const readonlyRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers: otherHeaders });
    expect(readonlyRes.status()).toBe(200);

    const listExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(listExecCasesRes.status()).toBe(200);
    const execCases = await listExecCasesRes.json();
    expect(execCases.length).toBe(2);
    const first = execCases[0];

    const updatedTitle = first.title + '（已更新）';
    const patchCaseRes = await ctx.patch(`${apiBase}/api/exec/cases/${first.id}`, {
      headers,
      data: { title: updatedTitle },
    });
    expect(patchCaseRes.status()).toBe(200);
    const patchedCase = await patchCaseRes.json();
    expect(patchedCase.title).toBe(updatedTitle);

    const itemsAfterTitleRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsAfterTitleRes.status()).toBe(200);
    const itemsAfterTitle = await itemsAfterTitleRes.json();
    const itemAfterTitle = itemsAfterTitle.find((it) => it.id === first.case_item_id);
    expect(itemAfterTitle && itemAfterTitle.title).toBe(updatedTitle);
    const itemUpdatedAtAfterTitle = itemAfterTitle.updated_at;

    const patchStatusRes = await ctx.patch(`${apiBase}/api/exec/cases/${first.id}`, {
      headers,
      data: { status: '通过', defect_links: ['BUG-1'] },
    });
    expect(patchStatusRes.status()).toBe(200);

    const reuseDetails = [
      { id: 'reuse-detail-a-' + Date.now(), text: '子项1', note: '', status: '通过', presetId: 'preset-a' },
      { id: 'reuse-detail-b-' + Date.now(), text: '子项2', note: '', status: '失败', presetId: 'preset-b' },
    ];
    const patchReuseRes = await ctx.patch(`${apiBase}/api/exec/cases/${first.id}`, {
      headers,
      data: { reuse_details: reuseDetails },
    });
    expect(patchReuseRes.status()).toBe(200);
    const patchedReuse = await patchReuseRes.json();
    expect(Array.isArray(patchedReuse.reuse_details)).toBeTruthy();
    expect(patchedReuse.reuse_details.length).toBe(2);
    expect(patchedReuse.reuse_details[0].status).toBe('通过');
    expect(patchedReuse.reuse_details[1].status).toBe('失败');

    const afterReuseRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(afterReuseRes.status()).toBe(200);
    const afterReuseCases = await afterReuseRes.json();
    const afterReuseCase = afterReuseCases.find((item) => item.id === first.id);
    expect(afterReuseCase && Array.isArray(afterReuseCase.reuse_details)).toBeTruthy();
    expect(afterReuseCase.reuse_details.length).toBe(2);

    const itemsAfterStatusRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsAfterStatusRes.status()).toBe(200);
    const itemsAfterStatus = await itemsAfterStatusRes.json();
    const itemAfterStatus = itemsAfterStatus.find((it) => it.id === first.case_item_id);
    expect(itemAfterStatus.updated_at).toBe(itemUpdatedAtAfterTitle);

    const importCases = [
      {
        module: patchedCase.module,
        title: patchedCase.title,
        expected: patchedCase.expected,
        status: '失败',
        remark: 'import-remark',
        defect_links: ['BUG-9'],
        reuse_details: [],
      },
    ];
    const keepDbRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db', import_cases: importCases },
    });
    expect(keepDbRes.status()).toBe(200);
    const casesAfterKeepDbRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesAfterKeepDbRes.status()).toBe(200);
    const casesAfterKeepDb = await casesAfterKeepDbRes.json();
    const keepDbCase = casesAfterKeepDb.find((c) => c.id === first.id);
    expect(keepDbCase && keepDbCase.status).toBe('通过');

    const preferImportRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'import', import_cases: importCases },
    });
    expect(preferImportRes.status()).toBe(200);
    const casesAfterPreferImportRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesAfterPreferImportRes.status()).toBe(200);
    const casesAfterPreferImport = await casesAfterPreferImportRes.json();
    const preferImportCase = casesAfterPreferImport.find((c) => c.id === first.id);
    expect(preferImportCase && preferImportCase.status).toBe('失败');

    const archiveRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/archive`, {
      headers,
      data: { reason: '存在失败用例，仍需归档以便留存结果' },
    });
    expect(archiveRes.status()).toBe(200);

    const restoreRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(restoreRes.status()).toBe(200);
    const restoredSet = await restoreRes.json();
    expect(restoredSet.id).not.toBe(execSetId);
    expect(restoredSet.status).toBe('active');
    const activeExecSetId = restoredSet.id;

    const execCasesAfterRestoreRes = await ctx.get(`${apiBase}/api/exec/sets/${activeExecSetId}/cases`, { headers });
    expect(execCasesAfterRestoreRes.status()).toBe(200);
    const execCasesAfterRestore = await execCasesAfterRestoreRes.json();
    const restoredFirst = execCasesAfterRestore.find((c) => c && c.case_item_id === first.case_item_id);
    // 归档后恢复执行集时：会按用例库基线刷新基础字段；若执行用例已存在结果且字段发生变化，则标记为“变更重跑”提醒重新确认。
    // 新语义：归档后会创建新的执行集，默认为未执行状态。
    expect(restoredFirst && restoredFirst.status).toBe('未执行');

    const createItemRes = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items`, {
      headers,
      data: {
        module: '模块A',
        title: '新增用例',
        expected: 'ok-new',
        priority: 'P2',
        precondition: '',
        steps: '',
        remark: '',
      },
    });
    expect(createItemRes.status()).toBe(201);
    const newItem = await createItemRes.json();

    const lastCaseId = execCasesAfterRestore.length ? execCasesAfterRestore[execCasesAfterRestore.length - 1].id : null;
    const createExecCaseRes = await ctx.post(`${apiBase}/api/exec/sets/${activeExecSetId}/cases`, {
      headers,
      data: { case_item_id: newItem.id, status: '未执行', after_case_id: lastCaseId },
    });
    expect(createExecCaseRes.status()).toBe(201);
    const createdExec = await createExecCaseRes.json();
    expect(createdExec.case_item_id).toBe(newItem.id);
    expect(createdExec.module).toBe(newItem.module);
    expect(createdExec.title).toBe(newItem.title);

    const blankExecRes = await ctx.post(`${apiBase}/api/exec/sets/${activeExecSetId}/cases`, {
      headers,
      data: { status: '未执行' },
    });
    expect(blankExecRes.status()).toBe(201);
    const blankExec = await blankExecRes.json();
    expect(blankExec.case_item_id).toBe(null);

    const autoBindRes = await ctx.patch(`${apiBase}/api/exec/cases/${blankExec.id}`, {
      headers,
      data: { module: '模块Z', title: '临时用例', expected: 'ok-auto', priority: 'P1', precondition: '已登录', steps: '步骤Z' },
    });
    expect(autoBindRes.status()).toBe(200);
    const autoBound = await autoBindRes.json();
    expect(autoBound.case_item_id).toBeTruthy();
    expect(autoBound.module).toBe('模块Z');
    expect(autoBound.title).toBe('临时用例');

    // 覆盖导入（case_file overwrite）后：replace + preserve_results=false 应彻底替换执行集用例，避免残留旧 exec_cases 造成“追加合并”。
    const overwriteRes = await ctx.post(`${apiBase}/api/case-files/import?overwrite=1`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '勾选用例-执行入库_result_20251213121212.json',
        source: 'apitest',
        items: [
          { module: '模块A', title: '覆盖后用例1', expected: 'ok', priority: 'P0', precondition: '', steps: '', remark: '' },
        ],
      },
    });
    expect(overwriteRes.status()).toBe(200);
    const overwrittenFile = await overwriteRes.json();
    expect(overwrittenFile && overwrittenFile.id).toBe(caseFileId);

    const hardReplaceRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: false, prefer_result_source: 'db' },
    });
    expect(hardReplaceRes.status()).toBe(200);
    const hardSet = await hardReplaceRes.json();
    expect(hardSet.id).toBe(activeExecSetId);

    const hardCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${activeExecSetId}/cases`, { headers });
    expect(hardCasesRes.status()).toBe(200);
    const hardCases = await hardCasesRes.json();
    expect(Array.isArray(hardCases)).toBeTruthy();
    expect(hardCases.length).toBe(1);
    expect(hardCases[0].title).toBe('覆盖后用例1');

    const foreignImportRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '勾选用例-另一个用例_result_20251213121212.json',
        source: 'apitest',
        items: [{ module: '模块B', title: '外部用例', expected: 'ok' }],
      },
    });
    expect(foreignImportRes.status()).toBe(201);
    const foreignCaseFileId = (await foreignImportRes.json()).id;
    const foreignItemsRes = await ctx.get(`${apiBase}/api/case-files/${foreignCaseFileId}/items`, { headers });
    expect(foreignItemsRes.status()).toBe(200);
    const foreignItems = await foreignItemsRes.json();
    expect(foreignItems.length).toBe(1);

    const badCreateRes = await ctx.post(`${apiBase}/api/exec/sets/${activeExecSetId}/cases`, {
      headers,
      data: { case_item_id: foreignItems[0].id },
    });
    expect(badCreateRes.status()).toBe(400);

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect([200, 404]).toContain(delProj.status());

    // cleanup other user
    const delUser = await ctx.delete(`${apiBase}/api/users/${otherUser.id}`, {
      headers,
      data: { admin_password: adminPass },
    });
    expect([200, 404]).toContain(delUser.status());
  });

  test('create exec case honors legacy order when order_no missing', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-order-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec order normalize' },
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
        file_name: 'exec-order-' + Date.now() + '.json',
        source: 'apitest',
        items: [
          { module: '模块A', title: '用例A', expected: 'ok', priority: 'P0', precondition: '', steps: '', remark: '' },
          { module: '模块A', title: '用例B', expected: 'ok', priority: 'P1', precondition: '', steps: '', remark: '' },
          { module: '模块A', title: '用例C', expected: 'ok', priority: 'P2', precondition: '', steps: '', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFileId = (await importRes.json()).id;

    const upsertRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertRes.status()).toBe(200);
    const execSetId = (await upsertRes.json()).id;

    const casesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesRes.status()).toBe(200);
    const execCases = await casesRes.json();
    expect(execCases.length).toBe(3);
    const firstCaseId = execCases[0].id;
    const secondCaseId = execCases[1].id;
    const thirdCaseId = execCases[2].id;

    const dbPath = path.resolve(__dirname, '..', '..', 'data', 'apitest.db');
    const script = `
import sqlite3
db = r"""${dbPath}"""
conn = sqlite3.connect(db)
cur = conn.cursor()
cur.execute("UPDATE exec_cases SET order_no=0 WHERE exec_set_id=?", (${execSetId},))
conn.commit()
conn.close()
`;
    execSync(`python3 - <<'PY'\n${script}\nPY`);

    const createItemRes = await ctx.post(`${apiBase}/api/case-files/${caseFileId}/items`, {
      headers,
      data: {
        module: '模块A',
        title: '插入用例',
        expected: 'ok-insert',
        priority: 'P1',
        precondition: '',
        steps: '',
        remark: '',
      },
    });
    expect(createItemRes.status()).toBe(201);
    const newItem = await createItemRes.json();

    const insertRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases`, {
      headers,
      data: { case_item_id: newItem.id, status: '未执行', after_case_id: firstCaseId },
    });
    expect(insertRes.status()).toBe(201);
    const inserted = await insertRes.json();
    expect(inserted.case_item_id).toBe(newItem.id);

    const casesAfterRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesAfterRes.status()).toBe(200);
    const casesAfter = await casesAfterRes.json();
    const idsAfter = casesAfter.map((c) => c.id);
    expect(idsAfter).toEqual([firstCaseId, inserted.id, secondCaseId, thirdCaseId]);

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });

  test('exec insert keeps order after case library sync', async () => {
    const ctx = await request.newContext();
    const token = await login(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'exec-sync-order-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'exec sync order' },
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
        file_name: 'exec-sync-order-' + Date.now() + '.json',
        source: 'apitest',
        items: [
          { module: '模块A', title: '用例A', expected: 'ok', priority: 'P0', precondition: 'pre-a', steps: 'step-a', remark: '' },
          { module: '模块A', title: '用例B', expected: 'ok', priority: 'P1', precondition: 'pre-b', steps: 'step-b', remark: '' },
          { module: '模块A', title: '用例C', expected: 'ok', priority: 'P2', precondition: 'pre-c', steps: 'step-c', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFileId = (await importRes.json()).id;

    const upsertRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers,
      data: { case_file_id: caseFileId, mode: 'replace', prefer_result_source: 'db' },
    });
    expect(upsertRes.status()).toBe(200);
    const execSetId = (await upsertRes.json()).id;

    const casesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesRes.status()).toBe(200);
    const execCases = await casesRes.json();
    expect(execCases.length).toBe(3);
    const firstCaseId = execCases[0].id;
    const secondCaseId = execCases[1].id;
    const thirdCaseId = execCases[2].id;

    const insertRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/cases`, {
      headers,
      data: {
        after_case_id: firstCaseId,
        module: '模块A',
        title: '执行插入',
        expected: 'ok-insert',
        priority: 'P1',
        precondition: 'pre-insert',
        steps: 'step-insert',
        remark: '',
        status: '未执行',
      },
    });
    expect(insertRes.status()).toBe(201);
    const inserted = await insertRes.json();
    expect(inserted && inserted.case_item_id).toBeTruthy();

    const casesAfterRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesAfterRes.status()).toBe(200);
    const casesAfter = await casesAfterRes.json();
    const idsAfter = casesAfter.map((c) => c.id);
    expect(idsAfter).toEqual([firstCaseId, inserted.id, secondCaseId, thirdCaseId]);

    const itemsRes = await ctx.get(`${apiBase}/api/case-files/${caseFileId}/items`, { headers });
    expect(itemsRes.status()).toBe(200);
    const items = await itemsRes.json();
    const titles = items.map((it) => it.title);
    expect(titles).toEqual(['用例A', '执行插入', '用例B', '用例C']);

    const syncRes = await ctx.post(`${apiBase}/api/exec/sets/${execSetId}/case-library-sync`, { headers });
    expect(syncRes.status()).toBe(200);

    const casesSyncRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetId}/cases`, { headers });
    expect(casesSyncRes.status()).toBe(200);
    const casesAfterSync = await casesSyncRes.json();
    const idsAfterSync = casesAfterSync.map((c) => c.id);
    expect(idsAfterSync).toEqual([firstCaseId, inserted.id, secondCaseId, thirdCaseId]);

    const delProj = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(delProj.status()).toBe(200);
  });
});
