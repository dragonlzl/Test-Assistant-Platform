const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 7, username: 'nav_user', role: 'admin', level: 'leader' };

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
    timeout: 30000,
  });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
}

async function setupRoutes(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tap-auth-token', 'nav-style-token');
    } catch (err) {}
  });

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/users/me' && method === 'GET') return respond(200, user);
    if (path === '/api/settings' && method === 'GET') return respond(200, []);
    if (path === '/api/settings' && method === 'PUT') return respond(200, []);
    if (path === '/api/projects' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') return respond(200, []);
    if (path === '/api/features' && method === 'GET') return respond(200, []);
    if (path === '/api/ops' && method === 'GET') return respond(200, []);
    return respond(200, method === 'GET' ? [] : {});
  });
}

test.describe('侧边栏一级菜单样式', () => {
  test('个人按钮文案、主导航代理与滚动按钮样式（白色/黑色主题）', async ({ page }) => {
    await setupRoutes(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await expect(page.locator('#userMenuToggle')).toHaveText('个人');

    const styleSnapshot = await page.evaluate(() => {
      var stableStyle = document.createElement('style');
      stableStyle.textContent = '* { transition: none !important; }';
      document.head.appendChild(stableStyle);

      function resolveColor(value) {
        var temp = document.createElement('span');
        temp.style.color = value;
        document.body.appendChild(temp);
        var color = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        return color;
      }

      function readStyles(theme) {
        if (theme) {
          document.documentElement.setAttribute('data-theme', theme);
        }
        var btn = document.querySelector('.tap-nav-rail-item[data-nav-group="ai"]') ||
          document.querySelector('.tap-nav-rail-item');
        var label = btn ? btn.querySelector('.tap-nav-rail-label') : null;
        var rootStyle = getComputedStyle(document.documentElement);
        var navColor = rootStyle.getPropertyValue('--tap-accent-strong').trim();
        var navBackground = rootStyle.getPropertyValue('--tap-accent-soft').trim();
        var baseBorder = rootStyle.getPropertyValue('--border').trim();
        var scrollButtons = Array.prototype.slice.call(document.querySelectorAll('.scroll-top-btn'));
        var scrollColors = scrollButtons.map(function(item) {
          return getComputedStyle(item).borderTopColor;
        });
        return {
          theme: theme || 'light',
          fontFamily: getComputedStyle(label || btn).fontFamily,
          expectedFontFamily: getComputedStyle(document.body).fontFamily,
          fontSize: getComputedStyle(label || btn).fontSize,
          color: getComputedStyle(btn).color,
          active: btn.classList.contains('active'),
          borderWidth: getComputedStyle(btn).borderTopWidth,
          borderRadius: getComputedStyle(btn).borderRadius,
          backgroundColor: getComputedStyle(btn).backgroundColor,
          width: Math.round(btn.getBoundingClientRect().width),
          height: Math.round(btn.getBoundingClientRect().height),
          expectedColor: resolveColor(navColor),
          expectedBackground: resolveColor(navBackground),
          expectedBaseBorder: resolveColor(baseBorder),
          scrollBorderColors: scrollColors,
        };
      }

      var snapshot = {
        light: readStyles('light'),
        dark: readStyles('dark'),
      };
      stableStyle.remove();
      return snapshot;
    });

    expect(styleSnapshot.light.fontFamily).toBe(styleSnapshot.light.expectedFontFamily);
    expect(styleSnapshot.light.fontSize).toBe('10px');
    expect(styleSnapshot.light.active).toBe(true);
    expect(styleSnapshot.light.color).toBe(styleSnapshot.light.expectedColor);
    expect(styleSnapshot.light.borderWidth).toBe('0px');
    expect(styleSnapshot.light.borderRadius).toBe('6px');
    expect(styleSnapshot.light.backgroundColor).toBe(styleSnapshot.light.expectedBackground);
    expect(styleSnapshot.light.width).toBe(56);
    expect(styleSnapshot.light.height).toBe(48);
    expect(styleSnapshot.light.scrollBorderColors.length).toBeGreaterThan(0);
    styleSnapshot.light.scrollBorderColors.forEach((color) => {
      expect(color).toBe(styleSnapshot.light.expectedBaseBorder);
    });

    expect(styleSnapshot.dark.fontFamily).toBe(styleSnapshot.dark.expectedFontFamily);
    expect(styleSnapshot.dark.fontSize).toBe('10px');
    expect(styleSnapshot.dark.active).toBe(true);
    expect(styleSnapshot.dark.color).toBe(styleSnapshot.dark.expectedColor);
    expect(styleSnapshot.dark.borderWidth).toBe('0px');
    expect(styleSnapshot.dark.borderRadius).toBe('6px');
    expect(styleSnapshot.dark.backgroundColor).toBe(styleSnapshot.dark.expectedBackground);
    expect(styleSnapshot.dark.width).toBe(56);
    expect(styleSnapshot.dark.height).toBe(48);
    expect(styleSnapshot.dark.scrollBorderColors.length).toBeGreaterThan(0);
    styleSnapshot.dark.scrollBorderColors.forEach((color) => {
      expect(color).toBe(styleSnapshot.dark.expectedBaseBorder);
    });
  });
});
