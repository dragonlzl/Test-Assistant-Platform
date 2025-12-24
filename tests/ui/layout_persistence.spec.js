const { test, expect } = require('@playwright/test');

test.describe('卡片折叠移除', () => {
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

  test('标题不再触发折叠且无三角标识', async ({ page }) => {
    await page.click('[data-group="ai"]');
    await page.click('[data-tab-btn="clean"]');
    const importCard = page.locator('section[data-section-id="import"]');
    await importCard.scrollIntoViewIfNeeded();
    const header = importCard.locator('h2');
    await expect(importCard.locator('.card-body')).toBeVisible();
    await header.click();
    await expect(importCard).not.toHaveClass(/collapsed/);
    await expect(importCard.locator('.card-body')).toBeVisible();

    const afterContent = await header.evaluate((el) => window.getComputedStyle(el, '::after').content);
    expect(afterContent).not.toContain('▾');
    const savedState = await page.evaluate(() => localStorage.getItem('usecase-card-collapse-v1'));
    expect(savedState).toBe(null);
  });
});
