const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('执行视图复用子项滚动自动收起', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-auto-collapse-token');
        const cases = [];
        for (let i = 0; i < 40; i += 1) {
          cases.push({
            module: `模块${i + 1}`,
            title: `用例${i + 1}`,
            priority: 'P1',
            preconditions: '',
            steps: `步骤${i + 1}`,
            expected: `结果${i + 1}`,
            actual: '未执行',
            remark: '',
            reuseDetails: i === 0
              ? [{ id: 'reuse-detail-1', text: '子项1', note: '', status: '未执行' }]
              : [],
            defectLinks: [],
          });
        }
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-auto-collapse-file',
            name: '复用自动收起',
            reuseEnabled: true,
            reusePresets: [],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases,
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'reuse-auto-collapse-file',
        }));
      } catch (_) {}
    });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_auto', role: 'user', level: 'member' }) })
    );
  });

  test('滚动离开后自动收起复用子项', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
      if (window.scrollTo) window.scrollTo(0, 0);
    });

    const reuseBtn = page.locator('[data-temp-reuse-panel="reuse-auto-collapse-file"][data-index="0"]');
    await expect(reuseBtn).toBeVisible();
    await reuseBtn.click();
    await expect(page.locator('.reuse-row.visible')).toHaveCount(1);

    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 600);
    }

    await expect(page.locator('.reuse-row.visible')).toHaveCount(0);
  });
});
