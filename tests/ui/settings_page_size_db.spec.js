const { test, expect } = require('@playwright/test');

test.describe('全局分页设置 DB 同步', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const user = { id: 901, username: 'page_size_user', role: 'admin', level: 'leader' };

  function buildExecCases(execSetId, count) {
    const cases = [];
    const now = new Date().toISOString();
    for (let i = 0; i < count; i += 1) {
      cases.push({
        id: 1000 + i,
        exec_set_id: execSetId,
        case_item_id: 2000 + i,
        module: '模块' + (i + 1),
        title: '用例标题' + (i + 1),
        expected: '预期' + (i + 1),
        priority: 'P1',
        precondition: '',
        steps: '步骤' + (i + 1),
        actual_result: '',
        defect_link: null,
        reuse_details: null,
        defect_links: null,
        remark: '',
        status: '未执行',
        order_no: i + 1,
        executor_id: user.id,
        created_at: now,
        updated_at: now,
      });
    }
    return cases;
  }

  function createApiHandler(serverState) {
    let settingSeq = 10;
    const execSet = {
      id: 501,
      name: '执行集-分页验证',
      status: 'active',
      project_id: 1,
      version_id: 11,
      case_count: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const cases = buildExecCases(execSet.id, execSet.case_count);

    return async function(route) {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/settings' && method === 'GET') return respond(200, serverState.settings);
      if (path === '/api/settings' && method === 'PUT') {
        const body = route.request().postDataJSON() || {};
        const scope = body.scope || 'user';
        const items = Array.isArray(body.items) ? body.items : [];
        const now = new Date().toISOString();
        const saved = [];
        items.forEach((item) => {
          if (!item || !item.key) return;
          const ownerId = scope === 'global' ? null : user.id;
          let existing = serverState.settings.find(
            (row) => row.key === item.key && row.scope === scope && row.owner_id === ownerId
          );
          if (existing) {
            existing.value_json = item.value_json;
            existing.updated_at = now;
            saved.push(existing);
            return;
          }
          const next = {
            id: settingSeq++,
            scope,
            owner_id: ownerId,
            key: item.key,
            value_json: item.value_json,
            updated_at: now,
          };
          serverState.settings.push(next);
          saved.push(next);
        });
        return respond(200, saved);
      }
      if (path === '/api/projects' && method === 'GET') {
        return respond(200, [{ id: 1, name: '分页项目', description: '' }]);
      }
      if (path === '/api/projects/1/versions' && method === 'GET') {
        return respond(200, [{ id: 11, name: 'v1' }]);
      }
      if (path === '/api/case-files' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/sets' && method === 'GET') {
        if (url.searchParams.get('status_filter') === 'archived') return respond(200, []);
        return respond(200, [execSet]);
      }
      if (path === `/api/exec/sets/${execSet.id}/cases` && method === 'GET') {
        return respond(200, cases);
      }
      return respond(200, {});
    };
  }

  async function waitForAppReady(page) {
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
  }

  test('设置页分页值优先于 tempexec_ui_v1 并即时生效', async ({ page }) => {
    const now = new Date().toISOString();
    const serverState = {
      settings: [
        {
          id: 1,
          scope: 'user',
          owner_id: user.id,
          key: 'tempExecPageSize',
          value_json: 10,
          updated_at: now,
        },
        {
          id: 2,
          scope: 'user',
          owner_id: user.id,
          key: 'tempexec_ui_v1',
          value_json: { type: 'tempexec_ui_v1', pageSize: 50 },
          updated_at: now,
        },
      ],
    };
    const apiHandler = createApiHandler(serverState);

    await page.addInitScript(() => {
      try {
        ['usecase-settings-v1', 'tempexec-page-size'].forEach((key) => {
          window.localStorage.removeItem(key);
        });
        window.localStorage.setItem('tap-auth-token', 'page-size-token');
      } catch (err) {
        // ignore
      }
    });
    await page.route('**/*', (route) => {
      const target = route.request().url();
      if (target.startsWith('http://localhost') || target.startsWith('http://127.0.0.1') || target.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.route('**/api/**', apiHandler);

    await page.goto(base + '/index.html');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await page.evaluate(() => {
      document.querySelectorAll('.tab-group .tab-submenu').forEach(function(menu) {
        menu.classList.remove('hidden');
      });
      document.querySelectorAll('.tab-group').forEach(function(group) {
        group.classList.add('open');
      });
      document.querySelectorAll('.tab-group .tab-group-btn').forEach(function(btn) {
        btn.classList.add('open');
      });
      document.querySelectorAll('[data-tab-btn]').forEach(function(btn) {
        btn.classList.remove('hidden');
        btn.classList.remove('role-hidden');
      });
    });

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    const paginationInfo = page.locator('.temp-pagination-info').first();
    await expect(paginationInfo).toContainText('每页 10 条');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#tempExecPageSizeInput')).toHaveValue('10');
    await page.fill('#tempExecPageSizeInput', '15');
    await page.click('#saveTempExecPageSize');
    await expect(page.locator('#tempExecPageSizeStatus')).toContainText(/已更新|已是/);
    await expect.poll(() => {
      const record = serverState.settings.find((item) => item.key === 'tempExecPageSize');
      return record ? record.value_json : null;
    }).toBe(15);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await expect(paginationInfo).toContainText('每页 15 条');
  });
});
