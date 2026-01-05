const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(
    () => window.app && window.app._inited === true && window.app.authReady === true,
    {},
    { timeout: 30000 }
  );
}

async function switchToTempExec(page) {
  await page.click('[data-group="cases"]');
  await page.click('[data-tab-btn="tempexec"]');
  await page.click('#openTempExecAssignDrawerBtn');
  await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
  await page.click('#closeTempExecAssignDrawerBtn');
  await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
}

test.describe('用例执行-归档确认抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
      try {
        localStorage.removeItem('usecase-active-tab');
        localStorage.removeItem('usecase-temp-exec-v1');
        localStorage.removeItem('tempexec-focus-v1');
      } catch (_) {}
    });
  });

  test('全部通过时归档弹出抽屉确认后才提交', async ({ page }) => {
    const user = { id: 1, username: 'ui_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const version = { id: 11, project_id: 1, name: 'v1' };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const execSet = { id: 1001, project_id: 1, version_id: 11, case_file_id: 101, case_count: 1, name: '用例A', status: 'active', created_at: iso(now - 1000), updated_at: iso(now - 900) };
    let archived = false;

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === '/api/projects/1/versions' && method === 'GET') return respond(200, [version]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const statusFilter = url.searchParams.get('status_filter') || '';
        if (statusFilter === 'archived') return respond(200, archived ? [Object.assign({}, execSet, { status: 'archived', archived_at: iso(now - 100) })] : []);
        return respond(200, archived ? [] : [execSet]);
      }

      const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (casesMatch && method === 'GET') {
        return respond(200, [
          {
            id: 10011,
            exec_set_id: execSet.id,
            case_item_id: null,
            module: '模块',
            title: '标题A',
            expected: '预期',
            priority: 'P1',
            precondition: '前提',
            steps: '步骤',
            actual_result: null,
            defect_link: null,
            reuse_details: null,
            defect_links: null,
            remark: null,
            status: '通过',
            order_no: 1,
            executor_id: user.id,
            created_at: execSet.created_at,
            updated_at: execSet.updated_at,
          },
        ]);
      }

      const archiveMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/archive$/);
      if (archiveMatch && method === 'POST') {
        archived = true;
        return respond(200, { ok: true });
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await switchToTempExec(page);
    await page.waitForFunction(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st) return false;
      const file = (st.tempExecFiles || []).find((f) => String(f && f.id) === '1001');
      return file && file._casesLoading === false;
    });

    const waitArchive = page.waitForResponse((res) =>
      res.url().includes('/api/exec/sets/1001/archive') && res.status() === 200
    );
    await page.click('#tempExecToolbar [data-temp-file-archive]');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('用例已全部执行通过');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);
    await waitArchive;
    expect(archived).toBe(true);
  });

  test('取消归档确认不会发送归档请求', async ({ page }) => {
    const user = { id: 2, username: 'ui_cancel', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const version = { id: 11, project_id: 1, name: 'v1' };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const execSet = { id: 1002, project_id: 1, version_id: 11, case_file_id: 102, case_count: 1, name: '用例B', status: 'active', created_at: iso(now - 2000), updated_at: iso(now - 1500) };
    let archiveCalls = 0;

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === '/api/projects/1/versions' && method === 'GET') return respond(200, [version]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const statusFilter = url.searchParams.get('status_filter') || '';
        if (statusFilter === 'archived') return respond(200, []);
        return respond(200, [execSet]);
      }

      const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (casesMatch && method === 'GET') {
        return respond(200, [
          {
            id: 10021,
            exec_set_id: execSet.id,
            case_item_id: null,
            module: '模块',
            title: '标题B',
            expected: '预期',
            priority: 'P1',
            precondition: '前提',
            steps: '步骤',
            actual_result: null,
            defect_link: null,
            reuse_details: null,
            defect_links: null,
            remark: null,
            status: '通过',
            order_no: 1,
            executor_id: user.id,
            created_at: execSet.created_at,
            updated_at: execSet.updated_at,
          },
        ]);
      }

      const archiveMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/archive$/);
      if (archiveMatch && method === 'POST') {
        archiveCalls += 1;
        return respond(200, { ok: true });
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await switchToTempExec(page);
    await page.waitForFunction(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st) return false;
      const file = (st.tempExecFiles || []).find((f) => String(f && f.id) === '1002');
      return file && file._casesLoading === false;
    });

    await page.click('#tempExecToolbar [data-temp-file-archive]');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.click('#appConfirmDrawerCancelBtn');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);

    await page.waitForTimeout(500);
    expect(archiveCalls).toBe(0);
  });
});
