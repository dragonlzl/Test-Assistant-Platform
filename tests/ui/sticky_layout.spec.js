const { test, expect } = require('@playwright/test');

test.describe('页面粘顶区域', () => {
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
  });

  test('侧边页签保持粘顶', async ({ page }) => {
    const tabsSelector = 'nav.tabs.vertical';
    const rootOverflow = await page.evaluate(() => {
      var rootStyle = getComputedStyle(document.documentElement);
      var bodyStyle = getComputedStyle(document.body);
      return {
        html: { overflow: rootStyle.overflow, overflowY: rootStyle.overflowY },
        body: { overflow: bodyStyle.overflow, overflowY: bodyStyle.overflowY },
      };
    });
    console.log('root overflow', rootOverflow);
    await expect(page.locator(tabsSelector)).toBeVisible();
    const tabsStyle = await page.$eval(tabsSelector, (el) => {
      const style = getComputedStyle(el);
      return { position: style.position, top: style.top };
    });
    const tabsOverflow = await page.$eval(tabsSelector, (el) => {
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
    console.log('tabs style', tabsStyle, 'overflow ancestor', tabsOverflow);
    await expect(tabsStyle.position).toBe('sticky');
    const topBefore = await page.$eval(tabsSelector, (el) => el.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const topAfter = await page.$eval(tabsSelector, (el) => el.getBoundingClientRect().top);
    const scrollState = await page.evaluate(() => ({
      body: document.body.scrollTop,
      doc: document.documentElement.scrollTop,
      page: window.pageYOffset,
    }));
    console.log('scroll state tabs', scrollState);
    await expect(topAfter).toBeGreaterThanOrEqual(0);
    await expect(topAfter).toBeLessThan(200);
    await expect(Math.abs(topAfter - topBefore)).toBeLessThan(300);
  });

  test('AI一键需求&用例评审步骤粘顶', async ({ page }) => {
    const flowSelector = '#flowNav';
    await expect(page.locator(flowSelector)).toBeVisible();
    const flowStyle = await page.$eval(flowSelector, (el) => {
      const style = getComputedStyle(el);
      return { position: style.position, top: style.top };
    });
    const flowOverflow = await page.$eval(flowSelector, (el) => {
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
    console.log('flow style', flowStyle, 'overflow ancestor', flowOverflow);
    await expect(flowStyle.position).toBe('sticky');
    const initialTop = await page.$eval(flowSelector, (el) => el.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const scrolledTop = await page.$eval(flowSelector, (el) => el.getBoundingClientRect().top);
    const scrollStateFlow = await page.evaluate(() => ({
      body: document.body.scrollTop,
      doc: document.documentElement.scrollTop,
      page: window.pageYOffset,
    }));
    console.log('scroll state flow', scrollStateFlow);
    await expect(scrolledTop).toBeGreaterThanOrEqual(0);
    await expect(scrolledTop).toBeLessThan(180);
    await expect(Math.abs(initialTop - scrolledTop)).toBeLessThan(260);
  });

  test('AI评审步骤粘顶区域顶部无漏底', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(200);
    const top = await page.$eval('#flowNav', (el) => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(160);
  });

  test('用例生成页前往拆分按钮可跳转', async ({ page }) => {
    await page.click('[data-tab-btn="casesgen"]');
    const jumpBtn = page.locator('#toSplitFromCaseGen');
    await expect(jumpBtn).toBeVisible();
    await jumpBtn.click();
    await page.waitForFunction(() => {
      var sec = document.querySelector('[data-section-id="split"]');
      return sec && sec.getBoundingClientRect().top < 260;
    });
    const cleanTab = page.locator('[data-tab-btn="clean"]');
    await expect(cleanTab).toHaveClass(/active/);
  });

  test('已有拆分结果时前往拆分按钮仍可跳转', async ({ page }) => {
    const splitSample = '[{"module":"登录","key_scenarios":[],"test_points":[],"coupled_modules":[]}]';
    await page.evaluate((text) => {
      var el = document.getElementById('splitResult');
      if (!el) return;
      el.removeAttribute('readonly');
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, splitSample);
    await page.click('[data-tab-btn="casesgen"]');
    const jumpBtn = page.locator('#toSplitFromCaseGen');
    await expect(jumpBtn).toBeVisible();
    await jumpBtn.click();
    await page.waitForFunction(() => {
      var sec = document.querySelector('[data-section-id="split"]');
      return sec && sec.getBoundingClientRect().top < 260;
    });
    const cleanTab = page.locator('[data-tab-btn="clean"]');
    await expect(cleanTab).toHaveClass(/active/);
  });
});
