const { test, expect } = require('@playwright/test');

test('导出文件名前缀去除重复时间戳标识', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.app && window.app._inited === true && window.app.xmindCoreApi, {}, { timeout: 30000 });

  const cleaned = await page.evaluate(() => {
    var api = window.app && window.app.xmindCoreApi;
    if (!api || typeof api.getSafeFileBaseName !== 'function') return null;
    return api.getSafeFileBaseName('武器大师任务_result_20251209170512_result_20251209170546.xmind');
  });

  expect(cleaned).toBe('武器大师任务');
});
