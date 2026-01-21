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
    await expect(hintInput).toHaveValue('需求澄清忽略数值和美术相关内容，模块拆分也忽略数值和美术。');
  });

  test('Agent 额外提示词输入持久化', async ({ page }) => {
    await page.evaluate(() => {
      try {
        localStorage.removeItem('usecase-workflow-state-v1');
      } catch (err) {}
      if (!window.app || !window.app.state) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });

    const hintInput = page.locator('#autoAgentPromptHint');
    await hintInput.fill('仅执行需求评审');
    await page.waitForFunction(() => {
      try {
        var raw = localStorage.getItem('usecase-workflow-state-v1');
        if (!raw) return false;
        var snapshot = JSON.parse(raw);
        return snapshot && snapshot.data && snapshot.data.autoAgentPromptHint === '仅执行需求评审';
      } catch (err) {
        return false;
      }
    });

    await page.reload();
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => { if (window.app && typeof window.app.init === 'function') window.app.init(); });
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });
    await expect(page.locator('#autoAgentPromptHint')).toHaveValue('仅执行需求评审');
  });

  test('重置流程后保留 Agent 额外提示词', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.autoAgentPromptHint = '重置后仍保留';
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
      if (typeof window.app.resetWorkflowData === 'function') {
        window.app.resetWorkflowData();
      }
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });

    await expect(page.locator('#autoAgentPromptHint')).toHaveValue('重置后仍保留');
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

  test('Agent 覆盖率不足时保留最高覆盖率结果', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.core) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      if (window.app.core.renderAgentPanel) window.app.core.renderAgentPanel();
      var compare = document.getElementById('compareResult');
      var cleaned = document.getElementById('cleanedText');
      if (compare) compare.value = '';
      if (cleaned) cleaned.value = '';
      window.app.core.applyAgentCoverageSelection([
        { index: 1, coverage: 60, compare: '{"coverage":60,"missing":["A"]}', cleaned: '[]', note: '初始' },
        { index: 2, coverage: 72, compare: '{"coverage":72,"missing":["B"]}', cleaned: '[{}]', note: '重清洗后' }
      ], { shouldOpenDrawer: false });
    });

    await expect(page.locator('#compareResult')).toHaveValue('{"coverage":72,"missing":["B"]}');
    await expect(page.locator('#cleanedText')).toHaveValue('[{}]');
    await expect(page.locator('#autoAgentTrace')).toContainText('保留最高覆盖率结果：第2次 72%');
  });

  test('Agent 提示词变更会清空路由结果', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentPromptRouting = {
        source: '旧提示',
        prompts: { review: '忽略数值' },
        flow: {},
      };
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });

    const hintInput = page.locator('#autoAgentPromptHint');
    await hintInput.fill('仅执行到清洗流程');
    await page.waitForFunction(() => {
      return window.app && window.app.state && window.app.state.caseGenAgentPromptRouting === null;
    });
  });

  test('Agent 决策可更新提示路由', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.core) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.autoAgentPromptHint = '仅执行到清洗流程';
      window.app.state.caseGenAgentLog = [];
      window.app.state.caseGenAgentTrace = [];
      if (window.app.core.renderAgentPanel) window.app.core.renderAgentPanel();
      window.app.core.applyAgentPromptRoutingDecision({
        action: 'clean',
        reason: '测试提示分配',
        understanding: '额外提示命中评审与清洗，仅执行到清洗流程',
        decision: { action: 'clean', reason: '测试提示分配' },
        routing_note: '评审忽略数值并仅执行到清洗',
        prompt_routing: {
          prompts: { review: '忽略数值' },
          flow: { stop_after: 'clean', only_steps: ['review', 'clean'], note: '仅执行到清洗' },
        },
      });
    });

    await page.waitForFunction(() => {
      if (!window.app || !window.app.state || !window.app.state.caseGenAgentPromptRouting) return false;
      var routing = window.app.state.caseGenAgentPromptRouting;
      return routing.prompts && routing.prompts.review === '忽略数值';
    });
    await expect(page.locator('#autoAgentTrace')).toContainText('Agent 理解：额外提示命中评审与清洗');
    await expect(page.locator('#autoAgentTrace')).toContainText('提示词投递到工具：');
    await expect(page.locator('#autoAgentTrace')).toContainText('Agent 路由说明：评审忽略数值');
  });

  test('Agent 复核可覆盖步骤输出', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.core) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentTrace = [];
      var review = document.getElementById('reviewResult');
      if (review) review.value = '旧结果';
      if (window.app.core.renderAgentPanel) window.app.core.renderAgentPanel();
      window.app.core.applyAgentReviewDecision('review', {
        ok: false,
        reason: '不符合提示',
        issues: ['包含数值相关澄清点'],
        output: '[{"类别":"需求模糊","不明确的需求点":"点A","不明确原因":"原因A","可能存在的分支/边界情况":"边界A"}]',
      });
    });

    await expect(page.locator('#reviewResult')).toHaveValue('[{"类别":"需求模糊","不明确的需求点":"点A","不明确原因":"原因A","可能存在的分支/边界情况":"边界A"}]');
    await expect(page.locator('#autoAgentTrace')).toContainText('复核问题：包含数值相关澄清点');
    await expect(page.locator('#autoAgentTrace')).toContainText('Agent 复核修正：需求评审（不符合提示）');
  });

  test('Agent 复核中状态可展示', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentPlan = [
        { key: 'review', label: '需求评审', status: 'reviewing', attempts: 0, note: '正在复核' },
      ];
      if (window.app.core && typeof window.app.core.renderAgentPanel === 'function') {
        window.app.core.renderAgentPanel();
      }
    });

    await expect(page.locator('#autoAgentPlan')).toContainText('复核中');
  });

  test('复核阶段流程步骤保持执行中状态', async ({ page }) => {
    await page.evaluate(() => {
      var review = document.getElementById('reviewResult');
      if (review) review.value = '已有评审结果';
      if (window.app && window.app.state) {
        window.app.state.inProgressSteps = window.app.state.inProgressSteps || {};
        window.app.state.inProgressSteps.review = true;
      }
      if (window.app && window.app.core && typeof window.app.core.updateFlowStatus === 'function') {
        window.app.core.updateFlowStatus();
      }
    });

    const reviewStep = page.locator('#flowNav .step[data-target="review"]');
    await expect(reviewStep).toHaveClass(/active/);
    await expect(reviewStep).not.toHaveClass(/done/);
  });

  test('Agent 中文路由字段可映射到评审与对比', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.core) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentLog = [];
      window.app.state.caseGenAgentTrace = [];
      if (window.app.core.renderAgentPanel) window.app.core.renderAgentPanel();
      window.app.core.applyAgentPromptRoutingDecision({
        action: 'review',
        reason: '提示词路由中文字段测试',
        routing_note: '澄清与覆盖率提示已分配到评审与对比',
        prompt_routing: {
          prompts: {
            '需求澄清': '忽略数值相关澄清点',
            '覆盖率': '覆盖率排除数值和美术的对比计算',
            '测试模块拆分': '忽略数值和美术',
          },
          flow: {},
        },
      }, '忽略数值和美术');
    });

    await page.waitForFunction(() => {
      var routing = window.app && window.app.state ? window.app.state.caseGenAgentPromptRouting : null;
      return Boolean(routing && routing.prompts && routing.prompts.review && routing.prompts.compare);
    });
    const prompts = await page.evaluate(() => window.app.state.caseGenAgentPromptRouting.prompts);
    expect(prompts.review).toContain('忽略数值');
    expect(prompts.compare).toContain('覆盖率排除');
    expect(prompts.split).toContain('忽略数值');
    await expect(page.locator('#autoAgentTrace')).toContainText('已将 Agent 路由映射到对应步骤');
  });

  test('Agent 提示词自动补齐路由规则并更新默认值', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cleaner-assignment-v1', JSON.stringify({
        caseGenAgentPrompt: '这是自定义的 Agent 提示词，缺少路由规则。',
      }));
      localStorage.setItem('usecase-default-prompts', JSON.stringify({
        casegenagent: '这是自定义的 Agent 提示词，缺少路由规则。',
      }));
    });
    await page.reload();
    await page.waitForFunction(() => window.app && typeof window.app.init === 'function', null, { timeout: 20000 });
    await page.evaluate(() => { if (window.app && typeof window.app.init === 'function') window.app.init(); });
    await page.waitForFunction(() => window.app && window.app._inited === true);

    const hasRouting = await page.evaluate(() => {
      return Boolean(
        window.app &&
        window.app.state &&
        window.app.state.assignments &&
        typeof window.app.state.assignments.caseGenAgentPrompt === 'string' &&
        window.app.state.assignments.caseGenAgentPrompt.indexOf('prompt_routing') !== -1 &&
        window.app.state.assignments.caseGenAgentPrompt.indexOf('routing_note') !== -1 &&
        window.app.state.assignments.caseGenAgentPrompt.indexOf('必须输出 understanding 字段') !== -1 &&
        window.app.state.assignments.caseGenAgentPrompt.indexOf('必须输出 decision 字段') !== -1
      );
    });
    expect(hasRouting).toBe(true);

    const defaultHasRouting = await page.evaluate(() => {
      var saved = {};
      try {
        saved = JSON.parse(localStorage.getItem('usecase-default-prompts') || '{}') || {};
      } catch (err) {
        saved = {};
      }
      return Boolean(
        saved.casegenagent &&
        String(saved.casegenagent).indexOf('prompt_routing') !== -1 &&
        String(saved.casegenagent).indexOf('routing_note') !== -1 &&
        String(saved.casegenagent).indexOf('必须输出 understanding 字段') !== -1 &&
        String(saved.casegenagent).indexOf('必须输出 decision 字段') !== -1
      );
    });
    expect(defaultHasRouting).toBe(true);
  });

  test('Agent 流程约束会标记后续步骤为跳过', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.core) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentPlan = [
        { key: 'review', label: '需求评审', status: 'done', attempts: 0, note: '' },
        { key: 'clarify', label: '需求澄清确认', status: 'done', attempts: 0, note: '' },
        { key: 'clean', label: '需求清洗', status: 'done', attempts: 0, note: '' },
        { key: 'compare', label: '对比完整性', status: 'pending', attempts: 0, note: '' },
        { key: 'coverage', label: '覆盖率校验', status: 'pending', attempts: 0, note: '' },
        { key: 'split', label: '测试模块拆分', status: 'pending', attempts: 0, note: '' },
        { key: 'cases', label: '覆盖对比', status: 'pending', attempts: 0, note: '' },
      ];
      window.app.core.markAgentPlanSkippedByFlow({
        allowedSteps: ['review', 'clean'],
        onlySteps: ['review', 'clean'],
        stopAfter: 'clean',
        note: '仅执行到清洗',
      });
      window.app.core.renderAgentPanel();
    });

    const plan = page.locator('#autoAgentPlan');
    await expect(plan).toContainText('测试模块拆分');
    await expect(plan).toContainText('已跳过');
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
