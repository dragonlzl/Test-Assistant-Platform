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

async function enableCaseLibraryMissingReminder(page) {
  const toggle = page.getByLabel('显示易漏用例参考');
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('#caseLibraryMissingReminderTop')).toBeHidden();
  await expect(page.locator('#caseLibraryMissingReminderBottom')).toBeHidden();
  await toggle.check();
  await expect(toggle).toBeChecked();
}

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

async function setupTempExecReminderPage(page, options) {
  const opts = options || {};
  const token = opts.token || '';
  const user = opts.user || {};
  const project = opts.project || {};
  const missingModules = Array.isArray(opts.missingModules) ? opts.missingModules : [];
  const missingTypes = Array.isArray(opts.missingTypes) ? opts.missingTypes : [];
  const missingItemsByModule = opts.missingItemsByModule || {};
  const files = Array.isArray(opts.files) ? opts.files : [];
  const activeId = opts.activeId || (files[0] ? files[0].id : '');
  const aiEnabled = opts.missingReminderAiEnabled === true;

  await page.addInitScript((payload) => {
    const tk = payload && payload.token ? payload.token : '';
    const projectId = payload ? payload.projectId : '';
    const files = Array.isArray(payload && payload.files) ? payload.files : [];
    const activeId = payload && payload.activeId ? payload.activeId : (files[0] ? files[0].id : '');
    try {
      if (tk) localStorage.setItem('tap-auth-token', tk);
      localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
        files: files,
        versions: [],
        placement: { requirementOrder: [], fileOrder: {}, versionOrder: {} },
        collapsed: { req: false, version: false },
        activeId: activeId,
      }));
    } catch (_) {}
  }, { token, projectId: project.id, files, activeId });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
    if (pathName === '/api/projects' && method === 'GET') return respond(200, project ? [project] : []);
    if (project && project.id && pathName === `/api/projects/${project.id}/versions` && method === 'GET') {
      return respond(200, []);
    }
    if (pathName === '/api/settings' && method === 'GET') {
      const settings = [{
        key: 'missingCaseReminderPlacement',
        scope: 'user',
        owner_id: user.id || 0,
        value_json: 'top',
      }];
      if (aiEnabled) {
        settings.push({
          key: 'missingCaseReminderAiEnabled',
          scope: 'user',
          owner_id: user.id || 0,
          value_json: 'on',
        });
      }
      return respond(200, settings);
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
    if (aiEnabled && pathName === '/api/model-proxy' && method === 'POST') {
      return respond(200, { choices: [{ message: { content: JSON.stringify({ ids: ['1'] }) } }] });
    }

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
  await page.evaluate(() => window.app.tempExecApi.loadTempExecState());
  await page.waitForFunction((expected) => {
    return window.app
      && window.app.state
      && Array.isArray(window.app.state.tempExecFiles)
      && window.app.state.tempExecFiles.length === expected;
  }, files.length, { timeout: 10000 });
  if (activeId) {
    await page.evaluate((targetId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(targetId);
      }
    }, activeId);
    await page.waitForFunction((targetId) => {
      return window.app
        && window.app.state
        && window.app.state.tempExecActiveId === targetId;
    }, activeId, { timeout: 10000 });
  }
}

test.describe('易漏用例参考区域', () => {
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
        module: '技能',
        title: '工程师角色的一技能效果',
        priority: 'P1',
        precondition: '已解锁工程师角色',
        steps: '点击一技能按钮',
        expected: '展示技能效果',
      }, {
        id: 1003,
        module: '技能',
        title: '工程师角色二技能效果',
        priority: 'P2',
        precondition: '已解锁工程师角色',
        steps: '点击二技能按钮',
        expected: '展示技能效果',
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
    const missingModules = [{ id: 101, project_id: 1, name: '技能', item_count: 2 }];
    const missingTypes = [{ id: 201, project_id: 1, name: '效果' }];
    const missingItemsByModule = {
      101: [{
        id: 9001,
        module_id: 101,
        title: '工程师角色的一技能效果',
        priority: 'P1',
        precondition: '已解锁工程师角色',
        steps: '点击一技能按钮',
        expected: '展示技能效果',
        type_id: 201,
      }, {
        id: 9002,
        module_id: 101,
        title: '工程师角色二技能效果',
        priority: 'P2',
        precondition: '',
        steps: '点击二技能按钮',
        expected: '',
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
    await enableCaseLibraryMissingReminder(page);

    const reminderTop = page.locator('#caseLibraryMissingReminderTop');
    const reminderBottom = page.locator('#caseLibraryMissingReminderBottom');
    await expect(reminderTop).toBeVisible();
    await expect(reminderTop).toContainText('易漏用例参考');
    await expect(reminderTop.locator('[data-missing-reminder-link]')).toContainText('跳转到易漏用例库');
    await expect(reminderTop).toContainText('匹配得分');
    const reminderRows = reminderTop.locator('tbody tr');
    await expect(reminderRows).toHaveCount(2);
    await expect(reminderRows.nth(0)).toContainText('工程师角色的一技能效果');
    await expect(reminderRows.nth(0).locator('td.score')).toContainText('4');
    await expect(reminderRows.nth(1)).toContainText('工程师角色二技能效果');
    await expect(reminderRows.nth(1).locator('td.score')).toContainText('2');
    await expect(reminderBottom).toBeHidden();

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    const editSecond = page.locator('[data-case-lib-edit="12"]');
    await expect(editSecond).toBeVisible();
    await editSecond.click();
    await expect(reminderTop).toBeHidden();
    await expect(reminderBottom).toBeHidden();
  });

  test('用例库编辑视图仅类型命中也可提醒', async ({ page }) => {
    const token = 'token-missing-reminder-type-only';
    const user = { id: 9, username: 'missing_type', role: 'user', level: 'member' };
    const project = { id: 2, name: '类型命中项目', description: 'missing reminder type only' };
    const versions = [{ id: 1, name: 'v1' }];
    const files = [{ id: 21, file_name_clean: '类型命中用例', project_id: 2, version_id: 1, item_count: 1 }];
    const casesByFileId = {
      21: [{
        id: 2001,
        module: '设置',
        title: '安全提示展示',
        priority: 'P1',
        precondition: '已登录',
        steps: '触发安全验证',
        expected: '展示安全提示',
      }],
    };
    const missingModules = [{ id: 301, project_id: 2, name: '支付', item_count: 1 }];
    const missingTypes = [{ id: 401, project_id: 2, name: '安全' }];
    const missingItemsByModule = {
      301: [{
        id: 9101,
        module_id: 301,
        title: '支付安全提示',
        priority: 'P1',
        precondition: '',
        steps: '',
        expected: '展示安全提示',
        type_id: 401,
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
        }, {
          key: 'missingCaseReminderMatchConfig',
          scope: 'user',
          owner_id: user.id,
          value_json: { type: true, module: false },
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
      if (pathName === '/api/missing-modules' && method === 'GET') return respond(200, missingModules);
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, missingTypes);
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
    const editFirst = page.locator('[data-case-lib-edit="21"]');
    await expect(editFirst).toBeVisible();
    await editFirst.click();
    await enableCaseLibraryMissingReminder(page);

    const reminderTop = page.locator('#caseLibraryMissingReminderTop');
    await expect(reminderTop).toBeVisible();
    await expect(reminderTop).toContainText('支付安全提示');
    await expect(reminderTop.locator('td.score')).toContainText('2');
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

    const files = [
      {
        id: 'exec-file-a',
        name: '执行用例A',
        createdAt: Date.now(),
        requirement: '',
        projectId: project.id,
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
        projectId: project.id,
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
    ];
    await setupTempExecReminderPage(page, {
      token: token,
      user: user,
      project: project,
      missingModules: missingModules,
      missingTypes: missingTypes,
      missingItemsByModule: missingItemsByModule,
      files: files,
      activeId: 'exec-file-a',
    });
    await page.getByRole('button', { name: '更多操作' }).click();
    const reminderToggle = page.getByLabel('显示易漏用例参考');
    await expect(reminderToggle).not.toBeChecked();
    await expect(page.locator('#tempExecView .missing-reminder-card')).toHaveCount(0);
    await reminderToggle.check();
    await page.waitForFunction(() => {
      return window.app && window.app.state && window.app.state.tempExecMissingReminder;
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
    await expect(reminder).toContainText('易漏用例参考');
    await expect(reminder).toContainText('支付失败提示');

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive('exec-file-b');
      }
    });
    await expect(page.locator('#tempExecView .missing-reminder-card')).toHaveCount(0);
  });

  test('执行视图按钮可跳转到易漏用例库抽屉', async ({ page }) => {
    const token = 'token-missing-reminder-jump';
    const user = { id: 0, username: 'missing_jump', role: 'user', level: 'member' };
    const project = { id: 1, name: '跳转项目', description: 'missing reminder jump' };
    const missingModules = [{ id: 302, project_id: 1, name: '支付', item_count: 1 }];
    const missingTypes = [{ id: 402, project_id: 1, name: '安全' }];
    const missingItemsByModule = {
      302: [{
        id: 7801,
        module_id: 302,
        title: '支付失败提示',
        priority: 'P1',
        precondition: '账户余额不足',
        steps: '点击支付',
        expected: '提示余额不足',
        type_id: 402,
      }],
    };
    const files = [
      {
        id: 'exec-file-jump',
        name: '执行用例跳转',
        createdAt: Date.now(),
        requirement: '',
        projectId: project.id,
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
    ];

    await setupTempExecReminderPage(page, {
      token: token,
      user: user,
      project: project,
      missingModules: missingModules,
      missingTypes: missingTypes,
      missingItemsByModule: missingItemsByModule,
      files: files,
      activeId: 'exec-file-jump',
    });

    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByLabel('显示易漏用例参考').check();
    const reminder = page.locator('#tempExecView .missing-reminder-card');
    await expect(reminder).toHaveCount(1, { timeout: 10000 });
    const jumpBtn = reminder.locator('[data-missing-reminder-link]');
    await expect(jumpBtn).toContainText('跳转到易漏用例库');
    await page.addInitScript(() => {
      window.__missingDrawerClosingSeen = false;
      window.__missingDrawerOpenSeen = false;
      window.__missingDrawerOpenFlap = false;
      window.__missingDrawerHiddenAfterOpen = false;
      window.__missingDrawerObserverBound = false;
      let tries = 0;
      function bindObserver() {
        if (window.__missingDrawerObserverBound) return;
        const drawer = document.getElementById('caseLibraryMissingDrawer');
        if (!drawer) return;
        window.__missingDrawerObserverBound = true;
        let lastOpen = drawer.classList && drawer.classList.contains('open');
        if (lastOpen) window.__missingDrawerOpenSeen = true;
        const observer = new MutationObserver(() => {
          if (drawer.classList && drawer.classList.contains('closing')) {
            window.__missingDrawerClosingSeen = true;
          }
          const isOpen = drawer.classList && drawer.classList.contains('open');
          if (isOpen) window.__missingDrawerOpenSeen = true;
          if (lastOpen && !isOpen) window.__missingDrawerOpenFlap = true;
          if (window.__missingDrawerOpenSeen && drawer.classList && drawer.classList.contains('hidden')) {
            window.__missingDrawerHiddenAfterOpen = true;
          }
          lastOpen = Boolean(isOpen);
        });
        observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });
        if (drawer.classList && drawer.classList.contains('closing')) {
          window.__missingDrawerClosingSeen = true;
        }
        if (drawer.classList && drawer.classList.contains('hidden')) {
          window.__missingDrawerHiddenAfterOpen = true;
        }
      }
      function scheduleBind() {
        tries += 1;
        if (tries > 120) return;
        bindObserver();
        if (!window.__missingDrawerObserverBound) {
          setTimeout(scheduleBind, 50);
        }
      }
      scheduleBind();
    });
    await jumpBtn.click();

    await page.waitForURL(/case-library\.html/);
    await waitCaseLibraryReady(page);
    await expect(page.locator('#caseLibraryMissingDrawer')).toHaveClass(/open/);
    await page.waitForTimeout(800);
    const status = await page.evaluate(() => ({
      closingSeen: Boolean(window.__missingDrawerClosingSeen),
      openFlap: Boolean(window.__missingDrawerOpenFlap),
      hiddenAfterOpen: Boolean(window.__missingDrawerHiddenAfterOpen),
    }));
    expect(status.closingSeen).toBe(false);
    expect(status.openFlap).toBe(false);
    expect(status.hiddenAfterOpen).toBe(false);
  });

  test('设置页易漏用例推荐开关需配置模型', async ({ page }) => {
    const token = 'token-missing-reminder-ai-setting';
    const user = { id: 301, username: 'missing_setting', role: 'user', level: 'member' };
    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
      if (pathName.indexOf('/api/projects/') === 0 && pathName.indexOf('/versions') > -1 && method === 'GET') {
        return respond(200, []);
      }
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      return respond(200, method === 'GET' ? [] : {});
    });

    await page.goto(base + '/settings.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    const select = page.locator('#missingReminderAiSelect');
    const saveBtn = page.locator('#saveMissingReminderAi');
    await expect(select).toHaveValue('off');
    await select.selectOption('on');
    await saveBtn.click();
    await expect(select).toHaveValue('off');
    await expect(page.locator('#missingReminderAiStatus')).toContainText('请先在功能指派配置易漏用例推荐模型');
  });

  test('用例库编辑视图AI开启且易漏库为空提示添加', async ({ page }) => {
    const token = 'token-missing-reminder-ai-empty';
    const user = { id: 302, username: 'missing_ai_empty', role: 'user', level: 'member' };
    const project = { id: 5, name: 'AI空库项目', description: 'missing reminder ai empty' };
    const versions = [{ id: 1, name: 'v1' }];
    const files = [{ id: 51, file_name_clean: '空库用例', project_id: 5, version_id: 1, item_count: 1 }];
    const casesByFileId = {
      51: [{
        id: 5101,
        module: '登录',
        title: '账号登录',
        priority: 'P1',
        precondition: '已注册账号',
        steps: '输入账号密码并登录',
        expected: '登录成功',
      }],
    };
    const missingModules = [];
    const missingTypes = [];

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
        }, {
          key: 'missingCaseReminderAiEnabled',
          scope: 'user',
          owner_id: user.id,
          value_json: 'on',
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

      if (pathName === '/api/missing-modules' && method === 'GET') return respond(200, missingModules);
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, missingTypes);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.goto(base + '/case-library.html');
    await waitCaseLibraryReady(page);
    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.locator('#caseLibraryEditProjectSelect').selectOption(String(project.id));
    const editFirst = page.locator('[data-case-lib-edit="51"]');
    await expect(editFirst).toBeVisible();
    await editFirst.click();
    await enableCaseLibraryMissingReminder(page);

    const reminderTop = page.locator('#caseLibraryMissingReminderTop');
    await expect(reminderTop).toBeVisible();
    await expect(reminderTop).toContainText('易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。');
    const aiBtn = reminderTop.locator('.missing-reminder-ai-btn');
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();
    const toast = page.locator('.temp-center-toast');
    await expect(toast).toContainText('易漏库没有任何用例，请点击上方“跳转到易漏用例库”进行添加。');
  });

  test('用例库编辑视图AI推荐可生成并需二次确认', async ({ page }) => {
    const token = 'token-missing-reminder-ai';
    const user = { id: 16, username: 'missing_ai', role: 'admin', level: 'leader' };
    const project = { id: 3, name: 'AI提醒项目', description: 'missing reminder ai' };
    const versions = [{ id: 1, name: 'v1' }];
    const files = [
      { id: 31, file_name_clean: 'AI匹配用例', project_id: 3, version_id: 1, item_count: 1 },
    ];
    const casesByFileId = {
      31: [{
        id: 3001,
        module: '技能',
        title: '工程师角色的一技能效果',
        priority: 'P1',
        precondition: '已解锁工程师角色',
        steps: '点击一技能按钮',
        expected: '展示技能效果',
      }, {
        id: 3002,
        module: '技能',
        title: '工程师角色二技能效果',
        priority: 'P2',
        precondition: '已解锁工程师角色',
        steps: '点击二技能按钮',
        expected: '展示技能效果',
      }],
    };
    const missingModules = [{ id: 501, project_id: 3, name: '技能', item_count: 2 }];
    const missingTypes = [{ id: 601, project_id: 3, name: '效果' }];
    const missingItemsByModule = {
      501: [{
        id: 8801,
        module_id: 501,
        title: '工程师角色的一技能效果',
        priority: 'P1',
        precondition: '已解锁工程师角色',
        steps: '点击一技能按钮',
        expected: '展示技能效果',
        type_id: 601,
      }, {
        id: 8802,
        module_id: 501,
        title: '工程师角色二技能效果',
        priority: 'P2',
        precondition: '',
        steps: '点击二技能按钮',
        expected: '',
        type_id: 601,
      }],
    };
    const modelId = 'missing-reminder-model';
    const modelBaseUrl = base + '/mock-model';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(payload.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(payload.assignments)); } catch (_) {}
    }, {
      token,
      models: [{
        id: modelId,
        name: 'AI推荐模型',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { missingReminderId: modelId },
    });
    await page.route('**/mock-model', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ids: ['2', '1'] }) } }] }),
      });
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
      if (pathName === '/api/settings' && method === 'GET') {
        return respond(200, [{
          key: 'missingCaseReminderPlacement',
          scope: 'user',
          owner_id: user.id,
          value_json: 'top',
        }, {
          key: 'missingCaseReminderAiEnabled',
          scope: 'user',
          owner_id: user.id,
          value_json: 'on',
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
      if (pathName === '/api/missing-modules' && method === 'GET') return respond(200, missingModules);
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, missingTypes);
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 2]);
        return respond(200, missingItemsByModule[moduleId] || []);
      }
      if (pathName === '/api/model-proxy' && method === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return respond(200, { choices: [{ message: { content: JSON.stringify({ ids: ['2', '1'] }) } }] });
      }
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.goto(base + '/case-library.html');
    await waitCaseLibraryReady(page);
    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.locator('#caseLibraryEditProjectSelect').selectOption(String(project.id));
    const editFirst = page.locator('[data-case-lib-edit="31"]');
    await expect(editFirst).toBeVisible();
    await editFirst.click();
    await enableCaseLibraryMissingReminder(page);

    const reminderTop = page.locator('#caseLibraryMissingReminderTop');
    await expect(reminderTop).toBeVisible();
    const aiBtn = reminderTop.locator('.missing-reminder-ai-btn');
    await expect(aiBtn).toBeVisible();
    await expect(reminderTop).toContainText('匹配得分');
    await aiBtn.click();
    await expect(aiBtn).toBeDisabled();
    await expect(reminderTop).toContainText('正在生成 AI 推荐');
    const rows = reminderTop.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('工程师角色二技能效果');
    await expect(rows.nth(1)).toContainText('工程师角色的一技能效果');
    const scoreCells = reminderTop.locator('tbody tr td.score');
    await expect(scoreCells).toHaveCount(2);
    await expect(scoreCells.nth(0)).toContainText(/高|中|低/);
    await expect(scoreCells.nth(1)).toContainText(/高|中|低/);

    await aiBtn.click();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('已有 AI 推荐结果');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);

    await page.evaluate(() => {
      if (window.app && window.app.state && window.app.state.settings) {
        window.app.state.settings.missingCaseReminderAiEnabled = 'off';
        try {
          window.dispatchEvent(new CustomEvent('app-settings-updated', { detail: { keys: ['missingCaseReminderAiEnabled'] } }));
        } catch (err) {
          try {
            const evt = document.createEvent('CustomEvent');
            evt.initCustomEvent('app-settings-updated', false, false, { keys: ['missingCaseReminderAiEnabled'] });
            window.dispatchEvent(evt);
          } catch (err2) {}
        }
      }
    });
    await expect(reminderTop).toContainText('匹配得分');
  });

  test('用例库编辑视图AI推荐切换页面不中断', async ({ page }) => {
    const token = 'token-missing-reminder-ai-switch';
    const user = { id: 18, username: 'missing_ai_switch', role: 'admin', level: 'leader' };
    const project = { id: 9, name: 'AI切换项目', description: 'missing reminder ai switch' };
    const versions = [{ id: 1, name: 'v1' }];
    const files = [
      { id: 91, file_name_clean: 'AI切换用例', project_id: 9, version_id: 1, item_count: 1 },
    ];
    const casesByFileId = {
      91: [{
        id: 9101,
        module: '技能',
        title: '工程师角色的一技能效果',
        priority: 'P1',
        precondition: '已解锁工程师角色',
        steps: '点击一技能按钮',
        expected: '展示技能效果',
      }],
    };
    const missingModules = [{ id: 901, project_id: 9, name: '技能', item_count: 2 }];
    const missingTypes = [{ id: 902, project_id: 9, name: '效果' }];
    const missingItemsByModule = {
      901: [{
        id: 9901,
        module_id: 901,
        title: '工程师角色的一技能效果',
        priority: 'P1',
        precondition: '已解锁工程师角色',
        steps: '点击一技能按钮',
        expected: '展示技能效果',
        type_id: 902,
      }, {
        id: 9902,
        module_id: 901,
        title: '工程师角色二技能效果',
        priority: 'P2',
        precondition: '',
        steps: '点击二技能按钮',
        expected: '',
        type_id: 902,
      }],
    };
    const modelId = 'missing-reminder-model-switch';
    const modelBaseUrl = base + '/mock-model-switch';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(payload.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(payload.assignments)); } catch (_) {}
    }, {
      token,
      models: [{
        id: modelId,
        name: 'AI推荐模型',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { missingReminderId: modelId },
    });
    await page.route('**/mock-model-switch', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ ids: ['2', '1'] }) } }],
        }),
      });
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
      if (pathName === '/api/settings' && method === 'GET') {
        return respond(200, [{
          key: 'missingCaseReminderPlacement',
          scope: 'user',
          owner_id: user.id,
          value_json: 'top',
        }, {
          key: 'missingCaseReminderAiEnabled',
          scope: 'user',
          owner_id: user.id,
          value_json: 'on',
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
      if (pathName === '/api/missing-modules' && method === 'GET') return respond(200, missingModules);
      if (pathName === '/api/missing-types' && method === 'GET') return respond(200, missingTypes);
      if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
        const parts = pathName.split('/');
        const moduleId = Number(parts[parts.length - 2]);
        return respond(200, missingItemsByModule[moduleId] || []);
      }
      if (pathName === '/api/model-proxy' && method === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return respond(200, { choices: [{ message: { content: JSON.stringify({ ids: ['2', '1'] }) } }] });
      }
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.goto(base + '/case-library.html');
    await waitCaseLibraryReady(page);
    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.locator('#caseLibraryEditProjectSelect').selectOption(String(project.id));
    const editFirst = page.locator('[data-case-lib-edit="91"]');
    await expect(editFirst).toBeVisible();
    await editFirst.click();
    await enableCaseLibraryMissingReminder(page);

    const reminderTop = page.locator('#caseLibraryMissingReminderTop');
    await expect(reminderTop).toBeVisible();
    const aiBtn = reminderTop.locator('.missing-reminder-ai-btn');
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();
    await expect(reminderTop).toContainText('正在生成 AI 推荐');
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('tap-missing-reminder-ai-task:case-library');
      if (!raw) return false;
      try {
        const data = JSON.parse(raw);
        return data && data.status === 'running';
      } catch (err) {
        return false;
      }
    });

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('settings');
      }
    });
    await page.waitForURL(/settings\.html/);
    await waitForAppReady(page);
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('tap-missing-reminder-ai-task:case-library');
      if (!raw) return false;
      try {
        const data = JSON.parse(raw);
        return data && data.status;
      } catch (err) {
        return false;
      }
    });

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('case-library');
      }
    });
    await page.waitForURL(/case-library\.html/);
    await waitCaseLibraryReady(page);
    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.locator('#caseLibraryEditProjectSelect').selectOption(String(project.id));
    const editAgain = page.locator('[data-case-lib-edit="91"]');
    await expect(editAgain).toBeVisible();
    await editAgain.click();
    await enableCaseLibraryMissingReminder(page);

    const reminderAgain = page.locator('#caseLibraryMissingReminderTop');
    await expect(reminderAgain).toContainText('工程师角色二技能效果', { timeout: 10000 });
    const scoreCells = reminderAgain.locator('tbody tr td.score');
    await expect(scoreCells.nth(0)).toContainText(/高|中|低/);
  });

  test('执行视图AI推荐按钮可生成建议', async ({ page }) => {
    const token = 'token-missing-reminder-ai-exec';
    const user = { id: 0, username: 'missing_ai_exec', role: 'user', level: 'member' };
    const project = { id: 4, name: 'AI执行项目', description: 'missing reminder ai exec' };
    const missingModules = [{ id: 701, project_id: 4, name: '支付', item_count: 1 }];
    const missingTypes = [{ id: 801, project_id: 4, name: '异常' }];
    const missingItemsByModule = {
      701: [{
        id: 9901,
        module_id: 701,
        title: '支付失败提示',
        priority: 'P1',
        precondition: '账户余额不足',
        steps: '点击支付',
        expected: '提示余额不足',
        type_id: 801,
      }],
    };
    const files = [
      {
        id: 'exec-file-ai',
        name: '执行用例AI',
        createdAt: Date.now(),
        requirement: '',
        projectId: project.id,
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
        }],
      },
    ];
    const modelId = 'missing-reminder-model-exec';
    const modelBaseUrl = base + '/mock-model-exec';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(payload.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(payload.assignments)); } catch (_) {}
    }, {
      models: [{
        id: modelId,
        name: 'AI推荐模型执行',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { missingReminderId: modelId },
    });
    await page.route('**/mock-model-exec', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ids: ['1'] }) } }] }),
      });
    });
    await setupTempExecReminderPage(page, {
      token,
      user,
      project,
      missingModules,
      missingTypes,
      missingItemsByModule,
      files,
      activeId: 'exec-file-ai',
      missingReminderAiEnabled: true,
    });

    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByLabel('显示易漏用例参考').check();
    const reminder = page.locator('#tempExecView .missing-reminder-card');
    await expect(reminder).toHaveCount(1, { timeout: 10000 });
    const aiBtn = reminder.locator('.missing-reminder-ai-btn');
    await expect(aiBtn).toBeVisible();
    await expect(reminder).toContainText('匹配得分');
    await aiBtn.click();
    await expect(reminder).toContainText('支付失败提示');
    const scoreCells = reminder.locator('tbody tr td.score');
    await expect(scoreCells).toHaveCount(1);
    await expect(scoreCells.nth(0)).toContainText(/高|中|低/);
  });
});
