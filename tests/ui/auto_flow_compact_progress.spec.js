const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

test.describe('一键执行按钮进度提示', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.removeItem('tap-auth-token');
        var keepKey = 'tap-e2e-keep-workflow';
        if (!localStorage.getItem(keepKey)) {
          localStorage.removeItem('usecase-workflow-state-v1');
        }
        localStorage.removeItem(keepKey);
      } catch (_) {}
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('紧凑步骤显示执行中/等待/失败状态', async ({ page }) => {
    await page.evaluate(() => {
      var raw = document.getElementById('rawText');
      var review = document.getElementById('reviewResult');
      var cleaned = document.getElementById('cleanedText');
      if (raw) raw.value = '需求';
      if (review) review.value = '[]';
      if (cleaned) cleaned.value = '{"summary":"ok"}';
      var state = window.app && window.app.state;
      function ensureRunner() {
        if (window.app && window.app._flowCompactRunner) return window.app._flowCompactRunner;
        var flowCore = window.app && window.app.flowCore;
        if (!flowCore || typeof flowCore.init !== 'function' || !state) return null;
        var runtime = window.app && window.app.core;
        var runner = flowCore.init({
          state: state,
          handlers: {
            hasCaseSource: function() {
              return runtime && typeof runtime.hasCaseSource === 'function'
                ? runtime.hasCaseSource()
                : false;
            },
          },
        });
        window.app._flowCompactRunner = runner;
        return runner;
      }
      var runner = ensureRunner();
      if (state) {
        state.inProgressSteps = { compare: true };
        state.waitingSteps = {};
        state.failedSteps = {};
        state.validationFailedSteps = {};
      }
      if (runner && typeof runner.updateFlowStatus === 'function') runner.updateFlowStatus();
    });

    const compareStep = page.locator('#autoFlowCompact .step[data-target=compare]');
    await expect(compareStep).toHaveClass(/active/);
    await expect(compareStep.locator('.step-status')).toHaveAttribute('data-status', 'running');
    await expect(page.locator('#autoFlowCompact .step:not(.hidden)')).toHaveCount(1);
    await expect(compareStep).not.toHaveClass(/hidden/);
    await expect(compareStep.locator('.step-label')).toHaveText('对比完整性');
    const autoSubstep = page.locator('[data-tab-btn="auto"] .ai-flow-substep');
    const cleanSubstep = page.locator('[data-tab-btn="clean"] .ai-flow-substep');
    await expect(autoSubstep).toHaveClass(/active/);
    await expect(cleanSubstep).toHaveClass(/active/);
    await expect(autoSubstep.locator('.step-label')).toHaveText('对比完整性');
    await expect(cleanSubstep.locator('.step-label')).toHaveText('对比完整性');
    await expect(autoSubstep.locator('.step-status')).toHaveAttribute('data-status', 'running');
    await expect(cleanSubstep.locator('.step-status')).toHaveAttribute('data-status', 'running');

    await page.evaluate(() => {
      var state = window.app && window.app.state;
      if (state) {
        state.inProgressSteps = {};
        state.waitingSteps = { split: true };
        state.failedSteps = {};
        state.validationFailedSteps = {};
      }
      var runner = window.app && window.app._flowCompactRunner;
      if (runner && typeof runner.updateFlowStatus === 'function') runner.updateFlowStatus();
    });
    const splitStep = page.locator('#autoFlowCompact .step[data-target=split]');
    await expect(splitStep).toHaveClass(/waiting/);
    await expect(splitStep.locator('.step-status')).toHaveAttribute('data-status', 'waiting');
    await expect(page.locator('#autoFlowCompact .step:not(.hidden)')).toHaveCount(1);
    await expect(splitStep).not.toHaveClass(/hidden/);
    await expect(splitStep.locator('.step-label')).toHaveText('拆分');
    await expect(autoSubstep).toHaveClass(/waiting/);
    await expect(cleanSubstep).toHaveClass(/waiting/);
    await expect(autoSubstep.locator('.step-label')).toHaveText('拆分');
    await expect(cleanSubstep.locator('.step-label')).toHaveText('拆分');
    await expect(autoSubstep.locator('.step-status')).toHaveAttribute('data-status', 'waiting');
    await expect(cleanSubstep.locator('.step-status')).toHaveAttribute('data-status', 'waiting');

    await page.evaluate(() => {
      var state = window.app && window.app.state;
      if (state) {
        state.inProgressSteps = {};
        state.waitingSteps = {};
        state.failedSteps = { 'cases-upload': true };
        state.validationFailedSteps = {};
      }
      var runner = window.app && window.app._flowCompactRunner;
      if (runner && typeof runner.updateFlowStatus === 'function') runner.updateFlowStatus();
    });
    const uploadStep = page.locator('#autoFlowCompact .step[data-target=cases-upload]');
    await expect(uploadStep).toHaveClass(/failed/);
    await expect(uploadStep.locator('.step-status')).toHaveAttribute('data-status', 'failed');
    await expect(page.locator('#autoFlowCompact .step:not(.hidden)')).toHaveCount(1);
    await expect(uploadStep).not.toHaveClass(/hidden/);
    await expect(uploadStep.locator('.step-label')).toHaveText('用例导入');
    await expect(autoSubstep).toHaveClass(/failed/);
    await expect(cleanSubstep).toHaveClass(/failed/);
    await expect(autoSubstep.locator('.step-label')).toHaveText('用例导入');
    await expect(cleanSubstep.locator('.step-label')).toHaveText('用例导入');
    await expect(autoSubstep.locator('.step-status')).toHaveAttribute('data-status', 'failed');
    await expect(cleanSubstep.locator('.step-status')).toHaveAttribute('data-status', 'failed');
  });

  test('初始化时紧凑进度默认隐藏', async () => {
    const htmlPath = path.join(__dirname, '..', '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const compactMatch = html.match(/<span\s+class=\"([^\"]*)\"\s+id=\"autoFlowCompact\"/);
    expect(compactMatch).not.toBeNull();
    expect(compactMatch[1]).toContain('hidden');
  });

  test('未开始时不展示紧凑进度', async ({ page }) => {
    await page.evaluate(() => {
      var raw = document.getElementById('rawText');
      var review = document.getElementById('reviewResult');
      var cleaned = document.getElementById('cleanedText');
      var compare = document.getElementById('compareResult');
      var split = document.getElementById('splitResult');
      var caseText = document.getElementById('caseText');
      var casesCompare = document.getElementById('casesCompareResult');
      if (raw) raw.value = '';
      if (review) review.value = '';
      if (cleaned) cleaned.value = '';
      if (compare) compare.value = '';
      if (split) split.value = '';
      if (caseText) caseText.value = '';
      if (casesCompare) casesCompare.value = '';
      var state = window.app && window.app.state;
      function ensureRunner() {
        if (window.app && window.app._flowCompactRunner) return window.app._flowCompactRunner;
        var flowCore = window.app && window.app.flowCore;
        if (!flowCore || typeof flowCore.init !== 'function' || !state) return null;
        var runtime = window.app && window.app.core;
        var runner = flowCore.init({
          state: state,
          handlers: {
            hasCaseSource: function() {
              return runtime && typeof runtime.hasCaseSource === 'function'
                ? runtime.hasCaseSource()
                : false;
            },
          },
        });
        window.app._flowCompactRunner = runner;
        return runner;
      }
      var runner = ensureRunner();
      if (state) {
        state.inProgressSteps = {};
        state.waitingSteps = {};
        state.failedSteps = {};
        state.validationFailedSteps = {};
      }
      if (runner && typeof runner.updateFlowStatus === 'function') runner.updateFlowStatus();
    });

    await expect(page.locator('#autoFlowCompact')).toHaveClass(/hidden/);
    await expect(page.locator('#autoFlowCompact .step:not(.hidden)')).toHaveCount(0);
    await expect(page.locator('[data-tab-btn="auto"] .ai-flow-substep')).toHaveClass(/hidden/);
    await expect(page.locator('[data-tab-btn="clean"] .ai-flow-substep')).toHaveClass(/hidden/);
  });

  test('跨页面切换时同步一键执行步骤状态', async ({ page }) => {
    await page.evaluate(() => {
      var snapshot = {
        version: 1,
        user_id: '',
        updated_at: Date.now(),
        data: {
          rawText: '需求内容',
          reviewResult: '[]',
          cleanedText: '{"summary":"ok"}',
          compareResult: '{"coverage":100,"missing":[]}',
          splitResult: '[{"module":"模块","key_scenarios":[],"test_points":[],"coupled_modules":[]}]',
          casesCompareResult: '{"coverage":100,"missing":[],"extra":[]}',
          caseText: '用例列表',
          importedCases: [],
        },
      };
      localStorage.setItem('usecase-workflow-state-v1', JSON.stringify(snapshot));
      localStorage.setItem('tap-e2e-keep-workflow', '1');
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);

    const compact = page.locator('#autoFlowCompact');
    await expect(compact).not.toHaveClass(/hidden/);
    await expect(compact.locator('.step:not(.hidden)')).toHaveCount(1);
    const casesStep = compact.locator('.step[data-target=cases]');
    await expect(casesStep).toHaveClass(/done/);
    await expect(casesStep.locator('.step-status')).toHaveAttribute('data-status', 'done');
    const autoSubstep = page.locator('[data-tab-btn="auto"] .ai-flow-substep');
    await expect(autoSubstep).not.toHaveClass(/hidden/);
    await expect(autoSubstep.locator('.step-label')).toHaveText('覆盖对比');
    await expect(autoSubstep.locator('.step-status')).toHaveAttribute('data-status', 'done');
  });

  test('跨页面切换时同步执行中状态', async ({ page }) => {
    await page.evaluate(() => {
      var snapshot = {
        version: 1,
        user_id: '',
        updated_at: Date.now(),
        data: {
          rawText: '需求内容',
          reviewResult: '[]',
          cleanedText: '{"summary":"ok"}',
          compareResult: '',
          splitResult: '',
          casesCompareResult: '',
          caseText: '用例列表',
          importedCases: [],
          inProgressStep: '',
          inProgressSteps: { compare: true },
          waitingSteps: {},
          failedSteps: {},
          validationFailedSteps: {},
          failedReasons: {},
          waitingReasons: {},
          validationFailedReasons: {},
          autoRunning: true,
        },
      };
      localStorage.setItem('usecase-workflow-state-v1', JSON.stringify(snapshot));
      localStorage.setItem('tap-e2e-keep-workflow', '1');
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);

    const compact = page.locator('#autoFlowCompact');
    await expect(compact).not.toHaveClass(/hidden/);
    const compareStep = compact.locator('.step[data-target=compare]');
    await expect(compareStep).toHaveClass(/active/);
    await expect(compareStep.locator('.step-status')).toHaveAttribute('data-status', 'running');
  });

  test('白色主题选中时进度样式可辨识', async ({ page }) => {
    await page.evaluate(() => {
      var raw = document.getElementById('rawText');
      if (raw) raw.value = '需求';
      var state = window.app && window.app.state;
      function ensureRunner() {
        if (window.app && window.app._flowCompactRunner) return window.app._flowCompactRunner;
        var flowCore = window.app && window.app.flowCore;
        if (!flowCore || typeof flowCore.init !== 'function' || !state) return null;
        var runtime = window.app && window.app.core;
        var runner = flowCore.init({
          state: state,
          handlers: {
            hasCaseSource: function() {
              return runtime && typeof runtime.hasCaseSource === 'function'
                ? runtime.hasCaseSource()
                : false;
            },
          },
        });
        window.app._flowCompactRunner = runner;
        return runner;
      }
      var runner = ensureRunner();
      if (state) {
        state.inProgressSteps = { import: true };
        state.waitingSteps = {};
        state.failedSteps = {};
        state.validationFailedSteps = {};
      }
      var groupBtn = document.querySelector('.tab-group-btn[data-group="ai"]');
      if (groupBtn) groupBtn.classList.add('active');
      var autoBtn = document.querySelector('.tab-submenu .ai-flow-submenu-btn[data-tab-btn="auto"]');
      if (autoBtn) autoBtn.classList.add('active');
      if (runner && typeof runner.updateFlowStatus === 'function') runner.updateFlowStatus();
    });

    const compactStyle = await page.locator('#autoFlowCompact .step.active:not(.hidden)').evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { bg: style.backgroundColor, color: style.color };
    });
    expect(compactStyle.bg.indexOf('255, 255, 255')).toBeGreaterThan(-1);
    expect(compactStyle.color).not.toBe('rgb(255, 255, 255)');

    const subStyle = await page.locator('[data-tab-btn="auto"] .ai-flow-substep.active').evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { bg: style.backgroundColor, color: style.color };
    });
    expect(subStyle.bg.indexOf('255, 255, 255')).toBeGreaterThan(-1);
    expect(subStyle.color).not.toBe('rgb(255, 255, 255)');
  });

  test('全部完成时最后步骤保持勾选', async ({ page }) => {
    await page.evaluate(() => {
      var raw = document.getElementById('rawText');
      var review = document.getElementById('reviewResult');
      var cleaned = document.getElementById('cleanedText');
      var compare = document.getElementById('compareResult');
      var split = document.getElementById('splitResult');
      var caseText = document.getElementById('caseText');
      var casesCompare = document.getElementById('casesCompareResult');
      if (raw) raw.value = '需求';
      if (review) review.value = '[]';
      if (cleaned) cleaned.value = '{"summary":"ok"}';
      if (compare) compare.value = '{"coverage":100,"missing":[]}';
      if (split) split.value = '[]';
      if (caseText) caseText.value = '用例';
      if (casesCompare) casesCompare.value = '{"coverage":100,"missing":[],"extra":[]}';
      var state = window.app && window.app.state;
      if (state) {
        state.inProgressSteps = {};
        state.waitingSteps = {};
        state.failedSteps = {};
        state.validationFailedSteps = {};
      }
      var flowCore = window.app && window.app.flowCore;
      if (flowCore && typeof flowCore.init === 'function' && state) {
        var runtime = window.app && window.app.core;
        var runner = flowCore.init({
          state: state,
          handlers: {
            hasCaseSource: function() {
              return runtime && typeof runtime.hasCaseSource === 'function'
                ? runtime.hasCaseSource()
                : false;
            },
          },
        });
        if (runner && typeof runner.updateFlowStatus === 'function') runner.updateFlowStatus();
      }
    });

    const lastStep = page.locator('#autoFlowCompact .step[data-target=cases]');
    await expect(lastStep).toHaveClass(/done/);
    await expect(lastStep.locator('.step-status')).toHaveAttribute('data-status', 'done');
    await expect(lastStep.locator('.step-label')).toHaveText('覆盖对比');
    const autoSubstep = page.locator('[data-tab-btn="auto"] .ai-flow-substep');
    const cleanSubstep = page.locator('[data-tab-btn="clean"] .ai-flow-substep');
    await expect(autoSubstep).toHaveClass(/done/);
    await expect(cleanSubstep).toHaveClass(/done/);
    await expect(autoSubstep.locator('.step-label')).toHaveText('覆盖对比');
    await expect(cleanSubstep.locator('.step-label')).toHaveText('覆盖对比');
    await expect(autoSubstep.locator('.step-status')).toHaveAttribute('data-status', 'done');
    await expect(cleanSubstep.locator('.step-status')).toHaveAttribute('data-status', 'done');
  });
});
