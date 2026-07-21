const { test, expect } = require('@playwright/test');

async function getDrawerWidthMetrics(page, selector) {
  return page.$eval(selector, function(panel) {
    var rect = panel.getBoundingClientRect();
    var viewport = window.innerWidth || document.documentElement.clientWidth || 0;
    var railWidth = parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue('--tap-nav-rail-width')
    ) || 0;
    return {
      width: rect.width,
      expectedWidth: Math.min(560, Math.max(0, viewport - railWidth)),
      viewport: viewport,
    };
  });
}

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
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

	  test('入口卡片与抽屉交互', async ({ page }) => {
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
    const widthMetrics = await getDrawerWidthMetrics(page, '#tempExecImportDrawer .drawer-panel');
    expect(Math.abs(widthMetrics.width - widthMetrics.expectedWidth)).toBeLessThanOrEqual(2);
    expect(widthMetrics.width).toBeLessThan(widthMetrics.viewport);

	    await page.click('#tempExecImportDrawer .drawer-mask', { position: { x: 10, y: 10 } });
	    await expect(drawer).not.toHaveClass(/open/);
	  });

  test('顶部导航入口顺序调整', async ({ page }) => {
    const order = await page.evaluate(() => {
      var nav = document.getElementById('tempexecFlowNav');
      if (!nav) return [];
      return Array.from(nav.querySelectorAll('.nav-entry-card')).map(function(btn) { return btn.id || ''; });
    });
    const selectIndex = order.indexOf('openTempExecCaseLibraryBtn');
    const assignIndex = order.indexOf('openTempExecAssignDrawerBtn');
    expect(selectIndex).toBeGreaterThanOrEqual(0);
    expect(assignIndex).toBeGreaterThanOrEqual(0);
    expect(selectIndex).toBeLessThan(assignIndex);
  });

  test('抽屉遮罩覆盖且不会导致页面滚动', async ({ page }) => {
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
    const entryBtn = page.locator('#openTempExecCaseLibraryBtn');
    await expect(entryBtn).toBeVisible();
    await expect(entryBtn).toContainText('选择用例执行');
    await entryBtn.click();
    await expect(page.locator('#tempexecFlowNav')).toBeVisible();
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);
    await expect(page.locator('[data-tab-btn="case-library"]')).not.toHaveClass(/active/);
    await expect(page.locator('#caseLibrarySelectExecDrawer')).toHaveClass(/open/);
  });

  test('顶部导航不再展示跳转用例库入口', async ({ page }) => {
    await expect(page.locator('#openTempExecCaseLibraryJumpBtn')).toHaveCount(0);
  });

  test('执行总览抽屉展开', async ({ page }) => {
    await page.click('#openTempExecOverviewNavBtn');
    const overviewDrawer = page.locator('#tempExecOverviewDrawer');
    await expect(overviewDrawer).toHaveClass(/open/);
    const widthMetrics = await getDrawerWidthMetrics(page, '#tempExecOverviewDrawer .drawer-panel');
    expect(Math.abs(widthMetrics.width - widthMetrics.expectedWidth)).toBeLessThanOrEqual(2);
    expect(widthMetrics.width).toBeLessThan(widthMetrics.viewport);
    await expect(page.locator('#tempExecOverview')).toContainText('暂无用例执行数据');
    await page.click('#closeTempExecOverviewDrawerBtn');
    await expect(overviewDrawer).not.toHaveClass(/open/);
  });
});
