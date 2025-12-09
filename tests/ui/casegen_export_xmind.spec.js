const { test, expect } = require('@playwright/test');

test.describe('用例生成导出 XMind', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('导出生成用例使用需求标识命名 XMind', async ({ page }) => {
    await page.click('[data-tab-btn="clean"]');
    await page.evaluate(() => {
      window.prompt = () => '需求1';
      const split = document.getElementById('splitResult');
      if (split) {
        split.removeAttribute('readonly');
        split.value = JSON.stringify([{ module: '登录模块', key_scenarios: [], test_points: [], coupled_modules: [] }]);
        split.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.click('#goUsecaseGen');
    const moduleId = await page.evaluate(() => {
      const state = window.app && window.app.state;
      if (window.app && window.app.requirement && typeof window.app.requirement.setRequirementLabel === 'function') {
        window.app.requirement.setRequirementLabel('需求1', 'ui-test');
      } else if (state) {
        state.requirementLabel = '需求1';
        state.requirementLabelSource = 'ui-test';
      }
      return state && state.caseGenModules && state.caseGenModules.length ? state.caseGenModules[0].id : '';
    });
    expect(moduleId).toBeTruthy();
    const casePayload = JSON.stringify([{
      module: '登录模块',
      title: '登录成功',
      priority: 'P1',
      preconditions: '',
      steps: '步骤1',
      expected: '成功',
    }], null, 2);
    const importContent = '#CASE_MODULE:登录模块\n' + casePayload;
    await page.setInputFiles(`input[data-import-input="${moduleId}"]`, {
      name: 'cases.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importContent),
    });
    await expect(page.locator(`textarea[data-result="${moduleId}"]`)).toHaveValue(/登录成功/);
    await expect(page.locator('#exportCaseGen')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#exportCaseGen'),
    ]);
    const name = await download.suggestedFilename();
    expect(name).toMatch(/^需求1_\d{14}\.xmind$/);
  });

  test('全局按钮导出勾选模块用例为 XMind', async ({ page }) => {
    await page.click('[data-tab-btn="clean"]');
    await page.evaluate(() => {
      window.prompt = () => '需求1';
      const split = document.getElementById('splitResult');
      if (split) {
        split.removeAttribute('readonly');
        split.value = JSON.stringify([{ module: '登录模块', key_scenarios: [], test_points: [], coupled_modules: [] }]);
        split.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.click('#goUsecaseGen');
    const moduleId = await page.evaluate(() => {
      const state = window.app && window.app.state;
      if (window.app && window.app.requirement && typeof window.app.requirement.setRequirementLabel === 'function') {
        window.app.requirement.setRequirementLabel('需求1', 'ui-test');
      } else if (state) {
        state.requirementLabel = '需求1';
        state.requirementLabelSource = 'ui-test';
      }
      return state && state.caseGenModules && state.caseGenModules.length ? state.caseGenModules[0].id : '';
    });
    expect(moduleId).toBeTruthy();
    const casePayload = JSON.stringify([{
      module: '登录模块',
      title: '登录成功',
      priority: 'P1',
      preconditions: '',
      steps: '步骤1',
      expected: '成功',
    }], null, 2);
    const importContent = '#CASE_MODULE:登录模块\n' + casePayload;
    await page.setInputFiles(`input[data-import-input="${moduleId}"]`, {
      name: 'cases.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importContent),
    });
    await expect(page.locator(`textarea[data-result="${moduleId}"]`)).toHaveValue(/登录成功/);
    const viewBtn = page.locator('[data-view]');
    await expect(viewBtn).toBeEnabled();
    await viewBtn.click();
    await page.waitForSelector('input[data-case-select-all]');
    await page.click('input[data-case-select-all]');
    const closeDrawerBtn = page.locator('#closeCaseGenViewDrawerBtn');
    if (await closeDrawerBtn.isVisible()) {
      await closeDrawerBtn.click();
    }
    const exportBtn = page.locator('#exportCaseGenXmind');
    await expect(exportBtn).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      exportBtn.click(),
    ]);
    const name = await download.suggestedFilename();
    expect(name).toMatch(/^需求1_\d{14}\.xmind$/);
  });
});
