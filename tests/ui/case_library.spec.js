const path = require('path');
const fs = require('fs');
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

async function reloadWithRetry(page) {
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.reload();
      return;
    } catch (err) {
      lastErr = err;
      const msg = err && err.message ? String(err.message) : String(err || '');
      const canRetry = msg.indexOf('ERR_EMPTY_RESPONSE') !== -1 || msg.indexOf('net::ERR_EMPTY_RESPONSE') !== -1;
      if (!canRetry || i === 2) throw err;
      await page.waitForTimeout(300);
    }
  }
  throw lastErr || new Error('page.reload failed');
}

async function waitCaseLibraryReady(page, timeoutMs) {
  const timeout = Number(timeoutMs) || 30000;
  // 预留 1s 给 Playwright 测试超时，保证能抛出更可读的状态信息。
  const deadline = Date.now() + Math.max(1000, timeout - 1000);
  let last = null;
  let retriedToken = false;
  let retriedReload = false;
  let retriedGoto = false;

  while (Date.now() < deadline) {
    // 用 evaluate 拿状态，避免 waitForFunction 因某些偶发脚本中断而卡死。
    last = await page.evaluate(() => {
      let token = '';
      try { token = localStorage.getItem('tap-auth-token') || ''; } catch (_) { token = ''; }
      return {
        hasApp: Boolean(window.app),
        authReady: Boolean(window.app && window.app.authReady === true),
        caseLibraryBound: Boolean(window.app && window.app.caseLibraryBound === true),
        hasSwitchTab: Boolean(window.app && typeof window.app.switchTab === 'function'),
        path: (window.location && window.location.pathname) ? String(window.location.pathname) : '',
        token: token,
      };
    });

    if (last && last.hasApp && last.authReady && last.caseLibraryBound && last.hasSwitchTab) return;

    // 兜底：偶发跳转到 login.html（通常因 token 注入/接口链路抖动），补 token 后回到 index.html 再等一次。
    if (!retriedGoto && last && last.path && last.path.indexOf('login') !== -1) {
      retriedGoto = true;
      await page.evaluate(() => {
        try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
      });
      const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
      await page.goto(base + '/index.html');
      await page.waitForTimeout(200);
      continue;
    }

    // 兜底：偶发 localStorage 注入丢失导致未登录，补 token 后刷新一次。
    if (!retriedToken && last && last.hasApp && !last.authReady && !last.token) {
      retriedToken = true;
      await page.evaluate(() => {
        try { localStorage.setItem('tap-auth-token', 'test-token'); } catch (_) {}
      });
      await reloadWithRetry(page);
      await page.waitForTimeout(100);
      continue;
    }
    // 兜底：偶发脚本未完整加载（switchTab 未挂载），先刷新一次触发重试。
    if (!retriedReload && last && last.hasApp && !last.hasSwitchTab) {
      retriedReload = true;
      await reloadWithRetry(page);
      await page.waitForTimeout(200);
      continue;
    }
    // 兜底：偶发 authGuard 请求链路失败导致一直未登录，直接刷新一次触发重试。
    if (!retriedReload && last && last.hasApp && !last.authReady && last.token) {
      retriedReload = true;
      await reloadWithRetry(page);
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
  }

  throw new Error('waitCaseLibraryReady timeout: ' + JSON.stringify(last || {}));
}

async function openDrawer(page, buttonSelector, drawerSelector) {
  const btn = page.locator(buttonSelector);
  const drawer = page.locator(drawerSelector);
  await btn.scrollIntoViewIfNeeded();
  let lastErr = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      if (i < 2) {
        await btn.click(i === 0 ? {} : { force: true });
      } else {
        // 兜底：个别情况下按钮点击被遮罩/焦点吞掉，直接在页面上下文触发一次 click。
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el && typeof el.click === 'function') el.click();
        }, buttonSelector);
      }
      await page.waitForTimeout(80);
      const opened = await drawer.evaluate((el) => Boolean(el && el.classList && el.classList.contains('open')));
      if (opened) return;
      await expect(drawer).toHaveClass(/open/, { timeout: 3000 });
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(200);
    }
  }
  throw lastErr || new Error('openDrawer failed: ' + drawerSelector);
}

async function switchToTab(page, tabName) {
  await page.evaluate((name) => {
    if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
  }, tabName);
}

async function ensureCaseLibraryTab(page) {
  for (let i = 0; i < 3; i += 1) {
    await switchToTab(page, 'case-library');
    try {
      await page.waitForFunction(() => {
        const head = document.getElementById('caseLibraryHead');
        if (!head) return false;
        if (head.classList.contains('hidden')) return false;
        const sections = document.querySelectorAll('[data-tab-section="case-library"]');
        if (!sections || !sections.length) return false;
        for (let j = 0; j < sections.length; j += 1) {
          const el = sections[j];
          if (el && el.classList && !el.classList.contains('hidden')) return true;
        }
        return false;
      }, {}, { timeout: 2000 });
      await expect(page.locator('#caseLibraryHead')).toBeVisible({ timeout: 2000 });
      return;
    } catch (err) {
      await page.waitForTimeout(300);
    }
  }
  await expect(page.locator('#caseLibraryHead')).toBeVisible();
}

test.describe('用例库页面（导入/编辑/转到执行）', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
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
        const overwrite = url.searchParams.get('overwrite') === '1' || url.searchParams.get('overwrite') === 'true';
        if (payload.project_id !== project.id) return respond(400, { detail: 'bad project' });
        if (payload.version_id !== versions[0].id) return respond(400, { detail: 'bad version' });
        const fileName = payload.file_name || '';
        const base = String(fileName).split(/[\\/]/).pop();
        let clean = base.replace(/\.[^.]+$/, '');
        const tsPattern = /(_result)?_\d{8}(?:_?\d{6})?$/i;
        while (tsPattern.test(clean)) clean = clean.replace(tsPattern, '');
        clean = clean.replace(/^勾选用例[\s_\-\u2010-\u2015\u2212\uFE63\uFF0D]*/i, '').trim();
        const existing = caseFiles.find((f) => f.file_name_clean === clean);
        const now = new Date().toISOString();
        if (existing && !overwrite) {
          return respond(400, { detail: '同名用例已存在' });
        }
        let file = existing;
        if (!file) {
          const id = nextCaseFileId++;
          file = {
            id,
            project_id: payload.project_id,
            version_id: payload.version_id,
            file_name_clean: clean,
            item_count: 0,
            importer_id: user.id,
            importer_name: user.username,
            imported_at: now,
            updated_at: now,
            last_updated_by: user.id,
            last_updated_by_name: user.username,
          };
          caseFiles.push(file);
        } else {
          file.version_id = payload.version_id;
          file.updated_at = now;
          file.last_updated_by = user.id;
          file.last_updated_by_name = user.username;
        }
        const fileId = file.id;
        const nextItems = (payload.items || []).map((it) => ({
          id: nextCaseItemId++,
          case_file_id: fileId,
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
        caseItemsByFileId[fileId] = nextItems;
        file.item_count = nextItems.length;
        return respond(existing ? 200 : 201, file);
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

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);

    await ensureCaseLibraryTab(page);

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
    // 导入成功后应清空文件选择，避免再次点击导致重复导入
    await expect(page.locator('#caseLibraryImportConfirmBtn')).toBeDisabled();
    await expect(page.locator('#caseLibraryImportFileHint')).toContainText('未选择文件');

    // 再次打开导入抽屉时，默认回填最近选择的项目/版本
    await page.click('#caseLibraryImportDrawer .ghost-btn[data-drawer-close="caseLibraryImportDrawer"]');
    await expect(page.locator('#caseLibraryImportDrawer')).not.toHaveClass(/open/);
    await page.click('#openCaseLibraryImportDrawerBtn');
    await expect(page.locator('#caseLibraryImportDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryImportProjectSelect')).toHaveValue(String(project.id));
    await expect(page.locator('#caseLibraryImportVersionSelect')).toBeEnabled();
    await expect(page.locator('#caseLibraryImportVersionSelect')).toHaveValue(String(versions[0].id));

    // 同名校验：再次导入同名文件（但内容不同），应打开差异对比抽屉
    const secondImportPayload = [
      {
        module: '登录',
        title: '正常登录',
        priority: 'P0',
        preconditions: '已注册账号',
        steps: '1. 输入账号\\n2. 输入密码\\n3. 点击登录（修改）',
        expected: '登录成功',
        remark: '此字段不会参与对比',
      },
      {
        module: '登录',
        title: '密码错误提示',
        priority: 'P2',
        preconditions: '',
        steps: '1. 输入账号\\n2. 输入错误密码\\n3. 点击登录',
        expected: '提示密码错误',
        remark: '',
      },
      {
        module: '登录',
        title: '新增用例',
        priority: 'P1',
        preconditions: '',
        steps: '1. 步骤A',
        expected: '预期A',
        remark: '',
      },
    ];
    await page.setInputFiles('#caseLibraryImportInput', {
      name: path.basename(fixturePath),
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(secondImportPayload), 'utf-8'),
    });
    await page.click('#caseLibraryImportConfirmBtn');
    await expect(page.locator('#caseLibraryImportStatus')).toContainText('同名用例已存在');
    await expect(page.locator('#caseLibraryImportDiffDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryImportDiffStatus')).toContainText('对比完成');
    await expect(page.locator('#caseLibraryImportDiffLeftBody')).toContainText('新增用例');
    await expect(page.locator('#caseLibraryImportDiffLeftBody')).toContainText('点击登录（修改）');
    await expect(page.locator('#caseLibraryImportDiffRightBody')).toContainText('点击登录');
    page.once('dialog', async (dialog) => dialog.accept());
    await page.click('#caseLibraryImportDiffOverwriteBtn');
    await expect(page.locator('#caseLibraryImportStatus')).toContainText('覆盖导入成功');
    await expect(page.locator('#caseLibraryImportDiffDrawer')).not.toHaveClass(/open/);

    // 关闭导入抽屉再进入编辑抽屉，避免遮罩拦截点击
    if (await page.locator('#caseLibraryImportDrawer').evaluate((el) => el.classList.contains('open'))) {
      await page.click('#caseLibraryImportDrawer .ghost-btn[data-drawer-close="caseLibraryImportDrawer"]');
    }
    await expect(page.locator('#caseLibraryImportDrawer')).not.toHaveClass(/open/);

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('case_library_import');

    // 抽屉内勾选后可导出 XMind/Excel（不含执行结果，使用原名）
    await page.click('#caseLibraryEditListBody input[data-case-lib-edit-select]');
    const [xmindDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#caseLibraryEditExportXmindBtn'),
    ]);
    expect(await xmindDownload.suggestedFilename()).toBe('case_library_import.xmind');
    const [excelDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#caseLibraryEditExportExcelBtn'),
    ]);
    expect(await excelDownload.suggestedFilename()).toBe('case_library_import.xlsx');

    await page.click('#caseLibraryEditListBody [data-case-lib-edit]');

    await expect(page.locator('#caseLibraryEditDrawer')).not.toHaveClass(/open/);
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditView th', { hasText: '实际结果' })).toHaveCount(0);
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录');

    await page.locator('#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="0"]').click();
    await page.locator('#caseLibraryEditView [data-case-lib-edit-field="title"][data-index="0"]').fill('正常登录（已更新）');
    await page.click('#caseLibraryEditClearSearchBtn');
    await expect(page.locator('#caseLibraryEditView')).toContainText('正常登录（已更新）');

    // 刷新页面后仍保持上次编辑的用例视图
    await reloadWithRetry(page);
    await waitCaseLibraryReady(page, 30000);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });
    await expect(page.locator('#flowNav')).toBeHidden();
    await expect(page.locator('#caseLibraryHead')).toBeVisible();
    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
    await expect(page.locator('#caseLibraryEditFileName')).toContainText('case_library_import');
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

  test('导入 Excel（xlsx）格式用例并入库', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '战魂铭人', description: '用于 Excel 导入' };
    const versions = [{ id: 11, name: 'v1' }];

    let nextCaseFileId = 100;
    let nextCaseItemId = 1000;
    const caseFiles = [];
    const caseItemsByFileId = {};

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
        const items = Array.isArray(payload.items) ? payload.items : [];
        // 期望 Excel 解析后至少包含两条用例（来自 fixture）
        if (items.length < 2) return respond(400, { detail: 'excel parse failed' });
        const first = items[0] || {};
        if (first.module !== '登录' || !String(first.title || '').includes('登录')) {
          return respond(400, { detail: 'excel payload mismatch' });
        }
        const fileName = payload.file_name || '';
        const base = String(fileName).split(/[\\/]/).pop();
        let clean = base.replace(/\.[^.]+$/, '').trim();
        const now = new Date().toISOString();
        const id = nextCaseFileId++;
        const file = {
          id,
          project_id: payload.project_id,
          version_id: payload.version_id,
          file_name_clean: clean,
          item_count: items.length,
          importer_id: user.id,
          importer_name: user.username,
          imported_at: now,
          updated_at: now,
          last_updated_by: user.id,
          last_updated_by_name: user.username,
        };
        caseFiles.push(file);
        caseItemsByFileId[id] = items.map((it) => ({
          id: nextCaseItemId++,
          case_file_id: id,
          module: it.module,
          title: it.title,
          expected: it.expected,
          priority: it.priority || null,
          precondition: it.precondition || it.preconditions || null,
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

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);
    await ensureCaseLibraryTab(page);

    const b64Path = path.join(__dirname, '..', 'fixtures', 'case_library_import.xlsx.base64');
    const b64 = fs.readFileSync(b64Path, 'utf-8').trim();
    const buffer = Buffer.from(b64, 'base64');

    await page.click('#openCaseLibraryImportDrawerBtn');
    await expect(page.locator('#caseLibraryImportDrawer')).toHaveClass(/open/);
    await page.setInputFiles('#caseLibraryImportInput', {
      name: 'case_library_excel_import.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    await page.selectOption('#caseLibraryImportProjectSelect', String(project.id));
    await expect(page.locator('#caseLibraryImportVersionSelect')).toBeEnabled();
    await page.selectOption('#caseLibraryImportVersionSelect', String(versions[0].id));
    await expect(page.locator('#caseLibraryImportConfirmBtn')).toBeEnabled();
    await page.click('#caseLibraryImportConfirmBtn');
    await expect(page.locator('#caseLibraryImportStatus')).toContainText('导入完成');
    // 导入成功后应清空文件选择，避免重复导入
    await expect(page.locator('#caseLibraryImportConfirmBtn')).toBeDisabled();
    await expect(page.locator('#caseLibraryImportFileHint')).toContainText('未选择文件');
  });

  test('导入模板下载：Excel 与 XMind', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '战魂铭人', description: '用于导入模板' };
    const versions = [{ id: 11, name: 'v1' }];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions`) return respond(200, versions);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return route.fallback();
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);
    await ensureCaseLibraryTab(page);

    await page.click('#openCaseLibraryImportDrawerBtn');
    await expect(page.locator('#caseLibraryImportDrawer')).toHaveClass(/open/);

    await page.waitForFunction(() => {
      const hasZip = typeof window.JSZip !== 'undefined' || typeof JSZip !== 'undefined';
      const api = window.app && (window.app.xmindCoreApi || window.app.xmindCore);
      const hasXmind = api && typeof api.buildXmindPackageFromCases === 'function';
      return Boolean(hasZip && hasXmind);
    }, {}, { timeout: 60000 });

    const [excelDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#caseLibraryImportExcelTemplateBtn'),
    ]);
    expect(await excelDownload.suggestedFilename()).toBe('用例导入模板.xlsx');

    const [xmindDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#caseLibraryImportXmindTemplateBtn'),
    ]);
    expect(await xmindDownload.suggestedFilename()).toBe('用例导入模板.xmind');
  });

  test('编辑抽屉支持全选/全取消并删除所选用例文件（需二次确认）', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '战魂铭人', description: '用于用例库删除' };
    const versions = [{ id: 11, name: 'v1' }];

	    const now = new Date().toISOString();
	    const caseFiles = [
      {
        id: 100,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例A',
        item_count: 2,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
      {
        id: 101,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例B',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
	      },
	    ];
	    const caseItemsByFileId = {
	      100: [
	        { id: 1, case_file_id: 100, module: '模块A', title: '用例A-1', expected: '预期', remark: '' },
	        { id: 2, case_file_id: 100, module: '模块A', title: '用例A-2', expected: '预期', remark: '' },
	      ],
	      101: [
	        { id: 3, case_file_id: 101, module: '模块B', title: '用例B', expected: '预期', remark: '' },
	      ],
	    };

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

	      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
	      if (itemsMatch && method === 'GET') {
	        const fileId = Number(itemsMatch[1]);
	        return respond(200, caseItemsByFileId[fileId] || []);
	      }

	      const delMatch = pathName.match(/^\/api\/case-files\/(\d+)$/);
	      if (delMatch && method === 'DELETE') {
	        const id = Number(delMatch[1]);
	        const idx = caseFiles.findIndex((f) => f && f.id === id);
        if (idx !== -1) caseFiles.splice(idx, 1);
        return respond(200, { detail: '用例文件已删除', case_file_id: id, linked_exec_sets: 0 });
      }

      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);

    await ensureCaseLibraryTab(page);

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');

	    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
	    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例A');
	    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例B');

	    // 先打开“用例A”的编辑视图，再回到抽屉删除，编辑视图应被清空/隐藏。
	    await page.click('#caseLibraryEditListBody [data-case-lib-edit="100"]');
	    await expect(page.locator('#caseLibraryEditDrawer')).not.toHaveClass(/open/);
	    await expect(page.locator('#caseLibraryEditCard')).toBeVisible();
	    await expect(page.locator('#caseLibraryEditFileName')).toContainText('用例A');

	    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
	    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));

	    await expect(page.locator('#caseLibraryEditDeleteBtn')).toBeDisabled();
	    await page.click('#caseLibraryEditSelectAll');
	    await expect(page.locator('#caseLibraryEditDeleteBtn')).toBeEnabled();

    page.once('dialog', async (dialog) => dialog.accept());
    await page.click('#caseLibraryEditDeleteBtn');

	    await expect(page.locator('#caseLibraryEditDrawerStatus')).toContainText('删除完成');
	    await expect(page.locator('#caseLibraryEditListBody')).toContainText('暂无用例文件');
	    await expect(page.locator('#caseLibraryEditDeleteBtn')).toBeDisabled();
	    await expect(page.locator('#caseLibraryEditCard')).toBeHidden();
	  });

  test('编辑用例&转到执行：支持按版本筛选（默认全部版本）', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '战魂铭人', description: '用于用例库版本筛选' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];

    const now = new Date().toISOString();
    const caseFiles = [
      {
        id: 100,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例v1',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
      {
        id: 101,
        project_id: project.id,
        version_id: versions[1].id,
        file_name_clean: '用例v2',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
    ];

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

      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);

    await ensureCaseLibraryTab(page);

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');

    await expect(page.locator('#caseLibraryEditVersionSelect')).toBeDisabled();
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));

    await expect(page.locator('#caseLibraryEditVersionSelect')).toBeEnabled();
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例v1');
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例v2');

    await page.selectOption('#caseLibraryEditVersionSelect', String(versions[0].id));
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例v1');
    await expect(page.locator('#caseLibraryEditListBody')).not.toContainText('用例v2');
  });

  test('编辑抽屉：非管理员可勾选并批量导出 XMind/Excel', async ({ page }) => {
    test.setTimeout(60 * 1000);
    const user = { id: 9, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '战魂铭人', description: '用于用例库批量导出' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];

    const now = new Date().toISOString();
    const caseFiles = [
      {
        id: 100,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例A',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
      {
        id: 101,
        project_id: project.id,
        version_id: versions[1].id,
        file_name_clean: '用例B',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
    ];
    const caseItemsByFileId = {
      100: [{ id: 1, case_file_id: 100, module: '模块', title: '用例A', priority: 'P1', precondition: '', steps: '步骤', expected: '预期', remark: '' }],
      101: [{ id: 2, case_file_id: 101, module: '模块', title: '用例B', priority: 'P1', precondition: '', steps: '步骤', expected: '预期', remark: '' }],
    };

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

      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        const fileId = Number(itemsMatch[1]);
        return respond(200, caseItemsByFileId[fileId] || []);
      }

      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);

    await ensureCaseLibraryTab(page);

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例A');
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例B');

    // 非管理员也可勾选；删除按钮应不可用/不可见，但导出按钮可用。
    await expect(page.locator('#caseLibraryEditDeleteBtn')).toBeHidden();
    await page.click('#caseLibraryEditSelectAll');
    await expect(page.locator('#caseLibraryEditExportXmindBtn')).toBeEnabled();
    await expect(page.locator('#caseLibraryEditExportExcelBtn')).toBeEnabled();

    // 依赖为本地 vendor（JSZip/XMind 导出）。在整文件串行跑时偶发资源加载抖动，先等待依赖可用，避免导出失败无下载。
    await page.waitForFunction(() => {
      const hasZip = typeof window.JSZip !== 'undefined' || typeof JSZip !== 'undefined';
      const api = window.app && (window.app.xmindCoreApi || window.app.xmindCore);
      const hasXmind = api && typeof api.buildXmindPackageFromCases === 'function';
      return Boolean(hasZip && hasXmind);
    }, {}, { timeout: 60000 });

    const [downloadZipXmind] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#caseLibraryEditExportXmindBtn'),
    ]);
    expect(await downloadZipXmind.suggestedFilename()).toBe('用例批量导出_xmind.zip');

    const [downloadZipExcel] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#caseLibraryEditExportExcelBtn'),
    ]);
    expect(await downloadZipExcel.suggestedFilename()).toBe('用例批量导出_excel.zip');
  });

  test('编辑抽屉：刷新页面后保持项目选择与勾选状态', async ({ page }) => {
    test.setTimeout(60 * 1000);
    const user = { id: 9, username: 'demo_user', role: 'user', level: 'member' };
    const project = { id: 1, name: '战魂铭人', description: '用于用例库抽屉刷新恢复' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];
    const now = new Date().toISOString();
    const caseFiles = [
      {
        id: 100,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例A',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
      {
        id: 101,
        project_id: project.id,
        version_id: versions[1].id,
        file_name_clean: '用例B',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
        last_updated_by: user.id,
        last_updated_by_name: user.username,
      },
    ];
    const caseItemsByFileId = {
      100: [{ id: 1, case_file_id: 100, module: '模块', title: '用例A', expected: '预期', remark: '' }],
      101: [{ id: 2, case_file_id: 101, module: '模块', title: '用例B', expected: '预期', remark: '' }],
    };

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

      const itemsMatch = pathName.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        const fileId = Number(itemsMatch[1]);
        return respond(200, caseItemsByFileId[fileId] || []);
      }

      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);

    await ensureCaseLibraryTab(page);

    await openDrawer(page, '#openCaseLibraryEditDrawerBtn', '#caseLibraryEditDrawer');
    await page.selectOption('#caseLibraryEditProjectSelect', String(project.id));
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例A');
    await expect(page.locator('#caseLibraryEditListBody')).toContainText('用例B');
    await page.click('#caseLibraryEditListBody input[data-case-lib-edit-select="100"]');
    await expect(page.locator('#caseLibraryEditExportXmindBtn')).toBeEnabled();
    await expect(page.locator('#caseLibraryEditExportExcelBtn')).toBeEnabled();

    await reloadWithRetry(page);
    await waitCaseLibraryReady(page, 60000);
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('case-library'); });

    await expect(page.locator('#caseLibraryEditDrawer')).toHaveClass(/open/);
    await expect(page.locator('#caseLibraryEditProjectSelect')).toHaveValue(String(project.id));
    await expect(page.locator('#caseLibraryEditListBody input[data-case-lib-edit-select="100"]')).toBeChecked();
    await expect(page.locator('#caseLibraryEditExportXmindBtn')).toBeEnabled();
    await expect(page.locator('#caseLibraryEditExportExcelBtn')).toBeEnabled();
  });

  test('选择用例执行：选择项目后自动加载列表，选择版本后自动过滤', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '战魂铭人', description: '用于选择执行' };
    const versions = [{ id: 11, name: 'v1' }, { id: 12, name: 'v2' }];
    const now = new Date().toISOString();
    const caseFiles = [
      {
        id: 100,
        project_id: project.id,
        version_id: versions[0].id,
        file_name_clean: '用例v1',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
      },
      {
        id: 101,
        project_id: project.id,
        version_id: versions[1].id,
        file_name_clean: '用例v2',
        item_count: 1,
        importer_id: user.id,
        importer_name: user.username,
        imported_at: now,
        updated_at: now,
      },
    ];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathName === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, versions);
      if (pathName === '/api/case-files' && method === 'GET') {
        const pid = url.searchParams.get('project_id');
        if (pid !== String(project.id)) return respond(200, []);
        return respond(200, caseFiles.slice().sort((a, b) => b.id - a.id));
      }
      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);
      if (pathName.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await gotoIndex(page);
    await waitCaseLibraryReady(page, 30000);

    await ensureCaseLibraryTab(page);

    await openDrawer(page, '#openCaseLibrarySelectExecDrawerBtn', '#caseLibrarySelectExecDrawer');

    await page.selectOption('#caseLibrarySelectProjectSelect', String(project.id));
    await expect(page.locator('#caseLibrarySelectListBody')).toContainText('用例v1');
    await expect(page.locator('#caseLibrarySelectListBody')).toContainText('用例v2');

    await page.selectOption('#caseLibrarySelectVersionSelect', String(versions[0].id));
    await expect(page.locator('#caseLibrarySelectListBody')).toContainText('用例v1');
    await expect(page.locator('#caseLibrarySelectListBody')).not.toContainText('用例v2');
  });
});
