const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

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

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('易漏用例提醒区域', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('用例库编辑视图匹配易漏模块时显示提醒', async ({ page }) => {
    const token = 'token-missing-reminder';
    const user = { id: 7, username: 'missing_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '提醒项目', description: 'missing reminder' };
    const versions = [{ id: 1, name: 'v1' }];
    const files = [
      { id: 11, file_name_clean: '含匹配用例', project_id: 1, version_id: 1, item_count: 1 },
      { id: 12, file_name_clean: '无匹配用例', project_id: 1, version_id: 1, item_count: 1 },
    ];
    const casesByFileId = {
      11: [{
        id: 1001,
        module: '登录',
        title: '登录成功',
        priority: 'P1',
        precondition: '已注册账号',
        steps: '输入账号密码',
        expected: '登录成功',
      }, {
        id: 1003,
        module: '账号',
        title: '安全校验',
        priority: 'P2',
        precondition: '已登录',
        steps: '触发安全验证',
        expected: '验证通过',
      }],
      12: [{
        id: 1002,
        module: '配置',
        title: '设置保存',
        priority: 'P2',
        precondition: '已进入设置',
        steps: '修改配置',
        expected: '保存成功',
      }],
    };
    const missingModules = [{ id: 101, project_id: 1, name: '登录', item_count: 1 }];
    const missingTypes = [{ id: 201, project_id: 1, name: '安全' }];
    const missingItemsByModule = {
      101: [{
        id: 9001,
        module_id: 101,
        title: '登录异常提示',
        priority: 'P1',
        precondition: '',
        steps: '输入错误密码',
        expected: '提示错误',
        type_id: 201,
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
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (pathName === '/api/settings' && method === 'GET') {
        return respond(200, [{
          key: 'missingCaseReminderPlacement',
          scope: 'user',
          owner_id: user.id,
          value_json: 'top',
        }]);
      }
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/case-files' && method === 'GET') return respond(200, files);
      if (pathName.startsWith('/api/case-files/') && pathName.endsWith('/items') && method === 'GET') {
        const parts = pathName.split('/');
        const fileId = Number(parts[parts.length - 2]);
        return respond(200, casesByFileId[fileId] || []);
      }

      if (pathName === '/api/missing-modules' && method === 'GET') {
        return respond(200, missingModules);
      }
      if (pathName === '/api/missing-types' && method === 'GET') {
        return respond(200, missingTypes);
      }
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 2]);
        return respond(200, missingItemsByModule[moduleId] || []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.goto(base + '/case-library.html');
    await waitCaseLibraryReady(page);
    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.locator('#caseLibraryEditProjectSelect').selectOption(String(project.id));
    const editFirst = page.locator('[data-case-lib-edit="11"]');
    await expect(editFirst).toBeVisible();
    await editFirst.click();

    const reminderTop = page.locator('#caseLibraryMissingReminderTop');
    const reminderBottom = page.locator('#caseLibraryMissingReminderBottom');
    await expect(reminderTop).toBeVisible();
    await expect(reminderTop).toContainText('易漏用例提醒');
    await expect(reminderTop).toContainText('登录异常提示');
    await expect(reminderBottom).toBeHidden();

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    const editSecond = page.locator('[data-case-lib-edit="12"]');
    await expect(editSecond).toBeVisible();
    await editSecond.click();
    await expect(reminderTop).toBeHidden();
    await expect(reminderBottom).toBeHidden();
  });

  test('执行视图匹配易漏模块时展示提醒', async ({ page }) => {
    const token = 'token-missing-reminder-exec';
    const user = { id: 0, username: 'missing_exec', role: 'user', level: 'member' };
    const project = { id: 1, name: '执行项目', description: 'missing reminder exec' };
    const missingModules = [{ id: 202, project_id: 1, name: '支付', item_count: 1 }];
    const missingTypes = [{ id: 302, project_id: 1, name: '安全' }];
    const missingItemsByModule = {
      202: [{
        id: 8801,
        module_id: 202,
        title: '支付失败提示',
        priority: 'P1',
        precondition: '账户余额不足',
        steps: '点击支付',
        expected: '提示余额不足',
        type_id: 302,
      }],
    };

    await page.addInitScript((payload) => {
      const tk = payload && payload.token ? payload.token : '';
      const projectId = payload ? payload.projectId : '';
      try {
        if (tk) localStorage.setItem('tap-auth-token', tk);
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [
            {
              id: 'exec-file-a',
              name: '执行用例A',
              createdAt: Date.now(),
              requirement: '',
              projectId: projectId,
              versionId: '',
              reuseEnabled: false,
              reusePresets: [],
              cases: [{
                module: '支付',
                title: '支付成功',
                priority: 'P1',
                precondition: '已绑定卡',
                steps: '确认支付',
                expected: '支付成功',
                actual: '未执行',
                remark: '',
                defectLinks: [],
              }, {
                module: '设置',
                title: '安全验证提示',
                priority: 'P2',
                precondition: '已登录',
                steps: '触发安全验证',
                expected: '展示验证提示',
                actual: '未执行',
                remark: '',
                defectLinks: [],
              }],
            },
            {
              id: 'exec-file-b',
              name: '执行用例B',
              createdAt: Date.now(),
              requirement: '',
              projectId: projectId,
              versionId: '',
              reuseEnabled: false,
              reusePresets: [],
              cases: [{
                module: '设置',
                title: '修改昵称',
                priority: 'P2',
                precondition: '已登录',
                steps: '进入设置修改',
                expected: '保存成功',
                actual: '未执行',
                remark: '',
                defectLinks: [],
              }],
            },
          ],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'exec-file-a',
        }));
      } catch (_) {}
    }, { token, projectId: project.id });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') {
        return respond(200, [{
          key: 'missingCaseReminderPlacement',
          scope: 'user',
          owner_id: user.id,
          value_json: 'top',
        }]);
      }
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);

      if (pathName === '/api/missing-modules' && method === 'GET') return respond(200, missingModules);
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, missingTypes);
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 2]);
        return respond(200, missingItemsByModule[moduleId] || []);
      }

      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.goto(base + '/case-exec.html?tab=tempexec');
    await waitForAppReady(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await page.waitForFunction(() => {
      return window.app
        && window.app.tempExecApi
        && typeof window.app.tempExecApi.loadTempExecState === 'function';
    }, null, { timeout: 10000 });
    const storedTempExec = await page.evaluate(() => {
      try { return localStorage.getItem('usecase-temp-exec-v1') || ''; } catch (_) { return ''; }
    });
    expect(storedTempExec).toBeTruthy();
    await page.evaluate(() => window.app.tempExecApi.loadTempExecState());
    await page.waitForFunction(() => {
      return window.app
        && window.app.state
        && Array.isArray(window.app.state.tempExecFiles)
        && window.app.state.tempExecFiles.length === 2;
    }, null, { timeout: 10000 });
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive('exec-file-a');
      }
    });
    await page.waitForFunction(() => {
      return window.app
        && window.app.state
        && window.app.state.tempExecActiveId === 'exec-file-a';
    }, null, { timeout: 10000 });
    const reminderState = await page.evaluate(() => {
      if (!window.app || !window.app.state) return null;
      const r = window.app.state.tempExecMissingReminder;
      if (!r) return null;
      return {
        loaded: Boolean(r.loaded),
        loading: Boolean(r.loading),
        items: r.items ? r.items.length : 0,
        signature: r.signature || '',
      };
    });
    expect(reminderState).toBeTruthy();
    await page.waitForFunction(() => {
      return window.app
        && window.app.state
        && window.app.state.tempExecMissingReminder
        && window.app.state.tempExecMissingReminder.loaded === true;
    }, null, { timeout: 10000 });
    const reminderCount = await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.state.tempExecMissingReminder) return 0;
      return window.app.state.tempExecMissingReminder.items
        ? window.app.state.tempExecMissingReminder.items.length
        : 0;
    });
    expect(reminderCount).toBeGreaterThan(0);

    const reminder = page.locator('#tempExecView .missing-reminder-card');
    await expect(reminder).toHaveCount(1);
    await expect(reminder).toContainText('支付失败提示');

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive('exec-file-b');
      }
    });
    await expect(page.locator('#tempExecView .missing-reminder-card')).toHaveCount(0);
  });
});
