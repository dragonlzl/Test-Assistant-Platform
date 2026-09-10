(function() {
  function init(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var manager = opts.manager || null;
    var prepareTask = typeof opts.prepareTask === 'function'
      ? opts.prepareTask
      : function missingPreparation() {
        return Promise.reject(new Error('XMind 生成准备能力未就绪'));
      };
    var buildRequestOptions = typeof opts.buildRequestOptions === 'function'
      ? opts.buildRequestOptions
      : function fallbackRequestOptions(task, stage) {
        var owner = task && task.requestOwner ? String(task.requestOwner || '') : '';
        return {
          owner: owner,
          requestKey: owner + ':' + String(stage || 'preparation'),
        };
      };
    var runningMap = {};

    function isPendingTask(task) {
      return Boolean(
        task
        && task.id
        && task.status === 'running'
        && task.preparationPending === true
      );
    }

    function readTask(taskOrId) {
      var taskId = typeof taskOrId === 'string'
        ? String(taskOrId || '')
        : String(taskOrId && taskOrId.id ? taskOrId.id : '');
      if (!taskId) return null;
      if (manager && typeof manager.getTask === 'function') {
        return manager.getTask(taskId);
      }
      return taskOrId && typeof taskOrId === 'object' ? taskOrId : null;
    }

    function getRunningPromise(taskId) {
      var targetId = String(taskId || '');
      return targetId && runningMap[targetId] ? runningMap[targetId] : null;
    }

    function runPendingTask(taskOrId) {
      var initial = readTask(taskOrId);
      if (!isPendingTask(initial)) return Promise.resolve(initial);
      var taskId = String(initial.id || '');
      if (runningMap[taskId]) return runningMap[taskId];

      var promise = Promise.resolve()
        .then(function() {
          var current = readTask(taskId);
          if (!isPendingTask(current)) return current;
          return prepareTask(current, {
            buildRequestOptions: function(stage) {
              return buildRequestOptions(current, String(stage || 'preparation'));
            },
          });
        })
        .then(function(patch) {
          var current = readTask(taskId);
          if (!isPendingTask(current)) return current;
          if (!manager || typeof manager.activateTask !== 'function') {
            throw new Error('XMind 生成任务激活能力未就绪');
          }
          return manager.activateTask(taskId, patch && typeof patch === 'object' ? patch : {}, {
            start: true,
            force: true,
          });
        })
        .catch(function(err) {
          var current = readTask(taskId);
          if (!isPendingTask(current)) return current;
          if (manager && typeof manager.failTask === 'function') {
            var message = err && err.message ? String(err.message || '') : String(err || '');
            manager.failTask(taskId, {
              error: message
                ? ('XMind 生成准备失败：' + message)
                : 'XMind 生成准备失败',
              action: 'preparation-error',
              abortReason: 'xmind-casegen-preparation-failed',
              meta: {
                stage: 'preparation',
              },
            });
          }
          return readTask(taskId);
        })
        .finally(function() {
          if (runningMap[taskId] === promise) delete runningMap[taskId];
        });
      runningMap[taskId] = promise;
      return promise;
    }

    function createAndStart(payload) {
      if (!manager || typeof manager.createDeferredTask !== 'function') {
        throw new Error('XMind deferred 任务能力未就绪');
      }
      var task = manager.createDeferredTask(payload);
      return {
        task: task,
        promise: runPendingTask(task),
      };
    }

    function resumePendingTasks(tasks) {
      var resumed = 0;
      (Array.isArray(tasks) ? tasks : []).forEach(function(task) {
        if (!isPendingTask(task)) return;
        if (runningMap[String(task.id || '')]) return;
        runPendingTask(task);
        resumed += 1;
      });
      return resumed;
    }

    return {
      createAndStart: createAndStart,
      runPendingTask: runPendingTask,
      resumePendingTasks: resumePendingTasks,
      getRunningPromise: getRunningPromise,
      isPendingTask: isPendingTask,
    };
  }

  window.app = window.app || {};
  window.app.retainedPreparationTask = {
    init: init,
  };
})();
