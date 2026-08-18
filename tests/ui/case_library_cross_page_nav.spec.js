const { test, expect } = require('@playwright/test');

test.describe('用例库跨页跳转', () => {
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
  });

  test('XMind 用例生成页点击“用例库”应跳转并渲染', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/ai-workflow.html?tab=casesgen');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

    await page.click('[data-group="cases"]');
    await Promise.all([
      page.waitForURL(/\/case-library\.html(\?.*)?$/, { timeout: 10000 }),
      page.click('[data-tab-btn="case-library"]'),
    ]);
    await expect(page.locator('#caseLibraryHead')).toBeVisible();
    await expect(page.locator('section[data-tab-section="case-library"]').first()).toBeVisible();
  });
});
