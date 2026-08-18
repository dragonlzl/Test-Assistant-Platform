const { test, expect } = require('@playwright/test');

test.describe('页面粘顶区域', () => {
  test.beforeEach(async ({ page }) => {
    page.__promptAnswers = [];
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.removeItem('tap-auth-token');
      } catch (e) {
        // ignore
      }
    });
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
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
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
    await expect(topAfter).toBeLessThan(260);
    await expect(Math.abs(topAfter - topBefore)).toBeLessThan(300);
  });
});
