const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

async function seedCaseGenState(page, options) {
  const opts = options || {};
  const requirement = opts.requirement || 'UI自动化需求';
  const modules = opts.modules || [
    { module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] },
    { module: '支付', key_scenarios: [], test_points: [], coupled_modules: [] },
  ];
  await page.evaluate(() => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('clean');
  });
  await page.evaluate((payload) => {
    const text = payload && payload.text ? payload.text : '';
    const label = payload && payload.label ? payload.label : '';
    const el = document.getElementById('splitResult');
    if (el) {
      el.removeAttribute('readonly');
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.requirementLabel = label;
      window.app.state.requirementLabelSource = 'ui-test';
    }
  }, { text: JSON.stringify(modules), label: requirement });
  await page.evaluate(() => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab('casesgen');
  });
  await page.waitForSelector('#casesGenerationContainer [data-module-id]', { timeout: 8000 });

  await page.evaluate((cfg) => {
    const state = window.app && window.app.state ? window.app.state : null;
    if (!state || !Array.isArray(state.caseGenModules) || !state.caseGenModules.length) return;

    const list = state.caseGenModules.slice();
    const makeCase = (moduleName, title) => ({
      module: moduleName,
      title: title,
      priority: 'P1',
      preconditions: '前置条件',
      steps: ['步骤1', '步骤2'],
      expected: '预期结果',
    });

    list.forEach((mod, idx) => {
      const title = mod && (mod.title || mod.module) ? String(mod.title || mod.module) : ('模块' + idx);
      const cases = cfg && cfg.noGenerateIndex === idx
        ? []
        : [makeCase(title, title + '-用例1')];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      if (!state.caseSelections) state.caseSelections = {};
      state.caseSelections[mod.id] = new Set();
      if (cfg && cfg.selectIndex === idx) {
        state.caseSelections[mod.id].add(0);
      }
    });

    if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
      window.app.casesGenApi.renderCaseGeneration();
    }
    if (window.app.casesGenApi && typeof window.app.casesGenApi.refreshAppendExistingButton === 'function') {
      window.app.casesGenApi.refreshAppendExistingButton();
    }
  }, {
    selectIndex: opts.selectIndex === undefined ? 0 : opts.selectIndex,
    noGenerateIndex: opts.noGenerateIndex,
  });
}

async function confirmDrawer(page, options) {
  const opts = options || {};
  const drawer = page.locator('#appConfirmDrawer');
  await expect(drawer).toHaveClass(/open/);
  if (opts.messageIncludes && opts.messageIncludes.length) {
    for (const msg of opts.messageIncludes) {
      await expect(page.locator('#appConfirmDrawerMessage')).toContainText(msg);
    }
  } else if (opts.message) {
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText(opts.message);
  }
  if (opts.inputValue !== undefined) {
    await page.fill('#appConfirmDrawerInput', String(opts.inputValue));
  }
  const prevMessage = await page.locator('#appConfirmDrawerMessage').evaluate((el) => el.textContent || '').catch(() => '');
  await page.click('#appConfirmDrawerConfirmBtn');
  await page.waitForFunction((prev) => {
    const el = document.getElementById('appConfirmDrawer');
    if (!el) return true;
    if (!el.classList.contains('open') && !el.classList.contains('closing')) return true;
    const msgEl = document.getElementById('appConfirmDrawerMessage');
    const next = msgEl ? (msgEl.textContent || '') : '';
    return String(next).trim() !== String(prev || '').trim();
  }, prevMessage);
}

async function cancelConfirmDrawer(page, options) {
  const opts = options || {};
  const drawer = page.locator('#appConfirmDrawer');
  await expect(drawer).toHaveClass(/open/);
  if (opts.messageIncludes && opts.messageIncludes.length) {
    for (const msg of opts.messageIncludes) {
      await expect(page.locator('#appConfirmDrawerMessage')).toContainText(msg);
    }
  } else if (opts.message) {
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText(opts.message);
  }
  await page.click('#appConfirmDrawerCancelBtn');
  await expect(drawer).not.toHaveClass(/open/);
}

test.describe('用例生成-新用例入库/旧用例追加入库', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('用例生成说明包含生成与补全规则', async ({ page }) => {
    const token = 'token-casegen-guide';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('casesgen');
      }
    });
    await page.click('#pageGuideTrigger');
    const drawer = page.locator('#pageGuideDrawer');
    await expect(drawer).toHaveClass(/open/);
    const guide = page.locator('#pageGuideDrawerBody');
    await expect(guide).toContainText('生成用例');
    await expect(guide).toContainText('补全生成');
    await expect(guide).toContainText('全模块直接生成');
    await expect(guide).toContainText('全模块补全生成');
    await expect(guide).toContainText('生成规则与区别');
  });

  test('新用例入库未勾选时标红全选按钮', async ({ page }) => {
    const token = 'token-casegen-store-select-all-hint';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1 });
    await page.selectOption('#caseGenStoreActionSelect', 'store');
    await page.click('#caseGenStoreNewBtn');

    const drawer = page.locator('#caseGenViewDrawer');
    await expect(drawer).toHaveClass(/open/);
    const selectAllBtn = page.locator('#caseGenAllSelectBtn');
    await expect(selectAllBtn).toHaveClass(/casegen-select-all-hint/);
    await selectAllBtn.click();
    await expect(selectAllBtn).not.toHaveClass(/casegen-select-all-hint/);
  });

  test('新用例入库：未选择“入库后动作”会提示并标红', async ({ page }) => {
    const token = 'token-casegen-store-action';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: 0 });
    await expect(page.locator('#caseGenStoreActionHint')).toBeVisible();
    await expect(page.locator('#caseGenStoreActionHint')).toContainText('在【全模块用例视图】中勾选用例');

    const storeBtn = page.locator('#caseGenStoreNewBtn');
    await expect(storeBtn).toBeEnabled();
    await storeBtn.click();

    await expect(page.locator('#caseGenStatus')).toContainText('请先选择', { timeout: 3000 });
    await expect(page.locator('#caseGenStoreActionSelect')).toHaveClass(/input-invalid/);
  });

  test('全模块用例视图：支持全选/取消全选所有模块用例', async ({ page }) => {
    const token = 'token-casegen-select-all';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1 });

    await page.click('#caseGenAllViewBtn');
    await expect(page.locator('#caseGenViewDrawer')).toHaveClass(/open/);

    const selectAllBtn = page.locator('#caseGenAllSelectBtn');
    await expect(selectAllBtn).toBeVisible();
    await selectAllBtn.click();

    const checkboxes = page.locator('#caseGenViewDrawerBody input[data-case-select]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
    await expect(selectAllBtn).toContainText('取消全选所有模块用例');

    await selectAllBtn.click();
    for (let i = 0; i < count; i += 1) {
      await expect(checkboxes.nth(i)).not.toBeChecked();
    }
  });

  test('新用例入库：视图勾选后关闭自动进入入库抽屉', async ({ page }) => {
    const token = 'token-casegen-store-unchecked';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1 });
    await page.selectOption('#caseGenStoreActionSelect', 'store');
    await page.click('#caseGenStoreNewBtn');

    const viewDrawer = page.locator('#caseGenViewDrawer');
    await expect(viewDrawer).toHaveClass(/open/);
    const viewContainer = page.locator('#caseGenViewDrawerBody .caseview');
    await expect(viewContainer).toHaveCount(2);
    await expect(viewContainer).toHaveClass([/caseview-selection-hint/, /caseview-selection-hint/]);

    await page.click('#closeCaseGenViewDrawerBtn');
    await expect(viewDrawer).not.toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawer')).not.toHaveClass(/open/);

    await page.click('#caseGenStoreNewBtn');
    await expect(viewDrawer).toHaveClass(/open/);
    await page.click('#caseGenViewDrawerBody input[data-case-select]');
    const count = await viewContainer.count();
    for (let i = 0; i < count; i += 1) {
      await expect(viewContainer.nth(i)).not.toHaveClass(/caseview-selection-hint/);
    }
    await page.click('#closeCaseGenViewDrawerBtn');
    await expect(viewDrawer).not.toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawerTitle')).toContainText('新用例入库');
  });

  test('旧用例追加入库：视图勾选后关闭自动进入入库抽屉', async ({ page }) => {
    const token = 'token-casegen-append-unchecked';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1 });
    await page.click('#caseGenStoreAppendBtn');

    const viewDrawer = page.locator('#caseGenViewDrawer');
    await expect(viewDrawer).toHaveClass(/open/);
    const viewContainer = page.locator('#caseGenViewDrawerBody .caseview');
    await expect(viewContainer).toHaveCount(2);
    await expect(viewContainer).toHaveClass([/caseview-selection-hint/, /caseview-selection-hint/]);
    await page.click('#caseGenViewDrawerBody input[data-case-select]');
    const count = await viewContainer.count();
    for (let i = 0; i < count; i += 1) {
      await expect(viewContainer.nth(i)).not.toHaveClass(/caseview-selection-hint/);
    }
    await page.click('#closeCaseGenViewDrawerBtn');
    await expect(viewDrawer).not.toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreDrawerTitle')).toContainText('旧用例追加入库');
  });

  test('进度模块点击：有用例时打开用例视图', async ({ page }) => {
    const token = 'token-casegen-progress-open';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1 });
    const moduleId = await page.evaluate(() => {
      const list = window.app && window.app.state && Array.isArray(window.app.state.caseGenModules)
        ? window.app.state.caseGenModules
        : [];
      return list && list[0] ? list[0].id : '';
    });
    await page.click(`#caseGenProgressList [data-casegen-module="${moduleId}"]`);

    const viewDrawer = page.locator('#caseGenViewDrawer');
    await expect(viewDrawer).toHaveClass(/open/);
    await expect(page.locator(`#caseGenViewDrawerBody [data-view-container="${moduleId}"]`)).toBeVisible();
  });

  test('进度模块点击：无用例时不打开用例视图', async ({ page }) => {
    const token = 'token-casegen-progress-empty';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1, noGenerateIndex: 0 });
    const moduleId = await page.evaluate(() => {
      const list = window.app && window.app.state && Array.isArray(window.app.state.caseGenModules)
        ? window.app.state.caseGenModules
        : [];
      return list && list[0] ? list[0].id : '';
    });
    await page.click(`#caseGenProgressList [data-casegen-module="${moduleId}"]`);

    const viewDrawer = page.locator('#caseGenViewDrawer');
    await expect(viewDrawer).not.toHaveClass(/open/);
  });

  test('进度面板高度自适应并可滚动', async ({ page }) => {
    const token = 'token-casegen-progress-scroll';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

    await page.setViewportSize({ width: 1280, height: 720 });
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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    const modules = Array.from({ length: 30 }, (_, idx) => ({
      module: `模块${idx + 1}`,
      key_scenarios: [],
      test_points: [],
      coupled_modules: [],
    }));
    await seedCaseGenState(page, { selectIndex: -1, modules });
    await page.evaluate(() => {
      if (window.app && typeof window.app.renderCaseGenProgressBoard === 'function') {
        window.app.renderCaseGenProgressBoard();
      }
    });

    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const panel = document.getElementById('caseGenProgressPanel');
      const list = document.getElementById('caseGenProgressList');
      if (!sidebar || !panel || !list) return null;
      const sidebarRect = sidebar.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      return {
        sidebarHeight: sidebarRect.height,
        panelHeight: panelRect.height,
        panelBottom: panelRect.bottom,
        sidebarBottom: sidebarRect.bottom,
        listScrollHeight: list.scrollHeight,
        listClientHeight: list.clientHeight,
      };
    });
    expect(metrics).not.toBeNull();
    expect(metrics.panelHeight).toBeLessThanOrEqual(metrics.sidebarHeight);
    expect(metrics.panelBottom).toBeLessThanOrEqual(metrics.sidebarBottom + 2);
    expect(metrics.listScrollHeight).toBeGreaterThan(metrics.listClientHeight + 10);
  });

  test('进度面板支持收起与展开', async ({ page }) => {
    const token = 'token-casegen-progress-toggle';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1 });
    await page.evaluate(() => {
      if (window.app && typeof window.app.renderCaseGenProgressBoard === 'function') {
        window.app.renderCaseGenProgressBoard();
      }
    });

    const toggle = page.locator('#caseGenProgressToggle');
    const panel = page.locator('#caseGenProgressPanel');
    const title = page.locator('#caseGenProgressPanel .panel-head .title');
    await expect(toggle).toHaveText('收起');
    await expect(panel).not.toHaveClass(/is-collapsed/);
    await expect(page.locator('#caseGenProgressList')).toBeVisible();
    await expect(title).toBeVisible();

    const before = await page.evaluate(() => {
      const panelEl = document.getElementById('caseGenProgressPanel');
      const titleRow = panelEl ? panelEl.querySelector('.panel-title-row') : null;
      const titleEl = panelEl ? panelEl.querySelector('.title') : null;
      if (!panelEl || !titleRow || !titleEl) return null;
      const panelRect = panelEl.getBoundingClientRect();
      const rowRect = titleRow.getBoundingClientRect();
      const titleRect = titleEl.getBoundingClientRect();
      const styles = window.getComputedStyle(panelEl);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      return {
        panelWidth: panelRect.width,
        rowWidth: rowRect.width,
        titleTop: titleRect.top,
        titleLeft: titleRect.left,
        titleHeight: titleRect.height,
        paddingLeft: paddingLeft,
        paddingRight: paddingRight,
      };
    });
    expect(before).not.toBeNull();

    await toggle.click();

    await expect(panel).toHaveClass(/is-collapsed/);
    await expect(page.locator('#caseGenProgressList')).toBeHidden();
    await expect(page.locator('#caseGenProgressPanel .panel-head .meta')).toBeHidden();
    await expect(toggle).toHaveText('展开');
    await expect(title).toBeVisible();

    const afterCollapse = await page.evaluate(() => {
      const panelEl = document.getElementById('caseGenProgressPanel');
      const titleRow = panelEl ? panelEl.querySelector('.panel-title-row') : null;
      const titleEl = panelEl ? panelEl.querySelector('.title') : null;
      if (!panelEl || !titleRow || !titleEl) return null;
      const panelRect = panelEl.getBoundingClientRect();
      const rowRect = titleRow.getBoundingClientRect();
      const titleRect = titleEl.getBoundingClientRect();
      const styles = window.getComputedStyle(panelEl);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      return {
        panelWidth: panelRect.width,
        rowWidth: rowRect.width,
        titleTop: titleRect.top,
        titleLeft: titleRect.left,
        titleHeight: titleRect.height,
        paddingLeft: paddingLeft,
        paddingRight: paddingRight,
      };
    });
    expect(afterCollapse).not.toBeNull();
    expect(Math.abs(afterCollapse.titleTop - before.titleTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterCollapse.titleLeft - before.titleLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterCollapse.titleHeight - before.titleHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterCollapse.rowWidth + afterCollapse.paddingLeft + afterCollapse.paddingRight - afterCollapse.panelWidth))
      .toBeLessThanOrEqual(2);

    await toggle.click();

    await expect(panel).not.toHaveClass(/is-collapsed/);
    await expect(page.locator('#caseGenProgressList')).toBeVisible();
    await expect(toggle).toHaveText('收起');
  });

  test('全模块生成按钮提示覆盖并支持取消', async ({ page }) => {
    const token = 'token-casegen-batch-generate';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const modules = [
      { module: '模块A', key_scenarios: [], test_points: [], coupled_modules: [] },
      { module: '模块B', key_scenarios: [], test_points: [], coupled_modules: [] },
      { module: '模块C', key_scenarios: [], test_points: [], coupled_modules: [] },
    ];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1, noGenerateIndex: 2, modules });

    await expect(page.locator('#caseGenAllGenerateBtn')).toBeEnabled();
    await expect(page.locator('#caseGenAllTopupBtn')).toBeEnabled();
    await page.click('#caseGenAllGenerateBtn');
    await cancelConfirmDrawer(page, { messageIncludes: ['模块A', '模块B', '已有生成数据'] });

    const runningCount = await page.evaluate(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      const running = st && st.caseGenRunning ? st.caseGenRunning : null;
      return running && typeof running.size === 'number' ? running.size : 0;
    });
    expect(runningCount).toBe(0);
  });

  test('全模块生成按钮：模块全生成中时不可点击', async ({ page }) => {
    const token = 'token-casegen-batch-running';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const modules = [
      { module: '模块A', key_scenarios: [], test_points: [], coupled_modules: [] },
      { module: '模块B', key_scenarios: [], test_points: [], coupled_modules: [] },
    ];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1, noGenerateIndex: 1, modules });
    await page.evaluate(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st || !Array.isArray(st.caseGenModules)) return;
      st.caseGenModules.forEach((mod) => {
        if (!st.caseGenModuleStatus || typeof st.caseGenModuleStatus !== 'object') {
          st.caseGenModuleStatus = {};
        }
        st.caseGenModuleStatus[mod.id] = { text: '生成中...', type: '' };
        if (window.app && typeof window.app.setCaseModuleRunning === 'function') {
          window.app.setCaseModuleRunning(mod.id, true);
          return;
        }
        if (!(st.caseGenRunning instanceof Set)) st.caseGenRunning = new Set();
        st.caseGenRunning.add(mod.id);
      });
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      }
    });

    await expect(page.locator('#caseGenAllGenerateBtn')).toBeDisabled();
    await expect(page.locator('#caseGenAllTopupBtn')).toBeDisabled();
  });

  test('全模块生成按钮：全部已有生成结果仍可点击', async ({ page }) => {
    const token = 'token-casegen-batch-all-generated';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const modules = [
      { module: '模块A', key_scenarios: [], test_points: [], coupled_modules: [] },
      { module: '模块B', key_scenarios: [], test_points: [], coupled_modules: [] },
    ];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1, modules });

    await expect(page.locator('#caseGenAllGenerateBtn')).toBeEnabled();
    await expect(page.locator('#caseGenAllTopupBtn')).toBeEnabled();
  });

  test('全模块生成按钮：覆盖后触发全部模块生成', async ({ page }) => {
    const token = 'token-casegen-batch-overwrite';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const modules = [
      { module: '模块A', key_scenarios: [], test_points: [], coupled_modules: [] },
      { module: '模块B', key_scenarios: [], test_points: [], coupled_modules: [] },
    ];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1, modules });

    await page.click('#caseGenAllGenerateBtn');
    await confirmDrawer(page, { messageIncludes: ['模块A', '模块B', '已有生成数据'] });

    await page.waitForFunction(() => {
      const st = window.app && window.app.state ? window.app.state : null;
      if (!st || !Array.isArray(st.caseGenModules) || !st.caseGenModules.length) return false;
      return st.caseGenModules.every((mod) => {
        const status = st.caseGenModuleStatus && st.caseGenModuleStatus[mod.id];
        const text = status && status.text ? String(status.text) : '';
        return text.indexOf('未找到用例生成模型') !== -1;
      });
    });
  });

  test('新用例入库：直接入库成功，且会校验未选模块二次确认', async ({ page }) => {
    const token = 'token-casegen-store-new';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    let importedPayload = null;
    const requirement = 'UI自动化需求-新入库';
    const now = new Date().toISOString();

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/case-files/import' && method === 'POST') {
        importedPayload = route.request().postDataJSON();
        return respond(201, {
          id: 100,
          project_id: project.id,
          version_id: versions[0].id,
          file_name_clean: requirement,
          reuse_enabled: false,
          item_count: Array.isArray(importedPayload && importedPayload.items) ? importedPayload.items.length : 0,
          importer_id: user.id,
          importer_name: user.username,
          imported_at: now,
          updated_at: now,
          last_updated_by: user.id,
          last_updated_by_name: user.username,
        });
      }
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { requirement, selectIndex: 0, noGenerateIndex: 1 });

    await page.selectOption('#caseGenStoreActionSelect', 'store');
    await page.click('#caseGenStoreNewBtn');

    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseGenDbStoreProjectSelect', String(project.id));
    await page.selectOption('#caseGenDbStoreVersionSelect', String(versions[0].id));
    await expect(page.locator('#caseGenDbStoreConfirmBtn')).toBeEnabled();
    await page.click('#caseGenDbStoreConfirmBtn');
    await confirmDrawer(page, { messageIncludes: ['支付', '没有选择用例'] });

    await expect(page.locator('#caseGenStatus')).toContainText('入库成功', { timeout: 5000 });
    expect(importedPayload && importedPayload.project_id).toBe(project.id);
    expect(importedPayload && importedPayload.version_id).toBe(versions[0].id);
    expect(String(importedPayload && importedPayload.file_name)).toContain(requirement);

  });

  test('新用例入库：入库并转到执行会创建执行集并切换到执行页', async ({ page }) => {
    const token = 'token-casegen-store-to-exec';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const requirement = 'UI自动化需求-入库并执行';
    const now = new Date().toISOString();
    let createdExecSet = null;

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/case-files/import' && method === 'POST') {
        return respond(201, {
          id: 101,
          project_id: project.id,
          version_id: versions[0].id,
          file_name_clean: requirement,
          reuse_enabled: false,
          item_count: 1,
          importer_id: user.id,
          importer_name: user.username,
          imported_at: now,
          updated_at: now,
          last_updated_by: user.id,
          last_updated_by_name: user.username,
        });
      }
      if (pathName === '/api/exec/sets/from-case-file' && method === 'POST') {
        const body = route.request().postDataJSON();
        createdExecSet = body;
        const hasExecVersion = Object.prototype.hasOwnProperty.call(body, 'exec_version_id');
        const resolvedVersionId = hasExecVersion ? body.exec_version_id : versions[0].id;
        return respond(200, {
          id: 2001,
          project_id: project.id,
          version_id: resolvedVersionId,
          case_file_id: body.case_file_id,
          name: requirement,
          requirement: requirement,
          reuse_enabled: false,
          status: 'active',
          created_at: now,
          updated_at: now,
          case_file_base_updated_at: now,
          case_file_last_synced_at: now,
          case_file_last_diff_at: null,
          case_file_last_diff_json: null,
          case_file_last_diff_shown_at: null,
        });
      }
      if (pathName === '/api/exec/sets' && method === 'GET') {
        const resolvedVersionId = createdExecSet && Object.prototype.hasOwnProperty.call(createdExecSet, 'exec_version_id')
          ? createdExecSet.exec_version_id
          : versions[0].id;
        return respond(200, [
          {
            id: 2001,
            project_id: project.id,
            version_id: resolvedVersionId,
            case_file_id: 101,
            name: requirement,
            requirement: requirement,
            status: 'active',
            created_at: now,
            updated_at: now,
          },
        ]);
      }
      const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (casesMatch && method === 'GET') return respond(200, []);
      const syncMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/case-library-sync$/);
      if (syncMatch && method === 'POST') {
        return respond(200, {
          exec_set_id: Number(syncMatch[1]),
          case_file_id: 101,
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
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { requirement, selectIndex: 0, noGenerateIndex: 1 });

    await page.selectOption('#caseGenStoreActionSelect', 'store_to_exec');
    await page.click('#caseGenStoreNewBtn');
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseGenDbStoreProjectSelect', String(project.id));
    await page.selectOption('#caseGenDbStoreVersionSelect', String(versions[0].id));
    await page.click('#caseGenDbStoreConfirmBtn');
    await confirmDrawer(page, { messageIncludes: ['支付', '没有选择用例'] });

    await expect(page.locator('#execVersionSelectDrawer')).toHaveClass(/open/);
    await expect(page.locator('#execVersionSelectDrawerConfirmBtn')).toBeEnabled();
    await page.click('#execVersionSelectDrawerConfirmBtn');

    await expect.poll(async () => {
      return page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''));
    }, { timeout: 5000 }).toBe('tempexec');

    const active = await page.evaluate(() => (window.app && window.app.state ? window.app.state.tempExecActiveId : ''));
    expect(String(active || '')).toBe('2001');
    expect(createdExecSet && createdExecSet.case_file_id).toBe(101);
  });

  test('旧用例追加入库：选择目标用例后二次确认并调用追加接口', async ({ page }) => {
    const token = 'token-casegen-append';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const caseFiles = [{ id: 300, project_id: project.id, version_id: versions[0].id, file_name_clean: '旧用例A', imported_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    let appendPayload = null;

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, caseFiles);
      if (pathName === `/api/case-files/${caseFiles[0].id}/items/append` && method === 'POST') {
        appendPayload = route.request().postDataJSON();
        return respond(200, {
          case_file_id: caseFiles[0].id,
          project_id: project.id,
          version_id: versions[0].id,
          file_name_clean: caseFiles[0].file_name_clean,
          appended: 1,
          skipped_payload_duplicates: 0,
          skipped_db_conflicts: 0,
          total_payload: Array.isArray(appendPayload && appendPayload.items) ? appendPayload.items.length : 0,
          total_unique: Array.isArray(appendPayload && appendPayload.items) ? appendPayload.items.length : 0,
          updated_at: new Date().toISOString(),
        });
      }
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { requirement: 'UI自动化需求-追加', selectIndex: 0, noGenerateIndex: 1 });

    await page.click('#caseGenStoreAppendBtn');
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseGenDbStoreProjectSelect', String(project.id));
    await page.selectOption('#caseGenDbStoreVersionSelect', String(versions[0].id));
    await expect(page.locator('#caseGenDbStoreCaseFileRow')).not.toHaveClass(/hidden/);
    await page.selectOption('#caseGenDbStoreCaseFileSelect', String(caseFiles[0].id));
    await page.click('#caseGenDbStoreConfirmBtn');
    await confirmDrawer(page, { messageIncludes: ['支付', '没有选择用例'] });

    await expect(page.locator('#caseGenStatus')).toContainText('追加入库成功', { timeout: 5000 });
    expect(appendPayload && Array.isArray(appendPayload.items) && appendPayload.items.length).toBe(1);
    expect(String(appendPayload.items[0].module || '')).toContain('登录');
    const drawer = page.locator('#caseGenDbStoreDrawer');
    await page.click('#caseGenStoreAppendBtn');
    await expect(drawer).toHaveClass(/open/);

  });

  test('旧用例追加入库：取消确认后仍可再次追加入库', async ({ page }) => {
    const token = 'token-casegen-append-cancel';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const caseFiles = [{ id: 300, project_id: project.id, version_id: versions[0].id, file_name_clean: '旧用例A', imported_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    let appendPayload = null;

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, caseFiles);
      if (pathName === `/api/case-files/${caseFiles[0].id}/items/append` && method === 'POST') {
        appendPayload = route.request().postDataJSON();
        return respond(200, { appended: 1 });
      }
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { requirement: 'UI自动化需求-追加取消', selectIndex: 0, noGenerateIndex: 1 });

    await page.click('#caseGenStoreAppendBtn');
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseGenDbStoreProjectSelect', String(project.id));
    await page.selectOption('#caseGenDbStoreVersionSelect', String(versions[0].id));
    await page.selectOption('#caseGenDbStoreCaseFileSelect', String(caseFiles[0].id));
    await page.click('#caseGenDbStoreConfirmBtn');
    await cancelConfirmDrawer(page, { messageIncludes: ['支付', '没有选择用例'] });
    await expect(page.locator('#caseGenDbStoreStatus')).toContainText('已取消追加入库');
    const drawer = page.locator('#caseGenDbStoreDrawer');
    const wasOpen = await drawer.evaluate((el) => el.classList.contains('open'));
    if (wasOpen) {
      await page.evaluate(() => {
        if (window.app && window.app.drawer && typeof window.app.drawer.closeAllDrawers === 'function') {
          window.app.drawer.closeAllDrawers();
        }
      });
      await expect(drawer).not.toHaveClass(/open/);
    }

    await page.click('#caseGenStoreAppendBtn');
    await expect(drawer).toHaveClass(/open/);
    expect(appendPayload).toBeNull();
  });

  test('旧用例追加入库：目标用例存在重复时打开diff并确认覆盖', async ({ page }) => {
    const token = 'token-casegen-append-overwrite';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const caseFiles = [{ id: 300, project_id: project.id, version_id: versions[0].id, file_name_clean: '旧用例A', imported_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    const dbItems = [
      { id: 9001, case_file_id: 300, module: '登录', title: '登录-用例1', priority: 'P1', precondition: '前置条件', steps: '步骤1\n步骤2', expected: '预期结果', remark: '' },
    ];
    let appendPayload = null;

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, caseFiles);
      if (pathName === `/api/case-files/${caseFiles[0].id}/items` && method === 'GET') return respond(200, dbItems);
      if (pathName === `/api/case-files/${caseFiles[0].id}/items/append` && method === 'POST') {
        appendPayload = route.request().postDataJSON();
        return respond(200, {
          case_file_id: caseFiles[0].id,
          project_id: project.id,
          version_id: versions[0].id,
          file_name_clean: caseFiles[0].file_name_clean,
          appended: 0,
          overwritten: 1,
          overwritten_changed: 1,
          skipped_payload_duplicates: 0,
          skipped_db_conflicts: 0,
          skipped_existing_conflicts: 0,
          total_payload: Array.isArray(appendPayload && appendPayload.items) ? appendPayload.items.length : 0,
          total_unique: Array.isArray(appendPayload && appendPayload.items) ? appendPayload.items.length : 0,
          updated_at: new Date().toISOString(),
        });
      }
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { requirement: 'UI自动化需求-追加覆盖', selectIndex: 0, noGenerateIndex: 1 });

    await page.click('#caseGenStoreAppendBtn');
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseGenDbStoreProjectSelect', String(project.id));
    await page.selectOption('#caseGenDbStoreVersionSelect', String(versions[0].id));
    await page.selectOption('#caseGenDbStoreCaseFileSelect', String(caseFiles[0].id));
    await page.click('#caseGenDbStoreConfirmBtn');
    await confirmDrawer(page, { messageIncludes: ['支付', '没有选择用例'] });

    await expect(page.locator('#caseLibraryImportDiffDrawer')).toHaveClass(/open/);
    await page.click('#caseLibraryImportDiffOverwriteBtn');

    await expect(page.locator('#caseGenStatus')).toContainText('追加入库成功', { timeout: 5000 });
    expect(appendPayload && appendPayload.overwrite_existing).toBe(true);

  });
});
