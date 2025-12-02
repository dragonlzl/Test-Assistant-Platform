const { test, expect } = require('@playwright/test');

test.describe('执行视图导入导出与拖拽', () => {
  test.beforeEach(async ({ page }) => {
    page.__promptAnswers = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : 'UI执行需求';
        await dialog.accept(answer);
        return;
      }
      await dialog.accept();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('导入导出、拖拽与配置恢复', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
    await page.evaluate(() => {
      window.app.state.requirementLabel = 'UI执行需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFileA = {
      name: 'execA.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录', steps: '步骤1', expected: '成功' },
        { module: '模块A', title: '退出', steps: '步骤2', expected: '成功' },
      ], null, 2)),
    };
    const execFileB = {
      name: 'execB.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块B', title: '下单', steps: '填写信息', expected: '下单成功' },
      ], null, 2)),
    };
    page.__promptAnswers.push('UI执行需求');
    page.__promptAnswers.push('支付需求');
    await page.setInputFiles('#tempExecInput', [execFileA, execFileB]);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });
    const reqCount = await page.locator('#tempExecNav [data-temp-req]').count();
    expect(reqCount).toBeGreaterThanOrEqual(2);

    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportTempExecBtn'),
    ]);
    const jsonName = await jsonDownload.suggestedFilename();
    expect(jsonName).toMatch(/\.json$/);

    const [cfgDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportTempExecConfigBtn'),
    ]);
    expect(await cfgDownload.suggestedFilename()).toMatch(/tempexec_full/i);

    const [xmindDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportTempExecXmindBtn'),
    ]);
    expect(await xmindDownload.suggestedFilename()).toMatch(/\.xmind$/);

    page.__promptAnswers.push('版本A');
    await page.click('#createTempVersionBtn');
    page.__promptAnswers.push('版本B');
    await page.click('#createTempVersionBtn');
    await expect(page.locator('#tempVersionGrid [data-temp-version]')).toHaveCount(2);

    const firstReq = page.locator('#tempExecNav [data-temp-req]').first();
    const firstVersion = page.locator('#tempVersionGrid [data-temp-version]').first();
    const firstVersionBody = firstVersion.locator('.temp-version-body');
    await firstReq.dragTo(firstVersionBody);
    await expect(firstVersion.locator('[data-temp-req-key]')).toHaveCount(1);

    const versionReq = firstVersion.locator('[data-temp-req]').first();
    const secondVersion = page.locator('#tempVersionGrid [data-temp-version]').nth(1);
    const secondVersionBody = secondVersion.locator('.temp-version-body');
    await versionReq.dragTo(secondVersionBody);
    await expect(secondVersion.locator('[data-temp-req-key]')).toHaveCount(1);

    const versionBox = secondVersion.locator('[data-temp-req-key]').first();
    const navPool = page.locator('[data-temp-req-pool]');
    await versionBox.dragTo(navPool);
    await expect(page.locator('#tempExecNav')).toContainText('UI执行需求');

    const focusZone = page.locator('[data-temp-focus-zone]');
    const navFileRow = page.locator('#tempExecNav .temp-req-row[data-temp-file]', { hasText: 'execA.json' });
    await navFileRow.dragTo(focusZone);
    await expect(focusZone.locator('button[data-temp-file]')).toHaveCount(1);
    const focusNames = await page.$$eval('#tempFocusBlock button[data-temp-file]', (nodes) => nodes.map((btn) => btn.textContent || ''));
    expect(focusNames.some((text) => text.indexOf('execA.json') !== -1)).toBeTruthy();

    const navRows = page.locator('#tempExecNav .temp-req-row[data-temp-file]');
    const navRowCount = await navRows.count();
    expect(navRowCount).toBeGreaterThanOrEqual(2);
    await navRows.nth(navRowCount - 1).dragTo(navRows.first());
    const navOrder = await page.$$eval('#tempExecNav .temp-req-row[data-temp-file] .name-text', (nodes) => nodes.map((el) => (el.textContent || '').trim()));
    expect(navOrder).toContain('execA.json');
    expect(navOrder).toContain('execB.json');

    const firstNavButton = page.locator('#tempExecNav button[data-temp-file]').first();
    const activeNavName = (await firstNavButton.locator('.name-text').textContent()) || '';
    await firstNavButton.click();
    await expect(page.locator('#tempExecView')).toContainText('当前文件');
    await expect(page.locator('#tempExecView')).toContainText(activeNavName.trim());
    const resultSelect = page.locator('#tempExecView select[data-temp-result]').first();
    await resultSelect.selectOption('通过');

    await page.click('#tempExecOverviewBtn');
    await expect(page.locator('#tempExecOverview')).toContainText('执行进度');
    await expect(page.locator('#tempExecOverview [data-temp-file]')).toHaveCount(2);
    await page.click('#tempExecBackBtn');

    const snapshot = await page.evaluate(() => JSON.stringify({
      type: 'tempexec_snapshot_v1',
      generatedAt: new Date().toISOString(),
      requirement: window.app.state.requirementLabel || '',
      files: window.app.state.tempExecFiles,
      versions: window.app.state.tempExecVersions,
      focus: window.app.state.tempExecFocus || [],
      pageSize: window.app.state.tempExecPageSize || 0,
      columns: (window.app.state.settings && window.app.state.settings.tempExecColumns) || {},
      activeId: window.app.state.tempExecActiveId || '',
      placement: window.app.state.tempExecPlacement || { requirementOrder: [], fileOrder: {}, versionOrder: [] },
    }));
    await page.evaluate(() => {
      const keys = ['usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'];
      keys.forEach((key) => window.localStorage.removeItem(key));
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.click('[data-tab-btn="tempexec"]');
    await expect(page.locator('#tempExecNav .temp-req-row[data-temp-file]')).toHaveCount(0);

    await page.setInputFiles('#importTempExecConfigFile', {
      name: 'snapshot.json',
      mimeType: 'application/json',
      buffer: Buffer.from(snapshot),
    });
    await expect(page.locator('#tempExecStatus')).toContainText('执行页面配置已导入', { timeout: 5000 });
    await expect(page.locator('#tempExecNav .temp-req-row[data-temp-file]')).toHaveCount(2);
  });
});
