const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
});

test('导出覆盖对比仅下载不跳转', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');
  const beforeUrl = page.url();
  await page.evaluate(() => {
    var el = document.getElementById('casesCompareResult');
    if (el) {
      el.removeAttribute('readonly');
      el.value = '{"coverage":50,"missing":[],"extra":[]}';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  page.once('dialog', (dialog) => dialog.accept('需求A'));

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportCasesCoverage'),
  ]);

  expect(download.suggestedFilename()).toMatch(/cases_compare_/);
  await expect(page).toHaveURL(beforeUrl);
});

test('拆分执行时开始拆分按钮不可点击', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('cleaner-models-v1', JSON.stringify([{
      id: 'mock-split-model',
      name: 'Mock Split',
      provider: 'custom',
      baseUrl: 'http://127.0.0.1:8123/mock-split',
      apiKey: '',
      model: 'mock-model',
      maxTokens: 64,
    }]));
    localStorage.setItem('cleaner-assignment-v1', JSON.stringify({ splitId: 'mock-split-model', splitTemperature: 0.2 }));
    localStorage.setItem('tap-e2e-skip-auth', '1');
    localStorage.removeItem('tap-auth-token');
  });
  const page = await context.newPage();
  await page.route('http://127.0.0.1:8123/mock-split', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: '[{"module":"模块1","key_scenarios":[],"test_points":[],"coupled_modules":[]}]' } }],
      }),
    });
  });
  await page.goto('/');
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');
  await expect(page.locator('#splitModelSelect')).toHaveValue('mock-split-model');
  await page.evaluate(() => {
    var cleaned = document.getElementById('cleanedText');
    if (cleaned) {
      cleaned.removeAttribute('readonly');
      cleaned.value = '用于拆分的需求内容';
      cleaned.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  page.once('dialog', (dialog) => dialog.accept('需求B'));

  const splitBtn = page.locator('#splitBtn');
  const splitStatus = page.locator('#splitStatus');
  await splitBtn.click();

  await expect(splitBtn).toBeDisabled();
  await expect(splitStatus).toContainText('拆分完成', { timeout: 4000 });
  await expect(splitBtn).toBeEnabled();

  await context.close();
});
