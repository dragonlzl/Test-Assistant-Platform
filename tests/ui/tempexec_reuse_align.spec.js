const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 0, username: 'reuse_align_user', role: 'user', level: 'member' };

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

test.describe('执行视图复用子项对齐', () => {
  test('复用子项执行选择框与实际结果列中心对齐', async ({ page }) => {
    const serverState = { settings: [] };
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'reuse-align-token');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'reuse-align-file',
            name: '复用对齐',
            reuseEnabled: true,
            reusePresets: [],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases: [{
              module: '模块A',
              title: '对齐用例',
              priority: 'P1',
              preconditions: '',
              steps: '步骤1',
              expected: '预期',
              actual: '未执行',
              remark: '',
              reuseDetails: [{
                id: 'reuse-align-detail-1',
                text: '子项1',
                note: '',
                status: '未执行',
              }],
              defectLinks: [],
            }],
          }],
          activeId: 'reuse-align-file',
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

    await page.evaluate(() => {
      if (window.app && typeof window.app.switchTab === 'function') {
        window.app.switchTab('tempexec');
      }
    });

    await page.waitForSelector('.reuse-status', { state: 'attached', timeout: 8000 });
    await page.click('.reuse-status');
    await page.waitForSelector('.reuse-entry .status-select', { state: 'attached', timeout: 8000 });
    const transitionProp = await page.$eval('.reuse-entry .status-select', (el) => getComputedStyle(el).transitionProperty);
    expect(transitionProp).not.toContain('all');
    expect(transitionProp).not.toContain('transform');

    await page.waitForFunction(() => {
      var table = document.querySelector('#tempExecView table');
      if (!table) return false;
      var listLeft = table.getBoundingClientRect().left;
      var actualEl = table.querySelector('tbody tr.case-row td.actual .reuse-status')
        || table.querySelector('tbody tr.case-row td.actual .status-select');
      var noteEl = table.querySelector('.reuse-entry .reuse-note');
      var selectEl = table.querySelector('.reuse-entry .status-select');
      if (!actualEl || !selectEl || !noteEl) return false;
      var actualRect = actualEl.getBoundingClientRect();
      var selectRect = selectEl.getBoundingClientRect();
      var noteRect = noteEl.getBoundingClientRect();
      if (!actualRect.width || !selectRect.width) return false;
      var actualCenter = actualRect.left + actualRect.width / 2;
      var selectCenter = selectRect.left + selectRect.width / 2;
      var delta = Math.abs((actualCenter - listLeft) - (selectCenter - listLeft));
      var gap = selectRect.left - noteRect.right;
      var fontSize = parseFloat(getComputedStyle(noteEl).fontSize) || 0;
      return delta <= 1 && Math.abs(gap - fontSize) <= 1;
    }, null, { timeout: 8000 });

    const result = await page.evaluate(() => {
      var table = document.querySelector('#tempExecView table');
      if (!table) return null;
      var listLeft = table.getBoundingClientRect().left;
      var actualEl = table.querySelector('tbody tr.case-row td.actual .reuse-status')
        || table.querySelector('tbody tr.case-row td.actual .status-select');
      var noteEl = table.querySelector('.reuse-entry .reuse-note');
      var selectEl = table.querySelector('.reuse-entry .status-select');
      if (!actualEl || !selectEl || !noteEl) return null;
      var actualRect = actualEl.getBoundingClientRect();
      var selectRect = selectEl.getBoundingClientRect();
      var noteRect = noteEl.getBoundingClientRect();
      var actualCenter = actualRect.left + actualRect.width / 2;
      var selectCenter = selectRect.left + selectRect.width / 2;
      var delta = Math.abs((actualCenter - listLeft) - (selectCenter - listLeft));
      var gap = selectRect.left - noteRect.right;
      var fontSize = parseFloat(getComputedStyle(noteEl).fontSize) || 0;
      return { delta, gap, fontSize };
    });
    expect(result).not.toBeNull();
    expect(result.delta).toBeLessThanOrEqual(1);
    expect(Math.abs(result.gap - result.fontSize)).toBeLessThanOrEqual(1);
  });
});
