const { test, expect } = require('@playwright/test');
const { clickSemanticLocator } = require('./helpers/vtable_semantic');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
    timeout,
  });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout });
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

const historyQueryHostSelector = '#caseLibraryHistoryDrawerTableHost';
const historyDetailHostSelector = '#caseLibraryHistoryTableHost';
const historyQueryTableId = 'case-library-history-query';
const historyDetailTableId = 'case-library-history-detail';

async function waitForVTable(page, hostSelector, tableId) {
  const host = page.locator(hostSelector);
  await expect(host.locator('.tap-vtable-shell.is-ready')).toHaveCount(1, { timeout: 10000 });
  await expect.poll(() => page.evaluate((id) => {
    const tableHost = window.app && window.app.ui ? window.app.ui.VTableHost : null;
    const controller = tableHost && typeof tableHost.get === 'function' ? tableHost.get(id) : null;
    return Boolean(controller && typeof controller.getModel === 'function' && controller.getModel());
  }, tableId)).toBe(true);
  return host;
}

async function getVTableRowKeys(page, tableId) {
  return page.evaluate((id) => {
    const tableHost = window.app && window.app.ui ? window.app.ui.VTableHost : null;
    const controller = tableHost && typeof tableHost.get === 'function' ? tableHost.get(id) : null;
    const model = controller && typeof controller.getModel === 'function' ? controller.getModel() : null;
    return model && Array.isArray(model.records)
      ? model.records.map((record) => String(record && record.__rowKey ? record.__rowKey : ''))
      : [];
  }, tableId);
}

async function clickSemanticAction(page, hostSelector, rowKey, action) {
  const clicked = await page.locator(hostSelector).evaluate((host, target) => {
    const rows = Array.prototype.slice.call(
      host.querySelectorAll('.tap-vtable-semantic tr[data-row-key]')
    );
    const row = rows.find((item) => item.getAttribute('data-row-key') === target.rowKey);
    const button = row
      ? row.querySelector('[data-table-action="' + target.action + '"]')
      : null;
    if (!button || typeof button.click !== 'function') return false;
    button.click();
    return true;
  }, { rowKey, action });
  expect(clicked).toBe(true);
}

async function sampleVTableCanvas(page, hostSelector) {
  return page.locator(hostSelector).evaluate((host) => {
    const shell = host.querySelector('.tap-vtable-shell');
    const canvases = Array.prototype.slice.call(host.querySelectorAll('canvas'));
    const hostRect = host.getBoundingClientRect();
    let coloredPixels = 0;
    let canvasHash = 2166136261;
    canvases.forEach((canvas) => {
      const context = canvas.getContext('2d');
      if (!context || !canvas.width || !canvas.height) return;
      const width = Math.min(canvas.width, 1000);
      const height = Math.min(canvas.height, 420);
      const data = context.getImageData(0, 0, width, height).data;
      for (let index = 0; index < data.length; index += 16) {
        if (data[index + 3] > 0) coloredPixels += 1;
        canvasHash ^= data[index];
        canvasHash = Math.imul(canvasHash, 16777619);
        canvasHash ^= data[index + 1];
        canvasHash = Math.imul(canvasHash, 16777619);
        canvasHash ^= data[index + 2];
        canvasHash = Math.imul(canvasHash, 16777619);
      }
    });
    return {
      canvasCount: canvases.length,
      coloredPixels,
      canvasHash: canvasHash >>> 0,
      background: shell ? getComputedStyle(shell).backgroundColor : '',
      hostLeft: hostRect.left,
      hostRight: hostRect.right,
      hostWidth: hostRect.width,
      hostHeight: hostRect.height,
      viewportWidth: window.innerWidth,
    };
  });
}

test.describe('用例库-用例改动历史抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'test-token');
      } catch (_) {}
    });
  });

  test('按项目/版本查询改动用例，并跳转展示历史详情（含操作人）', async ({ page }) => {
    test.setTimeout(60000);
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const projects = [
      { id: 1, name: '项目A', description: '' },
      { id: 2, name: '项目B', description: '' },
    ];
    const versionsByProject = {
      1: [{ id: 11, project_id: 1, name: 'v1' }],
      2: [{ id: 21, project_id: 2, name: 'v2' }],
    };
    const primaryHistoryFiles = [
      {
        project_id: 1,
        file_name_clean: '登录',
        case_file_id: 101,
        version_id: 11,
        is_deleted: false,
        last_changed_at: new Date().toISOString(),
        last_operator: 'demo_user',
        importer_name: 'demo_user',
        imported_at: new Date(Date.now() - 10000).toISOString(),
        last_updated_by_name: 'demo_user',
        updated_at: new Date(Date.now() - 3000).toISOString(),
        total_events: 31,
      },
    ].concat(Array.from({ length: 21 }).map((_, index) => ({
      project_id: 1,
      file_name_clean: `历史文件${index + 2}`,
      case_file_id: 102 + index,
      version_id: 11,
      is_deleted: false,
      last_changed_at: new Date(Date.now() - (index + 1) * 1000).toISOString(),
      last_operator: 'history_user',
      importer_name: 'history_user',
      imported_at: new Date(Date.now() - 20000).toISOString(),
      last_updated_by_name: 'history_user',
      updated_at: new Date(Date.now() - 5000).toISOString(),
      total_events: 1,
    })));
    const changeFilesByProjectVersion = {
      '1::11': primaryHistoryFiles,
      '2::21': [
        {
          project_id: 2,
          file_name_clean: '支付',
          case_file_id: null,
          version_id: 21,
          is_deleted: true,
          last_changed_at: new Date().toISOString(),
          last_operator: 'demo_user',
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 9000).toISOString(),
          last_updated_by_name: 'demo_user',
          updated_at: new Date(Date.now() - 2000).toISOString(),
          total_events: 2,
        },
      ],
    };
    const loginHistory = [
      {
        id: 1,
        kind: 'import',
        changed_at: new Date().toISOString(),
        operator: 'demo_user',
        changed_fields: [],
        old: null,
        new: null,
        meta: {},
      },
      {
        id: 2,
        kind: 'append',
        changed_at: new Date(Date.now() - 1000).toISOString(),
        operator: 'demo_user',
        changed_fields: [],
        old: null,
        new: null,
        meta: {},
      },
      {
        id: 3,
        kind: 'added',
        changed_at: new Date(Date.now() - 2000).toISOString(),
        operator: 'demo_user',
        changed_fields: [],
        old: null,
        new: { module: '登录', title: '新增登录', precondition: '无', steps: '新增步骤', expected: '成功' },
        meta: {},
      },
      {
        id: 4,
        kind: 'deleted',
        changed_at: new Date(Date.now() - 3000).toISOString(),
        operator: 'demo_user',
        changed_fields: [],
        old: { module: '登录', title: '删除登录', precondition: '无', steps: '删除步骤', expected: '失败' },
        new: null,
        meta: {},
      },
      {
        id: 5,
        kind: 'reimport',
        changed_at: new Date(Date.now() - 4000).toISOString(),
        operator: 'demo_user',
        changed_fields: [],
        old: null,
        new: null,
        meta: {},
      },
      {
        id: 6,
        kind: 'file_deleted',
        changed_at: new Date(Date.now() - 5000).toISOString(),
        operator: 'demo_user',
        changed_fields: [],
        old: null,
        new: null,
        meta: {},
      },
    ].concat(Array.from({ length: 25 }).map((_, index) => ({
      id: index + 7,
      kind: 'updated',
      changed_at: new Date(Date.now() - (index + 6) * 1000).toISOString(),
      operator: 'demo_user',
      changed_fields: ['steps'],
      old: { module: '登录', title: '正常登录', precondition: '无', steps: `旧${index + 1}`, expected: '成功' },
      new: { module: '登录', title: '正常登录', precondition: '无', steps: `新${index + 1}`, expected: '成功' },
      meta: { changed_fields: ['steps'] },
    })));
    const historyByKey = {
      '1::登录': {
        project_id: 1,
        file_name_clean: '登录',
        case_file_id: 101,
        version_id: 11,
        is_deleted: false,
        history: loginHistory,
      },
      '2::支付': {
        project_id: 2,
        file_name_clean: '支付',
        case_file_id: null,
        version_id: 21,
        is_deleted: true,
        history: [
          {
            id: 3,
            kind: 'file_deleted',
            changed_at: new Date().toISOString(),
            operator: 'demo_user',
            changed_fields: [],
            old: null,
            new: null,
            meta: {},
          },
        ],
      },
    };
    const caseFilesByProject = {
      1: [
        {
          id: 101,
          project_id: 1,
          version_id: 11,
          file_name_clean: '登录',
          reuse_enabled: false,
          item_count: 2,
          importer_id: 1,
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 50000).toISOString(),
          updated_at: new Date(Date.now() - 30000).toISOString(),
          last_updated_by: 1,
          last_updated_by_name: 'demo_user',
        },
      ],
      2: [],
    };
    const caseItemsByFileId = {
      101: [
        { id: 1001, case_file_id: 101, module: '登录', title: '正常登录', expected: '成功', priority: 'P0', precondition: '无', steps: '步骤', remark: '' },
        { id: 1002, case_file_id: 101, module: '登录', title: '异常登录', expected: '失败', priority: 'P1', precondition: '无', steps: '步骤', remark: '' },
      ],
    };
    let historyRequestCount = 0;

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      const verMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (verMatch && method === 'GET') {
        const pid = Number(verMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }

      if (pathName === '/api/case-files' && method === 'GET') {
        const pid = Number(url.searchParams.get('project_id') || '0');
        return respond(200, (caseFilesByProject[pid] || []).slice());
      }
      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        const fid = Number(itemsMatch[1]);
        return respond(200, (caseItemsByFileId[fid] || []).slice());
      }

      if (pathName === '/api/case-files/change-history/files' && method === 'GET') {
        const pid = url.searchParams.get('project_id') || '';
        const vid = url.searchParams.get('version_id') || '';
        const key = `${pid}::${vid}`;
        return respond(200, (changeFilesByProjectVersion[key] || []).slice());
      }
      if (pathName === '/api/case-files/change-history' && method === 'GET') {
        historyRequestCount += 1;
        const pid = url.searchParams.get('project_id') || '';
        const name = url.searchParams.get('file_name_clean') || '';
        const vid = url.searchParams.get('version_id') || '';
        const key = vid ? `${pid}::${vid}::${name}` : `${pid}::${name}`;
        return respond(
          200,
          historyByKey[key] ||
            historyByKey[`${pid}::${name}`] ||
            { project_id: Number(pid), file_name_clean: name, history: [], is_deleted: false }
        );
      }

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.setViewportSize({ width: 640, height: 900 });
    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');

    // 先进入“查看&编辑”选中用例，确保编辑视图持久化存在。
    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', '1');
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('登录');
    await clickSemanticLocator(
      page.locator('#caseLibraryEditListBody').getByRole('button', { name: '编辑', exact: true })
    );
    await expect(page.locator('#caseLibraryEditCard')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caseLibraryEditFileName')).toContainText('登录');

    await page.click('#openCaseLibraryHistoryDrawerBtn');
    await expect(page.locator('#caseLibraryHistoryDrawer')).toHaveClass(/open/);
    await expect.poll(() => page.locator('#caseLibraryHistoryDrawer .drawer-panel').evaluate((panel) => {
      return panel.getBoundingClientRect().right - window.innerWidth;
    })).toBeLessThanOrEqual(1);
    const drawerMetrics = await page.locator('#caseLibraryHistoryDrawer .drawer-panel').evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, viewportWidth: window.innerWidth };
    });
    expect(drawerMetrics.width).toBeGreaterThan(200);
    expect(drawerMetrics.left).toBeGreaterThanOrEqual(-1);
    expect(drawerMetrics.right).toBeLessThanOrEqual(drawerMetrics.viewportWidth + 1);

    await page.selectOption('#caseLibraryHistoryProjectSelect', '1');
    await expect(page.locator('#caseLibraryHistoryVersionSelect')).not.toBeDisabled();
    await expect(page.locator('#caseLibraryHistoryVersionSelect')).toContainText('全部版本');
    await page.selectOption('#caseLibraryHistoryVersionSelect', '11');
    await page.click('#caseLibraryHistoryQueryBtn');

    const queryHost = await waitForVTable(page, historyQueryHostSelector, historyQueryTableId);
    const loginQueryKey = 'history-file:1:11:id:101';
    const firstQueryPageKeys = [loginQueryKey].concat(
      Array.from({ length: 19 }).map((_, index) => `history-file:1:11:id:${102 + index}`)
    );
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual(firstQueryPageKeys);
    await expect(queryHost.locator('.tap-vtable-semantic tr[data-row-key]')).toHaveCount(20);
    const loginQueryRow = queryHost.locator(`.tap-vtable-semantic tr[data-row-key="${loginQueryKey}"]`);
    await expect(loginQueryRow.locator('[data-field="fileName"]')).toContainText('登录');
    await expect(loginQueryRow.locator('[data-field="versionName"]')).toHaveText('v1');
    await expect(loginQueryRow.locator('[data-field="importerName"]')).toHaveText('demo_user');

    await page.locator('[data-case-lib-drawer-page="next"][data-case-lib-drawer-scope="history-query"]').first().click();
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual([
      'history-file:1:11:id:121',
      'history-file:1:11:id:122',
    ]);
    await page.fill('#caseLibraryHistorySearchInput', '登录');
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual([loginQueryKey]);
    await expect(page.locator('#caseLibraryHistoryDrawerPaginationTop')).toContainText('显示 1-1 / 共 1 条');
    await page.fill('#caseLibraryHistorySearchInput', '不存在的历史');
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual([]);
    await expect(queryHost.locator('.tap-vtable-semantic tr[data-row-key]')).toHaveCount(0);
    await expect(queryHost.locator('.tap-vtable-semantic')).toContainText('暂无有改动记录的用例文件');
    await page.click('#caseLibraryHistoryClearBtn');
    await expect(page.locator('#caseLibraryHistorySearchInput')).toHaveValue('');
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual(firstQueryPageKeys);
    await expect(page.locator('#caseLibraryHistoryDrawerPaginationTop')).toContainText('显示 1-20 / 共 22 条');
    await page.fill('#caseLibraryHistorySearchInput', '登录');
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual([loginQueryKey]);

    const lightQueryCanvas = await sampleVTableCanvas(page, historyQueryHostSelector);
    expect(lightQueryCanvas.canvasCount).toBeGreaterThan(0);
    expect(lightQueryCanvas.coloredPixels).toBeGreaterThan(100);
    expect(lightQueryCanvas.hostWidth).toBeGreaterThan(100);
    expect(lightQueryCanvas.hostHeight).toBeGreaterThan(100);
    expect(lightQueryCanvas.hostLeft).toBeGreaterThanOrEqual(-1);
    expect(lightQueryCanvas.hostRight).toBeLessThanOrEqual(lightQueryCanvas.viewportWidth + 1);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect.poll(async () => (await sampleVTableCanvas(page, historyQueryHostSelector)).canvasHash)
      .not.toBe(lightQueryCanvas.canvasHash);
    const darkQueryCanvas = await sampleVTableCanvas(page, historyQueryHostSelector);
    expect(darkQueryCanvas.background).not.toBe(lightQueryCanvas.background);
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual([loginQueryKey]);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await expect.poll(async () => (await sampleVTableCanvas(page, historyQueryHostSelector)).canvasHash)
      .not.toBe(darkQueryCanvas.canvasHash);

    await clickSemanticAction(page, historyQueryHostSelector, loginQueryKey, 'open-history');
    await expect(page.locator('#caseLibraryHistoryDrawer')).not.toHaveClass(/open/);

    await expect(page.locator('#caseLibraryHistoryDetailCard')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caseLibraryEditCard')).toHaveClass(/hidden/);
    const detailHost = await waitForVTable(page, historyDetailHostSelector, historyDetailTableId);
    const firstDetailPageKeys = Array.from({ length: 20 }).map((_, index) => `history-event:${index + 1}`);
    await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(firstDetailPageKeys);
    await expect(detailHost.locator('.tap-vtable-semantic tr[data-row-key]')).toHaveCount(20);
    await expect(
      detailHost.locator('.tap-vtable-semantic tr[data-row-key="history-event:1"] [data-field="operator"]')
    ).toHaveText('demo_user');

    const filterCases = [
      { selector: '#caseLibraryHistoryAppendPill', kind: 'append', label: '追加', count: 1, keys: ['history-event:2'] },
      { selector: '#caseLibraryHistoryAddedPill', kind: 'added', label: '新增', count: 1, keys: ['history-event:3'] },
      { selector: '#caseLibraryHistoryUpdatedPill', kind: 'updated', label: '改动', count: 25, keys: Array.from({ length: 20 }).map((_, index) => `history-event:${index + 7}`) },
      { selector: '#caseLibraryHistoryDeletedPill', kind: 'deleted', label: '删除', count: 1, keys: ['history-event:4'] },
      { selector: '#caseLibraryHistoryImportPill', kind: 'import', label: '导入', count: 1, keys: ['history-event:1'] },
      { selector: '#caseLibraryHistoryReimportPill', kind: 'reimport', label: '重导', count: 1, keys: ['history-event:5'] },
      { selector: '#caseLibraryHistoryFileDeletedPill', kind: 'file_deleted', label: '整份删除', count: 1, keys: ['history-event:6'] },
    ];
    for (const filterCase of filterCases) {
      const pill = page.locator(filterCase.selector);
      await expect(pill).toHaveText(`${filterCase.label} ${filterCase.count}`);
      await pill.click();
      await expect(pill).toHaveClass(/active/);
      await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(filterCase.keys);
      await expect(detailHost.locator('.tap-vtable-semantic tr[data-row-key]')).toHaveCount(filterCase.keys.length);
      await pill.click();
      await expect(pill).not.toHaveClass(/active/);
      await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(firstDetailPageKeys);
    }

    const lightDetailCanvas = await sampleVTableCanvas(page, historyDetailHostSelector);
    expect(lightDetailCanvas.canvasCount).toBeGreaterThan(0);
    expect(lightDetailCanvas.coloredPixels).toBeGreaterThan(100);
    expect(lightDetailCanvas.hostWidth).toBeGreaterThan(100);
    expect(lightDetailCanvas.hostHeight).toBeGreaterThan(100);
    expect(lightDetailCanvas.hostLeft).toBeGreaterThanOrEqual(-1);
    expect(lightDetailCanvas.hostRight).toBeLessThanOrEqual(lightDetailCanvas.viewportWidth + 1);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect.poll(async () => (await sampleVTableCanvas(page, historyDetailHostSelector)).canvasHash)
      .not.toBe(lightDetailCanvas.canvasHash);
    const darkDetailCanvas = await sampleVTableCanvas(page, historyDetailHostSelector);
    expect(darkDetailCanvas.background).not.toBe(lightDetailCanvas.background);
    await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(firstDetailPageKeys);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

    // 详情分页：筛选后的 25 条改动默认每页 20 条，刷新后保留筛选与页码。
    await page.click('#caseLibraryHistoryUpdatedPill');
    await expect(page.locator('#caseLibraryHistoryUpdatedPill')).toHaveClass(/active/);
    await expect(page.locator('#caseLibraryHistoryPaginationTop')).toContainText('每页 20 条');
    await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(
      Array.from({ length: 20 }).map((_, index) => `history-event:${index + 7}`)
    );
    await page.locator('[data-case-lib-history-page="next"]').first().click();
    const updatedSecondPageKeys = Array.from({ length: 5 }).map((_, index) => `history-event:${index + 27}`);
    await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(updatedSecondPageKeys);
    await expect(detailHost.locator('.tap-vtable-semantic tr[data-row-key]')).toHaveCount(5);
    const requestsBeforeRefresh = historyRequestCount;
    await page.click('#caseLibraryHistoryRefreshBtn');
    await expect.poll(() => historyRequestCount).toBe(requestsBeforeRefresh + 1);
    await waitForVTable(page, historyDetailHostSelector, historyDetailTableId);
    await expect(page.locator('#caseLibraryHistoryUpdatedPill')).toHaveClass(/active/);
    await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(updatedSecondPageKeys);

    // 抽屉选择与搜索持久化：再次打开仍保留查询上下文和稳定键。
    await page.click('#openCaseLibraryHistoryDrawerBtn');
    await expect(page.locator('#caseLibraryHistoryDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryHistoryProjectSelect')).toHaveValue('1');
    await expect(page.locator('#caseLibraryHistoryVersionSelect')).toHaveValue('11');
    await expect(page.locator('#caseLibraryHistorySearchInput')).toHaveValue('登录');
    await waitForVTable(page, historyQueryHostSelector, historyQueryTableId);
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual([loginQueryKey]);
    await page.click('#caseLibraryHistoryDrawer .drawer-header [data-drawer-close="caseLibraryHistoryDrawer"]');
    await expect(page.locator('#caseLibraryHistoryDrawer')).not.toHaveClass(/open/);

    // 刷新后恢复详情筛选/页码和查询抽屉上下文。
    await page.reload();
    await waitAppReady(page, 30000);
    await expect
      .poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : '')))
      .toBe('case-library');
    await expect(page.locator('section[data-tab-section="case-library"]')).toBeVisible();
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toBeVisible();
    await expect(page.locator('#caseLibraryHistoryCaseName')).toContainText('登录');
    await expect(page.locator('#caseLibraryEditCard')).toBeHidden();
    await waitForVTable(page, historyDetailHostSelector, historyDetailTableId);
    await expect(page.locator('#caseLibraryHistoryUpdatedPill')).toHaveClass(/active/);
    await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(updatedSecondPageKeys);
    await expect(page.locator('#caseLibraryHistoryPaginationTop')).toContainText('显示 21-25 / 共 25 条');

    await page.click('#openCaseLibraryHistoryDrawerBtn');
    await expect(page.locator('#caseLibraryHistoryDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryHistoryProjectSelect')).toHaveValue('1');
    await expect(page.locator('#caseLibraryHistoryVersionSelect')).toHaveValue('11');
    await expect(page.locator('#caseLibraryHistorySearchInput')).toHaveValue('登录');
    await waitForVTable(page, historyQueryHostSelector, historyQueryTableId);
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual([loginQueryKey]);
  });

  test('先看历史详情再看编辑，刷新后保持编辑视图', async ({ page }) => {
    const user = { id: 1, username: 'demo_user', role: 'user', level: 'member' };
    const projects = [{ id: 1, name: '项目A', description: '' }];
    const versionsByProject = { 1: [{ id: 11, project_id: 1, name: 'v1' }] };
    const changeFilesByProjectVersion = {
      '1::11': [
        {
          project_id: 1,
          file_name_clean: '登录',
          case_file_id: 101,
          version_id: 11,
          is_deleted: false,
          last_changed_at: new Date().toISOString(),
          last_operator: 'demo_user',
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 10000).toISOString(),
          last_updated_by_name: 'demo_user',
          updated_at: new Date(Date.now() - 3000).toISOString(),
          total_events: 3,
        },
      ],
    };
    const historyByKey = {
      '1::登录': {
        project_id: 1,
        file_name_clean: '登录',
        case_file_id: 101,
        version_id: 11,
        is_deleted: false,
        history: [
          {
            id: 1,
            kind: 'updated',
            changed_at: new Date().toISOString(),
            operator: 'demo_user',
            changed_fields: ['steps'],
            old: { module: '登录', title: '正常登录', precondition: '无', steps: '旧', expected: '成功' },
            new: { module: '登录', title: '正常登录', precondition: '无', steps: '新', expected: '成功' },
            meta: { changed_fields: ['steps'] },
          },
        ],
      },
    };
    const caseFilesByProject = {
      1: [
        {
          id: 101,
          project_id: 1,
          version_id: 11,
          file_name_clean: '登录',
          reuse_enabled: false,
          item_count: 1,
          importer_id: 1,
          importer_name: 'demo_user',
          imported_at: new Date(Date.now() - 50000).toISOString(),
          updated_at: new Date(Date.now() - 30000).toISOString(),
          last_updated_by: 1,
          last_updated_by_name: 'demo_user',
        },
      ],
    };
    const caseItemsByFileId = {
      101: [{ id: 1001, case_file_id: 101, module: '登录', title: '正常登录', expected: '成功', priority: 'P0', precondition: '无', steps: '步骤', remark: '' }],
    };

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      const verMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (verMatch && method === 'GET') return respond(200, versionsByProject[Number(verMatch[1])] || []);

      if (pathName === '/api/case-files' && method === 'GET') {
        const pid = Number(url.searchParams.get('project_id') || '0');
        return respond(200, (caseFilesByProject[pid] || []).slice());
      }
      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') return respond(200, (caseItemsByFileId[Number(itemsMatch[1])] || []).slice());

      if (pathName === '/api/case-files/change-history/files' && method === 'GET') {
        const pid = url.searchParams.get('project_id') || '';
        const vid = url.searchParams.get('version_id') || '';
        return respond(200, (changeFilesByProjectVersion[`${pid}::${vid}`] || []).slice());
      }
      if (pathName === '/api/case-files/change-history' && method === 'GET') {
        const pid = url.searchParams.get('project_id') || '';
        const name = url.searchParams.get('file_name_clean') || '';
        const vid = url.searchParams.get('version_id') || '';
        const key = vid ? `${pid}::${vid}::${name}` : `${pid}::${name}`;
        return respond(
          200,
          historyByKey[key] ||
            historyByKey[`${pid}::${name}`] ||
            { project_id: Number(pid), file_name_clean: name, history: [], is_deleted: false }
        );
      }

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'case-library');

    // 先打开历史详情
    await page.click('#openCaseLibraryHistoryDrawerBtn');
    await expect(page.locator('#caseLibraryHistoryDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryHistoryProjectSelect', '1');
    await page.selectOption('#caseLibraryHistoryVersionSelect', '11');
    await page.click('#caseLibraryHistoryQueryBtn');
    const queryHost = await waitForVTable(page, historyQueryHostSelector, historyQueryTableId);
    const loginQueryKey = 'history-file:1:11:id:101';
    await expect.poll(() => getVTableRowKeys(page, historyQueryTableId)).toEqual([loginQueryKey]);
    await expect(
      queryHost.locator(`.tap-vtable-semantic tr[data-row-key="${loginQueryKey}"] [data-field="fileName"]`)
    ).toHaveText('登录');
    await clickSemanticAction(page, historyQueryHostSelector, loginQueryKey, 'open-history');
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditCard')).toBeHidden();
    await waitForVTable(page, historyDetailHostSelector, historyDetailTableId);
    await expect.poll(() => getVTableRowKeys(page, historyDetailTableId)).toEqual(['history-event:1']);

    // 再打开编辑视图
    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', '1');
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('登录');
    await clickSemanticLocator(
      page.locator('#caseLibraryEditListBody').getByRole('button', { name: '编辑', exact: true })
    );
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toBeHidden();

    // 刷新后保持编辑视图
    await page.reload();
    await waitAppReady(page, 30000);
    await expect
      .poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : '')))
      .toBe('case-library');
    await expect(page.locator('section[data-tab-section="case-library"]')).toBeVisible();
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryHistoryDetailCard')).toBeHidden();
    await expect(page.locator('#caseLibraryEditFileName')).toContainText('登录');
  });
});
