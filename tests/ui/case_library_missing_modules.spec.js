const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

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

async function buildXlsxBuffer(page, rows, sheetName) {
  const payload = { rows, sheetName: sheetName || '易漏用例' };
  const bytes = await page.evaluate(async (opts) => {
    const api = window.app && window.app.caseLibraryApi ? window.app.caseLibraryApi : null;
    if (!api || typeof api.buildSimpleXlsxBlob !== 'function') return [];
    const blob = await api.buildSimpleXlsxBlob({
      sheets: [{ name: opts.sheetName || '易漏用例', rows: opts.rows || [] }],
    });
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, payload);
  return Buffer.from(bytes);
}

function buildXmindBufferFromFixture(fixtureName) {
  const b64Path = path.join(__dirname, '..', 'fixtures', fixtureName);
  const b64 = fs.readFileSync(b64Path, 'utf-8').trim().replace(/\s+/g, '');
  return Buffer.from(b64, 'base64');
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

  test('模块列表显示填写完成标记', async ({ page }) => {
    const token = 'token-case-library-missing-complete';
    const user = { id: 10, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 2, name: '易漏项目-完成', description: 'for missing module completion' };
    const types = [{ id: 1, project_id: project.id, name: '功能', item_count: 2 }];
    const modules = [
      { id: 201, project_id: project.id, name: '模块A', item_count: 2 },
      { id: 202, project_id: project.id, name: '模块B', item_count: 0 },
      { id: 203, project_id: project.id, name: '模块C', item_count: 1 },
    ];
    const itemsByModule = {
      201: [
        {
          id: 9001,
          module_id: 201,
          module_name: '模块A',
          title: '易漏条目A1',
          priority: 'P1',
          precondition: '前置A1',
          steps: '步骤A1',
          expected: '期望A1',
          remark: '',
          type_id: 1,
          type_name: '功能',
          type_ids: [1],
          type_names: ['功能'],
        },
        {
          id: 9002,
          module_id: 201,
          module_name: '模块A',
          title: '易漏条目A2',
          priority: 'P2',
          precondition: '前置A2',
          steps: '步骤A2',
          expected: '期望A2',
          remark: '',
          type_id: 1,
          type_name: '功能',
          type_ids: [1],
          type_names: ['功能'],
        },
      ],
      203: [
        {
          id: 9003,
          module_id: 203,
          module_name: '模块C',
          title: '易漏条目C1',
          priority: '',
          precondition: '前置C1',
          steps: '步骤C1',
          expected: '期望C1',
          remark: '',
          type_id: null,
          type_name: null,
          type_ids: [],
          type_names: [],
        },
      ],
    };

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

      if (pathName === '/api/missing-types' && method === 'GET') {
        return respond(200, types.slice());
      }
      if (pathName === '/api/missing-modules' && method === 'GET') {
        return respond(200, modules.slice());
      }
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 2]);
        return respond(200, itemsByModule[moduleId] || []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page);

    await openDrawer(page, '#openCaseLibraryMissingDrawerBtn', '#caseLibraryMissingDrawer');
    await page.locator('#caseLibraryMissingProjectSelect').selectOption(String(project.id));

    await expect(page.locator('#caseLibraryMissingListBody tr')).toHaveCount(3);
    const moduleA = page.locator('#caseLibraryMissingListBody td.module', { hasText: '模块A' });
    const moduleB = page.locator('#caseLibraryMissingListBody td.module', { hasText: '模块B' });
    const moduleC = page.locator('#caseLibraryMissingListBody td.module', { hasText: '模块C' });

    await expect(moduleA).toHaveClass(/case-library-missing-module-complete/);
    await expect(moduleB).not.toHaveClass(/case-library-missing-module-complete/);
    await expect(moduleC).not.toHaveClass(/case-library-missing-module-complete/);
  });

  test('非组长删除模块提示权限不足', async ({ page }) => {
    const token = 'token-case-library-missing-permission';
    const user = { id: 11, username: 'demo_member', role: 'user', level: 'member' };
    const project = { id: 3, name: '易漏项目-权限', description: 'for missing module permission' };
    const modules = [{ id: 301, project_id: project.id, name: '模块权限', item_count: 1 }];

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

      if (pathName === '/api/missing-types' && method === 'GET') {
        return respond(200, []);
      }
      if (pathName === '/api/missing-modules' && method === 'GET') {
        return respond(200, modules.slice());
      }
      if (pathName.startsWith('/api/missing-modules/') && method === 'DELETE') {
        return respond(200, { detail: 'deleted' });
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page);

    await openDrawer(page, '#openCaseLibraryMissingDrawerBtn', '#caseLibraryMissingDrawer');
    await page.locator('#caseLibraryMissingProjectSelect').selectOption(String(project.id));
    await expect(page.locator('#caseLibraryMissingListBody tr')).toHaveCount(1);

    await page.locator('#caseLibraryMissingListBody input[type="checkbox"]').first().check();
    await page.locator('#caseLibraryMissingDeleteBtn').click();
    await expect(page.locator('.temp-center-toast')).toContainText('权限不足，请联系管理员或者组长进行操作。');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);
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

  test('易漏用例导入同名模块合并', async ({ page }) => {
    const token = 'token-case-library-missing-import';
    const user = { id: 11, username: 'missing_import_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '漏测项目', description: 'missing import' };
    const modules = [
      {
        id: 1,
        project_id: project.id,
        name: '模块A',
        item_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const itemsByModule = {
      1: [
        {
          id: 11,
          module_id: 1,
          module_name: '模块A',
          title: '用例1',
          priority: 'P1',
          precondition: '前提1',
          steps: '步骤1',
          expected: '预期1',
          remark: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };
    let moduleAutoId = 2;
    let itemAutoId = 100;

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
        const list = modules.map((m) => Object.assign({}, m, { item_count: (itemsByModule[m.id] || []).length }));
        return respond(200, list);
      }
      if (pathName === '/api/missing-modules' && method === 'POST') {
        const payload = route.request().postDataJSON();
        const created = {
          id: moduleAutoId++,
          project_id: payload.project_id,
          name: payload.name || '',
          item_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        modules.push(created);
        itemsByModule[created.id] = [];
        return respond(201, created);
      }
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 2]);
        return respond(200, itemsByModule[moduleId] || []);
      }
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'POST') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 2]);
        const payload = route.request().postDataJSON();
        let moduleName = '';
        const found = modules.find((m) => m.id === moduleId);
        if (found && found.name) moduleName = found.name;
        const created = Object.assign({}, payload, {
          id: itemAutoId++,
          module_id: moduleId,
          module_name: moduleName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (!itemsByModule[moduleId]) itemsByModule[moduleId] = [];
        itemsByModule[moduleId].push(created);
        return respond(201, created);
      }
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page);

    await openDrawer(page, '#openCaseLibraryMissingDrawerBtn', '#caseLibraryMissingDrawer');
    await page.locator('#caseLibraryMissingImportProjectSelect').selectOption(String(project.id));

    const rows = [
      ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'],
      ['模块A', '用例1', 'P1', '前提1', '步骤1', '预期1'],
      ['模块A', '用例2', 'P2', '前提2', '步骤2', '预期2'],
      ['模块B', '用例3', 'P1', '前提3', '步骤3', '预期3'],
    ];
    const buffer = await buildXlsxBuffer(page, rows, '易漏用例');
    await page.setInputFiles('#caseLibraryMissingImportInput', {
      name: 'missing_import.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    await expect(page.locator('#caseLibraryMissingImportStatus')).toContainText('已识别 3 条漏测用例');
    await expect(page.locator('#caseLibraryMissingImportConfirmBtn')).toBeEnabled();
    await page.locator('#caseLibraryMissingImportConfirmBtn').click();

    const diffDrawer = page.locator('#caseLibraryMissingImportDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryMissingImportDiffStatus')).toContainText('新增条目 2 条');
    await expect(page.locator('#caseLibraryMissingImportDiffStatus')).toContainText('重复跳过 1 条');

    await page.locator('#caseLibraryMissingImportDiffConfirmBtn').click();
    await expect(diffDrawer).not.toHaveClass(/open/);
    await expect(page.locator('#caseLibraryMissingImportStatus')).toContainText('合并完成');

    const moduleB = modules.find((m) => m.name === '模块B');
    expect(moduleB).toBeTruthy();
    expect(itemsByModule[1].length).toBe(2);
    expect(itemsByModule[moduleB.id].length).toBe(1);
  });

  test('易漏用例导入格式不匹配提示', async ({ page }) => {
    const token = 'token-case-library-missing-import-invalid';
    const user = { id: 12, username: 'missing_import_invalid', role: 'admin', level: 'leader' };
    const project = { id: 2, name: '漏测项目-格式', description: 'missing import invalid' };

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
      if (pathName === '/api/missing-modules' && method === 'GET') return respond(200, []);
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page);

    await openDrawer(page, '#openCaseLibraryMissingDrawerBtn', '#caseLibraryMissingDrawer');
    await page.locator('#caseLibraryMissingImportProjectSelect').selectOption(String(project.id));

    const rows = [
      ['模块名', '标题', '预期'],
      ['模块X', '用例X', '预期X'],
    ];
    const buffer = await buildXlsxBuffer(page, rows, '错误模板');
    await page.setInputFiles('#caseLibraryMissingImportInput', {
      name: 'missing_import_invalid.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    await expect(page.locator('#caseLibraryMissingImportStatus')).toContainText('Excel 表头');
    await expect(page.locator('#caseLibraryMissingImportConfirmBtn')).toBeDisabled();
  });

  test('易漏用例导入层级不足在差异页展示', async ({ page }) => {
    const token = 'token-case-library-missing-import-structure';
    const user = { id: 13, username: 'missing_import_structure', role: 'admin', level: 'leader' };
    const project = { id: 3, name: '漏测项目-层级', description: 'missing import structure' };

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
      if (pathName === '/api/missing-modules' && method === 'GET') return respond(200, []);
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page);

    await openDrawer(page, '#openCaseLibraryMissingDrawerBtn', '#caseLibraryMissingDrawer');
    await page.locator('#caseLibraryMissingImportProjectSelect').selectOption(String(project.id));
    await page.waitForFunction(() => {
      return Boolean(window.app && window.app.core && typeof window.app.core.parseXmindFile === 'function');
    });

    const buffer = buildXmindBufferFromFixture('case_library_xmind_missing_precondition.xmind.base64');
    await page.setInputFiles('#caseLibraryMissingImportInput', {
      name: 'missing_precondition.xmind',
      mimeType: 'application/octet-stream',
      buffer,
    });

    await expect(page.locator('#caseLibraryMissingImportStatus')).toContainText('字段层级不足');
    await page.locator('#caseLibraryMissingImportConfirmBtn').click();

    const diffDrawer = page.locator('#caseLibraryMissingImportDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryMissingImportStructureWrap')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caseLibraryMissingImportStructureBody')).toContainText('字段层级不足');
    await expect(page.locator('#caseLibraryMissingImportStructureBody')).toContainText('缺少');
  });
});
