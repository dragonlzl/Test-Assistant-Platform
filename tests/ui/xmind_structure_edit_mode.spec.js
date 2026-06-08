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
      try { localStorage.setItem('usecase-settings-v1', JSON.stringify({ theme: 'light' })); } catch (_) {}
      try { localStorage.setItem('tap-theme-hint', 'light'); } catch (_) {}
      try {
        if (document && document.documentElement) document.documentElement.setAttribute('data-theme', 'light');
      } catch (_) {}
    }, { token, caseFileId });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');
    await expect.poll(async () => {
      return await page.evaluate(() => {
        var root = document && document.documentElement ? document.documentElement : null;
        if (!root) return '';
        var theme = root.getAttribute('data-theme');
        return String(theme || 'light').toLowerCase();
      });
    }).toBe('light');

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
      expect(caretState.offset).toBeGreaterThanOrEqual(0);
      expect(caretState.offset).toBeLessThanOrEqual(caretState.textLen);
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

    const readNodeStats = async () => {
      return await page.evaluate(() => {
        var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
        if (!viewerEl || !viewerEl.querySelectorAll) return null;
        var nodes = viewerEl.querySelectorAll('me-tpc');
        var emptyCount = 0;
        for (var i = 0; i < nodes.length; i += 1) {
          var node = nodes[i];
          var topic = node && node.nodeObj && node.nodeObj.topic !== undefined && node.nodeObj.topic !== null
            ? String(node.nodeObj.topic).trim()
            : '';
          if (!topic) emptyCount += 1;
        }
        return {
          nodeCount: nodes.length,
          emptyCount: emptyCount,
        };
      });
    };

    const readThemeSnapshot = async () => {
      return await page.evaluate(() => {
        var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
        if (!viewerEl) return null;
        var canvasEl = viewerEl.querySelector ? viewerEl.querySelector('.xmind-structure-canvas') : null;
        var mapContainerEl = viewerEl.querySelector ? viewerEl.querySelector('.map-container') : null;
        var scopeEl = mapContainerEl || canvasEl || viewerEl;
        var scopeStyle = scopeEl ? getComputedStyle(scopeEl) : null;
        var viewerStyle = getComputedStyle(viewerEl);
        var root = document && document.documentElement ? document.documentElement : null;
        var rootTheme = root ? String(root.getAttribute('data-theme') || 'light').toLowerCase() : 'light';
        var mainBg = scopeStyle ? String(scopeStyle.getPropertyValue('--main-bgcolor') || '').trim().toLowerCase() : '';
        var bg = scopeStyle ? String(scopeStyle.getPropertyValue('--bgcolor') || '').trim().toLowerCase() : '';
        var viewerBg = viewerStyle ? String(viewerStyle.backgroundColor || '').trim().toLowerCase() : '';
        var mapBg = mapContainerEl ? String(getComputedStyle(mapContainerEl).backgroundColor || '').trim().toLowerCase() : '';
        var raw = [mainBg, bg, viewerBg, mapBg].join('|');
        var darkLike = raw.indexOf('#1f2937') >= 0
          || raw.indexOf('#111827') >= 0
          || raw.indexOf('#0f172a') >= 0
          || raw.indexOf('rgb(31, 41, 55)') >= 0
          || raw.indexOf('rgb(17, 24, 39)') >= 0
          || raw.indexOf('rgb(15, 23, 42)') >= 0;
        return {
          rootTheme: rootTheme,
          mainBg: mainBg,
          bg: bg,
          viewerBg: viewerBg,
          mapBg: mapBg,
          darkLike: darkLike,
        };
      });
    };

    const tabStatsBeforeAdd = await readNodeStats();
    expect(tabStatsBeforeAdd).toBeTruthy();
    const tabTargetNode = viewer.locator('me-main me-wrapper > me-parent > me-tpc .text').first();
    await tabTargetNode.click({ force: true });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
    const tabStatsAfterAdd = await readNodeStats();
    expect(tabStatsAfterAdd).toBeTruthy();
    if (tabStatsBeforeAdd && tabStatsAfterAdd) {
      expect(tabStatsAfterAdd.nodeCount).toBeGreaterThan(tabStatsBeforeAdd.nodeCount);
      expect(tabStatsAfterAdd.emptyCount).toBeGreaterThan(tabStatsBeforeAdd.emptyCount);
    }

    const themeBeforeUndo = await readThemeSnapshot();
    expect(themeBeforeUndo).toBeTruthy();
    if (themeBeforeUndo) {
      expect(themeBeforeUndo.rootTheme).toBe('light');
      expect(themeBeforeUndo.darkLike).toBeFalsy();
    }

    await expect(viewer.locator('[data-mind-action="undo"]')).toBeEnabled();
    await viewer.locator('[data-mind-action="undo"]').click();
    await page.waitForTimeout(120);
    const tabStatsAfterUndo = await readNodeStats();
    expect(tabStatsAfterUndo).toBeTruthy();
    if (tabStatsBeforeAdd && tabStatsAfterUndo) {
      expect(tabStatsAfterUndo.nodeCount).toBe(tabStatsBeforeAdd.nodeCount);
      expect(tabStatsAfterUndo.emptyCount).toBe(tabStatsBeforeAdd.emptyCount);
    }
    const themeAfterUndo = await readThemeSnapshot();
    expect(themeAfterUndo).toBeTruthy();
    if (themeBeforeUndo && themeAfterUndo) {
      expect(themeAfterUndo.rootTheme).toBe('light');
      expect(themeAfterUndo.mainBg).toBe(themeBeforeUndo.mainBg);
      expect(themeAfterUndo.bg).toBe(themeBeforeUndo.bg);
      expect(themeAfterUndo.darkLike).toBeFalsy();
    }

    const addStatsBefore = await readNodeStats();
    expect(addStatsBefore).toBeTruthy();
    await tabTargetNode.click({ force: true });
    await expect(viewer.locator('[data-mind-action="node-add"]')).toBeEnabled();
    await viewer.locator('[data-mind-action="node-add"]').click();
    await page.waitForTimeout(120);
    const addStatsAfter = await readNodeStats();
    expect(addStatsAfter).toBeTruthy();
    if (addStatsBefore && addStatsAfter) {
      expect(addStatsAfter.nodeCount).toBeGreaterThan(addStatsBefore.nodeCount);
      expect(addStatsAfter.emptyCount).toBeGreaterThan(addStatsBefore.emptyCount);
    }

    await expect(viewer.locator('[data-mind-action="undo"]')).toBeEnabled();
    await viewer.locator('[data-mind-action="undo"]').click();
    await page.waitForTimeout(120);
    const addStatsAfterUndo = await readNodeStats();
    expect(addStatsAfterUndo).toBeTruthy();
    if (addStatsBefore && addStatsAfterUndo) {
      expect(addStatsAfterUndo.nodeCount).toBe(addStatsBefore.nodeCount);
      expect(addStatsAfterUndo.emptyCount).toBe(addStatsBefore.emptyCount);
    }

    await expect(viewer.locator('[data-mind-action="redo"]')).toBeEnabled();
    await viewer.locator('[data-mind-action="redo"]').click();
    await page.waitForTimeout(120);
    const addStatsAfterRedo = await readNodeStats();
    expect(addStatsAfterRedo).toBeTruthy();
    if (addStatsAfterUndo && addStatsAfterRedo) {
      expect(addStatsAfterRedo.nodeCount).toBeGreaterThan(addStatsAfterUndo.nodeCount);
      expect(addStatsAfterRedo.emptyCount).toBeGreaterThan(addStatsAfterUndo.emptyCount);
    }

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
    const restoredToast = page.locator('.temp-center-toast', { hasText: '检测到上次未保存的内容编辑，已进行恢复，请继续完成编辑。' });
    await expect(restoredToast).toBeVisible({ timeout: 3000 });
    await expect(restoredToast).toHaveCount(0, { timeout: 5000 });

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
    const nodeCountBeforePaste = await viewer.locator('me-tpc').count();

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

  test('编辑态支持粘贴外部 XMind 缩进文本并渲染层级', async ({ page }) => {
    const token = 'token-case-library-xmind-paste-plain-text';
    const user = { id: 59, username: 'xmind_paste_user', role: 'admin', level: 'leader' };
    const project = { id: 391, name: 'XMind粘贴兼容项目' };
    const versions = [{ id: 491, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 1991;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '粘贴兼容用例集',
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
      id: 18901,
      case_file_id: caseFileId,
      module: '旧模块',
      title: '旧用例',
      priority: 'P1',
      precondition: '旧前提',
      steps: '旧步骤',
      expected: '旧结果',
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
    const nodeCountBeforePaste = await viewer.locator('me-tpc').count();

    const pasteText = [
      '商城优化',
      '\t商城布局',
      '\t\t页签排序',
      '\t\t\tP1',
      '\t\t\t\t进入商城',
      '\t\t\t\t\t观察页签排序',
      '\t\t\t\t\t\t改成从上到下排序，位于商城的左侧',
      '\t推荐页面',
      '\t\t页面布局',
      '\t\t\tP1',
      '\t\t\t\t进入商城',
      '\t\t\t\t\t观察页面中商品的布局',
      '\t\t\t\t\t\t会展示左右两个区块',
    ].join('\n');

    const pasteState = await page.evaluate((payload) => {
      var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
      if (!viewerEl || typeof viewerEl.dispatchEvent !== 'function') {
        return { ok: false, reason: 'viewer-not-found' };
      }
      if (typeof viewerEl.focus === 'function') {
        try {
          viewerEl.focus();
        } catch (_) {
          // ignore
        }
      }

      var clipboardData = {
        getData: function(type) {
          var name = type === undefined || type === null ? '' : String(type).toLowerCase();
          if (name === 'text/plain' || name === 'text') return payload;
          return '';
        },
      };

      var eventObj = null;
      try {
        eventObj = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      } catch (err0) {
        eventObj = document.createEvent('Event');
        eventObj.initEvent('paste', true, true);
      }
      try {
        Object.defineProperty(eventObj, 'clipboardData', {
          value: clipboardData,
        });
      } catch (err1) {
        try {
          eventObj.clipboardData = clipboardData;
        } catch (err2) {
          // ignore
        }
      }
      viewerEl.dispatchEvent(eventObj);
      return {
        ok: true,
        defaultPrevented: eventObj.defaultPrevented === true,
      };
    }, pasteText);

    expect(pasteState && pasteState.ok).toBeTruthy();
    expect(pasteState && pasteState.defaultPrevented).toBeTruthy();

    await expect(viewer.locator('me-tpc .text', { hasText: '旧模块' }).first()).toBeVisible();
    await expect(viewer.locator('me-tpc .text', { hasText: '旧用例' }).first()).toBeVisible();
    await expect(viewer.locator('me-tpc .text', { hasText: '商城优化' }).first()).toBeVisible();
    await expect(viewer.locator('me-tpc .text', { hasText: '推荐页面' }).first()).toBeVisible();
    await expect(viewer.locator('me-tpc .text', { hasText: '会展示左右两个区块' }).first()).toBeVisible();
    await expect(viewer.locator('[data-mind-action="undo"]')).toBeEnabled();

    const nodeCount = await viewer.locator('me-tpc').count();
    expect(nodeCount).toBeGreaterThan(nodeCountBeforePaste);
  });

  test('编辑态选中节点后粘贴普通文本会新增子节点', async ({ page }) => {
    const token = 'token-case-library-xmind-paste-plain-child';
    const user = { id: 69, username: 'xmind_paste_plain_user', role: 'admin', level: 'leader' };
    const project = { id: 431, name: 'XMind纯文本粘贴项目' };
    const versions = [{ id: 531, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 2091;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '纯文本粘贴用例集',
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
      id: 20901,
      case_file_id: caseFileId,
      module: '支付模块',
      title: '支付成功',
      priority: 'P1',
      precondition: '已登录',
      steps: '输入支付密码',
      expected: '支付成功',
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

    const targetMeta = await page.evaluate(() => {
      var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
      if (!viewerEl || !viewerEl.querySelector) return null;
      var node = viewerEl.querySelector('me-main me-wrapper > me-parent > me-tpc');
      if (!node || !node.nodeObj) return null;
      var nodeId = node.nodeObj.id === undefined || node.nodeObj.id === null
        ? ''
        : String(node.nodeObj.id);
      var children = Array.isArray(node.nodeObj.children) ? node.nodeObj.children : [];
      return {
        nodeId: nodeId,
        childCount: children.length,
      };
    });
    expect(targetMeta).toBeTruthy();

    await viewer.locator('me-main me-wrapper > me-parent > me-tpc .text').first().click({ force: true });
    await expect(page.locator('#input-box')).toHaveCount(0);

    const pasteText = '来自普通文本的子节点\n第二行';
    const pasteState = await page.evaluate((payload) => {
      var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
      if (!viewerEl || typeof viewerEl.dispatchEvent !== 'function') {
        return { ok: false, reason: 'viewer-not-found' };
      }
      if (typeof viewerEl.focus === 'function') {
        try {
          viewerEl.focus();
        } catch (_) {
          // ignore
        }
      }
      var clipboardData = {
        getData: function(type) {
          var name = type === undefined || type === null ? '' : String(type).toLowerCase();
          if (name === 'text/plain' || name === 'text') return payload;
          return '';
        },
      };
      var eventObj = null;
      try {
        eventObj = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      } catch (err0) {
        eventObj = document.createEvent('Event');
        eventObj.initEvent('paste', true, true);
      }
      try {
        Object.defineProperty(eventObj, 'clipboardData', {
          value: clipboardData,
        });
      } catch (err1) {
        try {
          eventObj.clipboardData = clipboardData;
        } catch (err2) {
          // ignore
        }
      }
      viewerEl.dispatchEvent(eventObj);
      return {
        ok: true,
        defaultPrevented: eventObj.defaultPrevented === true,
      };
    }, pasteText);
    expect(pasteState && pasteState.ok).toBeTruthy();
    expect(pasteState && pasteState.defaultPrevented).toBeTruthy();

    const appendState = await page.evaluate((payload) => {
      var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
      if (!viewerEl || !viewerEl.querySelectorAll) return null;
      var nodes = viewerEl.querySelectorAll('me-tpc');
      var target = null;
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (!node || !node.nodeObj || node.nodeObj.id === undefined || node.nodeObj.id === null) continue;
        if (String(node.nodeObj.id) !== String(payload.nodeId)) continue;
        target = node;
        break;
      }
      if (!target || !target.nodeObj) return null;
      var children = Array.isArray(target.nodeObj.children) ? target.nodeObj.children : [];
      var hasExactTopic = false;
      for (var j = 0; j < children.length; j += 1) {
        var topic = children[j] && children[j].topic !== undefined && children[j].topic !== null
          ? String(children[j].topic).trim()
          : '';
        if (topic === payload.expectedTopic) {
          hasExactTopic = true;
          break;
        }
      }
      return {
        childCount: children.length,
        hasExactTopic: hasExactTopic,
      };
    }, {
      nodeId: targetMeta && targetMeta.nodeId ? targetMeta.nodeId : '',
      expectedTopic: pasteText,
    });
    expect(appendState).toBeTruthy();
    if (appendState && targetMeta) {
      expect(appendState.childCount).toBeGreaterThan(targetMeta.childCount);
      expect(appendState.hasExactTopic).toBeTruthy();
    }
    await expect(viewer.locator('[data-mind-action="undo"]')).toBeEnabled();
  });

  test('编辑态选中节点后保留原生节点复制粘贴', async ({ page }) => {
    const token = 'token-case-library-xmind-copy-paste-node';
    const user = { id: 79, username: 'xmind_copy_paste_user', role: 'admin', level: 'leader' };
    const project = { id: 461, name: 'XMind节点复制项目' };
    const versions = [{ id: 561, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 2191;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '节点复制粘贴用例集',
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
      id: 21901,
      case_file_id: caseFileId,
      module: '支付模块',
      title: '支付成功',
      priority: 'P1',
      precondition: '已登录',
      steps: '输入支付密码',
      expected: '支付完成',
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
    await viewer.locator('me-tpc .text', { hasText: '支付成功' }).click({ force: true });
    await expect(page.locator('#input-box')).toHaveCount(0);

    const copyPasteState = await page.evaluate(() => {
      var viewerEl = document.getElementById('caseLibraryXmindStructureViewer');
      if (!viewerEl || !viewerEl.querySelectorAll) return null;
      var beforeNodes = viewerEl.querySelectorAll('me-tpc');
      var beforeExact = 0;
      Array.prototype.forEach.call(beforeNodes || [], function(node) {
        var textEl = node && node.querySelector ? node.querySelector('.text') : null;
        var label = textEl ? String(textEl.textContent || '').trim() : '';
        if (label === '支付成功') beforeExact += 1;
      });

      var activeEl = document.activeElement || null;
      var focusIsMindContainer = Boolean(activeEl && activeEl.classList && activeEl.classList.contains('map-container'));
      if (!activeEl || typeof activeEl.dispatchEvent !== 'function') return { ok: false, reason: 'no-active-target' };

      var copiedText = '';
      var copyClipboard = {
        setData: function(type, value) {
          var name = type === undefined || type === null ? '' : String(type).toLowerCase();
          if (name === 'text/plain' || name === 'text') copiedText = String(value || '');
        },
        getData: function() {
          return '';
        },
      };
      var copyEvent = null;
      try {
        copyEvent = new ClipboardEvent('copy', { bubbles: true, cancelable: true });
      } catch (err0) {
        copyEvent = document.createEvent('Event');
        copyEvent.initEvent('copy', true, true);
      }
      try {
        Object.defineProperty(copyEvent, 'clipboardData', { value: copyClipboard });
      } catch (err1) {
        try {
          copyEvent.clipboardData = copyClipboard;
        } catch (err2) {
          // ignore
        }
      }
      activeEl.dispatchEvent(copyEvent);

      var parsed = null;
      try {
        parsed = JSON.parse(copiedText);
      } catch (err3) {
        parsed = null;
      }
      var internal = Boolean(parsed && parsed.magic === 'MIND-ELIXIR-WAIT-COPY' && Array.isArray(parsed.data));

      var pasteClipboard = {
        getData: function(type) {
          var name = type === undefined || type === null ? '' : String(type).toLowerCase();
          if (name === 'text/plain' || name === 'text') return copiedText;
          return '';
        },
      };
      var pasteEvent = null;
      try {
        pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      } catch (err4) {
        pasteEvent = document.createEvent('Event');
        pasteEvent.initEvent('paste', true, true);
      }
      try {
        Object.defineProperty(pasteEvent, 'clipboardData', { value: pasteClipboard });
      } catch (err5) {
        try {
          pasteEvent.clipboardData = pasteClipboard;
        } catch (err6) {
          // ignore
        }
      }
      activeEl.dispatchEvent(pasteEvent);

      var afterNodes = viewerEl.querySelectorAll('me-tpc');
      var afterExact = 0;
      Array.prototype.forEach.call(afterNodes || [], function(node) {
        var textEl = node && node.querySelector ? node.querySelector('.text') : null;
        var label = textEl ? String(textEl.textContent || '').trim() : '';
        if (label === '支付成功') afterExact += 1;
      });
      return {
        ok: true,
        focusIsMindContainer: focusIsMindContainer,
        copyDefaultPrevented: copyEvent.defaultPrevented === true,
        pasteDefaultPrevented: pasteEvent.defaultPrevented === true,
        internal: internal,
        beforeCount: beforeNodes.length,
        afterCount: afterNodes.length,
        beforeExact: beforeExact,
        afterExact: afterExact,
      };
    });

    expect(copyPasteState).toBeTruthy();
    expect(copyPasteState && copyPasteState.ok).toBeTruthy();
    expect(copyPasteState && copyPasteState.focusIsMindContainer).toBeTruthy();
    expect(copyPasteState && copyPasteState.copyDefaultPrevented).toBeTruthy();
    expect(copyPasteState && copyPasteState.pasteDefaultPrevented).toBeTruthy();
    expect(copyPasteState && copyPasteState.internal).toBeTruthy();
    expect(copyPasteState && copyPasteState.afterCount).toBeGreaterThan(copyPasteState ? copyPasteState.beforeCount : 0);
    expect(copyPasteState && copyPasteState.afterExact).toBeGreaterThan(copyPasteState ? copyPasteState.beforeExact : 0);
    await expect(viewer.locator('[data-mind-action="undo"]')).toBeEnabled();
  });
});
