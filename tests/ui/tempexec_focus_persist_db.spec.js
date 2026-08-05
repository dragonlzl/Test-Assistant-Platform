const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  await page.waitForFunction(
    () => window.app && window.app._inited === true && window.app.authReady === true,
    null,
    { timeout }
  );
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout });
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
  if (tabName === 'tempexec') {
    await page.waitForURL(/\/case-exec\.html(?:[?#]|$)/, { timeout: 30000 });
  }
  await waitAppReady(page, 30000);
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
    if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
    if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
    if (pathName === '/api/auth/logout') return respond(200, {});

    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  };
}

test.describe('执行分配专注区持久化（DB）', () => {
  test('拖拽到专注区后刷新仍保留', async ({ browser }) => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const serverState = {
      user: { id: 9, username: 'focus_user', role: 'user', level: 'member' },
      projects: [{ id: 1, name: '项目A', description: '' }],
      versionsByProject: { 1: [{ id: 11, project_id: 1, name: 'v1' }] },
      execSets: [
        { id: 1001, project_id: 1, version_id: 11, case_file_id: 101, case_count: 1, name: '用例A', status: 'active', created_at: iso(now - 2000), updated_at: iso(now - 200) },
      ],
      casesBySetId: {
        1001: [{
          id: 5001,
          exec_set_id: 1001,
          case_item_id: null,
          module: '模块',
          title: '标题',
          expected: '预期',
          priority: null,
          precondition: null,
          steps: null,
          actual_result: null,
          defect_link: null,
          reuse_details: null,
          defect_links: [],
          remark: '',
          status: '未执行',
          order_no: 1,
          executor_id: 9,
          created_at: iso(now - 2000),
          updated_at: iso(now - 200),
        }],
      },
      settings: [],
      lastSettingsPayload: null,
    };
    const apiHandler = createApiHandler(serverState);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.indexOf('/api/') !== -1) return apiHandler(route);
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'focus-token'); } catch (_) {}
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    const navButtons = page.locator('#tempVersionGrid button[data-temp-file]');
    await expect(navButtons).toHaveCount(1);
    const navBtn = navButtons.first();
    const focusZone = page.locator('#tempFocusBlock [data-temp-focus-zone]');
    await navBtn.dragTo(focusZone);
    await expect(focusZone.locator('button[data-temp-file]')).toHaveCount(1);

    await expect.poll(() => {
      const row = serverState.settings.find((item) => item.key === 'tempexec_ui_v1');
      const focus = row && row.value_json ? row.value_json.focus : null;
      return Array.isArray(focus) ? focus.slice() : null;
    }, { timeout: 10000 }).toEqual(['1001']);

    await page.reload();
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempFocusBlock [data-temp-focus-zone] button[data-temp-file]')).toHaveCount(1);
    await expect(page.locator('#tempFocusBlock')).toContainText('用例A');

    await context.close();
  });
});
