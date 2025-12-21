const { test, expect } = require('@playwright/test');

test.describe('用例库抽屉分页', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const user = { id: 501, username: 'case_lib_user', role: 'admin', level: 'leader' };

  function buildCaseFiles(total) {
    const list = [];
    const now = new Date().toISOString();
    for (let i = 0; i < total; i += 1) {
      list.push({
        id: 100 + i,
        project_id: 1,
        version_id: 11,
        file_name_clean: `用例文件${i + 1}`,
        item_count: 5,
        reuse_enabled: false,
        importer_name: '导入人A',
        imported_at: now,
        last_updated_by_name: '更新人A',
        updated_at: now,
      });
    }
    return list;
  }

  function buildHistoryFiles(total) {
    const list = [];
    const now = new Date().toISOString();
    for (let i = 0; i < total; i += 1) {
      list.push({
        project_id: 1,
        version_id: 11,
        file_name_clean: `历史用例${i + 1}`,
        last_changed_at: now,
        importer_name: '导入人B',
        imported_at: now,
        last_updated_by_name: '更新人B',
        updated_at: now,
      });
    }
    return list;
  }

  async function waitForAppReady(page) {
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
  }

  test.beforeEach(async ({ page }) => {
    const caseFiles = buildCaseFiles(23);
    const historyFiles = buildHistoryFiles(23);
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('tap-auth-token', 'case-lib-token');
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

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/settings' && method === 'GET') {
        return respond(200, [
          {
            id: 1,
            scope: 'user',
            owner_id: user.id,
            key: 'tempExecPageSize',
            value_json: 10,
            updated_at: new Date().toISOString(),
          },
        ]);
      }
      if (path === '/api/projects') return respond(200, [{ id: 1, name: '用例库项目', description: '' }]);
      if (path === '/api/projects/1/versions') return respond(200, [{ id: 11, name: 'v1' }]);
      if (path === '/api/case-files') return respond(200, caseFiles);
      if (path === '/api/exec/sets/by-case-file') return respond(200, []);
      if (path === '/api/case-files/change-history/files') return respond(200, historyFiles);
      return respond(200, []);
    });

    await page.goto(base + '/index.html');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await page.evaluate(() => {
      document.querySelectorAll('.tab-group .tab-submenu').forEach(function(menu) {
        menu.classList.remove('hidden');
      });
      document.querySelectorAll('.tab-group').forEach(function(group) {
        group.classList.add('open');
      });
      document.querySelectorAll('.tab-group .tab-group-btn').forEach(function(btn) {
        btn.classList.add('open');
      });
      document.querySelectorAll('[data-tab-btn]').forEach(function(btn) {
        btn.classList.remove('hidden');
        btn.classList.remove('role-hidden');
      });
    });
  });

  test('查看&编辑 / 选择执行 / 历史查询抽屉分页生效', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });

    await page.click('#openCaseLibraryEditDrawerBtn');
    await page.waitForFunction(() => {
      const el = document.getElementById('caseLibraryEditProjectSelect');
      return el && el.options && el.options.length > 1;
    });
    await page.selectOption('#caseLibraryEditProjectSelect', '1');
    const editInfo = page.locator('[data-case-lib-drawer-pagination="edit"] .temp-pagination-info').first();
    await expect(editInfo).toContainText('每页 10 条');
    await expect(editInfo).toContainText('显示 1-10 / 23 条');
    await page.click('[data-case-lib-drawer-page="next"][data-case-lib-drawer-scope="edit"]');
    await expect(editInfo).toContainText('显示 11-20 / 23 条');
    await page.click('#caseLibraryEditDrawer .drawer-header [data-drawer-close="caseLibraryEditDrawer"]');

    await page.click('#openCaseLibrarySelectExecDrawerBtn');
    await page.waitForFunction(() => {
      const el = document.getElementById('caseLibrarySelectProjectSelect');
      return el && el.options && el.options.length > 1;
    });
    await page.selectOption('#caseLibrarySelectProjectSelect', '1');
    const selectInfo = page.locator('[data-case-lib-drawer-pagination="select"] .temp-pagination-info').first();
    await expect(selectInfo).toContainText('每页 10 条');
    await expect(selectInfo).toContainText('显示 1-10 / 23 条');
    await page.click('[data-case-lib-drawer-page="next"][data-case-lib-drawer-scope="select"]');
    await expect(selectInfo).toContainText('显示 11-20 / 23 条');
    await page.click('#caseLibrarySelectExecDrawer .drawer-header [data-drawer-close="caseLibrarySelectExecDrawer"]');

    await page.click('#openCaseLibraryHistoryDrawerBtn');
    await page.waitForFunction(() => {
      const el = document.getElementById('caseLibraryHistoryProjectSelect');
      return el && el.options && el.options.length > 1;
    });
    await page.selectOption('#caseLibraryHistoryProjectSelect', '1');
    await page.waitForSelector('#caseLibraryHistoryVersionSelect:not([disabled])');
    await page.selectOption('#caseLibraryHistoryVersionSelect', '0');
    await page.click('#caseLibraryHistoryQueryBtn');
    const historyInfo = page.locator('[data-case-lib-drawer-pagination="history-query"] .temp-pagination-info').first();
    await expect(historyInfo).toContainText('每页 10 条');
    await expect(historyInfo).toContainText('显示 1-10 / 23 条');
    await page.click('[data-case-lib-drawer-page="next"][data-case-lib-drawer-scope="history-query"]');
    await expect(historyInfo).toContainText('显示 11-20 / 23 条');
  });
});
