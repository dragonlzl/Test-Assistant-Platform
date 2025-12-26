const { test, expect } = require('@playwright/test');

test.describe('页签切换请求去重', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'test-token');
      } catch (_) {}
      const originalReplace = window.location.replace.bind(window.location);
      window.location.replace = function(url) {
        if (url && url.indexOf('login.html') !== -1) return;
        return originalReplace(url);
      };
    });

    await page.route('**/api/users/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 9, username: 'test_admin', role: 'admin' }),
      });
    });

  });

  test('点击用户管理仅触发一次用户列表请求', async ({ page }) => {
    let userProjectsCount = 0;
    let projectsCount = 0;
    const users = [
      { id: 1, username: 'alice', role: 'admin', level: 'leader', is_active: true, created_at: '2024-12-05T10:00:00Z' },
      { id: 2, username: 'bob', role: 'user', level: 'member', is_active: true, created_at: '2024-12-06T10:00:00Z' },
    ];
    const projects = [
      { id: 1, name: 'Alpha', description: '' },
      { id: 2, name: 'Beta', description: '' },
    ];

    await page.route('**/api/projects', (route) => {
      projectsCount += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects),
      });
    });
    await page.route('**/api/users', (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(users),
      });
    });
    await page.route('**/api/users/*/projects', (route) => {
      const match = route.request().url().match(/\/api\/users\/(\d+)\/projects/);
      const uid = match ? Number(match[1]) : 0;
      userProjectsCount += 1;
      const mapping = {
        1: [{ project_id: 1, name: 'Alpha' }],
        2: [{ project_id: 2, name: 'Beta' }],
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mapping[uid] || []),
      });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.tabGroupBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.adminBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.authReady === true, null, { timeout: 20000 });
    projectsCount = 0;

    const manageBtn = page.locator('.tab-group-btn', { hasText: '管理' });
    await manageBtn.click();
    const userTabBtn = page.locator('[data-group-menu="manage"] [data-tab-btn="user-admin"]');

    const beforeCount = userProjectsCount;
    const waitProjects = () => page.waitForResponse((res) => {
      const url = new URL(res.url());
      if (res.request().method() !== 'GET') return false;
      return /^\/api\/users\/\d+\/projects$/.test(url.pathname);
    });

    await userTabBtn.click();
    await waitProjects();
    await waitProjects();
    await expect(page.locator('#userAdminHead')).toBeVisible();

    await page.waitForTimeout(300);
    expect(userProjectsCount - beforeCount).toBe(users.length);
  });

  test('重复触发用户管理不会重复拉用户项目', async ({ page }) => {
    let userProjectsCount = 0;
    const users = [
      { id: 4, username: 'tom', role: 'user', level: 'member', is_active: true, created_at: '2024-12-01T10:00:00Z' },
      { id: 5, username: 'lisa', role: 'user', level: 'member', is_active: true, created_at: '2024-12-02T10:00:00Z' },
    ];
    const projects = [
      { id: 1, name: 'Alpha', description: '' },
      { id: 2, name: 'Beta', description: '' },
    ];

    await page.route('**/api/projects', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects),
      });
    });
    await page.route('**/api/users', (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(users),
      });
    });
    await page.route('**/api/users/*/projects', (route) => {
      userProjectsCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ project_id: 1, name: 'Alpha' }]),
      });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.tabGroupBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.adminBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.authReady === true, null, { timeout: 20000 });

    const waitProjects = () => page.waitForResponse((res) => {
      const url = new URL(res.url());
      if (res.request().method() !== 'GET') return false;
      return /^\/api\/users\/\d+\/projects$/.test(url.pathname);
    });

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('app-tab-activated', { detail: { tab: 'user-admin' } }));
      window.dispatchEvent(new CustomEvent('app-tab-activated', { detail: { tab: 'user-admin' } }));
    });
    await waitProjects();
    await waitProjects();
    await page.waitForTimeout(300);
    expect(userProjectsCount).toBe(users.length);
  });

  test('点击执行总览仅触发一次布局请求', async ({ page }) => {
    let layoutCount = 0;
    let projectsCount = 0;
    const projects = [{ id: 1, name: 'Alpha', description: '' }];
    const versions = [{ id: 101, project_id: 1, name: 'v1' }];
    const layoutRows = [
      {
        user_id: 7,
        username: 'alice',
        total: 2,
        pending: 1,
        passed: 1,
        failed: 0,
        blocked: 0,
        not_applicable: 0,
        exec_sets: [
          {
            id: 11,
            name: '集A',
            version_id: 101,
            total: 2,
            pending: 1,
            passed: 1,
            failed: 0,
            blocked: 0,
            not_applicable: 0,
          },
        ],
      },
    ];

    await page.addInitScript(() => {
      try {
        localStorage.setItem('exec_overview_last_project_id_v1', '1');
      } catch (_) {}
    });
    await page.route('**/api/projects', (route) => {
      projectsCount += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects),
      });
    });
    await page.route('**/api/projects/1/versions', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(versions),
      });
    });
    await page.route('**/api/exec/overview/layout**', (route) => {
      layoutCount += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(layoutRows),
      });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.tabGroupBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.authReady === true, null, { timeout: 20000 });
    projectsCount = 0;
    layoutCount = 0;

    const casesBtn = page.locator('.tab-group-btn', { hasText: '用例相关' });
    await casesBtn.click();
    const overviewBtn = page.locator('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    const waitLayout = page.waitForResponse((res) => {
      const url = new URL(res.url());
      return res.request().method() === 'GET' && url.pathname === '/api/exec/overview/layout';
    });
    await overviewBtn.click();
    await waitLayout;
    await page.waitForTimeout(300);
    expect(layoutCount).toBe(1);
  });

  test('点击项目管理仅触发一次项目列表请求', async ({ page }) => {
    let projectsCount = 0;
    const projects = [
      { id: 1, name: 'Alpha', description: '' },
      { id: 2, name: 'Beta', description: '' },
    ];

    await page.route('**/api/projects', (route) => {
      projectsCount += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(projects),
      });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.tabGroupBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.adminBound === true, null, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.authReady === true, null, { timeout: 20000 });
    projectsCount = 0;

    const manageBtn = page.locator('.tab-group-btn', { hasText: '管理' });
    await manageBtn.click();
    const projectTabBtn = page.locator('[data-group-menu="manage"] [data-tab-btn="project-admin"]');

    const waitProjects = page.waitForResponse((res) => {
      const url = new URL(res.url());
      return res.request().method() === 'GET' && url.pathname === '/api/projects';
    });
    await projectTabBtn.click();
    await waitProjects;
    await page.waitForTimeout(300);
    expect(projectsCount).toBe(1);
  });
});
