const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
const user = { id: 18, username: 'casegen_clear_user', role: 'user', level: 'member' };

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 20000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 20000 });
}

async function setupRoutes(page) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('tap-auth-token', 'casegen-clear-token'); } catch (err) {}
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
    if (path === '/api/case-files' && method === 'GET') return respond(200, []);
    if (path === '/api/models' && method === 'GET') return respond(200, []);
    if (path === '/api/features' && method === 'GET') return respond(200, []);
    if (path === '/api/ops' && method === 'GET') return respond(200, []);
    return respond(200, method === 'GET' ? [] : {});
  });
}

async function seedCaseGenModule(page) {
  await page.evaluate(() => {
    if (window.app && typeof window.app.switchTab === 'function') {
      window.app.switchTab('casesgen');
    }
  });
  await page.waitForFunction(() => window.app && window.app.casesGenApi && typeof window.app.casesGenApi.setCaseGenViewTab === 'function', null, { timeout: 8000 });

  await page.evaluate(() => {
    const state = window.app && window.app.state ? window.app.state : null;
    if (!state) return;
    const moduleId = 'mod-clear-1';
    state.caseGenModules = [
      { id: moduleId, title: '登录', module: '登录', key_scenarios: [], test_points: [], coupled_modules: [] },
    ];
    state.caseGenResults = {};
    state.caseSelections = {};
    const cases = [{
      module: '登录',
      title: '登录-用例1',
      priority: 'P1',
      preconditions: '前置条件',
      steps: ['步骤1', '步骤2'],
      expected: '预期结果',
    }];
    state.caseGenResults[moduleId] = JSON.stringify(cases, null, 2);
    state.caseSelections[moduleId] = new Set();

    if (window.app.casesGenApi && typeof window.app.casesGenApi.renderCaseGeneration === 'function') {
      window.app.casesGenApi.renderCaseGeneration();
    }
    if (window.app.casesGenApi && typeof window.app.casesGenApi.setCaseGenViewTab === 'function') {
      window.app.casesGenApi.setCaseGenViewTab('modules', { persist: false });
    }
  });

  await page.waitForSelector('[data-module-id="mod-clear-1"]', { timeout: 8000 });
}

test.describe('用例生成清除确认抽屉', () => {
  test('清除用例改为抽屉确认并支持取消', async ({ page }) => {
    await setupRoutes(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(base + '/index.html');
    await waitForAppReady(page);
    await seedCaseGenModule(page);

    const clearBtn = page.locator('[data-clear="mod-clear-1"]');
    const textarea = page.locator('textarea[data-result="mod-clear-1"]');
    await expect(clearBtn).toBeEnabled();
    await expect(textarea).not.toHaveValue('');

    await clearBtn.click();
    const drawer = page.locator('#appConfirmDrawer');
    await expect(drawer).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage'))
      .toContainText('确定要清除【登录】的用例吗？');
    await page.click('#appConfirmDrawerCancelBtn');
    await expect(drawer).not.toHaveClass(/open/);
    await expect(textarea).not.toHaveValue('');
    await expect(clearBtn).toBeEnabled();

    await clearBtn.click();
    await expect(drawer).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await page.waitForFunction(() => {
      const area = document.querySelector('textarea[data-result="mod-clear-1"]');
      const btn = document.querySelector('[data-clear="mod-clear-1"]');
      return area && area.value.trim() === '' && btn && btn.disabled;
    });
    await expect(page.locator('[data-case-status="mod-clear-1"]'))
      .toContainText('已清除');
  });
});
