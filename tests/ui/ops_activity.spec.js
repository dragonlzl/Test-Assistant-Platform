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

test.describe('操作记录-活跃度视图', () => {
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

  test('选择人员后展示活跃度，并支持行为/时间过滤', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const userB = { id: 2, username: 'user_b', role: 'user', level: 'member' };
    const userC = { id: 3, username: 'user_c', role: 'user', level: 'member' };
    const settings = [];
    const base = new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    const yesterday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 12, 0, 0);
    const logs = [
      { id: 1, user_id: 1, username: 'admin', action: 'login', target_type: 'auth', target_id: 1, result: 'success', detail: {}, created_at: new Date(today.getTime() - 1 * 60 * 60 * 1000).toISOString() },
      { id: 2, user_id: 1, username: 'admin', action: 'export_case_files_xmind', target_type: 'case_file', target_id: 10, result: 'success', detail: { file_name: 'case-1' }, created_at: new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString() },
      { id: 3, user_id: 1, username: 'admin', action: 'create_project', target_type: 'project', target_id: 20, result: 'success', detail: { name: 'proj-1' }, created_at: new Date(yesterday.getTime()).toISOString() },
      { id: 4, user_id: 2, username: 'user_b', action: 'login', target_type: 'auth', target_id: 2, result: 'success', detail: {}, created_at: new Date(yesterday.getTime() + 60 * 60 * 1000).toISOString() },
      { id: 5, user_id: 2, username: 'user_b', action: 'export_case_files_excel', target_type: 'case_file', target_id: 11, result: 'success', detail: { file_name: 'case-2' }, created_at: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000).toISOString() },
    ];
    let opsCalls = 0;

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-ops-activity-view-v1', JSON.stringify({
          userIds: [],
          timeRange: 'all',
          behaviors: [],
          behaviorAll: true,
          hasSelection: false,
        }));
      } catch (_) {}
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, admin);
      if (pathName === '/api/users' && method === 'GET') return respond(200, [admin, userB, userC]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, settings);
      if (pathName === '/api/ops' && method === 'GET') {
        opsCalls += 1;
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

    await page.click('#openOpsActivityDrawerBtn');
    await expect(page.locator('#opsActivityDrawer')).toHaveClass(/open/);

    await expect(page.locator('input[data-ops-activity-user="1"]')).toBeVisible();
    await page.click('input[data-ops-activity-user="1"]');
    await page.click('input[data-ops-activity-user="2"]');
    await page.click('input[data-ops-activity-user="3"]');
    await page.click('#opsActivityApplyBtn');
    await expect(page.locator('#opsActivityDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('.ops-activity-row')).toHaveCount(3);
    await expect(page.locator('.ops-activity-row').nth(0)).toContainText('admin');
    await expect(page.locator('.ops-activity-row').nth(0).locator('.ops-activity-count')).toHaveText('3');
    await expect(page.locator('.ops-activity-row').nth(1)).toContainText('user_b');
    await expect(page.locator('.ops-activity-row').nth(1).locator('.ops-activity-count')).toHaveText('2');
    await expect(page.locator('.ops-activity-row').nth(2)).toContainText('user_c');
    await expect(page.locator('.ops-activity-row').nth(2).locator('.ops-activity-count')).toHaveText('0');
    await expect.poll(() => opsCalls).toBeGreaterThanOrEqual(1);

    const beforeRefreshCalls = opsCalls;
    await page.click('#openOpsActivityDrawerBtnInline');
    await expect(page.locator('#opsActivityDrawer')).toHaveClass(/open/);
    await expect.poll(() => opsCalls).toBeGreaterThan(beforeRefreshCalls);
    await page.click('#opsActivityDrawer [data-drawer-close="opsActivityDrawer"]');
    await expect(page.locator('#opsActivityDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#opsActivityBehaviorFilterGrid')).toContainText('登录');
    await page.click('input[data-ops-activity-behavior="登录"]');
    await expect(page.locator('.ops-activity-row')).toHaveCount(3);
    await expect(page.locator('.ops-activity-count').nth(0)).toHaveText('1');
    await expect(page.locator('.ops-activity-count').nth(1)).toHaveText('1');
    await expect(page.locator('.ops-activity-count').nth(2)).toHaveText('0');

    await page.selectOption('#opsActivityTimeRangeSelect', 'day');
    await expect(page.locator('.ops-activity-row')).toHaveCount(3);
    await expect(page.locator('.ops-activity-row').first()).toContainText('admin');
    await expect(page.locator('.ops-activity-count').nth(0)).toHaveText('1');
    await expect(page.locator('.ops-activity-count').nth(1)).toHaveText('0');
    await expect(page.locator('.ops-activity-count').nth(2)).toHaveText('0');

    await page.click('input[data-ops-activity-behavior="all"]');
    const yesterdayInput = formatDateInput(yesterday);
    await page.fill('#opsActivityDateStart', yesterdayInput);
    await page.fill('#opsActivityDateEnd', yesterdayInput);
    await expect(page.locator('.ops-activity-row')).toHaveCount(3);
    await expect(page.locator('.ops-activity-row', { hasText: 'admin' }).locator('.ops-activity-count')).toHaveText('1');
    await expect(page.locator('.ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count')).toHaveText('2');
    await expect(page.locator('.ops-activity-row', { hasText: 'user_c' }).locator('.ops-activity-count')).toHaveText('0');
  });
});
