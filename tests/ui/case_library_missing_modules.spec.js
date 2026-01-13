const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/case-library.html');
}

async function reloadWithRetry(page) {
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.reload();
      return;
    } catch (err) {
      lastErr = err;
      const msg = err && err.message ? String(err.message) : String(err || '');
      const canRetry = msg.indexOf('ERR_EMPTY_RESPONSE') !== -1 || msg.indexOf('net::ERR_EMPTY_RESPONSE') !== -1;
      if (!canRetry || i === 2) throw err;
      await page.waitForTimeout(300);
    }
  }
  throw lastErr || new Error('page.reload failed');
}

async function waitCaseLibraryReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
  let retriedToken = false;
  let retriedReload = false;
  let retriedCaseLibrary = false;
  let retriedTabGroup = false;

  while (Date.now() < deadline) {
    try {
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
    } catch (err) {
      const msg = err && err.message ? String(err.message) : String(err || '');
      if (msg.indexOf('Execution context was destroyed') !== -1) {
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        continue;
      }
      throw err;
    }

    if (last && last.hasApp && last.authReady && last.caseLibraryBound && last.hasSwitchTab && last.tabGroupBound) return;

    if (!retriedToken && last && last.hasApp && !last.authReady && !last.token) {
      retriedToken = true;
      await page.evaluate(() => {
        try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
      });
      await reloadWithRetry(page);
      await page.waitForTimeout(100);
      continue;
    }
    if (!retriedReload && last && last.hasApp && !last.hasSwitchTab) {
      retriedReload = true;
      await reloadWithRetry(page);
      await page.waitForTimeout(200);
      continue;
    }
    if (!retriedCaseLibrary && last && last.hasApp && last.authReady && last.hasSwitchTab && !last.caseLibraryBound) {
      retriedCaseLibrary = true;
      await reloadWithRetry(page);
      await page.waitForTimeout(200);
      continue;
    }
    if (!retriedTabGroup && last && last.hasApp && last.authReady && last.caseLibraryBound && last.hasSwitchTab && !last.tabGroupBound) {
      retriedTabGroup = true;
      await reloadWithRetry(page);
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
  }
  throw new Error('waitCaseLibraryReady timeout: ' + JSON.stringify(last || {}));
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

test.describe('用例库易漏模块抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('新增模块后可查看易漏条目列表', async ({ page }) => {
    const token = 'token-case-library-missing';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '易漏项目', description: 'for missing modules' };
    const modules = [];
    let moduleAutoId = 100;

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
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, []);

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

      if (pathName === '/api/missing-modules' && method === 'GET') {
        return respond(200, modules.slice());
      }
      if (pathName === '/api/missing-modules' && method === 'POST') {
        const payload = route.request().postDataJSON();
        const name = payload && payload.name ? payload.name : '';
        const created = {
          id: moduleAutoId++,
          project_id: payload.project_id,
          name: name,
          item_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        modules.push(created);
        return respond(201, created);
      }
      if (pathName.startsWith('/api/missing-modules/') && method === 'PATCH') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 1]);
        const payload = route.request().postDataJSON();
        const nextName = payload && payload.name ? String(payload.name) : '';
        const target = modules.find((m) => String(m.id) === String(moduleId));
        if (!target) return respond(404, { detail: 'not found' });
        const dup = modules.find((m) => String(m.id) !== String(moduleId) && m.name === nextName);
        if (dup) return respond(409, { detail: 'missing_module_duplicate' });
        target.name = nextName;
        target.updated_at = new Date().toISOString();
        return respond(200, target);
      }
      if (pathName.startsWith('/api/missing-modules/') && method === 'DELETE') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 1]);
        const idx = modules.findIndex((m) => String(m.id) === String(moduleId));
        if (idx === -1) return respond(404, { detail: 'not found' });
        modules.splice(idx, 1);
        return respond(200, { detail: 'deleted' });
      }
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
        return respond(200, []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page);

    await openDrawer(page, '#openCaseLibraryMissingDrawerBtn', '#caseLibraryMissingDrawer');
    await page.locator('#caseLibraryMissingProjectSelect').selectOption(String(project.id));

    await page.locator('#caseLibraryMissingAddModuleBtn').click();
    await page.locator('#caseLibraryMissingModuleNameInput').fill('工程师1技能');
    await page.locator('#caseLibraryMissingAddConfirmBtn').click();

    await expect(page.locator('.temp-center-toast')).toContainText('添加成功');
    await expect(page.locator('#caseLibraryMissingListBody')).toContainText('工程师1技能');

    await page.locator('#caseLibraryMissingAddModuleBtn').click();
    await page.locator('#caseLibraryMissingModuleNameInput').fill('工程师');
    await page.locator('#caseLibraryMissingAddConfirmBtn').click();
    await expect(page.locator('.temp-center-toast')).toContainText('添加成功');

    const firstRow = page.locator('#caseLibraryMissingListBody tr').first();
    await firstRow.locator('button', { hasText: '编辑' }).click();
    await page.locator('#caseLibraryMissingEditModuleNameInput').fill('工程师');
    await page.locator('#caseLibraryMissingEditConfirmBtn').click();
    await expect(page.locator('.temp-center-toast')).toContainText('已有同名模块');

    await page.locator('#caseLibraryMissingEditModuleNameInput').fill('工程师1技能-更新');
    await page.locator('#caseLibraryMissingEditConfirmBtn').click();
    await expect(page.locator('.temp-center-toast')).toContainText('修改成功');
    await expect(page.locator('#caseLibraryMissingListBody')).toContainText('工程师1技能-更新');

    const secondRowCheck = page.locator('#caseLibraryMissingListBody tr').nth(1).locator('input[type=\"checkbox\"]');
    await secondRowCheck.check();
    await page.locator('#caseLibraryMissingDeleteBtn').click();
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.locator('#appConfirmDrawerConfirmBtn').click();
    await expect(page.locator('#caseLibraryMissingListBody td.module', { hasText: /^工程师$/ })).toHaveCount(0);

    await page.locator('#caseLibraryMissingListBody button[data-case-lib-missing-view]').first().click();
    await expect(page.locator('#caseLibraryMissingCard')).toBeVisible();
    await expect(page.locator('#caseLibraryMissingModules')).toContainText('工程师1技能-更新');

    const emptyAdd = page.locator('#caseLibraryMissingView [data-case-lib-missing-empty-add]');
    await expect(emptyAdd).toBeVisible();
    await emptyAdd.click();
    await expect(page.locator('#caseLibraryMissingView tr.case-row.new-added')).toHaveCount(1);
    await page.locator('.temp-undo-toast button').click();

    await page.reload();
    await waitCaseLibraryReady(page);
    await expect(page.locator('#caseLibraryMissingCard')).toBeVisible();
    await expect(page.locator('#caseLibraryMissingModules')).toContainText('工程师1技能-更新');
  });

  test('易漏用例优先级输入自动大写', async ({ page }) => {
    const token = 'token-case-library-missing-priority';
    const user = { id: 11, username: 'priority_admin', role: 'admin', level: 'leader' };
    const project = { id: 2, name: '优先级项目', description: 'priority missing case' };
    const modules = [
      {
        id: 21,
        project_id: project.id,
        name: '云存档',
        item_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const items = [
      {
        id: 301,
        module_id: 21,
        module_name: '云存档',
        type_id: null,
        type_name: null,
        title: '易漏条目',
        priority: 'p1',
        precondition: '',
        steps: '点击保存',
        expected: '提示异常',
        remark: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    let updateCalls = 0;
    let lastUpdatePayload = null;

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
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/missing-modules' && method === 'GET') {
        return respond(200, modules.slice());
      }
      if (pathName === `/api/missing-modules/${modules[0].id}/items` && method === 'GET') {
        return respond(200, items.slice());
      }
      if (pathName.startsWith('/api/missing-modules/items/') && method === 'PATCH') {
        updateCalls += 1;
        const payload = route.request().postDataJSON();
        lastUpdatePayload = payload;
        items[0] = Object.assign({}, items[0], payload, {
          priority: payload.priority || null,
          updated_at: new Date().toISOString(),
        });
        return respond(200, items[0]);
      }
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page);

    await openDrawer(page, '#openCaseLibraryMissingDrawerBtn', '#caseLibraryMissingDrawer');
    await page.locator('#caseLibraryMissingProjectSelect').selectOption(String(project.id));

    await page.locator('#caseLibraryMissingListBody button[data-case-lib-missing-view]').first().click();
    await expect(page.locator('#caseLibraryMissingCard')).toBeVisible();

    const priorityCell = page.locator('#caseLibraryMissingView [data-case-lib-missing-field="priority"][data-index="0"]');
    await expect(priorityCell).toHaveText('P1');

    await priorityCell.evaluate((el) => {
      el.focus();
      el.textContent = 'p2';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(priorityCell).toHaveText('P2');
    await page.click('#caseLibraryMissingStatus', { force: true });

    await expect.poll(() => updateCalls).toBeGreaterThan(0);
    expect(lastUpdatePayload && lastUpdatePayload.priority).toBe('P2');
  });
});
