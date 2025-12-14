const { test, expect } = require('@playwright/test');
const JSZip = require('../../scripts/vendor/jszip.min.js');

function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colIndexToLetters(idx) {
  let n = Number(idx) + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function buildSheetXml(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const rowXml = list
    .map((row, rIdx) => {
      const cols = Array.isArray(row) ? row : [];
      const cells = cols
        .map((val, cIdx) => {
          const ref = `${colIndexToLetters(cIdx)}${rIdx + 1}`;
          const v = escapeXml(val);
          return `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
        })
        .join('');
      return `<row r="${rIdx + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

async function buildXlsxBuffer(rows) {
  const zip = new JSZip();
  zip.file('xl/worksheets/sheet1.xml', buildSheetXml(rows));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function waitAppReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
  let retriedGoto = false;
  while (Date.now() < deadline) {
    try {
      last = await page.evaluate(() => {
        const path = (window.location && window.location.pathname) ? String(window.location.pathname) : '';
        return {
          hasApp: Boolean(window.app),
          inited: Boolean(window.app && window.app._inited === true),
          authReady: Boolean(window.app && window.app.authReady === true),
          hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
          hasDrawer: Boolean(window.app && window.app.drawer && typeof window.app.drawer.createDrawer === 'function'),
          path: path,
        };
      });
    } catch (err) {
      await page.waitForTimeout(200);
      continue;
    }
    if (!retriedGoto && last && last.path && last.path.indexOf('login') !== -1) {
      retriedGoto = true;
      const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
      await page.goto(base + '/index.html');
      await page.waitForTimeout(200);
      continue;
    }
    if (last && last.hasApp && last.inited && last.authReady && last.hasSwitchTab && last.hasDrawer) return;
    await page.waitForTimeout(200);
  }
  throw new Error('waitAppReady timeout: ' + JSON.stringify(last || {}));
}

test.describe('用例执行-Excel 导入同名差异对比', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
  });

  test('导入带结果 Excel：同名时打开 diff，覆盖需二次确认', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const token = 'test-token';

    const user = { id: 9, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: 'for tempexec xlsx diff' };
    const version = { id: 11, name: 'v1' };
    const caseFileId = 123;
    const execSetId = 456;
    const overwrittenExecSetId = 999;
    let lastOverwritePayload = null;

    const now = new Date().toISOString();
    const caseFiles = [
      { id: caseFileId, project_id: project.id, version_id: version.id, file_name_clean: '用例A', item_count: 1, status: 'active', created_at: now, updated_at: now },
    ];
    const caseItems = [
      { id: 1001, case_file_id: caseFileId, module: '模块', title: '标题', expected: '预期', priority: 'P1', precondition: '前提', steps: '步骤', remark: '' },
    ];
    const execSets = [
      { id: execSetId, project_id: project.id, version_id: version.id, case_file_id: caseFileId, name: '用例A', status: 'active', reuse_enabled: true, created_at: now, updated_at: now },
      { id: overwrittenExecSetId, project_id: project.id, version_id: version.id, case_file_id: caseFileId, name: '用例A', status: 'active', reuse_enabled: true, created_at: now, updated_at: now },
    ];
    const execCasesBySetId = {};
    execCasesBySetId[execSetId] = [
      {
        id: 2001,
        exec_set_id: execSetId,
        case_item_id: 1001,
        module: '模块',
        title: '标题',
        expected: '预期',
        priority: 'P1',
        precondition: '前提',
        steps: '步骤',
        remark: '旧备注',
        defect_links: [{ id: 'd1', url: 'http://old-bug' }],
        reuse_details: [
          { id: 'r1', text: '子项1', note: '旧子备注1', status: '通过' },
          { id: 'r2', text: '子项2', note: '旧子备注2', status: '失败' },
        ],
        status: '失败',
        order_no: 1,
        executor_id: user.id,
        created_at: now,
        updated_at: now,
      },
    ];
    execCasesBySetId[overwrittenExecSetId] = execCasesBySetId[execSetId];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, [version]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/case-files' && method === 'GET') return respond(200, caseFiles);
      if (pathName === `/api/case-files/${caseFileId}/items` && method === 'GET') return respond(200, caseItems);

      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, execSets);
      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const sid = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[sid] || []);
      }

      if (pathName === '/api/case-files/import' && method === 'POST') {
        if (url.searchParams.get('overwrite') === '1') {
          try { lastOverwritePayload = route.request().postDataJSON(); } catch (_) { lastOverwritePayload = null; }
          return respond(200, caseFiles[0]);
        }
        return respond(409, { detail: '同名用例已存在', existing_case_file_id: caseFileId, existing_file_name_clean: '用例A', existing_version_id: version.id });
      }

      if (pathName === '/api/exec/sets/from-case-file' && method === 'POST') {
        const payload = route.request().postDataJSON();
        expect(payload && payload.mode).toBe('replace');
        expect(payload && payload.preserve_results).toBe(false);
        return respond(200, execSets[1]);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.goto(base + '/index.html');
    await waitAppReady(page, 30000);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });

    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDrawer')).toHaveClass(/open/);

    const rows = [
      ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果', '实际结果', '备注', '缺陷链接'],
      ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果', '实际结果', '备注', '缺陷链接'],
      ['模块', '标题', 'P0', '前提', '步骤', '预期', '失败', '主备注', 'http://bug-new'],
      ['', '', '', '', '', '子项1', '通过', '子备注1', ''],
      ['', '', '', '', '', '子项2', '失败', '子备注2', ''],
    ];
    const xlsxBuf = await buildXlsxBuffer(rows);
    await page.setInputFiles('#tempExecInput', {
      name: '用例A.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: xlsxBuf,
    });

    await page.selectOption('#tempExecImportProjectSelect', String(project.id));
    await page.selectOption('#tempExecImportVersionSelect', String(version.id));

    await page.click('#tempExecImportConfirmBtn');

    await expect(page.locator('#tempExecImportDiffDrawer')).toHaveClass(/open/);
    await expect(page.locator('#tempExecImportDiffTitle')).toContainText('用例A');
    const actualHeaders = page.locator('#tempExecImportDiffDrawer th[data-tempexec-diff-result]', { hasText: '实际结果' });
    await expect(actualHeaders).toHaveCount(2);
    await expect(actualHeaders.first()).toBeVisible();
    await expect(actualHeaders.nth(1)).toBeVisible();

    let confirmCount = 0;
    page.on('dialog', async (dialog) => {
      confirmCount += 1;
      await dialog.accept();
    });
    const overwriteResp = page.waitForResponse((resp) => {
      const u = resp.url();
      return u.indexOf('/api/case-files/import') !== -1 && u.indexOf('overwrite=1') !== -1 && resp.status() === 200;
    });
    await page.click('#tempExecImportDiffOverwriteBtn');
    await overwriteResp;
    await page.waitForTimeout(400);
    expect(confirmCount).toBe(2);
    expect(lastOverwritePayload && Array.isArray(lastOverwritePayload.items) ? lastOverwritePayload.items.length : -1).toBe(1);
    expect(
      lastOverwritePayload && Array.isArray(lastOverwritePayload.items)
        ? lastOverwritePayload.items.some((it) => it && it.title === '用例标题' && it.expected === '预期结果')
        : false
    ).toBe(false);
    await expect(page.locator('#tempExecImportFileHint')).toContainText('未选择文件');
  });

  test('导入不带结果 Excel：同名 diff 不展示结果字段', async ({ page }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    const token = 'test-token';
    const user = { id: 9, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '项目A', description: 'for tempexec xlsx diff' };
    const version = { id: 11, name: 'v1' };
    const caseFileId = 321;

    const now = new Date().toISOString();
    const caseFiles = [
      { id: caseFileId, project_id: project.id, version_id: version.id, file_name_clean: '用例B', item_count: 1, status: 'active', created_at: now, updated_at: now },
    ];
    const caseItems = [
      { id: 2001, case_file_id: caseFileId, module: '模块', title: '标题', expected: '预期', priority: 'P1', precondition: '', steps: '', remark: '' },
    ];
    const execSets = [
      { id: 1000, project_id: project.id, version_id: version.id, case_file_id: caseFileId, name: '用例B', status: 'active', reuse_enabled: false, created_at: now, updated_at: now },
    ];
    const execCasesBySetId = {
      1000: [{ id: 4001, exec_set_id: 1000, case_item_id: 2001, module: '模块', title: '标题', expected: '预期', priority: 'P1', precondition: '', steps: '', remark: '', defect_links: [], reuse_details: [], status: '未执行', order_no: 1, executor_id: user.id, created_at: now, updated_at: now }],
    };

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, [version]);
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/case-files' && method === 'GET') return respond(200, caseFiles);
      if (pathName === `/api/case-files/${caseFileId}/items` && method === 'GET') return respond(200, caseItems);
      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, execSets);
      const execCasesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const sid = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[sid] || []);
      }

      if (pathName === '/api/case-files/import' && method === 'POST') {
        return respond(409, { detail: '同名用例已存在', existing_case_file_id: caseFileId, existing_file_name_clean: '用例B', existing_version_id: version.id });
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
    }, token);

    await page.goto(base + '/index.html');
    await waitAppReady(page, 30000);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('tempexec'); });

    await page.click('#openTempExecDrawerBtn');
    await expect(page.locator('#tempExecDrawer')).toHaveClass(/open/);
    const rows = [
      ['模块', '用例标题', '优先级', '前提条件', '操作步骤', '预期结果'],
      ['模块', '标题', 'P0', '', '', '预期'],
    ];
    const xlsxBuf = await buildXlsxBuffer(rows);
    await page.setInputFiles('#tempExecInput', {
      name: '用例B.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: xlsxBuf,
    });
    await page.selectOption('#tempExecImportProjectSelect', String(project.id));
    await page.selectOption('#tempExecImportVersionSelect', String(version.id));
    await page.click('#tempExecImportConfirmBtn');

    await expect(page.locator('#tempExecImportDiffDrawer')).toHaveClass(/open/);
    const actualHeaders2 = page.locator('#tempExecImportDiffDrawer th[data-tempexec-diff-result]', { hasText: '实际结果' });
    const remarkHeaders2 = page.locator('#tempExecImportDiffDrawer th[data-tempexec-diff-result]', { hasText: '备注' });
    const defectHeaders2 = page.locator('#tempExecImportDiffDrawer th[data-tempexec-diff-result]', { hasText: '缺陷链接' });
    await expect(actualHeaders2).toHaveCount(2);
    await expect(remarkHeaders2).toHaveCount(2);
    await expect(defectHeaders2).toHaveCount(2);
    await expect(actualHeaders2.first()).toHaveClass(/hidden/);
    await expect(actualHeaders2.nth(1)).toHaveClass(/hidden/);
    await expect(remarkHeaders2.first()).toHaveClass(/hidden/);
    await expect(remarkHeaders2.nth(1)).toHaveClass(/hidden/);
    await expect(defectHeaders2.first()).toHaveClass(/hidden/);
    await expect(defectHeaders2.nth(1)).toHaveClass(/hidden/);
  });
});
