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

test.describe('操作记录-执行用例聚合展示', () => {
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

  test('执行用例按天聚合为首条/末条记录', async ({ page }) => {
    const admin = { id: 1, username: 'admin', role: 'admin', level: 'leader' };
    const base = new Date();
    const yesterday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 10, 0, 0);
    const logs = [
      {
        id: 1,
        user_id: 1,
        username: 'admin',
        action: 'update_exec_case',
        target_type: 'exec_case',
        target_id: 100,
        result: 'success',
        detail: {
          module: '模块A',
          title: '用例1',
          precondition: '前置1',
          steps: '步骤1',
          expected: '预期1',
          status: '通过',
          actual_result: 'OK',
          changed_fields: ['status'],
        },
        created_at: new Date(yesterday.getTime()).toISOString(),
      },
      {
        id: 2,
        user_id: 1,
        username: 'admin',
        action: 'update_exec_case',
        target_type: 'exec_case',
        target_id: 101,
        result: 'success',
        detail: {
          module: '模块A',
          title: '用例2',
          precondition: '前置2',
          steps: '步骤2',
          expected: '预期2',
          status: '失败',
          actual_result: 'NG',
          changed_fields: ['status'],
        },
        created_at: new Date(yesterday.getTime() + 60 * 60 * 1000).toISOString(),
      },
      {
        id: 3,
        user_id: 1,
        username: 'admin',
        action: 'update_exec_case',
        target_type: 'exec_case',
        target_id: 102,
        result: 'success',
        detail: {
          module: '模块A',
          title: '皮肤',
          precondition: '前置3',
          steps: '步骤3',
          expected: '预期3',
          status: '未执行',
          actual_result: '',
          reuse_total_count: 3,
          reuse_executed_count: 1,
          changed_fields: ['reuse_details'],
        },
        created_at: new Date(yesterday.getTime() + 5 * 60 * 60 * 1000).toISOString(),
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
    await page.waitForFunction(() => {
      return document.querySelectorAll('#opsLogDrawerTableBody tr').length > 0;
    });

    const execRows = await page.$$eval('#opsLogDrawerTableBody tr', (rows) => {
      return rows
        .filter((row) => row.textContent.includes('执行用例'))
        .map((row) => {
          return {
            text: row.textContent || '',
          };
        });
    });
    const execText = execRows.map((row) => row.text).join(' ');
    expect(execText).toContain('0 -> 1');
    expect(execText).toContain('1 -> 3');
    expect(execText).toContain('用例：用例1');
    expect(execText).toContain('用例：皮肤（复）');
  });
});
