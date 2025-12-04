const { test, expect } = require('@playwright/test');

test.describe('用例助手基础冒烟', () => {
  test.beforeEach(async ({ page }) => {
    // 阻断外部请求，避免触发真实模型接口
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

  test('页面加载与导航存在', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '用例助手' })).toBeVisible();
    await expect(page.locator('[data-tab-btn="auto"]')).toBeVisible();
    await expect(page.locator('[data-tab-btn="casesgen"]')).toBeVisible();
    await expect(page.locator('[data-tab-btn="tempexec"]')).toBeVisible();
  });

  test('切换功能工作流标签可见', async ({ page }) => {
    const tab = page.locator('[data-tab-btn="clean"]');
    await tab.click();
    await expect(tab).toHaveClass(/active/);
    const cleanSection = page.locator('[data-tab-section="clean"]').first();
    await expect(cleanSection).toBeVisible();
  });

  test('切换用例执行入口可见', async ({ page }) => {
    const tab = page.locator('[data-tab-btn="tempexec"]');
    await tab.click();
    await expect(tab).toHaveClass(/active/);
    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDropZone')).toBeVisible();
    await page.click('#tempExecDrawer .drawer-mask');
  });

  test('所有页签与顶部步骤可点击', async ({ page }) => {
    const tabs = await page.$$('[data-tab-btn]');
    for (const tab of tabs) {
      await tab.click();
    }
    const steps = await page.$$('#flowNav .step');
    for (const step of steps) {
      await step.click();
    }
  });
});
