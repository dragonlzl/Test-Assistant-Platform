(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenAnalysisTaskController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var DEDUPE_ACTION_ID = String(opts.dedupeActionId || 'xmind-ai-dedupe');
    var DEDUPE_MODE_ONLY = String(opts.dedupeModeOnly || 'dedupe_only');
    var DEDUPE_MIN_VISIBLE_MS = Number(opts.dedupeMinVisibleMs || 260);
    var DEDUPE_TERMINAL_GRACE_MS = Number(opts.dedupeTerminalGraceMs || 1200);
    var DEDUPE_TERMINAL_VISUAL_MS = Number(opts.dedupeTerminalVisualMs || 3200);
    var dedupeTerminalVisualTimer = 0;
    var now = port('now', function() { return Date.now(); });
    var setTimer = port('setTimer', function(handler, delay) { return setTimeout(handler, delay); });
    var clearTimer = port('clearTimer', function(timer) { clearTimeout(timer); });
    var cloneJson = port('cloneJson', function(value) { return value; });
    var normalizeDedupeMode = port('normalizeDedupeMode', function(value) { return String(value || DEDUPE_MODE_ONLY); });
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var normalizeCaseItem = port('normalizeCaseItem', function(value) { return value || null; });
    var normalizeHistoryDiagnostics = port('normalizeHistoryDiagnostics', function(value) { return Array.isArray(value) ? value : []; });
    var normalizeHistoryDedupeRecords = port('normalizeHistoryDedupeRecords', function(value) { return Array.isArray(value) ? value : []; });
    var normalizeHistoryDurationMs = port('normalizeHistoryDurationMs', function(value) { return Number(value || 0) || 0; });
    var ensureDedupeUiState = port('ensureDedupeUiState', function() { return {}; });
    var ensureCoverageUiState = port('ensureCoverageUiState', function() { return {}; });
    var ensureRootUiState = port('ensureRootUiState', function() { return {}; });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return null; });
    var syncInterruptButton = port('syncInterruptButton');
    var hasAnyRunningGenerationOperation = port('hasAnyRunningGenerationOperation', function() { return false; });
    var buildCoverageSourceRequest = port('buildCoverageSourceRequest', function() { return {}; });
    var buildXmindCoverageTaskInput = port('buildXmindCoverageTaskInput', function() { return {}; });
    var buildCoverageTaskPayload = port('buildCoverageTaskPayload', function() { return {}; });
    var buildXmindDedupeExecutionInput = port('buildXmindDedupeExecutionInput', function() { return {}; });
    var buildDedupeTaskPayload = port('buildDedupeTaskPayload', function() { return {}; });
    var startManagedXmindTask = port('startManagedXmindTask', function() { return null; });
    var getActiveWorkspaceId = port('getActiveWorkspaceId', function() { return ''; });
    var collectCurrentAiDedupeModules = port('collectCurrentAiDedupeModules', function() { return []; });
    var getDedupeModeFromSettings = port('getDedupeModeFromSettings', function() { return DEDUPE_MODE_ONLY; });
    var syncInlineToolbarOverview = port('syncInlineToolbarOverview');
    var updateRootPipelineState = port('updateRootPipelineState');
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var queueStatusMindRender = port('queueStatusMindRender');
    var queueTerminalMindRender = port('queueTerminalMindRender');
    var getRootNodeId = port('getRootNodeId', function() { return ''; });
    var notifyStatus = port('notifyStatus');
    var notifyFloatingStatus = port('notifyFloatingStatus');
    var persistManagedTaskWorkspaceState = port('persistManagedTaskWorkspaceState');
    var persistXmindState = port('persistXmindState');
    var syncTerminalTaskRestoreContext = port('syncTerminalTaskRestoreContext');
    var getXmindCaseDedupeCoreApi = port('getXmindCaseDedupeCoreApi', function() { return null; });
    var getXmindDedupeBatchCoreApi = port('getXmindDedupeBatchCoreApi', function() { return null; });
    var getXmindRequirementCoverageCoreApi = port('getXmindRequirementCoverageCoreApi', function() { return null; });
    var getDedupeExecutionDiagnosticText = port('getDedupeExecutionDiagnosticText', function() { return ''; });
    var getTaskErrorMessage = port('getTaskErrorMessage', function(task, err) {
      return String(err && err.message ? err.message : task && task.error ? task.error : '未知错误');
    });
    var buildGenerationCancelledInfo = port('buildGenerationCancelledInfo', function() {
      return { resultKind: 'cancelled', reasonText: '', diagnostics: [], previewText: '' };
    });
    var buildGenerationErrorInfo = port('buildGenerationErrorInfo', function(err) {
      return { resultKind: 'error', reasonText: err && err.message ? err.message : '', diagnostics: [], previewText: '' };
    });
    var shouldSuppressTaskCancelToast = port('shouldSuppressTaskCancelToast', function() { return false; });
    var commitCaseList = port('commitCaseList');
    var clearModuleTopupHighlight = port('clearModuleTopupHighlight');
    var clearDeleteHistoryStacks = port('clearDeleteHistoryStacks');
    var saveActiveWorkspaceSnapshot = port('saveActiveWorkspaceSnapshot');
    var renderWorkspaceTabs = port('renderWorkspaceTabs');
    var syncCasesGenPageRender = port('syncCasesGenPageRender');
    var appendRootPipelineDiagnostics = port('appendRootPipelineDiagnostics');
    var recordGenerationHistory = port('recordGenerationHistory');
    var clearCoverageHighlightedCase = port('clearCoverageHighlightedCase');
    var isCoverageDialogOpen = port('isCoverageDialogOpen', function() { return false; });
    var renderCoverageDialog = port('renderCoverageDialog');

    function clearDedupeOverviewSummary(options) {
      var clearOptions = options || {};
      var dedupeState = ensureDedupeUiState();
      var changed = false;
      if (dedupeState.lastResult) {
        dedupeState.lastResult = null;
        changed = true;
      }
      if (clearOptions.clearTerminalVisual !== false) {
        if (dedupeTerminalVisualTimer) {
          clearTimer(dedupeTerminalVisualTimer);
          dedupeTerminalVisualTimer = 0;
        }
        if (
          dedupeState.terminalVisualRunning === true
          || Number(dedupeState.terminalVisualUntil || 0) > 0
        ) {
          dedupeState.terminalVisualRunning = false;
          dedupeState.terminalVisualUntil = 0;
          changed = true;
        }
      }
      if (!changed) return false;
      dedupeState.updatedAt = now();
      if (clearOptions.sync !== false) syncInlineToolbarOverview();
      return true;
    }

    function setDedupeRunningState(task, source) {
      var dedupeState = ensureDedupeUiState();
      dedupeState.running = true;
      dedupeState.taskId = String(task && task.id ? task.id : '');
      dedupeState.status = 'running';
      dedupeState.error = '';
      dedupeState.dedupeMode = normalizeDedupeMode(task && task.dedupeMode);
      dedupeState.batchCompleted = Number(task && task.modelRequestBatchCompleted || 0);
      dedupeState.batchTotal = Number(
        task && task.modelRequestBatchTotal
        || (task && Array.isArray(task.dedupeBatches) ? task.dedupeBatches.length : 0)
      );
      dedupeState.updatedAt = now();
      var rootState = ensureRootUiState();
      rootState.running = true;
      rootState.taskId = dedupeState.taskId;
      rootState.lastAction = DEDUPE_ACTION_ID;
      rootState.status = '';
      rootState.error = source === 'auto-full' ? '去重中' : '';
      rootState.updatedAt = dedupeState.updatedAt;
      syncInterruptButton();
    }

    function clearDedupeRunningState(errorText) {
      var dedupeState = ensureDedupeUiState();
      dedupeState.running = false;
      dedupeState.taskId = '';
      dedupeState.status = errorText ? 'error' : '';
      dedupeState.error = errorText ? String(errorText || '') : '';
      dedupeState.dedupeMode = DEDUPE_MODE_ONLY;
      dedupeState.batchCompleted = 0;
      dedupeState.batchTotal = 0;
      dedupeState.updatedAt = now();
      var rootState = ensureRootUiState();
      if (rootState.lastAction === DEDUPE_ACTION_ID) {
        rootState.running = false;
        rootState.taskId = '';
        if (
          !errorText
          && dedupeState.terminalVisualRunning === true
          && Number(dedupeState.terminalVisualUntil || 0) > now()
        ) {
          rootState.status = '';
          rootState.error = '去重中';
        } else {
          rootState.status = errorText ? 'error' : '';
          rootState.error = errorText ? String(errorText || '') : '';
        }
        rootState.updatedAt = now();
      }
      syncInterruptButton();
    }

    function scheduleDedupeTerminalVisualState(task) {
      var dedupeState = ensureDedupeUiState();
      var until = now() + DEDUPE_TERMINAL_VISUAL_MS;
      dedupeState.terminalVisualRunning = true;
      dedupeState.terminalVisualUntil = until;
      dedupeState.dedupeMode = normalizeDedupeMode(task && task.dedupeMode);
      dedupeState.updatedAt = now();
      if (dedupeTerminalVisualTimer) {
        clearTimer(dedupeTerminalVisualTimer);
        dedupeTerminalVisualTimer = 0;
      }
      dedupeTerminalVisualTimer = setTimer(function() {
        dedupeTerminalVisualTimer = 0;
        var stateNow = ensureDedupeUiState();
        if (Number(stateNow.terminalVisualUntil || 0) > now()) {
          scheduleDedupeTerminalVisualState({ dedupeMode: stateNow.dedupeMode });
          return;
        }
        stateNow.terminalVisualRunning = false;
        stateNow.terminalVisualUntil = 0;
        stateNow.updatedAt = now();
        syncInterruptButton();
        if (isDrawerOpen()) {
          queueStatusMindRender({
            reason: 'dedupe-terminal-visual-ended',
            persist: false,
            anchorNodeId: getRootNodeId(),
          });
        }
        persistXmindState(false);
      }, DEDUPE_TERMINAL_VISUAL_MS + 20);
      syncInlineToolbarOverview();
    }

    function waitForDedupeMinVisibleDuration(task) {
      var visibleUntil = Number(task && task.minVisibleUntil || 0);
      if (Number.isFinite(visibleUntil) && visibleUntil > 0) {
        var remainingMs = visibleUntil - now();
        if (remainingMs <= 0) return Promise.resolve();
        return new Promise(function(resolve) {
          setTimer(resolve, remainingMs);
        });
      }
      var startedAt = Number(task && task.dedupeVisibleStartedAt || 0);
      var delayMs = DEDUPE_TERMINAL_GRACE_MS;
      if (Number.isFinite(startedAt) && startedAt > 0) {
        var elapsed = now() - startedAt;
        delayMs = Math.max(DEDUPE_TERMINAL_GRACE_MS, DEDUPE_MIN_VISIBLE_MS - elapsed);
      }
      if (!Number.isFinite(delayMs) || delayMs <= 0) return Promise.resolve();
      return new Promise(function(resolve) {
        setTimer(resolve, delayMs);
      });
    }

    function showTerminalDedupeRunningState(task) {
      if (!task || task.scope !== 'dedupe') return;
      setDedupeRunningState(task, task.dedupeSource || '');
      if (task.rootPipelineId) {
        updateRootPipelineState(function(current) {
          current.stage = 'deduping';
          current.dedupeStatus = 'running';
          current.dedupeTaskId = String(task.id || '');
          current.dedupeMode = normalizeDedupeMode(task.dedupeMode);
          current.dedupeBeforeCount = Number(task.dedupeBeforeCount || current.dedupeBeforeCount || 0) || 0;
        });
      }
      if (isDrawerOpen()) {
        queueStatusMindRender({
          reason: 'dedupe-terminal-visible-grace',
          persist: false,
          anchorNodeId: getRootNodeId(),
        });
      }
    }

    function setCoverageRunningState(task) {
      var coverageState = ensureCoverageUiState();
      coverageState.running = true;
      coverageState.taskId = String(task && task.id ? task.id : '');
      coverageState.status = 'running';
      coverageState.error = '';
      coverageState.updatedAt = now();
      syncInterruptButton();
    }

    function clearCoverageRunningState(status, errorText) {
      var coverageState = ensureCoverageUiState();
      coverageState.running = false;
      coverageState.taskId = '';
      coverageState.status = status ? String(status || '') : '';
      coverageState.error = errorText ? String(errorText || '') : '';
      coverageState.updatedAt = now();
      syncInterruptButton();
    }

    function startRequirementCoverageTask(options) {
      var opts = options || {};
      if (hasAnyRunningGenerationOperation()) {
        notifyStatus('当前有 XMind 任务进行中，请等待完成后再分析覆盖', 'warn', { forceInline: true });
        return null;
      }
      var request = opts.request || buildCoverageSourceRequest();
      var taskInput = buildXmindCoverageTaskInput(request);
      var task = startManagedXmindTask(buildCoverageTaskPayload(taskInput, {
        workspaceId: getActiveWorkspaceId(),
        coverageSource: 'manual-toolbar',
      }));
      var coverageState = ensureCoverageUiState();
      coverageState.selectedSegmentId = '';
      coverageState.error = '';
      setCoverageRunningState(task);
      if (isCoverageDialogOpen()) {
        renderCoverageDialog();
      }
      notifyStatus('需求覆盖分析中', 'warn', { forceInline: true });
      persistManagedTaskWorkspaceState(true);
      return task;
    }

    function startAiDedupeTask(options) {
      var opts = options || {};
      var source = opts.source || 'manual-toolbar';
      var modules = Array.isArray(opts.modules) ? opts.modules : collectCurrentAiDedupeModules();
      if (!modules.length) {
        if (source !== 'auto-full') notifyStatus('当前页签没有可去重的 AI 生成用例', 'warn', { forceInline: true });
        return null;
      }
      var taskWorkspaceId = String(opts.workspaceId || getActiveWorkspaceId() || '');
      var dedupeMode = normalizeDedupeMode(opts.dedupeMode || getDedupeModeFromSettings());
      var taskInput = buildXmindDedupeExecutionInput(modules, { source: source, dedupeMode: dedupeMode });
      var dedupeVisibleStartedAt = now();
      clearDedupeOverviewSummary({ clearTerminalVisual: true, sync: false });
      var task = startManagedXmindTask(buildDedupeTaskPayload(taskInput, {
        workspaceId: taskWorkspaceId,
        dedupeSource: source,
        dedupeMode: dedupeMode,
        dedupeVisibleStartedAt: dedupeVisibleStartedAt,
        minVisibleUntil: dedupeVisibleStartedAt + DEDUPE_TERMINAL_VISUAL_MS,
        rootPipelineId: opts.rootPipelineId || '',
        rootPipelineActionId: opts.rootPipelineActionId || '',
        historySuppressed: source === 'auto-full',
        notifySuppressed: source === 'auto-full',
      }));
      setDedupeRunningState(task, source);
      syncInlineToolbarOverview();
      if (opts.rootPipelineId) {
        updateRootPipelineState(function(current) {
          current.stage = 'deduping';
          current.dedupeStatus = 'running';
          current.dedupeTaskId = String(task && task.id ? task.id : '');
          current.dedupeMode = dedupeMode;
          current.dedupeBeforeCount = Number(taskInput.beforeCaseCount || 0);
        });
      }
      if (isDrawerOpen()) {
        queueStatusMindRender({
          reason: source === 'auto-full' ? 'root-pipeline-dedupe-running' : 'manual-dedupe-running',
          persist: false,
          anchorNodeId: getRootNodeId(),
        });
      }
      persistManagedTaskWorkspaceState(true);
      return task;
    }


    function buildDedupeHistoryDetails(result) {
      return (result && Array.isArray(result.modules) ? result.modules : []).map(function(item) {
        return {
          module: normalizeModuleTitle(item && item.module ? item.module : ''),
          caseCount: Number(item && item.afterCount || 0) || 0,
        };
      }).filter(function(item) {
        return Boolean(item && item.module);
      });
    }

    function buildDedupeDetailMap(result, previousDetailMap) {
      var map = {};
      var previousMap = previousDetailMap && typeof previousDetailMap === 'object'
        ? previousDetailMap
        : {};
      buildDedupeHistoryDetails(result).forEach(function(item) {
        var key = normalizeModuleKey(item.module || '') || ('module-' + String(Object.keys(map).length + 1));
        var previousDetail = previousMap[key] && typeof previousMap[key] === 'object'
          ? previousMap[key]
          : null;
        map[key] = {
          module: item.module || '未命名模块',
          caseCount: Number(item.caseCount || 0) || 0,
          durationMs: normalizeHistoryDurationMs(previousDetail && previousDetail.durationMs),
        };
      });
      return map;
    }

    function normalizeManagedDedupeTaskResult(task, dedupeCoreApi, dedupeMode) {
      var batches = task && Array.isArray(task.dedupeBatches) ? task.dedupeBatches : [];
      if (!batches.length) {
        return dedupeCoreApi.normalizeDedupeResult(
          task && task.resultRaw ? task.resultRaw : '',
          task && Array.isArray(task.dedupeModules) ? task.dedupeModules : [],
          {
            dedupeMode: dedupeMode,
            allowPartialModulesResponse: task && task.dedupePartialModulesResponseAllowed === true,
          }
        );
      }
      var batchCoreApi = getXmindDedupeBatchCoreApi();
      if (!batchCoreApi || typeof batchCoreApi.mergeBatchResults !== 'function') {
        throw new Error('AI 用例去重批次聚合能力未就绪，请刷新后重试');
      }
      var rawResults = null;
      try {
        rawResults = JSON.parse(String(task && task.resultRaw ? task.resultRaw : ''));
      } catch (err) {
        rawResults = null;
      }
      if (!Array.isArray(rawResults) || rawResults.length !== batches.length) {
        throw new Error('AI 用例去重批次结果不完整，已保留原用例');
      }
      var entries = batches.map(function(batch, index) {
        return {
          id: batch && batch.id ? String(batch.id || '') : '',
          result: dedupeCoreApi.normalizeDedupeResult(
            rawResults[index],
            batch && Array.isArray(batch.modules) ? batch.modules : [],
            {
              dedupeMode: dedupeMode,
              allowPartialModulesResponse: true,
            }
          ),
        };
      });
      var merged = batchCoreApi.mergeBatchResults(
        task && Array.isArray(task.dedupeModules) ? task.dedupeModules : [],
        entries
      );
      merged.diagnostics = normalizeHistoryDiagnostics((merged.diagnostics || []).concat(
        'AI 用例去重已拆分为 ' + String(batches.length) + ' 个有界批次并行完成'
      ));
      return merged;
    }

    function completeDedupeTaskSuccess(task) {
      var dedupeCoreApi = getXmindCaseDedupeCoreApi();
      if (!dedupeCoreApi || typeof dedupeCoreApi.normalizeDedupeResult !== 'function') {
        throw new Error('AI 用例去重能力未就绪，请刷新后重试');
      }
      var dedupeMode = normalizeDedupeMode(task && task.dedupeMode);
      var result = normalizeManagedDedupeTaskResult(task, dedupeCoreApi, dedupeMode);
      var diagnostics = normalizeHistoryDiagnostics(result && result.diagnostics ? result.diagnostics : []);
      var removedCount = Number(result && result.removedCount || 0) || 0;
      var executionSummary = getDedupeExecutionDiagnosticText(removedCount, dedupeMode);
      diagnostics = normalizeHistoryDiagnostics(diagnostics.concat(executionSummary));
      (result && Array.isArray(result.modules) ? result.modules : []).forEach(function(item) {
        var moduleId = item && item.moduleId ? String(item.moduleId || '') : '';
        if (!moduleId) {
          diagnostics.push('模块「' + normalizeModuleTitle(item && item.module ? item.module : '') + '」缺少模块标识，已跳过回写');
          return;
        }
        var moduleTitle = normalizeModuleTitle(item && item.module ? item.module : '');
        var nextCases = (Array.isArray(item && item.cases) ? item.cases : []).map(function(caseItem) {
          return normalizeCaseItem(caseItem, moduleTitle);
        }).filter(Boolean);
        commitCaseList(moduleId, nextCases, Number(task && task.durationMs || 0), '', '');
        var moduleState = ensureModuleUiState(moduleId);
        if (moduleState) {
          moduleState.running = false;
          moduleState.taskId = '';
          moduleState.status = '';
          moduleState.error = '';
          moduleState.hideResults = false;
          clearModuleTopupHighlight(moduleState);
          moduleState.updatedAt = now();
        }
      });
      diagnostics = normalizeHistoryDiagnostics(diagnostics);
      var dedupeRecords = normalizeHistoryDedupeRecords(result && result.removedCases ? result.removedCases : []);

      var dedupeState = ensureDedupeUiState();
      dedupeState.lastResult = {
        status: 'done',
        source: task && task.dedupeSource ? String(task.dedupeSource || '') : 'manual-toolbar',
        dedupeMode: dedupeMode,
        beforeCount: Number(result && result.beforeCount || 0) || 0,
        afterCount: Number(result && result.afterCount || 0) || 0,
        removedCount: Number(result && result.removedCount || 0) || 0,
        moduleCount: result && Array.isArray(result.modules) ? result.modules.length : 0,
        diagnostics: diagnostics,
        dedupeRecords: dedupeRecords,
        updatedAt: now(),
      };
      scheduleDedupeTerminalVisualState(task);
      clearDedupeRunningState('');
      clearDeleteHistoryStacks();
      saveActiveWorkspaceSnapshot({
        forceShared: true,
        skipSummaryDraftSync: true,
        skipViewStateCapture: true,
      });
      renderWorkspaceTabs();
      syncCasesGenPageRender();

      if (task && task.rootPipelineId) {
        updateRootPipelineState(function(current) {
          current.stage = 'modules';
          current.dedupeStatus = 'done';
          current.dedupeTaskId = String(task.id || '');
          current.dedupeMode = dedupeMode;
          current.dedupeBeforeCount = Number(result && result.beforeCount || 0) || 0;
          current.dedupeAfterCount = Number(result && result.afterCount || 0) || 0;
          current.dedupeRemovedCount = Number(result && result.removedCount || 0) || 0;
          current.dedupeError = '';
          current.dedupeRecords = dedupeRecords;
          current.addedCases = Number(result && result.afterCount || current.addedCases || 0) || 0;
          current.detailMap = buildDedupeDetailMap(result, current.detailMap);
          appendRootPipelineDiagnostics(current, diagnostics);
        });
      } else if (!(task && task.historySuppressed === true)) {
        recordGenerationHistory({
          scope: 'root',
          actionId: DEDUPE_ACTION_ID,
          actionLabel: 'AI用例去重',
          summaryText: executionSummary,
          moduleCount: result && Array.isArray(result.modules) ? result.modules.length : 0,
          details: buildDedupeHistoryDetails(result),
          resultKind: removedCount > 0 ? 'changed' : 'no-change',
          reasonText: removedCount > 0 ? '' : '模型未发现明显重复或高度重叠用例',
          diagnostics: diagnostics,
          dedupeRecords: dedupeRecords,
        });
        if (!(task && task.notifySuppressed === true)) {
          notifyStatus(
            executionSummary,
            removedCount > 0 ? 'ok' : 'warn',
            { forceInline: true }
          );
        }
      }

      if (isDrawerOpen()) {
        queueTerminalMindRender({
          reason: task && task.rootPipelineId ? 'root-pipeline-dedupe-committed' : 'manual-dedupe-committed',
          persist: false,
          anchorNodeId: getRootNodeId(),
        });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return true;
    }

    function completeDedupeTaskError(task, err, options) {
      var opts = options || {};
      var resultKind = opts.resultKind === 'cancelled' ? 'cancelled' : 'error';
      var errorInfo = resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(getTaskErrorMessage(task, err)));
      var errorText = resultKind === 'cancelled' ? errorInfo.reasonText : errorInfo.reasonText;
      var diagnostics = normalizeHistoryDiagnostics(errorInfo.diagnostics || []);
      var stateMessage = resultKind === 'cancelled' ? '' : errorText;
      var dedupeMode = normalizeDedupeMode(task && task.dedupeMode);
      var dedupeState = ensureDedupeUiState();
      dedupeState.lastResult = {
        status: resultKind,
        source: task && task.dedupeSource ? String(task.dedupeSource || '') : 'manual-toolbar',
        dedupeMode: dedupeMode,
        beforeCount: Number(task && task.dedupeBeforeCount || 0) || 0,
        afterCount: Number(task && task.dedupeBeforeCount || 0) || 0,
        removedCount: 0,
        moduleCount: task && Array.isArray(task.dedupeModules) ? task.dedupeModules.length : 0,
        diagnostics: diagnostics,
        error: errorText,
        updatedAt: now(),
      };
      clearDedupeRunningState(stateMessage);

      if (task && task.rootPipelineId) {
        updateRootPipelineState(function(current) {
          current.stage = 'modules';
          current.dedupeStatus = resultKind;
          current.dedupeTaskId = String(task.id || '');
          current.dedupeMode = dedupeMode;
          current.dedupeBeforeCount = Number(task && task.dedupeBeforeCount || current.dedupeBeforeCount || 0) || 0;
          current.dedupeAfterCount = current.dedupeBeforeCount;
          current.dedupeRemovedCount = 0;
          current.dedupeError = errorText;
          appendRootPipelineDiagnostics(current, (resultKind === 'cancelled'
            ? ['AI 用例去重已中断，已保留原结果']
            : ['AI 用例去重失败：' + errorText, 'AI 用例去重失败，已保留原结果']
          ).concat(diagnostics));
        });
      } else if (!(task && task.historySuppressed === true)) {
        recordGenerationHistory({
          scope: 'root',
          actionId: DEDUPE_ACTION_ID,
          actionLabel: 'AI用例去重',
          summaryText: resultKind === 'cancelled' ? 'AI 用例去重已中断' : 'AI 用例去重失败',
          moduleCount: 0,
          details: [],
          resultKind: resultKind,
          reasonText: errorText,
          diagnostics: diagnostics,
          previewText: errorInfo.previewText,
        });
        if (resultKind === 'cancelled') {
          if (!shouldSuppressTaskCancelToast(task)) {
            notifyFloatingStatus('AI 用例去重已中断，已保留原结果', 'warn', 3000);
          }
        } else if (!(task && task.notifySuppressed === true)) {
          notifyStatus('AI 用例去重失败，已保留原结果', 'err', { forceInline: true });
        }
      }

      if (isDrawerOpen()) {
        queueTerminalMindRender({
          reason: resultKind === 'cancelled' ? 'dedupe-task-cancelled' : 'dedupe-task-error',
          persist: false,
          anchorNodeId: getRootNodeId(),
        });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function completeCoverageTaskSuccess(task) {
      var coverageCoreApi = getXmindRequirementCoverageCoreApi();
      if (!coverageCoreApi || typeof coverageCoreApi.normalizeCoverageResult !== 'function') {
        throw new Error('需求覆盖分析能力未就绪，请刷新后重试');
      }
      var request = task && task.coverageRequest && typeof task.coverageRequest === 'object'
        ? task.coverageRequest
        : {};
      var result = coverageCoreApi.normalizeCoverageResult(task && task.resultRaw ? task.resultRaw : '', request);
      var coverageState = ensureCoverageUiState();
      coverageState.result = result;
      coverageState.signature = String(result && result.signature ? result.signature : task && task.coverageSignature ? task.coverageSignature : '');
      coverageState.selectedSegmentId = String(result && result.selectedSegmentId ? result.selectedSegmentId : '');
      coverageState.running = false;
      coverageState.taskId = '';
      coverageState.status = 'done';
      coverageState.error = '';
      coverageState.updatedAt = now();
      clearCoverageHighlightedCase();
      if (isCoverageDialogOpen()) {
        renderCoverageDialog();
      }
      notifyStatus('需求覆盖分析完成', 'ok', { forceInline: true });
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return true;
    }

    function completeCoverageTaskError(task, err, options) {
      var opts = options || {};
      var resultKind = opts.resultKind === 'cancelled' ? 'cancelled' : 'error';
      var errorInfo = resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(getTaskErrorMessage(task, err)));
      var errorText = resultKind === 'cancelled' ? errorInfo.reasonText : errorInfo.reasonText;
      clearCoverageRunningState(resultKind, resultKind === 'cancelled' ? '' : errorText);
      if (isCoverageDialogOpen()) {
        renderCoverageDialog();
      }
      if (resultKind === 'cancelled') {
        if (!shouldSuppressTaskCancelToast(task)) {
          notifyFloatingStatus('需求覆盖分析已中断', 'warn', 3000);
        }
      } else {
        notifyStatus('需求覆盖分析失败：' + errorText, 'err', { forceInline: true });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return false;
    }


    return {
      clearDedupeOverviewSummary: clearDedupeOverviewSummary,
      setDedupeRunningState: setDedupeRunningState,
      clearDedupeRunningState: clearDedupeRunningState,
      scheduleDedupeTerminalVisualState: scheduleDedupeTerminalVisualState,
      waitForDedupeMinVisibleDuration: waitForDedupeMinVisibleDuration,
      showTerminalDedupeRunningState: showTerminalDedupeRunningState,
      setCoverageRunningState: setCoverageRunningState,
      clearCoverageRunningState: clearCoverageRunningState,
      startRequirementCoverageTask: startRequirementCoverageTask,
      startAiDedupeTask: startAiDedupeTask,
      buildDedupeHistoryDetails: buildDedupeHistoryDetails,
      buildDedupeDetailMap: buildDedupeDetailMap,
      normalizeManagedDedupeTaskResult: normalizeManagedDedupeTaskResult,
      completeDedupeTaskSuccess: completeDedupeTaskSuccess,
      completeDedupeTaskError: completeDedupeTaskError,
      completeCoverageTaskSuccess: completeCoverageTaskSuccess,
      completeCoverageTaskError: completeCoverageTaskError,
    };
  }

  return { create: create };
});
