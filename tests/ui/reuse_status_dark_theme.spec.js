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
              reuseDetails: [{
                id: 'reuse-detail-1',
                text: '子项1',
                note: '',
                status: '未执行',
              }],
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

    await page.click('.reuse-status');
    await page.waitForSelector('.reuse-entry .status-select option', { state: 'attached', timeout: 8000 });
    const panelColor = await page.evaluate(() => {
      var root = document.documentElement;
      var raw = getComputedStyle(root).getPropertyValue('--panel').trim();
      var temp = document.createElement('div');
      temp.style.backgroundColor = raw;
      document.body.appendChild(temp);
      var resolved = getComputedStyle(temp).backgroundColor;
      temp.remove();
      return resolved;
    });
    const optionBg = await page.$eval('.reuse-entry .status-select option', (el) => getComputedStyle(el).backgroundColor);
    expect(optionBg).toBe(panelColor);
  });

  test('暗色主题用例编辑输入框不为白底', async ({ page }) => {
    const serverState = {
      settings: [{
        id: 2,
        scope: 'user',
        owner_id: user.id,
        key: 'theme',
        value_json: 'dark',
      }],
    };
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-dark-edit-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-file-2',
            name: '复用执行-编辑',
            reuseEnabled: false,
            reusePresets: [],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases: [{
              module: '模块B',
              title: '编辑用例',
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
          activeId: 'reuse-file-2',
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

    const editSelector = '.card[data-section-id="tempexec-view"] .temp-inline-edit';
    await page.waitForSelector(editSelector, { state: 'visible', timeout: 8000 });
    await page.click(editSelector);
    await page.waitForFunction(() => {
      var el = document.activeElement;
      return el && el.classList && el.classList.contains('temp-inline-edit');
    });
    const panelColor = await page.evaluate(() => {
      var root = document.documentElement;
      var raw = getComputedStyle(root).getPropertyValue('--panel').trim();
      var temp = document.createElement('div');
      temp.style.backgroundColor = raw;
      document.body.appendChild(temp);
      var resolved = getComputedStyle(temp).backgroundColor;
      temp.remove();
      return resolved;
    });
    const editBg = await page.evaluate((selector) => {
      var el = document.activeElement && document.activeElement.classList
        && document.activeElement.classList.contains('temp-inline-edit')
        ? document.activeElement
        : document.querySelector(selector);
      if (!el) return '';
      return getComputedStyle(el).backgroundColor;
    }, editSelector);
    expect(editBg).not.toBe('rgb(248, 250, 252)');
    expect(editBg).not.toBe('rgb(255, 255, 255)');
    expect(panelColor).not.toBe('rgb(255, 255, 255)');
  });

  test('暗色主题执行页勾选框使用主题色', async ({ page }) => {
    const serverState = {
      settings: [{
        id: 3,
        scope: 'user',
        owner_id: user.id,
        key: 'theme',
        value_json: 'dark',
      }],
    };
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-dark-checkbox-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-file-3',
            name: '复用执行-勾选',
            reuseEnabled: true,
            reusePresets: [],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases: [{
              module: '模块C',
              title: '勾选用例',
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
          activeId: 'reuse-file-3',
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
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await page.waitForFunction(() => window.app && window.app.state && window.app.state.activeTab === 'tempexec');
    await page.waitForSelector('.temp-case-view td.check input[type="checkbox"]', { state: 'attached', timeout: 8000 });
    await page.waitForSelector('#tempExecToolbar input[data-temp-reuse-toggle]', { state: 'attached', timeout: 8000 });

    const expectedAccent = await page.evaluate(() => {
      var raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      var temp = document.createElement('div');
      temp.style.color = raw;
      document.body.appendChild(temp);
      var resolved = getComputedStyle(temp).color;
      temp.remove();
      return resolved;
    });
    const rowAccent = await page.$eval('.temp-case-view td.check input[type="checkbox"]', (el) => getComputedStyle(el).accentColor);
    const reuseAccent = await page.$eval('#tempExecToolbar input[data-temp-reuse-toggle]', (el) => getComputedStyle(el).accentColor);
    expect(rowAccent).toBe(expectedAccent);
    expect(reuseAccent).toBe(expectedAccent);
  });
});
