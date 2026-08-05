(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.app = root.app || {};
    root.app.xmindCasegenRootPipelineTailRescueController = api;
  }
})(typeof window !== 'undefined' ? window : null, function() {
  function noop() {}

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    function port(name, fallback) {
      return typeof opts[name] === 'function' ? opts[name] : fallback;
    }

    var FULL_CASES_ACTION_ID = String(opts.fullCasesActionId || 'root-full-cases');
    var getTaskManager = port('getTaskManager', function() { return null; });
    var getTimingCore = port('getTimingCore', function() { return null; });
    var listManagedTasks = port('listManagedTasks', function() { return []; });
    var getRootPipelineState = port('getRootPipelineState', function() { return null; });
    var normalizeModuleTitle = port('normalizeModuleTitle', function(value) { return String(value || '').trim(); });
    var normalizeModuleKey = port('normalizeModuleKey', function(value) { return String(value || '').trim().toLowerCase(); });
    var normalizeHistoryDurationMs = port('normalizeHistoryDurationMs', function(value) { return Number(value || 0) || 0; });
    var normalizeRootPipelineTaskCount = port('normalizeRootPipelineTaskCount', function(value) { return Number(value || 0) || 0; });
    var normalizeFallbackCaseList = port('normalizeFallbackCaseList', function(value) { return Array.isArray(value) ? value : []; });
    var estimateTaskContentBlocksSize = port('estimateTaskContentBlocksSize', function() { return 0; });
    var getConfiguredTimeoutSec = port('getConfiguredTimeoutSec', function() { return 300; });
    var now = port('now', function() { return Date.now(); });

    function resolvePipeline(task) {
      var targetId = String(task && task.rootPipelineId ? task.rootPipelineId : '');
      if (!targetId) return null;
      var activePipeline = getRootPipelineState();
      if (activePipeline && String(activePipeline.id || '') === targetId) return activePipeline;
      var restorePipeline = task
        && task.restoreContext
        && task.restoreContext.rootPipeline
        && typeof task.restoreContext.rootPipeline === 'object'
        ? task.restoreContext.rootPipeline
        : null;
      return restorePipeline && String(restorePipeline.id || '') === targetId
        ? restorePipeline
        : null;
    }

    function collectPeerDurations(pipeline, task) {
      var detailMap = pipeline && pipeline.detailMap && typeof pipeline.detailMap === 'object'
        ? pipeline.detailMap
        : {};
      var targetKey = normalizeModuleKey(task && task.moduleTitle ? task.moduleTitle : '');
      return Object.keys(detailMap).map(function(key) {
        if (targetKey && key === targetKey) return 0;
        return normalizeHistoryDurationMs(detailMap[key] && detailMap[key].durationMs);
      }).filter(function(durationMs) {
        return durationMs > 0;
      });
    }

    function estimateRequestSize(task) {
      if (task && task.requestMode === 'content') {
        return estimateTaskContentBlocksSize(task.contentBlocks || []);
      }
      return String(task && task.requestText ? task.requestText : '').length;
    }

    function maybeRescue(eventTask) {
      if (!eventTask || eventTask.scope !== 'module' || !eventTask.rootPipelineId) return false;
      var manager = getTaskManager();
      var timingCore = getTimingCore();
      if (!manager || typeof manager.failTask !== 'function') return false;
      if (!timingCore || typeof timingCore.evaluateTailRequest !== 'function') return false;
      var targetPipelineId = String(eventTask.rootPipelineId || '');
      var runningTasks = listManagedTasks().filter(function(task) {
        return Boolean(
          task
          && task.status === 'running'
          && task.scope === 'module'
          && String(task.rootPipelineId || '') === targetPipelineId
        );
      });
      if (runningTasks.length !== 1) return false;
      var candidate = runningTasks[0];
      if (String(candidate.rootPipelineActionId || '') !== FULL_CASES_ACTION_ID) return false;
      var pipeline = resolvePipeline(candidate);
      if (!pipeline || pipeline.cancelled === true || pipeline.dedupeStatus) return false;
      if (Array.isArray(pipeline.pendingQueue) && pipeline.pendingQueue.length > 0) return false;
      var totalCount = normalizeRootPipelineTaskCount(pipeline.moduleTaskTotal);
      var completedCount = normalizeRootPipelineTaskCount(pipeline.moduleTaskCompleted);
      var fallbackCases = normalizeFallbackCaseList(candidate.fallbackCases, candidate.moduleTitle || '');
      var evaluation = timingCore.evaluateTailRequest({
        timeoutMs: getConfiguredTimeoutSec() * 1000,
        requestStartedAt: Number(candidate.modelRequestStartedAt || 0),
        now: now(),
        remainingCount: Math.max(0, totalCount - completedCount),
        fallbackCaseCount: fallbackCases.length,
        peerDurationsMs: collectPeerDurations(pipeline, candidate),
      });
      if (!evaluation || evaluation.shouldRescue !== true) return false;
      var moduleTitle = normalizeModuleTitle(candidate.moduleTitle || '') || '当前模块';
      return manager.failTask(candidate.id, {
        action: 'error',
        abortReason: 'xmind-casegen-tail-fallback',
        error: '模型调用超时（模块「' + moduleTitle + '」成为尾部慢请求，已按同批模块耗时动态提前收口）',
        meta: {
          kind: 'root-module-tail-fallback',
          module: moduleTitle,
          elapsedMs: Number(evaluation.elapsedMs || 0),
          thresholdMs: Number(evaluation.thresholdMs || 0),
          timeoutMs: Number(evaluation.timeoutMs || 0),
          baselineMs: Number(evaluation.baselineMs || 0),
          peerCount: Number(evaluation.peerCount || 0),
          requestPayloadChars: estimateRequestSize(candidate),
        },
      });
    }

    return {
      resolvePipeline: resolvePipeline,
      collectPeerDurations: collectPeerDurations,
      estimateRequestSize: estimateRequestSize,
      maybeRescue: maybeRescue,
    };
  }

  return { create: create };
});
