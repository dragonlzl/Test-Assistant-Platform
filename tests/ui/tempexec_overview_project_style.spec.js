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

test.describe('用例执行-个人总览对齐执行总览风格', () => {
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
    });
  });

  test('按项目盒子 + 版本盒子展示执行集卡片，并可切换项目/版本', async ({ page }) => {
    const user = { id: 2, username: 'demo_user', role: 'user', level: 'member' };
    const projects = [
      { id: 1, name: '项目A', description: '' },
      { id: 2, name: '项目B', description: '' },
    ];
    const versionsByProject = {
      1: [
        { id: 11, project_id: 1, name: 'v1' },
        { id: 12, project_id: 1, name: 'vX' },
      ],
      2: [{ id: 21, project_id: 2, name: 'v2' }],
    };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();

    // 确保默认激活的是项目B（updated_at 更新的在前）。
    const execSets = [
      { id: 2002, project_id: 2, version_id: 21, case_file_id: 102, case_count: 2, name: '用例B', status: 'active', created_at: iso(now - 20000), updated_at: iso(now - 200) },
      { id: 2003, project_id: 1, version_id: 12, case_file_id: 103, case_count: 1, name: '用例C', status: 'active', created_at: iso(now - 25000), updated_at: iso(now - 300) },
      { id: 2001, project_id: 1, version_id: 11, case_file_id: 101, case_count: 2, name: '用例A', status: 'active', created_at: iso(now - 30000), updated_at: iso(now - 500) },
    ];
    const casesBySetId = {
      2001: [
        { id: 3001, exec_set_id: 2001, case_item_id: 1, module: '模块', title: '标题1', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '通过', order_no: 1, executor_id: user.id, created_at: iso(now - 30000), updated_at: iso(now - 500) },
        { id: 3002, exec_set_id: 2001, case_item_id: 2, module: '模块', title: '标题2', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '未执行', order_no: 2, executor_id: user.id, created_at: iso(now - 30000), updated_at: iso(now - 500) },
      ],
      2003: [
        { id: 3005, exec_set_id: 2003, case_item_id: 1, module: '模块', title: '标题', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '未执行', order_no: 1, executor_id: user.id, created_at: iso(now - 25000), updated_at: iso(now - 300) },
      ],
      2002: [
        { id: 3003, exec_set_id: 2002, case_item_id: 1, module: '模块', title: '标题1', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '失败', order_no: 1, executor_id: user.id, created_at: iso(now - 20000), updated_at: iso(now - 200) },
        { id: 3004, exec_set_id: 2002, case_item_id: 2, module: '模块', title: '标题2', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '未执行', order_no: 2, executor_id: user.id, created_at: iso(now - 20000), updated_at: iso(now - 200) },
      ],
    };

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      const verMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (verMatch && method === 'GET') {
        const pid = Number(verMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, execSets.slice());
      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const execSetId = Number(execCasesMatch[1]);
        return respond(200, casesBySetId[execSetId] || []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.click('#openTempExecDrawerBtn');
    await page.click('#tempExecOverviewBtn');
    await expect(page.locator('#tempExecOverviewDrawer')).toHaveClass(/open/);

    const projectButtons = page.locator('#tempExecOverview [data-temp-overview-project]');
    await expect(projectButtons).toHaveCount(2);
    await expect(page.locator('#tempExecOverview')).toContainText('项目A');
    await expect(page.locator('#tempExecOverview')).toContainText('项目B');

    const projectB = page.locator('#tempExecOverview [data-temp-overview-project="2"]');
    await expect(projectB).toHaveClass(/active/);
    await expect(page.locator('#tempExecOverview .exec-overview-version-box', { hasText: 'v2' }).first()).toBeVisible();
    await expect(page.locator('#tempExecOverview .exec-overview-file-chip', { hasText: '用例B' }).first()).toBeVisible();

    await page.locator('#tempExecOverview [data-temp-overview-project="1"]').click();
    await expect(page.locator('#tempExecOverview .exec-overview-version-box', { hasText: 'v1' }).first()).toBeVisible();
    await expect(page.locator('#tempExecOverview .exec-overview-file-chip', { hasText: '用例A' }).first()).toBeVisible();
    await expect(page.locator('#tempExecOverview .exec-overview-version-box', { hasText: 'vX' }).first()).toBeVisible();

    await page.locator('#tempExecOverview [data-temp-overview-version-select]').selectOption('11');
    await expect(page.locator('#tempExecOverview .exec-overview-version-box')).toHaveCount(1);

    await page.locator('#tempExecOverview .exec-overview-file-chip', { hasText: '用例A' }).click();
    await expect(page.locator('#tempExecOverviewDrawer')).not.toHaveClass(/open/);
    await expect
      .poll(() => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')))
      .toBe('2001');
  });
});
