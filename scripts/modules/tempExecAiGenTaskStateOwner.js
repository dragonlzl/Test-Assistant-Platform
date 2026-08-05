(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecAiGenTaskStateOwner = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var model = opts.model;
    var store = opts.store;
    var taskRunner = opts.taskRunner;
    var toolbar = opts.toolbar;
    var getState = typeof opts.getState === 'function' ? opts.getState : function() { return {}; };
    var getManager = typeof opts.getManager === 'function' ? opts.getManager : function() { return null; };
    var callbacks = opts.callbacks && typeof opts.callbacks === 'object' ? opts.callbacks : {};
    if (!model || typeof model.resolveGenerationMode !== 'function') {
      throw new Error('temp exec AI generation task state model is required');
    }
    if (!store || typeof store.getAppendMap !== 'function') {
      throw new Error('temp exec AI generation task state store is required');
    }
    if (!taskRunner || typeof taskRunner.resolveManagedResult !== 'function') {
      throw new Error('temp exec AI generation task state runner is required');
    }
    if (!toolbar || typeof toolbar.markResultReady !== 'function') {
      throw new Error('temp exec AI generation task state toolbar is required');
    }

    function notifyStatus(text, type) {
      if (typeof callbacks.setStatus === 'function') callbacks.setStatus(text, type);
    }

    function renderState() {
      if (typeof callbacks.renderResult === 'function') callbacks.renderResult();
      toolbar.syncRunButton();
      toolbar.syncButton();
    }

    function getCurrentTask() {
      return taskRunner.getCurrentTask(state.tempExecActiveId || null);
    }

    function resolveResultToken(task) {
      if (task && task.id) return String(task.id);
      if (task && task.contextSignature) return String(task.contextSignature);
      var ai = getState();
      if (ai && ai.runToken) return String(ai.runToken);
      if (ai && ai.taskSignature) return String(ai.taskSignature);
      return '';
    }

    function shouldDiscard(task) {
      if (!task || !task.caseFileId) return true;
      var file = typeof api.getTempExecFile === 'function' ? api.getTempExecFile(task.caseFileId) : null;
      if (!file || String(file.status || '') === 'archived') return true;
      var hadVersion = Boolean(task.versionAssigned) || Boolean(task.versionIdAtRun);
      var currentVersion = file.versionId ? String(file.versionId) : '';
      return hadVersion && !currentVersion;
    }

    function finishParsedResult(ai, parsed, task, resultToken) {
      var prepared = typeof callbacks.prepareParsedResult === 'function'
        ? callbacks.prepareParsedResult(parsed)
        : parsed;
      if (prepared && prepared.error) {
        ai.error = prepared.error;
        notifyStatus('生成失败：' + prepared.error, 'err');
        ai.modules = [];
        ai.selection = new Set();
        ai.resultGeneratedCount = 0;
        ai.resultDedupeCount = 0;
      } else {
        ai.modules = prepared && Array.isArray(prepared.modules) ? prepared.modules : [];
        ai.selection = new Set();
        if (typeof callbacks.applyResultStats === 'function') callbacks.applyResultStats(ai, prepared);
        notifyStatus(model.formatCompleteStatus(ai), 'ok');
        if (resultToken && task && task.caseFileId) {
          model.applyAppendMap(ai.modules, store.getAppendMap(task.caseFileId, resultToken));
        }
        toolbar.markResultReady(resolveResultToken(task), task ? task.caseFileId : null);
      }
      renderState();
    }

    function clearDiscardedTask(ai) {
      var manager = getManager();
      if (manager && typeof manager.clearTask === 'function') manager.clearTask('temp-exec');
      ai.loading = false;
      ai.generated = false;
      ai.error = '';
      toolbar.syncButton();
      toolbar.syncAssignEntryBadge();
    }

    function applyTaskState(task) {
      var ai = getState();
      if (!task || task.scene !== 'temp-exec') return false;
      if ((task.status === 'done' || task.status === 'error') && shouldDiscard(task)) {
        clearDiscardedTask(ai);
        return false;
      }
      var fileId = state.tempExecActiveId ? String(state.tempExecActiveId) : '';
      var taskFileId = task.caseFileId ? String(task.caseFileId) : '';
      if (!fileId || !taskFileId || taskFileId !== fileId) {
        if (task.status === 'done' && !shouldDiscard(task)) {
          toolbar.markResultReady(resolveResultToken(task), task.caseFileId);
        }
        toolbar.syncAssignEntryBadge();
        return false;
      }
      var signature = task.contextSignature ? String(task.contextSignature) : '';
      if (!signature) return false;
      ai.taskSignature = signature;
      ai.taskId = task.id || '';
      ai.caseFileId = task.caseFileId || ai.caseFileId;
      ai.loading = task.status === 'running';
      ai.generated = task.status === 'done';
      ai.error = task.status === 'error' ? (task.error || '') : '';
      ai.generationMode = model.resolveGenerationMode(task.prepContext);
      if (!ai.generationMode && task.xmindPipeline && task.xmindPipeline.enabled === true) {
        ai.generationMode = 'enhanced';
      }
      if (task.requirementText && (!ai.requirementText || ai.taskSignature === signature)) {
        ai.requirementText = String(task.requirementText);
        if (typeof callbacks.setRequirementText === 'function') callbacks.setRequirementText(ai.requirementText);
      }
      if (task.requirementFileName && (!ai.requirementFileName || ai.taskSignature === signature)) {
        ai.requirementFileName = String(task.requirementFileName);
        if (typeof callbacks.setRequirementFileName === 'function') {
          callbacks.setRequirementFileName(ai.requirementFileName);
        }
      }
      if (ai.loading) {
        notifyStatus('正在生成用例...', '');
        ai.modules = [];
        ai.selection = new Set();
        renderState();
        return true;
      }
      if (ai.generated && task.resultRaw) {
        var file = typeof api.getTempExecFile === 'function' ? api.getTempExecFile(taskFileId) : null;
        var resultToken = resolveResultToken(task);
        if (resultToken) store.resetAppendRecord(task.caseFileId, resultToken);
        var resolution = taskRunner.resolveManagedResult(task, {
          sourceCases: file && Array.isArray(file.cases) ? file.cases : [],
        });
        if (resolution && resolution.kind === 'ready') {
          finishParsedResult(ai, resolution.parsed, task, resultToken);
          return true;
        }
        if (resolution && resolution.kind === 'pending') {
          if (resolution.started === true) {
            if (resolution.semanticDedupe === true) notifyStatus('正在进行 AI 语义去重...', '');
            resolution.promise.then(function(parsed) {
              var currentTask = getCurrentTask();
              if (!currentTask || currentTask.id !== task.id) return;
              finishParsedResult(ai, parsed, task, resultToken);
            });
          }
          return true;
        }
        return true;
      }
      if (ai.error) notifyStatus(ai.error, 'err');
      renderState();
      return true;
    }

    function syncTaskState(force) {
      var task = taskRunner.resume(force === true);
      var currentId = state.tempExecActiveId || null;
      if (currentId) toolbar.syncBadgeForFile(currentId);
      if (!task) return false;
      return applyTaskState(task);
    }

    return {
      resolveResultToken: resolveResultToken,
      shouldDiscard: shouldDiscard,
      finishParsedResult: finishParsedResult,
      applyTaskState: applyTaskState,
      syncTaskState: syncTaskState,
      getCurrentTask: getCurrentTask,
    };
  }

  return { create: create };
});
