const { test, expect } = require('@playwright/test');

test.describe('模型管理与保留设置', () => {
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

  test('编辑模型时表单在对应模型下方原地展开', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('models'); });
    const createModel = async (name, key) => {
      await page.click('#createModelBtn');
      await page.fill('#modelDisplayName', name);
      await page.fill('#modelBaseUrl', 'https://example.com/v1/chat');
      await page.fill('#modelApiKey', key);
      await page.fill('#modelIdentifier', 'deepseek-chat');
      await page.click('#saveModelBtn');
    };
    await createModel('原地编辑模型 A', 'sk-a');
    await createModel('原地编辑模型 B', 'sk-b');

    const cards = page.locator('#modelList > .model-card[data-id]');
    await cards.nth(1).locator('[data-edit]').click();
    await expect(page.locator('#modelFormTitle')).toHaveText('编辑模型：原地编辑模型 B');
    await expect(page.locator('#modelDisplayName')).toHaveValue('原地编辑模型 B');
    await expect(cards.nth(1).locator('+ #modelFormWrapper')).toBeVisible();
    await expect(page.locator('#modelFormWrapper')).toHaveCount(1);

    await cards.nth(0).locator('[data-edit]').click();
    await expect(page.locator('#modelDisplayName')).toHaveValue('原地编辑模型 A');
    await expect(cards.nth(0).locator('+ #modelFormWrapper')).toBeVisible();
    await expect(cards.nth(1).locator('+ #modelFormWrapper')).toHaveCount(0);
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
    await expect(page.locator('#feishuWebhook')).toHaveCount(0);

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
    await expect(page.locator('#xmindCaseGenTemperature')).toHaveValue('0.2');
    await expect(page.locator('#caseLibraryGenTemperature')).toHaveValue('0.2');
    await page.fill('#xmindCaseGenTemperature', '0.6');
    await page.fill('#caseLibraryGenTemperature', '0.3');
    const modelId = await page.evaluate(() => {
      const models = JSON.parse(window.localStorage.getItem('cleaner-models-v1') || '[]');
      return models[0] && models[0].id ? models[0].id : '';
    });
    const selects = ['xmindCaseGenModelSelect', 'caseFilterModelSelect', 'missingReminderModelSelect', 'caseLibraryGenModelSelect'];
    for (const sel of selects) {
      await page.selectOption(`#${sel}`, modelId);
    }
    await page.locator('.assignment-feature-actions [data-save-assignments]').first().click();
    await expect(assignTab.locator('.tab-notice')).toHaveCount(0);
    const assignment = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-assignment-v1') || '{}'));
    expect(assignment.xmindCaseGenTemperature).toBeCloseTo(0.6);
    expect(assignment.caseLibraryGenTemperature).toBeCloseTo(0.3);

  });

  test('功能指派页只展示保留能力并使用最新基础文案', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    const xmindCaseGenPrompt = page.locator('#xmindCaseGenPrompt');
    const caseLibraryGenPrompt = page.locator('#caseLibraryGenPrompt');
    await expect(page.locator('#cleanModelSelect')).toHaveCount(0);
    await expect(page.locator('#reviewModelSelect')).toHaveCount(0);
    await expect(page.locator('#compareModelSelect')).toHaveCount(0);
    await expect(page.locator('#splitModelSelect')).toHaveCount(0);
    await expect(page.locator('#caseGenModelSelect')).toHaveCount(0);
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

    await page.selectOption('#xmindCaseGenModelSelect', modelId);
    await expect(page.locator('.temp-center-toast', { hasText: '指派已保存' })).toHaveCount(0);

    const featureSaveBtn = page.locator('.assignment-feature-actions [data-save-assignments]').first();
    await featureSaveBtn.scrollIntoViewIfNeeded();
    await featureSaveBtn.click();
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 5000 });
  });

  test('功能指派使用分类导航和独立分区布局', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });

    const assignmentNav = page.locator('#assignmentHead [data-assignment-target]');
    const assignmentSections = page.locator('[data-assignment-section]');
    await expect(page.locator('#assignmentHead')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/assignment-layout-active/);
    await expect(assignmentNav).toHaveCount(5);
    await expect(assignmentSections).toHaveCount(5);
    await expect(page.locator('#assignmentHead .nav-entry-icon svg')).toHaveCount(5);

    await page.click('#assignmentNavMissingBtn');
    await expect(page.locator('#assignmentNavMissingBtn')).toHaveAttribute('aria-current', 'page');
    await expect.poll(async () => {
      return page.locator('#assignmentMissingSection').evaluate((section) => section.getBoundingClientRect().top);
    }).toBeLessThan(360);

    await page.setViewportSize({ width: 720, height: 720 });
    const narrowMetrics = await page.evaluate(() => {
      const head = document.getElementById('assignmentHead');
      const nav = head ? head.querySelector('.assignment-nav-grid') : null;
      return {
        headHeight: head ? head.getBoundingClientRect().height : 0,
        navDirection: nav ? window.getComputedStyle(nav).flexDirection : '',
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(narrowMetrics.headHeight).toBeLessThan(90);
    expect(narrowMetrics.navDirection).toBe('row');
    expect(narrowMetrics.overflow).toBeLessThanOrEqual(1);
  });

  test('每个功能区都可保存整页指派', async ({ page }) => {
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('assign'); });
    const featureCards = page.locator('[data-tab-section="assign"] .model-card').filter({
      has: page.locator('textarea.small-textarea')
    });
    await expect(featureCards).toHaveCount(4);
    await expect(featureCards.locator('[data-save-assignments]')).toHaveCount(4);
    await expect(page.locator('#saveAssignments')).toHaveCount(0);
    const globalConfirmBtn = page.locator('#applyGlobalAssignBtn');
    const featureSaveBtn = featureCards.first().locator('[data-save-assignments]');
    await expect(page.locator('#globalAssignModelSelect + #applyGlobalAssignBtn')).toHaveCount(0);
    await expect(page.locator('.assignment-feature-actions #applyGlobalAssignBtn')).toBeVisible();
    const globalConfirmBox = await globalConfirmBtn.boundingBox();
    const featureSaveBox = await featureSaveBtn.boundingBox();
    expect(globalConfirmBox && featureSaveBox).toBeTruthy();
    expect(globalConfirmBox.width).toBe(featureSaveBox.width);
    expect(globalConfirmBox.height).toBe(featureSaveBox.height);
    const buttonBackgrounds = await page.evaluate(() => {
      const confirmBtn = document.getElementById('applyGlobalAssignBtn');
      const saveBtn = document.querySelector('.assignment-feature-actions [data-save-assignments]');
      return [window.getComputedStyle(confirmBtn).backgroundColor, window.getComputedStyle(saveBtn).backgroundColor];
    });
    expect(buttonBackgrounds[0]).toBe(buttonBackgrounds[1]);
    await globalConfirmBtn.click();
    await expect(page.locator('#globalAssignStatus')).toContainText('请先选择一个模型');
    for (let index = 0; index < 4; index += 1) {
      const buttons = featureCards.nth(index).locator('.assignment-feature-actions button');
      const testButtonBox = await buttons.nth(0).boundingBox();
      const saveButtonBox = await buttons.nth(1).boundingBox();
      expect(testButtonBox && saveButtonBox).toBeTruthy();
      expect(testButtonBox.width).toBe(saveButtonBox.width);
      expect(testButtonBox.height).toBe(saveButtonBox.height);
    }

    await page.fill('#xmindCaseGenPrompt', '来自卡片按钮的全量保存');
    await page.fill('#caseLibraryGenTemperature', '0.7');
    await featureCards.nth(2).locator('[data-save-assignments]').click();
    await expect(page.locator('.temp-center-toast.ok', { hasText: '指派已保存' })).toBeVisible();

    const assignment = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-assignment-v1') || '{}'));
    expect(assignment.xmindCaseGenPrompt).toBe('来自卡片按钮的全量保存');
    expect(assignment.caseLibraryGenTemperature).toBeCloseTo(0.7);
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
    const selectIds = ['xmindCaseGenModelSelect', 'caseFilterModelSelect', 'missingReminderModelSelect', 'caseLibraryGenModelSelect'];
    for (const sel of selectIds) {
      await page.selectOption(`#${sel}`, modelId);
    }
    await page.locator('.assignment-feature-actions [data-save-assignments]').first().click();
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
    await page.selectOption('#xmindCaseGenModelSelect', targetModelId);
    await expect(page.locator('#xmindCaseGenModelSelect')).toHaveValue(targetModelId);

    const assignment = await page.evaluate(() => JSON.parse(window.localStorage.getItem('cleaner-assignment-v1') || '{}'));
    expect(String(assignment.xmindCaseGenId || '')).toBe(targetModelId);
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

    await expect(page.locator('#xmindCaseGenModelSelect')).toHaveValue(targetModelId);
    await expect(page.locator('[data-tab-btn="assign"]').locator('.tab-notice')).toHaveCount(0);
  });
});
