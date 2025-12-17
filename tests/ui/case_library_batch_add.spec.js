const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
  while (Date.now() < deadline) {
    last = await page.evaluate(() => {
      let token = '';
      try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
      return {
        hasApp: Boolean(window.app),
        authReady: Boolean(window.app && window.app.authReady === true),
        caseLibraryBound: Boolean(window.app && window.app.caseLibraryBound === true),
        hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
        tabGroupBound: Boolean(window.app && window.app.tabGroupBound === true),
        token: token,
      };
    });
    if (last && last.hasApp && last.authReady && last.caseLibraryBound && last.hasSwitchTab && last.tabGroupBound) return;
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

async function openDrawer(page, buttonSelector, drawerSelector) {
  const btn = page.locator(buttonSelector);
  const drawer = page.locator(drawerSelector);
  const alreadyOpen = await drawer.evaluate((el) => Boolean(el && el.classList && el.classList.contains('open'))).catch(() => false);
  if (alreadyOpen) return;
  await btn.scrollIntoViewIfNeeded();
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      if (i < 2) {
        await btn.click(i === 0 ? {} : { force: true });
      } else {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el && typeof el.click === 'function') el.click();
        }, buttonSelector);
      }
      await page.waitForTimeout(80);
      await expect(drawer).toHaveClass(/open/, { timeout: 3000 });
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(200);
    }
  }
  throw lastErr || new Error('openDrawer failed: ' + drawerSelector);
}

test.describe('用例库编辑视图批量新增', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('批量新增支持数量校验、持久化、8 秒撤回与自动跳页', async ({ page }) => {
    const token = 'token-case-library-batch-add';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: 'for batch add' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const caseFileId = 100;
    const caseFiles = [
      {
        id: caseFileId,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例库A',
        reuse_enabled: false,
        item_count: 25,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
    ];

    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = Array.from({ length: 25 }).map((_, i) => ({
      id: 5000 + i + 1,
      case_file_id: caseFileId,
      module: '模块A',
      title: '用例' + (i + 1),
      priority: 'P1',
      precondition: '无',
      steps: '步骤' + (i + 1),
      expected: '预期' + (i + 1),
      remark: '',
      created_at: now,
      updated_at: now,
    }));

    let nextId = 9000;
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
        const fid = Number(itemsMatch[1]);
        return respond(200, (caseItemsByFileId[fid] || []).slice());
      }
      const createMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (createMatch && method === 'POST') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        createCalls += 1;
        const fid = Number(createMatch[1]);
        const payload = route.request().postDataJSON() || {};
        const created = {
          id: nextId++,
          case_file_id: fid,
          module: payload.module || '',
          title: payload.title || '',
          expected: payload.expected || '',
          priority: payload.priority || null,
          precondition: payload.precondition || '',
          steps: payload.steps || '',
          remark: payload.remark || null,
          created_at: now,
          updated_at: now,
        };
        caseItemsByFileId[fid] = (caseItemsByFileId[fid] || []).concat([created]);
        return respond(201, created);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditView')).toContainText('用例1');

    await expect(page.locator('#caseLibraryEditBatchAddCountInput')).toHaveValue('5');
    await page.fill('#caseLibraryEditBatchAddCountInput', '3');
    await page.locator('#caseLibraryEditBatchAddCountInput').blur();
    await page.reload();
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');
    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditBatchAddCountInput')).toHaveValue('3');

    await page.fill('#caseLibraryEditBatchAddCountInput', '');
    await page.click('#caseLibraryEditBatchAddBtn');
    await expect(page.locator('#caseLibraryEditBatchAddCountInput')).toHaveClass(/input-invalid/);

    await page.fill('#caseLibraryEditBatchAddCountInput', '5');
    await page.locator('#caseLibraryEditBatchAddCountInput').blur();
    await page.click('#caseLibraryEditBatchAddBtn');

    await expect(page.locator('#caseLibraryEditView [data-case-lib-pagination]').first()).toContainText('第 2 /');
    await expect(page.locator('#caseLibraryEditView tr.case-row.new-added')).toHaveCount(5);
    await expect(page.locator('.temp-undo-toast')).toContainText('已新增用例 5 条');

    await page.click('.temp-undo-toast button', { force: true });
    await expect(page.locator('.temp-undo-toast')).toHaveCount(0);
    await expect(page.locator('#caseLibraryEditView tr.case-row.new-added')).toHaveCount(0);
    expect(createCalls).toBe(0);

    await page.click('#caseLibraryEditBatchAddBtn');
    await page.waitForTimeout(8500);
    expect(createCalls).toBe(5);
    await expect(page.locator('#caseLibraryEditStatus')).toContainText('批量新增已入库');
  });

  test('刷新后：完整用例且模块已存在时归位到对应模块末尾', async ({ page }) => {
    const token = 'token-case-library-batch-add-reorder';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: 'for reorder' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const caseFileId = 100;
    const caseFiles = [
      {
        id: caseFileId,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例库A',
        reuse_enabled: false,
        item_count: 3,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
    ];
    const items = [
      { id: 1, case_file_id: caseFileId, module: '模块A', title: 'A1', priority: 'P1', precondition: '无', steps: '步骤', expected: '成功', remark: '', created_at: now, updated_at: now },
      { id: 2, case_file_id: caseFileId, module: '模块B', title: 'B1', priority: 'P1', precondition: '无', steps: '步骤', expected: '成功', remark: '', created_at: now, updated_at: now },
      { id: 3, case_file_id: caseFileId, module: '模块A', title: 'A2', priority: 'P1', precondition: '无', steps: '步骤', expected: '成功', remark: '', created_at: now, updated_at: now },
    ];

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
        return respond(200, items.slice());
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');
    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);

    const modules = await page.locator('#caseLibraryEditView tr.case-row [data-case-lib-edit-field="module"]').allInnerTexts();
    expect(modules.slice(0, 3)).toEqual(['模块A', '模块A', '模块B']);
  });
});
