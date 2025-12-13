const { test, expect } = require('@playwright/test');

test.describe('执行总览页（DB 接口接入）', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('项目列表 -> 版本筛选 -> 人员汇总 -> 用例明细', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: '用于执行总览' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, [project]);
      if (path === `/api/projects/${project.id}/versions`) return respond(200, versions);

      if (path === '/api/exec/overview' && method === 'GET') {
        const versionId = url.searchParams.get('version_id');
        if (versionId === String(versions[0].id)) {
          return respond(200, [
            {
              project_id: project.id,
              version_id: versions[0].id,
              user_id: user.id,
              username: user.username,
              total: 3,
              pending: 1,
              passed: 1,
              failed: 1,
              blocked: 0,
              not_applicable: 0,
            },
          ]);
        }
        return respond(200, [
          {
            project_id: project.id,
            version_id: null,
            user_id: user.id,
            username: user.username,
            total: 5,
            pending: 2,
            passed: 1,
            failed: 1,
            blocked: 1,
            not_applicable: 0,
          },
        ]);
      }

      if (path === '/api/exec/overview/cases' && method === 'GET') {
        const uid = url.searchParams.get('user_id');
        if (uid !== String(user.id)) return respond(200, []);
        return respond(200, [
          {
            exec_case_id: 100,
            exec_set_id: 200,
            exec_set_name: '需求-登录',
            version_id: versions[0].id,
            module: '登录',
            title: '正常登录',
            status: '通过',
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      if (path === '/api/auth/logout') return respond(200, {});

      // 兜底：其它模块可能会在启动时请求 settings/models/features/ops 等接口。
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });

    await expect(page.locator('[data-tab-section="exec-overview"]')).toBeVisible();
    await expect(page.locator('#execOverviewProjects')).toContainText(project.name);

    await page.click(`#execOverviewProjects [data-project-id="${project.id}"]`);
    await expect(page.locator('#execOverviewDetail')).toBeVisible();
    await expect(page.locator('#execOverviewVersionSelect')).toContainText('全部版本');
    await expect(page.locator('#execOverviewVersionSelect')).toContainText('v1');

    await expect(page.locator('#execOverviewUserCards')).toContainText(user.username);
    await expect(page.locator('#execOverviewUserCards')).toContainText('总数 5');

    await page.selectOption('#execOverviewVersionSelect', String(versions[0].id));
    await expect(page.locator('#execOverviewUserCards')).toContainText('总数 3');

    await page.click('#execOverviewUserCards .exec-overview-view-cases');
    await expect(page.locator('#execOverviewCasesPanel')).toBeVisible();
    await expect(page.locator('#execOverviewCasesTableBody')).toContainText('需求-登录');
    await expect(page.locator('#execOverviewCasesTableBody')).toContainText('正常登录');
  });
});
