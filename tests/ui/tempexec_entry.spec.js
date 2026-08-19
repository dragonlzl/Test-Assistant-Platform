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
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('页面内导航位于主侧栏右侧并纵向展示执行入口', async ({ page }) => {
    const sectionNav = page.locator('#tempexecSectionNav');
    const topNav = page.locator('#tempexecFlowNav');
    await expect(sectionNav).toBeVisible();
    await expect(topNav).toBeVisible();
    await expect(sectionNav.locator('.case-exec-section-nav-header h2')).toHaveText('用例执行');
    await expect(topNav.locator('[data-flow-toggle]')).toHaveCount(0);
    await expect(topNav.locator('.case-exec-section-nav-group-label')).toHaveCount(0);
    const focusBlock = topNav.locator('#tempExecViewFocusBlock');
    await expect(focusBlock).toBeVisible();
    await expect(focusBlock.locator('.temp-case-group-label')).toHaveText('专注区');
    await expect(focusBlock.locator('.temp-focus-zone')).toContainText('暂无专注用例');
    const navCards = topNav.locator('.nav-entry-card');
		    const cardCount = await navCards.count();
    expect(cardCount).toBe(4);
		    const iconCount = await navCards.locator('.nav-entry-icon svg').count();
		    expect(iconCount).toBe(cardCount);
	    const importCardDesc = topNav.locator('.nav-entry-card', { hasText: '用例导入' }).locator('.nav-entry-desc').first();
	    await expect(importCardDesc).toContainText('导入用例并确认入库');
	    const assignCardDesc = topNav.locator('.nav-entry-card', { hasText: '执行分配' }).locator('.nav-entry-desc').first();
	    await expect(assignCardDesc).toContainText('版本分组');
    await expect(topNav.locator('#openTempExecOverviewNavBtn')).toContainText('归档操作&进度预览');

    const focusLayout = await focusBlock.evaluate((block) => {
      const zone = block.querySelector('.temp-focus-zone');
      const importButton = document.getElementById('openTempExecImportDrawerBtn');
      const blockRect = block.getBoundingClientRect();
      const importRect = importButton.getBoundingClientRect();
      const zoneStyle = getComputedStyle(zone);
      return {
        beforeImport: blockRect.bottom <= importRect.top + 1,
        blockBorder: getComputedStyle(block).borderTopWidth,
        zoneBorder: zoneStyle.borderTopWidth,
        zoneBackground: zoneStyle.backgroundColor,
      };
    });
    expect(focusLayout.beforeImport).toBeTruthy();
    expect(focusLayout.blockBorder).toBe('0px');
    expect(focusLayout.zoneBorder).toBe('0px');
    expect(focusLayout.zoneBackground).toBe('rgba(0, 0, 0, 0)');

    const layout = await page.evaluate(() => {
      function rect(selector) {
        var element = document.querySelector(selector);
        if (!element) return null;
        var box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, width: box.width };
      }
      var cards = Array.prototype.map.call(document.querySelectorAll('#tempexecFlowNav .nav-entry-card'), function(card) {
        var box = card.getBoundingClientRect();
        return { left: box.left, top: box.top, width: box.width };
      });
      return {
        primary: rect('aside.sidebar'),
        section: rect('#tempexecSectionNav'),
        content: rect('.content-shell'),
        main: rect('main'),
        cards: cards,
      };
    });
    expect(layout.section.left).toBeGreaterThanOrEqual(layout.primary.right - 1);
    expect(layout.content.left).toBeGreaterThanOrEqual(layout.section.right - 1);
    expect(layout.main.left).toBeGreaterThanOrEqual(layout.section.right - 1);
    expect(layout.section.width).toBeGreaterThanOrEqual(174);
    expect(layout.section.width).toBeLessThanOrEqual(178);
    expect(layout.cards.every((card) => Math.abs(card.left - layout.cards[0].left) < 2)).toBeTruthy();
    expect(layout.cards[1].top).toBeGreaterThan(layout.cards[0].top);

    await page.click('#openTempExecImportDrawerBtn');
    const drawer = page.locator('#tempExecImportDrawer');
    await expect(drawer).toHaveClass(/open/);
    await expect.poll(async () => {
      const activeBackground = await page.locator('#openTempExecImportDrawerBtn').evaluate((button) => getComputedStyle(button).backgroundColor);
      const idleBackground = await page.locator('#openTempExecAssignDrawerBtn').evaluate((button) => getComputedStyle(button).backgroundColor);
      return activeBackground !== idleBackground;
    }).toBeTruthy();
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

  test('页面内导航默认展开并支持收起后恢复', async ({ page }) => {
    const sectionNav = page.locator('#tempexecSectionNav');
    const toggle = page.locator('#caseExecSectionNavToggle');
    const title = sectionNav.locator('.case-exec-section-nav-header h2');
    const nav = page.locator('#tempexecFlowNav');

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sectionNav).not.toHaveClass(/is-collapsed/);
    await expect(toggle).toHaveCSS('border-top-width', '0px');
    await expect.poll(() => toggle.evaluate((element) => element.parentElement.className))
      .toContain('case-exec-section-nav-header');

    const expandedLayout = await page.evaluate(() => {
      var section = document.getElementById('tempexecSectionNav').getBoundingClientRect();
      var content = document.querySelector('.content-shell').getBoundingClientRect();
      return { sectionWidth: section.width, contentLeft: content.left };
    });

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-label', '展开快捷导航');
    await expect(sectionNav).toHaveClass(/is-collapsed/);
    await expect(sectionNav).toBeHidden();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveCSS('border-top-width', '0px');
    await expect.poll(() => toggle.evaluate((element) => element.parentElement.id))
      .toBe('caseExecSectionNavToggleHost');
    await expect.poll(async () => {
      return sectionNav.evaluate((element) => element.getBoundingClientRect().width);
    }).toBe(0);

    const collapsedLayout = await page.evaluate(() => {
      var section = document.getElementById('tempexecSectionNav').getBoundingClientRect();
      var content = document.querySelector('.content-shell').getBoundingClientRect();
      var toggle = document.getElementById('caseExecSectionNavToggle').getBoundingClientRect();
      var project = document.querySelector('#tempExecContextTitle .case-exec-context-part.project').getBoundingClientRect();
      return {
        sectionWidth: section.width,
        contentLeft: content.left,
        toggleRight: toggle.right,
        toggleCenterY: toggle.top + toggle.height / 2,
        projectLeft: project.left,
        projectCenterY: project.top + project.height / 2,
      };
    });
    expect(collapsedLayout.sectionWidth).toBe(0);
    expect(expandedLayout.contentLeft - collapsedLayout.contentLeft).toBeGreaterThan(150);
    expect(collapsedLayout.toggleRight).toBeLessThanOrEqual(collapsedLayout.projectLeft);
    expect(Math.abs(collapsedLayout.toggleCenterY - collapsedLayout.projectCenterY)).toBeLessThanOrEqual(1);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', '收起快捷导航');
    await expect(sectionNav).not.toHaveClass(/is-collapsed/);
    await expect(sectionNav).toBeVisible();
    await expect.poll(() => toggle.evaluate((element) => element.parentElement.className))
      .toContain('case-exec-section-nav-header');
    await expect(title).toBeVisible();
    await expect(nav).toBeVisible();

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await expect(page.locator('#caseExecSectionNavToggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#tempexecSectionNav')).not.toHaveClass(/is-collapsed/);
    await expect.poll(() => page.locator('#caseExecSectionNavToggle').evaluate((element) => element.parentElement.className))
      .toContain('case-exec-section-nav-header');
  });

  test('页面内导航入口顺序正确', async ({ page }) => {
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

  test('页面内导航打开选择用例执行抽屉', async ({ page }) => {
    const entryBtn = page.locator('#openTempExecCaseLibraryBtn');
    await expect(entryBtn).toBeVisible();
    await expect(entryBtn).toContainText('选择用例执行');
    await entryBtn.click();
    await expect(page.locator('#tempexecFlowNav')).toBeVisible();
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);
    await expect(page.locator('[data-tab-btn="case-library"]')).not.toHaveClass(/active/);
    await expect(page.locator('#caseLibrarySelectExecDrawer')).toHaveClass(/open/);
  });

  test('页面内导航不再展示跳转用例库入口', async ({ page }) => {
    await expect(page.locator('#openTempExecCaseLibraryJumpBtn')).toHaveCount(0);
  });

  test('执行总览抽屉展开', async ({ page }) => {
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

  test('窄屏下页面内导航改为整行并位于内容区之前', async ({ page }) => {
    await page.setViewportSize({ width: 760, height: 900 });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);

    const layout = await page.evaluate(() => {
      function rect(selector) {
        var element = document.querySelector(selector);
        if (!element) return null;
        var box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
      }
      return {
        viewport: window.innerWidth,
        section: rect('#tempexecSectionNav'),
        content: rect('.content-shell'),
      };
    });
    expect(layout.section.width).toBeGreaterThan(layout.viewport * 0.9);
    expect(layout.content.top).toBeGreaterThanOrEqual(layout.section.bottom - 1);
  });
});
