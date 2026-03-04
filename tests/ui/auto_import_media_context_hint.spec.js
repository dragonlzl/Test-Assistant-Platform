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

test.describe('一键执行导入区图片模型提示', () => {
  test('原始需求导入区域展示图片上下文与模型视觉能力', async ({ page }) => {
    await page.route('**/*', async (route) => {
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

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.setItem('cleaner-models-v1', JSON.stringify([{
          id: 'vision-model',
          name: 'vision-model',
          provider: 'custom',
          baseUrl: 'http://mock-model.local/v1/chat/completions',
          apiKey: '',
          model: 'vision-model',
          maxTokens: 1024,
          capabilities: ['vision', 'chat'],
        }]));
        localStorage.setItem('cleaner-assignment-v1', JSON.stringify({
          cleanId: 'vision-model',
          reviewId: 'vision-model',
        }));
      } catch (_) {}
    });

    await initPage(page, base + '/ai-workflow.html?tab=auto');
    await page.evaluate(() => {
      var state = window.app && window.app.state;
      if (!state) return;
      state.requirementMedia = {
        docxImages: [{ index: 1, blob: new Blob(['x'], { type: 'image/png' }) }],
        pastedImages: [],
        lastDocxImageCount: 1,
        updatedAt: Date.now(),
      };
      if (window.app && typeof window.app.updateFlowStatus === 'function') {
        window.app.updateFlowStatus();
      }
    });

    const hint = page.locator('#mediaContextAutoImportHint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('图片上下文：1 张');
    await expect(hint).toContainText('评审模型：');
    await expect(hint).toContainText('清洗模型：');
    await expect(hint).toContainText('可识别图片');
  });
});
