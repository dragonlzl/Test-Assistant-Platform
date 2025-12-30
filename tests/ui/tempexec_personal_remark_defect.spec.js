const { test, expect, request } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8080';
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

test.describe('执行视图备注与缺陷链接保持个人', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('个人备注与缺陷链接不影响他人执行集', async ({ page }) => {
    const ctx = await request.newContext();
    const adminToken = await loginApi(ctx, adminUser, adminPass);
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    const healthRes = await ctx.get(`${apiBase}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health && health.status).toBe('ok');
    expect(String(health && health.db_file ? health.db_file : '')).toContain('apitest');

    const projectName = 'ui-personal-' + Date.now();
    const createProj = await ctx.post(`${apiBase}/api/projects`, {
      headers: adminHeaders,
      data: { name: projectName, description: 'ui personal remark/defect' },
    });
    expect(createProj.status()).toBe(201);
    const projectId = (await createProj.json()).id;

    const verRes = await ctx.post(`${apiBase}/api/projects/${projectId}/versions`, {
      headers: adminHeaders,
      data: { name: 'v1' },
    });
    expect(verRes.status()).toBe(201);
    const versionId = (await verRes.json()).id;

    const baseRemark = '基线备注';
    const importRes = await ctx.post(`${apiBase}/api/case-files/import`, {
      headers: adminHeaders,
      data: {
        project_id: projectId,
        version_id: versionId,
        file_name: 'ui-personal-' + Date.now() + '.json',
        source: 'apitest',
        items: [
          { module: '模块A', title: '用例A', expected: 'ok', priority: 'P0', precondition: '', steps: '', remark: baseRemark },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const caseFile = await importRes.json();
    const caseFileId = caseFile.id;

    const memberPass = 'Pwd123456';
    const memberAName = 'ui_personal_a_' + Date.now();
    const memberBName = 'ui_personal_b_' + Date.now();

    const createUserA = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: memberAName, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUserA.status()).toBe(201);
    const memberAId = (await createUserA.json()).id;

    const createUserB = await ctx.post(`${apiBase}/api/users`, {
      headers: adminHeaders,
      data: { username: memberBName, password: memberPass, role: 'user', level: 'member', is_active: true },
    });
    expect(createUserB.status()).toBe(201);
    const memberBId = (await createUserB.json()).id;

    const assignA = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: memberAId, project_ids: [projectId] },
    });
    expect(assignA.status()).toBe(200);
    const assignB = await ctx.post(`${apiBase}/api/users/assign-projects`, {
      headers: adminHeaders,
      data: { user_id: memberBId, project_ids: [projectId] },
    });
    expect(assignB.status()).toBe(200);

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

    const listExecCasesA = await ctx.get(`${apiBase}/api/exec/sets/${execSetAId}/cases`, { headers: headersA });
    expect(listExecCasesA.status()).toBe(200);
    const execCasesA = await listExecCasesA.json();
    expect(execCasesA.length).toBe(1);
    const execCaseA = execCasesA[0];

    const personalRemark = '个人备注-' + Date.now();
    const patchRes = await ctx.patch(`${apiBase}/api/exec/cases/${execCaseA.id}`, {
      headers: headersA,
      data: { remark: personalRemark, defect_links: ['BUG-1'] },
    });
    expect(patchRes.status()).toBe(200);

    const createExecSetB = await ctx.post(`${apiBase}/api/exec/sets/from-case-file`, {
      headers: headersB,
      data: { case_file_id: caseFileId, mode: 'replace', preserve_results: true, prefer_result_source: 'db' },
    });
    expect(createExecSetB.status()).toBe(200);
    const execSetBId = (await createExecSetB.json()).id;

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, tokenB);

    await page.goto(base + '/index.html');
    await ensureAuthed(page, tokenB, { id: memberBId, username: memberBName, role: 'user', level: 'member' });
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });
    await page.evaluate((fileId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(String(fileId));
      }
    }, execSetBId);

    await page.waitForSelector(`[data-temp-case-row="${execSetBId}"][data-index="0"]`, { timeout: 15000 });
    const personalState = await page.evaluate((execId) => {
      const files = window.app && window.app.state ? window.app.state.tempExecFiles : [];
      const file = files.find((item) => String(item && (item.execSetId || item.id)) === String(execId));
      const entry = file && Array.isArray(file.cases) ? file.cases[0] : null;
      return {
        remark: entry ? entry.remark : null,
        defectLinks: entry ? entry.defectLinks : null,
      };
    }, execSetBId);

    expect(personalState.remark).toBe(baseRemark);
    expect(Array.isArray(personalState.defectLinks) ? personalState.defectLinks.length : 0).toBe(0);
  });
});
