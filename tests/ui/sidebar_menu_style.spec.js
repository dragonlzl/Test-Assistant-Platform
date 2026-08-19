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
  test('头像入口与无边框分类在白色/黑色主题下保持一致', async ({ page }) => {
    await setupRoutes(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await expect(page.locator('#userMenuToggle')).toHaveText('n');

    const styleSnapshot = await page.evaluate(() => {
      function readStyles(theme) {
        if (theme) {
          document.documentElement.setAttribute('data-theme', theme);
        }
        var btn = document.querySelector('.tab-group-btn[data-group="ai"]') || document.querySelector('.tab-group-btn');
        if (btn && btn.classList) {
          btn.classList.remove('active');
          btn.classList.remove('hovering');
        }
        return {
          theme: theme || 'light',
          fontFamily: getComputedStyle(btn).fontFamily,
          fontSize: getComputedStyle(btn).fontSize,
          borderWidth: getComputedStyle(btn).borderTopWidth,
          background: getComputedStyle(btn).backgroundColor,
        };
      }

      return {
        light: readStyles('light'),
        dark: readStyles('dark'),
      };
    });

    expect(styleSnapshot.light.fontFamily).toContain('Geist Variable');
    expect(styleSnapshot.light.fontSize).toBe('10px');
    expect(styleSnapshot.light.borderWidth).toBe('0px');
    expect(styleSnapshot.light.background).toBe('rgba(0, 0, 0, 0)');
    expect(styleSnapshot.dark.fontFamily).toContain('Geist Variable');
    expect(styleSnapshot.dark.fontSize).toBe('10px');
    expect(styleSnapshot.dark.borderWidth).toBe('0px');
    expect(styleSnapshot.dark.background).toBe('rgba(0, 0, 0, 0)');

    const modelNotice = page.locator('[data-tab-btn="models"] .tab-notice');
    await expect(modelNotice).toBeVisible();
    const noticeBox = await modelNotice.boundingBox();
    expect(noticeBox.width).toBeLessThanOrEqual(8);
    expect(noticeBox.height).toBeLessThanOrEqual(8);
    await expect(page.locator('[data-tab-btn="models"]')).toHaveAttribute('title', /未配置模型/);
    await expect(page.locator('[data-tab-btn="models"]')).toHaveAttribute('aria-label', /未配置模型/);

    await page.setViewportSize({ width: 760, height: 900 });
    await page.reload();
    await waitForAppReady(page);
    const narrowButton = await page.locator('[data-tab-btn="models"]').boundingBox();
    const narrowNotice = await page.locator('[data-tab-btn="models"] .tab-notice').boundingBox();
    expect(narrowNotice.width).toBeLessThanOrEqual(8);
    expect(narrowNotice.height).toBeLessThanOrEqual(8);
    expect(narrowNotice.x).toBeGreaterThan(narrowButton.x + narrowButton.width - 20);
    expect(narrowNotice.y).toBeLessThan(narrowButton.y + 16);
  });
});
