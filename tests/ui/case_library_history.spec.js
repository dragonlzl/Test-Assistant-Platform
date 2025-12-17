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
          {
            id: 2,
            kind: 'import',
            changed_at: new Date(Date.now() - 5000).toISOString(),
            operator: 'demo_user',
            changed_fields: [],
            old: null,
            new: null,
            meta: { item_imported: 10 },
          },
        ],
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

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');

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
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('操作人');
    await expect(page.locator('#caseLibraryHistoryBody')).toContainText('demo_user');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('新增');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('改动');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('删除');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('导入');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('重导');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toContainText('整份删除');
  });
});
