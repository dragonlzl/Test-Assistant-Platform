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

test.describe('用例相关视图窄屏适配', () => {
  test('执行视图窄屏工具栏与表格适配', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    page.__promptAnswers = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'token-narrow-tempexec'); } catch (_) {}
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (pathName === '/api/users/me' && method === 'GET') {
        return respond(200, { id: 0, username: 'ui_admin', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
    });
    page.on('dialog', async (dialog) => {
      const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : '窄屏用例';
      await dialog.accept(answer);
    });

    await gotoIndex(page);
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
    await page.evaluate(() => {
      var keys = ['usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'];
      keys.forEach(function(key) {
        window.localStorage.removeItem(key);
      });
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });

    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '窄屏用例';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'narrow.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '下单支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('窄屏用例');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/open/);
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await navButtons.first().click({ force: true });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#tempExecToolbar .toolbar-actions')).toBeVisible({ timeout: 20000 });

    const layout = await page.evaluate(() => {
      function rect(el) {
        if (!el) return null;
        var box = el.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y) };
      }
      return {
        search: rect(document.querySelector('#tempExecToolbar .toolbar-actions .toolbar-search')),
        middle: rect(document.querySelector('#tempExecToolbar .toolbar-actions .toolbar-middle')),
        exportBlock: rect(document.querySelector('#tempExecToolbar .toolbar-actions .toolbar-export')),
        pillsOverflow: (function() {
          var el = document.querySelector('#tempExecToolbar .toolbar-pills');
          if (!el || !window.getComputedStyle) return '';
          return window.getComputedStyle(el).overflowX;
        })(),
      };
    });
    expect(layout.search).toBeTruthy();
    expect(layout.middle).toBeTruthy();
    expect(layout.exportBlock).toBeTruthy();
    expect(layout.search.y).toBeLessThan(layout.middle.y);
    expect(layout.middle.y).toBeLessThan(layout.exportBlock.y);
    expect(Math.abs(layout.search.x - layout.middle.x)).toBeLessThan(12);
    expect(layout.pillsOverflow).toBe('auto');

    const viewSize = await page.evaluate(() => {
      var el = document.getElementById('tempExecView');
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(viewSize.scrollWidth).toBeGreaterThan(viewSize.clientWidth);

    await page.setViewportSize({ width: 1000, height: 900 });
    await page.waitForTimeout(200);
    const midSize = await page.evaluate(() => {
      var el = document.getElementById('tempExecView');
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(midSize.scrollWidth).toBeGreaterThan(midSize.clientWidth);
  });

  test('用例库编辑视图窄屏工具栏与信息区适配', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    const token = 'token-narrow-case-library';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: 'for narrow view' };
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
    ];

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);
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

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');
    await expect(page.locator('#caseLibraryHead')).toBeVisible();

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录');
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditCard .case-library-drawer-toolbar')).toBeVisible();

    const layout = await page.evaluate(() => {
      function rect(el) {
        if (!el) return null;
        var box = el.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y) };
      }
      var toolbar = document.querySelector('#caseLibraryEditCard .case-library-drawer-toolbar');
      return {
        toolbarExists: Boolean(toolbar),
        search: rect(document.querySelector('#caseLibraryEditCard .case-library-search')),
        actions: rect(document.querySelector('#caseLibraryEditCard .case-library-drawer-actions')),
      };
    });
    expect(layout.toolbarExists).toBe(true);
    expect(layout.search).toBeTruthy();
    expect(layout.actions).toBeTruthy();
    expect(layout.search.y).toBeLessThan(layout.actions.y);
    const viewSize = await page.evaluate(() => {
      var el = document.getElementById('caseLibraryEditView');
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(viewSize.scrollWidth).toBeGreaterThan(viewSize.clientWidth);
  });
});
