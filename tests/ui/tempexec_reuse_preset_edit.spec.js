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
              { id: 'preset-a', text: '子项A', applicability: { profile: 'character-skin-unlock-v1', value: 'gem' } },
              { id: 'preset-b', text: '子项B', applicability: { profile: 'character-skin-unlock-v1', value: 'paid' } },
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

  test('复用操作使用小圆角矩形控件', async ({ page }) => {
    await page.unroute('**/api/**');
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const respond = (body) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
      if (url.pathname === '/api/users/me') {
        return respond({ id: 0, username: 'reuse_preset_edit', role: 'user', level: 'member' });
      }
      if (method === 'GET') return respond([]);
      return respond({});
    });
    await page.goto(base + '/case-exec.html');
    await waitForAppReady(page);
    await page.waitForLoadState('networkidle');

    const profileReady = await page.evaluate(() => {
      const state = window.app && window.app.state ? window.app.state : null;
      const api = window.app && window.app.tempExecApi ? window.app.tempExecApi : null;
      const applicabilityCore = window.app && window.app.reuseApplicabilityCore
        ? window.app.reuseApplicabilityCore
        : null;
      if (state && api && applicabilityCore) {
        state.projects = [{ id: 'project-1', name: '元气骑士' }];
        state.tempExecFiles = [{
          id: 'reuse-preset-edit',
          name: '复用预设编辑',
          reuseEnabled: true,
          reusePresets: [
            { id: 'preset-a', text: '子项A', applicability: { profile: 'character-skin-unlock-v1', value: 'gem' } },
            { id: 'preset-b', text: '子项B', applicability: { profile: 'character-skin-unlock-v1', value: 'paid' } },
          ],
          createdAt: Date.now(),
          requirement: '',
          projectId: 'project-1',
          versionId: '',
          cases: [{
            module: '宝石皮肤',
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
        }];
        state.tempExecActiveId = 'reuse-preset-edit';
        api.renderTempExecView();
        return true;
      }
      return false;
    });
    expect(profileReady).toBe(true);
    await expect(page.locator('#tempExecView')).toBeVisible({ timeout: 15000 });

    const rectangularControls = page.locator([
      '#tempExecToolbar [data-temp-reuse-toggle-all]',
      '#tempExecToolbar [data-temp-reuse-preset-add]',
      '#tempExecToolbar [data-temp-reuse-applicability-apply]',
      '#tempExecView .reuse-presets .preset-chip',
      '#tempExecView [data-temp-reuse-preset-remove]',
    ].join(','));
    await expect(rectangularControls).toHaveCount(7);
    const radii = await rectangularControls.evaluateAll((elements) => elements.map((element) => {
      return parseFloat(window.getComputedStyle(element).borderRadius) || 0;
    }));
    radii.forEach((radius) => expect(radius).toBeLessThanOrEqual(6));

    const actionRow = page.locator('#tempExecToolbar .toolbar-preset-actions');
    await expect(actionRow).toBeVisible();
    await expect(actionRow).not.toContainText('角色皮肤解锁方式');
    const actionOrder = await actionRow.locator('button').evaluateAll((buttons) => buttons.map((button) => {
      if (button.dataset.tempReusePresetAdd !== undefined) return 'preset';
      if (button.dataset.tempReuseToggleAll !== undefined) return 'expand';
      if (button.dataset.tempReuseApplicabilityApply !== undefined) return 'quick';
      return '';
    }));
    expect(actionOrder).toEqual(['preset', 'expand', 'quick']);
    await expect(actionRow.locator('[data-temp-reuse-applicability-apply]')).toHaveText('快速执行');
    const actionHeights = await actionRow.locator('button').evaluateAll((buttons) => buttons.map((button) => {
      return Math.round(button.getBoundingClientRect().height);
    }));
    expect(new Set(actionHeights).size).toBe(1);
    const pairedActionWidths = await actionRow.locator([
      '[data-temp-reuse-preset-add]',
      '[data-temp-reuse-toggle-all]',
    ].join(',')).evaluateAll((buttons) => buttons.map((button) => {
      return Math.round(button.getBoundingClientRect().width);
    }));
    expect(new Set(pairedActionWidths).size).toBe(1);

    const positions = await page.evaluate(() => {
      const search = document.querySelector('#tempExecToolbar .toolbar-search').getBoundingClientRect();
      const actions = document.querySelector('#tempExecToolbar .toolbar-preset-actions').getBoundingClientRect();
      return { searchRight: search.right, actionsLeft: actions.left };
    });
    expect(positions.actionsLeft).toBeGreaterThanOrEqual(positions.searchRight - 1);
    await expect(page.locator('#tempExecView .reuse-preset-actions')).toHaveCount(0);

    await page.locator('#tempExecToolbar [data-temp-reuse-preset-add]').click();
    const itemRow = page.locator('#tempExecView .reuse-preset-items');
    const presetInput = itemRow.locator('.preset-input');
    await expect(presetInput).toBeVisible();
    await expect(itemRow.locator(':scope > .preset-input')).toHaveCount(1);
    const firstItemClass = await itemRow.locator(':scope > *').first().getAttribute('class');
    expect(firstItemClass).toContain('preset-input');
    const inputRadius = await presetInput.evaluate((element) => {
      return parseFloat(window.getComputedStyle(element).borderRadius) || 0;
    });
    expect(inputRadius).toBeLessThanOrEqual(6);

    await presetInput.locator('input').fill('子项C');
    await presetInput.getByRole('button', { name: '保存' }).click();
    await expect(presetInput).toHaveCount(0);
    const presetTexts = await itemRow.locator(':scope > .preset-chip .preset-text').allTextContents();
    expect(presetTexts).toEqual(['子项A', '子项B', '子项C']);
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
    const values = await panel.locator('.reuse-input').evaluateAll((list) => list.map((el) => el.value));
    expect(values.filter((val) => val === '子项A-新')).toHaveLength(2);
    expect(values).toContain('子项B');
  });
});
