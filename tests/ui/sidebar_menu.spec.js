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

  test('一级分类不展示且菜单入口常驻', async ({ page }) => {
    const groupBtn = page.locator('.tab-group-btn', { hasText: 'AI 功能' });
    const submenu = page.locator('[data-group-menu="ai"]');
    await expect(groupBtn).toHaveAttribute('role', 'heading');
    await expect(groupBtn).toHaveAttribute('aria-level', '2');
    await expect(groupBtn).toHaveAttribute('tabindex', '-1');
    await expect(groupBtn).toHaveCSS('opacity', '0');
    await groupBtn.click();
    await expect(submenu).toBeVisible();
    await expect(submenu.locator('[data-tab-btn="auto"]')).toHaveCount(0);
    await expect(submenu.locator('[data-tab-btn="clean"]')).toHaveCount(0);

    await submenu.locator('[data-tab-btn="casesgen"]').click();
    await expect(page.locator('[data-tab-section="casesgen"]').first()).toBeVisible();
    await expect(submenu.locator('[data-tab-btn="casesgen"]')).toHaveClass(/active/);
    const categoryState = await page.evaluate(() => {
      return Array.prototype.map.call(document.querySelectorAll('.tab-group-btn'), function(button) {
        return {
          active: button.classList.contains('active'),
          hovering: button.classList.contains('hovering'),
        };
      });
    });
    expect(categoryState.every((state) => !state.active && !state.hovering)).toBeTruthy();

    await page.locator('main').click();
    await expect(submenu).toBeVisible();
  });

  test('抽屉打开时侧边导航不可点击', async ({ page }) => {
    await page.click('[data-tab-btn="casesgen"]');
    await page.waitForSelector('#xmindCaseGenOpenBtn');
    await page.click('#xmindCaseGenOpenBtn');
    const drawer = page.locator('#xmindCaseGenDrawer');
    await expect(drawer).toHaveClass(/open/);

    const beforeState = await page.evaluate(() => ({
      active: window.app && window.app.state ? window.app.state.activeTab : '',
      lastTabClick: window.app ? window.app.lastTabClick : '',
    }));

    const afterProgrammatic = await page.evaluate(() => {
      var target = document.querySelector('[data-tab-btn="tempexec"]');
      if (target && typeof target.click === 'function') target.click();
      return {
        active: window.app && window.app.state ? window.app.state.activeTab : '',
      lastTabClick: window.app ? window.app.lastTabClick : '',
      drawerOpen: document.body && document.body.classList.contains('drawer-open'),
      sidebarEvents: getComputedStyle(document.querySelector('aside.sidebar')).pointerEvents,
    };
  });
  expect(afterProgrammatic.active).toBe(beforeState.active);
  expect(afterProgrammatic.lastTabClick).toBe(beforeState.lastTabClick);
  expect(afterProgrammatic.drawerOpen).toBeTruthy();
  expect(afterProgrammatic.sidebarEvents).toBe('none');

  await expect(page.locator('.tab-group-btn', { hasText: '用例相关' })).toHaveAttribute('role', 'heading');
  });

  test('无可见二级入口时隐藏对应一级菜单', async ({ page }) => {
    await page.unroute('**/api/users/me');
    await page.route('**/api/users/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ username: 'normal_user', role: 'user' }),
      });
    });
    await page.reload();
    await page.waitForFunction(() => window.app && window.app._inited === true, { timeout: 20000 });

    const manageBtn = page.locator('.tab-group-btn[data-group="manage"]');
    await expect(manageBtn).toBeHidden();
    const activeTab = await page.evaluate(() => window.app && window.app.state ? window.app.state.activeTab : '');
    expect(activeTab).not.toBe('project-admin');
    expect(activeTab).not.toBe('user-admin');
    expect(activeTab).not.toBe('ops-log');
  });
});
