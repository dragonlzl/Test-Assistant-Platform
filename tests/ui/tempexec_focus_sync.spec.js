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

  test('执行页专注区空白点击打开执行分配', async ({ page }) => {
    await gotoIndex(page);
    await switchToTab(page, 'tempexec');

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
      state.tempExecFocus = ['file-1'];
      api.renderTempExecNav();
      api.renderTempExecView();
      api.renderTempVersionGrid();
      api.renderTempFocusZone();
    });

    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);
    await page.click('#tempExecViewFocusBlock button[data-temp-file]');
    await expect(page.locator('#tempExecAssignDrawer')).not.toHaveClass(/open/);

    await page.click('#tempExecViewFocusBlock .temp-focus-header');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);

    await page.click('#tempFocusBlock [data-temp-focus-zone]');
    await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
  });

  test('专注区同步显示与移出确认抽屉', async ({ page }) => {
    await gotoIndex(page);
    await switchToTab(page, 'tempexec');

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
    await expect(page.locator('#tempExecViewFocusBlock')).toContainText('同步展示【执行分配】中的专注区用例。');

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
