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
        hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
        tab: window.app && window.app.state ? window.app.state.activeTab : '',
        token: token,
      };
    });
    if (last && last.hasApp && last.authReady && last.hasSwitchTab) return;
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

test.describe('用例库编辑视图批量删除', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('勾选后可批量删除，并支持 8 秒内撤回', async ({ page }) => {
    const token = 'token-case-library-batch-delete';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: 'for batch delete' };
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
        id: 5001,
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
        id: 5002,
        case_file_id: caseFileId,
        module: '模块A',
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
    await waitAppReady(page, 30000);

    await switchToTab(page, 'case-library');
    await expect(page.locator('#caseLibraryHead')).toBeVisible();

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录');

    await expect(page.locator('#caseLibraryEditBatchDeleteBtn')).toBeDisabled();

    await page.click('#caseLibraryEditView input[data-case-lib-select][data-index="0"]');
    await page.click('#caseLibraryEditView input[data-case-lib-select][data-index="1"]');
    await expect(page.locator('#caseLibraryEditBatchDeleteBtn')).toBeEnabled();
    await expect(page.locator('#caseLibraryEditBatchDeleteBtn')).toContainText('（2）');

    await page.click('#caseLibraryEditBatchDeleteBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await page.waitForFunction(() => {
      const el = document.getElementById('appConfirmDrawer');
      return !el || (!el.classList.contains('open') && !el.classList.contains('closing'));
    });
    const toast = page.locator('.temp-undo-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('已删除用例 2 条');
    await page.click('.temp-undo-toast button', { force: true });
    await expect(page.locator('.temp-undo-toast')).toHaveCount(0);
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录');
    await expect(page.locator('#caseLibraryEditView')).toContainText('异常登录');
    expect(deleteCalls).toBe(0);

    await page.click('#caseLibraryEditView input[data-case-lib-select][data-index="0"]');
    await page.click('#caseLibraryEditView input[data-case-lib-select][data-index="1"]');
    await page.click('#caseLibraryEditBatchDeleteBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await page.waitForFunction(() => {
      const el = document.getElementById('appConfirmDrawer');
      return !el || (!el.classList.contains('open') && !el.classList.contains('closing'));
    });
    await expect(page.locator('#caseLibraryEditView')).not.toContainText('正常登录');
    await expect(page.locator('#caseLibraryEditView')).not.toContainText('异常登录');

    await page.waitForTimeout(8500);
    expect(deleteCalls).toBe(2);
    await expect(page.locator('#caseLibraryEditStatus')).toContainText('批量删除已入库');
    await expect(page.locator('#caseLibraryEditBatchAddBtn')).toBeEnabled();
  });
});
