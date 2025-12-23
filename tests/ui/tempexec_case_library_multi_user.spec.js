const { test, expect, request } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const apiBase = process.env.API_BASE_URL || base;
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || 'chillytest_admin';

async function loginApi(ctx, username, password) {
  const res = await ctx.post(`${apiBase}/api/auth/login`, {
    data: { username: username, password: password },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body && body.access_token).toBeTruthy();
  return body.access_token;
}

async function ensureAuthed(page, token, user) {
  await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
  await page.evaluate((payload) => {
    try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
    if (window.app && window.app.apiClient && typeof window.app.apiClient.setToken === 'function') {
      window.app.apiClient.setToken(payload.token);
    }
    if (window.app && window.app.state) {
      window.app.state.currentUser = payload.user;
      window.app.state.authReady = true;
    }
    window.app = window.app || {};
    window.app.authReady = true;
  }, { token: token, user: user });
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await page.evaluate(() => {
        let token = '';
        try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
        return {
          hasApp: Boolean(window.app),
          authReady: Boolean(window.app && window.app.authReady === true),
          hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
          hasTempExecApi: Boolean(window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function'),
          token: token,
          tab: window.app && window.app.state ? window.app.state.activeTab : '',
        };
      });
    } catch (err) {
      last = { error: err && err.message ? err.message : 'evaluate failed' };
      await page.waitForTimeout(200);
      continue;
    }
    if (last && last.hasApp && last.authReady && last.hasSwitchTab && last.hasTempExecApi) return;
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

async function gotoIndex(page) {
  await page.goto(base + '/index.html');
}

test.describe('执行页-多用户用例库变更同步', () => {
  test('A/B 交替修改与刷新后：B 可打开且展示正确 diff', async ({ page }) => {
    const ctx = await request.newContext();
    const token = await loginApi(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'ui-multi-user-case-lib-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'ui multi user case lib' },
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
    const memberAName = 'ui_case_lib_a_' + Date.now();
    const memberBName = 'ui_case_lib_b_' + Date.now();

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
        file_name: '多用户同步_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '账户', title: '修改资料', priority: 'P0', precondition: '已登录', steps: '步骤0', expected: '成功', remark: '' },
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

    const tokenA = await loginApi(ctx, memberAName, memberPass);
    const tokenB = await loginApi(ctx, memberBName, memberPass);
    const headersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
    const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    const createExecSetA = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersA,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetA.status()).toBe(200);
    const execSetAId = (await createExecSetA.json()).id;

    const createExecSetB = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersB,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetB.status()).toBe(200);

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, tokenB);

    await gotoIndex(page);
    await ensureAuthed(page, tokenB, { id: memberBId, username: memberBName, role: 'user', level: 'member' });
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const stepA = '步骤A_' + Date.now();
    const stepB = '步骤B_' + Date.now();

    const updateA = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers: headersA,
      data: { steps: stepA },
    });
    expect(updateA.status()).toBe(200);

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const updateB = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers: headersB,
      data: { steps: stepB },
    });
    expect(updateB.status()).toBe(200);

    const syncA = await ctx.post(`${apiBase}/api/exec/sets/${execSetAId}/case-library-sync`, { headers: headersA, data: {} });
    expect(syncA.status()).toBe(200);

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    const isOpen = await diffDrawer.evaluate((el) => el.classList.contains('open'));
    if (!isOpen) {
      await btn.click();
    }
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('步骤0');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText(stepA);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText(stepB);
    await expect(page.locator('#tempExecCaseLibraryDiffStatus')).not.toContainText('失败');

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

  test('用例库改动后：B 刷新自动弹出用例变更', async ({ page }) => {
    const ctx = await request.newContext();
    const token = await loginApi(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'ui-auto-popup-case-lib-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'ui auto popup case lib' },
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
    const memberAName = 'ui_case_lib_auto_a_' + Date.now();
    const memberBName = 'ui_case_lib_auto_b_' + Date.now();

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
        file_name: '自动弹窗_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '账户', title: '修改资料', priority: 'P0', precondition: '已登录', steps: '步骤0', expected: '成功', remark: '' },
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

    const tokenA = await loginApi(ctx, memberAName, memberPass);
    const tokenB = await loginApi(ctx, memberBName, memberPass);
    const headersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
    const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    const createExecSetA = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersA,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetA.status()).toBe(200);
    const execSetAId = (await createExecSetA.json()).id;

    const createExecSetB = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersB,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetB.status()).toBe(200);

    const stepUpdated = '步骤A_' + Date.now();
    const updateRes = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers: headersA,
      data: { steps: stepUpdated },
    });
    expect(updateRes.status()).toBe(200);

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, tokenB);

    await gotoIndex(page);
    await ensureAuthed(page, tokenB, { id: memberBId, username: memberBName, role: 'user', level: 'member' });
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('步骤0');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText(stepUpdated);

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

  test('A 连续改动两次后：B 刷新可看到两条记录', async ({ page }) => {
    const ctx = await request.newContext();
    const token = await loginApi(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'ui-double-change-case-lib-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'ui exec double change history' },
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
    const memberAName = 'ui_case_lib_a2_' + Date.now();
    const memberBName = 'ui_case_lib_b2_' + Date.now();

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
        file_name: '执行页双改_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '账户', title: '修改资料', priority: 'P0', precondition: '已登录', steps: '步骤0', expected: '成功', remark: '' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const tokenA = await loginApi(ctx, memberAName, memberPass);
    const tokenB = await loginApi(ctx, memberBName, memberPass);
    const headersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
    const headersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    const createExecSetA = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersA,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetA.status()).toBe(200);
    const execSetAId = (await createExecSetA.json()).id;

    const createExecSetB = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersB,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetB.status()).toBe(200);

    const listExecCasesRes = await ctx.get(`${apiBase}/api/exec/sets/${execSetAId}/cases`, { headers: headersA });
    expect(listExecCasesRes.status()).toBe(200);
    const execCases = await listExecCasesRes.json();
    expect(execCases.length).toBe(1);
    const execCaseId = execCases[0].id;

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, tokenB);

    await gotoIndex(page);
    await ensureAuthed(page, tokenB, { id: memberBId, username: memberBName, role: 'user', level: 'member' });
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const step1 = '步骤A_' + Date.now();
    const step2 = '步骤B_' + Date.now();
    const update1 = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseId}`, {
      headers: headersA,
      data: { steps: step1 },
    });
    expect(update1.status()).toBe(200);
    await page.waitForTimeout(1100);
    const update2 = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseId}`, {
      headers: headersA,
      data: { steps: step2 },
    });
    expect(update2.status()).toBe(200);

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    const isOpen = await diffDrawer.evaluate((el) => el.classList.contains('open'));
    if (!isOpen) {
      await btn.click();
    }
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('步骤0');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText(step1);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText(step2);
    await expect(page.locator('#tempExecCaseLibraryDiffStatus')).not.toContainText('失败');

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

  test('版本盒子删除后重新导入：用例变更自动刷新', async ({ page }) => {
    const ctx = await request.newContext();
    const token = await loginApi(ctx, adminUser, adminPass);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'ui-case-lib-reset-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers,
      data: { name: projectName, description: 'ui case lib diff reset on reimport' },
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
    const memberName = 'ui_case_lib_reset_' + Date.now();
    const createUser = await ctx.post(`${apiBase}/api/users`, {
      headers,
      data: { username: memberName, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUser.status()).toBe(201);
    const memberId = (await createUser.json()).id;

    const assign = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers,
      data: { user_id: memberId, project_ids: [projectId] },
    });
    expect(assign.status()).toBe(200);

    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: '变更刷新_' + Date.now() + '.json',
        source: 'api-test',
        items: [
          { module: '账户', title: '修改资料', priority: 'P0', precondition: '已登录', steps: '步骤0', expected: '成功', remark: '' },
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

    const tokenMember = await loginApi(ctx, memberName, memberPass);
    const headersMember = { Authorization: `Bearer ${tokenMember}`, 'Content-Type': 'application/json' };

    const createExecSetRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersMember,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetRes.status()).toBe(200);
    const execSetId = (await createExecSetRes.json()).id;

    const newSteps = '步骤A_' + Date.now();
    const updateItemRes = await ctx.patch(`${apiBase}/api/case-files/items/${caseItemId}`, {
      headers,
      data: { steps: newSteps },
    });
    expect(updateItemRes.status()).toBe(200);

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, tokenMember);

    await gotoIndex(page);
    await ensureAuthed(page, tokenMember, { id: memberId, username: memberName, role: 'user', level: 'member' });
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();
    await page.evaluate((id) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer === 'function') {
        window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer({ manual: true, execSetId: String(id) });
      }
    }, execSetId);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('步骤0');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText(newSteps);

    await page.evaluate((id) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.removeTempExecFile === 'function') {
        window.app.tempExecApi.removeTempExecFile(String(id));
      }
    }, execSetId);

    const reimportRes = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersMember,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(reimportRes.status()).toBe(200);
    const newExecSetId = (await reimportRes.json()).id;

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });
    await page.waitForFunction((id) => {
      if (!window.app || !window.app.state || !Array.isArray(window.app.state.tempExecFiles)) return false;
      return window.app.state.tempExecFiles.some((file) => String(file && file.id) === String(id));
    }, newExecSetId);
    await page.evaluate((id) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(String(id));
      }
    }, newExecSetId);

    await page.evaluate((id) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer === 'function') {
        window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer({ manual: true, execSetId: String(id) });
      }
    }, newExecSetId);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('暂无变更');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).not.toContainText(newSteps);
    await expect(page.locator('#tempExecCaseLibraryDiffStatus')).not.toContainText('失败');

    const cleanupRes = await ctx.delete(`${apiBase}/api/projects/${projectId}`, { headers });
    expect(cleanupRes.status()).toBe(200);
    const delUser = await ctx.post(`${apiBase}/api/users/${memberId}/delete`, {
      headers,
      data: { admin_password: adminPass },
    });
    expect(delUser.status()).toBe(200);
  });
});
