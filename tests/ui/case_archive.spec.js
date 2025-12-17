const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

test.describe('用例归档（个人总览归档 + 归档页查看）', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('归档后：执行页不再显示，但个人总览显示“归”，归档页可查看详情', async ({ page }) => {
    const token = 'token-case-archive-ui';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = Date.now();
    const iso = (t) => new Date(t).toISOString();

    let archived = false;
    const execSetId = 101;
    const execSet = {
      id: execSetId,
      project_id: project.id,
      version_id: versions[0].id,
      source: null,
      case_file_id: null,
      name: '用例1',
      requirement: '',
      reuse_enabled: false,
      reuse_presets: [],
      case_count: 2,
      status: 'active',
      created_at: iso(now - 60000),
      updated_at: iso(now - 1000),
    };
    const execCases = [
      {
        id: 9001,
        exec_set_id: execSetId,
        case_item_id: null,
        module: '模块A',
        title: '用例A',
        expected: 'ok',
        priority: 'P0',
        precondition: '',
        steps: '',
        actual_result: '实际结果A',
        defect_link: '',
        reuse_details: [],
        defect_links: [],
        remark: '备注A',
        status: '通过',
        order_no: 1,
        executor_id: user.id,
        created_at: iso(now - 50000),
        updated_at: iso(now - 5000),
      },
      {
        id: 9002,
        exec_set_id: execSetId,
        case_item_id: null,
        module: '模块A',
        title: '用例B',
        expected: 'ok',
        priority: 'P1',
        precondition: '',
        steps: '',
        actual_result: '实际结果B',
        defect_link: 'BUG-1',
        reuse_details: [],
        defect_links: ['BUG-2'],
        remark: '备注B',
        status: '失败',
        order_no: 2,
        executor_id: user.id,
        created_at: iso(now - 50000),
        updated_at: iso(now - 4000),
      },
    ];

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') return dialog.accept();
      if (dialog.type() === 'prompt') return dialog.accept('归档原因：留存失败结果');
      return dialog.accept();
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const tokenHeader = route.request().headers().authorization || '';
      const authed = tokenHeader === `Bearer ${token}`;
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, user);
      }
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const statusFilter = url.searchParams.get('status_filter') || '';
        if (statusFilter === 'archived') {
          return respond(200, archived ? [{ ...execSet, status: 'archived' }] : []);
        }
        return respond(200, archived ? [] : [execSet]);
      }
      if (pathName === `/api/exec/sets/${execSetId}/case-library-sync` && method === 'POST') {
        return respond(200, {});
      }
      if (pathName === `/api/exec/sets/${execSetId}/cases` && method === 'GET') {
        return respond(200, execCases);
      }
      if (pathName === `/api/exec/sets/${execSetId}/archive` && method === 'POST') {
        archived = true;
        return respond(200, {
          exec_set_id: execSetId,
          project_id: project.id,
          project_name: project.name,
          version_id: versions[0].id,
          version_name: versions[0].name,
          name: execSet.name,
          case_count: 2,
          reuse_enabled: false,
          imported_by: user.id,
          imported_by_name: user.username,
          imported_at: execSet.created_at,
          archived_by: user.id,
          archived_by_name: user.username,
          archived_at: iso(now),
          archived_reason: '归档原因：留存失败结果',
        });
      }
      if (pathName === '/api/exec/archives' && method === 'GET') {
        if (!archived) return respond(200, []);
        return respond(200, [{
          exec_set_id: execSetId,
          project_id: project.id,
          project_name: project.name,
          version_id: versions[0].id,
          version_name: versions[0].name,
          name: execSet.name,
          case_count: 2,
          reuse_enabled: false,
          imported_by: user.id,
          imported_by_name: user.username,
          imported_at: execSet.created_at,
          archived_by: user.id,
          archived_by_name: user.username,
          archived_at: iso(now),
          archived_reason: '归档原因：留存失败结果',
        }]);
      }
      if (pathName === `/api/exec/archives/${execSetId}` && method === 'GET') {
        if (!archived) return respond(404, { detail: 'not found' });
        return respond(200, {
          exec_set_id: execSetId,
          project_id: project.id,
          project_name: project.name,
          version_id: versions[0].id,
          version_name: versions[0].name,
          name: execSet.name,
          case_count: 2,
          reuse_enabled: false,
          imported_by: user.id,
          imported_by_name: user.username,
          imported_at: execSet.created_at,
          archived_by: user.id,
          archived_by_name: user.username,
          archived_at: iso(now),
          archived_reason: '归档原因：留存失败结果',
          cases: execCases,
        });
      }
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);

    // 进入用例执行页并打开个人总览抽屉
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecOverviewNavBtn');
    await expect(page.locator('#tempExecOverview')).toBeVisible();

    // 等待执行数据加载完成（此处应展示“失败”状态）
    await expect(page.locator('#tempExecOverview .exec-overview-file-status')).toContainText('失败', { timeout: 8000 });

    // 点击归档（会触发 confirm + prompt）
    const archiveBtn = page.locator('[data-temp-overview-archive]').first();
    await expect(archiveBtn).toBeVisible();

    await archiveBtn.click();

    // 个人总览仍展示归档状态“归”
    await expect(page.locator('#tempExecOverview .tag-archived')).toBeVisible({ timeout: 8000 });

    // 点击归档卡片应提示去归档页查看
    await page.click('#tempExecOverview [data-temp-file]');
    await expect(page.locator('#tempExecStatus')).toContainText('已归档', { timeout: 3000 });
    await page.click('#closeTempExecOverviewDrawerBtn');
    await expect(page.locator('#tempExecOverviewDrawer')).not.toHaveClass(/open/);

    // 进入用例归档页，查看归档列表与详情
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="case-archive"]');
    await page.click('#openCaseArchiveDrawerBtn');
    await expect(page.locator('#caseArchiveDrawer')).toHaveClass(/open/);

    await expect(page.locator('#caseArchiveListBody')).toContainText('用例1', { timeout: 8000 });
    await page.click('#caseArchiveListBody [data-case-archive-action="view"]');

    // 抽屉关闭，主页展示详情
    await expect(page.locator('#caseArchiveDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#caseArchiveDetailCard')).toBeVisible();
    await expect(page.locator('#caseArchiveDetailTitle')).toContainText('用例1');
    await expect(page.locator('#caseArchiveDetailSearchInput')).toBeVisible();
    await expect(page.locator('#caseArchiveCasesBody tr')).toHaveCount(2);
    await expect(page.locator('#caseArchiveCasesBody')).toContainText('失败');
    await expect(page.locator('#caseArchiveCasesBody')).toContainText('BUG-1');

    // 详情搜索：过滤用例行
    await page.fill('#caseArchiveDetailSearchInput', '用例A');
    await expect(page.locator('#caseArchiveCasesBody tr')).toHaveCount(1);
    await page.click('#caseArchiveDetailSearchClearBtn');
    await expect(page.locator('#caseArchiveCasesBody tr')).toHaveCount(2);

    // 刷新后：应恢复上次查看的归档详情
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="case-archive"]');
    await expect(page.locator('#caseArchiveDetailCard')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#caseArchiveDetailTitle')).toContainText('用例1');
  });
});
