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
    const projects = [
      { id: 1, name: '战魂铭人', description: '用于执行总览' },
      { id: 2, name: '元气骑士', description: '用于执行总览' },
    ];
    const versionsByProject = {
      1: [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }],
      2: [{ id: 21, name: 'v1' }],
    };

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, projects);
      var versionsMatch = path.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch) {
        var pid = Number(versionsMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }

      if (path === '/api/exec/overview' && method === 'GET') {
        const projectId = url.searchParams.get('project_id');
        const versionId = url.searchParams.get('version_id');
        if (projectId === '2') {
          return respond(200, [
            {
              project_id: 2,
              version_id: null,
              user_id: user.id,
              username: user.username,
              total: 1,
              pending: 1,
              passed: 0,
              failed: 0,
              blocked: 0,
              not_applicable: 0,
            },
          ]);
        }
        if (versionId === String(versionsByProject[1][0].id)) {
          return respond(200, [
            {
              project_id: 1,
              version_id: versionsByProject[1][0].id,
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
            project_id: 1,
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

      if (path === '/api/exec/overview/layout' && method === 'GET') {
        const projectId = url.searchParams.get('project_id');
        const versionId = url.searchParams.get('version_id');
        const baseUser = {
          project_id: Number(projectId),
          version_id: versionId ? Number(versionId) : null,
          user_id: user.id,
          username: user.username,
          level: user.level,
          user_created_at: new Date('2020-01-01T00:00:00Z').toISOString(),
          total: 5,
          pending: 2,
          passed: 1,
          failed: 1,
          blocked: 1,
          not_applicable: 0,
          ui_placement: { versionOrderByProject: { 1: ['12', '11'] }, fileOrderByProjectVersion: { 1: { 11: ['200'], 12: [] } } },
          exec_sets: [
            { exec_set_id: 200, exec_set_name: '需求-登录', version_id: 11, status: 'archived', requirement: '', total: 3, pending: 0, passed: 2, failed: 1, blocked: 0, not_applicable: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { exec_set_id: 201, exec_set_name: '需求-注册', version_id: 11, status: 'active', requirement: '', total: 2, pending: 2, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          ],
        };
        if (projectId === '2') {
          return respond(200, [
            Object.assign({}, baseUser, {
              project_id: 2,
              total: 1,
              pending: 1,
              passed: 0,
              failed: 0,
              blocked: 0,
              not_applicable: 0,
              exec_sets: [
                { exec_set_id: 300, exec_set_name: '需求-战斗', version_id: 21, status: 'active', requirement: '', total: 1, pending: 1, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }),
          ]);
        }
        if (versionId === String(versionsByProject[1][0].id)) {
          return respond(200, [
            Object.assign({}, baseUser, {
              total: 3,
              pending: 1,
              passed: 1,
              failed: 1,
              blocked: 0,
              not_applicable: 0,
              exec_sets: [
                { exec_set_id: 200, exec_set_name: '需求-登录', version_id: 11, status: 'archived', requirement: '', total: 3, pending: 0, passed: 2, failed: 1, blocked: 0, not_applicable: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ],
            }),
          ]);
        }
        return respond(200, [baseUser]);
      }

      if (path === '/api/exec/overview/cases' && method === 'GET') {
        const uid = url.searchParams.get('user_id');
        if (uid !== String(user.id)) return respond(200, []);
        return respond(200, [
          {
            exec_case_id: 100,
            exec_set_id: 200,
            exec_set_name: '需求-登录',
            version_id: versionsByProject[1][0].id,
            module: '登录',
            title: '正常登录',
            status: '通过',
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      var execCasesMatch = path.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        var execSetId = Number(execCasesMatch[1]);
        if (execSetId !== 200) return respond(200, []);
        return respond(200, [
          {
            id: 100,
            exec_set_id: 200,
            case_item_id: 1,
            module: '登录',
            title: '正常登录',
            expected: 'ok',
            priority: 'P0',
            precondition: '',
            steps: '1',
            actual_result: 'ok',
            defect_link: null,
            reuse_details: null,
            defect_links: null,
            remark: '',
            status: '通过',
            order_no: 1,
            executor_id: user.id,
            created_at: new Date().toISOString(),
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

    await expect(page.locator('#flowNav')).toBeHidden();
    await expect(page.locator('#execOverviewHead')).toBeVisible();
    await expect(page.locator('section[data-tab-section="exec-overview"]')).toBeVisible();
    await expect(page.locator('#execOverviewNavProjects .nav-entry-card')).toHaveCount(2);
    await expect(page.locator('#execOverviewNavProjects')).toContainText('战魂铭人');
    await expect(page.locator('#execOverviewNavProjects')).toContainText('元气骑士');

    await page.click('#execOverviewNavProjects [data-project-id="2"]');
    await expect(page.locator('#execOverviewDetail')).toBeVisible();
    await expect(page.locator('#execOverviewProjectTitle')).toContainText('元气骑士');
    await expect(page.locator('#execOverviewUserCards')).toContainText('总数 1');
    await expect(page.locator('#execOverviewUserCards .exec-overview-progress')).toHaveCount(0);
    await expect(page.locator('#execOverviewUserCards .exec-overview-file-progress')).toHaveCount(1);
    await expect(page.locator('#execOverviewUserCards')).not.toContainText('组长');

    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    await expect(page.locator('#execOverviewDetail')).toBeVisible();

    await expect(page.locator('#execOverviewVersionSelect')).toContainText('全部版本');
    await expect(page.locator('#execOverviewVersionSelect')).toContainText('v1');

    await expect(page.locator('#execOverviewUserCards')).toContainText(user.username);
    await expect(page.locator('#execOverviewUserCards')).toContainText('总数 5');
    await expect(page.locator('#execOverviewUserCards')).toContainText('归');
    await expect(page.locator('#execOverviewUserCards .exec-overview-progress')).toHaveCount(0);
    await expect(page.locator('#execOverviewUserCards .exec-overview-file-progress')).toHaveCount(2);

    await page.selectOption('#execOverviewVersionSelect', String(versionsByProject[1][0].id));
    await expect(page.locator('#execOverviewUserCards')).toContainText('总数 3');

    await page.click('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"]');
    await expect(page.locator('#execOverviewExecSetDrawer')).toHaveClass(/open/);
    await expect(page.locator('#execOverviewExecSetTableBody')).toContainText('正常登录');
  });
});
