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
      window.localStorage.setItem('tap-e2e-skip-auth', '1');
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
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

  test('模型管理表单操作与保存状态', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    const formWrapper = page.locator('#modelFormWrapper');
    await expect(formWrapper).toHaveClass(/hidden/);
    await page.waitForSelector('#createModelBtn', { state: 'visible' });
    await page.locator('#createModelBtn').scrollIntoViewIfNeeded();
    await page.click('#createModelBtn');
    await expect(formWrapper).toBeVisible();
    await page.fill('#modelDisplayName', 'UI自动化模型');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test');
    await page.fill('#modelIdentifier', 'deepseek-test');
    await page.fill('#modelMaxTokens', '2048');
    await page.selectOption('#modelStreamMode', 'stream');
    await page.click('#saveModelBtn');
    await expect(page.locator('#modelFormStatus')).toContainText('模型已保存');
    await expect(formWrapper).toHaveClass(/hidden/);
    await expect(page.locator('#modelList')).toContainText('UI自动化模型');
    await expect(page.locator('#modelList')).toContainText('调用：流式');

    const storedModel = await page.evaluate(() => {
      const list = JSON.parse(window.localStorage.getItem('cleaner-models-v1') || '[]');
      return list[0] || null;
    });
    expect(Boolean(storedModel && storedModel.stream)).toBeTruthy();

    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', '表单重置模型');
    await page.click('#resetModelForm');
    await expect(formWrapper).toHaveClass(/hidden/);
  });
  test('XMind 鍚庡彴浠诲姟淇濈暀妯″瀷娴佸紡閰嶇疆', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      if (!window.app || !window.app.xmindCaseGenTaskManager || typeof window.app.xmindCaseGenTaskManager.createTask !== 'function') {
        return null;
      }
      const task = window.app.xmindCaseGenTaskManager.createTask({
        prompt: 'XMind prompt',
        requestMode: 'text',
        requestText: 'hello',
        model: {
          id: 'packy-xmind',
          name: 'Packy XMind',
          provider: 'custom',
          baseUrl: 'https://www.packyapi.com/v1/responses',
          apiKey: 'sk-test',
          model: 'gpt-5.4',
          maxTokens: 1024,
          stream: true,
          streamMode: 'stream',
          capabilities: ['vision'],
        },
      });
      return task && task.model ? task.model : null;
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot.stream).toBe(true);
    expect(snapshot.streamMode).toBe('stream');
  });

  test('全局设置保存与列/分页逻辑', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await page.fill('#modelTimeoutInput', '180');
    await page.click('#saveModelTimeout');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await page.fill('#feishuWebhook', 'https://example.com/hook');
    await page.fill('#feishuNotifyUser', 'ou_123456');
    await page.click('#saveFeishuWebhook');
    await expect(page.locator('#feishuWebhookStatus')).toContainText('已保存');

    const moduleCheckbox = page.locator('input[data-temp-exec-col="module"]');
    await moduleCheckbox.uncheck();
    await expect(page.locator('#tempExecColumnStatus')).toContainText('已保存');
    await moduleCheckbox.check();
    await expect(page.locator('#tempExecColumnStatus')).toContainText('已保存');

    await page.fill('#tempExecPageSizeInput', '25');
    await page.click('#saveTempExecPageSize');
    await expect(page.locator('#tempExecPageSizeStatus')).toContainText(/已更新|分页设置已是每页/);
  });

  test('模型缺失提示与 deepseek token 推荐提醒', async ({ page }) => {
    const modelsTab = page.locator('[data-tab-btn="models"]');
    const assignTab = page.locator('[data-tab-btn="assign"]');
    await expect(modelsTab.locator('.tab-notice')).toContainText('未配置模型');
    await expect(assignTab.locator('.tab-notice')).toContainText('未配置模型');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', 'Reasoner 模型');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test');
    await page.fill('#modelIdentifier', 'deepseek-reasoner');
    await page.fill('#modelMaxTokens', '1024');
    await page.click('#saveModelBtn');
    await expect(page.locator('#modelFormStatus')).toContainText('模型已保存');
    await expect(modelsTab.locator('.tab-notice')).toHaveCount(0);
    await expect(assignTab.locator('.tab-notice')).toContainText('未保存指派模型');

    const tokenHint = page.locator('#deepseekTokenHint');
    await expect(tokenHint).toBeVisible();
    await expect(tokenHint).toContainText('1024');
    await tokenHint.click();
    await expect(page.locator('#modelFormWrapper')).not.toHaveClass(/hidden/);
    await expect(page.locator('#modelIdentifier')).toHaveValue(/deepseek-reasoner/);
    await page.fill('#modelMaxTokens', '20000');
    await page.click('#saveModelBtn');
    await expect(tokenHint).toHaveClass(/hidden/);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
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

  test('功能指派页的用例生成默认提示词使用最新基础文案', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    const caseGenPrompt = page.locator('#caseGenPrompt');
    const xmindCaseGenPrompt = page.locator('#xmindCaseGenPrompt');
    const caseLibraryGenPrompt = page.locator('#caseLibraryGenPrompt');
    await expect(caseGenPrompt).toHaveValue(/你是资深游戏测试工程师，善于用例设计。/);
    await expect(caseGenPrompt).toHaveValue(/优先生成需求主流程的核心用例/);
    await expect(caseGenPrompt).toHaveValue(/前提条件preconditions，如果有多条，则需要以1、2、3的形式分步展示。/);
    await expect(caseGenPrompt).toHaveValue(/操作步骤steps，如果有多条，需要以1、2、3的形式分步展示。/);
    await expect(caseGenPrompt).toHaveValue(/AI_CASE_WRITING_STYLE_GUIDE\.md/);
    await expect(caseGenPrompt).toHaveValue(/title 写短检查点/);
    await expect(caseGenPrompt).toHaveValue(/priority 只能填写 P0、P1、P2/);
    await expect(xmindCaseGenPrompt).toHaveValue(/AI_CASE_WRITING_STYLE_GUIDE\.md/);
    await expect(xmindCaseGenPrompt).toHaveValue(/title 写短检查点/);
    await expect(caseLibraryGenPrompt).toHaveValue(/AI_CASE_WRITING_STYLE_GUIDE\.md/);
    await expect(caseLibraryGenPrompt).toHaveValue(/title 写短检查点/);
  });

  test('功能指派页点击保存指派后显示 3 秒悬浮提示', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', '保存提示模型');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test');
    await page.fill('#modelIdentifier', 'deepseek-chat');
    await page.fill('#modelMaxTokens', '1024');
    await page.click('#saveModelBtn');

    const modelId = await page.evaluate(() => {
      const models = JSON.parse(window.localStorage.getItem('cleaner-models-v1') || '[]');
      return models[0]?.id || '';
    });

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    await expect(page.locator('#saveAssignmentsTop')).toBeVisible();

    const toast = page.locator('.temp-center-toast.ok', { hasText: '指派已保存' });
    await page.click('#saveAssignmentsTop');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 5000 });

    await page.selectOption('#cleanModelSelect', modelId);
    await expect(page.locator('.temp-center-toast', { hasText: '指派已保存' })).toHaveCount(0);

    await page.locator('#saveAssignments').scrollIntoViewIfNeeded();
    await page.click('#saveAssignments');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 5000 });
  });

  test('未指派提示点击页签自动定位到保存按钮', async ({ page }) => {
    const assignTab = page.locator('[data-tab-btn="assign"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', '定位测试模型');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test');
    await page.fill('#modelIdentifier', 'deepseek-chat');
    await page.fill('#modelMaxTokens', '1024');
    await page.click('#saveModelBtn');
    await expect(assignTab.locator('.tab-notice')).toContainText('未保存指派模型');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    await page.waitForTimeout(300);
    const topBtn = page.locator('#saveAssignmentsTop');
    await expect(topBtn).toBeVisible();
    const topPos = await topBtn.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top;
    });
    expect(topPos).toBeLessThan(320);
  });

  test('已保存指派后刷新仍不提示缺失', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
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
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
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

  test('功能指派切换模型后立即生效并持久化（无需点击保存指派）', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });

    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', '自动保存模型A');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test-a');
    await page.fill('#modelIdentifier', 'deepseek-chat-a');
    await page.click('#saveModelBtn');

    await page.click('#createModelBtn');
    await page.fill('#modelDisplayName', '自动保存模型B');
    await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
    await page.fill('#modelApiKey', 'sk-test-b');
    await page.fill('#modelIdentifier', 'deepseek-chat-b');
    await page.click('#saveModelBtn');

    const modelIds = await page.evaluate(() => {
      const list = JSON.parse(window.localStorage.getItem('cleaner-models-v1') || '[]');
      return list.map((item) => item && item.id ? String(item.id) : '').filter(Boolean);
    });
    expect(modelIds.length).toBeGreaterThanOrEqual(2);
    const targetModelId = modelIds[1];

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    await page.selectOption('#cleanModelSelect', targetModelId);
    await expect(page.locator('#cleanModelSelect')).toHaveValue(targetModelId);

    const assignment = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-assignment-v1') || '{}'));
    expect(String(assignment.cleanId || '')).toBe(targetModelId);
    await expect(page.locator('[data-tab-btn="assign"]').locator('.tab-notice')).toHaveCount(0);

    const storedModels = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-models-v1') || '[]'));
    const storedAssignments = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-assignment-v1') || '{}'));
    await page.addInitScript(({ models, assignments }) => {
      window.localStorage.setItem('cleaner-models-v1', JSON.stringify(models || []));
      window.localStorage.setItem('cleaner-assignment-v1', JSON.stringify(assignments || {}));
    }, { models: storedModels, assignments: storedAssignments });

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
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
      if (window.app && window.app.switchTab) window.app.switchTab('assign');
    });

    await expect(page.locator('#cleanModelSelect')).toHaveValue(targetModelId);
    await expect(page.locator('[data-tab-btn="assign"]').locator('.tab-notice')).toHaveCount(0);
  });
});
