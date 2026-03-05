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
        if (typeof MindElixir !== 'undefined') globalObj = MindElixir;
        else if (window && window.MindElixir) globalObj = window.MindElixir;
        var hasCtor = false;
        if (typeof globalObj === 'function') hasCtor = true;
        else if (globalObj && typeof globalObj.default === 'function') hasCtor = true;
        return hasApi && hasCtor;
      });
    } catch (err) {
      ready = false;
    }
    if (ready) return;
    if (i < maxRetry - 1) await page.goto(url);
  }
  throw new Error('MindElixir 依赖未就绪，请重试');
}

async function gotoCaseLibrary(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/case-library.html';
  await page.goto(url);
  await ensureMindElixirReady(page, url);
  return base;
}

async function waitCaseLibraryReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.caseLibraryBound === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', {}, { timeout: 30000 });
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
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

test('XMind 编辑态支持右键新增、跨侧拖拽、回车换行与横向滚动条', async ({ page }) => {
  const token = 'token-case-library-xmind-edit-interactions';
  const user = { id: 59, username: 'xmind_interaction_editor', role: 'admin', level: 'leader' };
  const project = { id: 901, name: 'XMind交互优化项目' };
  const versions = [{ id: 902, name: 'v1' }];
  const now = new Date().toISOString();
  const caseFileId = 9901;
  const caseFiles = [{
    id: caseFileId,
    project_id: project.id,
    version_id: versions[0].id,
    file_name_clean: '交互优化用例集',
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
    id: 99101,
    case_file_id: caseFileId,
    module: '支付模块',
    title: '余额不足时支付失败',
    priority: 'P1',
    precondition: '账号已登录',
    steps: '提交支付订单',
    expected: '提示余额不足',
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
  await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
  await expect(page.locator('#caseLibraryEditCard')).toBeVisible();

  await page.click('#caseLibraryXmindViewBtn');
  await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
  const viewer = page.locator('#caseLibraryXmindStructureViewer');
  await viewer.locator('[data-mind-action="edit-enter"]').click();
  await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

  const hasHorizontalScrollbar = await page.evaluate(() => {
    var canvas = document.querySelector('#caseLibraryXmindStructureViewer .xmind-structure-canvas');
    if (!canvas || typeof getComputedStyle !== 'function') return false;
    var style = getComputedStyle(canvas);
    return style.overflowX === 'auto' || style.overflowX === 'scroll';
  });
  expect(hasHorizontalScrollbar).toBeTruthy();

  const sideDragMeta = await page.evaluate(() => {
    var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
    if (!viewerEl || !viewerEl.querySelector) return null;
    var root = viewerEl.querySelector('me-root > me-tpc');
    var node = viewerEl.querySelector('me-main.rhs me-wrapper > me-parent > me-tpc');
    if (!root || !node || !node.nodeObj) return null;
    var rootRect = root.getBoundingClientRect();
    var nodeRect = node.getBoundingClientRect();
    return {
      nodeId: String(node.nodeObj.id || ''),
      startX: nodeRect.left + (nodeRect.width / 2),
      startY: nodeRect.top + (nodeRect.height / 2),
      targetX: (rootRect.left + (rootRect.width / 2)) - 280,
      targetY: nodeRect.top + (nodeRect.height / 2) + 24,
    };
  });
  expect(sideDragMeta).toBeTruthy();
  if (sideDragMeta) {
    await page.mouse.move(sideDragMeta.startX, sideDragMeta.startY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(sideDragMeta.targetX, sideDragMeta.targetY, { steps: 10 });
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(220);
    const switchedToLeft = await page.evaluate((nodeId) => {
      if (!nodeId) return false;
      var list = document.querySelectorAll('#caseLibraryXmindStructureViewer me-tpc');
      for (var i = 0; i < list.length; i += 1) {
        var node = list[i];
        if (!node || !node.nodeObj) continue;
        if (String(node.nodeObj.id || '') !== String(nodeId)) continue;
        var main = node.closest ? node.closest('me-main') : null;
        return Boolean(main && main.classList && main.classList.contains('lhs'));
      }
      return false;
    }, sideDragMeta.nodeId);
    expect(switchedToLeft).toBeTruthy();
  }

  const nodeCountBeforeContextAdd = await viewer.locator('me-tpc').count();
  await page.evaluate(() => {
    var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
    if (!viewerEl) return;
    var node = viewerEl.querySelector('me-main me-wrapper > me-parent > me-tpc');
    if (!node) return;
    var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    var cx = rect.left + (rect.width / 2);
    var cy = rect.top + (rect.height / 2);
    var leftEvt = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      clientX: cx,
      clientY: cy,
    });
    node.dispatchEvent(leftEvt);
    var rightEvt = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: cx,
      clientY: cy,
    });
    node.dispatchEvent(rightEvt);
    var menuEvt = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 2,
      clientX: cx,
      clientY: cy,
    });
    node.dispatchEvent(menuEvt);
  });
  await expect(page.locator('.xmind-node-context-menu.is-open')).toBeVisible();
  await page.evaluate(() => {
    var moveEvt = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 12,
      clientY: 12,
    });
    window.dispatchEvent(moveEvt);
    var upEvt = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 0,
      clientX: 12,
      clientY: 12,
    });
    window.dispatchEvent(upEvt);
  });
  await expect(page.locator('.xmind-node-context-menu.is-open')).toBeVisible();
  await expect(page.locator('.xmind-node-context-menu [data-mind-node-menu="node-delete"]')).toBeVisible();
  await page.evaluate(() => {
    var btn = document.querySelector('.xmind-node-context-menu [data-mind-node-menu="node-add"]');
    if (btn && typeof btn.click === 'function') btn.click();
  });
  await page.waitForTimeout(120);
  const nodeCountAfterContextAdd = await viewer.locator('me-tpc').count();
  expect(nodeCountAfterContextAdd).toBeGreaterThan(nodeCountBeforeContextAdd);

  await page.evaluate(() => {
    var input = document.getElementById('input-box');
    if (!input) return;
    if (typeof input.blur === 'function') input.blur();
  });
  await page.waitForTimeout(80);

  const editNode = viewer.locator('me-main me-wrapper > me-parent > me-tpc .text').first();
  const originalEditNodeText = String((await editNode.textContent()) || '').trim();
  await editNode.click({ force: true });
  await expect(page.locator('#input-box')).toHaveCount(0);
  await editNode.press('a');
  await expect(page.locator('#input-box')).toBeVisible();
  await expect.poll(async () => {
    return await page.evaluate(() => {
      var input = document.getElementById('input-box');
      if (!input) return '';
      return String(input.textContent || '').trim();
    });
  }).toBe('a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('第一行');
  await page.keyboard.press('Enter');
  await page.keyboard.type('第二行');
  const multiline = await page.evaluate(() => {
    var input = document.getElementById('input-box');
    if (!input) return { hasInput: false, hasBreak: false, text: '' };
    var text = String(input.textContent || '');
    var html = String(input.innerHTML || '');
    return {
      hasInput: true,
      hasBreak: text.indexOf('\n') >= 0 || /<br\s*\/?>/i.test(html),
      text: text,
    };
  });
  expect(multiline.hasInput).toBeTruthy();
  expect(multiline.text).toContain('第一行');
  expect(multiline.text).toContain('第二行');
  if (originalEditNodeText) {
    expect(multiline.text).not.toContain(originalEditNodeText);
  }
  expect(multiline.hasBreak).toBeTruthy();

  await page.evaluate(() => {
    var input = document.getElementById('input-box');
    if (input && typeof input.blur === 'function') input.blur();
  });
  await page.waitForTimeout(80);
  await editNode.click({ force: true });
  await expect(page.locator('#input-box')).toHaveCount(0);
  const nodeCountBeforeClear = await viewer.locator('me-tpc').count();
  await page.keyboard.press('Backspace');
  await expect(page.locator('#input-box')).toBeVisible();
  await expect.poll(async () => {
    return await page.evaluate(() => {
      var input = document.getElementById('input-box');
      if (!input) return '__NO_INPUT__';
      return String(input.textContent || '');
    });
  }).toBe('');
  const nodeCountAfterClear = await viewer.locator('me-tpc').count();
  expect(nodeCountAfterClear).toBe(nodeCountBeforeClear);

  await page.evaluate(() => {
    var input = document.getElementById('input-box');
    if (input && typeof input.blur === 'function') input.blur();
  });
  await page.waitForTimeout(80);
  await editNode.click({ force: true });
  await expect(page.locator('#input-box')).toHaveCount(0);
  const nodeCountBeforeDelete = await viewer.locator('me-tpc').count();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(140);
  const nodeCountAfterDelete = await viewer.locator('me-tpc').count();
  expect(nodeCountAfterDelete).toBeLessThan(nodeCountBeforeDelete);
});
