(function(factory) {
  var api = factory(typeof window !== 'undefined' ? window : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.appTaskLifecycleController = api;
  }
})(function(defaultRoot) {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var root = opts.root || defaultRoot || { app: {} };
    var state = opts.state || {};
    var missingReminderAiManager = opts.missingReminderAiManager || null;
    var autoWorkflowManager = opts.autoWorkflowManager || null;
    var applyAutoWorkflowTaskState = typeof opts.applyAutoWorkflowTaskState === 'function'
      ? opts.applyAutoWorkflowTaskState : function() {};
    var loadModels = typeof opts.loadModels === 'function' ? opts.loadModels : function() {};
    var loadAssignments = typeof opts.loadAssignments === 'function' ? opts.loadAssignments : function() {};
    var schedule = typeof opts.setTimeout === 'function'
      ? opts.setTimeout
      : function(callback, delay) { return setTimeout(callback, delay); };
    var maxResumeAttempts = Number(opts.maxResumeAttempts) || 40;
    var resumeDelayMs = Number(opts.resumeDelayMs) || 200;

    function shouldResumeMissingReminderAi() {
      return Boolean(state && state.settings && state.settings.missingCaseReminderAiEnabled === 'on');
    }

    function syncMissingReminderAiTasks() {
      if (!missingReminderAiManager || typeof missingReminderAiManager.resumeTasks !== 'function') return;
      if (!shouldResumeMissingReminderAi()) {
        if (typeof missingReminderAiManager.clearTask === 'function') {
          missingReminderAiManager.clearTask('case-library');
          missingReminderAiManager.clearTask('temp-exec');
        }
        return;
      }
      missingReminderAiManager.resumeTasks({ force: true });
    }

    function syncAutoWorkflowTaskState(task) {
      applyAutoWorkflowTaskState(task || null);
    }

    function resumeAutoWorkflowTaskWhenReady() {
      if (!autoWorkflowManager || typeof autoWorkflowManager.resumeTask !== 'function') return;
      var attempts = 0;
      function attemptResume() {
        attempts += 1;
        if (root.app && root.app._inited === true) {
          loadModels();
          loadAssignments();
          autoWorkflowManager.resumeTask({ force: true });
          syncAutoWorkflowTaskState(
            typeof autoWorkflowManager.getTask === 'function' ? autoWorkflowManager.getTask() : null
          );
          return;
        }
        if (attempts < maxResumeAttempts) schedule(attemptResume, resumeDelayMs);
      }
      attemptResume();
    }

    function bind() {
      if (root && typeof root.addEventListener === 'function') {
        root.addEventListener('app-settings-loaded', syncMissingReminderAiTasks);
        root.addEventListener('app-settings-updated', function(event) {
          var detail = event && event.detail ? event.detail : null;
          var keys = detail && Array.isArray(detail.keys) ? detail.keys : [];
          if (!keys.length || keys.indexOf('missingCaseReminderAiEnabled') !== -1) {
            syncMissingReminderAiTasks();
          }
        });
        root.addEventListener('auto-workflow-task', function(event) {
          var detail = event && event.detail ? event.detail : null;
          syncAutoWorkflowTaskState(detail ? detail.task : null);
        });
      }
      if (root.app && root.app.settingsReady === true) syncMissingReminderAiTasks();
      resumeAutoWorkflowTaskWhenReady();
    }

    bind();

    return {
      shouldResumeMissingReminderAi: shouldResumeMissingReminderAi,
      syncMissingReminderAiTasks: syncMissingReminderAiTasks,
      syncAutoWorkflowTaskState: syncAutoWorkflowTaskState,
      resumeAutoWorkflowTaskWhenReady: resumeAutoWorkflowTaskWhenReady,
    };
  }

  return { create: create };
});
