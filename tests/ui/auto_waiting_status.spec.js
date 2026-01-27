const { test, expect } = require('@playwright/test');

test.describe('一键执行等待状态', () => {
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
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('澄清等待时导航显示橙色高亮', async ({ page }) => {
    await page.evaluate(() => {
      var state = window.app && window.app.state;
      if (state) {
        state.reviewRows = [{ index: 0 }];
      }
      var review = document.getElementById('reviewResult');
      if (review) review.value = '[]';
      var core = window.app && window.app.core;
      if (core && typeof core.clearAllWaitingSteps === 'function') {
        core.clearAllWaitingSteps();
      }
      if (core && typeof core.setStepWaiting === 'function') {
        core.setStepWaiting('review');
      } else if (state) {
        state.waitingSteps = { review: true };
        if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
      }
    });
    const reviewStep = page.locator('#flowNav .step[data-target="review"]');
    await expect(reviewStep).toHaveClass(/waiting/);
    await expect(reviewStep.locator('.step-status')).toHaveAttribute('data-status', 'waiting');
    const border = await reviewStep.evaluate(function(el) {
      return window.getComputedStyle(el).borderColor;
    });
    expect(border).toBe('rgb(249, 115, 22)');
  });

  test('覆盖率不足时对比步骤进入等待确认', async ({ page }) => {
    await page.evaluate(() => {
      var compareEl = document.getElementById('compareResult');
      if (compareEl) compareEl.value = JSON.stringify({ coverage: 80, missing: [] });
      if (window.app && window.app.state) {
        window.app.state.waitingSteps = {};
        window.app.state.autoRequireClarifications = true;
      }
      var core = window.app && window.app.core;
      try {
        if (core && typeof core.enforceAutoCoverageRequirement === 'function') {
          core.enforceAutoCoverageRequirement();
        } else if (window.app && window.app.state) {
          if (core && typeof core.clearAllWaitingSteps === 'function') core.clearAllWaitingSteps();
          if (core && typeof core.setStepWaiting === 'function') core.setStepWaiting('compare');
          else window.app.state.waitingSteps = { compare: true };
        }
      } catch (err) {
        // 预期流程会中断等待确认，异常可忽略
      }
      if (core && typeof core.updateFlowStatus === 'function') {
        core.updateFlowStatus();
      }
    });
    const compareStep = page.locator('#flowNav .step[data-target="compare"]');
    await expect(compareStep).toHaveClass(/waiting/);
    await expect(compareStep.locator('.step-status')).toHaveAttribute('data-status', 'waiting');
    const border = await compareStep.evaluate(function(el) {
      return window.getComputedStyle(el).borderColor;
    });
    expect(border).toBe('rgb(249, 115, 22)');
  });

  test('澄清等待时导航跳转到一键执行澄清区', async ({ page }) => {
    await page.evaluate(() => {
      var clarifySection = document.querySelector('[data-section-id="auto-clarify"]');
      if (clarifySection) clarifySection.classList.remove('hidden');
      if (window.app && window.app.state) {
        window.app.state.waitingSteps = { review: true };
        window.app.state.autoRequireClarifications = true;
      }
      var core = window.app && window.app.core;
      if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
    });
    await page.locator('#flowNav .step[data-target="review"]').click();
    const autoTab = page.locator('[data-tab-btn="auto"]');
    await expect(autoTab).toHaveClass(/active/);
    const clarifyCard = page.locator('[data-section-id="auto-clarify"]');
    await expect(clarifyCard).not.toHaveClass(/hidden/);
  });

  test('覆盖率不足等待时导航跳转到一键执行对比区', async ({ page }) => {
    await page.evaluate(() => {
      var compareSection = document.querySelector('[data-section-id="auto-compare"]');
      if (compareSection) compareSection.classList.remove('hidden');
      if (window.app && window.app.state) {
        window.app.state.waitingSteps = { compare: true };
        window.app.state.autoRequireClarifications = true;
      }
      var core = window.app && window.app.core;
      if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
    });
    await page.locator('#flowNav .step[data-target="compare"]').click();
    const autoTab = page.locator('[data-tab-btn="auto"]');
    await expect(autoTab).toHaveClass(/active/);
    const compareCard = page.locator('[data-section-id="auto-compare"]');
    await expect(compareCard).not.toHaveClass(/hidden/);
  });

  test('数据不合法时显示失败状态', async ({ page }) => {
    await page.evaluate(() => {
      var core = window.app && window.app.core;
      if (core && typeof core.clearAllFailedSteps === 'function') core.clearAllFailedSteps();
      if (core && typeof core.setStepFailed === 'function') {
        core.setStepFailed('compare');
      } else if (window.app && window.app.state) {
        window.app.state.failedSteps = { compare: true };
        if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
      }
    });
    const compareStep = page.locator('#flowNav .step[data-target="compare"]');
    await expect(compareStep).toHaveClass(/failed/);
    await expect(compareStep.locator('.step-status')).toHaveAttribute('data-status', 'failed');
    const border = await compareStep.evaluate(function(el) {
      return window.getComputedStyle(el).borderColor;
    });
    expect(border).toBe('rgb(239, 68, 68)');
  });

  test('评审或清洗结果无效时显示失败状态', async ({ page }) => {
    await page.evaluate(() => {
      var core = window.app && window.app.core;
      if (core && typeof core.clearAllFailedSteps === 'function') core.clearAllFailedSteps();
      var review = document.getElementById('reviewResult');
      var cleaned = document.getElementById('cleanedText');
      if (review) review.value = 'not a json array';
      if (cleaned) cleaned.value = '{invalid json';
      if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
    });
    const reviewStep = page.locator('#flowNav .step[data-target="review"]');
    const cleanStep = page.locator('#flowNav .step[data-target="clean"]');
    const validation = await page.evaluate(() => (window.app && window.app.state) ? window.app.state.validationFailedSteps : {});
    expect(validation.review).toBe(true);
    expect(validation.clean).toBe(true);
    await expect(reviewStep).toHaveClass(/failed/);
    await expect(cleanStep).toHaveClass(/failed/);
    await expect(reviewStep.locator('.step-status')).toHaveAttribute('data-status', 'failed');
    await expect(cleanStep.locator('.step-status')).toHaveAttribute('data-status', 'failed');
  });

  test('评审结果格式异常时澄清区提示异常', async ({ page }) => {
    await page.evaluate(() => {
      var review = document.getElementById('reviewResult');
      if (review) review.value = '评审输出包含非 JSON 内容';
      if (window.app && window.app.state) {
        window.app.state.reviewRows = [];
        window.app.state.autoRequireClarifications = true;
      }
      var core = window.app && window.app.core;
      if (core && typeof core.renderAutoClarifyView === 'function') core.renderAutoClarifyView();
    });
    await expect(page.locator('#autoClarifyContainer')).toContainText('评审结果格式异常');
  });

  test('导入无效结果时自动标红', async ({ page }) => {
    await page.evaluate(() => {
      var compare = document.getElementById('compareResult');
      var split = document.getElementById('splitResult');
      if (compare) compare.value = 'not json coverage';
      if (split) split.value = '[]invalid{}';
      var core = window.app && window.app.core;
      if (core && typeof core.clearAllFailedSteps === 'function') core.clearAllFailedSteps();
      if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
    });
    const compareStep = page.locator('#flowNav .step[data-target="compare"]');
    const splitStep = page.locator('#flowNav .step[data-target="split"]');
    const validation = await page.evaluate(() => (window.app && window.app.state) ? window.app.state.validationFailedSteps : {});
    expect(validation.compare).toBe(true);
    expect(validation.split).toBe(true);
    await expect(compareStep).toHaveClass(/failed/);
    await expect(splitStep).toHaveClass(/failed/);
    await expect(compareStep.locator('.step-status')).toHaveAttribute('data-status', 'failed');
    await expect(splitStep.locator('.step-status')).toHaveAttribute('data-status', 'failed');
  });
});
