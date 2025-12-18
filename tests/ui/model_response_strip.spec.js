const { test, expect } = require('@playwright/test');

test('模型响应含代码块包装也能被剥离', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
    } catch (_) {}
  });
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });

  const results = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const clientWithChoice = service.createModelClient({
      fetchImpl: async function mockFetch() {
        return {
          ok: true,
          text: async function mockText() {
            return JSON.stringify({
              choices: [
                {
                  message: {
                    content: "'''json\n[{\"module\":\"模块X\",\"key_scenarios\":[\"场景A\"]}]\n'''",
                  },
                },
              ],
            });
          },
        };
      },
    });
    const sanitizedChoice = await clientWithChoice.callModelWithConfig(
      { baseUrl: 'http://mock.model/api', model: 'mock-model' },
      '用户输入',
      '提示词示例'
    );

    const clientWithRawText = service.createModelClient({
      fetchImpl: async function mockRawFetch() {
        return {
          ok: true,
          text: async function mockRawText() {
            return "```json\n{\"hello\":\"world\"}\n```";
          },
        };
      },
    });
    const sanitizedRaw = await clientWithRawText.callModelWithConfig(
      { baseUrl: 'http://mock.model/api', model: 'mock-model' },
      '任意输入',
      '任意提示'
    );

    return { sanitizedChoice, sanitizedRaw };
  });

  expect(results.sanitizedChoice).toBe('[{"module":"模块X","key_scenarios":["场景A"]}]');
  expect(results.sanitizedRaw).toBe('{"hello":"world"}');
});
