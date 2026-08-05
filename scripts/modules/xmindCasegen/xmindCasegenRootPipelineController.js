(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenRootPipelineController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var ensureState = typeof opts.ensureState === 'function' ? opts.ensureState : function() { return {}; };
    var createRootPipelineState = typeof opts.createRootPipelineState === 'function'
      ? opts.createRootPipelineState : function(value) { return value || {}; };
    var mergeRootPipelineSnapshot = typeof opts.mergeRootPipelineSnapshot === 'function'
      ? opts.mergeRootPipelineSnapshot : function(base) { return base || null; };
    var normalizeModuleTitle = typeof opts.normalizeModuleTitle === 'function'
      ? opts.normalizeModuleTitle : function(value) { return String(value || '').trim(); };
    var normalizeModuleKey = typeof opts.normalizeModuleKey === 'function'
      ? opts.normalizeModuleKey : function(value) { return String(value || '').trim().toLowerCase(); };
    var normalizeFallbackCaseList = typeof opts.normalizeFallbackCaseList === 'function'
      ? opts.normalizeFallbackCaseList : function(value) { return Array.isArray(value) ? value : []; };
    var normalizeArrayField = typeof opts.normalizeArrayField === 'function'
      ? opts.normalizeArrayField : function(value) { return Array.isArray(value) ? value : []; };
    var normalizeHistoryDurationMs = typeof opts.normalizeHistoryDurationMs === 'function'
      ? opts.normalizeHistoryDurationMs : function(value) { return Number(value || 0) || 0; };
    var normalizeHistoryDiagnostics = typeof opts.normalizeHistoryDiagnostics === 'function'
      ? opts.normalizeHistoryDiagnostics : function(value) { return Array.isArray(value) ? value : []; };
    var normalizeHistoryDetails = typeof opts.normalizeHistoryDetails === 'function'
      ? opts.normalizeHistoryDetails : function(value) { return Array.isArray(value) ? value : []; };
    var ensureVisibleModuleContext = typeof opts.ensureVisibleModuleContext === 'function'
      ? opts.ensureVisibleModuleContext : function(value) { return value || { list: [], map: {} }; };
    var getVisibleCasesForModuleEntry = typeof opts.getVisibleCasesForModuleEntry === 'function'
      ? opts.getVisibleCasesForModuleEntry : function() { return []; };
    var listManagedXmindTasks = typeof opts.listManagedXmindTasks === 'function'
      ? opts.listManagedXmindTasks : function() { return []; };
    var rootActions = opts.rootActions || {};
    var moduleActions = opts.moduleActions || {};
    var ROOT_ACTIONS = rootActions;
    var MODULE_ACTIONS = moduleActions;
    var getRootHistoryActionLabel = typeof opts.getRootHistoryActionLabel === 'function'
      ? opts.getRootHistoryActionLabel : function() { return ''; };
    var normalizeDedupeMode = typeof opts.normalizeDedupeMode === 'function'
      ? opts.normalizeDedupeMode : function(value) { return String(value || ''); };
    var getDedupeRemovedSummaryText = typeof opts.getDedupeRemovedSummaryText === 'function'
      ? opts.getDedupeRemovedSummaryText : function() { return ''; };
    var getDedupeNoChangeSummaryText = typeof opts.getDedupeNoChangeSummaryText === 'function'
      ? opts.getDedupeNoChangeSummaryText : function() { return ''; };
    var buildTopupHighlightLabel = typeof opts.buildTopupHighlightLabel === 'function'
      ? opts.buildTopupHighlightLabel : function() { return ''; };
    var buildVisibleModuleContext = typeof opts.buildVisibleModuleContext === 'function'
      ? opts.buildVisibleModuleContext : function() { return { list: [], map: {} }; };
    var buildRootPipelineDedupeReadiness = typeof opts.buildRootPipelineDedupeReadiness === 'function'
      ? opts.buildRootPipelineDedupeReadiness : function() { return { missingModules: [], dedupeModules: [] }; };
    var getDedupeModeFromSettings = typeof opts.getDedupeModeFromSettings === 'function'
      ? opts.getDedupeModeFromSettings : function() { return ''; };
    var startAiDedupeTask = typeof opts.startAiDedupeTask === 'function' ? opts.startAiDedupeTask : noop;
    var getActiveWorkspaceId = typeof opts.getActiveWorkspaceId === 'function' ? opts.getActiveWorkspaceId : function() { return ''; };
    var getDedupeModeActionText = typeof opts.getDedupeModeActionText === 'function'
      ? opts.getDedupeModeActionText : function() { return ''; };
    var notifyStatus = typeof opts.notifyStatus === 'function' ? opts.notifyStatus : noop;
    var clearRootPendingModules = typeof opts.clearRootPendingModules === 'function' ? opts.clearRootPendingModules : noop;
    var setAllModuleResultsVisibility = typeof opts.setAllModuleResultsVisibility === 'function'
      ? opts.setAllModuleResultsVisibility : noop;
    var markOpenButtonCompletionNotice = typeof opts.markOpenButtonCompletionNotice === 'function'
      ? opts.markOpenButtonCompletionNotice : noop;
    var getGenerationFailureLabel = typeof opts.getGenerationFailureLabel === 'function'
      ? opts.getGenerationFailureLabel : function() { return ''; };
    var getFriendlyRootEmptyModulesText = typeof opts.getFriendlyRootEmptyModulesText === 'function'
      ? opts.getFriendlyRootEmptyModulesText : function() { return ''; };
    var recordGenerationHistory = typeof opts.recordGenerationHistory === 'function' ? opts.recordGenerationHistory : noop;
    var discardCaseGenOperationSnapshotEntry = typeof opts.discardCaseGenOperationSnapshotEntry === 'function'
      ? opts.discardCaseGenOperationSnapshotEntry : noop;
    var clearDeleteHistoryStacks = typeof opts.clearDeleteHistoryStacks === 'function' ? opts.clearDeleteHistoryStacks : noop;
    var syncCasesGenPageRender = typeof opts.syncCasesGenPageRender === 'function' ? opts.syncCasesGenPageRender : noop;
    var isDrawerOpen = typeof opts.isDrawerOpen === 'function' ? opts.isDrawerOpen : function() { return false; };
    var queueTerminalMindRender = typeof opts.queueTerminalMindRender === 'function' ? opts.queueTerminalMindRender : noop;
    var persistManagedTaskWorkspaceState = typeof opts.persistManagedTaskWorkspaceState === 'function'
      ? opts.persistManagedTaskWorkspaceState : noop;

    function ensureRootUiState() {
      return ensureState().root;
    }

    function getRootPipelineState() {
      var rootState = ensureRootUiState();
      return rootState && rootState.pipeline && typeof rootState.pipeline === 'object'
        ? rootState.pipeline
        : null;
    }

    function setRootPipelineState(pipeline) {
      var rootState = ensureRootUiState();
      rootState.pipeline = pipeline && typeof pipeline === 'object'
        ? pipeline
        : null;
      rootState.updatedAt = Date.now();
      return rootState.pipeline;
    }

    function clearRootPipelineState() {
      return setRootPipelineState(null);
    }

    function updateRootPipelineState(mutator) {
      var current = getRootPipelineState();
      if (!current || typeof mutator !== 'function') return null;
      mutator(current);
      current.updatedAt = Date.now();
      setRootPipelineState(current);
      return current;
    }

    function ensureRootPipelineStateFromTask(task) {
      var taskPipelineId = task && task.rootPipelineId ? String(task.rootPipelineId || '') : '';
      var current = getRootPipelineState();
      if (current && taskPipelineId && String(current.id || '') === taskPipelineId) {
        return current;
      }
      if (!taskPipelineId) return current;
      var reconstructed = createRootPipelineState({
        id: taskPipelineId,
        actionId: task && task.rootPipelineActionId ? String(task.rootPipelineActionId || '') : String(task && task.actionId ? task.actionId : ''),
        snapshotId: task && task.snapshotId ? String(task.snapshotId || '') : '',
        historyActionLabel: task && task.historyActionLabel ? String(task.historyActionLabel || '') : '',
        stage: task && task.pipelineStage ? String(task.pipelineStage || '') : 'modules',
        discoveryStatus: task && task.pipelineStage === 'discovery' ? 'running' : 'done',
        hadAiContentBeforeAction: task && task.hadAiContentBeforeAction === true,
        hadAiLayerBeforeAction: task && task.hadAiLayerBeforeAction === true,
        hadAiCasesBeforeAction: task && task.hadAiCasesBeforeAction === true,
      });
      var restorePipeline = task
        && task.restoreContext
        && task.restoreContext.rootPipeline
        && typeof task.restoreContext.rootPipeline === 'object'
        ? task.restoreContext.rootPipeline
        : null;
      if (restorePipeline && String(restorePipeline.id || '') === taskPipelineId) {
        reconstructed = mergeRootPipelineSnapshot(restorePipeline, reconstructed);
      }
      setRootPipelineState(reconstructed);
      return reconstructed;
    }

    function isTaskInRootPipeline(task, pipelineId) {
      if (!task || !pipelineId) return false;
      return String(task.rootPipelineId || '') === String(pipelineId || '');
    }

    function normalizeRootPipelineTaskCount(value) {
      var total = Number(value || 0);
      if (!Number.isFinite(total) || total < 0) total = 0;
      return Math.floor(total);
    }

    function getRootPipelineModuleTaskCompletionKey(task) {
      if (!task || typeof task !== 'object') return '';
      var taskId = String(task.id || '').trim();
      if (taskId) return 'task:' + taskId;
      var moduleId = String(task.moduleId || '').trim();
      var moduleKey = String(task.moduleKey || '').trim();
      var moduleTitle = normalizeModuleTitle(task.moduleTitle || '');
      var actionId = String(task.actionId || '').trim();
      var rootActionId = String(task.rootPipelineActionId || '').trim();
      var keySeed = moduleId || moduleKey || moduleTitle;
      if (!keySeed) return '';
      return [
        'module',
        keySeed,
        actionId || 'unknown-action',
        rootActionId || 'unknown-root',
      ].join(':');
    }

    function markRootPipelineModuleTaskCompleted(task) {
      var pipelineId = task && task.rootPipelineId ? String(task.rootPipelineId || '') : '';
      if (!pipelineId) return null;
      var completionKey = getRootPipelineModuleTaskCompletionKey(task);
      return updateRootPipelineState(function(current) {
        if (String(current.id || '') !== pipelineId) return;
        if (!Array.isArray(current.moduleTaskCompletedKeys)) {
          current.moduleTaskCompletedKeys = [];
        }
        if (completionKey && current.moduleTaskCompletedKeys.indexOf(completionKey) !== -1) {
          return;
        }
        if (completionKey) {
          current.moduleTaskCompletedKeys.push(completionKey);
        }
        current.moduleTaskCompleted = normalizeRootPipelineTaskCount(current.moduleTaskCompleted) + 1;
      });
    }

    function isRootPipelineModulePhaseComplete(pipeline) {
      if (!pipeline) return true;
      if (pipeline.cancelled === true) return true;
      var total = normalizeRootPipelineTaskCount(pipeline.moduleTaskTotal);
      if (total <= 0) return true;
      var completed = normalizeRootPipelineTaskCount(pipeline.moduleTaskCompleted);
      if (Array.isArray(pipeline.moduleTaskCompletedKeys)) {
        completed = Math.max(completed, pipeline.moduleTaskCompletedKeys.length);
      }
      return completed >= total;
    }

    function collectRootPipelineRunningTasks(pipelineId, tasks) {
      var targetId = String(pipelineId || '');
      if (!targetId) return [];
      var list = Array.isArray(tasks) ? tasks : listManagedXmindTasks();
      return list.filter(function(task) {
        return task && task.status === 'running' && isTaskInRootPipeline(task, targetId);
      });
    }

    function isRootPipelineUiActive(pipeline, tasks) {
      if (!pipeline || !pipeline.id || pipeline.cancelled === true) return false;
      // Root pipeline 存在即表示全量流程尚未 finalize；不要被任务切换空窗误判为空闲。
      return true;
    }

    function isRootGenerationVisuallyRunning(rootState) {
      var currentRootState = rootState || ensureRootUiState();
      if (currentRootState && currentRootState.running === true) return true;
      var pipeline = currentRootState && currentRootState.pipeline && typeof currentRootState.pipeline === 'object'
        ? currentRootState.pipeline
        : getRootPipelineState();
      return isRootPipelineUiActive(pipeline);
    }

    function serializeRootPipelineDescriptor(descriptor) {
      var moduleEntry = descriptor && descriptor.moduleEntry ? descriptor.moduleEntry : null;
      var moduleTitle = normalizeModuleTitle(moduleEntry && moduleEntry.title ? moduleEntry.title : '');
      return {
        moduleId: String(moduleEntry && moduleEntry.aiModuleId ? moduleEntry.aiModuleId : ''),
        moduleKey: String(moduleEntry && moduleEntry.moduleKey ? moduleEntry.moduleKey : ''),
        moduleTitle: moduleTitle,
        actionId: String(descriptor && descriptor.actionId ? descriptor.actionId : ''),
        rootPendingActionId: String(descriptor && descriptor.rootPendingActionId ? descriptor.rootPendingActionId : ''),
        rootPipelineNewModule: descriptor && descriptor.rootPipelineNewModule === true,
        forceCreatedModuleBeforeAction: descriptor && descriptor.forceCreatedModuleBeforeAction === true,
        anchorNodeId: descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'anchorNodeId')
          ? String(descriptor.anchorNodeId || '')
          : '',
        fallbackCases: normalizeFallbackCaseList(descriptor && descriptor.fallbackCases, moduleTitle),
      };
    }

    function resolveRootPipelineDescriptor(serialized, visibleContext) {
      if (!serialized || typeof serialized !== 'object') return null;
      var context = ensureVisibleModuleContext(visibleContext);
      var contextMap = context.map || {};
      var targetModuleId = String(serialized.moduleId || '');
      var targetModuleKey = String(serialized.moduleKey || '');
      var targetTitle = normalizeModuleTitle(serialized.moduleTitle || '');
      var moduleEntry = null;
      if (targetModuleId) {
        context.list.some(function(entry) {
          if (entry && String(entry.aiModuleId || '') === targetModuleId) {
            moduleEntry = entry;
            return true;
          }
          return false;
        });
      }
      if (!moduleEntry && targetModuleKey && contextMap[targetModuleKey]) {
        moduleEntry = contextMap[targetModuleKey];
      }
      if (!moduleEntry && targetTitle) {
        context.list.some(function(entry) {
          if (normalizeModuleTitle(entry && entry.title ? entry.title : '') === targetTitle) {
            moduleEntry = entry;
            return true;
          }
          return false;
        });
      }
      if (!moduleEntry) return null;
      return {
        moduleEntry: moduleEntry,
        actionId: String(serialized.actionId || ''),
        rootPendingActionId: String(serialized.rootPendingActionId || ''),
        rootPipelineNewModule: serialized.rootPipelineNewModule === true,
        forceCreatedModuleBeforeAction: serialized.forceCreatedModuleBeforeAction === true,
        anchorNodeId: String(serialized.anchorNodeId || ''),
        fallbackCases: normalizeFallbackCaseList(serialized.fallbackCases, moduleEntry && moduleEntry.title ? moduleEntry.title : targetTitle),
      };
    }

    function replaceRootPipelinePendingQueue(pipelineId, descriptors) {
      var targetId = String(pipelineId || '');
      return updateRootPipelineState(function(current) {
        if (String(current.id || '') !== targetId) return;
        current.pendingQueue = (Array.isArray(descriptors) ? descriptors : [])
          .map(function(item) { return serializeRootPipelineDescriptor(item); })
          .filter(function(item) { return Boolean(item && item.actionId); });
      });
    }

    function shiftRootPipelinePendingDescriptor(pipelineId) {
      var targetId = String(pipelineId || '');
      var nextSerialized = null;
      updateRootPipelineState(function(current) {
        if (String(current.id || '') !== targetId) return;
        if (!Array.isArray(current.pendingQueue)) current.pendingQueue = [];
        nextSerialized = current.pendingQueue.shift() || null;
      });
      return nextSerialized;
    }

    function ensureRootPipelineDetailEntry(pipeline, moduleTitle) {
      if (!pipeline || typeof pipeline !== 'object') return null;
      if (!pipeline.detailMap || typeof pipeline.detailMap !== 'object') {
        pipeline.detailMap = {};
      }
      var title = normalizeModuleTitle(moduleTitle || '');
      var key = normalizeModuleKey(title || '') || ('module-' + String(Object.keys(pipeline.detailMap).length + 1));
      if (!pipeline.detailMap[key]) {
        pipeline.detailMap[key] = {
          module: title || '未命名模块',
          caseCount: 0,
          durationMs: 0,
        };
      }
      return pipeline.detailMap[key];
    }

    function appendRootPipelineModuleDetail(pipeline, moduleTitle, caseCount, durationMs) {
      var entry = ensureRootPipelineDetailEntry(pipeline, moduleTitle);
      if (!entry) return;
      var nextCount = Number(caseCount);
      if (!Number.isFinite(nextCount) || nextCount < 0) nextCount = 0;
      entry.caseCount += nextCount;
      var nextDurationMs = normalizeHistoryDurationMs(durationMs);
      if (nextDurationMs > 0) entry.durationMs = nextDurationMs;
    }

    function appendRootPipelineDiagnostics(pipeline, items) {
      if (!pipeline || typeof pipeline !== 'object') return;
      var next = Array.isArray(items) ? items : [items];
      pipeline.diagnostics = normalizeHistoryDiagnostics((pipeline.diagnostics || []).concat(next));
    }

    function normalizeRootPipelineDedupeModule(item) {
      if (!item || typeof item !== 'object') return null;
      var moduleTitle = normalizeModuleTitle(item.module || item.moduleTitle || item.title || '');
      var moduleId = item.moduleId || item.module_id ? String(item.moduleId || item.module_id || '') : '';
      var moduleKey = String(item.moduleKey || item.module_key || normalizeModuleKey(moduleTitle || moduleId || ''));
      var cases = normalizeFallbackCaseList(item.cases || [], moduleTitle);
      if (!moduleTitle || !cases.length) return null;
      return {
        moduleId: moduleId,
        moduleKey: moduleKey || normalizeModuleKey(moduleTitle),
        module: moduleTitle,
        key_scenarios: normalizeArrayField(item.key_scenarios || item.scenarios),
        test_points: normalizeArrayField(item.test_points || item.points),
        coupled_modules: normalizeArrayField(item.coupled_modules || item.coupled),
        cases: cases,
      };
    }

    function normalizeRootPipelineDedupeModules(list) {
      var result = [];
      var indexMap = {};
      (Array.isArray(list) ? list : []).forEach(function(item) {
        var normalized = normalizeRootPipelineDedupeModule(item);
        if (!normalized) return;
        var key = normalized.moduleId
          ? ('id:' + normalized.moduleId)
          : ('key:' + (normalized.moduleKey || normalizeModuleKey(normalized.module)));
        if (indexMap[key] === undefined) {
          indexMap[key] = result.length;
          result.push(normalized);
          return;
        }
        var existing = result[indexMap[key]];
        if (!existing || normalized.cases.length >= existing.cases.length) {
          result[indexMap[key]] = normalized;
        }
      });
      return result;
    }

    function hasRootPipelineDedupeCases(modules) {
      return (Array.isArray(modules) ? modules : []).some(function(item) {
        return Boolean(item && Array.isArray(item.cases) && item.cases.length > 0);
      });
    }

    function upsertRootPipelineDedupeModule(pipeline, item) {
      if (!pipeline || typeof pipeline !== 'object') return;
      var normalized = normalizeRootPipelineDedupeModule(item);
      if (!normalized) return;
      var list = normalizeRootPipelineDedupeModules(pipeline.generatedDedupeModules || []);
      var replaced = false;
      list.forEach(function(existing, index) {
        if (replaced) return;
        var sameId = normalized.moduleId && existing.moduleId && normalized.moduleId === existing.moduleId;
        var sameKey = normalized.moduleKey && existing.moduleKey && normalized.moduleKey === existing.moduleKey;
        if (!sameId && !sameKey) return;
        if ((normalized.cases || []).length > (existing.cases || []).length) {
          list[index] = normalized;
        }
        replaced = true;
      });
      if (!replaced) list.push(normalized);
      pipeline.generatedDedupeModules = list;
    }

    function mergeRootPipelineDetails(pipeline, details) {
      (Array.isArray(details) ? details : []).forEach(function(item) {
        if (!item) return;
        appendRootPipelineModuleDetail(
          pipeline,
          item.module || item.moduleTitle || '',
          Number(item.caseCount || 0),
          Number(item.durationMs || 0)
        );
      });
    }

    function getRootPipelineDetailList(pipeline) {
      var detailMap = pipeline && pipeline.detailMap && typeof pipeline.detailMap === 'object'
        ? pipeline.detailMap
        : {};
      return normalizeHistoryDetails(Object.keys(detailMap).map(function(key) {
        return detailMap[key];
      }));
    }

    function countRootPipelineFallbackModules(pipeline) {
      return normalizeHistoryDiagnostics(pipeline && pipeline.diagnostics ? pipeline.diagnostics : []).filter(function(item) {
        return String(item || '').indexOf('已采用首轮备用用例') !== -1;
      }).length;
    }

    function buildRootPipelineSuccessMessage(pipeline) {
      var actionId = pipeline && pipeline.actionId ? String(pipeline.actionId || '') : '';
      var createdModules = Number(pipeline && pipeline.createdModules || 0);
      var addedCases = Number(pipeline && pipeline.addedCases || 0);
      if (!Number.isFinite(createdModules) || createdModules < 0) createdModules = 0;
      if (!Number.isFinite(addedCases) || addedCases < 0) addedCases = 0;
      if (actionId === ROOT_ACTIONS.FULL_CASES) {
        if (createdModules <= 0) {
          createdModules = getRootPipelineDetailList(pipeline).length;
        }
        var baseText = (pipeline && pipeline.hadAiContentBeforeAction === true ? '已重新生成 ' : '已生成 ')
          + String(createdModules) + ' 个模块，' + String(addedCases) + ' 条用例';
        var dedupeMode = normalizeDedupeMode(pipeline && pipeline.dedupeMode ? pipeline.dedupeMode : '');
        if (pipeline && pipeline.dedupeStatus === 'done') {
          var removedCount = Number(pipeline.dedupeRemovedCount || 0) || 0;
          if (removedCount > 0) {
            baseText += '，' + getDedupeRemovedSummaryText(removedCount, dedupeMode).replace(/用例$/, '').trim();
          } else {
            baseText += '，' + getDedupeNoChangeSummaryText(dedupeMode);
          }
        } else if (pipeline && pipeline.dedupeStatus === 'blocked') {
          baseText += '，仍有模块未生成用例，已暂停 AI 用例去重';
        } else if (pipeline && pipeline.dedupeStatus === 'error') {
          baseText += '，AI 用例去重失败，已保留原结果';
        } else if (pipeline && pipeline.dedupeStatus === 'cancelled') {
          baseText += '，AI 用例去重已中断，已保留当前结果';
        }
        var fallbackModuleCount = countRootPipelineFallbackModules(pipeline);
        if (fallbackModuleCount > 0) {
          baseText += '，' + String(fallbackModuleCount) + ' 个模块已使用备用结果';
        }
        return baseText;
      }
      if (actionId === ROOT_ACTIONS.EXISTING_CASES) {
        if (createdModules > 0) {
          return '已补充 ' + String(createdModules) + ' 个模块，' + String(addedCases) + ' 条用例';
        }
        return '已补充 ' + String(addedCases) + ' 条用例';
      }
      if (actionId === ROOT_ACTIONS.TOPUP_MODULES_CASES || actionId === ROOT_ACTIONS.APPEND_ALL) {
        return '已补充 ' + String(createdModules) + ' 个模块，' + String(addedCases) + ' 条用例';
      }
      if (actionId === ROOT_ACTIONS.FULL_MODULES) {
        return '已生成 ' + String(createdModules) + ' 个模块';
      }
      if (actionId === ROOT_ACTIONS.REGENERATE_MODULES) {
        return '已重新生成 ' + String(createdModules) + ' 个模块';
      }
      return '已完成当前生成';
    }

    function buildRootPipelineModuleHighlightLabel(rootActionId, count) {
      var total = Number(count);
      if (!Number.isFinite(total) || total < 0) total = 0;
      if (rootActionId === ROOT_ACTIONS.EXISTING_CASES) {
        return total > 1 ? ('本轮补全用例 · ' + String(total) + ' 条') : '本轮补全用例';
      }
      return buildTopupHighlightLabel(total, 'cases');
    }

    function finalizeRootPipelineIfReady(pipelineId, options) {
      var targetId = String(pipelineId || '');
      var pipeline = getRootPipelineState();
      if (!pipeline || String(pipeline.id || '') !== targetId) return false;
      if (Array.isArray(pipeline.pendingQueue) && pipeline.pendingQueue.length > 0) return false;
      var relatedTasks = listManagedXmindTasks().filter(function(task) {
        return isTaskInRootPipeline(task, targetId);
      });
      if (relatedTasks.length > 0) return false;
      if (!isRootPipelineModulePhaseComplete(pipeline)) return false;

      var opts = options || {};
      var actionId = String(pipeline.actionId || '');
      var rootState = ensureRootUiState();
      var detailList = getRootPipelineDetailList(pipeline);
      var diagnostics = normalizeHistoryDiagnostics(pipeline.diagnostics || []);
      var changed = Number(pipeline.createdModules || 0) > 0 || Number(pipeline.addedCases || 0) > 0;
      var actionLabel = pipeline.historyActionLabel || getRootHistoryActionLabel(actionId, pipeline.hadAiContentBeforeAction === true);
      var renderReason = 'root-pipeline-finalized';
      var summaryText = '';
      var reasonText = '';
      var previewText = '';
      var resultKind = 'changed';
      var notifyText = '';
      var notifyType = 'ok';

      if (
        changed
        && actionId === ROOT_ACTIONS.FULL_CASES
        && pipeline.cancelled !== true
        && !pipeline.dedupeStatus
      ) {
        if (Number(pipeline.errorCount || 0) > 0) {
          updateRootPipelineState(function(current) {
            current.dedupeStatus = 'skipped';
            current.dedupeError = '';
            appendRootPipelineDiagnostics(current, '存在未成功模块，已跳过自动 AI 用例去重并保留已完成结果');
          });
          pipeline = getRootPipelineState() || pipeline;
          diagnostics = normalizeHistoryDiagnostics((diagnostics || []).concat('存在未成功模块，已跳过自动 AI 用例去重'));
        } else if (pipeline.restoredAfterRefresh === true) {
          updateRootPipelineState(function(current) {
            current.dedupeStatus = 'skipped';
          });
          pipeline = getRootPipelineState() || pipeline;
        } else {
        rootState.hideAiLayer = false;
        rootState.updatedAt = Date.now();
        var dedupeContext = buildVisibleModuleContext({ includeAiLayer: true });
        var readiness = buildRootPipelineDedupeReadiness(dedupeContext);
        var missingDedupeModules = readiness.missingModules || [];
        var dedupeModules = readiness.dedupeModules || [];
        var missingNames = missingDedupeModules.map(function(item) {
          return item && item.module ? String(item.module || '') : '';
        }).filter(Boolean).slice(0, 5).join('、');
        if (missingDedupeModules.length > 0) {
          var missingText = '还有 ' + String(missingDedupeModules.length) + ' 个模块未生成用例，已暂停去重'
            + (missingNames ? '：' + missingNames : '');
          updateRootPipelineState(function(current) {
            current.dedupeStatus = 'blocked';
            current.dedupeError = missingText;
            appendRootPipelineDiagnostics(current, missingText);
          });
          pipeline = getRootPipelineState() || pipeline;
          diagnostics = normalizeHistoryDiagnostics((diagnostics || []).concat(missingText));
          notifyStatus(missingText, 'warn', { forceInline: true });
        } else if (dedupeModules.length) {
          try {
            var autoDedupeMode = getDedupeModeFromSettings();
            startAiDedupeTask({
              source: 'auto-full',
              modules: dedupeModules,
              workspaceId: getActiveWorkspaceId(),
              rootPipelineId: targetId,
              rootPipelineActionId: actionId,
              dedupeMode: autoDedupeMode,
            });
            notifyStatus('全量用例已生成，正在进行 AI ' + getDedupeModeActionText(autoDedupeMode), 'warn', { forceInline: true });
            return false;
          } catch (dedupeStartErr) {
            updateRootPipelineState(function(current) {
              current.dedupeStatus = 'error';
              current.dedupeError = dedupeStartErr && dedupeStartErr.message ? String(dedupeStartErr.message) : 'AI 用例去重启动失败';
              appendRootPipelineDiagnostics(current, 'AI 用例去重启动失败：' + current.dedupeError);
            });
            pipeline = getRootPipelineState() || pipeline;
            diagnostics = normalizeHistoryDiagnostics((diagnostics || []).concat('AI 用例去重启动失败，已保留原结果'));
          }
        } else {
          updateRootPipelineState(function(current) {
            current.dedupeStatus = 'skipped';
            appendRootPipelineDiagnostics(current, '当前没有可去重的 AI 生成用例，已跳过去重');
          });
          pipeline = getRootPipelineState() || pipeline;
          diagnostics = normalizeHistoryDiagnostics((diagnostics || []).concat('当前没有可去重的 AI 生成用例，已跳过去重'));
        }
        }
      }

      rootState.running = false;
      rootState.taskId = '';
      rootState.lastAction = actionId || rootState.lastAction || '';
      rootState.hideAiLayer = false;
      rootState.updatedAt = Date.now();
      clearRootPendingModules();
      if (pipeline.hadAiCasesBeforeAction === true) {
        setAllModuleResultsVisibility(true);
      }
      if (pipeline.cancelled !== true) {
        markOpenButtonCompletionNotice({ persist: false });
      }

      if (!changed) {
        if (pipeline.cancelled === true) {
          resultKind = 'cancelled';
          reasonText = pipeline.cancelReason || '已手动中断当前 XMind 生成任务';
          summaryText = '已中断';
          notifyType = 'warn';
          renderReason = 'root-pipeline-cancelled';
        } else if (Number(pipeline.errorCount || 0) > 0 || pipeline.discoveryStatus === 'error') {
          resultKind = 'error';
          reasonText = '模型调用出错，请稍后重试。';
          summaryText = getGenerationFailureLabel('root', actionId, {
            hadAiContentBeforeAction: pipeline.hadAiContentBeforeAction === true,
            hadAiCasesBeforeAction: pipeline.hadAiCasesBeforeAction === true,
          });
          notifyText = summaryText;
          notifyType = 'err';
          rootState.status = 'error';
          rootState.error = reasonText;
          renderReason = 'root-pipeline-error';
        } else {
          resultKind = 'no-change';
          reasonText = getFriendlyRootEmptyModulesText(actionId);
          notifyText = '本轮未生成新的模块或用例';
          notifyType = 'warn';
          renderReason = 'root-pipeline-no-change';
          rootState.status = '';
          rootState.error = '';
        }
        recordGenerationHistory({
          scope: 'root',
          actionId: actionId,
          actionLabel: actionLabel,
          summaryText: summaryText,
          moduleCount: 0,
          details: [],
          resultKind: resultKind,
          reasonText: reasonText,
          diagnostics: diagnostics,
          previewText: previewText,
        });
        discardCaseGenOperationSnapshotEntry(String(pipeline.snapshotId || ''));
        rootState.snapshotId = '';
      } else {
        ensureState().mode = (
          actionId === ROOT_ACTIONS.FULL_MODULES
          || actionId === ROOT_ACTIONS.REGENERATE_MODULES
        ) ? 'modules' : 'full';
        rootState.status = '';
        rootState.error = '';
        rootState.snapshotId = String(ensureState().rootSnapshotId || pipeline.snapshotId || '');
        if (pipeline.cancelled === true) {
          diagnostics = normalizeHistoryDiagnostics(diagnostics.concat('已中断未完成任务，已保留已完成结果'));
          summaryText = '已中断，已保留已完成结果';
          notifyText = buildRootPipelineSuccessMessage(pipeline) + '，其余任务已中断';
          notifyType = 'warn';
        } else if (Number(pipeline.errorCount || 0) > 0) {
          diagnostics = normalizeHistoryDiagnostics(diagnostics.concat('有 ' + String(Number(pipeline.errorCount || 0)) + ' 个模块未成功完成'));
          summaryText = '部分模块未成功完成';
          notifyText = buildRootPipelineSuccessMessage(pipeline) + '，另有 ' + String(Number(pipeline.errorCount || 0)) + ' 个模块失败';
          notifyType = 'warn';
        } else if (pipeline.dedupeStatus === 'error') {
          diagnostics = normalizeHistoryDiagnostics(diagnostics.concat('AI 用例去重失败，已保留原结果'));
          summaryText = 'AI 用例去重失败，已保留原结果';
          notifyText = buildRootPipelineSuccessMessage(pipeline);
          notifyType = 'warn';
        } else if (pipeline.dedupeStatus === 'cancelled') {
          diagnostics = normalizeHistoryDiagnostics(diagnostics.concat('AI 用例去重已中断，已保留当前结果'));
          summaryText = 'AI 用例去重已中断，已保留当前结果';
          notifyText = buildRootPipelineSuccessMessage(pipeline);
          notifyType = 'warn';
        } else if (pipeline.dedupeStatus === 'blocked') {
          summaryText = '仍有模块未生成用例，已暂停 AI 用例去重';
          notifyText = pipeline.dedupeError || summaryText;
          notifyType = 'warn';
          rootState.status = 'error';
          rootState.error = notifyText;
        } else if (pipeline.dedupeStatus === 'done') {
          summaryText = buildRootPipelineSuccessMessage(pipeline);
          notifyText = summaryText;
          notifyType = 'ok';
        } else {
          notifyText = buildRootPipelineSuccessMessage(pipeline);
          notifyType = 'ok';
        }
        recordGenerationHistory({
          scope: 'root',
          actionId: actionId,
          actionLabel: actionLabel,
          summaryText: summaryText,
          moduleCount: detailList.length,
          details: detailList,
          diagnostics: diagnostics,
          dedupeRecords: pipeline.dedupeRecords || [],
        });
        clearDeleteHistoryStacks();
        syncCasesGenPageRender();
      }

      clearRootPipelineState();
      if (notifyText) {
        notifyStatus(notifyText, notifyType, { forceInline: true });
      }
      if (isDrawerOpen()) {
        queueTerminalMindRender({
          reason: renderReason,
          persist: false,
          anchorNodeId: Object.prototype.hasOwnProperty.call(opts, 'anchorNodeId') ? String(opts.anchorNodeId || '') : '',
        });
      }
      persistManagedTaskWorkspaceState(true);
      return changed;
    }

    function shouldUseRootPipeline(actionId) {
      return actionId === rootActions.FULL_CASES
        || actionId === rootActions.EXISTING_CASES
        || actionId === rootActions.TOPUP_MODULES_CASES
        || actionId === rootActions.APPEND_ALL;
    }

    function buildRootPipelineTaskDescriptors(actionId, visibleContext) {
      var descriptors = [];
      var context = ensureVisibleModuleContext(visibleContext);
      if (actionId !== rootActions.EXISTING_CASES && actionId !== rootActions.APPEND_ALL) {
        return descriptors;
      }
      context.list.forEach(function(entry) {
        if (!entry) return;
        var hasVisibleCases = getVisibleCasesForModuleEntry(entry).length > 0;
        descriptors.push({
          moduleEntry: entry,
          actionId: hasVisibleCases ? moduleActions.APPEND : moduleActions.FULL_CASES,
          rootPendingActionId: actionId === rootActions.EXISTING_CASES && hasVisibleCases
            ? rootActions.EXISTING_CASES
            : '',
          rootPipelineNewModule: false,
        });
      });
      return descriptors;
    }

    return {
      ensureRootUiState: ensureRootUiState,
      getRootPipelineState: getRootPipelineState,
      setRootPipelineState: setRootPipelineState,
      clearRootPipelineState: clearRootPipelineState,
      updateRootPipelineState: updateRootPipelineState,
      ensureRootPipelineStateFromTask: ensureRootPipelineStateFromTask,
      isTaskInRootPipeline: isTaskInRootPipeline,
      normalizeRootPipelineTaskCount: normalizeRootPipelineTaskCount,
      getRootPipelineModuleTaskCompletionKey: getRootPipelineModuleTaskCompletionKey,
      markRootPipelineModuleTaskCompleted: markRootPipelineModuleTaskCompleted,
      isRootPipelineModulePhaseComplete: isRootPipelineModulePhaseComplete,
      collectRootPipelineRunningTasks: collectRootPipelineRunningTasks,
      isRootPipelineUiActive: isRootPipelineUiActive,
      isRootGenerationVisuallyRunning: isRootGenerationVisuallyRunning,
      serializeRootPipelineDescriptor: serializeRootPipelineDescriptor,
      resolveRootPipelineDescriptor: resolveRootPipelineDescriptor,
      replaceRootPipelinePendingQueue: replaceRootPipelinePendingQueue,
      shiftRootPipelinePendingDescriptor: shiftRootPipelinePendingDescriptor,
      ensureRootPipelineDetailEntry: ensureRootPipelineDetailEntry,
      appendRootPipelineModuleDetail: appendRootPipelineModuleDetail,
      appendRootPipelineDiagnostics: appendRootPipelineDiagnostics,
      normalizeRootPipelineDedupeModule: normalizeRootPipelineDedupeModule,
      normalizeRootPipelineDedupeModules: normalizeRootPipelineDedupeModules,
      hasRootPipelineDedupeCases: hasRootPipelineDedupeCases,
      upsertRootPipelineDedupeModule: upsertRootPipelineDedupeModule,
      mergeRootPipelineDetails: mergeRootPipelineDetails,
      getRootPipelineDetailList: getRootPipelineDetailList,
      countRootPipelineFallbackModules: countRootPipelineFallbackModules,
      buildRootPipelineSuccessMessage: buildRootPipelineSuccessMessage,
      buildRootPipelineModuleHighlightLabel: buildRootPipelineModuleHighlightLabel,
      finalizeRootPipelineIfReady: finalizeRootPipelineIfReady,
      shouldUseRootPipeline: shouldUseRootPipeline,
      buildRootPipelineTaskDescriptors: buildRootPipelineTaskDescriptors,
    };
  }

  return { create: create };
});
