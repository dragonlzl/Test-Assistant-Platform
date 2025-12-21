const { test, expect } = require('@playwright/test');

test.describe('页面说明 XMind 结构抽屉', () => {
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
    await page.waitForFunction(() => window.app && window.app.pageGuide && window.app.drawer && typeof window.app.drawer.createDrawer === 'function');
    await page.evaluate(() => {
      localStorage.removeItem('usecase-card-collapse-v1');
    });
  });

  test('点击页面说明展示 XMind 结构', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);
    const guideTrigger = page.locator('#pageGuideTrigger');
    await expect(guideTrigger).toBeEnabled();
    await guideTrigger.click();
    const drawer = page.locator('#pageGuideDrawer');
    await expect(drawer).toHaveClass(/open/);
    const xmindBtn = page.locator('#pageGuideDrawer [data-guide-xmind="open"]');
    await expect(xmindBtn).toBeVisible();
    await xmindBtn.click();
    const xmindDrawer = page.locator('#xmindStructureDrawer');
    await expect(xmindDrawer).toHaveClass(/open/);
    const widthRatio = await page.$eval('#xmindStructureDrawer .drawer-panel', (panel) => {
      if (!panel || !panel.getBoundingClientRect) return 0;
      const rect = panel.getBoundingClientRect();
      const viewport = window.innerWidth || document.documentElement.clientWidth || 0;
      if (!viewport) return 0;
      return rect.width / viewport;
    });
    expect(widthRatio).toBeGreaterThan(0.5);
    expect(widthRatio).toBeLessThan(1);
    await expect(xmindDrawer).toContainText('XMind 用例层级要求');
    await page.click('#xmindStructureDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    await expect(xmindDrawer).not.toHaveClass(/open/);
  });
});
