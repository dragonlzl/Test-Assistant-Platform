const { test, expect } = require('@playwright/test');

test.describe('启动缓存恢复', () => {
  test('异常过大的本地流程缓存不会阻塞页面启动', async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });

    await page.addInitScript(() => {
      try {
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.setItem('usecase-workflow-state-v1', 'x'.repeat(1600001));
        localStorage.setItem('tap-xmind-casegen-tasks', 'y'.repeat(950001));
      } catch (err) {
        // ignore
      }
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
      timeout: 20000,
    });

    await expect.poll(async () => {
      return await page.evaluate(() => {
        return {
          workflow: localStorage.getItem('usecase-workflow-state-v1'),
          tasks: localStorage.getItem('tap-xmind-casegen-tasks'),
          user: window.app && window.app.state && window.app.state.currentUser
            ? window.app.state.currentUser.username
            : '',
        };
      });
    }).toEqual({
      workflow: null,
      tasks: null,
      user: 'e2e',
    });
  });

  test('主流程缓存超限时，大量残留的 XMind 任务会被整仓清理，不会在启动时逐条清理卡死', async ({ page }) => {
    const tasks = [];
    let idx = 0;
    let rawLength = 0;
    while (idx < 420 && rawLength < 760000) {
      tasks.push({
        id: 'xmind-bulk-clear-' + idx,
        status: 'done',
        scope: 'root',
        actionId: 'full_cases',
        workspaceId: 'workspace-' + idx,
        updatedAt: Date.now() - idx,
        restoreContext: {
          workspaceId: 'workspace-' + idx,
          requirementLabel: '批量清理需求-' + idx,
          rawText: '需求正文-' + idx + '-' + 'x'.repeat(1200),
          caseText: '',
          importedCases: [],
          caseGenModules: [],
          caseGenResults: {},
          operationSnapshots: [],
          nextSnapshotId: 1,
          history: [],
          rootPipeline: null,
          prep: {
            step: 3,
            requirementMode: 'manual',
            requirementSupplement: '',
            manualRequirementLabel: '批量清理需求-' + idx,
            manualRequirementBlocks: [{
              type: 'text',
              text: '需求正文-' + idx,
            }],
            caseImportMode: 'skip',
            completed: true,
            baseLocked: true,
          },
          viewState: {
            drawerOpen: idx % 2 === 0,
            fullscreen: false,
            transform: '',
            scaleVal: 1,
            scrollLeft: 0,
            scrollTop: 0,
            collapsedNodeKeys: [],
            treeSourceSignature: '',
            updatedAt: Date.now() - idx,
          },
        },
      });
      rawLength = JSON.stringify(tasks).length;
      idx += 1;
    }
    const tasksRaw = JSON.stringify(tasks);
    expect(tasksRaw.length).toBeLessThan(900000);
    expect(tasks.length).toBeGreaterThan(150);

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('file:')) {
        return route.continue();
      }
      return route.abort();
    });

    await page.addInitScript((payload) => {
      try {
        window.__pwXmindTaskEventCount = 0;
        window.addEventListener('xmind-casegen-task', function() {
          window.__pwXmindTaskEventCount = Number(window.__pwXmindTaskEventCount || 0) + 1;
        });
        localStorage.setItem('tap-e2e-skip-auth', '1');
        localStorage.setItem('usecase-workflow-state-v1', 'x'.repeat(1600001));
        localStorage.setItem('tap-xmind-casegen-tasks', String(payload.tasksRaw || '[]'));
      } catch (err) {
        // ignore
      }
    }, {
      tasksRaw,
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
      timeout: 10000,
    });

    await expect.poll(async () => {
      return await page.evaluate(() => {
        return {
          workflow: localStorage.getItem('usecase-workflow-state-v1'),
          tasks: localStorage.getItem('tap-xmind-casegen-tasks'),
          taskEventCount: Number(window.__pwXmindTaskEventCount || 0),
          user: window.app && window.app.state && window.app.state.currentUser
            ? window.app.state.currentUser.username
            : '',
        };
      });
    }).toEqual({
      workflow: null,
      tasks: null,
      taskEventCount: 1,
      user: 'e2e',
    });
  });
});
