const { test, expect } = require('@playwright/test');

test.describe('执行页抽屉遮罩不遮挡侧边栏/执行导航', () => {
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

  test('tempexec drawer keeps sidebar and tempexec nav visible with full mask', async ({ page }) => {
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
    await page.locator('#openTempExecImportDrawerBtn').evaluate((btn) => btn.click());

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
    const beforeSidebarTop = await page.$eval('aside.sidebar', (el) => el.getBoundingClientRect().top);
    const beforeNavTop = await page.$eval('#tempexecFlowNav', (el) => el.getBoundingClientRect().top);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.locator('#openTempExecImportDrawerBtn').evaluate((btn) => btn.click());
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
