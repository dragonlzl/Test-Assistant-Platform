const { test, expect } = require('@playwright/test');
const path = require('path');

const splitDebugPath = path.join(
  '/Users',
  'linzhenlong',
  'Downloads',
  'debug_SPLIT_2025-12-05-15-40-15.txt'
);

test('拆分调试文件导入补齐需求标识并可进行覆盖对比', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true);

  await page.click('[data-tab-btn="clean"]');
  await page.setInputFiles('#splitDebugFile', splitDebugPath);

  const splitValue = await page.$eval('#splitResult', (el) => el.value || '');
  expect(splitValue).toMatch(/requirement|需求标识/);

  await page.fill('#caseText', '[{"module":"新手礼包-投放与定价","title":"用例1"}]');
  await page.click('#casesCompareBtn', { force: true });

  const status = page.locator('#casesCoverageStatus');
  await expect(status).toContainText('未找到覆盖对比模型', { timeout: 5000 });
  await expect(status).not.toContainText('需求标识为空');
});
