(function(factory) {
  var taskManagerOwner = null;
  if (typeof module !== 'undefined' && module.exports) {
    taskManagerOwner = require('./persistentModelTaskManager.js');
  } else if (typeof window !== 'undefined' && window.app) {
    taskManagerOwner = window.app.persistentModelTaskManager || null;
  }
  var api = factory(taskManagerOwner);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.missingReminderAiManager = api;
  }
})(function(defaultTaskManagerOwner) {
  function initMissingReminderAiManager(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var utils = opts.utils || {};
    var callModel = typeof opts.callModelWithConfig === 'function'
      ? opts.callModelWithConfig
      : async function missingCall() {
        throw new Error('模型客户端不可用，请刷新页面后重试');
      };
    var taskManagerOwner = opts.taskManagerOwner || defaultTaskManagerOwner;
    if (!taskManagerOwner || typeof taskManagerOwner.create !== 'function') {
      throw new Error('持久任务管理器未加载');
    }

    function parseTaskIds(content) {
      var raw = content || '';
      var stripped = typeof utils.stripCodeFence === 'function'
        ? utils.stripCodeFence(raw)
        : String(raw || '').trim();
      var payloadText = typeof utils.extractJsonPayload === 'function'
        ? utils.extractJsonPayload(stripped)
        : '';
      var data = JSON.parse(payloadText || stripped);
      var ids = data && Array.isArray(data.ids) ? data.ids : [];
      return ids.map(function(id) { return String(id).trim(); }).filter(Boolean);
    }

    function executeTask(context) {
      var task = context.task;
      var model = task && task.model ? task.model : null;
      if (!model || !model.baseUrl || !model.model) {
        throw new Error('未找到易漏用例推荐模型');
      }
      if (!context.userText) throw new Error('推荐上下文缺失');
      return callModel(
        model,
        context.userText,
        task.prompt || '',
        task.reasoning || '',
        task.temperature
      );
    }

    return taskManagerOwner.create({
      storagePrefix: 'tap-missing-reminder-ai-task:',
      taskIdPrefix: 'missing-reminder-ai-',
      eventName: 'missing-reminder-ai-task',
      scenes: ['case-library', 'temp-exec'],
      executeTask: executeTask,
      buildSuccessPatch: function(content) { return { resultIds: parseTaskIds(content) }; },
      formatError: function(message) {
        return message ? ('AI 推荐失败：' + message) : 'AI 推荐失败';
      },
    });
  }

  return { init: initMissingReminderAiManager };
});
