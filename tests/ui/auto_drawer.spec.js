const { test, expect } = require('@playwright/test');

test.describe('auto tab drawers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('clarify view opens inside drawer', async ({ page }) => {
    await page.check('#autoNeedClarify');
    const opened = await page.$eval('#autoClarifyDrawer', (el) => el.classList.contains('open'));
    if (!opened) {
      await page.click('#autoClarifyToggleBtn');
    }

    const drawer = page.locator('#autoClarifyDrawer');
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#autoClarifyContainer')).toBeVisible();

    await page.click('#closeAutoClarifyDrawerBtn');
    await expect(drawer).not.toHaveClass(/open/);
  });

  test('coverage missing list uses drawer with mocked data', async ({ page }) => {
    await page.evaluate(() => {
      const compare = document.getElementById('compareResult');
      if (compare) {
        compare.value = JSON.stringify({
          coverage: 80,
          missing: [{ module: '模块A', points: ['P1'] }],
        });
      }
      if (window.app && window.app.state) {
        window.app.state.autoCompareMissingList = [{ module: '模块A', points: ['P1'] }];
        window.app.state.autoCompareSelections = new Set();
        window.app.state.autoCompareSelectionTouched = false;
        window.app.state.autoRunning = false;
      }
      const btn = document.getElementById('autoCompareMissingToggle');
      if (btn) btn.disabled = false;
    });

    await page.click('#autoCompareMissingToggle');

    const drawer = page.locator('#autoCompareDrawer');
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#autoCompareMissing table')).toBeVisible();
  });

  test('case missing view opens drawer with mocked data', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.missingRowCache = [
          { moduleName: '模块B', text: '缺失要点' },
        ];
        window.app.state.missingSelections = new Set();
        window.app.state.missingLastList = window.app.state.missingRowCache.slice();
        window.app.state.autoRunning = false;
      }
      const btn = document.getElementById('autoMissingToggle');
      if (btn) btn.disabled = false;
    });

    await page.click('#autoMissingToggle');

    const drawer = page.locator('#autoMissingDrawer');
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#autoMissingView table')).toBeVisible();
  });
});
