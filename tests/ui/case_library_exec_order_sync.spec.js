const { test, expect } = require('@playwright/test');
const { clickSemantic, readSemanticValues } = require('./helpers/vtable_semantic');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
}

test.describe('用例库按执行顺序排序', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'case-lib-order-token');
        localStorage.removeItem('usecase-settings-v1');
      } catch (_) {}
    });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('编辑视图按执行用例顺序展示', async ({ page }) => {
    const project = { id: 7, name: '排序项目', description: '' };
    const versions = [{ id: 71, name: 'v1' }];
    const caseFileId = 701;
    const execSetId = 9701;
    const now = new Date().toISOString();
    const caseFiles = [
      {
        id: caseFileId,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '执行顺序文件',
        reuse_enabled: false,
        item_count: 3,
        importer_id: 1,
        importer_name: '排序人员',
        imported_at: now,
        updated_at: now,
        last_updated_by: 1,
        last_updated_by_name: '排序人员',
      },
    ];
    const items = [
      { id: 1, case_file_id: caseFileId, module: '模块A', title: '用例1', expected: 'ok', priority: 'P0', precondition: '', steps: '', remark: '', created_at: now, updated_at: now },
      { id: 2, case_file_id: caseFileId, module: '模块A', title: '用例2', expected: 'ok', priority: 'P1', precondition: '', steps: '', remark: '', created_at: now, updated_at: now },
      { id: 3, case_file_id: caseFileId, module: '模块A', title: '用例3', expected: 'ok', priority: 'P2', precondition: '', steps: '', remark: '', created_at: now, updated_at: now },
    ];
    const execCases = [
      {
        id: 9001,
        exec_set_id: execSetId,
        case_item_id: 1,
        module: '模块A',
        title: '用例1',
        expected: 'ok',
        priority: 'P0',
        precondition: '',
        steps: '',
        remark: '',
        status: '未执行',
        reuse_details: [],
        defect_links: [],
        order_no: 1,
      },
      {
        id: 9002,
        exec_set_id: execSetId,
        case_item_id: 3,
        module: '模块A',
        title: '用例3',
        expected: 'ok',
        priority: 'P2',
        precondition: '',
        steps: '',
        remark: '',
        status: '未执行',
        reuse_details: [],
        defect_links: [],
        order_no: 2,
      },
      {
        id: 9003,
        exec_set_id: execSetId,
        case_item_id: 2,
        module: '模块A',
        title: '用例2',
        expected: 'ok',
        priority: 'P1',
        precondition: '',
        steps: '',
        remark: '',
        status: '未执行',
        reuse_details: [],
        defect_links: [],
        order_no: 3,
      },
    ];

    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me' && method === 'GET') return respond(200, { id: 1, username: 'order_user', role: 'admin', level: 'leader' });
      if (path === '/api/settings' && method === 'GET') return respond(200, []);
      if (path === '/api/settings' && method === 'PUT') return respond(200, []);
      if (path === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (path === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (path === '/api/case-files' && method === 'GET') return respond(200, caseFiles);
      if (path === `/api/case-files/${caseFileId}/items` && method === 'GET') return respond(200, items);
      if (path === '/api/exec/sets/by-case-file' && method === 'GET') {
        return respond(200, [{ case_file_id: caseFileId, active_users: ['排序人员'], exec_set_id: execSetId }]);
      }
      if (path === `/api/exec/sets/${execSetId}/cases` && method === 'GET') return respond(200, execCases);
      if (path === '/api/models' && method === 'GET') return respond(200, []);
      if (path === '/api/features' && method === 'GET') return respond(200, []);
      if (path === '/api/ops' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview' && method === 'GET') return respond(200, {});
      if (path === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/sets' && method === 'GET') return respond(200, []);
      return respond(200, method === 'GET' ? [] : {});
    });

    await page.goto(base + '/index.html');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });
    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await clickSemantic(page, `#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditView')).toContainText('用例1');

    const titles = await readSemanticValues(page, '#caseLibraryEditView [data-case-lib-edit-field="title"]');
    expect(titles).toEqual(['用例1', '用例3', '用例2']);
  });
});
