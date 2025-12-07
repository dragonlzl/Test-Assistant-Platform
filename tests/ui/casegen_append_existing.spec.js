const { test, expect } = require('@playwright/test');

test.describe('用例生成追加到已有用例', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.click('[data-tab-btn="clean"]');
    await page.evaluate(() => {
      window.app.state.requirementLabel = 'UI自动化需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });
  });

  test('未导入已有用例时提示先导入', async ({ page }) => {
    const splitPayload = JSON.stringify([{ module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] }]);
    await page.evaluate((text) => {
      var el = document.getElementById('splitResult');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, splitPayload);
    await page.click('#goUsecaseGen');
    await page.waitForSelector('#casesGenerationContainer [data-module-id]', { timeout: 5000 });

    await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.caseGenModules || !state.caseGenModules.length) return;
      var mod = state.caseGenModules[0];
      var cases = [{
        module: '登录',
        title: '新增用例1',
        priority: 'P1',
        preconditions: '前置',
        steps: ['步骤1'],
        expected: '预期',
      }];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      state.caseSelections[mod.id] = new Set();
      if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    const statusText = await page.evaluate(async () => {
      var state = window.app.state;
      var mod = state.caseGenModules && state.caseGenModules[0];
      if (mod) {
        state.caseSelections[mod.id] = new Set([0]);
      }
      if (window.app.casesGenApi && window.app.casesGenApi.appendSelectedCasesToImported) {
        await window.app.casesGenApi.appendSelectedCasesToImported();
      }
      var statusEl = document.getElementById('caseGenStatus');
      return statusEl ? statusEl.textContent : '';
    });
    await expect(page.locator('#caseGenStatus')).toContainText('请先在“功能工作流”导入', { timeout: 5000 });
  });

  test('已导入用例时追加并跳过重复标题', async ({ page }) => {
    const importedCases = '[{"module":"登录","title":"已有用例","priority":"P1","preconditions":"前置","steps":["旧步骤"],"expected":"旧预期"}]';
    await page.setInputFiles('#caseFileInput', {
      name: 'imported_cases.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importedCases),
    });
    await expect(page.locator('#caseStatus')).toContainText('已导入', { timeout: 5000 });

    const splitPayload = JSON.stringify([{ module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] }]);
    await page.evaluate((text) => {
      var el = document.getElementById('splitResult');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, splitPayload);
    await page.click('#goUsecaseGen');
    await page.waitForSelector('#casesGenerationContainer [data-module-id]', { timeout: 5000 });

    await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.caseGenModules || !state.caseGenModules.length) return;
      var mod = state.caseGenModules[0];
      var cases = [
        { module: '登录', title: '已有用例', priority: 'P1', preconditions: '前置', steps: ['重复'], expected: '重复预期' },
        { module: '登录', title: '新增用例A', priority: 'P2', preconditions: '', steps: ['新步骤'], expected: '新预期' },
      ];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      state.caseSelections[mod.id] = new Set();
      if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    const statusText = await page.evaluate(async () => {
      var state = window.app.state;
      var mod = state.caseGenModules && state.caseGenModules[0];
      if (mod) {
        state.caseSelections[mod.id] = new Set([0, 1]);
      }
      if (window.app.casesGenApi && window.app.casesGenApi.appendSelectedCasesToImported) {
        await window.app.casesGenApi.appendSelectedCasesToImported();
      }
      var statusEl = document.getElementById('caseGenStatus');
      return statusEl ? statusEl.textContent : '';
    });
    const importedCount = await page.evaluate(() => {
      var cases = [];
      var imported = window.app.state && window.app.state.importedCases;
      if (Array.isArray(imported)) {
        imported.forEach(function(item) {
          if (Array.isArray(item.list)) cases = cases.concat(item.list);
        });
      }
      return cases.length;
    });
    const execCount = await page.evaluate(() => {
      var entry = window.app.state.tempExecFiles && window.app.state.tempExecFiles[window.app.state.tempExecFiles.length - 1];
      return entry && Array.isArray(entry.cases) ? entry.cases.length : 0;
    });
    await expect(page.locator('#caseGenStatus')).toContainText('含 1 条重复已跳过', { timeout: 5000 });
    await expect(page.locator('#caseGenStatus')).toContainText('同步到用例执行', { timeout: 5000 });
    expect(importedCount).toBe(2);
    expect(execCount).toBe(2);
  });

  test('全部重复时提示无需新增', async ({ page }) => {
    const importedCases = '[{"module":"登录","title":"已有用例","priority":"P1","preconditions":"前置","steps":["旧步骤"],"expected":"旧预期"}]';
    await page.setInputFiles('#caseFileInput', {
      name: 'imported_cases.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importedCases),
    });
    await expect(page.locator('#caseStatus')).toContainText('已导入', { timeout: 5000 });

    const splitPayload = JSON.stringify([{ module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] }]);
    await page.evaluate((text) => {
      var el = document.getElementById('splitResult');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, splitPayload);
    await page.click('#goUsecaseGen');
    await page.waitForSelector('#casesGenerationContainer [data-module-id]', { timeout: 5000 });

    await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.caseGenModules || !state.caseGenModules.length) return;
      var mod = state.caseGenModules[0];
      var cases = [
        { module: '登录', title: '已有用例', priority: 'P1', preconditions: '前置', steps: ['重复'], expected: '重复预期' },
      ];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      state.caseSelections[mod.id] = new Set();
      if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    const statusText = await page.evaluate(async () => {
      var state = window.app.state;
      var mod = state.caseGenModules && state.caseGenModules[0];
      if (mod) {
        state.caseSelections[mod.id] = new Set([0]);
      }
      if (window.app.casesGenApi && window.app.casesGenApi.appendSelectedCasesToImported) {
        await window.app.casesGenApi.appendSelectedCasesToImported();
      }
      var statusEl = document.getElementById('caseGenStatus');
      return statusEl ? statusEl.textContent : '';
    });
    await expect(page.locator('#caseGenStatus')).toHaveText(/用例已经包含将要导入的用例，无需重复新增/, { timeout: 5000 });
  });
});
