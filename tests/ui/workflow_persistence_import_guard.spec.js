const { test, expect } = require('@playwright/test');

async function seedXmindWorkspaceResult(page, options = {}) {
  const workspaceId = options.workspaceId || 'xmind-import-keep';
  const workspaceTitle = options.workspaceTitle || '旧 XMind 需求';
  const moduleId = options.moduleId || 'xmind-mod-1';
  const moduleTitle = options.moduleTitle || '旧 XMind 模块';
  const caseTitle = options.caseTitle || '旧 XMind 用例';
  await page.evaluate(({ workspaceId, workspaceTitle, moduleId, moduleTitle, caseTitle }) => {
    var app = window.app || {};
    var state = app.state || null;
    if (!state || !state.xmindCaseGen) return;
    var host = state.xmindCaseGen;
    var now = Date.now();
    function buildCases() {
      return JSON.stringify([{
        module: moduleTitle,
        title: caseTitle,
        priority: 'P1',
        preconditions: moduleTitle + '前置条件',
        steps: ['1、进入' + moduleTitle, '2、执行' + caseTitle],
        expected: caseTitle + '执行成功',
      }], null, 2);
    }
    var xmindSnapshot = JSON.parse(JSON.stringify(host || {}));
    xmindSnapshot.prep = xmindSnapshot.prep && typeof xmindSnapshot.prep === 'object'
      ? xmindSnapshot.prep
      : {};
    xmindSnapshot.prep.requirementMode = 'manual';
    xmindSnapshot.prep.manualRequirementLabel = workspaceTitle;
    xmindSnapshot.prep.completed = true;
    xmindSnapshot.viewState = xmindSnapshot.viewState && typeof xmindSnapshot.viewState === 'object'
      ? xmindSnapshot.viewState
      : {};
    xmindSnapshot.viewState.drawerOpen = false;
    xmindSnapshot.viewState.fullscreen = false;
    xmindSnapshot.viewState.transform = '';
    xmindSnapshot.viewState.scaleVal = 1;
    xmindSnapshot.viewState.scrollLeft = 0;
    xmindSnapshot.viewState.scrollTop = 0;
    xmindSnapshot.viewState.collapsedNodeKeys = [];
    xmindSnapshot.viewState.treeSourceSignature = '';
    xmindSnapshot.viewState.updatedAt = now;
    host.activeWorkspaceId = workspaceId;
    host.workspaceOrder = [workspaceId];
    host.nextWorkspaceSeq = 2;
    host.workspaces = {};
    host.workspaces[workspaceId] = {
      id: workspaceId,
      seq: 1,
      name: workspaceTitle,
      pendingOpenPrep: false,
      updatedAt: now,
      createdAt: now,
      snapshot: {
        xmind: xmindSnapshot,
        shared: {
          requirementLabel: workspaceTitle,
          requirementLabelSource: 'workspace',
          lastRawImportName: 'old-xmind.txt',
          rawText: '旧 XMind 需求正文',
          caseText: '',
          importedCases: [],
          caseGenModules: [{
            id: moduleId,
            title: moduleTitle,
            module: moduleTitle,
            key_scenarios: [moduleTitle + '主场景'],
            test_points: [moduleTitle + '关键校验'],
            coupled_modules: [],
          }],
          caseGenSource: 'xmind-seeded',
          caseGenResults: {},
          caseSelections: {},
          caseGenSuggestions: {},
          caseGenModuleStatus: {},
          caseGenProgress: {},
          caseGenTiming: {},
          caseGenProgressNotice: {},
          caseGenSettings: JSON.parse(JSON.stringify(state.caseGenSettings || {})),
          requirementMedia: {
            docxImages: [],
            pastedImages: [],
            lastDocxImageCount: 0,
            updatedAt: now,
          },
        },
      },
    };
    host.workspaces[workspaceId].snapshot.shared.caseGenResults[moduleId] = buildCases();
    if (!state.caseGenSettings || typeof state.caseGenSettings !== 'object') {
      state.caseGenSettings = {};
    }
    state.caseGenSettings.activeTab = 'xmind-modules';
    state.caseGenModules = JSON.parse(JSON.stringify(host.workspaces[workspaceId].snapshot.shared.caseGenModules));
    state.caseGenSource = String(host.workspaces[workspaceId].snapshot.shared.caseGenSource || '');
    state.caseGenResults = JSON.parse(JSON.stringify(host.workspaces[workspaceId].snapshot.shared.caseGenResults));
    state.caseSelections = {};
    state.caseGenSuggestions = {};
    state.caseGenModuleStatus = {};
    state.caseGenProgress = {};
    state.caseGenTiming = {};
    state.caseGenProgressNotice = {};
    state.caseGenRunning = new Set();
    if (app.casesGenApi && typeof app.casesGenApi.renderCaseGenProgressBoard === 'function') {
      app.casesGenApi.renderCaseGenProgressBoard();
    }
  }, { workspaceId, workspaceTitle, moduleId, moduleTitle, caseTitle });
}

test.describe('需求导入确认与持久化', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('file:') ||
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        url.startsWith('about:')
      ) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
      } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  });

  test('无数据导入不提示确认', async ({ page }) => {
    await page.evaluate(() => {
      try { localStorage.removeItem('usecase-workflow-state-v1'); } catch (_) {}
    });
    await page.setInputFiles('#fileInput', {
      name: 'req-a.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Requirement A'),
    });
    await expect(page.locator('#rawText')).toHaveValue('Requirement A');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/open/);
  });

  test('已有数据导入需确认，取消后保留原内容', async ({ page }) => {
    await page.evaluate(() => {
      try { localStorage.removeItem('usecase-workflow-state-v1'); } catch (_) {}
    });
    await page.setInputFiles('#fileInput', {
      name: 'old.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Old requirement'),
    });
    await expect(page.locator('#rawText')).toHaveValue('Old requirement');
    await page.evaluate(() => {
      var review = document.getElementById('reviewResult');
      if (review) review.value = 'Old review';
    });

    await page.setInputFiles('#fileInput', {
      name: 'new.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('New requirement'),
    });
    const drawer = page.locator('#appConfirmDrawer');
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('已有 XMind 用例生成页签和结果会保留');
    await page.click('#appConfirmDrawerCancelBtn');
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('#rawText')).toHaveValue('Old requirement');
    await expect(page.locator('#reviewResult')).toHaveValue('Old review');

    await page.setInputFiles('#fileInput', {
      name: 'new.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('New requirement'),
    });
    await expect(drawer).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('#rawText')).toHaveValue('New requirement');
    await expect(page.locator('#reviewResult')).toHaveValue('');
  });

  test('确认重新导入需求后保留 XMind 页签与结果', async ({ page }) => {
    await page.evaluate(() => {
      try { localStorage.removeItem('usecase-workflow-state-v1'); } catch (_) {}
    });
    await page.setInputFiles('#fileInput', {
      name: 'old.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Old requirement'),
    });
    await expect(page.locator('#rawText')).toHaveValue('Old requirement');
    await page.evaluate(() => {
      var review = document.getElementById('reviewResult');
      if (review) review.value = 'Old review';
    });
    await seedXmindWorkspaceResult(page, {
      workspaceId: 'xmind-import-keep',
      workspaceTitle: '旧 XMind 需求',
      moduleId: 'xmind-mod-keep',
      moduleTitle: '旧 XMind 模块',
      caseTitle: '旧 XMind 用例',
    });
    await expect(page.locator('#caseGenProgressList')).toContainText('旧 XMind 需求');
    await expect(page.locator('#caseGenProgressList')).toContainText('1 模块');
    await expect(page.locator('#caseGenProgressList')).toContainText('1 用例');

    await page.setInputFiles('#fileInput', {
      name: 'new.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('New requirement'),
    });
    const drawer = page.locator('#appConfirmDrawer');
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('已有 XMind 用例生成页签和结果会保留');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('#rawText')).toHaveValue('New requirement');
    await expect(page.locator('#reviewResult')).toHaveValue('');
    await expect(page.locator('#caseGenProgressList')).toContainText('旧 XMind 需求');
    await expect(page.locator('#caseGenProgressList')).toContainText('1 模块');
    await expect(page.locator('#caseGenProgressList')).toContainText('1 用例');

    await page.click('[data-casegen-workspace="xmind-import-keep"]');
    await expect(page.locator('#xmindCaseGenDrawer')).toHaveClass(/open/);
    await expect(page.locator('#xmindCaseGenWorkspaceList')).toContainText('旧 XMind 需求');

    const snapshot = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      if (!host || !host.workspaces || !host.workspaces['xmind-import-keep']) {
        return { workspaceCount: 0, caseText: '' };
      }
      var record = host.workspaces['xmind-import-keep'];
      var resultMap = record && record.snapshot && record.snapshot.shared
        ? record.snapshot.shared.caseGenResults
        : {};
      return {
        workspaceCount: Array.isArray(host.workspaceOrder) ? host.workspaceOrder.length : 0,
        caseText: resultMap && resultMap['xmind-mod-keep'] ? String(resultMap['xmind-mod-keep']) : '',
      };
    });
    expect(snapshot.workspaceCount).toBe(1);
    expect(snapshot.caseText).toContain('旧 XMind 用例');
  });

  test('活动 XMind workspace 后台完成时，不覆盖旧流程 live 模块与需求上下文', async ({ page }) => {
    await page.evaluate(() => {
      var app = window.app || {};
      var state = app.state || null;
      if (!state || !state.xmindCaseGen) return;
      var now = Date.now();
      var workspaceId = 'xmind-live-isolation';
      var legacyResult = JSON.stringify([{
        module: '旧流程模块',
        title: '旧流程用例',
        priority: 'P1',
        preconditions: '旧流程前置条件',
        steps: ['1、执行旧流程'],
        expected: '旧流程结果正确',
      }], null, 2);
      var xmindHost = state.xmindCaseGen;
      var xmindSnapshot = JSON.parse(JSON.stringify(xmindHost || {}));
      xmindSnapshot.prep = xmindSnapshot.prep && typeof xmindSnapshot.prep === 'object'
        ? xmindSnapshot.prep
        : {};
      xmindSnapshot.prep.requirementMode = 'manual';
      xmindSnapshot.prep.manualRequirementLabel = 'XMind后台需求';
      xmindSnapshot.prep.completed = true;
      xmindSnapshot.viewState = xmindSnapshot.viewState && typeof xmindSnapshot.viewState === 'object'
        ? xmindSnapshot.viewState
        : {};
      xmindSnapshot.viewState.drawerOpen = false;
      xmindSnapshot.viewState.fullscreen = false;
      xmindSnapshot.viewState.updatedAt = now;

      xmindHost.activeWorkspaceId = workspaceId;
      xmindHost.workspaceOrder = [workspaceId];
      xmindHost.nextWorkspaceSeq = 2;
      xmindHost.workspaces = {};
      xmindHost.workspaces[workspaceId] = {
        id: workspaceId,
        seq: 1,
        name: 'XMind后台需求',
        pendingOpenPrep: false,
        updatedAt: now,
        createdAt: now,
        snapshot: {
          xmind: xmindSnapshot,
          shared: {
            requirementLabel: 'XMind后台需求',
            requirementLabelSource: 'workspace',
            lastRawImportName: 'xmind-background.txt',
            rawText: 'XMind后台原文',
            caseText: '',
            importedCases: [],
            caseGenModules: [{
              id: 'xmind-seed-mod',
              title: 'XMind旧模块',
              module: 'XMind旧模块',
              key_scenarios: ['XMind旧场景'],
              test_points: ['XMind旧校验'],
              coupled_modules: [],
            }],
            caseGenSource: 'xmind-seeded',
            caseGenResults: {},
            caseSelections: {},
            caseGenSuggestions: {},
            caseGenModuleStatus: {},
            caseGenProgress: {},
            caseGenTiming: {},
            caseGenProgressNotice: {},
            caseGenSettings: JSON.parse(JSON.stringify(state.caseGenSettings || {})),
            requirementMedia: {
              docxImages: [],
              pastedImages: [],
              lastDocxImageCount: 0,
              updatedAt: now,
            },
          },
        },
      };

      state.activeTab = 'auto';
      state.requirementLabel = '旧流程需求';
      state.requirementLabelSource = 'import';
      state.lastRawImportName = 'legacy-requirement.txt';
      state.caseGenSettings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : {};
      state.caseGenSettings.activeTab = 'legacy-modules';
      state.caseGenModules = [{
        id: 'legacy-mod',
        title: '旧流程模块',
        module: '旧流程模块',
        scenarios: ['旧流程主场景'],
        points: ['旧流程关键校验'],
        coupled: [],
      }];
      state.caseGenSource = 'legacy-flow';
      state.caseGenResults = { 'legacy-mod': legacyResult };
      state.importedCases = [{
        id: 'legacy-import-1',
        name: 'legacy-cases.xmind',
        requirement: '旧流程需求',
      }];
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      state.caseGenProgressNotice = {};
      if (state.caseGenLegacy && typeof state.caseGenLegacy === 'object') {
        state.caseGenLegacy.requirementLabel = '旧流程需求';
        state.caseGenLegacy.requirementLabelSource = 'import';
        state.caseGenLegacy.lastRawImportName = 'legacy-requirement.txt';
        state.caseGenLegacy.rawText = '旧流程原文';
        state.caseGenLegacy.caseText = '旧流程导入用例正文';
        state.caseGenLegacy.importedCases = JSON.parse(JSON.stringify(state.importedCases));
        state.caseGenLegacy.modules = JSON.parse(JSON.stringify(state.caseGenModules));
        state.caseGenLegacy.source = 'legacy-flow';
        state.caseGenLegacy.results = JSON.parse(JSON.stringify(state.caseGenResults));
      }

      var rawTextEl = document.getElementById('rawText');
      if (rawTextEl) {
        rawTextEl.value = '旧流程原文';
        rawTextEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var fileNameEl = document.getElementById('fileName');
      if (fileNameEl) fileNameEl.textContent = 'legacy-requirement.txt';
      var caseTextEl = document.getElementById('caseText');
      if (caseTextEl) {
        caseTextEl.value = '旧流程导入用例正文';
        caseTextEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (app.casesGenApi && typeof app.casesGenApi.renderCaseGeneration === 'function') {
        app.casesGenApi.renderCaseGeneration();
      }

      var task = {
        id: 'xmind-background-done-task',
        workspaceId: workspaceId,
        scope: 'root',
        status: 'done',
        actionId: 'root-full-modules',
        historyActionLabel: '生成模块',
        resultRaw: JSON.stringify([{
          module: '后台XMind模块',
          key_scenarios: ['后台XMind主场景'],
          test_points: ['后台XMind关键校验'],
          coupled_modules: [],
        }], null, 2),
        durationMs: 1200,
        createdAt: now,
        updatedAt: now + 50,
        restoreContext: {
          workspaceId: workspaceId,
          requirementLabel: 'XMind后台需求',
          requirementLabelSource: 'workspace',
          lastRawImportName: 'xmind-background.txt',
          rawText: 'XMind后台原文',
          caseText: '',
          importedCases: [],
          caseGenModules: [{
            id: 'xmind-bg-mod',
            title: '后台XMind模块',
            module: '后台XMind模块',
            key_scenarios: ['后台XMind主场景'],
            test_points: ['后台XMind关键校验'],
            coupled_modules: [],
          }],
          caseGenResults: {},
          operationSnapshots: [],
          nextSnapshotId: 1,
          history: [],
          rootPipeline: null,
          prep: JSON.parse(JSON.stringify(xmindSnapshot.prep || {})),
          viewState: JSON.parse(JSON.stringify(xmindSnapshot.viewState || {})),
        },
      };

      window.dispatchEvent(new CustomEvent('xmind-casegen-task', {
        detail: {
          action: 'done',
          task: task,
          tasks: [task],
        },
      }));
    });

    await page.waitForFunction(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state || !state.xmindCaseGen || !state.xmindCaseGen.workspaces) return false;
      var record = state.xmindCaseGen.workspaces['xmind-live-isolation'];
      if (!record || !record.snapshot || !record.snapshot.shared) return false;
      var modules = Array.isArray(record.snapshot.shared.caseGenModules) ? record.snapshot.shared.caseGenModules : [];
      return modules.some(function(item) {
        return String((item && (item.title || item.module)) || '') === '后台XMind模块';
      });
    }, null, { timeout: 20000 });

    const isolatedState = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : null;
      var record = host && host.workspaces ? host.workspaces['xmind-live-isolation'] : null;
      var workspaceModules = record && record.snapshot && record.snapshot.shared && Array.isArray(record.snapshot.shared.caseGenModules)
        ? record.snapshot.shared.caseGenModules.map(function(item) {
          return String((item && (item.title || item.module)) || '');
        })
        : [];
      var liveModules = state && Array.isArray(state.caseGenModules)
        ? state.caseGenModules.map(function(item) {
          return String((item && (item.title || item.module)) || '');
        })
        : [];
      return {
        requirementLabel: state ? String(state.requirementLabel || '') : '',
        rawText: document.getElementById('rawText') ? String(document.getElementById('rawText').value || '') : '',
        caseText: document.getElementById('caseText') ? String(document.getElementById('caseText').value || '') : '',
        importedCount: state && Array.isArray(state.importedCases) ? state.importedCases.length : 0,
        liveModules: liveModules,
        workspaceModules: workspaceModules,
      };
    });

    expect(isolatedState.requirementLabel).toBe('旧流程需求');
    expect(isolatedState.rawText).toBe('旧流程原文');
    expect(isolatedState.caseText).toContain('旧流程导入用例正文');
    expect(isolatedState.importedCount).toBe(1);
    expect(isolatedState.liveModules).toEqual(['旧流程模块']);
    expect(isolatedState.workspaceModules).toContain('后台XMind模块');
  });

  test('刷新后恢复工作流与用例生成数据', async ({ page }) => {
    await page.evaluate(() => {
      try { localStorage.removeItem('usecase-workflow-state-v1'); } catch (_) {}
    });
    await page.evaluate(() => {
      var raw = document.getElementById('rawText');
      if (raw) {
        raw.value = 'Requirement A';
        raw.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var review = document.getElementById('reviewResult');
      if (review) {
        review.value = 'Review result';
        review.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var autoInput = document.getElementById('autoCompareSuggestion');
      if (autoInput) {
        autoInput.value = 'Auto suggestion';
        autoInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var casesCompare = document.getElementById('casesCompareResult');
      if (casesCompare) {
        casesCompare.value = JSON.stringify({
          coverage: 80,
          missing: [{ module: 'Module 1', points: ['p1'] }],
          extra: [],
        }, null, 2);
        casesCompare.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.app && window.app.state) {
        window.app.state.caseGenModules = [
          { id: 'm1', title: 'Module 1', scenarios: ['s1'], points: [], coupled: [] },
        ];
        window.app.state.caseGenResults = {
          m1: '[{\"module\":\"Module 1\",\"title\":\"Case 1\",\"priority\":\"P1\",\"preconditions\":\"\",\"steps\":[\"a\"],\"expected\":\"b\"}]',
        };
        window.app.state.caseGenSuggestions = { m1: '' };
      }
      if (window.app && window.app.core && typeof window.app.core.renderCaseGeneration === 'function') {
        window.app.core.renderCaseGeneration();
      }
    });
    await page.evaluate(() => {
      var area = document.querySelector('textarea[data-suggestion="m1"]');
      if (area) {
        area.value = 'note';
        area.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
    });

    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await expect(page.locator('#rawText')).toHaveValue('Requirement A');
    await expect(page.locator('#reviewResult')).toHaveValue('Review result');
    await expect(page.locator('#autoCompareSuggestion')).toHaveValue('Auto suggestion');
    await expect(page.locator('#casesCompareResult')).toContainText('coverage');
    await expect(page.locator('textarea[data-suggestion="m1"]')).toHaveValue('note');
    await expect(page.locator('#caseGenProgressList')).toContainText('Module 1');
    const moduleCount = await page.evaluate(() => {
      return window.app && window.app.state && Array.isArray(window.app.state.caseGenModules)
        ? window.app.state.caseGenModules.length
        : 0;
    });
    expect(moduleCount).toBe(1);
  });

  test('切换到用例相关页面仍展示用例生成进度', async ({ page }) => {
    await page.evaluate(() => {
      try { localStorage.removeItem('usecase-workflow-state-v1'); } catch (_) {}
    });
    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.caseGenModules = [
          { id: 'm1', title: 'Module 1', scenarios: ['s1'], points: [], coupled: [] },
        ];
        window.app.state.caseGenResults = { m1: '' };
        window.app.state.caseGenSuggestions = { m1: '' };
      }
      if (window.app && typeof window.app.persistWorkflowStateNow === 'function') {
        window.app.persistWorkflowStateNow();
      }
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-library.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
    await expect(page.locator('#caseGenProgressList')).toContainText('Module 1');
  });
});
