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
    await page.evaluate(() => {
      const state = window.app && window.app.state;
      const api = window.app && window.app.casesgen;
      if (!state || !api || !state.caseGenModules || !state.caseGenModules.length) return;
      const mod = state.caseGenModules[0];
      state.caseGenResults[mod.id] = JSON.stringify([{
        module: mod.title || '登录模块',
        title: '登录成功',
        priority: 'P1',
        preconditions: '',
        steps: '步骤1',
        expected: '成功',
      }], null, 2);
      if (window.app && window.app.requirement && typeof window.app.requirement.setRequirementLabel === 'function') {
        window.app.requirement.setRequirementLabel('需求1', 'ui-test');
      } else {
        state.requirementLabel = '需求1';
        state.requirementLabelSource = 'ui-test';
      }
      if (typeof api.renderCaseGeneration === 'function') {
        api.renderCaseGeneration();
      }
      if (window.app && window.app.flow && typeof window.app.flow.refreshExportCaseGenButton === 'function') {
        window.app.flow.refreshExportCaseGenButton();
      } else {
        const btn = document.getElementById('exportCaseGen');
        if (btn) btn.disabled = false;
      }
    });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#exportCaseGen'),
    ]);
    const name = await download.suggestedFilename();
    expect(name).toMatch(/^需求1_\d{14}\.xmind$/);
  });
});
