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

test.describe('用例库跳转执行入口', () => {
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

    await page.goto(base + '/index.html');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
  });

  test('执行分配页添加执行用例后自动打开选择用例执行抽屉', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    await page.click('#tempExecAddCaseFromLibraryBtn');
    await page.waitForFunction(() => window.app && window.app.state && window.app.state.activeTab === 'case-library');
    await expect(page.locator('#caseLibrarySelectExecDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
  });

  test('执行分配与用例库入口布局调整', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await page.click('#openTempExecAssignDrawerBtn');
    const titleRow = page.locator('#tempExecAssignDrawer .card-title-row');
    await expect(titleRow.locator('#tempExecAddCaseFromLibraryBtn')).toBeVisible();
    await expect(page.locator('#tempExecOverviewBtn')).toHaveCount(0);
    await expect(page.locator('#toggleTempReq')).toHaveCount(0);
    await page.click('#closeTempExecAssignDrawerBtn');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });
    const order = await page.evaluate(() => {
      var nav = document.getElementById('caseLibraryFlowNav');
      if (!nav) return [];
      return Array.from(nav.querySelectorAll('.nav-entry-card')).map(function(btn) { return btn.id || ''; });
    });
    const jumpIndex = order.indexOf('caseLibraryJumpExecBtn');
    const selectIndex = order.indexOf('openCaseLibrarySelectExecDrawerBtn');
    expect(jumpIndex).toBeGreaterThanOrEqual(0);
    expect(selectIndex).toBeGreaterThanOrEqual(0);
    expect(jumpIndex).toBeLessThan(selectIndex);
  });

  test('用例库仅跳转执行页且不打开抽屉', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });
    await page.click('#caseLibraryJumpExecBtn');
    await page.waitForFunction(() => window.app && window.app.state && window.app.state.activeTab === 'tempexec');
    await expect(page.locator('#caseLibrarySelectExecDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
  });
});
