const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

async function openArchiveDrawer(page) {
  await page.click('[data-group="cases"]');
  await page.click('[data-tab-btn="case-archive"]');
  await page.click('#openCaseArchiveDrawerBtn');
  await expect(page.locator('#caseArchiveDrawer')).toHaveClass(/open/);
}

test.describe('归档恢复按钮', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('非组长点击恢复提示联系组长或管理员', async ({ page }) => {
    const token = 'token-archive-restore-member';
    const user = { id: 1, username: 'member_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const execSetId = 101;
    let restoreCalled = false;

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/archives' && method === 'GET') {
        return respond(200, [{
          exec_set_id: execSetId,
          project_id: project.id,
          project_name: project.name,
          version_id: versions[0].id,
          version_name: versions[0].name,
          name: '用例归档A',
          case_count: 2,
          reuse_enabled: false,
          rearchive_count: 0,
          archive_state: 'archived',
          imported_by: user.id,
          imported_by_name: user.username,
          imported_at: new Date().toISOString(),
          archived_by: user.id,
          archived_by_name: user.username,
          archived_at: new Date().toISOString(),
          archived_reason: '',
        }]);
      }
      if (pathName === `/api/exec/archives/${execSetId}/restore` && method === 'POST') {
        restoreCalled = true;
        return respond(200, { archive_exec_set_id: execSetId, restored_exec_set_id: 201, version_box_existed: false });
      }
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await openArchiveDrawer(page);

    await page.waitForSelector('[data-case-archive-action="restore"]');
    await page.click('[data-case-archive-action="restore"]');
    await expect(page.locator('.temp-center-toast')).toContainText('恢复请联系 组长 或 管理员！！', { timeout: 3000 });
    expect(restoreCalled).toBeFalsy();
  });

  test('组长可恢复并显示新建版本盒子提示', async ({ page }) => {
    const token = 'token-archive-restore-leader';
    const user = { id: 2, username: 'leader_user', role: 'user', level: 'leader' };
    const project = { id: 2, name: '项目B', description: '' };
    const versions = [{ id: 21, name: 'v2' }];
    const execSetId = 202;
    let restoreCalled = false;
    let archiveState = 'archived';

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/archives' && method === 'GET') {
        return respond(200, [{
          exec_set_id: execSetId,
          project_id: project.id,
          project_name: project.name,
          version_id: versions[0].id,
          version_name: versions[0].name,
          name: '用例归档B',
          case_count: 1,
          reuse_enabled: false,
          rearchive_count: 0,
          archive_state: archiveState,
          imported_by: user.id,
          imported_by_name: user.username,
          imported_at: new Date().toISOString(),
          archived_by: user.id,
          archived_by_name: user.username,
          archived_at: new Date().toISOString(),
          archived_reason: '',
        }]);
      }
      if (pathName === `/api/exec/archives/${execSetId}/restore` && method === 'POST') {
        restoreCalled = true;
        archiveState = 'rerun';
        return respond(200, {
          archive_exec_set_id: execSetId,
          restored_exec_set_id: 303,
          version_box_existed: false,
          version_name: versions[0].name,
        });
      }
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await openArchiveDrawer(page);

    await page.waitForSelector('[data-case-archive-action="restore"]');
    await page.click('[data-case-archive-action="restore"]');
    const drawer = page.locator('#appConfirmDrawer');
    await expect(drawer).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(drawer).not.toHaveClass(/open/);

    await expect(page.locator('.temp-center-toast')).toContainText('已恢复并新建版本盒子', { timeout: 3000 });
    expect(restoreCalled).toBeTruthy();
  });

  test('非组长遇到同名执行用例时提示无法恢复', async ({ page }) => {
    const token = 'token-archive-restore-member-dup';
    const user = { id: 3, username: 'member_dup', role: 'user', level: 'member' };
    const project = { id: 3, name: '项目C', description: '' };
    const versions = [{ id: 31, name: 'v3' }];
    const execSetId = 303;
    let restoreCalled = false;

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/archives' && method === 'GET') {
        return respond(200, [{
          exec_set_id: execSetId,
          project_id: project.id,
          project_name: project.name,
          version_id: versions[0].id,
          version_name: versions[0].name,
          name: '用例归档C',
          case_count: 2,
          reuse_enabled: false,
          rearchive_count: 0,
          archive_state: 'archived',
          imported_by: user.id,
          imported_by_name: user.username,
          imported_at: new Date().toISOString(),
          archived_by: user.id,
          archived_by_name: user.username,
          archived_at: new Date().toISOString(),
          archived_reason: '',
        }]);
      }
      if (pathName === '/api/exec/sets' && method === 'GET') {
        return respond(200, [{
          id: 404,
          project_id: project.id,
          version_id: versions[0].id,
          source: 'apitest',
          case_file_id: 999,
          name: '用例归档C',
          requirement: '',
          reuse_enabled: false,
          reuse_presets: [],
          case_count: 2,
          status: 'active',
          restored_from_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      }
      if (pathName === `/api/exec/archives/${execSetId}/restore` && method === 'POST') {
        restoreCalled = true;
        return respond(200, { archive_exec_set_id: execSetId, restored_exec_set_id: 505, version_box_existed: true });
      }
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await openArchiveDrawer(page);

    await page.waitForSelector('[data-case-archive-action="restore"]');
    await page.click('[data-case-archive-action="restore"]');
    await expect(page.locator('.temp-center-toast')).toContainText('执行页面已有相同执行用例，无法恢复。如需恢复，请先解散或者归档当前执行的同名用例', { timeout: 3000 });
    expect(restoreCalled).toBeFalsy();
  });

  test('组长恢复遇到同名执行用例时提示无法恢复', async ({ page }) => {
    const token = 'token-archive-restore-leader-dup';
    const user = { id: 4, username: 'leader_dup', role: 'user', level: 'leader' };
    const project = { id: 4, name: '项目D', description: '' };
    const versions = [{ id: 41, name: 'v4' }];
    const execSetId = 404;

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/archives' && method === 'GET') {
        return respond(200, [{
          exec_set_id: execSetId,
          project_id: project.id,
          project_name: project.name,
          version_id: versions[0].id,
          version_name: versions[0].name,
          name: '用例归档D',
          case_count: 1,
          reuse_enabled: false,
          rearchive_count: 0,
          archive_state: 'archived',
          imported_by: 99,
          imported_by_name: 'member_owner',
          imported_at: new Date().toISOString(),
          archived_by: 99,
          archived_by_name: 'member_owner',
          archived_at: new Date().toISOString(),
          archived_reason: '',
        }]);
      }
      if (pathName === `/api/exec/archives/${execSetId}/restore` && method === 'POST') {
        return respond(400, { detail: { code: 'exec_set_duplicate', detail: '已有同名执行用例' } });
      }
      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await openArchiveDrawer(page);

    await page.waitForSelector('[data-case-archive-action="restore"]');
    await page.click('[data-case-archive-action="restore"]');
    const drawer = page.locator('#appConfirmDrawer');
    await expect(drawer).toHaveClass(/open/);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('.temp-center-toast')).toContainText('该人员在执行页面已有相同执行用例。如需恢复，请先解散或者归档当前执行的同名用例。', { timeout: 3000 });
  });
});
