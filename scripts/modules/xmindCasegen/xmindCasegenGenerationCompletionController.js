(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenGenerationCompletionController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : (fallback || noop);
    }

    var ROOT_ACTIONS = opts.rootActions || {};
    var MODULE_ACTIONS = opts.moduleActions || {};
    var cloneJson = port('cloneJson', function(value, fallback) { return value === undefined ? fallback : value; });
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var normalizeFallbackCaseList = port('normalizeFallbackCaseList', function(value) { return Array.isArray(value) ? value : []; });
    var normalizeUniqueStringList = port('normalizeUniqueStringList', function(value) { return Array.isArray(value) ? value : []; });
    var normalizeHistoryDiagnostics = port('normalizeHistoryDiagnostics', function(value) { return Array.isArray(value) ? value : []; });
    var summarizeModelOutputText = port('summarizeModelOutputText', function(value) { return String(value || ''); });
    var createOperationContract = port('createOperationContract', function() { return {}; });
    var normalizeModelModulesOutputDetailed = port('normalizeModelModulesOutputDetailed', function() { return { list: [], diagnostics: [] }; });
    var filterModulesByContract = port('filterModulesByContract', function(value) { return { list: Array.isArray(value) ? value : [], diagnostics: [] }; });
    var buildVisibleModuleContext = port('buildVisibleModuleContext', function() { return { list: [], map: {} }; });
    var ensureVisibleModuleContext = port('ensureVisibleModuleContext', function(value) { return value || { list: [], map: {} }; });
    var evaluateRootCoverageGaps = port('evaluateRootCoverageGaps', function() { return { shouldRetry: false }; });
    var tryStartRootCoverageRetry = port('tryStartRootCoverageRetry', function() { return false; });
    var applyRootOutput = port('applyRootOutput', function() {
      return { changed: false, createdModules: 0, addedCases: 0, details: [], diagnostics: [] };
    });
    var buildCoverageRetryHistoryDiagnostics = port('buildCoverageRetryHistoryDiagnostics', function() { return []; });
    var buildRootNoChangeInfo = port('buildRootNoChangeInfo', function() {
      return { resultKind: 'no-change', reasonText: '', diagnostics: [], previewText: '' };
    });
    var buildModuleNoChangeInfo = port('buildModuleNoChangeInfo', function() {
      return { resultKind: 'no-change', reasonText: '', diagnostics: [], previewText: '' };
    });
    var resolveModuleTaskResult = port('resolveModuleTaskResult', function() {
      return {
        normalizedOutput: { diagnostics: [] },
        filtered: { diagnostics: [] },
        targetOutput: null,
        visibleCases: [],
        nextList: [],
        appended: [],
        mergeDiagnostics: [],
      };
    });
    var ensureRootPipelineStateFromTask = port('ensureRootPipelineStateFromTask', function() { return null; });
    var ensureRootUiState = port('ensureRootUiState', function() { return {}; });
    var ensureModuleUiState = port('ensureModuleUiState', function() { return null; });
    var getManagedTaskAnchorNodeId = port('getManagedTaskAnchorNodeId', function() { return ''; });
    var updateRootPipelineState = port('updateRootPipelineState');
    var buildRootPipelineTaskDescriptors = port('buildRootPipelineTaskDescriptors', function() { return []; });
    var cloneModulesWithoutCases = port('cloneModulesWithoutCases', function(value) { return Array.isArray(value) ? value : []; });
    var getTaskModelRequestDurationMs = port('getTaskModelRequestDurationMs', function() { return 0; });
    var normalizeRootPipelineDedupeModules = port('normalizeRootPipelineDedupeModules', function(value) { return Array.isArray(value) ? value : []; });
    var appendRootPipelineDiagnostics = port('appendRootPipelineDiagnostics');
    var mergeRootPipelineDetails = port('mergeRootPipelineDetails');
    var normalizeRootPipelineTaskCount = port('normalizeRootPipelineTaskCount', function(value) { return Number(value || 0) || 0; });
    var getRootPipelineState = port('getRootPipelineState', function() { return null; });
    var startRootPipelineModuleTasks = port('startRootPipelineModuleTasks', function() { return Promise.resolve(0); });
    var getTaskWorkspaceId = port('getTaskWorkspaceId', function(task) { return String(task && task.workspaceId ? task.workspaceId : ''); });
    var finalizeRootPipelineIfReady = port('finalizeRootPipelineIfReady', function() { return false; });
    var resolveTaskModuleEntry = port('resolveTaskModuleEntry', function() { return null; });
    var getAiCasesForModule = port('getAiCasesForModule', function() { return []; });
    var commitCaseList = port('commitCaseList');
    var setModuleTopupHighlight = port('setModuleTopupHighlight');
    var buildRootPipelineModuleHighlightLabel = port('buildRootPipelineModuleHighlightLabel', function() { return ''; });
    var removeAiModuleRecord = port('removeAiModuleRecord');
    var clearModuleTopupHighlight = port('clearModuleTopupHighlight');
    var clearModuleRootPendingAction = port('clearModuleRootPendingAction');
    var upsertRootPipelineDedupeModule = port('upsertRootPipelineDedupeModule');
    var appendRootPipelineModuleDetail = port('appendRootPipelineModuleDetail');
    var markRootPipelineModuleTaskCompleted = port('markRootPipelineModuleTaskCompleted');
    var getTaskErrorMessage = port('getTaskErrorMessage', function(task, err) {
      return String(err && err.message ? err.message : task && task.error ? task.error : '未知错误');
    });
    var buildGenerationCancelledInfo = port('buildGenerationCancelledInfo', function() {
      return { resultKind: 'cancelled', reasonText: '', diagnostics: [], previewText: '' };
    });
    var buildGenerationErrorInfo = port('buildGenerationErrorInfo', function(err) {
      return { resultKind: 'error', reasonText: err && err.message ? err.message : '', diagnostics: [], previewText: '' };
    });
    var formatHistoryDuration = port('formatHistoryDuration', function(value) { return String(Number(value || 0)); });
    var clearDeleteHistoryStacks = port('clearDeleteHistoryStacks');
    var syncCasesGenPageRender = port('syncCasesGenPageRender');
    var isDrawerOpen = port('isDrawerOpen', function() { return false; });
    var queueTerminalMindRender = port('queueTerminalMindRender');
    var flushQueuedMindRender = port('flushQueuedMindRender');
    var syncTerminalTaskRestoreContext = port('syncTerminalTaskRestoreContext');
    var persistManagedTaskWorkspaceState = port('persistManagedTaskWorkspaceState');
    var markOpenButtonCompletionNotice = port('markOpenButtonCompletionNotice');
    var clearRootPendingModules = port('clearRootPendingModules');
    var recordGenerationHistory = port('recordGenerationHistory');
    var discardCaseGenOperationSnapshotEntry = port('discardCaseGenOperationSnapshotEntry');
    var rollbackCaseGenOperationSnapshotEntry = port('rollbackCaseGenOperationSnapshotEntry');
    var setAllModuleResultsVisibility = port('setAllModuleResultsVisibility');
    var notifyStatus = port('notifyStatus');
    var notifyFloatingStatus = port('notifyFloatingStatus');
    var getRootHistoryActionLabel = port('getRootHistoryActionLabel', function() { return ''; });
    var getModuleHistoryActionLabel = port('getModuleHistoryActionLabel', function() { return ''; });
    var getGenerationFailureLabel = port('getGenerationFailureLabel', function() { return '生成失败'; });
    var shouldSuppressTaskCancelToast = port('shouldSuppressTaskCancelToast', function() { return false; });
    var ensureState = port('ensureState', function() { return {}; });

    async function handleRootPipelineDiscoveryTaskSuccess(task) {
      var pipeline = ensureRootPipelineStateFromTask(task);
      if (!pipeline || String(pipeline.id || '') !== String(task && task.rootPipelineId ? task.rootPipelineId : '')) {
        return false;
      }
      var actionId = String(pipeline.actionId || task && task.actionId || '');
      var rootState = ensureRootUiState();
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var contract = task && task.contract ? task.contract : createOperationContract(actionId, null);
      var visibleContext = rootState.hideAiLayer === true
        ? buildVisibleModuleContext({ includeAiLayer: false })
        : buildVisibleModuleContext();
      visibleContext = ensureVisibleModuleContext(visibleContext);
      var visibleMap = visibleContext.map || {};
      var normalizedOutput = normalizeModelModulesOutputDetailed(task && task.resultRaw ? task.resultRaw : '');
      var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
      var modules = filtered.list;
      var fullCaseOutputModules = [];
      if (String(actionId || '') === ROOT_ACTIONS.FULL_CASES) {
        var fullCaseDedupeContract = cloneJson(contract, {}) || {};
        fullCaseDedupeContract.generateCasesForNewModules = true;
        fullCaseDedupeContract.generateCasesForExistingModules = true;
        fullCaseOutputModules = filterModulesByContract(
          normalizedOutput.list,
          fullCaseDedupeContract,
          visibleContext
        ).list;
      }
      var coverageGapInfo = evaluateRootCoverageGaps(task, modules, contract);
      if (task && task.skipCoverageRetry !== true && coverageGapInfo.shouldRetry === true) {
        try {
          if (tryStartRootCoverageRetry(task, coverageGapInfo, anchorNodeId)) {
            updateRootPipelineState(function(current) {
              current.stage = 'discovering';
              current.discoveryStatus = 'running';
            });
            return false;
          }
        } catch (retryErr) {
          coverageGapInfo.retryStartError = retryErr && retryErr.message ? String(retryErr.message) : '自动补强未能启动';
        }
      }

      var existingDescriptors = (actionId === ROOT_ACTIONS.EXISTING_CASES || actionId === ROOT_ACTIONS.APPEND_ALL)
        ? buildRootPipelineTaskDescriptors(actionId, visibleContext)
        : [];
      var newModules = [];
      var skeletonModules = [];
      var skeletonActionId = '';

      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        newModules = fullCaseOutputModules.slice();
        skeletonModules = cloneModulesWithoutCases(newModules);
        skeletonActionId = ROOT_ACTIONS.FULL_MODULES;
      } else if (actionId === ROOT_ACTIONS.EXISTING_CASES || actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES || actionId === ROOT_ACTIONS.APPEND_ALL) {
        newModules = modules.filter(function(item) {
          return !visibleMap[normalizeModuleKey(item && item.module ? item.module : '')];
        });
        skeletonModules = cloneModulesWithoutCases(newModules);
        skeletonActionId = ROOT_ACTIONS.TOPUP_MODULES;
      }

      var skeletonApplied = {
        changed: false,
        createdModules: 0,
        addedCases: 0,
        details: [],
        diagnostics: {},
      };
      if (skeletonModules.length && skeletonActionId) {
        skeletonApplied = applyRootOutput(skeletonActionId, skeletonModules, visibleContext, getTaskModelRequestDurationMs(task));
      }
      if (actionId === ROOT_ACTIONS.FULL_CASES && skeletonApplied.changed) {
        rootState.hideAiLayer = false;
        rootState.updatedAt = Date.now();
      }

      var fullCasesModuleSnapshot = [];
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        var fullCasesContextAfterSkeleton = ensureVisibleModuleContext(buildVisibleModuleContext());
        var fullCasesMapAfterSkeleton = fullCasesContextAfterSkeleton.map || {};
        fullCasesModuleSnapshot = fullCaseOutputModules.map(function(item) {
          var moduleKey = normalizeModuleKey(item && item.module ? item.module : '');
          var resolvedEntry = moduleKey ? fullCasesMapAfterSkeleton[moduleKey] : null;
          return {
            moduleId: resolvedEntry && resolvedEntry.aiModuleId ? String(resolvedEntry.aiModuleId || '') : '',
            moduleKey: moduleKey,
            module: item && item.module ? item.module : '',
            key_scenarios: item && Array.isArray(item.key_scenarios) ? item.key_scenarios.slice() : [],
            test_points: item && Array.isArray(item.test_points) ? item.test_points.slice() : [],
            coupled_modules: item && Array.isArray(item.coupled_modules) ? item.coupled_modules.slice() : [],
            cases: normalizeFallbackCaseList(item && item.cases, item && item.module ? item.module : ''),
          };
        });
        updateRootPipelineState(function(current) {
          current.generatedDedupeModules = normalizeRootPipelineDedupeModules(fullCasesModuleSnapshot);
        });
      }

      if (actionId === ROOT_ACTIONS.FULL_CASES && Number(task && task.coverageRetryCount || 0) > 0) {
        updateRootPipelineState(function(current) {
          var retryReasonLabels = normalizeHistoryDiagnostics(task && task.coverageRetryReasons ? task.coverageRetryReasons : []);
          appendRootPipelineDiagnostics(current, retryReasonLabels.length
            ? ('自动补强覆盖：' + retryReasonLabels.join('、'))
            : '自动补强覆盖完成');
        });
      }

      updateRootPipelineState(function(current) {
        current.stage = 'modules';
        current.discoveryStatus = 'done';
        if (actionId === ROOT_ACTIONS.FULL_CASES) {
          current.createdModules += Number(skeletonApplied.createdModules || 0);
          mergeRootPipelineDetails(current, skeletonApplied.details);
        } else {
          current.createdModules += Number(skeletonApplied.createdModules || 0);
          mergeRootPipelineDetails(current, skeletonApplied.details);
        }
        if (coverageGapInfo && coverageGapInfo.retryStartError) {
          appendRootPipelineDiagnostics(current, '自动补强未启动：' + summarizeModelOutputText(coverageGapInfo.retryStartError, 80));
        }
      });

      var postContext = ensureVisibleModuleContext(buildVisibleModuleContext());
      var postContextMap = postContext.map || {};
      var descriptors = existingDescriptors.slice();
      newModules.forEach(function(item) {
        var moduleKey = normalizeModuleKey(item && item.module ? item.module : '');
        var resolvedEntry = moduleKey ? postContextMap[moduleKey] : null;
        if (!resolvedEntry) return;
        descriptors.push({
          moduleEntry: resolvedEntry,
          actionId: MODULE_ACTIONS.FULL_CASES,
          rootPipelineNewModule: actionId !== ROOT_ACTIONS.FULL_CASES,
          anchorNodeId: anchorNodeId,
          fallbackCases: normalizeFallbackCaseList(item && item.cases, item && item.module ? item.module : ''),
        });
      });
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        descriptors = newModules.map(function(item) {
          var moduleKey = normalizeModuleKey(item && item.module ? item.module : '');
          var resolvedEntry = moduleKey ? postContextMap[moduleKey] : null;
          if (!resolvedEntry) return null;
          return {
            moduleEntry: resolvedEntry,
            actionId: MODULE_ACTIONS.FULL_CASES,
            rootPipelineNewModule: false,
            anchorNodeId: anchorNodeId,
            fallbackCases: normalizeFallbackCaseList(item && item.cases, item && item.module ? item.module : ''),
          };
        }).filter(Boolean);
      }

      if (descriptors.length > 0) {
        updateRootPipelineState(function(current) {
          current.moduleTaskTotal = Math.max(normalizeRootPipelineTaskCount(current.moduleTaskTotal), descriptors.length);
          current.moduleTaskCompletedKeys = normalizeUniqueStringList(current.moduleTaskCompletedKeys || []);
          current.moduleTaskCompleted = Math.max(normalizeRootPipelineTaskCount(current.moduleTaskCompleted), current.moduleTaskCompletedKeys.length);
        });
        pipeline = getRootPipelineState() || pipeline;
        rootState.running = true;
        rootState.taskId = String(pipeline && pipeline.id ? pipeline.id : '');
        rootState.lastAction = actionId || rootState.lastAction || '';
        rootState.updatedAt = Date.now();
      }

      if (!descriptors.length && !skeletonApplied.changed) {
        var discoveryNoChangeInfo = buildRootNoChangeInfo(actionId, filtered.diagnostics, skeletonApplied.diagnostics, normalizedOutput.diagnostics);
        updateRootPipelineState(function(current) {
          appendRootPipelineDiagnostics(current, [discoveryNoChangeInfo.reasonText].concat(discoveryNoChangeInfo.diagnostics || []));
        });
      }

      if (isDrawerOpen()) {
        queueTerminalMindRender({
          reason: 'root-pipeline-discovery-committed',
          persist: false,
          anchorNodeId: anchorNodeId,
        });
        flushQueuedMindRender();
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);

      var startedCount = await startRootPipelineModuleTasks(pipeline, descriptors, {
        workspaceId: getTaskWorkspaceId(task),
      });
      if (startedCount <= 0) {
        finalizeRootPipelineIfReady(String(pipeline.id || ''), { anchorNodeId: anchorNodeId });
      }
      return startedCount > 0 || skeletonApplied.changed;
    }

    function handleRootPipelineDiscoveryTaskError(task, err, options) {
      var pipeline = ensureRootPipelineStateFromTask(task);
      if (!pipeline || String(pipeline.id || '') !== String(task && task.rootPipelineId ? task.rootPipelineId : '')) {
        return false;
      }
      var opts = options || {};
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var errorInfo = opts.resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(getTaskErrorMessage(task, err)));
      updateRootPipelineState(function(current) {
        current.stage = 'modules';
        current.discoveryStatus = opts.resultKind === 'cancelled' ? 'cancelled' : 'error';
        if (opts.resultKind === 'cancelled') {
          current.cancelled = true;
          current.cancelReason = errorInfo.reasonText;
        } else {
          current.errorCount += 1;
        }
        appendRootPipelineDiagnostics(current, (opts.resultKind === 'cancelled'
          ? ['发现阶段已中断：' + errorInfo.reasonText]
          : ['发现阶段失败：' + errorInfo.reasonText]
        ).concat(errorInfo.diagnostics || []));
      });
      if (isDrawerOpen()) {
        queueTerminalMindRender({ reason: opts.renderReason || 'root-pipeline-discovery-error', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function handleRootPipelineModuleTaskSuccess(task) {
      var pipeline = ensureRootPipelineStateFromTask(task);
      if (!pipeline || String(pipeline.id || '') !== String(task && task.rootPipelineId ? task.rootPipelineId : '')) {
        return false;
      }
      var actionId = String(task && task.actionId ? task.actionId : '');
      var visibleContext = buildVisibleModuleContext();
      var resolvedEntry = resolveTaskModuleEntry(task, visibleContext);
      var anchorNodeId = getManagedTaskAnchorNodeId(task, resolvedEntry);
      var historyModuleTitle = normalizeModuleTitle(
        resolvedEntry && resolvedEntry.title
          ? resolvedEntry.title
          : (task && task.moduleTitle ? task.moduleTitle : '')
      );
      var moduleId = resolvedEntry && resolvedEntry.aiModuleId ? resolvedEntry.aiModuleId : (task && task.moduleId ? task.moduleId : '');
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      var contract = task && task.contract ? task.contract : createOperationContract(actionId, resolvedEntry);
      var moduleResult = resolveModuleTaskResult({
        resultRaw: task && task.resultRaw ? task.resultRaw : '',
        contract: contract,
        visibleContext: visibleContext,
        moduleEntry: resolvedEntry,
        moduleTitle: historyModuleTitle,
        currentAiCases: getAiCasesForModule(moduleId),
        actionId: actionId,
      });
      var normalizedOutput = moduleResult.normalizedOutput;
      var filtered = moduleResult.filtered;
      var targetOutput = moduleResult.targetOutput;
      var visibleCases = moduleResult.visibleCases;
      var nextList = moduleResult.nextList;
      var appended = moduleResult.appended;
      var mergeDiagnostics = moduleResult.mergeDiagnostics;
      var changed = false;
      var addedCount = 0;

      if (actionId === MODULE_ACTIONS.APPEND) {
        if (appended.length > 0) {
          changed = true;
          addedCount = appended.length;
          commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', 'keep-valid');
          if (moduleState) {
            setModuleTopupHighlight(moduleState, resolvedEntry.title, visibleCases.length, appended.length, {
              label: buildRootPipelineModuleHighlightLabel(String(task.rootPipelineActionId || ''), appended.length),
            });
          }
        } else {
          var appendNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
          if (task && task.createdModuleBeforeAction === true && task.rootPipelineNewModule !== true && moduleId) {
            removeAiModuleRecord(moduleId);
          }
          updateRootPipelineState(function(current) {
            appendRootPipelineDiagnostics(current, '模块「' + historyModuleTitle + '」未新增用例：' + appendNoChangeInfo.reasonText);
          });
        }
      } else {
        if (nextList.length > 0) {
          changed = true;
          addedCount = nextList.length;
          commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', '');
          if (moduleState) {
            if (task && task.rootPipelineNewModule === true) {
              setModuleTopupHighlight(moduleState, resolvedEntry.title, 0, nextList.length, { highlightScope: 'subtree' });
            } else if (String(task.rootPipelineActionId || '') === ROOT_ACTIONS.EXISTING_CASES) {
              setModuleTopupHighlight(moduleState, resolvedEntry.title, 0, nextList.length, {
                label: buildRootPipelineModuleHighlightLabel(String(task.rootPipelineActionId || ''), nextList.length),
              });
            } else {
              clearModuleTopupHighlight(moduleState);
            }
          }
        } else {
          var fallbackCases = normalizeFallbackCaseList(task && task.fallbackCases, historyModuleTitle);
          if (fallbackCases.length > 0) {
            changed = true;
            nextList = fallbackCases.slice();
            addedCount = nextList.length;
            commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', '');
            updateRootPipelineState(function(current) {
              appendRootPipelineDiagnostics(current, '模块「' + historyModuleTitle + '」模块任务返回空结果，已回退使用首轮结果');
            });
            if (moduleState) clearModuleTopupHighlight(moduleState);
          } else {
            var fullNoChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
            if (task && task.createdModuleBeforeAction === true && task.rootPipelineNewModule !== true && moduleId) {
              removeAiModuleRecord(moduleId);
            }
            updateRootPipelineState(function(current) {
              appendRootPipelineDiagnostics(current, '模块「' + historyModuleTitle + '」未新增用例：' + fullNoChangeInfo.reasonText);
            });
          }
        }
      }

      if (moduleState) {
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        clearModuleRootPendingAction(moduleState);
        moduleState.updatedAt = Date.now();
      }

      if (changed) {
        updateRootPipelineState(function(current) {
          current.addedCases += addedCount;
          if (String(task && task.rootPipelineActionId ? task.rootPipelineActionId : '') === ROOT_ACTIONS.FULL_CASES) {
            upsertRootPipelineDedupeModule(current, {
              moduleId: moduleId,
              moduleKey: String(task && task.moduleKey ? task.moduleKey : (resolvedEntry && resolvedEntry.moduleKey ? resolvedEntry.moduleKey : '')),
              module: historyModuleTitle,
              key_scenarios: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.scenarios) ? resolvedEntry.aiModule.scenarios.slice() : [],
              test_points: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.points) ? resolvedEntry.aiModule.points.slice() : [],
              coupled_modules: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.coupled) ? resolvedEntry.aiModule.coupled.slice() : [],
              cases: nextList,
            });
          }
          appendRootPipelineModuleDetail(
            current,
            historyModuleTitle,
            addedCount,
            getTaskModelRequestDurationMs(task)
          );
        });
        clearDeleteHistoryStacks();
        syncCasesGenPageRender();
      } else {
        updateRootPipelineState(function(current) {
          appendRootPipelineModuleDetail(
            current,
            historyModuleTitle,
            0,
            getTaskModelRequestDurationMs(task)
          );
        });
      }
      markRootPipelineModuleTaskCompleted(task);
      if (isDrawerOpen()) {
        queueTerminalMindRender({ reason: changed ? 'root-pipeline-module-committed' : 'root-pipeline-module-no-change', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return changed;
    }

    function handleRootPipelineModuleTaskError(task, err, options) {
      var pipeline = ensureRootPipelineStateFromTask(task);
      if (!pipeline || String(pipeline.id || '') !== String(task && task.rootPipelineId ? task.rootPipelineId : '')) {
        return false;
      }
      var opts = options || {};
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var moduleId = task && task.moduleId ? String(task.moduleId || '') : '';
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      var resolvedEntry = resolveTaskModuleEntry(task, buildVisibleModuleContext());
      var moduleTitle = normalizeModuleTitle(
        resolvedEntry && resolvedEntry.title ? resolvedEntry.title : (task && task.moduleTitle ? task.moduleTitle : '')
      );
      var taskErrorText = getTaskErrorMessage(task, err);
      var fallbackCases = normalizeFallbackCaseList(task && task.fallbackCases, moduleTitle);
      var canUseTimeoutFallback = opts.resultKind !== 'cancelled'
        && String(task && task.rootPipelineActionId ? task.rootPipelineActionId : '') === ROOT_ACTIONS.FULL_CASES
        && taskErrorText.indexOf('模型调用超时') !== -1
        && moduleId
        && fallbackCases.length > 0;
      if (canUseTimeoutFallback) {
        commitCaseList(moduleId, fallbackCases, Number(task && task.durationMs || 0), '', '');
        if (moduleState) {
          moduleState.running = false;
          moduleState.taskId = '';
          moduleState.status = '';
          moduleState.error = '';
          moduleState.hideResults = false;
          clearModuleRootPendingAction(moduleState);
          clearModuleTopupHighlight(moduleState);
          moduleState.updatedAt = Date.now();
        }
        updateRootPipelineState(function(current) {
          current.addedCases += fallbackCases.length;
          upsertRootPipelineDedupeModule(current, {
            moduleId: moduleId,
            moduleKey: String(task && task.moduleKey ? task.moduleKey : (resolvedEntry && resolvedEntry.moduleKey ? resolvedEntry.moduleKey : '')),
            module: moduleTitle,
            key_scenarios: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.scenarios) ? resolvedEntry.aiModule.scenarios.slice() : [],
            test_points: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.points) ? resolvedEntry.aiModule.points.slice() : [],
            coupled_modules: resolvedEntry && resolvedEntry.aiModule && Array.isArray(resolvedEntry.aiModule.coupled) ? resolvedEntry.aiModule.coupled.slice() : [],
            cases: fallbackCases,
          });
          appendRootPipelineModuleDetail(
            current,
            moduleTitle,
            fallbackCases.length,
            getTaskModelRequestDurationMs(task)
          );
          var failureMeta = task && task.failureMeta && typeof task.failureMeta === 'object'
            ? task.failureMeta
            : {};
          if (String(failureMeta.kind || '') === 'root-module-tail-fallback') {
            appendRootPipelineDiagnostics(
              current,
              '模块「' + moduleTitle + '」成为尾部慢请求，实际耗时 '
                + formatHistoryDuration(failureMeta.elapsedMs)
                + '，同批 P80 基线 ' + formatHistoryDuration(failureMeta.baselineMs)
                + '，超过动态阈值 ' + formatHistoryDuration(failureMeta.thresholdMs)
                + '（参考 ' + String(Number(failureMeta.peerCount || 0)) + ' 个已完成模块，请求体约 '
                + String(Number(failureMeta.requestPayloadChars || 0)) + ' 字符）'
                + '，已采用首轮备用用例继续流程'
            );
          } else {
            appendRootPipelineDiagnostics(current, '模块「' + moduleTitle + '」模型调用超时，已采用首轮备用用例继续流程');
          }
        });
        markRootPipelineModuleTaskCompleted(task);
        clearDeleteHistoryStacks();
        syncCasesGenPageRender();
        if (isDrawerOpen()) {
          queueTerminalMindRender({ reason: 'root-pipeline-module-timeout-fallback', persist: false, anchorNodeId: anchorNodeId });
        }
        syncTerminalTaskRestoreContext(task);
        persistManagedTaskWorkspaceState(true);
        return true;
      }
      if (moduleState) {
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.status = opts.resultKind === 'cancelled' ? '' : 'error';
        moduleState.error = opts.resultKind === 'cancelled' ? '' : getTaskErrorMessage(task, err);
        moduleState.hideResults = false;
        clearModuleRootPendingAction(moduleState);
        moduleState.updatedAt = Date.now();
      }
      if (task && task.createdModuleBeforeAction === true && task.rootPipelineNewModule !== true && moduleId) {
        removeAiModuleRecord(moduleId);
      }
      var errorInfo = opts.resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(moduleState && moduleState.error ? moduleState.error : getTaskErrorMessage(task, err)));
      updateRootPipelineState(function(current) {
        appendRootPipelineModuleDetail(current, moduleTitle, 0, getTaskModelRequestDurationMs(task));
        if (opts.resultKind === 'cancelled') {
          current.cancelled = true;
          if (!current.cancelReason) current.cancelReason = errorInfo.reasonText;
        } else {
          current.errorCount += 1;
        }
        appendRootPipelineDiagnostics(current, (opts.resultKind === 'cancelled'
          ? ['模块「' + (moduleTitle || '当前模块') + '」已中断：' + errorInfo.reasonText]
          : ['模块「' + (moduleTitle || '当前模块') + '」失败：' + errorInfo.reasonText]
        ).concat(errorInfo.diagnostics || []));
      });
      markRootPipelineModuleTaskCompleted(task);
      if (isDrawerOpen()) {
        queueTerminalMindRender({ reason: opts.renderReason || 'root-pipeline-module-error', persist: false, anchorNodeId: anchorNodeId });
      }
      syncTerminalTaskRestoreContext(task);
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function completeRootTaskSuccess(task) {
      if (task && task.rootPipelineId && String(task.pipelineStage || '') === 'discovery') {
        return handleRootPipelineDiscoveryTaskSuccess(task);
      }
      var actionId = String(task && task.actionId ? task.actionId : '');
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var rootState = ensureRootUiState();
      var contract = task && task.contract ? task.contract : createOperationContract(actionId, null);
      var visibleContext = buildVisibleModuleContext();
      var normalizedOutput = normalizeModelModulesOutputDetailed(task && task.resultRaw ? task.resultRaw : '');
      var filtered = filterModulesByContract(normalizedOutput.list, contract, visibleContext);
      var modules = filtered.list;
      var coverageGapInfo = evaluateRootCoverageGaps(task, modules, contract);
      if (coverageGapInfo.shouldRetry === true) {
        try {
          if (tryStartRootCoverageRetry(task, coverageGapInfo, anchorNodeId)) {
            return false;
          }
        } catch (retryErr) {
          coverageGapInfo.retryStartError = retryErr && retryErr.message ? String(retryErr.message) : '自动补强未能启动';
        }
      }
      var applied = applyRootOutput(actionId, modules, visibleContext, getTaskModelRequestDurationMs(task));
      var historyDiagnostics = buildCoverageRetryHistoryDiagnostics(task);
      if (coverageGapInfo && coverageGapInfo.retryStartError) {
        historyDiagnostics.push('自动补强未启动：' + summarizeModelOutputText(coverageGapInfo.retryStartError, 80));
      }
      rootState.running = false;
      rootState.taskId = '';
      rootState.hideAiLayer = false;
      rootState.status = '';
      rootState.error = '';
      rootState.updatedAt = Date.now();
      clearRootPendingModules(actionId);
      markOpenButtonCompletionNotice({ persist: false });
      if (!applied.changed) {
        var rootNoChangeInfo = buildRootNoChangeInfo(actionId, filtered.diagnostics, applied.diagnostics, normalizedOutput.diagnostics);
        recordGenerationHistory({
          scope: 'root',
          actionId: actionId,
          actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getRootHistoryActionLabel(actionId, task && task.hadAiContentBeforeAction),
          moduleCount: 0,
          details: [],
          resultKind: rootNoChangeInfo.resultKind,
          reasonText: rootNoChangeInfo.reasonText,
          diagnostics: (rootNoChangeInfo.diagnostics || []).concat(historyDiagnostics),
          previewText: rootNoChangeInfo.previewText,
        });
        discardCaseGenOperationSnapshotEntry(task && task.snapshotId ? task.snapshotId : '');
        if (task && task.hadAiCasesBeforeAction === true) setAllModuleResultsVisibility(true);
        notifyStatus('本轮未生成新的模块或用例', 'warn', { forceInline: true });
        if (isDrawerOpen()) queueTerminalMindRender({ reason: 'root-task-no-change', persist: false, anchorNodeId: anchorNodeId });
        persistManagedTaskWorkspaceState(true);
        return false;
      }
      ensureState().mode = (
        actionId === ROOT_ACTIONS.FULL_MODULES
        || actionId === ROOT_ACTIONS.REGENERATE_MODULES
      ) ? 'modules' : 'full';
      rootState.snapshotId = String(ensureState().rootSnapshotId || (task && task.snapshotId ? task.snapshotId : '') || '');
      recordGenerationHistory({
        scope: 'root',
        actionId: actionId,
        actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getRootHistoryActionLabel(actionId, task && task.hadAiContentBeforeAction),
        moduleCount: Array.isArray(applied.details) ? applied.details.length : 0,
        details: applied.details,
        diagnostics: historyDiagnostics,
      });
      var message = '';
      if (actionId === ROOT_ACTIONS.FULL_MODULES) {
        message = '已生成 ' + String(applied.createdModules) + ' 个模块';
      } else if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) {
        message = '已重新生成 ' + String(applied.createdModules) + ' 个模块';
      } else if (actionId === ROOT_ACTIONS.FULL_CASES) {
        message = (task && task.hadAiContentBeforeAction ? '已重新生成 ' : '已生成 ')
          + String(applied.createdModules) + ' 个模块，' + String(applied.addedCases) + ' 条用例';
      } else {
        message = '已补充 ' + String(applied.createdModules) + ' 个模块，' + String(applied.addedCases) + ' 条用例';
      }
      notifyStatus(message, 'ok');
      clearDeleteHistoryStacks();
      syncCasesGenPageRender();
      if (isDrawerOpen()) queueTerminalMindRender({ reason: 'root-task-committed', persist: false, anchorNodeId: anchorNodeId });
      persistManagedTaskWorkspaceState(true);
      return true;
    }

    function completeRootTaskError(task, err, options) {
      if (task && task.rootPipelineId && String(task.pipelineStage || '') === 'discovery') {
        return handleRootPipelineDiscoveryTaskError(task, err, options);
      }
      var opts = options || {};
      var actionId = String(task && task.actionId ? task.actionId : '');
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var rootState = ensureRootUiState();
      discardCaseGenOperationSnapshotEntry(task && task.snapshotId ? task.snapshotId : '');
      rootState.running = false;
      rootState.taskId = '';
      rootState.hideAiLayer = false;
      rootState.status = opts.resultKind === 'cancelled' ? '' : 'error';
      rootState.error = opts.resultKind === 'cancelled' ? '' : getTaskErrorMessage(task, err);
      rootState.updatedAt = Date.now();
      clearRootPendingModules(actionId);
      if (task && task.hadAiCasesBeforeAction === true) setAllModuleResultsVisibility(true);
      var errorInfo = opts.resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(rootState.error));
      var retryHistoryDiagnostics = buildCoverageRetryHistoryDiagnostics(task);
      var failureLabel = opts.resultKind === 'cancelled'
        ? '已中断'
        : getGenerationFailureLabel('root', actionId, {
            hadAiContentBeforeAction: task && task.hadAiContentBeforeAction === true,
            hadAiCasesBeforeAction: task && task.hadAiCasesBeforeAction === true,
          });
      recordGenerationHistory({
        scope: 'root',
        actionId: actionId,
        actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getRootHistoryActionLabel(actionId, task && task.hadAiContentBeforeAction),
        summaryText: failureLabel,
        moduleCount: 0,
        details: [],
        resultKind: errorInfo.resultKind,
        reasonText: errorInfo.reasonText,
        diagnostics: (errorInfo.diagnostics || []).concat(retryHistoryDiagnostics),
        previewText: errorInfo.previewText,
      });
      if (opts.resultKind === 'cancelled') {
        if (!shouldSuppressTaskCancelToast(task)) {
          notifyFloatingStatus('已中断当前 XMind 生成任务', 'warn', 3000);
        }
      } else {
        notifyStatus(failureLabel, 'err', { forceInline: true });
      }
      if (isDrawerOpen()) queueTerminalMindRender({ reason: opts.renderReason || 'root-task-error', persist: false, anchorNodeId: anchorNodeId });
      persistManagedTaskWorkspaceState(true);
      return false;
    }

    function completeModuleTaskSuccess(task) {
      if (task && task.rootPipelineId && task.historySuppressed === true) {
        return handleRootPipelineModuleTaskSuccess(task);
      }
      var actionId = String(task && task.actionId ? task.actionId : '');
      var visibleContext = buildVisibleModuleContext();
      var resolvedEntry = resolveTaskModuleEntry(task, visibleContext);
      var anchorNodeId = getManagedTaskAnchorNodeId(task, resolvedEntry);
      var historyModuleTitle = normalizeModuleTitle(
        resolvedEntry && resolvedEntry.title
          ? resolvedEntry.title
          : (task && task.moduleTitle ? task.moduleTitle : '')
      );
      var moduleId = resolvedEntry && resolvedEntry.aiModuleId ? resolvedEntry.aiModuleId : (task && task.moduleId ? task.moduleId : '');
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      var contract = task && task.contract ? task.contract : createOperationContract(actionId, resolvedEntry);
      var moduleResult = resolveModuleTaskResult({
        resultRaw: task && task.resultRaw ? task.resultRaw : '',
        contract: contract,
        visibleContext: visibleContext,
        moduleEntry: resolvedEntry,
        moduleTitle: historyModuleTitle,
        currentAiCases: getAiCasesForModule(moduleId),
        actionId: actionId,
      });
      var normalizedOutput = moduleResult.normalizedOutput;
      var filtered = moduleResult.filtered;
      var targetOutput = moduleResult.targetOutput;
      var visibleCases = moduleResult.visibleCases;
      var nextList = moduleResult.nextList;
      var appended = moduleResult.appended;
      var mergeDiagnostics = moduleResult.mergeDiagnostics;
      var noChangeMessage = '';
      var noChangeRenderReason = '';

      if (actionId === MODULE_ACTIONS.APPEND) {
        if (!appended.length) {
          noChangeMessage = '当前模块未补充到新的用例';
          noChangeRenderReason = 'module-task-append-empty';
        } else {
          commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', 'keep-valid');
          if (moduleState) setModuleTopupHighlight(moduleState, resolvedEntry.title, visibleCases.length, appended.length);
        }
      } else {
        if (!nextList.length) {
          noChangeMessage = '当前模块未生成到有效用例';
          noChangeRenderReason = 'module-task-full-empty';
        } else {
          commitCaseList(moduleId, nextList, Number(task && task.durationMs || 0), '', '');
          if (moduleState) clearModuleTopupHighlight(moduleState);
        }
      }
      if (noChangeMessage) {
        markOpenButtonCompletionNotice({ persist: false });
        var noChangeInfo = buildModuleNoChangeInfo(actionId, filtered.diagnostics, mergeDiagnostics, targetOutput, normalizedOutput.diagnostics);
        if (task && task.createdModuleBeforeAction === true && task.snapshotId) {
          rollbackCaseGenOperationSnapshotEntry(task.snapshotId);
        } else if (task && task.snapshotId) {
          discardCaseGenOperationSnapshotEntry(task.snapshotId);
        }
        if (task && task.createdModuleBeforeAction === true) {
          removeAiModuleRecord(moduleId);
        }
        if (moduleState) {
          moduleState.running = false;
          moduleState.taskId = '';
          moduleState.hideResults = false;
          moduleState.snapshotId = '';
        }
        recordGenerationHistory({
          scope: 'module',
          moduleTitle: historyModuleTitle,
          actionId: actionId,
          actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getModuleHistoryActionLabel(actionId, resolvedEntry, task && task.hadAiCasesBeforeAction),
          moduleCount: 1,
          details: [{
            module: historyModuleTitle,
            caseCount: 0,
            durationMs: getTaskModelRequestDurationMs(task),
          }],
          resultKind: noChangeInfo.resultKind,
          reasonText: noChangeInfo.reasonText,
          diagnostics: noChangeInfo.diagnostics,
          previewText: noChangeInfo.previewText,
        });
        notifyStatus(noChangeMessage, 'warn', { forceInline: true });
        if (isDrawerOpen()) queueTerminalMindRender({ reason: noChangeRenderReason, persist: false, anchorNodeId: anchorNodeId });
        persistManagedTaskWorkspaceState(true);
        return false;
      }
      markOpenButtonCompletionNotice({ persist: false });

      if (moduleState) {
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.status = '';
        moduleState.error = '';
        moduleState.hideResults = false;
        moduleState.updatedAt = Date.now();
      }
      recordGenerationHistory({
        scope: 'module',
        moduleTitle: historyModuleTitle,
        actionId: actionId,
        actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getModuleHistoryActionLabel(actionId, resolvedEntry, task && task.hadAiCasesBeforeAction),
        moduleCount: 1,
        details: [{
          module: historyModuleTitle,
          caseCount: actionId === MODULE_ACTIONS.APPEND ? appended.length : nextList.length,
          durationMs: getTaskModelRequestDurationMs(task),
        }],
      });
      notifyStatus(
        actionId === MODULE_ACTIONS.APPEND
          ? ('已为该模块补充 ' + String(appended.length) + ' 条用例')
          : ((task && task.hadAiCasesBeforeAction ? '已重新生成 ' : '已生成 ') + String(nextList.length) + ' 条用例'),
        'ok'
      );
      clearDeleteHistoryStacks();
      syncCasesGenPageRender();
      if (isDrawerOpen()) queueTerminalMindRender({ reason: 'module-task-committed', persist: false, anchorNodeId: anchorNodeId });
      persistManagedTaskWorkspaceState(true);
      return true;
    }

    function completeModuleTaskError(task, err, options) {
      if (task && task.rootPipelineId && task.historySuppressed === true) {
        return handleRootPipelineModuleTaskError(task, err, options);
      }
      var opts = options || {};
      var actionId = String(task && task.actionId ? task.actionId : '');
      var anchorNodeId = getManagedTaskAnchorNodeId(task, null);
      var moduleId = task && task.moduleId ? String(task.moduleId || '') : '';
      var moduleState = moduleId ? ensureModuleUiState(moduleId) : null;
      if (task && task.createdModuleBeforeAction === true && task.snapshotId) {
        rollbackCaseGenOperationSnapshotEntry(task.snapshotId);
        if (moduleId) removeAiModuleRecord(moduleId);
      } else if (task && task.snapshotId) {
        discardCaseGenOperationSnapshotEntry(task.snapshotId);
      }
      if (moduleState) {
        moduleState.running = false;
        moduleState.taskId = '';
        moduleState.status = opts.resultKind === 'cancelled' ? '' : 'error';
        moduleState.error = opts.resultKind === 'cancelled' ? '' : getTaskErrorMessage(task, err);
        moduleState.hideResults = false;
        moduleState.updatedAt = Date.now();
      }
      var moduleTitle = normalizeModuleTitle(task && task.moduleTitle ? task.moduleTitle : '');
      var errorInfo = opts.resultKind === 'cancelled'
        ? buildGenerationCancelledInfo(task)
        : buildGenerationErrorInfo(new Error(moduleState && moduleState.error ? moduleState.error : getTaskErrorMessage(task, err)));
      var failureLabel = opts.resultKind === 'cancelled'
        ? '已中断'
        : getGenerationFailureLabel('module', actionId, {
            hadAiCasesBeforeAction: task && task.hadAiCasesBeforeAction === true,
          });
      recordGenerationHistory({
        scope: 'module',
        moduleTitle: moduleTitle,
        actionId: actionId,
        actionLabel: task && task.historyActionLabel ? task.historyActionLabel : getModuleHistoryActionLabel(actionId, null, task && task.hadAiCasesBeforeAction),
        summaryText: failureLabel,
        moduleCount: 1,
        details: [{
          module: moduleTitle,
          caseCount: 0,
          durationMs: getTaskModelRequestDurationMs(task),
        }],
        resultKind: errorInfo.resultKind,
        reasonText: errorInfo.reasonText,
        diagnostics: errorInfo.diagnostics,
        previewText: errorInfo.previewText,
      });
      if (opts.resultKind === 'cancelled') {
        if (!shouldSuppressTaskCancelToast(task)) {
          notifyFloatingStatus('已中断当前 XMind 生成任务', 'warn', 3000);
        }
      } else {
        notifyStatus(failureLabel, 'err', { forceInline: true });
      }
      if (isDrawerOpen()) queueTerminalMindRender({ reason: opts.renderReason || 'module-task-error', persist: false, anchorNodeId: anchorNodeId });
      persistManagedTaskWorkspaceState(true);
      return false;
    }


    return {
      handleRootPipelineDiscoveryTaskSuccess: handleRootPipelineDiscoveryTaskSuccess,
      handleRootPipelineDiscoveryTaskError: handleRootPipelineDiscoveryTaskError,
      handleRootPipelineModuleTaskSuccess: handleRootPipelineModuleTaskSuccess,
      handleRootPipelineModuleTaskError: handleRootPipelineModuleTaskError,
      completeRootTaskSuccess: completeRootTaskSuccess,
      completeRootTaskError: completeRootTaskError,
      completeModuleTaskSuccess: completeModuleTaskSuccess,
      completeModuleTaskError: completeModuleTaskError,
    };
  }

  return { create: create };
});
