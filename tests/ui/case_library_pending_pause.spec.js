const { test, expect } = require('@playwright/test');
const { clickSemantic, focusSemantic } = require('./helpers/vtable_semantic');

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

async function waitCaseLibraryReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  await page.waitForFunction(() => {
    return window.app && window.app._inited === true && window.app.authReady === true &&
      window.app.caseLibraryBound === true &&
      window.app.tabGroupBound === true && typeof window.app.switchTab === 'function';
  }, null, { timeout });
}

async function openCaseLibrary(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  await waitAppReady(page, timeout);
  await Promise.all([
    page.waitForURL(/\/case-library\.html(?:[?#].*)?$/, { timeout }),
    page.evaluate(() => {
      window.app.switchTab('case-library');
    }),
  ]);
  await waitCaseLibraryReady(page, timeout);
  await expect(page.locator('#caseLibraryHead')).toBeVisible();
}

test.describe('用例库撤回计时编辑不中断', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('编辑中撤回倒计时继续入库且不中断输入', async ({ page }) => {
    const token = 'token-case-library-pending';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: 'for pending pause' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const caseFileId = 101;
    const caseFiles = [
      {
        id: caseFileId,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例库B',
        reuse_enabled: false,
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
    ];

    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = [
      {
        id: 5101,
        case_file_id: caseFileId,
        module: '模块A',
        title: '正常登录',
        priority: 'P0',
        precondition: '',
        steps: '步骤1',
        expected: '成功',
        remark: '',
        created_at: now,
        updated_at: now,
      },
    ];

    let createCalls = 0;
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const tokenHeader = route.request().headers().authorization || '';
      const authed = tokenHeader === `Bearer ${token}`;
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, user);
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
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/case-files' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        return respond(200, caseFiles.slice());
      }

      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const id = Number(itemsMatch[1]);
        return respond(200, (caseItemsByFileId[id] || []).slice());
      }

      const createMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (createMatch && method === 'POST') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        createCalls += 1;
        const body = route.request().postDataJSON() || {};
        const created = {
          id: 9000 + createCalls,
          case_file_id: caseFileId,
          module: body.module || '',
          title: body.title || '',
          priority: body.priority || '',
          precondition: body.precondition || '',
          steps: body.steps || '',
          expected: body.expected || '',
          remark: body.remark || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        caseItemsByFileId[caseFileId].push(created);
        return respond(200, created);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await openCaseLibrary(page, 30000);

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await clickSemantic(page, `#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录');

    await clickSemantic(page, '#caseLibraryEditView button[data-case-lib-insert][data-index="0"]');
    const titleCell = page.locator('#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="1"]');
    await expect(titleCell).toHaveCount(1);
    await focusSemantic(page, '#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="1"]');

    await page.waitForTimeout(8500);
    expect(createCalls).toBe(1);

    const activeKey = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !el.getAttribute) return '';
      const field = el.getAttribute('data-case-lib-edit-field');
      const idx = el.getAttribute('data-index');
      return field ? `${field}:${idx}` : '';
    });
    expect(activeKey).toBe('title:1');
    expect(createCalls).toBe(1);
  });

  test('删除用例撤回计时不因编辑暂停', async ({ page }) => {
    const token = 'token-case-library-pending-delete';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: 'for pending delete' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const caseFileId = 101;
    const caseFiles = [
      {
        id: caseFileId,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例库B',
        reuse_enabled: false,
        item_count: 2,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
    ];

    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = [
      {
        id: 5101,
        case_file_id: caseFileId,
        module: '模块A',
        title: '正常登录',
        priority: 'P0',
        precondition: '',
        steps: '步骤1',
        expected: '成功',
        remark: '',
        created_at: now,
        updated_at: now,
      },
      {
        id: 5102,
        case_file_id: caseFileId,
        module: '模块B',
        title: '异常登录',
        priority: 'P1',
        precondition: '',
        steps: '步骤2',
        expected: '失败',
        remark: '',
        created_at: now,
        updated_at: now,
      },
    ];

    let deleteCalls = 0;
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const tokenHeader = route.request().headers().authorization || '';
      const authed = tokenHeader === `Bearer ${token}`;
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, user);
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
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/case-files' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        return respond(200, caseFiles.slice());
      }

      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const id = Number(itemsMatch[1]);
        return respond(200, (caseItemsByFileId[id] || []).slice());
      }

      const delMatch = pathName.match(/^\/api\/case-files\/items\/(\d+)$/);
      if (delMatch && method === 'DELETE') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        deleteCalls += 1;
        return respond(200, { detail: 'deleted', case_item_id: Number(delMatch[1]) });
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await openCaseLibrary(page, 30000);

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await clickSemantic(page, `#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录');

    await clickSemantic(page, '#caseLibraryEditView button[data-case-lib-remove][data-index="0"]');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');

    const titleCell = page.locator('#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="0"]');
    await expect(titleCell).toHaveCount(1);
    await focusSemantic(page, '#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="0"]');
    await page.waitForTimeout(8500);
    expect(deleteCalls).toBe(1);
  });
});
