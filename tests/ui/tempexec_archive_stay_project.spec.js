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
}

async function openTempExecOverview(page) {
  await page.evaluate(() => {
    if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
      window.app.drawer.closeAllDrawers();
    }
    try {
      window.dispatchEvent(new CustomEvent('app-path-sub-jump', { detail: { tab: 'tempexec', sub: '归档操作&进度预览' } }));
    } catch (err) {
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('app-path-sub-jump', false, false, { tab: 'tempexec', sub: '归档操作&进度预览' });
      window.dispatchEvent(evt);
    }
  });
  await expect(page.locator('#tempExecOverviewDrawer')).toHaveClass(/open/);
}

test.describe('用例执行-归档后不自动切换项目', () => {
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
    page.on('dialog', async (dialog) => dialog.accept());
  });

  test('当前项目全部归档后，执行视图不自动跳到其他项目，并显示项目/版本提示', async ({ page }) => {
    const user = { id: 1, username: 'ui_user', role: 'user', level: 'member' };
    const projects = [
      { id: 1, name: '项目A', description: '' },
      { id: 2, name: '项目B', description: '' },
    ];
    const versionsByProject = {
      1: [{ id: 11, project_id: 1, name: 'v1' }],
      2: [{ id: 21, project_id: 2, name: 'v2' }],
    };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    // 注意：tempexec DB 模式下会根据 created_at 做默认排序；确保 A 比 B 新，才能稳定成为默认激活项。
    const setA = { id: 1001, project_id: 1, version_id: 11, case_file_id: 101, case_count: 1, name: '用例A', status: 'active', created_at: iso(now - 1000), updated_at: iso(now - 900) };
    const setB = { id: 2001, project_id: 2, version_id: 21, case_file_id: 201, case_count: 1, name: '用例B', status: 'active', created_at: iso(now - 20000), updated_at: iso(now - 800) };
    let archived = false;
    const casesBySetId = {
      1001: [
        {
          id: 10011,
          exec_set_id: 1001,
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
          created_at: setA.created_at,
          updated_at: setA.updated_at,
        },
      ],
      2001: [
        {
          id: 20011,
          exec_set_id: 2001,
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
          status: '未执行',
          order_no: 1,
          executor_id: user.id,
          created_at: setB.created_at,
          updated_at: setB.updated_at,
        },
      ],
    };

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      const verMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (verMatch && method === 'GET') {
        const pid = Number(verMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const statusFilter = url.searchParams.get('status_filter') || '';
        if (statusFilter === 'archived') {
          if (!archived) return respond(200, []);
          return respond(200, [
            Object.assign({}, setA, { status: 'archived', archived_at: iso(now - 100) }),
          ]);
        }
        return respond(200, archived ? [setB] : [setA, setB]);
      }

      const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (casesMatch && method === 'GET') {
        const execSetId = Number(casesMatch[1]);
        return respond(200, casesBySetId[execSetId] || []);
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

    await expect(page.locator('#tempVersionGrid .temp-req-row[data-temp-file="1001"]')).toBeVisible();
    await page.click('#tempVersionGrid .temp-req-row[data-temp-file="1001"]');
    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 8000 }
    ).toBe('1001');

    await page.waitForFunction(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st) return false;
      const file = (st.tempExecFiles || []).find((f) => String(f && f.id) === '1001');
      return file && file._casesLoading === false;
    });

    await openTempExecOverview(page);
    await page.click('[data-temp-overview-archive="1001"]');

    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 8000 }
    ).toBe('');

    await expect(page.locator('#tempExecView .temp-exec-context')).toContainText('项目 项目A');
    await expect(page.locator('#tempExecView .temp-exec-context')).toContainText('版本 v1');
    await expect(page.locator('#tempExecView')).toContainText('暂无执行用例');
    await expect(page.locator('#tempExecView')).not.toContainText('标题B');
  });

  test('归档后自动移除专注区用例', async ({ page }) => {
    const user = { id: 3, username: 'ui_focus', role: 'user', level: 'member' };
    const projects = [{ id: 1, name: '项目A', description: '' }];
    const versionsByProject = { 1: [{ id: 11, project_id: 1, name: 'v1' }] };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const setA = { id: 1001, project_id: 1, version_id: 11, case_file_id: 101, case_count: 1, name: '用例A', status: 'active', created_at: iso(now - 1000), updated_at: iso(now - 900) };
    let archived = false;
    const casesBySetId = {
      1001: [
        {
          id: 10011,
          exec_set_id: 1001,
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
          created_at: setA.created_at,
          updated_at: setA.updated_at,
        },
      ],
    };

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      const verMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (verMatch && method === 'GET') {
        const pid = Number(verMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const statusFilter = url.searchParams.get('status_filter') || '';
        if (statusFilter === 'archived') {
          if (!archived) return respond(200, []);
          return respond(200, [Object.assign({}, setA, { status: 'archived', archived_at: iso(now - 100) })]);
        }
        return respond(200, archived ? [] : [setA]);
      }

      const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (casesMatch && method === 'GET') {
        const execSetId = Number(casesMatch[1]);
        return respond(200, casesBySetId[execSetId] || []);
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

    await expect(page.locator('#tempVersionGrid .temp-req-row[data-temp-file="1001"]')).toBeVisible();
    await page.click('#tempVersionGrid .temp-req-row[data-temp-file="1001"]');
    await page.waitForFunction(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st) return false;
      const file = (st.tempExecFiles || []).find((f) => String(f && f.id) === '1001');
      return file && file._casesLoading === false;
    });

    await page.evaluate(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      if (!st || !api) return;
      st.tempExecFocus = ['1001'];
      if (typeof api.renderTempFocusZone === 'function') api.renderTempFocusZone();
    });

    await expect(page.locator('#tempFocusBlock button[data-temp-file="1001"]')).toHaveCount(1);
    await expect(page.locator('#tempExecViewFocusBlock button[data-temp-file="1001"]')).toHaveCount(1);

    await openTempExecOverview(page);
    const waitArchive = page.waitForResponse((res) =>
      res.url().includes('/api/exec/sets/1001/archive') && res.status() === 200
    );
    await page.click('[data-temp-overview-archive="1001"]');
    await waitArchive;
    await expect(page.locator('#tempFocusBlock button[data-temp-file]')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('#tempExecViewFocusBlock button[data-temp-file]')).toHaveCount(0, { timeout: 10000 });
  });

  test('执行视图上一份/下一份循环切换，归档后自动切到下一份', async ({ page }) => {
    const user = { id: 2, username: 'ui_member', role: 'user', level: 'member' };
    const projects = [{ id: 1, name: '项目A', description: '' }];
    const versionsByProject = { 1: [{ id: 11, project_id: 1, name: 'v1' }] };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const setA = { id: 1101, project_id: 1, version_id: 11, case_file_id: 301, case_count: 1, name: '用例A', status: 'active', created_at: iso(now - 3000), updated_at: iso(now - 100) };
    const setB = { id: 1102, project_id: 1, version_id: 11, case_file_id: 302, case_count: 1, name: '用例B', status: 'active', created_at: iso(now - 2000), updated_at: iso(now - 200) };
    const casesBySetId = {
      1101: [
        {
          id: 11011,
          exec_set_id: 1101,
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
          created_at: setA.created_at,
          updated_at: setA.updated_at,
        },
      ],
      1102: [
        {
          id: 11021,
          exec_set_id: 1102,
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
          created_at: setB.created_at,
          updated_at: setB.updated_at,
        },
      ],
    };
    let archived = false;

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      if (pathName === '/api/projects/1/versions' && method === 'GET') return respond(200, versionsByProject[1]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const statusFilter = url.searchParams.get('status_filter') || '';
        if (statusFilter === 'archived') {
          if (!archived) return respond(200, []);
          return respond(200, [
            Object.assign({}, setA, { status: 'archived', archived_at: iso(now - 50) }),
          ]);
        }
        return respond(200, archived ? [setB] : [setA, setB]);
      }
      const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (casesMatch && method === 'GET') {
        const execSetId = Number(casesMatch[1]);
        return respond(200, casesBySetId[execSetId] || []);
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
    await page.click('#closeTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);

    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 8000 }
    ).toBe('1101');
    await expect(page.locator('#tempExecToolbar')).toContainText('用例A');
    await expect(page.locator('#tempExecToolbar [data-temp-file-nav="next"]')).toBeEnabled();

    await page.click('#tempExecToolbar [data-temp-file-nav="next"]');
    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 8000 }
    ).toBe('1102');
    await expect(page.locator('#tempExecToolbar')).toContainText('用例B');

    await page.click('#tempExecToolbar [data-temp-file-nav="prev"]');
    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 8000 }
    ).toBe('1101');
    await expect(page.locator('#tempExecToolbar')).toContainText('用例A');

    await page.waitForFunction(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st) return false;
      const file = (st.tempExecFiles || []).find((f) => String(f && f.id) === '1101');
      return file && file._casesLoading === false;
    });
    await page.click('#tempExecToolbar [data-temp-file-archive]');
    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 8000 }
    ).toBe('1102');
    await expect(page.locator('#tempExecToolbar')).toContainText('用例B');
  });

  test('点击已归档“归”字标识：关闭总览抽屉并打开导入&分配抽屉', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, { id: 1, username: 'ui_user', role: 'user', level: 'member' });
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [{ id: 1, name: '项目A', description: '' }]);
      if (pathName === '/api/projects/1/versions' && method === 'GET') return respond(200, [{ id: 11, project_id: 1, name: 'v1' }]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      const now = Date.now();
      const iso = (ms) => new Date(ms).toISOString();
      if (pathName === '/api/exec/sets' && method === 'GET') {
        const statusFilter = url.searchParams.get('status_filter') || '';
        if (statusFilter === 'archived') {
          return respond(200, [
            { id: 3001, project_id: 1, version_id: 11, case_file_id: 101, case_count: 1, name: '归档用例A', status: 'archived', created_at: iso(now - 5000), updated_at: iso(now - 3000), archived_at: iso(now - 1000) },
          ]);
        }
        return respond(200, []);
      }
      const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (casesMatch && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await switchToTempExec(page);
    await openTempExecOverview(page);

    const archivedChip = page.locator('.exec-overview-file-chip[data-temp-archived="1"] .tag-archived').first();
    await expect(archivedChip).toBeVisible();
    await archivedChip.click();

    await expect(page.locator('#tempExecOverviewDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
  });
});
