(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.persistentModelTaskManager = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var storagePrefix = String(opts.storagePrefix || '');
    var taskIdPrefix = String(opts.taskIdPrefix || 'managed-model-task-');
    var eventName = String(opts.eventName || 'managed-model-task');
    var scenes = Array.isArray(opts.scenes) ? opts.scenes.slice() : [];
    var executeTask = typeof opts.executeTask === 'function'
      ? opts.executeTask
      : function() { return Promise.reject(new Error('任务执行器未配置')); };
    var buildSuccessPatch = typeof opts.buildSuccessPatch === 'function'
      ? opts.buildSuccessPatch
      : function(result) { return { result: result }; };
    var formatError = typeof opts.formatError === 'function'
      ? opts.formatError
      : function(message) { return message || '任务执行失败'; };
    var storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    var heartbeatIntervalMs = Math.max(100, Number(opts.heartbeatIntervalMs) || 2000);
    var staleMs = Math.max(heartbeatIntervalMs, Number(opts.staleMs) || 6000);
    var maxRetryCount = Math.max(0, Number(opts.maxRetryCount) || 2);
    var runnerId = taskIdPrefix + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var runningMap = {};
    var takeoverTimers = {};
    var pageUnloading = false;

    if (!storagePrefix) throw new Error('持久任务存储前缀不能为空');

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pagehide', function() { pageUnloading = true; });
      window.addEventListener('beforeunload', function() { pageUnloading = true; });
    }

    function buildKey(scene) {
      return storagePrefix + scene;
    }

    function safeJsonParse(raw) {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (err) {
        return null;
      }
    }

    function readTask(scene) {
      if (!scene || !storage) return null;
      try {
        return safeJsonParse(storage.getItem(buildKey(scene)));
      } catch (err) {
        return null;
      }
    }

    function emitTaskUpdate(scene, task, action) {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      try {
        var detail = { scene: scene, task: task, action: action || '' };
        if (typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
        } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
          var event = document.createEvent('CustomEvent');
          event.initCustomEvent(eventName, false, false, detail);
          window.dispatchEvent(event);
        }
      } catch (err) {
        // ignore
      }
    }

    function writeTask(scene, task, action) {
      if (!scene || !storage) return task || null;
      if (!task) {
        try {
          storage.removeItem(buildKey(scene));
        } catch (err) {
          // ignore
        }
        emitTaskUpdate(scene, null, action || 'clear');
        return null;
      }
      task.updatedAt = Date.now();
      try {
        storage.setItem(buildKey(scene), JSON.stringify(task));
      } catch (err) {
        // ignore
      }
      emitTaskUpdate(scene, task, action || 'update');
      return task;
    }

    function clearTask(scene) {
      writeTask(scene, null, 'clear');
    }

    function updateTask(scene, patch, action) {
      if (!scene) return null;
      var current = readTask(scene);
      if (!current) return null;
      var next = patch && typeof patch === 'object' ? Object.assign({}, current, patch) : current;
      return writeTask(scene, next, action || 'update');
    }

    function buildTaskId() {
      return taskIdPrefix + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    function normalizeModelSnapshot(model) {
      if (!model || typeof model !== 'object') return null;
      return {
        id: model.id || '',
        name: model.name || '',
        provider: model.provider || '',
        baseUrl: model.baseUrl || '',
        apiKey: model.apiKey || '',
        model: model.model || '',
        maxTokens: model.maxTokens,
        stream: model.stream,
        streamMode: model.streamMode,
      };
    }

    function createTask(scene, payload) {
      var task = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
      task.id = task.id || buildTaskId();
      task.scene = scene || task.scene || '';
      task.status = 'running';
      task.createdAt = task.createdAt || Date.now();
      task.updatedAt = task.updatedAt || task.createdAt;
      task.retryCount = Number(task.retryCount || 0);
      if (task.model) task.model = normalizeModelSnapshot(task.model);
      return task;
    }

    function resolveUserText(task) {
      if (!task) return '';
      if (typeof task.userText === 'string' && task.userText.trim()) return task.userText;
      if (task.userPayload && typeof task.userPayload === 'object') {
        try {
          return JSON.stringify(task.userPayload, null, 2);
        } catch (err) {
          return '';
        }
      }
      return '';
    }

    function isTransientFetchError(err) {
      if (!err) return false;
      var message = err && err.message ? String(err.message) : String(err || '');
      if (!message) return false;
      return message.indexOf('Failed to fetch') !== -1 || message.indexOf('NetworkError') !== -1;
    }

    function isModelTimeoutError(err) {
      if (!err) return false;
      var message = err && err.message ? String(err.message) : String(err || '');
      return Boolean(message && message.indexOf('模型调用超时') !== -1);
    }

    function shouldSuspendForNavigation(err) {
      if (pageUnloading) return true;
      if (!err) return false;
      if (err.name === 'AbortError') return true;
      var message = err && err.message ? String(err.message) : String(err || '');
      if (message.indexOf('AbortError') !== -1) return true;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return isTransientFetchError(err) || isModelTimeoutError(err);
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

    function startHeartbeat(scene, task) {
      if (!scene || !task) return function() {};
      var timer = setInterval(function() {
        var current = readTask(scene);
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
        writeTask(scene, current, 'heartbeat');
      }, heartbeatIntervalMs);
      return function stopHeartbeat() {
        clearInterval(timer);
      };
    }

    function applyTerminalPatch(current, patch) {
      if (!patch || typeof patch !== 'object') return current;
      Object.keys(patch).forEach(function(key) {
        current[key] = patch[key];
      });
      return current;
    }

    function runTask(scene, task) {
      if (!scene || !task) return Promise.resolve(null);
      if (runningMap[scene] && runningMap[scene].taskId === task.id) {
        return runningMap[scene].promise;
      }
      var stopHeartbeat = startHeartbeat(scene, task);
      var promise = Promise.resolve()
        .then(function() {
          var current = readTask(scene);
          if (!current || current.id !== task.id) return null;
          return executeTask({
            scene: scene,
            task: current,
            userText: resolveUserText(current),
            getTask: readTask,
            updateTask: updateTask,
          });
        })
        .then(function(result) {
          var current = readTask(scene);
          if (!current || current.id !== task.id) return null;
          if (current.runnerId && current.runnerId !== runnerId) return null;
          applyTerminalPatch(current, buildSuccessPatch(result, current));
          current.status = 'done';
          current.error = '';
          current.updatedAt = Date.now();
          current.endedAt = current.updatedAt;
          current.heartbeatAt = 0;
          writeTask(scene, current, 'done');
          return current;
        })
        .catch(function(err) {
          var current = readTask(scene);
          if (!current || current.id !== task.id) return null;
          if (current.runnerId && current.runnerId !== runnerId) return null;
          var message = err && err.message ? err.message : String(err || '');
          if (shouldSuspendForNavigation(err)) {
            current.status = 'running';
            current.error = '';
            current.runnerId = '';
            current.heartbeatAt = 0;
            current.updatedAt = Date.now();
            writeTask(scene, current, 'suspend');
            return current;
          }
          if (isTransientFetchError(err)) {
            current.retryCount = Number(current.retryCount || 0) + 1;
            if (current.retryCount <= maxRetryCount) {
              current.status = 'running';
              current.error = '';
              current.runnerId = '';
              current.heartbeatAt = 0;
              current.updatedAt = Date.now();
              writeTask(scene, current, 'retry');
              return current;
            }
          }
          current.status = 'error';
          current.error = formatError(message, err, current);
          current.updatedAt = Date.now();
          current.endedAt = current.updatedAt;
          current.heartbeatAt = 0;
          writeTask(scene, current, 'error');
          return current;
        })
        .finally(function() {
          stopHeartbeat();
          if (runningMap[scene] && runningMap[scene].taskId === task.id) {
            delete runningMap[scene];
          }
        });
      runningMap[scene] = { taskId: task.id, promise: promise };
      return promise;
    }

    function startTask(scene, task, startOptions) {
      if (!scene) return Promise.resolve(null);
      var active = task ? createTask(scene, task) : readTask(scene);
      if (!active) return Promise.resolve(null);
      if (active.status !== 'running') return Promise.resolve(active);
      if (!startOptions || startOptions.force !== true) {
        if (!shouldTakeover(active)) {
          if (!takeoverTimers[scene]) {
            takeoverTimers[scene] = setTimeout(function() {
              takeoverTimers[scene] = null;
              var latest = readTask(scene);
              if (latest && latest.status === 'running') startTask(scene, latest);
            }, staleMs);
          }
          return Promise.resolve(active);
        }
      }
      active.runnerId = runnerId;
      active.heartbeatAt = Date.now();
      writeTask(scene, active, 'start');
      return runTask(scene, active);
    }

    function resumeTasks(startOptions) {
      scenes.forEach(function(scene) {
        var task = readTask(scene);
        if (task && task.status === 'running') startTask(scene, task, startOptions);
      });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', function(event) {
        var key = event && event.key ? String(event.key) : '';
        if (!key || key.indexOf(storagePrefix) !== 0) return;
        var scene = key.slice(storagePrefix.length);
        emitTaskUpdate(scene, readTask(scene), 'storage');
      });
    }

    return {
      createTask: createTask,
      startTask: startTask,
      getTask: readTask,
      updateTask: updateTask,
      clearTask: clearTask,
      resumeTasks: resumeTasks,
      buildTaskId: buildTaskId,
      normalizeModelSnapshot: normalizeModelSnapshot,
    };
  }

  return { create: create };
});
