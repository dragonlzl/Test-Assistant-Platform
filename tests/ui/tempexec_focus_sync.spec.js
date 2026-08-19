const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/index.html';
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(url);
      await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
      return;
    } catch (err) {
      lastErr = err;
      const msg = err && err.message ? String(err.message) : String(err || '');
      const canRetry = msg.indexOf('ERR_EMPTY_RESPONSE') !== -1 || msg.indexOf('net::ERR_EMPTY_RESPONSE') !== -1;
      if (!canRetry || i === 2) throw err;
      await page.waitForTimeout(300);
    }
  }
  throw lastErr || new Error('page.goto failed');
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
  await page.waitForFunction((name) => {
    const nodes = document.querySelectorAll('[data-tab-section="' + name + '"]');
    if (!nodes || !nodes.length) return true;
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      if (el && el.classList && !el.classList.contains('hidden')) return true;
    }
    return false;
  }, tabName);
}

test.describe('执行视图专注区同步', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
      try {
        localStorage.removeItem('usecase-temp-exec-v1');
        localStorage.removeItem('tempexec-focus-v1');
        localStorage.removeItem('tempexec-page-size');
        localStorage.removeItem('usecase-active-tab');
      } catch (_) {}
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') {
        return respond(200, { id: 0, username: 'ui_admin', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
    });
  });

  test('侧栏专注区纵向展示并支持点击快速切换', async ({ page }) => {
    await gotoIndex(page);
    await switchToTab(page, 'tempexec');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      if (!state || !api) return;
      state.projects = [{ id: 'project-1', name: '项目A' }];
      state.projectVersionsByProject = {
        'project-1': [{ id: 'version-1', project_id: 'project-1', name: 'v1' }],
      };
      state.tempExecFiles = [
        {
          id: 'file-1',
          name: '执行用例A',
          cases: [{ module: '登录', title: '账号登录', expected: '成功' }],
          scope: 'current',
          requirement: '需求A',
          projectId: 'project-1',
          versionId: 'version-1',
          reuseEnabled: false,
          createdAt: Date.now(),
        },
        {
          id: 'file-2',
          name: '执行用例B',
          cases: [{ module: '支付', title: '订单支付', expected: '成功' }],
          scope: 'current',
          requirement: '需求B',
          projectId: 'project-1',
          versionId: 'version-1',
          reuseEnabled: true,
          createdAt: Date.now(),
        },
      ];
      state.tempExecActiveId = 'file-2';
      state.tempExecFocus = ['file-1', 'file-2'];
      api.renderTempExecNav();
      api.renderTempExecView();
      api.renderTempVersionGrid();
      api.renderTempFocusZone();
    });

    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
    const focusBlock = page.locator('#tempExecViewFocusBlock');
    await expect(focusBlock.locator('button[data-temp-file]')).toHaveCount(2);
    const contextTitle = page.locator('#tempExecContextTitle');
    await expect(contextTitle).toContainText('项目 项目A');
    await expect(contextTitle).toContainText('版本 v1');
    await expect(contextTitle).toContainText('用例 执行用例B');
    await expect(contextTitle).not.toContainText('用例执行');
    await expect(page.locator('#tempExecToolbar .toolbar-file')).toHaveCount(0);
    await expect(page.locator('#tempExecView .temp-exec-context:not(.temp-exec-context-combo)')).toHaveCount(0);
    const reuseToggle = page.locator('#tempExecToolbar input[data-temp-reuse-toggle]');
    await expect(reuseToggle).toHaveCount(1);
    await expect(reuseToggle).toBeChecked();
    await expect(page.locator('#tempExecView input[data-temp-reuse-toggle]')).toHaveCount(0);
    await expect(page.locator('#tempExecToolbar .toolbar-primary-row > .toolbar-reuse-toggle')).toHaveCount(0);
    const toolbarOrder = await page.locator('#tempExecToolbar .toolbar-primary-row').evaluate((row) => {
      return Array.prototype.slice.call(row.children).map((child) => child.className || '');
    });
    expect(toolbarOrder.join('|')).toContain('toolbar-search|toolbar-preset-actions|toolbar-current-actions');
    await expect(page.locator('#tempExecMoreMenu input[data-temp-reuse-toggle]')).toHaveCount(1);
    await expect(page.locator('#tempExecMoreMenu input[data-temp-missing-reminder-toggle]')).toHaveCount(1);
    const positions = await focusBlock.locator('button[data-temp-file]').evaluateAll((buttons) => {
      return buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, left: rect.left };
      });
    });
    expect(positions[1].top).toBeGreaterThan(positions[0].top);
    expect(Math.abs(positions[1].left - positions[0].left)).toBeLessThan(2);

    await page.click('#tempExecViewFocusBlock button[data-temp-file="file-1"]');
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
    await expect.poll(() => page.evaluate(() => window.app.state.tempExecActiveId)).toBe('file-1');
    await expect(contextTitle).toContainText('用例 执行用例A');
    await expect(reuseToggle).not.toBeChecked();

    await page.click('#tempExecViewFocusBlock .temp-focus-header');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    await page.click('#tempFocusBlock [data-temp-focus-zone]');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
  });

  test('专注区同步显示与移出确认抽屉', async ({ page }) => {
    await gotoIndex(page);
    await switchToTab(page, 'tempexec');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      if (!state || !api) return;
      state.tempExecFiles = [
        {
          id: 'file-1',
          name: '执行用例A',
          cases: [{ module: '登录', title: '账号登录', expected: '成功' }],
          scope: 'current',
          requirement: '需求A',
          createdAt: Date.now(),
        },
      ];
      state.tempExecActiveId = 'file-1';
      state.tempExecFocus = [];
      api.renderTempExecNav();
      api.renderTempExecView();
      api.renderTempVersionGrid();
      api.renderTempFocusZone();
    });

    await page.click('#openTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    const navBtn = page.locator('#tempExecNav button[data-temp-file]').first();
    const focusZone = page.locator('#tempFocusBlock [data-temp-focus-zone]');
    await navBtn.dragTo(focusZone);

    await expect(page.locator('#tempFocusBlock button[data-temp-file]')).toHaveCount(1);
    await expect(page.locator('#tempExecViewFocusBlock button[data-temp-file]')).toHaveCount(1);
    await expect(page.locator('#tempexecFlowNav > #tempExecViewFocusBlock')).toHaveCount(1);

    await page.click('#tempFocusBlock [data-temp-focus-remove]');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.click('#appConfirmDrawerCancelBtn');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);

    await page.click('#closeTempExecAssignDrawerBtn');
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);

    await page.click('#tempExecViewFocusBlock [data-temp-focus-remove]');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#tempFocusBlock button[data-temp-file]')).toHaveCount(0);
    await expect(page.locator('#tempExecViewFocusBlock button[data-temp-file]')).toHaveCount(0);
  });
});
