const { test, expect } = require('@playwright/test');

test.describe('顶部导航预加载', () => {
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
  });

  test('用例库页加载时不显示默认流程导航', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-library.html?tab=case-archive', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#flowNav')).toBeHidden();
    await expect(page.locator('#caseArchiveHead')).toBeVisible();
  });

  test('执行总览加载时展示对应顶部导航', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html?tab=exec-overview', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#flowNav')).toBeHidden();
    await expect(page.locator('#execOverviewHead')).toBeVisible();
  });

  test('执行页遇到中文 tab 参数时会自动归一化到内部 key', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html?tab=' + encodeURIComponent('用例执行'), { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-tab-section="tempexec"]').first()).toBeVisible();
    await expect(page).toHaveURL(/case-exec\.html\?tab=tempexec/);
  });
});
