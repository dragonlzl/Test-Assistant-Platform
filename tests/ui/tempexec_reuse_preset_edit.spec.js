const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('复用预设子项编辑与删除确认', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-preset-edit-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-preset-edit',
            name: '复用预设编辑',
            reuseEnabled: true,
            reusePresets: [
              { id: 'preset-a', text: '子项A' },
              { id: 'preset-b', text: '子项B' },
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
              reuseDetails: [
                { id: 'detail-a', text: '子项A', note: '', status: '未执行', presetId: 'preset-a' },
                { id: 'detail-b', text: '子项B', note: '', status: '未执行', presetId: 'preset-b' },
                { id: 'detail-a2', text: '子项A', note: '', status: '未执行' },
              ],
              defectLinks: [],
            }],
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'reuse-preset-edit',
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 0, username: 'reuse_preset_edit', role: 'user', level: 'member' }) })
    );
  });

  test('预设子项删除需要确认抽屉', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });

    const presetChip = page.locator('#tempExecView .reuse-presets .preset-chip', { hasText: '子项B' });
    await expect(presetChip).toBeVisible();
    await presetChip.locator('[data-temp-reuse-preset-remove]').click();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toHaveText('确定删除该预设子项吗？删除后将同步移除关联的复用子项。');
    await page.click('#appConfirmDrawerCancelBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(presetChip).toBeVisible();

    await presetChip.locator('[data-temp-reuse-preset-remove]').click();
    await expect(confirmDrawer).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(presetChip).toHaveCount(0);
  });

  test('编辑预设子项同步更新同名复用子项', async ({ page }) => {
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });

    await page.locator('#tempExecView .reuse-presets .preset-text', { hasText: '子项A' }).click();
    const confirmDrawer = page.locator('#appConfirmDrawer');
    await expect(confirmDrawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerInput')).toHaveValue('子项A');
    await page.fill('#appConfirmDrawerInput', '子项A-新');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(confirmDrawer).not.toHaveClass(/open/);
    await expect(page.locator('#tempExecView .reuse-presets .preset-text', { hasText: '子项A-新' })).toBeVisible();

    await page.click('[data-temp-reuse-panel="reuse-preset-edit"][data-index="0"]');
    const panel = page.locator('[data-temp-reuse-panel-container="reuse-preset-edit"][data-index="0"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.reuse-input')).toHaveCount(3);
    const values = await panel.locator('.reuse-input').evaluateAll((list) => list.map((el) => el.value));
    expect(values.filter((val) => val === '子项A-新')).toHaveLength(2);
    expect(values).toContain('子项B');
  });
});
