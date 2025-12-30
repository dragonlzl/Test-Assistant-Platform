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
    try {
      last = await page.evaluate(() => {
        let token = '';
        try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
        return {
          hasApp: Boolean(window.app),
          authReady: Boolean(window.app && window.app.authReady === true),
          hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
          hasTempExecApi: Boolean(window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function'),
          token: token,
          tab: window.app && window.app.state ? window.app.state.activeTab : '',
        };
      });
    } catch (err) {
      last = { error: err && err.message ? err.message : 'evaluate failed' };
      await page.waitForTimeout(200);
      continue;
    }
    if (last && last.hasApp && last.authReady && last.hasSwitchTab && last.hasTempExecApi) return;
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

async function ensureAuthed(page, token, user) {
  await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
  await page.evaluate((payload) => {
    try { localStorage.setItem('tap-auth-token', payload.token); } catch (_) {}
    if (window.app && window.app.apiClient && typeof window.app.apiClient.setToken === 'function') {
      window.app.apiClient.setToken(payload.token);
    }
    if (window.app && window.app.state) {
      window.app.state.currentUser = payload.user;
      window.app.state.authReady = true;
    }
    window.app = window.app || {};
    window.app.authReady = true;
  }, { token: token, user: user });
}

async function confirmDrawer(page, message) {
  const drawer = page.locator('#appConfirmDrawer');
  await expect(drawer).toHaveClass(/open/);
  if (message) {
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText(message);
  }
  await page.click('#appConfirmDrawerConfirmBtn');
  await expect(drawer).not.toHaveClass(/open/);
}

test.describe('复用预设子项删除保持', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('删除预设子项后刷新仍保持移除', async ({ page }) => {
    const token = 'token-reuse-preset-remove';
    const user = { id: 41, username: 'reuse_preset_remove', role: 'user', level: 'member' };
    const now = new Date().toISOString();
    const execSet = {
      id: 8810,
      project_id: null,
      version_id: null,
      case_file_id: null,
      name: '复用预设删除',
      status: 'active',
      reuse_enabled: true,
      reuse_presets: [
        { id: 'preset-a', text: '子项A' },
        { id: 'preset-b', text: '子项B' },
      ],
      created_at: now,
      updated_at: now,
    };
    const execCase = {
      id: 881001,
      exec_set_id: execSet.id,
      case_item_id: 201,
      module: '模块A',
      title: '用例A',
      expected: 'ok',
      priority: 'P1',
      precondition: '',
      steps: '',
      status: '未执行',
      remark: '',
      defect_links: [],
      reuse_details: [
        { id: 'detail-a', text: '子项A', note: '', status: '通过', presetId: 'preset-a' },
        { id: 'detail-b', text: '子项B', note: '', status: '未执行', presetId: 'preset-b' },
      ],
      order_no: 1,
      created_at: now,
      updated_at: now,
    };

    let patchPayload = null;
    const execCasesBySetId = {};
    execCasesBySetId[execSet.id] = [Object.assign({}, execCase)];

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
      if (pathName === '/api/projects' && method === 'GET') return respond(200, []);
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, [execSet]);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/cases` && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, execCasesBySetId[execSet.id] || []);
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: null,
          last_shown_at: null,
          ever_changed: false,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { added: 0, updated: 0, deleted: 0 },
          diff: [],
        });
      }

      if (pathName === `/api/exec/cases/${execCase.id}` && method === 'PATCH') {
        try {
          patchPayload = JSON.parse(route.request().postData() || '{}');
        } catch (_) {
          patchPayload = {};
        }
        const list = execCasesBySetId[execSet.id] || [];
        if (list[0]) {
          Object.assign(list[0], patchPayload);
        }
        return respond(200, Object.assign({}, list[0] || execCase));
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await page.waitForFunction(() => window.app && window.app.apiClient && window.app.state);
    await ensureAuthed(page, token, user);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');

    const patchWait = page.waitForResponse((resp) => {
      return resp.url().includes(`/api/exec/cases/${execCase.id}`) && resp.request().method() === 'PATCH';
    });

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    await page.waitForSelector(`[data-temp-case-row="${execSet.id}"][data-index="0"]`, { timeout: 12000 });
    await page.click(`[data-temp-reuse-panel="${execSet.id}"][data-index="0"]`);
    const panel = page.locator(`[data-temp-reuse-panel-container="${execSet.id}"][data-index="0"]`);
    await expect(panel).toBeVisible();
    await expect(panel.locator('.reuse-entry')).toHaveCount(2);

    await panel.locator('.reuse-entry').first().locator('.reuse-remove').click();
    await confirmDrawer(page, '确定删除该复用测试项吗');
    await patchWait;

    await expect(panel.locator('.reuse-entry')).toHaveCount(1);
    await expect(panel.locator('.reuse-entry .reuse-input')).toHaveValue('子项B');

    expect(patchPayload && Array.isArray(patchPayload.reuse_details)).toBeTruthy();
    const removed = (patchPayload.reuse_details || []).find((item) => item && item.presetId === 'preset-a');
    expect(removed && removed.removed === true).toBeTruthy();

    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    await page.waitForSelector(`[data-temp-case-row="${execSet.id}"][data-index="0"]`, { timeout: 12000 });
    await page.click(`[data-temp-reuse-panel="${execSet.id}"][data-index="0"]`);
    const panelAfter = page.locator(`[data-temp-reuse-panel-container="${execSet.id}"][data-index="0"]`);
    await expect(panelAfter).toBeVisible();
    await expect(panelAfter.locator('.reuse-entry')).toHaveCount(1);
    await expect(panelAfter.locator('.reuse-entry .reuse-input')).toHaveValue('子项B');
  });
});
