const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('复用子项同步首条结果', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-sync-first-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-sync-file',
            name: '复用同步首条',
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
                { id: 'detail-3', text: '子项3', note: '', status: '阻塞' },
              ],
              defectLinks: [],
            }],
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'reuse-sync-file',
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_sync_first', role: 'user', level: 'member' }) })
    );
  });

  test('同步首条子项结果后其他子项跟随', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.click('[data-temp-reuse-panel="reuse-sync-file"][data-index="0"]');
    const panel = page.locator('[data-temp-reuse-panel-container="reuse-sync-file"][data-index="0"]');
    await expect(panel).toBeVisible();

    await page.click('[data-temp-reuse-sync="reuse-sync-file"][data-index="0"]');
    const firstValues = await panel.locator('select.status-select').evaluateAll((list) => list.map((el) => el.value));
    expect(firstValues).toEqual(['通过', '通过', '通过']);

    await page.evaluate(() => {
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      const file = api && api.getTempExecFile ? api.getTempExecFile('reuse-sync-file') : null;
      if (!file || !file.cases || !file.cases[0]) return;
      const entry = file.cases[0];
      if (Array.isArray(entry.reuseDetails)) {
        entry.reuseDetails.shift();
        if (entry.reuseDetails[0]) entry.reuseDetails[0].status = '失败';
        if (entry.reuseDetails[1]) entry.reuseDetails[1].status = '通过';
      }
      if (api && api.renderTempExecView) api.renderTempExecView();
    });

    await page.evaluate(() => {
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      if (!api) return;
      if (api.ensureTempExecReuseOpen) {
        const openSet = api.ensureTempExecReuseOpen('reuse-sync-file');
        if (openSet && openSet.add) openSet.add(0);
      }
      if (api.renderTempExecView) api.renderTempExecView();
    });
    const panelAfterDelete = page.locator('[data-temp-reuse-panel-container="reuse-sync-file"][data-index="0"]');
    await expect(panelAfterDelete).toBeVisible();
    await page.click('[data-temp-reuse-sync="reuse-sync-file"][data-index="0"]');
    const secondValues = await panelAfterDelete.locator('select.status-select').evaluateAll((list) => list.map((el) => el.value));
    expect(secondValues).toEqual(['失败', '失败']);
  });
});
