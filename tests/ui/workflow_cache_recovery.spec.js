const { test, expect } = require('@playwright/test');

test.describe('启动缓存恢复', () => {
  test('异常过大的本地流程缓存不会阻塞页面启动', async ({ page }) => {
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
        localStorage.setItem('usecase-workflow-state-v1', 'x'.repeat(1600001));
        localStorage.setItem('tap-xmind-casegen-tasks', 'y'.repeat(950001));
      } catch (err) {
        // ignore
      }
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
      timeout: 20000,
    });

    await expect.poll(async () => {
      return await page.evaluate(() => {
        return {
          workflow: localStorage.getItem('usecase-workflow-state-v1'),
          tasks: localStorage.getItem('tap-xmind-casegen-tasks'),
          user: window.app && window.app.state && window.app.state.currentUser
            ? window.app.state.currentUser.username
            : '',
        };
      });
    }).toEqual({
      workflow: null,
      tasks: null,
      user: 'e2e',
    });
  });
});
