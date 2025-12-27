const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 808, username: 'case_jump_user', role: 'admin', level: 'leader' };
const project = { id: 11, name: '跳转项目', description: '' };
const versions = [{ id: 111, name: 'v1' }];

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
}

test.describe('用例库/执行页跳转入口调整', () => {
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
        window.localStorage.setItem('tap-auth-token', 'case-lib-jump-token');
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
      if (path === '/api/case-files' && method === 'GET') {
        return respond(200, [
          {
            id: 301,
            project_id: project.id,
            version_id: versions[0].id,
            file_name_clean: '用例库样例',
            item_count: 3,
            reuse_enabled: false,
            importer_name: '导入人',
            imported_at: new Date().toISOString(),
            last_updated_by_name: '更新人',
            updated_at: new Date().toISOString(),
          },
        ]);
      }
      if (path === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (path === '/api/models' && method === 'GET') return respond(200, []);
      if (path === '/api/features' && method === 'GET') return respond(200, []);
      if (path === '/api/ops' && method === 'GET') return respond(200, []);
      return respond(200, []);
    });

    await page.waitForLoadState('domcontentloaded');
  });

  test('执行分配页添加执行用例后自动打开选择用例执行抽屉', async ({ page }) => {
    await page.goto(base + '/case-exec.html');
    await waitForAppReady(page);
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    await page.click('#tempExecAddCaseFromLibraryBtn');
    await page.waitForFunction(() => window.app && window.app.state && window.app.state.activeTab === 'tempexec');
    await expect(page.locator('#caseLibrarySelectExecDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
  });

  test('用例库导航不再提供跳转执行页入口', async ({ page }) => {
    await page.goto(base + '/case-library.html');
    await waitForAppReady(page);
    const order = await page.evaluate(() => {
      var nav = document.getElementById('caseLibraryFlowNav');
      if (!nav) return [];
      return Array.from(nav.querySelectorAll('.nav-entry-card')).map(function(btn) { return btn.id || ''; });
    });
    const selectIndex = order.indexOf('openCaseLibrarySelectExecDrawerBtn');
    expect(selectIndex).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('caseLibraryJumpExecBtn')).toBe(-1);
  });
});
