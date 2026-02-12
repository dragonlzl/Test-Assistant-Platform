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

test.describe('XMind 编辑模式', () => {
  test('用例库 XMind 支持编辑态、撤回恢复与刷新持久化', async ({ page }) => {
    const token = 'token-case-library-xmind-edit-mode';
    const user = { id: 29, username: 'xmind_editor', role: 'admin', level: 'leader' };
    const project = { id: 301, name: 'XMind编辑项目' };
    const versions = [{ id: 401, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 1901;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '编辑模式用例集',
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
      id: 18101,
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
    }, { token, caseFileId });

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
    await expect(viewer.locator('[data-mind-action="edit-enter"]')).toBeVisible();

    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();
    await expect(viewer.locator('[data-mind-action="node-add"]')).toBeVisible();

    const firstNode = viewer.locator('me-tpc .text').first();
    await firstNode.click({ force: true });
    await expect(viewer.locator('[data-mind-action="node-add"]')).toBeEnabled();

    await firstNode.dblclick({ force: true });
    await page.waitForTimeout(100);
    const caretState = await page.evaluate(() => {
      var input = document.getElementById('input-box');
      if (!input) return null;
      var selection = window.getSelection ? window.getSelection() : null;
      if (!selection || selection.rangeCount <= 0) return { collapsed: false, offset: -1, textLen: String(input.textContent || '').length };
      var range = selection.getRangeAt(0);
      var prefix = range.cloneRange();
      prefix.selectNodeContents(input);
      prefix.setEnd(range.endContainer, range.endOffset);
      return {
        collapsed: range.collapsed === true,
        offset: prefix.toString().length,
        textLen: String(input.textContent || '').length,
      };
    });
    expect(caretState).toBeTruthy();
    if (caretState) {
      expect(caretState.collapsed).toBeTruthy();
      expect(caretState.offset).toBe(caretState.textLen);
    }

    const draggableNode = viewer.locator('me-tpc .text').nth(1);
    await draggableNode.click({ force: true });
    const draggedText = String((await draggableNode.textContent()) || '').trim();
    const draggableBox = await draggableNode.boundingBox();
    if (!draggableBox) throw new Error('编辑态拖拽节点未渲染');
    const dragStartX = draggableBox.x + (draggableBox.width / 2);
    const dragStartY = draggableBox.y + (draggableBox.height / 2);
    const dragMoveX = dragStartX + 90;
    const dragMoveY = dragStartY + 30;
    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(dragMoveX, dragMoveY);
    await page.waitForTimeout(80);
    const dragGhostRect = await page.evaluate(() => {
      var ghost = document.querySelector('.xmind-floating-ghost, .mind-elixir-ghost');
      var xmindDrawer = document.getElementById('xmindStructureDrawer');
      if (!ghost) return null;
      var style = getComputedStyle(ghost);
      if (style.display === 'none') return null;
      var rect = ghost.getBoundingClientRect();
      var ghostZ = Number(style.zIndex || '0');
      var drawerZ = xmindDrawer ? Number((getComputedStyle(xmindDrawer).zIndex || '0')) : 0;
      var textLen = String(ghost.textContent || '').trim().length;
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        ghostZ: ghostZ,
        drawerZ: drawerZ,
        textLen: textLen,
      };
    });
    await page.mouse.up({ button: 'left' });
    expect(dragGhostRect).toBeTruthy();
    if (dragGhostRect) {
      expect(dragGhostRect.width).toBeGreaterThan(4);
      expect(dragGhostRect.height).toBeGreaterThan(4);
      expect(dragMoveX).toBeGreaterThanOrEqual(dragGhostRect.left - 4);
      expect(dragMoveX).toBeLessThanOrEqual(dragGhostRect.right + 4);
      expect(dragMoveY).toBeGreaterThanOrEqual(dragGhostRect.top - 4);
      expect(dragMoveY).toBeLessThanOrEqual(dragGhostRect.bottom + 4);
      expect(dragGhostRect.textLen).toBeGreaterThan(0);
      expect(dragGhostRect.ghostZ).toBeGreaterThan(dragGhostRect.drawerZ);
    }

    const nodeCountBeforeAdd = await viewer.locator('me-tpc').count();
    await viewer.locator('[data-mind-action="node-add"]').click();
    await page.waitForTimeout(120);
    const nodeCountAfterAdd = await viewer.locator('me-tpc').count();
    expect(nodeCountAfterAdd).toBeGreaterThan(nodeCountBeforeAdd);

    await expect(viewer.locator('[data-mind-action="undo"]')).toBeEnabled();
    await viewer.locator('[data-mind-action="undo"]').click();
    await page.waitForTimeout(120);
    const nodeCountAfterUndo = await viewer.locator('me-tpc').count();
    expect(nodeCountAfterUndo).toBe(nodeCountBeforeAdd);

    await expect(viewer.locator('[data-mind-action="redo"]')).toBeEnabled();
    await viewer.locator('[data-mind-action="redo"]').click();
    await page.waitForTimeout(120);
    const nodeCountAfterRedo = await viewer.locator('me-tpc').count();
    expect(nodeCountAfterRedo).toBeGreaterThan(nodeCountAfterUndo);

    await viewer.locator('[data-mind-action="edit-save"]').click();
    await page.waitForTimeout(200);
    await expect(viewer.locator('me-tpc.xmind-node-struct-error').first()).toBeVisible();

    await page.reload();
    await ensureMindElixirReady(page, (process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090') + '/case-library.html');
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryEditDrawerBtn');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await page.click('#caseLibraryXmindViewBtn');

    const viewerAfterReload = page.locator('#caseLibraryXmindStructureViewer');
    await expect(viewerAfterReload.locator('[data-mind-action="edit-cancel"]')).toBeVisible();
    await expect(viewerAfterReload.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await viewerAfterReload.locator('[data-mind-action="edit-cancel"]').click();
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('确认要取消保存吗');
    const confirmAboveXmind = await page.evaluate(() => {
      var confirmDrawer = document.getElementById('appConfirmDrawer');
      var xmindDrawer = document.getElementById('xmindStructureDrawer');
      if (!confirmDrawer || !xmindDrawer) return false;
      var confirmZ = Number((getComputedStyle(confirmDrawer).zIndex || '0'));
      var xmindZ = Number((getComputedStyle(xmindDrawer).zIndex || '0'));
      return confirmZ > xmindZ;
    });
    expect(confirmAboveXmind).toBeTruthy();
    await page.evaluate(() => {
      var btn = document.getElementById('appConfirmDrawerConfirmBtn');
      if (btn) btn.click();
    });
  });

  test('编辑态拖拽过程中展示可见节点预览', async ({ page }) => {
    const token = 'token-case-library-xmind-drag-preview';
    const user = { id: 39, username: 'xmind_drag_preview', role: 'admin', level: 'leader' };
    const project = { id: 331, name: 'XMind拖拽预览项目' };
    const versions = [{ id: 431, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 1931;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '拖拽预览用例集',
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
      id: 18301,
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
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('tap-current-user', JSON.stringify(payload.user)); } catch (_) {}
    }, { token, user });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryEditDrawerBtn');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await page.click('#caseLibraryXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);

    const viewer = page.locator('#caseLibraryXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    const draggableNode = viewer.locator('me-tpc .text').nth(1);
    await draggableNode.click({ force: true });
    const draggedText = String((await draggableNode.textContent()) || '').trim();
    const draggableBox = await draggableNode.boundingBox();
    if (!draggableBox) throw new Error('拖拽预览测试：节点未渲染');

    const dragStartX = draggableBox.x + (draggableBox.width / 2);
    const dragStartY = draggableBox.y + (draggableBox.height / 2);
    const dragMoveX = dragStartX + 120;
    const dragMoveY = dragStartY + 60;

    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(dragMoveX, dragMoveY, { steps: 8 });
    await page.waitForTimeout(120);

    const customGhost = await page.evaluate(() => {
      var ghost = document.querySelector('.xmind-custom-drag-ghost');
      if (!ghost) return null;
      var style = getComputedStyle(ghost);
      var rect = ghost.getBoundingClientRect();
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity || '0'),
        text: String(ghost.textContent || '').trim(),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });

    await page.mouse.up({ button: 'left' });

    expect(customGhost).toBeTruthy();
    if (customGhost) {
      expect(customGhost.display).toBe('block');
      expect(customGhost.visibility).toBe('visible');
      expect(customGhost.opacity).toBeGreaterThan(0.5);
      expect(customGhost.width).toBeGreaterThan(20);
      expect(customGhost.height).toBeGreaterThan(20);
      expect(String(customGhost.text || '').length).toBeGreaterThan(0);
      if (draggedText) expect(customGhost.text).toContain(draggedText);
      expect(customGhost.left).toBeGreaterThanOrEqual(dragMoveX + 6);
      expect(customGhost.left).toBeLessThanOrEqual(dragMoveX + 40);
      expect(customGhost.top).toBeGreaterThanOrEqual(dragMoveY + 6);
      expect(customGhost.top).toBeLessThanOrEqual(dragMoveY + 40);
    }
  });
});
