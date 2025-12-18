const { test, expect } = require('@playwright/test');

test.describe('项目管理变更后，导入区项目/版本下拉刷新', () => {
  test.beforeEach(async ({ page }) => {
    page.__promptAnswers = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
    });
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : '';
        await dialog.accept(answer);
        return;
      }
      await dialog.accept();
    });
  });

  test('新增版本后，用例库导入版本列表可刷新', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const now = new Date().toISOString();

    let nextProjectId = 2;
    let nextVersionId = 12;
    const versionsByProject = {
      1: [{ id: 11, project_id: 1, name: 'v1', created_at: now, updated_at: now }],
    };
    const projects = [
      { id: 1, name: '项目一', description: '', created_at: now, updated_at: now, versions: versionsByProject[1] },
    ];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);

      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      if (pathName === '/api/projects' && method === 'POST') {
        const payload = route.request().postDataJSON() || {};
        const proj = {
          id: nextProjectId++,
          name: payload.name || ('项目#' + nextProjectId),
          description: payload.description || '',
          created_at: now,
          updated_at: now,
          versions: [],
        };
        projects.push(proj);
        versionsByProject[proj.id] = [];
        return respond(201, proj);
      }

      const versionsMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch && method === 'GET') {
        const pid = Number(versionsMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }
      if (versionsMatch && method === 'POST') {
        const pid = Number(versionsMatch[1]);
        const payload = route.request().postDataJSON() || {};
        const ver = {
          id: nextVersionId++,
          project_id: pid,
          name: payload.name || ('v' + nextVersionId),
          created_at: now,
          updated_at: now,
        };
        if (!versionsByProject[pid]) versionsByProject[pid] = [];
        versionsByProject[pid].unshift(ver);
        const proj = projects.find((p) => p && Number(p.id) === pid);
        if (proj) proj.versions = versionsByProject[pid];
        return respond(201, ver);
      }

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);

      return respond(200, []);
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
    await page.waitForFunction(() => window.app && window.app.caseLibraryBound === true, {}, { timeout: 30000 });
    await page.waitForFunction(() => window.app && window.app.adminBound === true, {}, { timeout: 30000 });

    await page.evaluate(() => { window.app.switchTab('case-library'); });
    await page.click('#openCaseLibraryImportDrawerBtn');
    await page.waitForFunction(() => {
      const sel = document.getElementById('caseLibraryImportProjectSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#caseLibraryImportProjectSelect', '1');
    await page.waitForFunction(() => {
      const sel = document.getElementById('caseLibraryImportVersionSelect');
      return sel && !sel.disabled && sel.options && sel.options.length > 1;
    });
    const beforeOptions = await page.$$eval('#caseLibraryImportVersionSelect option', (nodes) =>
      nodes.map((n) => (n.textContent || '').trim()).filter(Boolean)
    );
    expect(beforeOptions).toContain('v1');
    expect(beforeOptions).not.toContain('v2');
    await page.click('#caseLibraryImportDrawer button.ghost-btn[data-drawer-close=\"caseLibraryImportDrawer\"]');

    // 新增版本：回到项目管理页，触发“项目/版本更新事件”，用例库缓存应失效。
    page.__promptAnswers.push('v2');
    await page.evaluate(() => { window.app.switchTab('project-admin'); });
    await page.waitForSelector('#projectTableBody [data-action=\"add-version\"][data-id=\"1\"]', { timeout: 10000 });
    await page.click('#projectTableBody [data-action=\"add-version\"][data-id=\"1\"]');
    await expect(page.locator('#projectTableBody')).toContainText('v2', { timeout: 10000 });

    // 回到用例库导入：版本下拉应能刷新出 v2（否则说明仍在用旧缓存）。
    await page.evaluate(() => { window.app.switchTab('case-library'); });
    await page.click('#openCaseLibraryImportDrawerBtn');
    await page.selectOption('#caseLibraryImportProjectSelect', '1');
    await page.waitForFunction(() => {
      const sel = document.getElementById('caseLibraryImportVersionSelect');
      return sel && !sel.disabled && sel.options && sel.options.length > 2;
    });
    const afterOptions = await page.$$eval('#caseLibraryImportVersionSelect option', (nodes) =>
      nodes.map((n) => (n.textContent || '').trim()).filter(Boolean)
    );
    expect(afterOptions).toContain('v2');
  });

  test('新增项目后，用例执行导入项目列表可刷新', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const now = new Date().toISOString();

    let nextProjectId = 2;
    const projects = [
      { id: 1, name: '项目一', description: '', created_at: now, updated_at: now, versions: [] },
    ];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);

      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      if (pathName === '/api/projects' && method === 'POST') {
        const payload = route.request().postDataJSON() || {};
        const proj = {
          id: nextProjectId++,
          name: payload.name || ('项目#' + nextProjectId),
          description: payload.description || '',
          created_at: now,
          updated_at: now,
          versions: [],
        };
        projects.push(proj);
        return respond(201, proj);
      }

      if (pathName.match(/^\/api\/projects\/\d+\/versions$/) && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);

      return respond(200, []);
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
    await page.waitForFunction(() => window.app && window.app.adminBound === true, {}, { timeout: 30000 });

    await page.evaluate(() => { window.app.switchTab('tempexec'); });
    await page.click('#openTempExecImportDrawerBtn');
    await page.waitForFunction(() => {
      const sel = document.getElementById('tempExecImportProjectSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    const beforeProjects = await page.$$eval('#tempExecImportProjectSelect option', (nodes) =>
      nodes.map((n) => (n.textContent || '').trim()).filter(Boolean)
    );
    expect(beforeProjects).toContain('项目一');
    expect(beforeProjects).not.toContain('项目二');

    // 新建项目（项目管理）：返回执行页导入区应能刷新出新项目。
    await page.evaluate(() => { window.app.switchTab('project-admin'); });
    await page.waitForSelector('#projectCreateBtn', { timeout: 10000 });
    await page.click('#projectCreateBtn');
    await page.fill('#projectNameInput', '项目二');
    await page.click('#projectSaveBtn');
    await expect(page.locator('#projectTableBody')).toContainText('项目二', { timeout: 10000 });

    await page.evaluate(() => { window.app.switchTab('tempexec'); });
    await page.click('#openTempExecImportDrawerBtn');
    await page.waitForFunction(() => {
      const sel = document.getElementById('tempExecImportProjectSelect');
      return sel && sel.options && sel.options.length > 2;
    });
    const afterProjects = await page.$$eval('#tempExecImportProjectSelect option', (nodes) =>
      nodes.map((n) => (n.textContent || '').trim()).filter(Boolean)
    );
    expect(afterProjects).toContain('项目二');
  });
});
