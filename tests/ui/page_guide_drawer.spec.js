const { test, expect } = require('@playwright/test');

test.describe('页面说明抽屉', () => {
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
        localStorage.setItem('tap-e2e-force-guide', '1');
      } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('自动弹出与设置开关', async ({ page }) => {
    const drawer = page.locator('#pageGuideDrawer');
    const openGroup = async (group, tabId) => {
      await page.click(`[data-group="${group}"]`);
      if (tabId) await expect(page.locator(`[data-tab-btn="${tabId}"]`)).toBeVisible();
    };
    const closeDrawer = async () => {
      await page.click('#closePageGuideDrawerBtn');
      await expect(drawer).not.toHaveClass(/open/);
    };

    await expect(drawer).toHaveClass(/open/);
    await closeDrawer();

    await openGroup('ai', 'clean');
    await page.click('[data-tab-btn="clean"]');
    await expect(drawer).toHaveClass(/open/);
    await closeDrawer();

    await openGroup('ai', 'auto');
    await page.click('[data-tab-btn="auto"]');
    await expect(drawer).toHaveClass(/open/);
    await closeDrawer();

    await openGroup('settings', 'settings');
    await page.click('[data-tab-btn="settings"]');
    const autoToggle = page.locator('#pageGuideSettingsGrid input[data-page-guide="auto"]');
    const selectAllToggle = page.locator('#pageGuideSelectAll');
    await selectAllToggle.check();
    await selectAllToggle.uncheck();
    await expect(autoToggle).not.toBeChecked();
    await selectAllToggle.check();
    await expect(autoToggle).toBeChecked();
    await autoToggle.uncheck();
    await expect(autoToggle).not.toBeChecked();

    await openGroup('ai', 'clean');
    await page.click('[data-tab-btn="clean"]');
    await expect(drawer).toHaveClass(/open/);
    await closeDrawer();

    await openGroup('ai', 'auto');
    await page.click('[data-tab-btn="auto"]');
    await page.waitForTimeout(200);
    await expect(drawer).not.toHaveClass(/open/);

    await openGroup('settings', 'settings');
    await page.click('[data-tab-btn="settings"]');
    await autoToggle.check();
    await openGroup('ai', 'auto');
    await page.click('[data-tab-btn="auto"]');
    await expect(drawer).toHaveClass(/open/);
    await closeDrawer();

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.waitForTimeout(200);
    await expect(page.locator('#pageGuideDrawer')).not.toHaveClass(/open/);
  });
});
