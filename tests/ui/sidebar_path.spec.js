const { test, expect } = require('@playwright/test');

test.describe('侧边栏辅助导航下线', () => {
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

  test('所有保留页面都不再展示页面路径与上下滚动按钮', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const targets = [
      '/ai-workflow.html?tab=casesgen',
      '/ai-tools.html?tab=assign',
      '/case-library.html?tab=case-library',
      '/case-exec.html?tab=tempexec',
      '/admin.html?tab=project-admin',
      '/settings.html?tab=settings',
    ];

    for (const target of targets) {
      await page.goto(base + target);
      await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
      await expect(page.locator('#currentPath, #currentPathText, #scrollTopBtn, #scrollBottomBtn')).toHaveCount(0);
      await expect(page.locator('.path-panel, .scroll-top-btn')).toHaveCount(0);
    }
  });
});
