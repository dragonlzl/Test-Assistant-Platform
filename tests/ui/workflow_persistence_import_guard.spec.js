const { test, expect } = require('@playwright/test');

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
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('新导入需求后页面数据会被清空（含用例生成数据）');
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
