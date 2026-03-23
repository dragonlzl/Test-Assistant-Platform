const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

async function openTempExecPage(page) {
  await page.goto(base + '/case-exec.html?tab=tempexec');
  await waitForAppReady(page);
}

test.describe('执行视图复用子项展开全部', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-expand-all-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-expand-file',
            name: '复用展开全部',
            reuseEnabled: true,
            reusePresets: [],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases: [
              {
                module: '模块A',
                title: '用例A',
                priority: 'P1',
                preconditions: '',
                steps: '步骤1',
                expected: '结果1',
                actual: '未执行',
                remark: '',
                reuseDetails: [{ id: 'detail-a', text: '子项A', note: '', status: '未执行', removed: false }],
                defectLinks: [],
              },
              {
                module: '模块B',
                title: '用例B',
                priority: 'P1',
                preconditions: '',
                steps: '步骤2',
                expected: '结果2',
                actual: '未执行',
                remark: '',
                reuseDetails: [{ id: 'detail-b', text: '子项B', note: '', status: '未执行', removed: false }],
                defectLinks: [],
              },
              {
                module: '模块C',
                title: '用例C',
                priority: 'P2',
                preconditions: '',
                steps: '步骤3',
                expected: '结果3',
                actual: '未执行',
                remark: '',
                reuseDetails: [{ id: 'detail-c', text: '子项C', note: '', status: '未执行', removed: false }],
                defectLinks: [],
              },
            ],
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'reuse-expand-file',
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_expand', role: 'user', level: 'member' }) })
    );
  });

  test('可基于当前页可见用例批量展开并收起复用子项', async ({ page }) => {
    await openTempExecPage(page);

    const toggleAllBtn = page.locator('[data-temp-reuse-toggle-all="reuse-expand-file"]');
    await expect(toggleAllBtn).toBeVisible();
    await expect(toggleAllBtn).toHaveText('展开所有子项');

    await page.click('[data-temp-reuse-panel="reuse-expand-file"][data-index="0"]');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(1);

    await toggleAllBtn.click();
    await expect(page.locator('.reuse-row.visible')).toHaveCount(3);
    await expect(toggleAllBtn).toHaveText('收起所有子项');

    await page.click('[data-temp-reuse-panel="reuse-expand-file"][data-index="0"]');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(2);
    await expect(toggleAllBtn).toHaveText('收起所有子项');

    await toggleAllBtn.click();
    await expect(page.locator('.reuse-row.visible')).toHaveCount(0);
    await expect(toggleAllBtn).toHaveText('展开所有子项');
  });

  test('滚动触发自动收起占位后，批量按钮仍保持收起态', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        const cases = [];
        for (let i = 0; i < 18; i += 1) {
          cases.push({
            module: `模块${i + 1}`,
            title: `用例${i + 1}`,
            priority: 'P1',
            preconditions: '',
            steps: `步骤${i + 1}`,
            expected: `结果${i + 1}`,
            actual: '未执行',
            remark: '',
            reuseDetails: [{ id: `detail-${i + 1}`, text: `子项${i + 1}`, note: '', status: '未执行', removed: false }],
            defectLinks: [],
          });
        }
        localStorage.setItem('tempexec-page-size', '200');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-expand-scroll-file',
            name: '复用展开滚动',
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
          activeId: 'reuse-expand-scroll-file',
        }));
      } catch (_) {}
    });

    await openTempExecPage(page);

    await expect(page.locator('[data-temp-reuse-toggle-all="reuse-expand-scroll-file"]')).toBeVisible();
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.applyTempExecPageSize === 'function') {
        window.app.tempExecApi.applyTempExecPageSize(200);
      }
    });

    const toggleAllBtn = page.locator('[data-temp-reuse-toggle-all="reuse-expand-scroll-file"]');
    await expect(toggleAllBtn).toBeVisible();
    await toggleAllBtn.click();
    await expect(toggleAllBtn).toHaveText('收起所有子项');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(18);

    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 500);
    }
    await page.waitForTimeout(300);

    await expect(page.locator('.reuse-row.placeholder').first()).toBeVisible();
    await expect(toggleAllBtn).toHaveText('收起所有子项');
  });

  test('批量展开和收起可覆盖分页后的用例', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        const cases = [];
        for (let i = 0; i < 12; i += 1) {
          cases.push({
            module: `分页模块${i + 1}`,
            title: `分页用例${i + 1}`,
            priority: 'P1',
            preconditions: '',
            steps: `步骤${i + 1}`,
            expected: `结果${i + 1}`,
            actual: '未执行',
            remark: '',
            reuseDetails: [{ id: `page-detail-${i + 1}`, text: `分页子项${i + 1}`, note: '', status: '未执行', removed: false }],
            defectLinks: [],
          });
        }
        localStorage.setItem('tempexec-page-size', '5');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-expand-pages-file',
            name: '复用分页展开',
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
          activeId: 'reuse-expand-pages-file',
        }));
      } catch (_) {}
    });

    await openTempExecPage(page);

    const toggleAllBtn = page.locator('[data-temp-reuse-toggle-all="reuse-expand-pages-file"]');
    await expect(toggleAllBtn).toBeVisible();

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.applyTempExecPageSize === 'function') {
        window.app.tempExecApi.applyTempExecPageSize(5);
      }
    });

    await expect(page.locator('.temp-pagination-info').first()).toContainText('每页 5 条');
    await expect(page.locator('.temp-pagination-controls span').first()).toHaveText('第 1 / 3 页');
    await expect(toggleAllBtn).toBeVisible();
    await expect(page.locator('.reuse-row.visible')).toHaveCount(0);

    await toggleAllBtn.click();
    await expect(toggleAllBtn).toHaveText('收起所有子项');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(5);

    await page.click('[data-temp-page-action="reuse-expand-pages-file"][data-action="next"]');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(5);
    await expect(toggleAllBtn).toHaveText('收起所有子项');

    await page.click('[data-temp-page-action="reuse-expand-pages-file"][data-action="next"]');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(2);

    await toggleAllBtn.click();
    await expect(toggleAllBtn).toHaveText('展开所有子项');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(0);

    await page.click('[data-temp-page-action="reuse-expand-pages-file"][data-action="prev"]');
    await expect(page.locator('.reuse-row.visible')).toHaveCount(0);
  });
});
