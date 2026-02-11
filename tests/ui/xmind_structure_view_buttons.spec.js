const { test, expect } = require('@playwright/test');

async function ensureMindElixirReady(page, url) {
  var maxRetry = 3;
  for (var i = 0; i < maxRetry; i += 1) {
    var ready = false;
    try {
      await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 8000 });
      ready = await page.evaluate(() => {
        var app = window.app || {};
        var api = app.mindElixirCoreApi || null;
        var hasApi = Boolean(api && typeof api.buildMindDataFromCases === 'function' && typeof api.renderMindMap === 'function');
        var globalObj = null;
        if (typeof MindElixir !== 'undefined') {
          globalObj = MindElixir;
        } else if (window && window.MindElixir) {
          globalObj = window.MindElixir;
        }
        var hasCtor = false;
        if (typeof globalObj === 'function') {
          hasCtor = true;
        } else if (globalObj && typeof globalObj.default === 'function') {
          hasCtor = true;
        }
        return hasApi && hasCtor;
      });
    } catch (err) {
      ready = false;
    }
    if (ready) return;
    if (i < maxRetry - 1) {
      await page.goto(url);
    }
  }
  throw new Error('MindElixir 依赖未就绪，请重试');
}

async function gotoExec(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/case-exec.html';
  await page.goto(url);
  await ensureMindElixirReady(page, url);
  return base;
}

async function gotoCaseLibrary(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/case-library.html';
  await page.goto(url);
  await ensureMindElixirReady(page, url);
  return base;
}

async function waitExecReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.tempExecApi, {}, { timeout: 30000 });
}

async function waitCaseLibraryReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.caseLibraryBound === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', {}, { timeout: 30000 });
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab(name);
    }
  }, tabName);
}

async function getDrawerWidthRatio(page) {
  return page.evaluate(() => {
    var panel = document.querySelector('#xmindStructureDrawer .drawer-panel');
    if (!panel || !panel.getBoundingClientRect) return 0;
    var rect = panel.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth || 1;
    if (!vw) return 0;
    return rect.width / vw;
  });
}

async function getCanvasTransform(page, selector) {
  return page.locator(selector).evaluate((el) => {
    if (!el) return '';
    var styleVal = el.style && el.style.transform ? el.style.transform : '';
    if (styleVal) return String(styleVal);
    var computed = typeof getComputedStyle === 'function' ? getComputedStyle(el).transform : '';
    return String(computed || '');
  });
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

  return page.route('**/*', async (route) => {
    const reqUrl = route.request().url();
    const method = route.request().method();
    const url = new URL(reqUrl);
    const pathName = url.pathname;
    const auth = route.request().headers()['authorization'] || '';
    const authed = auth === `Bearer ${token}`;

    const respond = (status, body) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (!pathName.startsWith('/api/')) {
      if (reqUrl.startsWith('http://localhost') || reqUrl.startsWith('http://127.0.0.1') || reqUrl.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    }

    if (pathName === '/api/users/me' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, user);
    }
    if (pathName === '/api/projects' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, [project]);
    }
    const versionsMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
    if (versionsMatch && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, versions);
    }
    if (pathName === '/api/case-files' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, caseFiles);
    }
    if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, []);
    }
    const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
    if (itemsMatch && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      const fid = Number(itemsMatch[1]);
      return respond(200, (caseItemsByFileId[fid] || []).slice());
    }

    if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
    if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
    if (pathName === '/api/models' && method === 'GET') return respond(200, []);
    if (pathName === '/api/features' && method === 'GET') return respond(200, []);
    if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
    if (pathName === '/api/auth/logout') return respond(200, {});
    return respond(200, []);
  });
}

test.describe('XMind 结构展示按钮', () => {
  test('执行页支持 XMind 结构展示并切换主题', async ({ page }) => {
    const fileId = 'temp-xmind-structure-1';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
    }, {
      files: [{
        id: fileId,
        name: '支付执行集',
        requirement: '支付需求',
        cases: [{
          module: '支付模块',
          title: '余额不足时支付失败',
          priority: 'P1',
          preconditions: '账号已登录',
          steps: '提交支付订单',
          expected: '提示余额不足',
          actual: '未执行',
          remark: '',
        }],
      }],
      versions: [],
      activeId: fileId,
    });

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    await gotoExec(page);
    await waitExecReady(page);
    await page.evaluate((nextId) => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.setTempExecActive === 'function') {
        window.app.tempExecApi.setTempExecActive(nextId);
      }
    }, fileId);

    await page.waitForFunction(() => {
      const card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });
    await expect(page.locator('#tempExecXmindViewBtn')).toBeVisible();
    await expect(page.locator('#tempExecXmindViewBtn')).toBeEnabled();

    await page.click('#tempExecXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('支付模块');
    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('余额不足时支付失败');
    var drawerWidthRatio = await getDrawerWidthRatio(page);
    expect(drawerWidthRatio).toBeGreaterThanOrEqual(0.66);

    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-action="zoom-out"]')).toBeVisible();
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-action="zoom-fit"]')).toBeVisible();
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]')).toBeVisible();
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-search-input]')).toBeVisible();
    await page.evaluate(() => {
      window.__tempExecXmindExportClicks = 0;
      if (window.app && window.app.tempExecApi) {
        window.app.tempExecApi.exportTempExecToXmind = function() {
          window.__tempExecXmindExportClicks += 1;
          return Promise.resolve(true);
        };
      }
    });
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-action="export-xmind"]')).toBeVisible();
    await page.click('#tempExecXmindStructureViewer [data-mind-action="export-xmind"]');
    await page.waitForFunction(() => window.__tempExecXmindExportClicks === 1);
    await page.fill('#tempExecXmindStructureViewer [data-mind-search-input]', '余额不足时支付失败');
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-search-count]')).toHaveText(/1\s*\/\s*1/);
    await expect(page.locator('#tempExecXmindStructureViewer me-tpc.xmind-search-active .text')).toContainText('余额不足时支付失败');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="search-clear"]');
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-search-count]')).toHaveText(/0\s*\/\s*0/);

    var transformBeforeZoom = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    var transformAfterZoom = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(transformAfterZoom).not.toBe(transformBeforeZoom);

    var canvas = page.locator('#tempExecXmindStructureViewer .xmind-structure-canvas');
    var dragBox = await canvas.boundingBox();
    if (!dragBox) throw new Error('执行页 XMind 画布未渲染');
    var transformBeforeDrag = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.mouse.move(dragBox.x + (dragBox.width / 2), dragBox.y + (dragBox.height / 2));
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(dragBox.x + (dragBox.width / 2) + 120, dragBox.y + (dragBox.height / 2) + 30);
    await page.mouse.up({ button: 'right' });
    var transformAfterDrag = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(transformAfterDrag).not.toBe(transformBeforeDrag);

    var firstNode = page.locator('#tempExecXmindStructureViewer me-tpc .text').first();
    var firstNodeBox = await firstNode.boundingBox();
    if (!firstNodeBox) throw new Error('执行页 XMind 节点未渲染');
    await page.mouse.move(firstNodeBox.x - 10, firstNodeBox.y - 10);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(firstNodeBox.x + firstNodeBox.width + 12, firstNodeBox.y + firstNodeBox.height + 12);
    await page.mouse.up({ button: 'left' });

    const lightBg = await page.locator('#xmindStructureDrawerBody .xmind-structure-viewer').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(180);
    const darkBg = await page.locator('#xmindStructureDrawerBody .xmind-structure-viewer').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    expect(lightBg).not.toBe(darkBg);
    expect(darkBg).toBe('rgb(15, 23, 42)');
  });

  test('用例库支持 XMind 结构展示并切换主题', async ({ page }) => {
    const token = 'token-case-library-xmind-structure';
    const user = { id: 19, username: 'xmind_admin', role: 'admin', level: 'leader' };
    const project = { id: 101, name: '结构展示项目' };
    const versions = [{ id: 201, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 901;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '订单用例集',
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
      id: 8101,
      case_file_id: caseFileId,
      module: '订单模块',
      title: '创建订单成功',
      priority: 'P1',
      precondition: '账号已登录',
      steps: '填写地址并提交订单',
      expected: '订单创建成功',
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
    }, { token });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await expect(page.locator(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`)).toBeVisible();
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();

    await expect(page.locator('#caseLibraryXmindViewBtn')).toBeEnabled();
    await page.click('#caseLibraryXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('订单模块');
    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('创建订单成功');
    var drawerWidthRatio = await getDrawerWidthRatio(page);
    expect(drawerWidthRatio).toBeGreaterThanOrEqual(0.66);
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="zoom-out"]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="zoom-fit"]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="zoom-in"]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-search-input]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="export-xmind"]')).toBeVisible();
    await page.click('#caseLibraryXmindStructureViewer [data-mind-action="export-xmind"]');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    await page.fill('#caseLibraryXmindStructureViewer [data-mind-search-input]', '创建订单成功');
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-search-count]')).toHaveText(/1\s*\/\s*1/);
    await expect(page.locator('#caseLibraryXmindStructureViewer me-tpc.xmind-search-active .text')).toContainText('创建订单成功');

    var beforeZoom = await getCanvasTransform(page, '#caseLibraryXmindStructureViewer .map-canvas');
    await page.click('#caseLibraryXmindStructureViewer [data-mind-action="zoom-in"]');
    var afterZoom = await getCanvasTransform(page, '#caseLibraryXmindStructureViewer .map-canvas');
    expect(afterZoom).not.toBe(beforeZoom);

    const lightBg = await page.locator('#xmindStructureDrawerBody .xmind-structure-viewer').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(180);
    const darkBg = await page.locator('#xmindStructureDrawerBody .xmind-structure-viewer').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    expect(lightBg).not.toBe(darkBg);
    expect(darkBg).toBe('rgb(15, 23, 42)');
  });
});
