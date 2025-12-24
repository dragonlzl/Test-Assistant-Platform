const { test, expect } = require('@playwright/test');

test.describe('模型管理：同名校验与删除二次确认', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      ['cleaner-models-v1', 'cleaner-assignment-v1', 'usecase-settings-v1'].forEach((key) => {
        window.localStorage.removeItem(key);
      });
      window.localStorage.setItem('tap-e2e-skip-auth', '1');
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await page.evaluate(() => {
      document.querySelectorAll('.tab-group .tab-submenu').forEach(function(menu) {
        menu.classList.remove('hidden');
      });
      document.querySelectorAll('.tab-group').forEach(function(group) {
        group.classList.add('open');
      });
      document.querySelectorAll('.tab-group .tab-group-btn').forEach(function(btn) {
        btn.classList.add('open');
      });
      document.querySelectorAll('[data-tab-btn]').forEach(function(btn) {
        btn.classList.remove('hidden');
        btn.classList.remove('role-hidden');
      });
    });
  });

  async function createModel(page, name, modelIdSuffix) {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await page.waitForSelector('#createModelBtn', { state: 'visible', timeout: 20000 });
    await page.locator('#createModelBtn').scrollIntoViewIfNeeded();
    await page.click('#createModelBtn');
    await page.waitForSelector('#modelFormWrapper', { state: 'visible', timeout: 20000 });
    await page.fill('#modelDisplayName', name);
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test-' + (modelIdSuffix || 'x'));
    await page.fill('#modelIdentifier', 'deepseek-test-' + (modelIdSuffix || 'x'));
    await page.fill('#modelMaxTokens', '2048');
    await page.click('#saveModelBtn');
  }

  test('新增模型同名校验：抽屉内提示且不落库', async ({ page }) => {
    await createModel(page, '重复校验模型', 'a');
    await expect(page.locator('#modelList')).toContainText('重复校验模型');

    await page.locator('#createModelBtn').scrollIntoViewIfNeeded();
    await page.click('#createModelBtn');
    await page.waitForSelector('#modelFormWrapper', { state: 'visible', timeout: 20000 });
    await page.fill('#modelDisplayName', '重复校验模型');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test-b');
    await page.fill('#modelIdentifier', 'deepseek-test-b');
    await page.fill('#modelMaxTokens', '2048');
    await page.click('#saveModelBtn');

    await expect(page.locator('#modelFormWrapper')).toBeVisible();
    await expect(page.locator('#modelFormStatus')).toContainText('模型名称已存在');
    const count = await page.locator('#modelList .model-card').count();
    expect(count).toBe(1);
  });

  test('删除模型二次确认：需要连续确认后才删除', async ({ page }) => {
    await createModel(page, '待删除模型', 'del');
    await expect(page.locator('#modelList')).toContainText('待删除模型');

    let dialogCount = 0;
    page.on('dialog', async (dialog) => {
      dialogCount += 1;
      await dialog.accept();
    });

    // 点击列表中的删除按钮（会触发两次 confirm）
    await page.locator('#modelList [data-delete]').first().click();
    await expect(page.locator('#modelFormStatus')).toContainText('模型已删除');
    await expect(page.locator('#modelList')).not.toContainText('待删除模型');
    expect(dialogCount).toBeGreaterThanOrEqual(2);
  });
});
