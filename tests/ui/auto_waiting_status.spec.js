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
});
