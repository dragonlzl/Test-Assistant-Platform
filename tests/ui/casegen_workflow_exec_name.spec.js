const { test, expect } = require('@playwright/test');

test.describe('工作流导入同步执行命名', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      var url = route.request().url();
      if (url.indexOf('http://localhost') === 0 || url.indexOf('http://127.0.0.1') === 0 || url.indexOf('file:') === 0) {
        route.continue();
        return;
      }
      route.abort();
    });
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('UI自动化需求');
      } else {
        await dialog.accept();
      }
    });
    page.on('console', (msg) => console.log('console', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('pageerror', err.message));
    var base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(function() { return window.app && window.app._inited === true; }, {}, { timeout: 20000 });
    await page.evaluate(function() {
      try {
        localStorage.clear();
      } catch (err) {
        // ignore
      }
      if (window.app && window.app.state) {
        window.app.state.tempExecFiles = [];
        window.app.state.tempExecPages = {};
        window.app.state.tempExecActiveId = '';
        window.app.state.requirementLabel = 'UI自动化需求';
        window.app.state.requirementLabelSource = 'ui-test';
      }
    });
    await page.click('[data-tab-btn="clean"]');
  });

  test('追加工作流用例同步执行文件名去重时间戳', async ({ page }) => {
    await page.evaluate(function() {
      window.app.state.importedCases = [{
        id: 'wf-case',
        name: '登录用例_20200101000000.xmind',
        list: [{
          module: '登录',
          title: '已有用例',
          priority: 'P1',
          preconditions: '',
          steps: ['旧步骤'],
          expected: '旧预期',
        }],
      }];
      if (window.app.casesCore && window.app.casesCore.renderImportedCaseList) {
        window.app.casesCore.renderImportedCaseList();
      }
    });

    var splitPayload = JSON.stringify([{ module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] }]);
    await page.evaluate(function(text) {
      var el = document.getElementById('splitResult');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, splitPayload);
    await page.click('#goUsecaseGen');
    await page.waitForSelector('#casesGenerationContainer [data-module-id]', { timeout: 5000 });

    await page.evaluate(function() {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.caseGenModules || !state.caseGenModules.length) return;
      var mod = state.caseGenModules[0];
      var cases = [{
        module: '登录',
        title: '追加用例',
        priority: 'P1',
        preconditions: '前置',
        steps: ['步骤1'],
        expected: '预期1',
      }];
      state.caseGenResults[mod.id] = JSON.stringify(cases, null, 2);
      state.caseSelections[mod.id] = new Set([0]);
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
        window.app.casesGenApi.renderCaseGeneration();
      } else if (window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
      if (window.app.casesGenApi && typeof window.app.casesGenApi.renderAppendTargetOptions === 'function') {
        window.app.casesGenApi.renderAppendTargetOptions();
      }
    });

    var workflowValue = await page.evaluate(function() {
      var opt = document.querySelector('#appendTargetSelect option[value^="workflow:"]');
      return opt ? opt.value : '';
    });
    if (workflowValue) {
      await page.selectOption('#appendTargetSelect', workflowValue);
    }

    await page.evaluate(async function() {
      if (window.app.casesGenApi && window.app.casesGenApi.appendSelectedCasesToImported) {
        await window.app.casesGenApi.appendSelectedCasesToImported();
      }
    });

    await expect.poll(async function() {
      return page.evaluate(function() {
        var files = window.app.state && window.app.state.tempExecFiles;
        var last = files && files.length ? files[files.length - 1] : null;
        return last && last.name ? last.name : '';
      });
    }, { timeout: 5000 }).toMatch(/^登录用例_\d{14}$/);

    var rootTitle = await page.evaluate(async function() {
      var files = window.app.state && window.app.state.tempExecFiles;
      var last = files && files.length ? files[files.length - 1] : null;
      if (!last) return '';
      var builder = window.app && window.app.xmindCoreApi && window.app.xmindCoreApi.buildTempExecXmindPackage;
      if (typeof builder !== 'function' || !window.JSZip) return '';
      var result = await builder(last, last.requirement);
      if (!result || !result.blob) return '';
      var zip = new window.JSZip();
      var loaded = await zip.loadAsync(result.blob);
      var content = loaded && loaded.file ? await loaded.file('content.json').async('string') : '';
      if (!content) return '';
      var parsed = JSON.parse(content);
      var sheet = Array.isArray(parsed) ? parsed[0] : parsed;
      return sheet && sheet.rootTopic && sheet.rootTopic.title ? sheet.rootTopic.title : '';
    });
    expect(rootTitle).toMatch(/^登录用例/);

    var rootTitleNoResult = await page.evaluate(async function() {
      var files = window.app.state && window.app.state.tempExecFiles;
      var last = files && files.length ? files[files.length - 1] : null;
      if (!last) return '';
      var builder = window.app && window.app.xmindCoreApi && window.app.xmindCoreApi.buildXmindPackageFromCases;
      if (typeof builder !== 'function' || !window.JSZip) return '';
      var pkg = await builder(last.cases, last.name, last.requirement);
      if (!pkg || !pkg.blob) return '';
      var zip = new window.JSZip();
      var loaded = await zip.loadAsync(pkg.blob);
      var content = loaded && loaded.file ? await loaded.file('content.json').async('string') : '';
      if (!content) return '';
      var parsed = JSON.parse(content);
      var sheet = Array.isArray(parsed) ? parsed[0] : parsed;
      return sheet && sheet.rootTopic && sheet.rootTopic.title ? sheet.rootTopic.title : '';
    });
    expect(rootTitleNoResult).toMatch(/^登录用例/);

    var containsOldStamp = await page.evaluate(function() {
      var files = window.app.state && window.app.state.tempExecFiles;
      var last = files && files.length ? files[files.length - 1] : null;
      if (!last || !last.name) return false;
      return last.name.indexOf('20200101000000') !== -1;
    });
    expect(containsOldStamp).toBe(false);
  });
});
