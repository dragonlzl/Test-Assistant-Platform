const { test, expect } = require('@playwright/test');

test.describe('使用帮助 XMind 结构抽屉', () => {
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

  test('点击按钮展开/收起抽屉', async ({ page }) => {
    await page.click('[data-tab-btn="help"]');
    await page.click('#xmindStructureToggle');
    const drawer = page.locator('#xmindStructureDrawer');
    await expect(drawer).toHaveClass(/open/);
    const widthRatio = await page.$eval('#xmindStructureDrawer .drawer-panel', (panel) => {
      if (!panel || !panel.getBoundingClientRect) return 0;
      const rect = panel.getBoundingClientRect();
      const viewport = window.innerWidth || document.documentElement.clientWidth || 0;
      if (!viewport) return 0;
      return rect.width / viewport;
    });
    expect(widthRatio).toBeGreaterThan(0.5);
    expect(widthRatio).toBeLessThan(1);
    await expect(page.locator('#xmindStructureCard')).toContainText('XMind 用例层级要求');
    await page.click('#xmindStructureDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    await expect(drawer).not.toHaveClass(/open/);
  });
});
