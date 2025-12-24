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
    try {
      last = await page.evaluate(() => {
        let token = '';
        try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
        return {
          hasApp: Boolean(window.app),
          authReady: Boolean(window.app && window.app.authReady === true),
          hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
          hasTempExecApi: Boolean(window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function'),
          token: token,
          tab: window.app && window.app.state ? window.app.state.activeTab : '',
        };
      });
    } catch (err) {
      last = { error: err && err.message ? err.message : 'evaluate failed' };
      await page.waitForTimeout(200);
      continue;
    }
    if (last && last.hasApp && last.authReady && last.hasSwitchTab && last.hasTempExecApi) return;
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

async function ensureAuthed(page, token, user) {
  await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
  await page.evaluate((payload) => {
    try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
    if (window.app && window.app.apiClient && typeof window.app.apiClient.setToken === 'function') {
      window.app.apiClient.setToken(payload.token);
    }
    if (window.app && window.app.state) {
      window.app.state.currentUser = payload.user;
      window.app.state.authReady = true;
    }
    window.app = window.app || {};
    window.app.authReady = true;
  }, { token: token, user: user });
}

test.describe('执行页-用例库变更同步与diff抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('刷新回到执行页时自动弹出 diff，并保留醒目标记', async ({ page }) => {
    const token = 'token-case-lib-auto-popup';
    const user = { id: 7, username: 'auto_popup_user', role: 'user', level: 'member' };
    const project = { id: 5, name: '自动弹窗项目', description: 'auto popup diff' };
    const versions = [{ id: 51, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 5001, project_id: project.id, version_id: versions[0].id, case_file_id: 333, name: '自动弹窗用例', status: 'active', created_at: now, updated_at: now };

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [execSet]);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        const diffEntry = {
          kind: 'deleted',
          case_item_id: 9,
          changed_fields: [],
          old: { module: '支付', title: '取消支付', priority: 'P1', precondition: '无', steps: '旧步骤', expected: '成功', remark: '' },
          new: null,
        };
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: now,
          last_shown_at: null,
          ever_changed: true,
          has_new_diff: true,
          should_auto_popup: true,
          summary: { added: 0, updated: 0, deleted: 1 },
          diff: [diffEntry],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 9001,
            exec_set_id: execSet.id,
            case_item_id: 1,
            module: '支付',
            title: '发起支付',
            expected: '成功',
            priority: 'P0',
            precondition: '无',
            steps: '新步骤',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
    await page.evaluate((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      if (window.app && window.app.apiClient && typeof window.app.apiClient.setToken === 'function') {
        window.app.apiClient.setToken(payload.token);
      }
      if (window.app && window.app.state) {
        window.app.state.currentUser = payload.user;
        window.app.state.authReady = true;
      }
      window.app = window.app || {};
      window.app.authReady = true;
    }, { token: token, user: user });

    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);

    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toHaveText('用例变更');
    await expect(btn).toHaveClass(/has-new/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('取消支付');

    const toolbarOrder = await page.evaluate(() => {
      var actions = document.querySelector('#tempExecToolbar .toolbar-actions');
      if (!actions) return null;
      var blocks = Array.prototype.slice.call(actions.children).map(function(el) { return el.className || ''; });
      var middle = actions.querySelector('.toolbar-middle');
      var middleOrder = [];
      if (middle) {
        middleOrder = Array.prototype.slice.call(middle.children).map(function(el) { return el.className || ''; });
      }
      var exportSlot = actions.querySelector('#tempExecExportSlot');
      var exportIds = exportSlot
        ? Array.prototype.slice.call(exportSlot.querySelectorAll('button')).map(function(btn) { return btn.id || ''; })
        : [];
      return { blocks: blocks, middle: middleOrder, exportIds: exportIds };
    });
    expect(toolbarOrder && toolbarOrder.blocks).toBeTruthy();
    expect(toolbarOrder.blocks.length).toBe(3);
    expect(toolbarOrder.blocks[1]).toContain('toolbar-middle');
    expect(toolbarOrder.middle.join(' ')).toContain('toolbar-change-slot');
    expect(toolbarOrder.middle.join(' ')).toContain('toolbar-nav');
    expect(toolbarOrder.middle.join(' ')).toContain('toolbar-archive-wrap');
    expect(toolbarOrder.exportIds).toContain('exportTempExecXmindBtn');
    expect(toolbarOrder.exportIds).toContain('exportTempExecCasesXmindBtn');
  });

  test('进入/刷新执行页时自动同步并弹出diff；无新变更时不自动弹但可手动打开', async ({ page }) => {
    const token = 'token-case-lib-diff';
    const user = { id: 9, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '战魂铭人', description: 'for case lib diff' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 2001, project_id: project.id, version_id: versions[0].id, case_file_id: 100, name: '用例A', status: 'active', created_at: now, updated_at: now };
    let syncCalls = 0;
    let acked = false;

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [execSet]);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        syncCalls += 1;
        const hasNew = syncCalls === 1;
        const diffEntry = {
          kind: 'updated',
          case_item_id: 1,
          changed_fields: ['steps'],
          old: { module: '登录', title: '正常登录', priority: 'P0', precondition: '', steps: '旧步骤', expected: '成功', remark: '' },
          new: { module: '登录', title: '正常登录', priority: 'P0', precondition: '', steps: '新步骤', expected: '成功', remark: '' },
        };
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: now,
          last_shown_at: acked ? now : null,
          ever_changed: true,
          has_new_diff: hasNew,
          should_auto_popup: hasNew,
          summary: { added: 0, updated: 1, deleted: 0 },
          diff: [diffEntry],
        });
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-diff/ack` && method === 'POST') {
        acked = true;
        return respond(200, { detail: 'ok', exec_set_id: execSet.id });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 3001,
            exec_set_id: execSet.id,
            case_item_id: 1,
            module: '登录',
            title: '正常登录',
            expected: '成功',
            priority: 'P0',
            precondition: '',
            steps: '新步骤',
            status: '变更重跑',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
    await page.evaluate((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      if (window.app && window.app.apiClient && typeof window.app.apiClient.setToken === 'function') {
        window.app.apiClient.setToken(payload.token);
      }
      if (window.app && window.app.state) {
        window.app.state.currentUser = payload.user;
        window.app.state.authReady = true;
      }
      window.app = window.app || {};
      window.app.authReady = true;
    }, { token: token, user: user });
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();
    if (await diffDrawer.evaluate((el) => el.classList.contains('open'))) {
      await expect(diffDrawer).toHaveClass(/open/);
    } else {
      await btn.click({ force: true });
      await expect(diffDrawer).toHaveClass(/open/);
    }
    await expect(page.locator('#tempExecCaseLibraryDiffCaseName')).toContainText('用例A');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('旧步骤');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('新步骤');

    await page.click('#closeTempExecCaseLibraryDiffDrawerBtn');
    await expect(diffDrawer).not.toHaveClass(/open/);

    await expect(page.locator('#tempExecToolbar')).toContainText('未执行 1');
    await expect(page.locator('#tempExecView')).toContainText('变更重跑');

    await expect(btn).toBeEnabled();

    // 再次刷新：无新变更时不自动弹，但按钮仍可手动打开并查看最近一次差异
    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    if (await diffDrawer.evaluate((el) => el.classList.contains('open'))) {
      await page.click('#closeTempExecCaseLibraryDiffDrawerBtn');
    }
    await expect(diffDrawer).not.toHaveClass(/open/);
    await expect(btn).toBeEnabled();

    const mask = page.locator('.drawer-mask[data-drawer-close="tempExecCaseLibraryDiffDrawer"]');
    if (await mask.isVisible()) {
      await mask.click();
      await expect(diffDrawer).not.toHaveClass(/open/);
    }

    await btn.click({ force: true });
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffCaseName')).toContainText('用例A');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('旧步骤');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('新步骤');
  });

  test('多人修改同字段后刷新：仅有摘要也保持变更按钮可点', async ({ page }) => {
    const token = 'token-case-lib-summary-only';
    const user = { id: 15, username: 'summary_user', role: 'user', level: 'member' };
    const project = { id: 7, name: '摘要保留项目', description: 'summary only' };
    const versions = [{ id: 71, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 7001, project_id: project.id, version_id: versions[0].id, case_file_id: 770, name: '用例汇总', status: 'active', created_at: now, updated_at: now };

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [execSet]);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: null,
          last_shown_at: null,
          ever_changed: false,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { appended: 0, added: 0, updated: 1, deleted: 0 },
          diff: [],
          history: [],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 7701,
            exec_set_id: execSet.id,
            case_item_id: 1,
            module: '账号',
            title: '修改昵称',
            expected: '成功',
            priority: 'P1',
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
        ]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffUpdatedPill')).toContainText('改动 1');

    await page.click('#closeTempExecCaseLibraryDiffDrawerBtn');
    await expect(diffDrawer).not.toHaveClass(/open/);

    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffUpdatedPill')).toContainText('改动 1');
  });

  test('多人交替刷新后元信息缺失仍可手动打开变更抽屉', async ({ page }) => {
    const token = 'token-case-lib-empty-meta';
    const user = { id: 21, username: 'empty_meta_user', role: 'user', level: 'member' };
    const project = { id: 9, name: '元信息清空项目', description: 'empty meta' };
    const versions = [{ id: 91, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 9101, project_id: project.id, version_id: versions[0].id, case_file_id: 990, name: '用例同步', status: 'active', created_at: now, updated_at: now };
    let syncCalls = 0;

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [execSet]);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        syncCalls += 1;
        if (syncCalls === 1) {
          const diffEntry = {
            kind: 'updated',
            case_item_id: 11,
            changed_fields: ['title'],
            old: { module: '账户', title: '旧标题', priority: 'P1', precondition: '', steps: '步骤', expected: '成功', remark: '' },
            new: { module: '账户', title: '新标题', priority: 'P1', precondition: '', steps: '步骤', expected: '成功', remark: '' },
          };
          return respond(200, {
            exec_set_id: execSet.id,
            case_file_id: execSet.case_file_id,
            case_file_updated_at: now,
            base_updated_at: now,
            last_diff_at: now,
            last_shown_at: null,
            ever_changed: true,
            has_new_diff: true,
            should_auto_popup: false,
            summary: { appended: 0, added: 0, updated: 1, deleted: 0 },
            diff: [diffEntry],
            history: [],
          });
        }
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: null,
          last_shown_at: null,
          ever_changed: false,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { appended: 0, added: 0, updated: 0, deleted: 0 },
          diff: [],
          history: [],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 91011,
            exec_set_id: execSet.id,
            case_item_id: 11,
            module: '账户',
            title: '新标题',
            expected: '成功',
            priority: 'P1',
            precondition: '',
            steps: '步骤',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('旧标题');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('新标题');

    await page.click('#closeTempExecCaseLibraryDiffDrawerBtn');
    await expect(diffDrawer).not.toHaveClass(/open/);

    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('暂无变更');
  });

  test('用例库变更已匹配：不提示新增且列表不重复', async ({ page }) => {
    const token = 'token-case-lib-diff-dedupe';
    const user = { id: 12, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 2, name: '无双世界', description: 'for case lib diff dedupe' };
    const versions = [{ id: 21, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 2101, project_id: project.id, version_id: versions[0].id, case_file_id: 110, name: '用例集', status: 'active', created_at: now, updated_at: now };

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [execSet]);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: null,
          last_shown_at: null,
          ever_changed: true,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { appended: 0, added: 0, updated: 0, deleted: 0 },
          diff: [],
          history: [],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 3101,
            exec_set_id: execSet.id,
            case_item_id: 1,
            module: '基础',
            title: '初始化',
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
          {
            id: 3102,
            exec_set_id: execSet.id,
            case_item_id: 2,
            module: '订单',
            title: '新增订单',
            expected: '成功',
            priority: 'P1',
            precondition: '已登录',
            steps: '步骤A',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 2,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).not.toHaveClass(/open/);

    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();
    await expect(btn).not.toHaveClass(/has-new/);

    const rowCount = await page.locator('#tempExecView tr.case-row').count();
    expect(rowCount).toBe(2);
  });

  test('存在多份变更时可切换用例diff；自动弹不影响当前选中用例；可点击“选择用例”切换执行视图', async ({ page }) => {
    const token = 'token-case-lib-diff-multi';
    const user = { id: 9, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '战魂铭人', description: 'for case lib diff multi' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const execSetA = { id: 2001, project_id: project.id, version_id: versions[0].id, case_file_id: 100, name: '用例A', status: 'active', created_at: now, updated_at: '2025-12-16T12:00:00.000Z' };
    const execSetB = { id: 2002, project_id: project.id, version_id: versions[0].id, case_file_id: 101, name: '用例B', status: 'active', created_at: now, updated_at: '2025-12-16T11:00:00.000Z' };

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [execSetA, execSetB]);
      }

      if (pathName === `/api/exec/sets/${execSetA.id}/case-library-sync` && method === 'POST') {
        return respond(200, {
          exec_set_id: execSetA.id,
          case_file_id: execSetA.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: now,
          last_shown_at: now,
          ever_changed: true,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { added: 0, updated: 1, deleted: 1 },
          diff: [
            {
              kind: 'updated',
              case_item_id: 11,
              changed_fields: ['steps'],
              old: { module: 'A模块', title: 'A改', priority: 'P0', precondition: '', steps: 'A旧步骤', expected: '成功', remark: '' },
              new: { module: 'A模块', title: 'A改', priority: 'P0', precondition: '', steps: 'A新步骤', expected: '成功', remark: '' },
            },
            {
              kind: 'deleted',
              case_item_id: 12,
              changed_fields: [],
              old: { module: 'A模块', title: 'A删', priority: 'P1', precondition: '', steps: 'A删步骤', expected: '成功', remark: '' },
              new: null,
            },
          ],
        });
      }

      if (pathName === `/api/exec/sets/${execSetB.id}/case-library-sync` && method === 'POST') {
        return respond(200, {
          exec_set_id: execSetB.id,
          case_file_id: execSetB.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: now,
          last_shown_at: null,
          ever_changed: true,
          has_new_diff: true,
          should_auto_popup: true,
          summary: { added: 0, updated: 1, deleted: 0 },
          diff: [
            {
              kind: 'updated',
              case_item_id: 21,
              changed_fields: ['steps'],
              old: { module: 'B模块', title: 'B改', priority: 'P0', precondition: '', steps: 'B旧步骤', expected: '成功', remark: '' },
              new: { module: 'B模块', title: 'B改', priority: 'P0', precondition: '', steps: 'B新步骤', expected: '成功', remark: '' },
            },
          ],
        });
      }

      if (pathName.endsWith('/case-library-diff/ack') && method === 'POST') {
        return respond(200, { detail: 'ok' });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        return respond(200, []);
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

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffCaseName')).toContainText('用例B');

    const activeIdBefore = await page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : ''));
    expect(activeIdBefore).toBe(String(execSetA.id));

    const tabs = page.locator('#tempExecCaseLibraryDiffCaseTabs button');
    await expect(tabs).toHaveCount(2);
    await expect(page.locator('#tempExecCaseLibraryDiffCaseTabs')).toContainText('用例A');
    await expect(page.locator('#tempExecCaseLibraryDiffCaseTabs')).toContainText('用例B');

    // 选择当前 diff 用例：切到用例B的执行视图
    await page.click('#tempExecCaseLibraryDiffSelectCaseBtn');
    const activeIdAfterSelect = await page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : ''));
    expect(activeIdAfterSelect).toBe(String(execSetB.id));

    // 切换查看用例A的 diff，并验证过滤药丸作用于“当前查看的 diff 用例”
    await page.click('#tempExecCaseLibraryDiffCaseTabs button:has-text(\"用例A\")');
    await expect(page.locator('#tempExecCaseLibraryDiffCaseName')).toContainText('用例A');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('A改');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('A删');

    // 切换用例后应重置过滤状态（药丸不应处于 active）
    const deletedPill = page.locator('#tempExecCaseLibraryDiffDeletedPill');
    await expect(deletedPill).not.toHaveClass(/active/);

    await page.click('#tempExecCaseLibraryDiffDeletedPill');
    await expect(deletedPill).toHaveClass(/active/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('A删');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).not.toContainText('A改');
  });

  test('用例库同步失败时：变更按钮仍可点击并触发重试', async ({ page }) => {
    const token = 'token-case-lib-retry';
    const user = { id: 13, username: 'retry_user', role: 'user', level: 'member' };
    const project = { id: 9, name: '同步重试项目', description: 'case lib retry' };
    const versions = [{ id: 91, name: 'v1' }];
    const now = new Date().toISOString();
    const execSet = { id: 3101, project_id: project.id, version_id: versions[0].id, case_file_id: 777, name: '同步重试用例', status: 'active', created_at: now, updated_at: now };
    const diffEntry = {
      kind: 'updated',
      case_item_id: 21,
      changed_fields: ['steps'],
      old: { module: '账号', title: '修改邮箱', priority: 'P1', precondition: '已登录', steps: '旧步骤', expected: '成功', remark: '' },
      new: { module: '账号', title: '修改邮箱', priority: 'P1', precondition: '已登录', steps: '新步骤', expected: '成功', remark: '' },
    };
    let syncCalls = 0;

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [execSet]);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        syncCalls += 1;
        if (syncCalls === 1) return respond(500, { detail: 'sync failed' });
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: now,
          last_shown_at: null,
          ever_changed: true,
          has_new_diff: true,
          should_auto_popup: false,
          summary: { added: 0, updated: 1, deleted: 0 },
          diff: [diffEntry],
        });
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-diff/ack` && method === 'POST') {
        return respond(200, { detail: 'ok' });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 9101,
            exec_set_id: execSet.id,
            case_item_id: 21,
            module: '账号',
            title: '修改邮箱',
            expected: '成功',
            priority: 'P1',
            precondition: '已登录',
            steps: '旧步骤',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();
    await btn.click();

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('修改邮箱');
    expect(syncCalls).toBeGreaterThanOrEqual(2);
  });

  test('复用类型变更只记录diff不自动弹窗', async ({ page }) => {
    const token = 'token-case-lib-reuse-change';
    const user = { id: 18, username: 'reuse_change_user', role: 'user', level: 'member' };
    const project = { id: 58, name: '复用变更项目', description: 'reuse change diff' };
    const versions = [{ id: 581, name: 'v1' }];
    const now = new Date().toISOString();
    const execSet = {
      id: 5811,
      project_id: project.id,
      version_id: versions[0].id,
      case_file_id: 8811,
      name: '复用类型变更用例',
      status: 'active',
      created_at: now,
      updated_at: now,
    };

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

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
        return respond(200, [execSet]);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        const diffEntry = {
          kind: 'updated',
          case_item_id: null,
          changed_fields: ['title'],
          old: { module: '用例类型', title: '非复用', priority: null, precondition: '-', steps: '-', expected: '-', remark: null },
          new: { module: '用例类型', title: '复用', priority: null, precondition: '-', steps: '-', expected: '-', remark: null },
        };
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: null,
          last_shown_at: null,
          ever_changed: true,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { added: 0, updated: 1, deleted: 0, appended: 0 },
          diff: [],
          history: [
            {
              diff_at: now,
              operator: 'owner',
              summary: { added: 0, updated: 1, deleted: 0, appended: 0 },
              diff: [diffEntry],
            },
          ],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 8812,
            exec_set_id: execSet.id,
            case_item_id: 1,
            module: '模块A',
            title: '复用场景',
            expected: '成功',
            priority: 'P0',
            precondition: '无',
            steps: '步骤1',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).not.toHaveClass(/open/);

    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();
    await expect(btn).not.toHaveClass(/has-new/);

    await btn.click();
    await expect(diffDrawer).toHaveClass(/open/);
    const body = page.locator('#tempExecCaseLibraryDiffBody');
    await expect(body).toContainText('用例类型');
    await expect(body).toContainText('旧：非复用');
    await expect(body).toContainText('新：复用');
  });
});
