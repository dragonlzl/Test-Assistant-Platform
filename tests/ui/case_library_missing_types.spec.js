const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/case-library.html');
}

async function waitCaseLibraryReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
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
  await btn.click();
  await expect(drawer).toHaveClass(/open/, { timeout: 3000 });
}

test.describe('用例库易漏类型筛选', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('类型新增与筛选生效，列表可调整类型', async ({ page }) => {
    const token = 'token-case-library-missing-type';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '易漏项目', description: 'for missing types' };
    let typeAutoId = 5;
    const types = [
      { id: 1, project_id: project.id, name: '功能', item_count: 1 },
      { id: 2, project_id: project.id, name: '性能', item_count: 1 },
    ];
    const modules = [
      { id: 101, project_id: project.id, name: '模块A', item_count: 1 },
      { id: 102, project_id: project.id, name: '模块B', item_count: 1 },
    ];
    const itemsByModule = {
      101: [{
        id: 501,
        module_id: 101,
        module_name: '模块A',
        title: '易漏条目1',
        priority: 'P1',
        precondition: '',
        steps: '',
        expected: '应提示',
        remark: null,
        type_id: 1,
        type_name: '功能',
      }],
      102: [{
        id: 502,
        module_id: 102,
        module_name: '模块B',
        title: '易漏条目2',
        priority: 'P2',
        precondition: '',
        steps: '',
        expected: '应告警',
        remark: null,
        type_id: 2,
        type_name: '性能',
      }],
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
      if (pathName === '/api/missing-types' && method === 'POST') {
        const payload = route.request().postDataJSON();
        const name = payload && payload.name ? String(payload.name) : '';
        if (!name) return respond(400, { detail: '类型名不能为空' });
        const dup = types.find((t) => t.name === name);
        if (dup) return respond(409, { detail: 'missing_type_duplicate' });
        const created = {
          id: typeAutoId++,
          project_id: payload.project_id,
          name: name,
          item_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        types.push(created);
        return respond(201, created);
      }

      if (pathName === '/api/missing-modules' && method === 'GET') {
        const typeParam = url.searchParams.get('type_ids') || '';
        const typeIds = typeParam.split(',').map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
        if (!typeIds.length) return respond(200, modules.slice());
        const filtered = modules.filter((mod) => {
          const rows = itemsByModule[mod.id] || [];
          return rows.some((row) => typeIds.indexOf(Number(row.type_id)) !== -1);
        });
        return respond(200, filtered);
      }
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 2]);
        return respond(200, itemsByModule[moduleId] || []);
      }
      if (pathName.startsWith('/api/missing-modules/items/') && method === 'PATCH') {
        const parts = pathName.split('/');
        const itemId = Number(parts[parts.length - 1]);
        const payload = route.request().postDataJSON();
        let found = null;
        Object.keys(itemsByModule).forEach((mid) => {
          const rows = itemsByModule[mid] || [];
          rows.forEach((row) => {
            if (row.id === itemId) found = row;
          });
        });
        if (!found) return respond(404, { detail: 'not found' });
        if (Object.prototype.hasOwnProperty.call(payload, 'type_id')) {
          const nextId = Number(payload.type_id) > 0 ? Number(payload.type_id) : null;
          found.type_id = nextId;
          const target = types.find((t) => Number(t.id) === Number(nextId));
          found.type_name = target ? target.name : null;
        }
        return respond(200, found);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page);

    await openDrawer(page, '#openCaseLibraryMissingDrawerBtn', '#caseLibraryMissingDrawer');
    await page.locator('#caseLibraryMissingProjectSelect').selectOption(String(project.id));

    await page.locator('#caseLibraryMissingTypeAddBtn').click();
    await expect(page.locator('#caseLibraryMissingTypeAddDrawer')).toHaveClass(/open/);
    await page.locator('#caseLibraryMissingTypeNameInput').fill('安全');
    await page.locator('#caseLibraryMissingTypeAddConfirmBtn').click();
    await expect(page.locator('.temp-center-toast')).toContainText('添加成功');
    await expect(page.locator('#caseLibraryMissingTypeGrid')).toContainText('安全');

    const typeChip = page.locator('#caseLibraryMissingTypeGrid label', { hasText: '功能' }).locator('input');
    const typeChipB = page.locator('#caseLibraryMissingTypeGrid label', { hasText: '性能' }).locator('input');
    const allChip = page.locator('#caseLibraryMissingTypeGrid label', { hasText: '全部' }).locator('input');
    await typeChip.check();
    await expect(page.locator('#caseLibraryMissingListBody tr')).toHaveCount(1);
    await expect(page.locator('#caseLibraryMissingListBody')).toContainText('模块A');

    await typeChipB.check();
    await expect(typeChip).toBeChecked();
    await expect(typeChipB).toBeChecked();
    await expect(allChip).not.toBeChecked();
    await expect(page.locator('#caseLibraryMissingListBody tr')).toHaveCount(2);

    await allChip.check();
    await expect(page.locator('#caseLibraryMissingListBody tr')).toHaveCount(2);

    await page.locator('#caseLibraryMissingListBody button[data-case-lib-missing-view]').first().click();
    await expect(page.locator('#caseLibraryMissingCard')).toBeVisible();
    await expect(page.locator('#caseLibraryMissingTypePills')).toContainText('功能');

    const typeSelect = page.locator('#caseLibraryMissingView select[data-case-lib-missing-type]').first();
    await typeSelect.selectOption('2');
    await expect(page.locator('#caseLibraryMissingTypePills')).toContainText('性能');

    await typeSelect.selectOption('__add_type__');
    await expect(page.locator('#caseLibraryMissingTypeAddDrawer')).toHaveClass(/open/);
    await page.locator('#caseLibraryMissingTypeNameInput').fill('稳定');
    await page.locator('#caseLibraryMissingTypeAddConfirmBtn').click();
    await expect(page.locator('.temp-center-toast')).toContainText('添加成功');
    await expect(page.locator('#caseLibraryMissingTypeAddDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#caseLibraryMissingDrawer')).not.toHaveClass(/open/);
  });
});
