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

test.describe('执行页复用开关同步到用例库', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('取消勾选复用后，用例库对应文件显示为非复用', async ({ page }) => {
    const token = 'token-reuse-sync';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '战魂铭人', description: 'for reuse sync' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const caseFileId = 100;
    const execSetId = 2001;
    const caseFiles = [
      {
        id: caseFileId,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例A',
        reuse_enabled: true,
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
    ];
    const execSets = [
      {
        id: execSetId,
        project_id: project.id,
        version_id: versions[0].id,
        case_file_id: caseFileId,
        name: '用例A',
        status: 'active',
        reuse_enabled: true,
        reuse_presets: [],
        created_at: now,
        updated_at: now,
      },
    ];
    const execCasesBySetId = {};
    execCasesBySetId[execSetId] = [
      {
        id: 3001,
        exec_set_id: execSetId,
        case_item_id: 1,
        module: '模块A',
        title: '登录',
        expected: '成功',
        priority: 'P0',
        precondition: '',
        steps: '步骤1',
        status: '未执行',
        remark: '',
        defect_links: [],
        reuse_details: [],
        order_no: 1,
        created_at: now,
        updated_at: now,
      },
    ];

    let execSetPatchCalls = 0;

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
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, execSets.slice());
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const id = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[id] || []);
      }

      const syncMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/case-library-sync$/);
      if (syncMatch && method === 'POST') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, {
          exec_set_id: execSetId,
          case_file_id: caseFileId,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: null,
          last_shown_at: null,
          ever_changed: false,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { added: 0, updated: 0, deleted: 0 },
          diff: [],
          history: [],
        });
      }

      const updateSetMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)$/);
      if (updateSetMatch && method === 'PATCH') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const id = Number(updateSetMatch[1]);
        execSetPatchCalls += 1;
        const payload = route.request().postDataJSON ? route.request().postDataJSON() : {};
        const found = execSets.find((s) => s && Number(s.id) === id) || null;
        if (!found) return respond(404, { detail: 'not found' });
        if (payload && Object.prototype.hasOwnProperty.call(payload, 'reuse_enabled')) {
          found.reuse_enabled = payload.reuse_enabled === true;
          const file = caseFiles.find((f) => f && Number(f.id) === Number(found.case_file_id)) || null;
          if (file) file.reuse_enabled = payload.reuse_enabled === true;
        }
        if (payload && Object.prototype.hasOwnProperty.call(payload, 'reuse_presets')) {
          found.reuse_presets = payload.reuse_presets;
        }
        found.updated_at = new Date().toISOString();
        return respond(200, found);
      }

      if (pathName === '/api/case-files' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        return respond(200, caseFiles.slice());
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

    await switchToTab(page, 'tempexec');
    const reuseToggle = page.locator('[data-temp-reuse-toggle]').first();
    await expect(reuseToggle).toBeVisible();
    await expect(reuseToggle).toBeChecked();
    await reuseToggle.uncheck();
    await expect(reuseToggle).not.toBeChecked();
    await expect.poll(() => execSetPatchCalls, { timeout: 10000 }).toBeGreaterThan(0);

    await switchToTab(page, 'case-library');
    await expect(page.locator('#caseLibraryHead')).toBeVisible();

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));

    const row = page.locator('#caseLibraryEditListBody tr', { hasText: '用例A' });
    await expect(row).toContainText('否');
    await expect(row.locator('.case-library-reuse-badge')).toHaveCount(0);
  });

  test('复用子项为“变更重跑”时状态选择有高亮颜色', async ({ page }) => {
    const token = 'token-reuse-detail-rerun';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '战魂铭人', description: 'for reuse detail rerun color' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const caseFileId = 100;
    const execSetId = 2001;
    const execSets = [
      {
        id: execSetId,
        project_id: project.id,
        version_id: versions[0].id,
        case_file_id: caseFileId,
        name: '用例A',
        status: 'active',
        reuse_enabled: true,
        reuse_presets: [],
        created_at: now,
        updated_at: now,
      },
    ];
    const execCasesBySetId = {};
    execCasesBySetId[execSetId] = [
      {
        id: 3001,
        exec_set_id: execSetId,
        case_item_id: 1,
        module: '模块A',
        title: '登录',
        expected: '成功',
        priority: 'P0',
        precondition: '',
        steps: '步骤1',
        status: '变更重跑',
        remark: '',
        defect_links: [],
        reuse_details: [{ id: 'd1', text: '子项1', note: '', status: '变更重跑' }],
        order_no: 1,
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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, execSets.slice());
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const id = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[id] || []);
      }

      const syncMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/case-library-sync$/);
      if (syncMatch && method === 'POST') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, {
          exec_set_id: execSetId,
          case_file_id: caseFileId,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: null,
          last_shown_at: null,
          ever_changed: false,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { added: 0, updated: 0, deleted: 0 },
          diff: [],
          history: [],
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

    await switchToTab(page, 'tempexec');
    const reusePanelBtn = page.locator('[data-temp-reuse-panel]').first();
    await expect(reusePanelBtn).toBeVisible();
    await reusePanelBtn.click();

    const statusSelect = page.locator('[data-temp-reuse-status]').first();
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('变更重跑');
    await expect(statusSelect).toHaveClass(/changed/);
  });
});
