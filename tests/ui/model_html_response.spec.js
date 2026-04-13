const { test, expect } = require('@playwright/test');

test('模型接口返回 HTML 页面时给出明确错误', async ({ page }) => {
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

  const errorMsg = await page.evaluate(async () => {
    const service = window.app && window.app.services && window.app.services.modelClient;
    if (!service || typeof service.createModelClient !== 'function') {
      throw new Error('模型客户端未加载');
    }
    const client = service.createModelClient({
      fetchImpl: async function mockFetch() {
        return {
          ok: true,
          text: async function mockText() {
            return '<!doctype html><html lang="zh-CN"><head><title>TiMi CC - AI API Gateway</title></head><body><div id="app"></div></body></html>';
          },
        };
      },
    });
    try {
      await client.callModelWithConfig(
        { baseUrl: 'https://mock.model/v1/responses', model: 'gpt-5.4' },
        'ping',
        '任意提示'
      );
      return '';
    } catch (err) {
      return err && err.message ? err.message : String(err);
    }
  });

  expect(errorMsg).toContain('HTML 页面');
  expect(errorMsg).toContain('TiMi CC - AI API Gateway');
});
