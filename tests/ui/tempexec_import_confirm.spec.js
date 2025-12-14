const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

test.describe('用例执行-导入需确认入库', () => {
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

  test('选择文件后必须选项目/版本才能确认入库', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '最长项目名六个字', description: 'for tempexec import' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];

    let nextCaseFileId = 100;
    let nextCaseItemId = 1000;
    const caseFiles = [];
    const caseItemsByFileId = {};
    let nextExecSetId = 2000;
    let nextExecCaseId = 3000;
    const execSets = [];
    const execCasesBySetId = {};

    function normalizeCleanName(fileName) {
      const base = String(fileName || '').split(/[\\/]/).pop();
      let clean = String(base || '').replace(/\.[^.]+$/, '');
      const tsPattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
      while (tsPattern.test(clean)) clean = clean.replace(tsPattern, '');
      clean = clean.replace(/^勾选用例[-_ ]*/i, '').trim();
      return clean || 'case';
    }

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/case-files' && method === 'GET') {
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        return respond(200, caseFiles.slice().sort((a, b) => b.id - a.id));
      }

      if (pathName === '/api/case-files/import' && method === 'POST') {
        const payload = route.request().postDataJSON();
        if (payload.project_id !== project.id) return respond(400, { detail: 'bad project' });
        if (!payload.version_id) return respond(400, { detail: 'bad version' });
        const cleanName = normalizeCleanName(payload.file_name || '');
        if (caseFiles.some((f) => f.file_name_clean === cleanName && String(f.version_id || '') === String(payload.version_id || ''))) {
          return respond(400, { detail: '同名用例已存在' });
        }
        const now = new Date().toISOString();
        const file = {
          id: nextCaseFileId++,
          project_id: payload.project_id,
          version_id: payload.version_id,
          file_name_clean: cleanName,
          importer_id: user.id,
          importer_name: user.username,
          imported_at: now,
          updated_at: now,
          last_updated_by: user.id,
          last_updated_by_name: user.username,
        };
        caseFiles.push(file);
        caseItemsByFileId[file.id] = (payload.items || []).map((it) => ({
          id: nextCaseItemId++,
          case_file_id: file.id,
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

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const pid = url.searchParams.get('project_id');
        const list = pid ? execSets.filter((s) => String(s.project_id) === String(pid)) : execSets.slice();
        return respond(200, list.slice().sort((a, b) => b.id - a.id));
      }

      if (pathName === '/api/exec/sets/from-case-file' && method === 'POST') {
        const payload = route.request().postDataJSON();
        const caseFileId = Number(payload.case_file_id);
        const cf = caseFiles.find((f) => f.id === caseFileId);
        if (!cf) return respond(404, { detail: 'case file not found' });

        let execSet = execSets.find((s) => s.case_file_id === caseFileId) || null;
        const now = new Date().toISOString();
        if (!execSet) {
          execSet = {
            id: nextExecSetId++,
            project_id: cf.project_id,
            version_id: cf.version_id,
            case_file_id: cf.id,
            name: cf.file_name_clean,
            requirement: payload.requirement || '',
            reuse_enabled: payload.reuse_enabled ? true : false,
            reuse_presets: payload.reuse_presets || null,
            status: 'active',
            created_at: now,
            updated_at: now,
          };
          execSets.push(execSet);
        } else {
          execSet.status = 'active';
          execSet.updated_at = now;
        }
        const items = caseItemsByFileId[caseFileId] || [];
        const prev = execCasesBySetId[execSet.id] || [];
        const prevByItemId = new Map(prev.filter((c) => c && c.case_item_id).map((c) => [c.case_item_id, c]));
        const rebuilt = items.map((it, idx) => {
          const existed = prevByItemId.get(it.id);
          return {
            id: existed ? existed.id : nextExecCaseId++,
            exec_set_id: execSet.id,
            case_item_id: it.id,
            module: it.module,
            title: it.title,
            expected: it.expected,
            priority: it.priority,
            precondition: it.precondition,
            steps: it.steps,
            actual_result: null,
            defect_link: null,
            reuse_details: (existed && existed.reuse_details) ? existed.reuse_details : [],
            defect_links: (existed && existed.defect_links) ? existed.defect_links : [],
            remark: existed ? existed.remark : (it.remark || ''),
            status: existed ? existed.status : '未执行',
            order_no: idx + 1,
            executor_id: user.id,
            created_at: existed ? existed.created_at : now,
            updated_at: now,
          };
        });
        execCasesBySetId[execSet.id] = rebuilt;
        return respond(200, execSet);
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const setId = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[setId] || []);
      }

      return respond(200, []);
    });

    const fixturePath = path.join(__dirname, '..', 'fixtures', 'case_library_import.json');
    const rawCases = fs.readFileSync(fixturePath, 'utf8');
    let parsedCases = [];
    try {
      const payload = JSON.parse(rawCases);
      parsedCases = Array.isArray(payload) ? payload : [];
    } catch (err) {
      parsedCases = [];
    }
    const fileBuf = Buffer.from(JSON.stringify({ requirement: '需求A', cases: parsedCases }, null, 2), 'utf8');

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });

    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDrawer')).toHaveClass(/open/);

    await expect(page.locator('#tempExecImportConfirmBtn')).toBeDisabled();
    await expect(page.locator('#tempExecImportFileHint')).toContainText('未选择文件');
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state && window.app.state.tempExecFiles ? window.app.state.tempExecFiles.length : -1))).toBe(0);

    await page.setInputFiles('#tempExecInput', {
      name: '勾选用例-登录_result_20251213121212.json',
      mimeType: 'application/json',
      buffer: fileBuf,
    });
    await expect(page.locator('#tempExecImportFileHint')).toContainText('已选择 1 份文件');
    await expect(page.locator('#tempExecImportConfirmBtn')).toBeDisabled();
    await expect(page.locator('#tempExecImportVersionSelect')).toBeDisabled();
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state && window.app.state.tempExecFiles ? window.app.state.tempExecFiles.length : -1))).toBe(0);

    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportProjectSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#tempExecImportProjectSelect', String(project.id));

    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportVersionSelect');
      return sel && !sel.disabled && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#tempExecImportVersionSelect', String(versions[0].id));

    await expect(page.locator('#tempExecImportConfirmBtn')).toBeEnabled();
    await page.click('#tempExecImportConfirmBtn');

    await expect.poll(() => page.evaluate(() => (window.app && window.app.state && window.app.state.tempExecFiles ? window.app.state.tempExecFiles.length : -1)), {
      timeout: 10000,
    }).toBe(1);
    await expect.poll(() => page.evaluate(() => (window.app && window.app.state && window.app.state.tempExecFiles && window.app.state.tempExecFiles[0] ? window.app.state.tempExecFiles[0].name : ''))).toContain('登录');
    await expect(page.locator('#tempExecImportFileHint')).toContainText('未选择文件');
  });

  test('历史用例名带前缀时导入仍能复用入库', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '最长项目名六个字', description: 'for tempexec import' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];

    let nextCaseFileId = 100;
    let nextCaseItemId = 1000;
    const caseFiles = [];
    const caseItemsByFileId = {};
    let nextExecSetId = 2000;
    let nextExecCaseId = 3000;
    const execSets = [];
    const execCasesBySetId = {};
    let importCallCount = 0;

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/case-files' && method === 'GET') {
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        return respond(200, caseFiles.slice().sort((a, b) => b.id - a.id));
      }

      if (pathName === '/api/case-files/import' && method === 'POST') {
        importCallCount += 1;
        return respond(400, { detail: '同名用例已存在' });
      }

      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        const fileId = Number(itemsMatch[1]);
        return respond(200, caseItemsByFileId[fileId] || []);
      }

      if (pathName === '/api/exec/sets' && method === 'GET') {
        const pid = url.searchParams.get('project_id');
        const list = pid ? execSets.filter((s) => String(s.project_id) === String(pid)) : execSets.slice();
        return respond(200, list.slice().sort((a, b) => b.id - a.id));
      }

      if (pathName === '/api/exec/sets/from-case-file' && method === 'POST') {
        const payload = route.request().postDataJSON();
        const caseFileId = Number(payload.case_file_id);
        const cf = caseFiles.find((f) => f.id === caseFileId);
        if (!cf) return respond(404, { detail: 'case file not found' });

        let execSet = execSets.find((s) => s.case_file_id === caseFileId) || null;
        const now = new Date().toISOString();
        if (!execSet) {
          execSet = {
            id: nextExecSetId++,
            project_id: cf.project_id,
            version_id: cf.version_id,
            case_file_id: cf.id,
            name: cf.file_name_clean,
            requirement: payload.requirement || '',
            reuse_enabled: payload.reuse_enabled ? true : false,
            reuse_presets: payload.reuse_presets || null,
            status: 'active',
            created_at: now,
            updated_at: now,
          };
          execSets.push(execSet);
        } else {
          execSet.status = 'active';
          execSet.updated_at = now;
        }
        const items = caseItemsByFileId[caseFileId] || [];
        const prev = execCasesBySetId[execSet.id] || [];
        const prevByItemId = new Map(prev.filter((c) => c && c.case_item_id).map((c) => [c.case_item_id, c]));
        const rebuilt = items.map((it, idx) => {
          const existed = prevByItemId.get(it.id);
          return {
            id: existed ? existed.id : nextExecCaseId++,
            exec_set_id: execSet.id,
            case_item_id: it.id,
            module: it.module,
            title: it.title,
            expected: it.expected,
            priority: it.priority,
            precondition: it.precondition,
            steps: it.steps,
            actual_result: null,
            defect_link: null,
            reuse_details: (existed && existed.reuse_details) ? existed.reuse_details : [],
            defect_links: (existed && existed.defect_links) ? existed.defect_links : [],
            remark: existed ? existed.remark : (it.remark || ''),
            status: existed ? existed.status : '未执行',
            order_no: idx + 1,
            executor_id: user.id,
            created_at: existed ? existed.created_at : now,
            updated_at: now,
          };
        });
        execCasesBySetId[execSet.id] = rebuilt;
        return respond(200, execSet);
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const setId = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[setId] || []);
      }

      return respond(200, []);
    });

    const fixturePath = path.join(__dirname, '..', 'fixtures', 'case_library_import.json');
    const rawCases = fs.readFileSync(fixturePath, 'utf8');
    let parsedCases = [];
    try {
      const payload = JSON.parse(rawCases);
      parsedCases = Array.isArray(payload) ? payload : [];
    } catch (err) {
      parsedCases = [];
    }
    const fileBuf = Buffer.from(JSON.stringify({ requirement: '需求A', cases: parsedCases }, null, 2), 'utf8');

    const legacyImportedAt = new Date().toISOString();
    const legacyFile = {
      id: nextCaseFileId++,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '勾选用例 登录',
      importer_id: user.id,
      importer_name: user.username,
      imported_at: legacyImportedAt,
      updated_at: legacyImportedAt,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    };
    caseFiles.push(legacyFile);
    caseItemsByFileId[legacyFile.id] = parsedCases.map((it) => ({
      id: nextCaseItemId++,
      case_file_id: legacyFile.id,
      module: it.module,
      title: it.title,
      expected: it.expected,
      priority: it.priority || null,
      precondition: it.precondition || it.preconditions || null,
      steps: it.steps || null,
      remark: it.remark || null,
      created_at: legacyImportedAt,
      updated_at: legacyImportedAt,
    }));

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true, {}, { timeout: 30000 });
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });

    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDrawer')).toHaveClass(/open/);

    await page.setInputFiles('#tempExecInput', {
      name: '勾选用例 登录_result_20251213121212.json',
      mimeType: 'application/json',
      buffer: fileBuf,
    });
    await expect(page.locator('#tempExecImportFileHint')).toContainText('已选择 1 份文件');

    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportProjectSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#tempExecImportProjectSelect', String(project.id));

    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportVersionSelect');
      return sel && !sel.disabled && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#tempExecImportVersionSelect', String(versions[0].id));

    await expect(page.locator('#tempExecImportConfirmBtn')).toBeEnabled();
    await page.click('#tempExecImportConfirmBtn');

    await expect.poll(() => page.evaluate(() => (window.app && window.app.state && window.app.state.tempExecFiles ? window.app.state.tempExecFiles.length : -1)), {
      timeout: 10000,
    }).toBe(1);
    expect(importCallCount).toBe(0);
  });
});
