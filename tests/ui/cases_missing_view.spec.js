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

test('缺失模块表头全选/取消有效', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab-btn="clean"]');

  const fixturePath = path.join(__dirname, '..', 'fixtures', 'cases_compare_missing_view.txt');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#importCasesCoverage'),
  ]);
  await chooser.setFiles(fixturePath);

  await page.click('#missingViewBtn');

  const container = page.locator('#missingViewContainer');
  await expect(container).toHaveClass(/visible/);
  await expect(container.locator('input[data-missing-index]')).toHaveCount(35);

  const headerCheckbox = container.locator('input[data-missing-select-all]');
  await headerCheckbox.check();
  const checkedCount = await container.evaluate((el) => {
    return Array.prototype.filter.call(
      el.querySelectorAll('input[data-missing-index]'),
      function(cb) { return cb.checked; }
    ).length;
  });
  await expect(checkedCount).toBe(35);
  await expect(container.locator('input[data-missing-index]:checked')).toHaveCount(35);

  await headerCheckbox.uncheck();
  await expect(container.locator('input[data-missing-index]:checked')).toHaveCount(0);
});

test('无拆分结果时生成用例按钮禁用，填入拆分结果后可用', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab-btn="clean"]');

  const genBtn = page.locator('#casesGoUsecaseGen');
  await expect(genBtn).toBeDisabled();

  await page.evaluate(() => {
    var splitEl = document.getElementById('splitResult');
    if (splitEl) {
      splitEl.removeAttribute('readonly');
      splitEl.value = '[{"module":"Demo","key_scenarios":[],"test_points":[],"coupled_modules":[]}]';
      splitEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await expect(genBtn).toBeEnabled();
});
