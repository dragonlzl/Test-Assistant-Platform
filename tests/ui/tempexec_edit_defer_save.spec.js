const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/case-exec.html?tab=tempexec');
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

test.describe('执行页编辑保存时机', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('编辑执行用例字段仅在失焦时入库', async ({ page }) => {
    const token = 'token-tempexec-edit-defer';
    const user = { id: 21, username: 'edit_defer_user', role: 'user', level: 'member' };
    const project = { id: 12, name: '延迟保存项目', description: 'defer save' };
    const versions = [{ id: 121, name: 'v1' }];
    const now = new Date().toISOString();
    const execSet = { id: 12101, project_id: project.id, version_id: versions[0].id, case_file_id: 501, name: '执行集A', status: 'active', created_at: now, updated_at: now };
    const execCase = {
      id: 1210101,
      exec_set_id: execSet.id,
      case_item_id: 101,
      module: '登录',
      title: '旧标题',
      expected: '成功',
      priority: 'P1',
      precondition: '无',
      steps: '旧步骤',
      status: '未执行',
      remark: '',
      defect_links: [],
      reuse_details: [],
      order_no: 1,
      created_at: now,
      updated_at: now,
    };
    let patchCalls = 0;
    const patchPayloads = [];

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
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
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
        return respond(200, [execCase]);
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
        patchCalls += 1;
        try {
          const raw = route.request().postData() || '{}';
          patchPayloads.push(JSON.parse(raw));
        } catch (_) {
          patchPayloads.push({});
        }
        return respond(200, { detail: 'ok' });
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
    await page.waitForLoadState('networkidle');

    const titleCell = page.locator('[data-temp-edit-field="title"]').first();
    await expect(titleCell).toBeVisible();
    await titleCell.click();
    await page.keyboard.type('新增文本');
    await page.waitForTimeout(500);
    expect(patchCalls).toBe(0);

    const patchWait = page.waitForResponse((resp) => {
      return resp.url().includes(`/api/exec/cases/${execCase.id}`) && resp.request().method() === 'PATCH';
    });
    await page.locator('#tempExecToolbar input[data-temp-search-input]').click();
    await patchWait;
    expect(patchCalls).toBe(1);
    expect(patchPayloads.length).toBe(1);
    expect(patchPayloads[0].title || '').toContain('新增文本');
  });
});
