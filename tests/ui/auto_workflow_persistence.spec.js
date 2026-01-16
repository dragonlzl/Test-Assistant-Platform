const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function gotoWithRetry(page, url) {
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(url);
      return;
    } catch (err) {
      lastErr = err;
      const msg = err && err.message ? String(err.message) : String(err || '');
      const canRetry = msg.indexOf('ERR_EMPTY_RESPONSE') !== -1 || msg.indexOf('net::ERR_EMPTY_RESPONSE') !== -1;
      if (!canRetry || i === 2) throw err;
      await page.waitForTimeout(300);
    }
  }
  throw lastErr || new Error('page.goto failed');
}

test.describe('一键执行跨页面不中断', () => {
  test('切换页面后自动流程继续执行', async ({ page }) => {
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
        let content = '';
        if (userPrompt.indexOf('仅针对以下单个模块进行覆盖对比') !== -1) {
          content = '{"coverage":100,"missing":[],"extra":[]}';
        } else if (userPrompt.indexOf('原始需求：') !== -1 && userPrompt.indexOf('清洗后的需求：') !== -1) {
          content = '{"coverage":100,"missing":[]}';
        } else if (userPrompt.indexOf('【原始需求】') !== -1) {
          content = '[{"功能":"登录","类别":"核心","功能描述":{"重新整理内容":"用户登录流程","功能目标":[],"规则":[],"约束":[],"流程":[]},"原始需求描述":["用户登录"]}]';
        } else if (systemPrompt.indexOf('拆分') !== -1 || systemPrompt.indexOf('测试模块') !== -1) {
          content = '[{"module":"登录","key_scenarios":["场景1"],"test_points":["要点1"],"coupled_modules":[]}]';
        } else {
          content = '[{"问题":"描述可能存在歧义"}]';
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ choices: [{ message: { content } }] }),
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

    await page.addInitScript((payload) => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.setItem('cleaner-models-v1', JSON.stringify([payload.model]));
        localStorage.setItem('cleaner-assignment-v1', JSON.stringify(payload.assignments));
      } catch (_) {}
    }, {
      model: {
        id: 'mock-model',
        name: 'mock',
        provider: 'custom',
        baseUrl: 'http://mock-model.local/v1/chat/completions',
        apiKey: '',
        model: 'mock',
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

    await gotoWithRetry(page, base + '/ai-workflow.html?tab=auto');
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => { if (window.app && typeof window.app.init === 'function') window.app.init(); });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });

    await page.evaluate((payload) => {
      if (window.app && window.app.state) {
        window.app.state.models = [payload.model];
        if (!window.app.state.assignments) window.app.state.assignments = {};
        window.app.state.assignments.cleanId = payload.model.id;
        window.app.state.assignments.reviewId = payload.model.id;
        window.app.state.assignments.compareId = payload.model.id;
        window.app.state.assignments.splitId = payload.model.id;
        window.app.state.assignments.casesId = payload.model.id;
        window.app.state.assignments.caseGenId = payload.model.id;
        window.app.state.autoRequireClarifications = false;
      }
      var clarifyToggle = document.getElementById('autoNeedClarify');
      if (clarifyToggle) {
        clarifyToggle.checked = false;
        clarifyToggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var raw = document.getElementById('rawText');
      if (raw) {
        raw.value = '用户登录需求';
        raw.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var cases = document.getElementById('caseText');
      if (cases) {
        cases.value = '用例：登录成功/失败';
        cases.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
    }, { model: {
      id: 'mock-model',
      name: 'mock',
      provider: 'custom',
      baseUrl: 'http://mock-model.local/v1/chat/completions',
      apiKey: '',
      model: 'mock',
      maxTokens: 1024,
    } });

    await page.click('#runAutoWorkflow');
    await expect(page.locator('#autoWorkflowStatus')).toContainText('正在执行', { timeout: 5000 });

    await gotoWithRetry(page, base + '/settings.html?tab=settings');
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => { if (window.app && typeof window.app.init === 'function') window.app.init(); });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });

    await page.waitForFunction(() => {
      try {
        var raw = localStorage.getItem('tap-auto-workflow-task') || '';
        var task = raw ? JSON.parse(raw) : null;
        return task && (task.status === 'running' || task.status === 'done');
      } catch (_) {
        return false;
      }
    }, null, { timeout: 20000 });

    await gotoWithRetry(page, base + '/ai-workflow.html?tab=auto');
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => { if (window.app && typeof window.app.init === 'function') window.app.init(); });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });

    await expect(page.locator('#autoWorkflowStatus')).toContainText('一键执行完成', { timeout: 20000 });
  });
});
