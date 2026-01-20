const { test, expect } = require('@playwright/test');

test.describe('用例生成 Agent 面板与澄清填充', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

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
      } catch (_) {}
    });
    await page.goto(base + '/ai-workflow.html?tab=auto');
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => { if (window.app && typeof window.app.init === 'function') window.app.init(); });
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('Agent 面板展示计划与修复建议', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      if (!window.app.state.settings) window.app.state.settings = {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentPlan = [
        { key: 'review', label: '需求评审', status: 'done', attempts: 0, note: '' },
        { key: 'clean', label: '需求清洗', status: 'waiting', attempts: 2, note: '校验失败' },
      ];
      window.app.state.caseGenAgentLog = [{ ts: Date.now(), level: 'warn', message: '覆盖率不足' }];
      window.app.state.caseGenAgentTrace = [{ ts: Date.now(), level: 'info', message: '开始执行需求评审' }];
      window.app.state.caseGenAgentFixSuggestions = '修复建议：补充登录失败提示文案与多语言路径。';
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });

    const panel = page.locator('#autoAgentPanel');
    const tracePanel = page.locator('#autoAgentTracePanel');
    await expect(panel).not.toHaveClass(/hidden/);
    await expect(tracePanel).not.toHaveClass(/hidden/);
    await expect(page.locator('#autoAgentPlan')).toContainText('需求评审');
    await expect(page.locator('#autoAgentSuggestion')).toContainText('修复建议');
    await expect(page.locator('#autoAgentTrace')).toContainText('开始执行需求评审');
  });

  test('Agent 停止按钮按设置展示并可触发停止', async ({ page }) => {
    const stopBtn = page.locator('#autoAgentStopBtn');
    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      if (!window.app.state.settings) window.app.state.settings = {};
      window.app.state.settings.caseGenAgentEnabled = false;
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });
    await expect(stopBtn).toHaveClass(/hidden/);

    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      if (!window.app.state.settings) window.app.state.settings = {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.autoRunning = true;
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });
    await expect(stopBtn).not.toHaveClass(/hidden/);
    await expect(stopBtn).toBeEnabled();
    await stopBtn.click();
    await expect(page.locator('#autoWorkflowStatus')).toContainText('Agent 已停止');
  });

  test('Agent 额外提示词输入框按设置展示并默认填充', async ({ page }) => {
    const hintBlock = page.locator('#autoAgentPromptHintBlock');
    const hintInput = page.locator('#autoAgentPromptHint');
    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      if (!window.app.state.settings) window.app.state.settings = {};
      window.app.state.settings.caseGenAgentEnabled = false;
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });
    await expect(hintBlock).toHaveClass(/hidden/);

    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      if (!window.app.state.settings) window.app.state.settings = {};
      window.app.state.settings.caseGenAgentEnabled = true;
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });
    await expect(hintBlock).not.toHaveClass(/hidden/);
    await expect(hintInput).toHaveValue('评审流程可以忽略数值、美术等相关内容。');
  });

  test('Agent 覆盖率重试前不弹出覆盖缺失抽屉', async ({ page }) => {
    await page.evaluate(() => {
      var compare = document.getElementById('compareResult');
      if (compare) {
        compare.value = JSON.stringify({ coverage: 60, missing: ['缺失点A'] }, null, 2);
      }
      if (window.app && window.app.state) {
        if (!window.app.state.settings) window.app.state.settings = {};
        window.app.state.settings.caseGenAgentEnabled = true;
        window.app.state.settings.caseGenAgentCoverageThreshold = 90;
        window.app.state.autoRunning = true;
        window.app.state.caseGenAgentCoverageRetries = 0;
      }
      if (window.app && window.app.core && typeof window.app.core.syncAutoCompareStatus === 'function') {
        window.app.core.syncAutoCompareStatus();
      }
    });

    await expect(page.locator('#autoCompareDrawer')).not.toHaveClass(/open/);

    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.caseGenAgentCoverageRetries = 2;
      }
      if (window.app && window.app.core && typeof window.app.core.syncAutoCompareStatus === 'function') {
        window.app.core.syncAutoCompareStatus();
      }
    });

    await expect(page.locator('#autoCompareDrawer')).toHaveClass(/open/);
  });

  test('Agent 覆盖率等待时校验补全输入', async ({ page }) => {
    await page.evaluate(() => {
      var compare = document.getElementById('compareResult');
      if (compare) {
        compare.value = JSON.stringify({ coverage: 60, missing: ['缺失点A'] }, null, 2);
      }
      if (window.app && window.app.state) {
        if (!window.app.state.settings) window.app.state.settings = {};
        window.app.state.settings.caseGenAgentEnabled = true;
        window.app.state.settings.caseGenAgentCoverageThreshold = 90;
        window.app.state.autoRunning = false;
        window.app.state.waitingSteps = { compare: '等待覆盖率处理' };
        window.app.state.autoCompareSuggestion = '';
        window.app.state.autoCompareMissingList = ['缺失点A'];
      }
      if (window.app && window.app.core && typeof window.app.core.syncAutoCompareStatus === 'function') {
        window.app.core.syncAutoCompareStatus(true);
      }
    });

    const suggestion = page.locator('#autoCompareSuggestion');
    await suggestion.fill('!!!');
    await page.locator('#autoFillCleanBtn').click();
    await expect(page.locator('#autoRecleanStatus')).toContainText('补充说明过于零散');
  });

  test('Agent 覆盖率等待时忽略继续会进入 Agent 处理', async ({ page }) => {
    await page.evaluate(() => {
      var compare = document.getElementById('compareResult');
      if (compare) {
        compare.value = JSON.stringify({ coverage: 60, missing: ['缺失点A'] }, null, 2);
      }
      if (window.app && window.app.state) {
        if (!window.app.state.settings) window.app.state.settings = {};
        window.app.state.settings.caseGenAgentEnabled = true;
        window.app.state.settings.caseGenAgentCoverageThreshold = 90;
        window.app.state.autoRunning = false;
        window.app.state.waitingSteps = { compare: '等待覆盖率处理' };
        window.app.state.caseGenAgentLog = [];
      }
      if (window.app && window.app.core && typeof window.app.core.syncAutoCompareStatus === 'function') {
        window.app.core.syncAutoCompareStatus(true);
      }
    });

    await page.locator('#autoIgnoreCoverageBtn').click();
    await page.waitForFunction(() => {
      if (!window.app || !window.app.state || !Array.isArray(window.app.state.caseGenAgentLog)) return false;
      return window.app.state.caseGenAgentLog.some((item) => {
        return item && item.message && item.message.indexOf('忽略覆盖率继续') !== -1;
      });
    });
  });

  test('评审结果自动填充澄清建议', async ({ page }) => {
    await page.evaluate(() => {
      if (window.app && window.app.state) {
        window.app.state.reviewRows = [{
          index: 0,
          category: '功能',
          point: '登录失败提示',
          reason: '未说明提示文案',
          branch: '多语言',
          clarification: '',
        }];
        window.app.state.reviewClarifications = new Map();
        window.app.state.activeTab = 'auto';
      }
      if (window.app && window.app.core && typeof window.app.core.autoFillReviewClarifications === 'function') {
        window.app.core.autoFillReviewClarifications({ source: 'test' });
      }
      if (window.app && window.app.core && typeof window.app.core.updateAutoClarifyVisibility === 'function') {
        var toggle = document.getElementById('autoNeedClarify');
        if (toggle) toggle.checked = true;
        window.app.core.updateAutoClarifyVisibility(true);
      }
    });

    const textarea = page.locator('#autoClarifyContainer textarea[data-clarify-index="0"]');
    await expect(textarea).toHaveValue(/待确认/);
  });

  test('切换页面后仍有工作流隐藏字段', async ({ page }) => {
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => { if (window.app && typeof window.app.init === 'function') window.app.init(); });
    await page.waitForFunction(() => window.app && window.app._inited === true);

    const hasFields = await page.evaluate(() => {
      return Boolean(
        document.getElementById('rawText') &&
        document.getElementById('compareResult') &&
        document.getElementById('casesCompareResult')
      );
    });
    expect(hasFields).toBe(true);
  });
});
