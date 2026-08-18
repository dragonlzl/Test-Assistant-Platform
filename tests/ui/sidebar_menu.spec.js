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
    await expect(submenu.locator('[data-tab-btn="auto"]')).toHaveCount(0);
    await expect(submenu.locator('[data-tab-btn="clean"]')).toHaveCount(0);

    await submenu.locator('[data-tab-btn="casesgen"]').click();
    await expect(page.locator('[data-tab-section="casesgen"]').first()).toBeVisible();
    const activeGroup = await page.evaluate(() => {
      var activeBtn = document.querySelector('.tab-group-btn.active');
      return activeBtn && activeBtn.dataset ? activeBtn.dataset.group : '';
    });
    expect(activeGroup).toBe('ai');

    await page.hover('.tab-group-btn[data-group="cases"]');
    const hoverState = await page.evaluate(() => {
      var activeBtn = document.querySelector('.tab-group-btn.active');
      var hoveringBtn = document.querySelector('.tab-group-btn.hovering');
      return {
        activeGroup: activeBtn && activeBtn.dataset ? activeBtn.dataset.group : '',
        hoveringGroup: hoveringBtn && hoveringBtn.dataset ? hoveringBtn.dataset.group : '',
      };
    });
    expect(hoverState.activeGroup).toBe('ai');
    expect(hoverState.hoveringGroup).toBe('cases');

    await page.hover('main');
    const hoverCleared = await page.evaluate(() => {
      var activeBtn = document.querySelector('.tab-group-btn.active');
      var hoveringBtn = document.querySelector('.tab-group-btn.hovering');
      return {
        activeGroup: activeBtn && activeBtn.dataset ? activeBtn.dataset.group : '',
        hoveringGroup: hoveringBtn && hoveringBtn.dataset ? hoveringBtn.dataset.group : '',
      };
    });
    expect(hoverCleared.activeGroup).toBe('ai');
    expect(hoverCleared.hoveringGroup).toBe('');

    await page.locator('main').click();
    await expect(submenu).toBeHidden();
  });

  test('抽屉打开时侧边导航不可点击', async ({ page }) => {
    await page.click('.tab-group-btn[data-group="ai"]');
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

  const groupBtn = page.locator('.tab-group-btn', { hasText: '用例相关' });
  await groupBtn.click({ force: true });
  const afterForcedClick = await page.evaluate(() => window.app && window.app.state ? window.app.state.activeTab : '');
  expect(afterForcedClick).toBe(beforeState.active);
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
