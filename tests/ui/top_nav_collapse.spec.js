const { test, expect } = require('@playwright/test');

async function setupPage(page) {
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
      const resetKey = 'tap-e2e-top-nav-reset';
      if (!localStorage.getItem(resetKey)) {
        localStorage.setItem(resetKey, '1');
        localStorage.removeItem('usecase-top-nav-collapse-v1');
        const raw = localStorage.getItem('usecase-settings-v1') || '{}';
        const settings = JSON.parse(raw);
        if (settings && typeof settings === 'object') {
          settings.smartTopNavCollapse = false;
          localStorage.setItem('usecase-settings-v1', JSON.stringify(settings));
        }
      }
    } catch (_) {}
  });
}

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
}

test.describe('顶部导航收起展开', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('收起状态按页面持久化', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await waitForAppReady(page);

    const tempexecNav = page.locator('#tempexecFlowNav');
    const tempexecToggle = page.locator('#tempexecFlowNav [data-flow-toggle]');
    await expect(tempexecNav).not.toHaveClass(/is-collapsed/);
    await expect(tempexecToggle).toHaveText('收起');

    await tempexecToggle.click();
    await expect(tempexecNav).toHaveClass(/is-collapsed/);
    await expect(tempexecToggle).toHaveText('展开');

    await page.reload();
    await waitForAppReady(page);
    await expect(tempexecNav).toHaveClass(/is-collapsed/);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('exec-overview');
      }
    });
    const execOverviewNav = page.locator('#execOverviewFlowNav');
    const execOverviewToggle = page.locator('#execOverviewFlowNav [data-flow-toggle]');
    await execOverviewNav.waitFor({ state: 'visible', timeout: 10000 });
    await expect(execOverviewNav).not.toHaveClass(/is-collapsed/);
    await expect(execOverviewToggle).toHaveText('收起');
  });

  test('智能收起随滚动展开', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/settings.html');
    await waitForAppReady(page);
    const smartToggle = page.locator('#smartTopNavToggle');
    await smartToggle.scrollIntoViewIfNeeded();
    await smartToggle.check();
    await expect(smartToggle).toBeChecked();

    await page.goto(base + '/case-library.html');
    await waitForAppReady(page);
    const nav = page.locator('#caseLibraryFlowNav');
    await expect(nav).not.toHaveClass(/is-collapsed/);

    await page.mouse.wheel(0, 160);
    await expect(nav).toHaveClass(/is-collapsed/);

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      if (document.body) document.body.style.scrollBehavior = 'auto';
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -160 }));
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -160 }));
    });
    await expect(nav).not.toHaveClass(/is-collapsed/);
  });
});
