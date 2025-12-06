const { test, expect } = require('@playwright/test');

test.describe('拆分到用例生成跳转', () => {
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
  });

  test('拆分结果生成用例按钮可跳转用例生成页', async ({ page }) => {
    await page.click('[data-tab-btn="clean"]');
    await page.evaluate(() => {
      const split = document.getElementById('splitResult');
      if (split) {
        split.removeAttribute('readonly');
        split.value = JSON.stringify([{
          module: '登录',
          key_scenarios: ['输入账号密码登录'],
          test_points: ['验证成功登录'],
          coupled_modules: [],
        }]);
        split.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.click('#goUsecaseGen');
    await expect(page.locator('[data-tab-btn="casesgen"]')).toHaveClass(/active/);
    await expect(page.locator('[data-section-id="casesgen"]')).toBeVisible();
    await expect(page.locator('#casesGenerationContainer')).toContainText('登录');
  });
});
