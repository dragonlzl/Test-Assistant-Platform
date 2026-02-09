const { test, expect } = require('@playwright/test');

test.describe('用例关联抽屉与转执行开关', () => {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

  async function waitForAppReady(page) {
    await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && window.app.state && window.app.apiClient, null, { timeout: 30000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', null, { timeout: 30000 });
  }

  async function switchToTab(page, tabName) {
    await page.evaluate((name) => {
      if (window.app && typeof window.app.switchTab === 'function') window.app.switchTab(name);
    }, tabName);
  }

  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('tap-auth-token', 'assoc-token');
      } catch (_) {
        // ignore
      }
    });
  });

  test('新增/编辑/删除关联 + 开关控制转执行', async ({ page }) => {
    const user = { id: 7001, username: 'assoc_admin', role: 'admin', level: 'leader' };
    const project = { id: 1, name: '关联项目', description: '' };
    const version = { id: 11, name: 'v1' };

    const caseFiles = [
      {
        id: 101,
        project_id: 1,
        version_id: 11,
        file_name_clean: '主用例A',
        item_count: 2,
        reuse_enabled: false,
        importer_name: '导入人',
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 102,
        project_id: 1,
        version_id: 11,
        file_name_clean: '副用例B',
        item_count: 2,
        reuse_enabled: false,
        importer_name: '导入人',
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 103,
        project_id: 1,
        version_id: 11,
        file_name_clean: '副用例C',
        item_count: 1,
        reuse_enabled: false,
        importer_name: '导入人',
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const caseItemsByFileId = {
      101: [
        { id: 1101, module: '登录', title: 'A-1', priority: 'P0', precondition: '无', steps: '步骤A1', expected: '结果A1' },
        { id: 1102, module: '登录', title: 'A-2', priority: 'P1', precondition: '无', steps: '步骤A2', expected: '结果A2' },
      ],
      102: [
        { id: 1201, module: '支付', title: 'B-1', priority: 'P0', precondition: '无', steps: '步骤B1', expected: '结果B1' },
        { id: 1202, module: '支付', title: 'B-2', priority: 'P1', precondition: '无', steps: '步骤B2', expected: '结果B2' },
      ],
      103: [
        { id: 1301, module: '订单', title: 'C-1', priority: 'P1', precondition: '无', steps: '步骤C1', expected: '结果C1' },
      ],
    };

    let nextAssocId = 9001;
    const associationsByMain = {};
    const transferPayloads = [];
    let nextExecSetId = 5001;
    const execSets = [];
    const execCasesBySetId = {};

    associationsByMain[String(103)] = [
      {
        id: nextAssocId++,
        main_case_file_id: 103,
        sub_case_file_id: 102,
        sub_case_file_name: '副用例B',
        selected_case_item_ids: [1201],
        selected_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    function getMainAssociationRows(mainId) {
      return Array.isArray(associationsByMain[String(mainId)]) ? associationsByMain[String(mainId)] : [];
    }

    function getCaseFileById(fileId) {
      return caseFiles.find((item) => Number(item.id) === Number(fileId)) || null;
    }

    function rebuildCaseFileList() {
      return caseFiles.map((item) => {
        const rows = getMainAssociationRows(item.id);
        return Object.assign({}, item, {
          association_count: rows.length,
        });
      });
    }

    function buildAssociationCandidates(mainCaseId) {
      return rebuildCaseFileList().map((item) => {
        let forbidden = false;
        let reason = null;
        if (Number(item.id) === Number(mainCaseId)) {
          forbidden = true;
          reason = '不能选择当前主用例';
        } else {
          const alreadyLinked = getMainAssociationRows(mainCaseId).some((row) => Number(row.sub_case_file_id) === Number(item.id));
          if (alreadyLinked) {
            forbidden = true;
            reason = '已关联到当前主用例';
          } else {
            const reverse = getMainAssociationRows(item.id).some((row) => Number(row.sub_case_file_id) === Number(mainCaseId));
            if (reverse) {
              forbidden = true;
              reason = '已存在反向关联';
            }
          }
        }
        return {
          id: item.id,
          project_id: item.project_id,
          version_id: item.version_id,
          file_name_clean: item.file_name_clean,
          item_count: item.item_count,
          association_count: item.association_count,
          association_forbidden: forbidden,
          forbidden_reason: reason,
        };
      });
    }

    function buildExecCasesForMain(mainCaseId, associationEnabled) {
      const mainItems = Array.isArray(caseItemsByFileId[mainCaseId]) ? caseItemsByFileId[mainCaseId] : [];
      const rows = [];
      mainItems.forEach((item, idx) => {
        rows.push({
          id: 100000 + rows.length,
          exec_set_id: 0,
          case_item_id: item.id,
          module: item.module,
          title: item.title,
          expected: item.expected,
          priority: item.priority,
          precondition: item.precondition,
          steps: item.steps,
          remark: '',
          status: '未执行',
          order_no: idx + 1,
        });
      });
      if (associationEnabled) {
        const assocRows = getMainAssociationRows(mainCaseId);
        assocRows.forEach((assoc) => {
          const subItems = Array.isArray(caseItemsByFileId[assoc.sub_case_file_id]) ? caseItemsByFileId[assoc.sub_case_file_id] : [];
          const selectedIds = Array.isArray(assoc.selected_case_item_ids) ? assoc.selected_case_item_ids : [];
          selectedIds.forEach((id) => {
            const hit = subItems.find((item) => Number(item.id) === Number(id));
            if (!hit) return;
            rows.push({
              id: 100000 + rows.length,
              exec_set_id: 0,
              case_item_id: null,
              module: hit.module,
              title: hit.title,
              expected: hit.expected,
              priority: hit.priority,
              precondition: hit.precondition,
              steps: hit.steps,
              remark: '',
              status: '未执行',
              order_no: rows.length + 1,
            });
          });
        });
      }
      return rows;
    }

    await page.route('**/api/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;
      const method = req.method();
      const respond = (status, body) => route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, [project]);
      if (path === '/api/projects/1/versions') return respond(200, [version]);
      if (path === '/api/settings' && method === 'GET') {
        return respond(200, [
          {
            id: 1,
            scope: 'user',
            owner_id: user.id,
            key: 'tempExecPageSize',
            value_json: 2,
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      if (path === '/api/case-files' && method === 'GET') {
        const pid = Number(url.searchParams.get('project_id') || '0');
        if (pid !== project.id) return respond(200, []);
        return respond(200, rebuildCaseFileList());
      }

      if (path === '/api/exec/sets/by-case-file' && method === 'GET') {
        return respond(200, []);
      }

      const assocCandidateMatch = path.match(/^\/api\/case-files\/(\d+)\/association-candidates$/);
      if (assocCandidateMatch && method === 'GET') {
        const mainId = Number(assocCandidateMatch[1]);
        const versionId = Number(url.searchParams.get('version_id') || '0');
        let candidates = buildAssociationCandidates(mainId);
        if (versionId > 0) {
          candidates = candidates.filter((item) => Number(item.version_id) === versionId);
        }
        return respond(200, candidates);
      }

      const assocListMatch = path.match(/^\/api\/case-files\/(\d+)\/associations$/);
      if (assocListMatch && method === 'GET') {
        const mainId = Number(assocListMatch[1]);
        return respond(200, getMainAssociationRows(mainId));
      }
      if (assocListMatch && method === 'POST') {
        const mainId = Number(assocListMatch[1]);
        const payload = req.postDataJSON();
        const selected = Array.isArray(payload.selected_case_item_ids) ? payload.selected_case_item_ids.slice() : [];
        if (!selected.length) return respond(400, { detail: '请先勾选至少一条副用例' });
        const existed = getMainAssociationRows(mainId).some((item) => Number(item.sub_case_file_id) === Number(payload.sub_case_file_id));
        if (existed) return respond(409, { detail: '关联已存在' });
        const subCase = getCaseFileById(payload.sub_case_file_id);
        const row = {
          id: nextAssocId++,
          main_case_file_id: mainId,
          sub_case_file_id: payload.sub_case_file_id,
          sub_case_file_name: subCase ? subCase.file_name_clean : ('用例#' + payload.sub_case_file_id),
          selected_case_item_ids: selected,
          selected_count: selected.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const list = getMainAssociationRows(mainId).slice();
        list.push(row);
        associationsByMain[String(mainId)] = list;
        return respond(201, row);
      }

      const assocItemMatch = path.match(/^\/api\/case-files\/(\d+)\/associations\/(\d+)$/);
      if (assocItemMatch && method === 'PATCH') {
        const mainId = Number(assocItemMatch[1]);
        const assocId = Number(assocItemMatch[2]);
        const payload = req.postDataJSON();
        const selected = Array.isArray(payload.selected_case_item_ids) ? payload.selected_case_item_ids.slice() : [];
        if (!selected.length) return respond(400, { detail: '请先勾选至少一条副用例' });
        const list = getMainAssociationRows(mainId).slice();
        const idx = list.findIndex((item) => Number(item.id) === assocId);
        if (idx < 0) return respond(404, { detail: '关联不存在' });
        list[idx] = Object.assign({}, list[idx], {
          selected_case_item_ids: selected,
          selected_count: selected.length,
          updated_at: new Date().toISOString(),
        });
        associationsByMain[String(mainId)] = list;
        return respond(200, list[idx]);
      }
      if (assocItemMatch && method === 'DELETE') {
        const mainId = Number(assocItemMatch[1]);
        const assocId = Number(assocItemMatch[2]);
        const list = getMainAssociationRows(mainId).filter((item) => Number(item.id) !== assocId);
        associationsByMain[String(mainId)] = list;
        return respond(200, { detail: 'ok' });
      }

      const caseItemsMatch = path.match(/^\/api\/case-files\/(\d+)\/items$/);
      if (caseItemsMatch && method === 'GET') {
        const caseFileId = Number(caseItemsMatch[1]);
        return respond(200, caseItemsByFileId[caseFileId] || []);
      }

      if (path === '/api/exec/sets' && method === 'GET') {
        return respond(200, []);
      }

      if (path === '/api/exec/sets/from-case-file' && method === 'POST') {
        const payload = req.postDataJSON();
        transferPayloads.push(payload);
        const caseFileId = Number(payload.case_file_id);
        let set = execSets.find((item) => Number(item.case_file_id) === caseFileId) || null;
        if (!set) {
          set = {
            id: nextExecSetId++,
            project_id: project.id,
            version_id: version.id,
            case_file_id: caseFileId,
            name: (getCaseFileById(caseFileId) || {}).file_name_clean || '测试用例',
            status: 'active',
            reuse_enabled: false,
            association_enabled: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          execSets.push(set);
        }
        const associationEnabled = payload.association_enabled === true;
        const rows = buildExecCasesForMain(caseFileId, associationEnabled);
        execCasesBySetId[String(set.id)] = rows.map((item) => Object.assign({}, item, { exec_set_id: set.id }));
        set.association_enabled = associationEnabled;
        set.case_count = rows.length;
        set.updated_at = new Date().toISOString();
        return respond(200, Object.assign({}, set));
      }

      const execCasesMatch = path.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        const execSetId = Number(execCasesMatch[1]);
        return respond(200, execCasesBySetId[String(execSetId)] || []);
      }

      if (path === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (path === '/api/exec/archives' && method === 'GET') return respond(200, []);

      if (method === 'GET') return respond(200, []);
      return respond(200, { ok: true });
    });

    await page.goto(base + '/case-library.html');
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);

    await page.evaluate(() => {
      if (window.app && window.app.caseLibraryApi && typeof window.app.caseLibraryApi.openSelectExecDrawer === 'function') {
        window.app.caseLibraryApi.openSelectExecDrawer({ allowInactive: true });
        return;
      }
      const btn = document.getElementById('openCaseLibrarySelectExecDrawerBtn');
      if (btn) btn.click();
    });
    await page.waitForFunction(() => {
      const el = document.getElementById('caseLibrarySelectProjectSelect');
      return el && el.options && el.options.length > 1;
    });
    await page.selectOption('#caseLibrarySelectProjectSelect', '1');
    await expect(page.locator('#caseLibrarySelectExecDrawer thead')).toContainText('关联用例');

    await page.click('[data-case-lib-association="101"]');
    await expect(page.locator('#caseLibraryAssociationDrawer')).toHaveClass(/open/);

    await page.click('#caseLibraryAssociationAddBtn');
    await expect(page.locator('#caseLibraryAssociationPickDrawer')).toHaveClass(/open/);
    await page.waitForFunction(() => {
      const el = document.getElementById('caseLibraryAssociationPickVersionSelect');
      return el && el.options && el.options.length > 1;
    });
    await page.selectOption('#caseLibraryAssociationPickVersionSelect', '11');
    await page.click('#caseLibraryAssociationPickQueryBtn');
    await page.check('[data-case-lib-assoc-subcase="102"]');
    await page.click('#caseLibraryAssociationPickNextBtn');
    await expect(page.locator('#caseLibraryAssociationItemDrawer')).toHaveClass(/open/);
    await page.waitForSelector('[data-case-lib-assoc-item="1201"]');
    await page.check('[data-case-lib-assoc-item="1201"]');
    await page.click('#caseLibraryAssociationPickConfirmBtn');

    await expect(page.locator('#caseLibraryAssociationListBody')).toContainText('副用例B');

    await page.click('#caseLibraryAssociationAddBtn');
    await expect(page.locator('#caseLibraryAssociationPickDrawer')).toHaveClass(/open/);
    await page.selectOption('#caseLibraryAssociationPickVersionSelect', '11');
    await page.click('#caseLibraryAssociationPickQueryBtn');
    await expect(page.locator('[data-case-lib-assoc-subcase="102"]')).toBeDisabled();
    await expect(page.locator('#caseLibraryAssociationPickCaseBody')).toContainText('已关联到当前主用例');
    await page.click('#caseLibraryAssociationPickDrawer button[data-drawer-close="caseLibraryAssociationPickDrawer"]:has-text("取消")');
    await expect(page.locator('#caseLibraryAssociationPickDrawer')).not.toHaveClass(/open/);

    await page.click('[data-case-lib-assoc-edit]');
    await expect(page.locator('#caseLibraryAssociationItemDrawer')).toHaveClass(/open/);
    await page.waitForFunction(() => {
      const el = document.getElementById('caseLibraryAssociationPickDrawer');
      return el && !el.classList.contains('open') && !el.classList.contains('closing');
    });
    await expect(page.locator('[data-case-lib-assoc-item="1201"]')).toBeChecked();
    await page.check('[data-case-lib-assoc-item="1202"]');
    await page.click('#caseLibraryAssociationPickConfirmBtn');
    await page.waitForFunction(() => {
      const el = document.getElementById('caseLibraryAssociationItemDrawer');
      return el && !el.classList.contains('open') && !el.classList.contains('closing');
    });

    await page.evaluate(() => {
      const el = document.getElementById('caseLibraryAssociationDrawer');
      if (el) {
        el.classList.remove('open');
        el.classList.remove('closing');
      }
    });
    await page.waitForFunction(() => !document.querySelector('#caseLibraryAssociationDrawer.open, #caseLibraryAssociationDrawer.closing'));
    await page.waitForSelector('#caseLibrarySelectExecDrawer.open');

    await page.evaluate(() => {
      window.app = window.app || {};
      window.app.execVersionDrawer = {
        open: function() {
          return Promise.resolve({ ok: true, versionId: 11 });
        },
      };
      window.app.switchTab = function() {
        return false;
      };
    });

    await page.uncheck('[data-case-lib-association-switch="101"]');
    await page.click('[data-case-lib-exec="101"]');
    await expect(page.locator('#appConfirmDrawer')).toHaveClass(/open/);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('不关联直接转执行');
    await page.click('#appConfirmDrawerConfirmBtn');
    await expect.poll(() => transferPayloads.length).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      if (window.app && window.app.caseLibraryApi && typeof window.app.caseLibraryApi.openSelectExecDrawer === 'function') {
        window.app.caseLibraryApi.openSelectExecDrawer({ allowInactive: true });
        return;
      }
      const btn = document.getElementById('openCaseLibrarySelectExecDrawerBtn');
      if (btn) btn.click();
    });
    await page.waitForSelector('[data-case-lib-association-switch="101"]');

    const firstPayload = transferPayloads[0] || {};
    expect(firstPayload.association_enabled).toBeFalsy();

    await expect(page.locator('[data-case-lib-association-switch="103"]')).toBeChecked();
    await expect(page.locator('[data-case-lib-exec="103"]')).toBeEnabled();
    await page.evaluate(() => {
      const btn = document.querySelector('[data-case-lib-exec="103"]');
      if (btn) {
        btn.disabled = false;
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });

    await expect.poll(() => transferPayloads.length).toBeGreaterThanOrEqual(2);
    expect(transferPayloads[1].association_enabled).toBeTruthy();
    expect(Number(transferPayloads[1].case_file_id)).toBe(103);

    await page.evaluate(() => {
      if (window.app && window.app.caseLibraryApi && typeof window.app.caseLibraryApi.openSelectExecDrawer === 'function') {
        window.app.caseLibraryApi.openSelectExecDrawer({ allowInactive: true });
        return;
      }
      const btn = document.getElementById('openCaseLibrarySelectExecDrawerBtn');
      if (btn) btn.click();
    });
    await page.waitForSelector('[data-case-lib-association="101"]');
    await page.click('[data-case-lib-association="101"]');
    await expect(page.locator('#caseLibraryAssociationDrawer')).toHaveClass(/open/);
    await page.click('[data-case-lib-assoc-delete]');
    await expect(page.locator('#caseLibraryAssociationDeleteConfirmDrawer')).toHaveClass(/open/);
    await page.click('#caseLibraryAssociationDeleteConfirmBtn');
    await expect(page.locator('#caseLibraryAssociationListBody')).toContainText('暂无关联副用例');
  });
});
