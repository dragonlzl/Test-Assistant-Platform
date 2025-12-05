const { test, expect } = require('@playwright/test');

test.describe('模型管理与全局设置', () => {
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
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('模型管理表单操作与保存状态', async ({ page }) => {
    await page.click('[data-tab-btn="models"]');
    const formWrapper = page.locator('#modelFormWrapper');
    await expect(formWrapper).toHaveClass(/hidden/);
    await page.click('#createModelBtn');
    await expect(formWrapper).not.toHaveClass(/hidden/);
    await page.fill('#modelDisplayName', 'UI自动化模型');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test');
    await page.fill('#modelIdentifier', 'deepseek-test');
    await page.fill('#modelMaxTokens', '2048');
    await page.click('#saveModelBtn');
    await expect(page.locator('#modelFormStatus')).toContainText('模型已保存');
    await expect(formWrapper).toHaveClass(/hidden/);
    await expect(page.locator('#modelList')).toContainText('UI自动化模型');

    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', '表单重置模型');
    await page.click('#resetModelForm');
    await expect(formWrapper).toHaveClass(/hidden/);
  });

  test('全局设置保存与列/分页逻辑', async ({ page }) => {
    await page.click('[data-tab-btn="models"]');
    await page.fill('#modelTimeoutInput', '180');
    await page.click('#saveModelTimeout');
    await expect(page.locator('#modelTimeoutStatus')).toContainText('已更新');

    await page.click('[data-tab-btn="settings"]');
    await page.fill('#feishuWebhook', 'https://example.com/hook');
    await page.fill('#feishuNotifyUser', 'ou_123456');
    await page.click('#saveFeishuWebhook');
    await expect(page.locator('#feishuWebhookStatus')).toContainText('已保存');

    const moduleCheckbox = page.locator('input[data-temp-exec-col="module"]');
    const stepsCheckbox = page.locator('input[data-temp-exec-col="steps"]');
    await moduleCheckbox.check();
    await stepsCheckbox.check();
    await page.click('#saveTempExecColumns');
    await expect(page.locator('#tempExecColumnStatus')).toContainText('已保存');

    await page.fill('#tempExecPageSizeInput', '25');
    await page.click('#saveTempExecPageSize');
    await expect(page.locator('#tempExecPageSizeStatus')).toContainText('已更新');
  });

  test('模型缺失提示与 deepseek token 推荐提醒', async ({ page }) => {
    const modelsTab = page.locator('[data-tab-btn="models"]');
    const assignTab = page.locator('[data-tab-btn="assign"]');
    await expect(modelsTab.locator('.tab-notice')).toContainText('未配置模型');
    await expect(assignTab.locator('.tab-notice')).toContainText('未配置模型');

    await page.click('[data-tab-btn="models"]');
    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', 'Reasoner 模型');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test');
    await page.fill('#modelIdentifier', 'deepseek-reasoner');
    await page.fill('#modelMaxTokens', '1024');
    await page.click('#saveModelBtn');
    await expect(page.locator('#modelFormStatus')).toContainText('模型已保存');
    await expect(modelsTab.locator('.tab-notice')).toHaveCount(0);
    await expect(assignTab.locator('.tab-notice')).toContainText('未指派模型');

    const tokenHint = page.locator('#deepseekTokenHint');
    await expect(tokenHint).toBeVisible();
    await expect(tokenHint).toContainText('1024');
    await tokenHint.click();
    await expect(page.locator('#modelFormWrapper')).not.toHaveClass(/hidden/);
    await expect(page.locator('#modelIdentifier')).toHaveValue(/deepseek-reasoner/);
    await page.fill('#modelMaxTokens', '20000');
    await page.click('#saveModelBtn');
    await expect(tokenHint).toHaveClass(/hidden/);

    await page.click('[data-tab-btn="assign"]');
    await expect(page.locator('#cleanTemperature')).toHaveValue('0.2');
    await expect(page.locator('#compareTemperature')).toHaveValue('0.2');
    await page.fill('#cleanTemperature', '0.6');
    await page.fill('#compareTemperature', '0.3');
    const modelId = await page.evaluate(() => {
      const models = JSON.parse(window.localStorage.getItem('cleaner-models-v1') || '[]');
      return models[0]?.id || '';
    });
    const selects = ['cleanModelSelect', 'reviewModelSelect', 'compareModelSelect', 'splitModelSelect', 'casesModelSelect', 'caseGenModelSelect'];
    for (const sel of selects) {
      await page.selectOption(`#${sel}`, modelId);
    }
    await page.click('#saveAssignments');
    await expect(assignTab.locator('.tab-notice')).toHaveCount(0);
    const assignment = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-assignment-v1') || '{}'));
    expect(assignment.cleanTemperature).toBeCloseTo(0.6);
    expect(assignment.compareTemperature).toBeCloseTo(0.3);

  });

  test('已保存指派后刷新仍不提示缺失', async ({ page }) => {
    await page.click('[data-tab-btn="models"]');
    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', '重载校验模型');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test');
    await page.fill('#modelIdentifier', 'deepseek-chat');
    await page.fill('#modelMaxTokens', '2048');
    await page.click('#saveModelBtn');
    const modelId = await page.evaluate(() => {
      const models = JSON.parse(window.localStorage.getItem('cleaner-models-v1') || '[]');
      return models[0]?.id || '';
    });
    await page.click('[data-tab-btn="assign"]');
    const selectIds = ['cleanModelSelect', 'reviewModelSelect', 'compareModelSelect', 'splitModelSelect', 'casesModelSelect', 'caseGenModelSelect'];
    for (const sel of selectIds) {
      await page.selectOption(`#${sel}`, modelId);
    }
    await page.click('#saveAssignments');
    await expect(page.locator('[data-tab-btn="assign"]').locator('.tab-notice')).toHaveCount(0);

    const storedModels = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-models-v1') || '[]'));
    const storedAssignments = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-assignment-v1') || '{}'));
    await page.addInitScript(({ models, assignments }) => {
      window.localStorage.setItem('cleaner-models-v1', JSON.stringify(models || []));
      window.localStorage.setItem('cleaner-assignment-v1', JSON.stringify(assignments || {}));
    }, { models: storedModels, assignments: storedAssignments });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await expect(page.locator('[data-tab-btn="assign"]').locator('.tab-notice')).toHaveCount(0);
  });
});
