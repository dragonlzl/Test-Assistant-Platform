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
    if (window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab(name);
    }
  }, tabName);
}

function buildWriterRoutes(page, options) {
  const {
    token,
    user,
    project,
    versions,
    caseFiles,
    caseItemsByFileId,
    holder,
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
      return respond(200, caseFiles.slice());
    }
    if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      return respond(200, []);
    }

    const importMatch = pathName === '/api/case-files/import' && method === 'POST';
    if (importMatch) {
      if (!authed) return respond(401, { detail: 'unauthorized' });
      const payload = route.request().postDataJSON() || {};
      holder.importPayload = payload;

      const nextId = 9901;
      const now = new Date().toISOString();
      const fileNameClean = '修改此处以确定用例名';
      const imported = {
        id: nextId,
        project_id: payload.project_id,
        version_id: payload.version_id,
        file_name_clean: fileNameClean,
        reuse_enabled: false,
        item_count: Array.isArray(payload.items) ? payload.items.length : 0,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      };
      caseFiles.unshift(imported);
      caseItemsByFileId[nextId] = (Array.isArray(payload.items) ? payload.items : []).map((it, idx) => ({
        id: 88000 + idx,
        case_file_id: nextId,
        module: it.module,
        title: it.title,
        priority: it.priority,
        precondition: it.precondition,
        steps: it.steps,
        expected: it.expected,
        remark: it.remark || '',
        created_at: now,
        updated_at: now,
      }));
      return respond(201, imported);
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

test.describe('用例库 XMind 编写用例', () => {
  test('入口直接编辑并可确认入库后自动打开查看编辑', async ({ page }) => {
    const token = 'token-case-library-xmind-writer';
    const user = { id: 45, username: 'writer_admin', role: 'admin', level: 'leader' };
    const project = { id: 701, name: '编写项目' };
    const versions = [{ id: 801, name: 'v1' }];
    const caseFiles = [];
    const caseItemsByFileId = {};
    const holder = { importPayload: null };

    await buildWriterRoutes(page, {
      token,
      user,
      project,
      versions,
      caseFiles,
      caseItemsByFileId,
      holder,
    });

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('tap-current-user', JSON.stringify(payload.user)); } catch (_) {}
    }, { token, user });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryWriterDrawerBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindStructureDrawerTitle')).toContainText('XMind 编写用例');

    const viewer = page.locator('#caseLibraryWriterXmindStructureViewer');
    await expect(viewer.locator('[data-mind-action="edit-cancel"]')).toBeVisible();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();
    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('用例：修改此处以确定用例的文件名');
    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('子模块：修改此处以确定子模块');
    await expect(page.locator('#xmindStructureDrawerBody')).toContainText('用例名：修改此处以确定用例名');

    const priorityPatched = await page.evaluate(() => {
      var nodes = document.querySelectorAll('#caseLibraryWriterXmindStructureViewer me-tpc');
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (!node || !node.nodeObj) continue;
        var topic = String(node.nodeObj.topic || '');
        if (topic.indexOf('优先级：') !== 0) continue;
        node.nodeObj.topic = 'p2';
        var textEl = node.querySelector ? node.querySelector('.text') : null;
        if (textEl) textEl.textContent = 'p2';
        return true;
      }
      return false;
    });
    expect(priorityPatched).toBeTruthy();

    const exportBtn = viewer.locator('[data-mind-action="export-xmind"]');
    await expect(exportBtn).toBeEnabled();
    await exportBtn.click();
    await expect(page.locator('#caseLibraryStatus')).toContainText('已导出 XMind');

    await viewer.locator('[data-mind-action="edit-save"]').click();
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('#caseLibraryWriterPublishDrawer')).toHaveClass(/open/);

    await page.waitForFunction((pid) => {
      var sel = document.getElementById('caseLibraryWriterPublishProjectSelect');
      if (!sel) return false;
      var options = Array.prototype.slice.call(sel.options || []);
      return options.some((opt) => String(opt.value || '') === String(pid));
    }, String(project.id), { timeout: 10000 });
    await page.selectOption('#caseLibraryWriterPublishProjectSelect', String(project.id));
    await page.waitForFunction((vid) => {
      var sel = document.getElementById('caseLibraryWriterPublishVersionSelect');
      if (!sel) return false;
      var options = Array.prototype.slice.call(sel.options || []);
      return options.some((opt) => String(opt.value || '') === String(vid));
    }, String(versions[0].id), { timeout: 10000 });
    await page.selectOption('#caseLibraryWriterPublishVersionSelect', String(versions[0].id));
    await expect(page.locator('#caseLibraryWriterPublishConfirmBtn')).toBeEnabled();
    await page.click('#caseLibraryWriterPublishConfirmBtn');

    const payload = holder.importPayload;
    expect(payload).toBeTruthy();
    if (payload) {
      expect(payload.project_id).toBe(project.id);
      expect(payload.version_id).toBe(versions[0].id);
      expect(Array.isArray(payload.items)).toBeTruthy();
      expect(payload.items.length).toBeGreaterThan(0);
      expect(String(payload.items[0].module || '')).toContain('子模块');
      expect(String(payload.items[0].title || '')).toContain('用例名');
      expect(String(payload.items[0].priority || '')).toBe('P2');
    }

    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditFileName')).toContainText('修改此处以确定用例名');
    await expect(page.locator('#caseLibraryEditStatus')).toContainText('已加载');
  });

  test('取消编辑二次确认提示包含恢复默认结构说明', async ({ page }) => {
    const token = 'token-case-library-xmind-writer-cancel';
    const user = { id: 46, username: 'writer_cancel', role: 'admin', level: 'leader' };
    const project = { id: 702, name: '编写项目2' };
    const versions = [{ id: 802, name: 'v1' }];
    const caseFiles = [];
    const caseItemsByFileId = {};
    const holder = { importPayload: null };

    await buildWriterRoutes(page, {
      token,
      user,
      project,
      versions,
      caseFiles,
      caseItemsByFileId,
      holder,
    });

    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
      try { localStorage.setItem('tap-current-user', JSON.stringify(payload.user)); } catch (_) {}
    }, { token, user });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryWriterDrawerBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);

    const viewer = page.locator('#caseLibraryWriterXmindStructureViewer');
    const rootChanged = await page.evaluate(() => {
      var root = null;
      var all = document.querySelectorAll('#caseLibraryWriterXmindStructureViewer me-tpc');
      for (var j = 0; j < all.length; j += 1) {
        var item = all[j];
        if (!item || !item.nodeObj) continue;
        if (item.nodeObj.parent) continue;
        root = item;
        break;
      }
      if (!root || !root.nodeObj) return false;
      var topic = String(root.nodeObj.topic || '');
      root.nodeObj.topic = topic + '（改）';
      var textEl = root.querySelector ? root.querySelector('.text') : null;
      if (textEl) textEl.textContent = root.nodeObj.topic;
      return true;
    });
    expect(rootChanged).toBeTruthy();
    await page.waitForTimeout(120);

    await viewer.locator('[data-mind-action="edit-cancel"]').click();
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('恢复默认结构');
  });
});
