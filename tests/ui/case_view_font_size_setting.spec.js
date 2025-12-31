const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
}

test.describe('用例视图字号设置', () => {
  const user = { id: 22, username: 'font_user', role: 'admin', level: 'leader' };
  const project = { id: 3, name: '字体项目', description: '' };
  const versions = [{ id: 31, name: 'v1' }];
  const caseFileId = 301;
  const now = new Date().toISOString();
  const caseFiles = [
    {
      id: caseFileId,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '用例库字体',
      reuse_enabled: false,
      item_count: 1,
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    },
  ];
  const caseItemsByFileId = {};
  caseItemsByFileId[caseFileId] = [
    {
      id: 9101,
      case_file_id: caseFileId,
      module: '模块A',
      title: '正常登录',
      priority: 'P1',
      precondition: '',
      steps: '步骤1',
      expected: '成功',
      remark: '',
      created_at: now,
      updated_at: now,
    },
  ];

  function createApiHandler(serverState) {
    let settingSeq = 20;
    return async function(route) {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me' && method === 'GET') return respond(200, user);
      if (path === '/api/settings' && method === 'GET') return respond(200, serverState.settings);
      if (path === '/api/settings' && method === 'PUT') {
        const body = route.request().postDataJSON() || {};
        const scope = body.scope || 'user';
        const items = Array.isArray(body.items) ? body.items : [];
        const nowIso = new Date().toISOString();
        const saved = [];
        items.forEach((item) => {
          if (!item || !item.key) return;
          const ownerId = scope === 'global' ? null : user.id;
          let existing = serverState.settings.find(
            (row) => row.key === item.key && row.scope === scope && row.owner_id === ownerId
          );
          if (existing) {
            existing.value_json = item.value_json;
            existing.updated_at = nowIso;
            saved.push(existing);
            return;
          }
          const next = {
            id: settingSeq += 1,
            scope,
            owner_id: ownerId,
            key: item.key,
            value_json: item.value_json,
            updated_at: nowIso,
          };
          serverState.settings.push(next);
          saved.push(next);
        });
        return respond(200, saved);
      }
      if (path === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (path === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (path === '/api/case-files' && method === 'GET') {
        const pid = url.searchParams.get('project_id');
        if (pid && pid !== String(project.id)) return respond(200, []);
        return respond(200, caseFiles.slice());
      }
      const itemsMatch = path.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        const id = Number(itemsMatch[1]);
        return respond(200, (caseItemsByFileId[id] || []).slice());
      }
      if (path === '/api/models' && method === 'GET') return respond(200, []);
      if (path === '/api/features' && method === 'GET') return respond(200, []);
      if (path === '/api/ops' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview' && method === 'GET') return respond(200, {});
      if (path === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/overview/layout' && method === 'GET') return respond(200, {});
      if (path === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    };
  }

  test('保存后同步执行视图与用例库编辑视图字号', async ({ page }) => {
    const serverState = { settings: [] };
    const apiHandler = createApiHandler(serverState);

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-auth-token', 'font-token');
        localStorage.removeItem('usecase-settings-v1');
        localStorage.setItem('usecase-temp-exec-v1', JSON.stringify({
          files: [{
            id: 'font-exec-file',
            name: '字号执行',
            reuseEnabled: false,
            reusePresets: [],
            createdAt: Date.now(),
            requirement: '',
            projectId: '',
            versionId: '',
            cases: [{
              module: '模块A',
              title: '用例A',
              priority: 'P1',
              preconditions: '',
              steps: '步骤1',
              expected: '期望1',
              actual: '未执行',
              remark: '',
              reuseDetails: [],
              defectLinks: [],
            }],
          }],
          versions: [],
          placement: { requirementOrder: [], fileOrder: {}, versionOrder: [] },
          collapsed: { req: false, version: false },
          activeId: 'font-exec-file',
        }));
      } catch (_) {}
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

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('settings'); });
    await expect(page.locator('#caseViewFontSizeInput')).toBeVisible();
    await page.fill('#caseViewFontSizeInput', '15');
    await page.click('#saveCaseViewFontSize');
    await expect(page.locator('#caseViewFontSizeStatus')).toContainText('用例视图字号已更新为');

    await page.waitForFunction(() => {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--case-view-font-size').trim();
      return val === '15px';
    });

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await page.waitForSelector('#tempExecView table');
    const execSizes = await page.evaluate(() => {
      const table = document.querySelector('#tempExecView table');
      const status = document.querySelector('#tempExecView select.status-select');
      const remark = document.querySelector('#tempExecView .remark-toggle');
      return {
        table: table ? getComputedStyle(table).fontSize : '',
        status: status ? getComputedStyle(status).fontSize : '',
        remark: remark ? getComputedStyle(remark).fontSize : '',
      };
    });
    expect(execSizes.table).toBe('15px');
    expect(execSizes.status).toBe('15px');
    expect(execSizes.remark).toBe('14px');

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });
    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.waitForSelector(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await page.click(`#caseLibraryEditListBody [data-case-lib-edit="${caseFileId}"]`);
    await page.waitForSelector('#caseLibraryEditView table');
    const editFont = await page.evaluate(() => {
      const table = document.querySelector('#caseLibraryEditView table');
      return table ? getComputedStyle(table).fontSize : '';
    });
    expect(editFont).toBe('15px');
  });
});
