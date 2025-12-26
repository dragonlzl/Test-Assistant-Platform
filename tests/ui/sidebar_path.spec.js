const { test, expect } = require('@playwright/test');

test.describe('侧边栏当前路径', () => {
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
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.removeItem('tap-auth-token');
      } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  });

  test('切换页签与执行分配更新路径', async ({ page }) => {
    const pathItems = page.locator('#currentPathText .path-item');
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await expect(pathItems.nth(0)).toHaveText('用例相关');
    await expect(pathItems.nth(1)).toHaveText('用例执行');
    await expect(pathItems.nth(2)).toHaveText('执行分配');

    await page.click('#openTempExecAssignDrawerBtn');
    await expect(pathItems.nth(2)).toHaveText('执行分配');
  });

  test('点击路径可打开执行分配抽屉', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    const assignDrawer = page.locator('#tempExecAssignDrawer');
    await expect(assignDrawer).not.toHaveClass(/open/);
    await page.locator('#currentPathText .path-item', { hasText: '执行分配' }).click();
    await expect(assignDrawer).toHaveClass(/open/);
  });

  test('路径不展示一键执行进度提示', async ({ page }) => {
    await page.click('[data-group="ai"]');
    await page.click('[data-tab-btn="auto"]');
    await page.evaluate(() => {
      var state = window.app && window.app.state;
      if (state) {
        state.inProgressSteps = { compare: true };
        state.waitingSteps = {};
        state.failedSteps = {};
        state.validationFailedSteps = {};
      }
      var core = window.app && window.app.core;
      if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
    });
    const pathItems = page.locator('#currentPathText .path-item');
    await expect(pathItems.nth(0)).toHaveText('AI 功能');
    await expect(pathItems.nth(1)).toHaveText('一键执行');

    await page.hover('[data-group="ai"]');
    await page.click('[data-tab-btn="clean"]');
    await expect(pathItems.nth(0)).toHaveText('AI 功能');
    await expect(pathItems.nth(1)).toHaveText('功能流程');
  });
});
