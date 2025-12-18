const { test, expect } = require('@playwright/test');

test.describe('执行视图空态与样式', () => {
  test.beforeEach(async ({ page }) => {
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
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true);
  });

  test('空态提示文案与删除按钮位置', async ({ page }) => {
    await page.click('[data-group="cases"]');
    await page.click('[data-tab-btn="tempexec"]');

    const emptyHint = page.locator('#tempExecView .temp-case-empty');
    await expect(emptyHint).toHaveText('暂无执行用例，请通过“用例导入&分配”抽屉导入或选择历史记录');

    const positions = await page.evaluate(() => {
      var host = document.createElement('div');
      host.style.position = 'relative';
      host.style.width = '260px';
      host.style.padding = '12px';
      document.body.appendChild(host);

      var btn = document.createElement('button');
      btn.className = 'temp-req-item';
      btn.textContent = '示例用例';
      var remove = document.createElement('span');
      remove.className = 'remove';
      btn.appendChild(remove);
      host.appendChild(btn);

      var style = window.getComputedStyle(remove);
      var btnRect = btn.getBoundingClientRect();
      var removeRect = remove.getBoundingClientRect();
      return {
        top: style.top,
        right: style.right,
        inside: removeRect.right <= btnRect.right && removeRect.top >= btnRect.top && removeRect.left >= btnRect.left
      };
    });

    expect(positions.top).toBe('8px');
    expect(positions.right).toBe('8px');
    expect(positions.inside).toBeTruthy();
  });
});
