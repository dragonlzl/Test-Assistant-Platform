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

test.describe('操作记录-抽屉列表/筛选/分页', () => {
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

  test('查看记录：使用全局分页，支持人员与行为过滤', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const userB = { id: 2, username: 'user_b', role: 'user', level: 'member' };
    const settings = [
      { id: 1, scope: 'user', owner_id: 1, key: 'tempExecPageSize', value_json: 5, updated_at: new Date().toISOString() },
    ];

    const now = Date.now();
    const logs = [
      { id: 1, user_id: 2, username: 'user_b', action: 'import_case_file', target_type: 'case_file', target_id: 100, result: 'success', detail: { file_name: 'case-0' }, created_at: new Date(now - 0 * 1000).toISOString() },
      { id: 2, user_id: 1, username: 'admin', action: 'login', target_type: 'auth', target_id: 1, result: 'success', detail: {}, created_at: new Date(now - 1 * 1000).toISOString() },
      { id: 3, user_id: 2, username: 'user_b', action: 'export_case_files_xmind', target_type: 'case_file', target_id: 101, result: 'success', detail: { file_name: 'case-2' }, created_at: new Date(now - 2 * 1000).toISOString() },
      { id: 4, user_id: 1, username: 'admin', action: 'update_user', target_type: 'user', target_id: 2, result: 'success', detail: { username: 'user_b' }, created_at: new Date(now - 3 * 1000).toISOString() },
      { id: 5, user_id: 2, username: 'user_b', action: 'archive_exec_set', target_type: 'exec_set', target_id: 77, result: 'success', detail: { name: 'exec-77' }, created_at: new Date(now - 4 * 1000).toISOString() },
      { id: 6, user_id: 1, username: 'admin', action: 'delete_case_file', target_type: 'case_file', target_id: 103, result: 'success', detail: { file_name: 'case-5' }, created_at: new Date(now - 5 * 1000).toISOString() },
      { id: 7, user_id: 2, username: 'user_b', action: 'logout', target_type: 'auth', target_id: 2, result: 'success', detail: {}, created_at: new Date(now - 6 * 1000).toISOString() },
      { id: 8, user_id: 1, username: 'admin', action: 'create_project', target_type: 'project', target_id: 9, result: 'success', detail: { name: 'proj-1' }, created_at: new Date(now - 7 * 1000).toISOString() },
      { id: 9, user_id: 1, username: 'admin', action: 'update_settings', target_type: 'settings', target_id: null, result: 'success', detail: { keys: ['tempExecPageSize'] }, created_at: new Date(now - 8 * 1000).toISOString() },
      { id: 10, user_id: 2, username: 'user_b', action: 'export_case_files_excel', target_type: 'case_file', target_id: 104, result: 'success', detail: { file_name: 'case-9' }, created_at: new Date(now - 9 * 1000).toISOString() },
      { id: 11, user_id: 1, username: 'admin', action: 'create_user', target_type: 'user', target_id: 3, result: 'success', detail: { username: 'u3' }, created_at: new Date(now - 10 * 1000).toISOString() },
      { id: 12, user_id: 1, username: 'admin', action: 'import_case_file', target_type: 'case_file', target_id: 105, result: 'success', detail: { file_name: 'case-11' }, created_at: new Date(now - 11 * 1000).toISOString() },
    ];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, admin);
      if (pathName === '/api/users' && method === 'GET') return respond(200, [admin, userB]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, settings);
      if (pathName === '/api/ops' && method === 'GET') {
        const uid = url.searchParams.get('user_id');
        if (uid) return respond(200, logs.filter((l) => String(l.user_id) === String(uid)));
        return respond(200, logs);
      }

      if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('ops-log');
    });

    await expect(page.locator('#openOpsLogDrawerBtn')).toBeVisible();
    await page.click('#openOpsLogDrawerBtn');
    await expect(page.locator('#opsLogDrawer')).toHaveClass(/open/);

    // 使用“全局分页设置”每页 5 条。
    await expect(page.locator('#opsLogDrawerTableBody tr')).toHaveCount(5);
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('用例文件：case-0');

    // 翻页：下一页应出现更旧的记录。
    await page.click('#opsLogPaginationTop [data-ops-log-page="next"]');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('用例文件：case-5');

    // 人员筛选：仅看 user_b。
    await page.selectOption('#opsLogUserSelect', '2');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('user_b');
    await expect(page.locator('#opsLogDrawerTableBody')).not.toContainText('admin');

    // 行为筛选：取消“导入”后不应出现“导入”行为。
    await page.selectOption('#opsLogUserSelect', '');
    await page.click('input[data-ops-log-behavior="import"]');
    await expect(page.locator('#opsLogDrawerTableBody')).not.toContainText('导入');
  });
});

