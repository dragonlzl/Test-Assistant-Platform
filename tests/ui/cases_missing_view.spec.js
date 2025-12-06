const path = require('path');
const { test, expect } = require('@playwright/test');

test('导入覆盖对比后可展开缺失模块视图', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab-btn="clean"]');

  const fixturePath = path.join(__dirname, '..', 'fixtures', 'cases_compare_missing_view.txt');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#importCasesCoverage'),
  ]);
  await chooser.setFiles(fixturePath);

  await expect(page.locator('#casesCoverageStatus')).toContainText('已导入覆盖对比结果');

  const missingBtn = page.locator('#missingViewBtn');
  await expect(missingBtn).toBeEnabled();
  await missingBtn.click();

  const container = page.locator('#missingViewContainer');
  await expect(container).toHaveClass(/visible/);
  await expect(container.locator('tbody tr')).toHaveCount(35);
  await expect(container.locator('tbody tr').first()).toContainText('礼包投放与触发');
});

test('导入带需求标识的覆盖结果仍可展示缺失模块', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab-btn="clean"]');

  const fixturePath = path.join(__dirname, '..', 'fixtures', 'cases_compare_missing_view_wrapped.txt');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#importCasesCoverage'),
  ]);
  await chooser.setFiles(fixturePath);

  await expect(page.locator('#casesCoverageStatus')).toContainText('已导入覆盖对比结果');

  const missingBtn = page.locator('#missingViewBtn');
  await expect(missingBtn).toBeEnabled();
  await missingBtn.click();

  const container = page.locator('#missingViewContainer');
  await expect(container).toHaveClass(/visible/);
  await expect(container.locator('tbody tr')).toHaveCount(24);
  await expect(container.locator('tbody tr').first()).toContainText('礼包系统综合流程与业务逻辑');
});
