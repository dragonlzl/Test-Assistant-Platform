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

async function gotoExec(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/case-exec.html';
  await page.goto(url);
  await ensureMindElixirReady(page, url);
  return base;
}

async function waitCaseLibraryReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.caseLibraryBound === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', {}, { timeout: 30000 });
}

async function waitExecReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.tempExecApi, {}, { timeout: 30000 });
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

async function getNodeCenter(page, viewerSelector, topicText) {
  var position = await page.evaluate(({ viewer, topic }) => {
    var nodes = document.querySelectorAll(viewer + ' me-tpc');
    var found = null;
    Array.prototype.some.call(nodes, function(node) {
      var textEl = node && node.querySelector ? node.querySelector('.text') : null;
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      if (label !== topic) return false;
      var rect = (textEl || node).getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      found = {
        x: rect.left + (rect.width / 2),
        y: rect.top + (rect.height / 2),
      };
      return true;
    });
    return found;
  }, { viewer: viewerSelector, topic: topicText });
  expect(position).toBeTruthy();
  return position;
}

async function clickEditNode(page, viewerSelector, topicText, ctrlKey) {
  var point = await getNodeCenter(page, viewerSelector, topicText);
  if (ctrlKey === true) await page.keyboard.down('Control');
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  if (ctrlKey === true) await page.keyboard.up('Control');
  await page.waitForTimeout(ctrlKey === true ? 220 : 120);
}

async function readEditSelectedLabels(page, viewerSelector) {
  return page.evaluate((viewer) => {
    var selected = document.querySelectorAll(viewer + ' .selected');
    var labels = [];
    var seen = {};
    Array.prototype.forEach.call(selected || [], function(el) {
      var node = el && el.closest ? el.closest('me-tpc') : null;
      if (!node || !node.querySelector) return;
      var textEl = node.querySelector('.text');
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      if (!label || seen[label]) return;
      seen[label] = true;
      labels.push(label);
    });
    return labels;
  }, viewerSelector);
}

async function clearEditSelection(page, viewerSelector) {
  var point = await page.evaluate((viewer) => {
    var canvas = document.querySelector(viewer + ' .xmind-structure-canvas');
    if (!canvas || !canvas.getBoundingClientRect || typeof document.elementsFromPoint !== 'function') return null;
    var rect = canvas.getBoundingClientRect();
    var cols = [0.08, 0.14, 0.22, 0.78, 0.86, 0.92];
    var rows = [0.14, 0.22, 0.34, 0.66, 0.78, 0.88];
    for (var ri = 0; ri < rows.length; ri += 1) {
      for (var ci = 0; ci < cols.length; ci += 1) {
        var x = rect.left + (rect.width * cols[ci]);
        var y = rect.top + (rect.height * rows[ri]);
        var stack = document.elementsFromPoint(x, y) || [];
        var blocked = stack.some(function(el) {
          return Boolean(el && el.closest && el.closest('me-tpc'));
        });
        if (!blocked) return { x: x, y: y };
      }
    }
    return {
      x: rect.left + 18,
      y: rect.top + 18,
    };
  }, viewerSelector);
  expect(point).toBeTruthy();
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
}

async function boxSelectTopics(page, viewerSelector, topics) {
  var bounds = await page.evaluate(({ viewer, labels }) => {
    var wanted = Array.isArray(labels) ? labels.slice() : [];
    var found = [];
    var nodes = document.querySelectorAll(viewer + ' me-tpc');
    Array.prototype.forEach.call(nodes, function(node) {
      if (!node || !node.querySelector) return;
      var textEl = node.querySelector('.text');
      var label = textEl
        ? String((typeof textEl.innerText === 'string' ? textEl.innerText : textEl.textContent) || '').replace(/\s+/g, ' ').trim()
        : '';
      if (wanted.indexOf(label) === -1) return;
      var rect = (textEl || node).getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      found.push({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      });
    });
    if (found.length !== wanted.length) return null;
    var union = {
      left: found[0].left,
      top: found[0].top,
      right: found[0].right,
      bottom: found[0].bottom,
    };
    found.forEach(function(rect) {
      if (rect.left < union.left) union.left = rect.left;
      if (rect.top < union.top) union.top = rect.top;
      if (rect.right > union.right) union.right = rect.right;
      if (rect.bottom > union.bottom) union.bottom = rect.bottom;
    });
    return union;
  }, { viewer: viewerSelector, labels: topics });
  expect(bounds).toBeTruthy();
  if (!bounds) return;
  await page.mouse.move(bounds.left - 18, bounds.top - 18);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(bounds.right + 18, bounds.bottom + 18, { steps: 8 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(180);
}

async function assertBoxDeleteRemovesTopics(page, viewerSelector, topics) {
  await clearEditSelection(page, viewerSelector);
  await boxSelectTopics(page, viewerSelector, topics);
  await page.locator(viewerSelector).focus();
  await page.keyboard.press('Delete');
  for (var i = 0; i < (topics || []).length; i += 1) {
    await expect(page.locator(viewerSelector + ' me-tpc .text', { hasText: topics[i] })).toHaveCount(0);
  }
}

async function expectSelectedLabels(page, viewerSelector, expectedLabels) {
  var normalized = (expectedLabels || []).slice().sort();
  await expect.poll(async () => {
    var labels = await readEditSelectedLabels(page, viewerSelector);
    return labels.slice().sort();
  }).toEqual(normalized);
}

async function runEditSelectionAssertions(page, viewerSelector) {
  await clearEditSelection(page, viewerSelector);
  await clickEditNode(page, viewerSelector, '余额不足时支付失败');
  await expectSelectedLabels(page, viewerSelector, ['余额不足时支付失败']);

  await clickEditNode(page, viewerSelector, '优惠券支付成功', true);
  await expectSelectedLabels(page, viewerSelector, ['余额不足时支付失败', '优惠券支付成功']);

  await clearEditSelection(page, viewerSelector);
  await expect.poll(async () => {
    return (await readEditSelectedLabels(page, viewerSelector)).length;
  }).toBe(0);

  await boxSelectTopics(page, viewerSelector, ['余额不足时支付失败', '优惠券支付成功']);
  await expect.poll(async () => {
    var labels = await readEditSelectedLabels(page, viewerSelector);
    return labels.filter(function(label) {
      return label === '余额不足时支付失败' || label === '优惠券支付成功';
    }).length;
  }).toBeGreaterThanOrEqual(2);

  await assertBoxDeleteRemovesTopics(page, viewerSelector, ['余额不足时支付失败', '优惠券支付成功']);
  await assertBoxDeleteRemovesTopics(page, viewerSelector, ['库存不足时下单失败', '提示库存不足', '地址缺失时提交失败', '提示收货地址必填']);
}

test.describe('XMind 编辑态节点选择', () => {
  test('用例库 XMind 编辑态支持单选、Ctrl 多选与框选', async ({ page }) => {
    const token = 'token-case-library-xmind-edit-selection';
    const user = { id: 129, username: 'xmind_edit_selection_user', role: 'admin', level: 'leader' };
    const project = { id: 1301, name: 'XMind编辑态选择项目' };
    const versions = [{ id: 1401, name: 'v1' }];
    const now = new Date().toISOString();
    const caseFileId = 1501;
    const caseFiles = [{
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '编辑态节点选择用例集',
      reuse_enabled: false,
      item_count: 4,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    }];
    const caseItemsByFileId = {};
    caseItemsByFileId[caseFileId] = [{
      id: 15001,
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
    }, {
      id: 15002,
      case_file_id: caseFileId,
      module: '支付模块',
      title: '优惠券支付成功',
      priority: 'P2',
      precondition: '账号已登录且有可用优惠券',
      steps: '选择优惠券并提交支付',
      expected: '提示支付成功',
      remark: '',
      created_at: now,
      updated_at: now,
    }, {
      id: 15003,
      case_file_id: caseFileId,
      module: '下单模块',
      title: '库存不足时下单失败',
      priority: 'P1',
      precondition: '商品库存不足',
      steps: '提交下单请求',
      expected: '提示库存不足',
      remark: '',
      created_at: now,
      updated_at: now,
    }, {
      id: 15004,
      case_file_id: caseFileId,
      module: '配送模块',
      title: '地址缺失时提交失败',
      priority: 'P2',
      precondition: '购物车中存在商品',
      steps: '不填写收货地址直接提交',
      expected: '提示收货地址必填',
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
      try { localStorage.setItem('tap-theme-hint', 'light'); } catch (_) {}
      try { localStorage.setItem('usecase-settings-v1', JSON.stringify({ theme: 'light' })); } catch (_) {}
    }, { token });

    await gotoCaseLibrary(page);
    await waitCaseLibraryReady(page);
    await switchToTab(page, 'case-library');

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click('#caseLibraryEditListBody [data-case-lib-edit="' + String(caseFileId) + '"]');
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();

    await page.click('#caseLibraryXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    const viewer = page.locator('#caseLibraryXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await runEditSelectionAssertions(page, '#caseLibraryXmindStructureViewer');
  });

  test('用例执行 XMind 编辑态支持单选、Ctrl 多选与框选', async ({ page }) => {
    const fileId = 'temp-xmind-edit-selection';
    await page.addInitScript((payload) => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
      try { localStorage.removeItem('tap-auth-token'); } catch (_) {}
      try { localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(payload)); } catch (_) {}
      try { localStorage.setItem('tempexec-focus-v1', JSON.stringify([])); } catch (_) {}
    }, {
      files: [{
        id: fileId,
        name: '执行编辑态选择集',
        requirement: '执行编辑态选择需求',
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
        }, {
          module: '下单模块',
          title: '库存不足时下单失败',
          priority: 'P1',
          preconditions: '商品库存不足',
          steps: '提交下单请求',
          expected: '提示库存不足',
          actual: '未执行',
          remark: '',
        }, {
          module: '配送模块',
          title: '地址缺失时提交失败',
          priority: 'P2',
          preconditions: '购物车中存在商品',
          steps: '不填写收货地址直接提交',
          expected: '提示收货地址必填',
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
      var btn = document.getElementById('tempExecXmindViewBtn');
      return Boolean(btn && !btn.disabled && !(btn.classList && btn.classList.contains('hidden')));
    }, {}, { timeout: 15000 });

    await page.click('#tempExecXmindViewBtn');
    await expect(page.locator('#xmindStructureDrawer')).toHaveClass(/open/);
    const viewer = page.locator('#tempExecXmindStructureViewer');
    await viewer.locator('[data-mind-action="edit-enter"]').click();
    await expect(viewer.locator('[data-mind-action="edit-save"]')).toBeVisible();

    await runEditSelectionAssertions(page, '#tempExecXmindStructureViewer');
  });
});
