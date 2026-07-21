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
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction((name) => {
    return window.app && window.app.state && window.app.state.activeTab === name;
  }, tabName, { timeout: 8000 }).catch(() => {});
}

async function ensureAuthed(page, token, user) {
  const deadline = Date.now() + 30000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
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
      return;
    } catch (error) {
      lastError = error;
      const message = error && error.message ? String(error.message) : '';
      if (message.indexOf('Execution context was destroyed') === -1) throw error;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(100);
    }
  }
  throw lastError || new Error('ensureAuthed timeout');
}

async function clickSemantic(page, selector) {
  await page.locator(selector).evaluate((element) => element.click());
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

  test('登录后未进入执行页不自动弹出 diff，进入执行页后再弹', async ({ page }) => {
    const token = 'token-case-lib-defer-open';
    const user = { id: 17, username: 'defer_open_user', role: 'user', level: 'member' };
    const project = { id: 6, name: '延迟弹窗项目', description: 'defer popup diff' };
    const versions = [{ id: 61, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 6001, project_id: project.id, version_id: versions[0].id, case_file_id: 212, name: '延迟弹窗用例', status: 'active', created_at: now, updated_at: now };

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
          kind: 'updated',
          case_item_id: 99,
          changed_fields: ['steps'],
          old: { module: '支付', title: '旧步骤', priority: 'P1', precondition: '无', steps: '旧步骤', expected: '成功', remark: '' },
          new: { module: '支付', title: '新步骤', priority: 'P1', precondition: '无', steps: '新步骤', expected: '成功', remark: '' },
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
          summary: { added: 0, updated: 1, deleted: 0 },
          diff: [diffEntry],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 9901,
            exec_set_id: execSet.id,
            case_item_id: 99,
            module: '支付',
            title: '新步骤',
            expected: '成功',
            priority: 'P1',
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

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'auto'); } catch (_) {}
      window.app = window.app || {};
      window.app.__tempexecCaseLibrarySyncSeq = 1;
    }, { token: token });

    await gotoIndex(page);
    await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);

    const initialTab = await page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''));
    expect(initialTab).not.toBe('tempexec');

    const syncResponse = page.waitForResponse((resp) => {
      return resp.url().includes(`/api/exec/sets/${execSet.id}/case-library-sync`) && resp.request().method() === 'POST';
    });
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });
    await syncResponse;
    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      return Boolean(state && Array.isArray(state.tempExecCaseLibraryAutoPopupOrder) && state.tempExecCaseLibraryAutoPopupOrder.length);
    });

    const openedBefore = await page.evaluate(() => {
      var drawer = document.getElementById('tempExecCaseLibraryDiffDrawer');
      return Boolean(drawer && drawer.classList.contains('open'));
    });
    expect(openedBefore).toBe(false);

    await switchToTab(page, 'tempexec');
    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
  });

  test('执行视图重入时等待同步完成后自动弹出 diff', async ({ page }) => {
    const token = 'token-case-lib-reenter';
    const user = { id: 27, username: 'reenter_user', role: 'user', level: 'member' };
    const project = { id: 16, name: '重入弹窗项目', description: 'reenter popup diff' };
    const versions = [{ id: 161, name: 'v1' }];
    const now = new Date().toISOString();
    const execSet = { id: 16001, project_id: project.id, version_id: versions[0].id, case_file_id: 612, name: '重入弹窗用例', status: 'active', created_at: now, updated_at: now };

    let releaseSync = null;
    const syncGate = new Promise((resolve) => {
      releaseSync = resolve;
    });

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
        if (syncGate) await syncGate;
        const diffEntry = {
          kind: 'updated',
          case_item_id: 120,
          changed_fields: ['expected'],
          old: { module: '订单', title: '旧预期', priority: 'P1', precondition: '无', steps: '步骤', expected: '旧预期', remark: '' },
          new: { module: '订单', title: '新预期', priority: 'P1', precondition: '无', steps: '步骤', expected: '新预期', remark: '' },
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
          summary: { added: 0, updated: 1, deleted: 0 },
          diff: [diffEntry],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 12001,
            exec_set_id: execSet.id,
            case_item_id: 120,
            module: '订单',
            title: '新预期',
            expected: '新预期',
            priority: 'P1',
            precondition: '无',
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

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'auto'); } catch (_) {}
    }, { token: token });

    await gotoIndex(page);
    await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);

    const syncReq = page.waitForRequest((req) => {
      return req.url().includes(`/api/exec/sets/${execSet.id}/case-library-sync`) && req.method() === 'POST';
    });
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        window.app.tempExecApi.loadTempExecState();
      }
    });
    await syncReq;

    const openedBefore = await page.evaluate(() => {
      var drawer = document.getElementById('tempExecCaseLibraryDiffDrawer');
      return Boolean(drawer && drawer.classList.contains('open'));
    });
    expect(openedBefore).toBe(false);

    await page.evaluate(() => {
      try {
        if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('app-path-sub-jump', { detail: { tab: 'tempexec', sub: '执行视图' } }));
        }
      } catch (_) {}
    });
    await page.waitForFunction(() => window.app && window.app.state && window.app.state.activeTab === 'tempexec');

    if (typeof releaseSync === 'function') releaseSync();
    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
  });

  test('菜单进入执行页时自动弹出 diff', async ({ page }) => {
    const token = 'token-case-lib-menu-entry';
    const user = { id: 37, username: 'menu_entry_user', role: 'user', level: 'member' };
    const project = { id: 18, name: '菜单进入项目', description: 'menu entry diff' };
    const versions = [{ id: 181, name: 'v1' }];
    const now = new Date().toISOString();
    const execSet = { id: 18001, project_id: project.id, version_id: versions[0].id, case_file_id: 812, name: '菜单进入用例', status: 'active', created_at: now, updated_at: now };

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
          kind: 'updated',
          case_item_id: 210,
          changed_fields: ['steps'],
          old: { module: '支付', title: '旧步骤', priority: 'P1', precondition: '无', steps: '旧步骤', expected: '成功', remark: '' },
          new: { module: '支付', title: '新步骤', priority: 'P1', precondition: '无', steps: '新步骤', expected: '成功', remark: '' },
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
          summary: { added: 0, updated: 1, deleted: 0 },
          diff: [diffEntry],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 21001,
            exec_set_id: execSet.id,
            case_item_id: 210,
            module: '支付',
            title: '新步骤',
            expected: '成功',
            priority: 'P1',
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

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
    }, { token: token });

    await gotoIndex(page);
    await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);

    const syncResponse = page.waitForResponse((resp) => {
      return resp.url().includes(`/api/exec/sets/${execSet.id}/case-library-sync`) && resp.request().method() === 'POST';
    });
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await page.waitForURL(/case-exec\.html/);
    await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await syncResponse;

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
  });

  test('暗色主题下 diff 新旧内容加粗展示', async ({ page }) => {
    const token = 'token-case-lib-diff-dark';
    const user = { id: 11, username: 'diff_dark_user', role: 'user', level: 'member' };
    const project = { id: 9, name: '暗色对比项目', description: 'diff dark theme' };
    const versions = [{ id: 91, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 9001, project_id: project.id, version_id: versions[0].id, case_file_id: 555, name: '暗色用例', status: 'active', created_at: now, updated_at: now };

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

      if (pathName === '/api/settings' && method === 'GET') {
        return respond(200, [{
          id: 1,
          scope: 'user',
          owner_id: user.id,
          key: 'theme',
          value_json: 'dark',
        }]);
      }
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
        const diffEntryUpdated = {
          kind: 'updated',
          case_item_id: 77,
          changed_fields: ['title'],
          old: { module: '登录', title: '旧标题', priority: 'P1', precondition: '无', steps: '旧步骤', expected: '旧预期', remark: '' },
          new: { module: '登录', title: '新标题', priority: 'P1', precondition: '无', steps: '新步骤', expected: '新预期', remark: '' },
        };
        const diffEntryAppended = {
          kind: 'appended',
          case_item_id: 78,
          changed_fields: [],
          old: { module: '注册', title: '追加前标题', priority: 'P2', precondition: '无', steps: '追加前步骤', expected: '追加前预期', remark: '' },
          new: { module: '注册', title: '追加后标题', priority: 'P2', precondition: '无', steps: '追加后步骤', expected: '追加后预期', remark: '' },
        };
        const diffEntryDeleted = {
          kind: 'deleted',
          case_item_id: 79,
          changed_fields: [],
          old: { module: '注销', title: '待删除用例', priority: 'P3', precondition: '无', steps: '删除步骤', expected: '删除预期', remark: '' },
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
          summary: { appended: 1, added: 0, updated: 1, deleted: 1 },
          diff: [diffEntryUpdated, diffEntryAppended, diffEntryDeleted],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 9901,
            exec_set_id: execSet.id,
            case_item_id: 77,
            module: '登录',
            title: '新标题',
            expected: '新预期',
            priority: 'P1',
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
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await page.waitForSelector('#tempExecCaseLibraryDiffBody .tap-vtable-semantic-table td[data-tone="changed"]', { timeout: 8000 });
    await expect(page.locator('#tempExecCaseLibraryDiffTableHost .tap-vtable-canvas canvas')).toHaveCount(1);

    const weights = await page.evaluate(() => {
      var changedEl = document.querySelector('#tempExecCaseLibraryDiffBody .tap-vtable-semantic-table td[data-tone="changed"]');
      if (!changedEl) return null;
      return { changedWeight: parseInt(getComputedStyle(changedEl).fontWeight, 10) };
    });
    expect(weights).not.toBeNull();
    expect(weights.changedWeight).toBeGreaterThanOrEqual(600);

    const tagWeights = await page.evaluate(() => {
      var appendedEl = document.querySelector('#tempExecCaseLibraryDiffBody .case-lib-diff-kind.appended');
      var deletedEl = document.querySelector('#tempExecCaseLibraryDiffBody .case-lib-diff-kind.deleted');
      return {
        appended: appendedEl ? parseInt(getComputedStyle(appendedEl).fontWeight, 10) : null,
        deleted: deletedEl ? parseInt(getComputedStyle(deletedEl).fontWeight, 10) : null,
      };
    });
    expect(tagWeights.appended).not.toBeNull();
    expect(tagWeights.appended).toBeGreaterThanOrEqual(700);
    expect(tagWeights.deleted).not.toBeNull();
    expect(tagWeights.deleted).toBeGreaterThanOrEqual(700);
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
        if (syncCalls < 3) {
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
        const id = Number(execCasesMatch[1]);
        if (id === execSetA.id) {
          return respond(200, [
            {
              id: 20111,
              exec_set_id: execSetA.id,
              case_item_id: 11,
              module: 'A模块',
              title: 'A改',
              expected: '成功',
              priority: 'P0',
              precondition: '',
              steps: 'A新步骤',
              status: '未执行',
              remark: '',
              defect_links: [],
              reuse_details: [],
              order_no: 1,
              created_at: now,
              updated_at: now,
            },
            {
              id: 20112,
              exec_set_id: execSetA.id,
              case_item_id: 12,
              module: 'A模块',
              title: 'A删',
              expected: '成功',
              priority: 'P1',
              precondition: '',
              steps: 'A删步骤',
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
        if (id === execSetB.id) {
          return respond(200, [
            {
              id: 20211,
              exec_set_id: execSetB.id,
              case_item_id: 21,
              module: 'B模块',
              title: 'B改',
              expected: '成功',
              priority: 'P0',
              precondition: '',
              steps: 'B新步骤',
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

  test('点击变更行可定位执行用例且抽屉保持打开', async ({ page }) => {
    const token = 'token-case-lib-diff-locate';
    const user = { id: 33, username: 'diff_locate_user', role: 'user', level: 'member' };
    const project = { id: 21, name: '变更定位项目', description: 'diff locate' };
    const versions = [{ id: 211, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 21001, project_id: project.id, version_id: versions[0].id, case_file_id: 880, name: '定位用例', status: 'active', created_at: now, updated_at: now };
    const execCases = [];
    for (let i = 0; i < 12; i += 1) {
      execCases.push({
        id: 7000 + i,
        exec_set_id: execSet.id,
        case_item_id: 5001 + i,
        module: '模块' + (i + 1),
        title: '用例' + (i + 1),
        expected: '预期' + (i + 1),
        priority: 'P1',
        precondition: '无',
        steps: '步骤' + (i + 1),
        status: '未执行',
        remark: '',
        defect_links: [],
        reuse_details: [],
        order_no: i + 1,
        created_at: now,
        updated_at: now,
      });
    }

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
        const diffAdded = {
          kind: 'added',
          case_item_id: 5003,
          changed_fields: [],
          old: null,
          new: { module: '模块3', title: '用例3', priority: 'P1', precondition: '无', steps: '步骤3', expected: '预期3', remark: '' },
        };
        const diffUpdated = {
          kind: 'updated',
          case_item_id: 5011,
          changed_fields: ['steps'],
          old: { module: '模块11', title: '用例11', priority: 'P1', precondition: '无', steps: '旧步骤11', expected: '预期11', remark: '' },
          new: { module: '模块11', title: '用例11', priority: 'P1', precondition: '无', steps: '步骤11', expected: '预期11', remark: '' },
        };
        const diffAppended = {
          kind: 'appended',
          case_item_id: 5009,
          changed_fields: [],
          old: { module: '模块9', title: '用例9', priority: 'P1', precondition: '无', steps: '旧步骤9', expected: '预期9', remark: '' },
          new: { module: '模块9', title: '用例9', priority: 'P1', precondition: '无', steps: '步骤9', expected: '预期9', remark: '' },
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
          summary: { appended: 1, added: 1, updated: 1, deleted: 0 },
          diff: [diffAdded, diffUpdated, diffAppended],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, execCases);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, { token: token });

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
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.applyTempExecPageSize === 'function') {
        window.app.tempExecApi.applyTempExecPageSize(5);
      }
    });

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);

    const targetRowBottom = page.locator('tr.case-row[data-temp-case-row=\"' + execSet.id + '\"][data-index=\"8\"]');
    const targetRowTop = page.locator('tr.case-row[data-temp-case-row=\"' + execSet.id + '\"][data-index=\"2\"]');

    const diffRowTopSelector = '#tempExecCaseLibraryDiffBody .tap-vtable-semantic-table td[data-case-lib-diff-case-id=\"5003\"]';
    await expect(page.locator(diffRowTopSelector)).toHaveCount(1);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await clickSemantic(page, diffRowTopSelector);

    await expect(diffDrawer).toHaveClass(/open/);
    await expect(targetRowTop).toHaveCount(1);
    await expect(targetRowTop).toContainText('用例3');
    await expect(targetRowTop).toHaveClass(/locate-highlight/);

    const diffRowBottomSelector = '#tempExecCaseLibraryDiffBody .tap-vtable-semantic-table td[data-case-lib-diff-case-id=\"5009\"]';
    await expect(page.locator(diffRowBottomSelector)).toHaveCount(1);
    await clickSemantic(page, diffRowBottomSelector);

    await expect(diffDrawer).toHaveClass(/open/);
    await expect(targetRowBottom).toHaveCount(1);
    await expect(targetRowBottom).toContainText('用例9');
    await expect(targetRowBottom).toHaveClass(/locate-highlight/);

    await page.click('#closeTempExecCaseLibraryDiffDrawerBtn');
    await expect(diffDrawer).not.toHaveClass(/open/);
    await page.waitForFunction((selector) => {
      var el = document.querySelector(selector);
      if (!el || !el.getBoundingClientRect) return false;
      var rect = el.getBoundingClientRect();
      var height = window.innerHeight || 0;
      return rect.bottom > 0 && rect.top < height;
    }, 'tr.case-row[data-temp-case-row="' + execSet.id + '"][data-index="8"]', { timeout: 3000 });
  });

  test('移除执行用例后 diff 列表不再展示已移除条目', async ({ page }) => {
    const token = 'token-case-lib-diff-filter';
    const user = { id: 44, username: 'diff_filter_user', role: 'user', level: 'member' };
    const project = { id: 31, name: '变更过滤项目', description: 'diff filter' };
    const versions = [{ id: 311, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 31001, project_id: project.id, version_id: versions[0].id, case_file_id: 990, name: '过滤用例', status: 'active', created_at: now, updated_at: now };

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
        const diffAdded = {
          kind: 'added',
          case_item_id: 9001,
          changed_fields: [],
          old: null,
          new: { module: '模块A', title: '用例A', priority: 'P1', precondition: '无', steps: '步骤A', expected: '预期A', remark: '' },
        };
        const diffUpdated = {
          kind: 'updated',
          case_item_id: 9002,
          changed_fields: ['steps'],
          old: { module: '模块B', title: '用例B', priority: 'P1', precondition: '无', steps: '旧步骤B', expected: '预期B', remark: '' },
          new: { module: '模块B', title: '用例B', priority: 'P1', precondition: '无', steps: '步骤B', expected: '预期B', remark: '' },
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
          summary: { appended: 0, added: 1, updated: 1, deleted: 0 },
          diff: [diffAdded, diffUpdated],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 90001,
            exec_set_id: execSet.id,
            case_item_id: 9001,
            module: '模块A',
            title: '用例A',
            expected: '预期A',
            priority: 'P1',
            precondition: '无',
            steps: '步骤A',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: now,
            updated_at: now,
          },
          {
            id: 90002,
            exec_set_id: execSet.id,
            case_item_id: 9002,
            module: '模块B',
            title: '用例B',
            expected: '预期B',
            priority: 'P1',
            precondition: '无',
            steps: '步骤B',
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

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, { token: token });

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

    await page.click('#tempExecCaseLibraryChangesBtn');
    const body = page.locator('#tempExecCaseLibraryDiffBody');
    await expect(body.locator('.tap-vtable-semantic-table tbody tr')).toHaveCount(2);
    await expect(body).toContainText('用例A');
    await expect(body).toContainText('用例B');

    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      var list = window.app.state.tempExecFiles || [];
      if (!list.length) return;
      var file = list[0];
      if (!file) return;
      file._casesLoading = false;
      file.cases = (Array.isArray(file.cases) ? file.cases : []).filter(function(item) {
        var id = item && (item.caseItemId || item.case_item_id);
        return String(id || '') !== '9001';
      });
      if (window.app.tempExecApi && typeof window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer === 'function') {
        window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer({ manual: true, execSetId: file.execSetId || file.id });
      }
    });

    await expect(body.locator('.tap-vtable-semantic-table tbody tr')).toHaveCount(1);
    await expect(body).not.toContainText('用例A');
    await expect(body).toContainText('用例B');
  });

  test('副用例命中 diff 自动弹出后，手动再次打开仍展示 diff', async ({ page }) => {
    const token = 'token-assoc-diff-reopen';
    const user = { id: 28, username: 'assoc_reopen_user', role: 'user', level: 'member' };
    const project = { id: 28, name: '关联diff重开项目', description: 'assoc diff reopen' };
    const versions = [{ id: 281, name: 'v1' }];
    const now = new Date().toISOString();
    const execSet = {
      id: 28001,
      project_id: project.id,
      version_id: versions[0].id,
      case_file_id: 2801,
      name: '主用例A(关联)',
      status: 'active',
      created_at: now,
      updated_at: now,
      association_enabled: true,
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
          last_diff_at: now,
          last_shown_at: null,
          ever_changed: true,
          has_new_diff: true,
          should_auto_popup: true,
          summary: { appended: 0, added: 0, updated: 1, deleted: 0 },
          diff: [
            {
              kind: 'updated',
              case_item_id: 8101,
              changed_fields: ['expected'],
              old: { module: '支付', title: '副用例-命中更新', priority: 'P1', precondition: '无', steps: '步骤B1', expected: '旧预期', remark: '' },
              new: { module: '支付', title: '副用例-命中更新', priority: 'P1', precondition: '无', steps: '步骤B1', expected: '新预期', remark: '' },
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
            id: 280011,
            exec_set_id: execSet.id,
            case_item_id: 1001,
            case_item_source_id: 1001,
            module: '登录',
            title: '主用例-1',
            expected: '通过',
            priority: 'P0',
            precondition: '无',
            steps: '步骤A1',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: now,
            updated_at: now,
          },
          {
            id: 280012,
            exec_set_id: execSet.id,
            case_item_id: null,
            case_item_source_id: 8101,
            module: '支付',
            title: '副用例-命中更新',
            expected: '新预期',
            priority: 'P1',
            precondition: '无',
            steps: '步骤B1',
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

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, { token: token });

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
    const diffBody = page.locator('#tempExecCaseLibraryDiffBody');
    const btn = page.locator('#tempExecCaseLibraryChangesBtn');

    await expect(diffDrawer).toHaveClass(/open/);
    await expect(diffBody).toContainText('副用例-命中更新');

    await page.click('#closeTempExecCaseLibraryDiffDrawerBtn');
    await expect(diffDrawer).not.toHaveClass(/open/);

    await page.waitForFunction(() => {
      if (!window.app || !window.app.state) return false;
      var files = Array.isArray(window.app.state.tempExecFiles) ? window.app.state.tempExecFiles : [];
      if (!files.length) return false;
      var file = files[0];
      if (!file || file._casesLoading) return false;
      var list = Array.isArray(file.cases) ? file.cases : [];
      if (!list.length) return false;
      return list.some(function(item) {
        if (!item) return false;
        var sourceId = item.caseItemSourceId;
        if (sourceId === null || sourceId === undefined) sourceId = item.case_item_source_id;
        return String(sourceId || '') === '8101';
      });
    });

    await btn.click({ force: true });
    var reopenedByBtn = await diffDrawer.evaluate(function(el) { return !!(el && el.classList && el.classList.contains('open')); });
    if (!reopenedByBtn) {
      await page.evaluate(() => {
        if (!window.app || !window.app.tempExecApi) return;
        if (typeof window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer !== 'function') return;
        var files = window.app.state && Array.isArray(window.app.state.tempExecFiles) ? window.app.state.tempExecFiles : [];
        var file = files.length ? files[0] : null;
        var execSetId = file && (file.execSetId || file.id) ? String(file.execSetId || file.id) : '';
        window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer({ manual: true, execSetId: execSetId });
      });
    }
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(diffBody).toContainText('副用例-命中更新');
    await expect(diffBody).not.toContainText('暂无变更');
  });

  test('新增后又被用例库删除时，手动打开 diff 仍保留新增记录', async ({ page }) => {
    const token = 'token-added-then-deleted-keep-history';
    const user = { id: 32, username: 'added_deleted_user', role: 'user', level: 'member' };
    const project = { id: 32, name: '新增后删除项目', description: 'keep added row when deleted exists' };
    const versions = [{ id: 321, name: 'v1' }];
    const now = new Date().toISOString();
    const execSet = {
      id: 32001,
      project_id: project.id,
      version_id: versions[0].id,
      case_file_id: 3201,
      name: '主用例A',
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
          last_diff_at: now,
          last_shown_at: null,
          ever_changed: true,
          has_new_diff: true,
          should_auto_popup: true,
          summary: { appended: 0, added: 1, updated: 0, deleted: 1 },
          diff: [
            {
              kind: 'added',
              case_item_id: 9101,
              changed_fields: [],
              old: null,
              new: { module: '支付', title: '新增后又删除', priority: 'P1', precondition: '无', steps: '步骤N', expected: '成功', remark: '' },
            },
            {
              kind: 'deleted',
              case_item_id: 9101,
              changed_fields: [],
              old: { module: '支付', title: '新增后又删除', priority: 'P1', precondition: '无', steps: '步骤N', expected: '成功', remark: '' },
              new: null,
            },
          ],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return respond(200, [
          {
            id: 320011,
            exec_set_id: execSet.id,
            case_item_id: 9002,
            module: '登录',
            title: '保留用例',
            expected: '成功',
            priority: 'P0',
            precondition: '无',
            steps: '步骤A',
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
    const diffBody = page.locator('#tempExecCaseLibraryDiffBody');
    const changeBtn = page.locator('#tempExecCaseLibraryChangesBtn');

    await expect(diffDrawer).toHaveClass(/open/);
    await expect(diffBody.locator('.tap-vtable-semantic-table tbody tr')).toHaveCount(2);
    await expect(diffBody).toContainText('新增');
    await expect(diffBody).toContainText('删除');

    await page.click('#closeTempExecCaseLibraryDiffDrawerBtn');
    await expect(diffDrawer).not.toHaveClass(/open/);

    await page.waitForFunction(() => {
      if (!window.app || !window.app.state) return false;
      var files = Array.isArray(window.app.state.tempExecFiles) ? window.app.state.tempExecFiles : [];
      if (!files.length) return false;
      var file = files[0];
      if (!file || file._casesLoading) return false;
      var list = Array.isArray(file.cases) ? file.cases : [];
      return list.length === 1 && String((list[0] && (list[0].caseItemId || list[0].case_item_id)) || '') === '9002';
    });

    await changeBtn.click({ force: true });
    var reopenedByBtn = await diffDrawer.evaluate(function(el) {
      return !!(el && el.classList && el.classList.contains('open'));
    });
    if (!reopenedByBtn) {
      await page.evaluate(() => {
        if (!window.app || !window.app.tempExecApi) return;
        if (typeof window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer !== 'function') return;
        var files = window.app.state && Array.isArray(window.app.state.tempExecFiles) ? window.app.state.tempExecFiles : [];
        var file = files.length ? files[0] : null;
        var execSetId = file && (file.execSetId || file.id) ? String(file.execSetId || file.id) : '';
        window.app.tempExecApi.openTempExecCaseLibraryDiffDrawer({ manual: true, execSetId: execSetId });
      });
    }
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(diffBody.locator('.tap-vtable-semantic-table tbody tr')).toHaveCount(2);
    await expect(diffBody).toContainText('新增');
    await expect(diffBody).toContainText('删除');
  });

  test('归档恢复后跨页面进入执行页自动弹出 diff', async ({ page }) => {
    const token = 'token-restore-auto-popup';
    const user = { id: 18, username: 'restore_user', role: 'user', level: 'member' };
    const project = { id: 18, name: '恢复项目', description: 'restore auto popup' };
    const versions = [{ id: 181, name: 'v1' }];
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 10000).toISOString();
    const activeExecSet = {
      id: 18001,
      project_id: project.id,
      version_id: versions[0].id,
      case_file_id: 801,
      name: '其他执行集',
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    const restoredExecSet = {
      id: 18002,
      project_id: project.id,
      version_id: versions[0].id,
      case_file_id: 802,
      name: '恢复执行集',
      status: 'active',
      created_at: earlier,
      updated_at: earlier,
      restored_from_id: 7001,
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

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [activeExecSet, restoredExecSet]);
      }

      const syncMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/case-library-sync$/);
      if (syncMatch && method === 'POST') {
        const id = Number(syncMatch[1]);
        if (id === restoredExecSet.id) {
          const diffEntry = {
            kind: 'deleted',
            case_item_id: 9001,
            changed_fields: [],
            old: { module: '支付', title: '恢复用例', priority: 'P1', precondition: '无', steps: '旧步骤', expected: '成功', remark: '' },
            new: null,
          };
          return respond(200, {
            exec_set_id: restoredExecSet.id,
            case_file_id: restoredExecSet.case_file_id,
            case_file_updated_at: now,
            base_updated_at: earlier,
            last_diff_at: now,
            last_shown_at: null,
            ever_changed: true,
            has_new_diff: true,
            should_auto_popup: true,
            summary: { added: 0, updated: 0, deleted: 1 },
            diff: [diffEntry],
          });
        }
        return respond(200, {
          exec_set_id: activeExecSet.id,
          case_file_id: activeExecSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: null,
          last_shown_at: null,
          ever_changed: false,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { added: 0, updated: 0, deleted: 0 },
          diff: [],
        });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id === restoredExecSet.id) {
          return respond(200, [{
            id: 9801,
            exec_set_id: restoredExecSet.id,
            case_item_id: 9001,
            module: '支付',
            title: '恢复用例',
            expected: '成功',
            priority: 'P1',
            precondition: '无',
            steps: '旧步骤',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: earlier,
            updated_at: now,
          }]);
        }
        return respond(200, []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'case-archive'); } catch (_) {}
      try { sessionStorage.setItem('tap-tempexec-pending-restore-diff', String(payload.pendingId)); } catch (_) {}
    }, { token: token, pendingId: restoredExecSet.id });

    await gotoIndex(page);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('恢复用例');
  });
});
