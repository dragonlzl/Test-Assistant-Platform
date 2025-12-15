const { test, expect } = require('@playwright/test');

test.describe('用例执行-项目/版本分组布局', () => {
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

  test('按项目/版本分组渲染、排序、拖拽限制与重排', async ({ page }) => {
    const user = { id: 1, username: 'ui_admin', role: 'admin', level: 'leader' };
    const projects = [
      { id: 1, name: '项目A', description: '' },
      { id: 2, name: '项目B', description: '' },
    ];
    const versionsByProject = {
      1: [
        { id: 11, project_id: 1, name: 'v1' },
        { id: 12, project_id: 1, name: 'v2' },
      ],
      2: [{ id: 21, project_id: 2, name: 'v3' }],
    };
    const now = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const execSets = [
      { id: 1001, project_id: 1, version_id: 11, case_file_id: 101, case_count: 1, name: '用例A', status: 'active', created_at: iso(now - 20000), updated_at: iso(now - 1000) },
      { id: 1002, project_id: 1, version_id: 11, case_file_id: 102, case_count: 1, name: '用例B', status: 'active', created_at: iso(now - 15000), updated_at: iso(now - 900) },
      { id: 1003, project_id: 1, version_id: 12, case_file_id: 103, case_count: 1, name: '用例C', status: 'active', created_at: iso(now - 5000), updated_at: iso(now - 100) },
      { id: 2001, project_id: 2, version_id: 21, case_file_id: 201, case_count: 1, name: '用例D', status: 'active', created_at: iso(now - 1000), updated_at: iso(now - 50) },
    ];
    const casesBySet = {};
    execSets.forEach((set) => {
      casesBySet[set.id] = [
        {
          id: set.id * 10 + 1,
          exec_set_id: set.id,
          case_item_id: null,
          module: '模块',
          title: '标题',
          expected: '预期',
          priority: 'P1',
          precondition: '前提',
          steps: '步骤',
          actual_result: null,
          defect_link: null,
          reuse_details: null,
          defect_links: null,
          remark: null,
          status: set.id === 1001 ? '失败' : '未执行',
          order_no: 1,
          executor_id: user.id,
          created_at: set.created_at,
          updated_at: set.updated_at,
        },
      ];
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathName = url.pathname;
      const method = route.request().method();
      const respond = (status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (pathName === '/api/users/me') return respond(200, user);
      if (pathName === '/api/projects' && method === 'GET') return respond(200, projects);
      const verMatch = pathName.match(/^\/api\/projects\/(\d+)\/versions$/);
      if (verMatch && method === 'GET') {
        const pid = Number(verMatch[1]);
        return respond(200, versionsByProject[pid] || []);
      }

      if (pathName === '/api/settings' && method === 'GET') return respond(200, []);
      if (pathName === '/api/settings' && method === 'PUT') return respond(200, []);
      if (pathName === '/api/models' && method === 'GET') return respond(200, []);
      if (pathName === '/api/features' && method === 'GET') return respond(200, []);
      if (pathName === '/api/ops' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview' && method === 'GET') return respond(200, []);
      if (pathName === '/api/exec/overview/cases' && method === 'GET') return respond(200, []);

      if (pathName === '/api/exec/sets' && method === 'GET') return respond(200, execSets.slice());
      const casesMatch = pathName.match(/^\/api\/exec\/sets\/(\d+)\/cases$/);
      if (casesMatch && method === 'GET') {
        const execSetId = Number(casesMatch[1]);
        return respond(200, casesBySet[execSetId] || []);
      }

      if (pathName === '/api/auth/logout') return respond(200, {});
      if (pathName.startsWith('/api/') && method === 'GET') return respond(200, []);
      return respond(200, {});
    });

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true);

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
    await expect(page.locator('#createTempVersionBtn')).toBeDisabled();

    await page.waitForFunction(() => {
      const grid = document.getElementById('tempVersionGrid');
      if (!grid) return false;
      return grid.querySelectorAll('.temp-project-card').length >= 2;
    });
    await expect(page.locator('#tempExecNav')).toHaveClass(/hidden/);

    const projectTitles = await page.$$eval('#tempVersionGrid .temp-project-card .temp-project-header .title', (nodes) =>
      nodes.map((n) => (n.textContent || '').trim())
    );
    expect(projectTitles[0]).toBe('项目B');
    expect(projectTitles[1]).toBe('项目A');

    const projectACard = page.locator('#tempVersionGrid .temp-project-card', { hasText: '项目A' }).first();
    const versionTitles = (await projectACard.locator('.temp-project-version-header .title').allTextContents()).map((t) => t.trim());
    expect(versionTitles[0]).toBe('v2');
    expect(versionTitles[1]).toBe('v1');

    const v1Card = projectACard.locator('.temp-project-version', { hasText: 'v1' }).first();
    const v1Body = v1Card.locator('.temp-project-version-body');
    const v1Rows = v1Body.locator('.temp-req-row[data-temp-file]');
    await expect(v1Rows).toHaveCount(2);
    const beforeOrder = await v1Rows.locator('.name-text').allTextContents();
    expect(beforeOrder.map((t) => t.trim())).toEqual(['用例B', '用例A']);

    // 存在失败/阻塞时：用例行应标红（不要求全部执行完）
    await page.waitForFunction(() => {
      const row = document.querySelector('.temp-req-row[data-temp-file="1001"]');
      return row && row.classList && row.classList.contains('err');
    });

    await v1Rows.nth(1).dragTo(v1Body, { targetPosition: { x: 10, y: 5 } });
    const afterOrder = await v1Rows.locator('.name-text').allTextContents();
    expect(afterOrder.map((t) => t.trim())).toEqual(['用例A', '用例B']);

    // 点击整行（含条数徽标）也能切换激活用例
    await v1Rows.first().locator('.temp-req-count-badge').click();
    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 5000 }
    ).toBe('1001');

    // 再点一次切换到另一份用例，并模拟某些场景重复触发 tempexec 激活事件：不应把 activeId 回滚
    await v1Rows.nth(1).click();
    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 5000 }
    ).toBe('1002');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('app-tab-activated', { detail: { tab: 'tempexec' } }));
    });
    await expect.poll(
      () => page.evaluate(() => (window.app && window.app.state ? String(window.app.state.tempExecActiveId || '') : '')),
      { timeout: 5000 }
    ).toBe('1002');

    const v2Card = projectACard.locator('.temp-project-version', { hasText: 'v2' }).first();
    const v2Body = v2Card.locator('.temp-project-version-body');
    await v1Rows.nth(0).dragTo(v2Body, { targetPosition: { x: 10, y: 10 } });
    await expect(page.locator('#tempExecStatus')).toContainText('不支持拖拽移动用例');
    await expect(v2Body).not.toContainText('用例A');
    await expect(v1Body).toContainText('用例A');

    const v1Header = v1Card.locator('.temp-project-version-header').first();
    const v2Header = v2Card.locator('.temp-project-version-header').first();
    await v1Header.dragTo(v2Header);
    const versionTitlesAfterReorder = (await projectACard.locator('.temp-project-version-header .title').allTextContents()).map((t) => t.trim());
    expect(versionTitlesAfterReorder[0]).toBe('v1');
    expect(versionTitlesAfterReorder[1]).toBe('v2');

    // 支持向后插入：将 v1 拖到 v2 后面（模拟拖到右下半区）
    const v1HeaderAfter = projectACard.locator('.temp-project-version-header', { hasText: 'v1' }).first();
    const v2HeaderAfter = projectACard.locator('.temp-project-version-header', { hasText: 'v2' }).first();
    const v2Box = await v2HeaderAfter.boundingBox();
    await v1HeaderAfter.dragTo(v2HeaderAfter, {
      targetPosition: { x: v2Box ? Math.max(5, Math.floor(v2Box.width - 6)) : 80, y: v2Box ? Math.max(5, Math.floor(v2Box.height - 4)) : 26 },
    });
    const versionTitlesAfterReorder2 = (await projectACard.locator('.temp-project-version-header .title').allTextContents()).map((t) => t.trim());
    expect(versionTitlesAfterReorder2[0]).toBe('v2');
    expect(versionTitlesAfterReorder2[1]).toBe('v1');

    const projectAHeader = projectACard.locator('.temp-project-header').first();
    const projectBCard = page.locator('#tempVersionGrid .temp-project-card', { hasText: '项目B' }).first();
    const projectBHeader = projectBCard.locator('.temp-project-header').first();
    await projectAHeader.dragTo(projectBHeader);
    const projectTitlesAfterReorder = await page.$$eval('#tempVersionGrid .temp-project-card .temp-project-header .title', (nodes) =>
      nodes.map((n) => (n.textContent || '').trim())
    );
    expect(projectTitlesAfterReorder[0]).toBe('项目A');
    expect(projectTitlesAfterReorder[1]).toBe('项目B');
  });
});
