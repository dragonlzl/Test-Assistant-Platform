const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  return base;
}

async function ensureTab(page, name) {
  await page.evaluate((tabName) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(tabName);
  }, name);
  await page.waitForFunction((tabName) => {
    const nodes = document.querySelectorAll('[data-tab-section="' + tabName + '"]');
    if (!nodes || !nodes.length) return true;
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      if (el && el.classList && !el.classList.contains('hidden')) return true;
    }
    return false;
  }, name);
}

async function openDrawer(page, buttonSelector, drawerSelector) {
  await page.click(buttonSelector);
  await expect(page.locator(drawerSelector)).toHaveClass(/open/, { timeout: 5000 });
}

async function confirmAddVersion(page, name) {
  const drawer = page.locator('#appConfirmDrawer');
  await expect(drawer).toHaveClass(/open/, { timeout: 5000 });
  await page.fill('#appConfirmDrawerInput', String(name));
  await page.click('#appConfirmDrawerConfirmBtn');
  await expect(drawer).not.toHaveClass(/open/, { timeout: 5000 });
}

async function expectDuplicateWarning(page) {
  const drawer = page.locator('#appConfirmDrawer');
  await expect(drawer).toHaveClass(/open/, { timeout: 5000 });
  await page.click('#appConfirmDrawerConfirmBtn');
  await page.waitForFunction(() => {
    const el = document.getElementById('appConfirmDrawerStatus');
    return el && (el.textContent || '').indexOf('版本已存在') !== -1;
  });
  await page.click('#appConfirmDrawerCancelBtn');
  await expect(drawer).not.toHaveClass(/open/, { timeout: 5000 });
}

test.describe('版本下拉新增入口', () => {
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
    });
  });

  test('执行页导入/执行版本选择支持新增版本（含重复提示）', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const now = new Date().toISOString();
    const project = { id: 1, name: '项目A', description: '' };
    let nextVersionId = 12;
    const versionsByProject = {
      1: [{ id: 11, project_id: 1, name: 'v1', created_at: now, updated_at: now }],
    };

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      const versionsMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch && method === 'GET') {
        const pid = Number(versionsMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }
      if (versionsMatch && method === 'POST') {
        const pid = Number(versionsMatch[1]);
        const payload = route.request().postDataJSON() || {};
        const name = payload.name || '';
        const list = versionsByProject[pid] || [];
        if (list.some((v) => v && v.name === name)) {
          return respond(400, { detail: '版本名已存在' });
        }
        const ver = { id: nextVersionId++, project_id: pid, name, created_at: now, updated_at: now };
        versionsByProject[pid] = [ver].concat(list);
        return respond(201, ver);
      }
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await ensureTab(page, 'tempexec');
    await openDrawer(page, '#openTempExecImportDrawerBtn', '#tempExecImportDrawer');
    await page.waitForFunction(() => {
      const sel = document.getElementById('tempExecImportProjectSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#tempExecImportProjectSelect', '1');
    await page.waitForFunction(() => {
      const sel = document.getElementById('tempExecImportVersionSelect');
      if (!sel || sel.disabled || !sel.options || !sel.options.length) return false;
      return Array.from(sel.options).some((opt) => opt && opt.value === '__add_version__');
    });
    await page.selectOption('#tempExecImportVersionSelect', '__add_version__');
    await confirmAddVersion(page, 'v2');
    await page.waitForFunction(() => {
      const sel = document.getElementById('tempExecImportVersionSelect');
      return sel && String(sel.value) === '12';
    });

    await page.selectOption('#tempExecImportVersionSelect', '__add_version__');
    await page.fill('#appConfirmDrawerInput', 'v2');
    await expectDuplicateWarning(page);

    await page.evaluate(() => {
      if (window.app && window.app.execVersionDrawer) {
        window.app.execVersionDrawer.open({ projectId: 1, projectName: '项目A', title: '选择执行版本' });
      }
    });
    await expect(page.locator('#execVersionSelectDrawer')).toHaveClass(/open/, { timeout: 5000 });
    await page.waitForFunction(() => {
      const sel = document.getElementById('execVersionSelectDrawerVersionSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#execVersionSelectDrawerVersionSelect', '__add_version__');
    await confirmAddVersion(page, 'v3');
    await page.waitForFunction(() => {
      const sel = document.getElementById('execVersionSelectDrawerVersionSelect');
      return sel && String(sel.value) === '13';
    });
  });

});
