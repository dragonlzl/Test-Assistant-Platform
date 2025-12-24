const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
    timeout,
  });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout });
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

function createApiHandler(serverState) {
  let settingSeq = 1;
  return async function(route) {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    const user = serverState.user;
    const projects = serverState.projects;
    const versionsByProject = serverState.versionsByProject;
    const execSets = serverState.execSets;
    const casesBySetId = serverState.casesBySetId;

    if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
    if (pathName === '/api/projects' && method === 'GET') return respond(200, projects.slice());

    const versionsMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
    if (versionsMatch && method === 'GET') {
      const pid = Number(versionsMatch[1]);
      return respond(200, (versionsByProject[pid] || []).slice());
    }

    if (pathName === '/api/settings' && method === 'GET') return respond(200, serverState.settings.slice());
    if (pathName === '/api/settings' && method === 'PUT') {
      const body = route.request().postDataJSON() || {};
      const scope = body.scope || 'user';
      const items = Array.isArray(body.items) ? body.items : [];
      const now = new Date().toISOString();
      const saved = [];
      items.forEach((item) => {
        if (!item || !item.key) return;
        const ownerId = scope === 'global' ? null : user.id;
        let existing = serverState.settings.find(
          (row) => row.key === item.key && row.scope === scope && row.owner_id === ownerId
        );
        if (existing) {
          existing.value_json = item.value_json;
          existing.updated_at = now;
          saved.push(existing);
          return;
        }
        const next = {
          id: settingSeq++,
          scope,
          owner_id: ownerId,
          key: item.key,
          value_json: item.value_json,
          updated_at: now,
        };
        serverState.settings.push(next);
        saved.push(next);
      });
      serverState.lastSettingsPayload = body;
      return respond(200, saved);
    }

    if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, execSets.slice());
    const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
    if (execCasesMatch && method === 'GET') {
      const execSetId = Number(execCasesMatch[1]);
      return respond(200, (casesBySetId[execSetId] || []).slice());
    }

    if (pathName === '/api/models' && method === 'GET') return respond(200, []);
    if (pathName === '/api/features' && method === 'GET') return respond(200, []);
    if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
    if (pathName === '/api/auth/logout') return respond(200, {});

    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  };
}

async function setupPage(context, apiHandler, token) {
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.indexOf('/api/') !== -1) return apiHandler(route);
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript((tk) => {
    try {
      localStorage.setItem('tap-auth-token', tk);
    } catch (_) {}
  }, token);
  await gotoIndex(page);
  await waitAppReady(page, 30000);
  return page;
}

test.describe('用例执行-导入抽屉项目筛选持久化', () => {
  test('项目按钮过滤下方分组，并持久化到 DB（跨刷新/重登）', async ({ browser }) => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const serverState = {
      user: { id: 7, username: 'demo_user', role: 'user', level: 'member' },
      projects: [
        { id: 1, name: '项目A', description: '' },
        { id: 2, name: '项目B', description: '' },
      ],
      versionsByProject: {
        1: [{ id: 11, project_id: 1, name: 'v1' }],
        2: [{ id: 21, project_id: 2, name: 'v2' }],
      },
      execSets: [
        { id: 1001, project_id: 1, version_id: 11, case_file_id: 101, case_count: 1, name: '用例A', status: 'active', created_at: iso(now - 2000), updated_at: iso(now - 200) },
        { id: 2001, project_id: 2, version_id: 21, case_file_id: 201, case_count: 1, name: '用例B', status: 'active', created_at: iso(now - 1500), updated_at: iso(now - 100) },
      ],
      casesBySetId: {
        1001: [{ id: 3001, exec_set_id: 1001, case_item_id: null, module: '模块', title: '标题', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '未执行', order_no: 1, executor_id: 7, created_at: iso(now - 2000), updated_at: iso(now - 200) }],
        2001: [{ id: 3002, exec_set_id: 2001, case_item_id: null, module: '模块', title: '标题', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '未执行', order_no: 1, executor_id: 7, created_at: iso(now - 1500), updated_at: iso(now - 100) }],
      },
      settings: [],
      lastSettingsPayload: null,
    };
    const apiHandler = createApiHandler(serverState);

    const contextA = await browser.newContext();
    const pageA = await setupPage(contextA, apiHandler, 'token-a');
    await switchToTab(pageA, 'tempexec');
    await pageA.click('#openTempExecAssignDrawerBtn');
    await expect(pageA.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    const filterButtons = pageA.locator('#tempVersionGrid [data-tempexec-import-project-filter]');
    await expect(filterButtons).toHaveCount(3);
    await pageA.locator('#tempVersionGrid [data-tempexec-import-project-filter="1"]').click();
    await expect(pageA.locator('#tempVersionGrid [data-tempexec-import-project-filter="1"]')).toHaveClass(/active/);
    await expect(pageA.locator('#tempVersionGrid .temp-project-card', { hasText: '项目A' })).toHaveCount(1);
    await expect(pageA.locator('#tempVersionGrid .temp-project-card', { hasText: '项目B' })).toHaveCount(0);

    await expect.poll(() => {
      const row = serverState.settings.find((item) => item.key === 'tempexec_ui_v1');
      const v = row && row.value_json ? row.value_json.importProjectFilterId : null;
      return v === null || v === undefined ? null : String(v);
    }, { timeout: 10000 }).toBe('1');

    await pageA.reload();
    await waitAppReady(pageA, 30000);
    await switchToTab(pageA, 'tempexec');
    await pageA.click('#openTempExecAssignDrawerBtn');
    await expect(pageA.locator('#tempVersionGrid [data-tempexec-import-project-filter="1"]')).toHaveClass(/active/);
    await expect(pageA.locator('#tempVersionGrid .temp-project-card', { hasText: '项目A' })).toHaveCount(1);
    await expect(pageA.locator('#tempVersionGrid .temp-project-card', { hasText: '项目B' })).toHaveCount(0);
    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await setupPage(contextB, apiHandler, 'token-b');
    await switchToTab(pageB, 'tempexec');
    await pageB.click('#openTempExecAssignDrawerBtn');
    await expect(pageB.locator('#tempVersionGrid [data-tempexec-import-project-filter="1"]')).toHaveClass(/active/);
    await expect(pageB.locator('#tempVersionGrid .temp-project-card', { hasText: '项目A' })).toHaveCount(1);
    await expect(pageB.locator('#tempVersionGrid .temp-project-card', { hasText: '项目B' })).toHaveCount(0);
    await contextB.close();
  });
});
