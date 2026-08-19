const { test, expect } = require('@playwright/test');

test.describe('执行页抽屉遮罩覆盖完整视口', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (err) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  });

  test('抽屉遮罩覆盖两级左侧导航并可从执行导航区域关闭', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await page.click('#openTempExecImportDrawerBtn');

    const drawer = page.locator('#tempExecImportDrawer');
    await expect(drawer).toHaveClass(/open/);

    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toBeVisible();

    const tempexecNav = page.locator('#tempexecFlowNav');
    await expect(tempexecNav).toBeVisible();

    const mask = page.locator('#tempExecImportDrawer .drawer-mask');
    await expect(mask).toBeVisible();
    const box = await mask.boundingBox();
    expect(box && box.width).toBeGreaterThan(1000);
    expect(box && box.height).toBeGreaterThan(600);

    const overlayCoverage = await page.evaluate(() => {
      var maskElement = document.querySelector('#tempExecImportDrawer .drawer-mask');
      var sidebarElement = document.querySelector('aside.sidebar');
      var sectionNavElement = document.getElementById('tempexecSectionNav');

      function probe(element, x, y) {
        if (!element || !maskElement) return false;
        var inlineValue = element.style.getPropertyValue('pointer-events');
        var inlinePriority = element.style.getPropertyPriority('pointer-events');
        element.style.setProperty('pointer-events', 'auto', 'important');
        var target = document.elementFromPoint(x, y);
        if (inlineValue) {
          element.style.setProperty('pointer-events', inlineValue, inlinePriority);
        } else {
          element.style.removeProperty('pointer-events');
        }
        return target === maskElement;
      }

      var sidebarRect = sidebarElement.getBoundingClientRect();
      var sectionRect = sectionNavElement.getBoundingClientRect();
      return {
        sidebarCovered: probe(sidebarElement, sidebarRect.left + 2, window.innerHeight / 2),
        sectionNavCovered: probe(sectionNavElement, sectionRect.left + sectionRect.width / 2, window.innerHeight / 2),
        sectionClickPoint: {
          x: sectionRect.left + sectionRect.width / 2,
          y: window.innerHeight / 2,
        },
      };
    });
    expect(overlayCoverage.sidebarCovered).toBeTruthy();
    expect(overlayCoverage.sectionNavCovered).toBeTruthy();

    await page.mouse.click(overlayCoverage.sectionClickPoint.x, overlayCoverage.sectionClickPoint.y);
    await expect(drawer).not.toHaveClass(/open/);
  });

  test('tempexec drawer keeps nav visible after page has been scrolled', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await page.waitForSelector('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      var filler = document.createElement('div');
      filler.id = 'drawer-scroll-filler-exec';
      filler.style.height = '2000px';
      filler.style.width = '1px';
      filler.style.pointerEvents = 'none';
      document.body.appendChild(filler);
      var target = 1400;
      window.scrollTo(0, target);
      document.documentElement.scrollTop = target;
      document.body.scrollTop = target;
    });
    await page.locator('#openTempExecImportDrawerBtn').click();

    const drawer = page.locator('#tempExecImportDrawer');
    await expect(drawer).toHaveClass(/open/);

    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toBeVisible();

    const tempexecNav = page.locator('#tempexecFlowNav');
    await expect(tempexecNav).toBeVisible();
  });

  test('tempexec drawer keeps nav position after long scroll on execute view', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await page.waitForSelector('#openTempExecImportDrawerBtn');
    await page.evaluate(() => {
      document.documentElement.style.overflowY = 'auto';
      document.documentElement.style.overflowX = 'hidden';
      document.body.style.overflow = 'visible';
    });
    await page.evaluate(() => {
      var filler = document.getElementById('drawer-long-scroll');
      if (!filler) {
        filler = document.createElement('div');
        filler.id = 'drawer-long-scroll';
        filler.style.height = '2400px';
        filler.style.width = '1px';
        filler.style.pointerEvents = 'none';
        var container = document.querySelector('.content-shell') || document.body;
        container.appendChild(filler);
      }
      var target = 1700;
      window.scrollTo(0, target);
      document.documentElement.scrollTop = target;
      document.body.scrollTop = target;
    });
    await page.waitForFunction(() => Math.abs(window.scrollY - 1700) < 5, { timeout: 2000 });
    await page.waitForFunction(() => window.app && window.app.tempExecApi);
    const beforeSidebarTop = await page.$eval('aside.sidebar', (el) => el.getBoundingClientRect().top);
    const beforeNavTop = await page.$eval('#tempexecFlowNav', (el) => el.getBoundingClientRect().top);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.locator('#openTempExecImportDrawerBtn').dispatchEvent('click');
    await page.waitForSelector('#tempExecImportDrawer.open');
    await page.waitForTimeout(180);

    const afterSidebarTop = await page.$eval('aside.sidebar', (el) => el.getBoundingClientRect().top);
    const afterNavTop = await page.$eval('#tempexecFlowNav', (el) => el.getBoundingClientRect().top);
    const scrollAfter = await page.evaluate(() => window.scrollY);

    expect(Math.abs(afterSidebarTop - beforeSidebarTop)).toBeLessThan(6);
    expect(Math.abs(afterNavTop - beforeNavTop)).toBeLessThan(6);
    expect(afterSidebarTop).toBeGreaterThanOrEqual(0);
    expect(afterNavTop).toBeGreaterThanOrEqual(0);
    expect(afterSidebarTop).toBeLessThan(180);
    expect(afterNavTop).toBeLessThan(180);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(5);
  });
});
