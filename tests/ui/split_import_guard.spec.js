const { test, expect } = require('@playwright/test');

function isAllowedLocalUrl(url) {
  return (
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1') ||
    url.startsWith('file:') ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('about:')
  );
}

async function expectSectionNearTop(page, sectionId) {
  await page.waitForFunction((id) => {
    var section = document.querySelector('[data-section-id="' + id + '"]');
    if (!section || typeof section.getBoundingClientRect !== 'function') return false;
    var rect = section.getBoundingClientRect();
    return rect.top >= -20 && rect.top <= 560 && rect.bottom > 0;
  }, sectionId, { timeout: 3000 });
}

test('未导入用例时手动拆分弹出二次提醒，点击前往导入用例后跳转到导入卡片', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const page = await context.newPage();
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (isAllowedLocalUrl(url)) return route.continue();
    return route.abort();
  });

  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');
  await page.evaluate(() => {
    var cleaned = document.getElementById('cleanedText');
    if (cleaned) {
      cleaned.removeAttribute('readonly');
      cleaned.value = '用于拆分的需求内容';
      cleaned.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.requirementLabel = '需求-拆分导入提醒';
      window.app.state.requirementLabelSource = 'manual';
    }
  });

  await page.click('#splitBtn');
  const drawer = page.locator('#appConfirmDrawer');
  await expect(drawer).toHaveClass(/open/);
  await expect(page.locator('#appConfirmDrawerConfirmBtn')).toHaveText('前往导入用例');
  await expect(page.locator('#appConfirmDrawerCancelBtn')).toHaveText('不导入用例');
  await expect(page.locator('#appConfirmDrawerMessage')).toContainText('当前尚未导入测试用例');

  await page.click('#appConfirmDrawerConfirmBtn');
  await expect(drawer).not.toHaveClass(/open/);
  await expect(page.locator('#splitStatus')).toContainText('已跳转到“测试用例导入（XMind）”卡片');
  await expect(page.locator('[data-tab-btn="clean"]')).toHaveClass(/active/);
  await expectSectionNearTop(page, 'cases-upload');

  await context.close();
});

test('已导入用例时拆分提示词包含模块节点约束且不弹导入提醒', async ({ browser }) => {
  const mockEndpoint = 'http://127.0.0.1:8124/mock-split';
  const context = await browser.newContext();
  await context.addInitScript((endpoint) => {
    try {
      localStorage.setItem('cleaner-models-v1', JSON.stringify([{
        id: 'mock-split-model-imported',
        name: 'Mock Split Imported',
        provider: 'custom',
        baseUrl: endpoint,
        apiKey: '',
        model: 'mock-model',
        maxTokens: 128,
      }]));
      localStorage.setItem('cleaner-assignment-v1', JSON.stringify({ splitId: 'mock-split-model-imported', splitTemperature: 0.2 }));
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  }, mockEndpoint);

  const page = await context.newPage();
  let systemPrompt = '';
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url === mockEndpoint) {
      const payload = route.request().postDataJSON();
      if (payload && Array.isArray(payload.messages) && payload.messages[0]) {
        systemPrompt = String(payload.messages[0].content || '');
      }
      await new Promise((resolve) => setTimeout(resolve, 160));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: '[{"module":"登录中心","key_scenarios":[],"test_points":[],"coupled_modules":[]}]' } }],
        }),
      });
    }
    if (isAllowedLocalUrl(url)) return route.continue();
    return route.abort();
  });

  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.click('[data-group="ai"]');
  await page.click('[data-tab-btn="clean"]');

  await page.evaluate(() => {
    var cleaned = document.getElementById('cleanedText');
    if (cleaned) {
      cleaned.removeAttribute('readonly');
      cleaned.value = '用于拆分的需求内容';
      cleaned.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.requirementLabel = '需求-导入模块复用';
      window.app.state.requirementLabelSource = 'import';
      window.app.state.importedCases = [{
        id: 'case-imported-1',
        name: 'imported.json',
        text: '',
        list: [
          { module: '登录中心', title: '登录成功', priority: 'P1', preconditions: '', steps: '输入正确账号密码', expected: '登录成功' },
          { module: '支付结算', title: '支付成功', priority: 'P1', preconditions: '', steps: '提交支付', expected: '支付成功' },
        ],
      }];
    }
  });

  await page.click('#splitBtn');
  await expect(page.locator('#splitStatus')).toContainText('拆分完成', { timeout: 5000 });
  await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);

  expect(systemPrompt).toContain('登录中心');
  expect(systemPrompt).toContain('支付结算');
  expect(systemPrompt).toContain('当前模块划分足够，则不要新增模块');
  expect(systemPrompt).toContain('最终输出格式保持不变');

  const splitParsed = await page.$eval('#splitResult', (el) => {
    var raw = (el && el.value ? el.value : '').trim();
    var parsed = JSON.parse(raw || '[]');
    return {
      isArray: Array.isArray(parsed),
      module: parsed[0] && parsed[0].module ? parsed[0].module : '',
      hasExpectedField: parsed[0] && Object.prototype.hasOwnProperty.call(parsed[0], 'key_scenarios'),
    };
  });
  expect(splitParsed.isArray).toBeTruthy();
  expect(splitParsed.module).toBe('登录中心');
  expect(splitParsed.hasExpectedField).toBeTruthy();

  await context.close();
});

test('忽略覆盖率继续时，拆分步骤也会弹出导入用例提醒并支持跳转', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const page = await context.newPage();
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (isAllowedLocalUrl(url)) return route.continue();
    return route.abort();
  });

  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/ai-workflow.html?tab=auto');
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.evaluate(() => {
    var cleaned = document.getElementById('cleanedText');
    if (cleaned) {
      cleaned.removeAttribute('readonly');
      cleaned.value = '用于继续流程的清洗结果';
      cleaned.dispatchEvent(new Event('input', { bubbles: true }));
    }
    var compare = document.getElementById('compareResult');
    if (compare) {
      compare.removeAttribute('readonly');
      compare.value = JSON.stringify({ coverage: 80, missing: ['缺少流程节点'] });
      compare.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (window.app && window.app.state) {
      window.app.state.requirementLabel = '需求-忽略继续导入提醒';
      window.app.state.requirementLabelSource = 'manual';
      window.app.state.importedCases = [];
    }
    if (window.app && typeof window.app.syncAutoCompareStatus === 'function') {
      window.app.syncAutoCompareStatus(false);
    }
  });

  const ignoreBtn = page.locator('#autoIgnoreCoverageBtn');
  await expect(ignoreBtn).toBeEnabled();
  await page.evaluate(() => {
    var btn = document.getElementById('autoIgnoreCoverageBtn');
    if (btn && typeof btn.click === 'function') btn.click();
  });

  const drawer = page.locator('#appConfirmDrawer');
  await expect(drawer).toHaveClass(/open/);
  await expect(page.locator('#appConfirmDrawerConfirmBtn')).toHaveText('前往导入用例');
  await expect(page.locator('#appConfirmDrawerCancelBtn')).toHaveText('不导入用例');

  await page.click('#appConfirmDrawerConfirmBtn');
  await expect(drawer).not.toHaveClass(/open/);
  await expect(page.locator('[data-tab-btn="clean"]')).toHaveClass(/active/);
  await expect(page.locator('#splitStatus')).toContainText('已跳转到“测试用例导入（XMind）”卡片');
  await expect(page.locator('[data-section-id="cases-upload"]')).toBeVisible();
  await expectSectionNearTop(page, 'cases-upload');

  await context.close();
});
