const { test, expect } = require('@playwright/test');

test.describe('功能引导抽屉', () => {
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
    await page.goto(base + '/case-library.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('打开抽屉并启动引导', async ({ page }) => {
    const trigger = page.locator('#flowGuideTrigger');
    const drawer = page.locator('#flowGuideDrawer');

    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer).toContainText('用例导入引导（用例库）');
    await expect(drawer.locator('[data-guide-start]')).toHaveCount(5);

    await drawer.locator('[data-guide-start="case-library-import"]').click();
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('#flowGuideOverlay')).toBeVisible();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例相关');

    await page.locator('.guide-skip-all').click();
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('跳过单步后可进入下一节点', async ({ page }) => {
    await page.locator('#flowGuideTrigger').click();
    await page.locator('[data-guide-start="case-library-import"]').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例相关');

    await page.locator('.guide-skip-step').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例库');

    await page.locator('.guide-skip-all').click();
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });
});
