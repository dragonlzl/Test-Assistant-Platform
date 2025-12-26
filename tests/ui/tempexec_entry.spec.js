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
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.removeItem('tap-auth-token');
      } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

	  test('入口卡片与抽屉交互', async ({ page }) => {
	    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
	    const topNav = page.locator('#tempexecFlowNav');
	    await expect(topNav).toBeVisible();
	    const navCards = topNav.locator('.nav-entry-card');
	    const cardCount = await navCards.count();
	    expect(cardCount).toBeGreaterThanOrEqual(2);
	    const iconCount = await navCards.locator('.nav-entry-icon svg').count();
	    expect(iconCount).toBe(cardCount);
	    const importCardDesc = topNav.locator('.nav-entry-card', { hasText: '用例导入' }).locator('.nav-entry-desc').first();
	    await expect(importCardDesc).toContainText('导入用例并确认入库');
	    const assignCardDesc = topNav.locator('.nav-entry-card', { hasText: '执行分配' }).locator('.nav-entry-desc').first();
	    await expect(assignCardDesc).toContainText('版本分组');
	    await expect(topNav.locator('#openTempExecOverviewNavBtn')).toContainText('归档操作&进度预览');

	    await page.click('#openTempExecImportDrawerBtn');
	    const drawer = page.locator('#tempExecImportDrawer');
	    await expect(drawer).toHaveClass(/open/);
    const widthRatio = await page.$eval('#tempExecImportDrawer .drawer-panel', function(panel) {
      if (!panel || !panel.getBoundingClientRect) return 0;
      var rect = panel.getBoundingClientRect();
      var viewport = window.innerWidth || document.documentElement.clientWidth || 0;
      if (!viewport) return 0;
      return rect.width / viewport;
    });
    expect(widthRatio).toBeGreaterThan(0.6);
    expect(widthRatio).toBeLessThan(1);

	    await page.click('#tempExecImportDrawer .drawer-mask', { position: { x: 10, y: 10 } });
	    await expect(drawer).not.toHaveClass(/open/);
	  });

  test('抽屉遮罩覆盖且不会导致页面滚动', async ({ page }) => {
	    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
	    const initialScroll = await page.evaluate(() => window.scrollY);
	    await page.click('#openTempExecImportDrawerBtn');
	    await expect(page.locator('#tempExecImportDrawer')).toHaveClass(/open/);
	    const maskMetrics = await page.$eval('#tempExecImportDrawer .drawer-mask', (mask) => {
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
	    await page.click('#tempExecImportDrawer .drawer-mask', { position: { x: 10, y: 10 } });
	    const afterFirstClose = await page.evaluate(() => window.scrollY);
	    await page.click('#openTempExecImportDrawerBtn');
	    await expect(page.locator('#tempExecImportDrawer')).toHaveClass(/open/);
	    await page.click('#tempExecImportDrawer .drawer-mask', { position: { x: 10, y: 10 } });
	    const finalScroll = await page.evaluate(() => window.scrollY);
	    expect(Math.abs(finalScroll - initialScroll)).toBeLessThanOrEqual(2);
	    expect(Math.abs(finalScroll - afterFirstClose)).toBeLessThanOrEqual(2);
	  });

  test('顶部导航打开选择用例执行抽屉', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    const entryBtn = page.locator('#openTempExecCaseLibraryBtn');
    await expect(entryBtn).toBeVisible();
    await expect(entryBtn).toContainText('选择用例执行');
    await entryBtn.click();
    await expect(page.locator('#tempexecFlowNav')).toBeVisible();
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);
    await expect(page.locator('[data-tab-btn="case-library"]')).not.toHaveClass(/active/);
    await expect(page.locator('#caseLibrarySelectExecDrawer')).toHaveClass(/open/);
  });

  test('顶部导航跳转用例库页签', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    const jumpBtn = page.locator('#openTempExecCaseLibraryJumpBtn');
    await expect(jumpBtn).toBeVisible();
    await expect(jumpBtn).toContainText('跳转用例库');
    await jumpBtn.click();
    await expect(page.locator('[data-tab-btn="case-library"]')).toHaveClass(/active/);
    await expect(page.locator('#caseLibraryFlowNav')).toBeVisible();
    await expect(page.locator('#caseLibrarySelectExecDrawer')).not.toHaveClass(/open/);
  });

  test('执行总览抽屉展开', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
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
