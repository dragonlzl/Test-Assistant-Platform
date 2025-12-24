const path = require('path');
const { test, expect } = require('@playwright/test');

async function gotoCleanTab(page) {
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
});

test('导入覆盖对比后可展开缺失模块视图', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await gotoCleanTab(page);

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
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await gotoCleanTab(page);

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
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await gotoCleanTab(page);

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
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await gotoCleanTab(page);

  await page.evaluate(() => {
    var splitEl = document.getElementById('splitResult');
    if (splitEl) {
      splitEl.removeAttribute('readonly');
      splitEl.value = '';
      splitEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.caseGenModules = [];
    }
    if (window.app && window.app.core && typeof window.app.core.updateFlowStatus === 'function') {
      window.app.core.updateFlowStatus();
    }
  });

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

test('导入拆分与覆盖对比后智能生成填充按钮自动可用', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await gotoCleanTab(page);

  const splitPayload = '#NODE:SPLIT\n[{"module":"礼包投放与触发","key_scenarios":["礼包到期触发"],"test_points":["到期提醒"],"coupled_modules":[]}]';
  await page.setInputFiles('#splitDebugFile', {
    name: 'split_debug.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(splitPayload),
  });
  await expect(page.locator('#splitStatus')).toContainText('已从调试 TXT 导入拆分结果');

  const coveragePath = path.join(__dirname, '..', 'fixtures', 'cases_compare_missing_view.txt');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#importCasesCoverage'),
  ]);
  await chooser.setFiles(coveragePath);
  await expect(page.locator('#casesCoverageStatus')).toContainText('已导入覆盖对比结果');

  const smartFillBtn = page.locator('#missingSmartFillBtn');
  await expect(smartFillBtn).toBeEnabled();
});

test('智能填充后自动关闭缺失抽屉并可滚动', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await gotoCleanTab(page);

  const splitPayload = '#NODE:SPLIT\n[{"module":"礼包投放与触发","key_scenarios":["礼包到期触发"],"test_points":["到期提醒"],"coupled_modules":[]}]';
  await page.setInputFiles('#splitDebugFile', {
    name: 'split_debug.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(splitPayload),
  });
  await expect(page.locator('#splitStatus')).toContainText('已从调试 TXT 导入拆分结果');

  const coveragePath = path.join(__dirname, '..', 'fixtures', 'cases_compare_missing_view.txt');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#importCasesCoverage'),
  ]);
  await chooser.setFiles(coveragePath);
  await expect(page.locator('#casesCoverageStatus')).toContainText('已导入覆盖对比结果');

  const missingBtn = page.locator('#missingViewBtn');
  await expect(missingBtn).toBeEnabled();
  await missingBtn.click();
  await page.click('#missingSmartFillBtn');

  await expect(page.locator('#missingViewDrawer')).not.toHaveClass(/open/);
  await page.waitForFunction(() => !document.body.classList.contains('drawer-open'));
  const bodyHasLock = await page.evaluate(() => document.body.classList.contains('drawer-open'));
  expect(bodyHasLock).toBeFalsy();
});

test('从缺失抽屉跳转到用例生成后自动收起抽屉', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.app && window.app._inited === true);
  await gotoCleanTab(page);

  const splitPayload = '#NODE:SPLIT\n[{"module":"礼包投放与触发","key_scenarios":["礼包到期触发"],"test_points":["到期提醒"],"coupled_modules":[]}]';
  await page.setInputFiles('#splitDebugFile', {
    name: 'split_debug.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(splitPayload),
  });
  await expect(page.locator('#splitStatus')).toContainText('已从调试 TXT 导入拆分结果');

  const coveragePath = path.join(__dirname, '..', 'fixtures', 'cases_compare_missing_view.txt');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#importCasesCoverage'),
  ]);
  await chooser.setFiles(coveragePath);
  await expect(page.locator('#casesCoverageStatus')).toContainText('已导入覆盖对比结果');

  const missingBtn = page.locator('#missingViewBtn');
  await expect(missingBtn).toBeEnabled();
  await missingBtn.click();
  await expect(page.locator('#missingViewDrawer')).toHaveClass(/open/);

  await page.click('#casesGoUsecaseGen');

  await page.waitForFunction(() => {
    var section = document.querySelector('section[data-tab-section="casesgen"]');
    return section && !section.classList.contains('hidden');
  });
  await expect(page.locator('section[data-tab-section="casesgen"]')).not.toHaveClass(/hidden/);
  await expect(page.locator('#missingViewDrawer')).not.toHaveClass(/open/);
  await page.waitForFunction(() => !document.body.classList.contains('drawer-open'));
  const bodyLocked = await page.evaluate(() => document.body.classList.contains('drawer-open'));
  expect(bodyLocked).toBeFalsy();
});
