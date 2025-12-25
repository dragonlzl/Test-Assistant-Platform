const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 0, username: 'reuse_dark_user', role: 'user', level: 'member' };

function createApiHandler(serverState) {
  return async function(route) {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/users/me' && method === 'GET') return respond(200, user);
    if (path === '/api/settings' && method === 'GET') return respond(200, serverState.settings);
    if (path === '/api/settings' && method === 'PUT') return respond(200, []);
    if (path === '/api/projects' && method === 'GET') return respond(200, []);
    if (path === '/api/case-files' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') return respond(200, []);
    if (path === '/api/features' && method === 'GET') return respond(200, []);
    if (path === '/api/ops' && method === 'GET') return respond(200, []);
    return respond(200, method === 'GET' ? [] : {});
  };
}

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

test.describe('暗色主题复用执行按钮', () => {
  test('复用类型实际结果按钮在暗色主题下非白底', async ({ page }) => {
    const serverState = {
      settings: [{
        id: 1,
        scope: 'user',
        owner_id: user.id,
        key: 'theme',
        value_json: 'dark',
      }],
    };
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-dark-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-file-1',
            name: '复用执行',
            reuseEnabled: true,
            reusePresets: [],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases: [{
              module: '模块A',
              title: '复用用例',
              priority: 'P1',
              preconditions: '',
              steps: '步骤1',
              expected: '预期',
              actual: '未执行',
              remark: '',
              reuseDetails: [],
              defectLinks: [],
            }],
          }],
          activeId: 'reuse-file-1',
        }));
      } catch (err) {}
    });

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.route('**/api/**', createApiHandler(serverState));

    await page.goto(base + '/index.html');
    await waitForAppReady(page);

    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.waitForSelector('.reuse-status', { state: 'attached', timeout: 8000 });
    const bgColor = await page.$eval('.reuse-status', (el) => getComputedStyle(el).backgroundColor);
    expect(bgColor).not.toBe('rgb(244, 244, 245)');
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });
});
