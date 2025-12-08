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
