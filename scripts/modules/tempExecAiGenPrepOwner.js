(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.tempExecAiGenPrepOwner = api;
  }
})(function() {
  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    var api = opts.api && typeof opts.api === 'object' ? opts.api : {};
    var view = opts.view;
    var toolbar = opts.toolbar;
    var taskState = opts.taskState;
    var getState = typeof opts.getState === 'function' ? opts.getState : function() { return {}; };
    var getPrepApi = typeof opts.getPrepApi === 'function' ? opts.getPrepApi : function() { return null; };
    var getAssignedModel = typeof opts.getAssignedModel === 'function' ? opts.getAssignedModel : function() { return null; };
    var getRequirementText = typeof opts.getRequirementText === 'function'
      ? opts.getRequirementText
      : function(ai) { return ai && ai.requirementText ? ai.requirementText : ''; };
    var syncContext = typeof opts.syncContext === 'function' ? opts.syncContext : function() {};
    var discardResult = typeof opts.discardResult === 'function' ? opts.discardResult : function() {};
    var run = typeof opts.run === 'function' ? opts.run : function() {};
    var showToast = typeof opts.showToast === 'function' ? opts.showToast : function() {};
    var openConfirmDrawer = typeof opts.openConfirmDrawer === 'function'
      ? opts.openConfirmDrawer
      : function() { return Promise.resolve({ ok: false }); };
    if (!view || typeof view.openDrawer !== 'function' || typeof view.closeDrawer !== 'function') {
      throw new Error('temp exec AI generation prep view is required');
    }
    if (!toolbar || typeof toolbar.resolveDisabledReason !== 'function') {
      throw new Error('temp exec AI generation prep toolbar is required');
    }
    if (!taskState || typeof taskState.syncTaskState !== 'function') {
      throw new Error('temp exec AI generation prep task state is required');
    }

    function getCurrentFile() {
      if (typeof api.getTempExecFile !== 'function') return null;
      var currentId = state.tempExecActiveId !== undefined && state.tempExecActiveId !== null
        ? state.tempExecActiveId
        : '';
      var file = api.getTempExecFile(currentId);
      if (file || currentId === '') return file;
      if (typeof currentId === 'string') {
        var numericId = Number(currentId);
        if (!isNaN(numericId)) return api.getTempExecFile(numericId);
      } else if (typeof currentId === 'number') {
        return api.getTempExecFile(String(currentId));
      }
      return null;
    }

    function shouldOpenDrawerDirect() {
      var ai = getState();
      if (ai.loading === true) return true;
      var task = taskState.getCurrentTask();
      if (task) {
        var status = String(task.status || '');
        if (status === 'running' || status === 'done' || status === 'error') return true;
      }
      if (ai.generated === true) {
        if (Array.isArray(ai.modules) && ai.modules.length) return true;
        if (ai.error) return true;
        if (ai.resultToken || ai.taskSignature) return true;
      }
      return false;
    }

    function showDisabledReason(reason) {
      if (reason === 'no-case') {
        showToast('请先选择执行用例。', 'warn');
        return true;
      }
      if (reason === 'archived') {
        showToast('该用例已归档，无法生成。', 'warn');
        return true;
      }
      if (reason === 'no-model') {
        showToast('请到AI功能-功能指派 页面下，配置该功能模型。', 'warn');
        return true;
      }
      return false;
    }

    function open(optionsValue) {
      var openOptions = optionsValue && typeof optionsValue === 'object' ? optionsValue : {};
      var reason = toolbar.resolveDisabledReason();
      if (reason === 'no-case' || reason === 'archived') {
        showDisabledReason(reason);
        return false;
      }
      if (openOptions.forcePrep !== true) {
        taskState.syncTaskState(true);
        if (shouldOpenDrawerDirect()) {
          view.openDrawer();
          return true;
        }
      }
      if (reason === 'no-model') {
        showDisabledReason(reason);
        return false;
      }
      var prepApi = getPrepApi();
      if (!prepApi || typeof prepApi.open !== 'function') {
        showToast('生成准备模块不可用，请刷新页面后重试。', 'err');
        return false;
      }
      var model = getAssignedModel();
      if (!model) {
        showDisabledReason('no-model');
        return false;
      }
      var currentFile = getCurrentFile();
      if (!currentFile || !Array.isArray(currentFile.cases)) {
        showToast('未找到执行用例内容。', 'warn');
        return false;
      }
      if (openOptions.closeDrawerBeforePrep === true) view.closeDrawer();
      if (openOptions.discardExisting === true) discardResult({ keepRequirement: true, silent: true });
      var ai = getState();
      var assignments = state.assignments || {};
      toolbar.clearResultBadge();
      syncContext();
      return prepApi.open({
        scene: 'temp-exec',
        caseFileId: currentFile.id || '',
        displayName: currentFile.name || currentFile.file_name_clean || '当前执行用例',
        projectId: currentFile.projectId || currentFile.project_id || '',
        versionId: currentFile.versionId || currentFile.version_id || '',
        cases: currentFile.cases || [],
        requirementText: getRequirementText(ai) || ai.requirementText || '',
        requirementSupplement: '',
        model: model,
        reasoning: assignments.caseLibraryGenReasoning || '',
        temperature: assignments.caseLibraryGenTemperature !== undefined
          ? assignments.caseLibraryGenTemperature
          : 0.2,
      }).then(function(result) {
        if (!result || result.ok !== true || !result.value) return false;
        view.openDrawer();
        run(result.value);
        toolbar.clearResultBadge();
        return true;
      }).catch(function(err) {
        showToast('打开生成准备失败：' + (err && err.message ? err.message : '未知错误'), 'err');
        return false;
      });
    }

    function regenerate() {
      return openConfirmDrawer({
        title: '确认重新生成',
        message: '重新生成会丢弃当前这批 AI 生成结果，且无法恢复。确认继续吗？',
        hint: '原有用例和已经追加保存的用例不会被删除。',
        hintType: 'warn',
        confirmText: '确认重新生成',
        cancelText: '取消',
        danger: true,
        previousDrawer: view.getDrawerReference(),
      }).then(function(result) {
        if (!result || result.ok !== true) return false;
        return open({ forcePrep: true, discardExisting: true, closeDrawerBeforePrep: true });
      });
    }

    return {
      getCurrentFile: getCurrentFile,
      shouldOpenDrawerDirect: shouldOpenDrawerDirect,
      open: open,
      regenerate: regenerate,
    };
  }

  return { create: create };
});
