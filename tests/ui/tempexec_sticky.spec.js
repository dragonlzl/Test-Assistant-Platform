const { test, expect } = require('@playwright/test');

test.describe('执行视图页面内导航布局', () => {
  test.beforeEach(async ({ page }) => {
    page.__promptAnswers = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (pathName === '/api/users/me' && method === 'GET') {
        // e2e: user.id = 0 不走 DB 入库，避免静态模式误触发 API。
        return respond(200, { id: 0, username: 'ui_admin', role: 'admin', level: 'leader' });
      }
      if (method === 'GET') return respond(200, []);
      return respond(200, {});
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

  test('页面内导航与操作工具条保持粘顶', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');
    await page.waitForFunction(() => window.app && window.app.state);
    await page.evaluate(() => {
      window.app.state.requirementLabel = '粘顶导航需求';
      window.app.state.requirementLabelSource = 'ui-test';
    });
    await page.click('#openTempExecImportDrawerBtn');
    await page.setInputFiles('#tempExecInput', {
      name: 'sticky.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(Array.from({ length: 40 }, (_, index) => ({
        module: index % 2 === 0 ? '模块A' : '模块B',
        title: '粘顶验证用例' + (index + 1),
        steps: '步骤' + (index + 1),
        expected: '成功',
      })), null, 2)),
    });
    await expect(page.locator('#tempExecStatus')).toContainText('已导入', { timeout: 5000 });
    await page.click('#closeTempExecImportDrawerBtn');
    await expect(page.locator('#tempExecToolbarCard')).toBeVisible({ timeout: 15000 });

    const reminderToggle = page.getByLabel('显示易漏用例参考');
    await expect(reminderToggle).not.toBeChecked();
    await expect(page.locator('#tempExecToolbar .toolbar-primary-row > .toolbar-reuse-toggle')).toHaveCount(0);
    await expect(page.locator('#tempExecToolbar .toolbar-primary-row > .toolbar-missing-toggle')).toHaveCount(0);
    const toolbarLayout = await page.evaluate(() => {
      function rect(selector) {
        var element = document.querySelector(selector);
        if (!element) return null;
        var box = element.getBoundingClientRect();
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          centerY: box.top + box.height / 2,
          borderRadius: getComputedStyle(element).borderRadius,
          tagName: element.tagName,
        };
      }
      return {
        header: rect('.case-exec-content-header'),
        actions: rect('#tempExecToolbar .toolbar-current-actions'),
        search: rect('#tempExecToolbar .toolbar-search'),
        change: rect('#tempExecCaseLibraryChangesBtn'),
        nav: rect('#tempExecToolbar .toolbar-nav'),
        more: rect('#tempExecToolbar .toolbar-more'),
        status: rect('#tempExecToolbar .summary-pill'),
      };
    });
    expect(toolbarLayout.actions.top).toBeGreaterThanOrEqual(toolbarLayout.header.top);
    expect(toolbarLayout.actions.bottom).toBeLessThanOrEqual(toolbarLayout.header.bottom + 1);
    expect(Math.abs(toolbarLayout.actions.right - toolbarLayout.header.right)).toBeLessThanOrEqual(20);
    expect(toolbarLayout.search.top).toBeGreaterThanOrEqual(toolbarLayout.header.bottom - 1);
    expect(toolbarLayout.change.right).toBeLessThanOrEqual(toolbarLayout.nav.left + 1);
    expect(toolbarLayout.more.left).toBeGreaterThan(toolbarLayout.nav.left);
    expect(toolbarLayout.status.tagName).toBe('BUTTON');
    expect(parseFloat(toolbarLayout.status.borderRadius)).toBeLessThanOrEqual(6);

    const moreToggle = page.getByRole('button', { name: '更多操作' });
    await expect(page.locator('#tempExecMoreMenu')).toBeHidden();
    await moreToggle.click();
    await expect(moreToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#tempExecMoreMenu')).toBeVisible();
    await expect(page.locator('#tempExecMoreMenu button')).toHaveCount(4);
    await expect(page.locator('#tempExecMoreMenu [data-temp-reuse-toggle]')).toHaveCount(1);
    await expect(page.locator('#tempExecMoreMenu [data-temp-missing-reminder-toggle]')).toHaveCount(1);
    const menuItemStyles = await page.locator('#tempExecMoreMenu').evaluate((menu) => {
      const items = Array.from(menu.querySelectorAll('.toolbar-more-check, button'));
      const menuBackground = getComputedStyle(menu).backgroundColor;
      return {
        menuBackground,
        items: items.map((item) => {
          const style = getComputedStyle(item);
          return {
            height: Math.round(item.getBoundingClientRect().height),
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            backgroundColor: style.backgroundColor,
            boxShadow: style.boxShadow,
          };
        }),
      };
    });
    expect(new Set(menuItemStyles.items.map((item) => item.height))).toEqual(new Set([30]));
    expect(new Set(menuItemStyles.items.map((item) => item.fontFamily)).size).toBe(1);
    expect(new Set(menuItemStyles.items.map((item) => item.fontSize))).toEqual(new Set(['12px']));
    expect(new Set(menuItemStyles.items.map((item) => item.fontWeight))).toEqual(new Set(['400']));
    expect(new Set(menuItemStyles.items.map((item) => item.color)).size).toBe(1);
    expect(new Set(menuItemStyles.items.map((item) => item.backgroundColor))).toEqual(new Set([menuItemStyles.menuBackground]));
    expect(new Set(menuItemStyles.items.map((item) => item.boxShadow))).toEqual(new Set(['none']));
    const enabledMenuButtons = page.locator('#tempExecMoreMenu button:not(:disabled)');
    const selectedStyles = [];
    for (let index = 0; index < await enabledMenuButtons.count(); index += 1) {
      const button = enabledMenuButtons.nth(index);
      await button.hover();
      await page.waitForTimeout(180);
      selectedStyles.push(await button.evaluate((item) => {
        const style = getComputedStyle(item);
        return {
          borderColor: style.borderColor,
          color: style.color,
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      }));
    }
    expect(selectedStyles.length).toBeGreaterThan(1);
    expect(new Set(selectedStyles.map((item) => item.borderColor)).size).toBe(1);
    expect(new Set(selectedStyles.map((item) => item.color)).size).toBe(1);
    expect(new Set(selectedStyles.map((item) => item.backgroundColor)).size).toBe(1);
    expect(new Set(selectedStyles.map((item) => item.boxShadow))).toEqual(new Set(['none']));
    expect(selectedStyles[0].backgroundColor).not.toBe(menuItemStyles.menuBackground);
    await page.keyboard.press('Escape');
    await expect(page.locator('#tempExecMoreMenu')).toBeHidden();
    await expect(moreToggle).toBeFocused();

    const density = await page.evaluate(() => {
      const toolbar = document.getElementById('tempExecToolbarCard');
      const focus = document.getElementById('tempExecViewFocusBlock');
      const section = document.querySelector('[data-section-id="tempexec-view"]');
      const heading = section ? section.querySelector(':scope > h2') : null;
      const toolbarRect = toolbar.getBoundingClientRect();
      const focusRect = focus.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      return {
        gap: sectionRect.top - toolbarRect.bottom,
        headingDisplay: heading ? getComputedStyle(heading).display : '',
        sectionBorder: getComputedStyle(section).borderTopWidth,
        focusParentId: focus && focus.parentElement ? focus.parentElement.id : '',
        focusInsideToolbar: toolbar.contains(focus),
        focusBorder: getComputedStyle(focus).borderTopWidth,
        focusWidth: focusRect.width,
      };
    });
    expect(Math.abs(density.gap)).toBeLessThanOrEqual(2);
    expect(density.headingDisplay).toBe('none');
    expect(density.sectionBorder).toBe('0px');
    expect(density.focusParentId).toBe('tempexecFlowNav');
    expect(density.focusInsideToolbar).toBeFalsy();
    expect(density.focusBorder).toBe('0px');
    expect(density.focusWidth).toBeGreaterThan(100);

    const navTopBefore = await page.$eval('#tempexecSectionNav', (el) => el.getBoundingClientRect().top);
    const stickyTopBefore = await page.$eval('#tempExecStickyHeader', (el) => el.getBoundingClientRect().top);

    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(200);

    const navTopAfter = await page.$eval('#tempexecSectionNav', (el) => el.getBoundingClientRect().top);
    const stickyTopAfter = await page.$eval('#tempExecStickyHeader', (el) => el.getBoundingClientRect().top);
    const navStyle = await page.$eval('#tempexecSectionNav', (el) => getComputedStyle(el).position);
    const stickyStyle = await page.$eval('#tempExecStickyHeader', (el) => getComputedStyle(el).position);
    const navOverflow = await page.$eval('#tempexecSectionNav', (el) => {
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
    const stickyOverflow = await page.$eval('#tempExecStickyHeader', (el) => {
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
    console.log('tempexec sticky header style', stickyStyle, 'top before/after', stickyTopBefore, stickyTopAfter, 'overflow ancestor', stickyOverflow, 'scroll', scrollState);
    await expect(navStyle).toBe('sticky');
    await expect(stickyStyle).toBe('sticky');
    expect(scrollState.page).toBeGreaterThan(100);
    await expect(navTopAfter).toBeGreaterThanOrEqual(0);
    await expect(stickyTopAfter).toBeGreaterThanOrEqual(0);
    await expect(Math.abs(navTopAfter - navTopBefore)).toBeLessThan(60);
    await expect(Math.abs(stickyTopAfter - stickyTopBefore)).toBeLessThan(2);
    await expect(navTopAfter).toBeLessThan(260);
    await expect(stickyTopAfter).toBeLessThan(2);
  });
});
