const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('执行视图复用预设同步新增用例', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-preset-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-preset-file',
            name: '复用预设',
            reuseEnabled: true,
            reusePresets: [
              { id: 'preset-1', text: '子项A' },
              { id: 'preset-2', text: '子项B' },
            ],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases: [{
              module: '模块A',
              title: '用例A',
              priority: 'P1',
              preconditions: '',
              steps: '步骤1',
              expected: '期望1',
              actual: '未执行',
              remark: '',
              reuseDetails: [],
              defectLinks: [],
            }],
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'reuse-preset-file',
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_preset', role: 'user', level: 'member' }) })
    );
  });

  test('新增用例自动填充预设子项', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.click('[data-temp-case-insert="reuse-preset-file"][data-index="0"]');
    await page.waitForSelector('[data-temp-case-row="reuse-preset-file"][data-index="1"]', { timeout: 8000 });

    await page.click('[data-temp-reuse-panel="reuse-preset-file"][data-index="1"]');
    const panel = page.locator('[data-temp-reuse-panel-container="reuse-preset-file"][data-index="1"]');
    const entries = panel.locator('.reuse-entry');
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0).locator('.reuse-input')).toHaveValue('子项A');
    await expect(entries.nth(1).locator('.reuse-input')).toHaveValue('子项B');
  });
});
