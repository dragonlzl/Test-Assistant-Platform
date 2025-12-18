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
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.removeItem('tap-auth-token');
      } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  });

  test('页面加载与导航存在', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '用例助手' })).toBeVisible();
    await page.click('[data-group="ai"]');
    await expect(page.locator('[data-tab-btn="auto"]')).toBeVisible();
    await expect(page.locator('[data-tab-btn="casesgen"]')).toBeVisible();
    await page.click('[data-group="cases"]');
    await expect(page.locator('[data-tab-btn="tempexec"]')).toBeVisible();
  });

  test('切换功能工作流标签可见', async ({ page }) => {
    const tab = page.locator('[data-tab-btn="clean"]');
    await page.click('[data-group="ai"]');
    await tab.click();
    await expect(tab).toHaveClass(/active/);
    const cleanSection = page.locator('[data-tab-section="clean"]').first();
    await expect(cleanSection).toBeVisible();
  });

  test('切换用例执行入口可见', async ({ page }) => {
    const tab = page.locator('[data-tab-btn="tempexec"]');
    await page.click('[data-group="cases"]');
    await tab.click();
    await expect(tab).toHaveClass(/active/);
    await page.click('#openTempExecImportDrawerBtn');
    await expect(page.locator('#tempExecDropZone')).toBeVisible();
    await page.click('#tempExecImportDrawer .drawer-mask');
  });

  test('所有页签与顶部步骤可点击', async ({ page }) => {
    const groups = ['ai', 'cases', 'settings'];
    for (const group of groups) {
      await page.click(`[data-group="${group}"]`);
      const tabIds = await page.$$eval(`[data-group-menu="${group}"] [data-tab-btn]`, (nodes) => {
        return nodes
          .filter((node) => node && node.getClientRects && node.getClientRects().length > 0)
          .map((node) => node.getAttribute('data-tab-btn') || '')
          .filter((val) => val);
      });
      for (const tabId of tabIds) {
        await page.click(`[data-group="${group}"]`);
        await page.click(`[data-tab-btn="${tabId}"]`);
      }
    }
    const steps = await page.$$('#flowNav .step');
    for (const step of steps) {
      await step.click();
    }
  });
});
