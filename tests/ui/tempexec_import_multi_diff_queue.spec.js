const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 20000 });
  return base;
}

test.describe('用例执行-多文件同名 diff 队列', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
  });

  test('多文件入库：同名按顺序弹出 diff，非同名不阻塞，最终 toast 展示成功/跳过/失败用例名', async ({ page }) => {
    const token = 'token-tempexec-import-multi-diff';
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '项目A', description: '' };
    const versions = [{ id: 11, name: 'v1' }];
    const now = new Date().toISOString();

    const existingByCleanName = {
      用例A: { id: 2001, clean: '用例A' },
      用例C: { id: 2003, clean: '用例C' },
    };
    const caseItemsByFileId = {};
    caseItemsByFileId[existingByCleanName.用例A.id] = [
      { id: 1, case_file_id: existingByCleanName.用例A.id, module: '模块A', title: '旧用例A', priority: 'P1', precondition: '', steps: '步骤1', expected: '旧预期A' },
    ];
    caseItemsByFileId[existingByCleanName.用例C.id] = [
      { id: 2, case_file_id: existingByCleanName.用例C.id, module: '模块C', title: '旧用例C', priority: 'P1', precondition: '', steps: '步骤1', expected: '旧预期C' },
    ];

    let nextCaseFileId = 3000;
    const createdCaseFiles = [];
    const importCalls = [];
    let nextExecSetId = 4000;
    const execSets = [];

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

      if (pathName === '/api/case-files' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        const files = [
          {
            id: existingByCleanName.用例A.id,
            project_id: project.id,
            version_id: versions[0].id,
            file_name_clean: existingByCleanName.用例A.clean,
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
            id: existingByCleanName.用例C.id,
            project_id: project.id,
            version_id: versions[0].id,
            file_name_clean: existingByCleanName.用例C.clean,
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
        createdCaseFiles.forEach((f) => files.push(f));
        return respond(200, files);
      }

      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const fileId = Number(itemsMatch[1]);
        return respond(200, caseItemsByFileId[fileId] || []);
      }

      if (pathName === '/api/case-files/import' && method === 'POST') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const overwrite = url.searchParams.get('overwrite') === '1';
        const bodyRaw = route.request().postData() || '{}';
        const payload = JSON.parse(bodyRaw);
        const fileName = payload && payload.file_name ? String(payload.file_name) : '';
        const clean = fileName.replace(/\.[^.]+$/, '');
        importCalls.push({ overwrite, fileName, clean });
        if (!overwrite && (clean === '用例A' || clean === '用例C')) {
          return respond(409, { detail: '同名用例已存在' });
        }
        if (!overwrite && clean === '用例B') {
          const file = {
            id: nextCaseFileId++,
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
          };
          createdCaseFiles.push(file);
          caseItemsByFileId[file.id] = (payload.items || []).map((it, idx) => ({
            id: 10000 + idx,
            case_file_id: file.id,
            module: it.module,
            title: it.title,
            expected: it.expected,
            priority: it.priority || null,
            precondition: it.precondition || null,
            steps: it.steps || null,
            remark: it.remark || null,
          }));
          return respond(201, file);
        }
        if (overwrite && clean === '用例A') {
          return respond(200, { id: existingByCleanName.用例A.id, file_name_clean: '用例A' });
        }
        return respond(200, { id: 999, file_name_clean: clean });
      }

      if (pathName === '/api/exec/sets' && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, execSets.slice());
      }

      if (pathName === '/api/exec/sets/from-case-file' && method === 'POST') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        const payload = route.request().postDataJSON();
        const now2 = new Date().toISOString();
        const hasExecVersion = Object.prototype.hasOwnProperty.call(payload || {}, 'exec_version_id');
        const set = {
          id: nextExecSetId++,
          project_id: project.id,
          version_id: hasExecVersion ? payload.exec_version_id : versions[0].id,
          case_file_id: payload.case_file_id,
          name: String(payload.case_file_id || ''),
          requirement: payload.requirement || '',
          reuse_enabled: payload.reuse_enabled ? true : false,
          reuse_presets: payload.reuse_presets || null,
          status: 'active',
          created_at: now2,
          updated_at: now2,
        };
        execSets.push(set);
        return respond(200, set);
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        if (!authed) return respond(401, { detail: 'unauthorized' });
        return respond(200, []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });

    await page.click('#openTempExecImportDrawerBtn');
    await expect(page.locator('#tempExecImportDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDrawer [data-section-id="tempexec-import"]')).toBeVisible();

    const fileA = { requirement: '需求A', cases: [{ module: '模块A', title: '新用例A', priority: 'P1', preconditions: '', steps: '步骤', expected: '新预期A' }] };
    const fileB = { requirement: '需求B', cases: [{ module: '模块B', title: '新用例B', priority: 'P1', preconditions: '', steps: '步骤', expected: '新预期B' }] };
    const fileC = { requirement: '需求C', cases: [{ module: '模块C', title: '新用例C', priority: 'P1', preconditions: '', steps: '步骤', expected: '新预期C' }] };

    await page.setInputFiles('#tempExecInput', [
      { name: '用例A.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fileA), 'utf-8') },
      { name: '用例B.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fileB), 'utf-8') },
      { name: '用例C.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fileC), 'utf-8') },
    ]);

    await page.selectOption('#tempExecImportProjectSelect', String(project.id));
    await page.selectOption('#tempExecImportVersionSelect', String(versions[0].id));
    await page.click('#tempExecImportConfirmBtn');
    await expect(page.locator('#execVersionSelectDrawer')).toHaveClass(/open/);
    await expect(page.locator('#execVersionSelectDrawerConfirmBtn')).toBeEnabled();
    await page.click('#execVersionSelectDrawerConfirmBtn');

    await expect(page.locator('#tempExecImportDiffDrawer')).toHaveClass(/open/, { timeout: 8000 });
    await expect(page.locator('#tempExecImportDiffTitle')).toContainText('用例A');

    await page.click('#tempExecImportDiffOverwriteBtn');
    await expect(page.locator('#tempExecImportDiffDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDiffTitle')).toContainText('用例C');

    await page.click('#tempExecImportDiffDrawer .drawer-header [data-drawer-close=\"tempExecImportDiffDrawer\"]', { force: true });
    await expect(page.locator('#tempExecImportDiffDrawer')).not.toHaveClass(/open/);

    const status = page.locator('#tempExecStatus');
    await expect(status).toContainText('入库完成', { timeout: 8000 });
    await expect(status).toContainText('用例B');
    await expect(status).toContainText('覆盖导入成功');
    await expect(status).toContainText('用例A');
    await expect(status).toContainText('跳过 - 用例C');

    await expect(page.locator('.temp-center-toast')).toContainText('入库完成');

    expect(importCalls.map((c) => `${c.overwrite ? 'overwrite' : 'new'}:${c.fileName}`)).toEqual([
      'new:用例B.json',
      'overwrite:用例A.json',
    ]);
  });
});
