const { test, expect } = require('@playwright/test');

test('drawer keeps sidebar and flow nav visible with full mask', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-tab-btn="clean"]');
  await page.click('#toggleCleanViewBtn');

  const drawer = page.locator('#cleanViewDrawer');
  await expect(drawer).toHaveClass(/open/);

  const sidebar = page.locator('aside.sidebar');
  await expect(sidebar).toBeVisible();

  const flowNav = page.locator('#flowNav');
  await expect(flowNav).toBeVisible();

  const mask = page.locator('#cleanViewDrawer .drawer-mask');
  await expect(mask).toBeVisible();
  const box = await mask.boundingBox();
  expect(box && box.width).toBeGreaterThan(1000);
  expect(box && box.height).toBeGreaterThan(600);
});

test('drawer keeps nav visible after page has been scrolled (clean)', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-tab-btn="clean"]');
  await page.waitForSelector('#toggleCleanViewBtn');
  await page.evaluate(() => {
    var filler = document.createElement('div');
    filler.id = 'drawer-scroll-filler';
    filler.style.height = '2000px';
    filler.style.width = '1px';
    filler.style.pointerEvents = 'none';
    document.body.appendChild(filler);
    var target = 1200;
    window.scrollTo(0, target);
    document.documentElement.scrollTop = target;
    document.body.scrollTop = target;
  });
  await page.locator('#toggleCleanViewBtn').evaluate((btn) => btn.click());

  const drawer = page.locator('#cleanViewDrawer');
  await expect(drawer).toHaveClass(/open/);

  const sidebar = page.locator('aside.sidebar');
  await expect(sidebar).toBeVisible();

  const flowNav = page.locator('#flowNav');
  await expect(flowNav).toBeVisible();
});

test('tempexec drawer keeps sidebar and tempexec nav visible with full mask', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-tab-btn="tempexec"]');
  await page.click('#openTempExecDrawerBtn');

  const drawer = page.locator('#tempExecDrawer');
  await expect(drawer).toHaveClass(/open/);

  const sidebar = page.locator('aside.sidebar');
  await expect(sidebar).toBeVisible();

  const tempexecNav = page.locator('#tempexecFlowNav');
  await expect(tempexecNav).toBeVisible();

  const mask = page.locator('#tempExecDrawer .drawer-mask');
  await expect(mask).toBeVisible();
  const box = await mask.boundingBox();
  expect(box && box.width).toBeGreaterThan(1000);
  expect(box && box.height).toBeGreaterThan(600);
});

test('tempexec drawer keeps nav visible after page has been scrolled', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-tab-btn="tempexec"]');
  await page.waitForSelector('#openTempExecDrawerBtn');
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
  await page.locator('#openTempExecDrawerBtn').evaluate((btn) => btn.click());

  const drawer = page.locator('#tempExecDrawer');
  await expect(drawer).toHaveClass(/open/);

  const sidebar = page.locator('aside.sidebar');
  await expect(sidebar).toBeVisible();

  const tempexecNav = page.locator('#tempexecFlowNav');
  await expect(tempexecNav).toBeVisible();
});

test('tempexec drawer keeps nav position after long scroll on execute view', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-tab-btn="tempexec"]');
  await page.waitForSelector('#openTempExecDrawerBtn');
  await page.waitForFunction(() => window.app && window.app._inited === true);
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

  await page.locator('#openTempExecDrawerBtn').evaluate((btn) => btn.click());
  await page.waitForSelector('#tempExecDrawer.open');
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
