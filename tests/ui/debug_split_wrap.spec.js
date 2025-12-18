const fs = require('fs');
const { test, expect } = require('@playwright/test');

test.describe('调试文件需求标识去重', () => {
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
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  });

  test('导入已带 requirement 的拆分调试文件后再次保存不会重复包裹', async ({ page }) => {
    await page.click('[data-group="ai"]');
    await page.click('[data-tab-btn="clean"]');

    const payload = '#NODE:SPLIT\n{"requirement":"当前需求","data":{"模块": [{"module": "登录","key_scenarios": [],"test_points": [],"coupled_modules": []}]}, "type":"split"}';
    await page.setInputFiles('#splitDebugFile', {
      name: 'debug_split.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(payload),
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('#saveSplitDebug');
    const download = await downloadPromise;
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const content = fs.readFileSync(filePath, 'utf8');
    const body = content.split('\n').slice(1).join('\n');
    const parsed = JSON.parse(body);
    expect(parsed.requirement).toBe('当前需求');
    expect(parsed.type).toBe('split');
    expect(parsed.data && parsed.data.requirement).toBeUndefined();
  });
});
