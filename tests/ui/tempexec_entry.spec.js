const { test, expect } = require('@playwright/test');

test.describe('临时执行入口导航', () => {
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
  });

  test('入口卡片与抽屉交互', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
    const topNav = page.locator('#tempexecFlowNav');
    await expect(topNav).toBeVisible();
    const navCards = topNav.locator('.nav-entry-card');
    const cardCount = await navCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(3);
    const iconCount = await navCards.locator('.nav-entry-icon svg').count();
    expect(iconCount).toBe(cardCount);
    const importCardDesc = topNav.locator('.nav-entry-card', { hasText: '用例导入&分配' }).locator('.nav-entry-desc').first();
    await expect(importCardDesc).toContainText('导入/分配用例');

    await page.click('#openTempExecDrawerBtn');
    const drawer = page.locator('#tempExecDrawer');
    await expect(drawer).toHaveClass(/open/);
    const widthRatio = await page.$eval('#tempExecDrawer .drawer-panel', function(panel) {
      if (!panel || !panel.getBoundingClientRect) return 0;
      var rect = panel.getBoundingClientRect();
      var viewport = window.innerWidth || document.documentElement.clientWidth || 0;
      if (!viewport) return 0;
      return rect.width / viewport;
    });
    expect(widthRatio).toBeGreaterThan(0.6);
    expect(widthRatio).toBeLessThan(1);

    await page.click('#tempExecDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    await expect(drawer).not.toHaveClass(/open/);
  });
});
