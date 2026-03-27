const { test, expect } = require('@playwright/test');

test.describe('对比完整性触发 Case Assistant', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
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

    await page.route('**/mock-model', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: '{"coverage":100,"missing":[]}',
              },
            },
          ],
        }),
      });
    });

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
      } catch (_) {}
      window.__electronCalls = [];
      window.__electronInvokeDelayMs = 0;
      window.electronAPI = {
        invokeChannel: function(channel, payload) {
          window.__electronCalls.push({ channel: channel, payload: payload });
          var delay = Number(window.__electronInvokeDelayMs || 0);
          return new Promise(function(resolve) {
            setTimeout(function() {
              resolve({
                status: true,
                msg: 'ok',
                data: '补全后的完整需求文案（由代码实现与预期需求合并）',
              });
            }, delay > 0 ? delay : 0);
          });
        },
      };
    });

    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => {
      if (window.app && typeof window.app.init === 'function') window.app.init();
    });
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 60000 });
  });

  async function prepareCompareInputs(page, projectRootPath) {
    await page.evaluate((path) => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('clean');
      }
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state) return;
      state.models = [
        {
          id: 'mock-compare-model',
          name: 'Mock Compare',
          provider: 'custom',
          baseUrl: '/mock-model',
          apiKey: 'mock-key',
          model: 'mock-model',
          maxTokens: 1024,
        },
      ];
      state.assignments = state.assignments || {};
      state.assignments.compareId = 'mock-compare-model';
      state.assignments.comparePrompt = '你是需求覆盖率审查专家，请输出 JSON：{coverage: number, missing: []}';
      state.settings = state.settings || {};
      state.settings.caseAssistantProjectRoot = path;

      var raw = document.getElementById('rawText');
      if (raw) {
        raw.value = '原始需求：点击入口按钮后弹出奖励弹窗，展示奖励标题与确认按钮。';
        raw.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var cleaned = document.getElementById('cleanedText');
      if (cleaned) {
        cleaned.value = '[{"功能":"奖励弹窗","功能描述":{"重新整理内容":"点击入口按钮后弹出奖励弹窗，含标题和确认按钮。"}}]';
        cleaned.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, projectRootPath);
  }

  test('手动点击对比后触发 Electron 接口并回写需求文案', async ({ page }) => {
    await prepareCompareInputs(page, 'E:/workspace/demo-project');
    await page.evaluate(() => { window.__electronInvokeDelayMs = 180; });

    await expect(page.locator('#compareCaseAssistantStatus')).toContainText('接口未被调用');
    await expect(page.locator('#compareCaseAssistantStatus')).toHaveAttribute('data-state', 'idle');

    await page.click('#compareBtn');

    await expect.poll(async () => {
      return page.locator('#compareCaseAssistantStatus').getAttribute('data-state');
    }).toBe('running');
    await expect(page.locator('#compareCaseAssistantStatus')).toContainText('正在调用中');

    await expect(page.locator('#compareStatus')).toContainText('已融合代码实现补全需求');
    await expect(page.locator('#compareCaseAssistantStatus')).toContainText('调用完毕');
    await expect(page.locator('#compareCaseAssistantStatus')).toHaveAttribute('data-state', 'done');
    await expect.poll(async () => {
      return page.evaluate(() => (window.__electronCalls || []).length);
    }).toBe(1);

    var call = await page.evaluate(() => (window.__electronCalls || [])[0]);
    expect(call.channel).toBe('case-assistant:request');
    expect(call.payload.projectRoot).toBe('E:/workspace/demo-project');
    expect(call.payload.timeoutMs).toBe(30 * 60 * 1000);
    expect(call.payload.userPrompt).toContain('E:/workspace/demo-project');

    await expect(page.locator('#cleanedText')).toHaveValue(/补全后的完整需求文案（由代码实现与预期需求合并）/);
  });

  test('项目路径为空或非法时不调用 Electron 接口，流程保持正常', async ({ page }) => {
    await prepareCompareInputs(page, 'relative/path/not-absolute');

    await expect(page.locator('#compareCaseAssistantStatus')).toBeHidden();

    await page.click('#compareBtn');

    await expect(page.locator('#compareStatus')).toContainText('对比完成');
    await expect(page.locator('#compareCaseAssistantStatus')).toBeHidden();
    await expect.poll(async () => {
      return page.evaluate(() => (window.__electronCalls || []).length);
    }).toBe(0);
    await expect(page.locator('#cleanedText')).not.toHaveValue(/补全后的完整需求文案（由代码实现与预期需求合并）/);
  });
});
