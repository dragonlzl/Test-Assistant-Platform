const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

async function gotoIndex(page) {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
  const url = base + '/index.html';
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(url);
      return base;
    } catch (err) {
      lastErr = err;
      const msg = err && err.message ? String(err.message) : String(err || '');
      const canRetry = msg.indexOf('ERR_EMPTY_RESPONSE') !== -1 || msg.indexOf('net::ERR_EMPTY_RESPONSE') !== -1;
      if (!canRetry || i === 2) throw err;
      await page.waitForTimeout(300);
    }
  }
  throw lastErr || new Error('page.goto failed');
}

async function waitAppInited(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let retriedReload = false;
  let retriedGoto = false;
  let last = null;

  while (Date.now() < deadline) {
    last = await page.evaluate(() => {
      let token = '';
      try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
      return {
        hasApp: Boolean(window.app),
        inited: Boolean(window.app && window.app._inited === true),
        hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
        path: (window.location && window.location.pathname) ? String(window.location.pathname) : '',
        token: token,
      };
    });

    if (last && last.hasApp && last.inited && last.hasSwitchTab) return;

    if (!retriedGoto && last && last.path && last.path.indexOf('login') !== -1) {
      retriedGoto = true;
      const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
      await page.goto(base + '/index.html');
      await page.waitForTimeout(200);
      continue;
    }

    if (!retriedReload && last && last.hasApp && (!last.inited || !last.hasSwitchTab)) {
      retriedReload = true;
      await page.reload();
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
  }
  throw new Error('waitAppInited timeout: ' + JSON.stringify(last || {}));
}

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
      clean = clean.replace(/^勾选用例[\s_\-\u2010-\u2015\u2212\uFE63\uFF0D]*/i, '').trim();
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
        if (caseFiles.some((f) => f.file_name_clean === cleanName)) {
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

    await gotoIndex(page);
    await waitAppInited(page, 30000);
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

    await gotoIndex(page);
    await waitAppInited(page, 30000);
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

    await expect(page.locator('#tempExecImportDiffDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDiffTitle')).toContainText('登录');
    expect(importCallCount).toBe(0);
  });

  test('文件名含全角空格前缀时，能匹配已入库用例文件并避免同名导入失败', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '导入前缀兼容', description: 'for tempexec import match' };
    const versions = [{ id: 11, name: 'v1' }];

    let importEndpointCalled = 0;
    const now = new Date().toISOString();

    const existingCaseFile = {
      id: 100,
      project_id: project.id,
      version_id: versions[0].id,
      file_name_clean: '全角空格测试',
      importer_id: user.id,
      importer_name: user.username,
      imported_at: now,
      updated_at: now,
      last_updated_by: user.id,
      last_updated_by_name: user.username,
    };
    const caseFiles = [existingCaseFile];
    const caseItemsByFileId = {
      100: [
        {
          id: 1000,
          case_file_id: 100,
          module: '登录',
          title: '全角空格测试',
          expected: 'ok',
          priority: null,
          precondition: null,
          steps: null,
          remark: null,
          created_at: now,
          updated_at: now,
        },
      ],
    };

    let nextExecSetId = 2000;
    let nextExecCaseId = 3000;
    const execSets = [];
    const execCasesBySetId = {};

    function normalizeCleanName(fileName) {
      const base = String(fileName || '').split(/[\\/]/).pop();
      let clean = String(base || '').replace(/\.[^.]+$/, '');
      const tsPattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
      while (tsPattern.test(clean)) clean = clean.replace(tsPattern, '');
      clean = clean.replace(/^勾选用例[\s_\-\u2010-\u2015\u2212\uFE63\uFF0D]*/i, '').trim();
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
        importEndpointCalled += 1;
        const payload = route.request().postDataJSON();
        const cleanName = normalizeCleanName(payload.file_name || '');
        if (
          caseFiles.some(
            (f) =>
              f.file_name_clean === cleanName &&
              String(f.version_id || '') === String(payload.version_id || '')
          )
        ) {
          return respond(400, { detail: '同名用例已存在' });
        }
        return respond(500, { detail: 'unexpected import call' });
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
        const now2 = new Date().toISOString();
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
            created_at: now2,
            updated_at: now2,
          };
          execSets.push(execSet);
        } else {
          execSet.status = 'active';
          execSet.updated_at = now2;
        }
        const items = caseItemsByFileId[caseFileId] || [];
        const rebuilt = items.map((it, idx) => ({
          id: nextExecCaseId++,
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
          reuse_details: [],
          defect_links: [],
          remark: it.remark || '',
          status: '未执行',
          order_no: idx + 1,
          executor_id: user.id,
          created_at: now2,
          updated_at: now2,
        }));
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

    const fileBuf = Buffer.from(
      JSON.stringify(
        {
          requirement: '需求A',
          cases: [
            { module: '登录', title: '全角空格测试', expected: 'ok', priority: 'P1', steps: '1', preconditions: '' },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    await gotoIndex(page);
    await waitAppInited(page, 30000);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });

    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDrawer')).toHaveClass(/open/);

    await page.setInputFiles('#tempExecInput', {
      name: '勾选用例　全角空格测试_result_20251213121212.json',
      mimeType: 'application/json',
      buffer: fileBuf,
    });

    await page.selectOption('#tempExecImportProjectSelect', String(project.id));
    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportVersionSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#tempExecImportVersionSelect', String(versions[0].id));

    await expect(page.locator('#tempExecImportConfirmBtn')).toBeEnabled();
    await page.click('#tempExecImportConfirmBtn');

    await expect(page.locator('#tempExecImportDiffDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDiffTitle')).toContainText('全角空格测试');
    expect(importEndpointCalled).toBe(0);
  });

  test('导入文件内存在重复条目时：打开抽屉提示并确认后自动去重入库', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '重复条目确认', description: 'for tempexec duplicate drawer' };
    const versions = [{ id: 11, name: 'v1' }];

    let nextCaseFileId = 100;
    let nextCaseItemId = 1000;
    const caseFiles = [];
    const caseItemsByFileId = {};
    let nextExecSetId = 2000;
    let nextExecCaseId = 3000;
    const execSets = [];
    const execCasesBySetId = {};
    let lastImportItemsLen = -1;
    let lastImportItems = null;

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
        lastImportItemsLen = (payload.items || []).length;
        lastImportItems = Array.isArray(payload.items) ? payload.items : [];
        const cleanName = String(payload.file_name || '').replace(/\.[^.]+$/, '');
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

      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, execSets.slice().sort((a, b) => b.id - a.id));

      if (pathName === '/api/exec/sets/from-case-file' && method === 'POST') {
        const payload = route.request().postDataJSON();
        const caseFileId = Number(payload.case_file_id);
        const cf = caseFiles.find((f) => f.id === caseFileId);
        if (!cf) return respond(404, { detail: 'case file not found' });
        const now = new Date().toISOString();
        let execSet = execSets.find((s) => s.case_file_id === caseFileId) || null;
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
        }
        const items = caseItemsByFileId[caseFileId] || [];
        execCasesBySetId[execSet.id] = items.map((it, idx) => ({
          id: nextExecCaseId++,
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
          reuse_details: [],
          defect_links: [],
          remark: it.remark || '',
          status: '未执行',
          order_no: idx + 1,
          executor_id: user.id,
          created_at: now,
          updated_at: now,
        }));
        return respond(200, execSet);
      }

      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const setId = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[setId] || []);
      }

      return respond(200, []);
    });

    const cases = [
      { module: '调整', title: '普通攻击', expected: '进入战斗后会佩戴嘴炮进行攻击', priority: 'P1', preconditions: '战斗场景', steps: '观察普通攻击' },
      { module: '调整', title: '普通攻击', expected: '进入战斗后会佩戴嘴炮进行攻击', priority: 'P1', preconditions: '战斗场景', steps: '观察普通攻击' },
      { module: '调整', title: '普通攻击', expected: '进入战斗后会佩戴嘴炮进行攻击', priority: 'P1', preconditions: '非战斗场景', steps: '观察普通攻击(不同步骤)' },
    ];
    const fileBuf = Buffer.from(JSON.stringify({ requirement: '需求A', cases }, null, 2), 'utf8');

    await gotoIndex(page);
    await waitAppInited(page, 30000);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });

    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDrawer')).toHaveClass(/open/);

    await page.setInputFiles('#tempExecInput', {
      name: '小小教官调整_20251209221805.xmind.json',
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

    await page.click('#tempExecImportConfirmBtn');

    await expect(page.locator('#tempExecImportDuplicateDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDuplicateStatus')).toContainText('原 3 条');
    await expect(page.locator('#tempExecImportDuplicateBody')).toContainText('普通攻击');

    await page.click('#tempExecImportDuplicateConfirmBtn');
    await expect(page.locator('#tempExecImportDuplicateDrawer')).not.toHaveClass(/open/);

    await expect.poll(() => page.evaluate(() => (window.app && window.app.state && window.app.state.tempExecFiles ? window.app.state.tempExecFiles.length : -1)), {
      timeout: 10000,
    }).toBe(1);
    expect(lastImportItemsLen).toBe(2);
    expect(Array.isArray(lastImportItems)).toBeTruthy();
    expect(lastImportItems.some((it) => it && it.precondition === '非战斗场景')).toBeTruthy();
  });

  test('刷新页面后保持导入项目/版本选择（便于多次导入）', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '导入选择持久化', description: 'for tempexec import selection persist' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];

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
      if (pathName === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, []);

      return respond(200, []);
    });

    const base = await gotoIndex(page);
    await waitAppInited(page, 30000);
    await page.waitForFunction(() => window.app && window.app.authReady === true);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await page.waitForFunction(() => {
      const nodes = document.querySelectorAll('[data-tab-section="tempexec"]');
      if (!nodes || !nodes.length) return true;
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (el && el.classList && !el.classList.contains('hidden')) return true;
      }
      return false;
    });

    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDrawer')).toHaveClass(/open/);

    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportProjectSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#tempExecImportProjectSelect', String(project.id));

    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportVersionSelect');
      return sel && !sel.disabled && sel.options && sel.options.length > 1;
    });
    await page.selectOption('#tempExecImportVersionSelect', String(versions[1].id));

    await page.reload();
    await waitAppInited(page, 30000);
    await page.waitForFunction(() => window.app && window.app.authReady === true);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });
    await page.waitForFunction(() => {
      const nodes = document.querySelectorAll('[data-tab-section="tempexec"]');
      if (!nodes || !nodes.length) return true;
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (el && el.classList && !el.classList.contains('hidden')) return true;
      }
      return false;
    });
    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDrawer')).toHaveClass(/open/);

    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportProjectSelect');
      return sel && sel.options && sel.options.length > 1;
    });
    await expect(page.locator('#tempExecImportProjectSelect')).toHaveValue(String(project.id));

    await page.waitForFunction(() => {
      var sel = document.getElementById('tempExecImportVersionSelect');
      return sel && !sel.disabled && sel.options && sel.options.length > 1;
    });
    await expect(page.locator('#tempExecImportVersionSelect')).toHaveValue(String(versions[1].id));
    await expect(page.locator('#tempExecImportConfirmBtn')).toBeDisabled();
  });
});
