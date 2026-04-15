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

  test('三页签大体量 XMind 快照会被紧凑持久化，刷新后仍能恢复而不会把首屏拖死', async ({ page }) => {
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
      } catch (err) {
        // ignore
      }
    });

    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090';
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
      timeout: 10000,
    });

    const persisted = await page.evaluate(() => {
      function clone(value) {
        return JSON.parse(JSON.stringify(value));
      }

      function buildCases(workspaceIndex, moduleIndex, count) {
        var list = [];
        for (var idx = 0; idx < count; idx += 1) {
          list.push({
            title: '页签' + workspaceIndex + '-模块' + moduleIndex + '-用例' + (idx + 1),
            precondition: '前置：准备账号、环境、依赖数据，编号 ' + workspaceIndex + '-' + moduleIndex + '-' + idx,
            steps: [
              '1. 打开页面并进入模块 ' + moduleIndex,
              '2. 执行操作 ' + (idx + 1) + '，校验字段、联动和权限',
              '3. 观察结果与日志，确认状态一致',
            ],
            expected: '预期：页面表现、服务端结果和提示文案都正确，且不存在重复提交或错误提示。',
          });
        }
        return list;
      }

      function buildWorkspaceSnapshot(workspaceIndex) {
        var modules = [];
        var moduleStates = {};
        var results = {};
        var operationSnapshots = [];
        var rootTitle = '大快照需求-' + workspaceIndex;
        for (var moduleIndex = 0; moduleIndex < 6; moduleIndex += 1) {
          var moduleTitle = '页签' + workspaceIndex + '-模块' + (moduleIndex + 1);
          var moduleId = 'workspace-' + workspaceIndex + '-module-' + moduleIndex;
          modules.push({
            module: moduleTitle,
            key_scenarios: ['关键场景-' + moduleIndex],
            test_points: ['测试点-' + moduleIndex],
            coupled_modules: ['依赖模块-' + moduleIndex],
            cases: [],
          });
          moduleStates[moduleId] = {
            lastAction: 'full_cases',
            running: false,
            taskId: '',
            rootPendingActionId: '',
            snapshotId: 'module-snapshot-' + workspaceIndex + '-' + moduleIndex,
            status: '',
            error: '',
            hideResults: false,
            updatedAt: Date.now() - moduleIndex,
            topupHighlight: {
              module: moduleTitle,
              offset: moduleIndex,
            },
            rollbackRestoreTopupHighlight: {
              module: moduleTitle,
            },
          };
          results[moduleId] = JSON.stringify(buildCases(workspaceIndex, moduleIndex + 1, 30), null, 2);
        }
        operationSnapshots.push({
          id: 'op-snap-' + workspaceIndex + '-1',
          scope: 'root',
          moduleId: '',
          caseGenModules: clone(modules),
          caseGenResults: clone(results),
          caseSelections: {},
          caseGenSuggestions: {},
          caseGenModuleStatus: {},
          caseGenProgress: {},
          caseGenTiming: {},
          caseGenSource: 'mock-source-' + workspaceIndex,
          createdAt: Date.now(),
        });
        operationSnapshots.push({
          id: 'op-snap-' + workspaceIndex + '-2',
          scope: 'module',
          moduleId: 'workspace-' + workspaceIndex + '-module-0',
          caseGenModules: clone(modules),
          caseGenResults: clone(results),
          caseSelections: {},
          caseGenSuggestions: {},
          caseGenModuleStatus: {},
          caseGenProgress: {},
          caseGenTiming: {},
          caseGenSource: 'mock-source-' + workspaceIndex,
          createdAt: Date.now() + 1,
        });
        return {
          id: 'workspace-' + workspaceIndex,
          seq: workspaceIndex,
          name: '大快照页签-' + workspaceIndex,
          pendingOpenPrep: false,
          updatedAt: Date.now(),
          createdAt: Date.now() - 1000,
          snapshot: {
            xmind: {
              mode: 'full',
              treeSourceSignature: 'tree-signature-' + workspaceIndex,
              hasModuleSkeleton: true,
              hasImportedBaseline: false,
              openButtonDotVisible: false,
              viewState: {
                drawerOpen: workspaceIndex === 1,
                fullscreen: false,
                transform: '',
                scaleVal: 1,
                scrollLeft: workspaceIndex * 20,
                scrollTop: workspaceIndex * 10,
                collapsedNodeKeys: ['collapsed-' + workspaceIndex],
                treeSourceSignature: 'tree-signature-' + workspaceIndex,
                updatedAt: Date.now(),
              },
              history: [{
                id: 'history-' + workspaceIndex,
                actionLabel: '生成全量用例',
                details: modules.map(function(item) {
                  return {
                    module: item.module,
                    caseCount: 30,
                  };
                }),
              }],
              operationSnapshots: clone(operationSnapshots),
              lastOperationSnapshotId: 'op-snap-' + workspaceIndex + '-2',
              rootSnapshotId: 'root-snapshot-' + workspaceIndex,
              rootSnapshots: [{
                id: 'root-snapshot-' + workspaceIndex,
                modules: clone(modules),
              }],
              deletedBaselineModuleKeys: ['deleted-module-' + workspaceIndex],
              deletedBaselineCaseKeys: ['deleted-case-' + workspaceIndex],
              deleteUndoStack: [{
                id: 'undo-' + workspaceIndex,
                modules: clone(modules),
              }],
              deleteRedoStack: [{
                id: 'redo-' + workspaceIndex,
                modules: clone(modules),
              }],
              root: {
                lastAction: 'full_cases',
                running: false,
                taskId: '',
                hideAiLayer: false,
                snapshotId: 'root-snapshot-' + workspaceIndex,
                status: '',
                error: '',
                updatedAt: Date.now(),
                pipeline: {
                  id: 'pipeline-' + workspaceIndex,
                  actionId: 'full_cases',
                  snapshotId: 'root-snapshot-' + workspaceIndex,
                  historyActionLabel: '生成全量用例',
                  stage: 'done',
                  discoveryStatus: 'done',
                  hadAiContentBeforeAction: false,
                  hadAiLayerBeforeAction: false,
                  hadAiCasesBeforeAction: false,
                  cancelled: false,
                  cancelReason: '',
                  errorCount: 0,
                  createdModules: 6,
                  addedCases: 180,
                  detailMap: modules.reduce(function(acc, item) {
                    acc[String(item.module || '')] = {
                      module: item.module,
                      caseCount: 30,
                    };
                    return acc;
                  }, {}),
                  diagnostics: ['已完成页签 ' + workspaceIndex + ' 的全量用例生成'],
                  pendingQueue: [],
                  updatedAt: Date.now(),
                },
              },
              summaryCollapsed: false,
              prep: {
                step: 3,
                requirementMode: 'manual',
                requirementSupplement: '',
                manualRequirementLabel: rootTitle,
                manualRequirementBlocks: [{
                  type: 'text',
                  text: '需求正文：页签 ' + workspaceIndex + ' 包含多个模块与大量用例，需要刷新后稳定恢复。',
                }],
                caseImportMode: 'skip',
                completed: true,
                baseLocked: true,
              },
              nextSnapshotId: 3,
              snapshots: [{
                id: 'snapshot-' + workspaceIndex,
              }],
              modules: clone(moduleStates),
            },
            shared: {
              requirementLabel: rootTitle,
              requirementLabelSource: 'manual',
              lastRawImportName: '',
              rawText: '需求正文：页签 ' + workspaceIndex + ' 包含多个模块与大量用例，需要刷新后稳定恢复。',
              caseText: '',
              importedCases: [],
              caseGenModules: clone(modules),
              caseGenSource: 'mock-source-' + workspaceIndex,
              caseGenResults: clone(results),
              caseSelections: {},
              caseGenSuggestions: {},
              caseGenModuleStatus: {},
              caseGenProgress: {},
              caseGenTiming: {},
              caseGenProgressNotice: {},
              caseGenSettings: {},
              requirementMedia: {
                docxImages: [],
                pastedImages: [],
                lastDocxImageCount: 0,
                updatedAt: 0,
              },
            },
          },
        };
      }

      var app = window.app || {};
      var state = app.state || {};
      var workspaces = {};
      var workspaceOrder = [];
      for (var workspaceIndex = 1; workspaceIndex <= 3; workspaceIndex += 1) {
        var record = buildWorkspaceSnapshot(workspaceIndex);
        workspaceOrder.push(record.id);
        workspaces[record.id] = record;
      }
      var activeId = workspaceOrder[0];
      var activeShared = clone(workspaces[activeId].snapshot.shared);
      var activeXmind = clone(workspaces[activeId].snapshot.xmind);
      state.requirementLabel = activeShared.requirementLabel;
      state.requirementLabelSource = activeShared.requirementLabelSource;
      state.lastRawImportName = activeShared.lastRawImportName;
      state.importedCases = clone(activeShared.importedCases);
      state.caseGenModules = clone(activeShared.caseGenModules);
      state.caseGenSource = activeShared.caseGenSource;
      state.caseGenResults = clone(activeShared.caseGenResults);
      state.caseSelections = {};
      state.caseGenSuggestions = {};
      state.caseGenModuleStatus = {};
      state.caseGenProgress = {};
      state.caseGenTiming = {};
      state.caseGenProgressNotice = {};
      state.caseGenSettings = {};
      var rawTextEl = document.getElementById('rawText');
      var caseTextEl = document.getElementById('caseText');
      if (rawTextEl) rawTextEl.value = String(activeShared.rawText || '');
      if (caseTextEl) caseTextEl.value = String(activeShared.caseText || '');
      state.xmindCaseGen = clone(activeXmind);
      state.xmindCaseGen.activeWorkspaceId = activeId;
      state.xmindCaseGen.mirrorWorkspaceId = activeId;
      state.xmindCaseGen.workspaceOrder = clone(workspaceOrder);
      state.xmindCaseGen.workspaces = clone(workspaces);
      state.xmindCaseGen.nextWorkspaceSeq = 4;
      state.xmindCaseGen.openButtonDotVisible = false;

      if (app && typeof app.persistWorkflowStateNow === 'function') {
        app.persistWorkflowStateNow();
      }

      var raw = localStorage.getItem('usecase-workflow-state-v1') || '';
      var parsed = raw ? JSON.parse(raw) : null;
      var data = parsed && parsed.data ? parsed.data : {};
      var host = data && data.xmindCaseGen ? data.xmindCaseGen : {};
      var storedOrder = Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
      var activeRecord = storedOrder.length && host.workspaces ? host.workspaces[storedOrder[0]] : null;
      return {
        rawLength: raw.length,
        workspaceCount: storedOrder.length,
        topLevelOperationSnapshots: Array.isArray(host.operationSnapshots) ? host.operationSnapshots.length : -1,
        topLevelDeleteUndo: Array.isArray(host.deleteUndoStack) ? host.deleteUndoStack.length : -1,
        topLevelDeleteRedo: Array.isArray(host.deleteRedoStack) ? host.deleteRedoStack.length : -1,
        activeSnapshotCompacted: Boolean(activeRecord && activeRecord.snapshot && activeRecord.snapshot.__topLevelActiveSnapshot === true),
        otherWorkspaceOperationSnapshots: storedOrder.slice(1).map(function(id) {
          var record = host.workspaces ? host.workspaces[id] : null;
          var xmind = record && record.snapshot ? record.snapshot.xmind : null;
          return Array.isArray(xmind && xmind.operationSnapshots) ? xmind.operationSnapshots.length : -1;
        }),
      };
    });

    expect(persisted.workspaceCount).toBe(3);
    expect(persisted.rawLength).toBeLessThan(1500000);
    expect(persisted.topLevelOperationSnapshots).toBe(0);
    expect(persisted.topLevelDeleteUndo).toBe(0);
    expect(persisted.topLevelDeleteRedo).toBe(0);
    expect(persisted.activeSnapshotCompacted).toBe(true);
    expect(persisted.otherWorkspaceOperationSnapshots.every((len) => len === 0)).toBeTruthy();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.app._inited === true && window.app.authReady === true, null, {
      timeout: 15000,
    });

    const restored = await page.evaluate(() => {
      var state = window.app && window.app.state ? window.app.state : null;
      var host = state && state.xmindCaseGen ? state.xmindCaseGen : {};
      var workspaceOrder = Array.isArray(host.workspaceOrder) ? host.workspaceOrder.slice() : [];
      var totalCaseCount = 0;
      workspaceOrder.forEach(function(id) {
        var record = host && host.workspaces ? host.workspaces[id] : null;
        var shared = record && record.snapshot ? record.snapshot.shared : null;
        var results = shared && shared.caseGenResults ? shared.caseGenResults : {};
        Object.keys(results).forEach(function(moduleId) {
          try {
            var list = JSON.parse(String(results[moduleId] || '[]'));
            if (Array.isArray(list)) totalCaseCount += list.length;
          } catch (err) {
            // ignore malformed data in assertion path
          }
        });
      });
      return {
        workspaceCount: workspaceOrder.length,
        totalCaseCount: totalCaseCount,
        activeWorkspaceId: String(host.activeWorkspaceId || ''),
        activeMirrorWorkspaceId: String(host.mirrorWorkspaceId || ''),
        firstWorkspaceName: (function() {
          var record = workspaceOrder.length && host.workspaces ? host.workspaces[workspaceOrder[0]] : null;
          return record ? String(record.name || '') : '';
        })(),
      };
    });

    expect(restored.workspaceCount).toBe(3);
    expect(restored.totalCaseCount).toBe(540);
    expect(restored.activeWorkspaceId).not.toBe('');
    expect(restored.activeMirrorWorkspaceId).toBe(restored.activeWorkspaceId);
    expect(restored.firstWorkspaceName).toContain('大快照');
  });
});
