const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function initPage(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
  await page.evaluate(() => {
    if (window.app && typeof window.app.init === 'function') window.app.init();
  });
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });
}

test.describe('澄清等待恢复', () => {
  test('刷新恢复后继续等待澄清，不重复调用评审模型', async ({ page }) => {
    let modelCalls = 0;

    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.indexOf('http://mock-model.local') === 0) {
        modelCalls += 1;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ choices: [{ message: { content: '[]' } }] }),
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

    const reviewJson = JSON.stringify([{
      '类别': '需求模糊',
      '不明确的需求点': '技能触发条件表述不一致',
      '不明确原因': '触发时机未定义',
      '可能存在的分支/边界情况': '昼夜切换时是否失效',
    }], null, 2);

    await page.addInitScript((payload) => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.setItem('cleaner-models-v1', JSON.stringify([payload.model]));
        localStorage.setItem('cleaner-assignment-v1', JSON.stringify(payload.assignments));
        localStorage.setItem('usecase-workflow-state-v1', JSON.stringify(payload.snapshot));
        localStorage.setItem('tap-auto-workflow-task', JSON.stringify(payload.task));
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
      snapshot: {
        version: 1,
        user_id: '',
        updated_at: Date.now(),
        data: {
          rawText: '这是一个狼人杀技能优化需求',
          reviewResult: reviewJson,
          cleanedText: '',
          compareResult: '',
          splitResult: '',
          casesCompareResult: '',
          caseText: '测试用例文本',
          importedCases: [],
          reviewClarifications: [{ index: 0, text: '' }],
          autoCompareSuggestion: '',
          autoRequireClarifications: true,
          caseGenSource: '',
          caseGenModules: [],
          caseGenResults: {},
          caseGenSuggestions: {},
          caseGenModuleStatus: {},
          caseGenProgress: {},
          caseSelections: {},
          missingSelections: [],
        },
      },
      task: {
        id: 'auto-workflow-wait-clarify',
        kind: 'full',
        status: 'running',
        startIndex: 0,
        stepIndex: 0,
        stepKey: 'review',
        stepLabel: '需求评审',
        context: {
          awaitingClarification: true,
          awaitingClarificationAt: Date.now(),
        },
        messages: {
          workflowStart: { text: '正在执行完整工作流，请勿关闭页面', tone: '' },
          workflowSuccess: { text: '一键执行完成，可切换至“功能流程”查看详情', tone: 'ok' },
          workflowFailure: { text: '一键执行中断', tone: 'err' },
          workflowCancelled: { text: '已中断当前执行任务', tone: 'warn' },
        },
        runnerId: '',
        heartbeatAt: 0,
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    await initPage(page, base + '/ai-workflow.html?tab=auto');

    await page.waitForFunction(() => {
      var el = document.getElementById('autoClarifyStatus');
      var text = el ? String(el.textContent || '') : '';
      return text.indexOf('请补充澄清结果') !== -1;
    }, null, { timeout: 10000 });

    expect(modelCalls).toBe(0);
    await expect(page.locator('#autoNeedClarify')).toBeChecked();
  });
});
