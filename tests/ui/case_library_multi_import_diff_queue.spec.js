const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

test.describe('用例库导入-多文件同名 diff 队列', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('多文件导入：多份同名按顺序弹出 diff，非同名不阻塞，最终提示展示具体用例名', async ({ page }) => {
    const token = 'token-case-library-import-multi-diff';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const existingByCleanName = {
      '用例A': { id: 2001, clean: '用例A' },
      '用例C': { id: 2003, clean: '用例C' },
    };

    const existingItemsById = {};
    existingItemsById[existingByCleanName['用例A'].id] = [
      { id: 1, case_file_id: existingByCleanName['用例A'].id, module: '模块A', title: '旧用例A', priority: 'P1', precondition: '', steps: '步骤1', expected: '旧预期A' },
    ];
    existingItemsById[existingByCleanName['用例C'].id] = [
      { id: 2, case_file_id: existingByCleanName['用例C'].id, module: '模块C', title: '旧用例C', priority: 'P1', precondition: '', steps: '步骤1', expected: '旧预期C' },
    ];

    const importCalls = [];
    let importedB = false;

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

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

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/layout' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets/by-case-file' && method === 'GET') return respond(200, []);

      if (pathName === '/api/case-files' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        const files = [
          {
            id: existingByCleanName['用例A'].id,
            project_id: project.id,
            version_id: versions[0].id,
            file_name_clean: existingByCleanName['用例A'].clean,
            reuse_enabled: false,
            item_count: 1,
            importer_id: user.id,
            importer_name: user.username,
            imported_at: now,
            updated_at: now,
            last_updated_by: user.id,
            last_updated_by_name: user.username,
          },
          {
            id: existingByCleanName['用例C'].id,
            project_id: project.id,
            version_id: versions[0].id,
            file_name_clean: existingByCleanName['用例C'].clean,
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
        if (importedB) {
          files.push({
            id: 2002,
            project_id: project.id,
            version_id: versions[0].id,
            file_name_clean: '用例B',
            reuse_enabled: false,
            item_count: 1,
            importer_id: user.id,
            importer_name: user.username,
            imported_at: now,
            updated_at: now,
            last_updated_by: user.id,
            last_updated_by_name: user.username,
          });
        }
        return respond(200, files);
      }

      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const id = Number(itemsMatch[1]);
        return respond(200, (existingItemsById[id] || []).slice());
      }

      if (pathName === '/api/case-files/import' && method === 'POST') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const overwrite = url.searchParams.get('overwrite') === '1';
        const bodyRaw = route.request().postData() || '{}';
        const payload = JSON.parse(bodyRaw);
        const fileName = payload && payload.file_name ? String(payload.file_name) : '';
        const clean = fileName.replace(/\.[^.]+$/, '');
        importCalls.push({ overwrite, fileName: fileName, clean: clean });
        if (!overwrite && (clean === '用例A' || clean === '用例C')) {
          const existing = existingByCleanName[clean];
          return respond(409, {
            detail: '同名用例已存在',
            existing_case_file_id: existing.id,
            existing_file_name_clean: existing.clean,
            existing_version_id: versions[0].id,
          });
        }
        if (!overwrite && clean === '用例B') importedB = true;
        return respond(200, { id: 999, file_name_clean: clean });
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await switchToTab(page, 'case-library');
    await expect(page.locator('#caseLibraryHead')).toBeVisible();

    await page.click('#openCaseLibraryImportDrawerBtn');
    await expect(page.locator('#caseLibraryImportDrawer')).toHaveClass(/open/);

    const fileA = [
      { module: '模块A', title: '新用例A', priority: 'P1', preconditions: '前置条件', steps: '1. 步骤', expected: '新预期A', remark: '' },
    ];
    const fileB = [
      { module: '模块B', title: '新用例B', priority: 'P1', preconditions: '前置条件', steps: '1. 步骤', expected: '新预期B', remark: '' },
    ];
    const fileC = [
      { module: '模块C', title: '新用例C', priority: 'P1', preconditions: '前置条件', steps: '1. 步骤', expected: '新预期C', remark: '' },
    ];

    await page.setInputFiles('#caseLibraryImportInput', [
      { name: '用例A.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fileA), 'utf-8') },
      { name: '用例B.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fileB), 'utf-8') },
      { name: '用例C.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fileC), 'utf-8') },
    ]);

    await page.selectOption('#caseLibraryImportProjectSelect', String(project.id));
    await page.selectOption('#caseLibraryImportVersionSelect', String(versions[0].id));
    await page.click('#caseLibraryImportConfirmBtn');

    await expect(page.locator('#caseLibraryImportDiffDrawer')).toHaveClass(/open/, { timeout: 8000 });
    await expect(page.locator('#caseLibraryImportDiffTitle')).toContainText('用例A');

    expect(importCalls.map((c) => c.fileName)).toEqual(['用例A.json', '用例B.json', '用例C.json']);

    await page.click('#caseLibraryImportDiffOverwriteBtn');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('覆盖导入用例');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect(page.locator('#caseLibraryImportDiffDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryImportDiffTitle')).toContainText('用例C');

    await page.click('#caseLibraryImportDiffDrawer .drawer-header [data-drawer-close="caseLibraryImportDiffDrawer"]', { force: true });
    await expect(page.locator('#caseLibraryImportDiffDrawer')).not.toHaveClass(/open/);

    const status = page.locator('#caseLibraryImportStatus');
    await expect(status).toContainText('导入完成', { timeout: 8000 });
    await expect(status).toContainText('用例B');
    await expect(status).toContainText('覆盖');
    await expect(status).toContainText('用例A');
    await expect(status).toContainText('跳过 - 用例C');

    expect(importCalls.map((c) => `${c.overwrite ? 'overwrite' : 'new'}:${c.fileName}`)).toEqual([
      'new:用例A.json',
      'new:用例B.json',
      'new:用例C.json',
      'overwrite:用例A.json',
    ]);
  });
});
