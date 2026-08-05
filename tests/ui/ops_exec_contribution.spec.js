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
    const base = new Date();
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    const yesterday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 12, 0, 0);
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
        created_at: new Date(today.getTime() - 1000).toISOString(),
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
        created_at: new Date(today.getTime() - 2000).toISOString(),
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
        created_at: new Date(yesterday.getTime() - 1000).toISOString(),
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
        created_at: new Date(today.getTime() - 4000).toISOString(),
      },
      {
        id: 5,
        user_id: 2,
        username: 'user_b',
        action: 'archive_exec_set',
        target_type: 'exec_set',
        target_id: 20,
        result: 'success',
        detail: { name: 'exec-a', actual_result_count: 1 },
        created_at: new Date(today.getTime() - 5000).toISOString(),
      },
      {
        id: 6,
        user_id: 2,
        username: 'user_b',
        action: 'archive_exec_set',
        target_type: 'exec_set',
        target_id: 21,
        result: 'success',
        detail: { name: 'exec-b', actual_result_count: 1 },
        created_at: new Date(yesterday.getTime() - 2000).toISOString(),
      },
    ];
    let opsCalls = 0;

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-ops-exec-contribution-view-v1', JSON.stringify({
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

    await page.click('input[data-ops-exec-contribution-user="1"]');
    await page.click('input[data-ops-exec-contribution-user="2"]');
    await page.click('#opsExecContributionApplyBtn');
    await expect(page.locator('#opsExecContributionDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#opsExecContributionCard')).toBeVisible();
    await expect(page.locator('#opsExecContributionBehaviorFilterGrid')).toContainText('用例执行 2');
    await expect(page.locator('#opsExecContributionBehaviorFilterGrid')).toContainText('归档用例 2');
    await expect(page.locator('#opsExecContributionList .ops-activity-row')).toHaveCount(2);
    await expect(page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'user_b' })).toContainText('user_b');
    await expect(page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'admin' })).toContainText('admin');
    await expect(
      page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count'),
    ).toHaveText(['2', '2']);
    await expect(
      page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'admin' }).locator('.ops-activity-count'),
    ).toHaveText(['0', '0']);
    await expect.poll(() => opsCalls).toBeGreaterThanOrEqual(1);

    const beforeRefreshCalls = opsCalls;
    await page.click('#openOpsExecContributionDrawerBtnInline');
    await expect(page.locator('#opsExecContributionDrawer')).toHaveClass(/open/);
    await expect.poll(() => opsCalls).toBeGreaterThan(beforeRefreshCalls);
    await page.click('#opsExecContributionDrawer [data-drawer-close="opsExecContributionDrawer"]');
    await expect(page.locator('#opsExecContributionDrawer')).not.toHaveClass(/open/);

    await page.click('input[data-ops-exec-contribution-behavior="archive"]');
    await expect(page.locator('#opsExecContributionList .ops-activity-row')).toHaveCount(2);
    await expect(page.locator('#opsExecContributionList .ops-activity-bar-item')).toHaveCount(2);
    await expect(page.locator('#opsExecContributionList .ops-activity-bar-label')).toHaveText(['归档', '归档']);
    await expect(page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count')).toHaveText('2');
    await expect(page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'admin' }).locator('.ops-activity-count')).toHaveText('0');

    await page.click('input[data-ops-exec-contribution-behavior="all"]');
    const todayInput = formatDateInput(today);
    await page.fill('#opsExecContributionDateStart', todayInput);
    await page.fill('#opsExecContributionDateEnd', todayInput);
    await expect(page.locator('#opsExecContributionList .ops-activity-row')).toHaveCount(2);
    await expect(
      page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count'),
    ).toHaveText(['1', '1']);
    await expect(
      page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'admin' }).locator('.ops-activity-count'),
    ).toHaveText(['0', '0']);
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
        action: 'update_exec_case',
        target_type: 'exec_case',
        target_id: i + 1,
        result: 'success',
        detail: {
          module: '模块A',
          title: `用例-${i}`,
          precondition: '前置',
          steps: '步骤',
          expected: '预期',
          status: '未执行',
          actual_result: '',
          changed_fields: [],
        },
        created_at: new Date(yesterday.getTime() - i * 1000).toISOString(),
      });
    }
    logs.push({
      id: 2001,
      user_id: 2,
      username: 'user_b',
      action: 'update_exec_case',
      target_type: 'exec_case',
      target_id: 999,
      result: 'success',
      detail: {
        module: '模块B',
        title: '用例-旧',
        precondition: '前置',
        steps: '步骤',
        expected: '预期',
        status: '通过',
        actual_result: 'OK',
        changed_fields: ['status'],
      },
      created_at: oldDate.toISOString(),
    });
    let opsCalls = 0;

    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          'tap-ops-exec-contribution-view-v1',
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

    await page.click('#openOpsExecContributionDrawerBtn');
    await expect(page.locator('#opsExecContributionDrawer')).toHaveClass(/open/);

    await page.click('input[data-ops-exec-contribution-user="2"]');
    await page.click('#opsExecContributionApplyBtn');
    await expect(page.locator('#opsExecContributionDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#opsExecContributionCard')).toBeVisible();
    await expect(page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count')).toHaveText(['0', '0']);

    const oldInput = formatDateInput(oldDate);
    await page.fill('#opsExecContributionDateStart', oldInput);
    await page.fill('#opsExecContributionDateEnd', oldInput);
    await expect.poll(() => opsCalls).toBeGreaterThan(1);
    await expect(page.locator('#opsExecContributionList .ops-activity-row', { hasText: 'user_b' }).locator('.ops-activity-count')).toHaveText(['1', '0']);
  });
});
