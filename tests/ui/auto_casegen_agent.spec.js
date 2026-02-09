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

  test('Agent 决策解析可修复换行', async ({ page }) => {
    const parsed = await page.evaluate(() => {
      if (!window.app || !window.app.core || typeof window.app.core.parseAgentDecisionContent !== 'function') return null;
      var raw = `{"action":"review","reason":"包含
换行","prompt_routing":{},"routing_note":"","understanding":"","decision":{"action":"review","reason":"包含
换行"}}`;
      return window.app.core.parseAgentDecisionContent(raw);
    });

    expect(parsed && parsed.action).toBe('review');
  });

  test('Agent 复核修正时可补全需求标识', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.core) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentTrace = [];
      window.app.state.requirementLabel = '需求A';
      window.app.state.requirementLabelSource = 'manual';
      if (window.app.core.renderAgentPanel) window.app.core.renderAgentPanel();
      window.app.core.applyAgentReviewDecision('clean', {
        ok: false,
        reason: '格式缺失',
        issues: ['缺少需求标识'],
        output: '{"data":[{"feature":"A"}]}',
      });
    });

    await expect(page.locator('#cleanedText')).toHaveValue(/"requirement": "需求A"/);
    await expect(page.locator('#autoAgentTrace')).toContainText('格式修复：需求清洗补全需求标识');
  });

  test('Agent 复核解析可容错 output 拼接', async ({ page }) => {
    const parsed = await page.evaluate(() => {
      if (!window.app || !window.app.core || typeof window.app.core.parseAgentReviewDecisionContent !== 'function') {
        return null;
      }
      var raw = '{"ok":false,"reason":"输出重复拼接","action":"fix","severity":"major","output":[{"a":1}][{"a":2}],"issues":["x"]}';
      return window.app.core.parseAgentReviewDecisionContent(raw);
    });

    expect(parsed).toBeTruthy();
    expect(parsed.ok).toBe(false);
    expect(parsed.action).toBe('fix');
  });

  test('清洗结果可修复换行占位字符', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (!window.app || !window.app.state) return null;
      window.app.state.assignments = window.app.state.assignments || {};
      window.app.state.assignments.cleanPrompt = '请输出 JSON';
      var cleaned = document.getElementById('cleanedText');
      if (cleaned) cleaned.value = '[n {"feature":"A","description":"B"n}n]';
      if (window.app.core && typeof window.app.core.updateFlowStatus === 'function') {
        window.app.core.updateFlowStatus();
      }
      return {
        invalid: window.app.state.validationFailedSteps && window.app.state.validationFailedSteps.clean,
        value: cleaned ? cleaned.value : '',
      };
    });

    expect(result).toBeTruthy();
    expect(result.invalid).toBeFalsy();
    expect(result.value).not.toContain('[n');
  });

  test('评审结果可修复换行占位字符', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (!window.app || !window.app.state) return null;
      var review = document.getElementById('reviewResult');
      if (review) review.value = '[n {"类别":"需求模糊","不明确的需求点":"A","不明确原因":"B","可能存在的分支/边界情况":"C"n}n]';
      if (window.app.core && typeof window.app.core.syncReviewViewFromResult === 'function') {
        window.app.core.syncReviewViewFromResult();
      }
      if (window.app.core && typeof window.app.core.updateFlowStatus === 'function') {
        window.app.core.updateFlowStatus();
      }
      return {
        invalid: window.app.state.validationFailedSteps && window.app.state.validationFailedSteps.review,
        value: review ? review.value : '',
      };
    });

    expect(result).toBeTruthy();
    expect(result.invalid).toBeFalsy();
    expect(result.value).not.toContain('[n');
  });

  test('对比结果可修复换行占位字符', async ({ page }) => {
    const result = await page.evaluate(() => {
      var compare = document.getElementById('compareResult');
      if (compare) compare.value = '{n  "coverage": 100,n  "missing": []n}';
      if (window.app && window.app.core && typeof window.app.core.updateFlowStatus === 'function') {
        window.app.core.updateFlowStatus();
      }
      return {
        invalid: window.app && window.app.state && window.app.state.validationFailedSteps
          ? window.app.state.validationFailedSteps.compare
          : null,
        value: compare ? compare.value : '',
      };
    });

    expect(result).toBeTruthy();
    expect(result.invalid).toBeFalsy();
    expect(result.value).not.toContain('n  "coverage"');
  });

  test('覆盖对比结果可修复换行占位字符', async ({ page }) => {
    const result = await page.evaluate(() => {
      var casesCompare = document.getElementById('casesCompareResult');
      if (casesCompare) casesCompare.value = '{n  "coverage": 90,n  "missing": []n}';
      if (window.app && window.app.core && typeof window.app.core.updateFlowStatus === 'function') {
        window.app.core.updateFlowStatus();
      }
      return {
        invalid: window.app && window.app.state && window.app.state.validationFailedSteps
          ? window.app.state.validationFailedSteps.cases
          : null,
        value: casesCompare ? casesCompare.value : '',
      };
    });

    expect(result).toBeTruthy();
    expect(result.invalid).toBeFalsy();
    expect(result.value).not.toContain('n  "coverage"');
  });

  test('Agent 复核严重问题可标记重跑', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.core) return null;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentTrace = [];
      if (window.app.core.renderAgentPanel) window.app.core.renderAgentPanel();
      return window.app.core.applyAgentReviewDecision('compare', {
        ok: false,
        action: 'rerun',
        severity: 'severe',
        reason: '严重不符',
        issues: ['覆盖率解析失败'],
      });
    });

    expect(result && result.rerun).toBeTruthy();
    await expect(page.locator('#autoAgentTrace')).toContainText('复核判定严重不符合');
  });

  test('Agent 复核按需附带需求与用例数据', async ({ page }) => {
    const payloads = await page.evaluate(() => {
      var raw = document.getElementById('rawText');
      if (raw) raw.value = '原始需求A';
      var cleaned = document.getElementById('cleanedText');
      if (cleaned) cleaned.value = '清洗需求A';
      var split = document.getElementById('splitResult');
      if (split) split.value = '模块拆分A';
      var casesCompare = document.getElementById('casesCompareResult');
      if (casesCompare) casesCompare.value = '{"coverage":90,"missing":[]}';
      if (window.app && window.app.state) {
        window.app.state.importedCases = [{
          id: 'case-1',
          name: '用例文件A',
          text: '用例A',
          list: [{ title: '用例A', steps: [] }],
        }];
      }
      if (!window.app || !window.app.core || typeof window.app.core.getAgentReviewPayloadSnapshot !== 'function') {
        return null;
      }
      return {
        review: window.app.core.getAgentReviewPayloadSnapshot('review', '提示'),
        cases: window.app.core.getAgentReviewPayloadSnapshot('cases', '提示'),
        reviewSummary: window.app.core.getAgentReviewInputSummary('review', '提示'),
        casesSummary: window.app.core.getAgentReviewInputSummary('cases', '提示'),
      };
    });

    expect(payloads && payloads.review && payloads.cases).toBeTruthy();
    expect(payloads.review.inputs && payloads.review.inputs.case_text).toBeFalsy();
    expect(payloads.review.inputs && payloads.review.inputs.raw_requirement).toContain('原始需求A');
    expect(payloads.cases.inputs && payloads.cases.inputs.case_text).toContain('"cases"');
    expect(payloads.cases.inputs && payloads.cases.inputs.cleaned_requirement).toContain('清洗需求A');
    expect(payloads.reviewSummary).toContain('需求-原始需求');
    expect(payloads.reviewSummary).not.toContain('用例-');
    expect(payloads.casesSummary).toContain('用例-导入用例');
    expect(payloads.casesSummary).toContain('需求-清洗结果');
  });

  test('确认澄清后结果可持久化', async ({ page }) => {
    await page.evaluate(() => {
      try {
        localStorage.removeItem('usecase-workflow-state-v1');
      } catch (err) {}
      var review = document.getElementById('reviewResult');
      if (review) {
        review.value = JSON.stringify([{
          '类别': '需求模糊',
          '不明确的需求点': '点A',
          '不明确原因': '原因A',
          '可能存在的分支/边界情况': '边界A'
        }], null, 2);
      }
      if (window.app && window.app.state) {
        window.app.state.reviewClarifications = new Map();
        window.app.state.reviewClarifications.set(0, '已确认');
      }
      if (window.app && window.app.core && typeof window.app.core.confirmClarifications === 'function') {
        window.app.core.confirmClarifications();
      }
    });

    await page.waitForFunction(() => {
      try {
        var raw = localStorage.getItem('usecase-workflow-state-v1');
        if (!raw) return false;
        var snapshot = JSON.parse(raw);
        var reviewText = snapshot && snapshot.data && snapshot.data.reviewResult ? snapshot.data.reviewResult : '';
        var confirmed = snapshot && snapshot.data ? snapshot.data.reviewClarifyConfirmed : false;
        var signature = snapshot && snapshot.data ? snapshot.data.reviewClarifyConfirmedSignature : '';
        return reviewText.indexOf('需求澄清结果') !== -1 && confirmed === true && Boolean(signature);
      } catch (err) {
        return false;
      }
    });
  });

  test('确认澄清立即持久化', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      try {
        localStorage.removeItem('usecase-workflow-state-v1');
      } catch (err) {}
      var review = document.getElementById('reviewResult');
      if (review) {
        review.value = JSON.stringify([{
          '类别': '需求模糊',
          '不明确的需求点': '点A',
          '不明确原因': '原因A',
          '可能存在的分支/边界情况': '边界A'
        }], null, 2);
      }
      if (window.app && window.app.state) {
        window.app.state.reviewClarifications = new Map();
        window.app.state.reviewClarifications.set(0, '已确认');
      }
      if (window.app && window.app.core && typeof window.app.core.confirmClarifications === 'function') {
        window.app.core.confirmClarifications();
      }
      try {
        var raw = localStorage.getItem('usecase-workflow-state-v1');
        return raw ? JSON.parse(raw) : null;
      } catch (err2) {
        return null;
      }
    });

    expect(snapshot && snapshot.data).toBeTruthy();
    expect(snapshot.data.reviewClarifyConfirmed).toBeTruthy();
    expect(snapshot.data.reviewClarifyConfirmedSignature).toBeTruthy();
    expect(snapshot.data.reviewClarifyFollowupSignature).toBeTruthy();
    expect(snapshot.data.reviewResult).toContain('需求澄清结果');
  });

  test('新评审数据会重置澄清确认状态', async ({ page }) => {
    const result = await page.evaluate(() => {
      var review = document.getElementById('reviewResult');
      if (review) {
        review.value = JSON.stringify([{
          '类别': '需求模糊',
          '不明确的需求点': '点A',
          '不明确原因': '原因A',
          '可能存在的分支/边界情况': '边界A'
        }], null, 2);
      }
      if (window.app && window.app.state) {
        window.app.state.reviewClarifications = new Map();
        window.app.state.reviewClarifications.set(0, '已确认');
      }
      if (window.app && window.app.core && typeof window.app.core.confirmClarifications === 'function') {
        window.app.core.confirmClarifications();
      }
      if (review) {
        review.value = JSON.stringify([{
          '类别': '需求不全',
          '不明确的需求点': '点B',
          '不明确原因': '原因B',
          '可能存在的分支/边界情况': '边界B'
        }], null, 2);
      }
      if (window.app && window.app.core && typeof window.app.core.syncReviewViewFromResult === 'function') {
        window.app.core.syncReviewViewFromResult();
      }
      return {
        confirmed: window.app && window.app.state ? window.app.state.reviewClarifyConfirmed : null,
        signature: window.app && window.app.state ? window.app.state.reviewClarifyConfirmedSignature : null,
      };
    });

    expect(result).toEqual({ confirmed: false, signature: '' });
  });

  test('澄清未确认时需要等待澄清', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      if (!window.app || !window.app.core || !window.app.state) return null;
      window.app.state.autoRequireClarifications = true;
      var review = document.getElementById('reviewResult');
      if (review) {
        review.value = JSON.stringify([{
          '类别': '需求模糊',
          '不明确的需求点': '点A',
          '不明确原因': '原因A',
          '可能存在的分支/边界情况': '边界A'
        }], null, 2);
      }
      window.app.state.reviewClarifications = new Map();
      window.app.state.reviewClarifications.set(0, '待确认');
      if (typeof window.app.core.syncReviewViewFromResult === 'function') {
        window.app.core.syncReviewViewFromResult();
      }
      var before = window.app.core.getAgentClarifyGuardSnapshot();
      if (typeof window.app.core.confirmClarifications === 'function') {
        window.app.core.confirmClarifications();
      }
      var after = window.app.core.getAgentClarifyGuardSnapshot();
      return { before, after };
    });

    expect(snapshot && snapshot.before && snapshot.after).toBeTruthy();
    expect(snapshot.before.required).toBeTruthy();
    expect(snapshot.before.clarify_confirmed).toBeFalsy();
    expect(snapshot.after.required).toBeFalsy();
    expect(snapshot.after.clarify_confirmed).toBeTruthy();
  });

  test('澄清后再评审保持已确认状态', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (!window.app || !window.app.core || !window.app.state) return null;
      window.app.state.autoRequireClarifications = true;
      var review = document.getElementById('reviewResult');
      if (review) {
        review.value = JSON.stringify([{
          '类别': '需求模糊',
          '不明确的需求点': '点A',
          '不明确原因': '原因A',
          '可能存在的分支/边界情况': '边界A'
        }], null, 2);
      }
      window.app.state.reviewClarifications = new Map();
      window.app.state.reviewClarifications.set(0, '已确认');
      if (typeof window.app.core.confirmClarifications === 'function') {
        window.app.core.confirmClarifications();
      }
      if (review) {
        review.value = JSON.stringify([{
          '类别': '需求不全',
          '不明确的需求点': '点B',
          '不明确原因': '原因B',
          '可能存在的分支/边界情况': '边界B'
        }], null, 2);
      }
      if (window.app && window.app.state) {
        window.app.state.reviewClarifyDataSignature = JSON.stringify([{
          '类别': '需求不全',
          '不明确的需求点': '点B',
          '不明确原因': '原因B',
          '可能存在的分支/边界情况': '边界B'
        }]);
        window.app.state.reviewClarifyConfirmed = true;
        window.app.state.reviewClarifyConfirmedSignature = window.app.state.reviewClarifyDataSignature;
      }
      if (typeof window.app.core.getAgentClarifyGuardSnapshot === 'function') {
        return window.app.core.getAgentClarifyGuardSnapshot();
      }
      return null;
    });

    expect(result).toBeTruthy();
    expect(result.required).toBeFalsy();
    expect(result.clarify_confirmed).toBeTruthy();
  });

  test('评审校验失败不视为已评审', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      var review = document.getElementById('reviewResult');
      if (review) review.value = '非 JSON 内容';
      if (window.app && window.app.state) {
        window.app.state.validationFailedSteps = { review: true };
      }
      if (window.app && window.app.core && typeof window.app.core.getAgentClarifyGuardSnapshot === 'function') {
        return window.app.core.getAgentClarifyGuardSnapshot();
      }
      return null;
    });

    expect(snapshot).toBeTruthy();
    expect(snapshot.has_review).toBeFalsy();
    expect(snapshot.review_clarifications_ready).toBeFalsy();
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

  test('刷新后 Agent 执行中的步骤保持进行中', async ({ page }) => {
    await page.evaluate(() => {
      var review = document.getElementById('reviewResult');
      var cleaned = document.getElementById('cleanedText');
      var compare = document.getElementById('compareResult');
      if (review) review.value = '评审已完成';
      if (cleaned) cleaned.value = '清洗已完成';
      if (compare) compare.value = JSON.stringify({ coverage: 80, missing: ['缺失点A'] }, null, 2);
      if (window.app && window.app.state) {
        window.app.state.settings = window.app.state.settings || {};
        window.app.state.settings.caseGenAgentEnabled = true;
        window.app.state.caseGenAgentPlan = [
          { key: 'review', label: '需求评审', status: 'done', attempts: 0, note: '' },
          { key: 'clarify', label: '需求澄清确认', status: 'done', attempts: 0, note: '' },
          { key: 'clean', label: '需求清洗', status: 'done', attempts: 0, note: '' },
          { key: 'compare', label: '对比完整性', status: 'running', attempts: 0, note: '' },
          { key: 'coverage', label: '覆盖率校验', status: 'pending', attempts: 0, note: '' },
        ];
        window.app.state.inProgressSteps = {};
        window.app.state.waitingSteps = {};
        window.app.state.failedSteps = {};
        window.app.state.validationFailedSteps = {};
      }
      if (window.app && window.app.core && typeof window.app.core.applyAutoWorkflowTaskState === 'function') {
        window.app.core.applyAutoWorkflowTaskState({ kind: 'agent', status: 'running' });
      } else if (window.app && window.app.core && typeof window.app.core.updateFlowStatus === 'function') {
        window.app.core.updateFlowStatus();
      }
    });

    const compareStep = page.locator('#flowNav .step[data-target="compare"]');
    await expect(compareStep).toHaveClass(/active/);
    await expect(compareStep).not.toHaveClass(/done/);
  });

  test('Agent 仅拆分时补齐最小前置链路', async ({ page }) => {
    await page.evaluate(() => {
      if (!window.app || !window.app.state || !window.app.core) return;
      window.app.state.settings = window.app.state.settings || {};
      window.app.state.settings.caseGenAgentEnabled = true;
      window.app.state.caseGenAgentPromptRouting = {
        source: '仅拆分',
        prompts: {},
        flow: { stop_after: 'split', only_steps: [], note: '仅执行拆分' },
      };
    });

    const snapshot = await page.evaluate(() => {
      if (!window.app || !window.app.core || typeof window.app.core.getAgentFlowConstraintSnapshot !== 'function') {
        return null;
      }
      return window.app.core.getAgentFlowConstraintSnapshot();
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot.expandedSteps).toEqual(['review', 'clean', 'split']);
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

  test('覆盖对比校验拦截占位模块名', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (window.app && window.app.state) {
        if (!window.app.state.settings) window.app.state.settings = {};
        window.app.state.settings.caseGenAgentEnabled = false;
      }
      var el = document.getElementById('casesCompareResult');
      if (el) {
        el.value = JSON.stringify({
          coverage: 12,
          missing: [{
            module: '模块1',
            key_scenarios: [],
            test_points: ['示例测试点'],
            coupled_modules: [],
          }],
          extra: [],
        }, null, 2);
      }
      var validator = null;
      if (window.app && window.app.core && typeof window.app.core.validateCasesCompareResult === 'function') {
        validator = window.app.core.validateCasesCompareResult;
      } else if (window.app && window.app.autoCore && typeof window.app.autoCore.init === 'function') {
        var tempCore = window.app.autoCore.init({ state: window.app.state || {}, dom: {} });
        if (tempCore && typeof tempCore.validateCasesCompareResult === 'function') {
          validator = tempCore.validateCasesCompareResult;
        }
      }
      if (!validator) return null;
      return validator();
    });

    expect(result).toBeTruthy();
    expect(result).not.toBe(true);
    expect(result.reason).toContain('占位模块名');
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
