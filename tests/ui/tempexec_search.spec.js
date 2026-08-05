const { test, expect } = require('@playwright/test');

test.describe('临时执行搜索功能', () => {
  test.beforeEach(async ({ page }) => {
    page.__promptAnswers = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (pathName === '/api/users/me' && method === 'GET') {
        // e2e: user.id = 0 不走 DB 入库，避免静态模式误触发 API。
        return respond(200, { id: 0, username: 'ui_admin', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
    });
    page.on('dialog', async (dialog) => {
      const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : '搜索需求';
      await dialog.accept(answer);
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
    await page.evaluate(() => {
      var keys = ['usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'];
      keys.forEach(function(key) {
        window.localStorage.removeItem(key);
      });
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
  });

  test('执行视图搜索与清空', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '搜索需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'search.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '下单支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('搜索需求');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/closing/);
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await expect(navButtons.first()).toBeVisible();
    const targetFileId = await navButtons.first().getAttribute('data-temp-file');
    expect(targetFileId).toBeTruthy();
    await navButtons.first().click();
    await page.waitForFunction((fileId) => {
      return Boolean(
        window.app && window.app.state
        && String(window.app.state.tempExecActiveId || '') === String(fileId || '')
      );
    }, targetFileId);
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });
    const caseRows = page.locator('#tempExecView table tbody tr').filter({ has: page.locator('[data-temp-case-remove]') });
    await expect(caseRows.first()).toBeVisible({ timeout: 15000 });
    await expect(caseRows).toHaveCount(3, { timeout: 15000 });

    const searchInput = page.locator('#tempExecToolbar input[placeholder="搜索用例关键字"]');
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    await searchInput.fill('登录');
    await expect(caseRows).toHaveCount(1, { timeout: 15000 });
    await expect(caseRows.first()).toContainText('登录');

    await searchInput.fill('');
    await expect(caseRows).toHaveCount(3);
  });

  test('复用展开并滚动后，执行视图搜索框输入不会失焦', async ({ page }) => {
    await page.evaluate(() => {
      var cases = [];
      for (var i = 0; i < 120; i += 1) {
        cases.push({
          module: '模块' + String(i + 1),
          title: i === 67 ? '目标检索用例' : ('普通用例' + String(i + 1)),
          priority: 'P1',
          preconditions: '',
          steps: '步骤' + String(i + 1),
          expected: '结果' + String(i + 1),
          actual: '未执行',
          remark: '',
          reuseDetails: i === 0
            ? [{ id: 'reuse-detail-focus', text: '复用子项1', note: '', status: '未执行' }]
            : [],
          defectLinks: [],
        });
      }
      window.localStorage.setItem('tempexec-page-size', '200');
      window.localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
        files: [{
          id: 'reuse-search-focus-file',
          name: '复用搜索焦点',
          reuseEnabled: true,
          reusePresets: [],
          createdAt: Date.now(),
          requirement: '',
          projectId: '',
          versionId: '',
          cases: cases,
        }],
        versions: [],
        placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
        collapsed: { req: false, version: false },
        activeId: 'reuse-search-focus-file',
      }));
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });

    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.waitForSelector('[data-section-id="tempexec-view"]:not(.hidden)');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.applyTempExecPageSize === 'function') {
        window.app.tempExecApi.applyTempExecPageSize(200);
      }
      if (window.scrollTo) window.scrollTo(0, 0);
    });

    await page.click('[data-temp-reuse-panel="reuse-search-focus-file"][data-index="0"]');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(1);

    for (let i = 0; i < 12; i += 1) {
      await page.mouse.wheel(0, 700);
      const scrollTop = await page.evaluate(() => {
        return window.scrollY || document.documentElement.scrollTop || 0;
      });
      if (scrollTop > 1800) break;
    }
    await page.waitForFunction(() => {
      return (window.scrollY || document.documentElement.scrollTop || 0) > 800;
    }, null, { timeout: 10000 });
    await page.waitForTimeout(300);

    const searchInput = page.locator('#tempExecToolbar input[placeholder="搜索用例关键字"]');
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await page.keyboard.type('目标检索', { delay: 40 });

    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue('目标检索');
    const caseRows = page.locator('#tempExecView table tbody tr').filter({ has: page.locator('[data-temp-case-remove]') });
    await expect(caseRows).toHaveCount(1, { timeout: 15000 });
    await expect(caseRows.first()).toContainText('目标检索用例');
  });

  test('删除用例改为确认抽屉', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '搜索需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'search.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '下单支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('搜索需求');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await navButtons.first().click({ force: true });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });
    const caseRows = page.locator('#tempExecView table tbody tr').filter({ has: page.locator('[data-temp-case-remove]') });
    await expect(caseRows).toHaveCount(3, { timeout: 15000 });

    await caseRows.first().locator('[data-temp-case-remove]').click();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toHaveText('确定删除该条用例吗？此操作不可撤销。');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(caseRows).toHaveCount(2, { timeout: 15000 });
  });

  test('执行视图删除待确认期间阻止连续删除', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '搜索需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'search.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '下单支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('搜索需求');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await navButtons.first().click({ force: true });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });
    const caseRows = page.locator('#tempExecView table tbody tr').filter({ has: page.locator('[data-temp-case-remove]') });
    await expect(caseRows).toHaveCount(3, { timeout: 15000 });

    await caseRows.first().locator('[data-temp-case-remove]').click();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(caseRows).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator('.temp-undo-toast')).toBeVisible();

    await caseRows.first().locator('[data-temp-case-remove]').click();
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(caseRows).toHaveCount(2, { timeout: 15000 });
    const hint = page.locator('.temp-click-hint');
    await expect(hint).toBeVisible({ timeout: 5000 });
    await expect(hint).toContainText('当前有待确认的增删操作，请先撤回或等待入库');
    const toastText = page.locator('.temp-undo-toast span');
    await expect(toastText).not.toContainText('可撤销 2 条');

    await caseRows.first().locator('[data-temp-case-insert]').click();
    await expect(caseRows).toHaveCount(2, { timeout: 15000 });
  });

  test('执行视图新增待确认期间阻止新增与删除', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '搜索需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'search.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '下单支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('搜索需求');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await navButtons.first().click({ force: true });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });
    const caseRows = page.locator('#tempExecView table tbody tr').filter({ has: page.locator('[data-temp-case-remove]') });
    await expect(caseRows).toHaveCount(3, { timeout: 15000 });

    await caseRows.first().locator('[data-temp-case-insert]').click();
    await expect(caseRows).toHaveCount(4, { timeout: 15000 });
    await expect(page.locator('.temp-undo-toast')).toBeVisible();

    await caseRows.first().locator('[data-temp-case-insert]').click();
    await expect(caseRows).toHaveCount(4, { timeout: 15000 });
    const hint = page.locator('.temp-click-hint');
    await expect(hint).toBeVisible({ timeout: 5000 });
    await expect(hint).toContainText('当前有待确认的增删操作，请先撤回或等待入库');
    const toastText = page.locator('.temp-undo-toast span');
    await expect(toastText).not.toContainText('可撤销 2 条');

    await caseRows.first().locator('[data-temp-case-remove]').click();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(caseRows).toHaveCount(4, { timeout: 15000 });
  });

  test('复用子项与缺陷链接删除改为确认抽屉', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '搜索需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'search.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '下单支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('搜索需求');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await navButtons.first().click({ force: true });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });

    const reuseToggle = page.locator('#tempExecView input[data-temp-reuse-toggle]').first();
    await expect(reuseToggle).toBeVisible();
    if (!(await reuseToggle.isChecked())) {
      await reuseToggle.check();
    }

    await page.locator('#tempExecView button[data-temp-reuse-panel]').first().click();
    const reuseRow = page.locator('#tempExecView tr.reuse-row.visible').first();
    await expect(reuseRow).toBeVisible();
    await reuseRow.locator('[data-temp-reuse-add]').click();
    await expect(reuseRow.locator('[data-temp-reuse-remove]')).toHaveCount(1);
    await reuseRow.locator('[data-temp-reuse-remove]').first().click();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toHaveText('确定删除该复用测试项吗？该操作不可撤销。');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(reuseRow.locator('[data-temp-reuse-remove]')).toHaveCount(0);

    await page.locator('#tempExecView button[data-temp-defect-toggle]').first().click();
    const defectRow = page.locator('#tempExecView tr.defect-row.visible').first();
    await expect(defectRow).toBeVisible();
    await defectRow.locator('[data-temp-defect-add]').click();
    await expect(defectRow.locator('[data-temp-defect-remove]')).toHaveCount(1);
    await defectRow.locator('[data-temp-defect-remove]').first().click();
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toHaveText('确定删除该缺陷链接吗？');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(defectRow.locator('[data-temp-defect-remove]')).toHaveCount(0);
  });

  test('复用切换存在执行记录时使用确认抽屉', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '搜索需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFile = {
      name: 'search.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录功能', steps: 'step', expected: 'ok' },
        { module: '模块A', title: '退出功能', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('搜索需求');
    await page.setInputFiles('#tempExecInput', execFile);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    await page.click('#closeTempExecImportDrawerBtn', { force: true });
    await page.click('#openTempExecAssignDrawerBtn', { force: true });
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(1, { timeout: 5000 });
    await navButtons.first().click({ force: true });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });

    const statusSelect = page.locator('#tempExecView select[data-temp-result]').first();
    await statusSelect.selectOption('通过');

    const reuseToggle = page.locator('#tempExecView input[data-temp-reuse-toggle]').first();
    await expect(reuseToggle).toBeVisible();
    await reuseToggle.check();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toHaveText('开启“用例复用”会清空当前执行结果与备注，是否继续？');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(reuseToggle).toBeChecked();
    await expect(page.locator('#tempExecView button.reuse-status').first()).toHaveText('未执行');

    await page.locator('#tempExecView button[data-temp-reuse-panel]').first().click();
    const reuseRow = page.locator('#tempExecView tr.reuse-row.visible').first();
    await expect(reuseRow).toBeVisible();
    await reuseRow.locator('[data-temp-reuse-add]').click();
    await expect(reuseRow.locator('[data-temp-reuse-remove]')).toHaveCount(1);

    await reuseToggle.uncheck();
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toHaveText('关闭“用例复用”会删除所有复用测试项与预设子项，是否继续？');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(reuseToggle).not.toBeChecked();
    await expect(page.locator('#tempExecView select[data-temp-result]').first()).toBeVisible();
  });
});
