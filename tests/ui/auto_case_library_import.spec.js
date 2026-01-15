const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 909, username: 'auto_case_lib_user', role: 'admin', level: 'leader' };
const project = { id: 77, name: '导入项目', description: '' };
const versions = [{ id: 7701, name: 'v1' }];
const caseFiles = [
  {
    id: 501,
    project_id: project.id,
    version_id: versions[0].id,
    file_name_clean: '登录用例',
    item_count: 2,
    reuse_enabled: true,
    importer_name: '导入人',
    imported_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 502,
    project_id: project.id,
    version_id: versions[0].id,
    file_name_clean: '支付用例',
    item_count: 1,
    reuse_enabled: false,
    importer_name: '导入人',
    imported_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
}

test.describe('一键执行/功能流程用例库导入', () => {
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
        window.localStorage.setItem('tap-auth-token', 'auto-case-lib-token');
        window.localStorage.removeItem('usecase-settings-v1');
      } catch (err) {
        // ignore
      }
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me' && method === 'GET') return respond(200, user);
      if (path === '/api/settings' && method === 'GET') return respond(200, []);
      if (path === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (path === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (path === '/api/case-files' && method === 'GET') return respond(200, caseFiles);
      if (path === '/api/case-files/501/items' && method === 'GET') {
        return respond(200, [
          { module: '登录', title: '正常登录', priority: 'P0', precondition: '已注册', steps: '输入账号', expected: '成功' },
          { module: '登录', title: '错误密码', priority: 'P1', precondition: '', steps: '输入错误密码', expected: '失败' },
        ]);
      }
      if (path === '/api/case-files/502/items' && method === 'GET') {
        return respond(200, [
          { module: '支付', title: '正常支付', priority: 'P0', precondition: '余额充足', steps: '点击支付', expected: '成功' },
        ]);
      }
      if (path === '/api/models' && method === 'GET') return respond(200, []);
      if (path === '/api/features' && method === 'GET') return respond(200, []);
      if (path === '/api/ops' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview' && method === 'GET') return respond(200, {});
      if (path === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview/layout' && method === 'GET') return respond(200, {});
      return respond(200, []);
    });

    await page.goto(base + '/index.html');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
  });

  test('一键执行从用例库导入用例', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('auto'); });
    await page.click('#autoCaseLibrarySelectBtn');
    await expect(page.locator('#caseLibraryImportSelectDrawer')).toHaveClass(/open/);

    await page.selectOption('#caseLibraryImportSelectProjectSelect', String(project.id));
    await page.waitForFunction(() => {
      var el = document.getElementById('caseLibraryImportSelectVersionSelect');
      return el && !el.disabled;
    });
    await expect(page.locator('#caseLibraryImportSelectVersionSelect option')).toContainText(['全部版本']);
    await page.selectOption('#caseLibraryImportSelectVersionSelect', String(versions[0].id));
    await page.fill('#caseLibraryImportSelectSearchInput', '用例');
    await page.click('#caseLibraryImportSelectQueryBtn');
    await page.waitForSelector('#caseLibraryImportSelectListBody tr');

    await expect(page.locator('#caseLibraryImportSelectBatchBtn')).toHaveText('批量导入');
    await page.click('[data-case-lib-import-pick="501"]');
    await expect(page.locator('#caseLibraryImportSelectDrawer')).not.toHaveClass(/open/);

    await page.waitForFunction(() => {
      var list = document.getElementById('autoCaseFileList');
      return list && list.textContent && list.textContent.indexOf('登录用例') !== -1;
    });
    await expect(page.locator('#autoCaseFileList')).toContainText('登录用例');
    await expect(page.locator('#caseFileList')).toContainText('登录用例');
  });

  test('勾选后点击导入仅导入一份', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('auto'); });
    await page.click('#autoCaseLibrarySelectBtn');
    await expect(page.locator('#caseLibraryImportSelectDrawer')).toHaveClass(/open/);

    await page.selectOption('#caseLibraryImportSelectProjectSelect', String(project.id));
    await page.waitForFunction(() => {
      var el = document.getElementById('caseLibraryImportSelectVersionSelect');
      return el && !el.disabled;
    });
    await page.selectOption('#caseLibraryImportSelectVersionSelect', String(versions[0].id));
    await page.fill('#caseLibraryImportSelectSearchInput', '用例');
    await page.click('#caseLibraryImportSelectQueryBtn');
    await page.waitForSelector('#caseLibraryImportSelectListBody tr');

    await page.check('[data-case-lib-import-select="501"]');
    await page.click('[data-case-lib-import-pick="501"]');
    await expect(page.locator('#caseLibraryImportSelectDrawer')).not.toHaveClass(/open/);

    const autoChips = page.locator('#autoCaseFileList .file-chip').filter({ hasText: '登录用例' });
    const flowChips = page.locator('#caseFileList .file-chip').filter({ hasText: '登录用例' });
    await expect(autoChips).toHaveCount(1);
    await expect(flowChips).toHaveCount(1);
  });

  test('功能流程导入按钮可打开用例库抽屉', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('clean'); });
    await page.click('#caseLibraryImportSelectBtn');
    await expect(page.locator('#caseLibraryImportSelectDrawer')).toHaveClass(/open/);
  });
});
