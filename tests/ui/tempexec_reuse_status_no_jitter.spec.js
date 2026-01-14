const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('复用子项选择执行结果不触发整页重绘', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-status-jitter-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-jitter-file',
            name: '复用执行抖动',
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
                { id: 'detail-1', text: '子项1', note: '', status: '未执行', removed: false },
                { id: 'detail-2', text: '子项2', note: '', status: '未执行', removed: false },
              ],
              defectLinks: [],
            }],
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'reuse-jitter-file',
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_status_jitter', role: 'user', level: 'member' }) })
    );
  });

  test('切换子项结果不会替换 DOM', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.click('[data-temp-reuse-panel="reuse-jitter-file"][data-index="0"]');
    const panel = page.locator('[data-temp-reuse-panel-container="reuse-jitter-file"][data-index="0"]');
    await expect(panel).toBeVisible();

    const beforeTransform = await page.evaluate(() => {
      window.__reuseSelect = document.querySelector('select[data-temp-reuse-status="reuse-jitter-file"][data-detail="detail-1"]');
      window.__reusePanel = document.querySelector('[data-temp-reuse-panel-container="reuse-jitter-file"][data-index="0"]');
      return window.__reuseSelect ? (window.__reuseSelect.style.transform || '') : '';
    });

    const firstSelect = panel.locator('select.status-select').first();
    await firstSelect.selectOption('通过');
    await expect(firstSelect).toHaveClass(/passed/);

    const compareResult = await page.evaluate(() => {
      const currentSelect = document.querySelector('select[data-temp-reuse-status="reuse-jitter-file"][data-detail="detail-1"]');
      const currentPanel = document.querySelector('[data-temp-reuse-panel-container="reuse-jitter-file"][data-index="0"]');
      return {
        sameSelect: window.__reuseSelect === currentSelect,
        samePanel: window.__reusePanel === currentPanel,
        transform: currentSelect ? (currentSelect.style.transform || '') : '',
      };
    });
    expect(compareResult.sameSelect).toBe(true);
    expect(compareResult.samePanel).toBe(true);
    expect(compareResult.transform).toBe(beforeTransform);
  });
});
