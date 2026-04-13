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

  test('缺失智能填充会按当前拆分结果同步旧流程用例生成', async ({ page }) => {
    await page.evaluate(() => {
      var splitPayload = JSON.stringify([{
        module: '短按吞噬功能',
        key_scenarios: ['吞噬敌人'],
        test_points: ['已有测试点'],
        coupled_modules: [],
      }], null, 2);
      var coveragePayload = JSON.stringify({
        coverage: 95,
        missing: [{
          module: '短按吞噬功能',
          points: ['缺失测试点A'],
        }],
        extra: [],
      }, null, 2);
      var splitEl = document.getElementById('splitResult');
      if (splitEl) {
        splitEl.removeAttribute('readonly');
        splitEl.value = splitPayload;
        splitEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var coverageEl = document.getElementById('casesCompareResult');
      if (coverageEl) {
        coverageEl.removeAttribute('readonly');
        coverageEl.value = coveragePayload;
        coverageEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var state = window.app && window.app.state ? window.app.state : null;
      if (!state) return;
      state.caseGenModules = [{
        id: 'stale-mod',
        title: '旧模块',
        module: '旧模块',
        scenarios: [],
        points: [],
        coupled: [],
      }];
      state.caseGenSource = '[{"module":"旧模块"}]';
      state.caseGenResults = {};
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.missingLastList = [{
        module: '短按吞噬功能',
        scenarios: [],
        points: ['缺失测试点A'],
        coupled: [],
        special: [],
      }];
      state.missingRowCache = [{
        moduleIndex: 0,
        moduleName: '短按吞噬功能',
        pointIndex: 0,
        text: '缺失测试点A',
      }];
      state.missingSelections = new Set([0]);
      state.autoRunning = false;
      state.caseGenSettings = state.caseGenSettings && typeof state.caseGenSettings === 'object'
        ? state.caseGenSettings
        : {};
      state.caseGenSettings.activeTab = 'settings';
      if (window.app && window.app.core && typeof window.app.core.updateAutoMissingCard === 'function') {
        window.app.core.updateAutoMissingCard();
      }
    });

    await expect(page.locator('#autoMissingSmartFill')).toBeEnabled();
    await page.click('#autoMissingToggle');
    await expect(page.locator('#autoMissingDrawer')).toHaveClass(/open/);
    await page.click('#autoMissingSmartFill');

    const firstFillState = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      return {
        activeTab: state ? String(state.activeTab || '') : '',
        activeCaseGenTab: state && state.caseGenSettings ? String(state.caseGenSettings.activeTab || '') : '',
        modules: state && Array.isArray(state.caseGenModules)
          ? state.caseGenModules.map(function(item) { return String((item && (item.title || item.module)) || ''); })
          : [],
        suggestionValues: state && state.caseGenSuggestions
          ? Object.keys(state.caseGenSuggestions).map(function(key) { return String(state.caseGenSuggestions[key] || ''); })
          : [],
      };
    });

    expect(firstFillState.activeTab).toBe('casesgen');
    expect(firstFillState.activeCaseGenTab).toBe('legacy-modules');
    expect(firstFillState.modules).toEqual(['短按吞噬功能']);
    expect(firstFillState.suggestionValues.some(function(item) {
      return item.indexOf('缺失测试要点：缺失测试点A') !== -1;
    })).toBeTruthy();
    await expect(page.locator('#caseGenLegacyModulesTabBtn')).toHaveClass(/is-active/);
    await expect(page.locator('#casesGenerationContainer')).toContainText('短按吞噬功能');
    await expect(page.locator('#casesGenerationContainer textarea[data-suggestion]')).toHaveValue(/缺失测试要点：缺失测试点A/);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('auto');
        window.app.switchTab('casesgen');
      }
    });
    await expect(page.locator('#casesGenerationContainer textarea[data-suggestion]')).toHaveValue(/缺失测试要点：缺失测试点A/);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('auto');
      }
      if (window.app && window.app.core && typeof window.app.core.updateAutoMissingCard === 'function') {
        window.app.core.updateAutoMissingCard();
      }
    });

    await page.click('#autoMissingToggle');
    await page.click('#autoMissingSmartFill');
    const secondFillStatus = await page.evaluate(() => {
      var autoStatus = document.getElementById('autoMissingStatus');
      var missingStatus = document.getElementById('missingViewStatus');
      return {
        autoStatus: autoStatus ? String(autoStatus.textContent || '').trim() : '',
        missingStatus: missingStatus ? String(missingStatus.textContent || '').trim() : '',
      };
    });
    expect(secondFillStatus.autoStatus).not.toContain('请先完成测试模块拆分');
    expect(secondFillStatus.missingStatus).not.toContain('请先完成测试模块拆分');
  });
});
