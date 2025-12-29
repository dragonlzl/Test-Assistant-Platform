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

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  test('查看记录：使用全局分页，支持人员与对象过滤', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const userB = { id: 2, username: 'user_b', role: 'user', level: 'member' };
    const settings = [
      { id: 1, scope: 'user', owner_id: 1, key: 'tempExecPageSize', value_json: 5, updated_at: new Date().toISOString() },
    ];

    const base = new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    const yesterday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 12, 0, 0);
    const logs = [
      { id: 1, user_id: 2, username: 'user_b', action: 'import_case_file', target_type: 'case_file', target_id: 100, result: 'success', detail: { file_name: 'case-0', source: 'xmind', before_count: 0, after_count: 1 }, created_at: new Date(yesterday.getTime()).toISOString() },
      { id: 2, user_id: 1, username: 'admin', action: 'login', target_type: 'auth', target_id: 1, result: 'success', detail: {}, created_at: new Date(yesterday.getTime() - 1000).toISOString() },
      { id: 3, user_id: 2, username: 'user_b', action: 'upsert_exec_set_from_case_file', target_type: 'exec_set', target_id: 101, result: 'success', detail: { case_file_name: 'case-2', exec_set_name: 'case-2', before_count: 10, after_count: 88, new_cases: 78, transfer_count: 88 }, created_at: new Date(today.getTime() - 2 * 1000).toISOString() },
      { id: 4, user_id: 1, username: 'admin', action: 'update_user', target_type: 'user', target_id: 2, result: 'success', detail: { username: 'user_b' }, created_at: new Date(today.getTime() - 3 * 1000).toISOString() },
      { id: 5, user_id: 2, username: 'user_b', action: 'archive_exec_set', target_type: 'exec_set', target_id: 77, result: 'success', detail: { name: 'exec-77', case_file_name: 'case-77', before_count: 12, after_count: 12 }, created_at: new Date(today.getTime() - 4 * 1000).toISOString() },
      { id: 6, user_id: 1, username: 'admin', action: 'delete_case_file', target_type: 'case_file', target_id: 103, result: 'success', detail: { file_name: 'case-5', before_count: 9, after_count: 0 }, created_at: new Date(today.getTime() - 5 * 1000).toISOString() },
      { id: 7, user_id: 2, username: 'user_b', action: 'logout', target_type: 'auth', target_id: 2, result: 'success', detail: {}, created_at: new Date(today.getTime() - 6 * 1000).toISOString() },
      { id: 8, user_id: 1, username: 'admin', action: 'create_project', target_type: 'project', target_id: 9, result: 'success', detail: { name: 'proj-1' }, created_at: new Date(today.getTime() - 7 * 1000).toISOString() },
      { id: 9, user_id: 1, username: 'admin', action: 'batch_create_case_items', target_type: 'case_item', target_id: null, result: 'success', detail: { file_name: 'case-batch-1', count: 3, before_count: 20, after_count: 23 }, created_at: new Date(today.getTime() - 8 * 1000).toISOString() },
      { id: 10, user_id: 2, username: 'user_b', action: 'batch_delete_case_items', target_type: 'case_item', target_id: null, result: 'success', detail: { file_name: 'case-batch-2', count: 2, before_count: 23, after_count: 21 }, created_at: new Date(today.getTime() - 9 * 1000).toISOString() },
      { id: 11, user_id: 1, username: 'admin', action: 'create_user', target_type: 'user', target_id: 3, result: 'success', detail: { username: 'u3' }, created_at: new Date(today.getTime() - 10 * 1000).toISOString() },
      { id: 12, user_id: 1, username: 'admin', action: 'import_case_file', target_type: 'case_file', target_id: 105, result: 'success', detail: { file_name: 'case-11', source: 'tempexec' }, created_at: new Date(today.getTime() - 11 * 1000).toISOString() },
      { id: 13, user_id: 1, username: 'admin', action: 'delete_version', target_type: 'project_version', target_id: 12, result: 'success', detail: { project_name: 'proj-2', version_name: 'v2', page: 'project-admin' }, created_at: new Date(today.getTime() - 12 * 1000).toISOString() },
      { id: 14, user_id: 1, username: 'admin', action: 'dissolve_exec_archived_placeholders', target_type: 'project_version', target_id: 13, result: 'success', detail: { project_name: 'proj-3', version_name: 'v3', count: 2, before_count: 2, after_count: 0, page: 'tempexec' }, created_at: new Date(today.getTime() - 13 * 1000).toISOString() },
      { id: 15, user_id: 1, username: 'admin', action: 'import_case_file', target_type: 'case_file', target_id: 106, result: 'success', detail: { file_name: 'case-over', overwrite: true, source: 'xmind', page: 'case-library', before_count: 100, after_count: 99 }, created_at: new Date(today.getTime() - 14 * 1000).toISOString() },
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
    await page.waitForFunction(() => {
      const grid = document.getElementById('opsLogTargetFilterGrid');
      return grid && grid.querySelectorAll('label').length > 0;
    });
    await expect(page.locator('#flowNav')).toHaveClass(/hidden/);
    await expect(page.locator('#opsLogDrawer')).toHaveClass(/open/);
    await expect(page.locator('.ops-log-table thead')).toContainText('操作页面');
    await expect(page.locator('.ops-log-table thead')).toContainText('变化');

    // 使用“全局分页设置”每页 5 条。
    await expect(page.locator('#opsLogDrawerTableBody tr')).toHaveCount(5);
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('用例：case-0');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('0 -> 1');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('12 -> 12');
    const transferRow = page.locator('#opsLogDrawerTableBody tr').filter({ hasText: '转执行' }).first();
    await expect(transferRow).toContainText('88');
    await expect(transferRow).not.toContainText('->');

    // 翻页：下一页应出现更旧的记录。
    await page.click('#opsLogPaginationTop [data-ops-log-page="next"]');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('用例：case-5');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('批量新增3条');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('批量删除2条');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('9 -> 0');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('20 -> 23');
    await page.click('#opsLogPaginationTop [data-ops-log-page="last"]');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('版本 proj-2v2');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('解散归档');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('覆盖入库');

    // 操作行为筛选：点击“批量新增”后仅保留批量新增记录。
    await page.click('input[data-ops-log-action="批量新增"]');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('批量新增3条');
    await expect(page.locator('#opsLogDrawerTableBody')).not.toContainText('批量删除2条');
    await page.click('input[data-ops-log-action="all"]');

    // 人员筛选：仅看 user_b。
    await page.selectOption('#opsLogUserSelect', '2');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('user_b');
    await expect(page.locator('#opsLogDrawerTableBody')).not.toContainText('admin');

    // 对象筛选：选择“系统平台”后，仅展示平台相关记录。
    await page.selectOption('#opsLogUserSelect', '');
    await page.click('input[data-ops-log-target="platform"]');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('系统平台');
    await expect(page.locator('#opsLogDrawerTableBody')).not.toContainText('用例：');
    await expect(page.locator('#opsLogDrawerTableBody')).not.toContainText('人员：');

    await page.click('input[data-ops-log-target="all"]');
    const yesterdayInput = formatDateInput(yesterday);
    await page.fill('#opsLogDateStart', yesterdayInput);
    await page.fill('#opsLogDateEnd', yesterdayInput);
    await expect(page.locator('#opsLogDrawerTableBody tr')).toHaveCount(2);
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('用例：case-0');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('系统平台');
  });

  test('用例类型变更记录显示为转为复用/非复用', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const now = new Date().toISOString();
    const logs = [
      {
        id: 101,
        user_id: 1,
        username: 'admin',
        action: 'change_case_reuse_type',
        target_type: 'case_file',
        target_id: 501,
        result: 'success',
        detail: { case_file_name: '用例A', file_name: '用例A', reuse_enabled: true },
        created_at: now,
      },
      {
        id: 102,
        user_id: 1,
        username: 'admin',
        action: 'change_case_reuse_type',
        target_type: 'case_file',
        target_id: 502,
        result: 'success',
        detail: { case_file_name: '用例B', file_name: '用例B', reuse_enabled: false },
        created_at: new Date(Date.now() - 1000).toISOString(),
      },
    ];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, admin);
      if (pathName === '/api/users' && method === 'GET') return respond(200, [admin]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, logs);

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

    await page.click('#openOpsLogDrawerBtn');
    await expect(page.locator('#opsLogDrawer')).toHaveClass(/open/);
    await expect(page.locator('.ops-log-table thead')).toContainText('变化');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('用例类型变更');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('用例：用例A');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('转为复用');
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('转为非复用');
  });

  test('查看记录：导出记录Excel', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const settings = [
      { id: 1, scope: 'user', owner_id: 1, key: 'tempExecPageSize', value_json: 20, updated_at: new Date().toISOString() },
    ];
    const now = new Date();
    const logs = [
      { id: 1, user_id: 1, username: 'admin', action: 'login', target_type: 'auth', target_id: 1, result: 'success', detail: {}, created_at: new Date(now.getTime() - 1000).toISOString() },
      { id: 2, user_id: 1, username: 'admin', action: 'create_project', target_type: 'project', target_id: 9, result: 'success', detail: { name: 'proj-1' }, created_at: new Date(now.getTime() - 2000).toISOString() },
    ];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, admin);
      if (pathName === '/api/users' && method === 'GET') return respond(200, [admin]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, settings);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, logs);

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
    await page.click('#openOpsLogDrawerBtn');
    await page.waitForFunction(() => {
      const grid = document.getElementById('opsLogTargetFilterGrid');
      return grid && grid.querySelectorAll('label').length > 0;
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#opsLogDrawerExportBtn'),
    ]);
    await expect(page.locator('#opsLogDrawerStatus')).toContainText('导出完成：2 条记录');
    expect(download.suggestedFilename()).toMatch(/操作记录_/);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test('设置更新不展示在查看记录列表', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const now = new Date();
    const logs = [
      {
        id: 201,
        user_id: 1,
        username: 'admin',
        action: 'update_settings',
        target_type: 'settings',
        target_id: 1,
        result: 'success',
        detail: { scope: 'user', keys: ['tempExecPageSize'], items: [{ key: 'tempExecPageSize', value_json: 20 }] },
        created_at: new Date(now.getTime() - 1000).toISOString(),
      },
      {
        id: 202,
        user_id: 1,
        username: 'admin',
        action: 'login',
        target_type: 'auth',
        target_id: 1,
        result: 'success',
        detail: {},
        created_at: new Date(now.getTime() - 2000).toISOString(),
      },
    ];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, admin);
      if (pathName === '/api/users' && method === 'GET') return respond(200, [admin]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, logs);

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

    await page.click('#openOpsLogDrawerBtn');
    await expect(page.locator('#opsLogDrawer')).toHaveClass(/open/);
    await expect(page.locator('#opsLogDrawerTableBody tr')).toHaveCount(1);
    await expect(page.locator('#opsLogDrawerTableBody')).toContainText('登录');
    await expect(page.locator('#opsLogDrawerTableBody')).not.toContainText('更新设置');
    await expect(page.locator('#opsLogDrawerTableBody')).not.toContainText('settings#');
  });
});
