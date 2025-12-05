const { test, expect } = require('@playwright/test');

test.describe('页签持久化', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('刷新后保持上次选中的页签', async ({ page }) => {
    const targetTab = page.locator('[data-tab-btn="tempexec"]');
    await targetTab.click();
    await expect(targetTab).toHaveClass(/active/);

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);
    await expect(page.locator('#tempexecFlowNav')).toBeVisible();
  });
});
