const { test, expect } = require('@playwright/test');

test.describe('卡片折叠持久化', () => {
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
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.removeItem('tap-auth-token');
      } catch (_) {}
    });
    page.on('dialog', async (dialog) => {
      await dialog.accept(page.__promptAnswers.shift() || '');
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
    await page.evaluate(() => {
      localStorage.removeItem('usecase-card-collapse-v1');
    });
  });

  test('折叠状态刷新后保持', async ({ page }) => {
    await page.click('[data-group="ai"]');
    await page.click('[data-tab-btn="clean"]');
    const importCard = page.locator('section[data-section-id="import"]');
    await importCard.scrollIntoViewIfNeeded();
    await importCard.locator('h2').click();
    await expect(importCard).toHaveClass(/collapsed/);
    const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem('usecase-card-collapse-v1') || '{}'));
    expect(savedState && savedState.import).toBe(true);

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.click('[data-group="ai"]');
    await page.click('[data-tab-btn="clean"]');
    const importCardAfter = page.locator('section[data-section-id="import"]');
    await expect(importCardAfter).toHaveClass(/collapsed/);

    await importCardAfter.locator('h2').click();
    await expect(importCardAfter).not.toHaveClass(/collapsed/);
    const restoredState = await page.evaluate(() => JSON.parse(localStorage.getItem('usecase-card-collapse-v1') || '{}'));
    expect(restoredState && restoredState.import).toBe(false);
  });
});
