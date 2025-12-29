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

test.describe('用例库编辑输入焦点稳定性', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('编辑时切换输入不应丢失焦点', async ({ page }) => {
    const token = 'token-case-library-edit-focus';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: 'for edit focus' };
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

      const patchMatch = pathName.match(/^\/api\/case-files\/items\/(\d+)$/);
      if (patchMatch && method === 'PATCH') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const id = Number(patchMatch[1]);
        const body = route.request().postDataJSON() || {};
        const list = caseItemsByFileId[caseFileId] || [];
        const item = list.find((entry) => entry.id === id);
        if (item) {
          if (Object.prototype.hasOwnProperty.call(body, 'module')) item.module = body.module;
          if (Object.prototype.hasOwnProperty.call(body, 'title')) item.title = body.title;
          if (Object.prototype.hasOwnProperty.call(body, 'priority')) item.priority = body.priority;
          if (Object.prototype.hasOwnProperty.call(body, 'precondition')) item.precondition = body.precondition;
          if (Object.prototype.hasOwnProperty.call(body, 'steps')) item.steps = body.steps;
          if (Object.prototype.hasOwnProperty.call(body, 'expected')) item.expected = body.expected;
          item.updated_at = new Date().toISOString();
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
        return respond(200, item || { id });
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

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('case-library');
    });
    await expect(page.locator('#caseLibraryHead')).toBeVisible();

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录');

    const moduleCell = page.locator('#caseLibraryEditView [data-case-lib-edit-field="module"][data-index="0"]');
    const titleCell = page.locator('#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="0"]');

    await moduleCell.click();
    await moduleCell.fill('模块A-更新');
    const patchWait = page.waitForResponse((res) => {
      return res.url().includes('/api/case-files/items/') && res.request().method() === 'PATCH';
    });
    await titleCell.click();
    await patchWait;

    const activeKey = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !el.getAttribute) return '';
      const field = el.getAttribute('data-case-lib-edit-field');
      const idx = el.getAttribute('data-index');
      return field ? `${field}:${idx}` : '';
    });
    expect(activeKey).toBe('title:0');
  });
});
