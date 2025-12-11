const { test, expect } = require('@playwright/test');

test.describe('侧边分级菜单', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    // 模拟已登录态，拦截鉴权接口
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'test-token');
      } catch (_) {}
      const originalReplace = window.location.replace.bind(window.location);
      window.location.replace = function(url) {
        if (url && url.indexOf('login.html') !== -1) {
          return;
        }
        return originalReplace(url);
      };
    });
    await page.route('**/api/users/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'test_admin', role: 'admin' }),
      });
    });
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });
  });

  test('点击一级菜单展开二级并可关闭', async ({ page }) => {
    const bound = await page.evaluate(() => window.app && window.app.tabGroupBound);
    console.log('tab group bound', bound);
    const groupBtn = page.locator('.tab-group-btn', { hasText: 'AI 功能' });
    await groupBtn.click();
    const submenu = page.locator('[data-group-menu="ai"]');
    const debugState = await page.evaluate(() => {
      var menu = document.querySelector('[data-group-menu="ai"]');
      var group = menu && menu.closest('.tab-group');
      return {
        openClass: group ? group.classList.contains('open') : false,
        hiddenClass: menu ? menu.classList.contains('hidden') : true,
        display: menu ? getComputedStyle(menu).display : '',
        lastGroup: window.app && window.app.lastTabGroup,
        groupBtnCount: document.querySelectorAll('.tab-group-btn').length,
        lastClick: window.app && window.app.lastTabClick,
        lastShowCall: window.app && window.app.lastShowCall,
        lastShowRan: window.app && window.app.lastShowRan,
      };
    });
    console.log('tab submenu state after click', debugState);
    await expect(submenu).toBeVisible();

    await submenu.locator('[data-tab-btn="casesgen"]').click();
    await expect(page.locator('[data-tab-section="casesgen"]').first()).toBeVisible();

    await page.locator('main').click();
    await expect(submenu).toBeHidden();
  });
});
