const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });
}

async function setupRoutes(page, splitPayloads, options) {
  const opts = options || {};
  const compareCoverageResponse = typeof opts.compareCoverageResponse === 'string'
    ? opts.compareCoverageResponse
    : '{"coverage":100,"missing":[]}';
  const user = { id: 301, username: 'auto_case_assistant_user', role: 'admin', level: 'leader' };
  const settingsStore = [];

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.indexOf('http://mock-model.local') === 0) {
      var postData = route.request().postData() || '';
      var parsed = {};
      try {
        parsed = JSON.parse(postData || '{}') || {};
      } catch (_) {
        parsed = {};
      }
      var messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      var systemPrompt = messages[0] && messages[0].content ? String(messages[0].content) : '';
      var userPrompt = messages[1] && messages[1].content ? String(messages[1].content) : '';
      var content = '';
      if (userPrompt.indexOf('仅针对以下单个模块进行覆盖对比') !== -1) {
        content = '{"coverage":100,"missing":[],"extra":[]}';
      } else if (userPrompt.indexOf('原始需求：') !== -1 && userPrompt.indexOf('清洗后的需求：') !== -1) {
        content = compareCoverageResponse;
      } else if (userPrompt.indexOf('【原始需求】') !== -1) {
        content = '[{"功能":"登录","类别":"核心","功能描述":{"重新整理内容":"用户登录流程","功能目标":[],"规则":[],"约束":[],"流程":[]},"原始需求描述":["用户登录"]}]';
      } else if (systemPrompt.indexOf('拆分') !== -1 || systemPrompt.indexOf('测试模块') !== -1) {
        splitPayloads.push(userPrompt);
        content = '[{"module":"登录","key_scenarios":["登录成功"],"test_points":["账号密码校验"],"coupled_modules":[]}]';
      } else {
        content = '[]';
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: content } }] }),
      });
    }
    if (
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('file:') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('about:')
    ) {
      return route.continue();
    }
    return route.abort();
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/users/me' && method === 'GET') return respond(200, user);
    if (path === '/api/settings' && method === 'GET') return respond(200, settingsStore);
    if (path === '/api/settings' && method === 'PUT') {
      const body = route.request().postDataJSON() || {};
      const items = Array.isArray(body.items) ? body.items : [];
      const saved = [];
      items.forEach((item, idx) => {
        if (!item || !item.key) return;
        var existing = settingsStore.find((row) => row.key === item.key && row.scope === 'user' && row.owner_id === user.id);
        if (existing) {
          existing.value_json = item.value_json;
          saved.push(existing);
          return;
        }
        var next = {
          id: settingsStore.length + idx + 1,
          scope: 'user',
          owner_id: user.id,
          key: item.key,
          value_json: item.value_json,
          updated_at: new Date().toISOString(),
        };
        settingsStore.push(next);
        saved.push(next);
      });
      return respond(200, saved);
    }
    if (path === '/api/projects' && method === 'GET') return respond(200, []);
    if (path.indexOf('/api/projects/') === 0 && path.indexOf('/versions') !== -1 && method === 'GET') return respond(200, []);
    if (path === '/api/case-files' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') return respond(200, []);
    if (path === '/api/features' && method === 'GET') return respond(200, []);
    return respond(200, method === 'GET' ? [] : {});
  });
}

async function bootstrap(page, options) {
  const opts = options || {};
  await page.addInitScript((payload) => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.setItem('cleaner-models-v1', JSON.stringify([payload.model]));
      localStorage.setItem('cleaner-assignment-v1', JSON.stringify(payload.assignments));
      localStorage.removeItem('tap-auto-workflow-task');
      sessionStorage.setItem('tap_bootstrap_reload_retry', '2');
    } catch (_) {}
    window.__caseAssistantCalls = [];
    if (payload.enableElectron === true) {
      window.electronAPI = {
        invokeChannel: function(channel, requestPayload) {
          window.__caseAssistantCalls.push({ channel: channel, payload: requestPayload });
          return Promise.resolve({
            status: true,
            msg: 'ok',
            data: payload.caseAssistantResponseText,
          });
        },
      };
    } else {
      try {
        delete window.electronAPI;
      } catch (_) {
        window.electronAPI = undefined;
      }
    }
  }, {
    enableElectron: opts.enableElectron === true,
    caseAssistantResponseText: opts.caseAssistantResponseText || '',
    model: {
      id: 'mock-model',
      name: 'mock-model',
      provider: 'custom',
      baseUrl: 'http://mock-model.local/v1/chat/completions',
      apiKey: 'mock-key',
      model: 'mock-model',
      maxTokens: 1024,
    },
    assignments: {
      cleanId: 'mock-model',
      reviewId: 'mock-model',
      compareId: 'mock-model',
      splitId: 'mock-model',
      casesId: 'mock-model',
      caseGenId: 'mock-model',
      cleanPrompt: '',
      reviewPrompt: '',
      comparePrompt: '',
      splitPrompt: '',
      casesPrompt: '',
      caseGenPrompt: '',
      cleanReasoning: '',
      reviewReasoning: '',
      compareReasoning: '',
      splitReasoning: '',
      casesReasoning: '',
      caseGenReasoning: '',
    },
  });
}

async function runWorkflow(page) {
  await page.goto(base + '/ai-workflow.html?tab=auto');
  await page.waitForLoadState('domcontentloaded');
  await waitForAppReady(page);
  await page.evaluate(() => {
    if (window.app && window.app.state) {
      window.app.state.autoRequireClarifications = false;
    }
    var clarifyToggle = document.getElementById('autoNeedClarify');
    if (clarifyToggle) {
      clarifyToggle.checked = false;
      clarifyToggle.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  const values = await page.evaluate(() => {
    var raw = document.getElementById('rawText');
    var caseText = document.getElementById('caseText');
    if (raw) {
      raw.value = '用户登录需求';
      raw.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (caseText) {
      caseText.value = '登录成功与失败用例';
      caseText.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return {
      raw: raw ? raw.value : '',
      caseText: caseText ? caseText.value : '',
    };
  });
  expect(values.raw).toContain('用户登录需求');
  expect(values.caseText).toContain('登录成功与失败用例');
  await page.click('#runAutoWorkflow');
  await expect(page.locator('#autoWorkflowStatus')).toContainText('一键执行完成', { timeout: 30000 });
}

async function runManualCompareAndSplit(page) {
  await page.goto(base + '/ai-workflow.html?tab=clean');
  await page.waitForLoadState('domcontentloaded');
  await waitForAppReady(page);
  await page.evaluate(() => {
    var raw = document.getElementById('rawText');
    if (raw) {
      raw.value = '用户登录需求';
      raw.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.click('#runClean');
  await expect(page.locator('#cleanStatus')).toContainText('清洗完成');
  await page.click('#compareBtn');
  await expect(page.locator('#compareStatus')).toContainText('对比完成');
  await page.click('#splitBtn');
  await expect(page.locator('#splitStatus')).toContainText('拆分完成');
}

test.describe('一键执行 Case Assistant 衔接', () => {
  test('Electron 可用且路径合法时，在对比后调用 Case Assistant 并用于拆分', async ({ page }) => {
    const splitPayloads = [];
    await setupRoutes(page, splitPayloads);
    await bootstrap(page, {
      enableElectron: true,
      caseAssistantResponseText: '【CaseAssistant整合需求】登录功能包含账号校验、异常提示与状态同步规则。',
    });

    await page.goto(base + '/settings.html?tab=settings');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await page.fill('#caseAssistantProjectRoot', 'E://workspace//case-assistant-demo');
    await page.click('#saveCaseAssistantProjectRoot');
    await expect(page.locator('#caseAssistantProjectRootStatus')).toContainText('已保存');

    await runWorkflow(page);

    const calls = await page.evaluate(() => window.__caseAssistantCalls || []);
    expect(calls.length).toBe(1);
    expect(calls[0].channel).toBe('case-assistant:request');
    expect(calls[0].payload.projectRoot).toBe('E://workspace//case-assistant-demo');

    expect(splitPayloads.length).toBeGreaterThan(0);
    const finalSplitPayload = splitPayloads[splitPayloads.length - 1];
    expect(finalSplitPayload).toContain('CaseAssistant整合需求');
  });

  test('路径为空或不合法时，不调用 Case Assistant 且流程继续', async ({ page }) => {
    const splitPayloads = [];
    await setupRoutes(page, splitPayloads);
    await bootstrap(page, {
      enableElectron: true,
      caseAssistantResponseText: '【CaseAssistant整合需求】不应出现',
    });

    await page.goto(base + '/settings.html?tab=settings');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await page.fill('#caseAssistantProjectRoot', 'relative/path/not-valid');
    await page.click('#saveCaseAssistantProjectRoot');
    await expect(page.locator('#caseAssistantProjectRootStatus')).toContainText('已保存');

    await runWorkflow(page);

    const calls = await page.evaluate(() => window.__caseAssistantCalls || []);
    expect(calls.length).toBe(0);

    expect(splitPayloads.length).toBeGreaterThan(0);
    const finalSplitPayload = splitPayloads[splitPayloads.length - 1];
    expect(finalSplitPayload).toContain('用户登录流程');
    expect(finalSplitPayload).not.toContain('CaseAssistant整合需求');
  });

  test('手动点击对比后也会触发 Case Assistant，且拆分消费其结果', async ({ page }) => {
    const splitPayloads = [];
    await setupRoutes(page, splitPayloads, {
      compareCoverageResponse: '{"coverage":82,"missing":["缺少异常流程"]}',
    });
    await bootstrap(page, {
      enableElectron: true,
      caseAssistantResponseText: '【CaseAssistant整合需求】手动对比后补齐了异常提示、状态回滚与权限前置条件。',
    });

    await page.goto(base + '/settings.html?tab=settings');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await page.fill('#caseAssistantProjectRoot', 'E://workspace//case-assistant-demo');
    await page.click('#saveCaseAssistantProjectRoot');
    await expect(page.locator('#caseAssistantProjectRootStatus')).toContainText('已保存');

    await runManualCompareAndSplit(page);

    const calls = await page.evaluate(() => window.__caseAssistantCalls || []);
    expect(calls.length).toBe(1);
    expect(calls[0].channel).toBe('case-assistant:request');

    expect(splitPayloads.length).toBeGreaterThan(0);
    const finalSplitPayload = splitPayloads[splitPayloads.length - 1];
    expect(finalSplitPayload).toContain('CaseAssistant整合需求');
  });
});
