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
  test('个人按钮文案、一级菜单描边与滚动按钮描边（白色/黑色主题）', async ({ page }) => {
    await setupRoutes(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await expect(page.locator('#userMenuToggle')).toHaveText('个人');

    const styleSnapshot = await page.evaluate(() => {
      function resolveColor(value) {
        var temp = document.createElement('span');
        temp.style.color = value;
        document.body.appendChild(temp);
        var color = getComputedStyle(temp).color;
        document.body.removeChild(temp);
        return color;
      }

      function parseColor(colorText) {
        var raw = String(colorText || '').trim();
        if (!raw || raw === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
        var match = raw.match(/rgba?\(([^)]+)\)/);
        if (match) {
          var parts = match[1].split(',').map(function(item) { return parseFloat(String(item).trim()); });
          return {
            r: parts[0] || 0,
            g: parts[1] || 0,
            b: parts[2] || 0,
            a: parts.length > 3 ? (parts[3] || 0) : 1,
          };
        }
        var srgb = raw.match(/color\(\s*srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\s*\)/);
        if (srgb) {
          return {
            r: Math.round((parseFloat(srgb[1]) || 0) * 255),
            g: Math.round((parseFloat(srgb[2]) || 0) * 255),
            b: Math.round((parseFloat(srgb[3]) || 0) * 255),
            a: srgb[4] !== undefined ? (parseFloat(srgb[4]) || 0) : 1,
          };
        }
        return { r: 0, g: 0, b: 0, a: 0 };
      }

      function readStyles(theme) {
        if (theme) {
          document.documentElement.setAttribute('data-theme', theme);
        }
        var btn = document.querySelector('.tab-group-btn[data-group="ai"]') || document.querySelector('.tab-group-btn');
        if (btn && btn.classList) {
          btn.classList.remove('active');
          btn.classList.remove('hovering');
        }
        var rootStyle = getComputedStyle(document.documentElement);
        var navColor = rootStyle.getPropertyValue('--nav-main-color').trim();
        var baseBorder = rootStyle.getPropertyValue('--border').trim();
        var scrollButtons = Array.prototype.slice.call(document.querySelectorAll('.scroll-top-btn'));
        var scrollColors = scrollButtons.map(function(item) {
          return getComputedStyle(item).borderTopColor;
        });
        return {
          theme: theme || 'light',
          fontFamily: getComputedStyle(btn).fontFamily,
          fontSize: getComputedStyle(btn).fontSize,
          color: getComputedStyle(btn).color,
          borderColor: getComputedStyle(btn).borderTopColor,
          borderRgba: parseColor(getComputedStyle(btn).borderTopColor),
          borderWidth: getComputedStyle(btn).borderTopWidth,
          expectedColor: resolveColor(navColor),
          expectedBaseBorder: resolveColor(baseBorder),
          scrollBorderColors: scrollColors,
        };
      }

      return {
        light: readStyles('light'),
        dark: readStyles('dark'),
      };
    });

    expect(styleSnapshot.light.fontFamily).toContain('Noto Sans SC');
    expect(styleSnapshot.light.fontSize).toBe('15px');
    expect(styleSnapshot.light.color).toBe(styleSnapshot.light.expectedColor);
    expect(styleSnapshot.light.borderRgba.a).toBeGreaterThan(0.3);
    expect(styleSnapshot.light.borderRgba.b).toBeGreaterThan(styleSnapshot.light.borderRgba.g);
    expect(styleSnapshot.light.borderRgba.b).toBeGreaterThan(styleSnapshot.light.borderRgba.r);
    expect(styleSnapshot.light.borderWidth).toBe('1px');
    expect(styleSnapshot.light.scrollBorderColors.length).toBeGreaterThan(0);
    styleSnapshot.light.scrollBorderColors.forEach((color) => {
      expect(color).toBe(styleSnapshot.light.expectedBaseBorder);
    });

    expect(styleSnapshot.dark.fontFamily).toContain('Noto Sans SC');
    expect(styleSnapshot.dark.fontSize).toBe('15px');
    expect(styleSnapshot.dark.color).toBe(styleSnapshot.dark.expectedColor);
    expect(styleSnapshot.dark.borderRgba.a).toBeGreaterThan(0.3);
    expect(styleSnapshot.dark.borderRgba.b).toBeGreaterThan(styleSnapshot.dark.borderRgba.g);
    expect(styleSnapshot.dark.borderRgba.b).toBeGreaterThan(styleSnapshot.dark.borderRgba.r);
    expect(styleSnapshot.dark.borderWidth).toBe('1px');
    expect(styleSnapshot.dark.scrollBorderColors.length).toBeGreaterThan(0);
    styleSnapshot.dark.scrollBorderColors.forEach((color) => {
      expect(color).toBe(styleSnapshot.dark.expectedBaseBorder);
    });
  });
});
