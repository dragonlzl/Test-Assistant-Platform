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
      if (dialog.type() === 'prompt') {
        await dialog.accept('1');
      } else {
        await dialog.accept();
      }
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
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
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
    await expect(page.locator('#caseGenStatus')).toContainText('请先在“功能工作流”或“用例执行”导入用例', { timeout: 5000 });
  });

  test('未勾选用例时直接转执行给出提示', async ({ page }) => {
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
      var state = window.app.state;
      var mod = state.caseGenModules[0];
      var cases = [
        { module: '登录', title: '未选用例1', priority: 'P1', preconditions: '', steps: ['步骤1'], expected: '预期1' },
      ];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    await page.click('#transferSelectedToExec');
    await expect(page.locator('#caseGenStatus')).toContainText('请到各个模块的用例视图中勾选用例', { timeout: 3000 });
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
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    const workflowValue = await page.evaluate(() => {
      var opt = document.querySelector('#appendTargetSelect option[value^="workflow:"]');
      return opt ? opt.value : '';
    });
    if (workflowValue) {
      await page.selectOption('#appendTargetSelect', workflowValue);
    }
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
    await expect(page.locator('#caseGenStatus')).toContainText('成功新增到【', { timeout: 5000 });
    await expect(page.locator('#caseGenStatus')).toContainText('含 1 条重复已跳过', { timeout: 5000 });
    expect(importedCount).toBe(2);
    expect(execCount).toBe(2);
  });

  test('多份功能工作流导入用例都可选择', async ({ page }) => {
    await page.evaluate(() => {
      window.app.state.importedCases = [
        { id: 'wf-a', name: '工作流用例A', list: [{ module: '登录', title: '已有1' }] },
        { id: 'wf-b', name: '工作流用例B', list: [{ module: '支付', title: '已有2' }] },
      ];
      if (window.app.casesCore && window.app.casesCore.renderImportedCaseList) {
        window.app.casesCore.renderImportedCaseList();
      }
    });
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
      if (window.app.casesGenApi && window.app.casesGenApi.renderAppendTargetOptions) {
        window.app.casesGenApi.renderAppendTargetOptions();
      }
    });
    const workflowOptions = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#appendTargetSelect option[value^="workflow:"]')).map(function(opt) {
        return opt.textContent;
      });
    });
    expect(workflowOptions.length).toBe(2);
    expect(workflowOptions).toEqual(expect.arrayContaining(['工作流用例A', '工作流用例B']));
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
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    const workflowValue = await page.evaluate(() => {
      var opt = document.querySelector('#appendTargetSelect option[value^="workflow:"]');
      return opt ? opt.value : '';
    });
    if (workflowValue) {
      await page.selectOption('#appendTargetSelect', workflowValue);
    }
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

  test('工作流为空时追加到执行历史用例', async ({ page }) => {
    await page.evaluate(() => {
      window.app.state.importedCases = [];
      window.app.state.tempExecFiles = [{
        id: 'exec-1',
        name: '历史执行用例',
        requirement: 'UI自动化需求',
        fromImport: true,
        reuseEnabled: false,
        cases: [{
          id: 'exec-1-0',
          module: '登录',
          title: '已有用例',
          priority: 'P1',
          preconditions: '前置',
          steps: '旧步骤',
          expected: '旧预期',
          actual: '通过',
          remark: '旧备注',
          reuseDetails: [],
          defectLinks: [],
        }],
      }];
      window.app.state.tempExecPages = {};
    });
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
      var state = window.app.state;
      var mod = state.caseGenModules[0];
      var cases = [
        { module: '登录', title: '已有用例', priority: 'P1', preconditions: '', steps: ['重复'], expected: '重复预期' },
        { module: '登录', title: '新增用例B', priority: 'P2', preconditions: '', steps: ['新步骤'], expected: '新预期' },
      ];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    const selectValue = await page.evaluate(() => {
      var opt = document.querySelector('#appendTargetSelect option[value^="exec:"]');
      return opt ? opt.value : '';
    });
    if (selectValue) {
      await page.selectOption('#appendTargetSelect', selectValue);
    }
    await page.evaluate(() => {
      var state = window.app.state;
      var mod = state.caseGenModules[0];
      state.caseSelections[mod.id] = new Set([0, 1]);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.refreshAppendExistingButton === 'function') {
        window.app.casesGenApi.refreshAppendExistingButton();
      }
    });
    await page.evaluate(async () => {
      await window.app.casesGenApi.appendSelectedCasesToImported();
    });
    const execData = await page.evaluate(() => {
      var file = window.app.state.tempExecFiles[0];
      var found = file.cases.find(function(c) { return c.title === '已有用例'; });
      return {
        count: file.cases.length,
        titles: file.cases.map(function(c) { return c.title; }),
        actual: found ? found.actual : '',
      };
    });
    expect(execData.count).toBe(2);
    expect(execData.titles).toEqual(expect.arrayContaining(['已有用例', '新增用例B']));
    expect(execData.actual).toBe('通过');
  });

  test('相同需求下同步执行记录并追加', async ({ page }) => {
    const importedCases = '[{"module":"登录","title":"已有用例","priority":"P1","preconditions":"前置","steps":["旧步骤"],"expected":"旧预期"}]';
    await page.setInputFiles('#caseFileInput', {
      name: 'imported_cases.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importedCases),
    });
    await page.evaluate(() => {
      window.app.state.tempExecFiles = [{
        id: 'exec-2',
        name: '执行用例-同需求',
        requirement: 'UI自动化需求',
        fromImport: true,
        reuseEnabled: true,
        cases: [{
          id: 'exec-2-0',
          module: '登录',
          title: '已有用例',
          priority: 'P1',
          preconditions: '前置',
          steps: '旧步骤',
          expected: '旧预期',
          actual: '通过',
          remark: '保留备注',
          reuseDetails: [{ id: 'reuse-1', text: '复用数据' }],
          defectLinks: [],
        }],
      }];
    });
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
      var state = window.app.state;
      var mod = state.caseGenModules[0];
      var cases = [
        { module: '登录', title: '已有用例', priority: 'P1', preconditions: '前置', steps: ['重复'], expected: '重复预期' },
        { module: '登录', title: '新增用例C', priority: 'P2', preconditions: '', steps: ['新步骤'], expected: '新预期' },
      ];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      state.caseSelections[mod.id] = new Set([0, 1]);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    const workflowValue = await page.evaluate(() => {
      var opt = document.querySelector('#appendTargetSelect option[value^="workflow:"]');
      return opt ? opt.value : '';
    });
    if (workflowValue) {
      await page.selectOption('#appendTargetSelect', workflowValue);
    }
    await page.evaluate(async () => {
      await window.app.casesGenApi.appendSelectedCasesToImported();
    });
    const execInfo = await page.evaluate(() => {
      var file = window.app.state.tempExecFiles.find(function(f) { return f.id === 'exec-2'; });
      var hit = file.cases.find(function(c) { return c.title === '已有用例'; });
      return {
        reuseEnabled: file.reuseEnabled,
        titles: file.cases.map(function(c) { return c.title; }),
        actual: hit ? hit.actual : '',
        remark: hit ? hit.remark : '',
      };
    });
    expect(execInfo.reuseEnabled).toBe(true);
    expect(execInfo.titles).toEqual(expect.arrayContaining(['已有用例', '新增用例C']));
    expect(execInfo.actual).toBe('通过');
    expect(execInfo.remark).toBe('保留备注');
  });

  test('无导入时勾选用例直接转到执行页', async ({ page }) => {
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
    const moduleId = await page.evaluate(() => {
      var state = window.app.state;
      var mod = state.caseGenModules[0];
      var cases = [
        { module: '登录', title: '新增用例E', priority: 'P1', preconditions: '', steps: ['步骤1'], expected: '预期1' },
        { module: '登录', title: '新增用例F', priority: 'P2', preconditions: '', steps: ['步骤2'], expected: '预期2' },
      ];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      state.caseSelections[mod.id] = new Set([0, 1]);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
      return mod.id;
    });
    const debugState2 = await page.evaluate((id) => {
      var state = window.app.state;
      state.caseSelections[id] = new Set([0, 1]);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.refreshAppendExistingButton === 'function') {
        window.app.casesGenApi.refreshAppendExistingButton();
      }
      var selection = state.caseSelections[id];
      var raw = state.caseGenResults[id] || '[]';
      var list = [];
      try { list = JSON.parse(raw); } catch (err) { list = []; }
      var hasSelection = false;
      if (selection && list.length) {
        selection.forEach(function(idx) { if (!hasSelection && list[idx]) hasSelection = true; });
      }
      return {
        selectionSize: selection ? selection.size : 0,
        listLen: list.length,
        hasSelection: hasSelection,
        disabled: document.getElementById('transferSelectedToExec').disabled,
      };
    }, moduleId);
    expect(debugState2.hasSelection).toBe(true);
    const debugState = await page.evaluate((id) => {
      var state = window.app.state;
      state.caseSelections[id] = new Set([0, 1]);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.refreshAppendExistingButton === 'function') {
        window.app.casesGenApi.refreshAppendExistingButton();
      }
      var selection = state.caseSelections[id];
      var raw = state.caseGenResults[id] || '[]';
      var list = [];
      try { list = JSON.parse(raw); } catch (err) { list = []; }
      var hasSelection = false;
      if (selection && list.length) {
        selection.forEach(function(idx) { if (!hasSelection && list[idx]) hasSelection = true; });
      }
      return {
        selectionSize: selection ? selection.size : 0,
        listLen: list.length,
        hasSelection: hasSelection,
        disabled: document.getElementById('transferSelectedToExec').disabled,
      };
    }, moduleId);
    expect(debugState.hasSelection).toBe(true);
    const transferBtn = page.locator('#transferSelectedToExec');
    await expect(transferBtn).toBeEnabled();
    await transferBtn.click();
    const execData = await page.evaluate(() => {
      var files = window.app.state.tempExecFiles || [];
      var latest = files[files.length - 1];
      return {
        count: files.length,
        latestCount: latest && latest.cases ? latest.cases.length : 0,
        activeId: window.app.state.tempExecActiveId || '',
        latestName: latest && latest.name ? latest.name : '',
      };
    });
    expect(execData.count).toBe(1);
    expect(execData.latestCount).toBe(2);
    expect(execData.activeId).not.toBe('');
    expect(execData.latestName.indexOf('勾选用例-')).toBe(-1);
    expect(execData.latestName).toBe('UI自动化需求');
  });

  test('存在导入时勾选用例直接转到执行页需确认', async ({ page }) => {
    const importedCases = '[{"module":"登录","title":"已有用例","priority":"P1","preconditions":"前置","steps":["旧步骤"],"expected":"旧预期"}]';
    await page.setInputFiles('#caseFileInput', {
      name: 'workflow_cases_multi.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importedCases),
    });
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
    const moduleId = await page.evaluate(() => {
      var state = window.app.state;
      var mod = state.caseGenModules[0];
      var cases = [
        { module: '登录', title: '新增用例G', priority: 'P1', preconditions: '', steps: ['步骤1'], expected: '预期1' },
      ];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
      return mod.id;
    });
    await page.evaluate((id) => {
      var state = window.app.state;
      state.caseSelections[id] = new Set([0]);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.refreshAppendExistingButton === 'function') {
        window.app.casesGenApi.refreshAppendExistingButton();
      }
    }, moduleId);
    const transferBtn = page.locator('#transferSelectedToExec');
    await expect(transferBtn).toBeEnabled();
    await transferBtn.click();
    const execData = await page.evaluate(() => {
      var files = window.app.state.tempExecFiles || [];
      var latest = files[files.length - 1];
      return {
        count: files.length,
        latestCount: latest && latest.cases ? latest.cases.length : 0,
      };
    });
    expect(execData.count).toBe(1);
    expect(execData.latestCount).toBe(1);
  });

  test('用例视图抽屉勾选后启用确认新增', async ({ page }) => {
    const importedCases = '[{"module":"登录","title":"已有用例","priority":"P1","preconditions":"前置","steps":["旧步骤"],"expected":"旧预期"}]';
    await page.setInputFiles('#caseFileInput', {
      name: 'workflow_cases.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importedCases),
    });

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

    const moduleId = await page.evaluate(() => {
      var state = window.app.state;
      var mod = state.caseGenModules && state.caseGenModules[0];
      var cases = [
        { module: '登录', title: '新增用例D', priority: 'P1', preconditions: '前置', steps: ['步骤1'], expected: '预期1' },
      ];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      state.caseSelections[mod.id] = new Set();
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
      return mod.id;
    });

    const workflowValue = await page.evaluate(() => {
      var opt = document.querySelector('#appendTargetSelect option[value^="workflow:"]');
      return opt ? opt.value : '';
    });
    if (workflowValue) {
      await page.selectOption('#appendTargetSelect', workflowValue);
    }
    const confirmBtn = page.locator('#appendToExistingCases');
    await expect(confirmBtn).toBeDisabled();

    await page.evaluate((id) => {
      if (window.app && window.app.casesGenApi && typeof window.app.casesGenApi.toggleCaseView === 'function') {
        window.app.casesGenApi.toggleCaseView(id);
      }
    }, moduleId);
    await expect(page.locator('#caseGenViewDrawer')).toHaveClass(/open/, { timeout: 2000 });
    await page.click('input[data-case-select="' + moduleId + '"]');
    await expect(confirmBtn).toBeEnabled();

    await page.click('#closeCaseGenViewDrawerBtn');
    await confirmBtn.click();
    await expect(page.locator('#caseGenStatus')).toContainText('成功新增到', { timeout: 5000 });
    await expect(page.locator('#appendTargetSelect')).toHaveValue('');
  });
});
