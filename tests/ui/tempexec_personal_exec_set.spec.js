const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let retriedReload = false;
  let retriedGoto = false;
  let last = null;

  while (Date.now() < deadline) {
    last = await page.evaluate(() => {
      let token = '';
      try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
      return {
        hasApp: Boolean(window.app),
        authReady: Boolean(window.app && window.app.authReady === true),
        hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
        path: (window.location && window.location.pathname) ? String(window.location.pathname) : '',
        token: token,
      };
    });

    if (last && last.hasApp && last.authReady && last.hasSwitchTab) return;

    if (!retriedGoto && last && last.path && last.path.indexOf('login') !== -1) {
      retriedGoto = true;
      const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
      await page.goto(base + '/index.html');
      await page.waitForTimeout(200);
      continue;
    }

    if (!retriedReload && last && last.hasApp && !last.hasSwitchTab) {
      retriedReload = true;
      await page.reload();
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

test.describe('用例执行-个人执行集隔离', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('同项目同用例：不同 token 只加载自己的执行集', async ({ page }) => {
    const tokenA = 'token-a';
    const tokenB = 'token-b';

    const userA = { id: 9, username: 'demo_a', role: 'user', level: 'member' };
    const userB = { id: 10, username: 'demo_b', role: 'user', level: 'member' };
    const project = { id: 1, name: '战魂铭人', description: 'for personal exec set' };
    const versions = [{ id: 11, name: 'v1' }];

    const now = new Date().toISOString();
    const execSetsByToken = {};
    execSetsByToken[tokenA] = [
      { id: 2001, project_id: project.id, version_id: versions[0].id, case_file_id: 100, name: '用例A', status: 'active', created_at: now, updated_at: now },
    ];
    execSetsByToken[tokenB] = [
      { id: 2002, project_id: project.id, version_id: versions[0].id, case_file_id: 100, name: '用例A', status: 'active', created_at: now, updated_at: now },
    ];
    const execCasesBySetId = {
      2001: [{ id: 3001, exec_set_id: 2001, case_item_id: 1, module: '模块', title: '标题', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '未执行', order_no: 1, executor_id: userA.id, created_at: now, updated_at: now }],
      2002: [{ id: 3002, exec_set_id: 2002, case_item_id: 1, module: '模块', title: '标题', expected: '预期', priority: null, precondition: null, steps: null, actual_result: null, defect_link: null, reuse_details: null, defect_links: null, remark: null, status: '未执行', order_no: 1, executor_id: userB.id, created_at: now, updated_at: now }],
    };

    function getAuthToken(route) {
      const hdr = route.request().headers()['authorization'] || route.request().headers()['Authorization'] || '';
      const raw = String(hdr || '');
      const parts = raw.split(/\s+/);
      if (parts.length >= 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
      return '';
    }

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const token = getAuthToken(route);
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') {
        if (token === tokenA) return respond(200, userA);
        if (token === tokenB) return respond(200, userB);
        return respond(401, { detail: 'unauthorized' });
      }
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const list = execSetsByToken[token] || [];
        return respond(200, list.slice());
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const execSetId = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[execSetId] || []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, tokenA);
    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await expect(page.locator('#currentUsername')).toContainText(userA.username);
    await page.waitForFunction(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st || !Array.isArray(st.tempExecFiles)) return false;
      return st.tempExecFiles.some((f) => f && String(f.id) === '2001') && !st.tempExecFiles.some((f) => f && String(f.id) === '2002');
    });

    // 切换“另一个用户”：追加一段 initScript 让下一次导航前覆盖 token。
    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, tokenB);
    await page.reload();
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await expect(page.locator('#currentUsername')).toContainText(userB.username);
    await page.waitForFunction(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st || !Array.isArray(st.tempExecFiles)) return false;
      return st.tempExecFiles.some((f) => f && String(f.id) === '2002') && !st.tempExecFiles.some((f) => f && String(f.id) === '2001');
    });
  });
});
