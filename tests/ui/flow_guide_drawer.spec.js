const { test, expect } = require('@playwright/test');

test.describe('功能引导抽屉', () => {
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
    await page.goto(base + '/case-library.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('打开抽屉并启动引导', async ({ page }) => {
    const trigger = page.locator('#flowGuideTrigger');
    const drawer = page.locator('#flowGuideDrawer');

    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer).toContainText('用例导入引导（用例库）');
    await expect(drawer.locator('[data-guide-start]')).toHaveCount(5);

    await drawer.locator('[data-guide-start="case-library-import"]').click();
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('#flowGuideOverlay')).toBeVisible();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例相关');

    await page.locator('.guide-skip-all').evaluate((el) => el.click());
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('跳过单步后可进入下一节点', async ({ page }) => {
    await page.locator('#flowGuideTrigger').click();
    await page.locator('[data-guide-start="case-library-import"]').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例相关');

    await page.locator('.guide-skip-step').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例库');

    await page.locator('.guide-skip-all').evaluate((el) => el.click());
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('菜单锁定时悬停其他分组不会切换', async ({ page }) => {
    await page.locator('#flowGuideTrigger').click();
    await page.locator('[data-guide-start="case-library-import"]').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例相关');

    await page.locator('.tab-group-btn[data-group="cases"]').hover();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例库');

    await page.locator('.tab-group-btn[data-group="manage"]').hover();
    await expect(page.locator('[data-group-menu="cases"] [data-tab-btn="case-library"]')).toBeVisible();
    await expect(page.locator('[data-group-menu="manage"]')).toHaveClass(/hidden/);

    await page.locator('.guide-skip-all').evaluate((el) => el.click());
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('启动引导会回到顶部', async ({ page }) => {
    await page.evaluate(() => {
      var spacer = document.getElementById('__guideScrollSpacer');
      if (!spacer) {
        spacer = document.createElement('div');
        spacer.id = '__guideScrollSpacer';
        spacer.style.height = '2000px';
        document.body.appendChild(spacer);
      }
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForFunction(() => window.scrollY > 0);
    const beforeScroll = await page.evaluate(() => window.scrollY);
    expect(beforeScroll).toBeGreaterThan(0);

    await page.locator('#flowGuideTrigger').click();
    await page.locator('[data-guide-start="case-library-import"]').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例相关');
    await page.waitForFunction(() => !document.body.classList.contains('drawer-open'));
    await page.waitForFunction(() => window.scrollY === 0);
    const afterScroll = await page.evaluate(() => window.scrollY);
    expect(afterScroll).toBe(0);

    await page.locator('.guide-skip-all').evaluate((el) => el.click());
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('执行分配拖拽放手后进入下一步', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });
    await expect(page.locator('[data-tab-btn="tempexec"]')).toHaveClass(/active/);

    await page.evaluate(() => {
      if (window.app && window.app.flowGuide) {
        window.app.flowGuide.start('temp-exec', { stepIndex: 8 });
      }
    });
    await expect(page.locator('#flowGuideTooltipText')).toContainText('拖拽用例可交换位置');
    await expect(page.locator('#guideFakeAssignPanel')).toBeVisible();

    const row1 = page.locator('#guideAssignVersionBox1 .temp-req-row').first();
    const row2 = page.locator('#guideAssignVersionBox1 .temp-req-row').nth(1);
    const dragData = await page.evaluateHandle(() => new DataTransfer());
    const row2Rect = await row2.boundingBox();
    await row1.dispatchEvent('dragstart', { dataTransfer: dragData });
    if (row2Rect) {
      await row2.dispatchEvent('dragover', {
        dataTransfer: dragData,
        clientY: row2Rect.y + row2Rect.height - 2,
      });
      await row2.dispatchEvent('drop', {
        dataTransfer: dragData,
        clientY: row2Rect.y + row2Rect.height - 2,
      });
    } else {
      await row2.dispatchEvent('dragover', { dataTransfer: dragData });
      await row2.dispatchEvent('drop', { dataTransfer: dragData });
    }
    await row1.dispatchEvent('dragend', { dataTransfer: dragData });

    const firstRowText = await page.locator('#guideAssignVersionBox1 .temp-req-row .name-text').first().textContent();
    expect(firstRowText || '').toContain('用例例子2');
    await expect(page.locator('#flowGuideTooltipText')).toContainText('拖拽版本盒子可交换位置');

    const box1Header = page.locator('#guideAssignVersionBox1 .temp-project-version-header');
    const box2 = page.locator('#guideAssignVersionBox2');
    const box2Rect = await box2.boundingBox();
    const dragData2 = await page.evaluateHandle(() => new DataTransfer());
    await box1Header.dispatchEvent('dragstart', { dataTransfer: dragData2 });
    if (box2Rect) {
      await box2.dispatchEvent('dragover', {
        dataTransfer: dragData2,
        clientX: box2Rect.x + box2Rect.width - 4,
        clientY: box2Rect.y + box2Rect.height / 2,
      });
      await box2.dispatchEvent('drop', {
        dataTransfer: dragData2,
        clientX: box2Rect.x + box2Rect.width - 4,
        clientY: box2Rect.y + box2Rect.height / 2,
      });
    } else {
      await box2.dispatchEvent('dragover', { dataTransfer: dragData2 });
      await box2.dispatchEvent('drop', { dataTransfer: dragData2 });
    }
    await box1Header.dispatchEvent('dragend', { dataTransfer: dragData2 });

    await expect(page.locator('#flowGuideTooltipText')).toContainText('拖拽用例到专注区');
  });

  test('从设置页启动用例执行引导可继续打开选择抽屉', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/settings.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);

    await page.evaluate(() => {
      if (window.app && window.app.flowGuide) {
        window.app.flowGuide.start('temp-exec');
      }
    });
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例相关');

    await page.locator('.tab-group-btn[data-group="cases"]').hover();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例执行');

    await page.locator('[data-tab-btn="tempexec"]').click();
    await page.waitForURL(/case-exec\.html/);
    await page.waitForFunction(() => window.app && window.app._inited === true);

    await expect(page.locator('#tempexecFlowNav')).toBeVisible();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('选择用例执行');
    await page.locator('#openTempExecCaseLibraryBtn').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('选择目标用例所属项目');
    await expect(page.locator('#caseLibrarySelectExecDrawer')).toHaveClass(/open/);

    await page.locator('.guide-skip-all').evaluate((el) => el.click());
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('用例导入引导结束后解除遮罩', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.evaluate(() => {
      if (window.app && window.app.flowGuide) {
        window.app.flowGuide.start('temp-exec-import', { stepIndex: 7 });
      }
    });
    await expect(page.locator('#guideFakeExecVersionPanel')).toBeVisible();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('选择执行用例的版本');

    await page.locator('#flowGuideFocus').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('确认并继续');

    await page.locator('#flowGuideFocus').click();
    await page.waitForFunction(() => !document.body.classList.contains('guide-active'));
    await page.waitForFunction(() => !document.body.classList.contains('drawer-open'));
    await expect(page.locator('#tempExecImportDrawer')).not.toHaveClass(/open/);
    await page.locator('#flowGuideTrigger').click();
    await expect(page.locator('#flowGuideDrawer')).toHaveClass(/open/);
  });

  test('AI一键引导可推进到导入用例步骤', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/ai-workflow.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);

    await page.evaluate(() => {
      if (window.app && window.app.flowGuide) {
        window.app.flowGuide.start('auto-flow');
      }
    });
    await expect(page.locator('#flowGuideTooltipText')).toContainText('AI 功能');

    await page.locator('.tab-group-btn[data-group="ai"]').hover();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('一键执行');

    await page.locator('[data-tab-btn="auto"]').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('选择需求');
    await page.locator('#flowGuideFocus').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('选择用例');
    await page.locator('#flowGuideFocus').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('人工审核流程');
    await page.locator('#flowGuideFocus').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('执行功能流程');
    await page.locator('#flowGuideFocus').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('观察执行进度');

    await page.locator('.guide-skip-all').evaluate((el) => el.click());
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('缺失模块引导小屏可看到跳过按钮', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 520 });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/ai-workflow.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);

    await page.evaluate(() => {
      if (window.app && window.app.flowGuide) {
        window.app.flowGuide.start('auto-flow', { stepIndex: 8 });
      }
    });
    await expect(page.locator('#flowGuideTooltipText')).toContainText('缺失的测试点');

    const skipAllBtn = page.locator('.guide-skip-all');
    await expect(skipAllBtn).toBeVisible();
    const skipBox = await skipAllBtn.boundingBox();
    const viewport = page.viewportSize();
    expect(skipBox).not.toBeNull();
    if (skipBox && viewport) {
      expect(skipBox.y).toBeGreaterThanOrEqual(0);
      expect(skipBox.y + skipBox.height).toBeLessThanOrEqual(viewport.height);
    }

    await skipAllBtn.click();
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('用例生成引导可进入全模块生成步骤', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/ai-workflow.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);

    await page.evaluate(() => {
      if (window.app && window.app.flowGuide) {
        window.app.flowGuide.start('casesgen');
      }
    });
    await expect(page.locator('#flowGuideTooltipText')).toContainText('AI 功能');

    await page.locator('.tab-group-btn[data-group="ai"]').hover();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('用例生成');

    await page.locator('[data-tab-btn="casesgen"]').click();
    await expect(page.locator('#flowGuideTooltipText')).toContainText('所有模块');

    await page.locator('.guide-skip-all').click();
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });

  test('版本选择禁用时可通过聚焦区继续', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.evaluate(() => {
      if (window.app && window.app.flowGuide) {
        window.app.flowGuide.start('temp-exec', { stepIndex: 4 });
      }
    });
    await expect(page.locator('#flowGuideTooltipText')).toContainText('选择目标用例所属项目版本');
    const versionSelect = page.locator('#caseLibrarySelectVersionSelect');
    await expect(versionSelect).toBeVisible();
    await expect(versionSelect).toBeDisabled();

    await page.locator('#flowGuideFocus').click();
    await expect(page.locator('#flowGuideTooltipText')).toHaveText(/刷新后下方会展示用例列表|执行分配/);
    await page.locator('.guide-skip-all').click();
    await expect(page.locator('#flowGuideOverlay')).toHaveClass(/hidden/);
  });
});
