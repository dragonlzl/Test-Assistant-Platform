const { test, expect } = require('@playwright/test');

test.describe('执行视图选中用例持久化', () => {
  test.beforeEach(async ({ page }) => {
    page.__promptAnswers = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      ['usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'].forEach(function(key) {
        window.localStorage.removeItem(key);
      });
    });
  });

  test('刷新后保持上次选中的用例', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
    const now = Date.now();
    await page.evaluate((stamp) => {
      const files = [
        {
          id: 'persist-a',
          name: 'persistA.json',
          cases: [
            { module: 'A', title: '用例A', priority: 'P1', preconditions: '', steps: '1', expected: 'ok', actual: '未执行', remark: '', reuseDetails: [], defectLinks: [] },
          ],
          scope: 'current',
          requirement: '持久化需求',
          reuseEnabled: false,
          createdAt: stamp,
          reusePresets: [],
          versionId: '',
        },
        {
          id: 'persist-b',
          name: 'persistB.json',
          cases: [
            { module: 'B', title: '用例B', priority: 'P1', preconditions: '', steps: '1', expected: 'ok', actual: '未执行', remark: '', reuseDetails: [], defectLinks: [] },
          ],
          scope: 'current',
          requirement: '持久化需求',
          reuseEnabled: false,
          createdAt: stamp + 1,
          reusePresets: [],
          versionId: '',
        },
      ];
      const payload = {
        files: files,
        versions: [],
        placement: {
          requirementOrder: ['持久化需求'],
          fileOrder: { '持久化需求': ['persist-a', 'persist-b'] },
          versionOrder: [],
        },
        collapsed: { req: false, version: false },
        activeId: 'persist-b',
      };
      localStorage.setItem('usecase-temp-exec-v1', JSON.stringify(payload));
      localStorage.setItem('tempexec-focus-v1', JSON.stringify([]));
      localStorage.setItem('tempexec-page-size', '20');
      window.app.state.tempExecPreserveScrollOnce = false;
    }, now);
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.click('[data-tab-btn="tempexec"]');
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await expect(navButtons).toHaveCount(2, { timeout: 5000 });
    const activeMatch = await page.$eval('#tempExecNav .temp-req-item.active .name-text', (el) => (el && el.textContent) || '');
    const activeId = await page.evaluate(() => window.app.state && window.app.state.tempExecActiveId);
    expect(activeMatch.trim()).toBe('persistB.json');
    expect(activeId).toBe('persist-b');
  });
});
