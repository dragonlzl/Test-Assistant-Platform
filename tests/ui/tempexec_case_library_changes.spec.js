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

test.describe('执行页-用例库变更同步与diff抽屉', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('进入/刷新执行页时自动同步并弹出diff；无新变更时不自动弹但可手动打开', async ({ page }) => {
    const token = 'token-case-lib-diff';
    const user = { id: 9, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '战魂铭人', description: 'for case lib diff' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const execSet = { id: 2001, project_id: project.id, version_id: versions[0].id, case_file_id: 100, name: '用例A', status: 'active', created_at: now, updated_at: now };
    let syncCalls = 0;
    let acked = false;

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

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        syncCalls += 1;
        const hasNew = syncCalls === 1;
        const diffEntry = {
          kind: 'updated',
          case_item_id: 1,
          changed_fields: ['steps'],
          old: { module: '登录', title: '正常登录', priority: 'P0', precondition: '', steps: '旧步骤', expected: '成功', remark: '' },
          new: { module: '登录', title: '正常登录', priority: 'P0', precondition: '', steps: '新步骤', expected: '成功', remark: '' },
        };
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: execSet.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: now,
          last_shown_at: acked ? now : null,
          ever_changed: true,
          has_new_diff: hasNew,
          should_auto_popup: hasNew,
          summary: { added: 0, updated: 1, deleted: 0 },
          diff: [diffEntry],
        });
      }

      if (pathName === `/api/exec/sets/${execSet.id}/case-library-diff/ack` && method === 'POST') {
        acked = true;
        return respond(200, { detail: 'ok', exec_set_id: execSet.id });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const id = Number(execCasesMatch[1]);
        if (id !== execSet.id) return respond(200, []);
        return respond(200, [
          {
            id: 3001,
            exec_set_id: execSet.id,
            case_item_id: 1,
            module: '登录',
            title: '正常登录',
            expected: '成功',
            priority: 'P0',
            precondition: '',
            steps: '新步骤',
            status: '变更重跑',
            remark: '',
            defect_links: [],
            reuse_details: [],
            order_no: 1,
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
    }, token);

    await gotoIndex(page);
    await waitAppReady(page, 30000);
    await switchToTab(page, 'tempexec');

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffCaseName')).toContainText('用例A');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('旧步骤');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('新步骤');

    await page.click('#closeTempExecCaseLibraryDiffDrawerBtn');
    await expect(diffDrawer).not.toHaveClass(/open/);

    await expect(page.locator('#tempExecToolbar')).toContainText('未执行 1');
    await expect(page.locator('#tempExecView')).toContainText('变更重跑');

    const btn = page.locator('#tempExecCaseLibraryChangesBtn');
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveClass(/has-new/);

    // 再次刷新：无新变更时不自动弹，但按钮仍可手动打开并查看最近一次差异
    await page.reload();
    await waitAppReady(page, 30000);
    await expect(diffDrawer).not.toHaveClass(/open/);
    await expect(btn).toHaveClass(/has-new/);

    await btn.click();
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(btn).not.toHaveClass(/has-new/);
    await expect(page.locator('#tempExecCaseLibraryDiffCaseName')).toContainText('用例A');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('旧步骤');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('新步骤');
  });

  test('存在多份变更时可切换用例diff；自动弹不影响当前选中用例；可点击“选择用例”切换执行视图', async ({ page }) => {
    const token = 'token-case-lib-diff-multi';
    const user = { id: 9, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '战魂铭人', description: 'for case lib diff multi' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const execSetA = { id: 2001, project_id: project.id, version_id: versions[0].id, case_file_id: 100, name: '用例A', status: 'active', created_at: now, updated_at: '2025-12-16T12:00:00.000Z' };
    const execSetB = { id: 2002, project_id: project.id, version_id: versions[0].id, case_file_id: 101, name: '用例B', status: 'active', created_at: now, updated_at: '2025-12-16T11:00:00.000Z' };

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
        return respond(200, [execSetA, execSetB]);
      }

      if (pathName === `/api/exec/sets/${execSetA.id}/case-library-sync` && method === 'POST') {
        return respond(200, {
          exec_set_id: execSetA.id,
          case_file_id: execSetA.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: now,
          last_shown_at: now,
          ever_changed: true,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { added: 0, updated: 1, deleted: 1 },
          diff: [
            {
              kind: 'updated',
              case_item_id: 11,
              changed_fields: ['steps'],
              old: { module: 'A模块', title: 'A改', priority: 'P0', precondition: '', steps: 'A旧步骤', expected: '成功', remark: '' },
              new: { module: 'A模块', title: 'A改', priority: 'P0', precondition: '', steps: 'A新步骤', expected: '成功', remark: '' },
            },
            {
              kind: 'deleted',
              case_item_id: 12,
              changed_fields: [],
              old: { module: 'A模块', title: 'A删', priority: 'P1', precondition: '', steps: 'A删步骤', expected: '成功', remark: '' },
              new: null,
            },
          ],
        });
      }

      if (pathName === `/api/exec/sets/${execSetB.id}/case-library-sync` && method === 'POST') {
        return respond(200, {
          exec_set_id: execSetB.id,
          case_file_id: execSetB.case_file_id,
          case_file_updated_at: now,
          base_updated_at: now,
          last_diff_at: now,
          last_shown_at: null,
          ever_changed: true,
          has_new_diff: true,
          should_auto_popup: true,
          summary: { added: 0, updated: 1, deleted: 0 },
          diff: [
            {
              kind: 'updated',
              case_item_id: 21,
              changed_fields: ['steps'],
              old: { module: 'B模块', title: 'B改', priority: 'P0', precondition: '', steps: 'B旧步骤', expected: '成功', remark: '' },
              new: { module: 'B模块', title: 'B改', priority: 'P0', precondition: '', steps: 'B新步骤', expected: '成功', remark: '' },
            },
          ],
        });
      }

      if (pathName.endsWith('/case-library-diff/ack') && method === 'POST') {
        return respond(200, { detail: 'ok' });
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        return respond(200, []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await gotoIndex(page);
    await waitAppReady(page, 30000);

    await switchToTab(page, 'tempexec');

    const diffDrawer = page.locator('#tempExecCaseLibraryDiffDrawer');
    await expect(diffDrawer).toHaveClass(/open/);
    await expect(page.locator('#tempExecCaseLibraryDiffCaseName')).toContainText('用例B');

    const activeIdBefore = await page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : ''));
    expect(activeIdBefore).toBe(String(execSetA.id));

    const tabs = page.locator('#tempExecCaseLibraryDiffCaseTabs button');
    await expect(tabs).toHaveCount(2);
    await expect(page.locator('#tempExecCaseLibraryDiffCaseTabs')).toContainText('用例A');
    await expect(page.locator('#tempExecCaseLibraryDiffCaseTabs')).toContainText('用例B');

    // 选择当前 diff 用例：切到用例B的执行视图
    await page.click('#tempExecCaseLibraryDiffSelectCaseBtn');
    const activeIdAfterSelect = await page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : ''));
    expect(activeIdAfterSelect).toBe(String(execSetB.id));

    // 切换查看用例A的 diff，并验证过滤药丸作用于“当前查看的 diff 用例”
    await page.click('#tempExecCaseLibraryDiffCaseTabs button:has-text(\"用例A\")');
    await expect(page.locator('#tempExecCaseLibraryDiffCaseName')).toContainText('用例A');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('A改');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('A删');

    // 切换用例后应重置过滤状态（药丸不应处于 active）
    const deletedPill = page.locator('#tempExecCaseLibraryDiffDeletedPill');
    await expect(deletedPill).not.toHaveClass(/active/);

    await page.click('#tempExecCaseLibraryDiffDeletedPill');
    await expect(deletedPill).toHaveClass(/active/);
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).toContainText('A删');
    await expect(page.locator('#tempExecCaseLibraryDiffBody')).not.toContainText('A改');
  });
});
