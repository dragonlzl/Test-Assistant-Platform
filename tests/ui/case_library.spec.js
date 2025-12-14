const path = require('path');
const { test, expect } = require('@playwright/test');

test.describe('用例库页面（导入/编辑/转到执行）', () => {
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
    });
  });

  test('导入 -> 同名校验 -> 编辑视图 -> 转到执行（同名覆盖并保留结果）', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '战魂铭人', description: '用于用例库' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];

    let nextCaseFileId = 100;
    let nextCaseItemId = 1000;
    const caseFiles = [];
    const caseItemsByFileId = {};
    let nextExecSetId = 2000;
    let nextExecCaseId = 3000;
    const execSets = [];
    const execCasesBySetId = {};

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions`) return respond(200, versions);

      if (pathName === '/api/case-files' && method === 'GET') {
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        return respond(200, caseFiles.slice().sort((a, b) => b.id - a.id));
      }

      if (pathName === '/api/case-files/import' && method === 'POST') {
        const payload = route.request().postDataJSON();
        if (payload.project_id !== project.id) return respond(400, { detail: 'bad project' });
        if (payload.version_id !== versions[0].id) return respond(400, { detail: 'bad version' });
        const fileName = payload.file_name || '';
        const base = String(fileName).split(/[\\/]/).pop();
        let clean = base.replace(/\.[^.]+$/, '');
        const tsPattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
        while (tsPattern.test(clean)) clean = clean.replace(tsPattern, '');
        clean = clean.replace(/^勾选用例[-_ ]*/i, '').trim();
        if (caseFiles.some((f) => f.file_name_clean === clean && String(f.version_id || '') === String(payload.version_id || ''))) {
          return respond(400, { detail: '同名用例已存在' });
        }
        const id = nextCaseFileId++;
        const now = new Date().toISOString();
        const file = {
          id,
          project_id: payload.project_id,
          version_id: payload.version_id,
          file_name_clean: clean,
          importer_id: user.id,
          importer_name: user.username,
          imported_at: now,
          updated_at: now,
          last_updated_by: user.id,
          last_updated_by_name: user.username,
        };
        caseFiles.push(file);
        caseItemsByFileId[id] = (payload.items || []).map((it) => ({
          id: nextCaseItemId++,
          case_file_id: id,
          module: it.module,
          title: it.title,
          expected: it.expected,
          priority: it.priority || null,
          precondition: it.precondition || null,
          steps: it.steps || null,
          remark: it.remark || null,
          created_at: now,
          updated_at: now,
        }));
        return respond(201, file);
      }

      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        const fileId = Number(itemsMatch[1]);
        return respond(200, caseItemsByFileId[fileId] || []);
      }

      const itemPatchMatch = pathName.match(/^\/api\/case-files\/items\/(\d+)$/);
      if (itemPatchMatch && method === 'PATCH') {
        const itemId = Number(itemPatchMatch[1]);
        const payload = route.request().postDataJSON();
        let found = null;
        Object.keys(caseItemsByFileId).forEach((fileId) => {
          const list = caseItemsByFileId[fileId] || [];
          const idx = list.findIndex((it) => it.id === itemId);
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
            found = list[idx];
          }
        });
        if (!found) return respond(404, { detail: 'not found' });
        // 同步文件更新时间/更新人（用于列表展示）
        const fileId = Number(found.case_file_id);
        const file = caseFiles.find((f) => f.id === fileId);
        if (file) {
          file.updated_at = found.updated_at;
          file.last_updated_by = user.id;
          file.last_updated_by_name = user.username;
        }
        return respond(200, found);
      }

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const pid = url.searchParams.get('project_id');
        let list = execSets.slice();
        if (pid) list = list.filter((s) => String(s.project_id) === String(pid));
        list.sort((a, b) => b.id - a.id);
        return respond(200, list);
      }

      if (pathName === '/api/exec/sets/from-case-file' && method === 'POST') {
        const body = route.request().postDataJSON() || {};
        const caseFileId = Number(body.case_file_id);
        const caseFile = caseFiles.find((f) => f.id === caseFileId);
        if (!caseFile) return respond(404, { detail: '用例文件不存在' });
        const now = new Date().toISOString();
        let execSet = execSets
          .filter((s) => s && Number(s.case_file_id) === caseFileId)
          .sort((a, b) => b.id - a.id)[0];
        if (!execSet) {
          execSet = {
            id: nextExecSetId++,
            project_id: caseFile.project_id,
            version_id: caseFile.version_id,
            case_file_id: caseFileId,
            name: caseFile.file_name_clean,
            requirement: body.requirement || null,
            reuse_enabled: body.reuse_enabled === true,
            reuse_presets: body.reuse_presets || null,
            status: 'active',
            created_at: now,
            updated_at: now,
          };
          execSets.push(execSet);
          execCasesBySetId[execSet.id] = [];
        } else {
          execSet.status = 'active';
          execSet.updated_at = now;
        }

        const existingCases = execCasesBySetId[execSet.id] || [];
        const existingByItemId = new Map(existingCases.map((c) => [c.case_item_id, c]));
        const items = caseItemsByFileId[caseFileId] || [];
        const importMap = new Map();
        if (body.prefer_result_source === 'import' && Array.isArray(body.import_cases)) {
          body.import_cases.forEach((row) => {
            if (!row) return;
            const k = [row.module, row.title, row.expected].map((v) => String(v || '').trim().toLowerCase()).join('::');
            importMap.set(k, row);
          });
        }
        const nextCases = items.map((it, idx) => {
          let c = existingByItemId.get(it.id);
          if (!c) {
            c = {
              id: nextExecCaseId++,
              exec_set_id: execSet.id,
              case_item_id: it.id,
              module: it.module,
              title: it.title,
              expected: it.expected,
              priority: it.priority || null,
              precondition: it.precondition || null,
              steps: it.steps || null,
              remark: it.remark || null,
              reuse_details: null,
              defect_links: null,
              status: '未执行',
              order_no: idx + 1,
              executor_id: user.id,
              created_at: now,
              updated_at: now,
            };
          } else {
            c.module = it.module;
            c.title = it.title;
            c.expected = it.expected;
            c.priority = it.priority || null;
            c.precondition = it.precondition || null;
            c.steps = it.steps || null;
            c.order_no = idx + 1;
            c.updated_at = now;
          }
          const key = [c.module, c.title, c.expected].map((v) => String(v || '').trim().toLowerCase()).join('::');
          const imported = importMap.get(key);
          if (imported) {
            if (imported.status !== undefined) c.status = imported.status;
            if (imported.remark !== undefined) c.remark = imported.remark;
            if (imported.reuse_details !== undefined) c.reuse_details = imported.reuse_details;
            if (imported.defect_links !== undefined) c.defect_links = imported.defect_links;
          }
          return c;
        });
        execCasesBySetId[execSet.id] = nextCases;
        return respond(200, execSet);
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const execSetId = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[execSetId] || []);
      }

      const execCasePatchMatch = pathName.match(/^\/api\/exec\/cases\/(\d+)$/);
      if (execCasePatchMatch && method === 'PATCH') {
        const caseId = Number(execCasePatchMatch[1]);
        const payload = route.request().postDataJSON() || {};
        let found = null;
        Object.keys(execCasesBySetId).forEach((sid) => {
          const list = execCasesBySetId[sid] || [];
          const idx = list.findIndex((c) => c.id === caseId);
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
            found = list[idx];
          }
        });
        if (!found) return respond(404, { detail: 'not found' });
        return respond(200, found);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.caseLibraryBound === true, { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="case-library"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });

    await expect(page.locator('#flowNav')).toBeHidden();
    await expect(page.locator('#caseLibraryHead')).toBeVisible();

    const fixturePath = path.join(__dirname, '..', 'fixtures', 'case_library_import.json');
    await page.click('#openCaseLibraryImportDrawerBtn');
    await expect(page.locator('#caseLibraryImportDrawer')).toHaveClass(/open/);

    await expect(page.locator('#caseLibraryImportConfirmBtn')).toBeDisabled();
    await page.setInputFiles('#caseLibraryImportInput', fixturePath);
    await page.selectOption('#caseLibraryImportProjectSelect', String(project.id));
    await expect(page.locator('#caseLibraryImportVersionSelect')).toBeEnabled();
    await page.selectOption('#caseLibraryImportVersionSelect', String(versions[0].id));
    await expect(page.locator('#caseLibraryImportConfirmBtn')).toBeEnabled();
    await page.click('#caseLibraryImportConfirmBtn');
    await expect(page.locator('#caseLibraryImportStatus')).toContainText('导入完成');
    await expect(page.locator('#caseLibraryStatus')).toContainText('导入完成');

    // 同名校验：再次导入同一份文件
    await page.click('#caseLibraryImportConfirmBtn');
    await expect(page.locator('#caseLibraryImportStatus')).toContainText('同名用例已存在');

    // 关闭导入抽屉再进入编辑抽屉，避免遮罩拦截点击
    await page.click('#caseLibraryImportDrawer .ghost-btn[data-drawer-close="caseLibraryImportDrawer"]');
    await expect(page.locator('#caseLibraryImportDrawer')).not.toHaveClass(/open/);

    await page.click('#openCaseLibraryEditDrawerBtn');
    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await page.click('#caseLibraryEditConfirmBtn');
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('case_library_import');
    await page.click('#caseLibraryEditListBody [data-case-lib-edit]');

    await expect(page.locator('#caseLibraryEditDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录');

    await page.locator('#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="0"]').click();
    await page.locator('#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="0"]').fill('正常登录（已更新）');
    await page.click('#caseLibraryEditClearSearchBtn');
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录（已更新）');

    // 先转到执行，给执行页写入结果，再回到用例库进行同名覆盖
    await page.click('#caseLibraryEditToExecBtn');
    await expect(page.locator('#tempexecFlowNav')).toBeVisible();
    await page.waitForFunction(() => {
      var st = window.app && window.app.state ? window.app.state : null;
      if (!st || !Array.isArray(st.tempExecFiles)) return false;
      return st.tempExecFiles.some((f) => (f && f.name) === 'case_library_import');
    });

    await page.click('#openTempExecViewNavBtn');
    const firstCasePatch = page.waitForResponse((res) => {
      return res.url().includes('/api/exec/cases/') && res.request().method() === 'PATCH';
    });
    const firstStatus = page.locator('#tempExecView select[data-temp-result]').first();
    await firstStatus.selectOption('通过');
    await page.locator('#tempExecView button[data-temp-remark-toggle]').first().click();
    const remark = page.locator('#tempExecView textarea[data-temp-remark]').first();
    await remark.fill('执行备注');
    await page.locator('#tempExecView button[data-temp-defect-toggle]').first().click();
    await page.locator('#tempExecView button[data-temp-defect-add]').first().click();
    const defectInput = page.locator('#tempExecView input[data-temp-defect-link]').first();
    await defectInput.fill('http://example.com/bug');
    await firstCasePatch;
    await page.waitForTimeout(600);

    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });
    page.on('dialog', async (dialog) => dialog.accept());
    await page.click('#caseLibraryEditToExecBtn');
    await expect(page.locator('#tempexecFlowNav')).toBeVisible();
    await expect(page.locator('#tempExecView')).toContainText('正常登录');
    await expect(page.locator('#tempExecView select.status-select[data-status="通过"]')).toHaveCount(1);
  });
});
