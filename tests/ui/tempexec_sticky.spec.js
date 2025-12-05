const { test, expect } = require('@playwright/test');

test.describe('执行视图粘顶布局', () => {
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
        const answer = page.__promptAnswers && page.__promptAnswers.length ? page.__promptAnswers.shift() : '粘顶需求';
        await dialog.accept(answer);
        return;
      }
      await dialog.accept();
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
    await page.evaluate(() => {
      document.documentElement.style.overflowY = 'auto';
      document.documentElement.style.overflowX = 'hidden';
      document.body.style.overflow = 'visible';
    });
    await page.evaluate(() => {
      ['usecase-card-collapse-v1', 'usecase-temp-exec-v1', 'tempexec-focus-v1', 'tempexec-page-size'].forEach((key) => {
        window.localStorage.removeItem(key);
      });
    });
  });

  test('功能导航与当前文件工具条保持粘顶', async ({ page }) => {
    await page.click('[data-tab-btn="tempexec"]');
    await page.evaluate(() => {
      window.app.state.requirementLabel = '粘顶导航需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });
    await page.click('#openTempExecDrawerBtn');
    await page.setInputFiles('#tempExecInput', {
      name: 'sticky.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { module: '模块A', title: '登录', steps: '步骤1', expected: '成功' },
        { module: '模块B', title: '下单', steps: '步骤2', expected: '成功' },
      ], null, 2)),
    });
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });
    await page.click('#closeTempExecDrawerBtn');
    await page.click('#openTempExecViewNavBtn');
    await expect(page.locator('#tempExecToolbarCard')).toBeVisible();

    const navTopBefore = await page.$eval('#tempexecFlowNav', (el) => el.getBoundingClientRect().top);
    const toolbarTopBefore = await page.$eval('#tempExecToolbarCard', (el) => el.getBoundingClientRect().top);

    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(200);

    const navTopAfter = await page.$eval('#tempexecFlowNav', (el) => el.getBoundingClientRect().top);
    const toolbarTopAfter = await page.$eval('#tempExecToolbarCard', (el) => el.getBoundingClientRect().top);
    const navStyle = await page.$eval('#tempexecFlowNav', (el) => getComputedStyle(el).position);
    const toolbarStyle = await page.$eval('#tempExecToolbarCard', (el) => getComputedStyle(el).position);
    const navOverflow = await page.$eval('#tempexecFlowNav', (el) => {
      var node = el.parentElement;
      while (node) {
        var style = getComputedStyle(node);
        if (style.overflow !== 'visible' || style.overflowY !== 'visible') {
          return { tag: node.tagName.toLowerCase(), className: node.className, overflow: style.overflow, overflowY: style.overflowY };
        }
        node = node.parentElement;
      }
      return null;
    });
    const toolbarOverflow = await page.$eval('#tempExecToolbarCard', (el) => {
      var node = el.parentElement;
      while (node) {
        var style = getComputedStyle(node);
        if (style.overflow !== 'visible' || style.overflowY !== 'visible') {
          return { tag: node.tagName.toLowerCase(), className: node.className, overflow: style.overflow, overflowY: style.overflowY };
        }
        node = node.parentElement;
      }
      return null;
    });
    const scrollState = await page.evaluate(() => ({
      body: document.body.scrollTop,
      doc: document.documentElement.scrollTop,
      page: window.pageYOffset,
    }));

    console.log('tempexec nav style', navStyle, 'top before/after', navTopBefore, navTopAfter, 'overflow ancestor', navOverflow);
    console.log('tempexec toolbar style', toolbarStyle, 'top before/after', toolbarTopBefore, toolbarTopAfter, 'overflow ancestor', toolbarOverflow, 'scroll', scrollState);
    await expect(navStyle).toBe('sticky');
    await expect(toolbarStyle).toBe('sticky');
    await expect(navTopAfter).toBeGreaterThanOrEqual(0);
    await expect(toolbarTopAfter).toBeGreaterThanOrEqual(0);
    await expect(Math.abs(navTopAfter - navTopBefore)).toBeLessThan(60);
    await expect(Math.abs(toolbarTopAfter - toolbarTopBefore)).toBeLessThan(60);
    await expect(navTopAfter).toBeLessThan(260);
    await expect(toolbarTopAfter).toBeLessThan(360);
  });
});
