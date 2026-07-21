const { test, expect } = require('@playwright/test');

test.describe('执行总览页（DB 接口接入）', () => {
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

  test('项目列表 -> 版本筛选 -> 人员汇总 -> 用例明细', async ({ page }) => {
    const vtableVendorRequests = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/scripts/vendor/vtable.es2019.min.js')) {
        vtableVendorRequests.push(request.url());
      }
    });
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const projects = [
      { id: 1, name: '战魂铭人', description: '用于执行总览' },
      { id: 2, name: '元气骑士', description: '用于执行总览' },
    ];
    const versionV1 = { id: 11, name: 'v1' };
    const versionV2 = { id: 12, name: 'v2' };
    const versionsByProject = {
      1: [versionV2, versionV1],
      2: [{ id: 21, name: 'v1' }],
    };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const layoutCalls = [];

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, projects);
      var versionsMatch = path.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch) {
        var pid = Number(versionsMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }

      if (path === '/api/exec/overview' && method === 'GET') {
        const projectId = url.searchParams.get('project_id');
        const versionId = url.searchParams.get('version_id');
        if (projectId === '2') {
          return respond(200, [
            {
              project_id: 2,
              version_id: null,
              user_id: user.id,
              username: user.username,
              total: 1,
              pending: 1,
              passed: 0,
              failed: 0,
              blocked: 0,
              not_applicable: 0,
            },
          ]);
        }
        if (versionId === String(versionV1.id)) {
          return respond(200, [
            {
              project_id: 1,
              version_id: versionV1.id,
              user_id: user.id,
              username: user.username,
              total: 3,
              pending: 1,
              passed: 1,
              failed: 1,
              blocked: 0,
              not_applicable: 0,
            },
          ]);
        }
        return respond(200, [
          {
            project_id: 1,
            version_id: null,
            user_id: user.id,
            username: user.username,
            total: 11,
            pending: 6,
            passed: 4,
            failed: 1,
            blocked: 0,
            not_applicable: 0,
          },
        ]);
      }

      if (path === '/api/exec/overview/layout' && method === 'GET') {
        const projectId = url.searchParams.get('project_id');
        const versionId = url.searchParams.get('version_id');
        const includeSets = url.searchParams.get('include_sets');
        layoutCalls.push({ projectId: projectId, versionId: versionId, includeSets: includeSets });
        const v1Stats = { version_id: 11, total: 9, pending: 5, passed: 3, failed: 1, blocked: 0, not_applicable: 0 };
        const v2Stats = { version_id: 12, total: 2, pending: 1, passed: 1, failed: 0, blocked: 0, not_applicable: 0 };
        const baseUser = {
          project_id: Number(projectId),
          version_id: versionId ? Number(versionId) : null,
          user_id: user.id,
          username: user.username,
          level: user.level,
          user_created_at: new Date('2020-01-01T00:00:00Z').toISOString(),
          total: 11,
          pending: 6,
          passed: 4,
          failed: 1,
          blocked: 0,
          not_applicable: 0,
          ui_placement: { versionOrderByProject: { 1: ['12', '11'] }, fileOrderByProjectVersion: { 1: { 11: ['200'], 12: [] } } },
          exec_sets: [],
          version_stats: [v1Stats, v2Stats],
        };
        if (projectId === '2') {
          return respond(200, [
            Object.assign({}, baseUser, {
              project_id: 2,
              total: 1,
              pending: 1,
              passed: 0,
              failed: 0,
              blocked: 0,
              not_applicable: 0,
              version_stats: [
                { version_id: 21, total: 1, pending: 1, passed: 0, failed: 0, blocked: 0, not_applicable: 0 },
              ],
            }),
          ]);
        }
        if (versionId === String(versionV1.id)) {
          return respond(200, [
            Object.assign({}, baseUser, {
              total: 3,
              pending: 0,
              passed: 2,
              failed: 1,
              blocked: 0,
              not_applicable: 0,
              version_stats: [
                { version_id: 11, total: 3, pending: 0, passed: 2, failed: 1, blocked: 0, not_applicable: 0 },
              ],
            }),
          ]);
        }
        return respond(200, [baseUser]);
      }

      if (path === '/api/exec/overview/layout/exec-sets' && method === 'GET') {
        const versionId = url.searchParams.get('version_id');
        const baseTime = (offset) => iso(now - offset);
        if (versionId === '21') {
          return respond(200, [
            { exec_set_id: 300, exec_set_name: '需求-战斗', version_id: 21, status: 'active', requirement: '', total: 1, pending: 1, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          ]);
        }
        if (versionId === String(versionV1.id)) {
          return respond(200, [
            { exec_set_id: 200, exec_set_name: '需求-登录', version_id: 11, status: 'archived', requirement: '', total: 3, pending: 0, passed: 2, failed: 1, blocked: 0, not_applicable: 0, created_at: baseTime(20000), updated_at: baseTime(2000) },
            { exec_set_id: 201, exec_set_name: '需求-注册', version_id: 11, status: 'active', requirement: '', total: 2, pending: 2, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: baseTime(18000), updated_at: baseTime(1000) },
            { exec_set_id: 202, exec_set_name: '需求-支付', version_id: 11, status: 'active', requirement: '', total: 4, pending: 3, passed: 1, failed: 0, blocked: 0, not_applicable: 0, created_at: baseTime(16000), updated_at: baseTime(1500) },
          ]);
        }
        if (versionId === String(versionV2.id)) {
          return respond(200, [
            { exec_set_id: 203, exec_set_name: '需求-支付-v2', version_id: 12, status: 'active', requirement: '', total: 2, pending: 1, passed: 1, failed: 0, blocked: 0, not_applicable: 0, created_at: baseTime(14000), updated_at: baseTime(800) },
          ]);
        }
        return respond(200, []);
      }

      if (path === '/api/exec/overview/cases' && method === 'GET') {
        const uid = url.searchParams.get('user_id');
        if (uid !== String(user.id)) return respond(200, []);
        return respond(200, [
          {
            exec_case_id: 100,
            exec_set_id: 200,
            exec_set_name: '需求-登录',
            version_id: versionV1.id,
            module: '登录',
            title: '正常登录',
            status: '通过',
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      var execCasesMatch = path.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        var execSetId = Number(execCasesMatch[1]);
        if (execSetId !== 200) return respond(200, []);
        return respond(200, [
          {
            id: 100,
            exec_set_id: 200,
            case_item_id: 1,
            module: '登录',
            title: '正常登录',
            expected: 'ok',
            priority: 'P0',
            precondition: '',
            steps: '1',
            actual_result: 'ok',
            defect_link: null,
            reuse_details: null,
            defect_links: null,
            remark: '',
            status: '通过',
            order_no: 1,
            executor_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      if (path === '/api/auth/logout') return respond(200, {});

      // 兜底：其它模块可能会在启动时请求 settings/models/features/ops 等接口。
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });

    await expect(page.locator('#flowNav')).toBeHidden();
    await expect(page.locator('#execOverviewHead')).toBeVisible();
    await expect(page.locator('section[data-tab-section="exec-overview"]')).toBeVisible();
    await expect(page.locator('#execOverviewNavProjects .nav-entry-card')).toHaveCount(2);
    await expect(page.locator('#execOverviewNavProjects')).toContainText('战魂铭人');
    await expect(page.locator('#execOverviewNavProjects')).toContainText('元气骑士');

    await page.click('#execOverviewNavProjects [data-project-id="2"]');
    await expect(page.locator('#execOverviewDetail')).toBeVisible();
    await expect(page.locator('#execOverviewProjectTitle')).toContainText('元气骑士');
    await expect(page.locator('#execOverviewNavProjects [data-project-id="2"]')).toHaveClass(/active/);
    await expect(page.locator('#execOverviewVersionSummary')).toBeVisible();
    await expect(page.locator('#execOverviewVersionSummary .exec-overview-version-summary-row')).toHaveCount(1);
    await expect(page.locator('#execOverviewVersionSummary .exec-overview-version-summary-row')).toContainText('v1（1条）');
    await expect(page.locator('#execOverviewUserCards')).toContainText('总数 1');
    await expect(page.locator('#execOverviewUserCards .exec-overview-version-box .head')).toContainText('v1（1条）');
    await expect(page.locator('#execOverviewUserCards .exec-overview-progress')).toHaveCount(0);
    await expect(page.locator('#execOverviewUserCards .exec-overview-file-progress')).toHaveCount(1);
    await expect(page.locator('#execOverviewUserCards')).not.toContainText('组长');

    await page.reload();
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });
    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });
    await expect(page.locator('#execOverviewDetail')).toBeVisible();
    await expect(page.locator('#execOverviewProjectTitle')).toContainText('元气骑士');
    await expect(page.locator('#execOverviewNavProjects [data-project-id="2"]')).toHaveClass(/active/);

    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    await expect(page.locator('#execOverviewDetail')).toBeVisible();

    await expect(page.locator('#execOverviewVersionSelect')).toContainText('全部版本');
    await expect(page.locator('#execOverviewVersionSelect')).toContainText('v1');

	    await expect(page.locator('#execOverviewUserCards')).toContainText(user.username);
	    await expect(page.locator('#execOverviewUserCards')).toContainText('总数 11');
	    await expect(page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id=\"200\"]')).toBeVisible();
	    await expect(page.locator('#execOverviewUserCards .tag-archived')).toBeVisible();
	    await expect(page.locator('#execOverviewUserCards .exec-overview-progress')).toHaveCount(0);
	    await expect(page.locator('#execOverviewUserCards .exec-overview-file-progress')).toHaveCount(4);
	    await expect(page.locator('#execOverviewUserCards .exec-overview-file-meta')).toHaveCount(4);

	    const summaryRows = page.locator('#execOverviewVersionSummary .exec-overview-version-summary-row');
	    await expect(summaryRows).toHaveCount(2);
	    await expect(summaryRows.nth(0)).toContainText('v2（2条）');
	    await expect(summaryRows.nth(0)).toContainText('已1/2');
	    await expect(summaryRows.nth(1)).toContainText('v1（9条）');
	    await expect(summaryRows.nth(1)).toContainText('已4/9');

	    const layoutStyles = await page.$eval('#execOverviewUserCards .exec-overview-layout', (el) => {
	      const style = getComputedStyle(el);
	      return { display: style.display, overflowX: style.overflowX };
	    });
	    expect(layoutStyles.display).toBe('flex');
	    expect(layoutStyles.overflowX).toMatch(/auto|scroll/);

	    await expect(page.locator('#execOverviewUserCards .exec-overview-version-box .head', { hasText: 'v2（2条）' })).toBeVisible();
	    await expect(page.locator('#execOverviewUserCards .exec-overview-version-box .head', { hasText: 'v1（9条）' })).toBeVisible();

	    const v1Body = page.locator('#execOverviewUserCards .exec-overview-version-box', { hasText: 'v1' }).locator('.body').first();
	    const v1BodyScrollable = await v1Body.evaluate((el) => el.scrollHeight > el.clientHeight);
	    expect(v1BodyScrollable).toBe(true);
	    const v1BodyHeight = await v1Body.evaluate((el) => Math.round(el.getBoundingClientRect().height));
	    const v2Body = page.locator('#execOverviewUserCards .exec-overview-version-box', { hasText: 'v2' }).locator('.body').first();
	    const v2BodyHeight = await v2Body.evaluate((el) => Math.round(el.getBoundingClientRect().height));
	    expect(Math.abs(v1BodyHeight - v2BodyHeight)).toBeLessThanOrEqual(2);
	    await expect(page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"] .exec-overview-file-meta')).toContainText('已3/3');
	    await expect(page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"] .exec-overview-kv.kv-pending')).toContainText('待0');
	    await expect(page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"] .exec-overview-kv.kv-passed')).toContainText('过2');
	    await expect(page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"] .exec-overview-kv.kv-failed')).toContainText('失1');

	    // 滚动后：后续执行集也应展示进度条，且进度条边界在卡片内
	    await v1Body.evaluate((el) => { el.scrollTop = el.scrollHeight; });
	    await expect(page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="202"] .exec-overview-file-progress')).toBeVisible();
	    const barInsideChip = await page
	      .locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="202"]')
	      .evaluate((chip) => {
	        const bar = chip.querySelector('.exec-overview-file-progress');
	        if (!bar) return false;
	        const cr = chip.getBoundingClientRect();
	        const br = bar.getBoundingClientRect();
	        return br.top >= cr.top && br.bottom <= cr.bottom && br.left >= cr.left && br.right <= cr.right;
	      });
	    expect(barInsideChip).toBe(true);

	    // “单条时高度”应作为基准：切到仅 1 条后再切回多条，子项高度保持一致（允许 2px 误差）
	    await page.selectOption('#execOverviewVersionSelect', String(versionV1.id));
	    const singleChipHeight = await page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"]').evaluate((el) =>
	      Math.round(el.getBoundingClientRect().height)
	    );
	    await page.selectOption('#execOverviewVersionSelect', '');
	    await page.waitForTimeout(200);
	    const multiChipHeight = await page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"]').evaluate((el) =>
	      Math.round(el.getBoundingClientRect().height)
	    );
	    expect(Math.abs(singleChipHeight - multiChipHeight)).toBeLessThanOrEqual(2);

    await page.selectOption('#execOverviewVersionSelect', String(versionV1.id));
    await expect(page.locator('#execOverviewUserCards')).toContainText('总数 3');
    await expect(page.locator('#execOverviewVersionSummary .exec-overview-version-summary-row')).toHaveCount(1);
    await expect(page.locator('#execOverviewVersionSummary')).toContainText('v1（9条）');
    await expect(page.locator('#execOverviewVersionSummary')).not.toContainText('v2');

    expect(vtableVendorRequests).toHaveLength(0);
    await page.click('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"]');
    await expect(page.locator('#execOverviewExecSetDrawer')).toHaveClass(/open/);
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table')).toContainText('正常登录');
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-canvas canvas')).toHaveCount(1);
    await expect.poll(() => vtableVendorRequests.length).toBe(1);

    const hasLayoutLiteNoVersion = layoutCalls.some(function(call) {
      if (!call) return false;
      if (call.includeSets !== '0') return false;
      if (call.versionId !== null && call.versionId !== '' && call.versionId !== undefined) return false;
      return true;
    });
    expect(hasLayoutLiteNoVersion).toBe(true);
  });

  test('执行总览版本筛选选择可持久化（按项目）', async ({ page }) => {
    const user = { id: 7, username: 'persist_user', role: 'admin', level: 'leader' };
    const projects = [
      { id: 1, name: '项目A', description: 'overview persist' },
      { id: 2, name: '项目B', description: 'overview persist' },
    ];
    const versionV1 = { id: 11, name: 'v1' };
    const versionV2 = { id: 12, name: 'v2' };
    const versionV3 = { id: 21, name: 'v1' };
    const versionsByProject = {
      1: [versionV1, versionV2],
      2: [versionV3],
    };
    const now = new Date('2024-01-01T00:00:00Z').toISOString();

    function buildUser(projectId, versionId, execSets) {
      var total = execSets.reduce(function(sum, item) { return sum + (item.total || 0); }, 0);
      var pending = execSets.reduce(function(sum, item) { return sum + (item.pending || 0); }, 0);
      var passed = execSets.reduce(function(sum, item) { return sum + (item.passed || 0); }, 0);
      var failed = execSets.reduce(function(sum, item) { return sum + (item.failed || 0); }, 0);
      var blocked = execSets.reduce(function(sum, item) { return sum + (item.blocked || 0); }, 0);
      var na = execSets.reduce(function(sum, item) { return sum + (item.not_applicable || 0); }, 0);
      var statsMap = {};
      execSets.forEach(function(item) {
        if (!item) return;
        var key = item.version_id === null || item.version_id === undefined ? '' : String(item.version_id);
        if (!statsMap[key]) {
          statsMap[key] = {
            version_id: key === '' ? null : Number(key),
            total: 0,
            pending: 0,
            passed: 0,
            failed: 0,
            blocked: 0,
            not_applicable: 0,
          };
        }
        statsMap[key].total += item.total || 0;
        statsMap[key].pending += item.pending || 0;
        statsMap[key].passed += item.passed || 0;
        statsMap[key].failed += item.failed || 0;
        statsMap[key].blocked += item.blocked || 0;
        statsMap[key].not_applicable += item.not_applicable || 0;
      });
      var versionStats = Object.keys(statsMap).map(function(key) { return statsMap[key]; });
      return {
        project_id: Number(projectId),
        version_id: versionId ? Number(versionId) : null,
        user_id: user.id,
        username: user.username,
        level: user.level,
        user_created_at: now,
        total: total,
        pending: pending,
        passed: passed,
        failed: failed,
        blocked: blocked,
        not_applicable: na,
        ui_placement: { versionOrderByProject: { 1: ['12', '11'], 2: ['21'] }, fileOrderByProjectVersion: { 1: { 11: ['101'], 12: ['102'] }, 2: { 21: ['201'] } } },
        exec_sets: [],
        version_stats: versionStats,
      };
    }

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, projects);
      var versionsMatch = path.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch) {
        var pid = Number(versionsMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }

      if (path === '/api/exec/overview/layout' && method === 'GET') {
        const projectId = url.searchParams.get('project_id');
        const versionId = url.searchParams.get('version_id');
        if (projectId === '2') {
          return respond(200, [
            buildUser(2, versionId, [
              { exec_set_id: 201, exec_set_name: '需求-搜索', version_id: 21, status: 'active', requirement: '', total: 2, pending: 2, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: now, updated_at: now },
            ]),
          ]);
        }
        if (versionId === String(versionV1.id)) {
          return respond(200, [
            buildUser(1, versionId, [
              { exec_set_id: 101, exec_set_name: '需求-登录', version_id: 11, status: 'active', requirement: '', total: 1, pending: 1, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: now, updated_at: now },
            ]),
          ]);
        }
        if (versionId === String(versionV2.id)) {
          return respond(200, [
            buildUser(1, versionId, [
              { exec_set_id: 102, exec_set_name: '需求-注册', version_id: 12, status: 'active', requirement: '', total: 3, pending: 2, passed: 1, failed: 0, blocked: 0, not_applicable: 0, created_at: now, updated_at: now },
            ]),
          ]);
        }
        return respond(200, [
          buildUser(1, null, [
            { exec_set_id: 101, exec_set_name: '需求-登录', version_id: 11, status: 'active', requirement: '', total: 1, pending: 1, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: now, updated_at: now },
            { exec_set_id: 102, exec_set_name: '需求-注册', version_id: 12, status: 'active', requirement: '', total: 3, pending: 2, passed: 1, failed: 0, blocked: 0, not_applicable: 0, created_at: now, updated_at: now },
          ]),
        ]);
      }

      if (path === '/api/exec/overview/layout/exec-sets' && method === 'GET') {
        const versionId = url.searchParams.get('version_id');
        if (versionId === '21') {
          return respond(200, [
            { exec_set_id: 201, exec_set_name: '需求-搜索', version_id: 21, status: 'active', requirement: '', total: 2, pending: 2, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: now, updated_at: now },
          ]);
        }
        if (versionId === String(versionV1.id)) {
          return respond(200, [
            { exec_set_id: 101, exec_set_name: '需求-登录', version_id: 11, status: 'active', requirement: '', total: 1, pending: 1, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: now, updated_at: now },
          ]);
        }
        if (versionId === String(versionV2.id)) {
          return respond(200, [
            { exec_set_id: 102, exec_set_name: '需求-注册', version_id: 12, status: 'active', requirement: '', total: 3, pending: 2, passed: 1, failed: 0, blocked: 0, not_applicable: 0, created_at: now, updated_at: now },
          ]);
        }
        return respond(200, []);
      }

      if (path === '/api/auth/logout') return respond(200, {});
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });

    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    await page.selectOption('#execOverviewVersionSelect', String(versionV1.id));
    await expect(page.locator('#execOverviewVersionSelect')).toHaveValue(String(versionV1.id));

    await page.click('#execOverviewNavProjects [data-project-id="2"]');
    await expect(page.locator('#execOverviewVersionSelect')).toHaveValue('');

    await page.reload();
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });
    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });

    await expect(page.locator('#execOverviewProjectTitle')).toContainText('项目B');
    await expect(page.locator('#execOverviewVersionSelect')).toHaveValue('');

    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    await expect(page.locator('#execOverviewVersionSelect')).toHaveValue(String(versionV1.id));
  });

  test('版本总览与个人区版本盒子仅近邻加载', async ({ page }) => {
    const user = { id: 8, username: 'lazy_user', role: 'admin', level: 'leader' };
    const projects = [{ id: 1, name: '总览虚拟化', description: 'overview lazy' }];
    const versions = [
      { id: 11, name: 'v1' },
      { id: 12, name: 'v2' },
      { id: 13, name: 'v3' },
      { id: 14, name: 'v4' },
      { id: 15, name: 'v5' },
      { id: 16, name: 'v6' },
    ];
    const now = new Date('2024-01-01T00:00:00Z').toISOString();
    const versionOrder = versions.map((v) => String(v.id));
    const fileOrderByVer = {};
    const execSets = versions.map((v, idx) => {
      const execSetId = 100 + idx;
      fileOrderByVer[v.id] = [String(execSetId)];
      return {
        exec_set_id: execSetId,
        exec_set_name: '需求-' + v.name,
        version_id: v.id,
        status: 'active',
        requirement: '',
        total: 1,
        pending: 1,
        passed: 0,
        failed: 0,
        blocked: 0,
        not_applicable: 0,
        created_at: now,
        updated_at: now,
      };
    });
    const versionStats = versions.map((v) => ({
      version_id: v.id,
      total: 1,
      pending: 1,
      passed: 0,
      failed: 0,
      blocked: 0,
      not_applicable: 0,
    }));

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, projects);
      var versionsMatch = path.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch) return respond(200, versions);

      if (path === '/api/exec/overview/layout' && method === 'GET') {
        return respond(200, [
          {
            project_id: 1,
            version_id: null,
            user_id: user.id,
            username: user.username,
            level: user.level,
            user_created_at: now,
            total: execSets.length,
            pending: execSets.length,
            passed: 0,
            failed: 0,
            blocked: 0,
            not_applicable: 0,
            ui_placement: { versionOrderByProject: { 1: versionOrder }, fileOrderByProjectVersion: { 1: fileOrderByVer } },
            exec_sets: [],
            version_stats: versionStats,
          },
        ]);
      }

      if (path === '/api/exec/overview/layout/exec-sets' && method === 'GET') {
        const versionId = url.searchParams.get('version_id');
        const list = execSets.filter((item) => String(item.version_id) === String(versionId));
        return respond(200, list);
      }

      if (path === '/api/auth/logout') return respond(200, {});
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });

    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    await expect(page.locator('#execOverviewVersionSummary .exec-overview-version-summary-row')).toHaveCount(6);
    await expect(page.locator('#execOverviewVersionSummary .exec-overview-version-summary-row:not(.placeholder)')).toHaveCount(4);
    await expect(page.locator('#execOverviewUserCards .exec-overview-version-box:not(.placeholder)')).toHaveCount(4);

    const layout = page.locator('#execOverviewUserCards .exec-overview-layout').first();
    const overflow = await layout.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflow).toBe(true);
    const bar = layout.locator('.exec-overview-scrollbar');
    await expect(bar).toHaveCount(1);
    const beforeOpacity = await bar.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    expect(beforeOpacity).toBeLessThan(0.1);
    await layout.hover();
    await page.waitForTimeout(200);
    const afterOpacity = await bar.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    expect(afterOpacity).toBeGreaterThan(0.1);

    const summaryBody = page.locator('#execOverviewVersionSummaryBody');
    await summaryBody.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(100);
    const v6Summary = page.locator('#execOverviewVersionSummary .exec-overview-version-summary-row', { hasText: 'v6' });
    await expect(v6Summary).not.toHaveClass(/placeholder/);

    await layout.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      el.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(100);
    const v6Box = page.locator('#execOverviewUserCards .exec-overview-version-box', { hasText: 'v6' }).first();
    await expect(v6Box).not.toHaveClass(/placeholder/);
  });

  test('个人区版本盒子滚轮优先上下滚动用例', async ({ page }) => {
    const user = { id: 10, username: 'wheel_user', role: 'admin', level: 'leader' };
    const projects = [{ id: 1, name: '滚轮冲突项目', description: 'overview wheel' }];
    const versions = [
      { id: 11, name: 'v1' },
      { id: 12, name: 'v2' },
      { id: 13, name: 'v3' },
      { id: 14, name: 'v4' },
      { id: 15, name: 'v5' },
    ];
    const now = new Date('2024-01-01T00:00:00Z').toISOString();
    const versionOrder = versions.map((v) => String(v.id));
    const fileOrderByVer = {};
    const execSets = [];
    for (let i = 0; i < 6; i += 1) {
      const execSetId = 300 + i;
      fileOrderByVer[11] = fileOrderByVer[11] || [];
      fileOrderByVer[11].push(String(execSetId));
      execSets.push({
        exec_set_id: execSetId,
        exec_set_name: '需求-登录-' + i,
        version_id: 11,
        status: 'active',
        requirement: '',
        total: 1,
        pending: 1,
        passed: 0,
        failed: 0,
        blocked: 0,
        not_applicable: 0,
        created_at: now,
        updated_at: now,
      });
    }
    versions.slice(1).forEach((ver, idx) => {
      const execSetId = 400 + idx;
      fileOrderByVer[ver.id] = [String(execSetId)];
      execSets.push({
        exec_set_id: execSetId,
        exec_set_name: '需求-' + ver.name,
        version_id: ver.id,
        status: 'active',
        requirement: '',
        total: 1,
        pending: 1,
        passed: 0,
        failed: 0,
        blocked: 0,
        not_applicable: 0,
        created_at: now,
        updated_at: now,
      });
    });
    const statsMap = {};
    execSets.forEach((item) => {
      const key = String(item.version_id);
      if (!statsMap[key]) {
        statsMap[key] = {
          version_id: item.version_id,
          total: 0,
          pending: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          not_applicable: 0,
        };
      }
      statsMap[key].total += item.total || 0;
      statsMap[key].pending += item.pending || 0;
      statsMap[key].passed += item.passed || 0;
      statsMap[key].failed += item.failed || 0;
      statsMap[key].blocked += item.blocked || 0;
      statsMap[key].not_applicable += item.not_applicable || 0;
    });
    const versionStats = Object.keys(statsMap).map((key) => statsMap[key]);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, projects);
      var versionsMatch = path.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch) return respond(200, versions);

      if (path === '/api/exec/overview/layout' && method === 'GET') {
        return respond(200, [
          {
            project_id: 1,
            version_id: null,
            user_id: user.id,
            username: user.username,
            level: user.level,
            user_created_at: now,
            total: execSets.length,
            pending: execSets.length,
            passed: 0,
            failed: 0,
            blocked: 0,
            not_applicable: 0,
            ui_placement: { versionOrderByProject: { 1: versionOrder }, fileOrderByProjectVersion: { 1: fileOrderByVer } },
            exec_sets: [],
            version_stats: versionStats,
          },
        ]);
      }

      if (path === '/api/exec/overview/layout/exec-sets' && method === 'GET') {
        const versionId = url.searchParams.get('version_id');
        const list = execSets.filter((item) => String(item.version_id) === String(versionId));
        return respond(200, list);
      }

      if (path === '/api/auth/logout') return respond(200, {});
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });

    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    const layout = page.locator('#execOverviewUserCards .exec-overview-layout').first();
    const v1Body = page.locator('#execOverviewUserCards .exec-overview-version-box', { hasText: 'v1' }).locator('.body').first();
    const scrollable = await v1Body.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrollable).toBe(true);

    await v1Body.hover();
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(120);
    const bodyScrollTop = await v1Body.evaluate((el) => el.scrollTop);
    const layoutScrollLeft = await layout.evaluate((el) => el.scrollLeft);
    expect(bodyScrollTop).toBeGreaterThan(0);
    expect(layoutScrollLeft).toBeLessThanOrEqual(1);
  });

  test('执行列表实际结果为空时使用状态兜底展示', async ({ page }) => {
    const user = { id: 6, username: 'overview_user', role: 'user', level: 'member' };
    const projects = [{ id: 1, name: '演示项目', description: 'exec overview' }];
    const versionV1 = { id: 11, name: 'v1' };
    const now = new Date().toISOString();

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, projects);
      var versionsMatch = path.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch) return respond(200, [versionV1]);

      if (path === '/api/exec/overview/layout' && method === 'GET') {
        return respond(200, [
          {
            project_id: 1,
            version_id: versionV1.id,
            user_id: user.id,
            username: user.username,
            level: user.level,
            user_created_at: now,
            total: 1,
            pending: 0,
            passed: 1,
            failed: 0,
            blocked: 0,
            not_applicable: 0,
            ui_placement: { versionOrderByProject: { 1: ['11'] }, fileOrderByProjectVersion: { 1: { 11: ['200'] } } },
            exec_sets: [],
            version_stats: [
              { version_id: versionV1.id, total: 1, pending: 0, passed: 1, failed: 0, blocked: 0, not_applicable: 0 },
            ],
          },
        ]);
      }

      if (path === '/api/exec/overview/layout/exec-sets' && method === 'GET') {
        const versionId = url.searchParams.get('version_id');
        if (versionId !== String(versionV1.id)) return respond(200, []);
        return respond(200, [
          {
            exec_set_id: 200,
            exec_set_name: '需求-登录',
            version_id: versionV1.id,
            status: 'active',
            requirement: '',
            total: 1,
            pending: 0,
            passed: 1,
            failed: 0,
            blocked: 0,
            not_applicable: 0,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      var execCasesMatch = path.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        var execSetId = Number(execCasesMatch[1]);
        if (execSetId !== 200) return respond(200, []);
        return respond(200, [
          {
            id: 100,
            exec_set_id: 200,
            case_item_id: 1,
            module: '登录',
            title: '正常登录',
            expected: 'ok',
            priority: 'P0',
            precondition: '',
            steps: '1',
            actual_result: '',
            defect_link: null,
            reuse_details: null,
            defect_links: null,
            remark: '',
            status: '通过',
            order_no: 1,
            executor_id: user.id,
            created_at: now,
            updated_at: now,
          },
        ]);
      }

      if (path === '/api/auth/logout') return respond(200, {});
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });

    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    await page.click('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"]');

    const row = page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table tbody tr').first();
    const headers = page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table thead th');
    await expect(headers).toHaveCount(4);
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table thead')).not.toContainText('状态');
    const actualCell = row.locator('td').nth(2);
    await expect(actualCell).toContainText('通过');
  });

  test('版本总览 NA 标识展示为不适用', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const projects = [{ id: 1, name: '战魂铭人', description: '用于执行总览' }];
    const versionV1 = { id: 11, name: 'v1' };
    const versionsByProject = { 1: [versionV1] };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, projects);
      var versionsMatch = path.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch) {
        var pid = Number(versionsMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }
      if (path === '/api/exec/overview' && method === 'GET') {
        return respond(200, [
          {
            project_id: 1,
            version_id: versionV1.id,
            user_id: user.id,
            username: user.username,
            total: 5,
            pending: 1,
            passed: 2,
            failed: 0,
            blocked: 0,
            not_applicable: 2,
          },
        ]);
      }
      if (path === '/api/exec/overview/layout' && method === 'GET') {
        return respond(200, [
          {
            project_id: 1,
            version_id: versionV1.id,
            user_id: user.id,
            username: user.username,
            level: user.level,
            user_created_at: new Date('2020-01-01T00:00:00Z').toISOString(),
            total: 5,
            pending: 1,
            passed: 2,
            failed: 0,
            blocked: 0,
            not_applicable: 2,
            ui_placement: { versionOrderByProject: { 1: ['11'] }, fileOrderByProjectVersion: { 1: { 11: ['200'] } } },
            exec_sets: [],
            version_stats: [
              { version_id: 11, total: 5, pending: 1, passed: 2, failed: 0, blocked: 0, not_applicable: 2 },
            ],
          },
        ]);
      }
      if (path === '/api/exec/overview/layout/exec-sets' && method === 'GET') {
        const versionId = url.searchParams.get('version_id');
        if (versionId !== String(versionV1.id)) return respond(200, []);
        return respond(200, [
          {
            exec_set_id: 200,
            exec_set_name: '需求-登录',
            version_id: 11,
            status: 'active',
            requirement: '',
            total: 5,
            pending: 1,
            passed: 2,
            failed: 0,
            blocked: 0,
            not_applicable: 2,
            created_at: iso(now - 20000),
            updated_at: iso(now - 2000),
          },
        ]);
      }
      if (path === '/api/auth/logout') return respond(200, {});
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });

    await expect(page.locator('#execOverviewNavProjects [data-project-id="1"]')).toBeVisible();
    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    const summaryRows = page.locator('#execOverviewVersionSummary .exec-overview-version-summary-row');
    await expect(summaryRows).toHaveCount(1);
    const naTag = summaryRows.locator('.exec-overview-kv.kv-na');
    await expect(naTag).toHaveText('不适用2');
  });

  test('执行列表抽屉支持搜索与分页（分页大小读取“其他设置”）', async ({ page }) => {
    const user = { id: 9, username: 'demo_admin', role: 'admin', level: 'leader' };
    const projects = [{ id: 1, name: '战魂铭人', description: '用于执行总览' }];
    const versionsByProject = { 1: [{ id: 11, name: 'v1' }] };
    const pageSize = 6;
    const settings = [{ scope: 'user', owner_id: user.id, key: 'tempExecPageSize', value_json: pageSize }];

    const buildCases = (count) =>
      Array.from({ length: count }).map((_, i) => ({
        id: 1000 + i + 1,
        exec_set_id: 200,
        module: i % 2 === 0 ? '登录' : '支付',
        title: '用例 ' + String(i + 1),
        expected: 'ok',
        priority: 'P0',
        precondition: '',
        steps: '1',
        actual_result: i % 3 === 0 ? 'ok' : '',
        defect_link: null,
        reuse_details: null,
        defect_links: null,
        remark: '',
        status: i % 3 === 0 ? '通过' : '未执行',
        order_no: i + 1,
        executor_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    const cases = buildCases(13);

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path === '/api/users/me') return respond(200, user);
      if (path === '/api/projects') return respond(200, projects);
      var versionsMatch = path.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (versionsMatch) {
        var pid = Number(versionsMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }

      if (path === '/api/settings' && method === 'GET') return respond(200, settings);
      if (path === '/api/settings' && method === 'PUT') return respond(200, settings);

      if (path === '/api/exec/overview/layout' && method === 'GET') {
        return respond(200, [
          {
            project_id: 1,
            version_id: null,
            user_id: user.id,
            username: user.username,
            level: user.level,
            user_created_at: new Date('2020-01-01T00:00:00Z').toISOString(),
            total: cases.length,
            pending: cases.length,
            passed: 0,
            failed: 0,
            blocked: 0,
            not_applicable: 0,
            ui_placement: { versionOrderByProject: { 1: ['11'] }, fileOrderByProjectVersion: { 1: { 11: ['200'] } } },
            exec_sets: [],
            version_stats: [
              { version_id: 11, total: cases.length, pending: cases.length, passed: 0, failed: 0, blocked: 0, not_applicable: 0 },
            ],
          },
        ]);
      }

      if (path === '/api/exec/overview/layout/exec-sets' && method === 'GET') {
        const versionId = url.searchParams.get('version_id');
        if (versionId !== '11') return respond(200, []);
        return respond(200, [
          { exec_set_id: 200, exec_set_name: '需求-登录', version_id: 11, status: 'active', requirement: '', total: cases.length, pending: cases.length, passed: 0, failed: 0, blocked: 0, not_applicable: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ]);
      }

      var execCasesMatch = path.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (execCasesMatch && method === 'GET') {
        var execSetId = Number(execCasesMatch[1]);
        if (execSetId !== 200) return respond(200, []);
        return respond(200, cases);
      }

      if (path === '/api/auth/logout') return respond(200, {});
      if (path.startsWith('/api/')) return respond(200, []);
      return respond(404, { detail: 'not found' });
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tab-group-btn[data-group="cases"]', { timeout: 20000 });
    await page.waitForFunction(() => window.app && typeof window.app.switchTab === 'function', { timeout: 20000 });
    await page.waitForFunction(() => window.app && window.app.state && window.app.authReady === true, null, { timeout: 20000 });
    await page.waitForFunction((size) => window.app && window.app.state && window.app.state.tempExecPageSize === size, pageSize, { timeout: 20000 });

    await page.click('.tab-group-btn[data-group="cases"]');
    await page.click('[data-group-menu="cases"] [data-tab-btn="exec-overview"]');
    await page.evaluate(() => { if (window.app && window.app.switchTab) window.app.switchTab('exec-overview'); });
    await expect(page.locator('#execOverviewNavProjects .nav-entry-card')).toHaveCount(1);

    await page.click('#execOverviewNavProjects [data-project-id="1"]');
    await expect(page.locator('#execOverviewDetail')).toBeVisible();
    await expect(page.locator('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"]')).toBeVisible();

    await page.click('#execOverviewUserCards .exec-overview-file-chip[data-exec-set-id="200"]');
    await expect(page.locator('#execOverviewExecSetDrawer')).toHaveClass(/open/);
    await expect(page.locator('#execOverviewExecSetPaginationTop')).toContainText('每页 ' + String(pageSize) + ' 条');
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table tbody tr')).toHaveCount(pageSize);
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table')).toContainText('用例 1');
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table')).toContainText('用例 ' + String(pageSize));

    await page.locator('[data-exec-overview-page="next"]').first().click();
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table')).toContainText('用例 ' + String(pageSize + 1));

    await page.fill('#execOverviewExecSetSearchInput', '用例 12');
    await expect(page.locator('#execOverviewExecSetSearchClearBtn')).not.toBeDisabled();
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table tbody tr')).toHaveCount(1);
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table')).toContainText('用例 12');

    await page.click('#execOverviewExecSetSearchClearBtn');
    await expect(page.locator('#execOverviewExecSetSearchInput')).toHaveValue('');
    await expect(page.locator('#execOverviewExecSetSearchClearBtn')).toBeDisabled();
    await expect(page.locator('#execOverviewExecSetTableHost .tap-vtable-semantic-table tbody tr')).toHaveCount(pageSize);
  });
});
