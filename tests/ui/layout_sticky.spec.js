const { test, expect } = require('@playwright/test');

test.describe('全局粘顶区域', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      localStorage.removeItem('usecase-card-collapse-v1');
    });
  });

  test('侧边页签与 AI 步骤保持粘顶', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(100);

    const navTopAfter = await page.$eval('.tabs.vertical', (el) => el.getBoundingClientRect().top);
    const flowTopAfter = await page.$eval('#flowNav', (el) => el.getBoundingClientRect().top);

    await expect(navTopAfter).toBeGreaterThanOrEqual(0);
    await expect(flowTopAfter).toBeGreaterThanOrEqual(0);
    await expect(navTopAfter).toBeLessThan(180);
    await expect(flowTopAfter).toBeLessThan(200);
  });
});
