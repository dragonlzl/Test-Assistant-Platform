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
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        // 只在首次进入时清空，避免 reload 场景把“待验证的持久化”清掉。
        const flagKey = 'tap-e2e-cleared-active-tab-once';
        const cleared = localStorage.getItem(flagKey);
        if (!cleared) {
          sessionStorage.removeItem('usecase-active-tab');
          localStorage.setItem(flagKey, '1');
        }
      } catch (err) {
        // ignore
      }
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app.switchTab && window.app.state, null, { timeout: 20000 });
  });

  test('刷新后保持上次选中的页签', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''))).toBe('tempexec');
    await expect(page.locator('#tempexecFlowNav')).toBeVisible();

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state ? window.app.state.activeTab : ''))).toBe('tempexec');
    await expect(page.locator('#tempexecFlowNav')).toBeVisible();
  });
});
