const { test, expect } = require('@playwright/test');

test.describe('一键执行阻塞原因提示', () => {
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

  test('等待/失败状态展示阻塞原因气泡', async ({ page }) => {
    await page.evaluate(() => {
      var state = window.app && window.app.state;
      if (state) {
        state.waitingSteps = { compare: true };
        state.failedSteps = { split: true };
        state.waitingReasons = { compare: '等待澄清确认' };
        state.failedReasons = { split: '拆分失败：模型响应为空' };
        state.validationFailedSteps = {};
        state.validationFailedReasons = {};
      }
      var core = window.app && window.app.core;
      if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
    });

    const compareStep = page.locator('#flowNav .step[data-target=compare]');
    await expect(compareStep).toHaveClass(/waiting/);
    const compareReason = compareStep.locator('.step-reason');
    await expect(compareReason).toHaveText('等待澄清确认');
    await expect(compareReason).not.toHaveClass(/hidden/);
    await expect(compareReason).toHaveClass(/reason-short/);
    const compareWhiteSpace = await compareReason.evaluate((el) => {
      var style = window.getComputedStyle(el);
      return style.whiteSpace;
    });
    expect(compareWhiteSpace).toBe('nowrap');

    const splitStep = page.locator('#flowNav .step[data-target=split]');
    await expect(splitStep).toHaveClass(/failed/);
    const splitReason = splitStep.locator('.step-reason');
    await expect(splitReason).toHaveText('拆分失败：模型响应为空');
    await expect(splitReason).not.toHaveClass(/hidden/);
    await expect(page.locator('#autoFlowCompact .step-reason')).toHaveCount(0);
    await expect(page.locator('.ai-flow-substep .step-reason')).toHaveCount(0);

    await page.evaluate(() => {
      var state = window.app && window.app.state;
      if (state) {
        state.waitingSteps = {};
        state.failedSteps = {};
        state.waitingReasons = {};
        state.failedReasons = {};
        state.validationFailedSteps = {};
        state.validationFailedReasons = {};
      }
      var core = window.app && window.app.core;
      if (core && typeof core.updateFlowStatus === 'function') core.updateFlowStatus();
    });

    await expect(compareReason).toHaveClass(/hidden/);
    await expect(splitReason).toHaveClass(/hidden/);
  });
});
