const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

function createFilterCase(title, actual, details) {
  return {
    module: '快速筛选',
    title,
    priority: 'P1',
    preconditions: '',
    steps: '验证复用子项结果',
    expected: '筛选数量与用例列表一致',
    actual,
    remark: '',
    reuseDetails: details.map((detail, index) => ({
      id: 'detail-' + index,
      text: '子项' + (index + 1),
      note: '',
      status: typeof detail === 'string' ? detail : detail.status,
      removed: typeof detail === 'string' ? false : Boolean(detail.removed),
    })),
    defectLinks: [],
  };
}

async function openFilterCases(page, cases, reuseEnabled = true) {
  await page.goto(base + '/case-exec.html?tab=tempexec');
  await waitForAppReady(page);
  await page.evaluate((fixture) => {
    const api = window.app.tempExecApi;
    const file = api.getTempExecFile('reuse-pending-file');
    file.cases = fixture.cases;
    file.reuseEnabled = fixture.reuseEnabled;
    window.app.state.tempExecStatusFilter = { fileId: '', status: '' };
    window.app.state.tempExecSearch = { fileId: '', term: '', raw: '' };
    api.applyTempExecPageSize(200);
    api.renderTempExecView();
  }, { cases, reuseEnabled });
  await expect(page.locator('#tempExecView tr.case-row')).toHaveCount(cases.length);
}

async function expectQuickFilter(page, key, label, expectedIndexes) {
  const button = page.locator('[data-temp-status-filter="' + key + '"]');
  await expect(button).toHaveText(label + ' ' + expectedIndexes.length);
  await button.click();
  await expect(button).toHaveClass(/active/);
  const rows = page.locator('#tempExecView tr.case-row');
  await expect(rows).toHaveCount(expectedIndexes.length);
  expect(await rows.evaluateAll((list) => list.map((row) => Number(row.dataset.index)))).toEqual(expectedIndexes);
  await expect(page.locator('.temp-pagination-info').first()).toContainText('/ ' + expectedIndexes.length + ' 条');
}

test.describe('执行视图复用未执行提示与快速筛选', () => {
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

  test('复用快速筛选允许未执行与失败重叠且通过要求所有有效子项通过', async ({ page }) => {
    await openFilterCases(page, [
      createFilterCase('部分通过待执行', '通过', ['通过', '未执行']),
      createFilterCase('失败仍待执行', '失败', ['失败', '未执行']),
      createFilterCase('通过失败待执行', '通过', ['通过', '失败', '未执行']),
      createFilterCase('全部通过', '未执行', ['通过', '通过']),
      createFilterCase('移除子项不参与筛选', '失败', [
        '通过',
        { status: '未执行', removed: true },
        { status: '失败', removed: true },
      ]),
      createFilterCase('仅移除子项按未执行', '通过', [
        { status: '未执行', removed: true },
        { status: '失败', removed: true },
      ]),
      createFilterCase('无子项按未执行忽略主结果失败', '失败', []),
      createFilterCase('通过与不适用仍非全通过', '通过', ['通过', '不适用']),
      createFilterCase('通过与阻塞仍非全通过', '通过', ['通过', '阻塞']),
      createFilterCase('无子项未执行', '未执行', []),
      createFilterCase('无子项按未执行忽略主结果通过', '通过', []),
    ]);

    await expectQuickFilter(page, 'pending', '未执行', [0, 1, 2, 5, 6, 9, 10]);
    await expectQuickFilter(page, 'failed', '失败', [1, 2]);
    await expectQuickFilter(page, 'passed', '通过', [3, 4]);
    await page.locator('[data-temp-status-filter="passed"]').click();
    await expect(page.locator('#tempExecView tr.case-row')).toHaveCount(11);
  });

  test('关闭复用后快速筛选保留单个执行结果语义', async ({ page }) => {
    await openFilterCases(page, [
      createFilterCase('普通通过', '通过', ['失败', '未执行']),
      createFilterCase('普通失败', '失败', ['通过', '通过']),
      createFilterCase('普通未执行', '未执行', ['通过', '失败']),
    ], false);

    await expectQuickFilter(page, 'pending', '未执行', [2]);
    await expectQuickFilter(page, 'failed', '失败', [1]);
    await expectQuickFilter(page, 'passed', '通过', [0]);
  });

  test('人工选择子项结果后立即更新快速筛选数量和当前列表', async ({ page }) => {
    await openFilterCases(page, [
      createFilterCase('部分通过待执行', '通过', ['通过', '未执行']),
      createFilterCase('失败仍待执行', '失败', ['失败', '未执行']),
      createFilterCase('通过失败待执行', '失败', ['通过', '失败', '未执行']),
    ]);

    await expectQuickFilter(page, 'pending', '未执行', [0, 1, 2]);
    await page.locator('[data-temp-reuse-panel="reuse-pending-file"][data-index="0"]').click();
    await page.locator('select[data-temp-reuse-status="reuse-pending-file"][data-index="0"][data-detail="detail-1"]').selectOption('通过');
    await expect(page.locator('#tempExecView tr.case-row')).toHaveCount(2);
    await expect(page.locator('#tempExecView tr.case-row[data-index="0"]')).toHaveCount(0);
    await expect(page.locator('[data-temp-status-filter="pending"]')).toHaveText('未执行 2');
    await expect(page.locator('[data-temp-status-filter="passed"]')).toHaveText('通过 1');

    await expectQuickFilter(page, 'failed', '失败', [1, 2]);
    await page.locator('[data-temp-reuse-panel="reuse-pending-file"][data-index="1"]').click();
    await page.locator('select[data-temp-reuse-status="reuse-pending-file"][data-index="1"][data-detail="detail-0"]').selectOption('通过');
    await expect(page.locator('#tempExecView tr.case-row')).toHaveCount(1);
    await expect(page.locator('#tempExecView tr.case-row[data-index="1"]')).toHaveCount(0);
    await expect(page.locator('[data-temp-status-filter="pending"]')).toHaveText('未执行 2');
    await expect(page.locator('[data-temp-status-filter="failed"]')).toHaveText('失败 1');

    await page.locator('[data-temp-reuse-panel="reuse-pending-file"][data-index="2"]').click();
    await page.locator('select[data-temp-reuse-status="reuse-pending-file"][data-index="2"][data-detail="detail-1"]').selectOption('通过');
    await expect(page.locator('#tempExecView tr.case-row')).toHaveCount(0);
    await expect(page.locator('[data-temp-status-filter="failed"]')).toHaveText('失败 0');
    await expect(page.locator('[data-temp-status-filter="pending"]')).toHaveText('未执行 2');

    await expectQuickFilter(page, 'pending', '未执行', [1, 2]);
    for (const entry of [{ index: 1, detail: 'detail-1' }, { index: 2, detail: 'detail-2' }]) {
      const panel = page.locator('[data-temp-reuse-panel-container="reuse-pending-file"][data-index="' + entry.index + '"]');
      if (!(await panel.isVisible())) {
        await page.locator('[data-temp-reuse-panel="reuse-pending-file"][data-index="' + entry.index + '"]').click();
      }
      await panel.locator('select[data-detail="' + entry.detail + '"]').selectOption('通过');
      await expect(page.locator('#tempExecView tr.case-row[data-index="' + entry.index + '"]')).toHaveCount(0);
    }
    await expect(page.locator('[data-temp-status-filter="pending"]')).toHaveText('未执行 0');
    await expectQuickFilter(page, 'passed', '通过', [0, 1, 2]);
  });

  test('筛选命中保持时子项选择结果更新计数且保留原 DOM', async ({ page }) => {
    await openFilterCases(page, [
      createFilterCase('通过与两个待执行子项', '通过', ['通过', '未执行', '未执行']),
    ]);
    await expectQuickFilter(page, 'pending', '未执行', [0]);
    await page.locator('[data-temp-reuse-panel="reuse-pending-file"][data-index="0"]').click();
    await page.evaluate(() => {
      window.__filterReuseSelect = document.querySelector('select[data-temp-reuse-status="reuse-pending-file"][data-detail="detail-1"]');
      window.__filterReusePanel = document.querySelector('[data-temp-reuse-panel-container="reuse-pending-file"][data-index="0"]');
    });

    await page.locator('select[data-temp-reuse-status="reuse-pending-file"][data-detail="detail-1"]').selectOption('失败');
    await expect(page.locator('#tempExecView tr.case-row')).toHaveCount(1);
    await expect(page.locator('[data-temp-status-filter="pending"]')).toHaveText('未执行 1');
    await expect(page.locator('[data-temp-status-filter="failed"]')).toHaveText('失败 1');
    await expect(page.locator('[data-temp-status-filter="passed"]')).toHaveText('通过 0');
    expect(await page.evaluate(() => ({
      sameSelect: window.__filterReuseSelect === document.querySelector('select[data-temp-reuse-status="reuse-pending-file"][data-detail="detail-1"]'),
      samePanel: window.__filterReusePanel === document.querySelector('[data-temp-reuse-panel-container="reuse-pending-file"][data-index="0"]'),
    }))).toEqual({ sameSelect: true, samePanel: true });
  });
});
