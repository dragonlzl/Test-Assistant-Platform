const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/case-library.html';
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(url);
      return base;
    } catch (err) {
      lastErr = err;
      const msg = err && err.message ? String(err.message) : String(err || '');
      const canRetry = msg.indexOf('ERR_EMPTY_RESPONSE') !== -1 || msg.indexOf('net::ERR_EMPTY_RESPONSE') !== -1;
      if (!canRetry || i === 2) throw err;
      await page.waitForTimeout(300);
    }
  }
  throw lastErr || new Error('page.goto failed');
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
  let retriedGoto = false;
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
          path: (window.location && window.location.pathname) ? String(window.location.pathname) : '',
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

    if (!retriedGoto && last && last.path && last.path.indexOf('login') !== -1) {
      retriedGoto = true;
      await page.evaluate(() => {
        try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
      });
      const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
      await page.goto(base + '/case-library.html');
      await page.waitForTimeout(200);
      continue;
    }

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
    if (!retriedReload && last && last.hasApp && !last.authReady && last.token) {
      retriedReload = true;
      await reloadWithRetry(page);
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
  }

  throw new Error('waitCaseLibraryReady timeout: ' + JSON.stringify(last || {}));
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

function buildCaseLibraryRoutes(page, options) {
  const {
    token,
    user,
    project,
    versions,
    caseFiles,
    caseItemsByFileId,
  } = options;
  let nextId = 9000;

  return page.route('**/api/**', async (route) => {
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
    if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

    if (pathName === '/api/missing-modules' && method === 'GET') return respond(200, []);
    if (pathName === '/api/missing-types' && method === 'GET') return respond(200, []);
    if (pathName.startsWith('/api/missing-modules/') && pathName.endsWith('/items') && method === 'GET') {
      return respond(200, []);
    }

    if (pathName === '/api/case-files' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      const pid = url.searchParams.get('project_id');
      if (pid !== String(project.id)) return respond(200, []);
      return respond(200, caseFiles.slice());
    }

    const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
    if (itemsMatch && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      const fid = Number(itemsMatch[1]);
      return respond(200, (caseItemsByFileId[fid] || []).slice());
    }
    if (itemsMatch && method === 'POST') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      const fid = Number(itemsMatch[1]);
      const payload = route.request().postDataJSON() || {};
      const created = {
        id: nextId++,
        case_file_id: fid,
        module: payload.module || '',
        title: payload.title || '',
        expected: payload.expected || '',
        priority: payload.priority || null,
        precondition: payload.precondition || '',
        steps: payload.steps || '',
        remark: payload.remark || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      caseItemsByFileId[fid] = (caseItemsByFileId[fid] || []).concat([created]);
      return respond(201, created);
    }

    if (pathName === '/api/auth/logout') return respond(200, {});
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  });
}

test.describe('用例库 AI 用例生成', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('未配置模型时点击提示配置入口', async ({ page }) => {
    const token = 'token-case-library-ai-no-model';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 11, name: '项目AI' };
    const versions = [{ id: 21, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 300;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '用例库AI',
      reuse_enabled: false,
      item_count: 2,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    }];
    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = [{
      id: 6001,
      case_file_id: caseFileId,
      module: '登录',
      title: '登录成功',
      priority: 'P1',
      precondition: '已注册账号',
      steps: '输入正确账号密码',
      expected: '登录成功',
      remark: '',
      created_at: now,
      updated_at: now,
    }];

    await buildCaseLibraryRoutes(page, {
      token,
      user,
      project,
      versions,
      caseFiles,
      caseItemsByFileId,
    });

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', '[]'); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', '{}'); } catch (_) {}
    }, { token });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);
    await switchToTab(page, 'case-library');

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await expect(page.locator(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`)).toBeVisible();
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditView')).toContainText('登录成功');

    await page.click('#caseLibraryAiGenBtn');
    await expect(page.locator('.temp-center-toast')).toContainText('请到AI功能-功能指派 页面下，配置该功能模型。');
    await expect(page.locator('#caseLibraryAiGenDrawer')).not.toHaveClass(/open/);
  });

  test('生成用例后可勾选并追加到编辑视图', async ({ page }) => {
    const token = 'token-case-library-ai-gen';
    const user = { id: 10, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 12, name: '项目AI-生成' };
    const versions = [{ id: 22, name: 'v2' }];
    const now = new Date().toISOString();
    const caseFileId = 301;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '用例库AI生成',
      reuse_enabled: false,
      item_count: 1,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    }];
    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = [{
      id: 6101,
      case_file_id: caseFileId,
      module: '登录',
      title: '登录成功',
      priority: 'P1',
      precondition: '已注册账号',
      steps: '输入正确账号密码',
      expected: '登录成功',
      remark: '',
      created_at: now,
      updated_at: now,
    }];

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const modelId = 'case-library-gen-model';
    const modelBaseUrl = base + '/mock-case-library-gen';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(payload.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(payload.assignments)); } catch (_) {}
    }, {
      token,
      models: [{
        id: modelId,
        name: '用例库生成模型',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { caseLibraryGenId: modelId },
    });

    await page.route('**/mock-case-library-gen', async (route) => {
      const payload = {
        missing_modules: [{
          module: '支付',
          coverage: 0,
          cases: [{
            module: '支付',
            title: '支付成功',
            priority: 'P1',
            precondition: '',
            steps: '选择商品并完成支付',
            expected: '支付成功并提示结果',
            remark: '',
          }],
        }],
        existing_modules: [{
          module: '登录',
          coverage: 60,
          cases: [{
            module: '登录',
            title: '登录失败-密码错误',
            priority: 'P1',
            precondition: '',
            steps: '输入错误密码',
            expected: '提示密码错误',
            remark: '',
          }],
        }],
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      });
    });

    await buildCaseLibraryRoutes(page, {
      token,
      user,
      project,
      versions,
      caseFiles,
      caseItemsByFileId,
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);
    await switchToTab(page, 'case-library');

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await expect(page.locator(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`)).toBeVisible();
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditView')).toContainText('登录成功');

    await page.click('#caseLibraryAiGenBtn');
    await expect(page.locator('#caseLibraryAiGenDrawer')).toHaveClass(/open/);

    await page.fill('#caseLibraryAiGenRequirementInput', '需求：支持登录与支付');
    await page.click('#caseLibraryAiGenRunBtn');
    await expect(page.locator('#caseLibraryAiGenStatus')).toContainText('生成完成');
    await expect(page.locator('#caseLibraryAiGenResult')).toBeVisible();
    await expect(page.locator('#caseLibraryAiGenResultBody')).toContainText('缺失');
    await expect(page.locator('#caseLibraryAiGenResultBody')).toContainText('60%');
    await expect(page.locator('#caseLibraryAiGenBtn')).toHaveClass(/has-badge/);
    await expect(page.locator('#openCaseLibraryEditDrawerBtn')).not.toHaveClass(/case-library-ai-gen-dot/);

    await page.click('#caseLibraryAiGenDrawer .drawer-header [data-drawer-close="caseLibraryAiGenDrawer"]');
    await expect(page.locator('#caseLibraryAiGenDrawer')).not.toHaveClass(/open/);

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await expect(page.locator('#openCaseLibraryEditDrawerBtn')).not.toHaveClass(/case-library-ai-gen-dot/);
    const editBtnSelector = `#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`;
    await expect(page.locator(editBtnSelector)).not.toHaveClass(/case-library-ai-gen-dot/);
    await page.click(editBtnSelector);
    await expect(page.locator('#caseLibraryEditDrawer')).not.toHaveClass(/open/);

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await expect(page.locator(editBtnSelector)).not.toHaveClass(/case-library-ai-gen-dot/);
    await page.click(editBtnSelector);
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();

    await page.click('#caseLibraryAiGenBtn');
    await expect(page.locator('#caseLibraryAiGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryAiGenBtn')).not.toHaveClass(/has-badge/);

    await page.click('#caseLibraryAiGenSelectAllBtn');
    await expect(page.locator('#caseLibraryAiGenAppendBtn')).toBeEnabled();
    await page.click('#caseLibraryAiGenAppendBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('确定追加');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('.temp-center-toast')).toContainText('追加 2条 用例成功！');
    await expect(page.locator('#caseLibraryAiGenResultBody td.ai-gen-appended-cell').getByText('支付成功', { exact: true })).toBeVisible();
    await expect(page.locator('#caseLibraryAiGenResultBody td.ai-gen-appended-cell').getByText('登录失败-密码错误', { exact: true })).toBeVisible();
    await expect(page.locator('#caseLibraryAiGenResultBody td').getByText('支付成功', { exact: true }).locator('..').locator('input[data-case-lib-ai-select]')).toBeDisabled();
    await expect(page.locator('#caseLibraryAiGenResultBody td').getByText('登录失败-密码错误', { exact: true }).locator('..').locator('input[data-case-lib-ai-select]')).toBeDisabled();

    await expect(page.locator('#caseLibraryEditView')).toContainText('支付成功');
    await expect(page.locator('#caseLibraryEditView')).toContainText('登录失败-密码错误');

    await reloadWithRetry(page);
    await waitCaseLibraryReady(page, 30000);
    await switchToTab(page, 'case-library');
    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await expect(page.locator(editBtnSelector)).toBeVisible();
    await page.click(editBtnSelector);
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryAiGenBtn')).not.toHaveClass(/has-badge/);

    await page.click('#caseLibraryAiGenBtn');
    await expect(page.locator('#caseLibraryAiGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryAiGenResultBody td.ai-gen-appended-cell').getByText('支付成功', { exact: true })).toBeVisible();
    await expect(page.locator('#caseLibraryAiGenResultBody td').getByText('支付成功', { exact: true }).locator('..').locator('input[data-case-lib-ai-select]')).toBeDisabled();
  });

  test('生成过程中切换用例不影响生成', async ({ page }) => {
    const token = 'token-case-library-ai-switch';
    const user = { id: 11, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 13, name: '项目AI-切换' };
    const versions = [{ id: 23, name: 'v3' }];
    const now = new Date().toISOString();
    const caseFileIdA = 401;
    const caseFileIdB = 402;
    const caseFiles = [{
      id: caseFileIdA,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '用例库A',
      reuse_enabled: false,
      item_count: 1,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    }, {
      id: caseFileIdB,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '用例库B',
      reuse_enabled: false,
      item_count: 1,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    }];
    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileIdA] = [{
      id: 6201,
      case_file_id: caseFileIdA,
      module: '支付',
      title: '支付入口展示',
      priority: 'P1',
      precondition: '',
      steps: '进入支付页',
      expected: '展示支付入口',
      remark: '',
      created_at: now,
      updated_at: now,
    }];
    caseItemsByFileId[caseFileIdB] = [{
      id: 6202,
      case_file_id: caseFileIdB,
      module: '购物车',
      title: '加入购物车',
      priority: 'P2',
      precondition: '',
      steps: '加入购物车',
      expected: '成功加入',
      remark: '',
      created_at: now,
      updated_at: now,
    }];

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const modelId = 'case-library-gen-model-switch';
    const modelBaseUrl = base + '/mock-case-library-gen-switch';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('cleaner-models-v1', JSON.stringify(payload.models)); } catch (_) {}
      try { localStorage.setItem('cleaner-assignment-v1', JSON.stringify(payload.assignments)); } catch (_) {}
    }, {
      token,
      models: [{
        id: modelId,
        name: '用例库生成模型',
        provider: 'custom',
        baseUrl: modelBaseUrl,
        apiKey: 'mock-key',
        model: 'mock-model',
        maxTokens: 512,
      }],
      assignments: { caseLibraryGenId: modelId },
    });

    await page.route('**/mock-case-library-gen-switch', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const payload = {
        missing_modules: [{
          module: '支付',
          coverage: 0,
          cases: [{
            module: '支付',
            title: '支付成功',
            priority: 'P1',
            precondition: '',
            steps: '选择商品并完成支付',
            expected: '支付成功并提示结果',
            remark: '',
          }],
        }],
        existing_modules: [],
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      });
    });

    await buildCaseLibraryRoutes(page, {
      token,
      user,
      project,
      versions,
      caseFiles,
      caseItemsByFileId,
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);
    await switchToTab(page, 'case-library');

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await expect(page.locator(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileIdA}"]`)).toBeVisible();
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileIdA}"]`);
    await expect(page.locator('#caseLibraryEditCard')).toContainText('用例库A');

    await page.click('#caseLibraryAiGenBtn');
    await expect(page.locator('#caseLibraryAiGenDrawer')).toHaveClass(/open/);
    await page.fill('#caseLibraryAiGenRequirementInput', '需求：支付流程');
    await page.click('#caseLibraryAiGenRunBtn');
    await page.click('#caseLibraryAiGenDrawer .drawer-header [data-drawer-close="caseLibraryAiGenDrawer"]');
    await expect(page.locator('#caseLibraryAiGenDrawer')).not.toHaveClass(/open/);

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await expect(page.locator(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileIdB}"]`)).toBeVisible();
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileIdB}"]`);
    await expect(page.locator('#caseLibraryEditCard')).toContainText('用例库B');

    await page.waitForFunction(() => {
      const raw = localStorage.getItem('tap-case-library-ai-gen-task:case-library');
      if (!raw) return false;
      try {
        const task = JSON.parse(raw);
        return task && task.status === 'done';
      } catch (_) {
        return false;
      }
    }, null, { timeout: 10000 });

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileIdA}"]`);
    await expect(page.locator('#caseLibraryEditCard')).toContainText('用例库A');

    await page.click('#caseLibraryAiGenBtn');
    await expect(page.locator('#caseLibraryAiGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryAiGenStatus')).toContainText('生成完成');
    await expect(page.locator('#caseLibraryAiGenResultBody')).toContainText('支付成功');
  });
});
