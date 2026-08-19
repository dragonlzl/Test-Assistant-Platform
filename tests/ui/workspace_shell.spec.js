const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 518, username: 'shell_admin', role: 'admin', level: 'leader' };

async function setupRoutes(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-auth-token', 'workspace-shell-token'); } catch (err) {}
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (body) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (path === '/api/users/me' && method === 'GET') return respond(user);
    if (path === '/api/settings' && method === 'GET') return respond([]);
    if (path === '/api/settings' && method === 'PUT') return respond([]);
    return respond(method === 'GET' ? [] : {});
  });
}

async function waitForShell(page) {
  await page.waitForFunction(() => {
    return document.documentElement.classList.contains('workspace-shell-enabled')
      && window.app
      && window.app._inited === true;
  }, null, { timeout: 30000 });
}

test.describe('共享工作台壳层', () => {
  test.beforeEach(async ({ page }) => {
    await setupRoutes(page);
  });

  test('六个登录后页面隐藏分类标题并保留对应激活入口', async ({ page }) => {
    const pages = [
      ['ai-workflow.html?tab=casesgen', 'casesgen'],
      ['ai-tools.html?tab=assign', 'assign'],
      ['case-exec.html?tab=tempexec', 'tempexec'],
      ['case-library.html?tab=case-library', 'case-library'],
      ['admin.html?tab=project-admin', 'project-admin'],
      ['settings.html?tab=settings', 'settings'],
    ];

    for (const entry of pages) {
      await page.goto(base + '/' + entry[0]);
      await waitForShell(page);
      await expect(page.locator('.workspace-brand-title')).toHaveText('用例助手');
      await expect(page.locator('[data-tab-btn="' + entry[1] + '"]')).toHaveClass(/active/);
      const navState = await page.evaluate(() => {
        const groups = Array.from(document.querySelectorAll('.tab-group:not(.hidden)'));
        const visibleButtons = groups.map((group) => Array.from(group.querySelectorAll('.tab-submenu [data-tab-btn]'))
          .filter((button) => getComputedStyle(button).display !== 'none'));
        const groupGaps = visibleButtons.slice(1).map((buttons, index) => {
          const previousButtons = visibleButtons[index];
          return buttons[0].getBoundingClientRect().top
            - previousButtons[previousButtons.length - 1].getBoundingClientRect().bottom;
        });
        const itemGaps = [];
        visibleButtons.forEach((buttons) => {
          buttons.slice(1).forEach((button, index) => {
            itemGaps.push(button.getBoundingClientRect().top - buttons[index].getBoundingClientRect().bottom);
          });
        });
        return {
          groups: groups.length,
          groupGaps,
          itemGaps,
          submenusVisible: groups.every((group) => {
            const menu = group.querySelector('.tab-submenu');
            return menu && getComputedStyle(menu).display === 'flex';
          }),
          groupsBorderless: groups.every((group) => {
            const button = group.querySelector('.tab-group-btn');
            return button && getComputedStyle(button).borderTopWidth === '0px';
          }),
          categoriesStatic: groups.every((group) => {
            const button = group.querySelector('.tab-group-btn');
            return button
              && button.tabIndex === -1
              && button.getAttribute('role') === 'heading'
              && button.getAttribute('aria-level') === '2'
              && !button.classList.contains('active')
              && !button.classList.contains('hovering');
          }),
          categoriesVisuallyHidden: groups.every((group) => {
            const button = group.querySelector('.tab-group-btn');
            if (!button) return false;
            const rect = button.getBoundingClientRect();
            return getComputedStyle(button).opacity === '0' && rect.width <= 4 && rect.height <= 4;
          }),
          toolCategoryHidden: getComputedStyle(document.querySelector('.workspace-tools'), '::before').display === 'none',
          categoryNoticesHidden: Array.from(document.querySelectorAll('.tab-group-btn .tab-notice'))
            .every((notice) => getComputedStyle(notice).display === 'none'),
        };
      });
      expect(navState.groups).toBe(4);
      expect(navState.groupGaps.every((gap) => gap >= 11)).toBeTruthy();
      expect(navState.itemGaps.every((gap) => gap <= 4)).toBeTruthy();
      expect(navState.submenusVisible).toBeTruthy();
      expect(navState.groupsBorderless).toBeTruthy();
      expect(navState.categoriesStatic).toBeTruthy();
      expect(navState.categoriesVisuallyHidden).toBeTruthy();
      expect(navState.toolCategoryHidden).toBeTruthy();
      expect(navState.categoryNoticesHidden).toBeTruthy();
      expect(await page.locator('[data-tab-btn]:visible .workspace-nav-icon').count()).toBeGreaterThan(0);
      await expect(page.locator('[data-tab-btn="casesgen"] .workspace-nav-label')).toHaveText('用例生成');
    }

    const rail = await page.locator('aside.sidebar').boundingBox();
    const brand = await page.locator('.workspace-brand-mark').boundingBox();
    await expect(page.locator('.workspace-brand-letter')).toHaveText('T');
    expect(Math.abs((brand.x + brand.width / 2) - (rail.x + rail.width / 2))).toBeLessThan(2);
    const usecaseGenerator = await page.locator('[data-tab-btn="casesgen"]').evaluate((button) => {
      const icon = button.querySelector('.workspace-nav-icon');
      const label = button.querySelector('.workspace-nav-label');
      const iconRect = icon.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      return {
        direction: getComputedStyle(button).flexDirection,
        iconTop: iconRect.top,
        iconCenter: iconRect.left + iconRect.width / 2,
        labelTop: labelRect.top,
        labelCenter: labelRect.left + labelRect.width / 2,
      };
    });
    expect(rail.width).toBeGreaterThanOrEqual(67);
    expect(rail.width).toBeLessThanOrEqual(69);
    expect(usecaseGenerator.direction).toBe('column');
    expect(usecaseGenerator.iconTop).toBeLessThan(usecaseGenerator.labelTop);
    expect(Math.abs(usecaseGenerator.iconCenter - usecaseGenerator.labelCenter)).toBeLessThan(2);
    await expect(page.locator('#sidebarTabCasegen')).toHaveCount(0);
    await expect(page.locator('#sidebarTabMemo .workspace-tool-label')).toHaveText('个人备忘');
  });

  test('个人工具抽屉覆盖导航栏并支持遮罩和 Escape 关闭', async ({ page }) => {
    await page.goto(base + '/ai-workflow.html?tab=casesgen');
    await waitForShell(page);
    const overlay = page.locator('#workspaceToolOverlay');
    const memoTrigger = page.locator('#sidebarTabMemo');
    const triggerBox = await memoTrigger.boundingBox();
    expect(triggerBox).not.toBeNull();

    await expect(overlay).not.toHaveClass(/is-open/);
    await memoTrigger.click();
    await expect(overlay).toHaveClass(/is-open/);
    await expect(page.locator('#workspaceToolDrawerTitle')).toHaveText('个人备忘');
    await expect(memoTrigger).toHaveClass(/is-drawer-open/);

    const viewport = page.viewportSize();
    const overlayBox = await overlay.boundingBox();
    const drawerBox = await page.locator('#workspaceToolDrawer').boundingBox();
    expect(overlayBox).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    expect(drawerBox.width).toBe(640);

    const triggerCenter = {
      x: triggerBox.x + triggerBox.width / 2,
      y: triggerBox.y + triggerBox.height / 2,
    };
    const navHitIsMask = await page.evaluate(({ x, y }) => {
      var hit = document.elementFromPoint(x, y);
      return Boolean(hit && hit.classList.contains('workspace-tool-mask'));
    }, triggerCenter);
    expect(navHitIsMask).toBeTruthy();

    await page.mouse.click(triggerCenter.x, triggerCenter.y);
    await expect(overlay).not.toHaveClass(/is-open/);
    await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id))
      .toBe('sidebarTabMemo');

    await page.click('#sidebarTabMemo');
    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/is-open/);
    await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id))
      .toBe('sidebarTabMemo');

    await page.click('#sidebarTabMemo');
    await page.click('.workspace-tool-mask', { position: { x: 20, y: 20 } });
    await expect(overlay).not.toHaveClass(/is-open/);
  });

  test('用户头像支持悬浮、点击、外部点击、Escape 和设置入口', async ({ page }) => {
    await page.goto(base + '/ai-workflow.html?tab=casesgen');
    await waitForShell(page);
    const menu = page.locator('#userMenu');
    const toggle = page.locator('#userMenuToggle');

    await expect(toggle).toHaveText('s');
    await expect(page.locator('.workspace-user-summary')).toContainText('shell_admin');
    await toggle.hover();
    await expect(menu).toHaveClass(/menu-open/);
    await expect(menu).toContainText('管理员');
    await expect(page.locator('#logoutBtn')).toBeVisible();

    await page.locator('main').hover();
    await expect(menu).not.toHaveClass(/menu-open/);
    await toggle.click();
    await expect(menu).toHaveClass(/menu-open/);
    await page.locator('main').click({ position: { x: 10, y: 10 } });
    await expect(menu).not.toHaveClass(/menu-open/);

    await toggle.focus();
    await expect(menu).toHaveClass(/menu-open/);
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveClass(/menu-open/);
    await expect(toggle).toBeFocused();

    await toggle.click();
    await Promise.all([
      page.waitForURL(/settings\.html\?tab=settings/, { timeout: 20000 }),
      page.click('#workspaceUserSettingsBtn'),
    ]);
  });

  test('共享页面统一命令按钮、表单字段和结构边框形态', async ({ page }) => {
    await page.goto(base + '/ai-tools.html?tab=assign');
    await waitForShell(page);
    await page.evaluate(() => {
      var fixture = document.createElement('section');
      fixture.id = 'workspaceGeometryFixture';
      fixture.className = 'card';
      fixture.innerHTML = [
        '<button id="workspaceGeometryButton" type="button">操作按钮</button>',
        '<input id="workspaceGeometryInput" type="text" value="输入框">',
        '<select id="workspaceGeometrySelect"><option>下拉框</option></select>',
        '<textarea id="workspaceGeometryTextarea">文本域</textarea>',
      ].join('');
      document.querySelector('main').appendChild(fixture);
    });

    const geometry = await page.evaluate(() => {
      function radius(selector) {
        return getComputedStyle(document.querySelector(selector)).borderTopLeftRadius;
      }
      return {
        button: radius('#workspaceGeometryButton'),
        select: radius('#workspaceGeometrySelect'),
        input: radius('#workspaceGeometryInput'),
        textarea: radius('#workspaceGeometryTextarea'),
        card: radius('#workspaceGeometryFixture'),
        avatar: radius('#userMenuToggle'),
      };
    });
    expect(geometry.button).toBe('4px');
    expect(geometry.select).toBe('4px');
    expect(geometry.input).toBe('0px');
    expect(geometry.textarea).toBe('0px');
    expect(geometry.card).toBe('0px');
    expect(geometry.avatar).toBe('50%');
  });

  test('六个登录后页面的可见命令控件遵循统一圆角规范', async ({ page }) => {
    const pages = [
      'ai-workflow.html?tab=casesgen',
      'ai-tools.html?tab=assign',
      'case-exec.html?tab=tempexec',
      'case-library.html?tab=case-library',
      'admin.html?tab=project-admin',
      'settings.html?tab=settings',
    ];

    for (const target of pages) {
      await page.goto(base + '/' + target);
      await waitForShell(page);
      await page.waitForTimeout(250);
      const geometry = await page.evaluate(() => {
        function isVisible(element) {
          var rect = element.getBoundingClientRect();
          var style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }
        function radii(selector, exclude) {
          return Array.from(document.querySelectorAll(selector))
            .filter(function(element) { return isVisible(element) && (!exclude || !element.matches(exclude)); })
            .map(function(element) { return getComputedStyle(element).borderTopLeftRadius; });
        }
        return {
          buttons: radii('button', '#userMenuToggle'),
          selects: radii('select'),
          fields: radii('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), textarea'),
          frames: radii('.card, .drawer-panel, .workspace-tool-drawer, .workspace-list-view, .admin-table-wrapper'),
          avatar: getComputedStyle(document.getElementById('userMenuToggle')).borderTopLeftRadius,
        };
      });
      expect(geometry.buttons.length).toBeGreaterThan(0);
      expect(new Set(geometry.buttons)).toEqual(new Set(['4px']));
      if (geometry.selects.length) expect(new Set(geometry.selects)).toEqual(new Set(['4px']));
      if (geometry.fields.length) expect(new Set(geometry.fields)).toEqual(new Set(['0px']));
      if (geometry.frames.length) expect(new Set(geometry.frames)).toEqual(new Set(['0px']));
      expect(geometry.avatar).toBe('50%');
    }
  });
});
