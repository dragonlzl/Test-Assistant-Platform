const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function waitForAppReady(page) {
  await page.waitForFunction(() => window.app && window.app._inited === true, null, { timeout: 30000 });
  await page.waitForFunction(() => window.app && window.app.tempExecApi && typeof window.app.tempExecApi.loadTempExecState === 'function', null, { timeout: 30000 });
}

test.describe('复用预设获取方式自动标记不适用', () => {
  test('角色皮肤按解锁方式批量应用且人工结果清除自动来源', async ({ page }) => {
    const token = 'reuse-applicability-token';
    const user = { id: 72, username: 'reuse_applicability', role: 'user', level: 'member' };
    const project = { id: 7, name: '元气骑士', description: '' };
    const now = new Date().toISOString();
    const execSet = {
      id: 9720,
      project_id: project.id,
      version_id: null,
      case_file_id: null,
      name: '角色皮肤全集',
      status: 'active',
      reuse_enabled: true,
      reuse_presets: [
        { id: 'preset-a', text: 'A皮肤' },
        { id: 'preset-b', text: 'B皮肤' },
      ],
      created_at: now,
      updated_at: now,
    };
    const execCases = [
      {
        id: 972001,
        exec_set_id: execSet.id,
        case_item_id: 1,
        module: '付费皮肤',
        title: '付费解锁',
        expected: '解锁成功',
        priority: 'P1',
        precondition: '',
        steps: '尝试解锁皮肤',
        status: '未执行',
        remark: '',
        defect_links: [],
        reuse_details: [
          { id: 'paid-a', presetId: 'preset-a', text: 'A皮肤', note: '', status: '未执行', removed: false },
          { id: 'paid-b', presetId: 'preset-b', text: 'B皮肤', note: '', status: '未执行', removed: false },
        ],
        order_no: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: 972002,
        exec_set_id: execSet.id,
        case_item_id: 2,
        module: '小鱼干皮肤',
        title: '小鱼干解锁',
        expected: '解锁成功',
        priority: 'P1',
        precondition: '',
        steps: '尝试解锁皮肤',
        status: '未执行',
        remark: '',
        defect_links: [],
        reuse_details: [
          { id: 'fish-a', presetId: 'preset-a', text: 'A皮肤', note: '', status: '未执行', removed: false },
          { id: 'fish-b', presetId: 'preset-b', text: 'B皮肤', note: '', status: '未执行', removed: false },
        ],
        order_no: 2,
        created_at: now,
        updated_at: now,
      },
      {
        id: 972003,
        exec_set_id: execSet.id,
        case_item_id: 3,
        module: '宝石皮肤',
        title: '宝石解锁',
        expected: '解锁成功',
        priority: 'P1',
        precondition: '',
        steps: '尝试解锁皮肤',
        status: '未执行',
        remark: '',
        defect_links: [],
        reuse_details: [
          { id: 'gem-a', presetId: 'preset-a', text: 'A皮肤', note: '', status: '未执行', removed: false },
          { id: 'gem-b', presetId: 'preset-b', text: 'B皮肤', note: '', status: '未执行', removed: false },
        ],
        order_no: 3,
        created_at: now,
        updated_at: now,
      },
      {
        id: 972004,
        exec_set_id: execSet.id,
        case_item_id: 4,
        module: '通用',
        title: '皮肤外形',
        expected: '展示正确',
        priority: 'P1',
        precondition: '',
        steps: '观察皮肤',
        status: '未执行',
        remark: '',
        defect_links: [],
        reuse_details: [
          { id: 'common-a', presetId: 'preset-a', text: 'A皮肤', note: '', status: '未执行', removed: false },
          { id: 'common-b', presetId: 'preset-b', text: 'B皮肤', note: '', status: '未执行', removed: false },
        ],
        order_no: 4,
        created_at: now,
        updated_at: now,
      },
    ];
    let batchPayload = null;
    let manualPatchPayload = null;

    await page.addInitScript((tk) => {
      try { localStorage.setItem('tap-auth-token', tk); } catch (_) {}
      try { sessionStorage.setItem('usecase-active-tab', 'tempexec'); } catch (_) {}
    }, token);

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.fallback();
      }
      return route.abort();
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const method = route.request().method();
      const respond = (status, body) => route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

      if (pathname === '/api/users/me' && method === 'GET') return respond(200, user);
      if (pathname === '/api/projects' && method === 'GET') return respond(200, [project]);
      if (pathname === `/api/projects/${project.id}/versions` && method === 'GET') return respond(200, []);
      if (pathname === '/api/case-files' && method === 'GET') return respond(200, []);
      if (pathname === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathname === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathname === '/api/models' && method === 'GET') return respond(200, []);
      if (pathname === '/api/features' && method === 'GET') return respond(200, []);
      if (pathname === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathname.startsWith('/api/exec/overview') && method === 'GET') return respond(200, []);
      if (pathname === '/api/exec/sets' && method === 'GET') return respond(200, [execSet]);
      if (pathname === `/api/exec/sets/${execSet.id}/cases` && method === 'GET') return respond(200, execCases);
      if (pathname === `/api/exec/sets/${execSet.id}/case-library-sync` && method === 'POST') {
        return respond(200, {
          exec_set_id: execSet.id,
          case_file_id: null,
          ever_changed: false,
          has_new_diff: false,
          should_auto_popup: false,
          summary: { added: 0, updated: 0, deleted: 0 },
          diff: [],
        });
      }
      if (pathname === `/api/exec/sets/${execSet.id}/reuse-applicability` && method === 'PATCH') {
        batchPayload = JSON.parse(route.request().postData() || '{}');
        execSet.reuse_presets = batchPayload.reuse_presets || [];
        (batchPayload.cases || []).forEach((change) => {
          const target = execCases.find((item) => item.id === change.case_id);
          if (!target) return;
          target.reuse_details = change.reuse_details;
          target.status = change.status;
        });
        return respond(200, {
          exec_set_id: execSet.id,
          updated_cases: (batchPayload.cases || []).length,
          updated_case_ids: (batchPayload.cases || []).map((item) => item.case_id),
          reuse_presets: execSet.reuse_presets,
        });
      }
      if (pathname === `/api/exec/cases/${execCases[0].id}` && method === 'PATCH') {
        manualPatchPayload = JSON.parse(route.request().postData() || '{}');
        Object.assign(execCases[0], manualPatchPayload);
        return respond(200, execCases[0]);
      }
      if (pathname === '/api/auth/logout') return respond(200, {});
      if (pathname.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    await page.goto(base + '/case-exec.html?tab=tempexec');
    await waitForAppReady(page);
    await page.evaluate(() => window.app.tempExecApi.loadTempExecState());

    const presetSelects = page.locator('#tempExecView .preset-applicability-select');
    await expect(presetSelects).toHaveCount(2);
    await expect(page.locator('#tempExecView .preset-profile-label')).toHaveCount(0);
    await expect(page.locator(`[data-temp-reuse-applicability-apply="${execSet.id}"]`)).toHaveText('快速执行');

    await presetSelects.nth(0).selectOption('paid');
    await presetSelects.nth(1).selectOption('fish');

    const batchWait = page.waitForResponse((response) => {
      return response.url().includes(`/api/exec/sets/${execSet.id}/reuse-applicability`)
        && response.request().method() === 'PATCH';
    });
    await page.click(`[data-temp-reuse-applicability-apply="${execSet.id}"]`);
    await expect(page.locator('#appConfirmDrawerMessage')).toContainText('设置不适用 4 项');
    await page.click('#appConfirmDrawerConfirmBtn');
    await batchWait;

    expect(batchPayload).toBeTruthy();
    expect(batchPayload.reuse_presets[0].applicability.value).toBe('paid');
    expect(batchPayload.reuse_presets[1].applicability.value).toBe('fish');
    expect(batchPayload.cases).toHaveLength(3);
    const paidChange = batchPayload.cases.find((item) => item.case_id === execCases[0].id);
    const fishChange = batchPayload.cases.find((item) => item.case_id === execCases[1].id);
    const gemChange = batchPayload.cases.find((item) => item.case_id === execCases[2].id);
    expect(paidChange.reuse_details.map((item) => item.status)).toEqual(['未执行', '不适用']);
    expect(fishChange.reuse_details.map((item) => item.status)).toEqual(['不适用', '未执行']);
    expect(gemChange.reuse_details.map((item) => item.status)).toEqual(['不适用', '不适用']);
    expect(batchPayload.cases.some((item) => item.case_id === execCases[3].id)).toBeFalsy();

    await page.click(`[data-temp-reuse-panel="${execSet.id}"][data-index="0"]`);
    const paidPanel = page.locator(`[data-temp-reuse-panel-container="${execSet.id}"][data-index="0"]`);
    await expect(paidPanel.locator('select.status-select')).toHaveCount(2);
    await expect(paidPanel.locator('select.status-select').nth(1)).toHaveValue('不适用');

    const manualWait = page.waitForResponse((response) => {
      return response.url().includes(`/api/exec/cases/${execCases[0].id}`)
        && response.request().method() === 'PATCH';
    });
    await paidPanel.locator('select.status-select').nth(1).selectOption('通过');
    await manualWait;
    const manuallyUpdated = manualPatchPayload.reuse_details.find((item) => item.id === 'paid-b');
    expect(manuallyUpdated.status).toBe('通过');
    expect(manuallyUpdated.statusOrigin).toBeUndefined();
    expect(manuallyUpdated.statusOriginProfile).toBeUndefined();
  });
});
