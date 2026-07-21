(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.xmindCaseGenTaskManagerModule = api;
  }
})(function() {
function initXmindCaseGenTaskManager(options) {
  const callModel = options && typeof options.callModelWithConfig === 'function'
    ? options.callModelWithConfig
    : async function missingTextModel() {
      throw new Error('模型客户端不可用，请刷新页面后重试');
    };
  const callModelWithContent = options && typeof options.callModelWithContent === 'function'
    ? options.callModelWithContent
    : async function missingContentModel() {
      throw new Error('多模态模型客户端不可用，请刷新页面后重试');
    };
  const abortByOwner = options && typeof options.abortRequestsByOwner === 'function'
    ? options.abortRequestsByOwner
    : function noopAbortByOwner() { return 0; };
  const getTimeoutSec = options && typeof options.getTimeoutSec === 'function'
    ? options.getTimeoutSec
    : function getDefaultTimeoutSec() { return 300; };
  const requestSchedulerCore = options && options.requestSchedulerCore
    ? options.requestSchedulerCore
    : (window.app && window.app.xmindRequestSchedulerCore ? window.app.xmindRequestSchedulerCore : null);
  const requestScheduler = requestSchedulerCore && typeof requestSchedulerCore.createScheduler === 'function'
    ? requestSchedulerCore.createScheduler({ maxConcurrentPerWorkspace: 5 })
    : null;
  const storageKey = 'tap-xmind-casegen-tasks';
  const runnerId = 'xmind-casegen-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const runningMap = {};
  const heartbeatIntervalMs = 2000;
  const staleMs = 6000;
  const takeoverTimers = {};
  const retryTimers = {};
  const batchRetryTimers = {};
  const retryDelaysMs = [1000, 3000];
  const watchdogIntervalMs = 5000;
  var watchdogTimer = 0;
  var pageUnloading = false;

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', function() { pageUnloading = true; });
    window.addEventListener('beforeunload', function() { pageUnloading = true; });
  }

  const taskStoreModule = options && options.taskStoreModule
    ? options.taskStoreModule
    : ((typeof window !== 'undefined' && window.app && window.app.xmindCaseGenTaskStore)
      ? window.app.xmindCaseGenTaskStore
      : (typeof require === 'function' ? require('./xmindCaseGenTaskStore.js') : null));
  if (!taskStoreModule || typeof taskStoreModule.create !== 'function') {
    throw new Error('xmindCaseGenTaskStore 未加载');
  }
  const taskStore = taskStoreModule.create({
    root: typeof window !== 'undefined' ? window : null,
    storageKey: storageKey,
  });
  const cloneJson = taskStore.cloneJson;
  const readTasks = taskStore.readTasks;
  const writeTasks = taskStore.writeTasks;
  const getTask = taskStore.getTask;
  const getTasks = taskStore.getTasks;
  const buildTaskId = taskStore.buildTaskId;
  const normalizeModelSnapshot = taskStore.normalizeModelSnapshot;
  const createTask = taskStore.createTask;
  const upsertTask = taskStore.upsertTask;
  const updateTaskHeartbeat = taskStore.updateTaskHeartbeat;
  const emitTaskUpdate = taskStore.emitTaskUpdate;

  function clearTask(taskId, action) {
    var targetId = taskId ? String(taskId || '') : '';
    if (!targetId) return false;
    clearTaskRetryTimer(targetId);
    clearBatchRetryTimers(targetId);
    removeTaskRequestSlots(targetId);
    if (takeoverTimers[targetId]) {
      clearTimeout(takeoverTimers[targetId]);
      delete takeoverTimers[targetId];
    }
    var list = readTasks();
    var removed = null;
    var nextList = list.filter(function(item) {
      var matched = item && String(item.id || '') === targetId;
      if (matched) removed = item;
      return !matched;
    });
    if (!removed && nextList.length === list.length) return false;
    writeTasks(nextList, action || 'clear', removed);
    if (removed && removed.status === 'running' && removed.requestOwner) {
      abortByOwner(removed.requestOwner, 'xmind-casegen-cleared');
    }
    return true;
  }

  function clearTasksForWorkspace(workspaceId, options) {
    var targetWorkspaceId = workspaceId ? String(workspaceId || '') : '';
    if (!targetWorkspaceId) return 0;
    var opts = options && typeof options === 'object' ? options : {};
    var targetGenerationId = opts.workspaceGenerationId
      ? String(opts.workspaceGenerationId || '')
      : '';
    var includeRunning = opts.includeRunning === true;
    var taskIds = readTasks().filter(function(task) {
      if (!task || !task.id) return false;
      if (task.status === 'running' && !includeRunning) return false;
      var restoreContext = task.restoreContext && typeof task.restoreContext === 'object'
        ? task.restoreContext
        : {};
      var taskWorkspaceId = task.workspaceId
        ? String(task.workspaceId || '')
        : String(restoreContext.workspaceId || '');
      if (taskWorkspaceId !== targetWorkspaceId) return false;
      var taskGenerationId = restoreContext.workspaceGenerationId
        ? String(restoreContext.workspaceGenerationId || '')
        : String(task.workspaceGenerationId || '');
      if (targetGenerationId && taskGenerationId && taskGenerationId !== targetGenerationId) return false;
      return true;
    }).map(function(task) {
      return String(task.id || '');
    }).filter(Boolean);
    var cleared = 0;
    taskIds.forEach(function(taskId) {
      if (clearTask(taskId, opts.action || 'workspace-clear')) cleared += 1;
    });
    return cleared;
  }

  function clearAllTasks(action) {
    readTasks().forEach(function(task) {
      if (!task || task.status !== 'running' || !task.requestOwner) return;
      abortByOwner(task.requestOwner, 'xmind-casegen-clear-all');
    });
    Object.keys(takeoverTimers).forEach(function(taskId) {
      if (takeoverTimers[taskId]) clearTimeout(takeoverTimers[taskId]);
      delete takeoverTimers[taskId];
    });
    Object.keys(runningMap).forEach(function(taskId) {
      delete runningMap[taskId];
    });
    Object.keys(retryTimers).forEach(function(taskId) {
      clearTaskRetryTimer(taskId);
    });
    Object.keys(batchRetryTimers).forEach(function(taskId) {
      clearBatchRetryTimers(taskId);
    });
    if (requestScheduler && typeof requestScheduler.clearQueued === 'function') {
      requestScheduler.clearQueued();
    }
    return taskStore.clearAll(action);
  }

  function resetRunner(task) {
    if (!task) return;
    task.runnerId = '';
    task.heartbeatAt = 0;
  }

  function isTransientFetchError(err) {
    if (!err) return false;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (!msg) return false;
    var lower = msg.toLowerCase();
    if (lower.indexOf('failed to fetch') !== -1) return true;
    if (lower.indexOf('networkerror') !== -1) return true;
    if (lower.indexOf('network request failed') !== -1) return true;
    if (lower.indexOf('load failed') !== -1) return true;
    return false;
  }

  function getRetryableHttpStatus(err) {
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (!msg) return 0;
    var match = msg.match(/\bHTTP\s*(429|502|503|504|520)\b/i);
    return match ? Number(match[1] || 0) : 0;
  }

  function getConfiguredTimeoutMs() {
    var timeoutSec = Number(getTimeoutSec());
    if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) timeoutSec = 300;
    return timeoutSec * 1000;
  }

  function isRetryableModelRequestError(err, timing) {
    if (isTransientFetchError(err)) return true;
    var status = getRetryableHttpStatus(err);
    if (!status) return false;
    if (status === 504) {
      var durationMs = Number(timing && timing.modelRequestDurationMs || 0);
      var timeoutMs = getConfiguredTimeoutMs();
      if (durationMs > 0 && timeoutMs > 0 && durationMs >= timeoutMs * 0.9) return false;
    }
    return true;
  }

  function isModelTimeoutError(err) {
    if (!err) return false;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (!msg) return false;
    return msg.indexOf('模型调用超时') !== -1;
  }

  function isAbortError(err) {
    if (!err) return false;
    if (err.name === 'AbortError') return true;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (!msg) return false;
    return msg.indexOf('AbortError') !== -1 || msg.indexOf('request-aborted') !== -1 || msg.indexOf('cancelled') !== -1;
  }

  function shouldSuspendForNavigation(err) {
    if (pageUnloading) return true;
    if (!err) return false;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      if (isAbortError(err)) return true;
      if (isTransientFetchError(err)) return true;
      if (isModelTimeoutError(err)) return true;
      return false;
    }
    return false;
  }

  function isTaskStale(task) {
    if (!task) return true;
    var heartbeat = Number(task.heartbeatAt || 0);
    if (!heartbeat) return true;
    return Date.now() - heartbeat > staleMs;
  }

  function shouldTakeover(task) {
    if (!task || task.status !== 'running') return false;
    if (!task.runnerId || task.runnerId === runnerId) return true;
    return isTaskStale(task);
  }

  function startHeartbeat(task) {
    if (!task || !task.id) return function() {};
    var timer = setInterval(function() {
      var current = getTask(task.id);
      if (!current || current.status !== 'running') {
        clearInterval(timer);
        return;
      }
      if (current.runnerId && current.runnerId !== runnerId) {
        clearInterval(timer);
        return;
      }
      current.runnerId = runnerId;
      current.heartbeatAt = Date.now();
      current.updatedAt = current.heartbeatAt;
      updateTaskHeartbeat(current);
    }, heartbeatIntervalMs);
    return function stopHeartbeat() {
      clearInterval(timer);
    };
  }

  function getTaskRequestWorkspaceId(task) {
    var restoreContext = task && task.restoreContext && typeof task.restoreContext === 'object'
      ? task.restoreContext
      : {};
    return String(task && task.workspaceId ? task.workspaceId : (restoreContext.workspaceId || ''));
  }

  function buildTaskRequestKey(taskId, suffix) {
    var targetId = String(taskId || '');
    var requestSuffix = suffix ? String(suffix || '') : '';
    return requestSuffix ? (targetId + ':' + requestSuffix) : targetId;
  }

  function acquireTaskRequestSlot(task, requestKey) {
    if (!requestScheduler || typeof requestScheduler.acquire !== 'function') {
      return Promise.reject(new Error('XMind 请求调度器不可用，请刷新页面后重试'));
    }
    var taskId = String(task && task.id ? task.id : '');
    if (!taskId || !requestKey) return Promise.resolve(false);
    return requestScheduler.acquire({
      workspaceId: getTaskRequestWorkspaceId(task),
      requestKey: String(requestKey || ''),
      taskId: taskId,
      isValid: function() {
        var current = getTask(taskId);
        return Boolean(current && current.status === 'running');
      },
    });
  }

  function releaseTaskRequestSlot(task, requestKey) {
    if (!requestScheduler || typeof requestScheduler.release !== 'function') return false;
    return requestScheduler.release({
      workspaceId: getTaskRequestWorkspaceId(task),
      requestKey: String(requestKey || ''),
    });
  }

  function removeTaskRequestSlots(taskId) {
    var targetId = String(taskId || '');
    if (!targetId || !requestScheduler || typeof requestScheduler.cancelTask !== 'function') return 0;
    return requestScheduler.cancelTask(targetId);
  }

  function hasTaskRequestActivity(taskId) {
    var targetId = String(taskId || '');
    if (!targetId || !requestScheduler || typeof requestScheduler.hasTask !== 'function') return false;
    return requestScheduler.hasTask(targetId);
  }

  function clearTaskRetryTimer(taskId) {
    var targetId = String(taskId || '');
    if (!targetId || !retryTimers[targetId]) return false;
    clearTimeout(retryTimers[targetId]);
    delete retryTimers[targetId];
    return true;
  }

  function clearBatchRetryTimers(taskId) {
    var targetId = String(taskId || '');
    var list = targetId && Array.isArray(batchRetryTimers[targetId])
      ? batchRetryTimers[targetId].slice()
      : [];
    if (!list.length) return false;
    delete batchRetryTimers[targetId];
    list.forEach(function(entry) {
      if (entry && entry.timer) clearTimeout(entry.timer);
      if (entry && typeof entry.resolve === 'function') entry.resolve(false);
    });
    return true;
  }

  function waitForBatchRetry(taskId, delayMs) {
    var targetId = String(taskId || '');
    var waitMs = Math.max(0, Number(delayMs || 0));
    if (!targetId || !waitMs) return Promise.resolve(true);
    return new Promise(function(resolve) {
      var entry = {
        timer: 0,
        resolve: resolve,
      };
      if (!Array.isArray(batchRetryTimers[targetId])) batchRetryTimers[targetId] = [];
      batchRetryTimers[targetId].push(entry);
      entry.timer = setTimeout(function() {
        var list = Array.isArray(batchRetryTimers[targetId]) ? batchRetryTimers[targetId] : [];
        var index = list.indexOf(entry);
        if (index !== -1) list.splice(index, 1);
        if (!list.length) delete batchRetryTimers[targetId];
        resolve(true);
      }, waitMs);
    });
  }

  function scheduleTaskRetry(taskId, retryCount) {
    var targetId = String(taskId || '');
    var retryIndex = Math.max(0, Number(retryCount || 1) - 1);
    var delayMs = retryDelaysMs[retryIndex];
    if (!targetId || !Number.isFinite(delayMs)) return false;
    clearTaskRetryTimer(targetId);
    retryTimers[targetId] = setTimeout(function() {
      delete retryTimers[targetId];
      var current = getTask(targetId);
      if (!current || current.status !== 'running') return;
      if (pageUnloading) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      startTask(targetId, { force: true });
    }, delayMs);
    return true;
  }

  function callTaskModel(current) {
    var model = current && current.model ? current.model : null;
    if (!model || !model.baseUrl || !model.model) {
      return Promise.reject(new Error('未找到 XMind 用例生成模型'));
    }
    if (current.requestMode === 'content') {
      return callModelWithContent(model, current.contentBlocks || [], current.prompt || '', {
        reasoningEffort: current.reasoning || '',
        temperature: current.temperature,
        owner: current.requestOwner || '',
      });
    }
    var requestText = current.requestText ? String(current.requestText || '') : '';
    if (!requestText.trim()) {
      return Promise.reject(new Error('生成上下文缺失'));
    }
    return callModel(model, requestText, current.prompt || '', current.reasoning || '', current.temperature, {
      owner: current.requestOwner || '',
    });
  }

  function startTaskModelRequestTiming(taskId) {
    var current = getTask(taskId);
    if (!current || current.status !== 'running') return Date.now();
    var startedAt = Date.now();
    current.modelRequestStartedAt = startedAt;
    current.updatedAt = startedAt;
    upsertTask(current, 'model-request-start');
    return startedAt;
  }

  function applyTaskModelRequestTiming(current, startedAt, endedAt) {
    if (!current) return 0;
    var activeStartedAt = Number(current.modelRequestStartedAt || 0);
    var expectedStartedAt = Number(startedAt || 0);
    if (!activeStartedAt || !expectedStartedAt || activeStartedAt !== expectedStartedAt) return 0;
    var finishAt = Number(endedAt || Date.now());
    var durationMs = Math.max(1, finishAt - expectedStartedAt);
    current.modelRequestStartedAt = 0;
    current.modelRequestDurationMs = durationMs;
    current.modelRequestTotalDurationMs = Number(current.modelRequestTotalDurationMs || 0) + durationMs;
    current.modelRequestAttemptCount = Number(current.modelRequestAttemptCount || 0) + 1;
    current.updatedAt = finishAt;
    return durationMs;
  }

  function finishTaskModelRequestTiming(taskId, startedAt) {
    var current = getTask(taskId);
    if (!current) return 0;
    var durationMs = applyTaskModelRequestTiming(current, startedAt, Date.now());
    if (!durationMs) return 0;
    upsertTask(current, 'model-request-finish');
    return durationMs;
  }

  function buildBatchModelTask(task, request) {
    var item = request && typeof request === 'object' ? request : {};
    return Object.assign({}, task, {
      requestMode: item.requestMode === 'content' ? 'content' : 'text',
      prompt: item.prompt ? String(item.prompt || '') : '',
      requestText: item.requestText ? String(item.requestText || '') : '',
      contentBlocks: Array.isArray(item.contentBlocks) ? item.contentBlocks : [],
      reasoning: item.reasoning ? String(item.reasoning || '') : String(task && task.reasoning || ''),
      temperature: Number.isFinite(Number(item.temperature))
        ? Number(item.temperature)
        : Number(task && task.temperature),
      requestOwner: task && task.requestOwner ? String(task.requestOwner || '') : '',
    });
  }

  function updateBatchRequestProgress(taskId, completedCount, totalCount, activeIndex) {
    var current = getTask(taskId);
    if (!current || current.status !== 'running') return null;
    current.modelRequestBatchCompleted = Math.max(0, Number(completedCount || 0));
    current.modelRequestBatchTotal = Math.max(0, Number(totalCount || 0));
    current.modelRequestBatchActiveIndex = Math.max(0, Number(activeIndex || 0));
    current.updatedAt = Date.now();
    return upsertTask(current, 'batch-progress');
  }

  function callBatchModelRequest(taskId, request, requestIndex) {
    var retryCount = 0;
    var requestKey = buildTaskRequestKey(taskId, 'batch-' + String(requestIndex));
    function runAttempt() {
      var current = getTask(taskId);
      if (!current || current.status !== 'running') {
        var cancelledError = new Error('request-aborted');
        cancelledError.name = 'AbortError';
        throw cancelledError;
      }
      var attemptStartedAt = 0;
      return acquireTaskRequestSlot(current, requestKey)
        .then(function(granted) {
          if (!granted) {
            var rejectedError = new Error('request-aborted');
            rejectedError.name = 'AbortError';
            throw rejectedError;
          }
          var latest = getTask(taskId);
          if (!latest || latest.status !== 'running') {
            releaseTaskRequestSlot(current, requestKey);
            var stoppedError = new Error('request-aborted');
            stoppedError.name = 'AbortError';
            throw stoppedError;
          }
          attemptStartedAt = Date.now();
          return Promise.resolve()
            .then(function() {
              return callTaskModel(buildBatchModelTask(latest, request));
            })
            .finally(function() {
              releaseTaskRequestSlot(latest, requestKey);
            });
        })
        .catch(function(err) {
          if (shouldSuspendForNavigation(err)) throw err;
          if (!isRetryableModelRequestError(err, {
            modelRequestDurationMs: Math.max(0, Date.now() - attemptStartedAt),
          }) || retryCount >= retryDelaysMs.length) {
            if (err && typeof err === 'object') err.xmindBatchRetryHandled = true;
            throw err;
          }
          var delayMs = retryDelaysMs[retryCount];
          retryCount += 1;
          var latest = getTask(taskId);
          if (latest && latest.status === 'running') {
            latest.modelRequestBatchRetryCount = Number(latest.modelRequestBatchRetryCount || 0) + 1;
            latest.modelRequestBatchRetryIndex = Number(requestIndex || 0);
            latest.updatedAt = Date.now();
            upsertTask(latest, 'batch-retry');
          }
          return waitForBatchRetry(taskId, delayMs).then(function(shouldContinue) {
            if (!shouldContinue) {
              var abortedError = new Error('request-aborted');
              abortedError.name = 'AbortError';
              throw abortedError;
            }
            return runAttempt();
          });
        });
    }
    return runAttempt();
  }

  function executeTaskModelRequestBatch(taskId, task) {
    var requests = task && Array.isArray(task.modelRequestBatch) ? task.modelRequestBatch : [];
    if (!requests.length) return Promise.reject(new Error('去重批次请求缺失'));
    var configuredConcurrency = Number(task.modelRequestBatchConcurrency || 1);
    var concurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
      ? Math.min(5, Math.floor(configuredConcurrency), requests.length)
      : 1;
    var results = new Array(requests.length);
    var completedMap = {};
    var nextIndex = 0;
    var stopped = false;
    updateBatchRequestProgress(taskId, 0, requests.length, 0);

    function runWorker() {
      if (stopped) return Promise.resolve();
      var requestIndex = nextIndex;
      nextIndex += 1;
      if (requestIndex >= requests.length) return Promise.resolve();
      return callBatchModelRequest(taskId, requests[requestIndex], requestIndex)
        .then(function(content) {
          results[requestIndex] = content;
          completedMap[requestIndex] = true;
          updateBatchRequestProgress(
            taskId,
            Object.keys(completedMap).length,
            requests.length,
            requestIndex
          );
          return runWorker();
        })
        .catch(function(err) {
          stopped = true;
          throw err;
        });
    }

    var workers = [];
    for (var i = 0; i < concurrency; i += 1) workers.push(runWorker());
    return Promise.all(workers).then(function() {
      return results;
    });
  }

  function executeTaskModelRequest(taskId) {
    var current = getTask(taskId);
    if (!current || current.status !== 'running') return Promise.resolve(current);
    if (Array.isArray(current.modelRequestBatch) && current.modelRequestBatch.length) {
      return executeTaskModelRequestBatch(taskId, current);
    }
    var requestKey = buildTaskRequestKey(taskId, 'request');
    return acquireTaskRequestSlot(current, requestKey).then(function(granted) {
      if (!granted) return getTask(taskId);
      var latest = getTask(taskId);
      if (!latest || latest.status !== 'running') {
        releaseTaskRequestSlot(current, requestKey);
        return latest;
      }
      var requestStartedAt = startTaskModelRequestTiming(taskId);
      return Promise.resolve()
        .then(function() {
          return callTaskModel(latest);
        })
        .then(function(content) {
          finishTaskModelRequestTiming(taskId, requestStartedAt);
          return content;
        }, function(err) {
          finishTaskModelRequestTiming(taskId, requestStartedAt);
          throw err;
        })
        .finally(function() {
          releaseTaskRequestSlot(latest, requestKey);
        });
    });
  }

  function runTask(task) {
    if (!task || !task.id) return Promise.resolve(null);
    if (runningMap[task.id] && runningMap[task.id].taskId === task.id) {
      return runningMap[task.id].promise;
    }
    var stopHeartbeat = startHeartbeat(task);
    function waitForTaskMinVisible(current) {
      var until = Number(current && current.minVisibleUntil || 0);
      if (!Number.isFinite(until) || until <= 0) return Promise.resolve(current);
      var delay = until - Date.now();
      if (!Number.isFinite(delay) || delay <= 0) return Promise.resolve(current);
      return new Promise(function(resolve) {
        setTimeout(function() {
          resolve(current);
        }, delay);
      });
    }
    var promise = Promise.resolve()
      .then(function() {
        return executeTaskModelRequest(task.id);
      })
      .then(function(content) {
        var current = getTask(task.id);
        return waitForTaskMinVisible(current).then(function() {
          return content;
        });
      })
      .then(function(content) {
        var current = getTask(task.id);
        if (!current) return null;
        if (current.status !== 'running') return current;
        if (current.runnerId && current.runnerId !== runnerId) return null;
        current.status = 'done';
        current.resultRaw = typeof content === 'string' ? content : JSON.stringify(content || '');
        current.error = '';
        current.durationMs = Math.max(0, Date.now() - Number(current.startedAt || current.createdAt || Date.now()));
        current.endedAt = Date.now();
        resetRunner(current);
        upsertTask(current, 'done');
        return current;
      })
      .catch(function(err) {
        var current = getTask(task.id);
        if (!current) return null;
        if (current.status === 'cancelled') return current;
        if (current.status !== 'running') return current;
        if (current.runnerId && current.runnerId !== runnerId) return null;
        var msg = err && err.message ? err.message : String(err || '');
        if (shouldSuspendForNavigation(err)) {
          current.status = 'running';
          current.error = '';
          resetRunner(current);
          current.updatedAt = Date.now();
          upsertTask(current, 'suspend');
          return current;
        }
        if (isRetryableModelRequestError(err, current) && !(err && err.xmindBatchRetryHandled === true)) {
          current.retryCount = Number(current.retryCount || 0) + 1;
          if (current.retryCount <= 2) {
            current.status = 'running';
            current.error = '';
            resetRunner(current);
            current.updatedAt = Date.now();
            upsertTask(current, 'retry');
            scheduleTaskRetry(current.id, current.retryCount);
            return current;
          }
        }
        current.status = 'error';
        current.error = msg ? ('XMind 用例生成失败：' + msg) : 'XMind 用例生成失败';
        current.endedAt = Date.now();
        clearBatchRetryTimers(current.id);
        removeTaskRequestSlots(current.id);
        resetRunner(current);
        upsertTask(current, 'error');
        if (current.requestOwner) {
          abortByOwner(current.requestOwner, 'xmind-casegen-error');
        }
        return current;
      })
      .finally(function() {
        stopHeartbeat();
        if (runningMap[task.id] && runningMap[task.id].taskId === task.id) {
          delete runningMap[task.id];
        }
      });
    runningMap[task.id] = {
      taskId: task.id,
      promise: promise,
    };
    return promise;
  }

  function startTask(task, options) {
    var active = null;
    if (typeof task === 'string') active = getTask(task);
    else active = task ? createTask(task) : null;
    if (!active || !active.id) return Promise.resolve(null);
    if (active.status !== 'running') return Promise.resolve(active);
    if (!options || options.force !== true) {
      if (!shouldTakeover(active)) {
        if (!takeoverTimers[active.id]) {
          takeoverTimers[active.id] = setTimeout(function() {
            takeoverTimers[active.id] = null;
            var latest = getTask(active.id);
            if (latest && latest.status === 'running') {
              startTask(latest);
            }
          }, staleMs);
        }
        return Promise.resolve(active);
      }
    }
    active.runnerId = runnerId;
    active.heartbeatAt = Date.now();
    active.startedAt = active.startedAt || active.heartbeatAt;
    upsertTask(active, 'start');
    return runTask(active);
  }

  function canResumeTaskRequests() {
    return Boolean(requestScheduler && typeof requestScheduler.acquire === 'function');
  }

  function resumeTasks(options) {
    if (!canResumeTaskRequests()) return 0;
    var resumed = 0;
    getTasks().forEach(function(task) {
      if (!task || task.status !== 'running') return;
      if (retryTimers[String(task.id || '')]) return;
      startTask(task, options);
      resumed += 1;
    });
    return resumed;
  }

  function resumeOrphanedTasks() {
    if (!canResumeTaskRequests()) return 0;
    if (pageUnloading) return 0;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return 0;
    var resumed = 0;
    getTasks().forEach(function(task) {
      if (!task || task.status !== 'running' || !task.id) return;
      var taskId = String(task.id || '');
      if (runningMap[taskId] || retryTimers[taskId] || batchRetryTimers[taskId]) return;
      if (hasTaskRequestActivity(taskId)) return;
      startTask(taskId);
      resumed += 1;
    });
    return resumed;
  }

  function failTask(taskId, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var active = getTask(taskId);
    if (!active || active.status !== 'running') return false;
    var now = Date.now();
    var requestStartedAt = Number(active.modelRequestStartedAt || 0);
    clearTaskRetryTimer(taskId);
    clearBatchRetryTimers(taskId);
    removeTaskRequestSlots(taskId);
    if (takeoverTimers[taskId]) {
      clearTimeout(takeoverTimers[taskId]);
      delete takeoverTimers[taskId];
    }
    if (requestStartedAt > 0) {
      applyTaskModelRequestTiming(active, requestStartedAt, now);
    }
    active.status = 'error';
    active.error = opts.error ? String(opts.error || '') : 'XMind 用例生成失败';
    active.endedAt = now;
    active.failureMeta = opts.meta && typeof opts.meta === 'object'
      ? cloneJson(opts.meta, {})
      : {};
    resetRunner(active);
    upsertTask(active, opts.action || 'error');
    if (active.requestOwner) {
      abortByOwner(active.requestOwner, opts.abortReason || 'xmind-casegen-failed');
    }
    return true;
  }

  function cancelTask(taskId, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var active = getTask(taskId);
    if (!active || active.status !== 'running') {
      if (opts.clear === true) clearTask(taskId, 'clear');
      return false;
    }
    var reasonText = opts.reason ? String(opts.reason) : '已中断当前 XMind 生成任务';
    clearTaskRetryTimer(taskId);
    clearBatchRetryTimers(taskId);
    removeTaskRequestSlots(taskId);
    if (takeoverTimers[taskId]) {
      clearTimeout(takeoverTimers[taskId]);
      delete takeoverTimers[taskId];
    }
    active.status = 'cancelled';
    active.error = reasonText;
    active.cancelledAt = Date.now();
    active.endedAt = active.cancelledAt;
    active.cancelMeta = {
      source: opts.source ? String(opts.source || '') : '',
      reason: reasonText,
    };
    resetRunner(active);
    upsertTask(active, 'cancel');
    if (active.requestOwner) {
      abortByOwner(active.requestOwner, opts.abortReason || 'xmind-casegen-cancelled');
    }
    return true;
  }

  function cancelAllRunning(options) {
    var count = 0;
    getTasks().forEach(function(task) {
      if (!task || task.status !== 'running') return;
      if (cancelTask(task.id, options)) count += 1;
    });
    return count;
  }

  function updateTasksContext(patch, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var list = readTasks();
    if (!Array.isArray(list) || !list.length) return 0;
    var taskIds = Array.isArray(opts.taskIds) ? opts.taskIds.map(function(item) {
      return String(item || '');
    }).filter(Boolean) : null;
    var changedCount = 0;
    var latestChangedTask = null;
    var nextList = list.map(function(item) {
      if (!item || !item.id) return item;
      if (opts.onlyRunning === true && item.status !== 'running') return item;
      if (taskIds && taskIds.indexOf(String(item.id || '')) === -1) return item;
      var nextTask = cloneJson(item, null);
      if (!nextTask) return item;
      var nextContext = nextTask.restoreContext && typeof nextTask.restoreContext === 'object'
        ? cloneJson(nextTask.restoreContext, {})
        : {};
      if (typeof patch === 'function') {
        try {
          patch(nextContext, nextTask);
        } catch (err) {
          return item;
        }
      } else if (patch && typeof patch === 'object') {
        Object.keys(patch).forEach(function(key) {
          if (patch[key] === undefined) {
            delete nextContext[key];
          } else {
            nextContext[key] = patch[key];
          }
        });
      }
      nextTask.restoreContext = nextContext;
      nextTask.updatedAt = Date.now();
      changedCount += 1;
      latestChangedTask = nextTask;
      return nextTask;
    });
    if (changedCount <= 0) return 0;
    writeTasks(nextList, opts.action || 'context', latestChangedTask);
    return changedCount;
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', function(e) {
      var key = e && e.key ? String(e.key) : '';
      if (key !== storageKey) return;
      emitTaskUpdate(null, 'storage', getTasks());
    });
    window.addEventListener('pageshow', function() {
      pageUnloading = false;
      resumeOrphanedTasks();
    });
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') return;
      pageUnloading = false;
      resumeOrphanedTasks();
    });
  }
  watchdogTimer = setInterval(function() {
    resumeOrphanedTasks();
  }, watchdogIntervalMs);

  return {
    createTask: createTask,
    startTask: startTask,
    getTask: getTask,
    getTasks: getTasks,
    clearTask: clearTask,
    clearTasksForWorkspace: clearTasksForWorkspace,
    clearAllTasks: clearAllTasks,
    cancelTask: cancelTask,
    failTask: failTask,
    cancelAllRunning: cancelAllRunning,
    updateTasksContext: updateTasksContext,
    resumeTasks: resumeTasks,
    buildTaskId: buildTaskId,
    normalizeModelSnapshot: normalizeModelSnapshot,
  };
}

  return {
    init: initXmindCaseGenTaskManager,
  };
});
