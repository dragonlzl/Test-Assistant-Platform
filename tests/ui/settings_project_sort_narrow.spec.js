const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
  while (Date.now() < deadline) {
    last = await page.evaluate(() => {
      let token = '';
      try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
      return {
        hasApp: Boolean(window.app),
        authReady: Boolean(window.app && window.app.authReady === true),
        hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
        tab: window.app && window.app.state ? window.app.state.activeTab : '',
        token: token,
      };
    });
    if (last && last.hasApp && last.authReady && last.hasSwitchTab) return;
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

test.describe('设置页项目排序窄屏适配', () => {
  test('项目排序卡片在窄屏下换行展示', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });

    const token = 'token-settings-project-sort';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const projects = [
      { id: 1, name: '项目A', description: '' },
      { id: 2, name: '项目B', description: '' },
      { id: 3, name: '项目C', description: '' },
      { id: 4, name: '项目D', description: '' },
    ];

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const tokenHeader = route.request().headers().authorization || '';
      const authed = tokenHeader === `Bearer ${token}`;
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, user);
      }
      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'settings');
    await expect(page.locator('#settingsOtherSection')).toBeVisible();

    await page.waitForFunction(() => {
      const grid = document.getElementById('projectSortGrid');
      if (!grid) return false;
      return grid.querySelectorAll('.project-sort-card').length >= 2;
    });

    const layout = await page.evaluate(() => {
      function rect(el) {
        if (!el) return null;
        var box = el.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y) };
      }
      var grid = document.getElementById('projectSortGrid');
      var cards = grid ? Array.from(grid.querySelectorAll('.project-sort-card')).slice(0, 3) : [];
      var card = cards.length ? cards[0] : null;
      var name = card ? card.querySelector('.name') : null;
      var meta = card ? card.querySelector('.meta') : null;
      return {
        name: rect(name),
        meta: rect(meta),
        cardRects: cards.map(rect),
      };
    });
    expect(layout.name).toBeTruthy();
    expect(layout.meta).toBeTruthy();
    expect(layout.name.y).toBeLessThan(layout.meta.y);
    expect(layout.cardRects.length).toBeGreaterThan(2);
    expect(Math.abs(layout.cardRects[0].y - layout.cardRects[1].y)).toBeLessThan(4);
    expect(layout.cardRects[2].y).toBeGreaterThan(layout.cardRects[0].y);
  });
});
