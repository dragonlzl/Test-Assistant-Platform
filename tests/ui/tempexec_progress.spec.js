const { test, expect } = require('@playwright/test');

test.describe('临时执行进度视图', () => {
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
        const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : '进度测试需求';
        await dialog.accept(answer);
        return;
      }
      await dialog.accept();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('执行概览统计与拖拽同步', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '进度测试需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });

    const execFileA = {
      name: 'progressA.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录', steps: 'step1', expected: 'ok' },
        { module: '模块A', title: '退出', steps: 'step2', expected: 'ok' },
      ], null, 2)),
    };
    const execFileB = {
      name: 'progressB.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块B', title: '下单', steps: 'step', expected: 'ok' },
        { module: '模块B', title: '支付', steps: 'step', expected: 'ok' },
      ], null, 2)),
    };
    page.__promptAnswers.push('需求一');
    page.__promptAnswers.push('需求二');
    await page.setInputFiles('#tempExecInput', [execFileA, execFileB]);
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });

    page.__promptAnswers.push('版本一');
    await page.click('#createTempVersionBtn');
    page.__promptAnswers.push('版本二');
    await page.click('#createTempVersionBtn');
    await expect(page.locator('#tempVersionGrid [data-temp-version]')).toHaveCount(2);

    const navRows = page.locator('#tempExecNav .temp-req-row[data-temp-file]');
    const firstVersionBody = page.locator('#tempVersionGrid [data-temp-version]').first().locator('.temp-version-body');
    await navRows.first().dragTo(firstVersionBody);
    await expect(navRows).toHaveCount(1);

    const versionOneFileBtn = page.locator('#tempVersionGrid [data-temp-version]').first().locator('button[data-temp-file]').first();
    await versionOneFileBtn.click();
    const firstFileSelects = page.locator('#tempExecView select[data-temp-result]');
    await firstFileSelects.nth(0).selectOption('通过');
    await firstFileSelects.nth(1).selectOption('失败');
    const navButtons = page.locator('#tempExecNav button[data-temp-file]');
    await navButtons.first().click();
    const secondFileSelects = page.locator('#tempExecView select[data-temp-result]');
    await secondFileSelects.nth(0).selectOption('阻塞');
    await secondFileSelects.nth(1).selectOption('不适用');
    const versionOneRow = page.locator('#tempVersionGrid [data-temp-version]').first().locator('.temp-req-row').first();
    await expect(versionOneRow).toHaveClass(/err/);
    await expect(navRows.first()).toHaveClass(/err/);

    await page.click('#tempExecOverviewBtn');
    const overviewEntries = page.locator('#tempExecOverview .temp-overview-entry');
    await expect(overviewEntries).toHaveCount(2);
    const overviewData = await page.$$eval('#tempExecOverview .temp-overview-entry', (nodes) => nodes.map((node) => {
      const header = node.querySelector('.temp-overview-header span');
      const rate = node.querySelector('.temp-overview-rate');
      const meta = node.querySelector('.temp-overview-meta');
      return {
        title: header ? header.textContent.trim() : '',
        rate: rate ? rate.textContent.trim() : '',
        meta: meta ? meta.textContent : '',
        barColors: Array.from(node.querySelectorAll('.temp-overview-bar .temp-overview-segment')).map(seg => seg.className || ''),
      };
    }));
    const progressEntry = overviewData.find(item => item.title.indexOf('progressA.json') !== -1);
    expect(progressEntry && progressEntry.rate).toContain('执行进度 50%');
    expect(progressEntry && progressEntry.meta).toContain('通过 1');
    expect(progressEntry && progressEntry.meta).toContain('失败 1');
    const pendingEntry = overviewData.find(item => item.title.indexOf('progressB.json') !== -1);
    expect(pendingEntry && pendingEntry.rate).toContain('执行进度 50%');
    expect(pendingEntry && pendingEntry.meta).toContain('阻塞 1');
    expect(pendingEntry && pendingEntry.meta).toContain('不适用 1');
    expect(progressEntry && progressEntry.barColors.some(cls => cls.indexOf('status-failed') !== -1 || cls.indexOf('status-blocked') !== -1)).toBeTruthy();
    expect(pendingEntry && pendingEntry.barColors.some(cls => cls.indexOf('status-blocked') !== -1 || cls.indexOf('status-unspecified') !== -1)).toBeTruthy();
    await expect(page.locator('#tempExecOverview')).toContainText('版本一');
    await expect(page.locator('#tempExecOverview')).toContainText('需求区（未分配版本）');

    await page.click('#tempExecBackBtn');
    await expect(page.locator('#tempExecView')).toBeVisible();

    const secondVersionBody = page.locator('#tempVersionGrid [data-temp-version]').nth(1).locator('.temp-version-body');
    await navRows.first().dragTo(secondVersionBody);
    await expect(navRows).toHaveCount(0);
    await page.click('#tempExecOverviewBtn');
    await expect(page.locator('#tempExecOverview')).toContainText('版本二');
    await expect(page.locator('#tempExecOverview')).toContainText('暂无未分配的用例');
    const finalColors = await page.$$eval('#tempExecOverview .temp-overview-entry', (nodes) => nodes.map((node) => {
      return Array.from(node.querySelectorAll('.temp-overview-bar .temp-overview-segment')).map(seg => seg.className || '');
    }));
    expect(finalColors.some(list => list.some(cls => cls.indexOf('status-failed') !== -1 || cls.indexOf('status-blocked') !== -1))).toBeTruthy();
  });
});
