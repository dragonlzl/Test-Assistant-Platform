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
    const now = Date.now();
    const logs = [
      { id: 1, user_id: 2, username: 'user_b', action: 'import_case_file', target_type: 'case_file', target_id: 10, result: 'success', detail: { item_imported: 3, source: 'xmind', file_name: 'case-a' }, created_at: new Date(now - 1000).toISOString() },
      { id: 2, user_id: 2, username: 'user_b', action: 'create_case_item', target_type: 'case_item', target_id: 11, result: 'success', detail: { complete: true, module: 'm', title: 't', precondition: 'p', steps: 's', expected: 'e' }, created_at: new Date(now - 2000).toISOString() },
      { id: 3, user_id: 2, username: 'user_b', action: 'delete_case_item', target_type: 'case_item', target_id: 12, result: 'success', detail: { module: 'm', title: 't2', precondition: 'p2', steps: 's2', expected: 'e2' }, created_at: new Date(now - 3000).toISOString() },
      { id: 4, user_id: 2, username: 'user_b', action: 'delete_case_file', target_type: 'case_file', target_id: 13, result: 'success', detail: { item_deleted_complete: 2, file_name: 'case-del' }, created_at: new Date(now - 4000).toISOString() },
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

    const beforeRefreshCalls = opsCalls;
    await page.click('#openOpsContributionDrawerBtnInline');
    await expect(page.locator('#opsContributionDrawer')).toHaveClass(/open/);
    await expect.poll(() => opsCalls).toBeGreaterThan(beforeRefreshCalls);
  });
});
