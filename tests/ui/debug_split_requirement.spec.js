const { test, expect } = require('@playwright/test');

test('拆分调试文件导入补齐需求标识并可进行覆盖对比', async ({ page }) => {
  await page.route('**/*', (route) => {
    var url = route.request().url();
    if (url.indexOf('http://localhost') === 0 || url.indexOf('http://127.0.0.1') === 0 || url.indexOf('file:') === 0) {
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

  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');
  const payload = {
    requirement: '当前需求',
    data: [{ module: '新手礼包-投放与定价', key_scenarios: [], test_points: [], coupled_modules: [] }],
    type: 'split',
  };
  await page.setInputFiles('#splitDebugFile', {
    name: 'debug_split.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('#NODE:SPLIT\n' + JSON.stringify(payload, null, 2)),
  });

  const splitValue = await page.$eval('#splitResult', (el) => el.value || '');
  expect(splitValue).toMatch(/requirement|需求标识/);

  await page.fill('#caseText', '[{"module":"新手礼包-投放与定价","title":"用例1"}]');
  await page.click('#casesCompareBtn', { force: true });

  const status = page.locator('#casesCoverageStatus');
  await expect(status).toContainText('未找到覆盖对比模型', { timeout: 5000 });
  await expect(status).not.toContainText('需求标识为空');
});
