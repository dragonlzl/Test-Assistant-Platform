const { test, expect } = require('@playwright/test');

async function setup(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-e2e-skip-auth', '1'); } catch (_) {}
  });
  await page.route('**/api/**', async (route) => {
    const method = route.request().method();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(method === 'GET' ? [] : {}),
    });
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true && window.app.uiReady === true);
}

test.describe('Shared DrawerShell lifecycle', () => {
  test('tracks nested scroll locks and Escape exits fullscreen before closing', async ({ page }) => {
    await setup(page);

    await page.evaluate(() => {
      function appendDrawer(id) {
        const drawer = document.createElement('div');
        drawer.id = id;
        drawer.className = 'drawer';
        drawer.innerHTML = [
          '<div class="drawer-mask"></div>',
          '<div class="drawer-panel drawer-panel-wide">',
          '<div class="drawer-header"><h3>' + id + '</h3><button data-drawer-close="' + id + '">关闭</button></div>',
          '<div class="drawer-body"><div style="height:80px">content</div></div>',
          '</div>',
        ].join('');
        document.body.appendChild(drawer);
        return window.app.drawer.createDrawer({ drawerId: id });
      }
      window.__drawerShellFirst = appendDrawer('drawerShellFirst');
      window.__drawerShellSecond = appendDrawer('drawerShellSecond');
      window.__drawerShellResizeCount = 0;
      document.addEventListener('tap:layout-resize', function() {
        window.__drawerShellResizeCount += 1;
      });
      window.__drawerShellFirst.open();
      window.__drawerShellSecond.open();
    });

    await expect(page.locator('body')).toHaveClass(/drawer-open/);
    await expect.poll(async () => page.evaluate(() => window.app.ui.DrawerShell.scrollLock.count())).toBe(2);

    await page.evaluate(() => {
      window.app.ui.DrawerShell.fullscreen.set(document.getElementById('drawerShellSecond'), true);
    });
    await expect(page.locator('#drawerShellSecond')).toHaveClass(/tap-drawer-fullscreen/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#drawerShellSecond')).not.toHaveClass(/tap-drawer-fullscreen/);
    await expect(page.locator('#drawerShellSecond')).toHaveClass(/open/);
    await expect.poll(async () => page.evaluate(() => window.__drawerShellResizeCount)).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('#drawerShellSecond')).not.toHaveClass(/open/);
    await expect(page.locator('body')).toHaveClass(/drawer-open/);
    await expect.poll(async () => page.evaluate(() => window.app.ui.DrawerShell.scrollLock.count())).toBe(1);

    await page.evaluate(() => window.__drawerShellFirst.close());
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
    await expect.poll(async () => page.evaluate(() => window.app.ui.DrawerShell.scrollLock.count())).toBe(0);
  });

  test('init remains idempotent and destroy releases listeners and locks', async ({ page }) => {
    await setup(page);
    const state = await page.evaluate(() => {
      const first = window.app.ui.drawers;
      const second = window.app.ui.DrawerShell.init();
      window.app.ui.DrawerShell.scrollLock.acquire('drawer-shell-test');
      const beforeDestroy = window.app.ui.DrawerShell.scrollLock.count();
      first.destroy();
      return {
        sameController: first === second,
        beforeDestroy,
        afterDestroy: window.app.ui.DrawerShell.scrollLock.count(),
        bodyLocked: document.body.classList.contains('drawer-open'),
      };
    });
    expect(state).toEqual({
      sameController: true,
      beforeDestroy: 1,
      afterDestroy: 0,
      bodyLocked: false,
    });
  });

  test('ignores non-drawer class mutations and destroy clears fullscreen compatibility classes', async ({ page }) => {
    await setup(page);

    await page.evaluate(() => {
      const marker = document.createElement('div');
      marker.id = 'drawerShellMutationMarker';
      document.body.appendChild(marker);
      marker.classList.add('open');

      const drawer = document.createElement('div');
      drawer.id = 'drawerShellCanvas';
      drawer.className = 'drawer';
      drawer.innerHTML = [
        '<div class="drawer-mask"></div>',
        '<div class="drawer-panel drawer-panel-xmind">',
        '<div class="drawer-header"><button data-drawer-close>关闭</button></div>',
        '</div>',
      ].join('');
      document.body.appendChild(drawer);
    });

    await expect.poll(async () => page.evaluate(() => (
      document.getElementById('drawerShellCanvas').getAttribute('data-drawer-shell')
    ))).toBe('1');
    await expect.poll(async () => page.evaluate(() => window.app.ui.DrawerShell.scrollLock.count())).toBe(0);

    const state = await page.evaluate(() => {
      const drawer = document.getElementById('drawerShellCanvas');
      window.app.ui.DrawerShell.fullscreen.set(drawer, true);
      const beforeDestroy = {
        shared: drawer.classList.contains('tap-drawer-fullscreen'),
        legacy: drawer.classList.contains('xmind-drawer-fullscreen'),
      };
      window.app.ui.DrawerShell.destroy();
      return {
        beforeDestroy,
        sharedAfterDestroy: drawer.classList.contains('tap-drawer-fullscreen'),
        legacyAfterDestroy: drawer.classList.contains('xmind-drawer-fullscreen'),
        decoratedAfterDestroy: drawer.hasAttribute('data-drawer-shell'),
      };
    });

    expect(state).toEqual({
      beforeDestroy: { shared: true, legacy: true },
      sharedAfterDestroy: false,
      legacyAfterDestroy: false,
      decoratedAfterDestroy: false,
    });
  });

  test('optionally resolves confirmation after the previous drawer is fully resumed', async ({ page }) => {
    await setup(page);

    await page.evaluate(() => {
      const drawer = document.createElement('div');
      drawer.id = 'drawerShellConfirmPrevious';
      drawer.className = 'drawer';
      drawer.innerHTML = [
        '<div class="drawer-mask"></div>',
        '<div class="drawer-panel">',
        '<div class="drawer-header"><button data-drawer-close>关闭</button></div>',
        '</div>',
      ].join('');
      document.body.appendChild(drawer);
      window.__drawerShellConfirmPrevious = window.app.drawer.createDrawer({ drawerId: drawer.id });
      window.__drawerShellConfirmPrevious.open();
      window.__drawerShellConfirmState = 'pending';
      window.__drawerShellConfirmResult = null;
      window.app.confirmDrawer.open({
        title: '生命周期确认',
        message: '确认后等待抽屉完全关闭',
        previousDrawer: window.__drawerShellConfirmPrevious,
        resolveAfterClose: true,
      }).then(function(result) {
        window.__drawerShellConfirmState = 'resolved';
        window.__drawerShellConfirmResult = result;
      });
    });

    await expect(page.locator('#drawerShellConfirmPrevious')).toHaveClass(/drawer-suspended/);
    await page.click('#appConfirmDrawerConfirmBtn');
    const immediate = await page.evaluate(() => ({
      state: window.__drawerShellConfirmState,
      confirmClass: document.getElementById('appConfirmDrawer').className,
      previousClass: document.getElementById('drawerShellConfirmPrevious').className,
    }));
    expect(immediate.state).toBe('pending');
    expect(immediate.confirmClass).toContain('closing');
    expect(immediate.previousClass).toContain('drawer-suspended');

    await expect.poll(() => page.evaluate(() => window.__drawerShellConfirmState)).toBe('resolved');
    await expect(page.locator('#appConfirmDrawer')).not.toHaveClass(/\b(?:open|closing)\b/);
    await expect(page.locator('#drawerShellConfirmPrevious')).not.toHaveClass(/drawer-suspended/);
    expect(await page.evaluate(() => window.__drawerShellConfirmResult)).toEqual({ ok: true });
  });
});
