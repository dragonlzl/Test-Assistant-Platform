const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('复用预设新增用例执行结果可独立选择', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-preset-status-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-status-file',
            name: '复用执行状态',
            reuseEnabled: true,
            reusePresets: [
              { id: 'preset-1', text: '子项1' },
              { id: 'preset-2', text: '子项2' },
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
          activeId: 'reuse-status-file',
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_preset_status', role: 'user', level: 'member' }) })
    );
  });

  test('新增用例后子项执行结果互不影响', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.click('[data-temp-case-insert="reuse-status-file"][data-index="0"]');
    await page.waitForSelector('[data-temp-case-row="reuse-status-file"][data-index="1"]', { timeout: 8000 });

    await page.click('[data-temp-reuse-panel="reuse-status-file"][data-index="1"]');
    const panel = page.locator('[data-temp-reuse-panel-container="reuse-status-file"][data-index="1"]');
    await expect(panel).toBeVisible();

    const selects = panel.locator('select.status-select');
    await expect(selects).toHaveCount(2);

    await selects.nth(0).selectOption('通过');
    await expect(selects.nth(0)).toHaveValue('通过');

    await selects.nth(1).selectOption('失败');
    const values = await panel.locator('select.status-select').evaluateAll((list) => list.map((el) => el.value));
    expect(values[0]).toBe('通过');
    expect(values[1]).toBe('失败');
  });
});
