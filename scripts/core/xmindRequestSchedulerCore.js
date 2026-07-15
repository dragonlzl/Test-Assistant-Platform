(function() {
  window.app = window.app || {};

  var DEFAULT_MAX_CONCURRENT_REQUESTS = 5;
  var DEFAULT_WORKSPACE_ID = '__xmind_default_workspace__';

  function normalizeText(value) {
    return value === null || value === undefined ? '' : String(value || '').trim();
  }

  function createScheduler(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var configuredLimit = Number(opts.maxConcurrentPerWorkspace || DEFAULT_MAX_CONCURRENT_REQUESTS);
    var maxConcurrentPerWorkspace = Number.isFinite(configuredLimit) && configuredLimit > 0
      ? Math.floor(configuredLimit)
      : DEFAULT_MAX_CONCURRENT_REQUESTS;
    var workspaceStates = {};
    var queuedRequests = {};
    var activeRequests = {};
    var sequence = 0;

    function normalizeWorkspaceId(value) {
      return normalizeText(value) || DEFAULT_WORKSPACE_ID;
    }

    function buildRequestId(workspaceId, requestKey) {
      return normalizeWorkspaceId(workspaceId) + '\u0000' + normalizeText(requestKey);
    }

    function getWorkspaceState(workspaceId, create) {
      var targetId = normalizeWorkspaceId(workspaceId);
      var state = workspaceStates[targetId];
      if (!state && create === true) {
        state = {
          workspaceId: targetId,
          activeCount: 0,
          queue: [],
        };
        workspaceStates[targetId] = state;
      }
      return state || null;
    }

    function cleanupWorkspaceState(workspaceId) {
      var targetId = normalizeWorkspaceId(workspaceId);
      var state = workspaceStates[targetId];
      if (!state || state.activeCount > 0 || state.queue.length > 0) return false;
      delete workspaceStates[targetId];
      return true;
    }

    function settleQueuedRequest(entry, granted) {
      if (!entry || entry.settled === true) return false;
      entry.settled = true;
      delete queuedRequests[entry.requestId];
      if (typeof entry.resolve === 'function') entry.resolve(granted === true);
      return true;
    }

    function isRequestValid(entry) {
      if (!entry || typeof entry.isValid !== 'function') return true;
      try {
        return entry.isValid() !== false;
      } catch (err) {
        return false;
      }
    }

    function drainWorkspace(workspaceId) {
      var state = getWorkspaceState(workspaceId, false);
      if (!state) return 0;
      var grantedCount = 0;
      while (state.activeCount < maxConcurrentPerWorkspace && state.queue.length) {
        var entry = state.queue.shift();
        if (!entry || entry.settled === true) continue;
        if (!isRequestValid(entry)) {
          settleQueuedRequest(entry, false);
          continue;
        }
        state.activeCount += 1;
        activeRequests[entry.requestId] = entry;
        settleQueuedRequest(entry, true);
        grantedCount += 1;
      }
      cleanupWorkspaceState(state.workspaceId);
      return grantedCount;
    }

    function acquire(input) {
      var source = input && typeof input === 'object' ? input : {};
      var workspaceId = normalizeWorkspaceId(source.workspaceId);
      var requestKey = normalizeText(source.requestKey);
      var taskId = normalizeText(source.taskId);
      if (!requestKey || !taskId) return Promise.resolve(false);
      var requestId = buildRequestId(workspaceId, requestKey);
      if (queuedRequests[requestId] || activeRequests[requestId]) return Promise.resolve(false);
      return new Promise(function(resolve) {
        var state = getWorkspaceState(workspaceId, true);
        var entry = {
          requestId: requestId,
          requestKey: requestKey,
          workspaceId: workspaceId,
          taskId: taskId,
          sequence: sequence,
          isValid: typeof source.isValid === 'function' ? source.isValid : null,
          resolve: resolve,
          settled: false,
        };
        sequence += 1;
        queuedRequests[requestId] = entry;
        state.queue.push(entry);
        drainWorkspace(workspaceId);
      });
    }

    function release(input) {
      var source = input && typeof input === 'object' ? input : {};
      var requestId = buildRequestId(source.workspaceId, source.requestKey);
      var entry = activeRequests[requestId];
      if (!entry) return false;
      delete activeRequests[requestId];
      var state = getWorkspaceState(entry.workspaceId, false);
      if (state) state.activeCount = Math.max(0, state.activeCount - 1);
      drainWorkspace(entry.workspaceId);
      cleanupWorkspaceState(entry.workspaceId);
      return true;
    }

    function cancelTask(taskId) {
      var targetId = normalizeText(taskId);
      if (!targetId) return 0;
      var removedCount = 0;
      Object.keys(workspaceStates).forEach(function(workspaceId) {
        var state = workspaceStates[workspaceId];
        for (var index = state.queue.length - 1; index >= 0; index -= 1) {
          var entry = state.queue[index];
          if (!entry || entry.taskId !== targetId) continue;
          state.queue.splice(index, 1);
          if (settleQueuedRequest(entry, false)) removedCount += 1;
        }
        cleanupWorkspaceState(workspaceId);
      });
      return removedCount;
    }

    function hasTask(taskId) {
      var targetId = normalizeText(taskId);
      if (!targetId) return false;
      var activeKeys = Object.keys(activeRequests);
      for (var activeIndex = 0; activeIndex < activeKeys.length; activeIndex += 1) {
        if (activeRequests[activeKeys[activeIndex]].taskId === targetId) return true;
      }
      var queuedKeys = Object.keys(queuedRequests);
      for (var queuedIndex = 0; queuedIndex < queuedKeys.length; queuedIndex += 1) {
        if (queuedRequests[queuedKeys[queuedIndex]].taskId === targetId) return true;
      }
      return false;
    }

    function clearQueued() {
      var removedCount = 0;
      Object.keys(workspaceStates).forEach(function(workspaceId) {
        var state = workspaceStates[workspaceId];
        while (state.queue.length) {
          if (settleQueuedRequest(state.queue.shift(), false)) removedCount += 1;
        }
        cleanupWorkspaceState(workspaceId);
      });
      return removedCount;
    }

    function getSnapshot() {
      return Object.keys(workspaceStates).map(function(workspaceId) {
        var state = workspaceStates[workspaceId];
        return {
          workspaceId: workspaceId,
          activeCount: state.activeCount,
          queuedCount: state.queue.length,
          activeRequestKeys: Object.keys(activeRequests).map(function(requestId) {
            return activeRequests[requestId];
          }).filter(function(entry) {
            return entry.workspaceId === workspaceId;
          }).map(function(entry) {
            return entry.requestKey;
          }),
          queuedRequestKeys: state.queue.map(function(entry) {
            return entry.requestKey;
          }),
        };
      });
    }

    return {
      acquire: acquire,
      release: release,
      cancelTask: cancelTask,
      hasTask: hasTask,
      clearQueued: clearQueued,
      getSnapshot: getSnapshot,
      maxConcurrentPerWorkspace: maxConcurrentPerWorkspace,
    };
  }

  window.app.xmindRequestSchedulerCore = {
    DEFAULT_MAX_CONCURRENT_REQUESTS: DEFAULT_MAX_CONCURRENT_REQUESTS,
    DEFAULT_WORKSPACE_ID: DEFAULT_WORKSPACE_ID,
    createScheduler: createScheduler,
  };
})();
