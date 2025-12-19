const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
}

async function switchToTempExec(page) {
  await page.click('[data-group="cases"]');
  await page.click('[data-tab-btn="tempexec"]');
  await page.click('#openTempExecAssignDrawerBtn');
  await expect(page.locator('#tempExecAssignDrawer')).toHaveClass(/open/);
}

function buildApiRouter(options) {
  const opts = options || {};
  const user = opts.user || { id: 1, username: 'ui_user', role: 'user', level: 'member' };
  const project = opts.project || { id: 1, name: '项目A', description: '' };
  const versions = opts.versions || [{ id: 11, name: 'v1' }];
  const activeSets = Array.isArray(opts.activeSets) ? opts.activeSets : [];
  const archivedSets = Array.isArray(opts.archivedSets) ? opts.archivedSets : [];
  const casesBySetId = opts.casesBySetId && typeof opts.casesBySetId === 'object' ? opts.casesBySetId : {};
  const uiSettings = opts.uiSettings || null;

  return async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;
    const method = route.request().method();
    const respond = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
    if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
    if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);

    if (pathName === '/api/settings' && method === 'GET') {
      if (!uiSettings) return respond(200, []);
      return respond(200, [{ key: 'tempexec_ui_v1', value_json: uiSettings }]);
    }
    if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);

    if (pathName === '/api/models' && method === 'GET') return respond(200, []);
    if (pathName === '/api/features' && method === 'GET') return respond(200, []);
    if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
    if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

    if (pathName === '/api/exec/sets' && method === 'GET') {
      const statusFilter = url.searchParams.get('status_filter') || '';
      if (statusFilter === 'archived') return respond(200, archivedSets.slice());
      return respond(200, activeSets.slice());
    }

    const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
    if (casesMatch && method === 'GET') {
      const execSetId = Number(casesMatch[1]);
      return respond(200, casesBySetId[execSetId] || []);
    }

    if (pathName === '/api/auth/logout') return respond(200, {});
    if (pathName.startsWith('/api/')) return respond(200, []);
    return respond(404, { detail: 'not found' });
  };
}

test.describe('用例执行-归档占位与解散归档', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
      try {
        localStorage.removeItem('usecase-active-tab');
        localStorage.removeItem('usecase-temp-exec-v1');
        localStorage.removeItem('tempexec-focus-v1');
      } catch (_) {}
    });
    page.on('dialog', async (dialog) => dialog.accept());
  });

  test('版本盒子仅剩归档占位时仍可见，点击“解散归档”清除占位', async ({ page }) => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const archivedSets = [
      { id: 9001, project_id: project.id, version_id: versions[0].id, case_file_id: 100, case_count: 1, name: '归档用例1', status: 'archived', created_at: iso(now - 100000), updated_at: iso(now - 90000), archived_at: iso(now - 80000) },
      { id: 9002, project_id: project.id, version_id: versions[0].id, case_file_id: 101, case_count: 2, name: '归档用例2', status: 'archived', created_at: iso(now - 90000), updated_at: iso(now - 80000), archived_at: iso(now - 70000) },
    ];

    await page.route('**/api/**', buildApiRouter({ project, versions, activeSets: [], archivedSets }));
    await gotoIndex(page);
    await switchToTempExec(page);

    await page.waitForFunction(() => {
      const grid = document.getElementById('tempVersionGrid');
      if (!grid) return false;
      return grid.querySelectorAll('.temp-project-version').length >= 1;
    });

    const v1Card = page.locator('#tempVersionGrid .temp-project-version', { hasText: 'v1' }).first();
    await expect(v1Card.locator('.archived-dissolve')).toBeVisible();
    await expect(v1Card.locator('.temp-req-row.archived')).toHaveCount(2);
    await expect(v1Card.locator('.temp-req-row.archived .temp-archived-mask')).toHaveCount(2);
    await expect(v1Card.locator('.temp-req-row.archived .temp-archived-mask')).toHaveText(['已归档', '已归档']);

    const draggableAttr = await v1Card.locator('.temp-req-row.archived').first().getAttribute('draggable');
    expect(String(draggableAttr || '')).toBe('false');

    await v1Card.locator('.archived-dissolve').click();
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    const dissolveMsg = await page.locator('#appConfirmDrawerMessage').innerText();
    expect(dissolveMsg).toContain('确定解散版本【v1】吗？版本包括待解散用例');
    expect(dissolveMsg).toContain('归档用例1');
    expect(dissolveMsg).toContain('归档用例2');
    expect(dissolveMsg.indexOf('\n')).toBe(-1);
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('#tempVersionGrid .temp-req-row.archived')).toHaveCount(0);
    await expect(page.locator('#tempVersionGrid .archived-dissolve')).toHaveCount(0);
    await expect(page.locator('#tempVersionGrid .temp-project-version', { hasText: 'v1' })).toHaveCount(0);

    await expect.poll(
      () =>
        page.evaluate(() => {
          const st = window.app && window.app.state ? window.app.state : null;
          if (!st) return { hidden: [], archived: [] };
          return { hidden: st.tempExecArchivedHidden || [], archived: st.tempExecArchivedFiles || [] };
        }),
      { timeout: 5000 }
    ).toMatchObject({ archived: [] });
  });

  test('归档占位固定在底部按最近归档倒序，拖拽指示器不插到归档下方', async ({ page }) => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const project = { id: 2, name: '项目B', description: '' };
    const versions = [{ id: 21, name: 'v2' }];
    const activeSets = [
      { id: 1001, project_id: project.id, version_id: versions[0].id, case_file_id: 201, case_count: 1, name: '活动用例A', status: 'active', created_at: iso(now - 120000), updated_at: iso(now - 110000) },
      { id: 1002, project_id: project.id, version_id: versions[0].id, case_file_id: 202, case_count: 1, name: '活动用例B', status: 'active', created_at: iso(now - 100000), updated_at: iso(now - 90000) },
    ];
    const archivedSets = [
      { id: 2001, project_id: project.id, version_id: versions[0].id, case_file_id: 301, case_count: 1, name: '归档用例旧', status: 'archived', created_at: iso(now - 90000), updated_at: iso(now - 80000), archived_at: iso(now - 70000) },
      { id: 2002, project_id: project.id, version_id: versions[0].id, case_file_id: 302, case_count: 1, name: '归档用例新', status: 'archived', created_at: iso(now - 80000), updated_at: iso(now - 70000), archived_at: iso(now - 1000) },
    ];

    await page.route('**/api/**', buildApiRouter({ project, versions, activeSets, archivedSets }));
    await gotoIndex(page);
    await switchToTempExec(page);

    const v2Card = page.locator('#tempVersionGrid .temp-project-version', { hasText: 'v2' }).first();
    const v2Body = v2Card.locator('.temp-project-version-body');
    await expect(v2Card.locator('.temp-req-row[data-temp-file]')).toHaveCount(4);

    const names = await v2Card.locator('.temp-req-row[data-temp-file] .name-text').allTextContents();
    const trimmed = names.map((t) => (t || '').trim());
    expect(trimmed.slice(-2)).toEqual(['归档用例新', '归档用例旧']);

    const dragHints = await v2Body.evaluate((el) => {
      try {
        if (typeof DataTransfer !== 'function' || typeof DragEvent !== 'function') return { ok: false, reason: 'no-dnd' };
        var dt = new DataTransfer();
        dt.setData('text/plain', '1002');
        var rect = el.getBoundingClientRect();
        var evt = new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          clientX: Math.floor(rect.left + 10),
          clientY: Math.floor(rect.bottom - 2),
          dataTransfer: dt,
        });
        el.dispatchEvent(evt);
        var indicator = el.querySelector('.temp-file-drop-indicator');
        var firstArchived = el.querySelector('.temp-req-row[data-temp-archived="1"]');
        return {
          ok: true,
          hasIndicator: Boolean(indicator),
          indicatorBeforeArchived: Boolean(indicator && firstArchived && indicator.nextElementSibling === firstArchived),
        };
      } catch (err) {
        return { ok: false, reason: String(err && err.message ? err.message : err) };
      }
    });
    expect(dragHints.ok).toBe(true);
    expect(dragHints.hasIndicator).toBe(true);
    expect(dragHints.indicatorBeforeArchived).toBe(true);
  });

  test('关闭版本时提示并同步解散归档占位', async ({ page }) => {
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const project = { id: 3, name: '项目C', description: '' };
    const versions = [{ id: 31, name: 'v3' }];
    const activeSets = [
      { id: 3001, project_id: project.id, version_id: versions[0].id, case_file_id: 401, case_count: 1, name: '活动用例C', status: 'active', created_at: iso(now - 120000), updated_at: iso(now - 110000) },
    ];
    const archivedSets = [
      { id: 3002, project_id: project.id, version_id: versions[0].id, case_file_id: 402, case_count: 1, name: '归档用例C', status: 'archived', created_at: iso(now - 100000), updated_at: iso(now - 90000), archived_at: iso(now - 80000) },
    ];

    let lastConfirm = '';
    page.removeAllListeners('dialog');
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') lastConfirm = dialog.message();
      await dialog.accept();
    });

    await page.route('**/api/**', buildApiRouter({ project, versions, activeSets, archivedSets }));
    await gotoIndex(page);
    await switchToTempExec(page);

    const v3Card = page.locator('#tempVersionGrid .temp-project-version', { hasText: 'v3' }).first();
    await expect(v3Card.locator('.archived-dissolve')).toBeVisible();
    await expect(v3Card.locator('.temp-req-row.archived')).toHaveCount(1);

    await v3Card.locator('[data-temp-project-version-remove]').click();
    expect(lastConfirm.indexOf('解散归档') !== -1).toBe(true);
    await expect(page.locator('#tempVersionGrid .temp-project-version', { hasText: 'v3' })).toHaveCount(0);

    await expect.poll(
      () =>
        page.evaluate(() => {
          const st = window.app && window.app.state ? window.app.state : null;
          if (!st) return { active: [], archived: [], hidden: [] };
          return {
            active: st.tempExecFiles || [],
            archived: st.tempExecArchivedFiles || [],
            hidden: st.tempExecArchivedHidden || [],
          };
        }),
      { timeout: 5000 }
    ).toMatchObject({ active: [], archived: [] });
  });
});
