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

test.describe('用例库-用例改动历史抽屉', () => {
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

  test('按项目/版本查询改动用例，并跳转展示历史详情（含操作人）', async ({ page }) => {
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const projects = [
      { id: 1, name: '项目A', description: '' },
      { id: 2, name: '项目B', description: '' },
    ];
    const versionsByProject = {
      1: [{ id: 11, project_id: 1, name: 'v1' }],
      2: [{ id: 21, project_id: 2, name: 'v2' }],
    };
    const changeFilesByProjectVersion = {
      '1::11': [
        {
          project_id: 1,
          file_name_clean: '登录',
          case_file_id: 101,
          version_id: 11,
          is_deleted: false,
          last_changed_at: new Date().toISOString(),
          last_operator: 'demo_user',
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 10000).toISOString(),
          last_updated_by_name: 'demo_user',
          updated_at: new Date(Date.now() - 3000).toISOString(),
          total_events: 3,
        },
      ],
      '2::21': [
        {
          project_id: 2,
          file_name_clean: '支付',
          case_file_id: null,
          version_id: 21,
          is_deleted: true,
          last_changed_at: new Date().toISOString(),
          last_operator: 'demo_user',
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 9000).toISOString(),
          last_updated_by_name: 'demo_user',
          updated_at: new Date(Date.now() - 2000).toISOString(),
          total_events: 2,
        },
      ],
    };
    const historyByKey = {
      '1::登录': {
        project_id: 1,
        file_name_clean: '登录',
        case_file_id: 101,
        version_id: 11,
        is_deleted: false,
        history: Array.from({ length: 25 }).map((_, i) => ({
          id: i + 1,
          kind: i === 0 ? 'import' : 'updated',
          changed_at: new Date(Date.now() - i * 1000).toISOString(),
          operator: 'demo_user',
          changed_fields: i === 0 ? [] : ['steps'],
          old: i === 0 ? null : { module: '登录', title: '正常登录', precondition: '无', steps: '旧' + i, expected: '成功' },
          new: i === 0 ? null : { module: '登录', title: '正常登录', precondition: '无', steps: '新' + i, expected: '成功' },
          meta: { changed_fields: i === 0 ? [] : ['steps'] },
        })),
      },
      '2::支付': {
        project_id: 2,
        file_name_clean: '支付',
        case_file_id: null,
        version_id: 21,
        is_deleted: true,
        history: [
          {
            id: 3,
            kind: 'file_deleted',
            changed_at: new Date().toISOString(),
            operator: 'demo_user',
            changed_fields: [],
            old: null,
            new: null,
            meta: {},
          },
        ],
      },
    };
    const caseFilesByProject = {
      1: [
        {
          id: 101,
          project_id: 1,
          version_id: 11,
          file_name_clean: '登录',
          reuse_enabled: false,
          item_count: 2,
          importer_id: 1,
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 50000).toISOString(),
          updated_at: new Date(Date.now() - 30000).toISOString(),
          last_updated_by: 1,
          last_updated_by_name: 'demo_user',
        },
      ],
      2: [],
    };
    const caseItemsByFileId = {
      101: [
        { id: 1001, case_file_id: 101, module: '登录', title: '正常登录', expected: '成功', priority: 'P0', precondition: '无', steps: '步骤', remark: '' },
        { id: 1002, case_file_id: 101, module: '登录', title: '异常登录', expected: '失败', priority: 'P1', precondition: '无', steps: '步骤', remark: '' },
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

      if (pathName === '/api/case-files' && method === 'GET') {
        const pid = Number(url.searchParams.get('project_id') || '0');
        return respond(200, (caseFilesByProject[pid] || []).slice());
      }
      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        const fid = Number(itemsMatch[1]);
        return respond(200, (caseItemsByFileId[fid] || []).slice());
      }

      if (pathName === '/api/case-files/change-history/files' && method === 'GET') {
        const pid = url.searchParams.get('project_id') || '';
        const vid = url.searchParams.get('version_id') || '';
        const key = `${pid}::${vid}`;
        return respond(200, (changeFilesByProjectVersion[key] || []).slice());
      }
      if (pathName === '/api/case-files/change-history' && method === 'GET') {
        const pid = url.searchParams.get('project_id') || '';
        const name = url.searchParams.get('file_name_clean') || '';
        const key = `${pid}::${name}`;
        return respond(200, historyByKey[key] || { project_id: Number(pid), file_name_clean: name, history: [], is_deleted: false });
      }

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');

    // 先进入“查看&编辑”选中用例，确保编辑视图持久化存在。
    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', '1');
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('登录');
    await page.locator('#caseLibraryEditListBody').getByText('查看&编辑').click();
    await expect(page.locator('#caseLibraryEditCard')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caseLibraryEditFileName')).toContainText('登录');

    await page.click('#openCaseLibraryHistoryDrawerBtn');
    await expect(page.locator('#caseLibraryHistoryDrawer')).toHaveClass(/open/);

    await page.selectOption('#caseLibraryHistoryProjectSelect', '1');
    await expect(page.locator('#caseLibraryHistoryVersionSelect')).not.toBeDisabled();
    await expect(page.locator('#caseLibraryHistoryVersionSelect')).toContainText('全部版本');
    await page.selectOption('#caseLibraryHistoryVersionSelect', '11');
    await page.click('#caseLibraryHistoryQueryBtn');

    await expect(page.locator('#caseLibraryHistoryDrawerListBody')).toContainText('登录');
    await expect(page.locator('#caseLibraryHistoryDrawerListBody')).toContainText('v1');
    await expect(page.locator('#caseLibraryHistoryDrawerListBody')).toContainText('demo_user');

    await page.locator('#caseLibraryHistoryDrawerListBody').getByText('历史详情').click();
    await expect(page.locator('#caseLibraryHistoryDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#caseLibraryHistoryDetailCard')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caseLibraryEditCard')).toHaveClass(/hidden/);
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('操作人员');
    await expect(page.locator('#caseLibraryHistoryBody')).toContainText('demo_user');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('新增');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('改动');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('删除');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('导入');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('重导');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('整份删除');

    // 详情分页：默认每页 20 条（沿用执行视图分页设置）。
    await expect(page.locator('#caseLibraryHistoryPaginationTop')).toContainText('每页 20 条');
    await expect(page.locator('#caseLibraryHistoryBody tr')).toHaveCount(20);
    await page.locator('[data-case-lib-history-page="next"]').first().click();
    await expect(page.locator('#caseLibraryHistoryBody tr')).toHaveCount(5);

    // 抽屉选择持久化：再次打开仍保留项目/版本并能自动恢复列表。
    await page.click('#openCaseLibraryHistoryDrawerBtn');
    await expect(page.locator('#caseLibraryHistoryDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryHistoryProjectSelect')).toHaveValue('1');
    await expect(page.locator('#caseLibraryHistoryVersionSelect')).toHaveValue('11');
    await expect(page.locator('#caseLibraryHistoryDrawerListBody')).toContainText('登录');

    // 刷新后保持“最近一次选择”（历史详情视图）。
    await page.reload();
    await waitAppReady(page, 30000);
    await expect
      .poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : '')))
      .toBe('case-library');
    await expect(page.locator('section[data-tab-section="case-library"]')).toBeVisible();
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toBeVisible();
    await expect(page.locator('#caseLibraryHistoryCaseName')).toContainText('登录');
    await expect(page.locator('#caseLibraryEditCard')).toBeHidden();
  });

  test('先看历史详情再看编辑，刷新后保持编辑视图', async ({ page }) => {
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const projects = [{ id: 1, name: '项目A', description: '' }];
    const versionsByProject = { 1: [{ id: 11, project_id: 1, name: 'v1' }] };
    const changeFilesByProjectVersion = {
      '1::11': [
        {
          project_id: 1,
          file_name_clean: '登录',
          case_file_id: 101,
          version_id: 11,
          is_deleted: false,
          last_changed_at: new Date().toISOString(),
          last_operator: 'demo_user',
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 10000).toISOString(),
          last_updated_by_name: 'demo_user',
          updated_at: new Date(Date.now() - 3000).toISOString(),
          total_events: 3,
        },
      ],
    };
    const historyByKey = {
      '1::登录': {
        project_id: 1,
        file_name_clean: '登录',
        case_file_id: 101,
        version_id: 11,
        is_deleted: false,
        history: [
          {
            id: 1,
            kind: 'updated',
            changed_at: new Date().toISOString(),
            operator: 'demo_user',
            changed_fields: ['steps'],
            old: { module: '登录', title: '正常登录', precondition: '无', steps: '旧', expected: '成功' },
            new: { module: '登录', title: '正常登录', precondition: '无', steps: '新', expected: '成功' },
            meta: { changed_fields: ['steps'] },
          },
        ],
      },
    };
    const caseFilesByProject = {
      1: [
        {
          id: 101,
          project_id: 1,
          version_id: 11,
          file_name_clean: '登录',
          reuse_enabled: false,
          item_count: 1,
          importer_id: 1,
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 50000).toISOString(),
          updated_at: new Date(Date.now() - 30000).toISOString(),
          last_updated_by: 1,
          last_updated_by_name: 'demo_user',
        },
      ],
    };
    const caseItemsByFileId = {
      101: [{ id: 1001, case_file_id: 101, module: '登录', title: '正常登录', expected: '成功', priority: 'P0', precondition: '无', steps: '步骤', remark: '' }],
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
      if (verMatch && method === 'GET') return respond(200, versionsByProject[Number(verMatch[1])] || []);

      if (pathName === '/api/case-files' && method === 'GET') {
        const pid = Number(url.searchParams.get('project_id') || '0');
        return respond(200, (caseFilesByProject[pid] || []).slice());
      }
      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') return respond(200, (caseItemsByFileId[Number(itemsMatch[1])] || []).slice());

      if (pathName === '/api/case-files/change-history/files' && method === 'GET') {
        const pid = url.searchParams.get('project_id') || '';
        const vid = url.searchParams.get('version_id') || '';
        return respond(200, (changeFilesByProjectVersion[`${pid}::${vid}`] || []).slice());
      }
      if (pathName === '/api/case-files/change-history' && method === 'GET') {
        const pid = url.searchParams.get('project_id') || '';
        const name = url.searchParams.get('file_name_clean') || '';
        return respond(200, historyByKey[`${pid}::${name}`] || { project_id: Number(pid), file_name_clean: name, history: [], is_deleted: false });
      }

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');

    // 先打开历史详情
    await page.click('#openCaseLibraryHistoryDrawerBtn');
    await expect(page.locator('#caseLibraryHistoryDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryHistoryProjectSelect', '1');
    await page.selectOption('#caseLibraryHistoryVersionSelect', '11');
    await page.click('#caseLibraryHistoryQueryBtn');
    await expect(page.locator('#caseLibraryHistoryDrawerListBody')).toContainText('登录');
    await page.locator('#caseLibraryHistoryDrawerListBody').getByText('历史详情').click();
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditCard')).toBeHidden();

    // 再打开编辑视图
    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', '1');
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('登录');
    await page.locator('#caseLibraryEditListBody').getByText('查看&编辑').click();
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toBeHidden();

    // 刷新后保持编辑视图
    await page.reload();
    await waitAppReady(page, 30000);
    await expect
      .poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : '')))
      .toBe('case-library');
    await expect(page.locator('section[data-tab-section="case-library"]')).toBeVisible();
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toBeHidden();
    await expect(page.locator('#caseLibraryEditFileName')).toContainText('登录');
  });
});
