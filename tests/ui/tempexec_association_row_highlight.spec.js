const { test, expect } = require('@playwright/test');

async function gotoCaseExec(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/case-exec.html');
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await page.evaluate(() => {
        return {
          hasApp: Boolean(window.app),
          authReady: Boolean(window.app && window.app.authReady === true),
          hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
          hasTempExecApi: Boolean(window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function'),
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
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction((name) => {
    return window.app && window.app.state && window.app.state.activeTab === name;
  }, tabName, { timeout: 8000 }).catch(() => {});
}

test.describe('执行页关联副用例行高亮', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('关联副用例行在白色与黑色主题均有区分背景', async ({ page }) => {
    const token = 'token-association-row-highlight';
    const user = { id: 31, username: 'assoc_row_user', role: 'user', level: 'member' };
    const project = { id: 31, name: '关联高亮项目', description: 'assoc row highlight' };
    const versions = [{ id: 311, name: 'v1' }];
    const now = new Date().toISOString();
    const execSet = {
      id: 9101,
      project_id: project.id,
      version_id: versions[0].id,
      case_file_id: 910,
      name: '主用例A(关联)',
      status: 'active',
      association_enabled: true,
      created_at: now,
      updated_at: now,
    };

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === '/api/projects/31/versions' && method === 'GET') return respond(200, versions);
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, [execSet]);

      if (pathName === '/api/case-files/910/associations' && method === 'GET') {
        return respond(200, [
          {
            id: 5001,
            main_case_file_id: 910,
            sub_case_file_id: 920,
            sub_case_file_name: '用例名2',
            selected_case_item_ids: [8101],
            selected_count: 1,
            created_at: now,
            updated_at: now,
          },
          {
            id: 5002,
            main_case_file_id: 910,
            sub_case_file_id: 930,
            sub_case_file_name: '用例名3',
            selected_case_item_ids: [8201, 8202],
            selected_count: 2,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (pathName === '/api/exec/sets/9101/case-library-sync' && method === 'POST') {
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
          summary: { appended: 0, added: 0, updated: 0, deleted: 0 },
          diff: [],
          history: [],
        });
      }

      if (pathName === '/api/exec/sets/9101/cases' && method === 'GET') {
        return respond(200, [
          {
            id: 91011,
            exec_set_id: execSet.id,
            case_item_id: 7001,
            case_item_source_id: 7001,
            module: '登录',
            title: '主用例-1',
            expected: '成功',
            priority: 'P0',
            precondition: '无',
            steps: '步骤A1',
            actual_result: '',
            defect_link: '',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
            created_at: now,
            updated_at: now,
          },
          {
            id: 91012,
            exec_set_id: execSet.id,
            case_item_id: null,
            case_item_source_id: 8101,
            module: '支付',
            title: '副用例-引用条目',
            expected: '成功',
            priority: 'P1',
            precondition: '无',
            steps: '步骤B1',
            actual_result: '',
            defect_link: '',
            status: '未执行',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 2,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, token);

    await gotoCaseExec(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');
    await page.evaluate(() => {
      if (window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function') {
        return window.app.tempExecApi.loadTempExecState();
      }
      return null;
    });

    const comboCard = page.locator('.temp-exec-context-combo');
    await expect(comboCard).toContainText('当前用例组合');
    await expect(comboCard).toContainText('主用例A(关联)');
    await expect(comboCard).toContainText('用例名2');
    await expect(comboCard).toContainText('1条');
    await expect(comboCard).toContainText('用例名3');
    await expect(comboCard).toContainText('2条');
    await expect(page.locator('.temp-exec-combo-item.main')).toHaveCount(1);
    await expect(page.locator('.temp-exec-combo-item.main .temp-exec-combo-count')).toHaveText('1条');
    await expect(page.locator('.temp-exec-combo-item.sub')).toHaveCount(2);
    await expect(page.locator('.temp-exec-combo-sep')).toHaveCount(2);

    const assocRow = page.locator('tr.case-row.association-sub[data-temp-case-row="9101"][data-index="1"]');
    const mainRow = page.locator('tr.case-row[data-temp-case-row="9101"][data-index="0"]');
    await expect(assocRow).toHaveCount(1);
    await expect(mainRow).toHaveCount(1);

    const lightColors = await page.evaluate(() => {
      var assocCell = document.querySelector('tr.case-row.association-sub[data-temp-case-row="9101"][data-index="1"] td');
      var mainCell = document.querySelector('tr.case-row[data-temp-case-row="9101"][data-index="0"] td');
      return {
        assoc: assocCell ? window.getComputedStyle(assocCell).backgroundColor : '',
        main: mainCell ? window.getComputedStyle(mainCell).backgroundColor : '',
      };
    });
    expect(lightColors.assoc).toBeTruthy();
    expect(lightColors.main).toBeTruthy();
    expect(lightColors.assoc).not.toBe(lightColors.main);

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    const darkColors = await page.evaluate(() => {
      var assocCell = document.querySelector('tr.case-row.association-sub[data-temp-case-row="9101"][data-index="1"] td');
      var mainCell = document.querySelector('tr.case-row[data-temp-case-row="9101"][data-index="0"] td');
      return {
        assoc: assocCell ? window.getComputedStyle(assocCell).backgroundColor : '',
        main: mainCell ? window.getComputedStyle(mainCell).backgroundColor : '',
      };
    });
    expect(darkColors.assoc).toBeTruthy();
    expect(darkColors.main).toBeTruthy();
    expect(darkColors.assoc).not.toBe(darkColors.main);
  });
});
