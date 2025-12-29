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

test.describe('操作记录-用例贡献视图', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'test-token');
      } catch (_) {}
    });
  });

  test('删除用例计入贡献统计', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const userB = { id: 2, username: 'user_b', role: 'user', level: 'member' };
    const base = new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    const yesterday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 12, 0, 0);
    const logs = [
      { id: 1, user_id: 2, username: 'user_b', action: 'import_case_file', target_type: 'case_file', target_id: 10, result: 'success', detail: { item_imported: 3, source: 'xmind', file_name: 'case-a' }, created_at: new Date(today.getTime() - 1000).toISOString() },
      { id: 2, user_id: 2, username: 'user_b', action: 'create_case_item', target_type: 'case_item', target_id: 11, result: 'success', detail: { complete: true, module: 'm', title: 't', precondition: 'p', steps: 's', expected: 'e' }, created_at: new Date(yesterday.getTime() - 1000).toISOString() },
      { id: 3, user_id: 2, username: 'user_b', action: 'delete_case_item', target_type: 'case_item', target_id: 12, result: 'success', detail: { module: 'm', title: 't2', precondition: 'p2', steps: 's2', expected: 'e2' }, created_at: new Date(yesterday.getTime() - 2000).toISOString() },
      { id: 4, user_id: 2, username: 'user_b', action: 'delete_case_file', target_type: 'case_file', target_id: 13, result: 'success', detail: { item_deleted_complete: 2, file_name: 'case-del' }, created_at: new Date(today.getTime() - 2000).toISOString() },
    ];
    let opsCalls = 0;

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, admin);
      if (pathName === '/api/users' && method === 'GET') return respond(200, [admin, userB]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
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
    await page.waitForFunction(() => {
      const grid = document.getElementById('opsContributionBehaviorFilterGrid');
      return grid && grid.querySelectorAll('label').length > 0;
    });

    await page.click('#openOpsContributionDrawerBtn');
    await expect(page.locator('#opsContributionDrawer')).toHaveClass(/open/);

    await page.click('input[data-ops-contribution-user="1"]');
    await page.click('input[data-ops-contribution-user="2"]');
    await page.click('#opsContributionApplyBtn');
    await expect(page.locator('#opsContributionDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#opsContributionCard')).toBeVisible();
    await expect(page.locator('#opsContributionBehaviorFilterGrid')).toContainText('用例导入 3');
    await expect(page.locator('#opsContributionBehaviorFilterGrid')).toContainText('新增用例 1');
    await expect(page.locator('#opsContributionBehaviorFilterGrid')).toContainText('删除用例 3');

    await expect(page.locator('#opsContributionList .ops-activity-row')).toHaveCount(2);
    await expect(page.locator('#opsContributionList .ops-activity-row', { hasText: 'user_b' })).toContainText('user_b');
    await expect(page.locator('#opsContributionList .ops-activity-row', { hasText: 'admin' })).toContainText('admin');
    await expect(
      page.locator('#opsContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count'),
    ).toHaveText('7');
    await expect(
      page.locator('#opsContributionList .ops-activity-row', { hasText: 'admin' }).locator('.ops-activity-count'),
    ).toHaveText('0');
    await expect.poll(() => opsCalls).toBeGreaterThanOrEqual(1);

    const yesterdayInput = formatDateInput(yesterday);
    await page.fill('#opsContributionDateStart', yesterdayInput);
    await page.fill('#opsContributionDateEnd', yesterdayInput);
    await expect(page.locator('#opsContributionList .ops-activity-row')).toHaveCount(2);
    await expect(
      page.locator('#opsContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count'),
    ).toHaveText('2');
    await expect(
      page.locator('#opsContributionList .ops-activity-row', { hasText: 'admin' }).locator('.ops-activity-count'),
    ).toHaveText('0');

    const beforeRefreshCalls = opsCalls;
    await page.click('#openOpsContributionDrawerBtnInline');
    await expect(page.locator('#opsContributionDrawer')).toHaveClass(/open/);
    await expect.poll(() => opsCalls).toBeGreaterThan(beforeRefreshCalls);
  });

  test('日期范围向更早调整会补齐分页数据', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const userB = { id: 2, username: 'user_b', role: 'user', level: 'member' };
    const base = new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    const yesterday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 12, 0, 0);
    const oldDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 10, 12, 0, 0);
    const logs = [];
    for (let i = 0; i < 500; i += 1) {
      logs.push({
        id: i + 1,
        user_id: 2,
        username: 'user_b',
        action: 'import_case_file',
        target_type: 'case_file',
        target_id: 10,
        result: 'success',
        detail: { item_imported: 1, source: 'xmind', file_name: `case-${i}` },
        created_at: new Date(yesterday.getTime() - i * 1000).toISOString(),
      });
    }
    logs.push({
      id: 1001,
      user_id: 2,
      username: 'user_b',
      action: 'import_case_file',
      target_type: 'case_file',
      target_id: 12,
      result: 'success',
      detail: { item_imported: 5, source: 'xmind', file_name: 'case-old' },
      created_at: oldDate.toISOString(),
    });
    let opsCalls = 0;

    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          'tap-ops-contribution-view-v1',
          JSON.stringify({
            userIds: [],
            timeRange: 'day',
            dateStart: '',
            dateEnd: '',
            behaviors: [],
            behaviorAll: true,
            hasSelection: false,
            savedAt: Date.now(),
          }),
        );
      } catch (_) {}
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, admin);
      if (pathName === '/api/users' && method === 'GET') return respond(200, [admin, userB]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') {
        opsCalls += 1;
        const limit = Number(url.searchParams.get('limit') || logs.length);
        const offset = Number(url.searchParams.get('offset') || 0);
        return respond(200, logs.slice(offset, offset + limit));
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

    await page.click('#openOpsContributionDrawerBtn');
    await expect(page.locator('#opsContributionDrawer')).toHaveClass(/open/);

    await page.click('input[data-ops-contribution-user="2"]');
    await page.click('#opsContributionApplyBtn');
    await expect(page.locator('#opsContributionDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#opsContributionCard')).toBeVisible();
    await expect(page.locator('#opsContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count')).toHaveText('0');

    const oldInput = formatDateInput(oldDate);
    await page.fill('#opsContributionDateStart', oldInput);
    await page.fill('#opsContributionDateEnd', oldInput);
    await expect.poll(() => opsCalls).toBeGreaterThan(1);
    await expect(page.locator('#opsContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count')).toHaveText('5');
  });
});
