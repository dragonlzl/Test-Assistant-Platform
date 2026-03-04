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

test.describe('一键执行评审异常自动中断', () => {
  test('需求评审返回结构异常时自动中断并提示重新执行', async ({ page }) => {
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.indexOf('http://mock-model.local') === 0) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{
              message: {
                content: 'event: response.created\ndata: {"type":"response.created"}',
              },
            }],
          }),
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

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.setItem('cleaner-models-v1', JSON.stringify([{
          id: 'mock-model',
          name: 'mock-model',
          provider: 'custom',
          baseUrl: 'http://mock-model.local/v1/chat/completions',
          apiKey: '',
          model: 'mock',
          maxTokens: 1024,
        }]));
        localStorage.setItem('cleaner-assignment-v1', JSON.stringify({
          reviewId: 'mock-model',
          cleanId: 'mock-model',
          compareId: 'mock-model',
          splitId: 'mock-model',
          casesId: 'mock-model',
          caseGenId: 'mock-model',
        }));
      } catch (_) {}
    });

    await initPage(page, base + '/ai-workflow.html?tab=auto');

    await page.evaluate(() => {
      var rawEl = document.getElementById('rawText');
      if (rawEl) rawEl.value = '这是待评审的需求文本';
      var caseText = document.getElementById('caseText');
      if (caseText) caseText.value = '- 用例标题';
      var clarify = document.getElementById('autoNeedClarify');
      if (clarify) {
        clarify.checked = true;
        clarify.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (window.app && window.app.state) {
        window.app.state.requirementLabel = '自动化需求';
        window.app.state.requirementLabelSource = 'manual';
      }
      if (window.app && typeof window.app.updateFlowStatus === 'function') {
        window.app.updateFlowStatus();
      }
    });

    await page.locator('#runAutoWorkflow').click();

    await page.waitForFunction(() => {
      var el = document.getElementById('autoWorkflowStatus');
      var text = el ? String(el.textContent || '') : '';
      return text.indexOf('需求评审结果') !== -1 && text.indexOf('请重新执行') !== -1;
    }, null, { timeout: 15000 });

    await expect(page.locator('#autoWorkflowStatus')).toContainText('需求评审结果');
    await expect(page.locator('#autoWorkflowStatus')).toContainText('请重新执行');
    await expect(page.locator('#runAutoWorkflow')).toBeEnabled();
    await expect(page.locator('#stopAutoWorkflow')).toBeDisabled();
    await expect(page.locator('#autoClarifyStatus')).not.toContainText('请补充澄清结果');
  });
});
