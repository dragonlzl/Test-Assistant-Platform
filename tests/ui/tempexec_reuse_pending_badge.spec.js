const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('执行视图复用未执行红点提示', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-pending-token');
        localStorage.setItem('usecase-settings-v1', JSON.stringify({ theme: 'dark' }));
        if (!localStorage.getItem('reuse-pending-inited')) {
          localStorage.setItem('reuse-pending-inited', '1');
          localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
            files: [{
              id: 'reuse-pending-file',
              name: '复用红点',
              reuseEnabled: true,
              reusePresets: [],
              createdAt: Date.now(),
              requirement: '',
              projectId: '',
              versionId: '',
              cases: [{
                module: '模块A',
                title: '登录',
                priority: 'P1',
                preconditions: '',
                steps: '步骤1',
                expected: '成功',
                actual: '变更重跑',
                remark: '',
                reuseDetails: [
                  { id: 'reuse-detail-1', text: '子项1', note: '', status: '未执行' },
                  { id: 'reuse-detail-2', text: '子项2', note: '', status: '未执行' },
                  { id: 'reuse-detail-3', text: '子项3', note: '', status: '通过' },
                ],
                defectLinks: [],
              }],
            }],
            versions: [],
            placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
            collapsed: { req: false, version: false },
            activeId: 'reuse-pending-file',
          }));
        }
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_pending', role: 'user', level: 'member' }) })
    );
  });

  test('未执行子项计数红点展示与持久化', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    const reuseBtn = page.locator('.reuse-status').first();
    await expect(reuseBtn).toBeVisible();
    await expect(reuseBtn).toHaveClass(/changed/);

    const badge = reuseBtn.locator('.reuse-pending-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('2');
    const badgeBg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(badgeBg).not.toBe('rgba(0, 0, 0, 0)');

    await page.reload();
    await waitForAppReady(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    const reuseBtnReload = page.locator('.reuse-status').first();
    const badgeReload = reuseBtnReload.locator('.reuse-pending-badge');
    await expect(badgeReload).toBeVisible();
    await expect(badgeReload).toHaveText('2');

    await reuseBtnReload.click();
    await expect(page.locator('.reuse-row.visible')).toHaveCount(1);
    await expect(reuseBtnReload.locator('.reuse-pending-badge')).toHaveCount(0);

    const selects = page.locator('.reuse-entry .status-select');
    await selects.nth(0).selectOption('通过');
    await selects.nth(1).selectOption('通过');

    await reuseBtnReload.click();
    await expect(page.locator('.reuse-row.visible')).toHaveCount(0);
    await expect(page.locator('.reuse-status .reuse-pending-badge')).toHaveCount(0);

    await page.reload();
    await waitForAppReady(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await expect(page.locator('.reuse-status .reuse-pending-badge')).toHaveCount(0);
  });
});
