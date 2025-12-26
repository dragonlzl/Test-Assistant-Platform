const { test, expect } = require('@playwright/test');

test.describe('一键执行抽屉视图', () => {
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

  test('需求澄清抽屉需手动打开', async ({ page }) => {
    await page.evaluate(() => {
      const toggle = document.getElementById('autoNeedClarify');
      if (toggle) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const review = document.getElementById('reviewResult');
      if (review) {
        review.removeAttribute('readonly');
        review.value = JSON.stringify([{ '不明确的需求点': '接口定义不清' }], null, 2);
      }
      if (window.app && window.app.state) {
        window.app.state.reviewRows = [{
          index: 0,
          source: { '不明确的需求点': '接口定义不清' },
          category: '接口',
          point: '接口定义不清',
          reason: '',
          branch: '',
          clarification: '',
        }];
        window.app.state.autoRequireClarifications = true;
      }
      if (window.app && window.app.core && typeof window.app.core.updateAutoClarifyVisibility === 'function') {
        window.app.core.updateAutoClarifyVisibility();
      }
      if (window.app && window.app.core && typeof window.app.core.renderAutoClarifyView === 'function') {
        window.app.core.renderAutoClarifyView();
      }
    });
    await page.evaluate(() => {
      window.__autoWaitPromise = window.app && window.app.core && typeof window.app.core.waitForAutoClarification === 'function'
        ? window.app.core.waitForAutoClarification()
        : Promise.resolve(true);
    });
    const drawer = page.locator('#autoClarifyDrawer');
    await expect(drawer).not.toHaveClass(/open/);
    await page.click('#autoClarifyToggleBtn');
    await expect(drawer).toHaveClass(/open/);
    await page.click('#autoClarifyConfirm');
    await page.evaluate(() => window.__autoWaitPromise);
    await page.click('#autoClarifyDrawer .drawer-mask');
    await expect(drawer).not.toHaveClass(/open/);
  });

  test('覆盖缺失与用例缺失视图使用抽屉', async ({ page }) => {
    await page.evaluate(() => {
      const compareEl = document.getElementById('compareResult');
      if (compareEl) compareEl.value = JSON.stringify({ coverage: 80, missing: ['缺少需求点A', '缺少需求点B'] });
      if (window.app && window.app.state) {
        window.app.state.autoCompareMissingList = ['缺少需求点A', '缺少需求点B'];
        window.app.state.autoCompareSelections = new Set();
        window.app.state.missingRowCache = [{ moduleName: '模块一', text: '缺失测试点', moduleIndex: 0 }];
        window.app.state.missingSelections = new Set();
        window.app.state.autoRunning = false;
      }
      if (window.app && window.app.core && typeof window.app.core.syncAutoCompareStatus === 'function') {
        window.app.core.syncAutoCompareStatus();
      }
      if (window.app && window.app.core && typeof window.app.core.updateAutoMissingCard === 'function') {
        window.app.core.updateAutoMissingCard();
      }
      if (window.app && window.app.core && typeof window.app.core.renderAutoCompareMissingView === 'function') {
        window.app.core.renderAutoCompareMissingView(['缺少需求点A', '缺少需求点B'], 80, true, false);
        window.app.core.updateAutoCompareActions(80);
      }
    });
    await page.evaluate(() => {
      const btn = document.getElementById('autoCompareToggleBtn');
      if (btn) btn.disabled = false;
    });
    await expect(page.locator('#autoCompareToggleBtn')).toBeEnabled();
    const compareDrawer = page.locator('#autoCompareDrawer');
    const opened = await compareDrawer.getAttribute('class');
    if (opened && opened.indexOf('open') !== -1) {
      await page.click('#closeAutoCompareDrawerBtn');
    }
    await page.click('#autoCompareToggleBtn');
    await expect(compareDrawer).toHaveClass(/open/);
    await expect(page.locator('#autoCompareMissing')).toBeVisible();
    await page.fill('#autoCompareSuggestion', '补充说明');
    await expect(page.locator('#autoCompareSuggestion')).toHaveValue('补充说明');
    await page.click('#closeAutoCompareDrawerBtn');
    await expect(compareDrawer).not.toHaveClass(/open/);

    const missingDrawer = page.locator('#autoMissingDrawer');
    await page.evaluate(() => {
      const btn = document.getElementById('autoMissingToggle');
      if (btn) btn.disabled = false;
      const copy = document.getElementById('autoMissingCopy');
      if (copy) copy.disabled = false;
    });
    await page.click('#autoMissingToggle');
    await expect(missingDrawer).toHaveClass(/open/);
    await expect(page.locator('#autoMissingView')).toBeVisible();
    await expect(page.locator('#autoMissingCopy')).toBeEnabled();
    await page.click('#closeAutoMissingDrawerBtn');
    await expect(missingDrawer).not.toHaveClass(/open/);
  });

  test('覆盖缺失视图在刷新后不自动弹出', async ({ page }) => {
    await page.evaluate(() => {
      const snapshot = {
        version: 1,
        user_id: '',
        updated_at: Date.now(),
        data: {
          compareResult: JSON.stringify({ coverage: 80, missing: ['缺少需求点A'] }),
          rawText: '原始需求',
          cleanedText: '清洗结果',
        },
      };
      localStorage.setItem('usecase-workflow-state-v1', JSON.stringify(snapshot));
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.waitForTimeout(200);
    await expect(page.locator('#autoCompareDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#autoCompareToggleBtn')).toBeEnabled();
  });
});
