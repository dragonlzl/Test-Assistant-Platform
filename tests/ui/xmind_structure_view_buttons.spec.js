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

async function waitTempExecXmindButtonReady(page) {
  await page.waitForFunction(() => {
    var btn = document.getElementById('tempExecXmindViewBtn');
    if (!btn) return false;
    if (btn.disabled) return false;
    if (btn.classList && btn.classList.contains('hidden')) return false;
    var style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(btn) : null;
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (btn.offsetParent === null) return false;
    if (!btn.getBoundingClientRect) return false;
    var rect = btn.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return true;
  }, {}, { timeout: 15000 });
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

async function getCanvasScale(page, selector) {
  return page.locator(selector).evaluate((el) => {
    if (!el) return 1;
    var transform = '';
    if (el.style && el.style.transform) transform = String(el.style.transform || '');
    if (!transform && typeof getComputedStyle === 'function') {
      transform = String((getComputedStyle(el).transform || ''));
    }
    if (!transform || transform === 'none') return 1;
    var scaleMatch = transform.match(/scale\(([^)]+)\)/);
    if (scaleMatch && scaleMatch[1]) {
      var direct = Number(scaleMatch[1]);
      if (isFinite(direct) && direct > 0) return direct;
    }
    var matrixMatch = transform.match(/matrix\(([^)]+)\)/);
    if (!matrixMatch || !matrixMatch[1]) return 1;
    var parts = matrixMatch[1].split(',');
    if (!parts || parts.length < 2) return 1;
    var a = Number(parts[0]);
    var b = Number(parts[1]);
    if (!isFinite(a)) a = 1;
    if (!isFinite(b)) b = 0;
    var scale = Math.sqrt((a * a) + (b * b));
    if (!isFinite(scale) || scale <= 0) return 1;
    return scale;
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
        }, {
          module: '支付模块',
          title: '优惠券支付成功',
          priority: 'P2',
          preconditions: '账号已登录且有可用优惠券',
          steps: '选择优惠券并提交支付',
          expected: '提示支付成功',
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
    await waitTempExecXmindButtonReady(page);
    await expect(page.locator('#tempExecXmindViewBtn')).toBeVisible();
    await expect(page.locator('#tempExecXmindViewBtn')).toBeEnabled();

    await waitTempExecXmindButtonReady(page);
    await page.click('#tempExecXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);

    const navGuardResult = await page.evaluate(async () => {
      var beforeHref = String(window.location.href || '');
      if (window.history && typeof window.history.back === 'function') {
        window.history.back();
      }
      await new Promise(function(resolve) {
        setTimeout(resolve, 140);
      });
      return {
        beforeHref: beforeHref,
        afterHref: String(window.location.href || ''),
      };
    });
    expect(navGuardResult.afterHref).toBe(navGuardResult.beforeHref);
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);

    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('支付模块');
    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('余额不足时支付失败');
    const execViewerModeEnabled = await page.locator('#xmindStructureDrawerBody').evaluate((el) => {
      return el.classList.contains('is-mind-viewer');
    });
    expect(execViewerModeEnabled).toBeTruthy();
    var drawerWidthRatio = await getDrawerWidthRatio(page);
    expect(drawerWidthRatio).toBeGreaterThanOrEqual(0.66);
    var execFullscreenBtn = page.locator('#tempExecXmindStructureViewer [data-mind-action="drawer-fullscreen"]');
    await expect(execFullscreenBtn).toBeVisible();
    await expect(execFullscreenBtn).toHaveText('全屏');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    var execFullscreenRatio = await getDrawerWidthRatio(page);
    expect(execFullscreenRatio).toBeGreaterThanOrEqual(0.97);
    await expect(execFullscreenBtn).toHaveText('复原');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindStructureDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);
    var execRestoredRatioByBtn = await getDrawerWidthRatio(page);
    expect(execRestoredRatioByBtn).toBeGreaterThanOrEqual(0.66);
    expect(execRestoredRatioByBtn).toBeLessThan(0.97);
    await expect(execFullscreenBtn).toHaveText('全屏');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#xmindStructureDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);
    var execRestoredRatioByEsc = await getDrawerWidthRatio(page);
    expect(execRestoredRatioByEsc).toBeGreaterThanOrEqual(0.66);
    expect(execRestoredRatioByEsc).toBeLessThan(0.97);
    await expect(execFullscreenBtn).toHaveText('全屏');

    await page.waitForTimeout(140);
    var initialScaleJustOpened = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-fit"]');
    var fitScaleJustOpened = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(Math.abs(fitScaleJustOpened - initialScaleJustOpened)).toBeLessThan(0.02);

    await page.waitForTimeout(520);
    var initialScaleAfterOpen = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-fit"]');
    var fitScaleAfterOpen = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(Math.abs(fitScaleAfterOpen - initialScaleAfterOpen)).toBeLessThan(0.02);

    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-action="zoom-out"]')).toBeVisible();
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-action="zoom-fit"]')).toBeVisible();
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]')).toBeVisible();
    const canvasHorizontalScrollEnabled = await page.evaluate(() => {
      var canvas = document.querySelector('#tempExecXmindStructureViewer .xmind-structure-canvas');
      if (!canvas || typeof getComputedStyle !== 'function') return false;
      var style = getComputedStyle(canvas);
      var overflowXReady = style.overflowX === 'auto' || style.overflowX === 'scroll';
      var overflowYReady = style.overflowY === 'auto' || style.overflowY === 'scroll';
      return overflowXReady && overflowYReady;
    });
    expect(canvasHorizontalScrollEnabled).toBeTruthy();
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
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-action="edit-enter"]')).toBeVisible();
    await page.click('#tempExecXmindStructureViewer [data-mind-action="export-xmind"]');
    await page.waitForFunction(() => window.__tempExecXmindExportClicks === 1);
    await page.fill('#tempExecXmindStructureViewer [data-mind-search-input]', '余额不足时支付失败');
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-search-count]')).toHaveText(/1\s*\/\s*1/);
    await page.click('#tempExecXmindStructureViewer [data-mind-action="search-clear"]');
    await expect(page.locator('#tempExecXmindStructureViewer [data-mind-search-count]')).toHaveText(/0\s*\/\s*0/);

    var ctrlDragInitX = 0;
    var ctrlDragInitY = 0;
    var canvasForInitCtrlDrag = page.locator('#tempExecXmindStructureViewer .xmind-structure-canvas');
    var initCtrlDragBox = await canvasForInitCtrlDrag.boundingBox();
    if (!initCtrlDragBox) throw new Error('执行页 XMind 画布未渲染（初始Ctrl拖动）');
    ctrlDragInitX = initCtrlDragBox.x + (initCtrlDragBox.width / 2) - 40;
    ctrlDragInitY = initCtrlDragBox.y + (initCtrlDragBox.height / 2) - 30;
    var transformBeforeInitCtrlDrag = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    var scaleBeforeInitCtrlDrag = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.keyboard.down('Control');
    await page.mouse.move(ctrlDragInitX, ctrlDragInitY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(ctrlDragInitX + 95, ctrlDragInitY + 36, { steps: 8 });
    await page.mouse.up({ button: 'left' });
    await page.keyboard.up('Control');
    var transformAfterInitCtrlDrag = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    var scaleAfterInitCtrlDrag = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(transformAfterInitCtrlDrag).not.toBe(transformBeforeInitCtrlDrag);
    expect(Math.abs(scaleAfterInitCtrlDrag - scaleBeforeInitCtrlDrag)).toBeLessThan(0.001);

    var transformBeforeZoom = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    var transformAfterZoom = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(transformAfterZoom).not.toBe(transformBeforeZoom);

    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-fit"]');
    var fitScale = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    for (var zoomOutIdx = 0; zoomOutIdx < 12; zoomOutIdx += 1) {
      await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-out"]');
    }
    var minReachableScale = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(minReachableScale).toBeLessThan(fitScale - 0.05);
    expect(minReachableScale).toBeGreaterThan(0.04);

    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-fit"]');
    var fitScaleForCtrlWheel = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    var zoomInScaleForCtrlWheel = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(zoomInScaleForCtrlWheel).toBeGreaterThan(fitScaleForCtrlWheel + 0.01);
    await page.evaluate(() => {
      var canvas = document.querySelector('#tempExecXmindStructureViewer .xmind-structure-canvas');
      if (!canvas) return;
      var rect = canvas.getBoundingClientRect();
      for (var i = 0; i < 8; i += 1) {
        var evt = new WheelEvent('wheel', {
          deltaY: 120,
          deltaX: 0,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
          clientX: rect.left + (rect.width / 2),
          clientY: rect.top + (rect.height / 2),
        });
        canvas.dispatchEvent(evt);
      }
    });
    var ctrlWheelZoomBackScale = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(Math.abs(ctrlWheelZoomBackScale - fitScaleForCtrlWheel)).toBeLessThan(0.02);

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

    var ctrlDragStartX = dragBox.x + (dragBox.width / 2) - 30;
    var ctrlDragStartY = dragBox.y + (dragBox.height / 2) - 20;
    var transformBeforeCtrlDrag = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.keyboard.down('Control');
    await page.mouse.move(ctrlDragStartX, ctrlDragStartY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(ctrlDragStartX + 100, ctrlDragStartY + 45, { steps: 8 });
    await page.mouse.up({ button: 'left' });
    await page.keyboard.up('Control');
    var transformAfterCtrlDrag = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(transformAfterCtrlDrag).not.toBe(transformBeforeCtrlDrag);

    const ctrlLeftDragDidNotTriggerBoxSelection = await page.evaluate(() => {
      var viewer = document.querySelector('#tempExecXmindStructureViewer');
      if (!viewer) return false;
      if (viewer.classList && viewer.classList.contains('is-box-selecting')) return false;
      if (viewer.classList && viewer.classList.contains('is-ctrl-left-dragging')) return false;
      var selected = viewer.querySelectorAll('me-tpc.xmind-box-selected');
      if (selected && selected.length > 0) return false;
      var rect = viewer.querySelector('.xmind-box-select-rect');
      if (rect && rect.getBoundingClientRect) {
        var box = rect.getBoundingClientRect();
        if (box.width > 1 && box.height > 1) return false;
      }
      return true;
    });
    expect(ctrlLeftDragDidNotTriggerBoxSelection).toBeTruthy();

    await page.evaluate(() => {
      window.__xmindContextMenuBlocked = false;
      var viewer = document.querySelector('#tempExecXmindStructureViewer');
      if (!viewer || !viewer.addEventListener) return;
      viewer.addEventListener('contextmenu', function(evt) {
        if (evt && evt.defaultPrevented) {
          window.__xmindContextMenuBlocked = true;
        }
      }, { capture: false, once: true });
    });
    var contextX = dragBox.x + Math.max(40, dragBox.width * 0.55);
    var contextY = dragBox.y + Math.max(60, dragBox.height * 0.55);
    await page.mouse.move(contextX, contextY);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    var contextMenuBlocked = await page.evaluate(() => Boolean(window.__xmindContextMenuBlocked));
    expect(contextMenuBlocked).toBeTruthy();

    var wheelGestureBlocked = await page.evaluate(() => {
      var viewer = document.querySelector('#tempExecXmindStructureViewer');
      var canvas = viewer && viewer.querySelector ? viewer.querySelector('.xmind-structure-canvas') : null;
      if (!canvas) return false;
      var wheelEvt = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: 0,
        deltaY: 120,
      });
      var dispatchResult = canvas.dispatchEvent(wheelEvt);
      return Boolean(wheelEvt.defaultPrevented) || dispatchResult === false;
    });
    expect(wheelGestureBlocked).toBeTruthy();
    var transformBeforeWheelPan = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.evaluate(() => {
      var canvas = document.querySelector('#tempExecXmindStructureViewer .xmind-structure-canvas');
      if (!canvas) return;
      var rect = canvas.getBoundingClientRect();
      var evt = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: 0,
        deltaY: 140,
        clientX: rect.left + (rect.width / 2),
        clientY: rect.top + (rect.height / 2),
      });
      canvas.dispatchEvent(evt);
    });
    await page.waitForTimeout(80);
    var transformAfterWheelPan = await getCanvasTransform(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(transformAfterWheelPan).not.toBe(transformBeforeWheelPan);

    var touchGestureBlocked = await page.evaluate(() => {
      var viewer = document.querySelector('#tempExecXmindStructureViewer');
      var canvas = viewer && viewer.querySelector ? viewer.querySelector('.xmind-structure-canvas') : null;
      if (!canvas) return false;
      var blocked = false;
      canvas.addEventListener('touchmove', function(evt) {
        blocked = Boolean(evt && evt.defaultPrevented);
      }, { once: true });
      var touchEvt = new Event('touchmove', {
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(touchEvt);
      return blocked || Boolean(touchEvt.defaultPrevented);
    });
    expect(touchGestureBlocked).toBeTruthy();

    var firstNode = page.locator('#tempExecXmindStructureViewer me-tpc .text').first();
    var firstNodeBox = await firstNode.boundingBox();
    if (!firstNodeBox) throw new Error('执行页 XMind 节点未渲染');
    await page.mouse.move(firstNodeBox.x - 10, firstNodeBox.y - 10);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(firstNodeBox.x + firstNodeBox.width + 12, firstNodeBox.y + firstNodeBox.height + 12);
    await page.mouse.up({ button: 'left' });

    const execNodeDblClicked = await page.evaluate(() => {
      var nodes = document.querySelectorAll('#tempExecXmindStructureViewer me-tpc .text');
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (String(node.textContent || '').trim() !== '优惠券支付成功') continue;
        node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    });
    expect(execNodeDblClicked).toBeTruthy();
    await page.waitForTimeout(150);
    const execLocate = await page.evaluate((payload) => {
      var selector = '#tempExecView tr.case-row[data-temp-case-row="' + String(payload.fileId) + '"][data-index="' + String(payload.index) + '"]';
      var row = document.querySelector(selector);
      if (!row) return { found: false, visible: false, text: '' };
      var rect = row.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight || 0;
      return {
        found: true,
        visible: rect.bottom > 0 && rect.top < vh,
        text: String(row.textContent || ''),
      };
    }, { fileId, index: 1 });
    expect(execLocate.found).toBeTruthy();
    expect(execLocate.text).toContain('优惠券支付成功');
    const execLocateRow = page.locator('#tempExecView tr.case-row[data-temp-case-row="' + String(fileId) + '"][data-index="1"]').first();
    await expect(execLocateRow).toHaveClass(/xmind-locate-highlight/);

    const drawerOpenAfterLocate = await page.evaluate(() => {
      var drawer = document.getElementById('xmindStructureDrawer');
      return Boolean(drawer && drawer.classList && drawer.classList.contains('open'));
    });
    if (!drawerOpenAfterLocate) {
      await page.click('#tempExecXmindViewBtn');
      await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    }

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

    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    await page.click('#closeXmindStructureDrawerBtn');
    await expect(page.locator('#xmindStructureDrawer')).not.toHaveClass(/open/);
    await expect(page).toHaveURL(/case-exec\.html/);
  });


  test('执行页大量用例放大后结构不消失', async ({ page }) => {
    const fileId = 'temp-xmind-many-cases';
    const cases = [];
    for (var i = 0; i < 80; i += 1) {
      var index = i + 1;
      var moduleNum = String(index).padStart(2, '0');
      cases.push({
        module: '支付模块-' + moduleNum,
        title: '批量校验用例-' + moduleNum,
        priority: index % 2 === 0 ? 'P1' : 'P2',
        preconditions: '账号已登录',
        steps: '执行步骤-' + moduleNum,
        expected: '结果符合预期-' + moduleNum,
        actual: '未执行',
        remark: '',
      });
    }

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
    }, {
      files: [{
        id: fileId,
        name: '大量用例执行集',
        requirement: '批量结构验证',
        cases,
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
      var card = document.getElementById('tempExecToolbarCard');
      return card && !card.classList.contains('hidden');
    });

    await waitTempExecXmindButtonReady(page);
    await page.click('#tempExecXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);

    async function assertMindVisible(message) {
      const metrics = await page.evaluate(() => {
        var viewer = document.querySelector('#tempExecXmindStructureViewer');
        if (!viewer) return { inter: false, nodeVisible: false };
        var canvas = viewer.querySelector('.xmind-structure-canvas');
        var nodes = viewer.querySelector('.map-container me-nodes');
        if (!canvas || !nodes || !canvas.getBoundingClientRect || !nodes.getBoundingClientRect) {
          return { inter: false, nodeVisible: false };
        }
        var canvasRect = canvas.getBoundingClientRect();
        var nodesRect = nodes.getBoundingClientRect();
        var intersects = nodesRect.right > canvasRect.left + 2
          && nodesRect.left < canvasRect.right - 2
          && nodesRect.bottom > canvasRect.top + 2
          && nodesRect.top < canvasRect.bottom - 2;

        var textVisible = false;
        var texts = viewer.querySelectorAll('me-tpc .text');
        for (var i = 0; i < texts.length; i += 1) {
          var item = texts[i];
          if (!item || !item.getBoundingClientRect) continue;
          var rect = item.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          var hit = rect.right > canvasRect.left + 2
            && rect.left < canvasRect.right - 2
            && rect.bottom > canvasRect.top + 2
            && rect.top < canvasRect.bottom - 2;
          if (hit) {
            textVisible = true;
            break;
          }
        }

        return {
          inter: intersects,
          nodeVisible: textVisible,
        };
      });
      expect(metrics.inter, message + '（结构整体应在画布可视范围）').toBeTruthy();
      expect(metrics.nodeVisible, message + '（应至少有一个节点文本可见）').toBeTruthy();
    }

    await assertMindVisible('初始全览后');

    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-fit"]');
    var largeCasesFitScale = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
    var largeCasesZoomInScale = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(largeCasesZoomInScale).toBeGreaterThan(largeCasesFitScale + 0.01);
    await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-out"]');
    var largeCasesZoomBackScale = await getCanvasScale(page, '#tempExecXmindStructureViewer .map-canvas');
    expect(Math.abs(largeCasesZoomBackScale - largeCasesFitScale)).toBeLessThan(0.02);

    for (var z = 0; z < 5; z += 1) {
      await page.click('#tempExecXmindStructureViewer [data-mind-action="zoom-in"]');
      await page.waitForTimeout(80);
      await assertMindVisible('第' + String(z + 1) + '次放大后');
    }
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
    }, {
      id: 8102,
      case_file_id: caseFileId,
      module: '订单模块',
      title: '取消订单成功',
      priority: 'P2',
      precondition: '订单尚未发货',
      steps: '在订单详情页点击取消',
      expected: '订单状态变更为已取消',
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
    const caseLibraryViewerModeEnabled = await page.locator('#xmindStructureDrawerBody').evaluate((el) => {
      return el.classList.contains('is-mind-viewer');
    });
    expect(caseLibraryViewerModeEnabled).toBeTruthy();
    var drawerWidthRatio = await getDrawerWidthRatio(page);
    expect(drawerWidthRatio).toBeGreaterThanOrEqual(0.66);
    var caseLibraryFullscreenBtn = page.locator('#caseLibraryXmindStructureViewer [data-mind-action="drawer-fullscreen"]');
    await expect(caseLibraryFullscreenBtn).toBeVisible();
    await expect(caseLibraryFullscreenBtn).toHaveText('全屏');
    await page.click('#caseLibraryXmindStructureViewer [data-mind-action="drawer-fullscreen"]');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/xmind-drawer-fullscreen/);
    var caseLibFullscreenRatio = await getDrawerWidthRatio(page);
    expect(caseLibFullscreenRatio).toBeGreaterThanOrEqual(0.97);
    await expect(caseLibraryFullscreenBtn).toHaveText('复原');
    await page.keyboard.press('Escape');
    await expect(page.locator('#xmindStructureDrawer')).not.toHaveClass(/xmind-drawer-fullscreen/);
    var caseLibRestoredRatio = await getDrawerWidthRatio(page);
    expect(caseLibRestoredRatio).toBeGreaterThanOrEqual(0.66);
    expect(caseLibRestoredRatio).toBeLessThan(0.97);
    await expect(caseLibraryFullscreenBtn).toHaveText('全屏');
    await page.waitForTimeout(140);
    var caseLibInitialScaleJustOpened = await getCanvasScale(page, '#caseLibraryXmindStructureViewer .map-canvas');
    await page.click('#caseLibraryXmindStructureViewer [data-mind-action="zoom-fit"]');
    var caseLibFitScaleJustOpened = await getCanvasScale(page, '#caseLibraryXmindStructureViewer .map-canvas');
    expect(Math.abs(caseLibFitScaleJustOpened - caseLibInitialScaleJustOpened)).toBeLessThan(0.02);
    await page.waitForTimeout(520);
    var caseLibInitialScaleAfterOpen = await getCanvasScale(page, '#caseLibraryXmindStructureViewer .map-canvas');
    await page.click('#caseLibraryXmindStructureViewer [data-mind-action="zoom-fit"]');
    var caseLibFitScaleAfterOpen = await getCanvasScale(page, '#caseLibraryXmindStructureViewer .map-canvas');
    expect(Math.abs(caseLibFitScaleAfterOpen - caseLibInitialScaleAfterOpen)).toBeLessThan(0.02);
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="zoom-out"]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="zoom-fit"]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="zoom-in"]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-search-input]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="export-xmind"]')).toBeVisible();
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-action="edit-enter"]')).toBeVisible();
    await page.click('#caseLibraryXmindStructureViewer [data-mind-action="export-xmind"]');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    await page.fill('#caseLibraryXmindStructureViewer [data-mind-search-input]', '创建订单成功');
    await expect(page.locator('#caseLibraryXmindStructureViewer [data-mind-search-count]')).toHaveText(/1\s*\/\s*1/);

    var beforeZoom = await getCanvasTransform(page, '#caseLibraryXmindStructureViewer .map-canvas');
    await page.click('#caseLibraryXmindStructureViewer [data-mind-action="zoom-in"]');
    var afterZoom = await getCanvasTransform(page, '#caseLibraryXmindStructureViewer .map-canvas');
    expect(afterZoom).not.toBe(beforeZoom);

    const caseLibNodeDblClicked = await page.evaluate(() => {
      var nodes = document.querySelectorAll('#caseLibraryXmindStructureViewer me-tpc .text');
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (String(node.textContent || '').trim() !== '取消订单成功') continue;
        node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    });
    expect(caseLibNodeDblClicked).toBeTruthy();
    await page.waitForTimeout(150);
    const locatedEditor = await page.evaluate(() => {
      var active = document.activeElement;
      if (!active || !active.getAttribute) return { index: '', field: '' };
      return {
        index: String(active.getAttribute('data-index') || ''),
        field: String(active.getAttribute('data-case-lib-edit-field') || ''),
      };
    });
    expect(locatedEditor.field).toBeTruthy();
    expect(locatedEditor.index).toBe('1');
    const caseLocateHighlight = await page.evaluate(() => {
      var cell = document.querySelector('#caseLibraryEditView [data-case-lib-edit-field="module"][data-index="1"]');
      var row = cell && cell.closest ? cell.closest('tr') : null;
      return Boolean(row && row.classList && row.classList.contains('xmind-locate-highlight'));
    });
    expect(caseLocateHighlight).toBeTruthy();

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
