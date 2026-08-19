const { test, expect } = require('@playwright/test');

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';

async function setupPage(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('tap-auth-token', 'casegen-entry-progress-token'); } catch (err) {}
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
      return route.continue();
    }
    return route.abort();
  });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = url.pathname === '/api/users/me'
      ? { id: 601, username: 'casegen_progress', role: 'admin', level: 'leader' }
      : (method === 'GET' ? [] : {});
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(base + '/ai-workflow.html?tab=casesgen');
  await page.waitForFunction(() => {
    return window.app
      && window.app._inited === true
      && window.app.casesGenApi
      && typeof window.app.casesGenApi.renderCaseGenProgressBoard === 'function';
  }, null, { timeout: 30000 });
}

test.describe('XMind 用例生成首页进度', () => {
  test('入口上移并展示真实任务进度、百分比和状态', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupPage(page);

    await expect(page.locator('#sidebarTabCasegen')).toHaveCount(0);
    await expect(page.locator('#caseGenProgressPanel')).toHaveCount(0);
    await expect(page.locator('#xmindCaseGenHomeProgressPercent')).toHaveText('0%');
    await expect(page.locator('#xmindCaseGenHomeProgressList')).toContainText('暂无生成任务');

    await page.evaluate(() => {
      var original = window.app.xmindCasegenApi;
      window.app.xmindCasegenApi = Object.assign({}, original, {
        getWorkspaceProgressItems: function() {
          return [
            {
              id: 'running-workspace',
              title: '角色皮肤需求',
              statusText: '生成中',
              statusCls: 'is-running',
              moduleCount: 6,
              caseCount: 24,
              progressPercent: 60,
              progressLabel: '生成模块用例 3/6',
            },
            {
              id: 'done-workspace',
              title: '商城支付需求',
              statusText: '未入库',
              statusCls: 'is-dirty',
              moduleCount: 4,
              caseCount: 18,
              progressPercent: 100,
              progressLabel: '生成完成',
            },
            {
              id: 'error-workspace',
              title: '登录兼容需求',
              statusText: '失败',
              statusCls: 'is-error',
              moduleCount: 2,
              caseCount: 5,
              progressPercent: 40,
              progressLabel: '生成失败',
            },
          ];
        },
        openWorkspace: function(workspaceId) {
          window.__casegenHomeOpenedWorkspace = workspaceId;
          return true;
        },
      });
      window.app.casesGenApi.renderCaseGenProgressBoard();
    });

    const taskCards = page.locator('#xmindCaseGenHomeProgressList [data-casegen-home-workspace]');
    await expect(taskCards).toHaveCount(3);
    await expect(page.locator('#xmindCaseGenHomeProgressPercent')).toHaveText('67%');
    await expect(page.locator('#xmindCaseGenHomeProgressTrack')).toHaveAttribute('aria-valuenow', '67');
    await expect(page.locator('#xmindCaseGenHomeProgressMeta')).toContainText('3 个任务');
    await expect(page.locator('#xmindCaseGenHomeProgressMeta')).toContainText('1 个进行中');
    await expect(page.locator('#xmindCaseGenHomeProgressMeta')).toContainText('1 个失败');
    await expect(page.locator('#xmindCaseGenHomeProgressMeta')).toContainText('12 个模块');
    await expect(page.locator('#xmindCaseGenHomeProgressMeta')).toContainText('47 条用例');
    await expect(taskCards.nth(0)).toContainText('60%');
    await expect(taskCards.nth(0)).toContainText('生成模块用例 3/6');
    await expect(taskCards.nth(1)).toContainText('100%');
    await expect(taskCards.nth(2)).toContainText('生成失败');

    await expect.poll(() => page.evaluate(() => {
      var track = document.getElementById('xmindCaseGenHomeProgressTrack');
      var fill = document.getElementById('xmindCaseGenHomeProgressFill');
      if (!track || !fill) return 0;
      return fill.getBoundingClientRect().width / track.getBoundingClientRect().width;
    })).toBeGreaterThan(0.65);

    const geometry = await page.evaluate(() => {
      var entry = document.querySelector('.xmind-casegen-entry-content');
      var progress = document.getElementById('xmindCaseGenHomeProgress');
      var task = document.querySelector('.xmind-casegen-home-task');
      var overallTrack = document.getElementById('xmindCaseGenHomeProgressTrack');
      var overallFill = document.getElementById('xmindCaseGenHomeProgressFill');
      return {
        entryTop: entry.getBoundingClientRect().top,
        entryBottom: entry.getBoundingClientRect().bottom,
        progressTop: progress.getBoundingClientRect().top,
        buttonRadius: getComputedStyle(task).borderTopLeftRadius,
        overallRatio: overallFill.getBoundingClientRect().width / overallTrack.getBoundingClientRect().width,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(geometry.entryTop).toBeLessThan(180);
    expect(geometry.entryBottom).toBeLessThan(geometry.progressTop);
    expect(geometry.buttonRadius).toBe('4px');
    expect(geometry.overallRatio).toBeGreaterThan(0.65);
    expect(geometry.overallRatio).toBeLessThan(0.69);
    expect(geometry.pageOverflow).toBeLessThanOrEqual(1);

    await taskCards.first().click();
    await expect.poll(() => page.evaluate(() => window.__casegenHomeOpenedWorkspace || ''))
      .toBe('running-workspace');

    await page.setViewportSize({ width: 720, height: 720 });
    const narrow = await page.evaluate(() => ({
      columns: getComputedStyle(document.getElementById('xmindCaseGenHomeProgressList')).gridTemplateColumns,
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(narrow.columns.trim().split(/\s+/)).toHaveLength(1);
    expect(narrow.pageOverflow).toBeLessThanOrEqual(1);
  });
});
