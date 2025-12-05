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

  test('配置备份抽屉遮罩覆盖且不会导致页面滚动', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
    const initialScroll = await page.evaluate(() => window.scrollY);
    await page.click('#openTempExecBackupNavBtn');
    const maskMetrics = await page.$eval('#tempExecDrawer .drawer-mask', (mask) => {
      const rect = mask.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        vw: window.innerWidth || document.documentElement.clientWidth || 0,
        vh: window.innerHeight || document.documentElement.clientHeight || 0,
      };
    });
    expect(maskMetrics.width).toBeGreaterThanOrEqual(maskMetrics.vw - 2);
    expect(maskMetrics.height).toBeGreaterThanOrEqual(maskMetrics.vh - 2);
    expect(maskMetrics.left).toBeLessThanOrEqual(1);
    expect(maskMetrics.top).toBeLessThanOrEqual(1);
    await page.click('#tempExecDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    const afterFirstClose = await page.evaluate(() => window.scrollY);
    await page.click('#openTempExecBackupNavBtn');
    await page.click('#tempExecDrawer .drawer-mask', { position: { x: 10, y: 10 } });
    const finalScroll = await page.evaluate(() => window.scrollY);
    expect(Math.abs(finalScroll - initialScroll)).toBeLessThanOrEqual(2);
    expect(Math.abs(finalScroll - afterFirstClose)).toBeLessThanOrEqual(2);
  });

  test('执行总览抽屉展开', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
    await page.click('#openTempExecOverviewNavBtn');
    const overviewDrawer = page.locator('#tempExecOverviewDrawer');
    await expect(overviewDrawer).toHaveClass(/open/);
    const widthRatio = await page.$eval('#tempExecOverviewDrawer .drawer-panel', function(panel) {
      if (!panel || !panel.getBoundingClientRect) return 0;
      var rect = panel.getBoundingClientRect();
      var viewport = window.innerWidth || document.documentElement.clientWidth || 0;
      if (!viewport) return 0;
      return rect.width / viewport;
    });
    expect(widthRatio).toBeGreaterThan(0.6);
    expect(widthRatio).toBeLessThan(1);
    await expect(page.locator('#tempExecOverview')).toContainText('暂无用例执行数据');
    await page.click('#closeTempExecOverviewDrawerBtn');
    await expect(overviewDrawer).not.toHaveClass(/open/);
  });
});
