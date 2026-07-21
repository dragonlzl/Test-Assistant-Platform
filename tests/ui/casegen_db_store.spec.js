const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html?_=' + Date.now().toString(36));
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

async function openCasegenSideTab(page) {
  await page.click('#sidebarTabCasegen');
  await page.waitForSelector('[data-sidebar-panel="casegen"].is-active');
}

async function openMemoSideTab(page) {
  await page.click('#sidebarTabMemo');
  await page.waitForSelector('[data-sidebar-panel="memo"].is-active');
}

async function ensureCasegenProgressExpanded(page) {
  const panel = page.locator('#caseGenProgressPanel');
  const toggle = page.locator('#caseGenProgressToggle');
  const isCollapsed = await panel.evaluate((el) => el.classList.contains('is-collapsed'));
  if (isCollapsed) {
    await toggle.click();
    await expect(panel).not.toHaveClass(/is-collapsed/);
  }
}

async function switchCasegenStoreMode(page, mode) {
  const next = mode === 'append' ? 'append' : 'new';
  const button = page.locator(next === 'append' ? '#caseGenStoreModeAppendBtn' : '#caseGenStoreModeNewBtn');
  const panel = page.locator(next === 'append' ? '#caseGenStoreModeAppendPanel' : '#caseGenStoreModeNewPanel');
  const otherPanel = page.locator(next === 'append' ? '#caseGenStoreModeNewPanel' : '#caseGenStoreModeAppendPanel');
  await button.click();
  await expect(button).toHaveClass(/is-active/);
  await expect(panel).toBeVisible();
  await expect(otherPanel).toBeHidden();
}

async function openCasegenBatchActionDrawer(page, action) {
  const next = action === 'topup'
    ? '#caseGenAllTopupBtn'
    : (action === 'suggested' ? '#caseGenSuggestionGenerateBtn' : '#caseGenAllGenerateBtn');
  await page.click(next);
  await expect(page.locator('#caseGenActionDrawer')).toHaveClass(/open/);
}

async function confirmCasegenBatchActionDrawer(page) {
  await page.click('#caseGenActionDrawerConfirmBtn');
  await expect(page.locator('#caseGenActionDrawer')).not.toHaveClass(/open/);
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
  await page.waitForFunction(() => {
    const state = window.app && window.app.state ? window.app.state : null;
    return state && Array.isArray(state.caseGenModules) && state.caseGenModules.length > 0;
  }, {}, { timeout: 8000 });

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
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
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
    await expect(guide).toContainText('用例生成设置');
    await expect(guide).toContainText('生成模块');
    await expect(guide).toContainText('额外要求填写');
    await expect(guide).toContainText('是否需要考虑边界');
    await expect(guide).toContainText('生成用例');
    await expect(guide).toContainText('补全生成');
    await expect(guide).toContainText('全模块直接生成');
    await expect(guide).toContainText('全模块补全生成');
    await expect(guide).toContainText('仅补全用例');
    await expect(guide).toContainText('生成规则与区别');
  });

  test('用例生成进度模块有生成建议时显示标记', async ({ page }) => {
    const token = 'token-casegen-suggestion-progress';
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
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, {
      modules: [
        { module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] },
      ],
    });
    await openCasegenSideTab(page);
    await ensureCasegenProgressExpanded(page);

    const moduleId = await page.evaluate(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      if (!state || !Array.isArray(state.caseGenModules) || !state.caseGenModules.length) return '';
      const mod = state.caseGenModules[0];
      if (!state.caseGenSuggestions) state.caseGenSuggestions = {};
      state.caseGenSuggestions[mod.id] = '补充说明';
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGenProgressBoard === 'function') {
        window.app.casesGenApi.renderCaseGenProgressBoard();
      }
      return String(mod.id);
    });
    const item = page.locator('[data-casegen-module="' + moduleId + '"]');
    await expect(item).toHaveClass(/has-suggestion/);
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
      if (pathName === '/api/settings' && method === 'GET') {
        return respond(200, [{
          id: 1,
          scope: 'user',
          owner_id: user.id,
          key: 'sidebarTabActive',
          value_json: 'memo',
        }]);
      }
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1 });
    await switchCasegenStoreMode(page, 'new');
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
    await expect(page.locator('#caseGenStoreActionHint')).toContainText('全模块用例视图');

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
    await switchCasegenStoreMode(page, 'new');
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
    await switchCasegenStoreMode(page, 'append');
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
    await openCasegenSideTab(page);
    await seedCaseGenState(page, { selectIndex: -1 });
    await ensureCasegenProgressExpanded(page);
    const moduleId = await page.evaluate(() => {
      const list = window.app && window.app.state && Array.isArray(window.app.state.caseGenModules)
        ? window.app.state.caseGenModules
        : [];
      return list && list[0] ? list[0].id : '';
    });
    await page.evaluate((id) => {
      var item = document.querySelector('#caseGenProgressList [data-casegen-module="' + id + '"]');
      if (item && item.click) item.click();
    }, moduleId);

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
    await openCasegenSideTab(page);
    await seedCaseGenState(page, { selectIndex: -1, noGenerateIndex: 0 });
    await ensureCasegenProgressExpanded(page);
    const moduleId = await page.evaluate(() => {
      const list = window.app && window.app.state && Array.isArray(window.app.state.caseGenModules)
        ? window.app.state.caseGenModules
        : [];
      return list && list[0] ? list[0].id : '';
    });
    await page.evaluate((id) => {
      var item = document.querySelector('#caseGenProgressList [data-casegen-module="' + id + '"]');
      if (item && item.click) item.click();
    }, moduleId);

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
    await openCasegenSideTab(page);

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
    let storedSettings = [];

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
      if (pathName === '/api/settings' && method === 'GET') return respond(200, storedSettings);
      if (pathName === '/api/settings' && method === 'PUT') {
        var payload = {};
        try {
          payload = JSON.parse(route.request().postData() || '{}') || {};
        } catch (err) {
          payload = {};
        }
        var items = Array.isArray(payload.items) ? payload.items : [];
        storedSettings = items.map(function(item) {
          return {
            key: item && item.key ? item.key : '',
            scope: payload.scope || 'user',
            owner_id: user.id,
            value_json: item ? item.value_json : undefined,
          };
        }).filter(function(item) { return item.key; });
        return respond(200, storedSettings);
      }
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
    await openCasegenSideTab(page);
    await ensureCasegenProgressExpanded(page);

    const toggle = page.locator('#caseGenProgressToggle');
    const panel = page.locator('#caseGenProgressPanel');
    const title = page.locator('#caseGenProgressPanel .panel-head .title');
    await expect(toggle).toHaveText('收起');
    await expect(panel).not.toHaveClass(/is-collapsed/);
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
    await expect(page.locator('#caseGenProgressPanel .panel-head .meta')).toBeHidden();
    await expect(toggle).toHaveText('展开');
    await expect(title).toBeVisible();
    await page.waitForFunction(() => {
      return window.app && window.app.state && window.app.state.settings
        && window.app.state.settings.caseGenProgressCollapsed === true;
    });

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
    await expect(toggle).toHaveText('收起');

    await toggle.click();
    await page.waitForFunction(() => {
      return window.app && window.app.state && window.app.state.settings
        && window.app.state.settings.caseGenProgressCollapsed === true;
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await expect(page.locator('#caseGenProgressPanel')).toHaveClass(/is-collapsed/);
  });

  test('用例生成完成后进度页签红点按未读规则显示', async ({ page }) => {
    const token = 'token-casegen-tab-dot';
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
    await openMemoSideTab(page);
    await seedCaseGenState(page, { selectIndex: -1 });
    await page.evaluate(() => {
      if (window.app && typeof window.app.renderCaseGenProgressBoard === 'function') {
        window.app.renderCaseGenProgressBoard();
      }
    });
    await expect(page.locator('#caseGenProgressTabDot')).toHaveClass(/is-visible/);
    await openCasegenSideTab(page);
    await expect(page.locator('#caseGenProgressTabDot')).not.toHaveClass(/is-visible/);

    await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!state || !state.caseGenModules || !state.caseGenModules[0]) return;
      var modId = state.caseGenModules[0].id;
      state.caseGenResults[modId] = '';
      if (api && typeof api.renderCaseGeneration === 'function') api.renderCaseGeneration();
      var cases = [{
        module: '登录',
        title: '登录-用例1',
        priority: 'P1',
        preconditions: '前置条件',
        steps: ['步骤1', '步骤2'],
        expected: '预期结果',
      }];
      state.caseGenResults[modId] = JSON.stringify(cases, null, 2);
      if (api && typeof api.renderCaseGeneration === 'function') api.renderCaseGeneration();
    });
    await expect(page.locator('#caseGenProgressTabDot')).not.toHaveClass(/is-visible/);

    await openMemoSideTab(page);
    await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      if (!state || !state.caseGenModules || !state.caseGenModules[1]) return;
      var modId = state.caseGenModules[1].id;
      state.caseGenResults[modId] = '';
      if (api && typeof api.renderCaseGeneration === 'function') api.renderCaseGeneration();
      var cases = [{
        module: '支付',
        title: '支付-用例1',
        priority: 'P1',
        preconditions: '前置条件',
        steps: ['步骤1', '步骤2'],
        expected: '预期结果',
      }];
      state.caseGenResults[modId] = JSON.stringify(cases, null, 2);
      if (api && typeof api.renderCaseGeneration === 'function') api.renderCaseGeneration();
    });
    await expect(page.locator('#caseGenProgressTabDot')).toHaveClass(/is-visible/);

    await page.waitForFunction(() => {
      try {
        var raw = localStorage.getItem('usecase-workflow-state-v1');
        if (!raw) return false;
        var snapshot = JSON.parse(raw);
        var notice = snapshot && snapshot.data ? snapshot.data.caseGenProgressNotice : null;
        return notice && notice.dotVisible === true;
      } catch (err) {
        return false;
      }
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.settingsReady === true, {}, { timeout: 20000 });
    await expect(page.locator('#caseGenProgressTabDot')).toHaveClass(/is-visible/);
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
    await openCasegenBatchActionDrawer(page, 'generate');
    await confirmCasegenBatchActionDrawer(page);
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

    await openCasegenBatchActionDrawer(page, 'generate');
    await confirmCasegenBatchActionDrawer(page);
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

  test('仅补全用例：只触发有生成建议的模块生成', async ({ page }) => {
    const token = 'token-casegen-suggestion-batch';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const modelRemoteId = 902;
    const modelId = String(modelRemoteId);
    const modules = [
      { module: '模块A', key_scenarios: [], test_points: [], coupled_modules: [] },
      { module: '模块B', key_scenarios: [], test_points: [], coupled_modules: [] },
      { module: '模块C', key_scenarios: [], test_points: [], coupled_modules: [] },
      { module: '模块D', key_scenarios: [], test_points: [], coupled_modules: [] },
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
      if (pathName === '/api/models' && method === 'GET') {
        return respond(200, [{
          id: modelRemoteId,
          name: 'MockCaseGenModel',
          owner_id: user.id,
          scope: 'user',
          config_json: {
            provider: 'custom',
            baseUrl: 'https://mock-model.local/v1/chat/completions',
            apiKey: 'mock-key',
            model: 'mock-model',
            maxTokens: 1024,
          },
        }]);
      }
      if (pathName === '/api/features' && method === 'GET') {
        return respond(200, [{
          id: 5002,
          name: 'default',
          owner_id: user.id,
          scope: 'user',
          config_json: {
            caseGenId: modelId,
            caseGenPrompt: '请仅输出 JSON 数组',
          },
        }]);
      }
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1, modules });
    await page.waitForFunction((expectedModelId) => {
      const state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.assignments || !Array.isArray(state.models)) return false;
      const assigned = state.assignments.caseGenId ? String(state.assignments.caseGenId) : '';
      if (assigned !== String(expectedModelId)) return false;
      return state.models.some((item) => {
        const id = item && item.id !== undefined && item.id !== null ? String(item.id) : '';
        return id === String(expectedModelId);
      });
    }, modelId, { timeout: 10000 });

    await page.evaluate(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      const client = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!state || !Array.isArray(state.caseGenModules) || state.caseGenModules.length < 4 || !client) return;
      if (!state.caseGenSuggestions || typeof state.caseGenSuggestions !== 'object') {
        state.caseGenSuggestions = {};
      }
      const ids = state.caseGenModules.map((mod) => mod.id);
      state.caseGenSuggestions[ids[0]] = '请补充边界场景';
      state.caseGenSuggestions[ids[1]] = '   ';
      state.caseGenSuggestions[ids[2]] = '请增加异常路径';
      state.caseGenSuggestions[ids[3]] = '';

      window.__casegenSuggestionBatchMetrics = { calls: 0, modules: [] };
      client.proxyModelRequest = function(payload, signal) {
        const metrics = window.__casegenSuggestionBatchMetrics;
        const modelPayload = payload && payload.payload ? payload.payload : {};
        const messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
        const userText = messages[1] && messages[1].content ? String(messages[1].content) : '';
        const match = userText.match(/"module":"([^"]+)"/);
        const moduleName = match && match[1] ? match[1] : '模块';
        metrics.calls += 1;
        metrics.modules.push(moduleName);
        const content = JSON.stringify([{
          module: moduleName,
          title: moduleName + '-新用例',
          priority: 'P1',
          precondition: '前置条件',
          steps: ['步骤1'],
          expected: '预期结果',
        }]);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              text: function() {
                return Promise.resolve(JSON.stringify({
                  choices: [{ message: { content } }],
                }));
              },
            });
          }, 50);
          if (signal && typeof signal.addEventListener === 'function') {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('aborted'));
            }, { once: true });
          }
        });
      };

      if (api && typeof api.renderCaseGeneration === 'function') {
        api.renderCaseGeneration();
      }
    });

    await expect(page.locator('#caseGenSuggestionGenerateBtn')).toBeEnabled();
    await openCasegenBatchActionDrawer(page, 'suggested');
    await confirmCasegenBatchActionDrawer(page);

    await page.waitForFunction(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const metrics = window.__casegenSuggestionBatchMetrics || { calls: 0, modules: [] };
      if (!state || !Array.isArray(state.caseGenModules) || state.caseGenModules.length < 4) return false;
      if (metrics.calls !== 2) return false;
      const modules = metrics.modules.slice().sort();
      if (modules.length !== 2 || modules[0] !== '模块A' || modules[1] !== '模块C') return false;
      const titles = state.caseGenModules.map((mod) => {
        const raw = state.caseGenResults && state.caseGenResults[mod.id] ? String(state.caseGenResults[mod.id]) : '[]';
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed) || !parsed.length) return '';
          return parsed[0] && parsed[0].title ? String(parsed[0].title) : '';
        } catch (err) {
          return '';
        }
      });
      return titles[0] === '模块A-新用例'
        && titles[1] === '模块B-用例1'
        && titles[2] === '模块C-新用例'
        && titles[3] === '模块D-用例1';
    }, {}, { timeout: 20000 });
  });

  test('全模块生成：超过10个模块按受控并发执行并最终清理运行态', async ({ page }) => {
    const token = 'token-casegen-batch-concurrency';
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const modelRemoteId = 901;
    const modelId = String(modelRemoteId);
    const modules = Array.from({ length: 12 }).map((_, idx) => ({
      module: '模块' + (idx + 1),
      key_scenarios: [],
      test_points: [],
      coupled_modules: [],
    }));

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
      if (pathName === '/api/models' && method === 'GET') {
        return respond(200, [{
          id: modelRemoteId,
          name: 'MockCaseGenModel',
          owner_id: user.id,
          scope: 'user',
          config_json: {
            provider: 'custom',
            baseUrl: 'https://mock-model.local/v1/chat/completions',
            apiKey: 'mock-key',
            model: 'mock-model',
            maxTokens: 1024,
          },
        }]);
      }
      if (pathName === '/api/features' && method === 'GET') {
        return respond(200, [{
          id: 5001,
          name: 'default',
          owner_id: user.id,
          scope: 'user',
          config_json: {
            caseGenId: modelId,
            caseGenPrompt: '请仅输出 JSON 数组',
          },
        }]);
      }
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await seedCaseGenState(page, { selectIndex: -1, modules });
    await page.waitForFunction((expectedModelId) => {
      const state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.assignments || !Array.isArray(state.models)) return false;
      const assigned = state.assignments.caseGenId ? String(state.assignments.caseGenId) : '';
      if (assigned !== String(expectedModelId)) return false;
      return state.models.some((item) => {
        const id = item && item.id !== undefined && item.id !== null ? String(item.id) : '';
        return id === String(expectedModelId);
      });
    }, modelId, { timeout: 10000 });

    await page.evaluate(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const api = window.app && window.app.casesGenApi ? window.app.casesGenApi : null;
      const client = window.app && window.app.apiClient ? window.app.apiClient : null;
      if (!state || !Array.isArray(state.caseGenModules) || !client) return;
      state.requirementLabel = state.requirementLabel || '批量并发回归';

      if (!(state.caseGenRunning instanceof Set)) state.caseGenRunning = new Set();
      state.caseGenRunning.clear();
      if (!state.caseGenModuleStatus || typeof state.caseGenModuleStatus !== 'object') {
        state.caseGenModuleStatus = {};
      } else {
        Object.keys(state.caseGenModuleStatus).forEach((key) => { delete state.caseGenModuleStatus[key]; });
      }
      if (!state.caseGenProgress || typeof state.caseGenProgress !== 'object') {
        state.caseGenProgress = {};
      } else {
        Object.keys(state.caseGenProgress).forEach((key) => { delete state.caseGenProgress[key]; });
      }
      state.caseGenModules.forEach((mod) => {
        state.caseGenResults[mod.id] = '';
      });

      window.__casegenBatchMetrics = { active: 0, max: 0, calls: 0 };
      client.proxyModelRequest = function(payload, signal) {
        const metrics = window.__casegenBatchMetrics;
        metrics.calls += 1;
        metrics.active += 1;
        if (metrics.active > metrics.max) metrics.max = metrics.active;
        const modelPayload = payload && payload.payload ? payload.payload : {};
        const messages = Array.isArray(modelPayload.messages) ? modelPayload.messages : [];
        const userText = messages[1] && messages[1].content ? String(messages[1].content) : '';
        const match = userText.match(/"module":"([^"]+)"/);
        const moduleName = match && match[1] ? match[1] : '模块';
        const content = JSON.stringify([{
          module: moduleName,
          title: moduleName + '-用例',
          priority: 'P1',
          precondition: '前置条件',
          steps: ['步骤1'],
          expected: '预期结果',
        }]);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            metrics.active -= 1;
            resolve({
              ok: true,
              status: 200,
              text: function() {
                return Promise.resolve(JSON.stringify({
                  choices: [{ message: { content } }],
                }));
              },
            });
          }, 60);
          if (signal && typeof signal.addEventListener === 'function') {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              metrics.active = Math.max(0, metrics.active - 1);
              reject(new Error('aborted'));
            }, { once: true });
          }
        });
      };

      if (api && typeof api.renderCaseGeneration === 'function') {
        api.renderCaseGeneration();
      }
    });

    await openCasegenBatchActionDrawer(page, 'generate');
    await confirmCasegenBatchActionDrawer(page);

    await page.waitForFunction(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      if (!state || !Array.isArray(state.caseGenModules) || !state.caseGenModules.length) return false;
      const allGenerated = state.caseGenModules.every((mod) => {
        const raw = state.caseGenResults && state.caseGenResults[mod.id] ? String(state.caseGenResults[mod.id]).trim() : '';
        return raw && raw !== '[]';
      });
      if (!allGenerated) return false;
      const running = state.caseGenRunning instanceof Set ? state.caseGenRunning.size : 0;
      if (running !== 0) return false;
      return state.caseGenModules.every((mod) => {
        const progress = state.caseGenProgress && state.caseGenProgress[mod.id] ? state.caseGenProgress[mod.id] : null;
        if (!progress) return true;
        const states = [];
        if (Array.isArray(progress.groups)) {
          progress.groups.forEach((group) => {
            if (group && group.state) states.push(String(group.state));
          });
        }
        if (progress.dedupe && progress.dedupe.state) states.push(String(progress.dedupe.state));
        if (progress.finalize && progress.finalize.state) states.push(String(progress.finalize.state));
        return states.indexOf('running') === -1;
      });
    }, {}, { timeout: 20000 });

    const metrics = await page.evaluate(() => window.__casegenBatchMetrics || { max: 0, calls: 0 });
    expect(metrics.calls).toBe(12);
    expect(metrics.max).toBeLessThanOrEqual(5);
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

    await switchCasegenStoreMode(page, 'new');
    await page.selectOption('#caseGenStoreActionSelect', 'store');
    await page.click('#caseGenStoreNewBtn');

    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreEntryNameRow')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caseGenDbStoreEntryNameInput')).toHaveValue(requirement);
    await page.fill('#caseGenDbStoreEntryNameInput', 'UI自动化需求-新入库-自定义名称');
    await page.selectOption('#caseGenDbStoreProjectSelect', String(project.id));
    await page.selectOption('#caseGenDbStoreVersionSelect', String(versions[0].id));
    await expect(page.locator('#caseGenDbStoreConfirmBtn')).toBeEnabled();
    await page.click('#caseGenDbStoreConfirmBtn');
    await confirmDrawer(page, { messageIncludes: ['支付', '没有选择用例'] });

    await expect(page.locator('#caseGenStatus')).toContainText('入库成功', { timeout: 5000 });
    expect(importedPayload && importedPayload.project_id).toBe(project.id);
    expect(importedPayload && importedPayload.version_id).toBe(versions[0].id);
    expect(String(importedPayload && importedPayload.file_name)).toBe('UI自动化需求-新入库-自定义名称.xmind');

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

    await switchCasegenStoreMode(page, 'new');
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

    await page.waitForURL(/case-exec\.html/, { timeout: 10000 });
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 10000 });
    await expect.poll(async () => {
      return page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''));
    }, { timeout: 10000 }).toBe('tempexec');

    await expect.poll(async () => {
      return page.evaluate(() => (window.app && window.app.state ? window.app.state.tempExecActiveId : ''));
    }, { timeout: 10000 }).toBe('2001');
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

    await switchCasegenStoreMode(page, 'append');
    await page.click('#caseGenStoreAppendBtn');
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseGenDbStoreEntryNameRow')).toHaveClass(/hidden/);
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
    await switchCasegenStoreMode(page, 'append');
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

    await switchCasegenStoreMode(page, 'append');
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

    await switchCasegenStoreMode(page, 'append');
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
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('casesgen');
      }
    });
    await page.waitForFunction(() => {
      return window.app
        && window.app.casesGenApi
        && typeof window.app.casesGenApi.openCaseGenDbStoreAppendDrawerWithItems === 'function';
    }, null, { timeout: 8000 });
    await page.evaluate(() => {
      window.app.casesGenApi.openCaseGenDbStoreAppendDrawerWithItems([{
        module: '登录',
        title: '登录-用例1',
        priority: 'P1',
        precondition: '前置条件',
        steps: '步骤1\n步骤2',
        expected: '预期结果',
        remark: '',
      }], {
        source: 'ui-test',
        missingModules: ['支付'],
      });
    });
    await expect(page.locator('#caseGenDbStoreDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseGenDbStoreProjectSelect', String(project.id));
    await page.selectOption('#caseGenDbStoreVersionSelect', String(versions[0].id));
    await page.selectOption('#caseGenDbStoreCaseFileSelect', String(caseFiles[0].id));
    await page.click('#caseGenDbStoreConfirmBtn');
    await confirmDrawer(page, { messageIncludes: ['支付', '没有选择用例'] });

    await expect(page.locator('#caseLibraryImportDiffDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryImportDiffTitle')).toHaveText(/^追加入库差异对比/);
    await expect(page.locator('#caseLibraryImportDiffOverwriteBtn')).toHaveText('确认覆盖并追加入库');
    await page.click('#caseLibraryImportDiffOverwriteBtn');

    await expect(page.locator('#caseGenStatus')).toContainText('追加入库成功', { timeout: 5000 });
    expect(appendPayload && appendPayload.overwrite_existing).toBe(true);

  });
});
