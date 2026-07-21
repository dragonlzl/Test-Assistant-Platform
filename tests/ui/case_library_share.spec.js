const { test, expect } = require('@playwright/test');
const { setSemanticChecked } = require('./helpers/vtable_semantic');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/case-library.html');
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

test.describe('用例库共享用例', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('共享抽屉展示全量项目并提示重复', async ({ page }) => {
    const token = 'token-case-library-share';
    const user = { id: 12, username: 'demo_user', role: 'user', level: 'member' };
    const projectA = { id: 1, name: '项目A', description: 'source' };
    const projectB = { id: 2, name: '项目B', description: 'target' };
    const versionsA = [{ id: 11, name: 'v1' }];
    const versionsB = [{ id: 21, name: 'v2' }];
    const now = new Date().toISOString();

    const caseFileId = 100;
    const caseFileId2 = 101;
    const caseFiles = [
      {
        id: caseFileId,
        project_id: projectA.id,
        version_id: versionsA[0].id,
        file_name_clean: '登录用例',
        reuse_enabled: false,
        item_count: 2,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
      {
        id: caseFileId2,
        project_id: projectA.id,
        version_id: versionsA[0].id,
        file_name_clean: '注册用例',
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
      if (pathName === '/api/projects' && method === 'GET') {
        if (url.searchParams.get('scope') === 'share') return respond(200, [projectA, projectB]);
        return respond(200, [projectA]);
      }
      if (pathName === `/api/projects/${projectA.id}/versions` && method === 'GET') return respond(200, versionsA);
      if (pathName === `/api/projects/${projectB.id}/versions` && method === 'GET') {
        if (url.searchParams.get('scope') === 'share') return respond(200, versionsB);
        return respond(403, { detail: 'forbidden' });
      }

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
        if (pid !== String(projectA.id)) return respond(200, []);
        return respond(200, caseFiles.slice());
      }

      if (pathName === '/api/case-files/share' && method === 'POST') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        let payload = {};
        try { payload = route.request().postDataJSON() || {}; } catch (_) { payload = {}; }
        if (payload.case_file_id === caseFileId) return respond(409, { detail: 'case_file_duplicate' });
        return respond(201, {
          id: 200,
          project_id: projectB.id,
          version_id: versionsB[0].id,
          file_name_clean: '注册用例',
          reuse_enabled: false,
          item_count: 2,
          importer_id: user.id,
          importer_name: user.username,
          imported_at: now,
          updated_at: now,
          last_updated_by: user.id,
          last_updated_by_name: user.username,
        });
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
    await page.selectOption('#caseLibraryEditProjectSelect', String(projectA.id));
    await page.waitForTimeout(200);

    await setSemanticChecked(page, `#caseLibraryEditListBody [data-case-lib-edit-select="${caseFileId}"]`, true);
    await setSemanticChecked(page, `#caseLibraryEditListBody [data-case-lib-edit-select="${caseFileId2}"]`, true);
    await page.click('#caseLibraryEditShareBtn');
    await expect(page.locator('#caseLibraryShareDrawer')).toHaveClass(/open/);

    await page.selectOption('#caseLibraryShareProjectSelect', String(projectB.id));
    await page.waitForFunction(() => {
      const el = document.getElementById('caseLibraryShareVersionSelect');
      return el && !el.disabled && el.options.length > 1;
    });
    await page.selectOption('#caseLibraryShareVersionSelect', String(versionsB[0].id));

    await page.click('#caseLibraryShareConfirmBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText(projectB.name);
    await page.click('#appConfirmDrawerConfirmBtn');
    const hint = page.locator('.temp-click-hint');
    await expect(hint).toContainText('该项目已有此用例');
    await expect(page.locator('#caseLibraryShareStatus')).toContainText('共享成功');
    await expect(page.locator('#caseLibraryShareStatus')).toContainText('已存在未共享');
  });
});
