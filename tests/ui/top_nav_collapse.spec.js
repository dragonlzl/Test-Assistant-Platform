const { test, expect } = require('@playwright/test');

async function setupPage(page) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-e2e-skip-auth', '1');
      localStorage.removeItem('tap-auth-token');
      const resetKey = 'tap-e2e-top-nav-reset';
      if (!localStorage.getItem(resetKey)) {
        localStorage.setItem(resetKey, '1');
        localStorage.removeItem('usecase-top-nav-collapse-v1');
        const raw = localStorage.getItem('usecase-settings-v1') || '{}';
        const settings = JSON.parse(raw);
        if (settings && typeof settings === 'object') {
          settings.smartTopNavCollapse = false;
          localStorage.setItem('usecase-settings-v1', JSON.stringify(settings));
        }
      }
    } catch (_) {}
  });
}

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
}

test.describe('顶部导航收起展开', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
  });

  test('收起状态按页面持久化', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/case-exec.html');
    await waitForAppReady(page);

    const tempexecNav = page.locator('#tempexecFlowNav');
    const tempexecToggle = page.locator('#tempexecFlowNav [data-flow-toggle]');
    await expect(tempexecNav).not.toHaveClass(/is-collapsed/);
    await expect(tempexecToggle).toHaveText('收起');

    await tempexecToggle.click();
    await expect(tempexecNav).toHaveClass(/is-collapsed/);
    await expect(tempexecToggle).toHaveText('展开');

    await page.reload();
    await waitForAppReady(page);
    await expect(tempexecNav).toHaveClass(/is-collapsed/);

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('exec-overview');
      }
    });
    const execOverviewNav = page.locator('#execOverviewFlowNav');
    const execOverviewToggle = page.locator('#execOverviewFlowNav [data-flow-toggle]');
    await execOverviewNav.waitFor({ state: 'visible', timeout: 10000 });
    await expect(execOverviewNav).not.toHaveClass(/is-collapsed/);
    await expect(execOverviewToggle).toHaveText('收起');
  });

  test('智能收起随滚动展开', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/settings.html');
    await waitForAppReady(page);
    const smartToggle = page.locator('#smartTopNavToggle');
    await smartToggle.scrollIntoViewIfNeeded();
    await smartToggle.check();
    await expect(smartToggle).toBeChecked();

    await page.goto(base + '/case-library.html');
    await waitForAppReady(page);
    const nav = page.locator('#caseLibraryFlowNav');
    await expect(nav).not.toHaveClass(/is-collapsed/);

    await page.mouse.wheel(0, 160);
    await expect(nav).toHaveClass(/is-collapsed/);

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      if (document.body) document.body.style.scrollBehavior = 'auto';
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -160 }));
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -160 }));
    });
    await expect(nav).not.toHaveClass(/is-collapsed/);

    await page.goto(base + '/case-exec.html');
    await waitForAppReady(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('exec-overview');
      }
    });
    const execOverviewNav = page.locator('#execOverviewFlowNav');
    await execOverviewNav.waitFor({ state: 'visible', timeout: 10000 });
    await expect(execOverviewNav).not.toHaveClass(/is-collapsed/);
    await page.mouse.wheel(0, 160);
    await expect(execOverviewNav).not.toHaveClass(/is-collapsed/);
  });

  test('智能收起不受侧边栏与提醒区滚动影响', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/settings.html');
    await waitForAppReady(page);
    const smartToggle = page.locator('#smartTopNavToggle');
    await smartToggle.scrollIntoViewIfNeeded();
    await smartToggle.check();
    await expect(smartToggle).toBeChecked();

    await page.goto(base + '/case-library.html');
    await waitForAppReady(page);
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('case-library');
      }
    });
    const nav = page.locator('#caseLibraryFlowNav');
    await nav.waitFor({ state: 'visible', timeout: 10000 });
    await expect(nav).not.toHaveClass(/is-collapsed/);

    await page.click('#sidebarTabCasegen');
    await expect(page.locator('[data-sidebar-panel="casegen"]')).toHaveClass(/is-active/);

    const scrollReady = await page.evaluate(() => {
      function fillCasegen() {
        var panelWrap = document.querySelector('[data-sidebar-panel="casegen"]');
        if (panelWrap) {
          panelWrap.classList.add('is-active');
          panelWrap.style.display = 'flex';
        }
        var panel = document.getElementById('caseGenProgressPanel');
        if (panel && panel.classList) panel.classList.remove('is-collapsed');
        var list = document.getElementById('caseGenProgressList');
        if (!list) return false;
        var items = '';
        for (var i = 0; i < 24; i += 1) {
          items += '<div class="casegen-progress-item"><span>模块' + (i + 1) + '</span></div>';
        }
        list.innerHTML = items;
        list.style.maxHeight = '120px';
        list.style.overflowY = 'auto';
        return list.scrollHeight > list.clientHeight;
      }

      function fillReminder() {
        var editCard = document.getElementById('caseLibraryEditCard');
        if (editCard && editCard.classList) editCard.classList.remove('hidden');
        var host = document.getElementById('caseLibraryMissingReminderTop') || document.getElementById('caseLibraryMissingReminderBottom');
        if (!host) return false;
        if (host.classList) host.classList.remove('hidden');
        var rows = '';
        for (var i = 0; i < 30; i += 1) {
          rows += '<tr><td>类型</td><td>模块</td><td>标题' + (i + 1) + '</td><td>P1</td><td>前提</td><td>步骤</td><td>预期</td></tr>';
        }
        host.innerHTML =
          '<div class="missing-reminder-card">' +
            '<div class="missing-reminder-scroll" style="max-height: 120px; overflow-y: auto;">' +
              '<div class="temp-case-view">' +
                '<table class="missing-reminder-table"><tbody>' + rows + '</tbody></table>' +
              '</div>' +
            '</div>' +
          '</div>';
        var scrollBox = host.querySelector('.missing-reminder-scroll');
        if (!scrollBox) return false;
        return scrollBox.scrollHeight > scrollBox.clientHeight;
      }

      return {
        casegen: fillCasegen(),
        reminder: fillReminder(),
      };
    });
    expect(scrollReady.casegen).toBe(true);
    expect(scrollReady.reminder).toBe(true);

    await page.evaluate(() => {
      var target = document.getElementById('caseGenProgressList');
      if (!target) return;
      target.dispatchEvent(new WheelEvent('wheel', { deltaY: 160, bubbles: true, cancelable: true }));
    });
    await expect(nav).not.toHaveClass(/is-collapsed/);

    await page.click('#sidebarTabMemo');
    await expect(page.locator('[data-sidebar-panel="memo"]')).toHaveClass(/is-active/);
    const memoReady = await page.evaluate(() => {
      var panelWrap = document.querySelector('[data-sidebar-panel="memo"]');
      if (panelWrap) {
        panelWrap.classList.add('is-active');
        panelWrap.style.display = 'flex';
      }
      var body = document.getElementById('memoPadBody');
      if (!body) return false;
      body.innerHTML = '<div class="memo-items"></div>';
      var itemsBox = body.querySelector('.memo-items');
      if (!itemsBox) return false;
      var html = '';
      for (var i = 0; i < 30; i += 1) {
        html += '<div class="memo-item"><span class="memo-item-index">' + (i + 1) + '</span><span>备忘' + (i + 1) + '</span></div>';
      }
      itemsBox.innerHTML = html;
      itemsBox.style.maxHeight = '120px';
      itemsBox.style.overflowY = 'auto';
      return itemsBox.scrollHeight > itemsBox.clientHeight;
    });
    expect(memoReady).toBe(true);
    await page.evaluate(() => {
      var target = document.querySelector('#memoPadBody .memo-items');
      if (!target) return;
      target.dispatchEvent(new WheelEvent('wheel', { deltaY: 160, bubbles: true, cancelable: true }));
    });
    await expect(nav).not.toHaveClass(/is-collapsed/);

    await page.evaluate(() => {
      var target = document.querySelector('#caseLibraryMissingReminderTop .missing-reminder-scroll');
      if (!target) return;
      target.dispatchEvent(new WheelEvent('wheel', { deltaY: 160, bubbles: true, cancelable: true }));
    });
    await expect(nav).not.toHaveClass(/is-collapsed/);
  });
});
