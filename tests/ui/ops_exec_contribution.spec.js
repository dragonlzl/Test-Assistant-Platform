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

test.describe('操作记录-用例执行贡献视图', () => {
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

  test('选择人员后展示用例执行贡献，并支持去重/归档统计', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const userB = { id: 2, username: 'user_b', role: 'user', level: 'member' };
    const now = Date.now();
    const logs = [
      {
        id: 1,
        user_id: 2,
        username: 'user_b',
        action: 'update_exec_case',
        target_type: 'exec_case',
        target_id: 10,
        result: 'success',
        detail: {
          module: '模块A',
          title: '用例1',
          precondition: '前置1',
          steps: '步骤1',
          expected: '预期1',
          status: '通过',
          actual_result: 'OK',
          changed_fields: ['status', 'actual_result'],
        },
        created_at: new Date(now - 1000).toISOString(),
      },
      {
        id: 2,
        user_id: 2,
        username: 'user_b',
        action: 'update_exec_case',
        target_type: 'exec_case',
        target_id: 11,
        result: 'success',
        detail: {
          module: '模块A',
          title: '用例1',
          precondition: '前置1',
          steps: '步骤1',
          expected: '预期1',
          status: '通过',
          actual_result: 'OK-2',
          changed_fields: ['actual_result'],
        },
        created_at: new Date(now - 2000).toISOString(),
      },
      {
        id: 3,
        user_id: 2,
        username: 'user_b',
        action: 'update_exec_case',
        target_type: 'exec_case',
        target_id: 12,
        result: 'success',
        detail: {
          module: '模块B',
          title: '用例2',
          precondition: '前置2',
          steps: '步骤2',
          expected: '预期2',
          status: '失败',
          actual_result: 'NG',
          changed_fields: ['status', 'actual_result'],
        },
        created_at: new Date(now - 3000).toISOString(),
      },
      {
        id: 4,
        user_id: 2,
        username: 'user_b',
        action: 'update_exec_case',
        target_type: 'exec_case',
        target_id: 13,
        result: 'success',
        detail: {
          module: '模块C',
          title: '用例3',
          precondition: '前置3',
          steps: '步骤3',
          expected: '预期3',
          status: '未执行',
          actual_result: '',
          changed_fields: [],
        },
        created_at: new Date(now - 4000).toISOString(),
      },
      {
        id: 5,
        user_id: 2,
        username: 'user_b',
        action: 'archive_exec_set',
        target_type: 'exec_set',
        target_id: 20,
        result: 'success',
        detail: { name: 'exec-a', actual_result_count: 2 },
        created_at: new Date(now - 5000).toISOString(),
      },
      {
        id: 6,
        user_id: 2,
        username: 'user_b',
        action: 'archive_exec_set',
        target_type: 'exec_set',
        target_id: 21,
        result: 'success',
        detail: { name: 'exec-b', actual_result_count: 0 },
        created_at: new Date(now - 6000).toISOString(),
      },
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

    await page.click('#openOpsExecContributionDrawerBtn');
    await expect(page.locator('#opsExecContributionDrawer')).toHaveClass(/open/);

    await page.click('input[data-ops-exec-contribution-user="2"]');
    await page.click('#opsExecContributionApplyBtn');
    await expect(page.locator('#opsExecContributionDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#opsExecContributionCard')).toBeVisible();
    await expect(page.locator('#opsExecContributionBehaviorFilterGrid')).toContainText('用例执行 2');
    await expect(page.locator('#opsExecContributionBehaviorFilterGrid')).toContainText('归档用例 2');
    await expect(page.locator('#opsExecContributionList .ops-activity-row')).toHaveCount(1);
    await expect(page.locator('#opsExecContributionList .ops-activity-row').first()).toContainText('user_b');
    await expect(page.locator('#opsExecContributionList .ops-activity-count')).toHaveText('4');
    await expect.poll(() => opsCalls).toBeGreaterThanOrEqual(1);

    const beforeRefreshCalls = opsCalls;
    await page.click('#openOpsExecContributionDrawerBtnInline');
    await expect(page.locator('#opsExecContributionDrawer')).toHaveClass(/open/);
    await expect.poll(() => opsCalls).toBeGreaterThan(beforeRefreshCalls);
    await page.click('#opsExecContributionDrawer [data-drawer-close="opsExecContributionDrawer"]');
    await expect(page.locator('#opsExecContributionDrawer')).not.toHaveClass(/open/);

    await page.click('input[data-ops-exec-contribution-behavior="archive"]');
    await expect(page.locator('#opsExecContributionList .ops-activity-count')).toHaveText('2');
  });
});
