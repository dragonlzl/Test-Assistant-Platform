(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.autoWorkflowManagerModule = api;
  }
})(function() {
function initAutoWorkflowManager(options) {
  const getSteps = options && typeof options.getSteps === 'function'
    ? options.getSteps
    : function() { return []; };
  const canRun = options && typeof options.canRun === 'function'
    ? options.canRun
    : function() { return true; };
  const persistWorkflowStateNow = options && typeof options.persistWorkflowStateNow === 'function'
    ? options.persistWorkflowStateNow
    : function() {};
  const getLastError = options && typeof options.getLastModelError === 'function'
    ? options.getLastModelError
    : function() { return null; };
  const clearLastError = options && typeof options.clearLastModelError === 'function'
    ? options.clearLastModelError
    : function() {};
  const abortModelRequests = options && typeof options.abortModelRequests === 'function'
    ? options.abortModelRequests
    : function() {};
  const storageKey = 'tap-auto-workflow-task';
  const runnerId = 'auto-workflow-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const runningMap = {};
  const heartbeatIntervalMs = 2000;
  const staleMs = 6000;
  var takeoverTimer = null;
  var retryTimer = null;
  var pageUnloading = false;

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', function() { pageUnloading = true; });
    window.addEventListener('beforeunload', function() { pageUnloading = true; });
  }

  function safeJsonParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function readTask() {
    if (typeof localStorage === 'undefined') return null;
    try {
      return safeJsonParse(localStorage.getItem(storageKey));
    } catch (err) {
      return null;
    }
  }

  function emitTaskUpdate(task, action) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    try {
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('auto-workflow-task', { detail: { task: task, action: action || '' } }));
      } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('auto-workflow-task', false, false, { task: task, action: action || '' });
        window.dispatchEvent(evt);
      }
    } catch (err) {
      // ignore
    }
  }

  function writeTask(task, action) {
    if (typeof localStorage === 'undefined') return task || null;
    if (!task) {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        // ignore
      }
      emitTaskUpdate(null, action || 'clear');
      return null;
    }
    var next = task;
    next.updatedAt = Date.now();
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (err) {
      // ignore
    }
    emitTaskUpdate(next, action || 'update');
    return next;
  }

  function clearTask() {
    writeTask(null, 'clear');
  }

  function cancelTask(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var reasonText = opts.reason ? String(opts.reason) : '已中断当前执行任务';
    var active = readTask();
    if (!active || active.status !== 'running') {
      if (opts.clear === true) clearTask();
      return false;
    }
    active.status = 'cancelled';
    active.error = reasonText;
    active.cancelledAt = Date.now();
    active.endedAt = active.cancelledAt;
    resetRunner(active);
    writeTask(active, 'cancel');
    try {
      abortModelRequests('auto-workflow-cancelled');
    } catch (err) {
      // ignore
    }
    return true;
  }

  function updateTaskContext(patch, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var active = readTask();
    if (!active) return null;
    if (opts.onlyRunning === true && active.status !== 'running') return null;
    var nextContext = active.context && typeof active.context === 'object'
      ? Object.assign({}, active.context)
      : {};
    if (typeof patch === 'function') {
      try {
        patch(nextContext, active);
      } catch (err) {
        // ignore
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
    active.context = nextContext;
    active.updatedAt = Date.now();
    writeTask(active, opts.action || 'context');
    return active;
  }

  function buildTaskId() {
    return 'auto-workflow-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  function createTask(payload) {
    var base = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
    base.id = base.id || buildTaskId();
    base.status = 'running';
    base.createdAt = base.createdAt || Date.now();
    base.updatedAt = base.updatedAt || base.createdAt;
    base.retryCount = Number(base.retryCount || 0);
    base.startIndex = Number(base.startIndex || 0);
    if (!Number.isFinite(base.startIndex) || base.startIndex < 0) base.startIndex = 0;
    if (!Number.isFinite(Number(base.stepIndex))) base.stepIndex = base.startIndex;
    if (!base.context || typeof base.context !== 'object') base.context = {};
    if (!base.messages || typeof base.messages !== 'object') base.messages = {};
    return base;
  }

  function isTransientFetchError(err) {
    if (!err) return false;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (!msg) return false;
    if (msg.indexOf('Failed to fetch') !== -1) return true;
    if (msg.indexOf('NetworkError') !== -1) return true;
    return false;
  }

  function isModelTimeoutError(err) {
    if (!err) return false;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (!msg) return false;
    return msg.indexOf('模型调用超时') !== -1;
  }

  function shouldSuspendForNavigation(err) {
    if (pageUnloading) return true;
    if (!err) return false;
    if (err.name === 'AbortError') return true;
    var msg = err && err.message ? String(err.message) : String(err || '');
    if (msg.indexOf('AbortError') !== -1) return true;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
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
    if (!task) return function() {};
    var timer = setInterval(function() {
      var current = readTask();
      if (!current || current.id !== task.id || current.status !== 'running') {
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
      writeTask(current, 'heartbeat');
    }, heartbeatIntervalMs);
    return function stopHeartbeat() {
      clearInterval(timer);
    };
  }

  function resetRunner(task) {
    if (!task) return;
    task.runnerId = '';
    task.heartbeatAt = 0;
  }

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(function() {
      retryTimer = null;
      var current = readTask();
      if (!current || current.status !== 'running') return;
      if (pageUnloading) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      startTask(current, { force: true });
    }, 800);
  }

  function handleRetry(current, action) {
    if (!current) return false;
    current.retryCount = Number(current.retryCount || 0) + 1;
    if (current.retryCount > 2) return false;
    current.status = 'running';
    current.error = '';
    resetRunner(current);
    current.updatedAt = Date.now();
    writeTask(current, action || 'retry');
    if (!pageUnloading && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
      scheduleRetry();
    }
    return true;
  }

  function runTask(task) {
    if (!task) return Promise.resolve(null);
    if (runningMap.main && runningMap.main.taskId === task.id) {
      return runningMap.main.promise;
    }
    var stopHeartbeat = startHeartbeat(task);
    var promise = Promise.resolve()
      .then(async function() {
        var steps = getSteps();
        var current = readTask();
        if (!current || current.id !== task.id) return null;
        if (typeof canRun === 'function' && !canRun()) {
          current.status = 'running';
          current.error = '';
          resetRunner(current);
          current.updatedAt = Date.now();
          writeTask(current, 'suspend');
          return current;
        }
        if (!steps || !steps.length) {
          current.status = 'error';
          current.error = '未配置自动流程步骤';
          current.updatedAt = Date.now();
          current.endedAt = current.updatedAt;
          resetRunner(current);
          writeTask(current, 'error');
          return current;
        }
        var startIndex = Number(current.stepIndex);
        if (!Number.isFinite(startIndex) || startIndex < 0) startIndex = Number(current.startIndex || 0);
        if (!Number.isFinite(startIndex) || startIndex < 0) startIndex = 0;
        var context = current.context && typeof current.context === 'object' ? current.context : {};

        for (var i = startIndex; i < steps.length; i += 1) {
          var step = steps[i] || {};
          current = readTask();
          if (!current || current.id !== task.id) return null;
          if (current.status !== 'running') return current;
          if (current.runnerId && current.runnerId !== runnerId) return null;
          current.stepIndex = i;
          current.stepKey = step.key || '';
          current.stepLabel = step.label || '';
          current.updatedAt = Date.now();
          writeTask(current, 'step');
          if (typeof clearLastError === 'function') clearLastError();
          try {
            if (step && typeof step.run === 'function') {
              await step.run(context);
            }
            current = readTask();
            if (!current || current.id !== task.id) return null;
            if (current.status !== 'running') return current;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            var valid = step && typeof step.validate === 'function' ? step.validate() : false;
            if (!valid) {
              var lastErr = typeof getLastError === 'function' ? getLastError() : null;
              if (shouldSuspendForNavigation(lastErr)) {
                current.status = 'running';
                current.error = '';
                resetRunner(current);
                current.updatedAt = Date.now();
                writeTask(current, 'suspend');
                return current;
              }
              if (isTransientFetchError(lastErr) && handleRetry(current, 'retry')) {
                return current;
              }
              var invalidReason = '';
              if (step && typeof step.getInvalidReason === 'function') {
                try {
                  invalidReason = step.getInvalidReason() || '';
                } catch (errGetReason) {
                  invalidReason = '';
                }
              }
              if (!invalidReason) {
                invalidReason = (step && step.label ? step.label : '流程步骤') + '未产生有效输出，请检查模型配置或稍后重试';
              }
              throw new Error(invalidReason);
            }
            if (step && typeof step.after === 'function') {
              await step.after();
            }
            current.stepIndex = i + 1;
            current.stepKey = '';
            current.stepLabel = '';
            current.updatedAt = Date.now();
            writeTask(current, 'progress');
            if (typeof persistWorkflowStateNow === 'function') persistWorkflowStateNow();
          } catch (err) {
            var lastErrInner = typeof getLastError === 'function' ? getLastError() : null;
            current = readTask();
            if (!current || current.id !== task.id) return null;
            if (current.status !== 'running') return current;
            if (current.runnerId && current.runnerId !== runnerId) return null;
            if (shouldSuspendForNavigation(err) || shouldSuspendForNavigation(lastErrInner)) {
              current.status = 'running';
              current.error = '';
              resetRunner(current);
              current.updatedAt = Date.now();
              writeTask(current, 'suspend');
              return current;
            }
            if ((isTransientFetchError(err) || isTransientFetchError(lastErrInner)) && handleRetry(current, 'retry')) {
              return current;
            }
            var msg = err && err.message ? err.message : String(err || '');
            current.status = 'error';
            current.error = msg || '自动流程失败';
            current.updatedAt = Date.now();
            current.endedAt = current.updatedAt;
            resetRunner(current);
            writeTask(current, 'error');
            return current;
          }
        }
        current = readTask();
        if (!current || current.id !== task.id) return null;
        if (current.runnerId && current.runnerId !== runnerId) return null;
        current.status = 'done';
        current.error = '';
        current.updatedAt = Date.now();
        current.endedAt = current.updatedAt;
        current.heartbeatAt = 0;
        writeTask(current, 'done');
        return current;
      })
      .finally(function() {
        stopHeartbeat();
        if (runningMap.main && runningMap.main.taskId === task.id) {
          delete runningMap.main;
        }
      });
    runningMap.main = { taskId: task.id, promise: promise };
    return promise;
  }

  function startTask(task, options) {
    var active = task ? createTask(task) : readTask();
    if (!active) return Promise.resolve(null);
    if (active.status !== 'running') return Promise.resolve(active);
    if (!options || options.force !== true) {
      if (!shouldTakeover(active)) {
        if (!takeoverTimer) {
          takeoverTimer = setTimeout(function() {
            takeoverTimer = null;
            var latest = readTask();
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
    writeTask(active, 'start');
    return runTask(active);
  }

  function resumeTask(options) {
    var task = readTask();
    if (task && task.status === 'running') {
      startTask(task, options);
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', function(e) {
      var key = e && e.key ? String(e.key) : '';
      if (key !== storageKey) return;
      emitTaskUpdate(readTask(), 'storage');
    });
  }

  return {
    createTask: createTask,
    startTask: startTask,
    getTask: readTask,
    cancelTask: cancelTask,
    updateTaskContext: updateTaskContext,
    clearTask: clearTask,
    resumeTask: resumeTask,
  };
}

  return {
    init: initAutoWorkflowManager,
  };
});

