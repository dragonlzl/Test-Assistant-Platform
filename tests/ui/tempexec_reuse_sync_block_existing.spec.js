const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('复用子项同步结果拦截', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-sync-block-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-sync-block',
            name: '复用同步拦截',
            reuseEnabled: true,
            reusePresets: [],
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
              reuseDetails: [
                { id: 'detail-1', text: '子项1', note: '', status: '通过' },
                { id: 'detail-2', text: '子项2', note: '', status: '失败' },
              ],
              defectLinks: [],
            }],
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'reuse-sync-block',
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_sync_block', role: 'user', level: 'member' }) })
    );
  });

  test('其他子项已有结果时提示无法同步', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.click('[data-temp-reuse-panel="reuse-sync-block"][data-index="0"]');
    const panel = page.locator('[data-temp-reuse-panel-container="reuse-sync-block"][data-index="0"]');
    await expect(panel).toBeVisible();

    await page.click('[data-temp-reuse-sync="reuse-sync-block"][data-index="0"]');
    const hint = page.locator('.temp-click-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('其他子项已有执行结果，无法直接同步');

    const values = await panel.locator('select.status-select').evaluateAll((list) => list.map((el) => el.value));
    expect(values).toEqual(['通过', '失败']);
  });
});
