(function(factory) {
  var taskManagerOwner = null;
  var xmindPipelineOwner = null;
  if (typeof module !== 'undefined' && module.exports) {
    taskManagerOwner = require('./persistentModelTaskManager.js');
    xmindPipelineOwner = require('../casePageXmindPipeline.js');
  } else if (typeof window !== 'undefined' && window.app) {
    taskManagerOwner = window.app.persistentModelTaskManager || null;
    xmindPipelineOwner = window.app.casePageXmindPipeline || null;
  }
  var api = factory(taskManagerOwner, xmindPipelineOwner);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.caseLibraryAiGenManager = api;
  }
})(function(defaultTaskManagerOwner, defaultXmindPipelineOwner) {
  function initCaseLibraryAiGenManager(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var callModel = typeof opts.callModelWithConfig === 'function'
      ? opts.callModelWithConfig
      : function() { return Promise.reject(new Error('模型客户端不可用，请刷新页面后重试')); };
    var taskManagerOwner = opts.taskManagerOwner || defaultTaskManagerOwner;
    var xmindPipelineOwner = opts.xmindPipelineOwner || defaultXmindPipelineOwner;
    if (!taskManagerOwner || typeof taskManagerOwner.create !== 'function') {
      throw new Error('持久任务管理器未加载');
    }
    if (!xmindPipelineOwner || typeof xmindPipelineOwner.create !== 'function') {
      throw new Error('XMind 流水线未加载');
    }

    var taskManager = null;
    var xmindPipeline = xmindPipelineOwner.create({
      callModel: callModel,
      getTask: function(scene) {
        return taskManager ? taskManager.getTask(scene) : null;
      },
      updateTask: function(scene, patch, action) {
        return taskManager ? taskManager.updateTask(scene, patch, action) : null;
      },
    });

    function executeTask(context) {
      var task = context.task;
      var model = task && task.model ? task.model : null;
      if (!model || !model.baseUrl || !model.model) {
        throw new Error('未找到用例库生成模型');
      }
      if (!context.userText) throw new Error('生成上下文缺失');
      if (task.xmindPipeline && task.xmindPipeline.enabled === true) {
        return xmindPipeline.run({
          scene: context.scene,
          task: task,
          model: model,
          userText: context.userText,
        });
      }
      return callModel(
        model,
        context.userText,
        task.prompt || '',
        task.reasoning || '',
        task.temperature
      );
    }

    taskManager = taskManagerOwner.create({
      storagePrefix: 'tap-case-library-ai-gen-task:',
      taskIdPrefix: 'case-library-ai-gen-',
      eventName: 'case-library-ai-gen-task',
      scenes: ['case-library', 'temp-exec'],
      executeTask: executeTask,
      buildSuccessPatch: function(content) { return { resultRaw: content }; },
      formatError: function(message) {
        return message ? ('AI 用例生成失败：' + message) : 'AI 用例生成失败';
      },
    });
    return taskManager;
  }

  return { init: initCaseLibraryAiGenManager };
});
