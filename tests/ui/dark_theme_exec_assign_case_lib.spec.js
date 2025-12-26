const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function gotoIndex(page) {
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
}

function createTempExecApiHandler(serverState) {
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
    if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

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

    if (pathName === '/api/exec/sets' && method === 'GET') {
      const statusFilter = url.searchParams.get('status_filter') || '';
      if (statusFilter === 'archived') return respond(200, []);
      return respond(200, execSets.slice());
    }
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
    if (pathName === '/api/auth/logout') return respond(200, {});

    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  };
}

function createCaseLibraryApiHandler(serverState) {
  return async function(route) {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    const user = serverState.user;
    const projects = serverState.projects;
    const versionsByProject = serverState.versionsByProject;
    const caseFiles = serverState.caseFiles;
    const execSetsByCaseFile = serverState.execSetsByCaseFile;

    if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
    if (pathName === '/api/projects' && method === 'GET') return respond(200, projects.slice());
    const versionsMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
    if (versionsMatch && method === 'GET') {
      const pid = Number(versionsMatch[1]);
      return respond(200, (versionsByProject[pid] || []).slice());
    }
    if (pathName === '/api/case-files' && method === 'GET') return respond(200, caseFiles.slice());
    if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') {
      return respond(200, execSetsByCaseFile.slice());
    }

    if (pathName === '/api/settings' && method === 'GET') return respond(200, serverState.settings.slice());
    if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
    if (pathName === '/api/models' && method === 'GET') return respond(200, []);
    if (pathName === '/api/features' && method === 'GET') return respond(200, []);
    if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
    if (pathName === '/api/auth/logout') return respond(200, {});

    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  };
}

test.describe('暗色主题 UI 对比增强', () => {
  test('执行分配版本盒子子项删除按钮非白底', async ({ page }) => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const serverState = {
      user: { id: 9, username: 'dark_assign_user', role: 'user', level: 'member' },
      projects: [{ id: 1, name: '执行项目', description: '' }],
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
      settings: [{
        id: 1,
        scope: 'user',
        owner_id: 9,
        key: 'theme',
        value_json: 'dark',
      }],
      lastSettingsPayload: null,
    };
    const apiHandler = createTempExecApiHandler(serverState);

    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.indexOf('/api/') !== -1) return apiHandler(route);
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'dark-assign-token'); } catch (_) {}
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    const removeBtn = page.locator('#tempVersionGrid .temp-project-version-body .temp-req-item .remove').first();
    await expect(removeBtn).toBeVisible();
    const bgColor = await removeBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
    expect(bgColor).not.toBe('rgb(244, 244, 245)');
  });

  test('执行分配拖拽时版本盒子背景非白底', async ({ page }) => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const serverState = {
      user: { id: 19, username: 'dark_drag_user', role: 'user', level: 'member' },
      projects: [{ id: 2, name: '拖拽项目', description: '' }],
      versionsByProject: { 2: [{ id: 21, project_id: 2, name: 'v1' }] },
      execSets: [
        { id: 2001, project_id: 2, version_id: 21, case_file_id: 201, case_count: 1, name: '用例B', status: 'active', created_at: iso(now - 2000), updated_at: iso(now - 200) },
      ],
      casesBySetId: {
        2001: [{
          id: 6001,
          exec_set_id: 2001,
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
          executor_id: 19,
          created_at: iso(now - 2000),
          updated_at: iso(now - 200),
        }],
      },
      settings: [{
        id: 1,
        scope: 'user',
        owner_id: 19,
        key: 'theme',
        value_json: 'dark',
      }],
      lastSettingsPayload: null,
    };
    const apiHandler = createTempExecApiHandler(serverState);

    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.indexOf('/api/') !== -1) return apiHandler(route);
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'dark-drag-token'); } catch (_) {}
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    await page.evaluate(() => {
      var body = document.querySelector('#tempVersionGrid .temp-project-version-body');
      if (!body) return;
      body.classList.add('dragover-file');
      if (!body.querySelector('.temp-file-drop-indicator')) {
        var indicator = document.createElement('div');
        indicator.className = 'temp-file-drop-indicator';
        body.appendChild(indicator);
      }
      if (!body.querySelector('.temp-drag-placeholder')) {
        var placeholder = document.createElement('div');
        placeholder.className = 'temp-drag-placeholder';
        placeholder.textContent = '放置到此';
        body.appendChild(placeholder);
      }
    });

    const colors = await page.evaluate(() => {
      var body = document.querySelector('#tempVersionGrid .temp-project-version-body');
      var indicator = body ? body.querySelector('.temp-file-drop-indicator') : null;
      var placeholder = body ? body.querySelector('.temp-drag-placeholder') : null;
      return {
        body: body ? getComputedStyle(body).backgroundColor : '',
        indicator: indicator ? getComputedStyle(indicator).backgroundColor : '',
        placeholder: placeholder ? getComputedStyle(placeholder).backgroundColor : '',
      };
    });
    expect(colors.body).not.toBe('rgb(255, 255, 255)');
    expect(colors.body).not.toBe('rgb(240, 247, 255)');
    expect(colors.indicator).not.toBe('rgb(255, 255, 255)');
    expect(colors.indicator).not.toBe('rgb(240, 247, 255)');
    expect(colors.placeholder).not.toBe('rgb(255, 255, 255)');
    expect(colors.placeholder).not.toBe('rgb(248, 251, 255)');
  });

  test('查看&编辑执行状态标签在暗色主题下更清晰', async ({ page }) => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const serverState = {
      user: { id: 7, username: 'case_lib_user', role: 'user', level: 'member' },
      projects: [{ id: 1, name: '用例库项目', description: '' }],
      versionsByProject: { 1: [{ id: 11, project_id: 1, name: 'v1' }] },
      caseFiles: [{
        id: 101,
        project_id: 1,
        version_id: 11,
        file_name_clean: '用例A',
        item_count: 1,
        reuse_enabled: false,
        importer_name: '导入人',
        imported_at: iso(now - 2000),
        last_updated_by_name: '更新人',
        updated_at: iso(now - 200),
      }],
      execSetsByCaseFile: [{
        id: 2001,
        project_id: 1,
        version_id: 11,
        case_file_id: 101,
        name: '执行用例A',
        active_users: ['张三'],
      }],
      settings: [{
        id: 1,
        scope: 'user',
        owner_id: 7,
        key: 'theme',
        value_json: 'dark',
      }],
    };
    const apiHandler = createCaseLibraryApiHandler(serverState);

    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.indexOf('/api/') !== -1) return apiHandler(route);
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'case-lib-dark-token'); } catch (_) {}
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await switchToTab(page, 'case-library');
    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', '1');
    await page.click('#caseLibraryEditConfirmBtn');
    await page.waitForSelector('#caseLibraryEditListBody .case-lib-exec-tag', { timeout: 8000 });

    const tagColor = await page.$eval('#caseLibraryEditListBody .case-lib-exec-tag', (el) => getComputedStyle(el).color);
    expect(tagColor).toBe('rgb(134, 239, 172)');
  });
});
