const { test, expect } = require('@playwright/test');

test('拆分结果写入后自动可展开拆分视图', async ({ page }) => {
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
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');

  await page.evaluate(() => {
    var apply = window.app && window.app.applySplitResultText;
    if (typeof apply === 'function') apply('');
  });
  const toggleBtn = page.locator('#toggleSplitView');
  await toggleBtn.scrollIntoViewIfNeeded();
  await expect(toggleBtn).toBeDisabled();

  await page.evaluate(() => {
    var sample = JSON.stringify([{
      module: '模块A',
      key_scenarios: ['场景1'],
      test_points: ['要点1'],
      coupled_modules: ['依赖1'],
      特殊测试点: ['特殊点1'],
    }]);
    var apply = window.app && window.app.applySplitResultText;
    if (typeof apply === 'function') apply(sample);
  });

  await toggleBtn.scrollIntoViewIfNeeded();
  await expect(toggleBtn).not.toBeDisabled();
  await toggleBtn.click();
  const splitView = page.locator('#splitViewContainer');
  await expect(splitView).toHaveClass(/visible/);
  await expect(splitView).toContainText('模块A');
  await expect(splitView).toContainText('特殊点1');
});
